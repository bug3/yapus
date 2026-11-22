# <img src="docs/public/logo.svg" alt="" height="33" align="absmiddle"> yapus

[![test](https://github.com/bug3/yapus/actions/workflows/test.yml/badge.svg)](https://github.com/bug3/yapus/actions/workflows/test.yml) [![license](https://img.shields.io/github/license/bug3/yapus)](LICENSE) [![docs](https://img.shields.io/badge/docs-yapus.dev-640B15)](https://yapus.dev)

> If an AI writes the code, what keeps it sound?

**Standards and orchestration for coding with an AI agent.** yapus is a set of Claude Code plugins for keeping AI-written software sound and maintainable: standards for the work, an orchestrator that divides it among subagents, and the mechanisms that hold both.

- **delegator** is the orchestrator: a fixed roster of subagents, a limit on launches and a cap on what returns to the session
- **ordo** installs the standards and the git hooks once per machine, and adds lint, CI and commit checks to a repository with one command

<!-- #region features -->
## Features

- **Quality held by checks.** Standards are written files; a rule a program can check is held by a hook or a test, and a pass-or-fail command, not a sentence, decides that a change is done.
- **Independent review.** A plan and a finished diff are judged by a subagent that never saw the conversation that produced them.
- **Context management.** The session holds what a decision needs; subagents do the reading, running and editing, each return is capped, and a standard other than the principles loads only when a file of its kind is touched.
- **Parallel work.** Independent tasks launch together, each subagent on its own files.
- **Work sized to the task.** A small change runs with no plan; a large one gets a written plan, built in parts that run side by side where their files are disjoint.
- **Survives compaction.** The prompts the person typed are logged and given back to the session after a compaction, with the paths of the newest plans.
- **Cost control.** Each subagent runs on the model its definition names, a smaller one for running commands, reading and web research than for editing, and a session has a launch budget.

<!-- #endregion features -->

<!-- #region quick-start -->
## Quick Start

### 1. Install the Plugins

Install each plugin once from the yapus marketplace.

```bash
claude plugin install delegator --marketplace bug3/yapus
```

```bash
claude plugin install ordo --marketplace bug3/yapus
```

In the default permission mode, Claude Code asks the person before the main agent runs a yapus skill that runs a program, such as `/delegator:status`; the same command typed by the person runs without the question, and an allow rule such as `Skill(delegator:status)` in the settings lifts it for that skill.

### 2. Set Up the Machine

Run once in a Claude Code session: it puts the yapus standards and git hooks into `~/.claude` and points the global `core.hooksPath` at those hooks.

```text
/ordo:machine
```

### 3. Set Up a Repository

Run in a session opened at the root of a git repository; add `go` for a Go repository.

```text
/ordo:repo
```

From the next session on, the orchestration rules open every session, and delegator checks each subagent launch before it starts.

In every repository on the machine, git refuses a commit whose subject is not `type(scope): verb ...`.

At the start of a session in a set-up repository, ordo lists the repository's commit scopes.

<!-- #endregion quick-start -->

<!-- #region delegator -->
## delegator

The session is the shared workspace of the person and the main agent, and it holds only what the next decision needs. delegator puts the orchestration rules [ORCH-1 to ORCH-7](https://github.com/bug3/yapus/blob/main/hooks/claude/delegator/policy/policy.md) at the start of every session, and again after a resume, a clear or a compaction: they hand reading, running, judging and edits to subagents, launch independent ones together and let into the session only what a decision needs. Hooks, the programs Claude Code runs at fixed points of a session, hold what a program can check: the launch check judges each subagent launch before it starts, and the return check caps what each subagent sends back. delegator also checks the form of `gh pr create` and `gh issue create` calls, except in a project ordo excludes. `claude plugin uninstall delegator@yapus` removes the plugin.

### Depths

A depth is the size class the main agent names for a task before its first tool call. Every subagent description starts with it in brackets, such as `[deep] S3 ...`, and the launch check refuses a description without one. An oracle is the command whose exit code says whether a change passes, such as `npm test`.

| Depth | When | How the work runs |
| --- | --- | --- |
| `quick` | one file, a decided change, a one-command oracle | by the main agent, no plan, no subagent |
| `standard` | the default | subagents for reading, running, judging and edits |
| `deep` | about 400 changed lines, several unknowns, multi-source research or work that outlives one context | a written plan, its parts built side by side where their files are disjoint |

The main agent raises the depth when an oracle fails twice or a review asks for rework; lowering it is left to the person.

### Subagents

Each subagent is launched as `delegator:<name>`, or as a `fork` when the work needs content of the conversation that no brief can carry. The launch check refuses the built-in agent types that stand in for the roster (`general-purpose`, `Explore`, `Plan`, `claude`), and a subagent launches no other subagent, except a finisher that launches the diff reviewer for its own diff.

| Agent definition | Job |
| --- | --- |
| `builder` | decided edits against an oracle, until it passes |
| `reader` | read-only search, distilling long files, logs or diffs |
| `runner` | the named commands, with exit codes and first error lines |
| `web-researcher` | one question about external facts, one URL per claim |
| `mcp-operator` | one task in a browser or a connected app through MCP tools |
| `plan-writer` | the plan of a `deep` task in `.yapus/plans/<YYYY-MM>/<topic>/plan.md` |
| `plan-reviewer` | a GO or REVISE verdict on a written plan |
| `finisher` | one part of a plan: edit, oracle, review, commit |
| `diff-reviewer` | an APPROVE or REWORK verdict on a finished diff |

Every subagent receives a return contract at its start: a return written as text opens with DONE, PARTIAL, QUESTIONS or BLOCKED and stays within 12,000 characters, about 3,000 tokens, so one return cannot flood the session. A longer return is sent back once to be shortened and passes on the second try. A workflow agent answers a script through a structured answer, which the limit does not bind and the gate does not judge.

### Deep Work

Deep work is a task rated `deep`: it is planned in writing before the first edit and carried out in slices. A slice is the part of the plan one finisher takes in one launch: its own files, acceptance criteria and oracle, and one or more commits of one intent each. The skill `/delegator:write-plan` runs the flow.

1. Plan: `delegator:plan-writer` writes `.yapus/plans/<YYYY-MM>/<topic>/plan.md`, under the month the plan starts in; on its first return the main agent launches in one message the measurement of each fact the plan marks unmeasured, each probe or reading it names, and, when the plan touches more than one module or a public interface, the plan review.
2. Plan review: when the plan touches more than one module or a public interface, `delegator:plan-reviewer` judges it once before the first edit.
3. The person's decisions: after the review, the main agent asks the person the open decisions that are theirs in one batch, in calls of up to four questions with the most consequential first, each question with its recommendation first, takes the others as recommended, records both in the plan, and sends the plan-writer the defects, the measurements and the answers in one message.
4. Slices: one `delegator:finisher` per slice, in a worktree of its own, edits only the slice's files and runs its oracle until it passes or one failure survives two repairs; every slice whose needed slices have landed and whose files are disjoint from those of the running slices starts at once, and a decision a slice leaves for the person is asked when it returns.
5. Diff review: the finisher writes the slice's diff to a file and launches `delegator:diff-reviewer`, the one nested launch the launch check admits, then repairs what a REWORK names.
6. Commit: the finisher commits the slice alone, never pushes, and returns the commits, the oracle's exit code, the verdict and the path of the detail file `<slice id>.md` beside the plan, which holds the rest.
7. Landing: the main agent cherry-picks the slices' commits onto one branch in the plan's order when a later slice needs them and at the end, and a subagent runs the oracle on the landed tip and, while the next slices run, on each landed commit in a separate worktree.

Outside deep work, a change of more than 150 lines goes once to `delegator:diff-reviewer` before the main agent reports it done.

### Deep Dive

A deep dive gathers and checks the context of a task rated `deep` before its plan is written. When the research leaves gaps, the completeness check writes up to 4 more questions, and one more round answers and checks them. A web question is answered first from a built-in catalog of keyless public sources the scope picks for it, such as arXiv, OpenAlex, the GitHub API or Hacker News search, and one web question asks what prior work exists elsewhere on the task's subject. `/delegator:deep-dive` is a workflow, a script Claude Code runs in the background with workflow agents of its own: it splits the task into 3 to 12 questions, answers each from the repository with the `reader` definition or from the web with the `web-researcher` definition, has every claim checked against the lines or the page it cites, and has `.yapus/plans/<YYYY-MM>/<topic>/research_<digest>.md` written, a file a plan-writer is given as a source beside the hand-kept `research.md`.

A claim a check refuted stays in the file under `Refuted` and one no check decided under `Unverified`, and the file ends with the run's counts per stage. The digest in the file's name is computed from the run's claims, so a run with other content writes another file, and a deep dive never writes `research.md`. The launch budget does not count the workflow agents of a deep dive. `/delegator:dive-report <run directory>` prints their tokens, time, models and tools per stage, and lists apart a call of a tool a workflow agent did not hold. It also counts the web fetches per host and the ones that failed.

### Launch Limits

The launch budget is the number of subagent launches admitted in one session. delegator counts the launches of a session and refuses the one past the budget.

The budget is 60 by default, above the 53 launches of the busiest measured session. `/delegator:agent-limit <n>` sets another whole number for the session, or with `--global` for every session.

The launch check also refuses a `quick` launch and a finisher outside `deep`. After a refusal the main agent tells the person what was refused and why, and does not split the work into smaller launches.

delegator records every launch and return verdict in a file that never leaves the machine; `/delegator:agent-report` prints the record's counts per agent type.

### Prompt Log

The prompt log keeps what the person typed, so a compaction does not lose it. delegator writes each prompt, with its time, as one JSON line to the session's file, `.yapus/sessions/<YYYY-MM>/<DD>T<HH-MM-SS>Z_<session id>.jsonl` under the directory the session opened in, named for the UTC time of the session's first prompt. A write to a file in a plan's directory adds a line that names the plan and the file. Right after a compaction it gives the session those prompts back, the newest that fit in 6,000 characters, with the paths of the five newest plans in `.yapus/plans/`.

It creates the sessions directory with a `.gitignore` that keeps it out of git; the person changes that file to keep their prompts in git. `/delegator:upgrade` moves the files of an older layout, `.yapus/prompts/` and the plans directly in `.yapus/plans/`, into this one and prints each move.

### Commands

Off means no rules at the session's start, no check on its launches, and no prompt written or given back.

| Command | Effect |
| --- | --- |
| `/delegator:switch off` | delegator off for the session, or with `--global` for every session |
| `/delegator:switch on` | delegator back on |
| `/delegator:status` | the mode and the limit in force, the session's launches, the tool calls its background subagents wait on |
| `/delegator:agent-limit <n>` | the launch budget for the session, or with `--global` for every session |
| `/delegator:agent-report` | the record's counts per agent type |
| `/delegator:upgrade` | the `.yapus/` files of an older layout moved into the present one |
| `/delegator:write-plan` | the deep work flow, from the plan to the slices |
| `/delegator:deep-dive` | the research before a plan: questions, claims checked against their sources, `research_<digest>.md` beside the plan |
| `/delegator:dive-report <run directory>` | the workflow agents, tokens, time, models and tools of one workflow run per stage, and its web fetches per host |

<!-- #endregion delegator -->

<!-- #region ordo -->
## ordo

ordo installs the yapus standards and git hooks on the machine and the yapus setup in a repository; `/ordo:upgrade` and `/ordo:repo` bring them up to the plugin's version. A standard is a file of numbered rules, such as `CODE-4`; every standard but PRINCIPLES.md names the file paths it applies to.

`/ordo:machine` writes the standards into `~/.claude/rules/yapus/ordo/` and the git hooks into `~/.claude/yapus/ordo/hooks/git`. It sets the global `core.hooksPath` to those hooks when it is unset, refuses when another one is set, and prints the steps that undo it.

At the start of every session, ordo reports when it is not installed on the machine or when the installed version differs from the plugin's; it updates nothing itself.

During a session, ordo refuses a Write or Edit that puts a Unicode dash other than the ASCII hyphen into a Markdown file.

`/ordo:exclude` turns ordo off in the session's project and its worktrees: it adds the repository's root to `~/.claude/yapus/ordo/excluded.json` and a `claudeMdExcludes` entry for the ordo standards to the project's `.claude/settings.local.json`. There the git hooks check no subject or branch and add no trailer, the repository's own hooks still run, the dashes check and the scopes line are off, and delegator judges no `gh pr create` or `gh issue create` form. `/ordo:include` takes both out.

### Standards

| File | Subject |
| --- | --- |
| [ACTIONS.md](standards/ACTIONS.md) | GitHub Actions workflows |
| [BASH.md](standards/BASH.md) | bash scripts |
| [CODE.md](standards/CODE.md) | command-line programs |
| [DATA.md](standards/DATA.md) | JSON, YAML and TOML files |
| [ENGINEERING.md](standards/ENGINEERING.md) | modules, types and boundaries |
| [GIT.md](standards/GIT.md) | commit scopes |
| [GO.md](standards/GO.md) | Go code |
| [IDENTIFIERS.md](standards/IDENTIFIERS.md) | machine identifiers and text for humans |
| [INSTRUCTIONS.md](standards/INSTRUCTIONS.md) | instruction files for agents |
| [MARKDOWN.md](standards/MARKDOWN.md) | Markdown prose |
| [PRINCIPLES.md](standards/PRINCIPLES.md) | principles for every change |
| [PYTHON.md](standards/PYTHON.md) | Python code |
| [REPOSITORY.md](standards/REPOSITORY.md) | technology choice and repository layout |
| [TERMS.md](standards/TERMS.md) | words for the human and the AI |
| [TESTS.md](standards/TESTS.md) | tests |
| [TYPESCRIPT.md](standards/TYPESCRIPT.md) | TypeScript code |

### Git Hooks

The commit hook refuses a subject that is not `type(scope): verb ...` with each word listed in a catalog, or that is longer than 72 characters. The type and verb catalogs ship with the hooks (`hooks/shared/catalogs/`); the scopes come from the repository's `.claude/yapus/ordo/scopes.json`, and a repository without one accepts any scope of the form. A `!` before the colon marks a breaking change.

Two subjects from this repository's history that pass:

```text
docs(readme): add the prompt log and its recall
refactor(ordo)!: rename the landmark plugin to ordo
```

The subject `update the readme` is refused with:

```text
yapus subject: "update the readme" is not in the form "type(scope): verb ...", such as "feat(hooks): add a check"; rewrite the subject
```

The repository's own `commit-msg` hook, which the global hooks path hides, runs after the yapus check, and its refusal stops the commit too.

When an agent runs git (`CLAUDECODE=1`), a commit subject that passes gets the trailers `Assisted-by: Claude Code` and `Co-authored-by: yapus <noreply@yapus.dev>`, and git refuses a new branch not named `<type>/<slug>`: the type from `hooks/shared/catalogs/types.json`, the slug of lowercase letters, digits and hyphens, at most 50 characters.

### Repository Setup

`/ordo:repo` writes the yapus repository setup into the repository at the root of the session. Every install writes the workflow `.github/workflows/yapus.yml`, the scope catalog `.claude/yapus/ordo/scopes.json` and the chosen language in `.claude/yapus/ordo/language`.

| Argument | Writes | Next steps it prints |
| --- | --- | --- |
| `typescript`, the default | the ESLint and TypeScript base under `.claude/yapus/ordo/`, the root `eslint.config.ts` and `tsconfig.json` that build on it, the `check` and `test` scripts, the pinned devDependencies and `"type": "module"` in `package.json` | `npm install`, `npm test` |
| `go`, with `go.mod` at the root | the golangci-lint config `.golangci.yml` | the pinned golangci-lint install, the Go checks |

For TypeScript it removes the old ESLint config files and packages. It never runs `npm` or golangci-lint.

In a repository that carries its stamp (`.claude/yapus/ordo/version`), plain `/ordo:repo` upgrades only yapus's own files to the plugin's version, in the recorded language, and refuses an argument that names another language. The root files, `scripts.test` and the scope catalog belong to the project.

The command writes nothing while a path it would write or remove has an uncommitted change, and it prints the git steps that undo it.

### Commands

| Command | Effect |
| --- | --- |
| `/ordo:machine` | standards and git hooks into `~/.claude`, once per machine |
| `/ordo:upgrade` | installed standards and git hooks up to the plugin's version |
| `/ordo:repo` | TypeScript setup of a new repository, upgrade of a set-up one in its recorded language |
| `/ordo:repo go` | Go setup of a new repository |
| `/ordo:exclude` | ordo off in the session's project and its worktrees |
| `/ordo:include` | ordo back on there |

<!-- #endregion ordo -->

## Requirements

Requires Node 24 or newer, bash 3.2 or newer, git 2.42 or newer and Claude Code 2.1.295 or newer.

## Security

Report a vulnerability as [SECURITY.md](SECURITY.md) describes.

## License

[MIT](LICENSE)
