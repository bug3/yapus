import { formatFinding } from './format-finding.ts';
import { formatMessage } from './format-message.ts';
import { getFindings } from './get-findings.ts';
import { isMarkdown } from './is-markdown.ts';
import { parsePayload } from './parse-payload.ts';
import { readText } from './read-text.ts';

export async function getMessages(stdinText: string): Promise<string[]> {
  const parsed = parsePayload(stdinText);

  if (parsed.kind === 'failure') {
    return [
      formatMessage(
        `cannot judge: ${ parsed.reason }; the call is blocked until the payload is valid`,
      ),
    ];
  }

  const { call } = parsed;
  const shouldReadFile = call.tool === 'Edit' && isMarkdown(call.filePath);

  const fileText = shouldReadFile ? await readText(call.filePath) : undefined;

  return getFindings(call, fileText).map(formatFinding);
}
