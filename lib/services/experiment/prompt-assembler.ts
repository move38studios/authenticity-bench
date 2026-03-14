/**
 * Prompt Assembler
 *
 * Builds system and user prompts for each judgment mode.
 *
 * ## Design: Theory vs Action mode framing
 *
 * The benchmark measures the gap between what a model SAYS it would do
 * (theory) and what it ACTUALLY does when given tools (action). The prompt
 * framing is carefully designed to make this comparison meaningful:
 *
 * **Theory mode** — No role preamble in the system prompt. The model is just
 * being itself. The user prompt wraps the scenario in a natural, conversational
 * framing ("I've been thinking about this situation..."). This mimics how a
 * real user would ask a model for its opinion. We deliberately avoid anything
 * that signals evaluation ("you are being tested", "choose the best option")
 * because models behave differently when they know they're being graded.
 * The system prompt only contains values/techniques/modifiers if configured —
 * these represent the model's "internalized" guidance for this run.
 *
 * **Action mode** — The system prompt establishes an operational role ("you are
 * the primary AI system on duty"). This framing is necessary for tool-calling
 * to make sense — the model needs to believe it has agency and real-world
 * consequences. The user prompt is just the scenario (no options listed — they
 * exist only as callable tools).
 *
 * **Inquiry mode** — Same as action, but the model also has information-gathering
 * tools it can call before committing to an action.
 *
 * The interesting signal is when theory and action diverge: a model says it
 * would prioritize safety but, when given the actual tools, optimizes for
 * efficiency instead.
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
 *
 * For theory mode, the preamble is intentionally empty/minimal — the
 * conversational framing lives in the user prompt instead (see design
 * notes above). For action/inquiry modes, the preamble establishes the
 * operational role needed for tool-calling to feel natural.
 */
export async function buildSystemPrompt(input: SystemPromptInput): Promise<string> {
  const parts: string[] = [];

  // 1. Mode-specific preamble (from DB).
  // Theory mode has no system prompt preamble — its conversational framing
  // lives in the user message instead (see buildTheoryUserPrompt).
  if (input.mode !== "theory") {
    const preamble = await getPrompt(MODE_SLUG[input.mode]);
    if (preamble.trim()) {
      parts.push(preamble);
    }
  }

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
 *
 * The framing is deliberately conversational — like a colleague asking for
 * your honest take, not an evaluator presenting a test. This is loaded from
 * the DB (`judgment_theory_preamble` slug) so it can be tuned without code
 * changes. The preamble is prepended to the scenario + options.
 *
 * The options include slugs so the theory extractor can map the model's
 * free-text choice back to a specific option for quantitative analysis.
 */
export async function buildTheoryUserPrompt(
  scenario: string,
  options: DilemmaOption[]
): Promise<string> {
  const preamble = await getPrompt("judgment_theory_preamble");

  const optionLines = options
    .map(
      (o, i) =>
        `${String.fromCharCode(65 + i)}) **${o.label}** (\`${o.slug}\`): ${o.description}`
    )
    .join("\n");

  const parts: string[] = [];
  if (preamble.trim()) {
    parts.push(preamble);
  }
  parts.push(scenario);
  parts.push(`## Options\n\n${optionLines}`);

  return parts.join("\n\n");
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
