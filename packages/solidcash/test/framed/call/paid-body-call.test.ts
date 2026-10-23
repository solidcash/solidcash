import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { callFramedEntry, sendFramedValue, type FramedCallResult } from '../../../src/framed/call/index.js';
import {
  addressOf, containerValue, currentCaller, deploy, deployBeside, deployBesideWith, type Deployed,
} from './value-harness.js';

/**
 * A recipient's paid body, composed by `callFramedEntry` (spec 4b): a `receive()` that emits, writes its own mapping
 * or sends to users' locks when another contract pays it. The recipient lists a run of its own after the payer's, and
 * the SDK learns what the paid body emits, writes and sends from the body's own program.
 */

const PAID_BODIES_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Tipped {'
  + '   int public tips;'
  + '   event Tip(int amount);'
  + '   receive() external payable { this.tips = this.tips + msg.value; emit Tip(msg.value); }'
  + ' }'
  + ' contract Bank {'
  + '   mapping(address => uint) balances;'
  + '   constructor(address owner) { this.balances[owner] = 1; }'
  + '   receive() external payable { this.balances[msg.sender] = this.balances[msg.sender] + msg.value; }'
  + ' }'
  + ' contract Payer {'
  + '   int public paid;'
  + '   receive() external payable { require(true); }'
  + '   function pay(bytes to, int amount) { this.paid = this.paid + amount; this.transfer(to, amount); }'
  + ' }';

const paidBodies = compileStringMulti(PAID_BODIES_SOURCE, { composition: 'framed' });

let payerRun: Promise<Deployed> | undefined;

/** One Payer serves every case, each recipient deployed beside it: its one deposit covers their sends, 31,001. */
function payer(): Promise<Deployed> {
  payerRun ??= (async (): Promise<Deployed> => {
    const deployed = await deploy(paidBodies.Payer!);
    // Each call is paid from the caller's largest coin, the last call's change, so one coin carries every case's fees.
    await deployed.provider.addUtxo(binToHex(deployed.callerLock), {
      txid: '46'.repeat(31) + 'c1', vout: 0, satoshis: 500_000n,
    });
    await sendFramedValue({ ...(await currentCaller(deployed)), value: 32_000n });
    return deployed;
  })();
  return payerRun;
}

describe('a paid receive() that emits or writes a mapping', () => {
  it('lists the event the paid body emits, learned from its own program', async () => {
    const deployed = await payer();
    const tippedCategory = await deployBeside(deployed, paidBodies.Tipped!, '4e'.repeat(31) + 'b1');

    const result = await callFramedEntry({
      ...(await currentCaller(deployed)),
      functionName: 'pay',
      args: [addressOf(paidBodies.Tipped!, tippedCategory), 6_000n],
      externals: { Tipped: { artifact: paidBodies.Tipped!, categoryId: tippedCategory } },
    });
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual(['Tipped.__receive()', 'Payer.pay()']);
    // The event is an immutable NFT of the paid contract's own category.
    const events = result.broadcast!.outputs.filter((output) => output.token !== undefined
      && binToHex(output.token.category) === tippedCategory && output.token.nft?.capability === 'none');
    expect(events).toHaveLength(1);
    expect(containerValue(result, tippedCategory)).toBe(6_000n);
  });

  it('writes the paid body\'s mapping entry, created on the first payment and updated on the next', async () => {
    const deployed = await payer();
    const bankCategory = await deployBesideWith(deployed, paidBodies.Bank!, [deployed.callerLock], '4f'.repeat(31) + 'b0');
    const externals = { Bank: { artifact: paidBodies.Bank!, categoryId: bankCategory } };
    const to = addressOf(paidBodies.Bank!, bankCategory);

    const first = await callFramedEntry({
      ...(await currentCaller(deployed)), functionName: 'pay', args: [to, 7_000n], externals,
    });
    expect(first.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(containerValue(first, bankCategory)).toBe(7_000n);

    const second = await callFramedEntry({
      ...(await currentCaller(deployed)), functionName: 'pay', args: [to, 3_000n], externals,
    });
    expect(second.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(containerValue(second, bankCategory)).toBe(3_000n);
  });
});

const SENDING_BODIES_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Splitter {'
  + '   bytes25 public first;'
  + '   bytes25 public second;'
  + '   constructor(bytes25 a, bytes25 b) { this.first = a; this.second = b; }'
  + '   receive() external payable {'
  + '     this.transfer(this.first, msg.value / 2);'
  + '     this.transfer(this.second, msg.value - msg.value / 2);'
  + '   }'
  + ' }'
  + ' contract Doubler {'
  + '   bytes25 public to;'
  + '   int public paid;'
  + '   constructor(bytes25 a) { this.to = a; }'
  + '   function deposit() payable { require(msg.value > 0); }'
  + '   receive() external payable { this.paid = this.paid + 1; this.transfer(this.to, msg.value * 2); }'
  + ' }'
  + ' contract Tipper {'
  + '   bytes25 public first;'
  + '   bytes25 public second;'
  + '   constructor(bytes25 a, bytes25 b) { this.first = a; this.second = b; }'
  + '   receive() external payable {'
  + '     if (msg.value > 5000) { this.transfer(this.first, 1000); }'
  + '     this.transfer(this.second, 500);'
  + '   }'
  + ' }';

const sendingBodies = compileStringMulti(SENDING_BODIES_SOURCE, { composition: 'framed' });
const FIRST_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x31));
const SECOND_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x32));

