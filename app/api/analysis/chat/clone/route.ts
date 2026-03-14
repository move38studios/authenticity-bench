/**
 * POST /api/analysis/chat/clone — Clone a shared analysis chat
 */

import { NextRequest } from "next/server";
import { getSession, unauthorized, notFound, ok } from "@/lib/api/helpers";
import { db } from "@/lib/db";
import { analysisChat, analysisChatMessage } from "@/lib/db/schema/analysis-chat";
import { eq, asc, and } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { sharingUuid } = (await request.json()) as { sharingUuid: string };
  if (!sharingUuid) {
    return notFound("Chat");
  }

  // Find original chat by sharing UUID
  const original = await db.query.analysisChat.findFirst({
    where: and(
      eq(analysisChat.sharingUuid, sharingUuid),
      eq(analysisChat.sharingEnabled, true),
    ),
  });

  if (!original) return notFound("Shared chat");

  // Get original messages
  const originalMessages = await db.query.analysisChatMessage.findMany({
    where: eq(analysisChatMessage.chatId, original.id),
    orderBy: [asc(analysisChatMessage.createdAt)],
  });

  // Create new chat
  const newChatId = randomUUID();
  const now = new Date();

  await db.insert(analysisChat).values({
    id: newChatId,
    userId: session.user.id,
    title: original.title ? `${original.title} (copy)` : "Cloned Analysis",
    loadedExperiments: original.loadedExperiments,
    createdAt: now,
    updatedAt: now,
  });

  // Clone messages
  if (originalMessages.length > 0) {
    await db.insert(analysisChatMessage).values(
      originalMessages.map((msg) => ({
        id: randomUUID(),
        chatId: newChatId,
        role: msg.role,
        parts: msg.parts,
        content: msg.content,
        metadata: msg.metadata,
        createdAt: new Date(),
      }))
    );
  }

  return ok({ chatId: newChatId });
}
