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
import { binToHex, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { deriveLogicalAddressFromSeed, deriveLogicalCreateAddress } from 'solidcash';
// CashAddress-aware ABI coder (wins over ethers/utils re-export for defaultAbiCoder / AbiCoder).
// Cycle-free: cash-abi-coder only imports ethers/abi + libauth.
import { AbiCoder as CashAbiCoder, defaultAbiCoder as cashDefaultAbiCoder } from './cash-abi-coder.js';
import { hexlify, toUtf8Bytes, toUtf8String, getBytes, concat, zeroPadValue, zeroPadBytes, isHexString, isBytesLike } from 'ethers/utils';
import { getAddress as ethersGetAddress, isAddress } from 'ethers/address';
import { id, solidityPacked, solidityPackedKeccak256 } from 'ethers/hash';
import { keccak256, sha256, ripemd160 } from 'ethers/crypto';
import { parseUnits, formatUnits, parseEther, formatEther } from 'ethers/utils';
// units may live on ethers root in some versions — import carefully without bare `ethers` (aliased to this file).
import { computeAddress } from 'ethers/transaction';
// ethers-v5 BigNumber shim (MistSwap utilities `const { BigNumber } = require("ethers")`).
// Import from a cycle-free path: ethers-utils imports getCreate* from this file, so only pull BigNumber.
import { BigNumber as CashBigNumber } from './ethers-bignumber.js';
export { CashAbiCoder as AbiCoder, cashDefaultAbiCoder as defaultAbiCoder, CashBigNumber as BigNumber };
/**
 * ethers.getAddress for BCH event payloads. Unmodified Solidity helpers pass a locking-bytecode
 * hex (`0x76a914…88ac`); return the matching CashAddress so it compares equal to signer.getAddress().
 */
export function getAddress(value) {
    if (typeof value === 'string' && value.includes(':'))
        return value;
    const hex = (typeof value === 'string' ? value : binToHex(value)).replace(/^0x/i, '');
    const bytes = hexToBin(hex);
    if (bytes.length === 23 || bytes.length === 25 || bytes.length === 35) {
        for (const prefix of ['bchtest', 'bitcoincash', 'bchreg']) {
            const result = lockingBytecodeToCashAddress({ bytecode: bytes, prefix, tokenSupport: false });
            if (typeof result === 'string')
                return result;
            if (result && typeof result === 'object' && 'address' in result) {
                return result.address;
            }
        }
    }
    return ethersGetAddress(`0x${hex}`);
}
/**
 * ethers.Contract shim that accepts BCH CashAddresses without ENS name resolution.
 * MistSwap KashiPair.init does `new ethers.Contract(await pair.asset(), ERC20abi, signer)`.
 * Real ethers v6 Contract resolves the address as an ENS name and throws UNSUPPORTED_OPERATION.
 * Methods are lazily resolved via hre.ethers.getContractAt when possible.
 */
export class Contract {
    constructor(address, abi, runner) {
        // StatefulContract address state returns locking bytecode (Uint8Array). Encode as cashaddr so
        // findDeploymentByAddress / getContractAt can resolve the live instance (KashiPair.init asset/collateral).
        let addr;
        if (typeof address === 'string') {
            addr = address;
        }
        else if (address instanceof Uint8Array) {
            try {
                // Dynamic import avoided in ctor; use hex form for registry LBC lookup.
                addr = Array.from(address).map((b) => b.toString(16).padStart(2, '0')).join('');
            }
            catch {
                addr = String(address);
            }
        }
        else {
            addr = String(address);
        }
        this.target = addr;
        this.address = addr;
        this.runner = runner;
        this.interface = abi ?? {};
        // eslint-disable-next-line no-constructor-return
        return new Proxy(this, {
            get: (target, prop, receiver) => {
                if (typeof prop === 'symbol' || prop in target) {
                    return Reflect.get(target, prop, receiver);
                }
                if (prop === 'then')
                    return undefined; // not thenable
                return async (...args) => {
                    const hre = globalThis.hre;
                    // Prefer live registry hit (KashiPair.init does new ethers.Contract(await pair.asset(), ERC20abi)).
                    try {
                        const solidcash = await import('solidcash');
                        const provider = hre?.ethers?.provider;
                        if (provider) {
                            let hit = solidcash.findDeploymentByAddress?.(provider, target.address)
                                ?? solidcash.findDeploymentByLockingBytecode?.(provider, target.address);
                            // Address may be raw locking-bytecode hex (from Uint8Array state) without 0x.
                            if (!hit && /^[0-9a-fA-F]{40,}$/.test(target.address)) {
                                hit = solidcash.findDeploymentByLockingBytecode?.(provider, target.address);
                            }
                            let c = hit?.contract;
                            // Re-pin category from on-chain minting NFT when the registered handle is stale
                            // (category mismatch → "Expected N data NFT(s) … found 0").
                            if (c && solidcash.StatefulContract && typeof provider.getUtxos === 'function') {
                                try {
                                    const tokenAddr = c.tokenAddress ?? target.address;
                                    const utxos = await provider.getUtxos(tokenAddr);
                                    const master = utxos.find((u) => u.token?.nft?.capability === 'minting');
                                    const cat = master?.token?.category;
                                    const inner = c.inner;
                                    if (cat && inner && typeof solidcash.StatefulContract.withCategory === 'function') {
                                        const pinned = solidcash.StatefulContract.withCategory(inner, cat);
                                        c = pinned;
                                    }
                                }
                                catch { /* keep original handle */ }
                            }
                            if (c) {
                                // Rebind runner when present (pairHelper.asset.connect(alice) patterns).
                                let inst = c;
                                if (target.runner && typeof c.connect === 'function') {
                                    try {
                                        inst = c.connect(target.runner);
                                    }
                                    catch { /* keep original */ }
                                }
                                const bare = inst[prop];
                                if (typeof bare === 'function') {
                                    return bare.apply(inst, args);
                                }
                                const callNs = inst.call;
                                const viaCall = callNs?.[prop];
                                if (typeof viaCall === 'function') {
                                    return viaCall.apply(inst, args);
                                }
                            }
                        }
                    }
                    catch { /* fall through to getContractAt candidates */ }
                    const candidates = [
                        'ReturnFalseERC20Mock', 'RevertingERC20Mock', 'ERC20Mock', 'SushiToken',
                        'WETH9Mock', 'BentoBoxMock', 'KashiPairMock',
                    ];
                    if (hre?.ethers?.getContractAt) {
                        for (const name of candidates) {
                            try {
                                const c = await hre.ethers.getContractAt(name, target.address);
                                const fn = c[prop];
                                if (typeof fn === 'function') {
                                    return fn.apply(c, args);
                                }
                                const viaCall = c.call?.[prop];
                                if (typeof viaCall === 'function') {
                                    return viaCall.apply(c, args);
                                }
                            }
                            catch { /* try next artifact */ }
                        }
                    }
                    throw new Error(`ethers.Contract shim: no method '${String(prop)}' for ${target.address}. `
                        + 'Register the contract artifact or use getContractAt/attach.');
                };
            },
        });
    }
    connect(runner) {
        return new Contract(this.address, this.interface, runner);
    }
    async getAddress() {
        return this.address;
    }
}
/** ethers-v5 `ethers.utils` namespace used by MistSwap kashipair/utilities (require("ethers")). */
export const utils = {
    parseUnits, formatUnits, parseEther, formatEther,
    keccak256, sha256, ripemd160, id, computeAddress,
    toUtf8Bytes, toUtf8String, getBytes, arrayify: getBytes, hexlify, concat, zeroPadValue, zeroPadBytes,
    isHexString, isBytesLike, getAddress, isAddress,
    // Prefer BCH getCreate2Address (defined below).
    get getCreate2Address() { return getCreate2Address; },
    solidityPack: solidityPacked,
    solidityKeccak256: solidityPackedKeccak256,
    defaultAbiCoder: cashDefaultAbiCoder,
    AbiCoder: CashAbiCoder,
};
function prefixOf(from) {
    if (typeof from === 'string' && from.includes(':')) {
        const p = from.split(':')[0];
        if (p === 'bitcoincash' || p === 'bchtest' || p === 'bchreg')
            return p;
    }
    return 'bitcoincash';
}
/** BCH redirect for ethers `getCreateAddress({ from, nonce })` (see file docs - identity is category, not nonce). */
export function getCreateAddress(tx) {
    return deriveLogicalCreateAddress(tx.from, tx.nonce);
}
/** BCH redirect for ethers `getCreate2Address(from, salt, initCodeHash)` (the salt maps to our CREATE2 segment). */
export function getCreate2Address(from, salt, initCodeHash) {
    const saltHex = typeof salt === 'string' ? salt : binToHex(salt);
    const codeHex = typeof initCodeHash === 'string' ? initCodeHash : binToHex(initCodeHash);
    // CREATE2 remains a deterministic compatibility placeholder until its separate salt registry is implemented.
    return deriveLogicalAddressFromSeed(`create2:${from}:${saltHex}:${codeHex}`, prefixOf(from));
}
//# sourceMappingURL=ethers-shim.js.map