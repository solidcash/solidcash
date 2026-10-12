import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hash256, hexToBin } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../src/index.js';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import type NetworkProvider from '../../src/network/NetworkProvider.js';
import { readFramedState } from '../../src/framed/deploy/index.js';
import {
  FramedProxyDeployError, buildProxyArtifact, deployFramedProxy, type FramedProxyCallerFunding,
} from '../../src/framed/proxy/index.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import { fundShippedFacets } from './shapes/harness.js';

/**
 * Audit SDKFRAMED-2: a framed proxy deployment commits fully or broadcasts nothing.
 *
 * The proxy's genesis mints its records uninitialized and `initialize` runs as a third transaction, so a proxy genesis
 * broadcast before its hop is accepted is left for anyone to initialize first. The deployment signs both geneses,
 * plans and evaluates the hop against them while all three are held, and only then broadcasts them back to back.
 */

const STATE = ' address public implementation; uint public initialized;';
const SOURCE = 'pragma solidcash ^0.13.0;'
  + ` contract Impl {${STATE}`
  + '   function initialize(address expected) {'
  + '     require(msg.sender == expected);'
  + '     require(this.initialized == 0);'
  + '     this.initialized = 1;'
  + '   }'
  + ' }'
  + ` contract Stuck {${STATE}`
  + '   function initialize(address expected) {'
  + '     require(msg.sender == expected);'
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

/** A fresh chain with both genesis coins at the deployer's wallet and the hop's coin at its own P2PKH lock. */
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

/** Nothing reached the provider: no broadcast was asked for, no category exists and the hop's coin is unspent. */
async function expectNothingBroadcast({ network, sent, geneses, caller }: Funded): Promise<void> {
  expect(sent).toStrictEqual([]);
  for (const coin of geneses) expect(await network.getUtxosByTokenCategory(coin.txid)).toStrictEqual([]);
  const live = await network.getUtxosForLockingBytecode(deployerLock);
  expect(live.some((utxo) => utxo.txid === caller.txid && utxo.vout === caller.vout)).toBe(true);
}

describe('audit SDKFRAMED-2: a framed proxy deployment commits fully or broadcasts nothing', () => {
  it('broadcasts the two geneses and the hop back to back, in order, and leaves the proxy initialized', async () => {
    const run = await funded(artifacts.Impl!);
    const deployment = await deployFramedProxy({ ...run.options, callerFunding: run.callerFunding });

    expect(run.sent).toStrictEqual([
      deployment.implementation.tx.txid, deployment.proxy.tx.txid, deployment.initialize.broadcast.txid,
    ]);
    // The hop spends outputs of both geneses, so this is the one order the chain accepts.
    const spent = new Set(deployment.initialize.broadcast.inputs
      .map((input) => binToHex(input.outpointTransactionHash)));
    expect(spent.has(deployment.implementation.tx.txid)).toBe(true);
    expect(spent.has(deployment.proxy.tx.txid)).toBe(true);
    const layout = buildProxyArtifact(artifacts.Impl!).stateLayout!;
    const state = await readFramedState(run.network, deployment.proxy.categoryId, layout);
    expect(state.byNft[0]!.initialized).toBe(1n);
  }, 600_000);

  it('broadcasts nothing when the initializer reverts, so no category exists afterwards', async () => {
    const run = await funded(artifacts.Stuck!);
    await expect(deployFramedProxy({ ...run.options, callerFunding: run.callerFunding })).rejects.toThrow(/not ready/);
    await expectNothingBroadcast(run);
  }, 600_000);

  it('refuses a deployment without callerFunding before broadcasting anything', async () => {
    const run = await funded(artifacts.Impl!);
    const deployment = deployFramedProxy(run.options);
    await expect(deployment).rejects.toThrow(FramedProxyDeployError);
    await expect(deployment).rejects.toThrow(/needs `callerFunding`/);
    await expectNothingBroadcast(run);
  }, 600_000);
});
