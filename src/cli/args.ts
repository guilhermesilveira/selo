import * as path from 'node:path';

export interface CommonArgs {
  cwd: string | undefined;
  positional: string[];
}

export function parseCommonArgs(rest: string[]): CommonArgs {
  const out: CommonArgs = { cwd: undefined, positional: [] };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--cwd') {
      const v = rest[++i];
      if (v !== undefined) out.cwd = path.resolve(v);
      continue;
    }
    if (a !== undefined) out.positional.push(a);
  }
  return out;
}
