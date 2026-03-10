/**
 * Reasoning Provider Options
 *
 * Maps reasoning effort levels to provider-specific options for models
 * that support extended thinking (Claude, Gemini, o-series).
 */

type ReasoningEffort = "low" | "medium" | "high";

const ANTHROPIC_BUDGETS: Record<ReasoningEffort, number> = {
  low: 4096,
  medium: 10240,
  high: 32768,
};

const GOOGLE_BUDGETS: Record<ReasoningEffort, number> = {
  low: 4096,
  medium: 12288,
  high: 32768,
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
    const budgetTokens = ANTHROPIC_BUDGETS[level];
    if (!budgetTokens) return undefined;
    return {
      anthropic: {
        thinking: { type: "enabled", budgetTokens },
      },
    };
  }

  if (modelId.startsWith("openai/")) {
    return {
      openai: { reasoningEffort: level },
    };
  }

  if (modelId.startsWith("google/")) {
    const isGemini3 = modelId.includes("gemini-3");
    if (isGemini3) {
      return {
        google: {
          thinkingConfig: { includeThoughts: true, thinkingLevel: level },
        },
      };
    }
    const thinkingBudget = GOOGLE_BUDGETS[level];
    if (!thinkingBudget) return undefined;
    return {
      google: {
        thinkingConfig: { includeThoughts: true, thinkingBudget },
      },
    };
  }

  return {
    openrouter: {
      reasoning: { effort: level },
    },
  };
}
