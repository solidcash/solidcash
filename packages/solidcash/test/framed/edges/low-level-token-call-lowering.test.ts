import { describe, expect, it } from 'vitest';
import {
  FrameKind,
  argsHash,
  encodeArgumentList,
  encodeBooleanValue,
  encodeIntegerValue,
  encodeResultList,
  splitFirstPush,
  decodeWitnessBlock,
  type Artifact,
  type CallRecord,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { publishedRefusals } from '../../../../solidc/test/framed/master/refused-entry.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import {
  USER_LOCK, compileAndDeploy, hexOf, master, masterInput, rootOf, seededAddress, selectorOf, token, userInput,
  userInputs, validatorFor, composeAndDerive,
} from '../shapes/harness.js';
import {
  createComposedDerivationHost, type CompositionDraftPlan, type DraftMaster,
} from '../../../src/framed/composer/index.js';

/**
 * A low-level call spelled the way a token wrapper spells it, lowered to the typed call it denotes.
 *
 * `address(t).call(abi.encodeCall(I.transfer, (to, amount)))` and the `abi.encodeWithSelector(I.transfer.selector,
 * ...)` spelling both denote `I(address(t)).transfer(to, amount)`. The framed convention compiles typed calls and
 * refuses the raw calldata form, so the spellings are compared against the typed call through the whole shipped
 * path: compile, deploy, plan, derive and machine. Their call records must agree on the argument digest and the
 * target, and every contract input must be accepted.
 */

const CALLER_LABEL = 'low level call caller';
const TOKEN_LABEL = 'low level call token';
const LABELS = { Caller: CALLER_LABEL, Token: TOKEN_LABEL };
const TOKEN_ADDRESS = seededAddress(TOKEN_LABEL);
const AMOUNT = 5n;

const HEAD = 'pragma solidcash ^0.14.0;'
  + ' interface IERC20 { function transfer(address to, int amount) returns (bool); }'
  + ' contract Token {'
  + '   function transfer(address to, int amount) returns (bool) { require(true); return true; }'
  + ' }';

const TARGET = `0x${hexOf(TOKEN_ADDRESS)}`;
const RECIPIENT = `0x${hexOf(USER_LOCK)}`;

/** The entry binds the low-level result and decodes the bool the callee returned from the returndata. */
const BOUND = HEAD
  + ' contract Caller { function f() {'
  + `   (bool ok, bytes data) = address(${TARGET}).call(abi.encodeCall(IERC20.transfer, (${RECIPIENT}, ${AMOUNT})));`
  + '   require(ok);'
  + '   require(abi.decode(data, (bool)));'
  + ' } }';

/** The bare statement: the low-level result is ignored. */
const BARE = HEAD
  + ' contract Caller { function f() {'
  + `   address(${TARGET}).call(abi.encodeCall(IERC20.transfer, (${RECIPIENT}, ${AMOUNT})));`
  + '   require(true);'
  + ' } }';

/** The selector spelling of the same call. */
const SELECTOR_PAYLOAD = `abi.encodeWithSelector(IERC20.transfer.selector, ${RECIPIENT}, ${AMOUNT})`;
const SELECTOR = HEAD
  + ' contract Caller { function f() {'
  + `   (bool ok, bytes data) = address(${TARGET}).call(${SELECTOR_PAYLOAD});`
  + '   require(ok);'
  + '   require(abi.decode(data, (bool)));'
  + ' } }';

/** The typed call the spellings above denote. */
const TYPED = HEAD
  + ' contract Caller { function f() {'
  + `   bool ok = IERC20(${TARGET}).transfer(${RECIPIENT}, ${AMOUNT});`
  + '   require(ok);'
  + ' } }';

/** The payload held in a local and used by a later low-level call, the OpenZeppelin-style two-statement spelling. */
const LOCAL_BOUND = HEAD
  + ' contract Caller { function f() {'
  + `   bytes memory data = abi.encodeCall(IERC20.transfer, (${RECIPIENT}, ${AMOUNT}));`
  + `   (bool ok, bytes ret) = address(${TARGET}).call(data);`
  + '   require(ok);'
  + '   require(abi.decode(ret, (bool)));'
  + ' } }';

