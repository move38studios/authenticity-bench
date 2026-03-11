/**
 * Response Parser
 *
 * Extracts choice, reasoning, and confidence from action-mode responses
 * (tool calls). Theory mode uses the theory-extractor instead.
 */

import type { RefusalType, InquiryToolCallSummary } from "./types";
import type { ActionToolDefinition } from "./prompt-assembler";

export interface ActionParseResult {
  choice: string | null;
  reasoning: string | null;
  confidence: number | null;
  refusalType: RefusalType;
}

/**
 * Parse a single-shot action mode response.
 *
 * The model should have called exactly one action tool. If it didn't call
 * any tool, it's a hard refusal.
 */
export function parseActionToolCall(
  toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> | undefined,
  actionTools: ActionToolDefinition[],
  assistantText?: string
): ActionParseResult {
  if (!toolCalls?.length) {
    return {
      choice: null,
      reasoning: assistantText ?? null,
      confidence: null,
      refusalType: "hard",
    };
  }

  const toolNameToSlug = new Map(
    actionTools.map((t) => [t.name, t.optionSlug])
  );

  // Find the first action tool call
  for (const call of toolCalls) {
    const slug = toolNameToSlug.get(call.name);
    if (slug) {
      return {
        choice: slug,
        reasoning:
          typeof call.arguments.reasoning === "string"
            ? call.arguments.reasoning
            : null,
        confidence:
          typeof call.arguments.confidence === "number"
            ? call.arguments.confidence
            : null,
        refusalType: "none",
      };
    }
  }

  // Model called tool(s) but none were action tools — shouldn't happen in single-shot
  return {
    choice: null,
    reasoning: assistantText ?? null,
    confidence: null,
    refusalType: "hard",
  };
}

/**
 * Parse an inquiry-to-action mode conversation.
 *
 * Examines the full tool call history to determine if an action tool was
 * eventually called. If only inquiry tools were used (hit turn cap), it's
 * a soft refusal.
 */
export function parseInquiryResult(
  finalToolCalls: Array<{ name: string; arguments: Record<string, unknown> }> | undefined,
  actionTools: ActionToolDefinition[],
  inquiryCallSummaries: InquiryToolCallSummary[],
  assistantText?: string
): ActionParseResult {
  // Check if the final turn contained an action tool call
  const actionResult = parseActionToolCall(
    finalToolCalls,
    actionTools,
    assistantText
  );

  if (actionResult.choice !== null) {
    return actionResult;
  }

  // No action tool was called. If there were inquiry calls, it's a soft refusal
  // (model gathered info but never committed to action). Otherwise hard refusal.
  if (inquiryCallSummaries.length > 0) {
    return {
      choice: null,
      reasoning: assistantText ?? null,
      confidence: null,
      refusalType: "soft",
    };
  }

  return {
    choice: null,
    reasoning: assistantText ?? null,
    confidence: null,
    refusalType: "hard",
  };
}
