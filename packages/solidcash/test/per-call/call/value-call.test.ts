import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { buildPushdataCommitment, bytesToHex, type Artifact } from '@solidcash/utils';
import { perCallValidator } from 'solidc';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import {
  deployMaster, satoshiContainerLockingBytecode, stateRecordLockingBytecode,
} from '../../../src/per-call/deploy/index.js';
import {
  PerCallCallError, callPerCallEntry, sendPerCallValue, type PerCallCallResult,
} from '../../../src/per-call/call/index.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * Value carried by a call into a deployed per-call contract (spec 4b), through the shipped path.
 *
 * A value send runs the contract's `receive()`, and a call to a payable entry carries value the same way: the caller
 * pays it into a satoshi container of the contract, and the entry reads it as `msg.value`. The SDK refuses by name
 * what the EVM would revert: value for an entry that is not payable, and a value send to a contract with neither a
 * `receive()` nor a payable `fallback()`.
 */

const CATEGORY_HEX = '35'.repeat(32);
const CALLER_TXID = '46'.repeat(32);
const AMOUNT = 10_000n;

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Vault {'
  + '   int public received;'
  + '   receive() external payable { this.received = this.received + msg.value; }'
  + '   function deposit() payable { this.received = this.received + msg.value; }'
  + '   function touch(int by) { this.received = this.received + by; }'
  + ' }';

const PLAIN_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Plain {'
  + '   int public count;'
  + '   function touch(int by) { this.count = this.count + by; }'
  + ' }';

const vault = compileStringMulti(SOURCE, { composition: 'per-call' }).Vault!;
const plain = compileStringMulti(PLAIN_SOURCE, { composition: 'per-call' }).Plain!;

interface Deployed {
  readonly artifact: Artifact;
  readonly provider: MockNetworkProvider;
  readonly categoryId: string;
  readonly callerUtxo: { txid: string; vout: number; satoshis: bigint };
  readonly callerLock: Uint8Array;
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
}

/** Deploys the contract through the shipped deployment and funds the caller's own coin at its P2PKH lock. */
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
  return {
    artifact, provider, categoryId: deployment.categoryId, callerUtxo, callerLock, funder: signature.unlockP2PKH(),
  };
}

/** The call's options, less the entry and the value. */
function callerOf(deployed: Deployed): Parameters<typeof sendPerCallValue>[0] {
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

/** The value the broadcast pays into the contract's containers. */
function containerValue(result: PerCallCallResult, categoryId: string): bigint {
  const lock = binToHex(satoshiContainerLockingBytecode(categoryId));
  return (result.broadcast?.outputs ?? [])
    .filter((output) => binToHex(output.lockingBytecode) === lock)
    .reduce((sum, output) => sum + output.valueSatoshis, 0n);
}

/** The record commitment the shipped encoder materializes for one balance. */
function received(value: bigint): string {
  return buildPushdataCommitment(vault.stateLayout!, { received: value }, 0);
}

describe('a value send to a deployed per-call contract', () => {
  it('runs receive() with the value, paid into a container of the contract', async () => {
    const deployed = await deploy(vault);
    const result = await sendPerCallValue({ ...callerOf(deployed), value: AMOUNT });

    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual(['Vault.__receive()']);
    expect(bytesToHex(result.writtenCommitments[0]!)).toBe(received(AMOUNT));
    expect(containerValue(result, deployed.categoryId)).toBe(AMOUNT);
  });

  it('is refused by name for a contract with no receive()', async () => {
    const deployed = await deploy(plain);
    await expect(sendPerCallValue({ ...callerOf(deployed), value: AMOUNT }))
      .rejects.toThrow(/contract "Plain" has no receive\(\)/);
  });
});

describe('a call to a payable entry carrying value', () => {
  it('reads the value as msg.value, paid into a container of the contract', async () => {
    const deployed = await deploy(vault);
    const result = await callPerCallEntry({ ...callerOf(deployed), functionName: 'deposit', value: AMOUNT });

    expect(result.accepted).toBe(true);
    expect(bytesToHex(result.writtenCommitments[0]!)).toBe(received(AMOUNT));
    expect(containerValue(result, deployed.categoryId)).toBe(AMOUNT);
  });

  it('is refused by name for an entry that is not payable', async () => {
    const deployed = await deploy(vault);
    await expect(callPerCallEntry({ ...callerOf(deployed), functionName: 'touch', args: [1n], value: AMOUNT }))
      .rejects.toThrow(PerCallCallError);
    await expect(callPerCallEntry({ ...callerOf(deployed), functionName: 'touch', args: [1n], value: AMOUNT }))
      .rejects.toThrow(/entry "touch" is not payable/);
    // The control: the same entry without value is served.
    const plainCall = await callPerCallEntry({ ...callerOf(deployed), functionName: 'touch', args: [1n] });
    expect(plainCall.accepted).toBe(true);
  });
});

const WALLET_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Wallet {'
  + '   int public paid;'
  + '   receive() external payable { require(true); }'
  + '   function withdraw(int amount) { this.paid = this.paid + amount; this.transfer(msg.sender, amount); }'
  + '   function forward() payable { this.paid = this.paid + msg.value; this.transfer(msg.sender, msg.value); }'
  + ' }';

const wallet = compileStringMulti(WALLET_SOURCE, { composition: 'per-call' }).Wallet!;

/** The caller's options with its current coin: the largest tokenless UTXO at its lock, the last call's change. */
async function currentCaller(deployed: Deployed): Promise<Parameters<typeof sendPerCallValue>[0]> {
  const coins = (await deployed.provider.getUtxosForLockingBytecode(deployed.callerLock))
    .filter((utxo) => utxo.token === undefined)
    .sort((left, right) => (left.satoshis > right.satoshis ? -1 : 1));
  return { ...callerOf(deployed), callerUtxo: coins[0]! };
}

/** The value the broadcast pays to the caller's own lock outside its change, which is the last output. */
function paidToCaller(result: PerCallCallResult, callerLock: Uint8Array): bigint {
  const outputs = result.broadcast?.outputs ?? [];
  return outputs.slice(0, -1)
    .filter((output) => binToHex(output.lockingBytecode) === binToHex(callerLock))
    .reduce((sum, output) => sum + output.valueSatoshis, 0n);
}

describe('an entry that sends, paid from the contract\'s containers', () => {
  it('withdraws what a deposit put in, and keeps the change in a container', async () => {
    const deployed = await deploy(wallet);
    const deposit = await sendPerCallValue({ ...(await currentCaller(deployed)), value: 20_000n });
    expect(deposit.accepted).toBe(true);

    const withdrawal = await callPerCallEntry({
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
    const deployed = await deploy(wallet);
    await sendPerCallValue({ ...(await currentCaller(deployed)), value: 5_000n });
    await expect(callPerCallEntry({ ...(await currentCaller(deployed)), functionName: 'withdraw', args: [10_000n] }))
      .rejects.toThrow(/contract "Wallet" holds 5000 satoshis in its containers, and entry "withdraw" sends 10000 more/);
  });

  it('forwards the value a payable entry receives without touching the containers', async () => {
    const deployed = await deploy(wallet);
    const forward = await callPerCallEntry({
      ...(await currentCaller(deployed)), functionName: 'forward', value: 7_000n,
    });
    expect(forward.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(paidToCaller(forward, deployed.callerLock)).toBe(7_000n);
  });
});

const PAYMENTS_SOURCE = 'pragma solidcash ^0.13.0;'
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

const payments = compileStringMulti(PAYMENTS_SOURCE, { composition: 'per-call' });

/** Deploys a second contract on a deployment's provider, funded from the same wallet. */
async function deployBeside(deployed: Deployed, artifact: Artifact, fundingTxid: string): Promise<string> {
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider: deployed.provider });
  const fundingUtxo = { txid: fundingTxid, vout: 0, satoshis: 500_000n };
  await deployed.provider.addUtxo(funder.address, fundingUtxo);
  const deployment = await deployStatefulContract(artifact, [], {
    provider: deployed.provider,
    fundingUtxo,
    funder: funder.unlock.spend(alicePub, signature),
    changeAddress: funder.address,
  });
  return deployment.categoryId;
}

/** A contract's address: the validator address its category derives. */
function addressOf(artifact: Artifact, categoryId: string): Uint8Array {
  return deployMaster(artifact, hexToBin(categoryId), perCallValidator.buildValidatorProgram()).address;
}

describe('an entry that pays a contract through its receive()', () => {
  it('runs the recipient\'s receive() with the value, paid from the payer\'s containers', async () => {
    const deployed = await deploy(payments.Payer!);
    const vaultCategory = await deployBeside(deployed, payments.Vault!, '47'.repeat(32));
    await sendPerCallValue({ ...(await currentCaller(deployed)), value: 20_000n });

    const result = await callPerCallEntry({
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

  it('is refused by name when the recipient has no receive()', async () => {
    const deployed = await deploy(payments.Payer!);
    const closedCategory = await deployBeside(deployed, payments.Closed!, '48'.repeat(32));
    await sendPerCallValue({ ...(await currentCaller(deployed)), value: 20_000n });
    await expect(callPerCallEntry({
      ...(await currentCaller(deployed)),
      functionName: 'pay',
      args: [addressOf(payments.Closed!, closedCategory), 7_000n],
      externals: { Closed: { artifact: payments.Closed!, categoryId: closedCategory } },
    })).rejects.toThrow(/contract "Closed" has no receive\(\), so the value entry "pay" sends it has no body to run/);
  });

  it('is refused by name when the recipient is not among the externals', async () => {
    const deployed = await deploy(payments.Payer!);
    const vaultCategory = await deployBeside(deployed, payments.Vault!, '49'.repeat(32));
    await expect(callPerCallEntry({
      ...(await currentCaller(deployed)),
      functionName: 'pay',
      args: [addressOf(payments.Vault!, vaultCategory), 7_000n],
    })).rejects.toThrow(/entry "pay" sends to the contract at [0-9a-f]+, which the call's externals do not name/);
  });
});

const TILL_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Till {'
  + '   int public emptied;'
  + '   receive() external payable { require(true); }'
  + '   function holding() view returns (int) { return address(this).balance; }'
  + '   function empty() { this.emptied = this.emptied + 1; this.transfer(msg.sender, address(this).balance); }'
  + ' }';

const till = compileStringMulti(TILL_SOURCE, { composition: 'per-call' }).Till!;

describe('an entry that reads its own balance', () => {
  it('reads every container the contract holds, and pays all of it out', async () => {
    const deployed = await deploy(till);
    await sendPerCallValue({ ...(await currentCaller(deployed)), value: 20_000n });
    await sendPerCallValue({ ...(await currentCaller(deployed)), value: 5_000n });

    const read = await readPerCallEntry({
      provider: deployed.provider, artifact: till, categoryId: deployed.categoryId, functionName: 'holding',
      vm: compositionMachine(),
    });
    expect(read.accepted).toBe(true);
    expect(read.value).toBe(25_000n);

    const emptied = await callPerCallEntry({ ...(await currentCaller(deployed)), functionName: 'empty' });
    expect(emptied.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(paidToCaller(emptied, deployed.callerLock)).toBe(25_000n);
    // Both containers are spent; the one the send follows keeps only what the caller put in to stand it up.
    expect(containerValue(emptied, deployed.categoryId)).toBe(1_000n);
  });
});

const FALLBACK_SOURCE = 'pragma solidcash ^0.13.0;'
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

const fallbacks = compileStringMulti(FALLBACK_SOURCE, { composition: 'per-call' });

describe('a value send to a contract whose fallback() takes it', () => {
  it('runs a payable fallback() when the contract has no receive(), as the EVM picks the body', async () => {
    const deployed = await deploy(fallbacks.Tip!);
    const result = await sendPerCallValue({ ...callerOf(deployed), value: AMOUNT });

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
    await expect(sendPerCallValue({ ...callerOf(deployed), value: AMOUNT })).rejects.toThrow(refusal);
  });

  it('runs the recipient\'s payable fallback() for an entry that pays it', async () => {
    const deployed = await deploy(fallbacks.Payer!);
    const tipCategory = await deployBeside(deployed, fallbacks.Tip!, '4a'.repeat(32));
    await sendPerCallValue({ ...(await currentCaller(deployed)), value: 20_000n });

    const result = await callPerCallEntry({
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
