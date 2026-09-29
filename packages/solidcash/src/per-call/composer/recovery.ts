/**
 * The recovery side-cars a per-call master co-spends.
 *
 * A compiled master whose entry calls `ecrecoverPubKey` (or the EVM projection) reads a side-car pair at a fixed
 * offset from its own input: side-car A checkpoints the GLV ladder and side-car B commits the recovered key, with
 * one keccak side-car after the pairs when the call projects to an EVM address. This module builds those inputs
 * from the call's `(hash, v, r, s)` and hands them to the plan in the order the body reads them, and `layout.ts`
 * places them immediately after the master's own input.
 *
 * The witnesses themselves are the shipped recovery engine (`ecrecover/ecrecoverComputeSidecar.ts`); this module
 * only resolves each call's scalars from the master's own argument pushes and shapes the two inputs a draft takes.
 * The salt brands the side-car; the compiled check strips it before hashing the covenant, so any salt the caller
 * states works. Scalars the body computes are learned from the body's own bind: the pair is built over placeholder
 * scalars and rebuilt over the ones the body binds.
 */

import { binToHex, hexToBin } from '@bitauth/libauth';
import { secp256k1 } from '@noble/curves/secp256k1';
import {
  PerCallEncodingError,
  SHARED_LIBRARY_SALT,
  decodeIntegerValue,
  ecrecoverComputeLockingBytecode,
  keccakComputeLockingBytecode,
  sha256,
} from '@solidcash/utils';
import type { Output, Unlocker, Utxo } from '../../interfaces.js';
import { buildEcrecoverComputeSidecars, computeEcrecoverWitness, probeEcrecoverSplit }
  from '../../ecrecover/ecrecoverComputeSidecar.js';
import { buildKeccakComputeSidecar } from '../../keccak/keccakComputeSidecar.js';
import type { DraftComputedWitness, DraftInput, DraftSettledInput, DraftSourceOutput } from './draft.js';

/** The value each side-car UTXO carries; the covenants' self-preservation only reads the lock and the token. */
const SIDE_CAR_VALUE = 100_000n;

/** The category a recovery side-car's own mutable NFT carries. It is the side-car's, not the contract's. */
export const RECOVERY_SIDE_CAR_CATEGORY: Uint8Array = new Uint8Array(32).fill(0xee);

/** One recovery call a master's entry makes, with the scalars the builtin recovers from. */
export interface RecoveryCall {
  readonly hash: Uint8Array;
  readonly v: number;
  readonly r: Uint8Array;
  readonly s: Uint8Array;
  /** True when the call is the EVM projection, which also co-spends a keccak side-car over the recovered key. */
  readonly evm: boolean;
}

/** A recovery call whose scalars the body computes, so the derivation learns them from the body's bind. */
export interface ComputedRecoveryCall {
  readonly computed: true;
  readonly evm: boolean;
}

/** The scalars a recovery side-car pair recovers from. */
type RecoveryScalars = Omit<RecoveryCall, 'evm'>;

/** The side-car inputs one master co-spends, in the order its body reads them. */
export interface RecoverySideCars {
  readonly ids: readonly string[];
  readonly inputs: Readonly<Record<string, DraftInput>>;
  /** The witnesses the body computes, which the plan hands the derivation to learn. */
  readonly computedWitnesses: readonly DraftComputedWitness[];
}

/** The ABI row of a function that makes recovery calls, as the compiled artifact publishes it. */
export interface RecoveryAbiFunction {
  readonly inputs: readonly { readonly name: string; readonly type: string }[];
  /** Per call, the parameter name each of `(hash, v, r, s)` came from, or `null` for a computed argument. */
  readonly ecrecoverArgParams?: readonly (readonly (string | null)[])[] | null;
  /** Per call, whether it is the EVM projection. */
  readonly ecrecoverEvmFlags?: readonly boolean[] | null;
}

/** A synthetic UTXO for the pair builders, which read the lock and the token that recreates it. */
function sideCarUtxo(role: 'A' | 'B' | 'K'): Utxo {
  return {
    txid: (role === 'A' ? 'aa' : role === 'B' ? 'bb' : 'cc').repeat(32),
    vout: 1,
    satoshis: SIDE_CAR_VALUE,
    token: {
      category: binToHex(RECOVERY_SIDE_CAR_CATEGORY), amount: 0n,
      nft: { capability: 'mutable', commitment: '' },
    },
  };
}

/**
 * The unlocking bytecode a shipped side-car builder produces.
 *
 * The builders' generators read only their captured witness, never the transaction, which does not exist yet when
 * a plan is laid out; the empty options object is the shape the interface requires.
 */
