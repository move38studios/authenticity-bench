/**
 * Combinatorial utilities for experiment configuration.
 *
 * Generates power sets for mental technique and modifier combos,
 * and computes total judgment counts.
 */

/**
 * Generate the power set of an array (all subsets including empty set).
 * Returns arrays of IDs sorted for consistency.
 */
export function powerSet<T>(items: T[]): T[][] {
  const result: T[][] = [[]];
  for (const item of items) {
    const len = result.length;
    for (let i = 0; i < len; i++) {
      result.push([...result[i], item]);
    }
  }
  return result;
}

/**
 * Compute total judgment count for an experiment configuration.
 */
export function computeTotalJudgments(config: {
  dilemmaCount: number;
  modelCount: number;
  valuesSystemCount: number; // not including the "none" baseline
  mentalTechniqueComboCount: number;
  modifierComboCount: number;
  judgmentModeCount: number;
  noiseRepeats: number;
}): number {
  return (
    config.dilemmaCount *
    config.modelCount *
    (config.valuesSystemCount + 1) * // +1 for "no values" baseline
    config.mentalTechniqueComboCount *
    config.modifierComboCount *
    config.judgmentModeCount *
    config.noiseRepeats
  );
}
