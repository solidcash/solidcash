/**
 * Drop-in 'ethers' module for ported hardhat suites (aliased as `ethers`). It re-exports the real ethers API
 * from its subpaths - so a project-wide `ethers` alias does NOT recurse into this file - and overrides only the
 * EVM CREATE-address predictors.
 *
 * Direct deployments expose an authenticated logical CREATE identity derived from the deployer and nonce.
 * Framed deployments expose addrV(category), predicted from their reserved genesis funding UTXO. The runtime's
 * composition convention selects the same address domain as deployment, including forward references used to
 * initialize contracts which call one another.
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

import { cashAddressToLockingBytecode, lockingBytecodeToCashAddress } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { sha256 as sha256Binary } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
// Reach the SDK through its named subpaths rather than through physical `dist` leaf files. The subpath is a
// stable package entry a test can `vi.mock` back onto the sources, which is what keeps a test's reservations
// and this shim's reads in one module instance; a `dist` leaf path can be neither redirected nor deduplicated.
import { deriveLogicalCreateAddress } from '@solidcash/solidcash/stateful';
import {
  findDeploymentByAddress, genesisOutpointKey, isReservedGenesisOutpoint, listDeployments,
  registeredValueAddressLockingBytecode,
} from '@solidcash/solidcash/stateful';
import { Contract as SolidCashContract } from '@solidcash/solidcash';
import { bytecodeToScript, scriptToAsm } from '@solidcash/utils';
import { getActiveProvider } from './network-helpers.js';
import { framedDeploy } from '@solidcash/solidcash/framed';
// CashAddress-aware ABI coder (wins over ethers/utils re-export for defaultAbiCoder / AbiCoder).
// Cycle-free: cash-abi-coder only imports ethers/abi + libauth.
import { AbiCoder as CashAbiCoder, defaultAbiCoder as cashDefaultAbiCoder } from './cash-abi-coder.js';
import { hexlify, toUtf8Bytes, toUtf8String, getBytes, concat, zeroPadValue, zeroPadBytes, isHexString, isBytesLike } from 'ethers/utils';
import { getAddress as ethersGetAddress, isAddress } from 'ethers/address';
import { id, solidityPacked as ethersSolidityPacked, solidityPackedKeccak256 } from 'ethers/hash';
import { cashAddressToEthHex, setCashAddressLockResolver } from './cash-abi-coder.js';

// The SDK presents a registered contract's ABI `address` as its value locking bytecode (the physical execution
// lock for a plain contract, the logical CREATE lock for a kernel participant). Ethers-style expectations must
// hash the same bytes, so route the synthetic identity through the deployment registry instead of decoding the
// cash-address string, whose lock can differ from the value the covenant holds.
setCashAddressLockResolver((addr) => {
  try {
    return registeredValueAddressLockingBytecode(getActiveProvider() as never, addr);
  } catch {
    return undefined;
  }
});
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
export function getAddress(value: string | Uint8Array): string {
  if (typeof value === 'string' && value.includes(':')) return value;
  const hex = (typeof value === 'string' ? value : binToHex(value)).replace(/^0x/i, '');
  const bytes = hexToBin(hex);
  if (bytes.length === 23 || bytes.length === 25 || bytes.length === 35) {
    for (const prefix of ['bchtest', 'bitcoincash', 'bchreg'] as const) {
      const result = lockingBytecodeToCashAddress({ bytecode: bytes, prefix, tokenSupport: false });
      if (typeof result === 'string') return result;
      if (result && typeof result === 'object' && 'address' in result) {
        return (result as { address: string }).address;
      }
    }
  }
  return ethersGetAddress(`0x${hex}`);
}

/** CashAddress-aware `solidityPacked`, matching the compiler's `abi.encodePacked` address form. */
export function solidityPacked(types: readonly string[], values: readonly unknown[]): string {
  const mapped = values.map((value, index) => {
    const type = types[index];
    if (type === 'address' && typeof value === 'string' && /^(bitcoincash|bchtest|bchreg):/i.test(value)) {
      return cashAddressToEthHex(value);
    }
    if (type === 'address[]' && Array.isArray(value)) {
      return value.map((entry) => (typeof entry === 'string' && /^(bitcoincash|bchtest|bchreg):/i.test(entry))
        ? cashAddressToEthHex(entry) : entry);
    }
    return value;
  });
  return ethersSolidityPacked(types, mapped);
}

/**
 * ethers.Contract shim that accepts BCH CashAddresses without ENS name resolution.
 * MistSwap KashiPair.init does `new ethers.Contract(await pair.asset(), ERC20abi, signer)`.
 * Real ethers v6 Contract resolves the address as an ENS name and throws UNSUPPORTED_OPERATION.
 * Methods are lazily resolved via hre.ethers.getContractAt when possible.
 */
