import {
  getActiveHre, hardhatCompatConfig,
  type HardhatNetwork, type HardhatRuntimeEnvironment, type SolidcashEthers,
} from '@solidcash/testing/hre';

export function lazy<T extends object>(pick: (hre: HardhatRuntimeEnvironment) => T): T {
  return new Proxy({} as T, {
    get: (_target, property) => (pick(getActiveHre()) as any)[property],
    has: (_target, property) => property in pick(getActiveHre()),
  });
}

export const hre = lazy<HardhatRuntimeEnvironment>((active) => active);
export const ethers = lazy<SolidcashEthers>((active) => active.ethers);
export const network = lazy<HardhatNetwork>((active) => active.network);
export const config = lazy<Record<string, unknown>>((active) => hardhatCompatConfig(active.config));
export const run = (name: string, args?: Record<string, unknown>): Promise<unknown> => getActiveHre().run(name, args);

export type { HardhatNetwork, HardhatRuntimeEnvironment, SolidcashEthers } from '@solidcash/testing/hre';
