import {
  FrameKind, buildPushdataCommitment, bytesToHex, encodeEventCommitment, parsePushdataCommitment, sha256,
  type Artifact, type RecordEntry,
} from '@solidcash/utils';
import { buildEntryNftCovenantScript, computeCollectionHash, encodeIntegerValue } from '@solidcash/utils';
import { binToHex, encodeDataPush, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { scriptToLockingBytecode } from '../../../src/utils.js';
import { decodeEntryCommitment, encodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import {
  deployMaster, eventLockingBytecode, readFramedDeployment, stateRecordLockingBytecode, stateRecordUnlockingBytecode,
} from '../../../src/framed/deploy/index.js';
import { publishedRefusals } from '../../../../solidc/test/framed/master/refused-entry.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import { deploymentStateValues, planHopExternalCalls } from '../../../src/framed/proxy/external-calls.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub, bobPkh, bobPriv } from '../../fixture/vars.js';
import {
  USER_LOCK, VALIDATOR_PROGRAM, compileAndDeploy, composeAndDerive, entryName, fundShippedFacets, hexOf, master,
  masterInput, rootOf, seededAddress, selectorOf, token, userInput, validatorFor, type DeployedContract,
} from '../shapes/harness.js';
import type { CompositionDraftPlan } from '../../../src/framed/composer/index.js';
import {
  layOutMappingBatch, planMappingBatch, type MappingNodePlacement,
} from '../../../src/framed/composer/index.js';

/** The empty successor a single-node list carries. */
const ZERO_SLOT = new Uint8Array(32);

/** One node of a sorted mapping, carrying an integer as its value tail. */
function nodeCommitment(slot: Uint8Array, value: bigint): Uint8Array {
  return encodeEntryCommitment(slot, ZERO_SLOT, encodeIntegerValue(value));
}

/**
 * What the shipped path does with the literal sweep, given the plan the callee's own batch names.
 *
 * The plan spends and recreates the two nodes the writes would touch, in the callee's slot order. A self-called
 * sorted-mapping writer is refused at compile time, so the host reports that reason before derivation; this returns
 * whichever the shipped path reports - a refusal by name, or the machine's verdicts - so the case can pin it.
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
  const nodeSource = (commitment: Uint8Array): {
    lockingBytecode: Uint8Array; valueSatoshis: bigint; token: ReturnType<typeof token>;
  } => ({
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
 * comment on each case states the EVM result of the same Solidity source and whether the framed answer agrees.
 *
 * The framed path lowers `this.f()` to an inlined subroutine. It runs that subroutine with the contract's own
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
const MAPPING_SWEEP_SOURCE = 'pragma solidcash ^0.14.0;'
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
 * argument plays no part. The callee still writes a sorted mapping through a self-call, which is refused.
 */
const LITERAL_SWEEP_SOURCE = 'pragma solidcash ^0.14.0;'
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
const READ_THROUGH_SELF_SOURCE = 'pragma solidcash ^0.14.0;'
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
const SCALAR_SWEEP_SOURCE = 'pragma solidcash ^0.14.0;'
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

const OWNER_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Tok {'
  + `   function ownerOnly() { require(msg.sender == 0x${hexOf(OWNER)}); }`
  + '   function callOwnerOnly() { this.ownerOnly(); require(true); }'
  + ' }';

const ADDRESS_THIS_SELF_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Tok {'
  + '   function onlySelf() { require(msg.sender == address(this)); }'
  + '   function callOnlySelf() { this.onlySelf(); require(true); }'
  + ' }';

/** The same self-call spelled through a base cast, which the builder lowers the same way as `this.g()`. */
const BASE_SELF_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Base {'
  + '   function onlySelf() virtual { require(msg.sender == address(this)); }'
  + ' }'
  + ' contract Tok is Base {'
  + '   function onlySelf() override { require(msg.sender == address(this)); }'
  + '   function callOnlySelf() { Base(this).onlySelf(); require(true); }'
  + ' }';

const ADDRESS_THIS_DIRECT_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Tok {'
  + '   function ping() { require(true); }'
  + '   function onlySelf() { require(msg.sender == address(this)); }'
  + ' }';

/** The same self-guard with the contract's address written as a literal, which the self-call can compile. */
const LITERAL_SELF_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Tok {'
  + `   function onlySelf() { require(msg.sender == 0x${hexOf(TOK_ADDRESS)}); }`
  + '   function callOnlySelf() { this.onlySelf(); require(true); }'
  + ' }';

const MARKET_LABEL = 'identity market';
const ESCROW_LABEL = 'identity escrow';
const ESCROW_ADDRESS = seededAddress(ESCROW_LABEL);

/** `Escrow.refund` is gated on `tx.origin` and reached only through `Market.refund`. */
function escrowSource(guard: string): string {
  return 'pragma solidcash ^0.14.0;'
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
  throw new Error('the shipped framed path accepted the composition, so there is no refusal to record');
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
): { outcome: ReturnType<typeof composeAndDerive>; rejected: string[] } {
  const outcome = composeAndDerive(plan, [artifacts[contract]!], [rootOf(contract, entry, 'tok-1')]);
  const rejected = outcome.verdicts
    .filter((verdict) => verdict.participant === 'tok-1')
    .filter((verdict) => !verdict.accepted)
    .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
  return { outcome, rejected };
}

describe('sweep: the internal transfer debits the contract, as the EVM does', () => {
  it('refuses the plan\'s exact shape at compile: a self-call cannot write a sorted mapping', () => {
    // `sweep` reaches `transfer` by `this.transfer(...)`, and `transfer` writes the sorted mapping `bal`. That
    // body compiles as a subroutine, which returns before the sorted-batch transition, so the predecessor relink,
    // the distinct-target check and the node-count census are never emitted in the caller's frame. The compiler
    // refuses the writer by name, and the caller with it, with or without an internal helper beside it. Called
    // directly, `transfer`'s own entry frame emits the transition; letting the self-call through would leave a
    // forged segment able to settle two nodes for one key.
    const transfer = 'the body derives a sorted-mapping write and is run as a subroutine by a self-call, whose '
      + 'frame never emits the batch transition that proves the write\'s topology (the predecessor relink, the '
      + 'distinct-target check and the node count); call it directly so its own entry frame proves it';
    const sweep = `it runs 'transfer', which the master cannot serve: ${transfer}`;
    const withHelper = MAPPING_SWEEP_SOURCE.replace(
      / }$/, ' function h(int x) private returns (int) { return x + 1; } }',
    );
    for (const source of [MAPPING_SWEEP_SOURCE, withHelper]) {
      const artifacts = compileStringMulti(source, { composition: 'framed' });
      expect(publishedRefusals(artifacts)).toStrictEqual([
        { functionName: 'Tok.transfer()', reason: transfer },
        { functionName: 'Tok.sweep()', reason: sweep },
      ]);
      expect(artifacts.Tok!.bytecode!.length).toBeGreaterThan(0);
    }
  });

  it('gives the read a block-layout slot: the published access and the frame\'s layout carry the call argument', () => {
    // The argument is `this.bal[<address>]`, a read the caller's own code performs before the self-call. A call
    // statement holds its call in a field the entry-access walk did not descend into, so the read entered no entry
    // access and no block layout allocated it a slot: the framed master and the direct path both refused the
    // whole contract with `The verified-mapping read on 'bal' in 'readThrough' has no allocated entry slot`. The
    // read is now collected like any other access of the body, so the published ABI names it, the layout gives it a
    // slot, and the frame reads the node a plan declares for it.
    for (const composition of ['framed', 'direct'] as const) {
      const artifacts = compileStringMulti(READ_THROUGH_SELF_SOURCE, { composition }) as
        Record<string, {
          bytecode?: string;
          abi: readonly { name: string; entryAccesses?: readonly { slotIndex: number; collection: string }[] }[];
        }>;
      const row = artifacts.Tok!.abi.find((abi) => abi.name === 'readThrough')!;
      expect(row.entryAccesses!.map((access) => [access.collection, access.slotIndex >= 0]))
        .toStrictEqual([['bal', true]]);
      expect(artifacts.Tok!.bytecode!.length).toBeGreaterThan(0);
    }
  });

  it('refuses to settle the literal sweep: the self-called writer is refused before layout', () => {
    // The literal sweep is the same sorted-mapping writer reached by a self-call, so the compiler refuses `sweep`
    // because it runs `transfer`. The host reports that published reason and never reaches the old layout stall
    // (the frame used to fail an OP_VERIFY before the segment close, read as FRAMED_DERIVATION_STALLED). The
    // honest batch the plan still declares, so the refusal is the missing transition, not a missing record.
    const refusal = sweepOutcome();
    expect(refusal.code).toBe('FRAMED_HOST_ENTRY_REFUSED');
    expect(refusal.message).toBe('FRAMED_HOST_ENTRY_REFUSED: Tok.sweep() is refused by the compiler: it runs '
      + '\'transfer\', which the master cannot serve: the body derives a sorted-mapping write and is run as a '
      + 'subroutine by a self-call, whose frame never emits the batch transition that proves the write\'s '
      + 'topology (the predecessor relink, the distinct-target check and the node count); call it directly so '
      + 'its own entry frame proves it');
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
    expect(refusal.code).toBe('FRAMED_DERIVATION_STALLED');
    expect(refusal.message).toMatch(/master "tok-1" of Tok.sweep\(\) filled no witness at site 0/);
  });

  it('serves `sweep(t)` as a user-entered root: the argument rides the dispatcher\'s call data', () => {
    // `sweep(t)` takes a run-time argument, and a program that dispatches over several entries takes the user's call
    // data as the selector followed by that argument's pushes: the frame's own parameter is bound from them, so the
    // body's guard on the value holds. The control pushes another address, which the body's own require refuses, so
    // the accepted frame is the argument being read rather than the guard being dropped.
    const source = 'pragma solidcash ^0.14.0;'
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
    expect(refusal.code).toBe('FRAMED_DERIVATION_STALLED');
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
    expect(refusal.code).toBe('FRAMED_DERIVATION_STALLED');
  });

  it('accepts this.onlySelf() with the guard written as the contract address', () => {
    // The same rule with the self-lock spelled out rather than read: the framed self-call supplies the
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
    expect(refusal.code).toBe('FRAMED_DERIVATION_STALLED');
  });

  it('refuses this.ownerOnly() called by the owner, as the EVM does', () => {
    // In the EVM `this.ownerOnly()` starts a message call, so msg.sender is the contract, not the owner, and the
    // guard fails however the entry was entered. The shipped self-call now supplies the contract's address, so
    // the same owner-entered plan that used to settle is refused.
    const { artifacts, contracts } = compileAndDeploy(OWNER_SOURCE, { Tok: TOK_LABEL });
    const refusal = refusalOf(() => settlePlan(singlePlan(artifacts, contracts.Tok!, 'callOwnerOnly', OWNER),
      artifacts, 'Tok', 'callOwnerOnly'));
    expect(refusal.code).toBe('FRAMED_DERIVATION_STALLED');
  });

  it('refuses this.ownerOnly() called by a non-owner, for the same reason', () => {
    // Both callers now see the contract inside the self-call, so this case no longer discriminates on the
    // caller; it stays as the second direction of the refusal.
    const { artifacts, contracts } = compileAndDeploy(OWNER_SOURCE, { Tok: TOK_LABEL });
    const refusal = refusalOf(() => settlePlan(singlePlan(artifacts, contracts.Tok!, 'callOwnerOnly', NON_OWNER),
      artifacts, 'Tok', 'callOwnerOnly'));
    expect(refusal.code).toBe('FRAMED_DERIVATION_STALLED');
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
    // Market. The framed frame carries the root user as the callee's origin, and every contract input is accepted.
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
    expect(refusal.code).toBe('FRAMED_DERIVATION_STALLED');
    expect(refusal.message).toMatch(/master "escrow-1" of Escrow.refund\(\) filled no witness/);
  });

  it('refuses a refund gated on msg.sender == address(this): the caller is another contract, not the callee', () => {
    // The counterpart of the self-addressed accept: reached from Market, Escrow is entered as the calling
    // contract (Market), which is not Escrow's own address, so `msg.sender == address(this)` fails and the
    // callee's frame is refused. The self-addressed call therefore agrees only because the callee is a master of
    // the caller's own contract.
    const refusal = refusalOf(() => marketCallsEscrow('require(msg.sender == address(this));'));
    expect(refusal.code).toBe('FRAMED_DERIVATION_STALLED');
    expect(refusal.message).toMatch(/master "escrow-1" of Escrow.refund\(\) filled no witness/);
  });
});

/**
 * The refund half on the shipped path. `Market` sits behind a generated proxy and `Escrow` beside it, both deployed
 * by the shipped deployment, and the user's `Market.refund()` runs through the shipped proxy hop, so the frames and
 * the outputs are the ones the path plans. `Escrow.refund()` admits only the payer it was built for, by `tx.origin`,
 * and its refund lands as the `Refunded` event naming the origin it saw; `Market` counts the refund in its record.
 *
 * Known wall: the same refund recorded in the escrow's own mapping under `tx.origin` (`refundRecorded`) is planned
 * under the frame's sender instead. Owner: the SDK hop (`proxy/entry-writes.ts`, `resolveHopKey`, which answers a
 * key the artifact names as `tx.origin` with the frame's caller lock), so the master, which derives the slot from
 * the frame's origin, refuses the node the plan states.
 */
describe('Escrow.refund reached through Market.refund on the shipped path: tx.origin admits the payer', () => {
  /** A 32-byte category or txid with varied bytes, taken from its label. */
  const idOf = (label: string): string => bytesToHex(sha256(utf8ToBin(`identity refund ${label}`)));
  const REFUND_ESCROW_CATEGORY = idOf('escrow');
  const MARKET_IMPL_CATEGORY = idOf('market implementation');
  const MARKET_PROXY_CATEGORY = idOf('market proxy');
  const PAYER = encodeLockingBytecodeP2pkh(alicePkh);
  const OTHER = encodeLockingBytecodeP2pkh(bobPkh);
  const REFUND = 40n;
  const REFUND_SOURCE = 'pragma solidcash ^0.14.0;'
    + ' interface IEscrow { function refund(); function refundRecorded(); }'
    + ' contract Escrow {'
    + '   address public payer;'
    + '   mapping(address => int) refunded;'
    + '   event Refunded(address to, int amount);'
    + '   constructor(address p) { this.payer = p; }'
    + '   function refund() {'
    + '     require(tx.origin == this.payer, "not the payer");'
    + `     emit Refunded(tx.origin, ${REFUND});`
    + '   }'
    + '   function refundRecorded() {'
    + '     require(tx.origin == this.payer, "not the payer");'
    + `     this.refunded[tx.origin] = ${REFUND};`
    + '   }'
    + ' }'
    + ' contract Market {'
    + '   address public implementation;'
    + '   address public escrow;'
    + '   int public refunds;'
    + '   function initialize(address e) { this.escrow = e; require(true); }'
    + '   function refund() { this.refunds = this.refunds + 1; IEscrow(this.escrow).refund(); }'
    + '   function refundRecorded() { this.refunds = this.refunds + 1; IEscrow(this.escrow).refundRecorded(); }'
    + ' }';

  /** A coin a genesis or a call is funded from; a genesis's txid becomes the category it mints. */
  const funding = (txid: string): { txid: string; vout: number; satoshis: bigint } =>
    ({ txid, vout: 0, satoshis: 500_000n });

  /** The escrow, then the market behind its proxy pointing at it, and the chain as it stood when both were done. */
  interface Deployed {
    readonly network: MockNetworkProvider;
    readonly escrow: Artifact;
    readonly market: Artifact;
    readonly marketProxy: Artifact;
    readonly proxyCategoryId: string;
    readonly implementationCategoryId: string;
    readonly proxyAddress: Uint8Array;
    readonly changeAddress: string;
    readonly snapshot: SnapshotRestorer;
  }

  let deployedRun: Promise<Deployed> | undefined;

  /** One deployment serves both cases; each rewinds the chain to it first. */
  async function deployed(): Promise<Deployed> {
    deployedRun ??= (async (): Promise<Deployed> => {
      const artifacts = compileStringMulti(REFUND_SOURCE, { composition: 'framed' });
      const escrow = artifacts.Escrow!;
      const market = artifacts.Market!;
      const marketProxy = buildProxyArtifact(market);
      const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
      const signature = new SignatureTemplate(alicePriv);
      const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
      const funder = wallet.unlock.spend(alicePub, signature);
      await fundShippedFacets(network);
      const escrowCoin = funding(REFUND_ESCROW_CATEGORY);
      await network.addUtxo(wallet.address, escrowCoin);
      await deployStatefulContract(escrow, [PAYER], {
        fundingUtxo: escrowCoin, funder, changeAddress: wallet.address, provider: network,
      });
      for (const txid of [MARKET_IMPL_CATEGORY, MARKET_PROXY_CATEGORY]) {
        await network.addUtxo(wallet.address, funding(txid));
      }
      const initCoin = funding(idOf('initialize coin'));
      await network.addUtxo(binToHex(PAYER), initCoin);
      const deployment = await deployFramedProxy({
        provider: network,
        implementationArtifact: market,
        proxyArtifact: marketProxy,
        implementationDeploy: { fundingUtxo: funding(MARKET_IMPL_CATEGORY), funder, changeAddress: wallet.address },
        proxyDeploy: { fundingUtxo: funding(MARKET_PROXY_CATEGORY), funder, changeAddress: wallet.address },
        initialize: {
          functionName: 'initialize',
          args: [deployMaster(escrow, hexToBin(REFUND_ESCROW_CATEGORY), VALIDATOR_PROGRAM).address],
        },
        callerLockingBytecode: PAYER,
        callerFunding: { utxo: initCoin, funder: signature.unlockP2PKH(), changeAddress: wallet.address },
        vm: compositionMachine(),
      });
      expect(deployment.initialize.broadcast).toBeDefined();
      return {
        network, escrow, market, marketProxy,
        proxyCategoryId: deployment.proxy.categoryId,
        implementationCategoryId: deployment.implementation.categoryId,
        proxyAddress: deployment.proxy.address,
        changeAddress: wallet.address,
        snapshot: await network.takeSnapshot(),
      };
    })();
    const shared = await deployedRun;
    await shared.snapshot.restore();
    return shared;
  }

  interface Entered {
    readonly coin: { txid: string; vout: number; satoshis: bigint };
    readonly lock: Uint8Array;
    readonly call: Promise<FramedProxyCallResult>;
  }

  /** Funds a coin of the payer's or the other user's and runs one `Market` entry through the shipped proxy hop. */
  async function enter(run: Deployed, caller: 'payer' | 'other', functionName = 'refund'): Promise<Entered> {
    const lock = caller === 'payer' ? PAYER : OTHER;
    const coin = funding(idOf(`${caller} ${functionName} coin`));
    await run.network.addUtxo(binToHex(lock), coin);
    const call = callFramedProxyEntry({
      provider: run.network,
      implementationArtifact: run.market,
      proxyArtifact: run.marketProxy,
      proxyCategoryId: run.proxyCategoryId,
      implementationCategoryId: run.implementationCategoryId,
      functionName,
      args: [],
      externals: { IEscrow: { artifact: run.escrow, categoryId: REFUND_ESCROW_CATEGORY } },
      callerUtxo: coin,
      callerLockingBytecode: lock,
      funder: new SignatureTemplate(caller === 'payer' ? alicePriv : bobPriv).unlockP2PKH(),
      changeAddress: run.changeAddress,
      vm: compositionMachine(),
    });
    return { coin, lock, call };
  }

  /** The payload of every `Refunded` event the chain holds at the escrow's event covenant. */
  async function refundEvents(run: Deployed): Promise<readonly string[]> {
    const event = run.escrow.events!.find((definition) => definition.name === 'Refunded')!;
    const lock = eventLockingBytecode(hexToBin(REFUND_ESCROW_CATEGORY), event.signature, false);
    return (await run.network.getUtxosForLockingBytecode(lock)).map((utxo) => utxo.token!.nft!.commitment);
  }

  /** The payload a `Refunded` event naming `to` carries. */
  function refundPayload(run: Deployed, to: Uint8Array): string {
    const event = run.escrow.events!.find((definition) => definition.name === 'Refunded')!;
    return bytesToHex(encodeEventCommitment(event.parameters, [to, REFUND]));
  }

  /** The nodes of the escrow's `refunded` mapping, the head left out, as slots. */
  async function refundedSlots(run: Deployed): Promise<readonly string[]> {
    const pools = await readFramedDeployment(run.network, REFUND_ESCROW_CATEGORY, run.escrow.stateLayout!);
    return (pools.nodesByCollection.get('refunded') ?? [])
      .map((utxo) => bytesToHex(decodeEntryCommitment(hexToBin(utxo.token!.nft!.commitment)).slot))
      .filter((slot) => slot !== bytesToHex(new Uint8Array(32)));
  }

  /** The market's refund count, as its proxy's records hold it. */
  async function refundsCounted(run: Deployed): Promise<unknown> {
    const layout = run.marketProxy.stateLayout!;
    const pools = await readFramedDeployment(run.network, run.proxyCategoryId, layout);
    return (Object.assign({}, ...pools.records.map((record, nftIndex) =>
      parsePushdataCommitment(record.token!.nft!.commitment, layout, nftIndex))) as Record<string, unknown>).refunds;
  }

  /** Every outpoint the two deployments hold and the chain's tip, which a refused call leaves exactly as they were. */
  async function chainView(run: Deployed): Promise<{ readonly tip: number | undefined; readonly outpoints: string[] }> {
    const held = await Promise.all([REFUND_ESCROW_CATEGORY, run.proxyCategoryId, run.implementationCategoryId]
      .map((categoryId) => run.network.getUtxosByTokenCategory(categoryId)));
    return {
      tip: run.network.indexer.getTip()?.height,
      outpoints: held.flat().map((utxo) => `${utxo.txid}:${utxo.vout}`).sort(),
    };
  }

  it('admits the payer: Escrow sees the root user in tx.origin, and the refund lands on chain', async () => {
    // The EVM keeps tx.origin unchanged across calls, so Escrow.refund sees the payer who signed although its
    // msg.sender is Market: the require holds and the refund is emitted to the payer. The same answer here: the
    // escrow's frame states Market's proxy as its sender and the payer's own input as its origin, every input is
    // accepted, and the refund event and Market's count are read back on chain.
    const run = await deployed();
    const result = await (await enter(run, 'payer')).call;
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(result.completed.map((frame) => frame.functionName))
      .toStrictEqual(['Escrow.refund()', 'Market.refund()', 'MarketProxy.__fallback()']);
    const nested = result.draft.blockOf('callee-master-1');
    expect(bytesToHex(nested.sender)).toBe(bytesToHex(run.proxyAddress));
    expect(bytesToHex(result.sourceOutputs[nested.originRef]!.lockingBytecode)).toBe(bytesToHex(PAYER));
    expect(await refundEvents(run)).toStrictEqual([refundPayload(run, PAYER)]);
    expect(await refundsCounted(run)).toBe(1n);
  });

  it('refuses another user with the escrow\'s own reason, and nothing is broadcast', async () => {
    // The EVM reverts: tx.origin is the user who signed, not the payer, so Escrow.refund's require fails with its
    // own message and Market's write is undone with it. The shipped hop reports the escrow's frame and that message,
    // and the chain keeps every outpoint, the user's coin and both contracts' state.
    const run = await deployed();
    const before = await chainView(run);
    const entered = await enter(run, 'other');
    await expect(entered.call).rejects.toThrow(
      /the call's callee "Escrow\.refund\(\)" did not settle through the proxy: frame "callee-master-1" .*not the payer/,
    );
    expect((await run.network.getUtxosForLockingBytecode(entered.lock))
      .some((utxo) => utxo.txid === entered.coin.txid && utxo.vout === entered.coin.vout)).toBe(true);
    expect(await chainView(run)).toStrictEqual(before);
    expect(await refundEvents(run)).toStrictEqual([]);
    expect(await refundsCounted(run)).toBe(0n);
  });

  it('known wall: a refund recorded under tx.origin is planned under the frame\'s sender, and refused', async () => {
    // The EVM admits the payer and records refunded[payer]. Owner: the SDK hop. The artifact publishes the key as
    // `{ kind: 'msgSender', senderOp: 'tx.origin' }`, and the hop answers every such key with the frame's caller
    // (`proxy/entry-writes.ts`, `resolveHopKey`, handed the calling frame's address by `calleeEntryWrites`), here
    // Market's proxy, while the master derives the slot from the frame's origin, the payer: the escrow's frame
    // computes a node the plan did not link, and refuses.
    const run = await deployed();
    const layout = run.marketProxy.stateLayout!;
    const plan = await planHopExternalCalls({
      provider: run.network, artifact: run.market, functionName: 'refundRecorded', args: [],
      externals: { IEscrow: { artifact: run.escrow, categoryId: REFUND_ESCROW_CATEGORY } },
      validatorProgram: VALIDATOR_PROGRAM,
      stateValues: deploymentStateValues(layout, run.proxyCategoryId,
        await readFramedDeployment(run.network, run.proxyCategoryId, layout)),
      selfAddress: run.proxyAddress, senderAddress: PAYER,
    });
    const planned = plan.callees[0]!.entryWrites!.reachWrites.flatMap((write) => write.targets)
      .map((target) => bytesToHex(target.slot));
    expect(planned).toStrictEqual([bytesToHex(keyToSlotMulti([run.proxyAddress]))]);
    expect(planned).not.toContain(bytesToHex(keyToSlotMulti([PAYER])));

    const before = await chainView(run);
    const entered = await enter(run, 'payer', 'refundRecorded');
    await expect(entered.call).rejects.toThrow(new RegExp('the call\'s callee "Escrow\\.refundRecorded\\(\\)" did '
      + 'not settle through the proxy: frame "callee-master-1" .*no source message'));
    expect(await chainView(run)).toStrictEqual(before);
    expect(await refundedSlots(run)).toStrictEqual([]);
  });
});

/**
 * The same call reached two ways. `this.g()` runs inline with `msg.sender == address(this)` (pinned above); a call
 * through an interface at the contract's own address runs on a second master of the contract, and the callee sees
 * the same `msg.sender`. The controls show the identity is the caller's own address, not a value a caller chooses.
 */
describe('a call to the contract\'s own address on a second master runs as the contract too', () => {
  /** `callG` calls `g` at the contract's own address; `g` asserts it runs for the contract. */
  const SELF_TARGET_SOURCE = 'pragma solidcash ^0.14.0;'
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
    expect(refusal.code).toBe('FRAMED_DERIVATION_STALLED');
    expect(refusal.message).toMatch(/master "tok-1" of Tok\.callG\(\) filled no witness/);
  });
});
