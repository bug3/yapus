import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { toCamelCase } from './to-camel-case.ts';

export async function getModulesWithoutOwnExport(
  root: string,
  modulePaths: readonly string[],
): Promise<string[]> {
  const hasOwnNameExports = await Promise.all(
    modulePaths.map((modulePath) => hasOwnNameExport(join(root, modulePath))),
  );

  return modulePaths.filter((modulePath, index) => hasOwnNameExports[index] === false);
}

async function hasOwnNameExport(modulePath: string): Promise<boolean> {
  const moduleExports: unknown = await import(pathToFileURL(modulePath).href);
  const isModuleObject = typeof moduleExports === 'object' && moduleExports !== null;

  return isModuleObject && Object.hasOwn(moduleExports, toCamelCase(basename(modulePath, '.ts')));
}
