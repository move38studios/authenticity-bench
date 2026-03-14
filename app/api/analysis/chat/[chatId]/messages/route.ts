/**
 * POST /api/analysis/chat/[chatId]/messages — Send message (streaming)
 *
 * Main chat endpoint with tool execution, message persistence,
 * image injection via prepareStep, and context windowing.
 */

import { NextRequest } from "next/server";
import { getSession, unauthorized, notFound, forbidden } from "@/lib/api/helpers";
import { db } from "@/lib/db";
import { analysisChat, analysisChatMessage } from "@/lib/db/schema/analysis-chat";
import { modelConfig } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { streamText, stepCountIs, convertToModelMessages, type UIMessage } from "ai";
import { z } from "zod/v4";
import { randomUUID } from "crypto";
import { getModel } from "@/lib/services/llm";
import { getPrompt } from "@/lib/services/prompts";
import { createAnalysisSandbox, SCHEMA_DESCRIPTION } from "@/lib/services/analysis/sandbox";
import { listExperimentsTool } from "@/lib/services/analysis/tools/list-experiments";
import { createLoadExperimentTool } from "@/lib/services/analysis/tools/load-experiment";
import { createExecutePythonTool } from "@/lib/services/analysis/tools/execute-python";
import { viewImageTool } from "@/lib/services/analysis/tools/viewimage";
import { windowMessages, compressToolOutputs, buildSummaryPrompt } from "@/lib/services/analysis/context";
import type { Sandbox } from "@vercel/sandbox";

export const maxDuration = 300; // 5 minutes

const DEFAULT_ANALYSIS_MODEL = "google/gemini-3.1-flash-lite-preview";

interface LoadedExperiment {
  experimentId: string;
  blobUrl: string;
  name: string;
  loadedAt: string;
}

/**
 * Normalize old "tool-invocation" parts to the "tool-{name}" format
 * that convertToModelMessages expects.
 */
function normalizeParts(parts: Array<Record<string, unknown>>): UIMessage["parts"] {
  return parts.map((part) => {
    if (part.type === "tool-invocation" && part.toolName) {
      return {
        type: `tool-${part.toolName}`,
        toolCallId: part.toolCallId,
        state: part.state === "result" ? "output-available" : part.state,
        input: part.args ?? part.input ?? {},
        output: part.result ?? part.output,
      } as unknown as UIMessage["parts"][number];
    }
    return part as unknown as UIMessage["parts"][number];
  });
}

