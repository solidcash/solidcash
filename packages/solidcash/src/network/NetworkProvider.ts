import type { Transaction as LibauthTransaction } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2023/bch-2023-types.js';
import { type TokenDetails, type Utxo, Network } from '../interfaces.js';

/** Exact transaction forms already materialized by an SDK builder. */
export interface PreparedTransaction {
  rawHex: string;
  rawBytes: Uint8Array;
  transaction: LibauthTransaction;
}

export interface ConsensusLimits {
  /** Maximum serialized unlocking/locking bytecode for one input script. */
  maximumInputBytes: number;
  /** Maximum VM stack item size (the P2SH redeem script is pushed as one item). */
  maximumStackItemBytes: number;
  /** Maximum serialized transaction size. */
  maximumTransactionBytes: number;
  maximumNftCommitmentBytes: number;
  /** Operation-cost units allowed per density-control byte. */
  operationCostBudgetPerByte: number;
  /**
   * Hash digest iterations allowed per density-control byte. BCH-2026 prices this differently in the two
   * regimes - standard relay policy allows 0.5 per byte, consensus allows 3.5 - so one value cannot express
   * both. This field is the shared fallback used when the regime-specific field below is not set; existing
   * profiles that set only this keep their previous behaviour exactly.
   */
  hashDigestIterationsPerByte: number;
  /**
   * Standard (relay policy) hash-iteration allowance. Real BCH-2026 value: 0.5.
   *
   * Both regime fields reach the VM. `createVirtualMachineBch2026ForProvider` takes any number, but
   * MockNetworkProvider forwards them to mem-cash, which rejects non-integers - so the real 0.5 and 3.5 are
   * usable for VM probes and envelope reads, and throw if set on that provider.
   */
  hashDigestIterationsPerByteStandard?: number;
  /** Nonstandard (consensus) hash-iteration allowance. Real BCH-2026 value: 3.5. See the note above. */
  hashDigestIterationsPerByteNonstandard?: number;
  /**
   * The most satoshis one output, or a transaction's inputs together, may hold. Real BCH value: 21 million coins
   * (`MAX_MONEY`), which applies when this is absent; a development network may raise it to carry larger values.
   */
  maximumMoney?: bigint;
}

/** A live output as an in-process simulator's own ledger holds it. */
export interface LedgerOutput {
  readonly lockingBytecode: Uint8Array;
  readonly satoshis: bigint;
  readonly token?: TokenDetails;
}

export interface NetworkPolicy {
  /** Apply node relay dust thresholds when constructing and validating outputs. */
  enforceDust: boolean;
}

export default interface NetworkProvider {
  /**
   * Variable indicating the network that this provider connects to.
   */
  network: Network;

  /**
   * Category of the provider's default oracle pool, hex in display byte order. `undefined` is spelled out so a
   * provider may expose it through a getter that can return no pool (as MockNetworkProvider does) and still be a
   * NetworkProvider for consumers compiling with `exactOptionalPropertyTypes`.
   */
  readonly oraclePoolCategory?: string | undefined;

  /**
   * Simulators and devnets: the key their own oracle pools name, its P2PKH funded. A pool a deployment creates
   * names it and is paid by it unless the deployment passes `ownerKey`.
   */
  readonly oraclePoolOwnerKey?: Uint8Array;

  /**
   * Simulators: keeps pool `category`, owned by `oraclePoolOwnerKey`, current after each block, as the provider keeps
   * its own. `createOraclePool` calls it for every pool that key owns.
   */
  keepOraclePool?(category: string): void;

  /** Optional provider-specific consensus limits. Omitted providers use BCH production limits. */
  consensusLimits?: ConsensusLimits;
  /** Optional relay-policy behavior. Omitted providers use production policy. */
  policy?: NetworkPolicy;
  /**
   * True for an in-process simulator (MockNetworkProvider). The SDK then evaluates on its fast VM paths, which
   * enforce `consensusLimits` as libauth's own paths do; live providers omit it and keep libauth's paths.
   */
  readonly simulator?: boolean;

  /**
   * Optional: the source each framed call orders a deployment's pools with (`PoolOrder`), of `Math.random`'s shape.
   * Omitted providers use `Math.random`, so independent callers rarely spend the same master, validator or facet.
   */
  poolRandom?: () => number;

  /**
   * Retrieve all UTXOs (confirmed and unconfirmed) for a given address.
   * @param address The CashAddress for which we wish to retrieve UTXOs.
   * @returns List of UTXOs spendable by the provided address.
   */
  getUtxos(address: string): Promise<Utxo[]>;

  /**
   * Retrieve all UTXOs (confirmed and unconfirmed) for a given locking bytecode.
   * @param lockingBytecode The locking bytecode for which we wish to retrieve UTXOs.
   * @returns List of UTXOs spendable by the provided locking bytecode.
   */
  getUtxosForLockingBytecode(lockingBytecode: Uint8Array | string): Promise<Utxo[]>;

  /**
   * Optional: every live UTXO whose CashToken category is `categoryId` (either
   * byte order). Used to find a CREATE identity NFT that no longer sits at the
   * contract's cashaddr.
   */
  getUtxosByTokenCategory?(categoryId: string): Promise<Utxo[]>;

  /**
   * @returns The current block height.
   */
  getBlockHeight(): Promise<number>;

  /**
   * The tip's median time past, in unix seconds, for a constructor that reads `block.timestamp`. Consensus requires a
   * time-type locktime to be strictly below this value (BCH's `LOCKTIME_MEDIAN_TIME_PAST`).
   */
  getMedianTimePast(): Promise<number>;

  /**
   * Retrieve the Hex transaction details for a given transaction ID.
   * @param txid Hex transaction ID.
   * @throws {Error} If the transaction does not exist
   * @returns The full hex transaction for the provided transaction ID.
   */
  getRawTransaction(txid: string): Promise<string>;

  /**
   * Broadcast a raw hex transaction to the Bitcoin Cash network.
   * @param txHex The raw transaction hex to be broadcast.
   * @throws {Error} If the transaction was not accepted by the network.
   * @returns The transaction ID corresponding to the broadcast transaction.
   */
  sendRawTransaction(txHex: string): Promise<string>;

  /**
   * Optional in-process fast path. Implementations must apply the same validation and acceptance semantics as
   * `sendRawTransaction`; the extra forms only avoid decoding bytes the builder has just encoded.
   */
  sendPreparedTransaction?(prepared: PreparedTransaction): Promise<string>;

  /**
   * Optional, in-process simulators only: the live output at `txid:vout` as the simulator's own ledger holds it. A
   * simulator's coins need no transaction behind them, so a coin proven from its transaction falls back to this; a
   * provider with a remote party behind it must not implement it.
   */
  getLedgerOutput?(txid: string, vout: number): Promise<LedgerOutput | undefined>;

  /**
   * Optional hook awaited before a deploy-site CREATE reservation and by `Signer.getNonce()`.
   *
   * A remote provider uses it to seed the logical transaction nonce from the shared chain, so two processes deploying
   * from one account do not anchor two contracts at the same logical address.
   */
  prepareSigner?(signer: import('../Signer.js').default): Promise<void>;
}