/** The same, with the selector spelling and the low-level result discarded. */
const LOCAL_BARE = HEAD
  + ' contract Caller { function f() {'
  + `   bytes memory data = ${SELECTOR_PAYLOAD};`
  + `   address(${TARGET}).call(data);`
  + '   require(true);'
  + ' } }';

/** The payload local is reassigned before the call, so the binding no longer holds. */
const LOCAL_REASSIGNED = HEAD
  + ' contract Caller { function f() {'
  + `   bytes memory data = abi.encodeCall(IERC20.transfer, (${RECIPIENT}, ${AMOUNT}));`
  + '   data = hex"deadbeef";'
  + `   (bool ok, bytes ret) = address(${TARGET}).call(data);`
  + '   require(ok);'
  + ' } }';

/** The payload local is bound to a plain `abi.encode`, which names no method. */
const LOCAL_OPAQUE = HEAD
  + ' contract Caller { function f() {'
  + `   bytes memory data = abi.encode(${RECIPIENT}, ${AMOUNT});`
  + `   (bool ok, bytes ret) = address(${TARGET}).call(data);`
  + '   require(ok);'
  + ' } }';

/** The payload is handed to a helper whose own body makes the low-level call: the `Address` indirection. */
const HELPER_FORWARD = HEAD
  + ' library Address {'
  + '   function forward(address target, bytes data) {'
  + '     (bool ok, bytes ret) = address(target).call(data);'
  + '     require(ok);'
  + '   }'
  + ' }'
  + ' contract Caller { function f() {'
  + `   bytes memory data = abi.encodeCall(IERC20.transfer, (${RECIPIENT}, ${AMOUNT}));`
  + `   Address.forward(${TARGET}, data);`
  + ' } }';

/** The same helper handed a payload that names no method. */
const HELPER_OPAQUE = HEAD
  + ' library Address {'
  + '   function forward(address target, bytes data) {'
  + '     (bool ok, bytes ret) = address(target).call(data);'
  + '     require(ok);'
  + '   }'
  + ' }'
  + ' contract Caller { function f() {'
  + `   bytes memory data = abi.encode(${RECIPIENT}, ${AMOUNT});`
  + `   Address.forward(${TARGET}, data);`
  + ' } }';

/** The payload local is declared in a nested block and used in that same block. */
const NESTED_BOUND = HEAD
  + ' contract Caller { function f() {'
  + '   {'
  + `     bytes memory data = abi.encodeCall(IERC20.transfer, (${RECIPIENT}, ${AMOUNT}));`
  + `     (bool ok, bytes ret) = address(${TARGET}).call(data);`
  + '     require(ok);'
  + '   }'
  + ' } }';

/** The gate OpenZeppelin's `Address.functionCall` puts beside the call, on the P2SH32 token target itself. */
const GATED = HEAD
  + ' contract Caller { function f() {'
  + `   require(address(${TARGET}).code.length > 0);`
  + `   bool ok = IERC20(${TARGET}).transfer(${RECIPIENT}, ${AMOUNT});`
  + '   require(ok);'
  + ' } }';

/** The same P2SH32 target, gated on having no code: false, because a contract address carries a script. */
const GATED_EMPTY = HEAD
  + ' contract Caller { function f() {'
  + `   require(address(${TARGET}).code.length == 0);`
  + `   bool ok = IERC20(${TARGET}).transfer(${RECIPIENT}, ${AMOUNT});`
  + '   require(ok);'
  + ' } }';

/** The same gate on a plain account (the user's P2PKH lock) rather than a contract target. */
const GATED_PLAIN_ACCOUNT = HEAD
  + ' contract Caller { function f() {'
  + `   require(address(${RECIPIENT}).code.length > 0);`
  + `   bool ok = IERC20(${TARGET}).transfer(${RECIPIENT}, ${AMOUNT});`
  + '   require(ok);'
  + ' } }';

