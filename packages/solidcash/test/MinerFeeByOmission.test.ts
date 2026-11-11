/**
 * `this.payMinerFee`: a contract's satoshi container pays the miner by omission. A production-profile mock behaves as
 * a real node, so nothing here is funded by a coin the SDK made up.
 */
import { decodeTransaction, encodeDataPush, encodeTransaction, hexToBin, binToHex, hash256 } from '@bitauth/libauth';
import { buildSatoshiContainerCovenantScript, fillerLockingBytecode, scriptToBytecode } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';
import MockNetworkProvider, { MOCK_PRODUCTION_LIMITS } from '../src/network/MockNetworkProvider.js';
import { StatefulContract } from '../src/stateful/index.js';
import { addressToLockScript } from '../src/utils.js';
import Signer from '../src/Signer.js';
import { alicePriv } from './fixture/vars.js';

const PAY = 100_000n;
const FEE = 30_000n;
const SOURCE = `pragma solidcash ^0.14.0;
contract Tip() {
  int constant PAY = 100000;
  int constant FEE = 30000;
  uint32 n;
  constructor() { this.n = 0; }
  function deposit() public payable { require(msg.value == PAY + FEE, "value"); this.n = this.n + 1; }
  function take(address to) public { this.n = this.n + 1; this.transfer(to, PAY); this.payMinerFee(FEE); }
}`;

const hex = (bytes: Uint8Array): string => binToHex(bytes);
const same = (left: Uint8Array, right: Uint8Array): boolean => hex(left) === hex(right);

async function setup(deposits: number, source = SOURCE, fee = FEE) {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const [alice, bob, thief] = await provider.getSigners(3, { fundingUtxos: 8, genesisFundingUtxos: 2 });
  const fundingUtxo = (await alice.getUtxos()).find((utxo) => utxo.vout === 0 && !utxo.token && utxo.satoshis >= 200_000n)!;
  const { contract } = await StatefulContract.deploy(compileString(source) as never, [], {
    provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(),
  });
  const pool = contract as any;
  const containerLock = addressToLockScript(pool.satoshiContainer.address);
  for (let index = 0; index < deposits; index += 1) {
    await pool.connect(alice).call.deposit().withValue(PAY + fee).send();
  }
  return { provider, alice, bob, thief, pool, containerLock };
}

type Context = Awaited<ReturnType<typeof setup>>;

/** Sends `take` through the SDK, mutating the transaction it would broadcast. The verdict is the node's own. */
async function takeMutated(context: Context, mutate: (transaction: any) => Promise<void> | void): Promise<string> {
  const { provider, pool, bob } = context;
  const broadcast = provider.sendRawTransaction.bind(provider);
  let verdict = 'not broadcast';
  provider.sendRawTransaction = async (raw: string) => {
    provider.sendRawTransaction = broadcast;
    const transaction = decodeTransaction(hexToBin(raw));
    await mutate(transaction);
    try {
      const txid = await broadcast(binToHex(encodeTransaction(transaction as never)));
      verdict = 'accepted';
      return txid;
    } catch (error) {
      verdict = String((error as Error).message);
      throw error;
    }
  };
  await pool.call.take(bob.getAddress()).send().catch(() => undefined);
  provider.sendRawTransaction = broadcast;
  return verdict;
}