const unlockingOf = (unlocker: Unlocker): Uint8Array => unlocker.generateUnlockingBytecode({} as never);

/** The source output a side-car input spends: its lock is the covenant's, its token the side-car's own. */
function sideCarSource(lock: Uint8Array): DraftSourceOutput {
  return {
    lockingBytecode: lock,
    valueSatoshis: SIDE_CAR_VALUE,
    token: {
      category: RECOVERY_SIDE_CAR_CATEGORY, amount: 0n,
      nft: { capability: 'mutable', commitment: new Uint8Array(0) },
    },
  };
}

/** The output a side-car recreates, from the recreation the shipped builder produced. */
function sideCarRecreation(recreate: Output): DraftSourceOutput {
  const token = recreate.token!;
  return {
    lockingBytecode: typeof recreate.to === 'string' ? hexToBin(recreate.to) : recreate.to,
    valueSatoshis: recreate.amount,
    token: {
      category: hexToBin(token.category),
      amount: token.amount,
      nft: { capability: token.nft!.capability, commitment: hexToBin(token.nft!.commitment) },
    },
  };
}

/** The byte length of the blob a recovery binds: `hash(32) || v(1) || r(32) || s(32)`. */
const RECOVERY_ARGUMENT_BYTES = 97;

/** The most scalar draws a placeholder recovery tries; a random point's ladder nearly always splits. */
const PLACEHOLDER_RECOVERY_DRAWS = 16;

/** The A/B pair over `scalars`, and when `kId` is set the EVM projection's keccak side-car over the recovered key. */
function recoverySideCarsOver(
  scalars: RecoveryScalars,
  salt: Uint8Array,
  ids: { readonly a: string; readonly b: string; readonly k: string | undefined },
): Record<string, DraftSettledInput> {
  const witness = computeEcrecoverWitness(scalars.hash, scalars.v, scalars.r, scalars.s);
  const chunkA = probeEcrecoverSplit(witness, salt, sideCarUtxo('A'), sideCarUtxo('B'));
  const { unlockerA, recreateA, unlockerB, recreateB } = buildEcrecoverComputeSidecars(
    witness, chunkA, salt, sideCarUtxo('A'), sideCarUtxo('B'),
  );
  const settled: Record<string, DraftSettledInput> = {
    [ids.a]: { unlockingBytecode: unlockingOf(unlockerA), output: sideCarRecreation(recreateA) },
    [ids.b]: { unlockingBytecode: unlockingOf(unlockerB), output: sideCarRecreation(recreateB) },
  };
  if (ids.k !== undefined) {
    const { unlocker, recreate } = buildKeccakComputeSidecar(witness.uncompressedPubkey, salt, sideCarUtxo('K'), false);
    settled[ids.k] = { unlockingBytecode: unlockingOf(unlocker), output: sideCarRecreation(recreate) };
  }
  return settled;
}

/** The blob a recovery over `scalars` binds. */
const recoveryArgumentOf = (scalars: RecoveryScalars): Uint8Array =>
  Uint8Array.from([...scalars.hash, scalars.v, ...scalars.r, ...scalars.s]);

/** The scalars of the blob a body bound, which must be the `hash || v || r || s` a recovery takes. */
function recoveryScalarsOf(blob: Uint8Array): RecoveryScalars {
  if (blob.length !== RECOVERY_ARGUMENT_BYTES) {
    throw new PerCallEncodingError(
      `the body binds a ${blob.length}-byte recovery argument, not the ${RECOVERY_ARGUMENT_BYTES} of hash || v || r || s`,
    );
  }
  return { hash: blob.slice(0, 32), v: blob[32]!, r: blob.slice(33, 65), s: blob.slice(65) };
}

/** A 32-byte little-endian word, the form the recovery builtin reads its scalars in. */
function littleEndianWord(value: bigint): Uint8Array {
  const word = new Uint8Array(32);
  for (let index = 0; index < 32; index += 1, value >>= 8n) word[index] = Number(value & 0xffn);
  return word;
}

/**
 * Placeholder scalars for a recovery the body computes, and the pair built over them.
 *
 * They are drawn from `tag` and recover a key over a random point, so the pair is a valid pair: one the body never
 * reads still holds its place. The drawn hash keeps every placeholder distinct. A draw whose ladder does not split
 * within the side-cars' budget is redrawn.
 */
