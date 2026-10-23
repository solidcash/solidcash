import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate, Signer, TransactionBuilder } from '../../src/index.js';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import type NetworkProvider from '../../src/network/NetworkProvider.js';
import { getContractFactory } from '../../src/stateful/index.js';
import type { StatefulContract } from '../../src/stateful/StatefulContract.js';
import { deployFramedProxy } from '../../src/framed/proxy/index.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub, bobPriv } from '../fixture/vars.js';
import { fundShippedFacets } from './shapes/harness.js';

/**
 * Audit SDKFRAMED-1 and SDKFRAMED-2: the coins a framed deployment signs for are proven before anything is signed.
 *
 * SDKFRAMED-1: a genesis takes its category from the funding coin's txid, so a coin a provider lists at the
 * deployer's address but that sits at another lock would hand the category to that lock's owner. The deployment
 * proves the coin from its transaction (or the simulator's own ledger) and refuses before signing.
 * SDKFRAMED-2: a proxy's initialize hop is a separate transaction after both geneses; a hop refusal the SDK can
 * know up front (a caller funder off the caller lock, a caller coin not at it) is raised before either genesis.
 */

const BOX_SOURCE = [
  'pragma solidity ^0.8.20;',
  'abstract contract Owned {',
  '  address private _owner;',
  '  constructor(address initialOwner) { _owner = initialOwner; }',
  '  function owner() public view virtual returns (address) { return _owner; }',
  '}',
  'contract Box is Owned {',
  '  uint256 public value;',
  '  constructor() Owned(msg.sender) {}',
  '  function setValue(uint256 v) public { value = v; }',
  '}',
].join('\n');

const box: Artifact = compileStringMulti(BOX_SOURCE, { evmCompat: true, composition: 'framed' } as never).Box!;

const SHARED_STATE = ' address public implementation; uint public initialized;';
const PROXY_SOURCE = 'pragma solidcash ^0.14.0;'
  + ` contract Impl {${SHARED_STATE}`
  + '   function initialize(address expected) {'
  + '     require(msg.sender == expected);'
  + '     require(this.initialized == 0);'
  + '     this.initialized = 1;'
  + '   }'
  + ' }'
  + ` contract Proxy {${SHARED_STATE}`
  + '   fallback(bytes input) external { this.implementation.delegatecall(input); require(true); }'
  + ' }';

let serial = 0;

/** A synthetic vout-0 coin the mock ledger holds at `address`, backed by no transaction. */
async function ledgerCoin(provider: MockNetworkProvider, address: string, satoshis = 5_000_000n): Promise<Utxo> {
  serial += 1;
  const utxo = { txid: `a5${serial.toString(16).padStart(6, '0')}`.padEnd(64, 'e'), vout: 0, satoshis };
  await provider.addUtxo(address, utxo);
  return utxo;
}

/** A vout-0 coin at `signer`'s own lock, created by a real transaction whose bytes the mock serves. */
async function realCoin(provider: MockNetworkProvider, signer: Signer): Promise<Utxo> {
  const source = await ledgerCoin(provider, signer.getAddress());
  const builder = new TransactionBuilder({ provider });
  builder.addInput(source, signer.unlockP2PKH());
  builder.addOutput({ to: signer.getAddress(), amount: source.satoshis - 2_000n });
  const sent = await builder.send();
  return { txid: sent.txid, vout: 0, satoshis: source.satoshis - 2_000n };
}

