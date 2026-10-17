import { getFindings } from './findings/get-findings.ts';
import { isMarkdown } from './findings/is-markdown.ts';
import { parsePayload } from './input/parse-payload.ts';
import { readText } from './input/read-text.ts';
import { formatFinding } from './output/format-finding.ts';
import { formatMessage } from './output/format-message.ts';

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
