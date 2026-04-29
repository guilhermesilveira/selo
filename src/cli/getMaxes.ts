import * as path from 'node:path';
import { loadProject, projectRoot } from '../engine/loadProject.js';
import { readBaseline } from '../ratchet/baseline.js';
import { parseCommonArgs } from './args.js';

export async function runGetMaxes(rest: string[]): Promise<void> {
  const args = parseCommonArgs(rest);
  const cwd = projectRoot(args.cwd);
  const ctx = await loadProject(cwd);
  const baseline = await readBaseline(path.join(cwd, 'selo.baseline.json'));

  const out: Record<string, number> = {};
  for (const ruleId of Object.keys(ctx.config.rules)) {
    const entry = baseline[ruleId];
    if (!entry) {
      process.stderr.write(`selo: ${ruleId} is in config but missing from baseline; skipping.\n`);
      continue;
    }
    out[ruleId] = entry.current;
  }
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
}
