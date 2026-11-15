import { isJsonObject, type JsonObject } from './is-json-object.ts';

// The top-level object of a package.json text; throws an Error that names the
// cause when the text is not JSON or not an object.
export function parsePackage(text: string): JsonObject {
  const parsed = parseJson(text);

  if (!isJsonObject(parsed)) {
    throw new Error('package.json is not a JSON object');
  }

  return parsed;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);

    throw new Error(
      `package.json is not valid JSON: ${ cause.split('\n')[0] ?? '' }`,
      { cause: error },
    );
  }
}
