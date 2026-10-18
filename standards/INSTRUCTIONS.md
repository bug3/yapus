---
paths:
  - "**/CLAUDE.md"
  - "**/AGENTS.md"
  - ".claude/**/*.md"
  - "**/SKILL.md"
  - "standards/**"
---

# Instructions

## INST-1. Put in the always-loaded instructions only the rules every task needs.

## INST-2. Load a rule that applies to one kind of file only while the agent works on a file of that kind.

## INST-3. Load a rule that applies to one kind of task only while the agent does a task of that kind.

## INST-4. Add a rule only for a mistake an agent would make without it.

## INST-5. Write a rule as an action the agent can take, never as a value it should hold.

## INST-7. Write every rule as one heading, its id and one sentence, with nothing under it.

## INST-8. State where a rule applies when it does not apply everywhere.

## INST-9. Leave no two rules that cannot both be obeyed, in one file or across files.
