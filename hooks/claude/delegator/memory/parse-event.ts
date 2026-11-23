// The hooked call a rule belongs to: a gh command by the two words after
// gh, or the launch of one agent type.
export type MemoryEvent =
  | { readonly kind: 'gh'; readonly group: string; readonly action: string }
  | { readonly kind: 'launch'; readonly agentType: string };

const GH_EVENT = /^gh (\S+) (\S+)$/u;
const LAUNCH_EVENT = /^launch (\S+)$/u;

// The event a rule's frontmatter names, 'gh <group> <action>' or
// 'launch <agent type>' with one space between the words, each word as it is
// written; undefined for any other text.
export function parseEvent(text: string): MemoryEvent | undefined {
  const [, group, action] = GH_EVENT.exec(text) ?? [];

  if (group !== undefined && action !== undefined) {
    return { kind: 'gh', group, action };
  }

  const [, agentType] = LAUNCH_EVENT.exec(text) ?? [];

  return agentType === undefined ? undefined : { kind: 'launch', agentType };
}
