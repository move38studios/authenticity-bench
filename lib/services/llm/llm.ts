/**
 * LLM Service
 *
 * Unified interface for text generation, structured output, and streaming
 * across multiple providers via the Vercel AI SDK.
 *
 * Models are routed by prefix: anthropic/*, openai/*, google/*, etc.
 */

import {
  generateObject as aiGenerateObject,
  generateText as aiGenerateText,
  streamText as aiStreamText,
  type LanguageModel,
} from "ai";
import { z } from "zod/v4";
import type {
  LLMProvider,
  GenerateTextOptions,
  GenerateObjectOptions,
  StreamTextOptions,
  TextResponse,
  ObjectResponse,
} from "./types";
import { getProviderConfig } from "./providers";
import { getActiveApiKey } from "./api-key-store";

// =============================================================================
// MODEL ID NORMALIZATION
// =============================================================================

/**
 * Mapping from "provider/model" IDs to native provider model IDs.
 */
const MODEL_ID_MAP: Record<string, string> = {
  // Anthropic
  "anthropic/claude-haiku-4.5": "claude-haiku-4-5-20251001",
  "anthropic/claude-sonnet-4.5": "claude-sonnet-4-5-20250929",
  "anthropic/claude-sonnet-4-6": "claude-sonnet-4-6",
  "anthropic/claude-opus-4.5": "claude-opus-4-5-20251101",
  "anthropic/claude-opus-4.6": "claude-opus-4-6",
  // OpenAI
  "openai/gpt-4.1-mini": "gpt-4.1-mini",
  "openai/gpt-4.1-nano": "gpt-4.1-nano",
  "openai/gpt-5.2": "gpt-5.2",
  "openai/gpt-5.4": "gpt-5.4",
  "openai/o3": "o3",
  "openai/o3-mini": "o3-mini",
  // Google
  "google/gemini-2.5-flash": "gemini-2.5-flash",
  "google/gemini-2.5-pro": "gemini-2.5-pro",
  "google/gemini-3-flash-preview": "gemini-3-flash-preview",
  "google/gemini-3.1-pro-preview": "gemini-3.1-pro-preview",
  "google/gemini-3.1-flash-lite-preview": "gemini-3.1-flash-lite-preview",
};

function normalizeModelId(modelId: string, provider: LLMProvider): string {
  if (provider === "openrouter" || provider === "custom") {
    // Strip the provider prefix (e.g. "openrouter/moonshotai/kimi-k2.5" → "moonshotai/kimi-k2.5")
    const prefixes = ["openrouter/", "custom/"];
    for (const p of prefixes) {
      if (modelId.startsWith(p)) return modelId.slice(p.length);
    }
    return modelId;
  }
  if (MODEL_ID_MAP[modelId]) {
    return MODEL_ID_MAP[modelId];
  }
  if (modelId.includes("/")) {
    return modelId.split("/")[1];
  }
  return modelId;
}

// =============================================================================
// PROVIDER ROUTING
// =============================================================================

async function extractProviderFromModelId(
  modelId: string
): Promise<LLMProvider> {
  if (!modelId.includes("/")) {
    return "openrouter";
  }

  const prefix = modelId.split("/")[0].toLowerCase();

  switch (prefix) {
    case "anthropic":
      return "anthropic";
    case "openai":
      return "openai";
    case "google": {
      const dbKey = await getActiveApiKey("google");
      return dbKey ? "google" : "openrouter";
    }
    default:
      return "openrouter";
  }
}

async function getApiKey(provider: LLMProvider): Promise<string> {
  const dbKey = await getActiveApiKey(provider);
  if (dbKey) return dbKey;

  throw new Error(
    `No API key configured for provider "${provider}". Add one in Admin → API Keys.`
  );
}

// =============================================================================
// MODEL INSTANCE
// =============================================================================

/**
 * Get an AI SDK model instance from a "provider/model" ID.
 */
export async function getModel(modelId: string): Promise<LanguageModel> {
  const provider = await extractProviderFromModelId(modelId);
  const providerConfig = getProviderConfig(provider);
  const apiKey = await getApiKey(provider);
  const client = providerConfig.createClient(apiKey);
  const nativeModelId = normalizeModelId(modelId, provider);

  return client(nativeModelId);
}

// =============================================================================
// TEXT GENERATION
// =============================================================================

export async function generateText(
  prompt: string,
  options: GenerateTextOptions = {}
): Promise<TextResponse> {
  const {
    model: modelId = "openai/gpt-4.1-mini",
    temperature = 0.7,
    systemPrompt,
  } = options;

  const model = await getModel(modelId);

  const result = await aiGenerateText({
    model,
    prompt,
    system: systemPrompt,
    temperature,
  });

  const inputTokens = result.usage?.inputTokens ?? 0;
  const outputTokens = result.usage?.outputTokens ?? 0;

  return {
    text: result.text,
    finishReason: result.finishReason,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    },
  };
}

// =============================================================================
// STRUCTURED OUTPUT
// =============================================================================

export async function generateObject<T extends z.ZodType>(
  prompt: string,
  options: GenerateObjectOptions<T>
): Promise<ObjectResponse<z.infer<T>>> {
  const {
    model: modelId = "openai/gpt-4.1-mini",
    temperature = 0.7,
    systemPrompt,
    schema,
    schemaName = "response",
    schemaDescription = "Generated response object",
  } = options;

  const model = await getModel(modelId);

  const result = await aiGenerateObject({
    model,
    prompt,
    system: systemPrompt,
    temperature,
    schema,
    schemaName,
    schemaDescription,
  });

  const inputTokens = result.usage?.inputTokens ?? 0;
  const outputTokens = result.usage?.outputTokens ?? 0;

  return {
    object: result.object as z.infer<T>,
    finishReason: result.finishReason,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    },
  };
}

// =============================================================================
// STREAMING
// =============================================================================

export async function streamText(
  prompt: string,
  options: StreamTextOptions = {}
) {
  const {
    model: modelId = "openai/gpt-4.1-mini",
    temperature = 0.7,
    systemPrompt,
    onChunk,
  } = options;

  const model = await getModel(modelId);

  const result = aiStreamText({
    model,
    prompt,
    system: systemPrompt,
    temperature,
    onChunk: onChunk
      ? ({ chunk }) => {
          const text = chunk.type === "text-delta" ? chunk.text : "";
          if (text) onChunk(text);
        }
      : undefined,
  });

  return result;
}
