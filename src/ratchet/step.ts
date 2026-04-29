/**
 * Compute the next `current` after a forced ratchet tightening.
 *
 *   delta = max(1, ceil(step * (current - goal)))
 *   next  = max(goal, current - delta)
 *
 * The `max(1, …)` guarantees forward progress when the fractional step
 * rounds to zero near the goal. The `max(goal, …)` clamps so we don't
 * overshoot.
 */
export function ratchetTowardsGoal(current: number, goal: number, step: number): number {
  if (current <= goal) return current;
  const delta = Math.max(1, Math.ceil(step * (current - goal)));
  return Math.max(goal, current - delta);
}

export const DEFAULT_STEP = 0.01;
