// The adopter's tsconfig.json: it extends the base and sets the one path the
// base cannot, because a path in the base resolves inside .landmark. It has
// no include, so the compiler takes every TypeScript file under the root.
export function wrapperTsconfig(): string {
  return `${ JSON.stringify(
    {
      extends: './.landmark/tsconfig.json',
      compilerOptions: { tsBuildInfoFile: 'node_modules/.cache/landmark/tsbuildinfo' },
    },
    undefined,
    2,
  ) }\n`;
}
