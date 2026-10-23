import { describe, expect, it } from 'vitest';
import { encodeDataPush } from '@bitauth/libauth';
import {
  FrameKind, buildEntryNftCovenantScript, bytesToHex, computeCollectionHash, encodeIntegerValue,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { deployMaster } from '../../../src/framed/deploy/index.js';
import { encodeEntryCommitment } from '../../../src/stateful/SortedList.js';
import { scriptToLockingBytecode } from '../../../src/utils.js';
import {
  createComposedDerivationHost, deriveDepthFirst, layOutMappingWrites, participant, planMappingWrite,
  type CompositionDraftPlan, type DraftMaster, type MappingNodePlacement,
} from '../../../src/framed/composer/index.js';
import { REAL_VALIDATOR_PROGRAM, seededCategory } from '../../../../solidc/test/framed/master/validator-input.js';
import { userInput, USER_LOCK } from '../shapes/harness.js';

/**
 * A mapping that grows: one entry writes a key the list does not hold.
 *
 * The write is an INSERT, so its segment declares two records — the head sentinel relinked in place and the node
 * the write creates at the transaction's trailing output. The composer plans both from the shipped sorted-list
 * encoder and places the created output at the index the layout allocates; the machine's verdict is the master's
 * own input, which is where the derived sorted-batch proof runs.
 *
 * The draft gives every input an output, so the created node's trailing output is carried by the root user's own
 * input, whose output the plan overrides: the master is the only input the machine evaluates here.
 */

const CATEGORY = seededCategory('records growing registry');
const KEY = new Uint8Array(20).fill(0x44);
const VALUE = 10n;
const HEAD_INDEX = 2;
const CREATED_INDEX = 1;
const ZERO_SLOT = new Uint8Array(32);

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Registry {'
  + '   mapping(address => uint) public balances;'
  + `   function seed() { balances[0x${Buffer.from(KEY).toString('hex')}] = ${VALUE}; require(true); }`
  + ' }';

const token = (
  capability: 'minting' | 'mutable',
  commitment: Uint8Array,
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: Uint8Array } } =>
  ({ category: CATEGORY, amount: 0n, nft: { capability, commitment } });

const artifact = compileStringMulti(SOURCE, { composition: 'framed' }).Registry!;
const deployed = deployMaster(artifact, CATEGORY, REAL_VALIDATOR_PROGRAM);
const entryLock = scriptToLockingBytecode(
  buildEntryNftCovenantScript(CATEGORY, computeCollectionHash(artifact.stateLayout!.collections![0]!.signature)),
  'p2sh32',
);
/** The head sentinel the transaction spends: slot 0 pointing at nothing. */
const HEAD_BEFORE = encodeEntryCommitment(ZERO_SLOT, ZERO_SLOT);

/** Everything the one insert needs: the plan, the two record commitments and the composed draft. */
function composeInsert(): ReturnType<typeof createComposedDerivationHost> {
  const write = planMappingWrite({
    keys: [KEY], value: VALUE, inventory: [HEAD_BEFORE], encodeValue: (n) => encodeIntegerValue(n),
  });
  const created = write.written.find((entry) => !entry.existed)!;
  const placements = new Map<string, MappingNodePlacement>([
    [bytesToHex(ZERO_SLOT), { in: HEAD_INDEX, out: HEAD_INDEX }],
    [bytesToHex(created.slot), { out: CREATED_INDEX }],
  ]);
  const segments = layOutMappingWrites([[write]], { placementOf: (slot) => placements.get(bytesToHex(slot)) });

  const master: DraftMaster = {
    master: 'registry-1', contract: 'Registry', functionName: 'Registry.seed()', program: deployed.script,
    facts: {
      contract: 'Registry', functionName: 'seed', kind: FrameKind.ROOT,
      callerIsUser: true, originEqualsCaller: true, makesExternalCall: false, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: deployed.address, value: 0n },
    enteredBy: 'user', origin: 'user', calls: [], retval: new Uint8Array(0), segments,
    events: [], sends: [], argumentPushes: [], redeemScript: deployed.script,
  };
  const headSource = {
    lockingBytecode: entryLock, valueSatoshis: 1_500n, token: token('mutable', HEAD_BEFORE),
  };
  const plan: CompositionDraftPlan = {
    blocks: [{ contract: 'Registry', masters: ['registry-1'], state: [] }],
    userInputs: [{ id: 'user', index: CREATED_INDEX }, { id: 'head', index: HEAD_INDEX }],
    masters: [master],
    inputs: {
      'registry-1': { source: { lockingBytecode: deployed.lockingBytecode, valueSatoshis: 20_000n, token: token('minting', new Uint8Array(0)) } },
      user: {
        source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
        output: { lockingBytecode: entryLock, valueSatoshis: 1_500n, token: token('mutable', created.after) },
        unlockingBytecode: userInput().unlockingBytecode,
      },
      head: {
        source: headSource,
        output: { ...headSource, token: token('mutable', write.written[0]!.after) },
        unlockingBytecode: encodeDataPush(new Uint8Array([1])),
      },
    },
  };
  const { host, draft } = createComposedDerivationHost({
    vm: compositionMachine(), artifacts: [artifact], plan });
  deriveDepthFirst({ contract: 'Registry', functionName: 'Registry.seed()', kind: FrameKind.ROOT, master: 'registry-1' }, host);
  return { host, draft };
}

describe('a mapping entry that creates a record', () => {
  it('relinks the predecessor and creates the node, accepted by the machine', () => {
    const { draft } = composeInsert();
    expect(participant(draft.layout, 'registry-1').index).toBe(0);
    // The created node is a trailing output; the layout allocates the one the plan named.
    expect(draft.assembly.outputs.createdIndices).toStrictEqual([CREATED_INDEX]);
    // The one segment declares the relinked predecessor in place, then the created node with no input.
    expect(draft.blockOf('registry-1').segments.map((segment) => segment.map((entry) => [entry.in, entry.out])))
      .toStrictEqual([[[HEAD_INDEX, HEAD_INDEX], [0xffff, CREATED_INDEX]]]);

    const program = draft.programFor('registry-1');
    const vm = compositionMachine();
    const state = vm.evaluate({
      inputIndex: program.inputIndex, sourceOutputs: program.sourceOutputs, transaction: program.transaction,
    });
    expect(vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) })
      .toStrictEqual({ accepted: true });
  });
});
