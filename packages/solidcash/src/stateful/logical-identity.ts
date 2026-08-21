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

/** True for a genesis CREATE identity commitment (`SCID` v1). */
export function isScidIdentityCommitment(commitment: string | Uint8Array | undefined): boolean {
  if (commitment === undefined) return false;
  const hex = typeof commitment === 'string' ? commitment : binToHex(commitment);
  return hex.toLowerCase().startsWith('5343494401');
}

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
  // The CREATE identity is a CashToken NFT. Advertise the token-supporting cashaddr so genesis
  // can place that NFT at getAddress() (non-token p2sh32 cashaddrs reject token outputs).
  const result = lockingBytecodeToCashAddress({ bytecode, prefix, tokenSupport: true });
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

/** Lock script of the CREATE identity encoded in a SCID v1 commitment, if decodable. */
export function logicalLockFromScidCommitment(
  commitment: string, prefix: LogicalIdentityPrefix = 'bitcoincash',
): Uint8Array | undefined {
  const decoded = decodeLogicalIdentityCommitment(commitment);
  if (!decoded) return undefined;
  try {
    const deployer = addressFromDeployerLockingBytecode(decoded.deployerLockingBytecode, prefix);
    return addressToLockScript(deriveLogicalCreateAddress(deployer, decoded.nonce));
  } catch {
    return undefined;
  }
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

/** Token-aware and non-token cashaddrs for the same CREATE lock. */
export function logicalIdentityAddressVariants(address: string): string[] {
  const variants = [address];
  try {
    const bytecode = addressToLockScript(address);
    const prefix = prefixOf(address);
    for (const tokenSupport of [false, true]) {
      const encoded = lockingBytecodeToCashAddress({ bytecode, prefix, tokenSupport });
      if (typeof encoded !== 'string' && !variants.includes(encoded.address)) variants.push(encoded.address);
    }
  } catch { /* keep the original string */ }
  return variants;
}

export function sameLogicalIdentityAddress(left: string, right: string): boolean {
  try {
    const a = addressToLockScript(left);
    const b = addressToLockScript(right);
    return a.length === b.length && a.every((byte, index) => byte === b[index]);
  } catch {
    return left === right;
  }
}

export function logicalIdentityBandKey(address: string): string {
  try {
    return binToHex(addressToLockScript(address));
  } catch {
    return address;
  }
}

/** True when a category witness is the 32-byte all-zero “direct caller / tx.origin” value. */
export function isZeroMsgSenderCategory(category: string | Uint8Array | undefined): boolean {
  if (category === undefined) return true;
  const hex = typeof category === 'string' ? category : binToHex(category);
  return hex.length === 0 || /^0+$/i.test(hex);
}

function prefixForProvider(provider: NetworkProvider): LogicalIdentityPrefix {
  if (provider.network === 'mainnet') return 'bitcoincash';
  if (provider.network === 'regtest') return 'bchreg';
  return 'bchtest';
}

function identityFromDecoded(
  anchor: Utxo, decoded: LogicalIdentityCommitment, prefix: LogicalIdentityPrefix,
): ResolvedLogicalIdentity {
  const deployer = addressFromDeployerLockingBytecode(decoded.deployerLockingBytecode, prefix);
  return {
    logicalAddress: deriveLogicalCreateAddress(deployer, decoded.nonce),
    categoryId: anchor.token!.category,
    anchor,
    unlocker: createLogicalIdentityUnlocker(deployer, decoded.nonce),
    ...decoded,
  };
}

function uniqueScidFromUtxos(
  utxos: readonly Utxo[], prefix: LogicalIdentityPrefix,
): ResolvedLogicalIdentity | undefined {
  const valid: ResolvedLogicalIdentity[] = [];
  const seen = new Set<string>();
  for (const anchor of utxos) {
    const nft = anchor.token?.nft;
    if (!anchor.token || nft?.capability !== 'none' || !isScidIdentityCommitment(nft.commitment)) continue;
    const decoded = decodeLogicalIdentityCommitment(nft.commitment);
    if (!decoded) continue;
    const id = `${anchor.txid}:${anchor.vout}`;
    if (seen.has(id)) continue;
    seen.add(id);
    try {
      valid.push(identityFromDecoded(anchor, decoded, prefix));
    } catch { /* non-canonical deployer */ }
  }
  return valid.length === 1 ? valid[0] : undefined;
}

/**
 * Try each address until one has exactly one authenticated SCID v1 anchor.
 * Category-constructed contracts often have no `_logicalAddress`; `target` /
 * `address` still name the CREATE lock. Missing is skippable; ambiguous is not.
 */
export async function resolveLogicalIdentityFromAddresses(
  provider: NetworkProvider, addresses: Iterable<string | undefined>,
): Promise<ResolvedLogicalIdentity | undefined> {
  const seen = new Set<string>();
  for (const address of addresses) {
    if (!address) continue;
    let key: string;
    try {
      key = logicalIdentityBandKey(address);
    } catch {
      key = address;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      return await resolveLogicalIdentity(provider, address);
    } catch (error) {
      if (!/missing or invalid/.test(error instanceof Error ? error.message : String(error))) throw error;
    }
  }
  return undefined;
}

/**
 * Find the unique immutable SCID v1 NFT of `categoryId`. Address variants are
 * tried first; if the provider can list by category, that scan is the fallback
 * so a moved/recreated anchor is still found.
 */
export async function resolveLogicalIdentityByCategory(
  provider: NetworkProvider,
  categoryId: string,
  preferredAddresses: Iterable<string | undefined> = [],
): Promise<ResolvedLogicalIdentity | undefined> {
  if (isZeroMsgSenderCategory(categoryId)) return undefined;
  const fromAddress = await resolveLogicalIdentityFromAddresses(provider, preferredAddresses);
  if (fromAddress) {
    const found = fromAddress.categoryId.toLowerCase();
    const wanted = categoryId.toLowerCase();
    const reversed = binToHex(hexToBin(categoryId).reverse()).toLowerCase();
    if (found === wanted || found === reversed) return fromAddress;
  }
  if (typeof provider.getUtxosByTokenCategory !== 'function') return fromAddress;
  const utxos = await provider.getUtxosByTokenCategory(categoryId);
  return uniqueScidFromUtxos(utxos, prefixForProvider(provider)) ?? fromAddress;
}

/**
 * A non-zero `__internal__msgSenderCategory` is a contract caller. The covenant
 * scans inputs for that category's SCID; missing it is an SDK construction
 * error, not a later OP_VERIFY.
 */
export async function requireMsgSenderIdentity(
  provider: NetworkProvider,
  categoryId: string,
  preferredAddresses: Iterable<string | undefined> = [],
): Promise<ResolvedLogicalIdentity> {
  const resolved = await resolveLogicalIdentityByCategory(provider, categoryId, preferredAddresses);
  if (resolved) return resolved;
  const tried = [...preferredAddresses].filter((address): address is string => !!address);
  const atAddresses = await Promise.all(tried.map(async (address) => {
    try {
      const utxos = await provider.getUtxos(address);
      return {
        address,
        utxos: utxos.map((utxo) => ({
          cap: utxo.token?.nft?.capability ?? (utxo.token ? 'ft' : 'plain'),
          cat: utxo.token?.category?.slice(0, 16),
          commit: String(utxo.token?.nft?.commitment ?? '').slice(0, 16),
        })),
      };
    } catch (error) {
      return { address, error: error instanceof Error ? error.message : String(error) };
    }
  }));
  let byCategory = 0;
  let scidAtCategory = 0;
  if (typeof provider.getUtxosByTokenCategory === 'function') {
    const utxos = await provider.getUtxosByTokenCategory(categoryId);
    byCategory = utxos.length;
    scidAtCategory = utxos.filter((utxo) => isScidIdentityCommitment(utxo.token?.nft?.commitment)).length;
  }
  throw new Error(
    `CREATE identity for category ${categoryId} is required (non-zero msg.sender) but missing. `
    + `Tried addresses: ${tried.join(', ') || '(none)'}. `
    + `categoryUtxos=${byCategory} scidAtCategory=${scidAtCategory} atAddresses=${JSON.stringify(atAddresses)}. `
    + 'The unique immutable SCID v1 NFT of this category must be a live UTXO.',
  );
}

/** Resolve and authenticate exactly one immutable CREATE anchor at a logical address. */
export async function resolveLogicalIdentity(
  provider: NetworkProvider, logicalAddress: string,
): Promise<ResolvedLogicalIdentity> {
  const seen = new Set<string>();
  const utxos: Utxo[] = [];
  const fetch = async (address: string): Promise<void> => {
    const found = await provider.getUtxos(address);
    for (const utxo of found) {
      const id = `${utxo.txid}:${utxo.vout}`;
      if (seen.has(id)) continue;
      seen.add(id);
      utxos.push(utxo);
    }
  };
  for (const address of logicalIdentityAddressVariants(logicalAddress)) await fetch(address);
  if (typeof provider.getUtxosForLockingBytecode === 'function') {
    try {
      const byLock = await provider.getUtxosForLockingBytecode(addressToLockScript(logicalAddress));
      for (const utxo of byLock) {
        const id = `${utxo.txid}:${utxo.vout}`;
        if (seen.has(id)) continue;
        seen.add(id);
        utxos.push(utxo);
      }
    } catch { /* address was not a cashaddr */ }
  }
  const candidates = utxos.flatMap((anchor) => {
    const nft = anchor.token?.nft;
    const decoded = nft?.capability === 'none' ? decodeLogicalIdentityCommitment(nft.commitment) : undefined;
    return decoded && anchor.token ? [{ anchor, decoded, categoryId: anchor.token.category }] : [];
  });
  const valid = candidates.filter(({ decoded }) => {
    try {
      const deployer = addressFromDeployerLockingBytecode(decoded.deployerLockingBytecode, prefixOf(logicalAddress));
      return sameLogicalIdentityAddress(deriveLogicalCreateAddress(deployer, decoded.nonce), logicalAddress);
    } catch { return false; }
  });
  if (valid.length !== 1) {
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_EXTERNAL_ARGS === '1') {
      console.error('logical-identity-resolve-miss', {
        logicalAddress,
        variants: logicalIdentityAddressVariants(logicalAddress),
        utxos: utxos.map((utxo) => ({
          outpoint: `${utxo.txid}:${utxo.vout}`,
          category: utxo.token?.category,
          capability: utxo.token?.nft?.capability,
          commitment: utxo.token?.nft?.commitment?.slice(0, 80),
        })),
        candidates: candidates.length,
        valid: valid.length,
        decodeReasons: candidates.map(({ decoded }) => {
          try {
            const deployer = addressFromDeployerLockingBytecode(
              decoded.deployerLockingBytecode, prefixOf(logicalAddress),
            );
            const derived = deriveLogicalCreateAddress(deployer, decoded.nonce);
            return {
              deployer,
              derived,
              same: sameLogicalIdentityAddress(derived, logicalAddress),
              root: binToHex(decoded.rootLockingBytecode).slice(0, 20),
            };
          } catch (error) {
            return { error: error instanceof Error ? error.message : String(error) };
          }
        }),
      });
    }
    throw new Error(
      `Logical contract identity at ${logicalAddress} is ${valid.length === 0 ? 'missing or invalid' : 'ambiguous'} `
      + `(expected exactly one authenticated immutable anchor, found ${valid.length}).`,
    );
  }
  const { anchor, decoded, categoryId } = valid[0];
  const deployer = addressFromDeployerLockingBytecode(decoded.deployerLockingBytecode, prefixOf(logicalAddress));
  return {
    logicalAddress: deriveLogicalCreateAddress(deployer, decoded.nonce),
    categoryId, anchor,
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
