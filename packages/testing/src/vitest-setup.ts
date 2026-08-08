/**
 * Vitest setupFile for SolidCash Hardhat-drop-in projects. Registers the chai/vitest matchers and loads the
 * project's solidcash.config.ts into the active HRE, so `import { ethers, config } from 'hardhat'` reflects it.
 * Referenced automatically by `solidcashHardhatPreset`; or add it manually: setupFiles: ['@solidcash/testing/vitest-setup'].
 */
import { beforeEach } from 'vitest';
import {
  takeDeploymentRegistrySnapshot, type DeploymentRegistrySnapshot, type SnapshotRestorer,
} from 'solidcash';
import './chai.js';
import { initHre } from './index.js';

const hre = await initHre(process.cwd());

const rawSelectors = process.env.SOLIDCASH_SNAPSHOT_BEFORE_EACH;
const selectors = (() => {
  if (!rawSelectors) return [] as string[];
  try {
    const parsed = JSON.parse(rawSelectors) as unknown;
    if (Array.isArray(parsed) && parsed.every((value) => typeof value === 'string')) return parsed;
  } catch { /* accept a single literal selector */ }
  return [rawSelectors];
})();
const globToRegExp = (glob: string): RegExp => {
  let source = '';
  for (let index = 0; index < glob.length; index++) {
    const char = glob[index];
    if (char === '*') {
      if (glob[index + 1] === '*') { source += '.*'; index++; } else source += '[^/]*';
    } else if (char === '?') source += '[^/]';
    else source += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
  }
  return new RegExp(source);
};
const fixtureSelectors = selectors.map((selector) => globToRegExp(selector.replaceAll('\\', '/')));
let fixtureHookRegistered = false;
let chainSnapshot: SnapshotRestorer | undefined;
let registrySnapshot: DeploymentRegistrySnapshot | undefined;
const globals = globalThis as Record<string, unknown>;

globals.beforeEach = (fn: () => unknown, timeout?: number): unknown => {
  const stack = new Error().stack?.replaceAll('\\', '/') ?? '';
  const selected = fixtureSelectors.some((selector) => selector.test(stack));
  if (fixtureHookRegistered || !selected) return beforeEach(fn, timeout);
  fixtureHookRegistered = true;
  return beforeEach(async () => {
    if (chainSnapshot) {
      await chainSnapshot.restore();
      registrySnapshot?.restore();
      return;
    }
    await fn();
    const provider = hre.ethers?.provider as { takeSnapshot?: () => Promise<SnapshotRestorer> } | undefined;
    if (!provider?.takeSnapshot) throw new Error('Snapshot beforeEach requires a snapshot-capable provider');
    chainSnapshot = await provider.takeSnapshot();
    registrySnapshot = takeDeploymentRegistrySnapshot(provider as never);
  }, timeout);
};
