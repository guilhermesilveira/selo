import * as path from 'node:path';
import { runRule } from '../engine/runRule.js';
import { formatOffenderLines } from '../engine/render.js';
import { filesForRule, loadProject, parseAllFiles, projectRoot, resolveOptions } from '../engine/loadProject.js';
import { readBaseline, writeBaseline, type Baseline } from '../ratchet/baseline.js';
import { verdict } from '../ratchet/verdict.js';
import { parseCommonArgs } from './args.js';

export async function runCheck(rest: string[]): Promise<void> {
  const args = parseCommonArgs(rest);
  const cwd = projectRoot(args.cwd);
  const ctx = await loadProject(cwd);
  const baselinePath = path.join(cwd, 'selo.baseline.json');
  const baseline: Baseline = await readBaseline(baselinePath);

  const files = await parseAllFiles(ctx);
  let regressed = false;
  let dirty = false;

  for (const [ruleId, ruleCfg] of Object.entries(ctx.config.rules)) {
    const rule = ctx.ruleMap.get(ruleId);
    if (!rule) {
      process.stderr.write(`selo: unknown rule '${ruleId}' — no pack provides it\n`);
      continue;
    }
    if (typeof ruleCfg.goal !== 'number' && rule.meta.type === 'threshold') {
      process.stderr.write(`selo: ${ruleId} is a threshold rule but no 'goal' is configured — skipping\n`);
      continue;
    }
    const goal = ruleCfg.goal ?? 0;
    const ruleFiles = filesForRule(files, ruleCfg);
    const options = resolveOptions(rule, ruleCfg);
    const aggregate = runRule({ rule, options, files: ruleFiles, goal });
    const v = verdict({
      measuredWorst: aggregate.worst,
      measuredViolations: aggregate.violationsVsGoal,
      goal,
      step: ruleCfg.step,
      stored: baseline[ruleId],
    });

    switch (v.kind) {
      case 'seeded': {
        baseline[ruleId] = v.next;
        dirty = true;
        process.stdout.write(
          `selo: seeded ${ruleId} — current=${v.next.current}, worst=${v.next.worst}, violationsVsGoal=${v.next.violationsVsGoal}, goal=${goal}\n`,
        );
        break;
      }
      case 'arrived': {
        process.stdout.write(`selo: ${ruleId} clean at goal=${goal}\n`);
        break;
      }
      case 'arrivedFailed': {
        regressed = true;
        const offenders = aggregate.offendersOver(v.offendersThreshold);
        process.stderr.write(
          `\nselo: ${ruleId} REGRESSED past goal=${goal}\n` +
            `  ${offenders.length} unit(s) violate goal=${goal}. ` +
            `The ratchet is finished — fix back to goal, no step-tightening.\n`,
        );
        for (const line of formatOffenderLines(rule, offenders)) process.stderr.write(`${line}\n`);
        break;
      }
      case 'flat': {
        process.stdout.write(
          `selo: ${ruleId} flat — worst ${aggregate.worst}, violations ${aggregate.violationsVsGoal}, current ${baseline[ruleId]?.current}, goal ${goal}\n`,
        );
        break;
      }
      case 'improved': {
        baseline[ruleId] = v.next;
        dirty = true;
        const prev = baseline[ruleId];
        process.stdout.write(
          `selo: ${ruleId} improved — worst ${prev?.worst}→${v.next.worst}, violationsVsGoal ${prev?.violationsVsGoal}→${v.next.violationsVsGoal}\n`,
        );
        break;
      }
      case 'regressed': {
        regressed = true;
        const stored = baseline[ruleId];
        const offenders = aggregate.offendersOver(v.offendersThreshold);
        process.stderr.write(
          `\nselo: REGRESSION on ${ruleId} (goal ${goal})\n` +
            `  worst:            ${stored?.worst} → ${aggregate.worst}\n` +
            `  violationsVsGoal: ${stored?.violationsVsGoal} → ${aggregate.violationsVsGoal}\n\n` +
            `  Tighten current:  ${stored?.current} → ${v.newCurrent}\n` +
            `  Units violating new current ${v.newCurrent}: ${offenders.length}\n`,
        );
        for (const line of formatOffenderLines(rule, offenders)) process.stderr.write(`${line}\n`);
        process.stderr.write(
          `\n  When everything is at or below ${v.newCurrent}, rerun \`selo check\` to bless the new baseline.\n`,
        );
        break;
      }
    }
  }

  if (dirty) await writeBaseline(baselinePath, baseline);
  if (regressed) process.exit(1);
}
