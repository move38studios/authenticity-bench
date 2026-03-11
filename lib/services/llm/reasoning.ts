/**
 * Reasoning Provider Options
 *
 * Maps reasoning effort levels to provider-specific options for models
 * that support extended thinking (Claude, Gemini, o-series).
 */

type ReasoningEffort = "low" | "medium" | "high";

const ANTHROPIC_BUDGETS: Record<ReasoningEffort, number> = {
  low: 5000,
  medium: 16000,
  high: 50000,
};

type JSONValue = null | string | number | boolean | JSONObject | JSONValue[];
type JSONObject = { [key: string]: JSONValue | undefined };
type ProviderOptions = Record<string, JSONObject>;

/**
 * Get provider-specific reasoning options for a model.
 */
export function getReasoningProviderOptions(
  modelId: string,
  effort?: string | null
): ProviderOptions | undefined {
  if (!effort || effort === "off") {
    return undefined;
  }

  const level = effort as ReasoningEffort;

  if (modelId.startsWith("anthropic/")) {
    return {
      anthropic: {
        thinking: { type: "enabled", budgetTokens: ANTHROPIC_BUDGETS[level] },
      },
    };
  }

  if (modelId.startsWith("openai/")) {
    return {
      openai: { reasoningEffort: level, reasoningSummary: "detailed" },
    };
  }

  if (modelId.startsWith("google/")) {
    return {
      google: {
        thinkingConfig: { includeThoughts: true, thinkingLevel: level },
      },
    };
  }

  return {
    openrouter: {
      reasoning: { effort: level },
    },
  };
}
