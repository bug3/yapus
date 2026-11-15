// The golangci-lint version the Go workflow installs. It is a function because
// a constant must be UPPER_CASE while a module exports its file name in camelCase.
export function getGolangciLintVersion(): string {
  return 'v2.15.0';
}
