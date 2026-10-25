# yapus

> If an AI writes the code, what keeps it sound?

**The foundation for building software with AI.** yapus is the proven core of how an AI coding agent is run: the rules that keep the work sound and maintainable, and the mechanisms that hold them.

Requires Node 24 or newer, bash 3.2 or newer, git 2.42 or newer and Claude Code 2.1.295 or newer; `npm test` also requires ShellCheck 0.11.0.

`git config core.hooksPath hooks/git`, run once in a clone, makes git refuse a commit whose subject is not `type(scope): verb ...` with each word listed in `hooks/shared/catalogs/`; for an agent it also adds the yapus trailers to each commit and refuses a new branch not named `<type>/<slug>`. `git config --unset core.hooksPath` undoes it.

`claude plugin install providens --marketplace bug3/yapus`, run once, installs the orchestrator plugin providens: it puts the orchestration rules (ORCH-1 to 7) at the start of every session while it is on, provides six subagents (`providens:builder`, `deacon`, `critic`, `warden`, `proctor`, `webscribe`) and the skill `/providens:blueprint` for writing the plan of deep work before its first edit, limits subagent launches and the size of what returns to the main session, and checks the form of `gh pr create` and `gh issue create` calls: the title, the labels, the body headings and the footer by the catalogs of the repository the call runs in (`hooks/shared/catalogs/`), and only the body headings in a repository without them. `claude plugin uninstall providens@yapus` undoes it.

providens counts the subagent launches of a session and refuses the one past the budget: 41, or the whole number `/providens:limit <n>` sets for the session, or with `--global` for every session, in the plugin's data directory (`CLAUDE_PLUGIN_DATA`, under `~/.claude/plugins/data/`). It writes every launch verdict, every launch's end (duration, tokens, tool calls, whether the subagent ran out of turns), every resume of a subagent and every return verdict (with the transcript's turns, tokens, tool calls and wall time) as one JSON line to `decisions.jsonl` in the same directory; the record never leaves the machine. `/providens:report` prints the record's counts per agent and the reading rules with their state (act, wait or ok). The gh check knows the options of gh 2.102 and refuses an option it does not know.

`/providens:mode off` turns providens off for the session, or with `--global` for every session: no rules at the session's start and no check on its launches; `/providens:mode on` turns it back on, and `/providens:status` shows the mode and the limit in force and the session's launches.
