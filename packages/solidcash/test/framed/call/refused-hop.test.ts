import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { bytesEqual, bytesToHex, validatorAddress, type StateLayout } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry } from '../../../src/framed/proxy/deploy.js';
import type { Utxo } from '../../../src/interfaces.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A hop whose implementation entry refuses.
 *
 * A user's coin enters the proxy's fallback, which delegatecalls the implementation, and the implementation's own
 * guard trips before the entry closes anything. The refusal names the entry's own published reason — or, for a bare
 * guard, the entry and the failing line — rather than the opcode the implementation's frame stopped on.
 *
 * A participant the frames' own runs never evaluate, such as the validator, is judged by the hop's verdict over every
 * input. A hop whose verdicts refuse broadcasts nothing, an initialize hop as much as a call: the verdicts name the
 * participant that refused, and the caller's coin stays unspent. A refused initialize broadcasts neither genesis.
 */

const IMPL_CATEGORY = '66'.repeat(31) + '99';
const PROXY_CATEGORY = '67'.repeat(31) + '98';
const HOP_COIN = { txid: '68'.repeat(32), vout: 0, satoshis: 300_000n };

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' error Short(int requested, int available);'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   uint public initialized;'
  + '   int public total;'
  + '   function initialize(address expected) {'
  + '     require(msg.sender == expected);'
  + '     require(this.initialized == 0);'
  + '     this.initialized = 1;'
  + '     this.total = 5;'
  + '   }'
  + '   function add(int by) { this.total = this.total + by; require(this.total >= 0, "total negative"); }'
  + '   function put(int by) { this.total = this.total + by; require(this.total >= 0); }'
  + '   function take(int by) {'
  + '     int held = this.total;'
  + '     if (by > held) { revert Short(by, held); }'
  + '     this.total = held - by;'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const impl = artifacts.Impl!;

/** The record's own state, read back through the shipped deployment reader and decoded as a field map. */
async function recordState(network: MockNetworkProvider, categoryId: string): Promise<string> {
  const layout: StateLayout = impl.stateLayout!;
  const deployment = await readFramedDeployment(network, categoryId, layout);
  return bytesToHex(new Uint8Array(Buffer.from(deployment.records[0]!.token!.nft!.commitment, 'hex')));
}

/** The objection the refusing machine below states for the validator's input. */
const VALIDATOR_REFUSAL = 'the validator refused';

/**
 * A machine that refuses the validator's input of `categoryId` and judges every other input as the composition
 * machine does. The frames settle on it, since no frame's own run evaluates the validator: only the hop's verdict
 * over every participant meets the refusal.
 */
function refusingValidatorOf(categoryId: string): ReturnType<typeof compositionMachine> {
  const machine = compositionMachine();
  const validatorLock = validatorAddress(hexToBin(categoryId), VALIDATOR_PROGRAM);
  return {
    ...machine,
    evaluate: (program) => {
      const state = machine.evaluate(program);
      const spent = program.sourceOutputs[program.inputIndex]?.lockingBytecode;
      return spent !== undefined && bytesEqual(spent, validatorLock) ? { ...state, error: VALIDATOR_REFUSAL } : state;
    },
  };
}

/** True while `coin` is still an unspent output at `lock`. */
async function unspent(network: MockNetworkProvider, lock: Uint8Array, coin: Utxo): Promise<boolean> {
  return (await network.getUtxosForLockingBytecode(lock))
    .some((utxo) => utxo.txid === coin.txid && utxo.vout === coin.vout);
}

/** A deployment funded from the deployer's own P2PKH lock, plus a coin a caller can enter a hop with. */
async function deployedWithCallerCoin(network: MockNetworkProvider, vm = compositionMachine()): Promise<{
  readonly proxyCategoryId: string;
  readonly implementationCategoryId: string;
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
  readonly hopCoin: Utxo;
  readonly callCoin: { txid: string; vout: number; satoshis: bigint };
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
  readonly initialize: Awaited<ReturnType<typeof deployFramedProxy>>['initialize'];
}> {
  const signature = new SignatureTemplate(alicePriv);
  const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const implFunding = { txid: IMPL_CATEGORY, vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: PROXY_CATEGORY, vout: 0, satoshis: 500_000n };
  const hopCoin = HOP_COIN;
  const callCoin = { txid: '69'.repeat(32), vout: 0, satoshis: 300_000n };
  for (const coin of [implFunding, proxyFunding]) await network.addUtxo(source.address, coin);
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);
  for (const coin of [hopCoin, callCoin]) await network.addUtxo(binToHex(deployerLock), coin);
  // The hops broadcast, so each composition's facet input needs a live UTXO at the facet's lock.
  await fundShippedFacets(network);

  const deployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: impl,
    implementationDeploy: {
      fundingUtxo: implFunding, funder: source.unlock.spend(alicePub, signature), changeAddress: source.address,
    },
    proxyDeploy: {
      fundingUtxo: proxyFunding, funder: source.unlock.spend(alicePub, signature), changeAddress: source.address,
    },
    initialize: { functionName: 'initialize', args: [deployerLock] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: hopCoin, funder: signature.unlockP2PKH(), changeAddress: source.address },
    vm,
  });
  return {
    proxyCategoryId: deployment.proxy.categoryId,
    implementationCategoryId: deployment.implementation.categoryId,
    deployerLock, changeAddress: source.address, hopCoin, callCoin, funder: signature.unlockP2PKH(),
    initialize: deployment.initialize,
  };
}

