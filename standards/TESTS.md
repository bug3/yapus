---
paths:
  - "**/*.test.ts"
  - "**/test_*.py"
  - "**/*_test.go"
  - "package.json"
  - "pyproject.toml"
  - "go.mod"
---

# Tests

## TEST-1. Test a behavior through the interface its callers use, one behavior per test, named for the action and its outcome.

## TEST-2. In a test, write no loop, no conditional and no expected value that the code under test computes.

## TEST-3. Give every check at least one input it must block and one it must pass, and keep both in the repository.

## TEST-4. Write tests that reach no network and write no file outside their own temporary directory.

## TEST-5. In a Node program, write tests with `node:test` and `node:assert/strict`; add no test framework.

## TEST-6. In a Python program, write tests with `unittest`; add no test framework.

## TEST-7. In a Go program, write tests with the `testing` package; add no test framework or assertion library.
