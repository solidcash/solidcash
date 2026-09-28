import { describe, expect, it } from 'vitest';
import { encodeDataPush, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { FrameKind, buildPushdataCommitment, bytesToHex, chainCategory } from '@solidcash/utils';
import { compileString, compileStringMulti } from '../../../../solidc/src/compiler.js';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  deployMaster, readPerCallDeployment, stateRecordLockingBytecode, stateRecordUnlockingBytecode,
} from '../../../src/per-call/deploy/index.js';
import {
  createComposedDerivationHost, participant, type CompositionDraftPlan, type DraftMaster,
} from '../../../src/per-call/composer/index.js';
import { deployPerCallProxy } from '../../../src/per-call/proxy/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import {
  USER_LOCK, VALIDATOR_PROGRAM, compileAndDeploy, master, masterInput, selectorOf, token, userInput,
  userInputs, validatorFor,
} from '../shapes/harness.js';

/**
 * A proxied `initialize` that writes a field, and the facts about the per-call compiler that stop it today.
 *
 * The proxy is the shape the convention compiles: one `address implementation` field and a fallback that
 * delegatecalls it with the call data the fallback received. The implementation's entry is an ordinary
 * state-writing entry, so when it runs as a delegate frame it reads and writes the record the proxy's genesis
 * minted. Making that settle needs two pieces of compiler support that are not there:
 *
 *   - the admission binds a forwarded fallback's target to a value the contract holds as a state variable, so a
 *     proxy whose implementation address is a deployment-filled constant is refused at compile time;
 *   - the per-call master head does not leave the frame's caller as the state owner for a delegate body, so a
 *     body marked `delegate` is refused for the hidden `__internal__proxyMasterIndex` it carries, and an
 *     unmarked body verifies the accessed record's token category against the input that executes (the
 *     implementation's master) rather than against the frame's caller (the proxy's master). The record carries
 *     the proxy's category, so that comparison fails before the write is reached.
 *
 * This file pins each refusal and pins that the same deployment's genesis record is otherwise the shipped,
 * accepted shape. The assertions above the refusals flip when the delegate-frame record support lands.
 */

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   int public version;'
  + '   function initialize(address expected) { require(msg.sender == expected); this.version = 7; }'
  + ' }'
  + ' contract Proxy {'
  + '   address implementation;'
  + '   fallback(bytes input) external { this.implementation.delegatecall(input); require(true); }'
  + ' }';

const IMPL_CATEGORY = '11'.repeat(32);
const PROXY_CATEGORY = '22'.repeat(32);

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

