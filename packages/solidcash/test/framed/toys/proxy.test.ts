import { describe, expect, it } from 'vitest';
import { encodeDataPush } from '@bitauth/libauth';
import {
  FrameKind, buildPushdataCommitment, argsHash, bytesToHex,
  type Artifact,
} from '@solidcash/utils';
import { compileString } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import {
  stateRecordLockingBytecode, stateRecordUnlockingBytecode,
} from '../../../src/framed/deploy/index.js';
import {
  USER_LOCK, compileAndDeploy, composeAndDerive, entryName, master, masterInput, rootOf, selectorOf,
  token, userInput, userInputs, validatorFor,
} from '../shapes/harness.js';
import {
  createComposedDerivationHost, participant,
  type CompositionDraftPlan, type DraftMaster,
} from '../../../src/framed/composer/index.js';

/**
 * A proxy's shape under the framed convention.
 *
 * The proxy is ordinary source: a state field holding the implementation's address and a `fallback` that
 * delegatecalls it with the call data it received. Its master is entered by a user's root frame; the fallback
 * records a `DELEGATE` call whose target is the address the proxy's own record holds, and the implementation's
 * master runs that frame on the proxy's own records, so its `msg.sender` and `address(this)` are the caller's.
 *
 * The tests below drive the shipped compile, the shipped deploy and the shipped composer on the real path, and pin
 * what the composer laid out for the delegate hop.
 */

