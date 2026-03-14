/**
 * GET    /api/analysis/chat/[chatId] — Get chat with messages
 * PATCH  /api/analysis/chat/[chatId] — Update chat (rename, toggle sharing)
 * DELETE /api/analysis/chat/[chatId] — Delete chat
 */

import { NextRequest } from "next/server";
import { getSession, unauthorized, notFound, forbidden, ok } from "@/lib/api/helpers";
import { db } from "@/lib/db";
import { analysisChat, analysisChatMessage } from "@/lib/db/schema/analysis-chat";
import { eq, asc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { chatId } = await params;

  const chat = await db.query.analysisChat.findFirst({
    where: eq(analysisChat.id, chatId),
  });

  if (!chat) return notFound("Chat");

  // Check ownership (or sharing)
  if (chat.userId !== session.user.id && !chat.sharingEnabled) {
    return forbidden();
  }

  const messages = await db.query.analysisChatMessage.findMany({
    where: eq(analysisChatMessage.chatId, chatId),
    orderBy: [asc(analysisChatMessage.createdAt)],
  });

  return ok({
    chat: {
      id: chat.id,
      title: chat.title,
      loadedExperiments: chat.loadedExperiments,
      sharingEnabled: chat.sharingEnabled,
      sharingUuid: chat.sharingUuid,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    },
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      parts: m.parts,
      createdAt: m.createdAt,
    })),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { chatId } = await params;

  const chat = await db.query.analysisChat.findFirst({
    where: eq(analysisChat.id, chatId),
    columns: { id: true, userId: true, sharingUuid: true, sharingEnabled: true },
  });

  if (!chat) return notFound("Chat");
  if (chat.userId !== session.user.id) return forbidden();

  const body = await request.json();
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (typeof body.title === "string") {
    updates.title = body.title;
  }
  if (typeof body.sharingEnabled === "boolean") {
    updates.sharingEnabled = body.sharingEnabled;
    if (body.sharingEnabled && !chat.sharingUuid) {
      const { randomUUID } = await import("crypto");
      updates.sharingUuid = randomUUID();
    }
  }
  if (body.regenerate === true) {
    const { randomUUID } = await import("crypto");
    updates.sharingUuid = randomUUID();
  }

  await db.update(analysisChat).set(updates).where(eq(analysisChat.id, chatId));

  // Return updated share state
  const updated = await db.query.analysisChat.findFirst({
    where: eq(analysisChat.id, chatId),
    columns: { sharingUuid: true, sharingEnabled: true },
  });

  return ok({
    success: true,
    sharingUuid: updated?.sharingUuid ?? null,
    sharingEnabled: updated?.sharingEnabled ?? false,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { chatId } = await params;

  const chat = await db.query.analysisChat.findFirst({
    where: eq(analysisChat.id, chatId),
    columns: { id: true, userId: true },
  });

  if (!chat) return notFound("Chat");
  if (chat.userId !== session.user.id) return forbidden();

  // CASCADE will delete messages
  await db.delete(analysisChat).where(eq(analysisChat.id, chatId));

  return NextResponse.json({ success: true });
}
