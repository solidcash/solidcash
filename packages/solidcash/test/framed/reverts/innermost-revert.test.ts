import { describe, expect, it, vi } from 'vitest';
import { FrameKind, computeFunctionSelector, computeFunctionSignature, validatorAddress } from '@solidcash/utils';
import { compileStringMulti } from 'solidc';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { deployMaster } from '../../../src/framed/deploy/index.js';
import {
  assertCompositionAccepted,
  createComposedDerivationHost,
  deriveDepthFirst,
  reportCompositionRefusal,
  type CompositionDraftPlan,
  type DraftMaster,
} from '../../../src/framed/composer/index.js';
import { COMPOSITION_LIMITS } from '../../../../solidc/test/framed/machine.js';
import { callerUnlockingBytecode } from '../../../../solidc/test/framed/master/caller-input.js';
import { REAL_VALIDATOR_PROGRAM, seededCategory, validatorSpend }
  from '../../../../solidc/test/framed/master/validator-input.js';

/**
 * The reason a refused composition reports, attributed to the innermost frame.
 *
 * A caller contract enters a callee that reverts with a custom error, so the callee's frame is the innermost one
 * that refuses. The composition is built the shipped way — the shipped compiler, the shipped deployment, the
 * shipped composer laying it out and assembling it — and the machine is asked for a verdict on the draft the
 * composer produced. The report is read from the shipped attribution helper, and a provider is watched to show
 * that nothing was broadcast.
 *
 * What the machine itself reports is a bare `OP_VERIFY` failure: the compiler emits a source `revert <Error>(...)`
 * as an unconditional `OP_0 OP_VERIFY` and does not evaluate the error's arguments (there is no revert-data
 * channel on BCH). The error's name and declared argument list therefore come from the artifact's error ABI, which
 * the compiler does publish; the concrete argument values are not on chain and are pinned as unavailable rather
 * than invented.
 */

const CATEGORY_CALLER = seededCategory('refusal caller');
const CATEGORY_CALLEE = seededCategory('refusal callee');
const CATEGORY_INNER = seededCategory('refusal inner');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const ADDRESS_CALLER = validatorAddress(CATEGORY_CALLER, VALIDATOR_PROGRAM);
const ADDRESS_CALLEE = validatorAddress(CATEGORY_CALLEE, VALIDATOR_PROGRAM);
const ADDRESS_INNER = validatorAddress(CATEGORY_INNER, VALIDATOR_PROGRAM);
const USER_LOCK = new Uint8Array([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x22), 0x88, 0xac]);

const CALLER_ENTRY = 'Caller.callIt()';
const CALLEE_ENTRY = 'Callee.ping()';
const CALLER_MASTER = 'caller-1';
const CALLEE_MASTER = 'callee-1';
const INNER_ENTRY = 'Inner.deep()';
const INNER_MASTER = 'inner-1';
const VALIDATOR_ID = 'validator';
const USER_ID = 'user';
const CALLEE_SELECTOR = computeFunctionSelector(computeFunctionSignature('ping', []));
const INNER_SELECTOR = computeFunctionSelector(computeFunctionSignature('deep', []));

/**
 * The composition's source: a caller that calls a callee, with the bodies under test filling each entry.
 *
 * `callerBeforeCall` runs in the caller's body before the call, so a check there refuses before the callee is
 * entered.
 */
function source(calleeBody: string, callerBody: string, callerBeforeCall = ''): string {
  return `pragma solidcash ^0.14.0;
error InsufficientBalance(int requested, int available);
interface ICallee { function ping(); }
contract Callee {
  function ping() {
    ${calleeBody}
  }
}
contract Caller {
  function callIt() {
    ${callerBeforeCall}
    ICallee(0x${Buffer.from(ADDRESS_CALLEE).toString('hex')}).ping.call();
    ${callerBody}
  }
}`;
}

const empty = new Uint8Array(0);
const token = (category: Uint8Array, capability: 'minting' | 'mutable'):
{ category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment: empty } });

