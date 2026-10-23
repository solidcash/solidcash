import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hash256, hexToBin } from '@bitauth/libauth';
import { buildPushdataCommitment, validatorAddress, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../src/index.js';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import type NetworkProvider from '../../src/network/NetworkProvider.js';
import { deployStatefulContract } from '../../src/stateful/sc-deploy.js';
import { readFramedState, stateRecordLockingBytecode } from '../../src/framed/deploy/index.js';
import {
  FramedProxyDeployError, buildProxyArtifact, callFramedProxyEntry, deployFramedProxy,
  type FramedProxyCallerFunding,
} from '../../src/framed/proxy/index.js';
import type { FramedProxyExternal } from '../../src/framed/proxy/external-calls.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub, bobPkh, bobPriv } from '../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from './shapes/harness.js';

/**
 * Audit SDKFRAMED-2: a framed proxy is minted initialized, so no uninitialized proxy is ever on chain.
 *
 * `initialize` is the proxy's constructor frame: it is derived against a probe of the proxy's genesis that is never
 * broadcast, and the genesis that is broadcast mints the records as `initialize` left them. A deployment is the
 * implementation's genesis and that one proxy genesis; a reverting initializer broadcasts nothing. An initializer
 * that calls another contract is the documented exception, run only when asked for as a separate hop.
 */

const STATE = ' address public implementation; uint public initialized;';
const WRITER_CATEGORY = 'a4'.repeat(31) + '5b';
const WRITER = validatorAddress(hexToBin(WRITER_CATEGORY), VALIDATOR_PROGRAM);
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IWriter { function bump(); }'
  + ' contract Writer { int public count; function bump() { this.count = this.count + 1; require(this.count > 0); } }'
  + ` contract Impl {${STATE}`
  + '   function initialize(address expected) {'
  + '     require(msg.sender == expected);'
  + '     require(this.initialized == 0, "already initialized");'
  + '     this.initialized = 1;'
  + '   }'
  + ' }'
  + ` contract Stuck {${STATE}`
  + '   function initialize(address expected) {'
  + '     require(msg.sender == expected);'
  + '     require(this.initialized == 7, "not ready");'
  + '     this.initialized = 1;'
  + '   }'
  + ' }'
  + ` contract Calling {${STATE}`
  + '   function initialize(address expected) {'
  + `     IWriter(0x${binToHex(WRITER)}).bump();`
  + '     require(msg.sender == expected);'
  + '   }'
  + ' }'
  // A minted genesis root has no P2PKH caller, so an atomic initializer must not bind msg.sender.
  + ` contract Atomic {${STATE}`
  + '   function initialize() {'
  + `     IWriter(0x${binToHex(WRITER)}).bump();`
  + '   }'
  + ' }'
  + ` contract StuckAtomic {${STATE}`
  + '   function initialize() {'
  + `     IWriter(0x${binToHex(WRITER)}).bump();`
  + '     require(this.initialized == 7, "not ready");'
  + '     this.initialized = 1;'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const signature = new SignatureTemplate(alicePriv);
const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);