function placeholderRecovery(
  tag: string,
  build: (scalars: RecoveryScalars) => Record<string, DraftSettledInput>,
): { readonly argument: Uint8Array; readonly settled: Record<string, DraftSettledInput> } {
  const order = secp256k1.CURVE.n;
  let refusal: unknown;
  for (let draw = 0; draw < PLACEHOLDER_RECOVERY_DRAWS; draw += 1) {
    const drawn = (part: string): bigint => BigInt(`0x${binToHex(
      sha256(new TextEncoder().encode(`per-call computed recovery\u0000${tag}\u0000${draw}\u0000${part}`)),
    )}`);
    const point = secp256k1.ProjectivePoint.BASE.multiply(drawn('k') % order || 1n).toAffine();
    const scalars: RecoveryScalars = {
      hash: littleEndianWord(drawn('hash')),
      v: 27 + Number(point.y & 1n),
      r: littleEndianWord(point.x % order),
      s: littleEndianWord(drawn('s') % order || 1n),
    };
    try {
      return { argument: recoveryArgumentOf(scalars), settled: build(scalars) };
    } catch (error) {
      refusal = error;
    }
  }
  throw new PerCallEncodingError(`no placeholder recovery for "${tag}" splits its ladder: ${String(refusal)}`);
}

/**
 * Builds the recovery side-cars one master co-spends, in the order its body reads them: the A/B pair of each call,
 * then one keccak side-car per EVM projection. The ids are namespaced by the master, so a composition that names
 * two masters' side-cars keeps them distinct. A call whose scalars the body computes is built over placeholder
 * scalars, and its computed witness rebuilds the pair (and its keccak side-car) over the blob the body binds.
 */
export function buildRecoverySideCars(
  master: string,
  calls: readonly (RecoveryCall | ComputedRecoveryCall)[],
  salt: Uint8Array = SHARED_LIBRARY_SALT,
): RecoverySideCars {
  const pairIds: string[] = [];
  const keccakIds: string[] = [];
  const inputs: Record<string, DraftInput> = {};
  const computedWitnesses: DraftComputedWitness[] = [];
  calls.forEach((call, index) => {
    const ids = {
      a: `${master}/recovery-A${index}`,
      b: `${master}/recovery-B${index}`,
      k: call.evm ? `${master}/recovery-K${keccakIds.length}` : undefined,
    };
    pairIds.push(ids.a, ids.b);
    const sources: Record<string, DraftSourceOutput> = {
      [ids.a]: sideCarSource(ecrecoverComputeLockingBytecode(salt, 'A')),
      [ids.b]: sideCarSource(ecrecoverComputeLockingBytecode(salt, 'B')),
    };
    if (ids.k !== undefined) {
      keccakIds.push(ids.k);
      sources[ids.k] = sideCarSource(keccakComputeLockingBytecode(salt, false));
    }
    const over = (scalars: RecoveryScalars): Record<string, DraftSettledInput> =>
      recoverySideCarsOver(scalars, salt, ids);
    let settled: Record<string, DraftSettledInput>;
    if ('computed' in call) {
      const placeholder = placeholderRecovery(`${master}/recovery-${index}`, over);
      computedWitnesses.push({
        master, placeholder: placeholder.argument, settle: (value) => over(recoveryScalarsOf(value)),
      });
      settled = placeholder.settled;
    } else {
      settled = over(call);
    }
    for (const [id, input] of Object.entries(settled)) inputs[id] = { source: sources[id]!, ...input };
  });
  return { ids: [...pairIds, ...keccakIds], inputs, computedWitnesses };
}

/**
 * The recovery calls an entry makes, with each `(hash, v, r, s)` read from the master's own argument pushes.
 *
 * `argumentPushes` are the pushes the master's unlocking bytecode carries above its witness block, in wire order:
 * `leadingPushes` skips the pushes that are not arguments (one when the call data leads with a dispatcher selector),
 * and the parameters then follow with the FIRST parameter's push LAST, which is where the compiled body reads it. A
 * call with any argument that is not a named parameter of the entry - a value the body computes - has no pushes to
 * read, so it is returned as computed, and `buildRecoverySideCars` leaves its scalars to the derivation.
 */
