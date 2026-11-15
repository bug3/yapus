// The median of the numbers, or undefined when there are none; the mean of
// the two middle values for an even count.
export function getMedian(numbers: readonly number[]): number | undefined {
  if (numbers.length === 0) {
    return undefined;
  }

  const sorted = [...numbers].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;

  return sorted.length % 2 === 1 ? upper : ((sorted[middle - 1] ?? 0) + upper) / 2;
}
