import { ghCommands, type BodyRules } from '../gh-commands.ts';

interface Section {
  readonly heading: string;
  hasText: boolean;
}

// A reason to refuse a body whose ending or `##` headings are not the rules', or
// undefined. Lines before the first heading are free.
export function getBodyTextRefusal(text: string, rules: BodyRules): string | undefined {
  const lines = dropTrailingBlanks(text.replaceAll('\r\n', '\n').split('\n'));
  const footerStart = lines.length - rules.footer.length;

  if (!rules.footer.every((line, index) => lines[footerStart + index] === line)) {
    return ghCommands.reasons.bodyFooter(rules.footer);
  }

  const sections = readSections(dropTrailingBlanks(lines.slice(0, footerStart)));
  const isFormed = sections.length === rules.headings.length
    && sections.every((section, index) =>
      section.hasText && section.heading === rules.headings[index]);

  return isFormed ? undefined : ghCommands.reasons.bodyHeadings(rules.headings);
}

function dropTrailingBlanks(lines: readonly string[]): readonly string[] {
  const lastText = lines.findLastIndex((line) => line.trim() !== '');

  return lines.slice(0, lastText + 1);
}

function readSections(lines: readonly string[]): readonly Section[] {
  const sections: Section[] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      sections.push({ heading: line.slice(3).trimEnd(), hasText: false });
    } else if (line.trim() !== '' && sections.length > 0) {
      const last = sections[sections.length - 1];

      if (last !== undefined) {
        last.hasText = true;
      }
    }
  }

  return sections;
}
