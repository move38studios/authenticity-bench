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
import { getPrompt, renderPrompt } from "@/lib/services/prompts";
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

  const [systemPrompt, promptTemplate] = await Promise.all([
    getPrompt("paraphraser_system"),
    getPrompt("paraphraser_prompt"),
  ]);

  const prompt = renderPrompt(promptTemplate, {
    noiseIndex: String(noiseIndex),
    seedHash,
    originalScenario,
  });

  const result = await generateText(prompt, {
    model: PARAPHRASE_MODEL,
    temperature: 0.9,
    systemPrompt,
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