export function recoveryCallsOf(
  abiFunction: RecoveryAbiFunction,
  argumentPushes: readonly Uint8Array[],
  leadingPushes = 0,
): readonly (RecoveryCall | ComputedRecoveryCall)[] {
  const params = abiFunction.ecrecoverArgParams ?? [];
  const flags = abiFunction.ecrecoverEvmFlags ?? [];
  if (params.length === 0) return [];
  const values = argumentPushes.slice(leadingPushes);
  const parameterCount = abiFunction.inputs.length;
  if (values.length !== parameterCount) {
    throw new PerCallEncodingError(
      `the entry takes ${parameterCount} parameter(s) and its unlocking bytecode carries ${values.length} `
      + 'argument push(es)',
    );
  }
  /** The push of parameter `index`, which the wire carries last for the first parameter. */
  const valueOf = (name: string): Uint8Array => {
    const index = abiFunction.inputs.findIndex((input) => input.name === name);
    if (index < 0) throw new PerCallEncodingError(`the entry has no parameter '${name}'`);
    return values[parameterCount - 1 - index]!;
  };
  return params.map((names, call) => {
    if (names.some((name) => name === null)) return { computed: true, evm: flags[call] === true };
    const [hashName, vName, rName, sName] = names as readonly string[];
    return {
      hash: valueOf(hashName!),
      v: Number(decodeIntegerValue(valueOf(vName!))),
      r: valueOf(rName!),
      s: valueOf(sName!),
      evm: flags[call] === true,
    };
  });
}

/** The ABI row of a function that hashes through keccak256 compute side-cars, as the compiled artifact publishes it. */
export interface KeccakAbiFunction {
  readonly inputs: readonly { readonly name: string; readonly type: string }[];
  /** Per keccak256 call, in the order the body makes them, the parameter its preimage is, or `null` if computed. */
  readonly keccakPreimageParams?: readonly (string | null)[] | null;
}

/**
 * The preimage of each keccak256 call an entry makes, read from the master's own argument pushes.
 *
 * The pushes are read as `recoveryCallsOf` reads them. A call whose preimage the body computes has no push to read,
 * so its entry is `undefined`, and `buildKeccakSideCars` leaves that preimage to the derivation.
 */
export function keccakPreimagesOf(
  abiFunction: KeccakAbiFunction,
  argumentPushes: readonly Uint8Array[],
  leadingPushes = 0,
): readonly (Uint8Array | undefined)[] {
  const params = abiFunction.keccakPreimageParams ?? [];
  if (params.length === 0) return [];
  const values = argumentPushes.slice(leadingPushes);
  const parameterCount = abiFunction.inputs.length;
  if (values.length !== parameterCount) {
    throw new PerCallEncodingError(
      `the entry takes ${parameterCount} parameter(s) and its unlocking bytecode carries ${values.length} `
      + 'argument push(es)',
    );
  }
  return params.map((name) => {
    if (name === null) return undefined;
    const index = abiFunction.inputs.findIndex((input) => input.name === name);
    if (index < 0) throw new PerCallEncodingError(`the entry has no parameter '${name}'`);
    return values[parameterCount - 1 - index]!;
  });
}

/** A stateful keccak256 side-car's unlocking bytecode and recreated output, hashing `preimage`. */
function keccakSideCarOver(preimage: Uint8Array, salt: Uint8Array): DraftSettledInput {
  const { unlocker, recreate } = buildKeccakComputeSidecar(preimage, salt, sideCarUtxo('K'), true);
  return { unlockingBytecode: unlockingOf(unlocker), output: sideCarRecreation(recreate) };
}

/**
 * Builds the keccak256 compute side-cars one master co-spends, one per call in the order its body makes them.
 *
 * Each follows the master's recovery side-cars in the block's list, so the body reads it at the step its own count
 * of calls names. The stateful covenant recreates the side-car at its own index, where a per-call body reads the
 * result; the ids are namespaced by the master. A side-car whose preimage the body computes hashes a placeholder,
 * and its computed witness rebuilds it around the preimage the body binds. A side-car the body never reads keeps
 * the placeholder and still holds its place, so the calls after it read theirs.
 */
export function buildKeccakSideCars(
  master: string,
  preimages: readonly (Uint8Array | undefined)[],
  salt: Uint8Array = SHARED_LIBRARY_SALT,
): RecoverySideCars {
  const ids: string[] = [];
  const inputs: Record<string, DraftInput> = {};
  const computedWitnesses: DraftComputedWitness[] = [];
  preimages.forEach((preimage, index) => {
    const id = `${master}/keccak-${index}`;
    ids.push(id);
    const source = sideCarSource(keccakComputeLockingBytecode(salt, true));
    if (preimage !== undefined) {
      inputs[id] = { source, ...keccakSideCarOver(preimage, salt) };
      return;
    }
    const placeholder = sha256(new TextEncoder().encode(`per-call computed witness\u0000${id}`));
    inputs[id] = { source, ...keccakSideCarOver(placeholder, salt) };
    computedWitnesses.push({ master, placeholder, settle: (value) => ({ [id]: keccakSideCarOver(value, salt) }) });
  });
  return { ids, inputs, computedWitnesses };
}