/** The value the broadcast pays to one lock. */
function paidTo(result: FramedCallResult, lock: Uint8Array): bigint {
  return (result.broadcast?.outputs ?? [])
    .filter((output) => binToHex(output.lockingBytecode) === binToHex(lock))
    .reduce((sum, output) => sum + output.valueSatoshis, 0n);
}

describe('a paid receive() that sends', () => {
  it('forwards what it receives to the users its records name', async () => {
    const deployed = await payer();
    const splitterCategory = await deployBesideWith(
      deployed, sendingBodies.Splitter!, [FIRST_LOCK, SECOND_LOCK], '50'.repeat(32),
    );

    const result = await callFramedEntry({
      ...(await currentCaller(deployed)),
      functionName: 'pay',
      args: [addressOf(sendingBodies.Splitter!, splitterCategory), 9_001n],
      externals: { Splitter: { artifact: sendingBodies.Splitter!, categoryId: splitterCategory } },
    });
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(paidTo(result, FIRST_LOCK)).toBe(4_500n);
    expect(paidTo(result, SECOND_LOCK)).toBe(4_501n);
  });

  it('pays out more than it receives from its own containers, and is refused by name when they cannot', async () => {
    const deployed = await payer();
    const doublerCategory = await deployBesideWith(deployed, sendingBodies.Doubler!, [FIRST_LOCK], '51'.repeat(31) + 'ae');
    const externals = { Doubler: { artifact: sendingBodies.Doubler!, categoryId: doublerCategory } };
    const to = addressOf(sendingBodies.Doubler!, doublerCategory);
    // Before its deposit it holds nothing, so what it sends beyond what it receives has no container to come from.
    await expect(callFramedEntry({
      ...(await currentCaller(deployed)), functionName: 'pay', args: [to, 3_000n], externals,
    })).rejects.toThrow(/contract "Doubler" holds 0 satoshis in its containers/);
    const doubler = { ...deployed, artifact: sendingBodies.Doubler!, categoryId: doublerCategory };
    const deposit = await callFramedEntry({ ...(await currentCaller(doubler)), functionName: 'deposit', value: 8_000n });
    expect(deposit.accepted).toBe(true);

    // As the EVM pays from its balance.
    const result = await callFramedEntry({
      ...(await currentCaller(deployed)), functionName: 'pay', args: [to, 3_000n], externals,
    });
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(paidTo(result, FIRST_LOCK)).toBe(6_000n);
    // The 3,000 it received and 3,000 of its deposit paid the send; the rest of the deposit stays in its container.
    expect(containerValue(result, doublerCategory)).toBe(5_000n);
  });

  it('lists only the send it makes when one of its sends is on a branch not taken', async () => {
    const deployed = await payer();
    const tipperCategory = await deployBesideWith(
      deployed, sendingBodies.Tipper!, [FIRST_LOCK, SECOND_LOCK], '53'.repeat(32),
    );
    const externals = { Tipper: { artifact: sendingBodies.Tipper!, categoryId: tipperCategory } };
    const to = addressOf(sendingBodies.Tipper!, tipperCategory);

    // A branch taken makes every send, as the splitter's do.
    const skipped = await callFramedEntry({
      ...(await currentCaller(deployed)), functionName: 'pay', args: [to, 3_000n], externals,
    });
    expect(skipped.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(paidTo(skipped, FIRST_LOCK)).toBe(0n);
    expect(paidTo(skipped, SECOND_LOCK)).toBe(500n);
    expect(containerValue(skipped, tipperCategory)).toBe(2_500n);

  });
});