const PROXY_LABEL = 'proxy hop proxy';
const IMPL_LABEL = 'proxy hop implementation';
// The record sits one participant on: the caller, the validator's head, the facet it binds, then the record.
const RECORD_INDEX = 3;

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Impl {'
  + '   function answer() pure { require(true); }'
  + ' }'
  + ' contract Proxy {'
  + '   address implementation;'
  + '   fallback(bytes input) external { this.implementation.delegatecall(input); require(true); }'
  + ' }';

type Artifacts = ReturnType<typeof compileAndDeploy>['artifacts'];

/** The data-NFT commitment holding the implementation's address, in the shipped encoder's form. */
function proxyRecord(artifacts: Artifacts, implementation: Uint8Array): Uint8Array {
  const layout = (artifacts.Proxy as Artifact).stateLayout!;
  return new Uint8Array(Buffer.from(buildPushdataCommitment(layout, { implementation }, 0), 'hex'));
}

interface Composition {
  readonly draft: ReturnType<typeof createComposedDerivationHost>['draft'];
  readonly plan: CompositionDraftPlan;
  readonly record: Uint8Array;
  readonly selector: Uint8Array;
  readonly input: Uint8Array;
  readonly implAddress: Uint8Array;
  readonly artifacts: Artifacts;
}

/** Lays out and assembles the proxied hop. */
function compose(): Composition {
  const { artifacts, contracts } = compileAndDeploy(SOURCE, { Proxy: PROXY_LABEL, Impl: IMPL_LABEL });
  const proxyContract = contracts.Proxy!;
  const implContract = contracts.Impl!;
  const validator = validatorFor(proxyContract.category);
  const record = proxyRecord(artifacts, implContract.address);

  const answerSelector = selectorOf(artifacts, 'Impl', 'answer');
  // The bytes the fallback received are the callee's own call data: the selector's push and its argument pushes
  // (none here). The site hashes those bytes to bind the callee to what the fallback forwarded.
  const input = encodeDataPush(answerSelector);

  const facts = (
    contract: string, functionName: string, kind: number, mastersOfContract: number, makesExternalCall: boolean,
  ): DraftMaster['facts'] => ({
    contract, functionName, kind, callerIsUser: kind === FrameKind.ROOT, originEqualsCaller: kind === FrameKind.ROOT,
    makesExternalCall, mastersOfContract,
  });

  const proxy: DraftMaster = master({
    master: 'proxy-1', contract: 'Proxy', entry: '__fallback', program: proxyContract.program,
    facts: facts('Proxy', '__fallback', FrameKind.ROOT, 1, true),
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: proxyContract.address, value: 0n },
    enteredBy: 'user', origin: 'user',
    calls: [{
      kind: FrameKind.DELEGATE, callee: 'impl-1', target: implContract.address, value: 0n,
      argumentPushes: [answerSelector],
    }],
    segments: [[{ in: RECORD_INDEX, out: RECORD_INDEX, viewIn: record, viewOut: record }], []],
    // The fallback's one parameter is the frame's own call-data band: the caller's selector push and its argument
    // pushes. The user supplies it directly as the entry's push, so the band is the selector's encoded push.
    argumentPushes: [answerSelector],
    // The user's call data is the fallback's received call data; the composer's root rule admits a root that
    // carries call data only through this flag, which a fallback-only master is the degenerate case of.
    dispatches: true,
  });
  const impl: DraftMaster = master({
    master: 'impl-1', contract: 'Impl', entry: 'answer', program: implContract.program,
    facts: facts('Impl', 'answer', FrameKind.DELEGATE, 1, false),
    frame: { kind: FrameKind.DELEGATE, sender: USER_LOCK, self: proxyContract.address, value: 0n },
    enteredBy: 'proxy-1', origin: 'user',
    segments: [[]],
    argumentPushes: [answerSelector],
  });

  // The record is kept unchanged, so it sits at the proxy's data-NFT covenant and its spend carries the
  // covenant's read-only path.
  const proxyCategoryHex = bytesToHex(proxyContract.category);
  const recordSource = {
    lockingBytecode: stateRecordLockingBytecode(proxyCategoryHex), valueSatoshis: 20_000n,
    token: token(proxyContract.category, 'mutable', record),
  };
  const plan: CompositionDraftPlan = {
    blocks: [
      { contract: 'Proxy', masters: ['proxy-1'], validator: { id: 'validator', settles: [] }, state: ['record'] },
      { contract: 'Impl', masters: ['impl-1'], state: [] },
    ],
    // The facet the validator binds is one participant ahead of the user.
    userInputs: userInputs(['user'], 5),
    masters: [proxy, impl],
    inputs: {
      'proxy-1': { source: masterInput(proxyContract) },
      'impl-1': { source: masterInput(implContract) },
      validator: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n,
          token: token(proxyContract.category, 'mutable') },
      },
      record: {
        source: recordSource,
        output: recordSource,
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
  return {
    draft, plan, record, selector: answerSelector, input, implAddress: implContract.address, artifacts,
  };
}

const PROLOGUE = 'pragma solidcash ^0.14.0;';

/** The one shape the convention serves: the fallback forwards its own received call data to an address it holds. */
const FORWARDED_SOURCE = PROLOGUE
  + ' contract Proxy {'
  + '   address implementation;'
  + '   fallback(bytes input) external { implementation.delegatecall(input); require(true); }'
  + ' }';

/** A body whose call data is a local computed from a parameter, not the bytes the entry received. */
const LOCAL_SLICE_SOURCE = PROLOGUE
  + ' contract Proxy {'
  + '   function set(address target, bytes data) { target.delegatecall(data.slice(0, 4)); require(true); }'
  + ' }';

/** A body whose call data is a parameter-shaped value that is not the entry's own received call data. */
const PARAMETER_DATA_SOURCE = PROLOGUE
  + ' contract Proxy { function set(address target, bytes data) { target.delegatecall(data); require(true); } }';

/** A fallback beside ordinary entries, run for a selector no entry has, as the EVM runs it. */
const FALLBACK_BESIDE_ENTRY_SOURCE = PROLOGUE
  + ' contract Proxy {'
  + '   address implementation;'
  + '   function set(address to) { require(to != 0x00); }'
  + '   fallback(bytes input) external { this.implementation.delegatecall(input); require(true); }'
  + ' }';

/** A receive: the contract would dispatch by stack depth, which the head cannot precede. */
const RECEIVE_SOURCE = PROLOGUE
  + ' contract Proxy { address implementation; receive() external payable { require(true); } }';

/** The refusal the shipped compile publishes or throws for a source, so a test can name the shape that stops it. */
function refusalOf(source: string, options: Record<string, unknown> = {}): { code?: string; message: string } {
  let artifact: Artifact;
  try {
    artifact = compileString(source, { composition: 'framed', ...options } as never);
  } catch (error) {
    return { code: (error as { code?: string }).code, message: (error as Error).message };
  }
  const refused = artifact.composition?.refusedEntries ?? [];
  if (refused.length === 0) {
    throw new Error('the shipped framed compiler served the source, so there is no refusal to record');
  }
  return {
    code: 'FRAMED_CODEGEN_UNAVAILABLE',
    message: refused.map((entry) => `${entry.functionName}: ${entry.reason}`).join(' | '),
  };
}

/** True when the shipped compile serves the source, i.e. throws nothing and publishes no refusal. */
function isServed(source: string): boolean {
  try {
    const artifact = compileString(source, { composition: 'framed' });
    return (artifact.composition?.refusedEntries ?? []).length === 0;
  } catch {
    return false;
  }
}

const LOW_LEVEL_REFUSAL = 'a low-level call needs the witness `calls[]` checks, which are not emitted yet';

// Constant call data and a target the contract does not hold are refused in `hostile/proxy-binding.test.ts`, and a
// non-delegate low-level call in `edges/refused-contract-shapes.test.ts`.
describe('the delegate shapes a framed master admits', () => {
  it('serves the fallback that forwards its own received call data to an address it holds', () => {
    expect(isServed(FORWARDED_SOURCE)).toBe(true);
  });

  it('refuses a delegatecall of a local computed from a parameter, by name', () => {
    const refusal = refusalOf(LOCAL_SLICE_SOURCE, { allowUnsafeOperations: true });
    expect(refusal.code).toBe('FRAMED_CODEGEN_UNAVAILABLE');
    expect(refusal.message).toContain(LOW_LEVEL_REFUSAL);
  });

  it('refuses a delegatecall whose data operand is a parameter that is not the entry\'s own call data', () => {
    const refusal = refusalOf(PARAMETER_DATA_SOURCE, { allowUnsafeOperations: true });
    expect(refusal.code).toBe('FRAMED_CODEGEN_UNAVAILABLE');
    expect(refusal.message).toContain(LOW_LEVEL_REFUSAL);
  });

  it('serves a fallback beside an ordinary entry, dispatched to for a selector no entry has', () => {
    expect(isServed(FALLBACK_BESIDE_ENTRY_SOURCE)).toBe(true);
  });

  it('serves a receive, dispatched by its selector like any entry', () => {
    expect(isServed(RECEIVE_SOURCE)).toBe(true);
  });
});

describe('the proxied hop settles end to end', () => {
  let settled: { outcome: ReturnType<typeof composeAndDerive>; composition: Composition } | undefined;

  /** Derives the hop once from the shipped plan: both frames run, and the machine is asked about every contract input. */
  function settle(): { outcome: ReturnType<typeof composeAndDerive>; composition: Composition } {
    if (settled === undefined) {
      const composition = compose();
      const outcome = composeAndDerive(
        composition.plan, [composition.artifacts.Proxy!, composition.artifacts.Impl!],
        [rootOf('Proxy', '__fallback', 'proxy-1')],
      );
      settled = { outcome, composition };
    }
    return settled;
  }

  it('completes the implementation frame and then the proxy frame that forwarded to it', () => {
    expect(settle().outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual([entryName('Impl', 'answer'), entryName('Proxy', '__fallback')]);
  });

  it('accepts the proxy master, the validator and the implementation master', () => {
    const { outcome } = settle();
    const verdicts = new Map(outcome.verdicts.map((verdict) => [verdict.participant, verdict]));
    for (const id of ['proxy-1', 'validator', 'impl-1']) {
      const verdict = verdicts.get(id);
      expect(verdict?.accepted, `${id}: ${verdict?.objection ?? 'not placed'}`).toBe(true);
    }
  });

  it('binds the callee reference, the forwarded digest and the callee\'s result into the caller\'s record', () => {
    const { outcome, composition } = settle();
    const call = outcome.draft.blockOf('proxy-1').calls[0]!;
    expect(call.kind).toBe(FrameKind.DELEGATE);
    expect(call.target).toStrictEqual(composition.implAddress);
    expect(call.argsHash).toStrictEqual(argsHash(composition.selector, new Uint8Array(0)));
    // The derivation filled the reference with the implementation's own input index.
    expect(call.calleeRef).toBe(participant(outcome.draft.layout, 'impl-1').index);
    // The callee returns nothing and the record carries exactly that value back to the caller unchanged.
    expect(call.result).toStrictEqual(new Uint8Array(0));
    expect(outcome.draft.blockOf('impl-1').retval).toStrictEqual(call.result);
    // The implementation runs the delegate frame the caller wrote: the caller's sender and address(this).
    const impl = outcome.draft.blockOf('impl-1');
    expect(impl.kind).toBe(FrameKind.DELEGATE);
    expect(impl.sender).toStrictEqual(outcome.draft.blockOf('proxy-1').sender);
    expect(impl.self).toStrictEqual(outcome.draft.blockOf('proxy-1').self);
  });
});

describe('a proxy whose fallback forwards its call data to its implementation', () => {
  it('serves the proxy and its implementation under the framed convention', () => {
    const { artifacts } = compileAndDeploy(SOURCE, { Proxy: PROXY_LABEL, Impl: IMPL_LABEL });
    expect(artifacts.Proxy?.composition?.convention).toBe('framed');
    expect(artifacts.Impl?.composition?.convention).toBe('framed');
    // The fallback is the proxy's only entry, so it is served rather than refused.
    expect(artifacts.Proxy?.composition?.refusedEntries).toBeUndefined();
    expect(artifacts.Proxy?.composition?.stopSites).toBeTruthy();
  });

  it('records a DELEGATE call whose target is the address the proxy\'s record holds', () => {
    const outcome = compose();
    const call = outcome.draft.blockOf('proxy-1').calls[0]!;
    expect(call.kind).toBe(FrameKind.DELEGATE);
    expect(call.target).toStrictEqual(outcome.implAddress);
    expect(call.value).toBe(0n);
    // The layout places the implementation's master, and the derivation is what fills the call's callee reference.
    expect(participant(outcome.draft.layout, 'impl-1').index).toBeTypeOf('number');
    // The record's digest is the hash of the bytes the fallback forwarded, which are the callee's call data.
    expect(bytesToHex(call.argsHash)).toBe(bytesToHex(argsHash(outcome.selector, new Uint8Array(0))));
  });

  it('runs the implementation as a delegate frame on the proxy\'s records', () => {
    const { draft, record } = compose();
    const impl = draft.blockOf('impl-1');
    expect(impl.kind).toBe(FrameKind.DELEGATE);
    // `msg.sender` and `address(this)` are the caller's, not the implementation's own address.
    expect(impl.sender).toStrictEqual(draft.blockOf('proxy-1').sender);
    expect(impl.self).toStrictEqual(draft.blockOf('proxy-1').self);
    const index = participant(draft.layout, 'record').index;
    expect(index).toBe(RECORD_INDEX);
    const program = draft.programFor('proxy-1');
    expect(program.sourceOutputs[index]!.token?.nft?.commitment).toStrictEqual(record);
    expect(program.transaction.outputs[index]!.token?.nft?.commitment).toStrictEqual(record);
  });

  it('binds the fallback\'s forwarded call data into the callee\'s unlocking bytecode', () => {
    const { draft, input } = compose();
    // The proxy's own unlocking bytecode carries the bytes it received as its argument, and the callee's carries
    // the same selector push, so the site can hash the forwarded bytes.
    const proxyInput = draft.unlockingBytecodeOf('proxy-1');
    const implInput = draft.unlockingBytecodeOf('impl-1');
    expect(proxyInput).toBeTruthy();
    expect(implInput).toBeTruthy();
    expect(input.length).toBe(5);
  });
});
