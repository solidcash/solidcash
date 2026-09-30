import { FrameKind, buildPushdataCommitment, bytesToHex, type RecordEntry } from '@solidcash/utils';
import { buildEntryNftCovenantScript, computeCollectionHash, encodeIntegerValue } from '@solidcash/utils';
import { encodeDataPush } from '@bitauth/libauth';
import { scriptToLockingBytecode } from '../../../src/utils.js';
import { encodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { stateRecordLockingBytecode, stateRecordUnlockingBytecode } from '../../../src/per-call/deploy/index.js';
import { publishedRefusals } from '../../../../solidc/test/per-call/master/refused-entry.js';
import {
  USER_LOCK, compileAndDeploy, composeAndDerive, entryName, hexOf, master, masterInput, rootOf, seededAddress,
  selectorOf, token, userInput, validatorFor, type DeployedContract,
} from '../shapes/harness.js';
import type { CompositionDraftPlan } from '../../../src/per-call/composer/index.js';
import {
  layOutMappingBatch, planMappingBatch, type MappingNodePlacement,
} from '../../../src/per-call/composer/index.js';

/** The empty successor a single-node list carries. */
const ZERO_SLOT = new Uint8Array(32);

/** One node of a sorted mapping, carrying an integer as its value tail. */
function nodeCommitment(slot: Uint8Array, value: bigint): Uint8Array {
  return encodeEntryCommitment(slot, ZERO_SLOT, encodeIntegerValue(value));
}

/**
 * What the shipped path does with the literal sweep, given the plan the callee's own batch names.
 *
 * The callee's body derives its two record groups from the frame's first segment, in its own slot order, and the
 * transaction spends and recreates the two nodes the writes touch. The caller's own read is what the layout has to
 * reconcile with that list; this returns whichever the shipped path reports - a refusal by name, or the machine's
 * verdicts - so the case can pin it.
 */
function sweepOutcome(): { readonly code?: string; readonly message: string; readonly rejected: readonly string[] } {
  const { artifacts, contracts } = compileAndDeploy(LITERAL_SWEEP_SOURCE, { Tok: TOK_LABEL });
  const tok = contracts.Tok!;
  const signature = artifacts.Tok!.stateLayout!.collections![0]!.signature;
  const entryLock = scriptToLockingBytecode(
    buildEntryNftCovenantScript(tok.category, computeCollectionHash(signature)), 'p2sh32',
  );
  const selfSlot = keyToSlotMulti([tok.address]);
  const treasurySlot = keyToSlotMulti([TREASURY]);
  // The callee's slot order: `to` first, then `msg.sender`, which is the address the self-call hands it.
  const batch = planMappingBatch({
    writes: [{ keys: [TREASURY], value: 1100n }, { keys: [tok.address], value: 0n }],
    inventory: [nodeCommitment(treasurySlot, 1000n), nodeCommitment(selfSlot, 100n)],
    encodeValue: encodeIntegerValue,
  });
  const placements = new Map<string, MappingNodePlacement>([
    [bytesToHex(treasurySlot), { in: 1, out: 1 }],
    [bytesToHex(selfSlot), { in: 2, out: 2 }],
  ]);
  const entries = layOutMappingBatch(batch, { placementOf: (slot) => placements.get(bytesToHex(slot)) });
  const nodeSource = (commitment: Uint8Array) => ({
    lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token(tok.category, 'mutable', commitment),
  });
  const plan: CompositionDraftPlan = {
    blocks: [{ contract: 'Tok', masters: ['tok-1'], state: ['treasuryNode', 'selfNode'] }],
    userInputs: [{ id: 'user', index: 3 }],
    masters: [master({
      master: 'tok-1', contract: 'Tok', entry: 'sweep', program: tok.program,
      facts: {
        contract: 'Tok', functionName: 'sweep', kind: FrameKind.ROOT,
        callerIsUser: true, originEqualsCaller: true, makesExternalCall: false, mastersOfContract: 1,
      },
      frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: tok.address, value: 0n },
      enteredBy: 'user', origin: 'user',
      segments: [entries],
    })],
    inputs: {
      'tok-1': { source: masterInput(tok) },
      treasuryNode: {
        source: nodeSource(batch.written[0]!.before), output: nodeSource(batch.written[0]!.after),
        unlockingBytecode: encodeDataPush(new Uint8Array([1])),
      },
      selfNode: {
        source: nodeSource(batch.written[1]!.before), output: nodeSource(batch.written[1]!.after),
        unlockingBytecode: encodeDataPush(new Uint8Array([1])),
      },
      user: userInput(),
    },
  };
  try {
    const { rejected } = settlePlan(plan, artifacts, 'Tok', 'sweep');
    return { message: 'settled', rejected };
  } catch (error) {
    const refusal = error as { code?: string; message: string };
    return { ...(refusal.code === undefined ? {} : { code: refusal.code }), message: refusal.message, rejected: [] };
  }
}

