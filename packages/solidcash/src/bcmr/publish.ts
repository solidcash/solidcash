/**
 * The owner's spends of an identity (docs/bcmr/DESIGN.md, 5.4).
 *
 * Each spends the authhead contract at input 0 beside a token-free coin at the owner's lock at input 1, the only two
 * inputs the contract admits; the coin authorizes the spend and pays its fee. Output 0 is the contract again (an
 * update, or a transfer to a new owner), the frozen lock, or `OP_RETURN` (a burn). The publication follows at output
 * 1, so the transaction becomes the identity's authhead; without a new registry the spent authhead's publication
 * carries over.
 */

import type { MetadataRegistry } from '@bitauth/libauth/build/lib/engine/types/bcmr-types.js';
import type { TransactionDetails, Unlocker, Utxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { satoshisAtLeastDust } from '../framed/composer/dust.js';
import { identityCoinRefusal, ownCoinRefusal, servedTransaction } from '../framed/deploy/own-coin.js';
import { publicationOf } from './authchain.js';
import {
  authheadLockingBytecode, authheadOutput, authheadToken, authheadUnlocker, ownerLockRefusal, type IdentityStatus,
} from './authhead.js';
import type { PublishedRegistry } from './deployment.js';
import { lockOf, type IdentityRecord } from './identity.js';
import {
  BcmrError, dataCarrierBytes, ipfsCidV1Raw, publicationOutput,
} from './publication.js';
import { encodeRegistry } from './registry.js';

/** What an owner's spend does to the identity. */
export type IdentityAction =
  /** Keeps the owner: publishes a registry, or carries the current one over. */
  | { readonly kind: 'update' }
  /** Hands the identity to `owner`, a P2PKH, P2SH20 or P2SH32 lock. */
  | { readonly kind: 'transfer'; readonly owner: Uint8Array | string }
  /** Freezes it: the transaction stays the authhead for good, so its registry is final. */
  | { readonly kind: 'freeze' }
  /** Burns it: the identity ends, and clients archive it. */
  | { readonly kind: 'burn' };

export interface PublishMetadataOptions {
  readonly provider: NetworkProvider;
  /** The active identity to spend, as a deployment, an earlier spend or `resolveIdentity` returned it. */
  readonly identity: IdentityRecord;
  /** A token-free coin at the owner's lock, which authorizes the spend and pays its fee, and its unlocker. */
  readonly owner: { readonly utxo: Utxo; readonly unlocker: Unlocker };
  /**
   * The registry to publish. Without one the spent authhead's publication carries over, so the identity keeps its
   * registry (R2); an update needs one when there is nothing to carry over, and a burn publishes nothing.
   */
  readonly registry?: MetadataRegistry;
  /** The URIs the publication offers; `ipfs://<CIDv1 of the registry>` when omitted. */
  readonly publicationUris?: readonly string[];
  /** What the spend does; an update when omitted. */
  readonly action?: IdentityAction;
  readonly changeAddress: string;
}

export interface PublishMetadataResult {
  readonly tx: TransactionDetails;
  readonly identity: IdentityRecord;
  readonly registry?: PublishedRegistry;
}

function equal(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((byte, i) => byte === right[i]);
}

const STATUS_AFTER: Record<IdentityAction['kind'], IdentityStatus> = {
  update: 'active', transfer: 'active', freeze: 'frozen', burn: 'burned',
};

/** The publication output of the authhead `txid`, null when it publishes nothing, or why it cannot be read. */
async function currentPublication(provider: NetworkProvider, txid: string): Promise<Uint8Array | null | string> {
  const transaction = await servedTransaction(provider, txid.toLowerCase());
  if (transaction === undefined) return 'the provider does not serve its transaction';
  if (typeof transaction === 'string') return transaction;
  return publicationOf(transaction) ?? null;
}

/** Spends an identity as its owner: publishes a registry, transfers, freezes or burns it. */
export async function publishMetadata(options: PublishMetadataOptions): Promise<PublishMetadataResult> {
  const { identity, owner } = options;
  const action = options.action ?? { kind: 'update' };
  const category = identity.category.toLowerCase();
  if (identity.status !== 'active') throw new BcmrError(`the identity of ${category} is ${identity.status}`);
  if (!equal(identity.lockingBytecode, authheadLockingBytecode(category))) {
    throw new BcmrError(`identity output ${identity.txid}:0 is not at the authhead contract of ${category}`);
  }
  const ownerLock = owner.unlocker.generateLockingBytecode();
  if (!equal(ownerLock, identity.owner)) {
    throw new BcmrError('the owner coin\'s unlocker is not at the identity\'s owner lock');
  }
  if (owner.utxo.token !== undefined) throw new BcmrError('the owner coin carries tokens: pass a token-free coin');
  // Another identity's output 0 at the owner's lock would hand that identity to this spend's output 0.
  const ownerRefusal = await ownCoinRefusal(options.provider, owner.utxo, ownerLock, { role: 'identity owner' })
    ?? await identityCoinRefusal(options.provider, owner.utxo);
  if (ownerRefusal !== undefined) throw new BcmrError(ownerRefusal);
  const nextOwner = action.kind === 'transfer' ? lockOf(action.owner) : identity.owner;
  const refusal = ownerLockRefusal(category, nextOwner);
  if (refusal !== undefined) throw new BcmrError(refusal);
  if (action.kind === 'burn' && options.registry !== undefined) {
    throw new BcmrError('a burned identity publishes nothing: publish first, then burn');
  }

  const encoded = options.registry === undefined ? undefined : await encodeRegistry(options.registry);
  const published: PublishedRegistry | undefined = encoded === undefined ? undefined : {
    ...encoded, uris: options.publicationUris ?? [`ipfs://${ipfsCidV1Raw(encoded.bytes)}`],
  };
  const carried = published !== undefined || action.kind === 'burn'
    ? null : await currentPublication(options.provider, identity.txid);
  if (typeof carried === 'string') {
    throw new BcmrError(`identity output ${identity.txid}:0 has no publication to carry over that the SDK can read `
      + `(${carried}): pass the registry to publish`);
  }
  if (action.kind === 'update' && published === undefined && carried === null) {
    throw new BcmrError(`identity output ${identity.txid}:0 publishes nothing to carry over: pass the registry`);
  }

  const status = STATUS_AFTER[action.kind];
  const next = authheadOutput(category, nextOwner, status, identity.satoshis);
  const { TransactionBuilder } = await import('../TransactionBuilder.js');
  const builder = new TransactionBuilder({ provider: options.provider });
  builder.addInput(
    { txid: identity.txid, vout: 0, satoshis: identity.satoshis, token: authheadToken(category, identity.owner) },
    authheadUnlocker(category),
  );
  builder.addInput(owner.utxo, owner.unlocker);
  builder.addOutput(next);
  if (published !== undefined) {
    builder.addOutput(publicationOutput(published.sha256, published.uris, dataCarrierBytes(next.to as Uint8Array)));
  } else if (carried !== null) {
    builder.addOutput({ to: carried, amount: 0n });
  }

  const { encodeTransaction } = await import('@bitauth/libauth/build/lib/message/transaction-encoding.js');
  const inputTotal = builder.inputs.reduce((sum, input) => sum + input.satoshis, 0n);
  builder.addOutput({ to: options.changeAddress, amount: 1000n });
  const fee = BigInt(encodeTransaction(builder.buildLibauthTransaction(true)).byteLength) + 300n;
  const change = inputTotal - builder.outputs.slice(0, -1).reduce((sum, output) => sum + output.amount, 0n) - fee;
  if (change < satoshisAtLeastDust(0n, { to: options.changeAddress })) {
    throw new BcmrError(`the owner coin cannot pay a ${fee}-satoshi fee and its change: fund it with more`);
  }
  builder.outputs[builder.outputs.length - 1] = { ...builder.outputs[builder.outputs.length - 1]!, amount: change };

  const tx = await builder.send();
  return {
    tx,
    identity: {
      txid: tx.txid,
      vout: 0,
      satoshis: next.amount,
      category,
      status,
      lockingBytecode: next.to as Uint8Array,
      owner: nextOwner,
    },
    ...(published === undefined ? {} : { registry: published }),
  };
}
