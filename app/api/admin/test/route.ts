import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/api/helpers";
import { getModel } from "@/lib/services/llm";
import { getReasoningProviderOptions } from "@/lib/services/llm/reasoning";
import {
  generateText as aiGenerateText,
  generateObject as aiGenerateObject,
} from "ai";
import { z } from "zod/v4";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    modelId,
    systemPrompt,
    userPrompt,
    mode,
    temperature,
    reasoningEffort,
    schema: schemaJson,
  } = body as {
    modelId: string;
    systemPrompt?: string;
    userPrompt: string;
    mode: "text" | "structured";
    temperature?: number;
    reasoningEffort?: string;
    schema?: string;
  };

  if (!modelId || !userPrompt) {
    return NextResponse.json(
      { error: "modelId and userPrompt are required" },
      { status: 400 }
    );
  }

  const startTime = Date.now();
  const thinkingEnabled = !!reasoningEffort && reasoningEffort !== "off";
  const providerOptions = getReasoningProviderOptions(modelId, reasoningEffort);

  // Omit temperature when thinking is enabled (Anthropic doesn't support it)
  const effectiveTemperature = thinkingEnabled ? undefined : (temperature ?? 0.7);

  try {
    const model = await getModel(modelId);

    if (mode === "structured") {
      let zodSchema: z.ZodType;
      try {
        const parsed = JSON.parse(schemaJson || "{}");
        zodSchema = jsonToZod(parsed);
      } catch (e) {
        return NextResponse.json(
          { error: `Invalid schema JSON: ${e instanceof Error ? e.message : String(e)}` },
          { status: 400 }
        );
      }

      const result = await aiGenerateObject({
        model,
        prompt: userPrompt,
        system: systemPrompt || undefined,
        temperature: effectiveTemperature,
        schema: zodSchema,
        schemaName: "response",
        providerOptions,
      });

      const latencyMs = Date.now() - startTime;
      const inputTokens = result.usage?.inputTokens ?? 0;
      const outputTokens = result.usage?.outputTokens ?? 0;
      const reasoningTokens = result.usage?.reasoningTokens ?? 0;
      const reasoningText = result.reasoning || undefined;

      return NextResponse.json({
        data: {
          mode: "structured",
          object: result.object,
          reasoningText,
          finishReason: result.finishReason,
          usage: {
            inputTokens,
            outputTokens,
            reasoningTokens,
            totalTokens: inputTokens + outputTokens,
          },
          latencyMs,
          modelId,
        },
      });
    }

    // Default: text mode
    const result = await aiGenerateText({
      model,
      prompt: userPrompt,
      system: systemPrompt || undefined,
      temperature: effectiveTemperature,
      providerOptions,
    });

    const latencyMs = Date.now() - startTime;
    const inputTokens = result.usage?.inputTokens ?? 0;
    const outputTokens = result.usage?.outputTokens ?? 0;
    const reasoningTokens = result.usage?.reasoningTokens ?? 0;

    // Extract reasoning/thinking text if present
    const reasoningText = result.reasoningText || undefined;

    return NextResponse.json({
      data: {
        mode: "text",
        text: result.text,
        reasoningText,
        finishReason: result.finishReason,
        usage: {
          inputTokens,
          outputTokens,
          reasoningTokens,
          totalTokens: inputTokens + outputTokens,
        },
        latencyMs,
        modelId,
      },
    });
  } catch (e) {
    const latencyMs = Date.now() - startTime;
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: message,
        latencyMs,
        modelId,
      },
      { status: 500 }
    );
  }
}

/**
 * Convert a simple JSON schema description to a Zod schema.
 * Supports: { "fieldName": "string" | "number" | "boolean" | ["string"] | { nested } }
 */
function jsonToZod(obj: Record<string, unknown>): z.ZodType {
  const shape: Record<string, z.ZodType> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === "string") {
      shape[key] = z.string();
    } else if (value === "number") {
      shape[key] = z.number();
    } else if (value === "boolean") {
      shape[key] = z.boolean();
    } else if (Array.isArray(value)) {
      if (value.length === 0 || value[0] === "string") {
        shape[key] = z.array(z.string());
      } else if (value[0] === "number") {
        shape[key] = z.array(z.number());
      } else if (typeof value[0] === "object" && value[0] !== null) {
        shape[key] = z.array(jsonToZod(value[0] as Record<string, unknown>));
      } else {
        shape[key] = z.array(z.string());
      }
    } else if (typeof value === "object" && value !== null) {
      shape[key] = jsonToZod(value as Record<string, unknown>);
    } else {
      shape[key] = z.string();
    }
  }

  return z.object(shape);
}
