import type { SeloRulePack } from '../contract/index.js';

export interface RuleConfig {
  /** Long-term target value. Required for `threshold` rules; optional (default 0) for `count`. */
  goal?: number;
  /** Override the default 0.01 ratchet step for this rule. */
  step?: number;
  /** Project-relative paths the rule should silently skip. */
  exempt?: string[];
  /** Rule-specific options passed to `measure(file, options)`. */
  options?: unknown;
}

export interface SeloConfig {
  /** Rule packs to load. Engine concatenates their `rules` maps. */
  packs: SeloRulePack[];
  /** Per-rule configuration, keyed by `meta.id`. Only listed rules run. */
  rules: Record<string, RuleConfig>;
  /** Optional file globs (default: `**\/*.{ts,tsx,js,jsx,mjs,cjs}`). */
  files?: string[];
  /** Optional ignore globs (added to the built-in defaults). */
  ignore?: string[];
}
