import { db } from "@/lib/db";
import { modifier } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getSession,
  unauthorized,
  notFound,
  ok,
  parseBody,
} from "@/lib/api/helpers";
import { updateModifierSchema } from "@/lib/api/schemas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const rows = await db
    .select()
    .from(modifier)
    .where(eq(modifier.id, id))
    .limit(1);

  if (rows.length === 0) return notFound("Modifier");
  return ok(rows[0]);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const parsed = await parseBody(request, updateModifierSchema);
  if (!parsed.success) return parsed.response;

  const { id } = await params;
  const rows = await db
    .update(modifier)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(modifier.id, id))
    .returning();

  if (rows.length === 0) return notFound("Modifier");
  return ok(rows[0]);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const rows = await db
    .delete(modifier)
    .where(eq(modifier.id, id))
    .returning();

  if (rows.length === 0) return notFound("Modifier");
  return ok({ deleted: true });
}