describe('fee by omission', () => {
  it('takes no funder and no change: the delta is what no output claims', async () => {
    const context = await setup(1);
    const { provider, pool, bob, containerLock } = context;
    const details = await pool.call.take(bob.getAddress()).send();
    const transaction = decodeTransaction(hexToBin(details.hex)) as any;
    expect(transaction.inputs).toHaveLength(3);
    expect(transaction.outputs.filter((output: any) => same(output.lockingBytecode, containerLock))).toHaveLength(0);
    expect(transaction.outputs.some((output: any) => output.valueSatoshis === PAY
      && same(output.lockingBytecode, bob.getLockingBytecode()))).toBe(true);
    const held = await provider.getUtxos(pool.satoshiContainer.address);
    expect(held).toHaveLength(0);
  });

  it('accepts the unmodified transaction through the same path as the attacks below', async () => {
    const context = await setup(2);
    expect(await takeMutated(context, () => undefined)).toBe('accepted');
  });

  describe('with a coin large enough to keep a balance', () => {
    const LARGE = 1_000_000n;
    const withLargeCoin = async (): Promise<Context> => {
      const context = await setup(0);
      await context.provider.seedUtxo(context.pool.satoshiContainer.address, {
        txid: 'cd'.repeat(32), vout: 0, satoshis: LARGE,
      });
      return context;
    };
    const keptOutput = (context: Context, transaction: any): any => transaction.outputs
      .find((output: any) => same(output.lockingBytecode, context.containerLock));

    it('keeps exactly what the sends and the fee leave', async () => {
      const context = await withLargeCoin();
      expect(await takeMutated(context, (transaction) => {
        expect(keptOutput(context, transaction).valueSatoshis).toBe(LARGE - PAY - FEE);
      })).toBe('accepted');
      expect(await context.pool.satoshiContainer.getBalance()).toBe(LARGE - PAY - FEE);
    });

    it('refuses one satoshi more than the source names', async () => {
      const context = await withLargeCoin();
      const verdict = await takeMutated(context, (transaction) => {
        keptOutput(context, transaction).valueSatoshis -= 1n;
      });
      expect(verdict).toMatch(/OP_VERIFY/);
      expect(await context.pool.satoshiContainer.getBalance()).toBe(LARGE);
    });
  });

  it('refuses a second container coin spent past the sends and the fee', async () => {
    const context = await setup(2);
    const { provider, pool, thief, containerLock } = context;
    const verdict = await takeMutated(context, async (transaction) => {
      const spent = transaction.inputs.map((input: any) => `${hex(input.outpointTransactionHash)}:${input.outpointIndex}`);
      const coins = await provider.getUtxos(pool.satoshiContainer.address);
      const other = coins.find((coin) => !spent.includes(`${coin.txid}:${coin.vout}`))!;
      const master = await provider.getLedgerOutput(hex(transaction.inputs[0].outpointTransactionHash), 0);
      const redeem = scriptToBytecode(buildSatoshiContainerCovenantScript(hexToBin(pool.categoryId), master!.lockingBytecode));
      expect(same(Uint8Array.from([0xaa, 0x20, ...hash256(redeem), 0x87]), containerLock)).toBe(true);
      const index = transaction.inputs.length;
      transaction.inputs.push({
        outpointTransactionHash: hexToBin(other.txid), outpointIndex: other.vout, sequenceNumber: 0xffffffff,
        unlockingBytecode: Uint8Array.from([0x00, 0x51, ...encodeDataPush(redeem)]),
      });
      transaction.outputs.splice(index, 0, { lockingBytecode: fillerLockingBytecode(), valueSatoshis: 576n });
      transaction.outputs.push({ lockingBytecode: thief.getLockingBytecode(), valueSatoshis: other.satoshis - 40_000n });
    });
    expect(verdict).toMatch(/OP_VERIFY/);
    expect(await pool.satoshiContainer.getBalance()).toBe(2n * (PAY + FEE));
  });

  it('gets no help when the delta cannot pay for the transaction', async () => {
    const tiny = 2_000n;
    const source = SOURCE.replace('int constant FEE = 30000;', `int constant FEE = ${tiny};`);
    expect(source).not.toBe(SOURCE);
    const { pool, bob } = await setup(1, source, tiny);
    await expect(pool.call.take(bob.getAddress()).send()).rejects.toThrow();
    expect(await pool.satoshiContainer.getBalance()).toBe(PAY + tiny);
  });
});

describe('.withValue on a payable entry that spends no container', () => {
  it('pays the container: the value is a new coin, and msg.value counts it', async () => {
    const { pool } = await setup(2);
    const coins = await pool.provider.getUtxos(pool.satoshiContainer.address);
    expect(coins.map((coin: { satoshis: bigint }) => coin.satoshis)).toEqual([PAY + FEE, PAY + FEE]);
  });

  it('is what the check reads: too little is refused', async () => {
    const { pool, alice } = await setup(0);
    await expect(pool.connect(alice).call.deposit().withValue(PAY).send()).rejects.toThrow(/value/);
  });
});

