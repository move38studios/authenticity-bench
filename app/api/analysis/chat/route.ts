/**
 * GET  /api/analysis/chat — List user's analysis chats
 * POST /api/analysis/chat — Create a new analysis chat
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, unauthorized, ok } from "@/lib/api/helpers";
import { db } from "@/lib/db";
import { analysisChat, analysisChatMessage } from "@/lib/db/schema/analysis-chat";
import { eq, desc, count, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const chats = await db.query.analysisChat.findMany({
    where: eq(analysisChat.userId, session.user.id),
    orderBy: [desc(analysisChat.updatedAt)],
    columns: {
      id: true,
      title: true,
      loadedExperiments: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Get message counts
  const chatIds = chats.map((c) => c.id);
  const countMap = new Map<string, number>();

  if (chatIds.length > 0) {
    const counts = await db
      .select({
        chatId: analysisChatMessage.chatId,
        messageCount: count(analysisChatMessage.id),
      })
      .from(analysisChatMessage)
      .where(inArray(analysisChatMessage.chatId, chatIds))
      .groupBy(analysisChatMessage.chatId);

    for (const c of counts) countMap.set(c.chatId, c.messageCount);
  }

  return ok(
    chats.map((chat) => ({
      ...chat,
      messageCount: countMap.get(chat.id) ?? 0,
    }))
  );
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  let body: { experimentId?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is fine — creates a blank chat
  }

  const chatId = randomUUID();
  const now = new Date();

  await db.insert(analysisChat).values({
    id: chatId,
    userId: session.user.id,
    title: null,
    loadedExperiments: [],
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json(
    {
      data: {
        id: chatId,
        preloadExperimentId: body.experimentId ?? null,
      },
    },
    { status: 201 }
  );
}
