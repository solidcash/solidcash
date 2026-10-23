import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026 } from '@bitauth/libauth';
import {
  FrameKind,
  buildPushdataCommitment,
  bytesToHex,
  encodeIntegerValue,
  encodeResultList,
  validatorAddress,
  type Artifact,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  deployMaster,
  readFramedDeployment,
  readFramedState,
  stateRecordLockingBytecode,
  stateRecordUnlockingBytecode,
} from '../../../src/framed/deploy/index.js';
import {
  createComposedDerivationHost,
  deriveDepthFirst,
  participant,
  type CompositionDraftPlan,
  type DraftMaster,
} from '../../../src/framed/composer/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import {
  decideReference, type ReferenceTransaction, type ReferenceToken,
} from '../../../src/framed/validator/reference/index.js';
import { callerUnlockingBytecode } from '../../../../solidc/test/framed/master/caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory, validatorSpend,
} from '../../../../solidc/test/framed/master/validator-input.js';

/**
 * Reading a deployed framed contract's record off chain.
 *
 * The record a read resolves is one an earlier composition actually wrote: a `bump` entry runs through the whole
 * shipped path (compile, deploy, composer, derivation), the machine accepts its master and the record's own
 * covenant input, and the commitment its output carries is what the read is pointed at. The read then plans a
 * `STATIC` root over that live record, learns the value the entry computed from the frame's `retval`, and returns
 * it decoded. Nothing is broadcast, which the provider's own transaction count is asserted to show.
 */

const LABEL = 'reads counter';
const CATEGORY = seededCategory(LABEL);
const CATEGORY_HEX = bytesToHex(CATEGORY);
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
const USER_LOCK = new Uint8Array([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x22), 0x88, 0xac]);

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Counter {'
  + '   int public counter;'
  + '   function bump(int by) { this.counter = this.counter + by; require(true); }'
  + '   function current() view returns (int) { return this.counter; }'
  + '   function scaled(int factor) view returns (int) { return this.counter * factor; }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const counter = artifacts.Counter!;
/** The entry's own selector, taken from the compiled artifact's ABI (its signature carries the parameter type). */
const BUMP_SELECTOR = new Uint8Array(Buffer.from(counter.abi.find((row) => row.name === 'bump')!.selector!, 'hex'));

const empty = new Uint8Array(0);
const token = (
  category: Uint8Array,
  capability: 'minting' | 'mutable',
  commitmentBytes: Uint8Array = empty,
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment: commitmentBytes } });

/** A data-NFT commitment holding `counter`, in the shipped encoder's form. */
const commitment = (value: bigint): Uint8Array =>
  new Uint8Array(Buffer.from(buildPushdataCommitment(counter.stateLayout!, { counter: value }, 0), 'hex'));

/** The machine's verdict on one input of the composed transaction. */
function verdict(program: Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0],
  index: number): string {
  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: index, sourceOutputs: program.sourceOutputs, transaction: program.transaction });
  return vm.stateSuccess(state) === true ? 'accepted' : String((state as { error?: unknown }).error);
}

/**
 * The composition an earlier call makes: a user's `bump` entry writes the record from zero to `by`.
 *
 * It runs the shipped path and is accepted by the machine at the entry's own master and at the record's covenant
 * input, so the commitment its output writes is state the contract really produced.
 */
