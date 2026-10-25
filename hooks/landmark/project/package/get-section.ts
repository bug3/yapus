import { isJsonObject, type JsonObject } from './is-json-object.ts';

// The dotted key paths a merge changed.
export interface Changes {
  readonly set: string[];
  readonly removed: string[];
}

// An object of the package.json, its dotted path ('' for the top level) and
// the changes the merge lists.
export interface Section {
  readonly object: JsonObject;
  readonly path: string;
  readonly changes: Changes;
}

// The object under parent[name]; a missing or non-object entry becomes an
// empty object appended to the parent.
export function getSection(parent: Section, name: string): Section {
  const existing = parent.object[name];
  const object: JsonObject = isJsonObject(existing) ? existing : {};

  parent.object[name] = object;

  return { object, path: getPath(parent, name), changes: parent.changes };
}

// The dotted path of a key of the section.
export function getPath(section: Section, key: string): string {
  return section.path === '' ? key : `${ section.path }.${ key }`;
}
