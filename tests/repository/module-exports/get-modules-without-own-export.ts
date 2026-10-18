import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { toCamelCase } from './to-camel-case.ts';

export async function getModulesWithoutOwnExport(
  root: string,
  modulePaths: readonly string[],
): Promise<string[]> {
  const checkedModules = await Promise.all(
    modulePaths.map(async (modulePath) => ({
      modulePath,
      hasOwnExport: await hasOwnNameExport(join(root, modulePath)),
    })),
  );

  return checkedModules
    .filter(({ hasOwnExport }) => !hasOwnExport)
    .map(({ modulePath }) => modulePath);
}

async function hasOwnNameExport(modulePath: string): Promise<boolean> {
  const moduleExports: unknown = await import(pathToFileURL(modulePath).href);
  const isModuleObject = typeof moduleExports === 'object' && moduleExports !== null;

  return isModuleObject && Object.hasOwn(moduleExports, toCamelCase(basename(modulePath, '.ts')));
}
