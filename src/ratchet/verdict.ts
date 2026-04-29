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
    // Seed: `current` is clamped at `goal` from below — the contract is the
    // goal, not the historical low. If the codebase already meets the goal at
    // seed time, current snaps to goal so future runs are in the arrived branch.
    return {
      kind: 'seeded',
      next: {
        current: Math.max(goal, measuredWorst),
        worst: measuredWorst,
        violationsVsGoal: measuredViolations,
      },
    };
  }
  if (stored.current <= goal) {
    // Arrived: only `goal` is the contract. A regression past goal must
    // return to goal immediately, no step-tightening — the ratchet is done.
    if (measuredViolations > 0) return { kind: 'arrivedFailed', offendersThreshold: goal };
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
