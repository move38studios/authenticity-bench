/**
 * Blob Storage Service
 *
 * Wraps @vercel/blob for storing analysis files (SQLite exports, charts, CSVs).
 */

import { put, del } from "@vercel/blob";

export async function uploadAnalysisFile(
  buffer: Buffer,
  path: string,
  contentType: string
): Promise<string> {
  const blob = await put(path, buffer, {
    access: "public",
    contentType,
    addRandomSuffix: false,
  });
  return blob.url;
}

export async function deleteAnalysisFile(url: string): Promise<void> {
  await del(url);
}
