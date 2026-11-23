Take the first line that fits:
1. The repository or git already shows it: save nothing.
2. It holds for everyone who works in the repository: write it to <mem path>/rules/<name>.md and tell the person it is a candidate for the repository (a check first, else a standard, a template or a document); move nothing there yourself.
3. Every session needs it: write this file with a top-level frontmatter line every-session: "<why every session needs it>" and state the rule itself in its MEMORY.md line.
4. It can end, as open or deferred work does: <mem path>/work/<name>.md, one file per item; for an item with a plan write what, why and when it was deferred and a frontmatter line plan: "<path of its plan.md>", and copy no slice state.
5. It says how to act in a situation you can name: <mem path>/rules/<name>.md, with a frontmatter line event: "gh <group> <action>" or event: "launch <agent type>" when the situation is that call; every other rule is listed at the session's start by its description. When it replaces a rule in rules/, keep the old file and add superseded-by: "<new name>" to its frontmatter.
6. Anything else: <mem path>/reference/<name>.md.
Start every file with frontmatter description: "<what it holds and when to read it>", for a rule the rule itself and its situation; <name> is lowercase letters, digits and hyphens.
