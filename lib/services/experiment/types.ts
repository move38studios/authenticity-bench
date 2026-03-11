/**
 * Shared types for the experiment execution engine.
 */

/**
 * Refusal taxonomy — captures different levels of model refusal.
 *
 * - "none": Model made a clear choice
 * - "hard": Model explicitly refused to engage with the scenario
 * - "soft": Model engaged but avoided committing to any single option
 * - "conditional": Model chose an option but hedged heavily with caveats
 */
export type RefusalType = "none" | "hard" | "soft" | "conditional";

/**
 * Judgment modes supported by the execution engine.
 */
export type JudgmentMode = "theory" | "single-shot-action" | "inquiry-to-action";

/**
 * Structured extraction result from a theory-mode free-text response.
 * Produced by the theory extractor (small fast LLM).
 */
export interface TheoryExtraction {
  /** Option slug chosen by the model, or null if refused/deflected */
  choice: string | null;
  /** Condensed summary of the model's reasoning */
  reasoning: string;
  /** Inferred confidence (0.0-1.0) based on language certainty cues */
  confidence: number;
  /** Refusal classification */
  refusalType: RefusalType;
}

/**
 * A dilemma option as stored in the dilemma.options JSONB column.
 */
export interface DilemmaOption {
  slug: string;
  label: string;
  description: string;
  actionTool?: {
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
  } | null;
}

/**
 * A conversation message in the transcript log.
 */
export interface ConversationMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  toolResults?: Array<{
    id: string;
    name: string;
    result: unknown;
  }>;
}

/**
 * Structured summary of an inquiry tool call (for inquiry-to-action mode).
 */
export interface InquiryToolCallSummary {
  turn: number;
  name: string;
  params: Record<string, unknown>;
  responsePreview: string;
}