/** A provider that lists `listed` as the only coin at `address`, and counts the broadcasts it is asked for. */
function lyingProvider(
  provider: MockNetworkProvider, address: string, listed: Utxo,
): { readonly provider: NetworkProvider; readonly broadcasts: () => number } {
  let count = 0;
  const wrapped = new Proxy(provider, {
    get(target, key): unknown {
      if (key === 'getUtxos') {
        return async (at: string): Promise<Utxo[]> => (at === address ? [listed] : target.getUtxos(at));
      }
      const value: unknown = Reflect.get(target, key, target);
      if (key === 'sendRawTransaction' || key === 'sendPreparedTransaction') {
        const send = value as (...args: unknown[]) => Promise<string>;
        return async (...args: unknown[]): Promise<string> => {
          count += 1;
          return send.apply(target, args);
        };
      }
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { provider: wrapped, broadcasts: () => count };
}

async function chain(): Promise<MockNetworkProvider> {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  await fundShippedFacets(provider);
  return provider;
}

const DEPLOYER_KEY = new Uint8Array(32).fill(0xe1);
const ATTACKER_KEY = new Uint8Array(32).fill(0xe2);

describe('audit SDKFRAMED-1: the genesis coin is proven at the deployer\'s own lock before signing', () => {
  it('refuses a real coin a provider lists at the deployer but that sits at the attacker\'s lock', async () => {
    const provider = await chain();
    const attacker = new Signer(ATTACKER_KEY, provider);
    const foreign = await realCoin(provider, attacker);
    expect(await provider.getRawTransaction(foreign.txid)).toMatch(/^[0-9a-f]+$/);
    const lying = lyingProvider(provider, new Signer(DEPLOYER_KEY, provider).getAddress(), foreign);
    const deployer = new Signer(DEPLOYER_KEY, lying.provider);

    await expect(getContractFactory(box, deployer).deploy()).rejects.toThrow(/sits at .*not the funder's own lock/);
    expect(lying.broadcasts()).toBe(0);
    expect(await provider.getUtxosByTokenCategory(foreign.txid)).toStrictEqual([]);
    expect((await provider.getUtxos(attacker.getAddress())).map((utxo) => utxo.txid)).toContain(foreign.txid);
  }, 600_000);

  it('refuses a simulator coin listed at the deployer that the ledger holds at another lock', async () => {
    const provider = await chain();
    const foreign = await ledgerCoin(provider, new Signer(ATTACKER_KEY, provider).getAddress());
    const lying = lyingProvider(provider, new Signer(DEPLOYER_KEY, provider).getAddress(), foreign);
    const deployer = new Signer(DEPLOYER_KEY, lying.provider);

    await expect(getContractFactory(box, deployer).deploy()).rejects.toThrow(/sits at .*not the funder's own lock/);
    expect(lying.broadcasts()).toBe(0);
    expect(await provider.getUtxosByTokenCategory(foreign.txid)).toStrictEqual([]);
  }, 600_000);

  it('refuses the deployer\'s own coin listed with a value its transaction does not carry', async () => {
    const provider = await chain();
    const own = await realCoin(provider, new Signer(DEPLOYER_KEY, provider));
    const lying = lyingProvider(
      provider, new Signer(DEPLOYER_KEY, provider).getAddress(), { ...own, satoshis: own.satoshis + 1_000n });
    const deployer = new Signer(DEPLOYER_KEY, lying.provider);

    await expect(getContractFactory(box, deployer).deploy()).rejects.toThrow(/holds \d+ satoshis, not the \d+/);
    expect(lying.broadcasts()).toBe(0);
    expect(await provider.getUtxosByTokenCategory(own.txid)).toStrictEqual([]);
  }, 600_000);

  it('deploys honestly from a real coin and from a simulator coin at the deployer\'s own lock', async () => {
    const provider = await chain();
    const deployer = new Signer(DEPLOYER_KEY, provider);
    const own = await realCoin(provider, deployer);
    const fromReal = await getContractFactory(box, deployer).deploy() as unknown as StatefulContract;
    expect(fromReal.categoryId).toBe(own.txid);
    expect((await provider.getUtxosByTokenCategory(own.txid)).length).toBeGreaterThan(0);

    const owner = new Signer(new Uint8Array(32).fill(0xe3), provider);
    const coin = await ledgerCoin(provider, owner.getAddress());
    const fromLedger = await getContractFactory(box, owner).deploy() as unknown as StatefulContract;
    expect(fromLedger.categoryId).toBe(coin.txid);
    expect((await provider.getUtxosByTokenCategory(coin.txid)).length).toBeGreaterThan(0);
  }, 600_000);
});

describe('audit SDKFRAMED-2: a hop the SDK can refuse up front is refused before either genesis', () => {
  const artifacts = compileStringMulti(PROXY_SOURCE, { composition: 'framed' });
  const signature = new SignatureTemplate(alicePriv);
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);

  async function proxyChain(): Promise<{
    readonly network: MockNetworkProvider;
    readonly options: Omit<Parameters<typeof deployFramedProxy>[0], 'callerFunding'>;
    readonly geneses: readonly Utxo[];
  }> {
    const network = await chain();
    const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
    const implFunding = await ledgerCoin(network, wallet.address, 500_000n);
    const proxyFunding = await ledgerCoin(network, wallet.address, 500_000n);
    const funder = wallet.unlock.spend(alicePub, signature);
    return {
      network,
      geneses: [implFunding, proxyFunding],
      options: {
        provider: network,
        implementationArtifact: artifacts.Impl!,
        proxyArtifact: artifacts.Proxy!,
        implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress: wallet.address },
        proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress: wallet.address },
        initialize: { functionName: 'initialize', args: [deployerLock] },
        callerLockingBytecode: deployerLock,
        vm: compositionMachine(),
      },
    };
  }

  async function expectNoGenesis(network: MockNetworkProvider, geneses: readonly Utxo[]): Promise<void> {
    for (const coin of geneses) expect(await network.getUtxosByTokenCategory(coin.txid)).toStrictEqual([]);
  }

  it('refuses a caller funder that signs for another lock before broadcasting either genesis', async () => {
    const { network, options, geneses } = await proxyChain();
    const callerUtxo = await ledgerCoin(network, binToHex(deployerLock), 100_000n);
    await expect(deployFramedProxy({
      ...options, initializeAs: 'hop',
      callerFunding: { utxo: callerUtxo, funder: new SignatureTemplate(bobPriv).unlockP2PKH() },
    })).rejects.toThrow(/not the hop's caller lock/);
    await expectNoGenesis(network, geneses);
  }, 600_000);

  it('refuses a caller coin that does not sit at the caller lock before broadcasting either genesis', async () => {
    const { network, options, geneses } = await proxyChain();
    const elsewhere = await ledgerCoin(network, new Signer(ATTACKER_KEY, network).getAddress(), 100_000n);
    await expect(deployFramedProxy({
      ...options, initializeAs: 'hop', callerFunding: { utxo: elsewhere, funder: signature.unlockP2PKH() },
    })).rejects.toThrow(/sits at .*not the caller's own lock/);
    await expectNoGenesis(network, geneses);
  }, 600_000);

  it('still deploys and initializes when the caller coin is the deployer\'s own', async () => {
    const { network, options } = await proxyChain();
    const callerUtxo = await ledgerCoin(network, binToHex(deployerLock), 100_000n);
    const deployment = await deployFramedProxy({
      ...options, callerFunding: { utxo: callerUtxo, funder: signature.unlockP2PKH() },
    });
    expect(deployment.initialize.accepted).toBe(true);
    expect(deployment.initialize.broadcast).toBeDefined();
  }, 600_000);
});
