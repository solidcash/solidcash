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
  /** Hash digest iterations allowed per density-control byte in the mock consensus VM. */
  hashDigestIterationsPerByte: number;
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
