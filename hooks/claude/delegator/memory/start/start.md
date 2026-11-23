Project memory is in .yapus/memory: work <n> (open items), rules <n>, reference <n>. Read a directory's index with Grep "^description:" when the person asks what is open or a task meets one of them.
Rules for a situation; read the file when its situation comes up:
rules/<name>.md: <description>
When a rule replaces another, keep the old file and give it superseded-by: "<new name>". When a work item is finished, write its lesson under rules/ or reference/ first and delete its entry after, since a deleted file cannot be restored.
work/<name>.md: not changed for <n> days
MEMORY.md: <n> lines, over <limit>
MEMORY.md line <n>: <target> is not in the auto memory directory
Tidy these when the task allows: ask the person about a work item that may be finished, and sort what MEMORY.md holds beyond every session's need; an edit to an open entry restarts its count.
and <n> more
