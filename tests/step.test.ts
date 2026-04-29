import { describe, expect, it } from 'vitest';
import { ratchetTowardsGoal } from '../src/ratchet/step.js';

describe('ratchetTowardsGoal', () => {
  it('uses ceil(step * gap) for the delta', () => {
    expect(ratchetTowardsGoal(1000, 100, 0.1)).toBe(910);
    expect(ratchetTowardsGoal(910, 100, 0.1)).toBe(829);
  });

  it('rounds delta up to 1 when fractional', () => {
    expect(ratchetTowardsGoal(109, 100, 0.1)).toBe(108);
    expect(ratchetTowardsGoal(101, 100, 0.1)).toBe(100);
  });

  it('clamps to the goal when step would overshoot', () => {
    expect(ratchetTowardsGoal(105, 100, 5)).toBe(100);
  });

  it('returns current when already at or past goal', () => {
    expect(ratchetTowardsGoal(100, 100, 0.1)).toBe(100);
    expect(ratchetTowardsGoal(50, 100, 0.1)).toBe(50);
  });

  it('forces at least 1 unit progress when step rounds to 0', () => {
    expect(ratchetTowardsGoal(500, 100, 0)).toBe(499);
  });
});
