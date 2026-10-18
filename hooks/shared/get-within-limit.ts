// The result of the work, or undefined when the limit passes first.
export async function getWithinLimit<T>(
  work: Promise<T>,
  limitSeconds: number,
): Promise<T | undefined> {
  let timer: NodeJS.Timeout | undefined;

  const limitReached = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => {
      resolve(undefined);
    }, limitSeconds * 1000);
  });

  try {
    return await Promise.race([work, limitReached]);
  } finally {
    clearTimeout(timer);
  }
}
