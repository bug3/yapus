import { getProjectDirectory } from '../../../shared/hooks-path/get-project-directory.ts';

// The adopter's tsconfig.json: it extends the base and sets the one path the
// base cannot, because a path in the base resolves inside the base directory. It
// has no include, so the compiler takes every TypeScript file under the root.
export function getWrapperTsconfig(): string {
  return `${ JSON.stringify(
    {
      extends: `./${ getProjectDirectory() }/tsconfig.json`,
      compilerOptions: { tsBuildInfoFile: 'node_modules/.cache/yapus/landmark/tsbuildinfo' },
    },
    undefined,
    2,
  ) }\n`;
}
