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
export const createDilemmaSchema = z.object({
  title: z.string().min(1),
  scenario: z.string().min(1),
  domain: z.string().optional(),
  options: z.array(z.string()).min(2),
  isPublic: z.boolean().optional().default(true),
  actionTool: z.record(z.string(), z.unknown()).optional(),
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