describe('a connected signer on a provider that cannot mint a funder', () => {
  const SOURCE_WITH_STATE_ONLY_CALL = `pragma solidcash ^0.14.0;
contract Counter() {
  uint32 n;
  constructor() { this.n = 0; }
  function bump() public { this.n = this.n + 1; }
  function pay() public payable { require(msg.value == 5000000, "value"); this.n = this.n + 1; }
}`;

  /** A wallet that holds exactly `amounts`, in that listing order. Another account deploys the contract. */
  async function wallet(amounts: bigint[]) {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const [deployer] = await provider.getSigners(1, { fundingUtxos: 1, genesisFundingUtxos: 1 });
    const fundingUtxo = (await deployer.getUtxos()).find((utxo) => utxo.vout === 0 && !utxo.token)!;
    const { contract } = await StatefulContract.deploy(compileString(SOURCE_WITH_STATE_ONLY_CALL) as never, [], {
      provider, fundingUtxo, funder: deployer.unlockP2PKH(), changeAddress: deployer.getAddress(),
    });
    const alice = new Signer(alicePriv, provider);
    const coins = new Map<string, bigint>();
    for (const [index, satoshis] of amounts.entries()) {
      const txid = (index + 1).toString(16).padStart(64, 'b');
      await provider.seedUtxo(alice.getAddress(), { txid, vout: 1, satoshis });
      coins.set(txid, satoshis);
    }
    return { alice, coins, counter: (contract as any).connect(alice) };
  }

  /** The wallet's coins a transaction spent, and the change it got back. */
  const paidBy = (hexTx: string, coins: Map<string, bigint>, lock: Uint8Array) => {
    const transaction = decodeTransaction(hexToBin(hexTx)) as any;
    return {
      amounts: transaction.inputs.flatMap((input: any) => coins.get(binToHex(input.outpointTransactionHash)) ?? []),
      change: transaction.outputs.filter((output: any) => same(output.lockingBytecode, lock)),
    };
  };

  it('pays a state-only call, which has no output-only slot to pull a coin in', async () => {
    const { alice, coins, counter } = await wallet([1_000_000n]);
    const sent = await counter.call.bump().send();
    const paid = paidBy(sent.hex, coins, alice.getLockingBytecode());
    expect(paid.amounts).toEqual([1_000_000n]);
    expect(paid.change).toHaveLength(1);
  });

  it('skips a listed coin that is too small for the value', async () => {
    const { alice, coins, counter } = await wallet([3_000n, 9_000_000n]);
    const sent = await counter.call.pay().withValue(5_000_000n).send();
    const paid = paidBy(sent.hex, coins, alice.getLockingBytecode());
    expect(paid.amounts).toEqual([9_000_000n]);
    expect(paid.change).toHaveLength(1);
  });

  it('adds up small coins, and still returns one change', async () => {
    const { alice, coins, counter } = await wallet([2_000_000n, 2_000_000n, 2_000_000n]);
    const sent = await counter.call.pay().withValue(5_000_000n).send();
    const paid = paidBy(sent.hex, coins, alice.getLockingBytecode());
    expect(paid.amounts).toHaveLength(3);
    expect(paid.change).toHaveLength(1);
  });

  it('says what is missing when the wallet cannot pay', async () => {
    const { alice, counter } = await wallet([1_000n]);
    await expect(counter.call.pay().withValue(5_000_000n).send()).rejects.toThrow(alice.getAddress());
  });

  it('takes no coin for an entry that pays the miner from the balance', async () => {
    const { pool, alice } = await setup(1);
    const before = (await alice.getUtxos()).length;
    await pool.connect(alice).call.take(alice.getAddress()).send();
    const received = (await alice.getUtxos()).filter((coin) => coin.satoshis === PAY);
    expect(received).toHaveLength(1);
    expect((await alice.getUtxos()).length).toBe(before + 1);
  });

  it('takes no coin for such an entry even when the fee falls short', async () => {
    const { pool, alice } = await setup(1, SOURCE.replaceAll('30000', '1000'), 1_000n);
    await expect(pool.connect(alice).call.take(alice.getAddress()).send()).rejects.toThrow(/below the minimum relay fee/);
  });
});

describe('the production profile', () => {
  it('states the chain\'s limits and relays as a node does', () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    expect(provider.consensusLimits).toEqual(MOCK_PRODUCTION_LIMITS);
    expect(provider.consensusLimits.maximumInputBytes).toBe(10_000);
    expect(provider.consensusLimits.maximumTransactionBytes).toBe(100_000);
    expect(provider.policy.enforceDust).toBe(true);
  });

  it('mints nothing for the SDK, while a test can still seed the ledger', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    expect((provider as { addUtxo?: unknown }).addUtxo).toBeUndefined();
    const [alice] = await provider.getSigners(1, { fundingUtxos: 1 });
    const before = (await alice.getUtxos()).length;
    await provider.seedUtxo(alice.getAddress(), { txid: 'ab'.repeat(32), vout: 0, satoshis: 5_000n });
    expect((await alice.getUtxos()).length).toBe(before + 1);
  });

  it('leaves the default mock as it was', () => {
    const provider = new MockNetworkProvider();
    expect(provider.consensusLimits.maximumInputBytes).toBe(1_000_000);
    expect(provider.policy.enforceDust).toBe(false);
    expect(typeof provider.addUtxo).toBe('function');
  });
});
