import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2sh32, hash256 } from '@bitauth/libauth';
import {
  FrameKind,
  asmToScript, computeFunctionSelector, computeFunctionSignature, scriptToBytecode, sha256, validatorAddress,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { fillPlaceholders } from '../../../../solidc/src/framed/master/placeholders.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { callerUnlockingBytecode } from '../../../../solidc/test/framed/master/caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory, validatorSpend,
} from '../../../../solidc/test/framed/master/validator-input.js';
import {
  MOCK_CONSENSUS_LIMITS,
  MockNetworkProvider,
} from '../../../src/network/mock/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import {
  createComposedDerivationHost,
  deriveDepthFirst,
  layoutTransaction,
  validatorFacetsOf,
  type CompositionDraftPlan,
  type DraftMaster,
} from '../../../src/framed/composer/index.js';

/**
 * A composed transaction under the chain's own limits.
 *
 * The reference composition is a real compiled pair of contracts, laid out and assembled by the shipped composer,
 * with the shipped validator program covering them. The chain caps an input's unlocking bytecode at 10,000 bytes
 * and funds its execution at 800 operation-cost units per byte of it, and a transaction is valid only when every
 * input succeeds — so a validator that does not fit is a transaction no node accepts, whatever the mock's profile
 * says about it.
 *
 * The machine here is that chain profile, not the relaxed one: `maximumInputBytes` is the real 10,000 and the
 * operation-cost density is the real 800. The validator spans one input per program part — the head runs in the
 * validator input the masters point at, and the facet the head binds runs at the input after it — so the assertion
 * is about every input the transaction spends, each against the budget its own bytes buy.
 *
 * `MOCK_CONSENSUS_LIMITS` itself lifts the byte caps (1,000,000), which is why the profile is built explicitly
 * rather than taken from the provider's default.
 */

const CONTRACT_INPUT_LIMIT_BYTES = 10_000;
const OP_COST_PER_BYTE = 800;

const CATEGORY_CALLER = seededCategory('consensus limits caller');
const CATEGORY_CALLEE = seededCategory('consensus limits callee');
const ADDRESS_CALLER = validatorAddress(CATEGORY_CALLER, REAL_VALIDATOR_PROGRAM);
const ADDRESS_CALLEE = validatorAddress(CATEGORY_CALLEE, REAL_VALIDATOR_PROGRAM);
const USER_LOCK = new Uint8Array([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x22), 0x88, 0xac]);

const CALLER_ENTRY = 'Caller.callIt()';
const CALLEE_ENTRY = 'Callee.ping()';
const CALLER_MASTER = 'caller-1';
const CALLEE_MASTER = 'callee-1';
const VALIDATOR_ID = 'validator';
const CALLEE_SELECTOR = computeFunctionSelector(computeFunctionSignature('ping', []));

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Caller {'
  + `   function callIt() { ICallee(0x${Buffer.from(ADDRESS_CALLEE).toString('hex')}).ping.call(); require(true); }`
  + ' }';

const empty = new Uint8Array(0);
const mutableToken = (category: Uint8Array): { category: Uint8Array; amount: bigint; nft: { capability: 'mutable'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability: 'mutable', commitment: empty } });
const mintingToken = (category: Uint8Array): { category: Uint8Array; amount: bigint; nft: { capability: 'minting'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability: 'minting', commitment: empty } });

/** The chain's own profile: the byte caps the mock lifts, and the operation-cost density it already publishes. */
function consensusMachine(): ReturnType<typeof createVirtualMachineBch2026ForProvider> {
  return createVirtualMachineBch2026ForProvider(new MockNetworkProvider({
    consensusLimits: { ...MOCK_CONSENSUS_LIMITS, maximumInputBytes: CONTRACT_INPUT_LIMIT_BYTES },
  }));
}

