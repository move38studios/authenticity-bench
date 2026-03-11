import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { modelConfig } from "../lib/db/schema";
import { randomUUID } from "crypto";

const MODELS = [
  // Anthropic
  { provider: "anthropic", modelId: "claude-haiku-4.5", displayName: "Claude Haiku 4.5", temperature: 0.7 },
  { provider: "anthropic", modelId: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6", temperature: 0.7 },
  { provider: "anthropic", modelId: "claude-opus-4.6", displayName: "Claude Opus 4.6", temperature: 0.7 },
  // OpenAI
  { provider: "openai", modelId: "gpt-4.1-nano", displayName: "GPT-4.1 Nano", temperature: 0.7 },
  { provider: "openai", modelId: "gpt-4.1-mini", displayName: "GPT-4.1 Mini", temperature: 0.7 },
  { provider: "openai", modelId: "gpt-5.4", displayName: "GPT-5.4", temperature: 0.7 },
  { provider: "openai", modelId: "o3-mini", displayName: "o3-mini", temperature: 0.7 },
  { provider: "openai", modelId: "o3", displayName: "o3", temperature: 0.7 },
  // Google
  { provider: "google", modelId: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash", temperature: 0.7 },
  { provider: "google", modelId: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro", temperature: 0.7 },
  { provider: "google", modelId: "gemini-3-flash-preview", displayName: "Gemini 3 Flash", temperature: 0.7 },
  { provider: "google", modelId: "gemini-3.1-pro-preview", displayName: "Gemini 3.1 Pro", temperature: 0.7 },
  { provider: "google", modelId: "gemini-3.1-flash-lite-preview", displayName: "Gemini 3.1 Flash Lite", temperature: 0.7 },
  // OpenRouter
  { provider: "openrouter", modelId: "moonshotai/kimi-k2.5", displayName: "Kimi K2.5", temperature: 0.7 },
  { provider: "openrouter", modelId: "qwen/qwen3.5-397b-a17b", displayName: "Qwen 3.5 397B", temperature: 0.7 },
  { provider: "openrouter", modelId: "qwen/qwen3.5-35b-a3b", displayName: "Qwen 3.5 35B", temperature: 0.7 },
  { provider: "openrouter", modelId: "qwen/qwen3-max-thinking", displayName: "Qwen 3 Max Thinking", temperature: 0.7 },
];

async function seedModels() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle({ client: sql });

  // Check what already exists
  const existing = await db.select().from(modelConfig);
  const existingKeys = new Set(
    existing.map((m) => `${m.provider}/${m.modelId}`)
  );

  const toInsert = MODELS.filter(
    (m) => !existingKeys.has(`${m.provider}/${m.modelId}`)
  );

  if (toInsert.length === 0) {
    console.log("All models already exist. Nothing to insert.");
    return;
  }

  await db.insert(modelConfig).values(
    toInsert.map((m) => ({
      id: randomUUID(),
      provider: m.provider,
      modelId: m.modelId,
      displayName: m.displayName,
      temperature: m.temperature,
      maxTokens: 4096,
    }))
  );

  console.log(`Inserted ${toInsert.length} model configs:`);
  toInsert.forEach((m) => console.log(`  ${m.displayName} (${m.provider}/${m.modelId})`));
}

seedModels().catch((err) => {
  console.error(err);
  process.exit(1);
});
