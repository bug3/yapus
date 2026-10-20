// Whether a word names a long option, whole or cut to a prefix as git allows (`--exe`
// for `--exec`), with or without `=VALUE`.
export function isLongOption(text: string, long: string): boolean {
  const name = text.split('=')[0] ?? '';

  return name.length > 2 && name.startsWith('--') && long.startsWith(name);
}
