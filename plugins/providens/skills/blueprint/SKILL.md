---
name: blueprint
description: Write the plan of deep work before its first edit, in a form critic can judge and builders can take slice by slice. Use when ORCH-1 rates a task deep or the person asks for a plan.
---

- Write the plan to the file the person names, else to `~/.claude/yapus/plans/<topic>.md`, and name its path in every brief that rests on it.
- Give the plan these sections in this order: Goal, Facts, Decisions, Acceptance, Slices, Risks, Status.
- Goal: the end state in one paragraph, then what the work leaves out and the limits it accepts.
- Facts: each fact a slice rests on, with its source as `file:line`, a URL, or a command and its output; measure an outside tool's behavior instead of assuming it.
- Decisions: each settled choice with its reason and who took it, and each open one with a recommendation, marked for the person when it is theirs.
- Acceptance: criteria numbered `A1` to `An`, each observable as pass or fail, and the oracle command that checks them.
- Slices: a table of id (`S1` to `Sn`), intent, the files the slice may change, the slices it needs and its oracle; size a slice like one commit, and fix each interface two slices share before either starts.
- Risks: for each step that touches authentication, data migration, a public interface, concurrency or a destructive operation, who approves it, how it is verified independently and how it is undone.
- Status: each slice as open, done with its commit, or blocked with the reason, then the next step.
- Before the first edit, launch `providens:critic` once on the plan file and its acceptance criteria when the plan touches more than one module or a public interface, and fold each defect into the section it names.
- Give each builder one slice and take its ORCH-5 brief from the plan: the slice's intent as the goal, its files, the decisions that bind it, its criteria and its oracle.
- Ask the person's open decisions with the question tool: one question per decision, your recommendation first, its context inside the question.
- Record each decision the person makes in Decisions as they make it, and update Status each time a slice returns.
