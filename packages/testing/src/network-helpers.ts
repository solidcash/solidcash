/**
 * @nomicfoundation/hardhat-network-helpers analogue for the SolidCash harness (HARDHAT-PARITY.md WS5/WS6).
 * These operate on an "active" test provider (a MockNetworkProvider) that the HRE sets; when none is set a
 * shared default one is created lazily so `import { loadFixture, time } from 'solidcash/network-helpers'` works
 * standalone. Snapshots are independent deep clones (via the mem-cash indexer), so restore is repeatable and,
 * unlike EVM, never invalidates other snapshots.
 */
import { MockNetworkProvider, type SnapshotRestorer } from 'solidcash';
import { randomUtxo } from 'solidcash';

/** The subset of provider capabilities the helpers require (MockNetworkProvider implements all of them). */
export interface TestNetworkProvider {
  takeSnapshot(): Promise<SnapshotRestorer>;
  getBlockHeight(): Promise<number>;
  getBlockTime(): number;
  setNextBlockTimestamp(ts: number | bigint): void;
  increaseTime(seconds: number | bigint): number;
  mine(count?: number): Promise<void>;
  mineUpTo(height: number): Promise<void>;
  addUtxo(addressOrLockingBytecode: string, utxo: { txid: string; vout: number; satoshis: bigint }): Promise<unknown>;
}

let activeProvider: TestNetworkProvider | undefined;

/** Point the network helpers at a specific test provider (the HRE calls this on init). */
export function setActiveProvider(provider: TestNetworkProvider): void {
  activeProvider = provider;
}

/** The active test provider, lazily defaulting to a fresh MockNetworkProvider. */
export function getActiveProvider(): TestNetworkProvider {
  if (!activeProvider) activeProvider = new MockNetworkProvider() as unknown as TestNetworkProvider;
  return activeProvider;
}

interface FixtureSnapshot<T> {
  fixture: () => Promise<T>;
  data: T;
  restorer: SnapshotRestorer;
  provider: TestNetworkProvider;
}

let snapshots: FixtureSnapshot<unknown>[] = [];

/**
 * hardhat `loadFixture`: run a NAMED fixture once and snapshot the chain; on later calls with the same function
 * reference, restore the snapshot and return the cached result instead of re-running. Reject anonymous fixtures
 * (the function identity is the cache key).
 */
export async function loadFixture<T>(fixture: () => Promise<T>): Promise<T> {
  if (typeof fixture !== 'function') throw new Error('loadFixture: fixture must be a function');
  if (fixture.name === '') {
    throw new Error('loadFixture: fixtures must be named functions (the function is the cache key)');
  }
  const existing = snapshots.find((s) => s.fixture === fixture) as FixtureSnapshot<T> | undefined;
  if (existing) {
    await existing.restorer.restore();
    return existing.data;
  }
  const data = await fixture();
  const provider = getActiveProvider();
  const restorer = await provider.takeSnapshot();
  snapshots.push({ fixture, data, restorer, provider } as FixtureSnapshot<unknown>);
  return data;
}

/** Drop all cached fixture snapshots (forces the next loadFixture to re-run). */
export function clearSnapshots(): void {
  snapshots = [];
}

/** hardhat-network-helpers `takeSnapshot`: capture a restorable snapshot of the active provider. */
export async function takeSnapshot(): Promise<SnapshotRestorer> {
  return getActiveProvider().takeSnapshot();
}

/** hardhat-network-helpers `mine(blocks?)`: advance the chain-tip height. */
export async function mine(blocks = 1): Promise<void> {
  await getActiveProvider().mine(blocks);
}

/** hardhat-network-helpers `mineUpTo(height)`. */
export async function mineUpTo(height: number | bigint): Promise<void> {
  await getActiveProvider().mineUpTo(Number(height));
}

/**
 * hardhat-network-helpers `time.duration.{seconds..years}` - seconds-count builders for time-travel. Exported as a
 * util too (WS10) so `duration.days(7)` works standalone in a ported suite.
 */
export const duration = {
  seconds: (n: number): number => n,
  minutes: (n: number): number => n * 60,
  hours: (n: number): number => n * 60 * 60,
  days: (n: number): number => n * 24 * 60 * 60,
  weeks: (n: number): number => n * 7 * 24 * 60 * 60,
  years: (n: number): number => n * 365 * 24 * 60 * 60,
};

/**
 * hardhat-network-helpers `time` sub-API. These control the mock chain's `block.timestamp` and `block.number`
 * (the Solidity/Hardhat time surface). Like Hardhat, `increase`/`increaseTo` MINE a block (advancing both height
 * and timestamp); a `block.*`-reading contract sees the new values after its BlockOracleUpdater syncs (drive it
 * from `mockBlockOracleRpc(provider)` - see oracle-helpers).
 */
export const time = {
  /** Latest block timestamp (unix seconds). */
  latest: async (): Promise<number> => getActiveProvider().getBlockTime(),
  /** Latest block height. */
  latestBlock: async (): Promise<number> => getActiveProvider().getBlockHeight(),
  /** Advance the timestamp by `seconds` immediately and mine a block (height + 1); returns the new timestamp. */
  increase: async (seconds: number | bigint): Promise<number> => {
    const p = getActiveProvider();
    const ts = p.increaseTime(seconds); // effective on the tip now, so block.* reads see it
    await p.mine(1);
    return ts;
  },
  /** Set the timestamp to an absolute value immediately and mine a block (unix seconds or a Date). */
  increaseTo: async (timestamp: number | bigint | Date): Promise<void> => {
    const p = getActiveProvider();
    const ts = timestamp instanceof Date ? Math.floor(timestamp.getTime() / 1000) : Number(timestamp);
    const delta = ts - p.getBlockTime();
    if (delta !== 0) p.increaseTime(delta); // effective now (Hardhat mines a block AT this timestamp)
    await p.mine(1);
  },
  /** Set the NEXT block's timestamp WITHOUT mining (unix seconds or a Date). */
  setNextBlockTimestamp: async (timestamp: number | bigint | Date): Promise<void> => {
    const ts = timestamp instanceof Date ? Math.floor(timestamp.getTime() / 1000) : Number(timestamp);
    getActiveProvider().setNextBlockTimestamp(ts);
  },
  duration,
};

/**
 * hardhat-network-helpers `setBalance` analogue. BCH is UTXO-based, so this is ADDITIVE (funds the address with
 * a fresh UTXO); it cannot subtract to an exact balance. Prefer `getSigners()` for pre-funded identities.
 */
export async function setBalance(address: string, satoshis: bigint | number): Promise<void> {
  await getActiveProvider().addUtxo(address, { ...randomUtxo(), satoshis: BigInt(satoshis) });
}

/** No BCH analogue - you hold keys, there is no account to impersonate. Throws with guidance. */
export function impersonateAccount(): never {
  throw new Error('impersonateAccount has no equivalent on Bitcoin Cash (UTXO). Use getSigners() or a SignatureTemplate.');
}

/** No BCH analogue. Throws with guidance. */
export function getImpersonatedSigner(): never {
  throw new Error('getImpersonatedSigner has no equivalent on Bitcoin Cash (UTXO). Use getSigners().');
}