/** The same gate on the zero address. */
const GATED_ZERO = HEAD
  + ' contract Caller { function f() {'
  + '   require(address(0).code.length > 0);'
  + `   bool ok = IERC20(${TARGET}).transfer(${RECIPIENT}, ${AMOUNT});`
  + '   require(ok);'
  + ' } }';

/** A plain account and the zero address, gated on having no code: true, as the EVM answers an account without code. */
const GATED_NO_CODE = HEAD
  + ' contract Caller { function f() {'
  + `   require(address(${RECIPIENT}).code.length == 0);`
  + '   require(address(0).code.length == 0);'
  + `   bool ok = IERC20(${TARGET}).transfer(${RECIPIENT}, ${AMOUNT});`
  + '   require(ok);'
  + ' } }';

/** Why the framed convention refuses an unlowered low-level call. */
const RAW_REFUSAL =
  "the call to '__raw__' takes the direct path's return-event or value-transfer machinery, "
  + 'which a framed body does not emit';

/** The calls a source's compiled artifacts publish as refused, or the empty list when every body is served. */
function refusalsOf(source: string): { functionName: string; reason: string }[] {
  return publishedRefusals(compileStringMulti(source, { composition: 'framed' }));
}

interface Run {
  readonly plan: CompositionDraftPlan;
  readonly artifacts: Artifact[];
  readonly argumentPushes: Uint8Array[];
}

/** The plan every form drives: the caller's entry makes one call to the token's `transfer`. */
function planFor(source: string): Run {
  const { artifacts, contracts } = compileAndDeploy(source, LABELS);
  const caller = contracts.Caller!;
  const tokenContract = contracts.Token!;
  const validator = validatorFor(caller.category);
  const transferSelector = selectorOf(artifacts, 'Token', 'transfer');
  // The call data carries the last parameter's push first, so the amount leads the recipient.
  const argumentPushes = [transferSelector, encodeIntegerValue(AMOUNT), USER_LOCK];

  const callerMaster: DraftMaster = master({
    master: 'caller-1', contract: 'Caller', entry: 'f', program: caller.program,
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: caller.address, value: 0n },
    facts: {
      contract: 'Caller', functionName: 'f', kind: FrameKind.ROOT, callerIsUser: true,
      originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
    },
    enteredBy: 'user', origin: 'user',
    calls: [{ kind: FrameKind.CALL, callee: 'token-1', target: tokenContract.address, value: 0n, argumentPushes }],
    segments: [[], []],
  });
  const tokenMaster: DraftMaster = {
    ...master({
      master: 'token-1', contract: 'Token', entry: 'transfer', program: tokenContract.program,
      frame: { kind: FrameKind.CALL, sender: caller.address, self: tokenContract.address, value: 0n },
      facts: {
        contract: 'Token', functionName: 'transfer', kind: FrameKind.CALL, callerIsUser: false,
        originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
      },
      enteredBy: 'caller-1', origin: 'user', argumentPushes,
    }),
    // The bool the callee's `transfer` returned, in the canonical result encoding.
    retval: encodeResultList([encodeBooleanValue(true)]),
  };

  const plan: CompositionDraftPlan = {
    blocks: [
      { contract: 'Caller', masters: ['caller-1'], validator: { id: 'validator', settles: [] }, state: [] },
      { contract: 'Token', masters: ['token-1'], state: [] },
    ],
    // The facet the validator binds is one participant ahead of the user.
    userInputs: userInputs(['user'], 4),
    masters: [callerMaster, tokenMaster],
    inputs: {
      'caller-1': { source: masterInput(caller) },
      'token-1': { source: masterInput(tokenContract) },
      validator: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(caller.category, 'mutable') },
      },
      user: userInput(),
    },
    validator: { id: 'validator', covers: ['Token'], settles: [], redeemScript: validator.redeem },
  };
  return { plan, artifacts: [artifacts.Caller!, artifacts.Token!], argumentPushes };
}

