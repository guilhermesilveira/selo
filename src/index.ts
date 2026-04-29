/**
 * Public package entry. Rule-pack authors import the contract types from
 * here (or from `@guilhermesilveira/selo/contract` directly) and export a
 * `SeloRulePack` for the engine to consume.
 */
export type {
  SeloFile,
  SeloMeasurement,
  SeloRule,
  SeloRuleMeta,
  SeloRulePack,
  SeloRuleType,
} from './contract/index.js';

export { renderSeal } from './contract/index.js';
