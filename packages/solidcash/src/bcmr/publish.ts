/**
 * Updating a published identity (docs/bcmr/DESIGN.md, 5.4).
 *
 * An update spends the current identity output, recreates output 0 under the same policy or a new one, and puts the
 * new publication at output 1, so the transaction becomes the identity's authhead. Under `authguard` the AuthKey
 * rides at input 1, where AuthGuard looks for it, and goes back to its holder.
 */

import type { MetadataRegistry } from '@bitauth/libauth/build/lib/engine/types/bcmr-types.js';
import type { Output, TransactionDetails, Unlocker, Utxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { satoshisAtLeastDust } from '../framed/composer/dust.js';
import { ownCoinRefusal, servedTransaction } from '../framed/deploy/own-coin.js';
import { genesisOutpointKey, reserveGenesisOutpoint } from '../stateful/genesis-reservations.js';
import { publicationOf } from './authchain.js';
import type { PublishedRegistry } from './deployment.js';
import {
  authGuardLockingBytecode, authGuardUnlocker, identityOutput, lockOf, type IdentityRecord,
} from './identity.js';
import {
  BcmrError, dataCarrierBytes, ipfsCidV1Raw, publicationOutput,
} from './publication.js';
import { encodeRegistry } from './registry.js';

/** How the identity output being spent is held, with what spends it. */
export type CurrentIdentity =
  | { readonly kind: 'key'; readonly unlocker: Unlocker }
  | {
    readonly kind: 'authguard';
    readonly authKeyCategory: string;
    /** The AuthKey UTXO, an immutable NFT of `authKeyCategory`, and what unlocks it. */
    readonly authKey: Utxo;
    readonly authKeyUnlocker: Unlocker;
    /** Where the AuthKey goes back to; its current lock when omitted. */
    readonly authKeyRecipient?: Uint8Array | string;
  };

/** How output 0 is held after the update. */
export type NextIdentity =
  | { readonly kind: 'key'; readonly lockingBytecode: Uint8Array | string }
  | { readonly kind: 'authguard' }
  | { readonly kind: 'frozen' }
  | { readonly kind: 'burned' };

export interface PublishMetadataOptions {
  readonly provider: NetworkProvider;
  /** The identity output the update spends: output 0 of the current authhead. */
  readonly identity: Utxo;
  readonly current: CurrentIdentity;
  /**
   * The registry to publish. An update without one re-publishes the publication of the authhead it spends, so the
   * identity keeps its registry (R2) and a key-held output 0 stays recognisable as an identity output (4.4); a
   * key-held update needs one when that authhead publishes nothing.
   */
  readonly registry?: MetadataRegistry;
  /** The URIs the publication offers; `ipfs://<CIDv1 of the registry>` when omitted. */
  readonly publicationUris?: readonly string[];
  /** How output 0 is held afterwards; unchanged when omitted. */
  readonly next?: NextIdentity;
  /** The coin paying the fee, and its unlocker. */
  readonly feeFunding: { readonly utxo: Utxo; readonly unlocker: Unlocker };
  readonly changeAddress: string;
}

export interface PublishMetadataResult {
  readonly tx: TransactionDetails;
  readonly identity: IdentityRecord;
  readonly registry?: PublishedRegistry;
}

function nextOf(current: CurrentIdentity, identity: Utxo, next: NextIdentity | undefined): NextIdentity {
  if (next !== undefined) return next;
  if (current.kind === 'authguard') return { kind: 'authguard' };
  const lock = current.unlocker.generateLockingBytecode();
  if (lock.length === 0) throw new BcmrError(`identity output ${identity.txid}:${identity.vout} has no lock to keep`);
  return { kind: 'key', lockingBytecode: lock };
}

/** The publication output of the authhead `txid`, or undefined when it has none or its transaction is not served. */
async function currentPublication(provider: NetworkProvider, txid: string): Promise<Uint8Array | undefined> {
  const transaction = await servedTransaction(provider, txid.toLowerCase());
  return typeof transaction === 'object' ? publicationOf(transaction) : undefined;
}

/** Spends an identity output to publish a new registry, or to move, freeze or burn the identity. */
export async function publishMetadata(options: PublishMetadataOptions): Promise<PublishMetadataResult> {
  const { current, identity } = options;
  if (identity.vout !== 0) throw new BcmrError(`an identity output is output 0, got ${identity.txid}:${identity.vout}`);
  if (identity.token !== undefined) throw new BcmrError('an identity output this SDK spends carries no token');
  const next = nextOf(current, identity, options.next);
  if (next.kind === 'burned' && options.registry !== undefined) {
    throw new BcmrError('a burned identity publishes nothing: publish first, then burn');
  }
  const feeRefusal = await ownCoinRefusal(
    options.provider, options.feeFunding.utxo, options.feeFunding.unlocker.generateLockingBytecode(),
    { role: 'fee payer' },
  );
  if (feeRefusal !== undefined) throw new BcmrError(feeRefusal);

  let nextOutput: Output;
  if (next.kind === 'authguard') {
    if (current.kind !== 'authguard') {
      throw new BcmrError('moving an identity into AuthGuard needs an AuthKey category: deploy with the authguard policy');
    }
    const to = authGuardLockingBytecode(current.authKeyCategory);
    nextOutput = { to, amount: satoshisAtLeastDust(identity.satoshis, { to }) };
  } else {
    nextOutput = identityOutput(next.kind, next.kind === 'key' ? lockOf(next.lockingBytecode) : new Uint8Array(0));
  }

  const encoded = options.registry === undefined ? undefined : await encodeRegistry(options.registry);
  const published: PublishedRegistry | undefined = encoded === undefined ? undefined : {
    ...encoded, uris: options.publicationUris ?? [`ipfs://${ipfsCidV1Raw(encoded.bytes)}`],
  };
  // A key-held output 0 of a transaction that neither creates a category nor publishes reads as a plain coin.
  const carried = published !== undefined || next.kind === 'burned'
    ? undefined : await currentPublication(options.provider, identity.txid);
  if (published === undefined && carried === undefined && next.kind === 'key') {
    throw new BcmrError(`identity output ${identity.txid}:0 has no publication to carry over, and a key-held `
      + 'update without one would leave output 0 an ordinary coin: pass the registry to publish');
  }

  const { TransactionBuilder } = await import('../TransactionBuilder.js');
  const builder = new TransactionBuilder({ provider: options.provider });
  if (current.kind === 'authguard') {
    // AuthGuard reads the AuthKey at input 1 and requires its own recreation at output 0 to keep the guard.
    builder.addInput(identity, authGuardUnlocker(current.authKeyCategory, next.kind === 'authguard'));
    builder.addInput(current.authKey, current.authKeyUnlocker);
  } else {
    builder.addInput(identity, current.unlocker);
  }
  builder.addInput(options.feeFunding.utxo, options.feeFunding.unlocker);

  builder.addOutput(nextOutput);
  if (published !== undefined) {
    builder.addOutput(publicationOutput(
      published.sha256, published.uris, dataCarrierBytes(nextOutput.to as Uint8Array),
    ));
  } else if (carried !== undefined) {
    builder.addOutput({ to: carried, amount: 0n });
  }
  if (current.kind === 'authguard') {
    const recipient = current.authKeyRecipient === undefined
      ? current.authKeyUnlocker.generateLockingBytecode() : lockOf(current.authKeyRecipient);
    builder.addOutput({ to: recipient, amount: current.authKey.satoshis, token: current.authKey.token });
  }

  const { encodeTransaction } = await import('@bitauth/libauth/build/lib/message/transaction-encoding.js');
  const inputTotal = builder.inputs.reduce((sum, input) => sum + input.satoshis, 0n);
  builder.addOutput({ to: options.changeAddress, amount: 1000n });
  const fee = BigInt(encodeTransaction(builder.buildLibauthTransaction(true)).byteLength) + 300n;
  const change = inputTotal - builder.outputs.slice(0, -1).reduce((sum, output) => sum + output.amount, 0n) - fee;
  if (change < satoshisAtLeastDust(0n, { to: options.changeAddress })) {
    throw new BcmrError(`the fee coin cannot pay a ${fee}-satoshi fee and its change: fund it with more`);
  }
  builder.outputs[builder.outputs.length - 1] = { ...builder.outputs[builder.outputs.length - 1]!, amount: change };

  const tx = await builder.send();
  const lockingBytecode = nextOutput.to as Uint8Array;
  if (next.kind === 'key') reserveGenesisOutpoint(genesisOutpointKey(tx.txid, 0));
  return {
    tx,
    identity: {
      txid: tx.txid,
      vout: 0,
      satoshis: nextOutput.amount,
      policy: next.kind,
      lockingBytecode,
      ...(current.kind === 'authguard' && next.kind === 'authguard' ? { authKeyCategory: current.authKeyCategory } : {}),
    },
    ...(published === undefined ? {} : { registry: published }),
  };
}
