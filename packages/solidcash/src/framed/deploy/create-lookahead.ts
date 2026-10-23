/**
 * Predicting the address of a contract another contract creates.
 *
 * `new C(...)` is a `CREATE` frame: the child's address is `addrV(category)`, and on this convention the category is
 * the txid of the genesis-eligible UTXO (an output at index 0) that the child's own genesis spends. So a parent's
 * code and its caller both need the child's address before that transaction is built, and the address exists only
 * once the funding UTXO exists. This module looks ahead: it reserves one genesis-eligible UTXO per child a caller
 * says it will create, and answers with the address the i-th reserved UTXO's category derives.
 *
 * A reservation holds the UTXO out of the SDK's genesis funding selection (see `genesis-reservations`), so a later
 * send cannot spend a coin whose future category an address was already derived from. The mapping is the one
 * `getCreateAddress({ from, nonce })` gives on EVM: nonce `n + i` is the i-th reserved UTXO, with `n` the signer's
 * nonce when the first reservation was made.
 */

import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { validatorAddress, type Artifact } from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc/runtime';
import type { Utxo } from '../../interfaces.js';
import type Signer from '../../Signer.js';
import { selectGenesisFundingUtxo, selectGenesisFundingUtxoForCost } from '../../stateful/ContractFactory.js';
import {
  genesisOutpointKey, releaseGenesisOutpoint, reserveGenesisOutpoint,
} from '../../stateful/genesis-reservations.js';
import { deployMaster } from './material.js';
import { ownCoinRefusal } from './own-coin.js';

/** Raised when a create address cannot be predicted from the UTXOs that are reserved. */
export class CreateAddressError extends Error {
  public readonly name = 'CreateAddressError';

  public constructor(message: string, options?: { readonly cause?: unknown }) {
    super(message, options);
  }
}

/** What a look-ahead needs: the account funding the creates, and the child master being predicted. */
export interface CreateLookaheadOptions {
  /** The account whose UTXOs become the children's categories, and whose nonce orders them. */
  readonly signer: Signer;
  /**
   * The child master the addresses are derived for, when one is known. A create address is `addrV(category)`, which
   * hashes the category and the shipped validator program and reads nothing from the artifact, so a caller that only
   * predicts addresses leaves this out; the look-ahead then selects the genesis-eligible UTXOs itself.
   */
  readonly artifact?: Artifact;
  /**
   * The validator program every address is derived under. Defaults to the shipped framed validator, which is what
   * the deployment path fills a master with, so a prediction and a deployment cannot disagree.
   */
  readonly validatorProgram?: Uint8Array;
}

/** The user documentation a caller is pointed at when too few UTXOs are reserved. */
const CREATION_DOC = 'packages/solidc/docs/contract-creation.md';

/** The smallest coin a look-ahead without an artifact funds a create from: a genesis carries a whole pool. */
const CREATE_FUNDING_FLOOR = 100_000n;

/**
 * A reservation of genesis-eligible UTXOs, one per child a caller will create.
 *
 * The look-ahead is opened once per account and kept for as long as addresses are predicted. `reserve` tops the
 * pool up to a wanted count; `getCreateAddress` answers for a nonce; `getFundingUtxo` hands back the UTXO a
 * deployment for that nonce must spend, so the child lands at the predicted address.
 */
export class CreateLookahead {
  private readonly signer: Signer;
  private readonly artifact?: Artifact;
  private readonly validatorProgram: Uint8Array;
  private readonly reserved: Utxo[] = [];
  private base?: number;

  private constructor(options: CreateLookaheadOptions) {
    this.signer = options.signer;
    this.artifact = options.artifact;
    this.validatorProgram = options.validatorProgram ?? framedValidator.buildValidatorProgram();
  }

  /** Opens a look-ahead over an account and a child master. */
  public static open(options: CreateLookaheadOptions): CreateLookahead {
    return new CreateLookahead(options);
  }

  /** The signer's nonce when the first reservation was made: the nonce the first reserved UTXO's create has. */
  public getBaseNonce(): number {
    if (this.base === undefined) {
      throw new CreateAddressError(
        `No creates are reserved for ${this.signer.getAddress()}, so no base nonce exists yet. `
        + `Reserve the genesis-eligible UTXOs first. See ${CREATION_DOC}.`,
      );
    }
    return this.base;
  }

  /** How many creates can be predicted right now. */
  public getReservedCount(): number {
    return this.reserved.length;
  }

  /** The reserved UTXOs, in nonce order, so a caller can fund the deployments itself. */
  public getReservedUtxos(): readonly Utxo[] {
    return this.reserved;
  }

