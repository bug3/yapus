import { getPath, type Section } from './get-section.ts';

// Sets the key of the section and lists its dotted path, only when the value
// differs.
export function setValue(section: Section, key: string, value: string): void {
  if (section.object[key] === value) {
    return;
  }

  section.object[key] = value;
  section.changes.set.push(getPath(section, key));
}
