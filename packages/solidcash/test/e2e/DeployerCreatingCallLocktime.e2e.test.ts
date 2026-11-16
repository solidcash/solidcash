/**
 * A5, A14 item 7: one locktime for a creating call whose creator checks `tx.time` and whose child's constructor reads
 * a block field.
 *
 * A transaction has one locktime. The creator's `require(tx.time >= t)` needs at least t, of t's kind; a constructor
 * that reads `block.timestamp` needs a time, and one that reads `block.number` a height. The SDK sets the lowest value
 * that satisfies every input, and the constructor reads it. When one input needs a height and another a time, no value
 * does, and the SDK fails with `DeployerLocktimeConflictError`, which names both inputs. Each creation is checked with
 * stock libauth's standard VM, honest and with its locktime one lower.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, createVirtualMachineBch2026, decodeTransaction, encodeLockingBytecodeP2pkh, hexToBin,
  lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { SignatureTemplate } from '../../src/index.js';
import { DeployerLocktimeConflictError, StatefulContract } from '../../src/stateful/index.js';
import { clearGenesisReservations } from '../../src/stateful/genesis-reservations.js';
import { solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { compileStringMulti } from '../direct-compile.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Artifact } from '@solidcash/utils';
import type { Utxo } from '../../src/interfaces.js';

const vm = createVirtualMachineBch2026(true);
const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
const alice = new SignatureTemplate(alicePriv);

type Spend = { transaction: any; sourceOutputs: any[] };

/**
 * A factory whose `make(t)` checks `tx.time >= t` (a `make()` that checks nothing, when `checks` is false) and creates a
 * child whose constructor stores `block.<field>`.
 */
const source = (field: 'timestamp' | 'number', checks: boolean): string => `
  contract Child { int born; constructor() { born = block.${field}; } function read() { require(born > 0); } }
  contract Factory { int made;
    function make(${checks ? 'int t' : ''}) { ${checks ? 'require(tx.time >= t);' : ''} new Child(); made = made + 1; }
  }`;

