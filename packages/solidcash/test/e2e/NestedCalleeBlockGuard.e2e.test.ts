/**
 * A called contract's own call under a guard on the block, on the direct convention (A calls D, which calls T when its
 * guard holds). D's run reads block.number and block.timestamp from the info coin of its oracle pool, and the SDK
 * decides from that coin whether D's call is made: a false guard leaves T unspent and its state as it was, a true one
 * calls T. A guard on D's own state is the contrast; there, as under a false guard on the block, D's one call is skipped
 * and stated as not made. The arguments of D's call read the block from the same coin. A `require` on the block before
 * D's call that fails is refused by the VM, as an EVM revert would be. Each sent transaction is checked by the VM.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import { decodePoolInfoCommitment, type Artifact } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { SignatureTemplate, Signer } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { isPoolInfoOutput } from '../../src/oracle/pool/index.js';
import { addressToLockScript, solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';
import type { DeployResult } from '../../src/stateful/stateful-lifecycle-types.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const SOURCE = `pragma solidcash ^0.53.0;
  interface IT { function set(int h, int c) external; }
  interface ID {
    function byHeight(IT t, int atLeast) external;
    function byTime(IT t, int atLeast) external;
    function byState(IT t, int atLeast) external;
    function stamp(IT t) external;
    function requireHeight(IT t, int atLeast) external;
  }
  contract T { int height; int clock; int calls;
    function set(int h, int c) external { height = h; clock = c; calls = calls + 1; } }
  contract D { int runs;
    function byHeight(IT t, int atLeast) external { if (int(block.number) >= atLeast) { t.set(1, 1); } runs = runs + 1; }
    function byTime(IT t, int atLeast) external { if (int(block.timestamp) >= atLeast) { t.set(2, 2); } runs = runs + 1; }
    function byState(IT t, int atLeast) external { if (runs >= atLeast) { t.set(3, 3); } runs = runs + 1; }
    function stamp(IT t) external { t.set(int(block.number) + 1, int(block.timestamp) + 1); runs = runs + 1; }
    function requireHeight(IT t, int atLeast) external { require(int(block.number) >= atLeast); t.set(6, 6); runs = runs + 1; } }
  contract A { int runs;
    function byHeight(ID d, IT t, int atLeast) external { d.byHeight(t, atLeast); runs = runs + 1; }
    function byTime(ID d, IT t, int atLeast) external { d.byTime(t, atLeast); runs = runs + 1; }
    function byState(ID d, IT t, int atLeast) external { d.byState(t, atLeast); runs = runs + 1; }
    function stamp(ID d, IT t) external { d.stamp(t); runs = runs + 1; }
    function requireHeight(ID d, IT t, int atLeast) external { d.requireHeight(t, atLeast); runs = runs + 1; } }`;

const compileOptions = (primary: string): never => ({
  deployer: true, genesisCalls: true, primaryContractName: primary,
}) as never;

// Floors no mock block reaches: a height of a billion, and a time in the year 2286.
const HEIGHT_OUT_OF_REACH = 1_000_000_000n;
const TIME_OUT_OF_REACH = 10_000_000_000n;

let serial = 0x6a00;
const nextTxid = (): string => (serial++).toString(16).padStart(64, '0');

type Sent = { transaction: ReturnType<typeof decodeTransactionUnsafe>; sourceOutputs: any[] };
type TState = { height?: bigint; clock?: bigint; calls?: bigint };

interface Chain {
  provider: MockNetworkProvider;
  t: DeployResult<Artifact>;
  d: DeployResult<Artifact>;
  a: DeployResult<Artifact>;
  /** A's function `name` on D and T, sent by a wallet. */
  send(name: string, ...args: bigint[]): Promise<Sent>;
  /** How many transactions the builder has handed to the chain. */
  sentCount(): number;
  tState(): Promise<Required<TState>>;
  runs(deployed: DeployResult<Artifact>): Promise<bigint>;
  tLock: Uint8Array;
  dLock: Uint8Array;
}

