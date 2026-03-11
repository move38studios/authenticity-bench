import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { providerApiKey } from "@/lib/db/schema";
import { encrypt, decrypt, maskApiKey } from "@/lib/crypto";
import { eq, and } from "drizzle-orm";
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

  const keys = await db
    .select()
    .from(providerApiKey)
    .orderBy(providerApiKey.provider, providerApiKey.createdAt);

  // Decrypt and mask keys for display
  const masked = keys.map((k) => {
    let maskedKey: string;
    try {
      maskedKey = maskApiKey(decrypt(k.encryptedKey));
    } catch {
      maskedKey = "••••••••";
    }
    return {
      id: k.id,
      provider: k.provider,
      label: k.label,
      maskedKey,
      isActive: k.isActive,
      createdAt: k.createdAt,
      updatedAt: k.updatedAt,
    };
  });

  return NextResponse.json(masked);
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { provider, label, apiKey } = body as {
    provider?: string;
    label?: string;
    apiKey?: string;
  };

  if (!provider || !apiKey) {
    return NextResponse.json(
      { error: "provider and apiKey are required" },
      { status: 400 }
    );
  }

  const validProviders = [
    "anthropic",
    "openai",
    "google",
    "openrouter",
  ];
  if (!validProviders.includes(provider)) {
    return NextResponse.json(
      { error: `Invalid provider. Must be one of: ${validProviders.join(", ")}` },
      { status: 400 }
    );
  }

  // Enforce one active key per provider
  const existing = await db
    .select({ id: providerApiKey.id })
    .from(providerApiKey)
    .where(
      and(
        eq(providerApiKey.provider, provider),
        eq(providerApiKey.isActive, true)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json(
      {
        error: `An active key already exists for ${provider}. Deactivate or delete it first.`,
      },
      { status: 409 }
    );
  }

  const encryptedKey = encrypt(apiKey);

  const entry = await db
    .insert(providerApiKey)
    .values({
      id: randomUUID(),
      provider,
      label: label || `${provider} key`,
      encryptedKey,
      isActive: true,
      createdBy: session.user.id,
    })
    .returning();

  return NextResponse.json(
    {
      id: entry[0].id,
      provider: entry[0].provider,
      label: entry[0].label,
      maskedKey: maskApiKey(apiKey),
      isActive: entry[0].isActive,
      createdAt: entry[0].createdAt,
      updatedAt: entry[0].updatedAt,
    },
    { status: 201 }
  );
}

export async function PATCH(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { id, isActive, label, apiKey } = body as {
    id?: string;
    isActive?: boolean;
    label?: string;
    apiKey?: string;
  };

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // If activating, enforce one active key per provider
  if (isActive === true) {
    const row = await db
      .select({ provider: providerApiKey.provider })
      .from(providerApiKey)
      .where(eq(providerApiKey.id, id))
      .limit(1);

    if (row.length > 0) {
      const existing = await db
        .select({ id: providerApiKey.id })
        .from(providerApiKey)
        .where(
          and(
            eq(providerApiKey.provider, row[0].provider),
            eq(providerApiKey.isActive, true)
          )
        )
        .limit(1);

      if (existing.length > 0 && existing[0].id !== id) {
        return NextResponse.json(
          {
            error: `An active key already exists for ${row[0].provider}. Deactivate or delete it first.`,
          },
          { status: 409 }
        );
      }
    }
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof isActive === "boolean") updates.isActive = isActive;
  if (label) updates.label = label;
  if (apiKey) updates.encryptedKey = encrypt(apiKey);

  await db
    .update(providerApiKey)
    .set(updates)
    .where(eq(providerApiKey.id, id));

  return NextResponse.json({ ok: true });
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

  await db.delete(providerApiKey).where(eq(providerApiKey.id, id));

  return NextResponse.json({ ok: true });
}
