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
  return {
    path: path.relative(projectRoot, absolutePath).replaceAll(path.sep, '/'),
    source,
    ast,
  };
}
