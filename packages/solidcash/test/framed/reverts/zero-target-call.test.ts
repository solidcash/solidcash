import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { framedValidator } from '@solidcash/solidc';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { planHopExternalCalls } from '../../../src/framed/proxy/external-calls.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry } from '../../../src/framed/proxy/deploy.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * An entry whose guarded external call names the zero address.
 *
 * The entry gates a token call on `token_.code.length > 0` and then makes it; the caller passes the zero address,
 * which has no code, so the entry's own `require` refuses before the call is reached. The target is the zero
 * address, which no deployment sits at, so the entry's own refusal is what a caller must read rather than a
 * planning refusal over a target that names no contract.
 */

/** A 32-byte id whose bytes vary and whose reverse is a different value. */
function id32(lead: string): string {
  return `${lead.repeat(31)}c4`;
}

const IMPL_CATEGORY = id32('4a');
const PROXY_CATEGORY = id32('4b');
const TOKEN_CATEGORY = id32('4e');

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IERC20 { function balanceOf(address who) returns (uint); }'
  + ' contract Token {'
  + '   mapping(address => uint) balances;'
  + '   function balanceOf(address who) returns (uint) { require(true); return this.balances[who]; }'
  + ' }'
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
  + '   function hold(address token_) {'
  + '     require(address(token_).code.length > 0 && IERC20(token_).balanceOf(msg.sender) > 0, "invalid token");'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const impl = artifacts.Impl!;

/** The planner against the entry, named the way a hop names its callee. */
function plan(args: readonly Uint8Array[]): ReturnType<typeof planHopExternalCalls> {
  return planHopExternalCalls({
    provider: new MockNetworkProvider(),
    artifact: impl,
    functionName: 'hold',
    args,
    externals: { IERC20: { artifact: artifacts.Token!, categoryId: TOKEN_CATEGORY } },
    selfAddress: new Uint8Array(35).fill(0x22),
    senderAddress: new Uint8Array(25).fill(0x33),
    validatorProgram: framedValidator.buildValidatorProgram(),
  });
}

/** A deployment behind the generated proxy, plus a coin a caller can enter a hop with. */
async function deployedWithCallerCoin(network: MockNetworkProvider): Promise<{
  readonly proxyCategoryId: string;
  readonly implementationCategoryId: string;
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
  readonly callCoin: { txid: string; vout: number; satoshis: bigint };
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
}> {
  const signature = new SignatureTemplate(alicePriv);
  const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const implFunding = { txid: IMPL_CATEGORY, vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: PROXY_CATEGORY, vout: 0, satoshis: 500_000n };
  const hopCoin = { txid: id32('4c'), vout: 0, satoshis: 300_000n };
  const callCoin = { txid: id32('4d'), vout: 0, satoshis: 300_000n };
  for (const coin of [implFunding, proxyFunding]) await network.addUtxo(source.address, coin);
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);
  for (const coin of [hopCoin, callCoin]) await network.addUtxo(binToHex(deployerLock), coin);
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
    vm: compositionMachine(),
  });
  expect(deployment.initialize.broadcast).toBeDefined();
  return {
    proxyCategoryId: deployment.proxy.categoryId,
    implementationCategoryId: deployment.implementation.categoryId,
    deployerLock, changeAddress: source.address, callCoin, funder: signature.unlockP2PKH(),
  };
}

describe('an entry whose guarded call names the zero address', () => {
  it('states no call and places no callee for a target that names no contract', async () => {
    const planned = await plan([new Uint8Array(0)]);
    expect(planned.calls).toStrictEqual([]);
    expect(planned.callBases).toStrictEqual([-1]);
    expect(planned.callees).toStrictEqual([]);
  });

  it('still plans a call for a non-zero target, which names a contract to reach', async () => {
    // The control: only the zero address is stated for nothing. A real lock is treated as a contract, so the hop
    // goes on to place a callee and only refuses because no live deployment holds a master.
    await expect(plan([new Uint8Array(35).fill(0x11)])).rejects.toThrow(/holds 0 master\(s\)/);
  });

  it('runs the entry\'s own guard rather than refusing the target', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployedWithCallerCoin(network);

    // The entry's own frame refuses before the call is reached, so the implementation frame is named with its source
    // line and its own message rather than the hop refusing a target that names no contract. The `&&` skips the
    // call, so the frame declares no record and the body reaches its `require` rather than a call-count check.
    await expect(callFramedProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'hold',
      args: [new Uint8Array(0)],
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    })).rejects.toThrow(
      new RegExp('the implementation\'s "hold" entry did not settle through the proxy: frame '
        + '"implementation-master" of Impl\\.hold\\(\\) at line \\d+: invalid token \\(Program failed an OP_VERIFY'),
    );

    // Nothing was broadcast, so the caller's coin is still live.
    const live = await network.getUtxosForLockingBytecode(funded.deployerLock);
    expect(live.some((utxo) => utxo.txid === funded.callCoin.txid)).toBe(true);
  });
});
