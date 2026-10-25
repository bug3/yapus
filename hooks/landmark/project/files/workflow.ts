// The text of .github/workflows/test.yml without its ShellCheck step. It is a
// list of lines because a .yml file outside .github is refused; a test keeps
// it equal to the file.
export function workflow(): string {
  return `${ [
    'name: "test"',
    '',
    'on:',
    '  pull_request:',
    '',
    'permissions:',
    '  contents: "read"',
    '',
    'jobs:',
    '  test:',
    '    runs-on: "ubuntu-latest"',
    '    timeout-minutes: 10',
    '    steps:',
    '      - uses: "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1" # v7.0.1',
    '      - uses: "actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1" # v7.1.0',
    '        with:',
    '          node-version: "24"',
    '      - run: "npm ci"',
    '      - run: "npm test"',
  ].join('\n') }\n`;
}
