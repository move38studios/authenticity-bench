/**
 * Executor
 *
 * Processes judgment batches per provider with concurrency control.
 * Handles all three judgment modes, pause/cancel gates, and DB writes.
 */

import { db } from "@/lib/db";
import {
  experiment,
  judgment,
} from "@/lib/db/schema/experiment";
import {
  modelConfig,
  dilemma,
  valuesSystem,
  mentalTechnique,
  modifier,
} from "@/lib/db/schema/content";
import { eq, inArray, and, sql } from "drizzle-orm";
import { generateText as aiSdkGenerateText, type LanguageModel } from "ai";
import { z } from "zod/v4";
import { jsonSchema } from "ai";
import { getModel } from "@/lib/services/llm";
import {
  buildSystemPrompt,
  buildTheoryUserPrompt,
  buildActionUserPrompt,
  buildActionTools,
  buildInquiryTools,
  type ActionToolDefinition,
} from "./prompt-assembler";
import { extractTheoryJudgment } from "./theory-extractor";
import { parseActionToolCall, parseInquiryResult } from "./response-parser";
import { estimateJudgmentCost } from "./cost-estimator";
import type {
  JudgmentMode,
  DilemmaOption,
  ConversationMessage,
  InquiryToolCallSummary,
} from "./types";

// =============================================================================
// CONSTANTS
// =============================================================================

const CONCURRENCY_PER_PROVIDER = 5;
const MAX_INQUIRY_TURNS = 10;
const MAX_TEXT_NUDGES = 2;

// =============================================================================
// TYPES
// =============================================================================

interface JudgmentRow {
  id: string;
  experimentId: string;
  dilemmaId: string;
  modelConfigId: string;
  valuesSystemId: string | null;
  mentalTechniqueIds: string[];
  modifierIds: string[];
  judgmentMode: string;
  noiseIndex: number;
  userPrompt: string | null;
  status: string;
}

interface JudgmentContext {
  model: LanguageModel;
  modelFullId: string;
  dilemmaRow: {
    scenario: string;
    options: DilemmaOption[];
    inquiryTools: unknown[] | null;
  };
  systemPrompt: string;
  userPrompt: string;
  mode: JudgmentMode;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolSet = Record<string, any>;

// =============================================================================
// PAUSE / CANCEL GATE
// =============================================================================

type ExperimentStatus =
  | "running"
  | "paused"
  | "cancelled"
  | "failed"
  | "completed"
  | "draft";

async function checkExperimentStatus(
  experimentId: string
): Promise<ExperimentStatus> {
  const row = await db.query.experiment.findFirst({
    where: eq(experiment.id, experimentId),
    columns: { status: true },
  });
  return (row?.status ?? "failed") as ExperimentStatus;
}

async function waitIfPaused(experimentId: string): Promise<boolean> {
  let status = await checkExperimentStatus(experimentId);

  while (status === "paused") {
    await new Promise((r) => setTimeout(r, 30_000));
    status = await checkExperimentStatus(experimentId);
  }

  return status === "running";
}

// =============================================================================
// CONTENT CACHE
// =============================================================================

class ContentCache {
  private models = new Map<string, typeof modelConfig.$inferSelect>();
  private dilemmas = new Map<string, typeof dilemma.$inferSelect>();
  private valuesSystems = new Map<
    string,
    typeof valuesSystem.$inferSelect
  >();
  private techniques = new Map<
    string,
    typeof mentalTechnique.$inferSelect
  >();
  private modifiers = new Map<string, typeof modifier.$inferSelect>();

  async getModel(id: string) {
    if (!this.models.has(id)) {
      const row = await db.query.modelConfig.findFirst({
        where: eq(modelConfig.id, id),
      });
      if (row) this.models.set(id, row);
    }
    return this.models.get(id)!;
  }

  async getDilemma(id: string) {
    if (!this.dilemmas.has(id)) {
      const row = await db.query.dilemma.findFirst({
        where: eq(dilemma.id, id),
      });
      if (row) this.dilemmas.set(id, row);
    }
    return this.dilemmas.get(id)!;
  }

