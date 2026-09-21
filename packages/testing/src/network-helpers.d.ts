/**
 * @nomicfoundation/hardhat-network-helpers analogue for the SolidCash harness (HARDHAT-PARITY.md WS5/WS6).
 * These operate on an "active" test provider (a MockNetworkProvider) that the HRE sets; when none is set a
 * shared default one is created lazily so `import { loadFixture, time } from 'solidcash/network-helpers'` works
 * standalone. Snapshots are independent deep clones (via the mem-cash indexer), so restore is repeatable and,
 * unlike EVM, never invalidates other snapshots.
 */
import { type SnapshotRestorer } from 'solidcash';
/** The subset of provider capabilities the helpers require (MockNetworkProvider implements all of them). */
export interface TestNetworkProvider {
    takeSnapshot(): Promise<SnapshotRestorer>;
    getBlockHeight(): Promise<number>;
    getBlockTime(): number;
    setNextBlockTimestamp(ts: number | bigint): void;
    increaseTime(seconds: number | bigint): number;
    mine(count?: number): Promise<void>;
    mineUpTo(height: number): Promise<void>;
    addUtxo(addressOrLockingBytecode: string, utxo: {
        txid: string;
        vout: number;
        satoshis: bigint;
    }): Promise<unknown>;
}
/** Point the network helpers at a specific test provider (the HRE calls this on init). */
export declare function setActiveProvider(provider: TestNetworkProvider): void;
/** The active test provider, lazily defaulting to a fresh MockNetworkProvider. */
export declare function getActiveProvider(): TestNetworkProvider;
/**
 * hardhat `loadFixture`: run a NAMED fixture once and snapshot the chain; on later calls with the same function
 * reference, restore the snapshot and return the cached result instead of re-running. Reject anonymous fixtures
 * (the function identity is the cache key).
 */
export declare function loadFixture<T>(fixture: () => Promise<T>): Promise<T>;
/** Drop all cached fixture snapshots (forces the next loadFixture to re-run). */
export declare function clearSnapshots(): void;
/** hardhat-network-helpers `takeSnapshot`: capture a restorable snapshot of the active provider. */
export declare function takeSnapshot(): Promise<SnapshotRestorer>;
/** hardhat-network-helpers `mine(blocks?)`: advance the chain-tip height. */
export declare function mine(blocks?: number): Promise<void>;
/** hardhat-network-helpers `mineUpTo(height)`. */
export declare function mineUpTo(height: number | bigint): Promise<void>;
/**
 * hardhat-network-helpers `time.duration.{seconds..years}` - seconds-count builders for time-travel. Exported as a
 * util too (WS10) so `duration.days(7)` works standalone in a ported suite.
 */
export declare const duration: {
    seconds: (n: number) => number;
    minutes: (n: number) => number;
    hours: (n: number) => number;
    days: (n: number) => number;
    weeks: (n: number) => number;
    years: (n: number) => number;
};
/**
 * hardhat-network-helpers `time` sub-API. These control the mock chain's `block.timestamp` and `block.number`
 * (the Solidity/Hardhat time surface). Like Hardhat, `increase`/`increaseTo` MINE a block (advancing both height
 * and timestamp); a `block.*`-reading contract sees the new values after its BlockOracleUpdater syncs (drive it
 * from `mockBlockOracleRpc(provider)` - see oracle-helpers).
 */
export declare const time: {
    /** Latest block timestamp (unix seconds). */
    latest: () => Promise<number>;
    /** Latest block height. */
    latestBlock: () => Promise<number>;
    /** Advance the timestamp by `seconds` immediately and mine a block (height + 1); returns the new timestamp. */
    increase: (seconds: number | bigint) => Promise<number>;
    /** Set the timestamp to an absolute value immediately and mine a block (unix seconds or a Date). */
    increaseTo: (timestamp: number | bigint | Date) => Promise<void>;
    /** Set the NEXT block's timestamp WITHOUT mining (unix seconds or a Date). */
    setNextBlockTimestamp: (timestamp: number | bigint | Date) => Promise<void>;
    duration: {
        seconds: (n: number) => number;
        minutes: (n: number) => number;
        hours: (n: number) => number;
        days: (n: number) => number;
        weeks: (n: number) => number;
        years: (n: number) => number;
    };
};
/**
 * hardhat-network-helpers `setBalance` analogue. BCH is UTXO-based, so this is ADDITIVE (funds the address with
 * a fresh UTXO); it cannot subtract to an exact balance. Prefer `getSigners()` for pre-funded identities.
 */
export declare function setBalance(address: string, satoshis: bigint | number): Promise<void>;
/** No BCH analogue - you hold keys, there is no account to impersonate. Throws with guidance. */
export declare function impersonateAccount(): never;
/** No BCH analogue. Throws with guidance. */
export declare function getImpersonatedSigner(): never;
