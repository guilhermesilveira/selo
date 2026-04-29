import type { SeloMeasurement, SeloRule } from '../contract/index.js';
import { renderSeal } from '../contract/index.js';

export function formatOffenderLines(rule: SeloRule, measurements: SeloMeasurement[], maxRows = 10): string[] {
  const top = measurements.slice(0, maxRows);
  const lines: string[] = [];
  for (const m of top) {
    const where = m.startLine !== undefined ? `${m.file}:${m.startLine}` : m.file;
    const name = m.name !== undefined ? ` — ${m.name}` : '';
    const sealed = renderSeal(rule.meta.seal, m.data);
    lines.push(`    ${m.value.toString().padStart(5)}  ${where}${name}`);
    lines.push(`           ${sealed}`);
  }
  if (measurements.length > top.length) {
    lines.push(`    ... and ${measurements.length - top.length} more`);
  }
  return lines;
}
