---
paths:
  - "**/*.ts"
  - "**/*.sh"
  - "hooks/git/commit-msg"
  - "hooks/git/pre-push"
  - "hooks/git/reference-transaction"
---

# Engineering

## ENG-1. Split a file on a second reason to change, not on its line count.

## ENG-2. Give a module an interface that hides its work; write no layer that hides nothing.

## ENG-3. Draw a module boundary around a decision expected to change, not around a step of the process, and keep dependencies between modules acyclic.

## ENG-4. State a module's whole contract at its interface: inputs, outputs, failure behavior, side effects.

## ENG-5. Keep the parts of one behavior together; when you split it, leave callers one entry point.

## ENG-8. Turn every external input into a type that admits only valid values at the boundary; the core never sees raw input.

## ENG-9. Make an illegal state unrepresentable in the type; keep absence a different case from error.

## ENG-10. Write no boolean parameter that selects between two behaviors; write two functions or a type with one case per behavior.

## ENG-11. When the program itself states a closed set of cases, declare it in one place and handle it only through a construct the compiler checks for exhaustiveness.

## ENG-16. Give every hard-to-reverse effect a reverse path the repository can run.

## ENG-17. Give every invariant a test, and watch that test fail once against the broken invariant before it passes.

## ENG-27. Use what the repository already depends on; open no second way to do the same thing.

## ENG-28. Wire the program's parts together in one place in its own code; adopt no framework that wires the program.

## ENG-29. Grant a component the least authority its task needs and deny the rest by default.
