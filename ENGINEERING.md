# Engineering

## E1. Split a file on a second reason to change, not on its line count.

## E2. Give a module an interface that hides its work; write no layer that hides nothing.

## E3. Draw a module boundary around a decision expected to change, not around a step of the process, and keep dependencies between modules acyclic.

## E4. State a module's whole contract at its interface: inputs, outputs, failure behavior, side effects.

## E5. Keep the parts of one behavior together; when you split it, leave callers one entry point.

## E6. Tolerate duplication until the third use; when an abstraction stops fitting its callers, put its body back at them instead of adding a parameter.

## E7. Build nothing without a current caller, an acceptance criterion or a proven constraint.

## E8. Turn every external input into a type that admits only valid values at the boundary; the core never sees raw input.

## E9. Make an illegal state unrepresentable in the type; keep absence a different case from error.

## E10. Write no boolean parameter that selects between two behaviors; write two functions or a type with one case per behavior.

## E11. When the program itself states a closed set of cases, declare it in one place and handle it only through a construct the compiler checks for exhaustiveness.

## E12. Address things by stable machine identifiers; keep text for people apart from keys.

## E13. Never put a structural change and a behavioral change in one change.

## E14. One change carries one intent and about 100 changed lines; split one that nears 150, and when one part is structural, split that part out first.

## E16. Give every hard-to-reverse effect a reverse path the repository can run.

## E17. Give every invariant a test, and watch that test fail once against the broken invariant before it passes.

## E18. Test a behavior through the interface its callers use, one behavior per test, named for the action and its outcome.

## E19. In a test, write no loop, no conditional and no expected value that the code under test computes.

## E20. Put no change into the repository without a command that answers pass or fail, and accept its exit code and output, not a sentence, as the result.

## E21. Treat every new warning as a failing check.

## E22. Before choosing a language, framework or platform, write the constraints it must meet: where it runs, what load it carries, who maintains it.

## E23. Choose a technology whose failure modes others have already written down.

## E24. Use a language whose types can make an illegal state unrepresentable and whose compiler checks a closed set for exhaustiveness.

## E25. Use one language in a repository; add a second only for work the first cannot express.

## E26. Add a dependency, direct or transitive, only for work you would not write and maintain yourself, and pin it to one version.

## E27. Use what the repository already depends on; open no second way to do the same thing.

## E28. Wire the program's parts together in one place in its own code; adopt no framework that wires the program.

## E29. Grant a component the least authority its task needs and deny the rest by default.

## E30. Leave these decisions to a person: architecture, authentication, data migration, the shape of a public interface, dependency and technology choice, root cause.