interface Composition {
  readonly draft: ReturnType<typeof createComposedDerivationHost>['draft'];
  readonly artifacts: ReturnType<typeof compileStringMulti>;
  readonly provider: MockNetworkProvider;
  readonly vm: ReturnType<typeof createVirtualMachineBch2026ForProvider>;
  /** The shipped derivation's own refusal, which a reverting frame raises before the machine is asked. */
  readonly derivationError?: Error;
}

/**
 * Compiles, deploys, plans and assembles the composition, then runs the shipped derivation.
 *
 * The derivation is attempted and its refusal is kept: a frame that reverts fills no witness, so the shipped
 * derivation stops before the machine is asked for a verdict. The draft it leaves is what the report is read from.
 * `derive: false` keeps the assembled draft before any derivation, the state a settle reports on when it asks the
 * machine about a frame whose callee has not been derived yet.
 */
function build(calleeBody: string, callerBody: string, callerBeforeCall = '', derive = true): Composition {
  const artifacts = compileStringMulti(source(calleeBody, callerBody, callerBeforeCall), { composition: 'framed' });
  const caller = deployMaster(artifacts.Caller!, CATEGORY_CALLER, VALIDATOR_PROGRAM);
  const callee = deployMaster(artifacts.Callee!, CATEGORY_CALLEE, VALIDATOR_PROGRAM);
  const validator = validatorSpend(CATEGORY_CALLER, { roots: [0], masters: [0, 2], settles: [] });

  const callerMaster: DraftMaster = {
    master: CALLER_MASTER, contract: 'Caller', functionName: CALLER_ENTRY, program: caller.script,
    facts: {
      contract: 'Caller', functionName: 'callIt', kind: FrameKind.ROOT, callerIsUser: true,
      originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: ADDRESS_CALLER, value: 0n },
    enteredBy: USER_ID, origin: USER_ID,
    calls: [{
      kind: FrameKind.CALL, callee: CALLEE_MASTER, target: ADDRESS_CALLEE, value: 0n,
      argumentPushes: [CALLEE_SELECTOR],
    }],
    retval: empty, segments: [[], []], events: [], sends: [], argumentPushes: [], redeemScript: caller.script,
  };
  const calleeMaster: DraftMaster = {
    master: CALLEE_MASTER, contract: 'Callee', functionName: CALLEE_ENTRY, program: callee.script,
    facts: {
      contract: 'Callee', functionName: 'ping', kind: FrameKind.CALL, callerIsUser: false,
      originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.CALL, sender: ADDRESS_CALLER, self: ADDRESS_CALLEE, value: 0n },
    enteredBy: CALLER_MASTER, origin: USER_ID, calls: [], retval: empty, segments: [[]],
    events: [], sends: [], argumentPushes: [CALLEE_SELECTOR], redeemScript: callee.script,
  };
  const plan: CompositionDraftPlan = {
    blocks: [
      { contract: 'Caller', masters: [CALLER_MASTER], validator: { id: VALIDATOR_ID, settles: [] }, state: [] },
      { contract: 'Callee', masters: [CALLEE_MASTER], state: [] },
    ],
    // The facet the validator binds is one participant ahead of the user.
    userInputs: [{ id: USER_ID, index: 4 }],
    masters: [callerMaster, calleeMaster],
    inputs: {
      [CALLER_MASTER]: {
        source: {
          lockingBytecode: caller.lockingBytecode, valueSatoshis: 20_000n,
          token: token(CATEGORY_CALLER, 'minting'),
        },
      },
      [CALLEE_MASTER]: {
        source: {
          lockingBytecode: callee.lockingBytecode, valueSatoshis: 20_000n,
          token: token(CATEGORY_CALLEE, 'minting'),
        },
      },
      [VALIDATOR_ID]: {
        source: {
          lockingBytecode: validator.lock, valueSatoshis: 20_000n,
          token: token(CATEGORY_CALLER, 'mutable'),
        },
      },
      [USER_ID]: {
        source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n }, unlockingBytecode: callerUnlockingBytecode(),
      },
    },
    validator: { id: VALIDATOR_ID, covers: ['Callee'], settles: [], redeemScript: validator.redeem },
  };

  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const vm = createVirtualMachineBch2026ForProvider(provider);
  const { host, draft } = createComposedDerivationHost({
    vm, artifacts: [artifacts.Caller!, artifacts.Callee!], plan,
  });
  let derivationError: Error | undefined;
  if (derive) try {
    deriveDepthFirst({ contract: 'Caller', functionName: CALLER_ENTRY, kind: FrameKind.ROOT, master: CALLER_MASTER }, host);
  } catch (error) {
    // A reverting frame fills no witness, so the shipped derivation stops here; the draft stands for the report.
    derivationError = error as Error;
  }
  return { draft, artifacts, provider, vm, ...(derivationError === undefined ? {} : { derivationError }) };
}

