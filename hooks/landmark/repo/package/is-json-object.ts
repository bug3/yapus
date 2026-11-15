// Mutable on purpose: the merge sets and deletes keys, which the readonly
// type of shared/is-record.ts forbids.
export type JsonObject = Record<string, unknown>;

export function isJsonObject(parsed: unknown): parsed is JsonObject {
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
}
