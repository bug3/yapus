const FENCE = '---';
// One glob entry of a paths head, quoted, as Claude Code reads it.
const PATHS_ENTRY = /^( {2}- ")([^"]+)"$/;

interface PathsCatalog {
  readonly map: Readonly<Record<string, unknown>>;
}

// The standard as landmark installs it into ~/.claude/rules/yapus/landmark:
// each paths entry named in the catalog map is replaced by its value, or
// dropped when the value is not a string; every other line, the body included,
// stays as it is.
export function renderStandard(text: string, catalog: PathsCatalog): string {
  const lines = text.split('\n');
  const headEnd = lines[0] === FENCE ? lines.indexOf(FENCE, 1) : -1;

  if (headEnd < 0) {
    return text;
  }

  const head = lines.slice(0, headEnd).flatMap((line) => renderLine(line, catalog));

  return [...head, ...lines.slice(headEnd)].join('\n');
}

function renderLine(line: string, catalog: PathsCatalog): string[] {
  const [, prefix = '', entry = ''] = PATHS_ENTRY.exec(line) ?? [];

  if (!Object.hasOwn(catalog.map, entry)) {
    return [line];
  }

  const adopterEntry = catalog.map[entry];

  return typeof adopterEntry === 'string' ? [`${ prefix }${ adopterEntry }"`] : [];
}
