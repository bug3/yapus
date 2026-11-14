---
paths:
  - "**/*.go"
  - "go.mod"
---

# Go

## GO-1. Run a Go command-line program from a hook, a script or CI as a built binary, never through `go run`: `go run` exits 1 whenever the program exits non-zero.

## GO-2. Write a method only when it uses the state of its receiver or satisfies an interface; write a function otherwise, and declare no type only to group functions.

## GO-3. Declare an interface in the package that calls it, with only the methods that package calls, and return a concrete type from a constructor.

## GO-4. Write no doc comment on a name only because the name is exported.

## GO-5. Handle each error once: return it wrapped with `%w` and the step that failed, or report it; never both.

## GO-6. Start a goroutine only together with the way it is stopped and the place that waits for it to end.
