import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import {
  asmToScript, buildSatoshiContainerCovenantScript, encodeArgumentList, encodeIntegerValue, encodeWitnessBlock,
  scriptToBytecode, sha256, validatorAddress, type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory } from './validator-input.js';

/**
 * `address(this).balance` in a framed master (spec 4b): the value of the containers the transaction spends, with
 * the frame's value credited and the sends the body has made so far taken out, as the EVM's balance stands at that
 * point of the execution.
 */

const CATEGORY = seededCategory('value balance');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const CONTAINER_LOCK = encodeLockingBytecodeP2sh32(
  hash256(scriptToBytecode(buildSatoshiContainerCovenantScript(CATEGORY))),
);

type Artifact = ReturnType<typeof compileString>;
type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Bank {'
  + '   receive() external payable { require(true); }'
  + '   function check(int expected) { require(address(this).balance == expected); }'
  + '   function top(int expected) payable { require(address(this).balance == expected); }'
  + '   function sweep() { this.transfer(msg.sender, address(this).balance); }'
  + '   function spend(int amount, int expected) {'
  + '     this.transfer(msg.sender, amount);'
  + '     require(address(this).balance == expected);'
  + '   }'
  + ' }';

const OTHER_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Peek {'
  + '   function peek(address who) { require(who.balance > 0); }'
  + '   function own() { require(address(this).balance >= 0); }'
  + ' }';

const artifact: Artifact = compileString(SOURCE, { composition: 'framed' });

function deployed(target: Artifact = artifact): { program: Uint8Array; lock: Uint8Array } {
  const { placeholders } = target.composition!;
  const program = fillPlaceholders(scriptToBytecode(asmToScript(target.bytecode)), placeholders, {
    category: categorySlotValue(CATEGORY),
    contractAddress: ADDRESS,
    ...(placeholders.templateHashOffset === undefined ? {} : { templateHash: TEMPLATE_HASH }),
  });
  return { program, lock: encodeLockingBytecodeP2sh32(hash256(program)) };
}

const selectorOf = (entry: string, target: Artifact = artifact): Uint8Array =>
  Uint8Array.from(Buffer.from(target.abi.find((row) => row.name === entry)!.selector!, 'hex'));
const container = (value: bigint): VmOutput => ({ lockingBytecode: CONTAINER_LOCK, valueSatoshis: value });
const payment = (value: bigint): VmOutput => ({ lockingBytecode: USER_LOCK, valueSatoshis: value });

interface Spend {
  /** The master the spend runs; the bank by default. */
  readonly artifact?: Artifact;
  readonly entry: string;
  readonly args: readonly Uint8Array[];
  readonly value?: bigint;
  readonly containersIn: readonly bigint[];
  /** The outputs after the master and the user's change: the first at index 2. */
  readonly trailing: readonly VmOutput[];
  readonly sends?: readonly number[];
}

function verdict(spend: Spend): { accepted: boolean; objection?: string } {
  const target = spend.artifact ?? artifact;
  const { program, lock } = deployed(target);
  const block: WitnessBlock = {
    kind: 0, callerRef: 1, originRef: 1, validatorRef: 0xffff, sender: USER_LOCK, self: ADDRESS,
    value: spend.value ?? 0n, retval: new Uint8Array(0), calls: [], segments: [[]], events: [],
    sends: [...(spend.sends ?? [])],
  };
  const input = (fill: number, unlockingBytecode: Uint8Array): VmTransaction['inputs'][number] => ({
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(fill), sequenceNumber: 0xffffffff,
    unlockingBytecode,
  });
  const master: VmOutput = {
    lockingBytecode: lock, valueSatoshis: 20_000n,
    token: { category: CATEGORY, amount: 0n, nft: { capability: 'minting', commitment: new Uint8Array(0) } },
  };
  const transaction: VmTransaction = {
    version: 2,
    inputs: [
      {
        ...input(1, new Uint8Array([
          ...encodeDataPush(encodeWitnessBlock(block)),
          ...encodeArgumentList([selectorOf(spend.entry, target), ...spend.args]),
          ...encodeDataPush(program),
        ])),
        // A constructor runs only where input 0, here the master's own, spends the category's genesis outpoint.
        ...(spend.entry === '__construct' ? { outpointTransactionHash: CATEGORY } : {}),
      },
      input(2, callerUnlockingBytecode()),
      ...spend.containersIn.map((_, index) => input(3 + index, encodeDataPush(new Uint8Array([1])))),
    ],
    outputs: [master, payment(1_000n), ...spend.trailing],
    locktime: 0,
  };
  const sourceOutputs: VmProgram['sourceOutputs'] = [
    master, payment(100_000n), ...spend.containersIn.map(container),
  ];
  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: 0, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

const int = (value: bigint): Uint8Array => encodeIntegerValue(value);

describe('address(this).balance, compiled framed', () => {
  it('is the value of the containers the transaction spends', () => {
    const spend = (expected: bigint): { accepted: boolean } => verdict({
      entry: 'check', args: [int(expected)], containersIn: [30_000n, 20_000n], trailing: [container(50_000n)],
    });
    expect(spend(50_000n)).toStrictEqual({ accepted: true });
    expect(spend(49_999n).accepted).toBe(false);
  });

  it('credits the value the frame receives', () => {
    const spend = (expected: bigint): { accepted: boolean } => verdict({
      entry: 'top', args: [int(expected)], value: 10_000n, containersIn: [50_000n], trailing: [container(60_000n)],
    });
    expect(spend(60_000n)).toStrictEqual({ accepted: true });
    expect(spend(50_000n).accepted).toBe(false);
  });

  it('takes out what the body has already sent', () => {
    const spend = (expected: bigint): { accepted: boolean } => verdict({
      entry: 'spend',
      // The first parameter's push lands last.
      args: [int(expected), int(10_000n)],
      containersIn: [50_000n],
      trailing: [container(40_000n), payment(10_000n)],
      sends: [3],
    });
    expect(spend(40_000n)).toStrictEqual({ accepted: true });
    expect(spend(50_000n).accepted).toBe(false);
  });

  it('pays out the whole balance', () => {
    expect(verdict({
      entry: 'sweep', args: [], containersIn: [30_000n, 20_000n], trailing: [container(1_000n), payment(50_000n)],
      sends: [3],
    })).toStrictEqual({ accepted: true });
    expect(verdict({
      entry: 'sweep', args: [], containersIn: [30_000n, 20_000n], trailing: [container(1_000n), payment(49_999n)],
      sends: [3],
    }).accepted).toBe(false);
  });

  it('is published for the builder, which spends every container for an entry that reads it', () => {
    const readers = artifact.composition!.balanceReaders;
    expect(readers).toStrictEqual(['Bank.check()', 'Bank.top()', 'Bank.sweep()', 'Bank.spend()']);
  });

  it('refuses by name a body that reads another address\'s balance', () => {
    const other = compileString(OTHER_SOURCE, { composition: 'framed' });
    const refused = other.composition!.refusedEntries ?? [];
    expect(refused.map((entry) => entry.functionName)).toStrictEqual(['Peek.peek()']);
    expect(refused[0]!.reason).toMatch(/reads the balance of an address other than its own/);
  });
});

/**
 * A constructor's balance read (spec 4b): the constructor runs only at its genesis, and no genesis shows a balance.
 * Another address's balance shows only in the inputs a transaction spends, and the contract's own is the
 * containers a transaction spends beside one of its masters, which do not exist before the genesis. A read is
 * refused by name and published as the constructor's refusal, while the bodies the master serves keep serving.
 */
const constructorSource = (name: string, members: string): string => 'pragma solidcash ^0.14.0;'
  + ` contract ${name} {${members}`
  + '   function note() { require(true); }'
  + ' }';

const OTHER_BALANCE_CONSTRUCTORS: Readonly<Record<string, string>> = {
  Param: constructorSource('Param', ' int public seen; constructor(address who) { this.seen = who.balance; }'),
  Sender: constructorSource('Sender', ' int public seen; constructor() { this.seen = msg.sender.balance; }'),
  Helper: constructorSource('Helper', ' int public seen; constructor(address who) { this.seen = peek(who); }'
    + ' function peek(address w) internal view returns (int) { return w.balance; }'),
};

const OWN_BALANCE_CONSTRUCTORS: Readonly<Record<string, string>> = {
  Cast: constructorSource('Cast', ' int public seen; constructor() { this.seen = address(this).balance; }'),
  Self: constructorSource('Self', ' int public seen; constructor() { this.seen = this.balance; }'),
};

const SOLIDITY_OWN_BALANCE_SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Sol { uint256 public seen; constructor() { seen = address(this).balance; }'
  + '   function note() public { seen = seen + 1; } }';

const KEPT_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Kept {'
  + '   constructor() { require(address(this).balance >= 0); }'
  + '   function check(int expected) { require(address(this).balance == expected); }'
  + ' }';

const SERVED_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Served {'
  + '   constructor() { require(true); }'
  + '   function check(int expected) { require(address(this).balance == expected); }'
  + ' }';

describe('a constructor that reads a balance, compiled framed', () => {
  it('is refused by name when it reads another address\'s balance, itself or through a body it runs', () => {
    for (const [name, source] of Object.entries(OTHER_BALANCE_CONSTRUCTORS)) {
      expect(compileString(source, { composition: 'framed' }).composition!.refusedEntries, name).toStrictEqual([{
        functionName: `${name}.__construct()`,
        reason: 'the constructor reads the balance of an address other than its own, which a transaction shows '
          + 'only in the inputs it spends',
      }]);
    }
  });

  it('is refused by name when it reads its own contract\'s balance, in either spelling', () => {
    const own = [
      ...Object.entries(OWN_BALANCE_CONSTRUCTORS).map(([name, source]) => ({
        name, compiled: compileString(source, { composition: 'framed' }),
      })),
      {
        name: 'Sol',
        compiled: compileString(SOLIDITY_OWN_BALANCE_SOURCE, {
          composition: 'framed', evmCompat: true,
        } as never),
      },
    ];
    for (const { name, compiled } of own) {
      expect(compiled.composition!.refusedEntries, name).toStrictEqual([{
        functionName: `${name}.__construct()`,
        reason: 'the constructor reads its contract\'s balance, which no genesis shows: the balance is the '
          + 'containers a transaction spends beside a master of the contract, and the contract has no master '
          + 'before its genesis',
      }]);
      // A refused constructor is not one a builder spends the contract's containers for.
      expect(compiled.composition!.balanceReaders, name).toBeUndefined();
    }
  });

  it('fails at the refused constructor while an entry that reads its balance keeps settling', () => {
    const kept = compileString(KEPT_SOURCE, { composition: 'framed' });
    expect(kept.composition!.refusedEntries!.map((entry) => entry.functionName)).toStrictEqual(['Kept.__construct()']);
    expect(kept.composition!.balanceReaders).toStrictEqual(['Kept.check()']);
    expect(verdict({
      artifact: kept, entry: 'check', args: [int(50_000n)], containersIn: [30_000n, 20_000n],
      trailing: [container(50_000n)],
    })).toStrictEqual({ accepted: true });
    expect(verdict({ artifact: kept, entry: '__construct', args: [], containersIn: [], trailing: [] }))
      .toStrictEqual({ accepted: false, objection: 'Program failed an OP_VERIFY operation.' });
    // The control: the same master with a constructor that reads no balance serves the same frame.
    const served = compileString(SERVED_SOURCE, { composition: 'framed' });
    expect(served.composition!.refusedEntries).toBeUndefined();
    expect(verdict({ artifact: served, entry: '__construct', args: [], containersIn: [], trailing: [] }))
      .toStrictEqual({ accepted: true });
  });
});

/**
 * A kept subroutine that reads its contract's balance (spec 4b).
 *
 * A body the master keeps as its own subroutine has no frame to read the balance from, so its definition cannot be
 * emitted and used to fail the whole compile. It is emitted as a refusal stub instead, and the entry and the
 * constructor that run it are refused with it, by name, while the entry that reads its balance itself settles.
 */
const KEPT_HELPER_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Vault {'
  + '   constructor() { require(mine() >= 0); }'
  + '   function f(int expected) { require(mine() == expected); }'
  + '   function check(int expected) { require(address(this).balance == expected); }'
  + '   function mine() internal view returns (int) { return address(this).balance; }'
  + ' }';

describe('a kept subroutine that reads its contract\'s balance, compiled framed', () => {
  const compiledVault = (): Artifact => compileString(KEPT_HELPER_SOURCE, { composition: 'framed' });

  it('compiles, and refuses by name the entry and the constructor that run it', () => {
    expect(compiledVault().composition!.refusedEntries).toStrictEqual([
      {
        functionName: 'Vault.__construct()',
        reason: 'the constructor reads its contract\'s balance, which no genesis shows: the balance is the '
          + 'containers a transaction spends beside a master of the contract, and the contract has no master '
          + 'before its genesis',
      },
      {
        functionName: 'Vault.f()',
        reason: 'it runs \'mine\', which the master cannot serve: the body reads its contract\'s balance and is '
          + 'invoked as its own subroutine, which has no frame to read it from',
      },
    ]);
  });

  it('fails at the refused bodies while the entry that reads its balance itself settles', () => {
    const vault = compiledVault();
    expect(verdict({
      artifact: vault, entry: 'check', args: [int(50_000n)], containersIn: [30_000n, 20_000n],
      trailing: [container(50_000n)],
    })).toStrictEqual({ accepted: true });
    const refused = { accepted: false, objection: 'Program failed an OP_VERIFY operation.' };
    expect(verdict({
      artifact: vault, entry: 'f', args: [int(50_000n)], containersIn: [30_000n, 20_000n],
      trailing: [container(50_000n)],
    })).toStrictEqual(refused);
    expect(verdict({ artifact: vault, entry: '__construct', args: [], containersIn: [], trailing: [] }))
      .toStrictEqual(refused);
  });
});