function writeComposition(by: bigint): { readonly written: Uint8Array; readonly verdicts: readonly string[] } {
  const deployed = deployMaster(counter, CATEGORY, VALIDATOR_PROGRAM);
  const validator = validatorSpend(CATEGORY, { roots: [0], masters: [0, 2], settles: [] });
  const before = commitment(0n);
  const after = commitment(by);

  const writer: DraftMaster = {
    master: 'writer', contract: 'Counter', functionName: 'Counter.bump()', program: deployed.script,
    facts: {
      contract: 'Counter', functionName: 'bump', kind: FrameKind.ROOT, callerIsUser: true,
      originEqualsCaller: true, makesExternalCall: false, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: ADDRESS, value: 0n },
    enteredBy: 'user', origin: 'user',
    calls: [], retval: empty,
    // The record sits one participant further on: caller, head, facet, then the record.
    segments: [[{ in: 3, out: 3, viewIn: before, viewOut: after }]],
    events: [], sends: [], argumentPushes: [BUMP_SELECTOR, encodeIntegerValue(by)],
    redeemScript: deployed.script, dispatches: true,
  };

  const recordSource = {
    lockingBytecode: stateRecordLockingBytecode(CATEGORY_HEX),
    valueSatoshis: 20_000n, token: token(CATEGORY, 'mutable', before),
  };
  const plan: CompositionDraftPlan = {
    blocks: [{ contract: 'Counter', masters: ['writer'], validator: { id: 'validator', settles: [] }, state: ['record'] }],
    // The facet the validator binds is one participant ahead of the user.
    userInputs: [{ id: 'user', index: 4 }],
    masters: [writer],
    inputs: {
      writer: {
        source: { lockingBytecode: deployed.lockingBytecode, valueSatoshis: 20_000n, token: token(CATEGORY, 'minting') },
      },
      validator: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(CATEGORY, 'mutable') },
      },
      record: {
        source: recordSource,
        output: { ...recordSource, token: token(CATEGORY, 'mutable', after) },
        unlockingBytecode: stateRecordUnlockingBytecode(CATEGORY_HEX, 0, 1),
      },
      user: {
        source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
        unlockingBytecode: callerUnlockingBytecode(),
      },
    },
    validator: { id: 'validator', covers: [], settles: [], redeemScript: validator.redeem },
  };

  const { host, draft } = createComposedDerivationHost({
    vm: compositionMachine(), artifacts: [counter], plan });
  const beforeDerive = draft.programFor('writer');
  if (verdict(beforeDerive, beforeDerive.inputIndex) !== 'accepted') {
    throw new Error(`writer refuses before derivation: ${verdict(beforeDerive, beforeDerive.inputIndex)}`);
  }
  deriveDepthFirst(
    { contract: 'Counter', functionName: 'Counter.bump()', kind: FrameKind.ROOT, master: 'writer' }, host);

  const program = draft.programFor('writer');
  const written = program.transaction.outputs[participant(draft.layout, 'record').index]!.token?.nft?.commitment;
  expect(written).toStrictEqual(after);
  return { written: after, verdicts: [verdict(program, 0), verdict(program, 2)] };
}

/** The provider a read runs against: the master, a validator and the record at `written`, as the live chain. */
async function chain(provider: MockNetworkProvider, written: Uint8Array): Promise<void> {
  const deployed = deployMaster(counter, CATEGORY, VALIDATOR_PROGRAM);
  const utxo = (txid: string, satoshis: bigint, cap: 'minting' | 'mutable', value: Uint8Array): {
    txid: string; vout: number; satoshis: bigint;
    token: { category: string; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: string } };
  } => ({
    txid, vout: 0, satoshis,
    token: { category: CATEGORY_HEX, amount: 0n, nft: { capability: cap, commitment: bytesToHex(value) } },
  });

  await provider.addUtxo(bytesToHex(deployed.lockingBytecode), utxo('11'.repeat(32), 20_000n, 'minting', empty));
  await provider.addUtxo(bytesToHex(deployed.address), utxo('22'.repeat(32), 20_000n, 'mutable', empty));
  await provider.addUtxo(bytesToHex(stateRecordLockingBytecode(CATEGORY_HEX)),
    utxo('33'.repeat(32), 20_000n, 'mutable', written));
}

/** The provider's own transaction count, chain and mempool together. */
function transactionCount(provider: MockNetworkProvider): number {
  const snapshot = provider.indexer.storage.snapshot() as unknown as { txIndex: Map<string, unknown> };
  return snapshot.txIndex.size;
}