  async getValuesSystem(id: string) {
    if (!this.valuesSystems.has(id)) {
      const row = await db.query.valuesSystem.findFirst({
        where: eq(valuesSystem.id, id),
      });
      if (row) this.valuesSystems.set(id, row);
    }
    return this.valuesSystems.get(id)!;
  }

  async getTechnique(id: string) {
    if (!this.techniques.has(id)) {
      const row = await db.query.mentalTechnique.findFirst({
        where: eq(mentalTechnique.id, id),
      });
      if (row) this.techniques.set(id, row);
    }
    return this.techniques.get(id)!;
  }

  async getModifier(id: string) {
    if (!this.modifiers.has(id)) {
      const row = await db.query.modifier.findFirst({
        where: eq(modifier.id, id),
      });
      if (row) this.modifiers.set(id, row);
    }
    return this.modifiers.get(id)!;
  }
}

// =============================================================================
// BUILD JUDGMENT CONTEXT
// =============================================================================

async function buildContext(
  row: JudgmentRow,
  cache: ContentCache
): Promise<JudgmentContext> {
  const mc = await cache.getModel(row.modelConfigId);
  const d = await cache.getDilemma(row.dilemmaId);
  const options = d.options as DilemmaOption[];
  const mode = row.judgmentMode as JudgmentMode;

  let valuesContent: string | null = null;
  if (row.valuesSystemId) {
    const vs = await cache.getValuesSystem(row.valuesSystemId);
    valuesContent = vs.content;
  }

  const techniqueIds = row.mentalTechniqueIds as string[];
  const techniqueContents: string[] = [];
  for (const id of techniqueIds) {
    const t = await cache.getTechnique(id);
    techniqueContents.push(t.content);
  }

  const modifierIds = row.modifierIds as string[];
  const modifierContents: string[] = [];
  for (const id of modifierIds) {
    const m = await cache.getModifier(id);
    modifierContents.push(m.content);
  }

  const systemPrompt = buildSystemPrompt({
    mode,
    valuesSystemContent: valuesContent,
    mentalTechniqueContents: techniqueContents,
    modifierContents: modifierContents,
  });

  const scenario = row.userPrompt ?? d.scenario;
  const userPrompt =
    mode === "theory"
      ? buildTheoryUserPrompt(scenario, options)
      : buildActionUserPrompt(scenario);

  const modelFullId = `${mc.provider}/${mc.modelId}`;
  const model = await getModel(modelFullId);

  return {
    model,
    modelFullId,
    dilemmaRow: {
      scenario: d.scenario,
      options,
      inquiryTools: d.inquiryTools as unknown[] | null,
    },
    systemPrompt,
    userPrompt,
    mode,
  };
}

// =============================================================================
// TOOL BUILDING
// =============================================================================

const actionToolSchema = {
  type: "object" as const,
  properties: {
    reasoning: {
      type: "string" as const,
      description: "Your reasoning for this action",
    },
    confidence: {
      type: "number" as const,
      description: "Your confidence in this decision (0.0 to 1.0)",
    },
  },
  required: ["reasoning"],
};

function buildAiSdkTools(actionTools: ActionToolDefinition[]): AnyToolSet {
  const tools: AnyToolSet = {};
  for (const at of actionTools) {
    tools[at.name] = {
      description: at.description,
      parameters: jsonSchema(actionToolSchema),
    };
  }
  return tools;
}

function buildAllInquiryTools(
  actionTools: ActionToolDefinition[],
  inquiryToolDefs: Array<{
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
    response: string;
  }>
): AnyToolSet {
  const tools = buildAiSdkTools(actionTools);

  for (const it of inquiryToolDefs) {
    tools[it.name] = {
      description: it.description,
      parameters: jsonSchema(
        it.parameters ?? { type: "object", properties: {} }
      ),
    };
  }

  return tools;
}

// =============================================================================
// HELPER: extract tool call info
// =============================================================================

function extractToolCalls(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resultToolCalls: any[] | undefined
): Array<{ name: string; arguments: Record<string, unknown>; id: string }> {
  if (!resultToolCalls?.length) return [];
  return resultToolCalls.map((tc) => ({
    name: tc.toolName as string,
    arguments: (tc.input ?? tc.args ?? {}) as Record<string, unknown>,
    id: (tc.toolCallId ?? "") as string,
  }));
}

// =============================================================================
// EXECUTE: THEORY MODE
// =============================================================================

async function executeTheory(ctx: JudgmentContext) {
  const startTime = Date.now();

  const result = await aiSdkGenerateText({
    model: ctx.model,
    system: ctx.systemPrompt,
    prompt: ctx.userPrompt,
  });

  const latencyMs = Date.now() - startTime;
  const rawText = result.text;

  const extraction = await extractTheoryJudgment(
    rawText,
    ctx.dilemmaRow.options
  );

  const conversationLog: ConversationMessage[] = [
    { role: "system", content: ctx.systemPrompt },
    { role: "user", content: ctx.userPrompt },
    { role: "assistant", content: rawText },
  ];

  const isRefused =
    extraction.refusalType === "hard" || extraction.refusalType === "soft";

  return {
    status: isRefused ? ("refused" as const) : ("completed" as const),
    refusalType: extraction.refusalType,
    choice: extraction.choice,
    reasoning: extraction.reasoning,
    confidence: extraction.confidence,
    conversationLog,
    rawResponse: { text: rawText },
    inquiryToolCalls: null,
    errorMessage: isRefused ? `${extraction.refusalType} refusal` : null,
    latencyMs,
    promptTokens: result.usage?.inputTokens ?? 0,
    completionTokens: result.usage?.outputTokens ?? 0,
    reasoningTokens: 0,
    costEstimate: estimateJudgmentCost(
      ctx.modelFullId,
      result.usage?.inputTokens ?? 0,
      result.usage?.outputTokens ?? 0
    ),
  };
}

// =============================================================================
// EXECUTE: SINGLE-SHOT ACTION MODE
// =============================================================================

async function executeSingleShotAction(ctx: JudgmentContext) {
  const startTime = Date.now();
  const actionTools = buildActionTools(ctx.dilemmaRow.options);
  const aiTools = buildAiSdkTools(actionTools);

  const result = await aiSdkGenerateText({
    model: ctx.model,
    system: ctx.systemPrompt,
    prompt: ctx.userPrompt,
    tools: aiTools,
    toolChoice: "auto",
  });

  const latencyMs = Date.now() - startTime;
  const toolCalls = extractToolCalls(result.toolCalls);

  const parsed = parseActionToolCall(
    toolCalls.length > 0 ? toolCalls : undefined,
    actionTools,
    result.text
  );

  const conversationLog: ConversationMessage[] = [
    { role: "system", content: ctx.systemPrompt },
    { role: "user", content: ctx.userPrompt },
    {
      role: "assistant",
      content: result.text ?? "",
      toolCalls: toolCalls.map((tc) => ({
        id: tc.id,
        name: tc.name,
        arguments: tc.arguments,
      })),
    },
  ];

  const isRefused =
    parsed.refusalType === "hard" || parsed.refusalType === "soft";

  return {
    status: isRefused ? ("refused" as const) : ("completed" as const),
    refusalType: parsed.refusalType,
    choice: parsed.choice,
    reasoning: parsed.reasoning,
    confidence: parsed.confidence,
    conversationLog,
    rawResponse: { text: result.text, toolCalls },
    inquiryToolCalls: null,
    errorMessage: isRefused ? `${parsed.refusalType} refusal` : null,
    latencyMs,
    promptTokens: result.usage?.inputTokens ?? 0,
    completionTokens: result.usage?.outputTokens ?? 0,
    reasoningTokens: 0,
    costEstimate: estimateJudgmentCost(
      ctx.modelFullId,
      result.usage?.inputTokens ?? 0,
      result.usage?.outputTokens ?? 0
    ),
  };
}

// =============================================================================
// EXECUTE: INQUIRY-TO-ACTION MODE
// =============================================================================

async function executeInquiryToAction(ctx: JudgmentContext) {
  const startTime = Date.now();
  const actionTools = buildActionTools(ctx.dilemmaRow.options);
  const rawInquiryTools = (ctx.dilemmaRow.inquiryTools ?? []) as Array<{
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
    response: string;
  }>;
  const inquiryToolDefs = buildInquiryTools(rawInquiryTools);
  const aiTools = buildAllInquiryTools(actionTools, rawInquiryTools);

  const actionToolNames = new Set(actionTools.map((t) => t.name));
  const inquiryToolMap = new Map(inquiryToolDefs.map((t) => [t.name, t]));

  const conversationLog: ConversationMessage[] = [
    { role: "system", content: ctx.systemPrompt },
    { role: "user", content: ctx.userPrompt },
  ];
  const inquiryCallSummaries: InquiryToolCallSummary[] = [];

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let textNudges = 0;
  let finalToolCalls:
    | Array<{ name: string; arguments: Record<string, unknown> }>
    | undefined;
  let finalText = "";

  // Use response.messages for multi-turn (AI SDK manages the message array)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let messages: any[] = [{ role: "user", content: ctx.userPrompt }];

  for (let turn = 0; turn < MAX_INQUIRY_TURNS; turn++) {
    const result = await aiSdkGenerateText({
      model: ctx.model,
      system: ctx.systemPrompt,
      messages,
      tools: aiTools,
      toolChoice: "auto",
    });

    totalPromptTokens += result.usage?.inputTokens ?? 0;
    totalCompletionTokens += result.usage?.outputTokens ?? 0;

    const toolCalls = extractToolCalls(result.toolCalls);
    finalText = result.text ?? "";

    // Record assistant message
    conversationLog.push({
      role: "assistant",
      content: finalText,
      toolCalls: toolCalls.map((tc) => ({
        id: tc.id,
        name: tc.name,
        arguments: tc.arguments,
      })),
    });

    if (toolCalls.length === 0) {
      // Text-only response — add to messages and nudge
      messages.push({ role: "assistant", content: finalText });
      textNudges++;
      if (textNudges > MAX_TEXT_NUDGES) break;
      const nudge =
        "Please use one of the available tools to take action on this situation.";
      messages.push({ role: "user", content: nudge });
      conversationLog.push({ role: "user", content: nudge });
      continue;
    }

    // Check for action tool call
    const hasAction = toolCalls.some((tc) => actionToolNames.has(tc.name));

    if (hasAction) {
      finalToolCalls = toolCalls.map((tc) => ({
        name: tc.name,
        arguments: tc.arguments,
      }));
      break;
    }

    // Inquiry tools only — return pre-programmed responses and continue
    // Build assistant message with tool calls
    messages.push({
      role: "assistant",
      content: toolCalls.map((tc) => ({
        type: "tool-call",
        toolCallId: tc.id,
        toolName: tc.name,
        args: tc.arguments,
      })),
    });

    // Build tool result messages
    const toolResultParts = toolCalls.map((tc) => {
      const inquiryTool = inquiryToolMap.get(tc.name);
      const response = inquiryTool?.response ?? "No information available.";

      inquiryCallSummaries.push({
        turn: turn + 1,
        name: tc.name,
        params: tc.arguments,
        responsePreview: response.slice(0, 200),
      });

      conversationLog.push({
        role: "tool",
        content: response,
        toolResults: [{ id: tc.id, name: tc.name, result: response }],
      });

      return {
        type: "tool-result",
        toolCallId: tc.id,
        toolName: tc.name,
        result: response,
      };
    });

    messages.push({ role: "tool", content: toolResultParts });
  }

  const latencyMs = Date.now() - startTime;

  const parsed = parseInquiryResult(
    finalToolCalls,
    actionTools,
    inquiryCallSummaries,
    finalText
  );

  const isRefused =
    parsed.refusalType === "hard" || parsed.refusalType === "soft";

  return {
    status: isRefused ? ("refused" as const) : ("completed" as const),
    refusalType: parsed.refusalType,
    choice: parsed.choice,
    reasoning: parsed.reasoning,
    confidence: parsed.confidence,
    conversationLog,
    rawResponse: { text: finalText, toolCalls: finalToolCalls },
    inquiryToolCalls:
      inquiryCallSummaries.length > 0 ? inquiryCallSummaries : null,
    errorMessage: isRefused ? `${parsed.refusalType} refusal` : null,
    latencyMs,
    promptTokens: totalPromptTokens,
    completionTokens: totalCompletionTokens,
    reasoningTokens: 0,
    costEstimate: estimateJudgmentCost(
      ctx.modelFullId,
      totalPromptTokens,
      totalCompletionTokens
    ),
  };
}

// =============================================================================
// EXECUTE SINGLE JUDGMENT
// =============================================================================

async function executeSingleJudgment(row: JudgmentRow, cache: ContentCache) {
  await db
    .update(judgment)
    .set({ status: "running" })
    .where(eq(judgment.id, row.id));

  try {
    const ctx = await buildContext(row, cache);

    let result;
    switch (ctx.mode) {
      case "theory":
        result = await executeTheory(ctx);
        break;
      case "single-shot-action":
        result = await executeSingleShotAction(ctx);
        break;
      case "inquiry-to-action":
        result = await executeInquiryToAction(ctx);
        break;
    }

    await db
      .update(judgment)
      .set({
        status: result.status,
        refusalType: result.refusalType,
        choice: result.choice,
        reasoning: result.reasoning,
        confidence: result.confidence,
        conversationLog: result.conversationLog,
        rawResponse: result.rawResponse,
        inquiryToolCalls: result.inquiryToolCalls,
        systemPrompt: ctx.systemPrompt,
        errorMessage: result.errorMessage,
        latencyMs: result.latencyMs,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        reasoningTokens: result.reasoningTokens,
        costEstimate: result.costEstimate,
      })
      .where(eq(judgment.id, row.id));

    const counterField =
      result.status === "completed" || result.status === "refused"
        ? "completedCount"
        : "failedCount";

    await db
      .update(experiment)
      .set({
        [counterField]: sql`${experiment[counterField]} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(experiment.id, row.experimentId));

    return result.status;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);

    const isApiRefusal =
      message.includes("content_filter") ||
      message.includes("content_policy") ||
      message.includes("safety") ||
      (e instanceof Error &&
        "status" in e &&
        ((e as { status: number }).status === 400 ||
          (e as { status: number }).status === 403));

    await db
      .update(judgment)
      .set({
        status: isApiRefusal ? "refused" : "error",
        refusalType: isApiRefusal ? "hard" : null,
        errorMessage: message,
      })
      .where(eq(judgment.id, row.id));

    await db
      .update(experiment)
      .set({
        [isApiRefusal ? "completedCount" : "failedCount"]: sql`${
          isApiRefusal ? experiment.completedCount : experiment.failedCount
        } + 1`,
        updatedAt: new Date(),
      })
      .where(eq(experiment.id, row.experimentId));

    return isApiRefusal ? "refused" : "error";
  }
}

// =============================================================================
// EXECUTE PROVIDER BATCH
// =============================================================================

export async function executeProviderBatch(
  experimentId: string,
  judgmentIds: string[]
): Promise<{ completed: number; refused: number; errors: number }> {
  const cache = new ContentCache();
  let completed = 0;
  let refused = 0;
  let errors = 0;

  for (let i = 0; i < judgmentIds.length; i += CONCURRENCY_PER_PROVIDER) {
    const shouldContinue = await waitIfPaused(experimentId);
    if (!shouldContinue) break;

    const batchIds = judgmentIds.slice(i, i + CONCURRENCY_PER_PROVIDER);

    const rows = await db
      .select()
      .from(judgment)
      .where(
        and(inArray(judgment.id, batchIds), eq(judgment.status, "pending"))
      );

    const results = await Promise.all(
      rows.map((row) =>
        executeSingleJudgment(row as unknown as JudgmentRow, cache)
      )
    );

    for (const status of results) {
      if (status === "completed") completed++;
      else if (status === "refused") refused++;
      else errors++;
    }
  }

  return { completed, refused, errors };
}
