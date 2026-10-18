// The violation for a push test that a signal stopped, naming the commit it
// was testing, if any.
export function getInterruptedViolation(shortSha: string | undefined): string {
  return shortSha === undefined
    ? 'the push test was interrupted'
    : `the push test was interrupted on ${ shortSha }`;
}
