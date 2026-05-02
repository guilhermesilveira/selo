import { describe, expect, it } from 'vitest';
import { migrateBaseline, verdict } from '../src/ratchet/verdict.js';

describe('verdict — threshold rules', () => {
  it('seeds when no baseline exists', () => {
    const v = verdict({
      ruleType: 'threshold',
      measuredWorst: 904,
      measuredViolations: 297,
      goal: 80,
      stored: undefined,
    });
    expect(v.kind).toBe('seeded');
    if (v.kind === 'seeded') {
      expect(v.next).toEqual({ current: 904, worst: 904, violationsVsGoal: 297 });
    }
  });

  it('seeds with current clamped to goal when measuredWorst is already below goal', () => {
    const v = verdict({
      ruleType: 'threshold',
      measuredWorst: 70,
      measuredViolations: 0,
      goal: 80,
      stored: undefined,
    });
    expect(v.kind).toBe('seeded');
    if (v.kind === 'seeded') {
      expect(v.next).toEqual({ current: 80, worst: 70, violationsVsGoal: 0 });
    }
  });

  it('reports flat when measurements match the stored baseline', () => {
    const v = verdict({
      ruleType: 'threshold',
      measuredWorst: 904,
      measuredViolations: 297,
      goal: 80,
      stored: { current: 904, worst: 904, violationsVsGoal: 297 },
    });
    expect(v.kind).toBe('flat');
  });

  it('regresses when worst grows', () => {
    const v = verdict({
      ruleType: 'threshold',
      measuredWorst: 920,
      measuredViolations: 297,
      goal: 80,
      stored: { current: 904, worst: 904, violationsVsGoal: 297 },
    });
    expect(v.kind).toBe('regressed');
    if (v.kind === 'regressed') expect(v.newCurrent).toBeLessThan(904);
  });

  it('regresses when violations grow even if worst is unchanged', () => {
    const v = verdict({
      ruleType: 'threshold',
      measuredWorst: 904,
      measuredViolations: 298,
      goal: 80,
      stored: { current: 904, worst: 904, violationsVsGoal: 297 },
    });
    expect(v.kind).toBe('regressed');
  });

  it('improves when worst drops', () => {
    const v = verdict({
      ruleType: 'threshold',
      measuredWorst: 850,
      measuredViolations: 290,
      goal: 80,
      stored: { current: 904, worst: 904, violationsVsGoal: 297 },
    });
    expect(v.kind).toBe('improved');
    if (v.kind === 'improved') {
      expect(v.next).toEqual({ current: 850, worst: 850, violationsVsGoal: 290 });
    }
  });

  it('never loosens current when blessing a threshold improvement', () => {
    const v = verdict({
      ruleType: 'threshold',
      measuredWorst: 850,
      measuredViolations: 290,
      goal: 80,
      stored: { current: 800, worst: 904, violationsVsGoal: 297 },
    });
    expect(v.kind).toBe('improved');
    if (v.kind === 'improved') {
      expect(v.next).toEqual({ current: 800, worst: 850, violationsVsGoal: 290 });
    }
  });

  it('reports arrived when current is at the goal and nothing violates it', () => {
    const v = verdict({
      ruleType: 'threshold',
      measuredWorst: 70,
      measuredViolations: 0,
      goal: 80,
      stored: { current: 80, worst: 70, violationsVsGoal: 0 },
    });
    expect(v.kind).toBe('arrived');
  });

  it('reports arrivedFailed when current is at the goal but units violate it', () => {
    const v = verdict({
      ruleType: 'threshold',
      measuredWorst: 95,
      measuredViolations: 1,
      goal: 80,
      stored: { current: 80, worst: 70, violationsVsGoal: 0 },
    });
    expect(v.kind).toBe('arrivedFailed');
    if (v.kind === 'arrivedFailed') expect(v.offendersThreshold).toBe(80);
  });

  it('arrivedFailed reports against goal even when current snapped below it (stale baseline)', () => {
    const v = verdict({
      ruleType: 'threshold',
      measuredWorst: 95,
      measuredViolations: 1,
      goal: 80,
      stored: { current: 70, worst: 70, violationsVsGoal: 0 },
    });
    expect(v.kind).toBe('arrivedFailed');
    if (v.kind === 'arrivedFailed') expect(v.offendersThreshold).toBe(80);
  });

  it('arrivedFailed enforces goal regardless of how badly the violation overshoots', () => {
    const v = verdict({
      ruleType: 'threshold',
      measuredWorst: 8000,
      measuredViolations: 5,
      goal: 80,
      stored: { current: 80, worst: 80, violationsVsGoal: 0 },
    });
    expect(v.kind).toBe('arrivedFailed');
    if (v.kind === 'arrivedFailed') expect(v.offendersThreshold).toBe(80);
  });
});

