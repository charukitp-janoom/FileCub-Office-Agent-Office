/** Trims/collapses whitespace and applies Unicode NFC so Thai combining
 * marks typed differently (e.g. sara am composed vs. decomposed) still
 * compare equal against what got indexed. */
export function normalizeQuery(raw: string): string {
  return raw.normalize("NFC").trim().replace(/\s+/g, " ");
}

/**
 * Wraps a normalized query as an FTS5 phrase literal so arbitrary user
 * input (quotes, hyphens, `AND`/`OR`/column-filter syntax) can never be
 * interpreted as FTS5 query syntax — it always matches as plain text.
 * Combined with the trigram tokenizer on search_index, this gives
 * substring search that works for Thai without word segmentation.
 */
export function toFtsMatchQuery(normalized: string): string {
  return `"${normalized.replace(/"/g, '""')}"`;
}
