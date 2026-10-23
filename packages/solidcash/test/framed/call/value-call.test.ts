import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { buildPushdataCommitment, bytesToHex, type Artifact } from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import type { SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { satoshiContainerLockingBytecode, stateRecordLockingBytecode } from '../../../src/framed/deploy/index.js';
import {
  FramedCallError, callFramedEntry, sendFramedValue, type FramedCallResult,
} from '../../../src/framed/call/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import {
  addressOf, callerOf, containerValue, currentCaller, deploy, deployBeside, type Deployed,
} from './value-harness.js';

/**
 * Value carried by a call into a deployed framed contract (spec 4b), through the shipped path.
 *
 * A value send runs the contract's `receive()`, and a call to a payable entry carries value the same way: the caller
 * pays it into a satoshi container of the contract, and the entry reads it as `msg.value`. The SDK refuses by name
 * what the EVM would revert: value for an entry that is not payable, and a value send to a contract with neither a
 * `receive()` nor a payable `fallback()`.
 */

const AMOUNT = 10_000n;

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Vault {'
  + '   int public received;'
  + '   receive() external payable { this.received = this.received + msg.value; }'
  + '   function deposit() payable { this.received = this.received + msg.value; }'
  + '   function touch(int by) { this.received = this.received + by; }'
  + ' }';

const PLAIN_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Plain {'
  + '   int public count;'
  + '   function touch(int by) { this.count = this.count + by; }'
  + ' }';

const vault = compileStringMulti(SOURCE, { composition: 'framed' }).Vault!;
const plain = compileStringMulti(PLAIN_SOURCE, { composition: 'framed' }).Plain!;

/** The record commitment the shipped encoder materializes for one balance. */
function received(value: bigint): string {
  return buildPushdataCommitment(vault.stateLayout!, { received: value }, 0);
}

/**
 * One deployment of `artifact` for the cases that share it: the first deploys it and snapshots the chain, and each
 * rewinds the chain to that snapshot first, so every case starts from the deployment as it came out.
 */
function sharedDeployment(artifact: Artifact): () => Promise<Deployed> {
  let run: Promise<{ readonly deployed: Deployed; readonly snapshot: SnapshotRestorer }> | undefined;
  return async (): Promise<Deployed> => {
    run ??= (async (): Promise<{ readonly deployed: Deployed; readonly snapshot: SnapshotRestorer }> => {
      const deployed = await deploy(artifact);
      return { deployed, snapshot: await deployed.provider.takeSnapshot() };
    })();
    const shared = await run;
    await shared.snapshot.restore();
    return shared.deployed;
  };
}

const deployedVault = sharedDeployment(vault);

describe('a value send to a deployed framed contract', () => {
  it('runs receive() with the value, paid into a container of the contract', async () => {
    const deployed = await deployedVault();
    const result = await sendFramedValue({ ...callerOf(deployed), value: AMOUNT });

    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual(['Vault.__receive()']);
    expect(bytesToHex(result.writtenCommitments[0]!)).toBe(received(AMOUNT));
    expect(containerValue(result, deployed.categoryId)).toBe(AMOUNT);
  });

  it('is refused by name for a contract with no receive()', async () => {
    const deployed = await deploy(plain);
    await expect(sendFramedValue({ ...callerOf(deployed), value: AMOUNT }))
      .rejects.toThrow(/contract "Plain" has no receive\(\)/);
  });
});

describe('a call to a payable entry carrying value', () => {
  it('reads the value as msg.value, paid into a container of the contract', async () => {
    const deployed = await deployedVault();
    const result = await callFramedEntry({ ...callerOf(deployed), functionName: 'deposit', value: AMOUNT });

    expect(result.accepted).toBe(true);
    expect(bytesToHex(result.writtenCommitments[0]!)).toBe(received(AMOUNT));
    expect(containerValue(result, deployed.categoryId)).toBe(AMOUNT);
  });

  it('is refused by name for an entry that is not payable', async () => {
    const deployed = await deployedVault();
    await expect(callFramedEntry({ ...callerOf(deployed), functionName: 'touch', args: [1n], value: AMOUNT }))
      .rejects.toThrow(FramedCallError);
    await expect(callFramedEntry({ ...callerOf(deployed), functionName: 'touch', args: [1n], value: AMOUNT }))
      .rejects.toThrow(/entry "touch" is not payable/);
    // The control: the same entry without value is served.
    const plainCall = await callFramedEntry({ ...callerOf(deployed), functionName: 'touch', args: [1n] });
    expect(plainCall.accepted).toBe(true);
  });
});

const WALLET_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Wallet {'
  + '   int public paid;'
  + '   receive() external payable { require(true); }'
  + '   function withdraw(int amount) { this.paid = this.paid + amount; this.transfer(msg.sender, amount); }'
  + '   function forward() payable { this.paid = this.paid + msg.value; this.transfer(msg.sender, msg.value); }'
  + ' }';

const wallet = compileStringMulti(WALLET_SOURCE, { composition: 'framed' }).Wallet!;
const deployedWallet = sharedDeployment(wallet);

/** The value the broadcast pays to the caller's own lock outside its change, which is the last output. */
function paidToCaller(result: FramedCallResult, callerLock: Uint8Array): bigint {
  const outputs = result.broadcast?.outputs ?? [];
  return outputs.slice(0, -1)
    .filter((output) => binToHex(output.lockingBytecode) === binToHex(callerLock))
    .reduce((sum, output) => sum + output.valueSatoshis, 0n);
}

describe('an entry that sends, paid from the contract\'s containers', () => {
  it('withdraws what a deposit put in, and keeps the change in a container', async () => {
    const deployed = await deployedWallet();
    const deposit = await sendFramedValue({ ...(await currentCaller(deployed)), value: 20_000n });
    expect(deposit.accepted).toBe(true);

    const withdrawal = await callFramedEntry({
      ...(await currentCaller(deployed)), functionName: 'withdraw', args: [15_000n],
    });
    expect(withdrawal.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(paidToCaller(withdrawal, deployed.callerLock)).toBe(15_000n);
    // The deposit's container is spent and the change is kept in the one the send follows.
    expect(containerValue(withdrawal, deployed.categoryId)).toBe(5_000n);
    const containerLock = binToHex(satoshiContainerLockingBytecode(deployed.categoryId));
    const containerIndex = withdrawal.broadcast!.outputs
      .findIndex((output) => binToHex(output.lockingBytecode) === containerLock);
    expect(binToHex(withdrawal.broadcast!.outputs[containerIndex + 1]!.lockingBytecode))
      .toBe(binToHex(deployed.callerLock));
  });

  it('is refused by name when the containers cannot cover the send', async () => {
    const deployed = await deployedWallet();
    await sendFramedValue({ ...(await currentCaller(deployed)), value: 5_000n });
    await expect(callFramedEntry({ ...(await currentCaller(deployed)), functionName: 'withdraw', args: [10_000n] }))
      .rejects.toThrow(/contract "Wallet" holds 5000 satoshis in its containers, and entry "withdraw" sends 10000 more/);
  });

  it('forwards the value a payable entry receives without touching the containers', async () => {
    const deployed = await deployedWallet();
    const forward = await callFramedEntry({
      ...(await currentCaller(deployed)), functionName: 'forward', value: 7_000n,
    });
    expect(forward.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(paidToCaller(forward, deployed.callerLock)).toBe(7_000n);
  });
});

const READING_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Capped {'
  + '   int public cap;'
  + '   receive() external payable { require(true); }'
  + '   function setCap(int c) { this.cap = c; }'
  + '   function pay(int amount) { require(amount <= this.cap); this.transfer(msg.sender, amount); }'
  + ' }'
  + ' contract Ledger {'
  + '   mapping(address => int) balances;'
  + '   receive() external payable { this.balances[msg.sender] = this.balances[msg.sender] + msg.value; }'
  + '   function withdraw(int amount) {'
  + '     require(this.balances[msg.sender] >= amount);'
  + '     this.balances[msg.sender] = this.balances[msg.sender] - amount;'
  + '     this.transfer(msg.sender, amount);'
  + '   }'
  + ' }'
  + ' contract Allowance {'
  + '   mapping(address => int) limits;'
  + '   receive() external payable { require(true); }'
  + '   function setLimit(int v) { this.limits[msg.sender] = v; }'
  + '   function pay(int amount) { require(amount <= this.limits[msg.sender]); this.transfer(msg.sender, amount); }'
  + ' }';

const reading = compileStringMulti(READING_SOURCE, { composition: 'framed' });

describe('an entry that sends what its state allows', () => {
  it('pays up to the cap its record holds, a record it reads and does not write', async () => {
    const deployed = await deploy(reading.Capped!);
    await sendFramedValue({ ...(await currentCaller(deployed)), value: 20_000n });
    const cap = await callFramedEntry({ ...(await currentCaller(deployed)), functionName: 'setCap', args: [15_000n] });
    expect(cap.accepted).toBe(true);

    const over = await callFramedEntry({ ...(await currentCaller(deployed)), functionName: 'pay', args: [15_001n] });
    expect(over.accepted).toBe(false);
    expect(over.broadcast).toBeUndefined();
    const paid = await callFramedEntry({ ...(await currentCaller(deployed)), functionName: 'pay', args: [15_000n] });
    expect(paid.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(paidToCaller(paid, deployed.callerLock)).toBe(15_000n);
  });

  it('withdraws what its mapping credits the sender, debiting the entry it reads', async () => {
    const deployed = await deploy(reading.Ledger!);
    await sendFramedValue({ ...(await currentCaller(deployed)), value: 20_000n });

    const withdrawal = await callFramedEntry({
      ...(await currentCaller(deployed)), functionName: 'withdraw', args: [15_000n],
    });
    expect(withdrawal.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(paidToCaller(withdrawal, deployed.callerLock)).toBe(15_000n);
    expect(containerValue(withdrawal, deployed.categoryId)).toBe(5_000n);
    // The entry now credits 5,000, so a larger withdrawal is refused.
    const over = await callFramedEntry({ ...(await currentCaller(deployed)), functionName: 'withdraw', args: [6_000n] });
    expect(over.accepted).toBe(false);
    expect(over.broadcast).toBeUndefined();
  });

  it('pays up to the limit its mapping grants the sender, a key it reads and does not write', async () => {
    const deployed = await deploy(reading.Allowance!);
    await sendFramedValue({ ...(await currentCaller(deployed)), value: 20_000n });
    const limit = await callFramedEntry({
      ...(await currentCaller(deployed)), functionName: 'setLimit', args: [15_000n],
    });
    expect(limit.accepted).toBe(true);

    const over = await callFramedEntry({ ...(await currentCaller(deployed)), functionName: 'pay', args: [15_001n] });
    expect(over.accepted).toBe(false);
    expect(over.broadcast).toBeUndefined();
    const paid = await callFramedEntry({ ...(await currentCaller(deployed)), functionName: 'pay', args: [15_000n] });
    expect(paid.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(paidToCaller(paid, deployed.callerLock)).toBe(15_000n);
  });
});

const PAYMENTS_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Payer {'
  + '   int public paid;'
  + '   receive() external payable { require(true); }'
  + '   function pay(bytes to, int amount) { this.paid = this.paid + amount; this.transfer(to, amount); }'
  + ' }'
  + ' contract Vault {'
  + '   int public received;'
  + '   receive() external payable { this.received = this.received + msg.value; }'
  + ' }'
  + ' contract Closed {'
  + '   int public count;'
  + '   function touch(int by) { this.count = this.count + by; }'
  + ' }';

const payments = compileStringMulti(PAYMENTS_SOURCE, { composition: 'framed' });
const deployedPayer = sharedDeployment(payments.Payer!);

describe('an entry that pays a contract through its receive()', () => {
  it('runs the recipient\'s receive() with the value, paid from the payer\'s containers', async () => {
    const deployed = await deployedPayer();
    const vaultCategory = await deployBeside(deployed, payments.Vault!, '47'.repeat(31) + 'b8');
    await sendFramedValue({ ...(await currentCaller(deployed)), value: 20_000n });

    const result = await callFramedEntry({
      ...(await currentCaller(deployed)),
      functionName: 'pay',
      args: [addressOf(payments.Vault!, vaultCategory), 7_000n],
      externals: { Vault: { artifact: payments.Vault!, categoryId: vaultCategory } },
    });
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual(['Vault.__receive()', 'Payer.pay()']);
    // The recipient booked the value it received, and its containers hold it.
    const vaultRecord = binToHex(stateRecordLockingBytecode(vaultCategory));
    const booked = result.broadcast!.outputs.find((output) => binToHex(output.lockingBytecode) === vaultRecord);
    expect(binToHex(booked!.token!.nft!.commitment!)).toBe(
      buildPushdataCommitment(payments.Vault!.stateLayout!, { received: 7_000n }, 0),
    );
    expect(containerValue(result, vaultCategory)).toBe(7_000n);
    // The payer's deposit paid it, and the change stays in the payer's container.
    expect(containerValue(result, deployed.categoryId)).toBe(13_000n);
  });

  it('is refused by name when the recipient has no receive(), or is not among the externals', async () => {
    const deployed = await deployedPayer();
    // Both are refused from the artifacts and the call's externals, before any recipient deployment is read.
    const closedCategory = '48'.repeat(31) + 'b7';
    await expect(callFramedEntry({
      ...(await currentCaller(deployed)),
      functionName: 'pay',
      args: [addressOf(payments.Closed!, closedCategory), 7_000n],
      externals: { Closed: { artifact: payments.Closed!, categoryId: closedCategory } },
    })).rejects.toThrow(/contract "Closed" has no receive\(\), so the value entry "pay" sends it has no body to run/);
    await expect(callFramedEntry({
      ...(await currentCaller(deployed)),
      functionName: 'pay',
      args: [addressOf(payments.Vault!, '49'.repeat(32)), 7_000n],
    })).rejects.toThrow(/entry "pay" sends to the contract at [0-9a-f]+, which the call's externals do not name/);
  });
});

const TILL_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Till {'
  + '   int public emptied;'
  + '   receive() external payable { require(true); }'
  + '   function holding() view returns (int) { return address(this).balance; }'
  + '   function empty() { this.emptied = this.emptied + 1; this.transfer(msg.sender, address(this).balance); }'
  + ' }';

const till = compileStringMulti(TILL_SOURCE, { composition: 'framed' }).Till!;

describe('an entry that reads its own balance', () => {
  it('reads every container the contract holds, and pays all of it out', async () => {
    const deployed = await deploy(till);
    await sendFramedValue({ ...(await currentCaller(deployed)), value: 20_000n });
    await sendFramedValue({ ...(await currentCaller(deployed)), value: 5_000n });

    const read = await readFramedEntry({
      provider: deployed.provider, artifact: till, categoryId: deployed.categoryId, functionName: 'holding',
      vm: compositionMachine(),
    });
    expect(read.accepted).toBe(true);
    expect(read.value).toBe(25_000n);

    const emptied = await callFramedEntry({ ...(await currentCaller(deployed)), functionName: 'empty' });
    expect(emptied.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(paidToCaller(emptied, deployed.callerLock)).toBe(25_000n);
    // Both containers are spent; the one the send follows keeps only what the caller put in to stand it up.
    expect(containerValue(emptied, deployed.categoryId)).toBe(1_000n);
  });
});

const FALLBACK_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Tip {'
  + '   int public tipped;'
  + '   function reset() { this.tipped = 0; }'
  + '   fallback() external payable { this.tipped = this.tipped + msg.value; }'
  + ' }'
  + ' contract Shut {'
  + '   int public count;'
  + '   function touch(int by) { this.count = this.count + by; }'
  + '   fallback() external { this.count = this.count + 1; }'
  + ' }'
  + ' contract Payer {'
  + '   int public paid;'
  + '   receive() external payable { require(true); }'
  + '   function pay(bytes to, int amount) { this.paid = this.paid + amount; this.transfer(to, amount); }'
  + ' }';

const fallbacks = compileStringMulti(FALLBACK_SOURCE, { composition: 'framed' });

describe('a value send to a contract whose fallback() takes it', () => {
  it('runs a payable fallback() when the contract has no receive(), as the EVM picks the body', async () => {
    const deployed = await deploy(fallbacks.Tip!);
    const result = await sendFramedValue({ ...callerOf(deployed), value: AMOUNT });

    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual(['Tip.__fallback()']);
    expect(bytesToHex(result.writtenCommitments[0]!)).toBe(
      buildPushdataCommitment(fallbacks.Tip!.stateLayout!, { tipped: AMOUNT }, 0),
    );
    expect(containerValue(result, deployed.categoryId)).toBe(AMOUNT);
  });

  it('is refused by name when the fallback() is not payable', async () => {
    const deployed = await deploy(fallbacks.Shut!);
    const refusal = 'contract "Shut" has no receive() and its fallback() is not payable, so it refuses a value sent to it';
    await expect(sendFramedValue({ ...callerOf(deployed), value: AMOUNT })).rejects.toThrow(refusal);
  });

  it('runs the recipient\'s payable fallback() for an entry that pays it', async () => {
    const deployed = await deploy(fallbacks.Payer!);
    const tipCategory = await deployBeside(deployed, fallbacks.Tip!, '4a'.repeat(31) + 'b5');
    await sendFramedValue({ ...(await currentCaller(deployed)), value: 20_000n });

    const result = await callFramedEntry({
      ...(await currentCaller(deployed)),
      functionName: 'pay',
      args: [addressOf(fallbacks.Tip!, tipCategory), 7_000n],
      externals: { Tip: { artifact: fallbacks.Tip!, categoryId: tipCategory } },
    });
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual(['Tip.__fallback()', 'Payer.pay()']);
    const tipRecord = binToHex(stateRecordLockingBytecode(tipCategory));
    const booked = result.broadcast!.outputs.find((output) => binToHex(output.lockingBytecode) === tipRecord);
    expect(binToHex(booked!.token!.nft!.commitment!)).toBe(
      buildPushdataCommitment(fallbacks.Tip!.stateLayout!, { tipped: 7_000n }, 0),
    );
    expect(containerValue(result, tipCategory)).toBe(7_000n);
  });
});

const BRANCH_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Till {'
  + '   int public calls;'
  + '   receive() external payable { require(true); }'
  + '   function payIf(int amount) { this.calls = this.calls + 1; if (amount > 0) { this.transfer(msg.sender, amount); } }'
  + '   function payCapped(int amount) {'
  + '     require(amount < 50000);'
  + '     this.calls = this.calls + 1;'
  + '     if (amount > 0) { this.transfer(msg.sender, amount); }'
  + '   }'
  + '   function split(int first, int second) {'
  + '     this.calls = this.calls + 1;'
  + '     if (first > 0) { this.transfer(msg.sender, first); }'
  + '     this.transfer(msg.sender, second);'
  + '   }'
  + '   function payTo(bytes to, int amount) { this.calls = this.calls + 1; if (amount > 0) { this.transfer(to, amount); } }'
  + '   function payEither(bytes first, bytes second, int amount) {'
  + '     this.calls = this.calls + 1;'
  + '     if (amount > 100000) { this.transfer(first, amount); }'
  + '     this.transfer(second, amount);'
  + '   }'
  + ' }'
  + ' contract Vault {'
  + '   int public received;'
  + '   receive() external payable { this.received = this.received + msg.value; }'
  + ' }'
  + ' contract Jar {'
  + '   int public received;'
  + '   receive() external payable { this.received = this.received + msg.value; }'
  + ' }';

const branch = compileStringMulti(BRANCH_SOURCE, { composition: 'framed' });

/** The Till the branch cases share, and the Vault and the Jar deployed beside it. */
interface Branching {
  readonly deployed: Deployed;
  readonly vaultCategory: string;
  readonly jarCategory: string;
}

let branching: Promise<Branching> | undefined;

/** One Till serves every branch case: its one deposit covers their sends, 29,000 in all, and none reads its balance. */
function branchingTill(): Promise<Branching> {
  branching ??= (async (): Promise<Branching> => {
    const deployed = await deploy(branch.Till!);
    const vaultCategory = await deployBeside(deployed, branch.Vault!, '4c'.repeat(31) + 'b3');
    const jarCategory = await deployBeside(deployed, branch.Jar!, '4d'.repeat(31) + 'b2');
    // Each call is paid from the caller's largest coin, the last call's change, so one coin carries every case's fees.
    await deployed.provider.addUtxo(binToHex(deployed.callerLock), {
      txid: '46'.repeat(31) + 'c1', vout: 0, satoshis: 500_000n,
    });
    await sendFramedValue({ ...(await currentCaller(deployed)), value: 30_000n });
    return { deployed, vaultCategory, jarCategory };
  })();
  return branching;
}

describe('an entry that sends on a branch', () => {
  it('lists nothing when the branch with its only send is not taken', async () => {
    const { deployed } = await branchingTill();

    // A send on a branch taken is the control of the refusal case below.
    const skipped = await callFramedEntry({ ...(await currentCaller(deployed)), functionName: 'payIf', args: [0n] });
    expect(skipped.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(paidToCaller(skipped, deployed.callerLock)).toBe(0n);
    // No send, so no container is spent or kept.
    expect(containerValue(skipped, deployed.categoryId)).toBe(0n);
  });

  it('reports the body\'s own refusal when it stops before any send', async () => {
    const { deployed } = await branchingTill();

    const refused = await callFramedEntry({
      ...(await currentCaller(deployed)), functionName: 'payCapped', args: [60_000n],
    });
    expect(refused.accepted).toBe(false);
    expect(refused.broadcast).toBeUndefined();
    // The control: an amount the body admits is paid.
    const paid = await callFramedEntry({
      ...(await currentCaller(deployed)), functionName: 'payCapped', args: [9_000n],
    });
    expect(paid.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(paidToCaller(paid, deployed.callerLock)).toBe(9_000n);
  });

  it('lists the sends made in order when an earlier one is on a branch not taken', async () => {
    const { deployed } = await branchingTill();

    const one = await callFramedEntry({
      ...(await currentCaller(deployed)), functionName: 'split', args: [0n, 5_000n],
    });
    expect(one.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(paidToCaller(one, deployed.callerLock)).toBe(5_000n);

    const both = await callFramedEntry({
      ...(await currentCaller(deployed)), functionName: 'split', args: [3_000n, 4_000n],
    });
    expect(both.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(paidToCaller(both, deployed.callerLock)).toBe(7_000n);
  });

  it('runs no frame of a contract it pays on a branch not taken', async () => {
    const { deployed, vaultCategory } = await branchingTill();
    const externals = { Vault: { artifact: branch.Vault!, categoryId: vaultCategory } };
    const to = addressOf(branch.Vault!, vaultCategory);

    // A contract paid on a branch taken is paid as the unconditional case pays one.
    const skipped = await callFramedEntry({
      ...(await currentCaller(deployed)), functionName: 'payTo', args: [to, 0n], externals,
    });
    expect(skipped.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(skipped.completed.map((frame) => frame.functionName)).toStrictEqual(['Till.payTo()']);
    expect(containerValue(skipped, vaultCategory)).toBe(0n);
  });

  it('pays the contract whose call the body made when an earlier contract\'s is on a branch not taken', async () => {
    const { deployed, vaultCategory, jarCategory } = await branchingTill();

    const result = await callFramedEntry({
      ...(await currentCaller(deployed)),
      functionName: 'payEither',
      args: [addressOf(branch.Vault!, vaultCategory), addressOf(branch.Jar!, jarCategory), 8_000n],
      externals: {
        Vault: { artifact: branch.Vault!, categoryId: vaultCategory },
        Jar: { artifact: branch.Jar!, categoryId: jarCategory },
      },
    });
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual(['Jar.__receive()', 'Till.payEither()']);
    expect(containerValue(result, vaultCategory)).toBe(0n);
    expect(containerValue(result, jarCategory)).toBe(8_000n);

  });
});
