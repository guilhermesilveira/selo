import { describe, expect, it } from 'vitest';
import { verdict } from '../src/ratchet/verdict.js';

describe('verdict', () => {
  it('seeds when no baseline exists', () => {
    const v = verdict({ measuredWorst: 904, measuredViolations: 297, goal: 80, stored: undefined });
    expect(v.kind).toBe('seeded');
    if (v.kind === 'seeded') {
      expect(v.next).toEqual({ current: 904, worst: 904, violationsVsGoal: 297 });
    }
  });

  it('seeds with current clamped to goal when measuredWorst is already below goal', () => {
    const v = verdict({ measuredWorst: 70, measuredViolations: 0, goal: 80, stored: undefined });
    expect(v.kind).toBe('seeded');
    if (v.kind === 'seeded') {
      // current snaps to goal — historical lows aren't promoted to a contract.
      expect(v.next).toEqual({ current: 80, worst: 70, violationsVsGoal: 0 });
    }
  });

  it('reports flat when measurements match the stored baseline', () => {
    const v = verdict({
      measuredWorst: 904,
      measuredViolations: 297,
      goal: 80,
      stored: { current: 904, worst: 904, violationsVsGoal: 297 },
    });
    expect(v.kind).toBe('flat');
  });

  it('regresses when worst grows', () => {
    const v = verdict({
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
      measuredWorst: 904,
      measuredViolations: 298,
      goal: 80,
      stored: { current: 904, worst: 904, violationsVsGoal: 297 },
    });
    expect(v.kind).toBe('regressed');
  });

  it('improves when worst drops', () => {
    const v = verdict({
      measuredWorst: 850,
      measuredViolations: 290,
      goal: 80,
      stored: { current: 904, worst: 904, violationsVsGoal: 297 },
    });
    expect(v.kind).toBe('improved');
    if (v.kind === 'improved') {
      expect(v.next).toEqual({ current: 904, worst: 850, violationsVsGoal: 290 });
    }
  });

  it('reports arrived when current is at the goal and nothing violates it', () => {
    const v = verdict({
      measuredWorst: 70,
      measuredViolations: 0,
      goal: 80,
      stored: { current: 80, worst: 70, violationsVsGoal: 0 },
    });
    expect(v.kind).toBe('arrived');
  });

  it('reports arrivedFailed when current is at the goal but units violate it', () => {
    const v = verdict({
      measuredWorst: 95,
      measuredViolations: 1,
      goal: 80,
      stored: { current: 80, worst: 70, violationsVsGoal: 0 },
    });
    expect(v.kind).toBe('arrivedFailed');
    if (v.kind === 'arrivedFailed') expect(v.offendersThreshold).toBe(80);
  });

  it('arrivedFailed reports against goal even when current snapped below it (stale baseline)', () => {
    // Pre-existing baselines may have current<goal; the verdict still uses goal as the threshold.
    const v = verdict({
      measuredWorst: 95,
      measuredViolations: 1,
      goal: 80,
      stored: { current: 70, worst: 70, violationsVsGoal: 0 },
    });
    expect(v.kind).toBe('arrivedFailed');
    if (v.kind === 'arrivedFailed') expect(v.offendersThreshold).toBe(80);
  });

  it('arrivedFailed enforces goal regardless of how badly the violation overshoots', () => {
    // Even a 10000% overshoot returns to goal, not to a stepped intermediate.
    const v = verdict({
      measuredWorst: 8000,
      measuredViolations: 5,
      goal: 80,
      stored: { current: 80, worst: 80, violationsVsGoal: 0 },
    });
    expect(v.kind).toBe('arrivedFailed');
    if (v.kind === 'arrivedFailed') expect(v.offendersThreshold).toBe(80);
  });
});
