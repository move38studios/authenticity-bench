import { db } from "@/lib/db";
import { valuesSystem } from "@/lib/db/schema";
import { randomUUID } from "crypto";
import {
  getSession,
  unauthorized,
  ok,
  parseBody,
} from "@/lib/api/helpers";
import { createValuesSystemSchema } from "@/lib/api/schemas";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const rows = await db
    .select()
    .from(valuesSystem)
    .orderBy(valuesSystem.createdAt);

  return ok(rows);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const parsed = await parseBody(request, createValuesSystemSchema);
  if (!parsed.success) return parsed.response;

  const row = await db
    .insert(valuesSystem)
    .values({
      id: randomUUID(),
      ...parsed.data,
      createdBy: session.user.id,
    })
    .returning();

  return ok(row[0], 201);
}
