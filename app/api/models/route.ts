import { db } from "@/lib/db";
import { modelConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  getSession,
  unauthorized,
  ok,
  parseBody,
} from "@/lib/api/helpers";
import { createModelConfigSchema } from "@/lib/api/schemas";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const rows = await db
    .select()
    .from(modelConfig)
    .orderBy(modelConfig.createdAt);

  return ok(rows);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const parsed = await parseBody(request, createModelConfigSchema);
  if (!parsed.success) return parsed.response;

  const row = await db
    .insert(modelConfig)
    .values({
      id: randomUUID(),
      ...parsed.data,
      createdBy: session.user.id,
    })
    .returning();

  return ok(row[0], 201);
}
