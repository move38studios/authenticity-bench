import { z } from "zod/v4";

// Model Config
export const createModelConfigSchema = z.object({
  provider: z.string().min(1),
  modelId: z.string().min(1),
  displayName: z.string().min(1),
  temperature: z.number().min(0).max(2).optional().default(1.0),
  topP: z.number().min(0).max(1).optional(),
  maxTokens: z.number().int().min(1).optional().default(4096),
  extraParams: z.record(z.string(), z.unknown()).optional(),
});

export const updateModelConfigSchema = createModelConfigSchema.partial();

// Dilemma
const actionToolDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

export const dilemmaOptionSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_]+$/, "Slug must be lowercase alphanumeric with underscores"),
  label: z.string().min(1),
  description: z.string().min(1),
  actionTool: actionToolDefinitionSchema.nullable().optional(),
});

export const createDilemmaSchema = z.object({
  title: z.string().min(1),
  scenario: z.string().min(1),
  domain: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  options: z.array(dilemmaOptionSchema).min(2),
  isPublic: z.boolean().optional().default(true),
  inquiryTools: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const updateDilemmaSchema = createDilemmaSchema.partial();

// Values System
export const createValuesSystemSchema = z.object({
  name: z.string().min(1),
  content: z.string().min(1),
  description: z.string().optional(),
});

export const updateValuesSystemSchema = createValuesSystemSchema.partial();

// Mental Technique
export const createMentalTechniqueSchema = z.object({
  name: z.string().min(1),
  content: z.string().min(1),
  description: z.string().optional(),
});

export const updateMentalTechniqueSchema =
  createMentalTechniqueSchema.partial();

// Modifier
export const createModifierSchema = z.object({
  name: z.string().min(1),
  content: z.string().min(1),
  description: z.string().optional(),
});

export const updateModifierSchema = createModifierSchema.partial();

// Experiment
const judgmentModeEnum = z.enum([
  "theory",
  "single-shot-action",
  "inquiry-to-action",
]);

export const createExperimentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  judgmentModes: z.array(judgmentModeEnum).min(1),
  noiseRepeats: z.number().int().min(1).max(20).optional().default(3),
  modelConfigIds: z.array(z.string()).min(1),
  dilemmaIds: z.array(z.string()).min(1),
  valuesSystemIds: z.array(z.string()).optional().default([]), // empty = none-only baseline
  mentalTechniqueIds: z.array(z.string()).optional().default([]),
  modifierIds: z.array(z.string()).optional().default([]),
  // combo configs — if omitted, full power set is generated
  mentalTechniqueCombos: z.array(z.array(z.string())).optional(),
  modifierCombos: z.array(z.array(z.string())).optional(),
});

export const updateExperimentSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  judgmentModes: z.array(judgmentModeEnum).min(1).optional(),
  noiseRepeats: z.number().int().min(1).max(20).optional(),
  modelConfigIds: z.array(z.string()).min(1).optional(),
  dilemmaIds: z.array(z.string()).min(1).optional(),
  valuesSystemIds: z.array(z.string()).optional(),
  mentalTechniqueIds: z.array(z.string()).optional(),
  modifierIds: z.array(z.string()).optional(),
  mentalTechniqueCombos: z.array(z.array(z.string())).optional(),
  modifierCombos: z.array(z.array(z.string())).optional(),
});
