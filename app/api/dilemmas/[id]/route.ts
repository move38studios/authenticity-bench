import { db } from "@/lib/db";
import { dilemma } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getSession,
  unauthorized,
  notFound,
  ok,
  parseBody,
} from "@/lib/api/helpers";
import { updateDilemmaSchema } from "@/lib/api/schemas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const rows = await db
    .select()
    .from(dilemma)
    .where(eq(dilemma.id, id))
    .limit(1);

  if (rows.length === 0) return notFound("Dilemma");
  return ok(rows[0]);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const parsed = await parseBody(request, updateDilemmaSchema);
  if (!parsed.success) return parsed.response;

  const { id } = await params;
  const rows = await db
    .update(dilemma)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(dilemma.id, id))
    .returning();

  if (rows.length === 0) return notFound("Dilemma");
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
    .delete(dilemma)
    .where(eq(dilemma.id, id))
    .returning();

  if (rows.length === 0) return notFound("Dilemma");
  return ok({ deleted: true });
}
