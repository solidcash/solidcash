import { describe, expect, it } from 'vitest';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { encodeDataPush } from '@bitauth/libauth';
import {
  FrameKind, buildEntryNftCovenantScript, computeCollectionHash, encodeIntegerValue, bytesToHex,
} from '@solidcash/utils';
import { scriptToLockingBytecode } from '../../../src/utils.js';
import { encodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import {
  USER_LOCK, compileAndDeploy, entryName, master, masterInput, seededAddress, selectorOf, token, userInput,
  userInputs, validatorFor, hexOf,
} from '../shapes/harness.js';
import {
  createComposedDerivationHost, deriveComposition, layOutMappingWrites, participant, planMappingWrite,
  type CompositionDraft, type CompositionDraftPlan, type DerivationResult, type DraftMaster,
  type MappingNodePlacement, type MappingWritePlan,
} from '../../../src/framed/composer/index.js';

/**
 * Fan-in: `Hub.go` approves `Vault` on `Token`, then calls `Vault.pull`, which calls `Token.transferFrom`.
 * `Token.transferFrom` reads `allowance[VAULT]` and writes it back, so `Token` is entered twice and its second
 * frame works on the entry its first frame wrote.
 *
 * The read-modify-write of one entry is admitted by the compiler, and the composition settles: a mapping node's
 * record group is declared per segment, so the approval frame closes against the `40` it computes while the pull
 * frame reads that same `40` and closes against the `0` it computes. The transaction has one commitment for the
 * node - the `7` it spends and the `0` it writes - so the two frames only agree because each resolves the node
 * against its own segment's declaration rather than against the transaction, and the settlement ties the first
 * declaration to the spent commitment and the last to the written one.
 *
 * The plan supplies only identities, the allowed record declarations and the covenant the node sits at; the
 * layout, the callee indices and the derivation order come from the shipped composer and derivation.
 */

const TOKEN_LABEL = 'fan in token';
const VAULT_LABEL = 'fan in vault';
const HUB_LABEL = 'fan in hub';
const TOKEN = hexOf(seededAddress(TOKEN_LABEL));
const VAULT = hexOf(seededAddress(VAULT_LABEL));
const HUB = hexOf(seededAddress(HUB_LABEL));
const SPENDER = seededAddress(VAULT_LABEL);
const HOLDER = seededAddress(HUB_LABEL);

/** The composer gives a user-entered master no call data, so the root takes no argument and the amount is fixed. */
const AMOUNT = 40n;
const PREVIOUS = 7n;
// The hub, its validator and the facet it binds, the vault, the token's two masters, then the node.
const NODE_INDEX = 6;
const ZERO_SLOT = new Uint8Array(32);

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IToken {'
  + '   function approve(address spender, int amount);'
  + '   function transferFrom(address holder, address recipient, int amount);'
  + ' }'
  + ' interface IPull { function pull(); }'
  + ' contract Token {'
  + '   mapping(address => int) allowance;'
  + '   function approve(address spender, int amount) { this.allowance[spender] = amount; require(true); }'
  + '   function transferFrom(address holder, address recipient, int amount) {'
  + '     require(this.allowance[recipient] >= amount);'
  + '     this.allowance[recipient] = this.allowance[recipient] - amount;'
  + '     require(true);'
  + '   }'
  + ' }'
  + ' contract Vault {'
  + `   function pull() { IToken(0x${TOKEN}).transferFrom(0x${HUB}, 0x${VAULT}, 40); require(true); }`
  + ' }'
  + ' contract Hub {'
  + `   function go() { IToken(0x${TOKEN}).approve(0x${VAULT}, 40); IPull(0x${VAULT}).pull(); require(true); }`
  + ' }';

/** One node of the allowance list, carrying a value as its tail. */
function node(slot: Uint8Array, value: bigint): Uint8Array {
  return encodeEntryCommitment(slot, ZERO_SLOT, encodeIntegerValue(value));
}

/**
 * Lays out, assembles and derives the fan-in composition.
 *
 * The plan declares the two writes of the one allowance node: the approval from `7` to `40` and the pull from `40`
 * to `0`, each in its own frame's segment. The transaction spends `7` and writes `0`, which is the only pair of
 * commitments one node can have in one transaction.
 */
function drive(): {
  readonly draft: CompositionDraft;
  readonly derived: DerivationResult;
  readonly slot: Uint8Array;
  readonly transferWrite: MappingWritePlan;
} {
  const { artifacts, contracts } = compileAndDeploy(SOURCE, {
    Token: TOKEN_LABEL, Vault: VAULT_LABEL, Hub: HUB_LABEL,
  });
  const tokenContract = contracts.Token!;
  const vaultContract = contracts.Vault!;
  const hubContract = contracts.Hub!;
  const validator = validatorFor(hubContract.category);

  const slot = keyToSlotMulti([SPENDER]);
  const approveWrite = planMappingWrite({
    keys: [SPENDER], value: AMOUNT, inventory: [node(slot, PREVIOUS)], encodeValue: (n) => encodeIntegerValue(n),
  });
  const transferWrite = planMappingWrite({
    keys: [SPENDER], value: 0n, inventory: [approveWrite.written[0]!.after], encodeValue: (n) => encodeIntegerValue(n),
  });
  const placements = new Map<string, MappingNodePlacement>([
    [bytesToHex(slot), { in: NODE_INDEX, out: NODE_INDEX }],
  ]);
  const approveSegments = layOutMappingWrites([[approveWrite]], { placementOf: (s) => placements.get(bytesToHex(s)) });
  const transferSegments = layOutMappingWrites([[transferWrite]], { placementOf: (s) => placements.get(bytesToHex(s)) });

  const approveSelector = selectorOf(artifacts, 'Token', 'approve');
  const transferSelector = selectorOf(artifacts, 'Token', 'transferFrom');
  const pullSelector = selectorOf(artifacts, 'Vault', 'pull');
  const amountPush = encodeIntegerValue(AMOUNT);

  const facts = (
    contract: string, functionName: string, kind: number, mastersOfContract: number, makesExternalCall: boolean,
  ): DraftMaster['facts'] => ({
    contract, functionName, kind, callerIsUser: kind === FrameKind.ROOT, originEqualsCaller: kind === FrameKind.ROOT,
    makesExternalCall, mastersOfContract,
  });

  const hub: DraftMaster = master({
    master: 'hub-1', contract: 'Hub', entry: 'go', program: hubContract.program,
    facts: facts('Hub', 'go', FrameKind.ROOT, 1, true),
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: hubContract.address, value: 0n },
    enteredBy: 'user', origin: 'user',
    calls: [
      { kind: FrameKind.CALL, callee: 'approve-1', target: tokenContract.address, value: 0n,
        argumentPushes: [approveSelector, amountPush, SPENDER] },
      { kind: FrameKind.CALL, callee: 'vault-1', target: vaultContract.address, value: 0n,
        argumentPushes: [pullSelector] },
    ],
    segments: [[], [], []],
  });
  const vault: DraftMaster = master({
    master: 'vault-1', contract: 'Vault', entry: 'pull', program: vaultContract.program,
    facts: facts('Vault', 'pull', FrameKind.CALL, 1, true),
    frame: { kind: FrameKind.CALL, sender: hubContract.address, self: vaultContract.address, value: 0n },
    enteredBy: 'hub-1', origin: 'user',
    calls: [{ kind: FrameKind.CALL, callee: 'transferFrom-1', target: tokenContract.address, value: 0n,
      argumentPushes: [transferSelector, amountPush, SPENDER, HOLDER] }],
    argumentPushes: [pullSelector], segments: [[], []],
  });
  const approve: DraftMaster = {
    ...master({
      master: 'approve-1', contract: 'Token', entry: 'approve', program: tokenContract.program,
      facts: facts('Token', 'approve', FrameKind.CALL, 2, false),
      frame: { kind: FrameKind.CALL, sender: hubContract.address, self: tokenContract.address, value: 0n },
      enteredBy: 'hub-1', origin: 'user',
      segments: approveSegments, argumentPushes: [approveSelector, amountPush, SPENDER],
    }),
    dispatches: true,
  };
  const transfer: DraftMaster = {
    ...master({
      master: 'transferFrom-1', contract: 'Token', entry: 'transferFrom', program: tokenContract.program,
      facts: facts('Token', 'transferFrom', FrameKind.CALL, 2, false),
      frame: { kind: FrameKind.CALL, sender: vaultContract.address, self: tokenContract.address, value: 0n },
      enteredBy: 'vault-1', origin: 'user',
      segments: transferSegments, argumentPushes: [transferSelector, amountPush, SPENDER, HOLDER],
    }),
    dispatches: true,
  };

  // The node is locked by the allowance collection's own entry covenant: a body reads and closes an entry against
  // that covenant's address, so the UTXO the transaction spends is the one the collection mints.
  const allowanceSignature = artifacts.Token!.stateLayout!.collections![0]!.signature;
  const entryLock = scriptToLockingBytecode(
    buildEntryNftCovenantScript(tokenContract.category, computeCollectionHash(allowanceSignature)), 'p2sh32',
  );
  const nodeSource = {
    lockingBytecode: entryLock, valueSatoshis: 20_000n,
    token: token(tokenContract.category, 'mutable', node(slot, PREVIOUS)),
  };
  const plan: CompositionDraftPlan = {
    blocks: [
      { contract: 'Hub', masters: ['hub-1'], validator: { id: 'validator', settles: [] }, state: [] },
      { contract: 'Vault', masters: ['vault-1'], state: [] },
      { contract: 'Token', masters: ['approve-1', 'transferFrom-1'], state: ['node'] },
    ],
    userInputs: userInputs(['user'], NODE_INDEX + 1),
    masters: [hub, vault, approve, transfer],
    inputs: {
      'hub-1': { source: masterInput(hubContract) },
      'vault-1': { source: masterInput(vaultContract) },
      'approve-1': { source: masterInput(tokenContract) },
      'transferFrom-1': { source: masterInput(tokenContract) },
      validator: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n,
          token: token(hubContract.category, 'mutable') },
      },
      node: {
        source: nodeSource,
        output: { ...nodeSource, token: token(tokenContract.category, 'mutable', transferWrite.written[0]!.after) },
        unlockingBytecode: encodeDataPush(new Uint8Array([1])),
      },
      user: userInput(),
    },
    validator: {
      id: 'validator', covers: ['Vault', 'Token'],
      settles: [{ category: tokenContract.category, stateInputs: ['node'] }],
      redeemScript: validator.redeem,
    },
  };

  const { host, draft } = createComposedDerivationHost({
    vm: compositionMachine(),
    artifacts: [artifacts.Hub!, artifacts.Vault!, artifacts.Token!], plan,
  });
  const derived = deriveComposition(
    [{ contract: 'Hub', functionName: entryName('Hub', 'go'), kind: FrameKind.ROOT, master: 'hub-1' }],
    host,
  );
  return { draft, derived, slot, transferWrite };
}

