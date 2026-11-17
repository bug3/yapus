import { findLogMoves } from './find-log-moves.ts';
import { findPlanMoves } from './find-plan-moves.ts';
import { type Found, mergeFound } from './merge-found.ts';

// What moves a project's .yapus/ files into the present layout: the steps in
// order, the prompt logs and then the plans, each recognising its own older
// shape. Nothing is changed, and a project in the present layout has no move.
export function findMoves(projectRoot: string): Found {
  return mergeFound([findLogMoves(projectRoot), findPlanMoves(projectRoot)]);
}
