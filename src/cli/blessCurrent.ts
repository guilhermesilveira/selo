import * as path from 'node:path';
import { runRule } from '../engine/runRule.js';
import { filesForRule, loadProject, parseAllFiles, projectRoot, resolveOptions } from '../engine/loadProject.js';
import { readBaseline, writeBaseline, type Baseline } from '../ratchet/baseline.js';
import { parseCommonArgs } from './args.js';

export async function runBlessCurrent(rest: string[]): Promise<void> {
  const args = parseCommonArgs(rest);
  const cwd = projectRoot(args.cwd);
  const ctx = await loadProject(cwd);
  const baselinePath = path.join(cwd, 'selo.baseline.json');
  const baseline: Baseline = await readBaseline(baselinePath);
  const files = await parseAllFiles(ctx);
  let dirty = false;

  for (const [ruleId, ruleCfg] of Object.entries(ctx.config.rules)) {
    const rule = ctx.ruleMap.get(ruleId);
    if (!rule) continue;
    if (typeof ruleCfg.goal !== 'number' && rule.meta.type === 'threshold') continue;
    const goal = ruleCfg.goal ?? 0;
    const ruleFiles = filesForRule(files, ruleCfg);
    const options = resolveOptions(rule, ruleCfg);
    const aggregate = runRule({ rule, options, files: ruleFiles, goal });
    const stored = baseline[ruleId];

    if (!stored) {
      baseline[ruleId] = {
        current: aggregate.worst,
        worst: aggregate.worst,
        violationsVsGoal: aggregate.violationsVsGoal,
      };
      dirty = true;
      process.stdout.write(
        `selo: ${ruleId} seeded → current=${aggregate.worst}, worst=${aggregate.worst}, violationsVsGoal=${aggregate.violationsVsGoal}\n`,
      );
      continue;
    }
    if (aggregate.worst > stored.worst || aggregate.violationsVsGoal > stored.violationsVsGoal) {
      process.stdout.write(
        `selo: ${ruleId} skipped — would worsen baseline (worst ${stored.worst}→${aggregate.worst}, violations ${stored.violationsVsGoal}→${aggregate.violationsVsGoal})\n`,
      );
      continue;
    }
    if (
      aggregate.worst === stored.worst &&
      aggregate.violationsVsGoal === stored.violationsVsGoal &&
      aggregate.worst === stored.current
    ) {
      process.stdout.write(
        `selo: ${ruleId} unchanged (current=${stored.current}, violations=${stored.violationsVsGoal})\n`,
      );
      continue;
    }
    baseline[ruleId] = {
      current: aggregate.worst,
      worst: aggregate.worst,
      violationsVsGoal: aggregate.violationsVsGoal,
    };
    dirty = true;
    process.stdout.write(
      `selo: ${ruleId} blessed — current ${stored.current}→${aggregate.worst}, worst ${stored.worst}→${aggregate.worst}, violations ${stored.violationsVsGoal}→${aggregate.violationsVsGoal}\n`,
    );
  }

  if (dirty) await writeBaseline(baselinePath, baseline);
}
