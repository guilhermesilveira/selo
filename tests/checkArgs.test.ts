import { describe, expect, it } from 'vitest';
import { parseCheckArgs } from '../src/cli/check.js';

describe('parseCheckArgs', () => {
  it('blesses the baseline by default', () => {
    expect(parseCheckArgs([])).toEqual({
      cwd: undefined,
      blessBaseline: true,
    });
  });

  it('can disable baseline blessing', () => {
    expect(parseCheckArgs(['--cwd', '/tmp/project', '--dont-bless-baseline'])).toEqual({
      cwd: '/tmp/project',
      blessBaseline: false,
    });
  });
});
