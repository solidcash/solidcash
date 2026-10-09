/**
 * phase-boundary extract: Stateful ABI resolve + compute side-car stand-in helpers.
 * (phase-boundary extract from StatefulContract.ts).
 */

import type { AbiFunction, Artifact } from '@solidcash/utils';
import { sha256 as sha256Sync } from '@solidcash/utils';
import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { utf8ToBin } from '@bitauth/libauth/build/lib/format/utf8.js';
import { bigIntToVmNumber } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import type { FunctionArgument } from '../Argument.js';
import type { Utxo } from '../interfaces.js';
import {
  canonicalAbiFunctionSignature,
  visibleHandlerInputs,
} from './route-expression-key.js';

export function resolveStatefulAbiFunction(
  artifact: Artifact,
  identifier: string,
  args: readonly FunctionArgument[],
  selector?: string,
): AbiFunction {
  const signatureMatch = artifact.abi.find((candidate) => canonicalAbiFunctionSignature(candidate) === identifier);
  const name = signatureMatch?.name ?? identifier;
  const sameName = artifact.abi.filter((candidate) => candidate.name === name);
  let candidates = signatureMatch ? [signatureMatch] : sameName;
  if (selector !== undefined) {
    const normalized = selector.replace(/^0x/i, '').toLowerCase();
    if (!/^[0-9a-f]{8}$/.test(normalized)) {
      throw new Error(`Function selector '${selector}' must be exactly four hexadecimal bytes.`);
    }
    candidates = candidates.filter((candidate) => candidate.selector?.toLowerCase() === normalized);
  }
  if (candidates.length === 0) {
    throw new Error(`No function '${identifier}' with the requested selector on ${artifact.contractName}.`);
  }
  if (candidates.length === 1) return candidates[0];
  const arityMatches = candidates.filter((candidate) => visibleHandlerInputs(candidate.inputs).length === args.length);
  if (arityMatches.length === 1) return arityMatches[0];
  throw new Error(
    `Ambiguous call to overloaded function '${name}'. Use explicit signature or selector: `
    + sameName.map(canonicalAbiFunctionSignature).join(', '),
  );
}

/**
 * Deterministic stand-in for a compute side-car that a mock provider has not been provisioned with.
 *
 * The identity of a side-car must be a pure function of the resource it belongs to (the branded locking bytecode,
 * which already bakes the contract category and the side-car role, plus its slot index). A random one changes the
 * physical side-car on every derivation pass, so the authenticated call manifest can never match the slot the
 * atomic verifier digests: the verifier rejects the assembly before the compute call, the deferred argument is
 * never exposed, and composition reports an unresolvable compute resource even though nothing is unresolvable.
 * Real networks never take this path - they require explicitly deployed side-cars.
 */
export const computeSideCarStandIn = (domain: string, lock: Uint8Array, index: number): Utxo => {
  const identity = sha256Sync(Uint8Array.from([...utf8ToBin(domain), ...lock, ...bigIntToVmNumber(BigInt(index))]));
  return {
    txid: binToHex(sha256Sync(Uint8Array.from([...utf8ToBin(`${domain}:utxo`), ...identity]))),
    vout: index,
    satoshis: 100_000n,
    token: {
      // A compute side-car's covenant splits a 32-byte chunk out of its commitment, so a fabricated stand-in must
      // carry a well-formed one: an empty commitment makes the split run on a zero-length item and abort the
      // script before the compute call is ever reached, which is exactly where a deferred argument is supposed to
      // be exposed. Zeros are a placeholder the resolver replaces with the real chunk once the argument is learned.
      category: binToHex(identity), amount: 0n,
      nft: { capability: 'mutable', commitment: binToHex(new Uint8Array(32)) },
    },
  };
};

/** True when a fetched side-car list already contains this stand-in's outpoint (idempotent provisioning). */
export const hasOutpoint = (utxos: readonly Utxo[], candidate: Utxo): boolean => utxos.some(
  (utxo) => utxo.txid.toLowerCase() === candidate.txid.toLowerCase() && utxo.vout === candidate.vout,
);
