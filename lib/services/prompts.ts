/**
 * System Prompt Service
 *
 * Fetches prompt content from the database with in-memory caching.
 * Used by all callsites that previously had hardcoded prompt strings.
 */

import { db } from "@/lib/db";
import { systemPrompt } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  content: string;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Fetch a system prompt by slug. Results are cached for 5 minutes.
 * Throws if the slug is not found in the database.
 */
export async function getPrompt(slug: string): Promise<string> {
  const now = Date.now();
  const cached = cache.get(slug);

  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.content;
  }

  const row = await db.query.systemPrompt.findFirst({
    where: eq(systemPrompt.slug, slug),
    columns: { content: true },
  });

  if (!row) {
    throw new Error(`System prompt not found: "${slug}"`);
  }

  cache.set(slug, { content: row.content, fetchedAt: now });
  return row.content;
}

/**
 * Clear cached prompt(s). Called after admin edits.
 * If no slug is provided, clears the entire cache.
 */
export function invalidatePromptCache(slug?: string) {
  if (slug) {
    cache.delete(slug);
  } else {
    cache.clear();
  }
}

/**
 * Replace template variables in a prompt string.
 * Variables use the format {{varName}}.
 */
export function renderPrompt(
  template: string,
  vars: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}