describe('a proxied initialize that writes a field', () => {
  it('mints the proxy record through the shipped deployment, and reads it back through the shipped decoder', async () => {
    const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
    const network = provider();
    const { funder, proxyFunding, changeAddress } = await funded(network);
    const { deployPerCallStatefulContract } = await import('../../../src/per-call/deploy/stateful.js');

    // `initialize` is not planned: only the proxy's own genesis is run, so the record it mints can be read back.
    const proxy = await deployPerCallStatefulContract(artifacts.Proxy!, [], {
      fundingUtxo: proxyFunding, funder, changeAddress, provider: network,
      initialState: { implementation: implementationAddress(artifacts) },
    });
    const discovery = await readPerCallDeployment(network, proxy.categoryId, artifacts.Proxy!.stateLayout!);
    const commitment = new Uint8Array(Buffer.from(discovery.records[0]!.token!.nft!.commitment, 'hex'));

    // The record the shipped encoder materializes from the implementation's address, read back unchanged.
    expect(bytesToHex(commitment)).toBe(
      buildPushdataCommitment(artifacts.Proxy!.stateLayout!, { implementation: implementationAddress(artifacts) }, 0),
    );
  });

  it('refuses a proxy whose delegatecall target is a filled constant rather than a state variable', () => {
    const literal = 'pragma solidcash ^0.13.0;'
      + ' contract Proxy {'
      + `   fallback(bytes input) external { address(0x${'ab'.repeat(35)}).delegatecall(input); require(true); }`
      + ' }';
    expect(() => compileString(literal, { composition: 'per-call' })).toThrowError(
      /fallback and receive make the contract dispatch by selector/,
    );
  });

  it('refuses a body marked to run against the caller\'s records, by the hidden operand it carries', () => {
    const source = 'pragma solidcash ^0.13.0;'
      + ' contract Impl { int public version;'
      + ' function initialize(address expected) delegate { require(msg.sender == expected); this.version = 7; } }';
    const artifact = compileString(source, { composition: 'per-call' }) as {
      readonly composition?: { readonly refusedEntries?: readonly { readonly reason: string }[] };
    };
    const reasons = (artifact.composition?.refusedEntries ?? []).map((entry) => entry.reason).join(' | ');
    expect(reasons).toContain("'__internal__proxyMasterIndex', which the master head does not supply");
  });

  it('fails the implementation master at the category guard its body emits for the accessed record', () => {
    // The delegate hop laid out by hand, with the implementation's segment declaring the record it writes. The
    // shipped composer builds the program and the shipped machine evaluates the implementation's master.
    const source = 'pragma solidcash ^0.13.0;'
      + ' contract Impl { int public version; function initialize() { this.version = 7; require(true); } }'
      + ' contract Proxy { address implementation;'
      + '   fallback(bytes input) external { this.implementation.delegatecall(input); require(true); } }';
    const { artifacts, contracts } = compileAndDeploy(source, {
      Proxy: 'proxy initialize write proxy', Impl: 'proxy initialize write impl',
    });
    const proxyContract = contracts.Proxy!;
    const implContract = contracts.Impl!;
    const layout = artifacts.Proxy!.stateLayout!;
    const record = new Uint8Array(Buffer.from(
      buildPushdataCommitment(layout, { implementation: implContract.address }, 0), 'hex'));
    const written = new Uint8Array(Buffer.from(
      buildPushdataCommitment(artifacts.Impl!.stateLayout!, { version: 7n }, 0), 'hex'));
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
      calls: [{ kind: FrameKind.DELEGATE, callee: 'impl-1', target: implContract.address, value: 0n,
        argumentPushes: [selector] }],
      segments: [[{ in: recordIndex, out: recordIndex, viewIn: record, viewOut: record }], []],
      argumentPushes: [encodeDataPush(selector)], dispatches: true,
    });
    const implementationMaster = master({
      master: 'impl-1', contract: 'Impl', entry: 'initialize', program: implContract.program,
      facts: facts('Impl', 'initialize', FrameKind.DELEGATE, false),
      frame: { kind: FrameKind.DELEGATE, sender: USER_LOCK, self: proxyContract.address, value: 0n },
      enteredBy: 'proxy-1', origin: 'user',
      segments: [[{ in: recordIndex, out: recordIndex, viewIn: record, viewOut: written }]],
      argumentPushes: [selector],
    });
    const proxyCategoryHex = bytesToHex(proxyContract.category);
    const recordSource = {
      lockingBytecode: stateRecordLockingBytecode(proxyCategoryHex), valueSatoshis: 20_000n,
      token: token(proxyContract.category, 'mutable', record),
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
          source: recordSource,
          output: { ...recordSource, token: token(proxyContract.category, 'mutable', written) },
          unlockingBytecode: stateRecordUnlockingBytecode(proxyCategoryHex, 0, 1),
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
    expect(participant(draft.layout, 'record').index).toBe(recordIndex);
    const program = draft.programFor('impl-1');
    const index = participant(draft.layout, 'impl-1').index;
    const vm = compositionMachine();
    const state = vm.evaluate({
      inputIndex: index, sourceOutputs: program.sourceOutputs, transaction: program.transaction,
    });
    // The implementation's master refuses: its own body checks the accessed record's category against the input
    // that executes (the implementation's master), while the record carries the proxy's category, so the
    // comparison fails before the write's own close is reached. The two values on the stack at the failing
    // instruction are exactly those two categories.
    expect(vm.stateSuccess(state)).not.toBe(true);
    expect(String((state as { readonly error?: string }).error)).toContain('OP_VERIFY');
    const trace = vm.debug(program) as readonly {
      readonly ip: number; readonly stack: readonly Uint8Array[]; readonly error?: string;
    }[];
    const failed = trace.findIndex((entry) => entry.error !== undefined);
    const atFailure = trace[failed - 1]!;
    const compared = [atFailure.stack.at(-1)!, atFailure.stack.at(-2)!]
      .map((bytes) => bytesToHex(bytes)).sort();
    expect(compared).toStrictEqual([
      bytesToHex(chainCategory(implContract.category)), bytesToHex(chainCategory(proxyContract.category)),
    ].sort());
  });

  it('stalls deriving the state-writing initialize at the implementation master', async () => {
    const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
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
    })).rejects.toThrowError(
      /PER_CALL_DERIVATION_STALLED: master "implementation-master" of Impl\.initialize\(\)/,
    );
  });
});
