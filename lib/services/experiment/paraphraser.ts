/**
 * Paraphraser
 *
 * Rewrites dilemma scenario text to create noise variants. This ensures
 * judgments measure real model behavior, not token-sequence artifacts.
 *
 * - noiseIndex 0: original text (baseline)
 * - noiseIndex > 0: paraphrased with a unique random seed per index
 *
 * Only the scenario text is paraphrased. Options are never touched.
 */

import { generateText } from "@/lib/services/llm";
import crypto from "crypto";

const PARAPHRASE_MODEL = "anthropic/claude-haiku-4.5";

/**
 * Generate a paraphrased version of a scenario for a given noise index.
 * Returns the original text unchanged for noiseIndex 0.
 */
export async function paraphraseScenario(
  originalScenario: string,
  noiseIndex: number,
  dilemmaId: string
): Promise<string> {
  if (noiseIndex === 0) return originalScenario;

  // Deterministic but unique seed per (dilemma, noiseIndex) pair
  const seedHash = crypto
    .createHash("sha256")
    .update(`${dilemmaId}:${noiseIndex}`)
    .digest("hex")
    .slice(0, 12);

  const prompt = `You are a precise text editor. Rewrite the following scenario text with different sentence structure and word choice while preserving EXACTLY the same meaning, facts, names, numbers, relationships, and tone.

Do NOT add, remove, or change any factual details. Do NOT change the options or choices available. Only vary how the information is expressed.

Random seed: ${noiseIndex}-${seedHash}

Scenario:
${originalScenario}`;

  const result = await generateText(prompt, {
    model: PARAPHRASE_MODEL,
    temperature: 0.9,
    systemPrompt:
      "You are a text rewriting assistant. Output ONLY the rewritten scenario text, nothing else. No preamble, no explanation.",
  });

  return result.text.trim();
}

/**
 * Batch-paraphrase all unique (dilemma, noiseIndex) pairs.
 * Returns a map of "dilemmaId:noiseIndex" → paraphrased text.
 *
 * noiseIndex 0 is always the original text. Higher indices are paraphrased
 * once and shared across all judgments with the same (dilemma, noiseIndex).
 */
export async function batchParaphrase(
  dilemmas: Array<{ id: string; scenario: string }>,
  noiseRepeats: number,
  concurrency = 5
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  // Collect all tasks
  const tasks: Array<{
    key: string;
    dilemmaId: string;
    scenario: string;
    noiseIndex: number;
  }> = [];

  for (const dilemma of dilemmas) {
    for (let i = 0; i < noiseRepeats; i++) {
      const key = `${dilemma.id}:${i}`;
      if (i === 0) {
        results.set(key, dilemma.scenario);
      } else {
        tasks.push({
          key,
          dilemmaId: dilemma.id,
          scenario: dilemma.scenario,
          noiseIndex: i,
        });
      }
    }
  }

  // Process in batches with concurrency control
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (task) => {
        const text = await paraphraseScenario(
          task.scenario,
          task.noiseIndex,
          task.dilemmaId
        );
        return { key: task.key, text };
      })
    );
    for (const { key, text } of batchResults) {
      results.set(key, text);
    }
  }

  return results;
}