/** The read's derived bytes, as the reference model reads them. */
function toModel(program: Parameters<ReturnType<typeof compositionMachine>['evaluate']>[0],
): ReferenceTransaction {
  type MachineToken = { category: Uint8Array; amount: bigint; nft?: { capability: string; commitment: Uint8Array } };
  const shape = (held: MachineToken | undefined): ReferenceToken => (held === undefined
    ? { category: new Uint8Array(0), capability: 0, hasNft: false, nftCommitment: new Uint8Array(0), amount: 0n }
    : {
      category: held.category,
      capability: held.nft?.capability === 'minting' ? 2 : held.nft?.capability === 'mutable' ? 1 : 0,
      hasNft: held.nft !== undefined,
      nftCommitment: held.nft?.commitment ?? new Uint8Array(0),
      amount: held.amount,
    });
  return {
    inputs: program.transaction.inputs.map((input, index) => ({
      index,
      value: program.sourceOutputs[index]!.valueSatoshis,
      lockingBytecode: program.sourceOutputs[index]!.lockingBytecode,
      unlockingBytecode: input.unlockingBytecode,
      token: shape(program.sourceOutputs[index]!.token as MachineToken | undefined),
      outpointTransactionHash: input.outpointTransactionHash,
      outpointIndex: input.outpointIndex,
    })),
    outputs: program.transaction.outputs.map((output, index) => ({
      index,
      value: output.valueSatoshis,
      lockingBytecode: output.lockingBytecode,
      token: shape(output.token as MachineToken | undefined),
    })),
  };
}

