import { describe, expect, it } from 'vitest';
import { encodeDataPush, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { FrameKind, buildPushdataCommitment, bytesToHex, type RecordEntry } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { refusalOf } from '../../../../solidc/test/framed/master/refused-entry.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { stateRecordLockingBytecode, stateRecordUnlockingBytecode } from '../../../src/framed/deploy/index.js';
import {
  createComposedDerivationHost, participant,
  type CompositionDraftPlan, type DraftMaster,
} from '../../../src/framed/composer/index.js';
import { deployFramedProxy, FramedProxyDeployError } from '../../../src/framed/proxy/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';
import {
  USER_LOCK, compileAndDeploy, layoutWithFacets, master, masterInput, selectorOf, token,
  userInput,
  userInputs, validatorFor,
} from '../shapes/harness.js';

/**
 * A proxied `initialize` that writes state.
 *
 * The proxy's record is the record its implementation's entries read and write, so the two must declare the same
 * fields: the implementation's write rebuilds the whole commitment from the fields its own source declares, and a
 * field only the proxy declares would not survive it. The record therefore carries the proxy's own field — the one
 * the fallback reads the implementation's address from — beside the implementation's fields, and every deployment
 * here declares that shape on both sides.
 *
 * The tests drive the shipped deployment, composer, derivation and machine. The entry's own `Initializable` guard
 * is what the second call trips, so the record a second call is offered is the one the first call left.
 */

const IMPL_CATEGORY = '11'.repeat(31) + 'ee';
const PROXY_CATEGORY = '22'.repeat(31) + 'dd';

const SHARED_STATE = ' address public implementation;'
  + ' uint public initialized;'
  + ' int public version;';

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ` contract Impl {${SHARED_STATE}`
  + '   function initialize(address expected) {'
  + '     require(msg.sender == expected);'
  + '     require(this.initialized == 0);'
  + '     this.initialized = 1;'
  + '     this.version = 7;'
  + '   }'
  + ' }'
  + ` contract Proxy {${SHARED_STATE}`
  + '   fallback(bytes input) external { this.implementation.delegatecall(input); require(true); }'
  + ' }';

function provider(): MockNetworkProvider {
  return new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
}

/** Funds a deployment's two genesis UTXOs and returns the deployer's own lock. */
async function funded(network: MockNetworkProvider): Promise<{
  readonly funder: ReturnType<Contract['unlock']['spend']>;
  readonly implFunding: { txid: string; vout: number; satoshis: bigint };
  readonly proxyFunding: { txid: string; vout: number; satoshis: bigint };
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
}> {
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const implFunding = { txid: IMPL_CATEGORY, vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: PROXY_CATEGORY, vout: 0, satoshis: 500_000n };
  await network.addUtxo(funder.address, implFunding);
  await network.addUtxo(funder.address, proxyFunding);
  // The hop broadcasts, so each composition's facet input needs a live UTXO at the facet's lock.
  await fundShippedFacets(network);
  return {
    funder: funder.unlock.spend(alicePub, signature),
    implFunding,
    proxyFunding,
    deployerLock: encodeLockingBytecodeP2pkh(alicePkh),
    changeAddress: funder.address,
  };
}

describe('a proxied initialize that writes state', () => {
  it('refuses a second initialize offered the record the first call left, and accepts the same plan before it', () => {
    const { artifacts, contracts } = compileAndDeploy(SOURCE, { Proxy: 'second call proxy', Impl: 'second call impl' });
    const proxyContract = contracts.Proxy!;
    const implContract = contracts.Impl!;
    const implementation = implContract.address;
    const selector = selectorOf(artifacts, 'Impl', 'initialize');
    // The proxy master, its validator and the facet the validator binds precede the record.
    const recordIndex = 3;
    const state = (initialized: bigint, version: bigint): Uint8Array => new Uint8Array(Buffer.from(
      buildPushdataCommitment(artifacts.Proxy!.stateLayout!, { implementation, initialized, version }, 0), 'hex'));
    const written = state(1n, 7n);

    /** The proxied hop for one state of the record, with the record ending where the entry computes it. */
    const planFor = (before: Uint8Array, after: Uint8Array): CompositionDraftPlan => {
      const facts = (
        contract: string, entry: string, kind: number, makesExternalCall: boolean,
      ): DraftMaster['facts'] => ({
        contract, functionName: `${contract}.${entry}()`, kind, callerIsUser: kind === FrameKind.ROOT,
        originEqualsCaller: kind === FrameKind.ROOT, makesExternalCall, mastersOfContract: 1,
      });
      const kept = (view: Uint8Array): RecordEntry =>
        ({ in: recordIndex, out: recordIndex, viewIn: view, viewOut: view });
      const proxyMaster = master({
        master: 'proxy-1', contract: 'Proxy', entry: '__fallback', program: proxyContract.program,
        facts: facts('Proxy', '__fallback', FrameKind.ROOT, true),
        frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: proxyContract.address, value: 0n },
        enteredBy: 'user', origin: 'user',
        calls: [{ kind: FrameKind.DELEGATE, callee: 'impl-1', target: implementation, value: 0n,
          argumentPushes: [selector, USER_LOCK] }],
        // The record as the proxy read it before the call, and as the delegate frame left it after.
        segments: [[kept(before)], [kept(after)]],
        argumentPushes: [new Uint8Array([...encodeDataPush(selector), ...encodeDataPush(USER_LOCK)])],
        dispatches: true,
      });
      const implementationMaster = master({
        master: 'impl-1', contract: 'Impl', entry: 'initialize', program: implContract.program,
        facts: facts('Impl', 'initialize', FrameKind.DELEGATE, false),
        frame: { kind: FrameKind.DELEGATE, sender: USER_LOCK, self: proxyContract.address, value: 0n },
        enteredBy: 'proxy-1', origin: 'user',
        segments: [[{ in: recordIndex, out: recordIndex, viewIn: before, viewOut: after }]],
        // The forwarded call data's pushes are the entry's write to its frame: the selector, then the argument.
        argumentPushes: [selector, USER_LOCK],
      });
      const proxyCategoryHex = bytesToHex(proxyContract.category);
      const blocks = [
        { contract: 'Proxy', masters: ['proxy-1'], validator: { id: 'validator', settles: [] }, state: ['record'] },
        { contract: 'Impl', masters: ['impl-1'], state: [] },
      ];
      // A record the entry rewrites is spent on the covenant's write path, which names a master of the record's
      // own category; a record it leaves alone needs no master.
      const writes = bytesToHex(before) !== bytesToHex(after);
      const proxyMasterIndex = participant(layoutWithFacets(blocks), 'proxy-1').index;
      const recordSource = {
        lockingBytecode: stateRecordLockingBytecode(proxyCategoryHex), valueSatoshis: 20_000n,
        token: token(proxyContract.category, 'mutable', before),
      };
      const validator = validatorFor(proxyContract.category);
      return {
        blocks,
        // The facet the validator binds is one participant ahead of the user.
        userInputs: userInputs(['user'], 5),
        masters: [proxyMaster, implementationMaster],
        inputs: {
          'proxy-1': { source: masterInput(proxyContract) },
          'impl-1': { source: masterInput(implContract) },
          validator: { source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n,
            token: token(proxyContract.category, 'mutable') } },
          record: {
            source: recordSource,
            output: { ...recordSource, token: token(proxyContract.category, 'mutable', after) },
            unlockingBytecode: stateRecordUnlockingBytecode(
              proxyCategoryHex, proxyMasterIndex, writes ? 1 : 0,
            ),
          },
          user: userInput(),
        },
        validator: {
          id: 'validator', covers: ['Impl'],
          settles: [{ category: proxyContract.category, stateInputs: ['record'] }],
          redeemScript: validator.redeem,
        },
      };
    };

    /** The machine's verdict on the implementation frame of one plan. */
    const verdictOf = (before: Uint8Array, after: Uint8Array): { accepted: boolean; error?: string } => {
      const plan = planFor(before, after);
      const { draft } = createComposedDerivationHost({
        vm: compositionMachine(), artifacts: [artifacts.Proxy!, artifacts.Impl!], plan,
      });
      const program = draft.programFor('impl-1');
      const vm = compositionMachine();
      const evaluation = vm.evaluate({
        inputIndex: participant(draft.layout, 'impl-1').index,
        sourceOutputs: program.sourceOutputs,
        transaction: program.transaction,
      });
      return vm.stateSuccess(evaluation) === true
        ? { accepted: true }
        : { accepted: false, error: String((evaluation as { readonly error?: string }).error) };
    };

    // The control the refusal is attributed to: the same plan - the same masters, the same calls, the same push
    // encoding - offered the state the entry expects, which it then writes itself.
    expect(verdictOf(state(0n, 0n), written)).toStrictEqual({ accepted: true });
    // The record the first call left, with the plan declaring it unchanged: the flag the entry guards on is set,
    // and the state the deployment would leave is not the state that record holds.
    const refused = verdictOf(written, written);
    expect(refused.accepted).toBe(false);
    expect(refused.error).toContain('OP_VERIFY');
  });

  it('refuses a proxy whose record does not declare the implementation\'s fields', async () => {
    const mismatched = 'pragma solidcash ^0.14.0;'
      + ' contract Impl { int public version;'
      + '   function initialize(address expected) { require(msg.sender == expected); this.version = 7; } }'
      + ' contract Proxy { address implementation;'
      + '   fallback(bytes input) external { this.implementation.delegatecall(input); require(true); } }';
    const { artifacts } = compileAndDeploy(mismatched, { Proxy: 'mismatch proxy', Impl: 'mismatch impl' });
    const network = provider();
    const { funder, implFunding, proxyFunding, changeAddress, deployerLock } = await funded(network);
    const deployment = deployFramedProxy({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyArtifact: artifacts.Proxy!,
      implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress },
      proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress },
      initialize: { functionName: 'initialize', args: [deployerLock] },
      callerLockingBytecode: deployerLock,
      vm: compositionMachine(),
    });
    await expect(deployment).rejects.toThrowError(FramedProxyDeployError);
    await expect(deployment).rejects.toThrowError(/must declare the same record fields/);
  });

  it('refuses a proxy whose delegatecall target is a filled constant rather than a value the contract holds', () => {
    const literal = 'pragma solidcash ^0.14.0;'
      + ' contract Proxy {'
      + `   fallback(bytes input) external { address(0x${'ab'.repeat(35)}).delegatecall(input); require(true); }`
      + ' }';
    // No address the contract holds, so the fallback is no proxy: it is dispatched to, and its call is refused.
    expect(refusalOf(literal).message).toBe('Proxy.__fallback(): a low-level call needs the witness `calls[]` '
      + 'checks, which are not emitted yet');
  });
});
