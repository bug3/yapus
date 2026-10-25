export type JsonObject = Record<string, unknown>;

export function isJsonObject(parsed: unknown): parsed is JsonObject {
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
}
