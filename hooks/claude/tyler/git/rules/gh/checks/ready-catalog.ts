// `gh pr ready` marks a draft pull request ready for review, only when the pull
// request of this directory's branch has no check that failed, waits or was cancelled.
//
// What `gh pr checks --json name,bucket` prints and exits with, from gh v2.102.0:
// - pkg/cmd/pr/checks/checks.go:189-191: with --json the checks are written and the
//   command returns before the exit codes (checks.go:248-252: 1 for a failed check
//   and 8 for a pending one), so the exit says nothing about the checks and the
//   JSON is read whatever the exit.
// - pkg/cmd/pr/checks/checks.go:302-304 (returned through checks.go:184-187 before
//   any output): a pull request with no checks fails with the message "no checks
//   reported on the '<branch>' branch" on stderr, an empty stdout and a non-zero exit.
// - pkg/cmd/pr/checks/aggregate.go:72-88: `bucket` is one of pass, skipping, fail,
//   cancel and pending.
export const readyCatalog = {
  checksArguments: ['pr', 'checks', '--json', 'name,bucket'],
  // Buckets that let the pull request be marked ready; any other bucket stops it.
  passingBuckets: ['pass', 'skipping'],
  // The whole stderr of a pull request with no checks (checks.go:303), which lets it
  // be marked ready; a branch name with a quote in it does not match and is refused.
  noChecksPattern: /^no checks reported on the '[^'\n]*' branch$/,
  reasons: {
    moving: (command: string, shown: string): string =>
      `\`${ command }\` reads the checks of the pull request of this directory's branch, so `
      + `${ shown } is not allowed; remove it`,
    notPassed: (command: string, notPassed: readonly string[]): string =>
      `\`${ command }\` needs every check to pass; these have not: ${ notPassed.join(', ') }; `
      + 'fix or wait for them, then retry',
    cannotRead: (detail: string): string =>
      `cannot read the checks (${ detail }); retry it`,
  },
} as const;
