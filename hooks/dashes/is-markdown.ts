export function isMarkdown(filePath: string): boolean {
  const lowerPath = filePath.toLowerCase();

  return lowerPath.endsWith('.md') || lowerPath.endsWith('.markdown');
}
