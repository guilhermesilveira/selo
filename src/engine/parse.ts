import { parse as tsParse } from '@typescript-eslint/parser';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { SeloFile } from '../contract/index.js';

export async function parseFile(absolutePath: string, projectRoot: string): Promise<SeloFile | null> {
  const source = await fs.readFile(absolutePath, 'utf8');
  const isJsx = absolutePath.endsWith('.tsx') || absolutePath.endsWith('.jsx');
  let ast: unknown;
  try {
    ast = tsParse(source, {
      loc: true,
      range: true,
      comment: true,
      jsx: isJsx,
      ecmaVersion: 'latest',
      sourceType: 'module',
    });
  } catch {
    return null;
  }
  setParents(ast, null);
  return {
    path: path.relative(projectRoot, absolutePath).replaceAll(path.sep, '/'),
    source,
    ast,
  };
}

/**
 * @typescript-eslint/parser does not attach `parent` references by default.
 * Rule authors very often need them (to find a function's enclosing class,
 * etc.), so we walk the AST once after parsing and set them.
 *
 * The walker skips `parent`, `loc`, and `range` keys to avoid cycles and
 * irrelevant traversal.
 */
function setParents(node: unknown, parent: unknown): void {
  if (Array.isArray(node)) {
    for (const c of node) setParents(c, parent);
    return;
  }
  if (!node || typeof node !== 'object') return;
  (node as { parent?: unknown }).parent = parent;
  const obj = node as Record<string, unknown>;
  for (const k of Object.keys(obj)) {
    if (k === 'parent' || k === 'loc' || k === 'range') continue;
    setParents(obj[k], node);
  }
}
