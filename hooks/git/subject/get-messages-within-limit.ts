import { getMessages, type HookInput } from './get-messages.ts';
import { formatMessage } from './output/format-message.ts';

// The limit covers the whole run: reading the message file and the catalogs
// and judging the subject.
export async function getMessagesWithinLimit(
  hookInput: HookInput,
  limitSeconds: number,
): Promise<string[]> {
  let timer: NodeJS.Timeout | undefined;

  const limitReached = new Promise<string[]>((resolve) => {
    timer = setTimeout(() => {
      resolve([
        formatMessage(
          `no answer within ${ String(limitSeconds) } seconds; the commit is blocked, retry it`,
        ),
      ]);
    }, limitSeconds * 1000);
  });

  try {
    return await Promise.race([getMessages(hookInput), limitReached]);
  } finally {
    clearTimeout(timer);
  }
}