/** The compiled pair, the plan, and the locks the plan's source outputs carry. */
function buildPlan(): CompositionDraftPlan {
  const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
  const program = (name: 'Caller' | 'Callee'): Uint8Array => fillPlaceholders(
    scriptToBytecode(asmToScript(artifacts[name]!.bytecode)),
    artifacts[name]!.composition!.placeholders,
    {
      category: name === 'Caller' ? categorySlotValue(CATEGORY_CALLER) : categorySlotValue(CATEGORY_CALLEE),
      contractAddress: name === 'Caller' ? ADDRESS_CALLER : ADDRESS_CALLEE,
      templateHash: sha256(REAL_VALIDATOR_PROGRAM),
    },
  );
  const callerProgram = program('Caller');
  const calleeProgram = program('Callee');
  const validator = validatorSpend(CATEGORY_CALLER, { roots: [0], masters: [0, 2], settles: [] });

  const callerMaster: DraftMaster = {
    master: CALLER_MASTER,
    contract: 'Caller',
    functionName: CALLER_ENTRY,
    program: callerProgram,
    facts: {
      contract: 'Caller', functionName: 'callIt', kind: FrameKind.ROOT,
      callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: ADDRESS_CALLER, value: 0n },
    enteredBy: 'user',
    origin: 'user',
    calls: [{
      kind: FrameKind.CALL, callee: CALLEE_MASTER, target: ADDRESS_CALLEE, value: 0n,
      argumentPushes: [CALLEE_SELECTOR],
    }],
    retval: empty,
    segments: [[], []],
    events: [],
    sends: [],
    argumentPushes: [],
    redeemScript: callerProgram,
  };
  const calleeMaster: DraftMaster = {
    master: CALLEE_MASTER,
    contract: 'Callee',
    functionName: CALLEE_ENTRY,
    program: calleeProgram,
    facts: {
      contract: 'Callee', functionName: 'ping', kind: FrameKind.CALL,
      callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.CALL, sender: ADDRESS_CALLER, self: ADDRESS_CALLEE, value: 0n },
    enteredBy: CALLER_MASTER,
    origin: 'user',
    calls: [],
    retval: empty,
    segments: [[]],
    events: [],
    sends: [],
    argumentPushes: [CALLEE_SELECTOR],
    redeemScript: calleeProgram,
  };

  const validatorPlan = { id: VALIDATOR_ID, covers: ['Callee'], settles: [], redeemScript: validator.redeem };
  const blocks: CompositionDraftPlan['blocks'] = [
    { contract: 'Caller', masters: [CALLER_MASTER], validator: { id: VALIDATOR_ID, settles: [] }, state: [] },
    { contract: 'Callee', masters: [CALLEE_MASTER], state: [] },
  ];
  // The layout the composer derives, facet included: the plan states the users' positions, and a facet at
  // `head + 1` is one participant the user follows.
  const layout = layoutTransaction(
    blocks,
    new Map([[VALIDATOR_ID, validatorFacetsOf(validatorPlan)]]),
  );

  return {
    blocks,
    userInputs: [{ id: 'user', index: layout.participantCount }],
    masters: [callerMaster, calleeMaster],
    inputs: {
      [CALLER_MASTER]: {
        source: {
          lockingBytecode: encodeLockingBytecodeP2sh32(hash256(callerProgram)),
          valueSatoshis: 20_000n,
          token: mintingToken(CATEGORY_CALLER),
        },
      },
      [CALLEE_MASTER]: {
        source: {
          lockingBytecode: encodeLockingBytecodeP2sh32(hash256(calleeProgram)),
          valueSatoshis: 20_000n,
          token: mintingToken(CATEGORY_CALLEE),
        },
      },
      [VALIDATOR_ID]: {
        source: {
          lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: mutableToken(CATEGORY_CALLER),
        },
      },
      user: {
        source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
        unlockingBytecode: callerUnlockingBytecode(),
      },
    },
    validator: validatorPlan,
  };
}

/** One input's verdict and what it spent against the limit its own bytes buy. */
interface InputMeasurement {
  readonly index: number;
  readonly id: string;
  readonly unlockingBytes: number;
  readonly lockingBytes: number;
  readonly operationCost: number;
  readonly maximumOperationCost: number;
  readonly accepted: boolean;
  readonly objection?: string;
}

const root = { contract: 'Caller', functionName: CALLER_ENTRY, kind: FrameKind.ROOT, master: CALLER_MASTER };

/** Where the composer places the parts: the caller, the head, the facet the head binds, the callee, then the user. */
const HEAD_INDEX = 1;
const FACET_INDEX = 2;

