import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { buildPushdataCommitment, bytesToHex, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { satoshiContainerLockingBytecode } from '../../../src/per-call/deploy/index.js';
import {
  PerCallCallError, callPerCallEntry, sendPerCallValue, type PerCallCallResult,
} from '../../../src/per-call/call/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * Value carried by a call into a deployed per-call contract (spec 4b), through the shipped path.
 *
 * A value send runs the contract's `receive()`, and a call to a payable entry carries value the same way: the caller
 * pays it into a satoshi container of the contract, and the entry reads it as `msg.value`. The SDK refuses by name
 * what the EVM would revert: value for an entry that is not payable, and a value send to a contract with no
 * `receive()`.
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
