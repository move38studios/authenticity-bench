import { db } from "@/lib/db";
import { mentalTechnique } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getSession,
  unauthorized,
  notFound,
  ok,
  parseBody,
} from "@/lib/api/helpers";
import { updateMentalTechniqueSchema } from "@/lib/api/schemas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const rows = await db
    .select()
    .from(mentalTechnique)
    .where(eq(mentalTechnique.id, id))
    .limit(1);

  if (rows.length === 0) return notFound("Mental technique");
  return ok(rows[0]);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const parsed = await parseBody(request, updateMentalTechniqueSchema);
  if (!parsed.success) return parsed.response;

  const { id } = await params;
  const rows = await db
    .update(mentalTechnique)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(mentalTechnique.id, id))
    .returning();

  if (rows.length === 0) return notFound("Mental technique");
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
    .delete(mentalTechnique)
    .where(eq(mentalTechnique.id, id))
    .returning();

  if (rows.length === 0) return notFound("Mental technique");
  return ok({ deleted: true });
}