describe('reading a framed record the contract already wrote', () => {
  it('reads back the value an earlier accepted composition wrote', async () => {
    const { written, verdicts } = writeComposition(7n);
    expect(verdicts).toStrictEqual(['accepted', 'accepted']);

    const provider = new MockNetworkProvider();
    await chain(provider, written);

    const result = await readFramedEntry({
      provider, artifact: counter, categoryId: CATEGORY_HEX, functionName: 'current', vm: compositionMachine(),
    });

    expect(result.accepted).toBe(true);
    expect(result.value).toBe(7n);
    // The bytes on the derived transaction are the entry's own answer, read back through the shipped decoder.
    expect(result.retval).toStrictEqual(encodeResultList([encodeIntegerValue(7n)]));

    // The read's own frame and the record it spends are accepted by the machine, and the record is recreated
    // unchanged, so the read changed nothing.
    const program = result.draft.programFor('read');
    const recordIndex = participant(result.draft.layout, 'record-0').index;
    expect(verdict(program, program.inputIndex)).toBe('accepted');
    expect(verdict(program, recordIndex)).toBe('accepted');
    expect(program.transaction.outputs[recordIndex]!.token?.nft?.commitment).toStrictEqual(written);
    expect(program.sourceOutputs[recordIndex]!.token?.nft?.commitment).toStrictEqual(written);
  });

  it('reads the value the deployment layer decodes from the same live record', async () => {
    const provider = new MockNetworkProvider();
    await chain(provider, commitment(41n));

    const state = await readFramedState(provider, CATEGORY_HEX, counter.stateLayout!);
    expect(state.byNft[0]!.counter).toBe(41n);

    const result = await readFramedEntry({
      provider, artifact: counter, categoryId: CATEGORY_HEX, functionName: 'current', vm: compositionMachine(),
    });
    expect(result.accepted).toBe(true);
    expect(result.value).toBe(41n);
    expect(result.value).toBe(state.byNft[0]!.counter);
  });

  it('passes an argument into the read and returns what the entry computed with it', async () => {
    const provider = new MockNetworkProvider();
    await chain(provider, commitment(7n));

    const result = await readFramedEntry({
      provider, artifact: counter, categoryId: CATEGORY_HEX, functionName: 'scaled', args: [3n],
      vm: compositionMachine(),
    });
    expect(result.accepted).toBe(true);
    expect(result.value).toBe(21n);
  });

  it('broadcasts nothing: the provider\'s transaction count is unchanged', async () => {
    const provider = new MockNetworkProvider();
    await chain(provider, commitment(7n));
    const discovery = await readFramedDeployment(provider, CATEGORY_HEX, counter.stateLayout!);
    expect(discovery.records).toHaveLength(1);

    const before = transactionCount(provider);
    const result = await readFramedEntry({
      provider, artifact: counter, categoryId: CATEGORY_HEX, functionName: 'current', vm: compositionMachine(),
    });
    expect(result.accepted).toBe(true);
    expect(transactionCount(provider)).toBe(before);
  });

  it('is read-only to the validator reference, which refuses its shape as a composition root', async () => {
    // The reference model carries the read-only rules (V10), but it decides a composition's transcript, and a read
    // is a root frame no user entered. It lands on the root's caller not being a covered master.
    const provider = new MockNetworkProvider();
    await chain(provider, commitment(7n));
    const result = await readFramedEntry({
      provider, artifact: counter, categoryId: CATEGORY_HEX, functionName: 'current', vm: compositionMachine(),
    });
    const program = result.draft.programFor('read');
    const decision = decideReference(toModel(program), {
      validatorTemplate: VALIDATOR_PROGRAM,
      validatorInputIndex: participant(result.draft.layout, 'validator').index,
    });
    expect(result.accepted).toBe(true);
    expect(decision.accepted).toBe(false);
    expect(`${decision.check}:${decision.reason}`).toBe('V4:A_NON_ROOT_CALLER_IS_NOT_A_COVERED_MASTER');
  });

  it('reports the machine\'s objection when the read entry refuses', async () => {
    // A record of zero fails the entry's own guard, so its body never reaches the return comparison.
    const refusing = 'pragma solidcash ^0.14.0;\n'
      + ' contract Guarded {\n'
      + '   int public counter;\n'
      + '   function current() view returns (int) {\n'
      + '     require(this.counter > 0, "counter must be positive");\n'
      + '     return this.counter;\n'
      + '   }\n'
      + ' }';
    const guarded = compileStringMulti(refusing, { composition: 'framed' }).Guarded!;
    const deployed = deployMaster(guarded, CATEGORY, VALIDATOR_PROGRAM);
    // The record holds zero, which is what the entry's own guard refuses.
    const zero = new Uint8Array(Buffer.from(buildPushdataCommitment(guarded.stateLayout!, { counter: 0n }, 0), 'hex'));
    const provider = new MockNetworkProvider();
    const utxo = (txid: string, cap: 'minting' | 'mutable', value: Uint8Array): {
      txid: string; vout: number; satoshis: bigint;
      token: { category: string; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: string } };
    } => ({ txid, vout: 0, satoshis: 20_000n,
      token: { category: CATEGORY_HEX, amount: 0n, nft: { capability: cap, commitment: bytesToHex(value) } } });
    await provider.addUtxo(bytesToHex(deployed.lockingBytecode), utxo('11'.repeat(32), 'minting', empty));
    await provider.addUtxo(bytesToHex(deployed.address), utxo('22'.repeat(32), 'mutable', empty));
    await provider.addUtxo(bytesToHex(stateRecordLockingBytecode(CATEGORY_HEX)), utxo('33'.repeat(32), 'mutable', zero));

    const result = await readFramedEntry({
      provider, artifact: guarded as Artifact, categoryId: CATEGORY_HEX, functionName: 'current',
      vm: compositionMachine(),
    });
    expect(result.accepted).toBe(false);
    // The read's refusal lands on the same surface a refused composition reports: the read frame is named, a source
    // line is attributed, the machine's objection is carried, and so is the `require`'s own message.
    expect(result.refusal?.innermost?.master).toBe('read');
    expect(result.objection).toMatch(/frame "read" of Guarded\.current\(\) at line \d+/);
    expect(result.objection).toMatch(/OP_VERIFY/);
    expect(guarded.debug?.requires?.some((entry) => entry.message === 'counter must be positive')).toBe(true);
    expect(result.refusal?.innermost?.reason.message).toBe('counter must be positive');
    expect(result.values).toStrictEqual([]);
  });
});