describe('verdict — count rules', () => {
  it('seeds with current = violationsVsGoal (not the per-unit value)', () => {
    const v = verdict({
      ruleType: 'count',
      measuredWorst: 1,
      measuredViolations: 100,
      goal: 0,
      stored: undefined,
    });
    expect(v.kind).toBe('seeded');
    if (v.kind === 'seeded') {
      expect(v.next).toEqual({ current: 100, worst: 100, violationsVsGoal: 100 });
    }
  });

  it('seeds with current clamped to goal when measured is already at/below goal', () => {
    const v = verdict({
      ruleType: 'count',
      measuredWorst: 1,
      measuredViolations: 3,
      goal: 5,
      stored: undefined,
    });
    expect(v.kind).toBe('seeded');
    if (v.kind === 'seeded') {
      // current snaps to goal (5), worst tracks the measured count (3).
      expect(v.next).toEqual({ current: 5, worst: 3, violationsVsGoal: 3 });
    }
  });

  it('regresses by exactly 1 when 100 violations grow to 101 with default step', () => {
    const v = verdict({
      ruleType: 'count',
      measuredWorst: 1,
      measuredViolations: 101,
      goal: 0,
      stored: { current: 100, worst: 100, violationsVsGoal: 100 },
    });
    expect(v.kind).toBe('regressed');
    if (v.kind === 'regressed') {
      // delta = max(1, ceil(0.01 * 100)) = 1, newCurrent = 99.
      expect(v.newCurrent).toBe(99);
    }
  });

  it('flat when violations match stored', () => {
    const v = verdict({
      ruleType: 'count',
      measuredWorst: 1,
      measuredViolations: 100,
      goal: 0,
      stored: { current: 100, worst: 100, violationsVsGoal: 100 },
    });
    expect(v.kind).toBe('flat');
  });

  it('improved when violations drop, current tightens', () => {
    const v = verdict({
      ruleType: 'count',
      measuredWorst: 1,
      measuredViolations: 90,
      goal: 0,
      stored: { current: 100, worst: 100, violationsVsGoal: 100 },
    });
    expect(v.kind).toBe('improved');
    if (v.kind === 'improved') {
      expect(v.next).toEqual({ current: 90, worst: 90, violationsVsGoal: 90 });
    }
  });

  it('arrivedFailed when measured violations exceed goal', () => {
    const v = verdict({
      ruleType: 'count',
      measuredWorst: 1,
      measuredViolations: 5,
      goal: 0,
      stored: { current: 0, worst: 0, violationsVsGoal: 0 },
    });
    expect(v.kind).toBe('arrivedFailed');
    if (v.kind === 'arrivedFailed') expect(v.offendersThreshold).toBe(0);
  });

  it('arrived (clean) when measured violations are within goal tolerance', () => {
    const v = verdict({
      ruleType: 'count',
      measuredWorst: 1,
      measuredViolations: 4,
      goal: 5,
      stored: { current: 5, worst: 4, violationsVsGoal: 4 },
    });
    expect(v.kind).toBe('arrived');
  });

  it('regresses by 10 when step is 0.1 and gap is 100', () => {
    const v = verdict({
      ruleType: 'count',
      measuredWorst: 1,
      measuredViolations: 101,
      goal: 0,
      step: 0.1,
      stored: { current: 100, worst: 100, violationsVsGoal: 100 },
    });
    expect(v.kind).toBe('regressed');
    if (v.kind === 'regressed') {
      // delta = max(1, ceil(0.1 * 100)) = 10, newCurrent = 90.
      expect(v.newCurrent).toBe(90);
    }
  });

  it('migrates a stale baseline (current=1 from pre-fix) on the fly', () => {
    // Stored under the old behaviour — current = 1 (per-unit value),
    // violationsVsGoal = 100. The verdict should treat current as 100
    // and report flat against the same 100 measurements.
    const v = verdict({
      ruleType: 'count',
      measuredWorst: 1,
      measuredViolations: 100,
      goal: 0,
      stored: { current: 1, worst: 1, violationsVsGoal: 100 },
    });
    expect(v.kind).toBe('flat');
  });
});

describe('migrateBaseline', () => {
  it('returns input unchanged for threshold rules', () => {
    const stored = { current: 80, worst: 70, violationsVsGoal: 0 };
    expect(migrateBaseline(stored, 'threshold')).toBe(stored);
  });

  it('returns input unchanged for count rules already in new format', () => {
    const stored = { current: 100, worst: 100, violationsVsGoal: 100 };
    expect(migrateBaseline(stored, 'count')).toBe(stored);
  });

  it('snaps current up to violationsVsGoal for stale count baselines', () => {
    const stored = { current: 1, worst: 1, violationsVsGoal: 100 };
    const migrated = migrateBaseline(stored, 'count');
    expect(migrated).toEqual({ current: 100, worst: 1, violationsVsGoal: 100 });
  });

  it('returns undefined input unchanged', () => {
    expect(migrateBaseline(undefined, 'count')).toBeUndefined();
  });
});
