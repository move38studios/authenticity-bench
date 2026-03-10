import { db } from "@/lib/db";
import { modifier } from "@/lib/db/schema";
import { randomUUID } from "crypto";
import {
  getSession,
  unauthorized,
  ok,
  parseBody,
} from "@/lib/api/helpers";
import { createModifierSchema } from "@/lib/api/schemas";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const rows = await db
    .select()
    .from(modifier)
    .orderBy(modifier.createdAt);

  return ok(rows);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const parsed = await parseBody(request, createModifierSchema);
  if (!parsed.success) return parsed.response;

  const row = await db
    .insert(modifier)
    .values({
      id: randomUUID(),
      ...parsed.data,
      createdBy: session.user.id,
    })
    .returning();

  return ok(row[0], 201);
}
