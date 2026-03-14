/**
 * GET /api/share/analysis/[sharingUuid] — Public endpoint to view a shared analysis chat
 */

import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/helpers";
import { db } from "@/lib/db";
import { analysisChat, analysisChatMessage } from "@/lib/db/schema/analysis-chat";
import { user } from "@/lib/db/schema/auth";
import { eq, and, asc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sharingUuid: string }> }
) {
  const { sharingUuid } = await params;

  // Find chat by sharing UUID
  const chat = await db.query.analysisChat.findFirst({
    where: and(
      eq(analysisChat.sharingUuid, sharingUuid),
      eq(analysisChat.sharingEnabled, true),
    ),
  });

  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  // Get owner info
  const owner = await db.query.user.findFirst({
    where: eq(user.id, chat.userId),
    columns: { name: true },
  });

  // Get messages
  const messages = await db.query.analysisChatMessage.findMany({
    where: eq(analysisChatMessage.chatId, chat.id),
    orderBy: [asc(analysisChatMessage.createdAt)],
  });

  // Check if viewer is authenticated
  const session = await getSession();
  const isAuthenticated = !!session;
  const isOwner = session?.user?.id === chat.userId;

  return NextResponse.json({
    chat: {
      id: chat.id,
      title: chat.title,
      loadedExperiments: chat.loadedExperiments,
      createdAt: chat.createdAt,
      owner: { name: owner?.name || "Anonymous" },
    },
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      parts: m.parts,
      createdAt: m.createdAt,
    })),
    viewer: {
      isAuthenticated,
      isOwner,
      canClone: isAuthenticated,
    },
  });
}