const ROOT = rootOf('Caller', 'f', 'caller-1');

/** The call record a form's composed transaction carries for the caller's own input, and the digest it must be. */
function callRecord(source: string): { readonly record: CallRecord; readonly expected: Uint8Array } {
  const { plan, artifacts, argumentPushes } = planFor(source);
  const outcome = composeAndDerive(plan, artifacts, [ROOT]);
  const rejected = outcome.verdicts.filter((verdict) => !verdict.accepted)
    .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
  expect(rejected).toStrictEqual([]);
  const block = decodeWitnessBlock(splitFirstPush(outcome.draft.unlockingBytecodeOf('caller-1')).payload);
  expect(block.calls).toHaveLength(1);
  // The digest the shipped encoders produce from the callee's call data: the selector, then the amount, then the
  // recipient. The machine accepting the caller's input is the proof the body recomputes the same digest.
  const expected = argsHash(
    argumentPushes[0]!, encodeArgumentList(argumentPushes.slice(1)),
  );
  return { record: block.calls[0]!, expected };
}

let typedRecord: ReturnType<typeof callRecord> | undefined;
/** The typed call's record, derived once: every spelling below is compared against it. */
function typedCall(): ReturnType<typeof callRecord> {
  typedRecord ??= callRecord(TYPED);
  return typedRecord;
}

describe('a low-level token call whose callee and method are statically known', () => {
  it('lowers to the typed call: the bound and selector spellings settle as the typed call does', () => {
    const typed = typedCall();
    expect(typed.record.argsHash).toStrictEqual(typed.expected);
    expect(typed.record.target).toStrictEqual(TOKEN_ADDRESS);
    // The whole record agrees: kind, target, value, callee reference, argument digest and returned result.
    expect(callRecord(BOUND).record).toStrictEqual(typed.record);
    // The selector spelling compiles to the bound spelling's program, so it settles as that one does.
    const callerOf = (source: string): Artifact => compileStringMulti(source, { composition: 'framed' }).Caller!;
    expect(callerOf(SELECTOR).bytecode).toBe(callerOf(BOUND).bytecode);
  });

  it('lowers the bare statement whose result is ignored to the same typed call', () => {
    expect(callRecord(BARE).record).toStrictEqual(typedCall().record);
  });

  it('lowers a payload held in a local to the typed call, in the binding and discarded positions', () => {
    const typed = typedCall().record;
    // The tuple-assignment spelling reads the local the block bound to an `abi.encodeCall` payload.
    expect(callRecord(LOCAL_BOUND).record).toStrictEqual(typed);
    // The discarded-result spelling reads the local bound to an `abi.encodeWithSelector` payload.
    expect(callRecord(LOCAL_BARE).record).toStrictEqual(typed);
  });

  it('lowers a payload passed to a helper whose own body calls, to the typed call', () => {
    // The helper's parameter is the caller's local and the caller's local is bound to the payload, so the chain is
    // followed name by name across the inlined boundary and the call compiles as the typed call it denotes.
    expect(callRecord(HELPER_FORWARD).record).toStrictEqual(typedCall().record);
  });

  it('leaves the same helper refused when the payload it is handed names no method', () => {
    // The chain resolves to an `abi.encode`, which is opaque, so the body keeps its own refusal.
    expect(refusalsOf(HELPER_OPAQUE)).toStrictEqual([
      { functionName: 'Caller.f()', reason: RAW_REFUSAL },
    ]);
  });

  it('lowers a payload local declared in a nested block to the typed call', () => {
    // The binding is scoped to the block that declared it, but is still in source order before the call.
    expect(callRecord(NESTED_BOUND).record).toStrictEqual(typedCall().record);
  });

  it('leaves a payload local it cannot name refused by name', () => {
    // The local is reassigned after its binding, so the payload the call passes on is no longer the named method.
    expect(refusalsOf(LOCAL_REASSIGNED)).toStrictEqual([
      { functionName: 'Caller.f()', reason: RAW_REFUSAL },
    ]);
    // The local is bound to a plain `abi.encode`, which is opaque: it names no method.
    expect(refusalsOf(LOCAL_OPAQUE)).toStrictEqual([
      { functionName: 'Caller.f()', reason: RAW_REFUSAL },
    ]);
  });

  it('leaves a spelling it cannot name statically refused by name', () => {
    // A selector the compiler only holds at run time: the payload is no longer a named method.
    const runtimeSelector = HEAD
      + ' contract Caller { function f(bytes4 sel) {'
      + `   (bool ok, bytes data) = address(${TARGET}).call(abi.encodeWithSelector(sel, ${RECIPIENT}, ${AMOUNT}));`
      + '   require(ok);'
      + ' } }';
    expect(refusalsOf(runtimeSelector)).toStrictEqual([
      { functionName: 'Caller.f()', reason: RAW_REFUSAL },
    ]);

    // A payload the compiler cannot name at all.
    const opaquePayload = 'pragma solidcash ^0.14.0;'
      + ' contract Caller { function f(bytes payload) {'
      + `   (bool ok, bytes data) = address(${TARGET}).call(payload);`
      + '   require(ok);'
      + ' } }';
    expect(refusalsOf(opaquePayload)).toStrictEqual([
      { functionName: 'Caller.f()', reason: RAW_REFUSAL },
    ]);

    // The served spellings publish no refusal.
    expect(refusalsOf(TYPED)).toStrictEqual([]);
    expect(refusalsOf(SELECTOR)).toStrictEqual([]);
  });
});

