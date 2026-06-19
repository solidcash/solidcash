// Generic registry of external script libraries ("precompiles") callable from contracts by name.
// Built-in libraries (keccak256, future keccak512) plus user-supplied ones share this shape. A library
// is a self-contained, OP_DEFINE-able script blob (a function inputs -> outputs) with an ABI signature.
// It is either inlined into the contract redeem or loaded at runtime from a co-spent side-car UTXO.
// See packages/solidc/docs/external-libraries.md.
import { hexToBin } from '@bitauth/libauth';
import { Op, Script, scriptToBytecode } from './script.js';
import { hash256 } from './hash.js';
import { AbiInput, AbiOutput } from './artifact.js';
import {
  KECCAK256_LIBRARY_BLOB, KECCAK256_LIBRARY_BLOB_HASH, KECCAK256_LIBRARY_ID,
} from './keccak-library.js';

export interface ExternalLibrary {
  name: string;             // builtin resolves its library by this name (e.g. 'keccak256')
  blob: Uint8Array;         // the library script (a function inputs -> outputs)
  blobHash: Uint8Array;     // hash256(blob); the integrity check baked into the loader
  functionId: bigint;       // OP_DEFINE id the library is registered under (>= 0x1009)
  abi: { inputs: AbiInput[]; outputs: AbiOutput[] };  // call signature, e.g. (bytes) -> bytes32
}

// Built-in precompiles. User libraries (blob+ABI, or compiled from .scash) are merged into this set at
// compile time. Future built-ins (keccak512, ...) are added as more named entries.
export const BUILTIN_LIBRARIES: Record<string, ExternalLibrary> = {
  keccak256: {
    name: 'keccak256',
    blob: hexToBin(KECCAK256_LIBRARY_BLOB),
    blobHash: hexToBin(KECCAK256_LIBRARY_BLOB_HASH),
    functionId: KECCAK256_LIBRARY_ID,
    abi: { inputs: [{ name: 'message', type: 'bytes' }], outputs: [{ type: 'bytes32' }] },
  },
};

// A user-supplied library: a name, the script blob (hex), and its call signature. Provided to the
// compiler via the `userLibraries` option; resolved into the registry alongside the built-ins.
export interface UserLibraryInput {
  name: string;
  code: string; // hex-encoded library blob (a function inputs -> outputs)
  abi: { inputs: AbiInput[]; outputs: AbiOutput[] };
}

// The full library set for a compilation: built-in precompiles + user libraries. User libraries get
// function ids after the built-ins'. Throws on a name collision (incl. shadowing a built-in).
export function resolveLibraries(userLibraries?: readonly UserLibraryInput[]): Record<string, ExternalLibrary> {
  const resolved: Record<string, ExternalLibrary> = { ...BUILTIN_LIBRARIES };
  let nextId = Object.values(BUILTIN_LIBRARIES).reduce((max, l) => (l.functionId > max ? l.functionId : max), 0x1008n) + 1n;
  for (const ul of userLibraries ?? []) {
    if (resolved[ul.name]) throw new Error(`External library '${ul.name}' is already defined`);
    const blob = hexToBin(ul.code);
    resolved[ul.name] = { name: ul.name, blob, blobHash: hash256(blob), functionId: nextId, abi: ul.abi };
    nextId += 1n;
  }
  return resolved;
}

// Minimal data-push prefix length for a push of `len` bytes (direct / PUSHDATA1 / PUSHDATA2 / PUSHDATA4).
export function pushPrefixLength(len: number): number {
  if (len <= 75) return 1;
  if (len <= 255) return 2;
  if (len <= 65535) return 3;
  return 5;
}

// Fixed parts of the side-car redeem wrapper (same for every library).
export const SIDECAR_SALT_PREFIX_LENGTH = 34; // OP_PUSHBYTES_32 + 32 salt bytes + OP_DROP
export const SIDECAR_SELFPRES_LENGTH = 6;     // INPUTINDEX UTXOBYTECODE TXOUTPUTCOUNT 1SUB OUTPUTBYTECODE EQUALVERIFY

/**
 * The successive lengths a contract's loader strips off the side-car INPUT bytecode (= PUSHDATA(redeem))
 * to reach the blob: drop outerPush, saltPrefix, selfPres, blobPush; then take blobLength (drop the
 * OP_DROP OP_1 suffix). Derived from the blob length; salt-independent.
 */
export function sidecarStripOffsets(blob: Uint8Array): {
  outerPush: number; saltPrefix: number; selfPres: number; blobPush: number; blobLength: number;
} {
  const blobPush = pushPrefixLength(blob.length);
  const redeemLength = SIDECAR_SALT_PREFIX_LENGTH + SIDECAR_SELFPRES_LENGTH + blobPush + blob.length + 2;
  return {
    outerPush: pushPrefixLength(redeemLength),
    saltPrefix: SIDECAR_SALT_PREFIX_LENGTH,
    selfPres: SIDECAR_SELFPRES_LENGTH,
    blobPush,
    blobLength: blob.length,
  };
}

/**
 * Build a side-car redeem wrapping a library blob:
 *   <salt:32> OP_DROP | self-pres | PUSHDATA(blob) | OP_DROP OP_1
 * self-pres recreates the side-car against the LAST output. salt = the contract token category (branded)
 * or 32 zero bytes (shared). The loader strips down to the blob using sidecarCodeRange().
 */
export function buildSidecarRedeem(blob: Uint8Array, salt: Uint8Array): Uint8Array {
  if (salt.length !== 32) throw new Error('side-car salt must be 32 bytes');
  const script: Script = [
    salt, Op.OP_DROP,
    Op.OP_INPUTINDEX, Op.OP_UTXOBYTECODE, Op.OP_TXOUTPUTCOUNT, Op.OP_1SUB, Op.OP_OUTPUTBYTECODE, Op.OP_EQUALVERIFY,
    blob, Op.OP_DROP, Op.OP_1,
  ];
  return scriptToBytecode(script);
}

/** P2SH32 locking bytecode for a side-car: OP_HASH256 <hash256(redeem)> OP_EQUAL. */
export function sidecarLockingBytecode(blob: Uint8Array, salt: Uint8Array): Uint8Array {
  return Uint8Array.from([0xaa, 0x20, ...hash256(buildSidecarRedeem(blob, salt)), 0x87]);
}

/**
 * Byte range of the blob within the side-car INPUT bytecode (the revealed P2SH redeem = PUSHDATA(redeem)),
 * i.e. the codeBegin/codeEnd the loader strips to. Derived from the blob length; salt-independent.
 */
export function sidecarCodeRange(blob: Uint8Array): { codeBegin: number; codeEnd: number } {
  const saltPrefix = 1 + 32 + 1;        // OP_PUSHBYTES_32 + 32 salt bytes + OP_DROP
  const selfPres = 6;                   // INPUTINDEX UTXOBYTECODE TXOUTPUTCOUNT 1SUB OUTPUTBYTECODE EQUALVERIFY
  const blobPush = pushPrefixLength(blob.length);
  const redeemLength = saltPrefix + selfPres + blobPush + blob.length + 2; // + OP_DROP OP_1
  const outerPush = pushPrefixLength(redeemLength);
  const codeBegin = outerPush + saltPrefix + selfPres + blobPush;
  return { codeBegin, codeEnd: codeBegin + blob.length };
}