/** A provider that records, in order, the txid of every transaction it is asked to broadcast. */
function recording(network: MockNetworkProvider): { readonly provider: NetworkProvider; readonly sent: string[] } {
  const sent: string[] = [];
  const provider = new Proxy(network, {
    get(target, key): unknown {
      const value: unknown = Reflect.get(target, key, target);
      if (key === 'sendRawTransaction' || key === 'sendPreparedTransaction') {
        const send = value as (argument: unknown) => Promise<string>;
        return async (argument: string | { readonly rawHex: string }): Promise<string> => {
          const rawHex = typeof argument === 'string' ? argument : argument.rawHex;
          sent.push(binToHex(hash256(hexToBin(rawHex)).reverse()));
          return send.call(target, argument);
        };
      }
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { provider, sent };
}

interface Funded {
  readonly network: MockNetworkProvider;
  readonly sent: readonly string[];
  readonly geneses: readonly Utxo[];
  readonly caller: Utxo;
  readonly options: Omit<Parameters<typeof deployFramedProxy>[0], 'callerFunding'>;
  readonly callerFunding: FramedProxyCallerFunding;
}

/** A fresh chain with both genesis coins at the deployer's wallet and a hop's coin at its own P2PKH lock. */
async function funded(implementationArtifact: Artifact): Promise<Funded> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  await fundShippedFacets(network);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, signature);
  const implFunding = { txid: 'a1'.repeat(32), vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: 'a2'.repeat(32), vout: 0, satoshis: 500_000n };
  const caller = { txid: 'a3'.repeat(32), vout: 0, satoshis: 100_000n };
  await network.addUtxo(wallet.address, implFunding);
  await network.addUtxo(wallet.address, proxyFunding);
  await network.addUtxo(binToHex(deployerLock), caller);
  const { provider, sent } = recording(network);
  return {
    network,
    sent,
    geneses: [implFunding, proxyFunding],
    caller,
    options: {
      provider,
      implementationArtifact,
      implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress: wallet.address },
      proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress: wallet.address },
      initialize: { functionName: 'initialize', args: [deployerLock] },
      callerLockingBytecode: deployerLock,
      vm: compositionMachine(),
    },
    callerFunding: { utxo: caller, funder: signature.unlockP2PKH() },
  };
}

/** Deploys the writer the calling initializer reaches, at the category its address literal names. */
async function deployWriter(network: MockNetworkProvider): Promise<Readonly<Record<string, FramedProxyExternal>>> {
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const fundingUtxo = { txid: WRITER_CATEGORY, vout: 0, satoshis: 500_000n };
  await network.addUtxo(wallet.address, fundingUtxo);
  await deployStatefulContract(artifacts.Writer!, [], {
    fundingUtxo, funder: wallet.unlock.spend(alicePub, signature), changeAddress: wallet.address, provider: network,
  });
  return { IWriter: { artifact: artifacts.Writer!, categoryId: WRITER_CATEGORY } };
}

/** Whether the hop's coin is still unspent at the deployer's lock. */
async function callerCoinLive({ network, caller }: Funded): Promise<boolean> {
  const live = await network.getUtxosForLockingBytecode(deployerLock);
  return live.some((utxo) => utxo.txid === caller.txid && utxo.vout === caller.vout);
}

/** Nothing reached the provider: no broadcast was asked for, no category exists and the hop's coin is unspent. */
async function expectNothingBroadcast(run: Funded): Promise<void> {
  expect(run.sent).toStrictEqual([]);
  for (const coin of run.geneses) expect(await run.network.getUtxosByTokenCategory(coin.txid)).toStrictEqual([]);
  expect(await callerCoinLive(run)).toBe(true);
}

const layout = buildProxyArtifact(artifacts.Impl!).stateLayout!;

