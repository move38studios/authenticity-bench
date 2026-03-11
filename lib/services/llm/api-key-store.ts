/**
 * Reads active API keys from the database for LLM providers.
 * Keys are encrypted at rest and decrypted on read.
 */

import { db } from "@/lib/db";
import { providerApiKey } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { eq, and } from "drizzle-orm";

/**
 * Get the active API key for a provider from the database.
 * Returns null if no active key exists (caller should fall back to env var).
 */
export async function getActiveApiKey(
  provider: string
): Promise<string | null> {
  try {
    const rows = await db
      .select({ encryptedKey: providerApiKey.encryptedKey })
      .from(providerApiKey)
      .where(
        and(
          eq(providerApiKey.provider, provider),
          eq(providerApiKey.isActive, true)
        )
      )
      .limit(1);

    if (rows.length === 0) return null;

    return decrypt(rows[0].encryptedKey);
  } catch {
    // If ENCRYPTION_KEY is not set or table doesn't exist yet, silently fall back
    return null;
  }
}