/** The 1-based line of the first source line containing `needle`. */
function lineOf(text: string, needle: string): number {
  return text.split('\n').findIndex((line) => line.includes(needle)) + 1;
}

/**
 * The three-frame source for the reachability case.
 *
 * `Caller` fails its own check and never enters `Callee`; `Callee` fails before it enters `Inner`; `Inner` refuses
 * on its own body. All three frames are laid, so the report has to tell the frame the execution reached from the
 * two below it.
 */
function sourceThree(): string {
  return `pragma solidcash ^0.14.0;
interface IInner { function deep(); }
interface ICallee { function ping(); }
contract Inner {
  function deep() { require(false, "inner failed"); }
}
contract Callee {
  function ping() {
    IInner(0x${Buffer.from(ADDRESS_INNER).toString('hex')}).deep();
    require(false, "callee failed");
  }
}
contract Caller {
  function callIt() {
    require(false, "caller failed");
    ICallee(0x${Buffer.from(ADDRESS_CALLEE).toString('hex')}).ping();
  }
}`;
}

/**
 * Assembles three frames without deriving them, then binds the caller's own call.
 *
 * The caller's call is bound by hand because the shipped derivation stops at the caller's failing check; the state
 * the report reads is the one a settle hands it: the reached frame's call bound, the frames below it not.
 */
