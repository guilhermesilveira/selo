import { DEFAULT_STEP, ratchetTowardsGoal } from './step.js';
import type { RuleBaseline } from './baseline.js';

export interface VerdictInput {
  measuredWorst: number;
  measuredViolations: number;
  goal: number;
  step?: number;
  stored: RuleBaseline | undefined;
}

export type Verdict =
  | { kind: 'seeded'; next: RuleBaseline }
  | { kind: 'arrived' }
  | { kind: 'arrivedFailed'; offendersThreshold: number }
  | { kind: 'flat' }
  | { kind: 'improved'; next: RuleBaseline }
  | { kind: 'regressed'; newCurrent: number; offendersThreshold: number };

export function verdict({ measuredWorst, measuredViolations, goal, step, stored }: VerdictInput): Verdict {
  if (!stored) {
    return {
      kind: 'seeded',
      next: { current: measuredWorst, worst: measuredWorst, violationsVsGoal: measuredViolations },
    };
  }
  if (stored.current <= goal) {
    if (measuredViolations > 0) return { kind: 'arrivedFailed', offendersThreshold: stored.current };
    return { kind: 'arrived' };
  }
  if (measuredWorst > stored.worst || measuredViolations > stored.violationsVsGoal) {
    const newCurrent = ratchetTowardsGoal(stored.current, goal, step ?? DEFAULT_STEP);
    return { kind: 'regressed', newCurrent, offendersThreshold: newCurrent };
  }
  if (measuredWorst < stored.worst || measuredViolations < stored.violationsVsGoal) {
    return {
      kind: 'improved',
      next: { current: stored.current, worst: measuredWorst, violationsVsGoal: measuredViolations },
    };
  }
  return { kind: 'flat' };
}