describe('audit SDKFRAMED-2: a framed proxy is minted initialized, so no uninitialized proxy is ever on chain', () => {
  it('broadcasts the implementation genesis and one proxy genesis whose records already carry the state', async () => {
    const run = await funded(artifacts.Impl!);
    const deployment = await deployFramedProxy(run.options);

    expect(run.sent).toStrictEqual([deployment.implementation.tx.txid, deployment.proxy.tx.txid]);
    expect(deployment.initialize.broadcast.txid).toBe(deployment.proxy.tx.txid);
    // The genesis spends only its own funding coin, and no caller coin is needed or touched.
    expect(deployment.proxy.tx.inputs.length).toBe(1);
    expect(await callerCoinLive(run)).toBe(true);
    // Its record outputs are minted as `initialize` left them; none carries the uninitialized state.
    const recordLock = binToHex(stateRecordLockingBytecode(deployment.proxy.categoryId));
    const records = deployment.proxy.tx.outputs.filter((output) => binToHex(output.lockingBytecode) === recordLock);
    const written = buildPushdataCommitment(layout, {
      implementation: deployment.implementation.address, initialized: 1n,
    }, 0);
    expect(records.map((output) => binToHex(output.token!.nft!.commitment))).toStrictEqual([written]);
    expect(binToHex(deployment.initialize.writtenRecordCommitment)).toBe(written);
    const state = await readFramedState(run.network, deployment.proxy.categoryId, layout);
    expect(state.byNft[0]!.initialized).toBe(1n);
  }, 600_000);

  it('leaves no uninitialized state for a later root hop to take: anyone\'s initialize reverts', async () => {
    const run = await funded(artifacts.Impl!);
    const deployment = await deployFramedProxy(run.options);
    const outpoints = async (): Promise<readonly string[]> => (await run.network
      .getUtxosByTokenCategory(deployment.proxy.categoryId)).map((utxo) => `${utxo.txid}:${utxo.vout}`).sort();
    const before = await outpoints();

    // A watcher enters `initialize` naming itself, as it would race an uninitialized proxy's hop.
    const watcherLock = encodeLockingBytecodeP2pkh(bobPkh);
    const coin = { txid: 'b1'.repeat(32), vout: 0, satoshis: 100_000n };
    await run.network.addUtxo(binToHex(watcherLock), coin);
    await expect(callFramedProxyEntry({
      provider: run.network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'initialize',
      args: [watcherLock],
      callerUtxo: coin,
      callerLockingBytecode: watcherLock,
      funder: new SignatureTemplate(bobPriv).unlockP2PKH(),
      vm: compositionMachine(),
    })).rejects.toThrow(/already initialized/);

    expect(await outpoints()).toStrictEqual(before);
    const state = await readFramedState(run.network, deployment.proxy.categoryId, layout);
    expect(state.byNft[0]!.initialized).toBe(1n);
  }, 600_000);

  it('broadcasts nothing when the initializer reverts, so no category exists afterwards', async () => {
    const run = await funded(artifacts.Stuck!);
    await expect(deployFramedProxy(run.options)).rejects.toThrow(/not ready/);
    await expectNothingBroadcast(run);
  }, 600_000);

  it('deploys a calling initializer atomically through the proxy genesis frame, and keeps the hop escape hatch', async () => {
    // The default now runs the Writer's frame inside the proxy's own genesis: one proxy genesis whose records
    // already carry the Writer's state change, and no uninitialized proxy genesis is ever broadcast.
    const run = await funded(artifacts.Atomic!);
    const externals = await deployWriter(run.network);
    const deployment = await deployFramedProxy({
      ...run.options, initialize: { functionName: 'initialize' }, externals,
    });
    expect(run.sent).toStrictEqual([deployment.implementation.tx.txid, deployment.proxy.tx.txid]);
    expect(deployment.initialize.broadcast.txid).toBe(deployment.proxy.tx.txid);
    // The genesis spends its own funding coin and the participants its frames run, never the caller's coin.
    expect(deployment.proxy.tx.inputs.some((input) =>
      binToHex(input.outpointTransactionHash) === run.caller.txid)).toBe(false);
    expect(await callerCoinLive(run)).toBe(true);
    const writer = await readFramedState(run.network, WRITER_CATEGORY, artifacts.Writer!.stateLayout!);
    expect(writer.byNft[0]!.count).toBe(1n);
    // The proxy's own genesis still mints its record carrying the implementation's address, as a probe would.
    const recordLock = binToHex(stateRecordLockingBytecode(deployment.proxy.categoryId));
    const records = deployment.proxy.tx.outputs.filter((output) => binToHex(output.lockingBytecode) === recordLock);
    expect(records.map((output) => binToHex(output.token!.nft!.commitment))).toStrictEqual([
      buildPushdataCommitment(layout, { implementation: deployment.implementation.address, initialized: 0n }, 0),
    ]);

    // A caller that binds msg.sender still asks for the separate hop, which broadcasts both geneses and the hop.
    const hopped = await funded(artifacts.Calling!);
    const hoppedExternals = await deployWriter(hopped.network);
    const hoppedDeployment = await deployFramedProxy({
      ...hopped.options, externals: hoppedExternals, initializeAs: 'hop', callerFunding: hopped.callerFunding,
    });
    expect(hopped.sent).toStrictEqual([
      hoppedDeployment.implementation.tx.txid, hoppedDeployment.proxy.tx.txid,
      hoppedDeployment.initialize.broadcast.txid,
    ]);
    const hoppedWriter = await readFramedState(
      hopped.network, WRITER_CATEGORY, artifacts.Writer!.stateLayout!);
    expect(hoppedWriter.byNft[0]!.count).toBe(1n);
  }, 600_000);

  it('broadcasts nothing when a calling initializer reverts inside the genesis frame', async () => {
    const run = await funded(artifacts.StuckAtomic!);
    const externals = await deployWriter(run.network);
    await expect(deployFramedProxy({
      ...run.options, initialize: { functionName: 'initialize' }, externals,
    })).rejects.toThrow(/not ready/);
    await expectNothingBroadcast(run);
  }, 600_000);

  it('runs a separate hop when asked, broadcasting the two geneses and the hop back to back', async () => {
    const run = await funded(artifacts.Impl!);
    const deployment = await deployFramedProxy({
      ...run.options, initializeAs: 'hop', callerFunding: run.callerFunding,
    });

    expect(run.sent).toStrictEqual([
      deployment.implementation.tx.txid, deployment.proxy.tx.txid, deployment.initialize.broadcast.txid,
    ]);
    // The hop spends outputs of both geneses, so this is the one order the chain accepts.
    const spent = new Set(deployment.initialize.broadcast.inputs
      .map((input) => binToHex(input.outpointTransactionHash)));
    expect(spent.has(deployment.implementation.tx.txid)).toBe(true);
    expect(spent.has(deployment.proxy.tx.txid)).toBe(true);
    const state = await readFramedState(run.network, deployment.proxy.categoryId, layout);
    expect(state.byNft[0]!.initialized).toBe(1n);
  }, 600_000);

  it('refuses a separate hop without callerFunding before broadcasting anything', async () => {
    const run = await funded(artifacts.Impl!);
    const deployment = deployFramedProxy({ ...run.options, initializeAs: 'hop' });
    await expect(deployment).rejects.toThrow(FramedProxyDeployError);
    await expect(deployment).rejects.toThrow(/needs `callerFunding`/);
    await expectNothingBroadcast(run);
  }, 600_000);

  it('refuses a stranger in the hop window, then the deployer\'s hop initializes the proxy', async () => {
    const run = await funded(artifacts.Impl!);
    const strangerLock = encodeLockingBytecodeP2pkh(bobPkh);
    const strangerCoin = { txid: 'b1'.repeat(32), vout: 0, satoshis: 100_000n };
    await run.network.addUtxo(binToHex(strangerLock), strangerCoin);
    let strangerRefused: string | undefined;
    const deployment = await deployFramedProxy({
      ...run.options,
      initializeAs: 'hop',
      callerFunding: run.callerFunding,
      beforeHopBroadcast: async ({ proxyCategoryId }): Promise<void> => {
        // The two geneses are live, the hop is not: a stranger enters `initialize` naming its own lock.
        try {
          const stranger = await callFramedProxyEntry({
            provider: run.network,
            implementationArtifact: artifacts.Impl!,
            proxyCategoryId,
            implementationCategoryId: run.options.implementationDeploy.fundingUtxo.txid,
            functionName: 'initialize',
            args: [strangerLock],
            callerUtxo: strangerCoin,
            callerLockingBytecode: strangerLock,
            funder: new SignatureTemplate(bobPriv).unlockP2PKH(),
            vm: compositionMachine(),
          });
          expect(stranger.accepted, stranger.verdicts.map((verdict) => verdict.objection).join('; ')).toBe(false);
          expect(stranger.broadcast).toBeUndefined();
        } catch (error) {
          strangerRefused = error instanceof Error ? error.message : String(error);
          expect(strangerRefused).toMatch(/VERIFY|refused|required|sender|initialize/i);
        }
      },
    });

    expect(strangerRefused !== undefined || run.sent.length === 3).toBe(true);
    expect(run.sent).toStrictEqual([
      deployment.implementation.tx.txid, deployment.proxy.tx.txid, deployment.initialize.broadcast.txid,
    ]);
    const state = await readFramedState(run.network, deployment.proxy.categoryId, layout);
    expect(state.byNft[0]!.initialized).toBe(1n);
  }, 600_000);
});
