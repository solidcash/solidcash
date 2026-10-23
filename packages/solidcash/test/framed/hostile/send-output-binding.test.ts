import { beforeAll, describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { concatBytes, encodeWitnessBlock, splitFirstPush, type Artifact, type WitnessBlock } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry, sendFramedValue, type FramedCallResult } from '../../../src/framed/call/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * Which output a listed send names.
 *
 * A send entry is only an output index: no compiled master bakes a position for a value send, because the lock it
 * pays is a run-time value the body computes. This case asks whether the index is bound by anything on the real
 * path. It derives one accepted value send through the shipped composer and machine, then moves the output that
 * index names on the assembled spend and asks the machine for a verdict on the master and on the validator:
 *
 * - the body that computed the send reads its own region slot (the `n`-th send it made), takes the output index the
 *   block listed there and pins the recipient lock, the amount and the empty token it computed at exactly that
 *   index; it also pins that index to its own output region, requiring the output one before it to be a container
 *   of its contract. So renaming the output that index points at (its lock, or its value), or inserting an output
 *   where it points, is refused by the body, while the validator's own rules only read the index and the value it
 *   carries.
 * - what the nominated index is free to be is therefore any output that already carries the computed lock and the
 *   computed amount, at the position the frame's container immediately precedes, and only such an output.
 *   Re-listing the send at another output of that exact shape changes neither recipient nor amount, so the freedom
 *   grants the builder nothing. That acceptance is pinned below.
 *
 * Every coordinate comes from the shipped path: `compileStringMulti` with the framed convention, the shipped
 * deployment and call composer, and the BCH-2026 machine. The single difference from the accepted spend in each
 * case is the field under test.
 */

const CATEGORY_HEX = '5a'.repeat(31) + 'a5';
const CALLER_TXID = '5b'.repeat(31) + 'a4';
const AMOUNT = 15_000n;
const DEPOSIT = 20_000n;
const MASTER_ID = 'master';

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Holder {'
  + '   int public paid;'
  + '   receive() external payable { require(true); }'
  + '   function withdraw(int amount) { this.paid = this.paid + amount; this.transfer(msg.sender, amount); }'
  + ' }';

const holder = compileStringMulti(SOURCE, { composition: 'framed' }).Holder!;

interface Deployed {
  readonly artifact: Artifact;
  readonly provider: MockNetworkProvider;
  readonly categoryId: string;
  readonly callerUtxo: { txid: string; vout: number; satoshis: bigint };
  readonly callerLock: Uint8Array;
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
}

/** Deploys the sending contract and funds a caller coin at its own P2PKH lock. */
async function deploy(artifact: Artifact): Promise<Deployed> {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const fundingUtxo = { txid: CATEGORY_HEX, vout: 0, satoshis: 500_000n };
  await provider.addUtxo(funder.address, fundingUtxo);
  const deployment = await deployStatefulContract(artifact, [], {
    provider,
    fundingUtxo,
    funder: funder.unlock.spend(alicePub, signature),
    changeAddress: funder.address,
  });
  const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: CALLER_TXID, vout: 0, satoshis: 200_000n };
  await provider.addUtxo(binToHex(callerLock), callerUtxo);
  await fundShippedFacets(provider);
  return {
    artifact, provider, categoryId: deployment.categoryId, callerUtxo, callerLock, funder: signature.unlockP2PKH(),
  };
}

/** The call options, less the entry and the value. */
function callerOf(deployed: Deployed): Parameters<typeof sendFramedValue>[0] {
  return {
    provider: deployed.provider,
    artifact: deployed.artifact,
    categoryId: deployed.categoryId,
    callerUtxo: deployed.callerUtxo,
    callerLockingBytecode: deployed.callerLock,
    funder: deployed.funder,
    vm: compositionMachine(),
    value: 0n,
  };
}

