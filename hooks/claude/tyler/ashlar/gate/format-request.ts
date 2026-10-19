import type { Change } from '../git/get-change.ts';
import type { RiskHit } from '../git/get-risk-hits.ts';

export interface Request {
  readonly base: string;
  readonly change: Change;
  readonly threshold: number;
  readonly hits: readonly RiskHit[];
  readonly diffPath: string;
}

const BASE_LENGTH = 12;

// The text that sends the session back: what makes the change need review,
// and the instruction to get it reviewed. A reason that does not apply is left
// out.
export function formatRequest(request: Request): string {
  const reasons = [describeLines(request), describeHits(request.hits)]
    .filter((reason) => reason !== undefined);

  return `the change since ${ request.base.slice(0, BASE_LENGTH) } ${ reasons.join(' and ') } `
    + 'with no accepted review; launch providens:warden with the task\'s acceptance criteria '
    + `and the diff in ${ request.diffPath }`;
}

function describeLines(request: Request): string | undefined {
  const { lines } = request.change;

  return lines > request.threshold
    ? `has ${ String(lines) } changed lines (threshold ${ String(request.threshold) })`
    : undefined;
}

function describeHits(hits: readonly RiskHit[]): string | undefined {
  const [first, ...others] = hits;

  if (first === undefined) {
    return undefined;
  }

  const more = others.length > 0 ? ` and ${ String(others.length) } more` : '';

  return `touches ${ first.file } (${ first.glob })${ more }`;
}
