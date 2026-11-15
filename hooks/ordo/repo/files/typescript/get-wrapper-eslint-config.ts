import { getProjectDirectory } from '../../../../shared/hooks-path/get-project-directory.ts';

// The adopter's eslint.config.ts: the base, and the place for the project's
// own overrides. The base's last override matches this file by name.
export function getWrapperEslintConfig(): string {
  return [
    'import { defineConfig } from \'eslint/config\';',
    `import base from './${ getProjectDirectory() }/eslint.config.ts';`,
    '',
    'export default defineConfig(base);',
    '',
  ].join('\n');
}