export class Contract {
  readonly target: string;
  readonly address: string;
  runner: unknown;
  interface: unknown;

  constructor(
    address: string | Uint8Array | { toString(): string },
    abi?: unknown,
    runner?: unknown,
  ) {
    // StatefulContract address state returns locking bytecode (Uint8Array). Encode as cashaddr so
    // findDeploymentByAddress / getContractAt can resolve the live instance (KashiPair.init asset/collateral).
    let addr: string;
    if (typeof address === 'string') {
      addr = address;
    } else if (address instanceof Uint8Array) {
      try {
        // Dynamic import avoided in ctor; use hex form for registry LBC lookup.
        addr = Array.from(address).map((b) => b.toString(16).padStart(2, '0')).join('');
      } catch {
        addr = String(address);
      }
    } else {
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
        if (prop === 'then') return undefined; // not thenable
        return async (...args: unknown[]) => {
          const hre = (globalThis as { hre?: {
            ethers?: {
              getContractAt?: (name: string, address: string) => Promise<Record<string, unknown>>;
              provider?: unknown;
            };
          } }).hre;
          // Prefer live registry hit (KashiPair.init does new ethers.Contract(await pair.asset(), ERC20abi)).
          try {
            const solidcash = await import('@solidcash/solidcash/stateful');
            const provider = hre?.ethers?.provider as {
              getUtxos?: (a: string) => Promise<Array<{ token?: { category?: string; nft?: { capability?: string } } }>>;
            } | undefined;
            if (provider) {
              let hit = solidcash.findDeploymentByAddress?.(provider as never, target.address)
                ?? solidcash.findDeploymentByLockingBytecode?.(provider as never, target.address);
              // Address may be raw locking-bytecode hex (from Uint8Array state) without 0x.
              if (!hit && /^[0-9a-fA-F]{40,}$/.test(target.address)) {
                hit = solidcash.findDeploymentByLockingBytecode?.(provider as never, target.address);
              }
              let c = hit?.contract as Record<string, unknown> | undefined;
              // Re-pin category from on-chain minting NFT when the registered handle is stale
              // (category mismatch → "Expected N data NFT(s) … found 0").
              if (c && solidcash.StatefulContract && typeof provider.getUtxos === 'function') {
                try {
                  const tokenAddr = (c as { tokenAddress?: string }).tokenAddress ?? target.address;
                  const utxos = await provider.getUtxos(tokenAddr);
                  const master = utxos.find((u) => u.token?.nft?.capability === 'minting');
                  const cat = master?.token?.category;
                  const inner = (c as { inner?: unknown }).inner;
                  if (cat && inner && typeof solidcash.StatefulContract.withCategory === 'function') {
                    const pinned = solidcash.StatefulContract.withCategory(
                      inner as never, cat,
                    ) as unknown as Record<string, unknown>;
                    c = pinned;
                  }
                } catch { /* keep original handle */ }
              }
              if (c) {
                // Rebind runner when present (pairHelper.asset.connect(alice) patterns).
                let inst = c;
                if (target.runner && typeof (c as { connect?: (r: unknown) => unknown }).connect === 'function') {
                  try {
                    inst = (c as { connect: (r: unknown) => Record<string, unknown> }).connect(target.runner);
                  } catch { /* keep original */ }
                }
                const bare = inst[prop as string];
                if (typeof bare === 'function') {
                  return (bare as (...a: unknown[]) => unknown).apply(inst, args);
                }
                const callNs = inst.call as Record<string, unknown> | undefined;
                const viaCall = callNs?.[prop as string];
                if (typeof viaCall === 'function') {
                  return (viaCall as (...a: unknown[]) => unknown).apply(inst, args);
                }
              }
            }
          } catch { /* fall through to getContractAt candidates */ }
          const candidates = [
            'ReturnFalseERC20Mock', 'RevertingERC20Mock', 'ERC20Mock', 'SushiToken',
            'WETH9Mock', 'BentoBoxMock', 'KashiPairMock',
          ];
          if (hre?.ethers?.getContractAt) {
            for (const name of candidates) {
              try {
                const c = await hre.ethers.getContractAt(name, target.address) as Record<string, unknown>;
                const fn = c[prop as string];
                if (typeof fn === 'function') {
                  return (fn as (...a: unknown[]) => unknown).apply(c, args);
                }
                const viaCall = (c.call as Record<string, unknown> | undefined)?.[prop as string];
                if (typeof viaCall === 'function') {
                  return (viaCall as (...a: unknown[]) => unknown).apply(c, args);
                }
              } catch { /* try next artifact */ }
            }
          }
          throw new Error(
            `ethers.Contract shim: no method '${String(prop)}' for ${target.address}. `
            + 'Register the contract artifact or use getContractAt/attach.',
          );
        };
      },
    });
  }

  connect(runner: unknown): Contract {
    return new Contract(this.address, this.interface, runner);
  }

  async getAddress(): Promise<string> {
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

/**
 * Predict the address exposed by the selected deployment convention. An unspecified standalone convention
 * retains a caller's explicit framed look-ahead; HRE connections always supply their resolved convention.
 */
export function getCreateAddressForComposition(
  tx: { from: string; nonce: number | bigint }, composition?: 'direct' | 'framed',
): string {
  // A nonce read reserves genesis funding in either convention. The reservation does not select the address
  // domain: direct deployments expose logical CREATE identities, while framed deployments expose addrV(category).
  if (composition !== 'direct' && framedDeploy.createLookaheadForAddress(tx.from) !== undefined) {
    return binToHex(framedDeploy.predictCreateAddress(tx.from, tx.nonce));
  }
  return deriveLogicalCreateAddress(tx.from, tx.nonce);
}

export function getCreateAddress(tx: { from: string; nonce: number | bigint }): string {
  // Keep this read cycle-free: hre.ts imports the ethers shim and publishes its active resolved configuration
  // on the same process-global slot. A standalone shim without an HRE retains its explicit look-ahead behavior.
  const config = (globalThis as { __solidcashActiveHre?: {
    config: { composition?: 'direct' | 'framed'; compiler?: { composition?: unknown } };
  } }).__solidcashActiveHre?.config;
  const composition = config === undefined ? undefined
    : config.composition ?? config.compiler?.composition ?? 'direct';
  return getCreateAddressForComposition(tx,
    composition === 'direct' || composition === 'framed' ? composition : undefined);
}

/** BCH redirect for ethers `getCreate2Address(from, salt, initCodeHash)` (the salt maps to our CREATE2 segment). */
export function getCreate2Address(
  from: string, salt: string | Uint8Array, initCodeHash: string | Uint8Array,
): string {
  const saltHex = (typeof salt === 'string' ? salt : binToHex(salt)).replace(/^0x/i, '').toLowerCase();
  if ((globalThis as any).process?.env?.DEBUG_CREATE2) console.error('GET_CREATE2_CALLED', from, saltHex);
  const codeHex = typeof initCodeHash === 'string' ? initCodeHash : binToHex(initCodeHash);
  // An unmodified Solidity `UniswapV2Library.pairFor` hashes the canonical pair init-code hash. That caller is
  // asking for the EVM CREATE2 *identity*, not for the BCH child a factory will deploy (whose address also
  // commits to a funding category), so answer the identity directly.
  const codeClean = codeHex.replace(/^0x/i, '').toLowerCase();
  if (CANONICAL_PAIR_INIT_CODE_HASHES.includes(codeClean)) {
    return evmCreate2Identity(from, saltHex, codeClean);
  }
  try {
    const provider = getActiveProvider() as any;
    const parent = findDeploymentByAddress(provider, from);
    // A child this session already created is the exact answer: its address commits to the funding coin's
    // category, which a pure salt hash cannot reconstruct after the coin is spent.
    const registered = [...listDeployments(provider)].reverse().find((entry) => (
      entry.salt?.toLowerCase() === saltHex
      && entry.parentAddress !== undefined
      && (entry.parentAddress === (parent?.address ?? from)
        || (parent?.lockingBytecode !== undefined && entry.parentLockingBytecode === parent.lockingBytecode))
    ));
    if (registered) return registered.address;
    const predicted = process.env.DISABLE_PREDICT
      ? undefined
      : predictFactoryChildAddress(provider, parent?.contract, saltHex);
    if ((globalThis as any).process?.env?.DEBUG_CREATE2) {
      console.error('GET_CREATE2', JSON.stringify({
        from, saltHex, parent: parent ? [parent.address, parent.contractName] : null, predicted,
        contractKeys: parent?.contract ? Object.keys(parent.contract as object).slice(0, 20) : null,
      }));
    }
    if (predicted) return predicted;
  } catch (error) {
    if ((globalThis as any).process?.env?.DEBUG_CREATE2) console.error('GET_CREATE2_ERROR', String(error));
    /* not a BCH deployment context: fall back to the deterministic placeholder */
  }
  // No deployment can be predicted yet: answer the EVM CREATE2 address itself, which is what an unmodified
  // Solidity `pairFor`/`create2` consumer derives from the factory and salt. This is the same 20-byte identity
  // lane the SDK decodes an address value to, so a contract-computed hash and its test-side expectation agree.
  return evmCreate2Identity(from, saltHex, codeClean);
}

/** Canonical Uniswap/SushiSwap pair init-code hashes an EVM `pairFor` hard-codes. */
const CANONICAL_PAIR_INIT_CODE_HASHES = [
  'e18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303',
  '96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
];

/** `keccak256(0xff ++ factoryIdentity ++ salt ++ initCodeHash)[12:]` as a 20-byte hex identity. */
function evmCreate2Identity(from: string, saltHex: string, codeHex: string): string {
  const fromHex = (() => {
    try {
      return cashAddressToEthHex(from).replace(/^0x/i, '').toLowerCase().padStart(40, '0').slice(-40);
    } catch {
      return from.replace(/^0x/i, '').toLowerCase().padStart(40, '0').slice(-40);
    }
  })();
  const saltWord = saltHex.padStart(64, '0').slice(-64);
  const codeWord = codeHex.replace(/^0x/i, '').toLowerCase().padStart(64, '0').slice(-64);
  const hash = keccak256(`0x${'ff'}${fromHex}${saltWord}${codeWord}`);
  return `0x${hash.slice(-40)}`;
}

/**
 * Predict the next stateful child a factory's deploy function will create. The child's p2sh32 address commits to
 * its category, which is the txid of the genesis funding coin `deployFrom` selects; mirror that selection (the
 * same signer, the same ordered UTXO set, the same vout-0/token-free/cost rules) and build the child script.
 */
function predictFactoryChildAddress(provider: any, factory: any, saltHex: string): string | undefined {
  const artifact = factory?.inner?.artifact;
  const deployFn = artifact?.abi?.find((candidate: any) => (candidate.deployTargets?.length ?? 0) > 0);
  const target = deployFn?.deployTargets?.[0];
  const childArtifact = target && factory?._getChild?.(target.contractName);
  const signer = factory?._signer;
  const indexer = provider?.indexer;
  if ((globalThis as any).process?.env?.DEBUG_CREATE2) {
    console.error('PREDICT_INPUTS', JSON.stringify({
      hasTarget: !!target, hasChild: !!childArtifact, signer: !!signer, indexer: !!indexer,
      deployFn: deployFn?.name, childName: target?.contractName,
      factoryKeys: factory ? Object.keys(factory).slice(0, 12) : null,
      canGetChild: typeof factory?._getChild,
    }));
  }
  if (!target || !childArtifact || !signer || !indexer) return undefined;
  if ((globalThis as any).process?.env?.DEBUG_CREATE2) {
    console.error('PREDICT_SIGNER', Object.keys(signer), typeof signer.address, signer.address,
      'proto', Object.getOwnPropertyNames(Object.getPrototypeOf(signer)));
  }
  const signerLock: Uint8Array = typeof signer.generateLockingBytecode === 'function'
    ? signer.generateLockingBytecode()
    : (() => {
      const decoded = cashAddressToLockingBytecode(signer.address);
      if (typeof decoded === 'string') throw new Error('prediction signer has no locking bytecode');
      return decoded.bytecode;
    })();
  const dataNfts = BigInt(childArtifact.stateLayout?.dataNftCount ?? target.dataNftCount ?? 1);
  const cost = 1200n + 1200n * dataNfts + 5000n + 2400n;
  const entries = indexer.getUtxos(binToHex(sha256Binary.hash(signerLock))) as Array<{
    outpoint: { txid: string; vout: number }; satoshis: bigint; tokenData?: unknown;
  }>;
  if ((globalThis as any).process?.env?.DEBUG_CREATE2) {
    console.error('PREDICT_UTXOS', signer.address, entries.length,
      entries.filter((entry) => entry.outpoint.vout === 0 && !entry.tokenData).slice(0, 8)
        .map((entry) => [entry.outpoint.txid, entry.outpoint.vout, String(entry.satoshis)]));
  }
  const funding = entries.find((entry) => entry.outpoint.vout === 0 && entry.tokenData === undefined
    && entry.satoshis >= cost
    && !isReservedGenesisOutpoint(genesisOutpointKey(entry.outpoint.txid, entry.outpoint.vout)));
  if (!funding) return undefined;
  const effectiveArtifact = {
    ...childArtifact,
    bytecode: scriptToAsm(bytecodeToScript(hexToBin(target.creationBytecode))),
  };
  const child = new SolidCashContract(effectiveArtifact as any, [], {
    provider,
    addressType: 'p2sh32',
    category: hexToBin(funding.outpoint.txid),
    salt: hexToBin(saltHex),
  } as any) as any;
  if ((globalThis as any).process?.env?.DEBUG_CREATE2) {
    console.error('PREDICT_CHILD', JSON.stringify({
      category: funding.outpoint.txid, salt: saltHex, address: child.address,
      bytecodeLen: child.bytecode.length / 2,
    }));
  }
  return child.address;
}
