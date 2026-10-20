export interface Arguments {
  // Long options as written (`--hard`), and each letter of a short group as `-x`.
  readonly flags: ReadonlySet<string>;
  // The words that are not options: all of them after a `--`.
  readonly operands: readonly string[];
}

export function readArguments(texts: readonly string[]): Arguments {
  const flags = new Set<string>();
  const operands: string[] = [];
  let isAfterDashes = false;

  for (const text of texts) {
    if (isAfterDashes || !text.startsWith('-') || text === '-') {
      operands.push(text);
    } else if (text === '--') {
      isAfterDashes = true;
    } else if (text.startsWith('--')) {
      flags.add(text);
    } else {
      for (const letter of text.slice(1)) {
        flags.add(`-${ letter }`);
      }
    }
  }

  return { flags, operands };
}

// git accepts any unambiguous prefix of a long option (`--har` is `--hard`),
// so a written long option counts when it starts the wanted one.
export function hasFlag(args: Arguments, flag: string): boolean {
  if (!flag.startsWith('--')) {
    return args.flags.has(flag);
  }

  return [...args.flags].some((written) => {
    const name = written.split('=')[0] ?? written;

    return name.startsWith('--') && name.length > 2 && flag.startsWith(name);
  });
}
