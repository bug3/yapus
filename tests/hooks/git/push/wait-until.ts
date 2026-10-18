import { setTimeout as sleep } from 'node:timers/promises';

const POLL_MS = 20;

// Whether isDone turns true within the limit, asked every 20 ms.
export async function waitUntil(isDone: () => boolean, limitMs: number): Promise<boolean> {
  const deadline = Date.now() + limitMs;

  while (!isDone()) {
    if (Date.now() > deadline) {
      return false;
    }

    await sleep(POLL_MS);
  }

  return true;
}
