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
 * states works.
 */

import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  PerCallEncodingError,
  SHARED_LIBRARY_SALT,
  decodeIntegerValue,
  ecrecoverComputeLockingBytecode,
  keccakComputeLockingBytecode,
} from '@solidcash/utils';
import type { Output, Unlocker, Utxo } from '../../interfaces.js';
import { buildEcrecoverComputeSidecars, computeEcrecoverWitness, probeEcrecoverSplit }
  from '../../ecrecover/ecrecoverComputeSidecar.js';
import { buildKeccakComputeSidecar } from '../../keccak/keccakComputeSidecar.js';
import type { DraftInput, DraftSourceOutput } from './draft.js';

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

/** The side-car inputs one master co-spends, in the order its body reads them. */
export interface RecoverySideCars {
  readonly ids: readonly string[];
  readonly inputs: Readonly<Record<string, DraftInput>>;
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

/**
 * Builds the recovery side-cars one master co-spends, in the order its body reads them: the A/B pair of each call,
 * then one keccak side-car per EVM projection. The ids are namespaced by the master, so a composition that names
 * two masters' side-cars keeps them distinct.
 */
export function buildRecoverySideCars(
  master: string,
  calls: readonly RecoveryCall[],
  salt: Uint8Array = SHARED_LIBRARY_SALT,
): RecoverySideCars {
  const ids: string[] = [];
  const inputs: Record<string, DraftInput> = {};
  const evmPreimages: Uint8Array[] = [];
  calls.forEach((call, index) => {
    const witness = computeEcrecoverWitness(call.hash, call.v, call.r, call.s);
    const chunkA = probeEcrecoverSplit(witness, salt, sideCarUtxo('A'), sideCarUtxo('B'));
    const { unlockerA, recreateA, unlockerB, recreateB } = buildEcrecoverComputeSidecars(
      witness, chunkA, salt, sideCarUtxo('A'), sideCarUtxo('B'),
    );
    const aId = `${master}/recovery-A${index}`, bId = `${master}/recovery-B${index}`;
    ids.push(aId, bId);
    inputs[aId] = {
      source: sideCarSource(ecrecoverComputeLockingBytecode(salt, 'A')),
      output: sideCarRecreation(recreateA),
      unlockingBytecode: unlockingOf(unlockerA),
    };
    inputs[bId] = {
      source: sideCarSource(ecrecoverComputeLockingBytecode(salt, 'B')),
      output: sideCarRecreation(recreateB),
      unlockingBytecode: unlockingOf(unlockerB),
    };
    if (call.evm) evmPreimages.push(witness.uncompressedPubkey);
  });
  evmPreimages.forEach((preimage, index) => {
    const { unlocker, recreate } = buildKeccakComputeSidecar(preimage, salt, sideCarUtxo('K'), false);
    const id = `${master}/recovery-K${index}`;
    ids.push(id);
    inputs[id] = {
      source: sideCarSource(keccakComputeLockingBytecode(salt, false)),
      output: sideCarRecreation(recreate),
      unlockingBytecode: unlockingOf(unlocker),
    };
  });
  return { ids, inputs };
}

/**
 * The recovery calls an entry makes, with each `(hash, v, r, s)` read from the master's own argument pushes.
 *
 * `argumentPushes` are the pushes the master's unlocking bytecode carries above its witness block, in wire order:
 * `leadingPushes` skips the pushes that are not arguments (one when the call data leads with a dispatcher selector),
 * and the parameters then follow with the FIRST parameter's push LAST, which is where the compiled body reads it. A
 * call whose argument is not a named parameter of the entry - a value the body computes - is refused rather than
 * guessed: the side-car has to recover from the same scalars the body binds, and this layer cannot read a value only
 * the running code holds.
 */
export function recoveryCallsOf(
  abiFunction: RecoveryAbiFunction,
  argumentPushes: readonly Uint8Array[],
  leadingPushes = 0,
): readonly RecoveryCall[] {
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
    if (names.some((name) => name === null)) {
      throw new PerCallEncodingError(
        `recovery call ${call} passes a computed argument, which cannot be read from the entry's arguments`,
      );
    }
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
 * The pushes are read as `recoveryCallsOf` reads them. A call whose preimage is not a named parameter of the entry
 * is refused rather than guessed: the side-car has to hash the bytes the body binds.
 */
export function keccakPreimagesOf(
  abiFunction: KeccakAbiFunction,
  argumentPushes: readonly Uint8Array[],
  leadingPushes = 0,
): readonly Uint8Array[] {
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
  return params.map((name, call) => {
    if (name === null) {
      throw new PerCallEncodingError(
        `keccak256 call ${call} hashes a computed preimage, which cannot be read from the entry's arguments`,
      );
    }
    const index = abiFunction.inputs.findIndex((input) => input.name === name);
    if (index < 0) throw new PerCallEncodingError(`the entry has no parameter '${name}'`);
    return values[parameterCount - 1 - index]!;
  });
}

/**
 * Builds the keccak256 compute side-cars one master co-spends, one per call in the order its body makes them.
 *
 * Each follows the master's recovery side-cars in the block's list, so the body reads it at the step its own count
 * of calls names. The stateful covenant recreates the side-car at its own index, where a per-call body reads the
 * result; the ids are namespaced by the master.
 */
export function buildKeccakSideCars(
  master: string,
  preimages: readonly Uint8Array[],
  salt: Uint8Array = SHARED_LIBRARY_SALT,
): RecoverySideCars {
  const ids: string[] = [];
  const inputs: Record<string, DraftInput> = {};
  preimages.forEach((preimage, index) => {
    const { unlocker, recreate } = buildKeccakComputeSidecar(preimage, salt, sideCarUtxo('K'), true);
    const id = `${master}/keccak-${index}`;
    ids.push(id);
    inputs[id] = {
      source: sideCarSource(keccakComputeLockingBytecode(salt, true)),
      output: sideCarRecreation(recreate),
      unlockingBytecode: unlockingOf(unlocker),
    };
  });
  return { ids, inputs };
}
