import { globby } from 'globby';
import * as path from 'node:path';

const DEFAULT_FILES = ['**/*.{ts,tsx,js,jsx,mjs,cjs}'];
const DEFAULT_IGNORE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/coverage/**',
  '**/.git/**',
];

export interface DiscoverOptions {
  cwd: string;
  files?: string[];
  ignore?: string[];
}

export async function discoverFiles(opts: DiscoverOptions): Promise<string[]> {
  const matched = await globby(opts.files ?? DEFAULT_FILES, {
    cwd: opts.cwd,
    gitignore: true,
    ignore: [...DEFAULT_IGNORE, ...(opts.ignore ?? [])],
    absolute: true,
  });
  return matched.map((p) => path.normalize(p));
}
