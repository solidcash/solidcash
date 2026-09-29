import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { bytesToHex } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { deployMaster } from '../../../src/per-call/deploy/index.js';
import { buildProxyArtifact } from '../../../src/per-call/proxy/index.js';
import { callPerCallProxyEntry } from '../../../src/per-call/proxy/deploy.js';
import type { StateValueType } from '../../../src/types/state-inference.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A real hop whose implementation entry calls a callee that itself calls another contract.
 *
 * The implementation entry's call target lives in the implementation's own state, so the planner has to read the
 * proxy's live record to resolve it; the callee's own entry makes a call of its own, whose target lives in the
 * callee's record, so the planner has to recurse and read the callee's record too. The hop is driven only through
 * the shipped deployment, composer, derivation and machine, and the callee's own call record is read back from the
 * draft the derivation filled.
 */

const IMPL_CATEGORY = '11'.repeat(32);
const PROXY_CATEGORY = '22'.repeat(32);
const PAY_CATEGORY = '55'.repeat(32);
const TOKEN_CATEGORY = '66'.repeat(32);

// The implementation's target is a state field, and so is the callee's; both are seeded at deploy time, so the
// planner's own reading of the live records is what makes the hop plannable with no hand-fed facts.
const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface IToken { function transfer(address to, int amount); }'
  + ' interface IPay { function pay(address to, int amount); }'
  + ' contract Token {'
  + '   int public moved;'
  + '   function transfer(address to, int amount) { require(amount >= 0); }'
  + ' }'
  + ' contract Pay {'
  + '   address public token;'
  + '   function pay(address to, int amount) {'
  + '     IToken(this.token).transfer(to, amount);'
  + '     require(true);'
  + '   }'
  + ' }'
  + ' contract Impl {'
  + '   address public payee;'
  + '   bytes32 public pad1;'
  + '   bytes32 public pad2;'
  + '   bytes32 public pad3;'
  + '   bytes32 public pad4;'
  + '   function run(address to, int amount) {'
  + '     IPay(this.payee).pay(to, amount);'
  + '     require(true);'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
const impl = artifacts.Impl!;
const pay = artifacts.Pay!;
const token = artifacts.Token!;

/** Deploys one contract at its own seeded category, funded from the deployer's P2PKH lock. */
async function deployAt(
  network: MockNetworkProvider,
  source: Contract,
  artifact: typeof impl,
  categoryId: string,
  initialState?: Record<string, StateValueType>,
): Promise<void> {
  const signature = new SignatureTemplate(alicePriv);
  const funding = { txid: categoryId, vout: 0, satoshis: 500_000n };
  await network.addUtxo(source.address, funding);
  await deployStatefulContract(artifact, [], {
    fundingUtxo: funding,
    funder: source.unlock.spend(alicePub, signature),
    changeAddress: source.address,
    provider: network,
    ...(initialState === undefined ? {} : { initialState }),
  });
}

describe('a hop whose implementation entry reaches a callee that calls on', () => {
  it('reads each target from state, settles the whole tree and accepts every contract input', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
    const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);
    await fundShippedFacets(network);

    // The addresses the entries' own code computes, `addrV(category)`, which the state fields are seeded with.
    const tokenAddress = deployMaster(token, new Uint8Array(Buffer.from(TOKEN_CATEGORY, 'hex')), VALIDATOR_PROGRAM).address;
    const payAddress = deployMaster(pay, new Uint8Array(Buffer.from(PAY_CATEGORY, 'hex')), VALIDATOR_PROGRAM).address;
    const implAddress = deployMaster(impl, new Uint8Array(Buffer.from(IMPL_CATEGORY, 'hex')), VALIDATOR_PROGRAM).address;

    await deployAt(network, source, token, TOKEN_CATEGORY);
    await deployAt(network, source, pay, PAY_CATEGORY, { token: tokenAddress });
    await deployAt(network, source, impl, IMPL_CATEGORY);
    // The proxy declares the implementation's fields beside the address its fallback forwards to, so its record
    // carries both the implementation's address and the call target the implementation's own entry reads.
    await deployAt(network, source, buildProxyArtifact(impl), PROXY_CATEGORY, {
      implementation: implAddress, payee: payAddress,
    });

    const callCoin = { txid: '44'.repeat(32), vout: 0, satoshis: 300_000n };
    await network.addUtxo(binToHex(deployerLock), callCoin);
    const callerFunder = signature.unlockP2PKH();

    const result = await callPerCallProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      proxyCategoryId: PROXY_CATEGORY,
      implementationCategoryId: IMPL_CATEGORY,
      functionName: 'run',
      args: [new Uint8Array(35).fill(0x33), 100n],
      externals: {
        IPay: { artifact: pay, categoryId: PAY_CATEGORY },
        IToken: { artifact: token, categoryId: TOKEN_CATEGORY },
      },
      callerUtxo: callCoin,
      callerLockingBytecode: deployerLock,
      funder: callerFunder,
      changeAddress: source.address,
      vm: compositionMachine(),
    });

    // The deepest callee completes first: the token's transfer, then the callee that called it, then the entry and
    // the fallback that entered it.
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([
      `${token.contractName}.transfer()`,
      `${pay.contractName}.pay()`,
      `${impl.contractName}.run()`,
      'ImplProxy.__fallback()',
    ]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

    // The callee's own call record is stated, and it targets the address the callee's record holds.
    const calleeBlock = result.draft.blockOf('callee-master-1');
    expect(calleeBlock.calls).toHaveLength(1);
    expect(bytesToHex(calleeBlock.calls[0]!.target)).toBe(bytesToHex(tokenAddress));
  });
});
