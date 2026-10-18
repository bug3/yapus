---
paths:
  - "**/*.ts"
  - "**/*.sh"
  - "hooks/git/commit-msg"
  - "hooks/git/pre-push"
---

# Code

## CODE-1. Give a program one entry file that only calls its logic; keep the logic in modules a test can import without running the program.

## CODE-2. Read stdin, arguments and environment variables in one function that runs first, and nowhere else.

## CODE-3. Return a failure the program expects, such as invalid input or a missing file, as a value; throw only on a defect in the program itself.

## CODE-4. In a command-line program, exit 0 on success and 2 when the program fails, blocks or cannot judge; turn every uncaught error into exit 2 and use no other exit code.

## CODE-5. Write only the program's result to stdout; write diagnostics, progress, errors and violations to stderr.

## CODE-6. Write each failure message as one line that names the program, what failed and what to do next.

## CODE-7. Name every violation a check finds by its file and line, or by the input it concerns when it has no line.

## CODE-8. Write a command-line program to run with no person present: it asks no question, prints no color code and expects no terminal.

## CODE-9. Put a time limit on every wait; when it passes, stop the work it waited for and fail.

## CODE-10. Give the same result on every run with the same input.

## CODE-11. Test that every case in a data file has exactly one handler and every handler a case; fail at run time on a case with no handler.

## CODE-14. Comment only what the code cannot say: the reason for a branch, a workaround or an ordering; never restate the code.

## CODE-15. Find a program's own files from the location of its own code, never from the working directory.

## CODE-17. At a program's start, check that every tool it needs is present at the version it needs.

## CODE-18. Separate two statements of different jobs, such as reading, building, checking, acting and returning, with one blank line, and keep the statements of one job together.

## CODE-19. Start a function name with a verb: `get` for one that finds or computes a value, `is`, `has`, `can` or `should` for one that returns a boolean, the verb of the change for one that converts, and a creating verb such as `make` for one that creates.

## CODE-20. Name a value for what it holds, never for its type or with a generic word such as `data`, `value`, `item` or `result`, and repeat no word its container already says.

## CODE-21. Give a function one job, and write an entry function as a list of calls to named steps.

## CODE-22. Order a file as imports, constants, exported functions, then the functions they call, every caller above what it calls.

## CODE-23. Use a ternary only to pick a value, and a `switch` or a lookup object instead of an if and else-if chain over one value.

## CODE-24. Name a condition that joins two or more tests, with a constant or a function.

## CODE-25. When two branches of one function differ only in a value, compute the value once and write the rest once.

## CODE-26. Give a literal used more than twice a named constant at the top of its file.

## CODE-27. Inline a variable used once, unless its name explains a condition, it holds an awaited value, it keeps a call out of a template literal or it separates the steps of a test.

## CODE-28. Read a file, a process or a request once per run and pass its result on.

## CODE-29. Convert no value into the form it already has.

## CODE-30. Wrap in `try` only code that can throw.