  /**
   * Reserves at least `count` genesis-eligible UTXOs, one per create, and returns them in nonce order.
   *
   * A UTXO already reserved is not handed out again, and a UTXO the SDK selects is held out of later genesis funding
   * selection until `release`. The first call fixes the base nonce, so the nonces a caller predicts on stay stable
   * across top-ups.
   */
  public async reserve(count: number, options?: { readonly fanOut?: boolean }): Promise<readonly Utxo[]> {
    if (!Number.isInteger(count) || count < 1) {
      throw new CreateAddressError(`reserve a positive whole number of creates: got ${count}`);
    }
    if (this.base === undefined) this.base = Number(this.signer._getTransactionNonceState());
    while (this.reserved.length < count) {
      const utxo = await this.select(options?.fanOut !== false);
      // A predicted address is `addrV` of this coin's txid, so the coin is proven at the signer's own lock first.
      const refusal = await ownCoinRefusal(
        this.signer.provider, utxo, this.signer.getLockingBytecode(), { role: 'signer', tokenFree: true });
      if (refusal !== undefined) throw new CreateAddressError(refusal);
      reserveGenesisOutpoint(genesisOutpointKey(utxo.txid, utxo.vout));
      this.reserved.push(utxo);
    }
    return this.reserved;
  }

  /**
   * The address of the create at `nonce`: `addrV` of the i-th reserved UTXO's category, with `i = nonce - base`.
   *
   * The category is the reserved UTXO's txid, so the address is computed from the reservation and needs no
   * broadcast.
   */
  public getCreateAddress(nonce: bigint | number): Uint8Array {
    const index = this.indexFor(nonce);
    const category = new Uint8Array(hexToBin(this.reserved[index]!.txid));
    if (this.artifact === undefined) return validatorAddress(category, this.validatorProgram);
    return deployMaster(this.artifact, category, this.validatorProgram).address;
  }

  /** The reserved UTXO whose category is the create at `nonce`'s category. Deploy with it to land at the address. */
  public getFundingUtxo(nonce: bigint | number): Utxo {
    return this.reserved[this.indexFor(nonce)]!;
  }

  /** Releases every reservation, so the UTXOs become selectable again. */
  public release(): void {
    for (const utxo of this.reserved) releaseGenesisOutpoint(genesisOutpointKey(utxo.txid, utxo.vout));
    this.reserved.length = 0;
    this.base = undefined;
  }

  private async select(fanOut: boolean): Promise<Utxo> {
    const excluded = new Set(this.reserved.map((utxo) => genesisOutpointKey(utxo.txid, utxo.vout)));
    if (this.artifact === undefined) {
      // The coin a create is predicted from must be as fundable as any other genesis coin, so the selection — and
      // its fan-out — is the shipped one, sized by the floor a caller without an artifact can state.
      // A nonce read passes fanOut false so the read cannot sign a consolidation.
      try {
        return await selectGenesisFundingUtxoForCost(
          this.signer, CREATE_FUNDING_FLOOR, excluded, { fanOut },
        );
      } catch (cause) {
        throw this.insufficientFundingError(cause);
      }
    }
    try {
      return await selectGenesisFundingUtxo(this.signer, this.artifact, excluded, 1);
    } catch (cause) {
      throw this.insufficientFundingError(cause);
    }
  }

  private insufficientFundingError(cause?: unknown): CreateAddressError {
    const message = `Cannot reserve a genesis-eligible UTXO for contract creation at ${this.signer.getAddress()}: `
      + 'a creator needs one vout-0, token-free UTXO per child it will deploy. Fund the account with more such '
      + `UTXOs, or deploy fewer children. See ${CREATION_DOC}.`;
    return cause === undefined ? new CreateAddressError(message) : new CreateAddressError(message, { cause });
  }

  private indexFor(nonce: bigint | number): number {
    if (this.base === undefined) {
      throw new CreateAddressError(
        `No creates are reserved for ${this.signer.getAddress()}, so no address can be predicted. Reserve the `
        + `genesis-eligible UTXOs first. See ${CREATION_DOC}.`,
      );
    }
    const value = typeof nonce === 'bigint'
      ? nonce
      : (Number.isInteger(nonce) ? BigInt(nonce) : undefined);
    if (value === undefined) {
      throw new CreateAddressError(`a create nonce is a whole number: got ${String(nonce)}`);
    }
    const index = Number(value) - this.base;
    if (!Number.isInteger(index) || index < 0 || index >= this.reserved.length) {
      throw new CreateAddressError(
        `Cannot predict the address of create nonce ${value.toString()}: ${this.reserved.length} genesis-eligible `
        + `UTXO(s) are reserved (nonces ${this.base}..${this.base + this.reserved.length - 1}). Reserve one more `
        + `genesis-eligible UTXO per child before predicting its address. See ${CREATION_DOC}.`,
      );
    }
    return index;
  }
}
