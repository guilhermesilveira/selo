import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SeloConfig } from './types.js';

const CANDIDATES = [
  'selo.config.mjs',
  'selo.config.js',
  'selo.config.ts',
  'selo.config.json',
];

export async function findConfigFile(cwd: string): Promise<string | null> {
  for (const name of CANDIDATES) {
    const p = path.join(cwd, name);
    try {
      await fs.access(p);
      return p;
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function loadConfig(configPath: string): Promise<SeloConfig> {
  const ext = path.extname(configPath);
  if (ext === '.json') {
    const raw = await fs.readFile(configPath, 'utf8');
    return JSON.parse(raw) as SeloConfig;
  }
  const url = pathToFileURL(configPath).href;
  const mod = (await import(url)) as { default?: unknown };
  if (!mod.default) {
    throw new Error(`selo: ${configPath} must export a default config object.`);
  }
  return mod.default as SeloConfig;
}
