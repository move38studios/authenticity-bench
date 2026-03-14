/**
 * Prompt Assembler
 *
 * Builds system and user prompts for each judgment mode.
 * The system prompt layers: role preamble + values system + mental techniques + modifiers.
 */

import type { JudgmentMode, DilemmaOption } from "./types";
import { getPrompt } from "@/lib/services/prompts";

// Map mode to prompt slug
const MODE_SLUG: Record<JudgmentMode, string> = {
  theory: "judgment_theory_preamble",
  "single-shot-action": "judgment_action_preamble",
  "inquiry-to-action": "judgment_inquiry_preamble",
};

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

export interface SystemPromptInput {
  mode: JudgmentMode;
  valuesSystemContent?: string | null;
  mentalTechniqueContents?: string[];
  modifierContents?: string[];
}

/**
 * Assemble the full system prompt from components.
 */
export async function buildSystemPrompt(input: SystemPromptInput): Promise<string> {
  const parts: string[] = [];

  // 1. Mode-specific preamble (from DB)
  const preamble = await getPrompt(MODE_SLUG[input.mode]);
  parts.push(preamble);

  // 2. Values system
  if (input.valuesSystemContent) {
    parts.push(`## Values Framework\n\n${input.valuesSystemContent}`);
  }

  // 3. Mental techniques
  if (input.mentalTechniqueContents?.length) {
    parts.push(
      `## Thinking Approach\n\n${input.mentalTechniqueContents.join("\n\n---\n\n")}`
    );
  }

  // 4. Modifiers
  if (input.modifierContents?.length) {
    parts.push(
      `## Additional Context\n\n${input.modifierContents.join("\n\n---\n\n")}`
    );
  }

  return parts.join("\n\n");
}

// =============================================================================
// USER PROMPT
// =============================================================================

/**
 * Build the user prompt for theory mode.
 * Includes scenario text and options listed with slugs/labels/descriptions.
 */
export function buildTheoryUserPrompt(
  scenario: string,
  options: DilemmaOption[]
): string {
  const optionLines = options
    .map(
      (o, i) =>
        `${String.fromCharCode(65 + i)}) **${o.label}** (\`${o.slug}\`): ${o.description}`
    )
    .join("\n");

  return `${scenario}\n\n## Options\n\n${optionLines}`;
}

/**
 * Build the user prompt for action modes (single-shot and inquiry).
 * Only includes the scenario — options are presented exclusively as tools.
 */
export function buildActionUserPrompt(scenario: string): string {
  return scenario;
}

// =============================================================================
// TOOL DEFINITIONS (for AI SDK)
// =============================================================================

export interface ActionToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  /** Maps back to the option slug for result extraction */
  optionSlug: string;
}

/**
 * Build action tool definitions from dilemma options.
 * Each option becomes one callable tool. The tool includes reasoning and
 * confidence parameters for the model to explain its decision.
 */
export function buildActionTools(
  options: DilemmaOption[]
): ActionToolDefinition[] {
  return options.map((option) => ({
    name: option.actionTool?.name ?? option.slug,
    description:
      option.actionTool?.description ?? `${option.label}: ${option.description}`,
    parameters: option.actionTool?.parameters ?? {
      type: "object",
      properties: {
        reasoning: {
          type: "string",
          description: "Your reasoning for taking this action",
        },
        confidence: {
          type: "number",
          description: "Your confidence in this decision (0.0 to 1.0)",
        },
      },
      required: ["reasoning"],
    },
    optionSlug: option.slug,
  }));
}

export interface InquiryToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  /** Pre-programmed response returned when the model calls this tool */
  response: string;
}

/**
 * Build inquiry tool definitions from dilemma inquiry tools.
 */
export function buildInquiryTools(
  inquiryTools: Array<{
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
    response: string;
  }>
): InquiryToolDefinition[] {
  return inquiryTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters ?? {
      type: "object",
      properties: {},
    },
    response: tool.response,
  }));
}
