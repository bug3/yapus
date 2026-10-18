import { getCodePointName } from './get-code-point-name.ts';

// A message is one line: a control character or a line or paragraph
// separator, which could break the line, is written as its code point.
export function formatMessage(detail: string): string {
  return `yapus subject: ${ getPrintableText(detail) }`;
}

function getPrintableText(text: string): string {
  return Array.from(text, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;

    return isControlOrSeparator(codePoint) ? `<${ getCodePointName(codePoint) }>` : character;
  }).join('');
}

function isControlOrSeparator(codePoint: number): boolean {
  const isControl = codePoint < 0x20 || (codePoint >= 0x7f && codePoint <= 0x9f);

  return isControl || codePoint === 0x2028 || codePoint === 0x2029;
}