async function chain(): Promise<Chain> {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
  const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
  const sent: Sent[] = [];
  const original = provider.sendRawTransaction.bind(provider);
  (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
    const transaction = decodeTransactionUnsafe(hexToBin(hex));
    const sourceOutputs = await Promise.all(transaction.inputs.map(async (input) => {
      const spent = await provider.getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex);
      if (spent === undefined) throw new Error('an input of the transaction is not on the ledger');
      return solidCashOutputToLibauthOutput({
        to: spent.lockingBytecode, amount: spent.satoshis, ...(spent.token === undefined ? {} : { token: spent.token }),
      });
    }));
    sent.push({ transaction, sourceOutputs });
    return original(hex);
  };
  const deploy = async (primary: string): Promise<DeployResult<Artifact>> => {
    const fundingUtxo: Utxo = { txid: nextTxid(), vout: 0, satoshis: 2_000_000n };
    await provider.seedUtxo(binToHex(authorLock), fundingUtxo);
    return StatefulContract.deploy(compileString(SOURCE, compileOptions(primary)), [] as never, {
      provider, fundingUtxo, funder, changeAddress: change.address, senderLockingBytecode: authorLock,
    } as never);
  };
  const t = await deploy('T');
  const d = await deploy('D');
  const a = await deploy('A');
  const wallet = new Signer(alicePriv, provider);
  for (let coin = 0; coin < 12; coin += 1) {
    await provider.seedUtxo(wallet.getAddress(), { txid: nextTxid(), vout: 0, satoshis: 200_000n });
  }
  const tLock = addressToLockScript(t.contract.address);
  const dLock = addressToLockScript(d.contract.address);
  // D names T under the interface it calls it through.
  (d.contract as unknown as { _registerResolvedExternal(name: string, contract: unknown): void })
    ._registerResolvedExternal('IT', t.contract);
  const send = async (name: string, ...args: bigint[]): Promise<Sent> => {
    const call = (a.contract.connect(wallet) as any).call[name](dLock, tLock, ...args).withExternalCall(d.contract);
    await call.send().catch((error: Error) => {
      throw new Error(`A.${name}(${args.join(', ')}) was not sent: ${error.message}`);
    });
    const last = sent[sent.length - 1]!;
    expect(createVirtualMachineBch2026ForProvider(provider).verify(last as never)).toBe(true);
    // The call itself: A's call of D spends D.
    expect(spends(last, dLock)).toBe(true);
    return last;
  };
  const tState = async (): Promise<Required<TState>> => {
    const state = (await t.contract.getState()) as TState;
    return { height: state.height ?? 0n, clock: state.clock ?? 0n, calls: state.calls ?? 0n };
  };
  const runs = async (deployed: DeployResult<Artifact>): Promise<bigint> => (
    ((await deployed.contract.getState()) as { runs?: bigint }).runs ?? 0n);
  return { provider, t, d, a, send, sentCount: () => sent.length, tState, runs, tLock, dLock };
}

const same = (left: Uint8Array, right: Uint8Array): boolean => binToHex(left) === binToHex(right);
const spends = (sent: Sent, lock: Uint8Array): boolean => sent.sourceOutputs
  .some((output) => same(output.lockingBytecode, lock));

/** The block fields of the one pool info coin `sent` co-spends. */
function infoCoinFields(sent: Sent, pool: string): { number: bigint; timestamp: bigint } {
  const coins = sent.sourceOutputs.filter((output) => isPoolInfoOutput(output, pool));
  expect(coins).toHaveLength(1);
  return decodePoolInfoCommitment(coins[0]!.token.nft.commitment);
}

const poolOf = (deployed: DeployResult<Artifact>): string => (
  deployed.contract.inner as unknown as { oraclePool: string }).oraclePool;

