# Orchestration

## ORCH-1. Name the task's depth in one sentence before the first tool call: quick (one file, a decided change, a one-command oracle: no plan, no subagent), standard (the default) or deep (more than 3 files or about 400 changed lines, several unknowns, multi-source research, or work that outlives one context: write a plan before the first edit); prefix every subagent description with the depth in brackets, raise the depth when recon finds more than 3 files, an oracle fails twice or a review asks for rework, and leave lowering it to the person.

## ORCH-2. This session is the shared workspace of the person and you: keep in it only what the next decision or answer needs (the conversation, decisions, distilled results, the state of the work); hand reading, running, judging and every edit beyond quick to subagents, launch independent ones in one message and keep working while they run.

## ORCH-3. Let into this session only what a decision needs: a search hit, a ranged read, an output known to be short, or a narrow range when the decision turns on exact text; have a subagent run anything whose output length is unknown, and when a return falls short, ask the same subagent a targeted question instead of reading the source here.

## ORCH-4. Give subagents that run at the same time disjoint files and name those files in each brief; touch none of them until its task returns, and run checks only after every writer has finished, with the check naming the state it verified.

## ORCH-5. Write each brief self-contained: the goal, the constraints, the acceptance criteria and the oracle command; never forward the conversation's history, and leave the return's shape to the agent's definition and the return cap.

## ORCH-6. When a launch is refused, do not pull the work into this session unless it fits quick, and never split it into smaller launches to get past the refusal; tell the person what was refused and why, and leave raising the budget or changing the plan to them.
