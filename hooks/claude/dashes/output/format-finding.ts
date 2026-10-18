import { assertNever } from '../assert-never.ts';
import type { Finding, Place } from '../findings/get-findings.ts';
import { formatMessage } from './format-message.ts';
import { getCodePointName } from './get-code-point-name.ts';

export function formatFinding({ filePath, place, dashes }: Finding): string {
  const location = getLocation(filePath, place);
  const dashNames = dashes.map(getCodePointName).join(', ');

  return formatMessage(`${ location }: ${ dashNames }; use the ASCII hyphen`);
}

function getLocation(filePath: string, place: Place): string {
  switch (place.kind) {
    case 'file':
      return `${ filePath }:${ String(place.line) }`;
    case 'new_string':
      return `${ filePath }: new_string line ${ String(place.line) }`;
    default:
      return assertNever(place);
  }
}
