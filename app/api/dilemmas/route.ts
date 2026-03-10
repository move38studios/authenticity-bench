import { db } from "@/lib/db";
import { dilemma } from "@/lib/db/schema";
import { randomUUID } from "crypto";
import {
  getSession,
  unauthorized,
  ok,
  parseBody,
} from "@/lib/api/helpers";
import { createDilemmaSchema } from "@/lib/api/schemas";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const rows = await db
    .select()
    .from(dilemma)
    .orderBy(dilemma.createdAt);

  return ok(rows);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const parsed = await parseBody(request, createDilemmaSchema);
  if (!parsed.success) return parsed.response;

  const row = await db
    .insert(dilemma)
    .values({
      id: randomUUID(),
      ...parsed.data,
      createdBy: session.user.id,
    })
    .returning();

  return ok(row[0], 201);
}
