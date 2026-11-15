import { getPath, getSection, type Section } from './get-section.ts';

// eslint-plugin-*, eslint-config-*, @scope/eslint-plugin[-*],
// @scope/eslint-config[-*] and @typescript-eslint/*.
const OLD_ESLINT_PACKAGE =
  /^(?:eslint-(?:plugin|config)-|@[^/]+\/eslint-(?:plugin|config)(?:-.*)?$|@typescript-eslint\/)/;

// What an install drops of the replaced ESLint setup: its devDependencies,
// except the pins, and the top-level eslintConfig key.
export function removeLegacyKeys(root: Section, pins: Readonly<Record<string, string>>): void {
  const devDependencies = getSection(root, 'devDependencies');

  Object.keys(devDependencies.object)
    .filter((name) => OLD_ESLINT_PACKAGE.test(name) && !Object.hasOwn(pins, name))
    .forEach((name) => {
      removeKey(devDependencies, name);
    });

  removeKey(root, 'eslintConfig');
}

function removeKey(section: Section, key: string): void {
  if (Object.hasOwn(section.object, key)) {
    Reflect.deleteProperty(section.object, key);
    section.changes.removed.push(getPath(section, key));
  }
}
