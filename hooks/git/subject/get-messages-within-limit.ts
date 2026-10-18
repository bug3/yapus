import { getWithinLimit } from '../../shared/get-within-limit.ts';
import { getMessages, type HookInput } from './get-messages.ts';
import { formatMessage } from './output/format-message.ts';

// The limit covers the whole run: reading the message file and the catalogs
// and judging the subject.
export async function getMessagesWithinLimit(
  hookInput: HookInput,
  limitSeconds: number,
): Promise<string[]> {
  const messages = await getWithinLimit(getMessages(hookInput), limitSeconds);

  return messages ?? [
    formatMessage(
      `no answer within ${ String(limitSeconds) } seconds; the commit is blocked, retry it`,
    ),
  ];
}