/** A deployment behind the generated proxy, on the network that holds it. */
interface Deployed {
  readonly network: MockNetworkProvider;
  readonly funded: Awaited<ReturnType<typeof deployedWithCallerCoin>>;
}

let deployedRun: Promise<Deployed> | undefined;

/** One deployment serves every case: each hop is refused before anything is broadcast, so the call coin stays live. */
function sharedDeployment(): Promise<Deployed> {
  deployedRun ??= (async (): Promise<Deployed> => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployedWithCallerCoin(network);
    expect(funded.initialize.broadcast).toBeDefined();
    return { network, funded };
  })();
  return deployedRun;
}

describe('a hop whose implementation entry refuses', () => {
  it('names the entry\'s own message rather than the opcode the implementation frame stopped on', async () => {
    const { network, funded } = await sharedDeployment();
    const before = await recordState(network, funded.proxyCategoryId);

    await expect(callFramedProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'add',
      args: [-100n],
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    })).rejects.toThrow(/total negative/);

    // Nothing was broadcast, so the record is where the initialize hop left it.
    expect(await recordState(network, funded.proxyCategoryId)).toBe(before);
  });

  it('names the entry and the failing line for a bare guard', async () => {
    const { network, funded } = await sharedDeployment();

    await expect(callFramedProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'put',
      args: [-100n],
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    })).rejects.toThrow(/Impl\.put\(\)[\s\S]*at line \d+/);
  });

  it('carries the values the entry\'s custom error was raised with', async () => {
    const { network, funded } = await sharedDeployment();

    const refused = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'take',
      args: [100n],
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    }).then(() => undefined, (error: unknown) => error as { message: string; errorArgs?: readonly unknown[] });

    expect(refused?.message).toMatch(/revert Short\(int256, int256\)/);
    // The initialize hop left `total` at 5, which the entry read and raised beside the amount it was asked for.
    expect(refused?.errorArgs).toStrictEqual([100n, 5n]);
  });

  it('broadcasts nothing when a participant past the frames refuses the call, and names it', async () => {
    const { network, funded } = await sharedDeployment();
    const before = await recordState(network, funded.proxyCategoryId);

    // The entry accepts, so the frames settle; only the validator's own verdict refuses.
    const result = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'add',
      args: [1n],
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: refusingValidatorOf(funded.proxyCategoryId),
    });
    expect(result.verdicts.filter((verdict) => !verdict.accepted))
      .toStrictEqual([{ id: 'validator', index: 1, accepted: false, objection: VALIDATOR_REFUSAL }]);
    expect(result.accepted).toBe(false);
    expect(result.broadcast).toBeUndefined();
    expect(await unspent(network, funded.deployerLock, funded.callCoin)).toBe(true);
    expect(await recordState(network, funded.proxyCategoryId)).toBe(before);
  });

  it('broadcasts no initialize a participant past the frames refuses, nor either genesis, and names it', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    await expect(deployedWithCallerCoin(network, refusingValidatorOf(PROXY_CATEGORY)))
      .rejects.toThrow(`hop was refused, so nothing was broadcast: validator: ${VALIDATOR_REFUSAL}`);
    // The geneses were only held, so no category exists and no proxy is left for anyone to initialize.
    expect(await network.getUtxosByTokenCategory(IMPL_CATEGORY)).toStrictEqual([]);
    expect(await network.getUtxosByTokenCategory(PROXY_CATEGORY)).toStrictEqual([]);
    expect(await unspent(network, encodeLockingBytecodeP2pkh(alicePkh), HOP_COIN)).toBe(true);
  });
});
