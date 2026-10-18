export function assertNever(unhandledCase: never): never {
  throw new Error(`unhandled case ${ JSON.stringify(unhandledCase) }`);
}
