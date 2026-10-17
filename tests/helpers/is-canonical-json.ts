// The D2 form is the text JSON.stringify prints with a two-space indent,
// plus a final newline; a comment, a BOM or a trailing comma fails to parse.
export function isCanonicalJson(fileText: string): boolean {
  try {
    return `${ JSON.stringify(JSON.parse(fileText), undefined, 2) }\n` === fileText;
  } catch {
    return false;
  }
}
