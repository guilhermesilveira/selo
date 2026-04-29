import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SeloRule, SeloRulePack } from '../src/contract/index.js';
import { discoverFiles } from '../src/engine/discover.js';
import { parseFile } from '../src/engine/parse.js';
import { runRule } from '../src/engine/runRule.js';

// Fixture rule: count characters per file. Pure threshold rule, no AST involved.
const charCountRule: SeloRule<unknown> = {
  meta: {
    id: 'fixture/max-chars',
    description: 'Cap characters per file (fixture rule for engine tests).',
    type: 'threshold',
    unitLabel: 'chars',
    seal: '{{file}} has {{value}} characters; cap is {{max}}.',
  },
  measure(file) {
    return [
      {
        value: file.source.length,
        file: file.path,
        data: { file: file.path, value: file.source.length, max: 'TBD' },
      },
    ];
  },
};

const fixturePack: SeloRulePack = {
  name: 'fixture',
  version: '0.0.0',
  rules: { 'fixture/max-chars': charCountRule },
};

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'selo-test-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('engine integration', () => {
  it('discovers, parses, and runs a fixture rule across files', async () => {
    await fs.writeFile(path.join(tmp, 'a.ts'), 'const a = 1;\n'); // 13 chars
    await fs.writeFile(path.join(tmp, 'b.ts'), 'const b = 2;\nconst c = 3;\n'); // 26 chars

    const filesAbs = await discoverFiles({ cwd: tmp });
    expect(filesAbs.length).toBe(2);

    const files = await Promise.all(filesAbs.map((p) => parseFile(p, tmp)));
    const valid = files.filter((f): f is NonNullable<typeof f> => f !== null);
    const aggregate = runRule({
      rule: fixturePack.rules['fixture/max-chars']!,
      options: {},
      files: valid,
      goal: 10,
    });
    expect(aggregate.measurements.length).toBe(2);
    expect(aggregate.worst).toBe(26);
    expect(aggregate.violationsVsGoal).toBe(2); // both files exceed goal of 10
    const offenders = aggregate.offendersOver(10);
    expect(offenders[0]?.value).toBe(26);
    expect(offenders[1]?.value).toBe(13);
  });

  it('respects rule.meta.type=count with violationsVsGoal = total measurements', async () => {
    const countRule: SeloRule<unknown> = {
      meta: {
        id: 'fixture/lines-with-todo',
        description: 'Count lines that contain TODO.',
        type: 'count',
        unitLabel: 'todos',
        seal: 'TODO at {{file}}:{{line}}',
      },
      measure(file) {
        const out = [];
        const lines = file.source.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i]!.includes('TODO')) {
            out.push({ value: 1, file: file.path, startLine: i + 1, data: { file: file.path, line: i + 1 } });
          }
        }
        return out;
      },
    };

    await fs.writeFile(path.join(tmp, 'a.ts'), '// TODO: fix\nconst a = 1;\n// TODO: again\n');
    await fs.writeFile(path.join(tmp, 'b.ts'), 'const b = 2;\n');

    const filesAbs = await discoverFiles({ cwd: tmp });
    const files = await Promise.all(filesAbs.map((p) => parseFile(p, tmp)));
    const valid = files.filter((f): f is NonNullable<typeof f> => f !== null);

    const aggregate = runRule({ rule: countRule, options: undefined, files: valid, goal: 0 });
    expect(aggregate.measurements.length).toBe(2);
    expect(aggregate.violationsVsGoal).toBe(2);
    expect(aggregate.worst).toBe(1);
  });
});
