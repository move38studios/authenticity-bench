import { db } from "@/lib/db";
import { modelConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getSession,
  unauthorized,
  notFound,
  ok,
  parseBody,
} from "@/lib/api/helpers";
import { updateModelConfigSchema } from "@/lib/api/schemas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const rows = await db
    .select()
    .from(modelConfig)
    .where(eq(modelConfig.id, id))
    .limit(1);

  if (rows.length === 0) return notFound("Model config");
  return ok(rows[0]);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const parsed = await parseBody(request, updateModelConfigSchema);
  if (!parsed.success) return parsed.response;

  const { id } = await params;
  const rows = await db
    .update(modelConfig)
    .set(parsed.data)
    .where(eq(modelConfig.id, id))
    .returning();

  if (rows.length === 0) return notFound("Model config");
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
    .delete(modelConfig)
    .where(eq(modelConfig.id, id))
    .returning();

  if (rows.length === 0) return notFound("Model config");
  return ok({ deleted: true });
}
