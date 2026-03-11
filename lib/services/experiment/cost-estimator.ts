/**
 * Cost Estimator
 *
 * Rough cost estimation for experiments. Uses tier-based pricing
 * for pre-run estimates and actual token counts for post-run calculation.
 */

import type { JudgmentMode } from "./types";

// =============================================================================
// MODEL TIER CLASSIFICATION
// =============================================================================

type CostTier = "cheap" | "mid" | "expensive";

const TIER_COST_PER_JUDGMENT: Record<CostTier, number> = {
  cheap: 0.001,
  mid: 0.01,
  expensive: 0.05,
};

const INQUIRY_MODE_MULTIPLIER = 3;

/**
 * Classify a model into a cost tier based on its provider and model ID.
 */
function getModelTier(provider: string, modelId: string): CostTier {
  const id = modelId.toLowerCase();

  // Cheap tier
  if (
    id.includes("haiku") ||
    id.includes("nano") ||
    id.includes("mini") ||
    id.includes("flash-lite") ||
    provider === "groq"
  ) {
    return "cheap";
  }

  // Expensive tier
  if (
    id.includes("opus") ||
    id.includes("gpt-5") ||
    id === "o3"
  ) {
    return "expensive";
  }

  // Mid tier (default)
  return "mid";
}

// =============================================================================
// PRE-RUN ESTIMATE
// =============================================================================

export interface CostEstimateInput {
  models: Array<{ provider: string; modelId: string }>;
  judgmentModes: JudgmentMode[];
  totalJudgments: number;
}

export interface CostEstimate {
  low: number;
  high: number;
  formatted: string;
}

/**
 * Estimate the total cost range for an experiment before it runs.
 * Returns a low-high range formatted as a string.
 */
export function estimateExperimentCost(input: CostEstimateInput): CostEstimate {
  const hasInquiry = input.judgmentModes.includes("inquiry-to-action");
  const nonInquiryModes = input.judgmentModes.filter(
    (m) => m !== "inquiry-to-action"
  );

  // Calculate per-model costs
  let totalLow = 0;
  let totalHigh = 0;

  for (const model of input.models) {
    const tier = getModelTier(model.provider, model.modelId);
    const baseCost = TIER_COST_PER_JUDGMENT[tier];

    // Judgments per model ≈ total / number of models
    const judgmentsPerModel = input.totalJudgments / input.models.length;

    // Split by mode
    const modesCount = input.judgmentModes.length;
    const judgmentsPerMode = judgmentsPerModel / modesCount;

    // Non-inquiry modes
    const nonInquiryCost =
      judgmentsPerMode * nonInquiryModes.length * baseCost;

    // Inquiry mode (3x multiplier)
    const inquiryCost = hasInquiry
      ? judgmentsPerMode * baseCost * INQUIRY_MODE_MULTIPLIER
      : 0;

    // Low estimate: 70% of calculated cost
    // High estimate: 150% of calculated cost
    const modelCost = nonInquiryCost + inquiryCost;
    totalLow += modelCost * 0.7;
    totalHigh += modelCost * 1.5;
  }

  return {
    low: totalLow,
    high: totalHigh,
    formatted: `~$${totalLow.toFixed(2)}–$${totalHigh.toFixed(2)}`,
  };
}

// =============================================================================
// PER-JUDGMENT COST (post-run)
// =============================================================================

// Approximate pricing per 1M tokens (input/output)
const TOKEN_PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  "claude-haiku": { input: 0.8, output: 4 },
  "claude-sonnet": { input: 3, output: 15 },
  "claude-opus": { input: 15, output: 75 },
  // OpenAI
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-5": { input: 10, output: 30 },
  "o3-mini": { input: 1.1, output: 4.4 },
  "o3": { input: 10, output: 40 },
  // Google
  "gemini-flash": { input: 0.1, output: 0.4 },
  "gemini-pro": { input: 1.25, output: 5 },
};

/**
 * Estimate the cost of a single judgment from actual token usage.
 */
export function estimateJudgmentCost(
  modelId: string,
  promptTokens: number,
  completionTokens: number
): number {
  const id = modelId.toLowerCase();

  // Find matching pricing
  let pricing = { input: 1, output: 4 }; // default fallback
  for (const [key, value] of Object.entries(TOKEN_PRICING)) {
    if (id.includes(key)) {
      pricing = value;
      break;
    }
  }

  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}
