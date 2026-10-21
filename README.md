# yapus

> If an AI writes the code, what keeps it sound?

**The foundation for building software with AI.** yapus is the proven core of how an AI coding agent is run: the rules that keep the work sound and maintainable, and the mechanisms that hold them.

Requires Node 24 or newer, bash 3.2 or newer and Claude Code 2.1.295 or newer; `npm test` also requires git 2.17 or newer and ShellCheck 0.11.0.

`git config core.hooksPath hooks/git`, run once in a clone, makes git refuse a commit whose subject is not `type(scope): verb ...` with the type listed in `hooks/shared/catalogs/` and the scope and verb in `hooks/git/subject/catalogs/`, and a push whose `npm test` fails. `git config --unset core.hooksPath` undoes it.