async function factoryFor(field: 'timestamp' | 'number', checks = true): Promise<{
  provider: MockNetworkProvider; captured: Spend[]; artifacts: Record<string, Artifact>;
  make: (...args: bigint[]) => ReturnType<typeof StatefulContract.deployFrom>;
}> {
  clearGenesisReservations();
  const provider = new MockNetworkProvider({ profile: 'production' });
  const captured: Spend[] = [];
  const send = provider.sendRawTransaction.bind(provider);
  provider.sendRawTransaction = async (hex: string) => {
    const transaction = decodeTransaction(hexToBin(hex));
    if (typeof transaction === 'string') throw new Error(transaction);
    const sourceOutputs = await Promise.all(transaction.inputs.map(async (input) => {
      const spent = await provider.getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex);
      if (spent === undefined) throw new Error('a spent coin is not on the ledger');
      return solidCashOutputToLibauthOutput({
        to: spent.lockingBytecode, amount: spent.satoshis, ...(spent.token === undefined ? {} : { token: spent.token }),
      });
    }));
    const txid = await send(hex);
    captured.push({ transaction, sourceOutputs });
    return txid;
  };
  const change = lockingBytecodeToCashAddress({ bytecode: aliceLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const artifacts = compileStringMulti(source(field, checks), { allowUnsafeOperations: true } as never);
  const funding: Utxo = { txid: 'a1'.repeat(32), vout: 0, satoshis: 200_000n };
  await provider.seedUtxo(binToHex(aliceLock), funding);
  // The child's code reads the oracle pool in its constructor arm, so its lock commits to a pool binding, and its
  // creator passes its own: the factory takes `__oraclePool`. Neither reads a pool coin.
  const deployed = await StatefulContract.deploy(artifacts.Factory, [], {
    provider, fundingUtxo: funding, funder: alice.unlockP2PKH(), initialState: { made: 0n },
    changeAddress: change.address, senderLockingBytecode: aliceLock, oraclePool: 'cc'.repeat(32),
  } as never);
  const prep: Utxo = { txid: 'a2'.repeat(32), vout: 0, satoshis: 400_000n };
  await provider.seedUtxo(binToHex(aliceLock), prep);
  const make = (...args: bigint[]): ReturnType<typeof StatefulContract.deployFrom> => StatefulContract.deployFrom({
    provider, factory: deployed.contract, deployFunctionName: 'make', deployFunctionArgs: args,
    childArtifact: artifacts.Child, fundingUtxo: prep, funder: alice.unlockP2PKH(), changeAddress: change.address,
  });
  return { provider, captured, artifacts, make };
}

/** The creation with another locktime, the wallet's inputs signed again over it. */
function withLocktime(spend: Spend, locktime: number): Spend {
  const copy: Spend = structuredClone(spend);
  copy.transaction.locktime = locktime;
  copy.transaction.inputs.forEach((_input: unknown, inputIndex: number) => {
    if (binToHex(copy.sourceOutputs[inputIndex].lockingBytecode) !== binToHex(aliceLock)) return;
    copy.transaction.inputs[inputIndex].unlockingBytecode = alice.unlockP2PKH().generateUnlockingBytecode({
      transaction: copy.transaction, sourceOutputs: copy.sourceOutputs, inputIndex,
    });
  });
  return copy;
}

const passes = (spend: Spend, inputIndex: number): boolean => vm.stateSuccess(
  vm.evaluate({ ...structuredClone(spend), inputIndex } as never),
) === true;

describe('A5, A14 item 7: the locktime of a creating call', () => {
  it('meets a creator\'s tx.time check and a constructor\'s block.timestamp with one value', async () => {
    const { provider, captured, artifacts, make } = await factoryFor('timestamp');
    const t = BigInt(await provider.getMedianTimePast() - 1000);
    const result = await make(t);
    const creation = captured[captured.length - 1]!;
    // The lowest value that satisfies both: the creator's bound, which is a time, as the constructor needs.
    expect(creation.transaction.locktime).toBe(Number(t));
    expect(((await result.child.getState()) as { born?: bigint }).born).toBe(t);
    expect(((await result.factory.getState()) as { made?: bigint }).made).toBe(1n);
    expect(vm.verify(creation as never)).toBe(true);

    // One lower: the creator's check fails, and the constructor would read another value than its record holds.
    const lower = withLocktime(creation, Number(t) - 1);
    expect(vm.verify(lower as never)).not.toBe(true);
    expect(passes(lower, 0)).toBe(false);
    const deployerInput = creation.sourceOutputs.findIndex((output: any) => binToHex(output.lockingBytecode)
      === artifacts.Factory.childDeployers!.Child!.lockingBytecode);
    expect(passes(lower, deployerInput)).toBe(false);
    expect(passes(withLocktime(creation, Number(t)), deployerInput)).toBe(true);
  }, 600_000);

  it('meets a creator\'s height check and a constructor\'s block.number with one value', async () => {
    const { provider, captured, make } = await factoryFor('number');
    const t = BigInt(await provider.getBlockHeight() - 10);
    const result = await make(t);
    const creation = captured[captured.length - 1]!;
    expect(creation.transaction.locktime).toBe(Number(t));
    expect(((await result.child.getState()) as { born?: bigint }).born).toBe(t);
    expect(vm.verify(creation as never)).toBe(true);
    expect(passes(withLocktime(creation, Number(t) - 1), 0)).toBe(false);
  }, 600_000);

  it('sets item 7\'s locktime when only the constructor constrains it: the median time past minus 1', async () => {
    const { provider, captured, make } = await factoryFor('timestamp', false);
    const result = await make();
    const creation = captured[captured.length - 1]!;
    const mtp = await provider.getMedianTimePast();
    expect(creation.transaction.locktime).toBe(mtp - 1);
    expect(((await result.child.getState()) as { born?: bigint }).born).toBe(BigInt(mtp - 1));
    expect(vm.verify(creation as never)).toBe(true);
  }, 600_000);

  it('refuses a height check beside block.timestamp, and a time check beside block.number, naming both inputs', async () => {
    const timestamp = await factoryFor('timestamp');
    const refusal = await timestamp.make(1_000n).then(() => undefined, (error: unknown) => error);
    expect(refusal).toBeInstanceOf(DeployerLocktimeConflictError);
    const { first, second } = refusal as DeployerLocktimeConflictError;
    expect([first.kind, second.kind].sort()).toEqual(['height', 'time']);
    expect([first.inputIndex, second.inputIndex]).toContain(0);
    expect((refusal as Error).message).toMatch(/'Child'.*block\.timestamp/);
    expect((refusal as Error).message).toMatch(/'Factory'.*tx\.time >= 1000/);
    expect(timestamp.captured).toHaveLength(1);

    const number = await factoryFor('number');
    await expect(number.make(1_700_000_000n)).rejects.toThrow(DeployerLocktimeConflictError);
    expect(number.captured).toHaveLength(1);
  }, 600_000);
});