function buildThree(): {
  readonly draft: ReturnType<typeof createComposedDerivationHost>['draft'];
  readonly artifacts: ReturnType<typeof compileStringMulti>;
  readonly vm: ReturnType<typeof createVirtualMachineBch2026ForProvider>;
} {
  const artifacts = compileStringMulti(sourceThree(), { composition: 'framed' });
  const caller = deployMaster(artifacts.Caller!, CATEGORY_CALLER, VALIDATOR_PROGRAM);
  const callee = deployMaster(artifacts.Callee!, CATEGORY_CALLEE, VALIDATOR_PROGRAM);
  const inner = deployMaster(artifacts.Inner!, CATEGORY_INNER, VALIDATOR_PROGRAM);
  const validator = validatorSpend(CATEGORY_CALLER, { roots: [0], masters: [0, 2], settles: [] });

  const callerMaster: DraftMaster = {
    master: CALLER_MASTER, contract: 'Caller', functionName: CALLER_ENTRY, program: caller.script,
    facts: {
      contract: 'Caller', functionName: 'callIt', kind: FrameKind.ROOT, callerIsUser: true,
      originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: ADDRESS_CALLER, value: 0n },
    enteredBy: USER_ID, origin: USER_ID,
    calls: [{
      kind: FrameKind.CALL, callee: CALLEE_MASTER, target: ADDRESS_CALLEE, value: 0n,
      argumentPushes: [CALLEE_SELECTOR],
    }],
    retval: empty, segments: [[], []], events: [], sends: [], argumentPushes: [], redeemScript: caller.script,
  };
  const calleeMaster: DraftMaster = {
    master: CALLEE_MASTER, contract: 'Callee', functionName: CALLEE_ENTRY, program: callee.script,
    facts: {
      contract: 'Callee', functionName: 'ping', kind: FrameKind.CALL, callerIsUser: false,
      originEqualsCaller: false, makesExternalCall: true, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.CALL, sender: ADDRESS_CALLER, self: ADDRESS_CALLEE, value: 0n },
    enteredBy: CALLER_MASTER, origin: USER_ID,
    calls: [{
      kind: FrameKind.CALL, callee: INNER_MASTER, target: ADDRESS_INNER, value: 0n,
      argumentPushes: [INNER_SELECTOR],
    }],
    retval: empty, segments: [[], []], events: [], sends: [], argumentPushes: [CALLEE_SELECTOR], redeemScript: callee.script,
  };
  const innerMaster: DraftMaster = {
    master: INNER_MASTER, contract: 'Inner', functionName: INNER_ENTRY, program: inner.script,
    facts: {
      contract: 'Inner', functionName: 'deep', kind: FrameKind.CALL, callerIsUser: false,
      originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.CALL, sender: ADDRESS_CALLEE, self: ADDRESS_INNER, value: 0n },
    enteredBy: CALLEE_MASTER, origin: USER_ID, calls: [], retval: empty, segments: [[]],
    events: [], sends: [], argumentPushes: [INNER_SELECTOR], redeemScript: inner.script,
  };
  const plan: CompositionDraftPlan = {
    blocks: [
      { contract: 'Caller', masters: [CALLER_MASTER], validator: { id: VALIDATOR_ID, settles: [] }, state: [] },
      { contract: 'Callee', masters: [CALLEE_MASTER], state: [] },
      { contract: 'Inner', masters: [INNER_MASTER], state: [] },
    ],
    userInputs: [{ id: USER_ID, index: 5 }],
    masters: [callerMaster, calleeMaster, innerMaster],
    inputs: {
      [CALLER_MASTER]: {
        source: {
          lockingBytecode: caller.lockingBytecode, valueSatoshis: 20_000n,
          token: token(CATEGORY_CALLER, 'minting'),
        },
      },
      [CALLEE_MASTER]: {
        source: {
          lockingBytecode: callee.lockingBytecode, valueSatoshis: 20_000n,
          token: token(CATEGORY_CALLEE, 'minting'),
        },
      },
      [INNER_MASTER]: {
        source: {
          lockingBytecode: inner.lockingBytecode, valueSatoshis: 20_000n,
          token: token(CATEGORY_INNER, 'minting'),
        },
      },
      [VALIDATOR_ID]: {
        source: {
          lockingBytecode: validator.lock, valueSatoshis: 20_000n,
          token: token(CATEGORY_CALLER, 'mutable'),
        },
      },
      [USER_ID]: {
        source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n }, unlockingBytecode: callerUnlockingBytecode(),
      },
    },
    validator: { id: VALIDATOR_ID, covers: ['Callee', 'Inner'], settles: [], redeemScript: validator.redeem },
  };

  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const vm = createVirtualMachineBch2026ForProvider(provider);
  const { draft } = createComposedDerivationHost({
    vm, artifacts: [artifacts.Caller!, artifacts.Callee!, artifacts.Inner!], plan,
  });
  draft.blockOf(CALLER_MASTER).calls[0]!.calleeRef =
    draft.layout.participants.find((participant) => participant.id === CALLEE_MASTER)!.index;
  return { draft, artifacts, vm };
}