/** Composes the pair through the shipped composer, derives every execution, and evaluates every input. */
function measure(): { measurements: readonly InputMeasurement[]; programBytes: number } {
  const plan = buildPlan();
  const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
  const { host, draft } = createComposedDerivationHost({
    vm: compositionMachine(), artifacts: [artifacts.Caller!, artifacts.Callee!], plan,
  });
  deriveDepthFirst(root, host);

  const template = draft.programFor(CALLER_MASTER);
  const vm = consensusMachine();
  // The layout's participants are the contract's inputs: the caller's master, the validator's head, the facet the
  // head binds, and the callee's master. The user's signed input is not one of them.
  const measurements = draft.layout.participants.map((placed): InputMeasurement => {
    const program = {
      inputIndex: placed.index,
      sourceOutputs: template.sourceOutputs,
      transaction: template.transaction,
    };
    const state = vm.evaluate(program);
    const metrics = (state as {
      readonly metrics?: { readonly operationCost?: number; readonly maximumOperationCost?: number };
    }).metrics;
    const accepted = vm.stateSuccess(state) === true;
    return {
      index: placed.index,
      id: placed.id,
      unlockingBytes: template.transaction.inputs[placed.index]!.unlockingBytecode.length,
      lockingBytes: template.sourceOutputs[placed.index]!.lockingBytecode.length,
      operationCost: metrics?.operationCost ?? 0,
      maximumOperationCost: metrics?.maximumOperationCost ?? 0,
      accepted,
      ...(accepted ? {} : { objection: String((state as { error?: unknown }).error) }),
    };
  });
  return { measurements, programBytes: REAL_VALIDATOR_PROGRAM.length };
}

describe('the composed transaction under the chain\'s own limits', () => {
  it('accepts every input, with each unlocking bytecode inside the 10,000-byte cap', () => {
    const { measurements, programBytes } = measure();
    console.log('composed transaction under the consensus profile', JSON.stringify({
      validatorProgramBytes: programBytes,
      inputs: measurements.map((input) => [
        input.index, input.id, input.unlockingBytes, input.lockingBytes,
        input.operationCost, input.maximumOperationCost, input.accepted,
      ]),
    }));
    // The controls: the profile is the chain's, and the composition is the whole one, validator parts included.
    expect(MOCK_CONSENSUS_LIMITS.maximumInputBytes).toBeGreaterThan(CONTRACT_INPUT_LIMIT_BYTES);
    expect(measurements.map((input) => input.id)).toEqual([
      CALLER_MASTER, VALIDATOR_ID, `${VALIDATOR_ID}/1`, CALLEE_MASTER,
    ]);
    expect(measurements.map((input) => input.accepted)).toEqual(measurements.map(() => true));
    for (const input of measurements) {
      expect(input.unlockingBytes, `input ${input.index} (${input.id})`).toBeLessThanOrEqual(CONTRACT_INPUT_LIMIT_BYTES);
    }
    // The density: each input's own bytes pay for its own operations.
    for (const input of measurements) {
      expect(input.operationCost, `input ${input.index} (${input.id})`)
        .toBeLessThanOrEqual(input.maximumOperationCost);
      expect(input.maximumOperationCost).toBeGreaterThanOrEqual(OP_COST_PER_BYTE * input.unlockingBytes);
    }
  });

  it('refuses the validator input when the head does not carry the facet it binds', () => {
    // The control for the split: the head requires the facet at `head + 1`, so a transaction that leaves it out is
    // refused. Without this the facet's checks could be dropped by leaving its input out.
    const plan = buildPlan();
    const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
    const { host, draft } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [artifacts.Caller!, artifacts.Callee!], plan,
    });
    deriveDepthFirst(root, host);

    const template = draft.programFor(CALLER_MASTER);
    // The same transaction, with the input at `head + 1` locked by something else: the head binds the facet by its
    // lock, so the position no longer holds the code the head names.
    const otherLock = {
      ...template,
      inputIndex: HEAD_INDEX,
      sourceOutputs: template.sourceOutputs.map((output, index) =>
        (index === FACET_INDEX ? { ...output, lockingBytecode: USER_LOCK } : output)),
    };
    const vm = consensusMachine();
    const state = vm.evaluate(otherLock);
    expect(vm.stateSuccess(state)).not.toBe(true);
  });
});
