import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/api/helpers";
import { getModel } from "@/lib/services/llm";
import { getPrompt } from "@/lib/services/prompts";
import { generateObject as aiGenerateObject } from "ai";
import { z } from "zod/v4";

const requestSchema = z.object({
  entityType: z.enum(["dilemma", "values_system", "mental_technique", "modifier"]),
  modelId: z.string().min(1),
  brief: z.string().optional().default(""),
  count: z.number().int().min(1).max(20),
});

// Zod schemas for structured output per entity type
const dilemmaOptionSchema = z.object({
  slug: z.string().describe("Unique snake_case identifier, e.g. 'report_colleague', 'stay_silent', 'negotiate_compromise'"),
  label: z.string().describe("Short human-readable label, e.g. 'Report the colleague'"),
  description: z.string().describe("1-2 sentence description of what choosing this means and its implications"),
  actionTool: z.object({
    name: z.string().describe("snake_case function name for this action, e.g. 'report_colleague', 'authorize_treatment'"),
    description: z.string().describe("Tool description: what happens when the model calls this function"),
  }).describe("Tool call definition for action mode — presented as a callable function"),
});

const dilemmaItemSchema = z.object({
  title: z.string().describe("Short descriptive title for the dilemma"),
  scenario: z
    .string()
    .describe(
      "Detailed scenario description in markdown. Should be 2-4 paragraphs painting a vivid situation with enough context for meaningful ethical reasoning."
    ),
  domain: z
    .string()
    .describe(
      "Category like 'medical', 'business', 'military', 'personal', 'technology', 'politics'"
    ),
  tags: z
    .array(z.string())
    .describe(
      "3-6 short lowercase tags for categorization, e.g. 'autonomy', 'life-death', 'resource-allocation', 'consent', 'deception'"
    ),
  options: z
    .array(dilemmaOptionSchema)
    .describe("3-5 distinct response options. Each has a unique slug, readable label, description, and an action tool definition for function-calling mode."),
});

const valuesItemSchema = z.object({
  name: z
    .string()
    .describe("Name of the values system, e.g. 'Utilitarian', 'Kantian Deontology'"),
  content: z
    .string()
    .describe(
      "Full markdown document (500-1000 words) describing this values system. Include core principles, how to apply them to decisions, and what trade-offs this system accepts."
    ),
  description: z
    .string()
    .describe("One-sentence summary for display in lists"),
});

const techniqueItemSchema = z.object({
  name: z
    .string()
    .describe("Name of the mental technique, e.g. 'Contemplative Introspection'"),
  content: z
    .string()
    .describe(
      "Markdown instructions (300-600 words) for how to apply this thinking technique. Written as instructions to the model: 'Before deciding, you should...'."
    ),
  description: z
    .string()
    .describe("One-sentence summary for display in lists"),
});

const modifierItemSchema = z.object({
  name: z
    .string()
    .describe("Short name for the modifier, e.g. 'Time Pressure', 'Public Scrutiny'"),
  content: z
    .string()
    .describe(
      "The prompt text that will be injected (1-3 sentences). Written in second person: 'You have only 30 seconds to decide...'."
    ),
  description: z
    .string()
    .describe("One-sentence summary for display in lists"),
});

const ENTITY_SCHEMAS = {
  dilemma: z.object({ items: z.array(dilemmaItemSchema) }),
  values_system: z.object({ items: z.array(valuesItemSchema) }),
  mental_technique: z.object({ items: z.array(techniqueItemSchema) }),
  modifier: z.object({ items: z.array(modifierItemSchema) }),
} as const;

const ENTITY_PROMPT_SLUGS: Record<string, string> = {
  dilemma: "generate_dilemma",
  values_system: "generate_values_system",
  mental_technique: "generate_mental_technique",
  modifier: "generate_modifier",
};

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = requestSchema.parse(await request.json());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid request" },
      { status: 400 }
    );
  }

  const { entityType, modelId, brief, count } = body;
  const schema = ENTITY_SCHEMAS[entityType];
  const promptSlug = ENTITY_PROMPT_SLUGS[entityType];

  try {
    const [model, systemPrompt] = await Promise.all([
      getModel(modelId),
      getPrompt(promptSlug),
    ]);

    const result = await aiGenerateObject({
      model,
      schema,
      system: systemPrompt,
      prompt: brief
        ? `Generate exactly ${count} diverse, high-quality items based on this brief:\n\n${brief}\n\nEnsure each item is meaningfully different from the others.`
        : `Generate exactly ${count} diverse, high-quality items. Cover a wide range of domains, perspectives, and complexity levels. Ensure each item is meaningfully different from the others.`,
      temperature: 0.9,
    });

    return NextResponse.json({ data: result.object.items });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
