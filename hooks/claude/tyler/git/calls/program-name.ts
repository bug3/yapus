// The name a program word runs as: after the last `/`, lower-cased, because macOS file
// systems ignore case (`GIT` runs git, `/usr/bin/ENV` runs env).
export function programName(text: string): string {
  return text.slice(text.lastIndexOf('/') + 1).toLowerCase();
}
