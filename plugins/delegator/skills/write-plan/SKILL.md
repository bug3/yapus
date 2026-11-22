---
name: write-plan
description: Have the plan of deep work written before its first edit, reviewed, decided with the person and built slice by slice. Use when ORCH-1 rates a task deep or the person asks for a plan.
---

- Launch `delegator:plan-writer` with the topic, the sources and the questions the plan must settle; it writes the plan to `.yapus/plans/<YYYY-MM>/<topic>/plan.md` in the project's root, and you name that path in every brief that rests on it.
- On the plan-writer's first return, launch in one message a subagent to measure each fact it returns as unmeasured, one for each probe or reading the plan names, and, before the first edit, `delegator:plan-reviewer` once on the plan file and its acceptance criteria when the plan touches more than one module or a public interface.
- After the review, or at once when the plan needs none, ask the person the open decisions in one batch, in calls of up to four questions back to back with the most consequential first, then send the plan-writer the defects, the measurements and the answers in one message to fold each into the section it names.
- Give each finisher one slice of the plan, with the brief ORCH-5 names for it; launch at once every slice whose needed slices have landed and whose files are disjoint from each other's and from those of the running slices, each in a worktree and branch of its own from the tested tip of the landing branch, both named in the brief.
- When finishers ran side by side, land their commits on one branch in the plan's order and have the oracle run on the result before the next launch.
- Ask the person, with the question tool, only the open decisions on architecture, authentication, data migration, the shape of a public interface, a dependency or technology choice, or one the project's instructions leave to the person: one question per decision, your recommendation first, its context inside the question.
- Take every other open decision as the plan recommends, and record it in Decisions as taken by you and open to the person's override.
- Record each decision the person makes in Decisions as they make it, and update Status each time a slice returns.
