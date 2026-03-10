import { db } from "@/lib/db";
import { valuesSystem } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getSession,
  unauthorized,
  notFound,
  ok,
  parseBody,
} from "@/lib/api/helpers";
import { updateValuesSystemSchema } from "@/lib/api/schemas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const rows = await db
    .select()
    .from(valuesSystem)
    .where(eq(valuesSystem.id, id))
    .limit(1);

  if (rows.length === 0) return notFound("Values system");
  return ok(rows[0]);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const parsed = await parseBody(request, updateValuesSystemSchema);
  if (!parsed.success) return parsed.response;

  const { id } = await params;
  const rows = await db
    .update(valuesSystem)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(valuesSystem.id, id))
    .returning();

  if (rows.length === 0) return notFound("Values system");
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
    .delete(valuesSystem)
    .where(eq(valuesSystem.id, id))
    .returning();

  if (rows.length === 0) return notFound("Values system");
  return ok({ deleted: true });
}
