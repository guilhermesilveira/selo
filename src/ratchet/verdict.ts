import type { SeloRuleType } from '../contract/index.js';
import type { RuleBaseline } from './baseline.js';
import { DEFAULT_STEP, ratchetTowardsGoal } from './step.js';

export interface VerdictInput {
  ruleType: SeloRuleType;
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

/**
 * Compatibility shim: count-rule baselines created before the issue-#2 fix
 * stored `current` as the per-unit value (always 1 because every count-rule
 * measurement has `value: 1`) instead of the violation-count cap. The
 * ratchet had nothing meaningful to operate on. Snap up so subsequent
 * verdicts work correctly.
 *
 * Idempotent — once `current >= violationsVsGoal` the function is a no-op.
 */
export function migrateBaseline(
  stored: RuleBaseline | undefined,
  ruleType: SeloRuleType,
): RuleBaseline | undefined {
  if (!stored || ruleType !== 'count') return stored;
  if (stored.current >= stored.violationsVsGoal) return stored;
  return { ...stored, current: stored.violationsVsGoal };
}

export function verdict(input: VerdictInput): Verdict {
  const { ruleType, measuredWorst, measuredViolations, goal, step } = input;
  const stored = migrateBaseline(input.stored, ruleType);

  if (!stored) {
    // Seed. Pick the metric the rule type ratchets on:
    //   threshold: max measured value (e.g. lines, complexity)
    //   count:     total violations
    // Clamp `current` at goal from below — the contract is the goal,
    // never a historical low.
    const seedMetric = ruleType === 'count' ? measuredViolations : measuredWorst;
    return {
      kind: 'seeded',
      next: {
        current: Math.max(goal, seedMetric),
        worst: seedMetric,
        violationsVsGoal: measuredViolations,
      },
    };
  }

  if (stored.current <= goal) {
    // Arrived: goal is the contract. Past goal returns to goal immediately,
    // no step-tightening, no matter how bad the overshoot is.
    const failed = ruleType === 'count' ? measuredViolations > goal : measuredViolations > 0;
    if (failed) return { kind: 'arrivedFailed', offendersThreshold: goal };
    return { kind: 'arrived' };
  }

  // Ratcheting (current > goal). Regression check is type-specific:
  //   threshold: worst grew OR violations-past-goal grew
  //   count:     total violations grew (worst is meaningless — always 1)
  const regressed =
    ruleType === 'count'
      ? measuredViolations > stored.violationsVsGoal
      : measuredWorst > stored.worst || measuredViolations > stored.violationsVsGoal;
  if (regressed) {
    const newCurrent = ratchetTowardsGoal(stored.current, goal, step ?? DEFAULT_STEP);
    return { kind: 'regressed', newCurrent, offendersThreshold: newCurrent };
  }

  const improved =
    ruleType === 'count'
      ? measuredViolations < stored.violationsVsGoal
      : measuredWorst < stored.worst || measuredViolations < stored.violationsVsGoal;
  if (improved) {
    const improvedMetric = ruleType === 'count' ? measuredViolations : measuredWorst;
    return {
      kind: 'improved',
      next: {
        current: Math.min(stored.current, Math.max(goal, improvedMetric)),
        worst: ruleType === 'count' ? measuredViolations : measuredWorst,
        violationsVsGoal: measuredViolations,
      },
    };
  }

  return { kind: 'flat' };
}
