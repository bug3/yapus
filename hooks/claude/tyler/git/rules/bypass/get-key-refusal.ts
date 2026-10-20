import { bypassCatalog } from './bypass-catalog.ts';

// A reason to refuse setting this configuration key, or undefined when allowed.
export function getKeyRefusal(key: string): string | undefined {
  const denied = getDeniedKeyRefusal(key);

  if (denied !== undefined) {
    return denied;
  }

  const lower = key.toLowerCase();
  const isAllowed = bypassCatalog.allowedConfigKeys.some((allowed) => allowed === lower)
    || bypassCatalog.allowedConfigPrefixes.some((prefix) => lower.startsWith(prefix));

  return isAllowed ? undefined : getUnsettableReason(key);
}

// A reason when the word names a key refused wherever it stands, or undefined.
export function getDeniedKeyRefusal(key: string): string | undefined {
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

  const isInclude = lower === bypassCatalog.includeKey
    || (lower.startsWith(bypassCatalog.includeIfPrefix)
      && lower.endsWith(bypassCatalog.includeIfSuffix));

  return isInclude ? getUnsettableReason(key) : undefined;
}

function getUnsettableReason(key: string): string {
  return `\`git config\` key \`${ key }\` is not one the agent may set; a person sets it`;
}
