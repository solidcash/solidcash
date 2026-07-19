/**
 * Drop-in 'ethers' module for ported hardhat suites (aliased as `ethers`). It re-exports the real ethers API
 * from its subpaths - so a project-wide `ethers` alias does NOT recurse into this file - and overrides only the
 * EVM CREATE-address predictors.
 *
 * On Bitcoin Cash a stateful contract's identity is its token category: the genesis funding UTXO's txid (vout 0),
 * optionally salted. It is NOT f(deployer, nonce), so `getCreateAddress`/`getCreate2Address` cannot be used
 * plainly. They are redirected to a deterministic BCH p2sh32 address so ported code that precomputes addresses
 * (e.g. to break a circular deploy dependency) still runs. The REAL deployed address comes from
 * `contract.getAddress()` after deploy - i.e. the SDK builder `new Contract(artifact, args, { category, salt })`
 * - which is what code should rely on for an address that matches an on-chain contract.
 */
export * from 'ethers/abi';
export * from 'ethers/address';
export * from 'ethers/constants';
export * from 'ethers/contract';
export * from 'ethers/crypto';
export * from 'ethers/hash';
export * from 'ethers/providers';
export * from 'ethers/transaction';
export * from 'ethers/utils';
export * from 'ethers/wallet';
export * from 'ethers/wordlists';

import { encodeCashAddress, utf8ToBin, binToHex } from '@bitauth/libauth';
import { hash160 } from '@solidcash/utils';

type Prefix = 'bitcoincash' | 'bchtest' | 'bchreg';
function prefixOf(from: string): Prefix {
  if (typeof from === 'string' && from.includes(':')) {
    const p = from.split(':')[0];
    if (p === 'bitcoincash' || p === 'bchtest' || p === 'bchreg') return p;
  }
  return 'bitcoincash';
}

// A deterministic p2sh CashAddress from a seed string. Distinct seeds => distinct addresses, so precomputed-address
// patterns stay collision-free; this is NOT the real deployed address (see file docs - use contract.getAddress()).
function bchAddressFromSeed(seed: string, prefix: Prefix): string {
  return encodeCashAddress({ prefix, type: 'p2sh', payload: hash160(utf8ToBin(seed)), throwErrors: true }).address;
}

/** BCH redirect for ethers `getCreateAddress({ from, nonce })` (see file docs - identity is category, not nonce). */
export function getCreateAddress(tx: { from: string; nonce: number | bigint }): string {
  return bchAddressFromSeed(`create:${tx.from}:${BigInt(tx.nonce).toString()}`, prefixOf(tx.from));
}

/** BCH redirect for ethers `getCreate2Address(from, salt, initCodeHash)` (the salt maps to our CREATE2 segment). */
export function getCreate2Address(
  from: string, salt: string | Uint8Array, initCodeHash: string | Uint8Array,
): string {
  const saltHex = typeof salt === 'string' ? salt : binToHex(salt);
  const codeHex = typeof initCodeHash === 'string' ? initCodeHash : binToHex(initCodeHash);
  return bchAddressFromSeed(`create2:${from}:${saltHex}:${codeHex}`, prefixOf(from));
}
