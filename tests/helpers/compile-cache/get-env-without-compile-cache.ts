const COMPILE_CACHE_VARIABLE = 'NODE_COMPILE_CACHE';

// Node keys a compile-cache entry by the file's path and never removes one, so
// a process that runs code from a temporary copy writes entries no later run
// reads. The returned environment is env without NODE_COMPILE_CACHE.
export function getEnvWithoutCompileCache(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(env).filter(([name]) => name !== COMPILE_CACHE_VARIABLE),
  );
}
