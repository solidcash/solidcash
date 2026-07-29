import { Utxo, Network } from '../interfaces.js';

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

  /** Optional provider-specific consensus limits. Omitted providers use BCH production limits. */
  consensusLimits?: ConsensusLimits;
  /** Optional relay-policy behavior. Omitted providers use production policy. */
  policy?: NetworkPolicy;

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
   * @returns The current block height.
   */
  getBlockHeight(): Promise<number>;

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
}
