import { describe, expect, it } from 'vitest';
import { encodeDataPush, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { FrameKind, buildPushdataCommitment, bytesToHex } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  deployMaster, readPerCallDeployment, stateRecordLockingBytecode, stateRecordUnlockingBytecode,
} from '../../../src/per-call/deploy/index.js';
import {
  createComposedDerivationHost, participant, type CompositionDraftPlan, type DraftMaster,
} from '../../../src/per-call/composer/index.js';
import { deployPerCallProxy, PerCallProxyDeployError } from '../../../src/per-call/proxy/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import {
  USER_LOCK, VALIDATOR_PROGRAM, compileAndDeploy, master, masterInput, selectorOf, token, userInput,
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

const IMPL_CATEGORY = '11'.repeat(32);
const PROXY_CATEGORY = '22'.repeat(32);

const SHARED_STATE = ' address public implementation;'
  + ' uint public initialized;'
  + ' int public version;';

const SOURCE = 'pragma solidcash ^0.13.0;'
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
  return {
    funder: funder.unlock.spend(alicePub, signature),
    implFunding,
    proxyFunding,
    deployerLock: encodeLockingBytecodeP2pkh(alicePkh),
    changeAddress: funder.address,
  };
}

/** The implementation's address at its seeded category, `addrV(category)`. */
function implementationAddress(artifacts: ReturnType<typeof compileStringMulti>): Uint8Array {
  return deployMaster(
    artifacts.Impl!, new Uint8Array(Buffer.from(IMPL_CATEGORY, 'hex')), VALIDATOR_PROGRAM,
  ).address;
}

/** The commitment the shipped encoder materializes from one state of the shared layout. */
function commitment(
  artifacts: ReturnType<typeof compileStringMulti>,
  implementation: Uint8Array,
  initialized: bigint,
  version: bigint,
): Uint8Array {
  return new Uint8Array(Buffer.from(
    buildPushdataCommitment(artifacts.Proxy!.stateLayout!, { implementation, initialized, version }, 0), 'hex'));
}