function extractTextContent(parts: unknown[]): string {
  return parts
    .filter((p): p is { type: string; text: string } =>
      typeof p === "object" && p !== null && "type" in p && "text" in p && (p as { type: string }).type === "text"
    )
    .map((p) => p.text)
    .join(" ")
    .slice(0, 10000);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { chatId } = await params;

  // Load chat
  const chat = await db.query.analysisChat.findFirst({
    where: eq(analysisChat.id, chatId),
  });
  if (!chat) return notFound("Chat");
  if (chat.userId !== session.user.id && !chat.sharingEnabled) {
    return forbidden();
  }

  // Read model from header, validate against DB
  const requestedModel = request.headers.get("x-model-id") || DEFAULT_ANALYSIS_MODEL;
  let analysisModel = DEFAULT_ANALYSIS_MODEL;
  if (requestedModel !== DEFAULT_ANALYSIS_MODEL) {
    const match = await db.query.modelConfig.findFirst({
      where: eq(modelConfig.modelId, requestedModel),
      columns: { modelId: true },
    });
    analysisModel = match ? requestedModel : DEFAULT_ANALYSIS_MODEL;
  } else {
    analysisModel = DEFAULT_ANALYSIS_MODEL;
  }

  const { messages: clientMessages } = (await request.json()) as {
    messages: UIMessage[];
  };

  // Load existing messages from DB
  const dbMessages = await db.query.analysisChatMessage.findMany({
    where: eq(analysisChatMessage.chatId, chatId),
    orderBy: [asc(analysisChatMessage.createdAt)],
  });

  // Convert DB messages to UIMessage format, normalizing old tool part formats
  const existingMessages: UIMessage[] = dbMessages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    parts: normalizeParts(m.parts as Array<Record<string, unknown>>),
    createdAt: m.createdAt,
  }));

  // The client sends the full message list including the new user message.
  // We use existing DB messages + the last client message (the new one).
  const lastClientMessage = clientMessages[clientMessages.length - 1];
  const allMessages = [...existingMessages];
  if (lastClientMessage && lastClientMessage.role === "user") {
    allMessages.push(lastClientMessage);
  }

  // Build system prompt
  const baseSystemPrompt = await getPrompt("analysis_system");
  const loadedExperiments = (chat.loadedExperiments as LoadedExperiment[]) ?? [];

  let systemPrompt = baseSystemPrompt + "\n\n" + SCHEMA_DESCRIPTION;

  // Add loaded experiments context
  if (loadedExperiments.length > 0) {
    const expList = loadedExperiments
      .map((e) => `- "${e.name}" (id: ${e.experimentId})`)
      .join("\n");
    systemPrompt += `\n\n## Currently Loaded Experiments\n${expList}\n\nThese experiments are already available in the sandbox. You can query them directly.`;
  }

  // Context windowing
  const systemTokens = Math.ceil(systemPrompt.length / 4);

  // Inject summary if we have one from previous turns
  if (chat.summary) {
    systemPrompt += `\n\n## Previous Conversation Summary\n${chat.summary}`;
  }

  const windowed = windowMessages(allMessages, systemTokens);
  const compressedMessages = compressToolOutputs(windowed.messages);

  // Lazy sandbox — only created when a tool needs it
  const sandboxRef: { instance: Sandbox | null } = { instance: null };

  async function getSandbox(): Promise<Sandbox> {
    if (sandboxRef.instance) return sandboxRef.instance;

    const sb = await createAnalysisSandbox();

    // Re-download previously loaded experiments into sandbox
    for (const exp of loadedExperiments) {
      try {
        const response = await fetch(exp.blobUrl);
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          const safeName = exp.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50).toLowerCase();
          await sb.writeFiles([
            { path: `data/${safeName}.db`, content: buffer },
          ]);
        }
      } catch {
        // If we can't download, the agent can re-load via load_experiment tool
      }
    }

    sandboxRef.instance = sb;
    return sb;
  }

  try {
    const model = await getModel(analysisModel);

    const executionCounter = { count: 0 };

    const result = streamText({
      model,
      system: systemPrompt,
      messages: await convertToModelMessages(compressedMessages),
      tools: {
        list_experiments: listExperimentsTool,
        load_experiment: createLoadExperimentTool(getSandbox, chatId),
        execute_python: createExecutePythonTool(getSandbox, chatId, executionCounter),
        viewimage: viewImageTool,
      },
      stopWhen: stepCountIs(15),

      // Inject images from tool results so the LLM can see charts
      prepareStep: async ({ steps, messages: currentMessages }) => {
        const lastStep = steps[steps.length - 1];
        if (!lastStep?.toolResults?.length) return undefined;

        const imageUrls: string[] = [];

        for (const toolResult of lastStep.toolResults) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const r = toolResult as any;

          if (r.toolName === "viewimage" && r.output?.url) {
            imageUrls.push(r.output.url);
          }

          // execute_python may return files with image URLs
          if (r.toolName === "execute_python" && r.output?.files) {
            for (const file of r.output.files) {
              if (file.contentType?.startsWith("image/")) {
                imageUrls.push(file.url);
              }
            }
          }
        }

        if (imageUrls.length === 0) return undefined;

        return {
          messages: [
            ...currentMessages,
            {
              role: "user" as const,
              content: imageUrls.map((url) => ({
                type: "image" as const,
                image: new URL(url),
              })),
            },
          ],
        };
      },

      onFinish: async ({ response, usage }) => {
        try {
          // Save user message
          if (lastClientMessage && lastClientMessage.role === "user") {
            await db
              .insert(analysisChatMessage)
              .values({
                id: lastClientMessage.id || randomUUID(),
                chatId,
                role: "user",
                parts: lastClientMessage.parts,
                content: extractTextContent(lastClientMessage.parts as unknown[]),
                createdAt: new Date(),
              })
              .onConflictDoNothing();
          }

          // Build tool call map from response.messages
          const toolCallMap = new Map<
            string,
            { toolName: string; toolCallId: string; input: unknown; output?: unknown }
          >();

          for (const msg of response.messages) {
            if (msg.role === "assistant" && Array.isArray(msg.content)) {
              for (const part of msg.content) {
                if (part.type === "tool-call") {
                  const p = part as { toolCallId: string; toolName: string; input: unknown };
                  toolCallMap.set(p.toolCallId, {
                    toolName: p.toolName,
                    toolCallId: p.toolCallId,
                    input: p.input,
                  });
                }
              }
            } else if (msg.role === "tool" && Array.isArray(msg.content)) {
              for (const tr of msg.content) {
                if (tr.type === "tool-result") {
                  const p = tr as { toolCallId: string; output: unknown };
                  const existing = toolCallMap.get(p.toolCallId);
                  if (existing) {
                    const output = p.output;
                    if (output && typeof output === "object" && "value" in output) {
                      existing.output = (output as { value: unknown }).value;
                    } else {
                      existing.output = output;
                    }
                  }
                }
              }
            }
          }

          // Build assistant message parts in order
          const assistantParts: Array<Record<string, unknown>> = [];

          for (const msg of response.messages) {
            if (msg.role === "assistant") {
              if (typeof msg.content === "string" && msg.content.trim()) {
                assistantParts.push({ type: "text", text: msg.content });
              } else if (Array.isArray(msg.content)) {
                for (const part of msg.content) {
                  if (part.type === "text" && (part as { text: string }).text.trim()) {
                    assistantParts.push({ type: "text", text: (part as { text: string }).text });
                  } else if (part.type === "reasoning") {
                    const rp = part as { text: string };
                    if (rp.text?.trim()) {
                      assistantParts.push({ type: "reasoning", text: rp.text });
                    }
                  } else if (part.type === "tool-call") {
                    const tp = part as { toolCallId: string; toolName: string };
                    const toolData = toolCallMap.get(tp.toolCallId);
                    if (toolData) {
                      assistantParts.push({
                        type: `tool-${toolData.toolName}`,
                        toolCallId: toolData.toolCallId,
                        state: "output-available",
                        input: toolData.input,
                        output: toolData.output,
                      });
                    }
                  }
                }
              }
            }
          }

          // Save assistant message
          if (assistantParts.length > 0) {
            const metadata = {
              model: analysisModel,
              tokens: usage
                ? {
                    prompt: usage.inputTokens ?? 0,
                    completion: usage.outputTokens ?? 0,
                  }
                : undefined,
            };

            await db.insert(analysisChatMessage).values({
              id: randomUUID(),
              chatId,
              role: "assistant",
              parts: assistantParts,
              content: extractTextContent(assistantParts),
              metadata,
              createdAt: new Date(),
            });
          }

          // Update chat timestamp
          await db
            .update(analysisChat)
            .set({ updatedAt: new Date() })
            .where(eq(analysisChat.id, chatId));

          // Generate title if this is the first exchange
          if (!chat.title && assistantParts.length > 0) {
            try {
              const userText = allMessages
                .filter((m) => m.role === "user")
                .flatMap((m) => m.parts)
                .filter((p): p is { type: "text"; text: string } => p.type === "text")
                .map((p) => p.text)
                .join(" ")
                .slice(0, 200);

              const assistantText = assistantParts
                .filter((p) => p.type === "text" && typeof p.text === "string")
                .map((p) => p.text as string)
                .join(" ")
                .slice(0, 200);

              if (userText) {
                const titleModel = await getModel("openai/gpt-4.1-nano");
                const { generateText: genText } = await import("ai");
                const titleResult = await genText({
                  model: titleModel,
                  prompt: `Generate a short title (max 6 words) for this conversation. Return ONLY the title, no quotes or explanation.

User: ${userText}
Assistant: ${assistantText}

Title:`,
                  temperature: 0.7,
                  maxOutputTokens: 20,
                });
                const title = titleResult.text
                  .trim()
                  .replace(/^["']|["']$/g, "")
                  .replace(/^Title:\s*/i, "")
                  .slice(0, 50);
                if (title) {
                  await db
                    .update(analysisChat)
                    .set({ title })
                    .where(eq(analysisChat.id, chatId));
                }
              }
            } catch {
              // Title generation is non-critical
            }
          }

          // Summarize dropped messages if needed
          if (windowed.droppedCount > 0) {
            const droppedMessages = allMessages.slice(0, windowed.droppedCount);
            const summary = buildSummaryPrompt(droppedMessages);
            if (summary) {
              await db
                .update(analysisChat)
                .set({
                  summary,
                  summaryTokens: Math.ceil(summary.length / 4),
                  summaryUpToMessageId: droppedMessages[droppedMessages.length - 1]?.id,
                })
                .where(eq(analysisChat.id, chatId));
            }
          }
        } catch (err) {
          console.error("[Analysis Chat] onFinish error:", err);
        } finally {
          sandboxRef.instance?.stop().catch(() => {});
        }
      },

      onError: async () => {
        sandboxRef.instance?.stop().catch(() => {});
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    sandboxRef.instance?.stop().catch(() => {});
    throw err;
  }
}
