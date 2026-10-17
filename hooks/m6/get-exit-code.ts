// Claude Code blocks the tool call on exit 2 and lets it through on exit 0.
export function getExitCode(messages: readonly string[]): 0 | 2 {
  return messages.length === 0 ? 0 : 2;
}