describe('a proxied initialize that writes state', () => {
  it('mints the proxy record through the shipped deployment and reads it back through the shipped decoder', async () => {
    const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
    const network = provider();
    const { funder, proxyFunding, changeAddress } = await funded(network);
    const { deployPerCallStatefulContract } = await import('../../../src/per-call/deploy/stateful.js');

    const proxy = await deployPerCallStatefulContract(artifacts.Proxy!, [], {
      fundingUtxo: proxyFunding, funder, changeAddress, provider: network,
      initialState: { implementation: implementationAddress(artifacts), initialized: 0n, version: 0n },
    });
    const discovery = await readPerCallDeployment(network, proxy.categoryId, artifacts.Proxy!.stateLayout!);
    const commitmentBytes = new Uint8Array(Buffer.from(discovery.records[0]!.token!.nft!.commitment, 'hex'));

    expect(bytesToHex(commitmentBytes)).toBe(bytesToHex(commitment(
      artifacts, implementationAddress(artifacts), 0n, 0n,
    )));
  });

  it('settles the writing initialize through the proxy, and the record keeps the address it was called through', async () => {
    const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
    const network = provider();
    const { funder, implFunding, proxyFunding, changeAddress, deployerLock } = await funded(network);
    const deployment = await deployPerCallProxy({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyArtifact: artifacts.Proxy!,
      implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress },
      proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress },
      initialize: { functionName: 'initialize', args: [deployerLock] },
      callerLockingBytecode: deployerLock,
      vm: compositionMachine(),
    });

    expect(deployment.initialize.completed.map((frame) => frame.functionName))
      .toStrictEqual(['Impl.initialize()', 'Proxy.__fallback()']);
    expect(deployment.initialize.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(deployment.initialize.accepted).toBe(true);
    // The state the entry itself computed: the flag set and the version written, with the address still there.
    const written = commitment(artifacts, deployment.implementation.address, 1n, 7n);
    expect(bytesToHex(deployment.initialize.writtenRecordCommitment)).toBe(bytesToHex(written));
    const recordIndex = participant(deployment.initialize.draft.layout, 'proxy-record').index;
    expect(bytesToHex(deployment.initialize.transaction.outputs[recordIndex]!.token!.nft!.commitment))
      .toBe(bytesToHex(written));
  });

  it('refuses a second initialize against the record the first one left, at the entry\'s own guard', () => {
    // The record a second call is offered is the one the first call wrote: the flag is set, so the entry's own
    // require refuses before it writes, and the plan declares the record unchanged.
    const { artifacts, contracts } = compileAndDeploy(SOURCE, { Proxy: 'second call proxy', Impl: 'second call impl' });
    const proxyContract = contracts.Proxy!;
    const implContract = contracts.Impl!;
    const implementation = implContract.address;
    const written = new Uint8Array(Buffer.from(
      buildPushdataCommitment(artifacts.Proxy!.stateLayout!, { implementation, initialized: 1n, version: 7n }, 0), 'hex'));
    const selector = selectorOf(artifacts, 'Impl', 'initialize');
    const recordIndex = 2;
    const facts = (
      contract: string, entry: string, kind: number, makesExternalCall: boolean,
    ): DraftMaster['facts'] => ({
      contract, functionName: `${contract}.${entry}()`, kind, callerIsUser: kind === FrameKind.ROOT,
      originEqualsCaller: kind === FrameKind.ROOT, makesExternalCall, mastersOfContract: 1,
    });
    const proxyMaster = master({
      master: 'proxy-1', contract: 'Proxy', entry: '__fallback', program: proxyContract.program,
      facts: facts('Proxy', '__fallback', FrameKind.ROOT, true),
      frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: proxyContract.address, value: 0n },
      enteredBy: 'user', origin: 'user',
      calls: [{ kind: FrameKind.DELEGATE, callee: 'impl-1', target: implementation, value: 0n,
        argumentPushes: [selector, encodeDataPush(USER_LOCK)] }],
      segments: [
        [{ in: recordIndex, out: recordIndex, viewIn: written, viewOut: written }],
        [{ in: recordIndex, out: recordIndex, viewIn: written, viewOut: written }],
      ],
      // The fallback receives its call data as one `bytes` argument: the selector's push and the argument's.
      argumentPushes: [new Uint8Array([...encodeDataPush(selector), ...encodeDataPush(USER_LOCK)])],
      dispatches: true,
    });
    const implementationMaster = master({
      master: 'impl-1', contract: 'Impl', entry: 'initialize', program: implContract.program,
      facts: facts('Impl', 'initialize', FrameKind.DELEGATE, false),
      frame: { kind: FrameKind.DELEGATE, sender: USER_LOCK, self: proxyContract.address, value: 0n },
      enteredBy: 'proxy-1', origin: 'user',
      segments: [[{ in: recordIndex, out: recordIndex, viewIn: written, viewOut: written }]],
      // The forwarded call data is the selector's push followed by the entry's argument pushes, which is what the
      // fallback received and handed to the implementation.
      argumentPushes: [selector, encodeDataPush(USER_LOCK)],
    });
    const proxyCategoryHex = bytesToHex(proxyContract.category);
    const recordSource = {
      lockingBytecode: stateRecordLockingBytecode(proxyCategoryHex), valueSatoshis: 20_000n,
      token: token(proxyContract.category, 'mutable', written),
    };
    const validator = validatorFor(proxyContract.category);
    const plan: CompositionDraftPlan = {
      blocks: [
        { contract: 'Proxy', masters: ['proxy-1'], validator: { id: 'validator', settles: [] }, state: ['record'] },
        { contract: 'Impl', masters: ['impl-1'], state: [] },
      ],
      userInputs: userInputs(['user'], 4),
      masters: [proxyMaster, implementationMaster],
      inputs: {
        'proxy-1': { source: masterInput(proxyContract) },
        'impl-1': { source: masterInput(implContract) },
        validator: { source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n,
          token: token(proxyContract.category, 'mutable') } },
        record: {
          source: recordSource, output: recordSource,
          unlockingBytecode: stateRecordUnlockingBytecode(proxyCategoryHex, 0, 0),
        },
        user: userInput(),
      },
      validator: {
        id: 'validator', covers: ['Impl'],
        settles: [{ category: proxyContract.category, stateInputs: ['record'] }],
        redeemScript: validator.redeem,
      },
    };

    const { draft } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [artifacts.Proxy!, artifacts.Impl!], plan,
    });
    const program = draft.programFor('impl-1');
    const vm = compositionMachine();
    const state = vm.evaluate({
      inputIndex: participant(draft.layout, 'impl-1').index,
      sourceOutputs: program.sourceOutputs,
      transaction: program.transaction,
    });
    expect(vm.stateSuccess(state)).not.toBe(true);
    expect(String((state as { readonly error?: string }).error)).toContain('OP_VERIFY');
  });

  it('refuses a proxy whose record does not declare the implementation\'s fields', async () => {
    const mismatched = 'pragma solidcash ^0.13.0;'
      + ' contract Impl { int public version;'
      + '   function initialize(address expected) { require(msg.sender == expected); this.version = 7; } }'
      + ' contract Proxy { address implementation;'
      + '   fallback(bytes input) external { this.implementation.delegatecall(input); require(true); } }';
    const { artifacts } = compileAndDeploy(mismatched, { Proxy: 'mismatch proxy', Impl: 'mismatch impl' });
    const network = provider();
    const { funder, implFunding, proxyFunding, changeAddress, deployerLock } = await funded(network);
    await expect(deployPerCallProxy({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyArtifact: artifacts.Proxy!,
      implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress },
      proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress },
      initialize: { functionName: 'initialize', args: [deployerLock] },
      callerLockingBytecode: deployerLock,
      vm: compositionMachine(),
    })).rejects.toThrowError(PerCallProxyDeployError);
  });

  it('refuses a proxy whose delegatecall target is a filled constant rather than a value the contract holds', () => {
    const literal = 'pragma solidcash ^0.13.0;'
      + ' contract Proxy {'
      + `   fallback(bytes input) external { address(0x${'ab'.repeat(35)}).delegatecall(input); require(true); }`
      + ' }';
    expect(() => compileStringMulti(literal, { composition: 'per-call' })).toThrowError(
      /fallback and receive make the contract dispatch by selector/,
    );
  });
});
