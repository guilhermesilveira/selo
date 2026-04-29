import * as fs from 'node:fs/promises';

export interface RuleBaseline {
  current: number;
  worst: number;
  violationsVsGoal: number;
}

export type Baseline = Record<string, RuleBaseline>;

export async function readBaseline(path: string): Promise<Baseline> {
  try {
    const raw = await fs.readFile(path, 'utf8');
    return JSON.parse(raw) as Baseline;
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'ENOENT') return {};
    throw e;
  }
}

export async function writeBaseline(path: string, baseline: Baseline): Promise<void> {
  const sorted: Baseline = {};
  for (const key of Object.keys(baseline).sort()) {
    sorted[key] = baseline[key]!;
  }
  await fs.writeFile(path, `${JSON.stringify(sorted, null, 2)}\n`);
}
