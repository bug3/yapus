# yapus

> If an AI writes the code, what keeps it sound?

**The foundation for building software with AI.** yapus is the proven core of how an AI coding agent is run: the rules that keep the work sound and maintainable, and the mechanisms that hold them.

Requires Node 24 or newer, bash 3.2 or newer, git 2.42 or newer and Claude Code 2.1.295 or newer; `npm test` also requires ShellCheck 0.11.0.

`git config core.hooksPath hooks/git`, run once in a clone, makes git refuse a commit whose subject is not `type(scope): verb ...` with each word listed in `hooks/shared/catalogs/`; for an agent it also adds the yapus trailers to each commit and refuses a new branch not named `<type>/<slug>`. `git config --unset core.hooksPath` undoes it.

`claude plugin install providens --marketplace bug3/yapus`, run once, installs the orchestrator plugin providens: it puts the orchestration rules (ORCH-1 to 7) at the start of every session, provides six subagents (`providens:builder`, `deacon`, `critic`, `warden`, `proctor`, `webscribe`), limits subagent launches and the size of what returns to the main session, and checks the form of `gh pr create` and `gh issue create` calls. `claude plugin uninstall providens@yapus` undoes it.
