/**
 * Sanitize user input embedded in PostgREST `.or()` filter strings.
 * Strips metacharacters that can alter filter logic (commas, parens, wildcards).
 */
export function sanitizePostgrestSearch(term: string): string {
  return term
    .trim()
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/[,()]/g, "");
}

/** Safe `%term%` pattern for `.ilike()` column filters. */
export function toIlikePattern(term: string): string {
  const sanitized = sanitizePostgrestSearch(term);
  return sanitized ? `%${sanitized}%` : "%";
}
