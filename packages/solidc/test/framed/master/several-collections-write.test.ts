import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import {
  buildEntryNftCovenantScript, computeCollectionHash, encodeWitnessBlock,
  type RecordEntry, type StateLayout, type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { deployMaster, verifyMasterDeployment } from '../../../../solidcash/src/framed/deploy/index.js';
import { encodeEntryCommitment, keyToSlot, keyToSlotMulti } from '../../../../solidcash/src/stateful/SortedList.js';
import { scriptToLockingBytecode } from '../../../../solidcash/src/utils.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, seededCategory } from './validator-input.js';

/**
 * A framed master whose entry writes two verified-mapping collections in one execution.
 *
 * `balances[to] += amount; allowances[owner][spender] += amount` is the shape a token's transfer-and-spend path
 * has: two collections, one of them keyed by two values, each target read from the value its node holds and
 * written back to the same node. A framed master has no SDK plan, so it derives both collections' operands from
 * the records its own frame declares — one group per target, the collections in the order the body writes them,
 * and one created-record count over the body because the trailing region is the body's rather than a collection's.
 *
 * The shipped path runs whole: the source through `compileString` with the framed convention, the program
 * through `deployMaster`, and the BCH-2026 machine is asked for a verdict on the master's own input.
 */

const CATEGORY = seededCategory('several collections framed');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const TO = new Uint8Array(20).fill(0x33);
const OWNER = new Uint8Array(20).fill(0x44);
const SPENDER = new Uint8Array(20).fill(0x55);
const AMOUNT = 42;
const EMPTY = new Uint8Array(0);

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Wallet {'
  + '   mapping(address => uint) balances;'
  + '   mapping(address => mapping(address => uint)) allowances;'
  + '   function spend(address to, address owner, address spender, uint amount) {'
  + '     balances[to] = balances[to] + amount;'
  + '     allowances[owner][spender] = allowances[owner][spender] + amount;'
  + '   }'
  + ' }';

/** The user's signed input first, then the master; the two targets' nodes follow at the entry slots' offsets. */
const USER_INDEX = 0;
const MASTER_INDEX = 1;
const BALANCES_NODE_INDEX = MASTER_INDEX + 1;
const ALLOWANCES_NODE_INDEX = MASTER_INDEX + 2;

const artifact = compileString(SOURCE, { composition: 'framed' });
const deployed = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);
verifyMasterDeployment(deployed, artifact, CATEGORY, VALIDATOR_PROGRAM);
const masterLock = encodeLockingBytecodeP2sh32(hash256(deployed.script));
const stateLayout: StateLayout = artifact.stateLayout!;

/** Each collection's own covenant address, found by the collection signature the layout publishes. */
function entryLockFor(collectionName: string): Uint8Array {
  const collection = stateLayout.collections!.find((candidate) => candidate.signature.startsWith(`${collectionName}:`));
  if (collection === undefined) throw new Error(`the layout publishes no collection for "${collectionName}"`);
  return scriptToLockingBytecode(
    buildEntryNftCovenantScript(CATEGORY, computeCollectionHash(collection.signature)), 'p2sh32',
  );
}
const balancesLock = entryLockFor('balances');
const allowancesLock = entryLockFor('allowances');

const BALANCES_SLOT = keyToSlot(TO);
const ALLOWANCES_SLOT = keyToSlotMulti([OWNER, SPENDER]);
const ZERO_SLOT = new Uint8Array(32);
const BALANCES_SPENT = 7;
const ALLOWANCES_SPENT = 5;
const BALANCES_BEFORE = encodeEntryCommitment(BALANCES_SLOT, ZERO_SLOT, new Uint8Array([BALANCES_SPENT]));
const BALANCES_AFTER = encodeEntryCommitment(BALANCES_SLOT, ZERO_SLOT, new Uint8Array([BALANCES_SPENT + AMOUNT]));
const ALLOWANCES_BEFORE = encodeEntryCommitment(ALLOWANCES_SLOT, ZERO_SLOT, new Uint8Array([ALLOWANCES_SPENT]));
const ALLOWANCES_AFTER = encodeEntryCommitment(
  ALLOWANCES_SLOT, ZERO_SLOT, new Uint8Array([ALLOWANCES_SPENT + AMOUNT]),
);

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

function token(capability: 'minting' | 'mutable', commitmentBytes: Uint8Array): VmOutput['token'] {
  return { category: CATEGORY, amount: 0n, nft: { capability, commitment: commitmentBytes } };
}

/** Both targets are rewritten in place, so each collection's group is one node kept at its own input index. */
function records(): RecordEntry[] {
  return [
    {
      in: BALANCES_NODE_INDEX, out: BALANCES_NODE_INDEX, viewIn: BALANCES_BEFORE, viewOut: BALANCES_AFTER,
    },
    {
      in: ALLOWANCES_NODE_INDEX, out: ALLOWANCES_NODE_INDEX,
      viewIn: ALLOWANCES_BEFORE, viewOut: ALLOWANCES_AFTER,
    },
  ];
}

interface SpendOptions {
  readonly declared?: RecordEntry[];
  readonly balancesWritten?: Uint8Array;
  readonly allowancesWritten?: Uint8Array;
}

/** Builds the master, both nodes and the user's input, and evaluates the master's own input. */
function evaluate(options: SpendOptions = {}): { accepted: boolean; objection?: string } {
  const block: WitnessBlock = {
    kind: 0,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: 0xffff,
    sender: USER_LOCK,
    self: deployed.address,
    value: 0n,
    retval: EMPTY,
    calls: [],
    segments: [options.declared ?? records()],
    events: [],
    sends: [],
  };
  const masterInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(1),
    sequenceNumber: 0xffffffff,
    // Deepest parameter first: `amount`, then `spender`, then `owner`, then `to` on top where the body reads it.
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(block)),
      ...encodeDataPush(new Uint8Array([AMOUNT])),
      ...encodeDataPush(SPENDER),
      ...encodeDataPush(OWNER),
      ...encodeDataPush(TO),
      ...encodeDataPush(deployed.script),
    ]),
  };
  const userInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(4),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: callerUnlockingBytecode(),
  };
  const nodeIndices = [BALANCES_NODE_INDEX, ALLOWANCES_NODE_INDEX];
  const nodeInputs = nodeIndices.map((index) => ({
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(5 + index),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: encodeDataPush(new Uint8Array([1])),
  }));

  const masterOutput = { lockingBytecode: masterLock, valueSatoshis: 20_000n, token: token('minting', EMPTY) };
  const nodeOutputs = [
    {
      lockingBytecode: balancesLock,
      valueSatoshis: 20_000n,
      token: token('mutable', options.balancesWritten ?? BALANCES_AFTER),
    },
    {
      lockingBytecode: allowancesLock,
      valueSatoshis: 20_000n,
      token: token('mutable', options.allowancesWritten ?? ALLOWANCES_AFTER),
    },
  ];
  const transaction: VmTransaction = {
    version: 2,
    inputs: [userInput, masterInput, ...nodeInputs],
    outputs: [{ lockingBytecode: USER_LOCK, valueSatoshis: 100_000n }, masterOutput, ...nodeOutputs],
    locktime: 0,
  };
  const sourceOutputs = [
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
    { lockingBytecode: masterLock, valueSatoshis: 20_000n, token: token('minting', EMPTY) },
    { lockingBytecode: balancesLock, valueSatoshis: 20_000n, token: token('mutable', BALANCES_BEFORE) },
    { lockingBytecode: allowancesLock, valueSatoshis: 20_000n, token: token('mutable', ALLOWANCES_BEFORE) },
  ];
  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: MASTER_INDEX, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error) };
}

