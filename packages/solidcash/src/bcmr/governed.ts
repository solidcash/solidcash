/**
 * Contract-governed metadata (docs/bcmr/DESIGN.md, section 9): the contract's own access control decides its BCMR
 * registry, as `onlyOwner` guards `contractURI` under ERC-7572.
 *
 * The identity output sits under a guard keyed to the contract's category and the lock of its
 * `MetadataUpdated(bytes32 registryHash, bytes32 identityTxid)` event. Only the contract's code mints that event's
 * NFTs, so the function that emits it, with whatever access control the contract puts on it, authorizes an update.
 * Output 0 of every call is the contract's own, so the authorization and the update cannot share a transaction: the
 * update spends the event NFT once it may be spent, 144 blocks after its emit, which also announces each change a day
 * ahead. The guard spends only when:
 *
 * 1. the input its unlocking names holds an immutable NFT of the category at the event's lock;
 * 2. that event names the hash output 1 publishes and the guard's own outpoint, so an authorization serves once;
 * 3. output 0 recreates the guard, and output 1 is the publication.
 */

import { encodeLockingBytecodeP2sh20, encodeLockingBytecodeP2sh32 } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { encodeDataPush } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/push.js';
import {
  buildEventNftCovenantScript, computeEventNameHash, hash160, hash256, scriptToBytecode,
  type Artifact, type EventDefinitionAbi,
} from '@solidcash/utils';
import type { TransactionDetails, Unlocker, Utxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { satoshisAtLeastDust } from '../framed/composer/dust.js';
import { ownCoinRefusal } from '../framed/deploy/own-coin.js';
import type { PublishedRegistry } from './deployment.js';
import type { IdentityRecord } from './identity.js';
import { BcmrError, ipfsCidV1Raw, publicationOutput } from './publication.js';
import { encodeRegistry, type MetadataRegistry } from './registry.js';

/** The event a governed contract emits to authorize an update (`BcmrGoverned.scash`). */
export const METADATA_UPDATED = 'MetadataUpdated';

/** The relative timelock, in blocks, after which an event NFT may be spent. */
export const EVENT_MATURITY_BLOCKS = 144;

/** What a governed guard is keyed to. */
export interface GovernedGuard {
  readonly category: string;
  readonly eventLockingBytecode: Uint8Array;
  /** How the event writes its arguments: pushes, or `abi.encodePacked` words under `evmCompat`. */
  readonly notation: 'native' | 'evm';
}

const OP = {
  OP_0: 0x00, OP_1: 0x51, OP_DROP: 0x75, OP_DUP: 0x76, OP_ROT: 0x7b, OP_SWAP: 0x7c, OP_SPLIT: 0x7f, OP_SIZE: 0x82,
  OP_EQUAL: 0x87, OP_EQUALVERIFY: 0x88, OP_NUMEQUALVERIFY: 0x9d, OP_INPUTINDEX: 0xc0, OP_UTXOBYTECODE: 0xc7,
  OP_OUTPOINTTXHASH: 0xc8, OP_OUTPOINTINDEX: 0xc9, OP_OUTPUTBYTECODE: 0xcd, OP_UTXOTOKENCATEGORY: 0xce,
  OP_UTXOTOKENCOMMITMENT: 0xcf,
} as const;

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

const ops = (...codes: number[]): Uint8Array => Uint8Array.from(codes);
const push = (bytes: Uint8Array): Uint8Array => encodeDataPush(bytes);
const pushNumber = (value: number): Uint8Array => encodeDataPush(value === 0 ? new Uint8Array(0) : Uint8Array.of(value));

/** The contract's `MetadataUpdated(bytes32, bytes32)` event and its notation, refused when the artifact lacks it. */
export function governedEvent(artifact: Artifact): { readonly event: EventDefinitionAbi; readonly notation: 'native' | 'evm' } {
  const event = (artifact.events ?? []).find((candidate) => candidate.name === METADATA_UPDATED
    && candidate.anonymous !== true
    && candidate.parameters.length === 2
    && candidate.parameters.every((parameter) => parameter.type === 'bytes32'));
  if (event === undefined) {
    throw new BcmrError(
      `${artifact.contractName} emits no MetadataUpdated(bytes32 registryHash, bytes32 identityTxid): inherit `
      + 'BcmrGoverned to govern its metadata',
    );
  }
  const evm = event.parameters.map((parameter) => parameter.notation === 'evm');
  if (evm[0] !== evm[1]) throw new BcmrError('MetadataUpdated mixes argument notations');
  return { event, notation: evm[0] === true ? 'evm' : 'native' };
}

/** The redeem script of the guard keyed to `guard`; its unlocking pushes the event input's index. */
export function governedGuardRedeemScript(guard: GovernedGuard): Uint8Array {
  if (!/^[0-9a-f]{64}$/.test(guard.category)) throw new BcmrError(`a category is 64 hex characters: ${guard.category}`);
  // An immutable NFT answers its bare 32-byte category, in the VM's byte order.
  const categoryVm = hexToBin(guard.category).reverse();
  const readArguments = guard.notation === 'native'
    ? concat([
      ops(OP.OP_1, OP.OP_SPLIT, OP.OP_SWAP), push(Uint8Array.of(0x20)), ops(OP.OP_EQUALVERIFY),
      pushNumber(32), ops(OP.OP_SPLIT),
      ops(OP.OP_1, OP.OP_SPLIT, OP.OP_SWAP), push(Uint8Array.of(0x20)), ops(OP.OP_EQUALVERIFY),
    ])
    : concat([pushNumber(32), ops(OP.OP_SPLIT)]);
  return concat([
    // 1. The named input holds an immutable NFT of the category at the event's lock.
    ops(OP.OP_DUP, OP.OP_UTXOTOKENCATEGORY), push(categoryVm), ops(OP.OP_EQUALVERIFY),
    ops(OP.OP_DUP, OP.OP_UTXOBYTECODE), push(guard.eventLockingBytecode), ops(OP.OP_EQUALVERIFY),
    // 2. Its arguments: `[hash, txid]`, the txid exactly 32 bytes.
    ops(OP.OP_UTXOTOKENCOMMITMENT), readArguments, ops(OP.OP_SIZE), pushNumber(32), ops(OP.OP_NUMEQUALVERIFY),
    // The txid is this input's own outpoint, which is an output 0.
    ops(OP.OP_INPUTINDEX, OP.OP_OUTPOINTTXHASH, OP.OP_EQUALVERIFY),
    ops(OP.OP_INPUTINDEX, OP.OP_OUTPOINTINDEX, OP.OP_0, OP.OP_NUMEQUALVERIFY),
    // 3. Output 0 recreates the guard; output 1 publishes the hash.
    ops(OP.OP_0, OP.OP_OUTPUTBYTECODE, OP.OP_INPUTINDEX, OP.OP_UTXOBYTECODE, OP.OP_EQUALVERIFY),
    ops(OP.OP_1, OP.OP_OUTPUTBYTECODE), pushNumber(7), ops(OP.OP_SPLIT), pushNumber(32), ops(OP.OP_SPLIT, OP.OP_DROP),
    ops(OP.OP_ROT, OP.OP_EQUALVERIFY),
    push(hexToBin('6a0442434d5220')), ops(OP.OP_EQUAL),
  ]);
}

/** The P2SH32 lock of the guard keyed to `guard`. */
export function governedGuardLockingBytecode(guard: GovernedGuard): Uint8Array {
  return encodeLockingBytecodeP2sh32(hash256(governedGuardRedeemScript(guard)));
}

/** Spends a governed guard, pointing it at the authorizing event's input. */
export function governedGuardUnlocker(guard: GovernedGuard, eventInputIndex: number): Unlocker {
  const redeemScript = governedGuardRedeemScript(guard);
  return {
    generateLockingBytecode: () => governedGuardLockingBytecode(guard),
    generateUnlockingBytecode: () => concat([pushNumber(eventInputIndex), push(redeemScript)]),
  };
}

/** The guard for a contract's deployment, from the lock its convention gives the contract's MetadataUpdated event. */
export function governedGuardFor(artifact: Artifact, category: string, eventLockingBytecode: Uint8Array): GovernedGuard {
  return { category: category.toLowerCase(), eventLockingBytecode, notation: governedEvent(artifact).notation };
}

/** The lock of a framed contract's MetadataUpdated event: P2SH32 of the event covenant. */
export function framedEventLockingBytecode(category: string, event: EventDefinitionAbi): Uint8Array {
  return encodeLockingBytecodeP2sh32(hash256(scriptToBytecode(
    buildEventNftCovenantScript(hexToBin(category), computeEventNameHash(event.signature)),
  )));
}

/**
 * The arguments to pass the contract's `updateMetadata` to authorize `registry` for the identity output at
 * `identityTxid`: the registry's SHA-256, and the txid in the byte order the guard reads its outpoint in.
 */
export function governedAuthorization(registrySha256: Uint8Array, identityTxid: string): {
  readonly registryHash: Uint8Array;
  readonly identityTxid: Uint8Array;
} {
  return { registryHash: registrySha256, identityTxid: hexToBin(identityTxid).reverse() };
}

/** Spends a matured event NFT at its covenant: the redeem script alone, under the relative timelock. */
function eventUnlocker(category: string, event: EventDefinitionAbi, lockingBytecode: Uint8Array): Unlocker {
  const redeemScript = scriptToBytecode(
    buildEventNftCovenantScript(hexToBin(category), computeEventNameHash(event.signature)),
  );
  const asP2sh32 = encodeLockingBytecodeP2sh32(hash256(redeemScript));
  const asP2sh20 = encodeLockingBytecodeP2sh20(hash160(redeemScript));
  const matches = (candidate: Uint8Array): boolean => binToHex(candidate) === binToHex(lockingBytecode);
  if (!matches(asP2sh32) && !matches(asP2sh20)) throw new BcmrError('the authorization is not at the event covenant');
  return {
    generateLockingBytecode: () => lockingBytecode,
    generateUnlockingBytecode: () => push(redeemScript),
  };
}

export interface ApplyGovernedMetadataOptions {
  readonly provider: NetworkProvider;
  readonly artifact: Artifact;
  readonly guard: GovernedGuard;
  /** The guarded identity output: output 0 of the current authhead. */
  readonly identity: Utxo;
  /** The MetadataUpdated event NFT the contract emitted for this update, 144 blocks old or more. */
  readonly authorization: Utxo;
  /** The registry the event authorized; its SHA-256 must be the event's hash. */
  readonly registry: MetadataRegistry;
  /** The URIs the publication offers; `ipfs://<CIDv1 of the registry>` when omitted. */
  readonly publicationUris?: readonly string[];
  readonly feeFunding: { readonly utxo: Utxo; readonly unlocker: Unlocker };
  readonly changeAddress: string;
}

/** Publishes a registry the contract authorized, spending the guard and the matured event that authorized it. */
export async function applyGovernedMetadata(options: ApplyGovernedMetadataOptions): Promise<{
  readonly tx: TransactionDetails;
  readonly identity: IdentityRecord;
  readonly registry: PublishedRegistry;
}> {
  const { guard, identity } = options;
  if (identity.vout !== 0) throw new BcmrError(`an identity output is output 0, got ${identity.txid}:${identity.vout}`);
  const { event } = governedEvent(options.artifact);
  const authorization = options.authorization.token;
  if (authorization?.category !== guard.category || authorization.nft?.capability !== 'none') {
    throw new BcmrError('the authorization is not an immutable NFT of the contract\'s category');
  }
  const encoded = await encodeRegistry(options.registry);
  const registry: PublishedRegistry = {
    ...encoded, uris: options.publicationUris ?? [`ipfs://${ipfsCidV1Raw(encoded.bytes)}`],
  };
  const feeRefusal = await ownCoinRefusal(
    options.provider, options.feeFunding.utxo, options.feeFunding.unlocker.generateLockingBytecode(),
    { role: 'fee payer' },
  );
  if (feeRefusal !== undefined) throw new BcmrError(feeRefusal);

  const guardLock = governedGuardLockingBytecode(guard);
  const { TransactionBuilder } = await import('../TransactionBuilder.js');
  // The update consumes the authorization: its event NFT is burned, so it cannot serve twice.
  const builder = new TransactionBuilder({ provider: options.provider, allowImplicitNftBurn: true });
  builder.addInput(identity, governedGuardUnlocker(guard, 1));
  builder.addInput(
    options.authorization,
    eventUnlocker(guard.category, event, guard.eventLockingBytecode),
    { sequence: EVENT_MATURITY_BLOCKS },
  );
  builder.addInput(options.feeFunding.utxo, options.feeFunding.unlocker);
  const guardOutput = { to: guardLock, amount: satoshisAtLeastDust(identity.satoshis, { to: guardLock }) };
  builder.addOutput(guardOutput);
  builder.addOutput(publicationOutput(registry.sha256, registry.uris));

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
  return {
    tx,
    identity: { txid: tx.txid, vout: 0, satoshis: guardOutput.amount, policy: 'governed', lockingBytecode: guardLock },
    registry,
  };
}