/** The machine's verdict on one participant's own input of the assembled transaction. */
function verdictAt(draft: ReturnType<typeof createComposedDerivationHost>['draft'], id: string): string {
  const program = draft.programFor('hub-1');
  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex: participant(draft.layout, id).index,
    sourceOutputs: program.sourceOutputs,
    transaction: program.transaction,
  });
  return vm.stateSuccess(state) === true ? 'accepted' : `refused: ${String(state.error)}`;
}

describe('a caller approving a vault that pulls through the token', () => {
  it('compiles: the read-modify-write of one allowance entry is admitted', () => {
    const { artifacts } = compileAndDeploy(SOURCE, {
      Token: TOKEN_LABEL, Vault: VAULT_LABEL, Hub: HUB_LABEL,
    });
    expect(artifacts.Token?.composition?.convention).toBe('framed');
    expect(artifacts.Token?.stateLayout?.mappings?.map((mapping) => mapping.name)).toStrictEqual(['allowance']);
  });

  it('settles the pull-through: the second frame reads the allowance the first frame declared', () => {
    // The approval frame reads the node at the `7` its segment declares and closes it against the `40` it
    // computes; the pull frame reads `40` and closes against the `0` it computes. The transaction itself has one
    // commitment for the node - the `7` it spends and the `0` it writes - so the frames can only agree because
    // each resolves the node against its own segment's declaration rather than against the transaction.
    const { draft, derived, slot, transferWrite } = drive();
    expect(derived.completed.map((frame) => frame.master))
      .toStrictEqual(['approve-1', 'transferFrom-1', 'vault-1', 'hub-1']);
    for (const id of ['approve-1', 'transferFrom-1', 'vault-1', 'hub-1', 'validator']) {
      expect(`${id}: ${verdictAt(draft, id)}`).toBe(`${id}: accepted`);
    }

    // The node input carries the `7` the list held and the node output the `0` the pull left, read back through
    // the shipped encoder and held to the write the composer planned.
    const program = draft.programFor('hub-1');
    const nodeIndex = participant(draft.layout, 'node').index;
    expect(program.sourceOutputs[nodeIndex]!.token?.nft?.commitment).toStrictEqual(node(slot, PREVIOUS));
    expect(program.transaction.outputs[nodeIndex]!.token?.nft?.commitment).toStrictEqual(node(slot, 0n));
    expect(program.transaction.outputs[nodeIndex]!.token?.nft?.commitment)
      .toStrictEqual(transferWrite.written[0]!.after);
  });

  it('refuses a pull whose declared close is not the one the frame computed', () => {
    // The control for the settle above: the pull frame closes the node against the `0` it computes from the `40`
    // its own segment declares, so a declaration rewritten to a value no frame wrote is refused by the machine
    // rather than served.
    const { draft, slot } = drive();
    const record = draft.blockOf('transferFrom-1').segments[0]![0]!;
    record.viewOut = node(slot, 99n);
    expect(verdictAt(draft, 'transferFrom-1')).toBe('refused: Program failed an OP_VERIFY operation.');
  });
});
