/**
 * Context Windowing for Analysis Chat
 *
 * Simplified version of steelframe's approach:
 * - Estimates tokens from message content
 * - Drops oldest messages when over budget
 * - Summarizes dropped messages
 * - Compresses large tool outputs in older messages
 */

import type { UIMessage } from "ai";

const CHARS_PER_TOKEN = 4;
const CONTEXT_BUDGET = 120_000; // tokens (~480k chars for Sonnet)
const MIN_KEEP_MESSAGES = 4;
const TOOL_OUTPUT_COMPRESS_THRESHOLD = 6000; // chars

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function estimateMessageTokens(message: UIMessage): number {
  let chars = 0;
  for (const part of message.parts) {
    if (part.type === "text") {
      chars += part.text.length;
    } else if (part.type === "reasoning") {
      chars += part.text.length;
    } else {
      // Tool parts — estimate from stringified content
      chars += JSON.stringify(part).length;
    }
  }
  return estimateTokens(chars.toString().length > 0 ? String(chars) : "").valueOf() > 0
    ? Math.ceil(chars / CHARS_PER_TOKEN)
    : 0;
}

interface WindowResult {
  messages: UIMessage[];
  droppedCount: number;
  estimatedTokens: number;
}

/**
 * Window messages to fit within context budget.
 * Keeps the most recent messages, drops oldest first.
 */
export function windowMessages(
  messages: UIMessage[],
  systemPromptTokens: number
): WindowResult {
  const budget = CONTEXT_BUDGET - systemPromptTokens;

  // Walk backwards, accumulate tokens
  let totalTokens = 0;
  let keepFrom = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = estimateMessageTokens(messages[i]);
    if (totalTokens + msgTokens > budget && messages.length - i >= MIN_KEEP_MESSAGES) {
      keepFrom = i + 1;
      break;
    }
    totalTokens += msgTokens;
  }

  return {
    messages: messages.slice(keepFrom),
    droppedCount: keepFrom,
    estimatedTokens: totalTokens,
  };
}

/**
 * Compress large tool outputs in older messages (not the last 2 messages).
 */
export function compressToolOutputs(messages: UIMessage[]): UIMessage[] {
  if (messages.length <= 2) return messages;

  return messages.map((msg, idx) => {
    // Don't compress the last 2 messages
    if (idx >= messages.length - 2) return msg;
    if (msg.role !== "assistant") return msg;

    const newParts = msg.parts.map((part) => {
      // Check for tool parts (type: "tool-{name}") with large outputs
      const isToolPart = part.type.startsWith("tool-") && "output" in part;
      if (isToolPart && (part as { state?: string }).state === "output-available") {
        const outputStr = JSON.stringify((part as { output: unknown }).output);
        if (outputStr.length > TOOL_OUTPUT_COMPRESS_THRESHOLD) {
          const toolName = part.type.slice(5); // "tool-execute_python" → "execute_python"
          const tokens = estimateTokens(outputStr);
          return {
            ...part,
            output: {
              _compressed: true,
              summary: `[${toolName} output: ~${Math.round(tokens / 1000)}k tokens — compressed]`,
            },
          };
        }
      }
      return part;
    });

    return { ...msg, parts: newParts } as UIMessage;
  });
}

/**
 * Summarize dropped messages for context injection.
 * Uses a simple approach — just concatenates key content.
 */
export function buildSummaryPrompt(droppedMessages: UIMessage[]): string {
  const summaryParts: string[] = [];

  for (const msg of droppedMessages) {
    const textParts = msg.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text);

    if (textParts.length > 0) {
      summaryParts.push(`${msg.role}: ${textParts.join(" ").slice(0, 500)}`);
    }
  }

  return summaryParts.join("\n").slice(0, 4000);
}
