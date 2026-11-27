---
paths:
  - "**/*.ts"
  - "**/*.sh"
  - "**/*.py"
  - "**/*.go"
  - "hooks/git/commit-msg"
  - "hooks/git/reference-transaction"
  - "hooks/git/forward"
---

# Code

## CODE-1. Give a program one entry file that only calls its logic; keep the logic in modules a test can import without running the program.

## CODE-2. Read stdin, arguments and environment variables in one function that runs first, and nowhere else.

## CODE-3. Return a failure the program expects, such as invalid input or a missing file, as a value; throw only on a defect in the program itself.

## CODE-4. In a command-line program, exit 0 on success and 2 when the program fails, blocks or cannot judge; turn every uncaught error into exit 2 and use no other exit code.

## CODE-5. Write only the program's result to stdout; write diagnostics, progress, errors and violations to stderr.

## CODE-6. Write each failure message as one line that names the program, what failed and what to do next.

## CODE-7. Name every violation a check finds by its file and line, or by the input it concerns when it has no line.

## CODE-8. Write a command-line program to run with no human present: it asks no question, prints no color code and expects no terminal.

## CODE-9. Put a time limit on every wait; when it passes, stop the work it waited for and fail.

## CODE-10. Give the same result on every run with the same input.

## CODE-11. Test that every case in a data file has exactly one handler and every handler a case; fail at run time on a case with no handler.

## CODE-12. Comment only what the code cannot say: the reason for a branch, a workaround or an ordering; never restate the code.

## CODE-13. Find a program's own files from the location of its own code, never from the working directory.

## CODE-14. At a program's start, check that every tool it needs is present at the version it needs.

## CODE-15. Name a value for what it holds, never for its type or with a generic word such as `data`, `value`, `item` or `result`, and repeat no word its container already says.

## CODE-16. Give a function one job, and write an entry function as a list of calls to named steps.

## CODE-17. When two branches of one function differ only in a value, compute the value once and write the rest once.

## CODE-18. Give a literal whose value does not say what it means, or whose uses must change together, a named constant at the top of its file.

## CODE-19. Read a file, a process or a request once per run and pass its result on.

## CODE-20. Wrap in `try` only code that can throw.

## CODE-21. Keep data that more than one file uses, such as an object, a list, a query or a prompt, in a file of its own format, and have each user read it by path, or through a library built for that format when one exists; keep data that one file uses in that file, and when the runtime cannot read a file, keep the one copy in the code with a comment that says why.