/** The caller's current tokenless coin: the last call's change. */
async function currentCaller(deployed: Deployed): Promise<Parameters<typeof sendFramedValue>[0]> {
  const coins = (await deployed.provider.getUtxosForLockingBytecode(deployed.callerLock))
    .filter((utxo) => utxo.token === undefined)
    .sort((left, right) => (left.satoshis > right.satoshis ? -1 : 1));
  return { ...callerOf(deployed), callerUtxo: coins[0]! };
}

type VmProgram = Parameters<ReturnType<typeof compositionMachine>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmSourceOutputs = VmProgram['sourceOutputs'];
type VmOutput = VmTransaction['outputs'][number];

/** One participant's verdict, named as the layout names it. */
interface Verdict {
  readonly id: string;
  readonly accepted: boolean;
  readonly objection?: string;
}

/** The machine's answer on every participant input of one spend. */
function machineVerdicts(
  transaction: VmTransaction,
  sourceOutputs: VmSourceOutputs,
  participants: { readonly id: string; readonly index: number }[],
): Verdict[] {
  const vm = compositionMachine();
  return participants.map((placed) => {
    const state = vm.evaluate({ inputIndex: placed.index, sourceOutputs, transaction });
    return vm.stateSuccess(state) === true
      ? { id: placed.id, accepted: true }
      : { id: placed.id, accepted: false, objection: String((state as { readonly error?: unknown }).error) };
  });
}

interface Composition {
  readonly transaction: VmTransaction;
  readonly sourceOutputs: VmSourceOutputs;
  readonly participants: { readonly id: string; readonly index: number }[];
  readonly result: FramedCallResult;
}

/** The accepted value-send composition: deployed, called, assembled. */
let accepted: Composition | undefined;

beforeAll(async () => {
  const deployed = await deploy(holder);
  await sendFramedValue({ ...callerOf(deployed), value: DEPOSIT });
  const result = await callFramedEntry({
    ...(await currentCaller(deployed)), functionName: 'withdraw', args: [AMOUNT],
  });
  accepted = {
    transaction: structuredClone(result.transaction) as VmTransaction,
    sourceOutputs: result.sourceOutputs,
    participants: result.draft.layout.participants.map((placed) => ({ id: placed.id, index: placed.index })),
    result,
  };
});

/** The one accepted run, once the `beforeAll` has built it. */
function composition(): Composition {
  if (accepted === undefined) throw new Error('the composition was not built');
  return accepted;
}

/** The index of the participant the layout placed for one identity. */
function indexOf(compositionValue: Composition, id: string): number {
  const placed = compositionValue.participants.find((candidate) => candidate.id === id);
  if (placed === undefined) throw new Error(`no participant "${id}"`);
  return placed.index;
}

/** The output index the master's block lists for its one send. */
function sendIndex(compositionValue: Composition): number {
  const sends = compositionValue.result.draft.blockOf(MASTER_ID).sends;
  expect(sends).toHaveLength(1);
  return sends[0]!;
}

/**
 * A copy of the accepted spend, with `apply` free to rewrite outputs, and the master's block rebuilt through the
 * same builder the composer used. The argument/redeem bytes after the block are carried over untouched.
 */
function rebuilt(
  compositionValue: Composition,
  apply: (draft: { transaction: VmTransaction; block: WitnessBlock }) => void,
): VmTransaction {
  const masterIndex = indexOf(compositionValue, MASTER_ID);
  const transaction = structuredClone(compositionValue.transaction) as VmTransaction;
  const original = compositionValue.transaction.inputs[masterIndex]!.unlockingBytecode;
  const block = structuredClone(compositionValue.result.draft.blockOf(MASTER_ID)) as WitnessBlock;
  apply({ transaction, block });
  const { rest } = splitFirstPush(original);
  transaction.inputs[masterIndex] = {
    ...transaction.inputs[masterIndex]!,
    unlockingBytecode: concatBytes([encodeDataPush(encodeWitnessBlock(block)), rest]),
  };
  return transaction;
}