/**
 * The machine's own verdict on the caller's input before any witness is filled.
 *
 * The `code.length` boundary is asked here rather than through the derivation: an entry whose gate the target
 * cannot satisfy leaves the caller's witness unfilled, so the derivation stalls before the machine is reached
 * with a filled input. The program is the shipped one; only the witness is absent.
 */
function machineObjection(source: string): string {
  const { plan, artifacts } = planFor(source);
  const { draft } = createComposedDerivationHost({ vm: compositionMachine(), artifacts, plan });
  const program = draft.programFor('caller-1');
  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex: program.inputIndex, sourceOutputs: program.sourceOutputs, transaction: program.transaction,
  });
  return vm.stateSuccess(state) === true ? 'accepted' : String((state as { error?: unknown }).error);
}

describe('the address.code.length gate on a token target', () => {
  it('serves the gate on a P2SH32 target and accepts every contract input', () => {
    const { plan, artifacts } = planFor(GATED);
    const outcome = composeAndDerive(plan, artifacts, [ROOT]);
    const rejected = outcome.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
    expect(rejected).toStrictEqual([]);
    // The gate is a predicate over the target's own script: it adds no call record to the caller's execution.
    const block = decodeWitnessBlock(splitFirstPush(outcome.draft.unlockingBytecodeOf('caller-1')).payload);
    expect(block.calls).toHaveLength(1);

    // The P2SH32 target's length is non-zero, so the opposite gate never settles.
    const empty = planFor(GATED_EMPTY);
    expect(() => composeAndDerive(empty.plan, empty.artifacts, [ROOT])).toThrow(/FRAMED_DERIVATION_STALLED/);
  });

  it('answers zero for a plain account and the zero address, as the EVM does for an account without code', () => {
    // A P2PKH lock is 25 bytes and the zero address is empty, neither the 23- or 35-byte P2SH form, so neither holds
    // a script: the gate on having none settles, and the gate on having some fails at the body's own require.
    const { plan, artifacts } = planFor(GATED_NO_CODE);
    const outcome = composeAndDerive(plan, artifacts, [ROOT]);
    expect(outcome.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    for (const source of [GATED_PLAIN_ACCOUNT, GATED_ZERO]) {
      expect(machineObjection(source)).toBe('Program failed an OP_VERIFY operation.');
    }
  });
});