/**
 * The identity toy: what `msg.sender`, `address(this)` and `tx.origin` are inside an internal self-call.
 *
 * In Solidity a call through `this.f()` starts a new message call, so `msg.sender` inside `f` is `address(this)`;
 * a bare `f()` is an internal call that keeps the caller. Every case below is driven through the shipped compile,
 * the shipped composer and the shipped derivation, with the machine asked for a verdict where a plan settles. The
 * comment on each case states the EVM result of the same Solidity source and whether the per-call answer agrees.
 *
 * The per-call path lowers `this.f()` to an inlined subroutine. It runs that subroutine with the contract's own
 * address as `msg.sender` and as `address(this)`, so a self-call agrees with the EVM; a bare internal call keeps
 * the caller. The cases pin that agreement, and they still pin the divergences the self-call rule does not reach:
 * a self-called body that writes a mapping is refused at compile time, and a user-entered entry takes no
 * run-time argument.
 */

const TOK_LABEL = 'identity tok';
const TOK_ADDRESS = seededAddress(TOK_LABEL);
const TREASURY = seededAddress('identity treasury');
const OWNER = USER_LOCK;
const NON_OWNER = new Uint8Array([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x33), 0x88, 0xac]);

/** The plan's exact sweep shape: `sweep(t)` calls `this.transfer(t, bal[address(this)])` and transfer debits `bal`. */
const MAPPING_SWEEP_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Tok {'
  + '   mapping(address => int) bal;'
  + '   function transfer(address to, int amount) {'
  + '     this.bal[msg.sender] = this.bal[msg.sender] - amount;'
  + '     this.bal[to] = this.bal[to] + amount;'
  + '     require(true);'
  + '   }'
  + '   function sweep(address t) { this.transfer(t, this.bal[address(this)]); require(true); }'
  + ' }';

/**
 * The plan's sweep with the treasury fixed at compile time.
 *
 * This is the same shape as the plan's `sweep(t)` with the treasury named in the source, so the frame's own
 * argument plays no part and what the frame does with the callee's records is the only thing measured.
 */
const LITERAL_SWEEP_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Tok {'
  + '   mapping(address => int) bal;'
  + '   function transfer(address to, int amount) {'
  + '     this.bal[msg.sender] = this.bal[msg.sender] - amount;'
  + '     this.bal[to] = this.bal[to] + amount;'
  + '     require(true);'
  + '   }'
  + `   function sweep() { this.transfer(0x${hexOf(TREASURY)}, this.bal[address(this)]); require(true); }`
  + ' }';

/**
 * A self-call whose only mapping access is the read the caller passes as its argument.
 *
 * The callee reads its own `msg.sender`, so the call stays a call rather than being inlined, and the read stays an
 * argument of a call statement: the shape whose entry access the block layout used to omit. The callee also writes
 * a scalar, which gives the segment a computed record of its own beside the node the read declares.
 */
const READ_THROUGH_SELF_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Tok {'
  + '   mapping(address => int) bal;'
  + '   int seen;'
  + '   function onlySelfRecord(int x) {'
  + '     if (msg.sender == address(this)) { this.seen = x; }'
  + '     require(true);'
  + '   }'
  + `   function readThrough() { this.onlySelfRecord(this.bal[0x${hexOf(TOK_ADDRESS)}]); require(true); }`
  + ' }';

/**
 * The sweep mechanism with balances the compiler can reach through the self-call: two scalars and a transfer that
 * compares `msg.sender` with the contract's own address to choose which one it debits. The plan's exact shape is
 * refused (below), so this is the reachable statement of the same rule.
 */
const SCALAR_SWEEP_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Tok {'
  + '   int balSelf;'
  + '   int balUser;'
  + '   function transfer(address to, int amount) {'
  + `     if (msg.sender == 0x${hexOf(TOK_ADDRESS)}) { this.balSelf = this.balSelf - amount; }`
  + '     else { this.balUser = this.balUser - amount; }'
  + '     require(true);'
  + '   }'
  + `   function sweep() { this.transfer(0x${hexOf(TREASURY)}, this.balSelf); require(true); }`
  + ' }';

const OWNER_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Tok {'
  + `   function ownerOnly() { require(msg.sender == 0x${hexOf(OWNER)}); }`
  + '   function callOwnerOnly() { this.ownerOnly(); require(true); }'
  + ' }';

const ADDRESS_THIS_SELF_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Tok {'
  + '   function onlySelf() { require(msg.sender == address(this)); }'
  + '   function callOnlySelf() { this.onlySelf(); require(true); }'
  + ' }';

/** The same self-call spelled through a base cast, which the builder lowers the same way as `this.g()`. */
const BASE_SELF_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Base {'
  + '   function onlySelf() virtual { require(msg.sender == address(this)); }'
  + ' }'
  + ' contract Tok is Base {'
  + '   function onlySelf() override { require(msg.sender == address(this)); }'
  + '   function callOnlySelf() { Base(this).onlySelf(); require(true); }'
  + ' }';

const ADDRESS_THIS_DIRECT_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Tok {'
  + '   function ping() { require(true); }'
  + '   function onlySelf() { require(msg.sender == address(this)); }'
  + ' }';

/** The same self-guard with the contract's address written as a literal, which the self-call can compile. */
const LITERAL_SELF_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Tok {'
  + `   function onlySelf() { require(msg.sender == 0x${hexOf(TOK_ADDRESS)}); }`
  + '   function callOnlySelf() { this.onlySelf(); require(true); }'
  + ' }';

const MARKET_LABEL = 'identity market';
const ESCROW_LABEL = 'identity escrow';
const ESCROW_ADDRESS = seededAddress(ESCROW_LABEL);

/** `Escrow.refund` is gated on `tx.origin` and reached only through `Market.refund`. */
function escrowSource(guard: string): string {
  return 'pragma solidcash ^0.13.0;'
    + ' interface IEscrow { function refund(); }'
    + ` contract Escrow { function refund() { ${guard} require(true); } }`
    + ` contract Market { function refund() { IEscrow(0x${hexOf(ESCROW_ADDRESS)}).refund.call(); require(true); } }`;
}

/** The error a shipped call raised, or a failure when it returned normally. */
function refusalOf(run: () => unknown): { readonly name?: string; readonly code?: string; readonly message: string } {
  try {
    run();
  } catch (error) {
    const refusal = error as { name?: string; code?: string; message: string };
    return { name: refusal.name, code: refusal.code, message: refusal.message };
  }
  throw new Error('the shipped per-call path accepted the composition, so there is no refusal to record');
}

/** The refusals a compile publishes, or the error it throws, as one record. */
function compileRefusal(source: string): { readonly name?: string; readonly code?: string; readonly message: string } {
  try {
    const refusals = publishedRefusals(compileStringMulti(source, { composition: 'per-call' }) as
      Record<string, { composition?: unknown }>);
    if (refusals.length === 0) {
      throw new Error('the shipped per-call compiler served the source, so there is no refusal to record');
    }
    return {
      code: 'PER_CALL_CODEGEN_UNAVAILABLE',
      message: refusals.map((refused) => `${refused.functionName}: ${refused.reason}`).join(' | '),
    };
  } catch (error) {
    const refusal = error as { name?: string; code?: string; message: string };
    return {
      ...(refusal.name === undefined ? {} : { name: refusal.name }),
      ...(refusal.code === undefined ? {} : { code: refusal.code }),
      message: refusal.message,
    };
  }
}

/** One contract, one master entered by a user, and the user's signed input; no records and no calls. */
function singlePlan(
  artifacts: ReturnType<typeof compileAndDeploy>['artifacts'],
  contract: DeployedContract,
  entry: string,
  sender: Uint8Array,
  segments?: readonly (readonly RecordEntry[])[],
): CompositionDraftPlan {
  // An ABI row with a selector is a callable entry; a contract whose master dispatches over several of them takes
  // the user's call data's selector, which is the only argument push a user-entered master may carry.
  const dispatches = (artifacts[contract.name]!.abi.filter((row) => row.selector !== undefined).length) > 1;
  return {
    blocks: [{ contract: contract.name, masters: ['tok-1'], state: segments === undefined ? [] : ['record'] }],
    userInputs: [{ id: 'user', index: segments === undefined ? 1 : 2 }],
    masters: [{
      ...master({
        master: 'tok-1', contract: contract.name, entry, program: contract.program,
        facts: {
          contract: contract.name, functionName: entry, kind: FrameKind.ROOT,
          callerIsUser: true, originEqualsCaller: true, makesExternalCall: false, mastersOfContract: 1,
        },
        frame: { kind: FrameKind.ROOT, sender, self: contract.address, value: 0n },
        enteredBy: 'user', origin: 'user',
        ...(segments === undefined ? {} : { segments }),
        ...(dispatches ? { argumentPushes: [selectorOf(artifacts, contract.name, entry)] } : {}),
      }),
      ...(dispatches ? { dispatches: true } : {}),
    }],
    inputs: {
      'tok-1': { source: masterInput(contract) },
      ...(segments === undefined ? {} : {
        // The record is a data NFT at the contract's own covenant lock, rewritten in place by a stated segment,
        // so its spend carries the covenant's write path with the index of the master that authorizes it.
        record: {
          source: {
            lockingBytecode: stateRecordLockingBytecode(bytesToHex(contract.category)), valueSatoshis: 20_000n,
            token: token(contract.category, 'mutable', segments[0]![0]!.viewIn),
          },
          output: {
            lockingBytecode: stateRecordLockingBytecode(bytesToHex(contract.category)), valueSatoshis: 20_000n,
            token: token(contract.category, 'mutable', segments[0]![0]!.viewOut),
          },
          unlockingBytecode: stateRecordUnlockingBytecode(bytesToHex(contract.category), 0, 1),
        },
      }),
      user: userInput(),
    },
  };
}

/** The derivation's completion and the machine's verdict on each contract-frame input of one plan. */
function settlePlan(
  plan: CompositionDraftPlan,
  artifacts: ReturnType<typeof compileAndDeploy>['artifacts'],
  contract: string,
  entry: string,
) {
  const outcome = composeAndDerive(plan, [artifacts[contract]!], [rootOf(contract, entry, 'tok-1')]);
  const rejected = outcome.verdicts
    .filter((verdict) => verdict.participant === 'tok-1')
    .filter((verdict) => !verdict.accepted)
    .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
  return { outcome, rejected };
}

describe('sweep: the internal transfer debits the contract, as the EVM does', () => {
  it('resolves the plan\'s exact shape at compile: the self-call takes the callee\'s declared parameters', () => {
    // The self-called body writes a sorted mapping, which carries the sorted-batch operands the direct convention
    // receives from its SDK. A per-call master derives each operand from its own witness block, so the call site
    // passes only the declared parameters and the call resolves: the exact `sweep(t)` spelling the plan names
    // compiles, with or without an internal helper declared beside it.
    const withHelper = MAPPING_SWEEP_SOURCE.replace(/ }$/, ' function h(int x) private returns (int) { return x + 1; } }');
    for (const source of [MAPPING_SWEEP_SOURCE, withHelper]) {
      const artifacts = compileStringMulti(source, { composition: 'per-call' }) as
        Record<string, { bytecode?: string }>;
      expect(publishedRefusals(artifacts)).toStrictEqual([]);
      expect(artifacts.Tok!.bytecode!.length).toBeGreaterThan(0);
    }
  });

  it('gives the read a block-layout slot: the published access and the frame\'s layout carry the call argument', () => {
    // The argument is `this.bal[<address>]`, a read the caller's own code performs before the self-call. A call
    // statement holds its call in a field the entry-access walk did not descend into, so the read entered no entry
    // access and no block layout allocated it a slot: the per-call master and the direct path both refused the
    // whole contract with `The verified-mapping read on 'bal' in 'readThrough' has no allocated entry slot`. The
    // read is now collected like any other access of the body, so the published ABI names it, the layout gives it a
    // slot, and the frame reads the node a plan declares for it.
    for (const composition of ['per-call', 'direct'] as const) {
      const artifacts = compileStringMulti(READ_THROUGH_SELF_SOURCE, { composition }) as
        Record<string, {
          bytecode?: string;
          abi: { name: string; entryAccesses?: readonly { slotIndex: number; collection: string }[] }[];
        }>;
      const row = artifacts.Tok!.abi.find((abi) => abi.name === 'readThrough')!;
      expect(row.entryAccesses!.map((access) => [access.collection, access.slotIndex >= 0]))
        .toStrictEqual([['bal', true]]);
      expect(artifacts.Tok!.bytecode!.length).toBeGreaterThan(0);
    }
  });

  it('cannot yet lay the sweep out: the frame the callee writes in declares records its own layout omits', () => {
    // The mapping sweep compiles, and the frame accepts up to the record the read resolves: the caller's published
    // accesses name the read, and the callee's batch derives its two groups from the same segment, so the shipped
    // layout has no declaration that satisfies both (the frame fails an OP_VERIFY before the segment close, and the
    // derivation reads it as a stall). Serving it means attributing a self-called body's accesses to the frame that
    // runs it and sizing the derivation's leading records from that frame.
    const refusal = sweepOutcome();
    expect(refusal.code).toBe('PER_CALL_DERIVATION_STALLED');
    expect(refusal.message).toMatch(/master "tok-1" of Tok\.sweep\(\) filled no witness at site 0 /);
  });

  it('accepts the contract-debited commitment: the self-call debits the contract, as the EVM does', () => {
    // In the EVM `sweep` runs `this.transfer`, so the callee's msg.sender is address(this): the guard debits
    // `balSelf`, which falls by the swept amount, while `balUser` is unchanged. The plan declares that value and
    // every contract input is accepted.
    const { artifacts, contracts } = compileAndDeploy(SCALAR_SWEEP_SOURCE, { Tok: TOK_LABEL });
    const tok = contracts.Tok!;
    const committed = (balSelf: bigint, balUser: bigint): Uint8Array =>
      new Uint8Array(Buffer.from(buildPushdataCommitment(artifacts.Tok!.stateLayout!, { balSelf, balUser }, 0), 'hex'));
    // The swept amount is `balSelf`, so the contract debit leaves {0, 1000}.
    const kept: RecordEntry = { in: 1, out: 1, viewIn: committed(100n, 1000n), viewOut: committed(0n, 1000n) };
    const plan = singlePlan(artifacts, tok, 'sweep', USER_LOCK, [[kept]]);

    const { outcome, rejected } = settlePlan(plan, artifacts, 'Tok', 'sweep');
    expect(outcome.completed.map((frame) => frame.functionName)).toStrictEqual([entryName('Tok', 'sweep')]);
    expect(rejected).toStrictEqual([]);
    // The written commitment is the body's own computation: balSelf debited, balUser unchanged.
    expect(new Uint8Array(outcome.transaction.outputs[1]!.token!.nft!.commitment)).toStrictEqual(committed(0n, 1000n));
  });

  it('still debits the contract when the contract also declares an internal helper', () => {
    // The helper runs the inliner that would move the self-called body into `sweep`; the self-call stays a call.
    const source = SCALAR_SWEEP_SOURCE.replace(/ }$/, ' function h(int x) private returns (int) { return x + 1; } }');
    const { artifacts, contracts } = compileAndDeploy(source, { Tok: TOK_LABEL });
    const tok = contracts.Tok!;
    const committed = (balSelf: bigint, balUser: bigint): Uint8Array =>
      new Uint8Array(Buffer.from(buildPushdataCommitment(artifacts.Tok!.stateLayout!, { balSelf, balUser }, 0), 'hex'));
    const kept: RecordEntry = { in: 1, out: 1, viewIn: committed(100n, 1000n), viewOut: committed(0n, 1000n) };
    const { rejected } = settlePlan(singlePlan(artifacts, tok, 'sweep', USER_LOCK, [[kept]]), artifacts, 'Tok', 'sweep');
    expect(rejected).toStrictEqual([]);
  });

  it('refuses the caller-debited commitment the old inline call produced', () => {
    // `balSelf` unchanged with `balUser` debited was what the self-call computed when it kept the caller as the
    // frame sender; the shipped body now debits the contract, so this declaration is not the value the frame
    // closed on and the derivation stalls.
    const { artifacts, contracts } = compileAndDeploy(SCALAR_SWEEP_SOURCE, { Tok: TOK_LABEL });
    const tok = contracts.Tok!;
    const committed = (balSelf: bigint, balUser: bigint): Uint8Array =>
      new Uint8Array(Buffer.from(buildPushdataCommitment(artifacts.Tok!.stateLayout!, { balSelf, balUser }, 0), 'hex'));
    const kept: RecordEntry = { in: 1, out: 1, viewIn: committed(100n, 1000n), viewOut: committed(100n, 900n) };
    const plan = singlePlan(artifacts, tok, 'sweep', USER_LOCK, [[kept]]);

    const refusal = refusalOf(() => settlePlan(plan, artifacts, 'Tok', 'sweep'));
    expect(refusal.code).toBe('PER_CALL_DERIVATION_STALLED');
    expect(refusal.message).toMatch(/master "tok-1" of Tok.sweep\(\) filled no witness at site 0/);
  });

  it('serves `sweep(t)` as a user-entered root: the argument rides the dispatcher\'s call data', () => {
    // `sweep(t)` takes a run-time argument, and a program that dispatches over several entries takes the user's call
    // data as the selector followed by that argument's pushes: the frame's own parameter is bound from them, so the
    // body's guard on the value holds. The control pushes another address, which the body's own require refuses, so
    // the accepted frame is the argument being read rather than the guard being dropped.
    const source = 'pragma solidcash ^0.13.0;'
      + ` contract Tok { function sweep(address t) { require(t == 0x${hexOf(TREASURY)}); }`
      + ' function ping() { require(true); } }';
    const { artifacts, contracts } = compileAndDeploy(source, { Tok: TOK_LABEL });
    const plan = (arg: Uint8Array): CompositionDraftPlan => ({
      blocks: [{ contract: 'Tok', masters: ['tok-1'], state: [] }],
      userInputs: [{ id: 'user', index: 1 }],
      masters: [{
        ...master({
          master: 'tok-1', contract: 'Tok', entry: 'sweep', program: contracts.Tok!.program,
          facts: {
            contract: 'Tok', functionName: 'sweep', kind: FrameKind.ROOT,
            callerIsUser: true, originEqualsCaller: true, makesExternalCall: false, mastersOfContract: 1,
          },
          frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: contracts.Tok!.address, value: 0n },
          enteredBy: 'user', origin: 'user',
          argumentPushes: [selectorOf(artifacts, 'Tok', 'sweep'), arg],
        }),
        dispatches: true,
      }],
      inputs: { 'tok-1': { source: masterInput(contracts.Tok!) }, user: userInput() },
    });

    const { outcome, rejected } = settlePlan(plan(TREASURY), artifacts, 'Tok', 'sweep');
    expect(outcome.completed.map((frame) => frame.functionName)).toStrictEqual([entryName('Tok', 'sweep')]);
    expect(rejected).toStrictEqual([]);

    const refusal = refusalOf(() => settlePlan(plan(OWNER), artifacts, 'Tok', 'sweep'));
    expect(refusal.code).toBe('PER_CALL_DERIVATION_STALLED');
  });
});

describe('onlySelf and ownerOnly: a self-call runs as the contract, as the EVM does', () => {
  it('accepts this.onlySelf(): inside the self-call msg.sender is address(this), as the EVM has it', () => {
    // In the EVM `this.onlySelf()` is a message call, so the guard's msg.sender is the contract and the require
    // holds. The shipped self-call runs with the caller's contract address as the callee's msg.sender and passes
    // it as its own address(this), so every contract input is accepted. The direct-call control below shows the
    // same guard still fails when a user calls it.
    const { artifacts, contracts } = compileAndDeploy(ADDRESS_THIS_SELF_SOURCE, { Tok: TOK_LABEL });
    const { outcome, rejected } = settlePlan(singlePlan(artifacts, contracts.Tok!, 'callOnlySelf', USER_LOCK),
      artifacts, 'Tok', 'callOnlySelf');
    expect(outcome.completed.map((frame) => frame.functionName)).toStrictEqual([entryName('Tok', 'callOnlySelf')]);
    expect(rejected).toStrictEqual([]);
  });

  it('accepts onlySelf() reached through a base cast: the same call form agrees', () => {
    // `Base(this).onlySelf()` lowers to the same direct self-call as `this.onlySelf()`, so it must present the
    // same identity: msg.sender and address(this) are both the contract, and the guard holds.
    const { artifacts, contracts } = compileAndDeploy(BASE_SELF_SOURCE, { Tok: TOK_LABEL });
    const { outcome, rejected } = settlePlan(singlePlan(artifacts, contracts.Tok!, 'callOnlySelf', USER_LOCK),
      artifacts, 'Tok', 'callOnlySelf');
    expect(outcome.completed.map((frame) => frame.functionName)).toStrictEqual([entryName('Tok', 'callOnlySelf')]);
    expect(rejected).toStrictEqual([]);
  });

  it('refuses onlySelf() called directly by a user, as the EVM does', () => {
    const { artifacts, contracts } = compileAndDeploy(ADDRESS_THIS_DIRECT_SOURCE, { Tok: TOK_LABEL });
    // The same entry plan accepts `ping`, so the refusal below is the guard and not a malformed frame.
    const accepted = settlePlan(singlePlan(artifacts, contracts.Tok!, 'ping', USER_LOCK), artifacts, 'Tok', 'ping');
    expect(accepted.rejected).toStrictEqual([]);
    const refusal = refusalOf(() => settlePlan(singlePlan(artifacts, contracts.Tok!, 'onlySelf', USER_LOCK),
      artifacts, 'Tok', 'onlySelf'));
    expect(refusal.code).toBe('PER_CALL_DERIVATION_STALLED');
  });

  it('accepts this.onlySelf() with the guard written as the contract address', () => {
    // The same rule with the self-lock spelled out rather than read: the per-call self-call supplies the
    // contract's address as the callee's msg.sender, so the literal comparison holds.
    const { artifacts, contracts } = compileAndDeploy(LITERAL_SELF_SOURCE, { Tok: TOK_LABEL });
    const { outcome, rejected } = settlePlan(singlePlan(artifacts, contracts.Tok!, 'callOnlySelf', USER_LOCK),
      artifacts, 'Tok', 'callOnlySelf');
    expect(outcome.completed.map((frame) => frame.functionName)).toStrictEqual([entryName('Tok', 'callOnlySelf')]);
    expect(rejected).toStrictEqual([]);
  });

  it('accepts ownerOnly() called directly by the owner, so the caller-gated accept beside it is not vacuous', () => {
    const { artifacts, contracts } = compileAndDeploy(OWNER_SOURCE, { Tok: TOK_LABEL });
    const { outcome, rejected } = settlePlan(singlePlan(artifacts, contracts.Tok!, 'ownerOnly', OWNER),
      artifacts, 'Tok', 'ownerOnly');
    expect(outcome.completed.map((frame) => frame.functionName)).toStrictEqual([entryName('Tok', 'ownerOnly')]);
    expect(rejected).toStrictEqual([]);
  });

  it('refuses ownerOnly() called by a non-owner: the direct guard reads the frame sender', () => {
    const { artifacts, contracts } = compileAndDeploy(OWNER_SOURCE, { Tok: TOK_LABEL });
    const refusal = refusalOf(() => settlePlan(singlePlan(artifacts, contracts.Tok!, 'ownerOnly', NON_OWNER),
      artifacts, 'Tok', 'ownerOnly'));
    expect(refusal.code).toBe('PER_CALL_DERIVATION_STALLED');
  });

  it('refuses this.ownerOnly() called by the owner, as the EVM does', () => {
    // In the EVM `this.ownerOnly()` starts a message call, so msg.sender is the contract, not the owner, and the
    // guard fails however the entry was entered. The shipped self-call now supplies the contract's address, so
    // the same owner-entered plan that used to settle is refused.
    const { artifacts, contracts } = compileAndDeploy(OWNER_SOURCE, { Tok: TOK_LABEL });
    const refusal = refusalOf(() => settlePlan(singlePlan(artifacts, contracts.Tok!, 'callOwnerOnly', OWNER),
      artifacts, 'Tok', 'callOwnerOnly'));
    expect(refusal.code).toBe('PER_CALL_DERIVATION_STALLED');
  });

  it('refuses this.ownerOnly() called by a non-owner, for the same reason', () => {
    // Both callers now see the contract inside the self-call, so this case no longer discriminates on the
    // caller; it stays as the second direction of the refusal.
    const { artifacts, contracts } = compileAndDeploy(OWNER_SOURCE, { Tok: TOK_LABEL });
    const refusal = refusalOf(() => settlePlan(singlePlan(artifacts, contracts.Tok!, 'callOwnerOnly', NON_OWNER),
      artifacts, 'Tok', 'callOwnerOnly'));
    expect(refusal.code).toBe('PER_CALL_DERIVATION_STALLED');
  });
});

describe('Escrow.refund reached through Market.refund sees the root user in tx.origin', () => {
  /** Market's root calling Escrow.refund, with the callee's frame guarded on the given lock. */
  function marketCallsEscrow(guard: string): ReturnType<typeof composeAndDerive> {
    const source = escrowSource(guard);
    const { artifacts, contracts } = compileAndDeploy(source, { Market: MARKET_LABEL, Escrow: ESCROW_LABEL });
    const market = contracts.Market!;
    const escrow = contracts.Escrow!;
    const validator = validatorFor(market.category);
    const selector = selectorOf(artifacts, 'Escrow', 'refund');
    const plan: CompositionDraftPlan = {
      blocks: [
        { contract: 'Market', masters: ['market-1'], validator: { id: 'validator', settles: [] }, state: [] },
        { contract: 'Escrow', masters: ['escrow-1'], state: [] },
      ],
      // The facet the validator binds is one participant ahead of the user.
      userInputs: [{ id: 'user', index: 4 }],
      masters: [
        master({
          master: 'market-1', contract: 'Market', entry: 'refund', program: market.program,
          facts: {
            contract: 'Market', functionName: 'refund', kind: FrameKind.ROOT,
            callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
          },
          frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: market.address, value: 0n },
          enteredBy: 'user', origin: 'user',
          calls: [{ kind: FrameKind.CALL, callee: 'escrow-1', target: escrow.address, value: 0n, argumentPushes: [selector] }],
        }),
        master({
          master: 'escrow-1', contract: 'Escrow', entry: 'refund', program: escrow.program,
          facts: {
            contract: 'Escrow', functionName: 'refund', kind: FrameKind.CALL,
            callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
          },
          frame: { kind: FrameKind.CALL, sender: market.address, self: escrow.address, value: 0n },
          enteredBy: 'market-1', origin: 'user', argumentPushes: [selector],
        }),
      ],
      inputs: {
        'market-1': { source: masterInput(market) },
        'escrow-1': { source: masterInput(escrow) },
        validator: { source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(market.category, 'mutable') } },
        user: userInput(),
      },
      validator: { id: 'validator', covers: ['Escrow'], settles: [], redeemScript: validator.redeem },
    };
    return composeAndDerive(plan, [artifacts.Market!, artifacts.Escrow!], [rootOf('Market', 'refund', 'market-1')]);
  }

  it('accepts a refund gated on tx.origin == the root user, reached through the intermediate contract', () => {
    // The EVM keeps tx.origin unchanged across calls, so Escrow sees the user who signed the transaction, not
    // Market. The per-call frame carries the root user as the callee's origin, and every contract input is accepted.
    const outcome = marketCallsEscrow(`require(tx.origin == 0x${hexOf(USER_LOCK)});`);
    const rejected = outcome.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
    expect(rejected).toStrictEqual([]);
    expect(outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual([entryName('Escrow', 'refund'), entryName('Market', 'refund')]);
  });

  it('refuses a refund gated on tx.origin == the intermediate contract, so the accept is not vacuous', () => {
    // The same call topology with Escrow expecting the caller instead of the user: the frame's origin is the root
    // user, so the guard fails and the callee's frame is refused.
    const refusal = refusalOf(() => marketCallsEscrow(`require(tx.origin == 0x${hexOf(seededAddress(MARKET_LABEL))});`));
    expect(refusal.code).toBe('PER_CALL_DERIVATION_STALLED');
    expect(refusal.message).toMatch(/master "escrow-1" of Escrow.refund\(\) filled no witness/);
  });

  it('refuses a refund gated on msg.sender == address(this): the caller is another contract, not the callee', () => {
    // The counterpart of the self-addressed accept: reached from Market, Escrow is entered as the calling
    // contract (Market), which is not Escrow's own address, so `msg.sender == address(this)` fails and the
    // callee's frame is refused. The self-addressed call therefore agrees only because the callee is a master of
    // the caller's own contract.
    const refusal = refusalOf(() => marketCallsEscrow('require(msg.sender == address(this));'));
    expect(refusal.code).toBe('PER_CALL_DERIVATION_STALLED');
    expect(refusal.message).toMatch(/master "escrow-1" of Escrow.refund\(\) filled no witness/);
  });
});

/**
 * The same call reached two ways. `this.g()` runs inline with `msg.sender == address(this)` (pinned above); a call
 * through an interface at the contract's own address runs on a second master of the contract, and the callee sees
 * the same `msg.sender`. The controls show the identity is the caller's own address, not a value a caller chooses.
 */
describe('a call to the contract\'s own address on a second master runs as the contract too', () => {
  /** `callG` calls `g` at the contract's own address; `g` asserts it runs for the contract. */
  const SELF_TARGET_SOURCE = 'pragma solidcash ^0.13.0;'
    + ' interface ITok { function g(); }'
    + ' contract Tok {'
    + '   function g() { require(msg.sender == address(this)); }'
    + '   function callG() { ITok(address(this)).g.call(); require(true); }'
    + ' }';

  /** The root user entry `callG`, and a second master of the same contract running `g`, entered by the first. */
  function selfCallPlan(
    artifacts: ReturnType<typeof compileAndDeploy>['artifacts'],
    tok: DeployedContract,
    target: Uint8Array = tok.address,
  ): CompositionDraftPlan {
    const validator = validatorFor(tok.category);
    const callG = selectorOf(artifacts, 'Tok', 'callG');
    const g = selectorOf(artifacts, 'Tok', 'g');
    return {
      blocks: [{
        contract: 'Tok', masters: ['tok-1', 'tok-2'], validator: { id: 'validator', settles: [] }, state: [],
      }],
      // The facet the validator binds is one participant ahead of the user.
      userInputs: [{ id: 'user', index: 4 }],
      masters: [
        master({
          master: 'tok-1', contract: 'Tok', entry: 'callG', program: tok.program,
          facts: {
            contract: 'Tok', functionName: 'callG', kind: FrameKind.ROOT,
            callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 2,
          },
          frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: tok.address, value: 0n },
          enteredBy: 'user', origin: 'user', argumentPushes: [callG], dispatches: true,
          calls: [{ kind: FrameKind.CALL, callee: 'tok-2', target, value: 0n, argumentPushes: [g] }],
        }),
        master({
          master: 'tok-2', contract: 'Tok', entry: 'g', program: tok.program,
          facts: {
            contract: 'Tok', functionName: 'g', kind: FrameKind.CALL,
            callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 2,
          },
          frame: { kind: FrameKind.CALL, sender: tok.address, self: tok.address, value: 0n },
          enteredBy: 'tok-1', origin: 'user', argumentPushes: [g],
        }),
      ],
      inputs: {
        'tok-1': { source: masterInput(tok) },
        'tok-2': { source: masterInput(tok) },
        validator: {
          source: {
            lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(tok.category, 'mutable'),
          },
        },
        user: userInput(),
      },
      validator: {
        id: 'validator', covers: [], settles: [{ category: tok.category, stateInputs: [] }],
        redeemScript: validator.redeem,
      },
    };
  }

  it('accepts the self-addressed call: the callee\'s msg.sender is the contract, as the inline form has it', () => {
    // In the EVM a message call to the contract itself sets msg.sender to address(this), exactly as the inlined
    // `this.g()` does. The callee `g` runs on a second master of Tok and its guard holds, so the callee is
    // accepted and the caller settles with the callee derived first.
    const { artifacts, contracts } = compileAndDeploy(SELF_TARGET_SOURCE, { Tok: TOK_LABEL });
    const tok = contracts.Tok!;
    const outcome = composeAndDerive(selfCallPlan(artifacts, tok), [artifacts.Tok!],
      [rootOf('Tok', 'callG', 'tok-1')]);
    const rejected = outcome.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
    expect(rejected).toStrictEqual([]);
    expect(outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual([entryName('Tok', 'g'), entryName('Tok', 'callG')]);
  });

  it('refuses the same plan whose recorded target is a different contract', () => {
    // The record's target is bound to the value the caller's own code produces, its frame `self`: a record that
    // names another contract is refused at the caller, so the self-addressed accept above is that binding and
    // not any target the builder might name.
    const { artifacts, contracts } = compileAndDeploy(SELF_TARGET_SOURCE, { Tok: TOK_LABEL });
    const tok = contracts.Tok!;
    const refusal = refusalOf(() => composeAndDerive(selfCallPlan(artifacts, tok, ESCROW_ADDRESS), [artifacts.Tok!],
      [rootOf('Tok', 'callG', 'tok-1')]));
    expect(refusal.code).toBe('PER_CALL_DERIVATION_STALLED');
    expect(refusal.message).toMatch(/master "tok-1" of Tok\.callG\(\) filled no witness/);
  });
});
