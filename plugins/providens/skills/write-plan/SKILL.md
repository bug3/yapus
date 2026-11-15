---
name: write-plan
description: Have the plan of deep work written before its first edit, reviewed, decided with the person and built slice by slice. Use when ORCH-1 rates a task deep or the person asks for a plan.
---

- Launch `providens:plan-writer` with the topic, the sources and the questions the plan must settle; it writes the plan to `.yapus/plans/<topic>.md` in the project's root, and you name that path in every brief that rests on it.
- Have a subagent measure each fact the plan-writer returns as unmeasured, and send the plan-writer the result.
- Before the first edit, launch `providens:plan-reviewer` once on the plan file and its acceptance criteria when the plan touches more than one module or a public interface, and have the plan-writer fold each defect into the section it names.
- Give each finisher one slice of the plan, with the brief ORCH-5 names for it.
- Ask the person's open decisions with the question tool: one question per decision, your recommendation first, its context inside the question.
- Record each decision the person makes in Decisions as they make it, and update Status each time a slice returns.
