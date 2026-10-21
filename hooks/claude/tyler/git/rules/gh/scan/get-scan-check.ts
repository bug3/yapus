import { makeScannerArguments } from '../../../../../../shared/scanner/make-scanner-arguments.ts';
import { readScannerReport } from '../../../../../../shared/scanner/read-scanner-report.ts';
import type { Call } from '../../../calls/get-calls.ts';
import { gateScanner } from '../../../context/gate-scanner.ts';
import type { Context } from '../../../context/make-context.ts';
import type { CheckResult } from '../../../get-verdict.ts';
import { getGhAction } from '../get-gh-action.ts';
import { ghCommands } from '../gh-commands.ts';
import { readGhArguments } from '../read-gh-arguments.ts';
import { readScanText } from './read-scan-text.ts';

const { reasons, scanned } = ghCommands;

// What the scanner makes of the title and the body of a gh call that writes text:
// a refusal for a secret (never printed) or a scan that cannot run, a note when
// the scanner is not installed, else undefined. The scanner reads the text from
// standard input, with the arguments the git hooks use.
export function getScanCheck(call: Call, context: Context): CheckResult {
  const action = getGhAction(call.words);
  const options = scanned.get(action);
  const spec = ghCommands.actions.get(action);

  if (call.tool !== 'gh' || options === undefined || spec === undefined) {
    return undefined;
  }

  const args = readGhArguments(call.words.slice(2), spec);

  if ('refusal' in args) {
    return args;
  }

  const read = readScanText(args, spec.command, options);

  if ('refusal' in read) {
    return read;
  }

  return read.text === '' ? undefined : scan(read.text, context);
}

function scan(text: string, context: Context): CheckResult {
  if ('violation' in gateScanner) {
    return { refusal: reasons.scanFailed };
  }

  const result = context.run('scanner', makeScannerArguments(gateScanner, ['stdin']), {
    input: text,
  });

  if ('failure' in result) {
    return result.isMissing === true
      ? { note: reasons.scanMissing }
      : { refusal: reasons.scanFailed };
  }

  if (result.status === 0) {
    return undefined;
  }

  const findings = result.status === gateScanner.findingsExitCode
    ? readScannerReport(result.stdout)
    : [];
  const [first] = 'violation' in findings ? [] : findings;

  return first === undefined
    ? { refusal: reasons.scanFailed }
    : { refusal: reasons.scanSecret(first.ruleId, first.startLine) };
}
