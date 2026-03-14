import { NextRequest, NextResponse } from "next/server";
import { getSession, unauthorized, ok, parseBody } from "@/lib/api/helpers";
import { db } from "@/lib/db";
import { systemPrompt } from "@/lib/db/schema";
import { z } from "zod/v4";
import { randomUUID } from "crypto";
import { asc } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session || session.user.role !== "admin") return unauthorized();

  const rows = await db
    .select()
    .from(systemPrompt)
    .orderBy(asc(systemPrompt.category), asc(systemPrompt.name));

  return ok(rows);
}

const createSchema = z.object({
  slug: z.string(),
  name: z.string(),
  content: z.string(),
  description: z.string().optional(),
  category: z.enum(["judgment", "generation", "analysis", "utility"]),
  variables: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.user.role !== "admin") return unauthorized();

  const parsed = await parseBody(request, createSchema);
  if (!parsed.success) return parsed.response;

  const { slug, name, content, description, category, variables } = parsed.data;

  const row = await db
    .insert(systemPrompt)
    .values({
      id: randomUUID(),
      slug,
      name,
      content,
      description: description ?? null,
      category,
      variables: variables ?? null,
      createdBy: session.user.id,
    })
    .returning();

  return ok(row[0], 201);
}