describe('a refused composition reports its innermost frame reason', () => {
  it('names the callee custom error and its declared arguments, and broadcasts nothing', () => {
    const text = source('revert InsufficientBalance(100, 50);', 'require(true);');
    const { draft, artifacts, provider, vm, derivationError } = build(
      'revert InsufficientBalance(100, 50);', 'require(true);',
    );
    const broadcast = vi.spyOn(provider, 'sendRawTransaction');

    // What the shipped derivation reports on its own: a stall that names the frame and its site but not the reason
    // the frame refused. The machine is never asked, so the report below is what recovers the actual reason.
    expect((derivationError as { code?: string }).code).toBe('FRAMED_DERIVATION_STALLED');
    expect(derivationError!.message).not.toContain('InsufficientBalance');

    let report: ReturnType<typeof reportCompositionRefusal> | undefined;
    try {
      assertCompositionAccepted({ draft, artifacts: [artifacts.Caller!, artifacts.Callee!], vm });
    } catch (error) {
      report = (error as { report: ReturnType<typeof reportCompositionRefusal> }).report;
    }

    expect(report).toBeDefined();
    expect(report!.accepted).toBe(false);
    // The callee refused; the caller did not, so the innermost frame is the callee.
    expect(report!.refusals.map((refusal) => refusal.master)).toStrictEqual([CALLEE_MASTER]);
    const innermost = report!.innermost!;
    expect(innermost.depth).toBe(1);
    expect(innermost.contract).toBe('Callee');
    expect(innermost.functionName).toBe(CALLEE_ENTRY);
    // The error's name and declared argument list come from the artifact's error ABI, which the compiler publishes.
    expect(innermost.reason.error!.name).toBe('InsufficientBalance');
    expect(innermost.reason.error!.parameters).toStrictEqual([
      { name: 'requested', type: 'int256' },
      { name: 'available', type: 'int256' },
    ]);
    expect(innermost.reason.line).toBe(lineOf(text, 'revert InsufficientBalance'));
    // The machine's own objection is a bare verification failure; the values come from where the compiler says the
    // revert leaves them, here the literals it names.
    expect(innermost.objection).toContain('OP_VERIFY');
    expect(innermost.reason.arguments).toStrictEqual([100n, 50n]);

    expect(broadcast).not.toHaveBeenCalled();
  });

  it('reads the values a revert raised from the failing state: a run-time value and a cast', () => {
    // Neither value is a literal: the first is what the running transaction holds, the second a cast whose own
    // conversion the report replays over the bytes the variable holds.
    const body = 'int requested = tx.inputs.length; bytes4 tag = 0x01020304; '
      + 'require(requested > 0); revert InsufficientBalance(requested, int(tag));';
    const { draft, artifacts, vm } = build(body, 'require(true);');
    const report = reportCompositionRefusal({ draft, artifacts: [artifacts.Caller!, artifacts.Callee!], vm });
    const inputs = draft.programFor(CALLER_MASTER).transaction.inputs.length;
    expect(report.innermost!.reason.error!.name).toBe('InsufficientBalance');
    expect(report.innermost!.reason.arguments).toStrictEqual([BigInt(inputs), 0x04030201n]);
  });

  it('reports the callee\'s reason, not the caller\'s, when both frames refuse', () => {
    const text = source('revert InsufficientBalance(100, 50);', 'require(false, "caller failed");');
    const { draft, artifacts, vm } = build(
      'revert InsufficientBalance(100, 50);', 'require(false, "caller failed");',
    );

    const report = reportCompositionRefusal({ draft, artifacts: [artifacts.Caller!, artifacts.Callee!], vm });

    expect(report.accepted).toBe(false);
    // Both frames refused, and the deeper one is named as the innermost.
    expect(report.refusals.map((refusal) => refusal.master).sort()).toStrictEqual([CALLER_MASTER, CALLEE_MASTER].sort());
    // Each frame's own reason is attributed separately: the caller's failing require is named as the caller's.
    const callerRefusal = report.refusals.find((refusal) => refusal.master === CALLER_MASTER)!;
    expect(callerRefusal.depth).toBe(0);
    expect(callerRefusal.reason.message).toBe('caller failed');
    expect(callerRefusal.reason.line).toBe(lineOf(text, 'require(false, "caller failed")'));
    expect(report.innermost!.master).toBe(CALLEE_MASTER);
    expect(report.innermost!.reason.error!.name).toBe('InsufficientBalance');
    expect(report.innermost!.reason.line).toBe(lineOf(text, 'revert InsufficientBalance'));
    expect(report.innermost!.reason.message).not.toBe('caller failed');
  });

  it('reports a caller\'s own check that fails before the call, not the callee frame it never enters', () => {
    // The check runs before the call, so a real execution stops in the caller and never enters the callee. Both
    // frames are laid (the plan is static), and the callee would refuse on its own revert, but its refusal is
    // downstream of a call the caller never made. The report is read before a derivation fills the call reference,
    // which is the state a settle reports on when it asks about a frame whose callee is not derived yet.
    const before = 'require(false, "caller failed");';
    const text = source('revert InsufficientBalance(100, 50);', 'require(true);', before);
    const { draft, artifacts, vm } = build('revert InsufficientBalance(100, 50);', 'require(true);', before, false);

    const report = reportCompositionRefusal({ draft, artifacts: [artifacts.Caller!, artifacts.Callee!], vm });

    expect(report.accepted).toBe(false);
    // Both frames refused, and each reason is attributed to its own frame.
    const callerRefusal = report.refusals.find((refusal) => refusal.master === CALLER_MASTER)!;
    expect(callerRefusal.reason.message).toBe('caller failed');
    expect(callerRefusal.reason.line).toBe(lineOf(text, 'require(false, "caller failed")'));
    const calleeRefusal = report.refusals.find((refusal) => refusal.master === CALLEE_MASTER)!;
    expect(calleeRefusal.reason.error!.name).toBe('InsufficientBalance');
    // The caller's check failed before it executed the call, so its reason is the one that surfaces.
    expect(report.innermost!.master).toBe(CALLER_MASTER);
    expect(report.innermost!.reason.message).toBe('caller failed');
  });

  it('pins a frame that reverts with no message to the machine\'s own objection and its source line', () => {
    const text = source('require(false);', 'require(true);');
    const { draft, artifacts, vm } = build('require(false);', 'require(true);');

    const report = reportCompositionRefusal({ draft, artifacts: [artifacts.Caller!, artifacts.Callee!], vm });
    const innermost = report.innermost!;

    expect(innermost.master).toBe(CALLEE_MASTER);
    // No custom error and no message is published for a bare `require(false)`, so the best report is the line and
    // the machine's own objection rather than a guessed reason.
    expect(innermost.reason.error).toBeUndefined();
    expect(innermost.reason.message).toBeUndefined();
    expect(innermost.reason.line).toBe(lineOf(text, 'require(false);'));
    expect(innermost.objection).toContain('OP_VERIFY');
  });

  it('names the reached caller, not a frame below a call the execution never entered', () => {
    // `Caller` fails its own check; `Callee`'s call to `Inner` is never bound; `Inner` refuses on its own body.
    // The three frames are laid and the caller's own call is bound, so the two frames below it are not on the
    // executed path: the deepest reached frame is the caller, and its own reason is the one reported.
    const text = sourceThree();
    const { draft, artifacts, vm } = buildThree();
    const report = reportCompositionRefusal({
      draft, artifacts: [artifacts.Caller!, artifacts.Callee!, artifacts.Inner!], vm,
    });

    expect(report.accepted).toBe(false);
    // Every frame refused on the machine, and each owns its reason.
    const callerRefusal = report.refusals.find((refusal) => refusal.master === CALLER_MASTER)!;
    expect(callerRefusal.reason.message).toBe('caller failed');
    expect(callerRefusal.reason.line).toBe(lineOf(text, 'require(false, "caller failed")'));
    const innerRefusal = report.refusals.find((refusal) => refusal.master === INNER_MASTER)!;
    expect(innerRefusal.reason.message).toBe('inner failed');
    // The caller's call is bound, but the callee never reached `Inner`, so `Inner` is not the innermost frame.
    expect(report.innermost!.master).toBe(CALLER_MASTER);
    expect(report.innermost!.reason.message).toBe('caller failed');
  });
});
