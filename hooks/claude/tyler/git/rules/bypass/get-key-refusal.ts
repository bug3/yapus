import { bypassCatalog } from './bypass-catalog.ts';

// A reason to refuse setting this configuration key, or undefined when allowed.
export function getKeyRefusal(key: string): string | undefined {
  const lower = key.toLowerCase();

  if (lower === bypassCatalog.hooksPathKey) {
    return bypassCatalog.reasons.hooksPath;
  }

  if (lower.startsWith(bypassCatalog.aliasKeyPrefix)) {
    return bypassCatalog.reasons.aliasConfig;
  }

  if (lower === bypassCatalog.cleanRequireForceKey) {
    return bypassCatalog.reasons.cleanRequireForceConfig;
  }

  const isAllowed = bypassCatalog.allowedConfigKeys.some((allowed) => allowed === lower)
    || bypassCatalog.allowedConfigPrefixes.some((prefix) => lower.startsWith(prefix));

  return isAllowed
    ? undefined
    : `\`git config\` key \`${ key }\` is not one the agent may set; a person sets it`;
}