describe('a framed master whose entry writes two mapping collections', () => {
  it('publishes both collections and the entry point that writes them', () => {
    expect(artifact.composition?.convention).toBe('framed');
    // The layout spells the value type as the compiler's own reading of it, which is what the collections and
    // their covenant addresses are derived from.
    expect(stateLayout.collections?.map((collection) => collection.signature))
      .toStrictEqual([
        'balances:mapping(address => uint256)',
        'allowances:mapping(address => mapping(address => uint256))',
      ]);
    const declared = artifact.abi.find((entry) => entry.name === 'spend');
    expect(declared?.inputs?.map((input) => input.name)).toStrictEqual(['to', 'owner', 'spender', 'amount']);
  });

  it('derives every collection from its own frame and is accepted by the machine', () => {
    expect(evaluate()).toStrictEqual({ accepted: true });
  });

  it('refuses a value either collection did not compute', () => {
    // Each collection's node carries the value its own read produced: `spent + amount`, one per collection.
    expect(evaluate({
      balancesWritten: encodeEntryCommitment(BALANCES_SLOT, ZERO_SLOT, new Uint8Array([BALANCES_SPENT + AMOUNT + 1])),
    }).accepted).toBe(false);
    expect(evaluate({
      allowancesWritten: encodeEntryCommitment(
        ALLOWANCES_SLOT, ZERO_SLOT, new Uint8Array([ALLOWANCES_SPENT + AMOUNT + 1]),
      ),
    }).accepted).toBe(false);
    expect(evaluate({ balancesWritten: BALANCES_AFTER, allowancesWritten: ALLOWANCES_AFTER }).accepted).toBe(true);
  });

  it('refuses a group declared for the other collection', () => {
    // The two collections are read in the order the body writes them, so a record group whose node carries the
    // other collection's slot names no target the derivation is looking at.
    const swapped: RecordEntry[] = [
      { in: BALANCES_NODE_INDEX, out: BALANCES_NODE_INDEX, viewIn: ALLOWANCES_BEFORE, viewOut: ALLOWANCES_AFTER },
      { in: ALLOWANCES_NODE_INDEX, out: ALLOWANCES_NODE_INDEX, viewIn: BALANCES_BEFORE, viewOut: BALANCES_AFTER },
    ];
    expect(evaluate({ declared: swapped }).accepted).toBe(false);
  });

  it('refuses a segment that declares one collection and not the other', () => {
    expect(evaluate({ declared: [records()[0]!] }).accepted).toBe(false);
    expect(evaluate({ declared: [] }).accepted).toBe(false);
  });
});
