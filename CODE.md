# Code

## C1. Give a program one entry file that only calls its logic; keep the logic in modules a test can import without running the program.

## C2. Read stdin, arguments and environment variables in one function that runs first, and nowhere else.

## C3. Return a failure the program expects, such as invalid input or a missing file, as a value; throw only on a defect in the program itself.

## C4. Exit 0 on success and 2 when the program fails, blocks or cannot judge; turn every uncaught error into exit 2 and use no other exit code.

## C5. Write only the program's result to stdout; write diagnostics, progress, errors and violations to stderr.

## C6. Write each failure message as one line that names the program, what failed and what to do next.

## C7. Name every violation a check finds by its file and line, or by the input it concerns when it has no line.

## C8. Write a program to run with no person present: it asks no question, prints no color code and expects no terminal.

## C9. Put a time limit on every wait; when it passes, stop the work it waited for and fail.

## C10. Give the same result on every run with the same input.

## C11. Test that every case in a data file has exactly one handler and every handler a case; fail at run time on a case with no handler.

## C12. Give every check at least one input it must block and one it must pass, and keep both in the repository.

## C13. Write tests that reach no network and write no file outside their own temporary directory.
