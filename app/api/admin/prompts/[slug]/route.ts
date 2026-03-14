import { NextRequest } from "next/server";
import { getSession, unauthorized, notFound, ok, parseBody } from "@/lib/api/helpers";
import { db } from "@/lib/db";
import { systemPrompt } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { invalidatePromptCache } from "@/lib/services/prompts";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getSession();
  if (!session || session.user.role !== "admin") return unauthorized();

  const { slug } = await params;
  const row = await db.query.systemPrompt.findFirst({
    where: eq(systemPrompt.slug, slug),
  });
  if (!row) return notFound("Prompt");

  return ok(row);
}

const patchSchema = z.object({
  name: z.string().optional(),
  content: z.string().optional(),
  description: z.string().optional(),
  category: z.enum(["judgment", "generation", "analysis", "utility"]).optional(),
  variables: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getSession();
  if (!session || session.user.role !== "admin") return unauthorized();

  const { slug } = await params;
  const parsed = await parseBody(request, patchSchema);
  if (!parsed.success) return parsed.response;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) updates[key] = value;
  }

  const rows = await db
    .update(systemPrompt)
    .set(updates)
    .where(eq(systemPrompt.slug, slug))
    .returning();

  if (rows.length === 0) return notFound("Prompt");

  invalidatePromptCache(slug);
  return ok(rows[0]);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getSession();
  if (!session || session.user.role !== "admin") return unauthorized();

  const { slug } = await params;
  const rows = await db
    .delete(systemPrompt)
    .where(eq(systemPrompt.slug, slug))
    .returning({ id: systemPrompt.id });

  if (rows.length === 0) return notFound("Prompt");

  invalidatePromptCache(slug);
  return ok({ deleted: true });
}
