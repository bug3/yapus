# Engineering

## ENG-1. Split a file on a second reason to change, not on its line count.

## ENG-2. Give a module an interface that hides its work; write no layer that hides nothing.

## ENG-3. Draw a module boundary around a decision expected to change, not around a step of the process, and keep dependencies between modules acyclic.

## ENG-4. State a module's whole contract at its interface: inputs, outputs, failure behavior, side effects.

## ENG-5. Keep the parts of one behavior together; when you split it, leave callers one entry point.

## ENG-6. Tolerate duplication until the third use; when an abstraction stops fitting its callers, put its body back at them instead of adding a parameter.

## ENG-7. Build nothing without a current caller, an acceptance criterion or a proven constraint.

## ENG-8. Turn every external input into a type that admits only valid values at the boundary; the core never sees raw input.

## ENG-9. Make an illegal state unrepresentable in the type; keep absence a different case from error.

## ENG-10. Write no boolean parameter that selects between two behaviors; write two functions or a type with one case per behavior.

## ENG-11. When the program itself states a closed set of cases, declare it in one place and handle it only through a construct the compiler checks for exhaustiveness.

## ENG-13. Never put a structural change and a behavioral change in one change.

## ENG-14. One change carries one intent and about 100 changed lines; split one that nears 150, and when one part is structural, split that part out first.

## ENG-16. Give every hard-to-reverse effect a reverse path the repository can run.

## ENG-17. Give every invariant a test, and watch that test fail once against the broken invariant before it passes.

## ENG-20. Put no change into the repository without a command that answers pass or fail, and accept its exit code and output, not a sentence, as the result.

## ENG-21. Treat every new warning as a failing check.

## ENG-27. Use what the repository already depends on; open no second way to do the same thing.

## ENG-28. Wire the program's parts together in one place in its own code; adopt no framework that wires the program.

## ENG-29. Grant a component the least authority its task needs and deny the rest by default.

## ENG-30. Leave these decisions to a person: architecture, authentication, data migration, the shape of a public interface, dependency and technology choice, root cause.
