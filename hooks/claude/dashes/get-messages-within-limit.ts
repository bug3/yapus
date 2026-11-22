import type { Readable } from 'node:stream';
import { text } from 'node:stream/consumers';
import { getWithinLimit } from '../../shared/get-within-limit.ts';
import { getMessages } from './get-messages.ts';
import { formatMessage } from './output/format-message.ts';

// The limit covers the whole run: reading stdin, asking whether the project
// is excluded and judging what stdin holds. The question can run git, which
// blocks the run until runGit's own limit ends it.
export async function getMessagesWithinLimit(
  stdin: Readable,
  limitSeconds: number,
  isExcluded: () => boolean,
): Promise<string[]> {
  const messages = await getWithinLimit(getMessagesFromStdin(stdin, isExcluded), limitSeconds);

  return messages ?? [
    formatMessage(
      `no answer within ${ String(limitSeconds) } seconds; the call is blocked, retry it`,
    ),
  ];
}

// stdin is read whole before the question, also when the call then passes:
// a hook that exits with input unread breaks the harness's pipe.
async function getMessagesFromStdin(
  stdin: Readable,
  isExcluded: () => boolean,
): Promise<string[]> {
  const stdinText = await text(stdin);

  return isExcluded() ? [] : getMessages(stdinText);
}
