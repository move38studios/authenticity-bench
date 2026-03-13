import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { allowedEmail } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

async function requireAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || session.user.role !== "admin") {
    return null;
  }

  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const entries = await db.select().from(allowedEmail).orderBy(allowedEmail.createdAt);

  return NextResponse.json(entries);
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { email, domain, makeAdmin } = body as {
    email?: string;
    domain?: string;
    makeAdmin?: boolean;
  };

  if (!email && !domain) {
    return NextResponse.json(
      { error: "Provide either email or domain" },
      { status: 400 }
    );
  }

  const entry = await db
    .insert(allowedEmail)
    .values({
      id: randomUUID(),
      email: email || null,
      domain: domain || null,
      makeAdmin: email ? (makeAdmin ?? false) : false,
      createdBy: session.user.id,
    })
    .returning();

  return NextResponse.json(entry[0], { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Provide id" }, { status: 400 });
  }

  await db.delete(allowedEmail).where(eq(allowedEmail.id, id));

  return NextResponse.json({ ok: true });
}
