import {
  binToHex, cashAddressToLockingBytecode, encodeCashAddress, hexToBin, lockingBytecodeToCashAddress, utf8ToBin,
} from '@bitauth/libauth';
import { Op, Script, scriptToBytecode } from '@solidcash/utils';
import type NetworkProvider from '../network/NetworkProvider.js';
import type { Unlocker, Utxo } from '../interfaces.js';
import { addressToLockScript, createUnlockingBytecode, scriptToLockingBytecode } from '../utils.js';

const IDENTITY_MAGIC = Uint8Array.from([0x53, 0x43, 0x49, 0x44]); // "SCID"
const FACET_MAGIC = Uint8Array.from([0x53, 0x43, 0x49, 0x46]); // "SCIF"
const IDENTITY_VERSION = 1;

export type LogicalIdentityPrefix = 'bitcoincash' | 'bchtest' | 'bchreg';

function prefixOf(address: string): LogicalIdentityPrefix {
  const prefix = address.includes(':') ? address.split(':')[0] : 'bitcoincash';
  if (prefix === 'bitcoincash' || prefix === 'bchtest' || prefix === 'bchreg') return prefix;
  return 'bitcoincash';
}

function nonceToBin(nonce: bigint): Uint8Array {
  if (nonce < 0n || nonce > 0xffff_ffff_ffff_ffffn) throw new Error('Logical CREATE nonce must fit uint64.');
  const out = new Uint8Array(8);
  let value = nonce;
  for (let i = 0; i < out.length; i++) {
    out[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  return out;
}

function binToNonce(bin: Uint8Array): bigint {
  let value = 0n;
  for (let i = bin.length - 1; i >= 0; i--) value = (value << 8n) | BigInt(bin[i]);
  return value;
}

/** Solidity-visible CREATE identity used by the ethers compatibility layer and deployment SDK. */
export function deriveLogicalCreateAddress(deployer: string, nonce: bigint | number): string {
  return deriveLogicalAddressFromSeed(`create:${deployer}:${BigInt(nonce).toString()}`, prefixOf(deployer));
}

export function deriveLogicalAddressFromSeed(seed: string, prefix: LogicalIdentityPrefix): string {
  // p2sh32, not p2sh20. This is a stateful-contract identity, and a 160-bit script hash offers only ~2^80
  // collision resistance: finding a second seed that hashes alike would let an attacker present a different
  // deployer/nonce for the same logical address. `scriptToLockingBytecode` hashes with hash256 for p2sh32.
  const bytecode = scriptToLockingBytecode(logicalIdentityRedeemScript(seed), 'p2sh32');
  const result = lockingBytecodeToCashAddress({ bytecode, prefix });
  if (typeof result === 'string') throw new Error(`Could not derive a logical identity address: ${result}`);
  return result.address;
}

function logicalIdentityRedeemScript(seed: string): Script {
  // The preimage is intentionally revealed when the immutable anchor is co-spent. OP_DROP OP_1 makes the
  // identity NFT permissionless to preserve; authenticity comes from its category and SCID root binding.
  return [utf8ToBin(seed), Op.OP_DROP, Op.OP_1];
}

function logicalIdentityRedeemBytecode(seed: string): Uint8Array {
  return scriptToBytecode(logicalIdentityRedeemScript(seed));
}

export function createLogicalIdentityUnlocker(deployer: string, nonce: bigint | number): Unlocker {
  const seed = `create:${deployer}:${BigInt(nonce).toString()}`;
  const redeem = logicalIdentityRedeemBytecode(seed);
  const logicalAddress = deriveLogicalAddressFromSeed(seed, prefixOf(deployer));
  return {
    generateLockingBytecode: () => addressToLockScript(logicalAddress),
    generateUnlockingBytecode: () => createUnlockingBytecode('p2sh32', redeem, []),
  };
}

export interface LogicalIdentityCommitment {
  deployerLockingBytecode: Uint8Array;
  nonce: bigint;
  rootLockingBytecode: Uint8Array;
}

/** Encode the immutable category-bearing anchor created by contract genesis. */
export function encodeLogicalIdentityCommitment(value: LogicalIdentityCommitment): string {
  const deployer = value.deployerLockingBytecode;
  const root = value.rootLockingBytecode;
  if (deployer.length > 255 || root.length > 255) throw new Error('Logical identity bytecode is too large.');
  const out = new Uint8Array(4 + 1 + 8 + 1 + deployer.length + 1 + root.length);
  let offset = 0;
  out.set(IDENTITY_MAGIC, offset); offset += 4;
  out[offset++] = IDENTITY_VERSION;
  out.set(nonceToBin(value.nonce), offset); offset += 8;
  out[offset++] = deployer.length; out.set(deployer, offset); offset += deployer.length;
  out[offset++] = root.length; out.set(root, offset);
  if (out.length > 128) throw new Error(`Logical identity commitment is ${out.length} bytes (maximum 128).`);
  return binToHex(out);
}

export function decodeLogicalIdentityCommitment(commitment: string): LogicalIdentityCommitment | undefined {
  const bin = hexToBin(commitment);
  if (bin.length < 15 || !IDENTITY_MAGIC.every((byte, i) => bin[i] === byte) || bin[4] !== IDENTITY_VERSION) {
    return undefined;
  }
  let offset = 5;
  const nonce = binToNonce(bin.slice(offset, offset + 8)); offset += 8;
  const deployerLength = bin[offset++];
  if (offset + deployerLength + 1 > bin.length) return undefined;
  const deployerLockingBytecode = bin.slice(offset, offset + deployerLength); offset += deployerLength;
  const rootLength = bin[offset++];
  if (offset + rootLength !== bin.length) return undefined;
  return { nonce, deployerLockingBytecode, rootLockingBytecode: bin.slice(offset) };
}

export interface ResolvedLogicalIdentity extends LogicalIdentityCommitment {
  logicalAddress: string;
  categoryId: string;
  anchor: Utxo;
  unlocker: Unlocker;
}

export function encodeLogicalFacetCommitment(index: number, facetCategoryId: string): string {
  if (!Number.isInteger(index) || index < 0 || index > 0xffff) throw new Error('Facet identity index must fit uint16.');
  if (!/^[0-9a-f]{64}$/i.test(facetCategoryId)) throw new Error('Facet identity category must be 32-byte hex.');
  const out = new Uint8Array(4 + 1 + 2 + 32);
  out.set(FACET_MAGIC, 0);
  out[4] = IDENTITY_VERSION;
  out[5] = index & 0xff;
  out[6] = index >>> 8;
  out.set(hexToBin(facetCategoryId), 7);
  return binToHex(out);
}

export function decodeLogicalFacetCommitment(commitment: string): { index: number; categoryId: string } | undefined {
  const bin = hexToBin(commitment);
  if (bin.length !== 39 || !FACET_MAGIC.every((byte, i) => bin[i] === byte) || bin[4] !== IDENTITY_VERSION) {
    return undefined;
  }
  return { index: bin[5] | (bin[6] << 8), categoryId: binToHex(bin.slice(7)) };
}

export interface ResolvedSplitLogicalIdentity extends ResolvedLogicalIdentity {
  facetCategories: string[];
}

/** Resolve root and ordered facet categories solely from immutable NFTs minted by the root genesis. */
export async function resolveSplitLogicalIdentity(
  provider: NetworkProvider, logicalAddress: string, expectedFacetCount: number,
): Promise<ResolvedSplitLogicalIdentity> {
  const root = await resolveLogicalIdentity(provider, logicalAddress);
  const utxos = await provider.getUtxos(logicalAddress);
  const records = utxos.flatMap((utxo) => {
    if (utxo.token?.category !== root.categoryId || utxo.token.nft?.capability !== 'none') return [];
    const decoded = decodeLogicalFacetCommitment(utxo.token.nft.commitment);
    return decoded ? [decoded] : [];
  });
  const facetCategories: string[] = [];
  for (const record of records) {
    if (record.index >= expectedFacetCount || facetCategories[record.index] !== undefined) {
      throw new Error(`Logical split identity at ${logicalAddress} has an invalid or duplicate facet index ${record.index}.`);
    }
    facetCategories[record.index] = record.categoryId;
  }
  if (facetCategories.length !== expectedFacetCount || facetCategories.some((category) => category === undefined)) {
    throw new Error(
      `Logical split identity at ${logicalAddress} has ${records.length} facet records; expected ${expectedFacetCount}.`,
    );
  }
  return { ...root, facetCategories };
}

function addressFromDeployerLockingBytecode(bytecode: Uint8Array, prefix: LogicalIdentityPrefix): string {
  if (
    bytecode.length !== 25 || bytecode[0] !== 0x76 || bytecode[1] !== 0xa9 || bytecode[2] !== 0x14
    || bytecode[23] !== 0x88 || bytecode[24] !== 0xac
  ) {
    throw new Error('Logical identity anchor contains a non-canonical P2PKH deployer.');
  }
  const decoded = cashAddressToLockingBytecode(encodeCashAddress({
    prefix, type: 'p2pkh', payload: bytecode.slice(3, 23), throwErrors: true,
  }).address);
  if (typeof decoded === 'string' || binToHex(decoded.bytecode) !== binToHex(bytecode)) {
    throw new Error('Logical identity anchor contains a non-canonical P2PKH deployer.');
  }
  return encodeCashAddress({ prefix, type: 'p2pkh', payload: bytecode.slice(3, 23), throwErrors: true }).address;
}

/** Resolve and authenticate exactly one immutable CREATE anchor at a logical address. */
export async function resolveLogicalIdentity(
  provider: NetworkProvider, logicalAddress: string,
): Promise<ResolvedLogicalIdentity> {
  const utxos = await provider.getUtxos(logicalAddress);
  const candidates = utxos.flatMap((anchor) => {
    const nft = anchor.token?.nft;
    const decoded = nft?.capability === 'none' ? decodeLogicalIdentityCommitment(nft.commitment) : undefined;
    return decoded && anchor.token ? [{ anchor, decoded, categoryId: anchor.token.category }] : [];
  });
  const valid = candidates.filter(({ decoded }) => {
    try {
      const deployer = addressFromDeployerLockingBytecode(decoded.deployerLockingBytecode, prefixOf(logicalAddress));
      return deriveLogicalCreateAddress(deployer, decoded.nonce) === logicalAddress;
    } catch { return false; }
  });
  if (valid.length !== 1) {
    throw new Error(
      `Logical contract identity at ${logicalAddress} is ${valid.length === 0 ? 'missing or invalid' : 'ambiguous'} `
      + `(expected exactly one authenticated immutable anchor, found ${valid.length}).`,
    );
  }
  const { anchor, decoded, categoryId } = valid[0];
  const deployer = addressFromDeployerLockingBytecode(decoded.deployerLockingBytecode, prefixOf(logicalAddress));
  return {
    logicalAddress, categoryId, anchor,
    unlocker: createLogicalIdentityUnlocker(deployer, decoded.nonce),
    ...decoded,
  };
}

export function buildLogicalIdentityCommitment(
  deployer: string, nonce: bigint, rootAddress: string,
): string {
  return encodeLogicalIdentityCommitment({
    deployerLockingBytecode: addressToLockScript(deployer),
    nonce,
    rootLockingBytecode: addressToLockScript(rootAddress),
  });
}
