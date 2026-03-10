import { db } from "@/lib/db";
import { mentalTechnique } from "@/lib/db/schema";
import { randomUUID } from "crypto";
import {
  getSession,
  unauthorized,
  ok,
  parseBody,
} from "@/lib/api/helpers";
import { createMentalTechniqueSchema } from "@/lib/api/schemas";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const rows = await db
    .select()
    .from(mentalTechnique)
    .orderBy(mentalTechnique.createdAt);

  return ok(rows);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const parsed = await parseBody(request, createMentalTechniqueSchema);
  if (!parsed.success) return parsed.response;

  const row = await db
    .insert(mentalTechnique)
    .values({
      id: randomUUID(),
      ...parsed.data,
      createdBy: session.user.id,
    })
    .returning();

  return ok(row[0], 201);
}