describe('a called contract\'s call under a guard on the block, on the direct convention (A calls D, which calls T when '
  + 'its guard holds)', () => {
  it('leaves T unspent and as it was when D\'s guard on block.number is false, and calls T when it is true', async () => {
    const c = await chain();
    const pool = poolOf(c.d);

    // The guard is false: D runs without its call, so T keeps its state and its coin.
    const unmet = await c.send('byHeight', HEIGHT_OUT_OF_REACH);
    expect(await c.tState()).toEqual({ height: 0n, clock: 0n, calls: 0n });
    expect(spends(unmet, c.tLock)).toBe(false);
    expect(infoCoinFields(unmet, pool).number).toBeLessThan(HEIGHT_OUT_OF_REACH);
    expect(await c.runs(c.d)).toBe(1n);
    expect(await c.runs(c.a)).toBe(1n);

    const met = await c.send('byHeight', 0n);
    expect(spends(met, c.tLock)).toBe(true);
    expect(await c.tState()).toEqual({ height: 1n, clock: 1n, calls: 1n });
    expect(await c.runs(c.d)).toBe(2n);
    expect(await c.runs(c.a)).toBe(2n);
  });

  it('leaves T unspent and as it was when D\'s guard on block.timestamp is false, and calls T when it is true',
    async () => {
      const c = await chain();
      const pool = poolOf(c.d);

      const unmet = await c.send('byTime', TIME_OUT_OF_REACH);
      expect(await c.tState()).toEqual({ height: 0n, clock: 0n, calls: 0n });
      expect(spends(unmet, c.tLock)).toBe(false);
      expect(infoCoinFields(unmet, pool).timestamp).toBeLessThan(TIME_OUT_OF_REACH);
      expect(await c.runs(c.d)).toBe(1n);

      const met = await c.send('byTime', 0n);
      expect(spends(met, c.tLock)).toBe(true);
      expect(await c.tState()).toEqual({ height: 2n, clock: 2n, calls: 1n });
      expect(await c.runs(c.d)).toBe(2n);
    });

  it('leaves T unspent when D\'s guard on its own state is false, and calls T when it is true', async () => {
    const c = await chain();

    const unmet = await c.send('byState', 5n);
    expect(await c.tState()).toEqual({ height: 0n, clock: 0n, calls: 0n });
    expect(spends(unmet, c.tLock)).toBe(false);
    expect(await c.runs(c.d)).toBe(1n);

    const met = await c.send('byState', 1n);
    expect(spends(met, c.tLock)).toBe(true);
    expect(await c.tState()).toEqual({ height: 3n, clock: 3n, calls: 1n });
    expect(await c.runs(c.d)).toBe(2n);
  });

  it('passes T the block.number and block.timestamp D reads, from the info coin D\'s run slices', async () => {
    const c = await chain();
    const sent = await c.send('stamp');
    const fields = infoCoinFields(sent, poolOf(c.d));
    expect(await c.tState()).toEqual({ height: fields.number + 1n, clock: fields.timestamp + 1n, calls: 1n });
    expect(spends(sent, c.tLock)).toBe(true);
    expect(await c.runs(c.d)).toBe(1n);
  });

  it('is refused by the VM, as an EVM revert would be, when D requires a height not reached before its call, and '
    + 'calls T when the height is reached', async () => {
    const c = await chain();
    const before = c.sentCount();

    // D's require fails: its run does not settle, so nothing lands, T's call included.
    const refusal = await c.send('requireHeight', HEIGHT_OUT_OF_REACH).then(() => undefined, (error: unknown) => error);
    expect((refusal as Error | undefined)?.message).toMatch(/^A\.requireHeight\(\d+\) was not sent: .*OP_VERIFY/s);
    expect(c.sentCount()).toBe(before);
    expect(await c.tState()).toEqual({ height: 0n, clock: 0n, calls: 0n });
    expect(await c.runs(c.d)).toBe(0n);
    expect(await c.runs(c.a)).toBe(0n);

    const met = await c.send('requireHeight', 0n);
    expect(spends(met, c.tLock)).toBe(true);
    expect(await c.tState()).toEqual({ height: 6n, clock: 6n, calls: 1n });
    expect(await c.runs(c.d)).toBe(1n);
  });
});
