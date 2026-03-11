/**
 * LLM Provider Registry
 *
 * Maps provider IDs to AI SDK client factories.
 * Direct providers (anthropic, openai, google) have native structured output support.
 * Gateway providers (openrouter, groq) are for exotic/niche models.
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LLMProvider, CustomProviderConfig } from "./types";

export interface ProviderConfig {
  createClient: (
    apiKey: string,
    customConfig?: CustomProviderConfig
  ) =>
    | ReturnType<typeof createOpenAICompatible>
    | ReturnType<typeof createOpenAI>
    | ReturnType<typeof createAnthropic>
    | ReturnType<typeof createGoogleGenerativeAI>
    | ReturnType<typeof createOpenRouter>;
  supportsStructuredOutputs: boolean;
}

export const PROVIDER_REGISTRY: Record<LLMProvider, ProviderConfig> = {
  anthropic: {
    createClient: (apiKey: string) =>
      createAnthropic({ apiKey }),
    supportsStructuredOutputs: true,
  },

  openai: {
    createClient: (apiKey: string) => createOpenAI({ apiKey }),
    supportsStructuredOutputs: true,
  },

  google: {
    createClient: (apiKey: string) => createGoogleGenerativeAI({ apiKey }),
    supportsStructuredOutputs: true,
  },

  openrouter: {
    createClient: (apiKey: string) =>
      createOpenRouter({ apiKey, compatibility: "strict" }),
    supportsStructuredOutputs: true,
  },

  custom: {
    createClient: (apiKey: string, customConfig?: CustomProviderConfig) => {
      if (!customConfig?.baseUrl) {
        throw new Error("Custom provider requires baseUrl in customConfig");
      }
      return createOpenAICompatible({
        name: "custom",
        baseURL: customConfig.baseUrl,
        apiKey,
        supportsStructuredOutputs: false,
      });
    },
    supportsStructuredOutputs: false,
  },
};

export function getProviderConfig(provider: LLMProvider): ProviderConfig {
  const config = PROVIDER_REGISTRY[provider];
  if (!config) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  return config;
}