/** The participant id whose verdict refused, with its objection, or undefined when all accepted. */
function refusal(verdicts: readonly Verdict[]): string | undefined {
  const refused = verdicts.find((verdict) => !verdict.accepted);
  return refused === undefined ? undefined : `${refused.id}: ${refused.objection ?? 'refused'}`;
}

describe('the output a listed send names', () => {
  it('accepts the assembled spend, so each case below is a difference from an accepted transcript', () => {
    const { transaction, sourceOutputs, participants } = composition();
    expect(refusal(machineVerdicts(transaction, sourceOutputs, participants))).toBeUndefined();
    expect(composition().result.draft.blockOf(MASTER_ID).sends).toHaveLength(1);
  });

  it('accepts an unchanged rebuild of the block, so the builder below is not what refuses', () => {
    const compositionValue = composition();
    const transaction = rebuilt(compositionValue, () => undefined);
    expect(refusal(machineVerdicts(transaction, compositionValue.sourceOutputs, compositionValue.participants)))
      .toBeUndefined();
  });

  it('refuses a named output whose lock the body did not compute, while the validator accepts', () => {
    // The listed index still names a 25-byte send-shaped output of the same amount, but paid to a stranger's lock.
    // Nothing in the validator reads a listed send's lock; the body pins the recipient it computed at exactly the
    // named index, so the master is what refuses.
    const compositionValue = composition();
    const stranger = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x99));
    const transaction = rebuilt(compositionValue, ({ transaction: draft }) => {
      draft.outputs[sendIndex(compositionValue)] = {
        ...draft.outputs[sendIndex(compositionValue)]!, lockingBytecode: stranger,
      };
    });

    const verdicts = machineVerdicts(transaction, compositionValue.sourceOutputs, compositionValue.participants);
    expect(verdicts.find((verdict) => verdict.id === MASTER_ID)!.accepted).toBe(false);
    // The validator is not what refuses: its rules are the index, its value, and no two sends sharing it.
    expect(verdicts.filter((verdict) => verdict.id !== MASTER_ID).every((verdict) => verdict.accepted)).toBe(true);
  });

  it('accepts the index naming another output that is already exactly what the body computed', () => {
    // What the index is free to be, and all it is free to be: an output that already carries the computed lock and
    // amount, at the position the frame's own container immediately precedes. A duplicate of the send is placed
    // there, funded out of the caller's own change, and the block re-lists the send at it. Recipient and amount are
    // exactly what the accepted spend paid and the contract's container grew by nothing, so the builder gains
    // nothing. Together with the lock refusal above, and the value and container refusals a compiled master gives
    // in `solidc/test/framed/master/send-output.test.ts`, this pins the property: the index is bound by the
    // container it follows and by the lock, amount and empty token the body computed at it, and by nothing else.
    const compositionValue = composition();
    const original = sendIndex(compositionValue);
    const output = compositionValue.transaction.outputs[original]!;
    const changeIndex = compositionValue.transaction.outputs.length - 1;
    const change = compositionValue.transaction.outputs[changeIndex]!;
    expect(change.valueSatoshis).toBeGreaterThanOrEqual(AMOUNT);

    const transaction = rebuilt(compositionValue, ({ transaction: draft, block }) => {
      draft.outputs[changeIndex] = { ...draft.outputs[changeIndex]!, valueSatoshis: change.valueSatoshis - AMOUNT };
      draft.outputs.splice(original, 0, {
        lockingBytecode: output.lockingBytecode, valueSatoshis: AMOUNT,
      } as VmOutput);
      block.sends = [original];
    });

    expect(refusal(machineVerdicts(transaction, compositionValue.sourceOutputs, compositionValue.participants)))
      .toBeUndefined();
    // The amount and the recipient the named index now holds are exactly what the accepted spend paid.
    expect(transaction.outputs[original]!.valueSatoshis).toBe(AMOUNT);
    expect(binToHex(transaction.outputs[original]!.lockingBytecode)).toBe(binToHex(output.lockingBytecode));
  });
});
