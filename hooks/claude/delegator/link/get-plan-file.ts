import { isAbsolute, join, relative, sep } from 'node:path';
import { isMonthName } from '../plans/is-month-name.ts';
import { isTopicName } from '../plans/is-topic-name.ts';

// A file of a plan: the plan as <YYYY-MM>/<topic>, and the file's path below
// the plan's directory.
export interface PlanFile {
  readonly plan: string;
  readonly file: string;
}

// The plan file at the absolute path, or undefined for a path that is not
// below <projectRoot>/.yapus/plans/<month>/<topic>/: a file of another root,
// a plan of the older layout, a file directly in a month. The paths are
// compared as text, so one that reaches the root through a link is none.
export function getPlanFile(projectRoot: string, filePath: string): PlanFile | undefined {
  if (!isAbsolute(filePath)) {
    return undefined;
  }

  const plansDirectory = join(projectRoot, '.yapus', 'plans');
  const [month, topic, ...below] = relative(plansDirectory, filePath).split(sep);

  if (month === undefined || topic === undefined || below.length === 0) {
    return undefined;
  }

  // A path outside the plans directory starts with '..', which is no month.
  if (!isMonthName(month) || !isTopicName(topic)) {
    return undefined;
  }

  return { plan: `${ month }/${ topic }`, file: below.join('/') };
}
