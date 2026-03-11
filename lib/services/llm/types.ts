import { z } from "zod/v4";

/**
 * Supported LLM providers.
 */
export type LLMProvider =
  | "anthropic"
  | "openai"
  | "google"
  | "openrouter"
  | "custom";

/**
 * Model tier for cost/performance categorization.
 */
export type ModelTier = "light" | "standard" | "heavy";

/**
 * Custom provider configuration (for OpenAI-compatible endpoints).
 */
export type CustomProviderConfig = {
  baseUrl: string;
  apiKeyEnvVar: string;
};

/**
 * Options for text generation.
 */
export interface GenerateTextOptions {
  /** Model ID in "provider/model" format */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

/**
 * Options for structured object generation.
 */
export interface GenerateObjectOptions<T extends z.ZodType>
  extends GenerateTextOptions {
  schema: T;
  schemaName?: string;
  schemaDescription?: string;
}

/**
 * Options for streaming text generation.
 */
export interface StreamTextOptions extends GenerateTextOptions {
  onChunk?: (chunk: string) => void;
}

/**
 * Response from text generation.
 */
export interface TextResponse {
  text: string;
  finishReason: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

/**
 * Response from structured object generation.
 */
export interface ObjectResponse<T> extends Omit<TextResponse, "text"> {
  object: T;
}
