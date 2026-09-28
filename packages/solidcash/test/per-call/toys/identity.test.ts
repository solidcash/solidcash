import { FrameKind, buildPushdataCommitment, bytesToHex, type RecordEntry } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { stateRecordLockingBytecode, stateRecordUnlockingBytecode } from '../../../src/per-call/deploy/index.js';
import { publishedRefusals } from '../../../../solidc/test/per-call/master/refused-entry.js';
import {
  USER_LOCK, compileAndDeploy, composeAndDerive, entryName, hexOf, master, masterInput, rootOf, seededAddress,
  selectorOf, token, userInput, validatorFor, type DeployedContract,
} from '../shapes/harness.js';
import type { CompositionDraftPlan } from '../../../src/per-call/composer/index.js';

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
  it('is refused by the compiler in the plan\'s exact shape: the self-called transfer writes a mapping', () => {
    // The mapping read/write adds hidden context parameters to `transfer`, so `this.transfer(t, amount)` cannot be
    // resolved with the source's two arguments. The plan's expectation (the transfer debits the contract) therefore
    // cannot be reached through the self-call at all; the scalar shape below is the reachable statement of it.
    const refusal = compileRefusal(MAPPING_SWEEP_SOURCE);
    expect(refusal.message).toMatch(/Found parameters .* call to function 'transfer'/);
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

  it('refuses `sweep(t)` as a user-entered root: a user entry supplies no run-time argument', () => {
    // `sweep(t)` takes a run-time argument. A user-entered master carries no call data (only a dispatcher selector
    // is permitted), so the root frame's parameter is never supplied: the machine rejects the frame and the
    // derivation stalls. This is why the reachable sweep above is parameterless.
    const source = 'pragma solidcash ^0.13.0;'
      + ` contract Tok { function sweep(address t) { require(t == 0x${hexOf(TREASURY)}); } }`;
    const { artifacts, contracts } = compileAndDeploy(source, { Tok: TOK_LABEL });
    const plan: CompositionDraftPlan = {
      blocks: [{ contract: 'Tok', masters: ['tok-1'], state: [] }],
      userInputs: [{ id: 'user', index: 1 }],
      masters: [master({
        master: 'tok-1', contract: 'Tok', entry: 'sweep', program: contracts.Tok!.program,
        facts: {
          contract: 'Tok', functionName: 'sweep', kind: FrameKind.ROOT,
          callerIsUser: true, originEqualsCaller: true, makesExternalCall: false, mastersOfContract: 1,
        },
        frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: contracts.Tok!.address, value: 0n },
        enteredBy: 'user', origin: 'user',
      })],
      inputs: { 'tok-1': { source: masterInput(contracts.Tok!) }, user: userInput() },
    };
    const refusal = refusalOf(() => settlePlan(plan, artifacts, 'Tok', 'sweep'));
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
      userInputs: [{ id: 'user', index: 3 }],
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
});
