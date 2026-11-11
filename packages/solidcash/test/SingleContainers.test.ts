/**
 * `pragma satoshicontainer single` and `pragma tokencontainer single`: a contract keeps one coin per container of that
 * kind. The deployment opens it, a call recreates it and refuses to open another. Each pragma is tested alone, and
 * leaves the other kind as it is without one. Each attack is the SDK's own transaction with one thing changed, judged by
 * the VM.
 */
import { binToHex, decodeTransaction, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';
import MockNetworkProvider from '../src/network/MockNetworkProvider.js';
import { StatefulContract } from '../src/stateful/index.js';
import { createSatoshiContainerUnlocker, createTokenContainerUnlocker } from '../src/stateful/covenant-helpers.js';
import { Contract, SignatureTemplate, TransactionBuilder } from '../src/index.js';
import { addressToLockScript } from '../src/utils.js';
import { createTestProvider } from './test-util.js';
import { alicePkh, alicePriv, alicePub } from './fixture/vars.js';
import p2pkhArtifact from './fixture/p2pkh.artifact.js';
import {
  buildSatoshiContainerCovenantScript, buildTokenContainerCovenantScript, fillerLockingBytecode, FILLER_SATOSHIS, Op,
} from '@solidcash/utils';

const PAY = 100_000n;
const FEE = 30_000n;
const TOKENS = 100n;
const SEED = 1_200n;
const ASSET = 'a1b2c3d4e5f60718293a4b5c6d7e8f900123456789abcdef0011223344556677';

const SATOSHI_PRAGMA = 'pragma satoshicontainer single;\n';
const TOKEN_PRAGMA = 'pragma tokencontainer single;\n';

const SATOSHI_SOURCE = `pragma solidcash ^0.14.0;
pragma satoshicontainer single;
contract Tip() {
  int constant PAY = 100000;
  int constant FEE = 30000;
  event E(uint32 indexed n);
  uint32 n;
  constructor() { this.n = 0; }
  function deposit() public payable { require(msg.value == PAY + FEE, "value"); this.n = this.n + 1; emit E(this.n); }
  function take(address to) public { this.n = this.n + 1; this.transfer(to, PAY); this.payMinerFee(FEE); }
  function poke() public { this.n = this.n + 1; this.payMinerFee(FEE); }
}`;

const TOKEN_SOURCE = `pragma solidcash ^0.14.0;
pragma tokencontainer single;
contract Vault(bytes32 asset) {
  int constant TOKENS = 100;
  int constant FEE = 30000;
  uint32 n;
  constructor() { this.n = 0; }
  function deposit() public payable {
    require(msg.value == FEE, "value");
    require(this.outState.tokens[asset].tokenAmount == this.tokens[asset].tokenAmount + TOKENS, "tokens");
    this.n = this.n + 1;
  }
  function take(address to) public {
    this.n = this.n + 1;
    this.tokens[asset].transfer(to, TOKENS);
    this.payMinerFee(FEE);
  }
  function bump() public { this.n = this.n + 1; }
}`;

const same = (left: Uint8Array, right: Uint8Array): boolean => binToHex(left) === binToHex(right);

/** Sends `send`, changing the transaction the SDK would broadcast. The verdict is the node's own. */
async function mutated(provider: any, send: () => Promise<unknown>, mutate: (tx: any) => void): Promise<string> {
  const broadcast = provider.sendRawTransaction.bind(provider);
  let verdict = 'not broadcast';
  provider.sendRawTransaction = async (raw: string) => {
    provider.sendRawTransaction = broadcast;
    const transaction = decodeTransaction(hexToBin(raw));
    mutate(transaction);
    try {
      const id = await broadcast(binToHex(encodeTransaction(transaction as never)));
      verdict = 'accepted';
      return id;
    } catch (error) {
      verdict = String((error as Error).message);
      throw error;
    }
  };
  await send().catch(() => undefined);
  provider.sendRawTransaction = broadcast;
  return verdict;
}

/** `source` with `pragmas` in place of its container pragmas. */
const withPragmas = (source: string, pragmas: string): string => source
  .replace(/^pragma (?:satoshi|token)container single;\n/gm, '')
  .replace(/^pragma solidcash [^\n]*\n/m, (line) => line + pragmas);
const WITHOUT_PRAGMA = { pragmas: '' };

async function satoshiPool(deposits: number, { pragmas = SATOSHI_PRAGMA } = {}) {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const [alice, bob] = await provider.getSigners(2, { fundingUtxos: 8, genesisFundingUtxos: 2 });
  const fundingUtxo = (await alice.getUtxos()).find((utxo) => utxo.vout === 0 && !utxo.token && utxo.satoshis >= 200_000n)!;
  const source = withPragmas(SATOSHI_SOURCE, pragmas);
  const { contract } = await StatefulContract.deploy(compileString(source) as never, [], {
    provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(), initialBalance: SEED,
  });
  const pool = contract as any;
  const lock = addressToLockScript(pool.satoshiContainer.address);
  const coins = async () => (await provider.getUtxos(pool.satoshiContainer.address))
    .map((coin) => coin.satoshis).sort((left, right) => Number(left - right));
  const deposit = () => pool.connect(alice).call.deposit().withValue(PAY + FEE).send();
  for (let index = 0; index < deposits; index += 1) await deposit();
  return { provider, alice, bob, pool, lock, coins, deposit };
}

async function tokenPool(deposits: number, { pragmas = TOKEN_PRAGMA, seeded = true } = {}) {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const [alice, bob] = await provider.getSigners(2, { fundingUtxos: 8, genesisFundingUtxos: 2 });
  const fundingUtxo = (await alice.getUtxos()).find((utxo) => utxo.vout === 0 && !utxo.token && utxo.satoshis >= 200_000n)!;
  let nextCoin = 0;
  const tokenCoin = async (amount: bigint) => {
    nextCoin += 1;
    const coin = {
      txid: nextCoin.toString(16).padStart(64, 'c'), vout: 0, satoshis: SEED, token: { category: ASSET, amount },
    };
    await provider.seedUtxo(alice.getAddress(), coin);
    return coin;
  };
  const artifact = compileString(withPragmas(TOKEN_SOURCE, pragmas)) as any;
  const { contract } = await StatefulContract.deploy(artifact as never, [hexToBin(ASSET)], {
    provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(), initialBalance: SEED,
    ...(seeded ? { tokenContainers: [{ utxo: await tokenCoin(1n), unlocker: alice.unlockP2PKH() }] } : {}),
  });
  const pool = contract as any;
  const address = pool.tokens[ASSET].address as string;
  const lock = addressToLockScript(address);
  const coins = async () => (await provider.getUtxos(address))
    .flatMap((coin) => (coin.token ? [coin.token.amount] : [])).sort((left, right) => Number(left - right));
  const deposit = async () => pool.connect(alice).call.deposit()
    .addInput(await tokenCoin(TOKENS), alice.unlockP2PKH()).tokenContainerDeposit(ASSET, TOKENS).withValue(FEE).send();
  for (let index = 0; index < deposits; index += 1) await deposit();
  return { provider, alice, bob, pool, lock, address, coins, deposit, tokenCoin, artifact };
}

describe('the satoshi container of pragma satoshicontainer single', () => {
  it('stays one coin through deposits and withdrawals, down to what the deployment put there', async () => {
    const { pool, bob, coins, deposit } = await satoshiPool(0);
    expect(await coins()).toEqual([SEED]);
    await deposit();
    await deposit();
    expect(await coins()).toEqual([SEED + 2n * (PAY + FEE)]);
    await pool.call.take(bob.getAddress()).send();
    await pool.call.take(bob.getAddress()).send();
    expect(await coins()).toEqual([SEED]);
  });

  it('has one shape from the first deposit on', async () => {
    const { deposit } = await satoshiPool(0);
    const first = (await deposit()).hex.length;
    expect((await deposit()).hex.length).toBe(first);
  });

  it('needs the deployment to open it, which the token pragma alone does not', async () => {
    const deploy = async (source: string): Promise<unknown> => {
      const provider = new MockNetworkProvider({ profile: 'production' });
      const [alice] = await provider.getSigners(1, { fundingUtxos: 2, genesisFundingUtxos: 1 });
      const fundingUtxo = (await alice.getUtxos()).find((utxo) => utxo.vout === 0 && !utxo.token)!;
      return StatefulContract.deploy(compileString(source) as never, [], {
        provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(),
      });
    };
    await expect(deploy(SATOSHI_SOURCE)).rejects.toThrow(/initialBalance/);
    await expect(deploy(withPragmas(SATOSHI_SOURCE, TOKEN_PRAGMA))).resolves.toBeDefined();
  });

  it('accepts the unmodified transaction through the same path as the attacks below', async () => {
    const { provider, pool, bob } = await satoshiPool(1);
    expect(await mutated(provider, () => pool.call.take(bob.getAddress()).send(), () => undefined)).toBe('accepted');
  });

  /** Pays the deposit in two coins. The sum is right, the kept coin grows and the signature is real. */
  const splitDeposit = async ({ pool, alice, lock }: Awaited<ReturnType<typeof satoshiPool>>) => pool.connect(alice)
    .call.deposit().withValue(PAY + FEE - 1_000n).addOutput({ to: lock, amount: 1_000n }).send();

  it('refuses a deposit split into a second coin, which only the pragma stops', async () => {
    const control = await satoshiPool(1, WITHOUT_PRAGMA);
    await splitDeposit(control);
    expect(await control.coins()).toEqual([1_000n, SEED, PAY + FEE - 1_000n, PAY + FEE].sort((a, b) => Number(a - b)));
    const attacked = await satoshiPool(1);
    await expect(splitDeposit(attacked)).rejects.toThrow(/Program failed|VERIFY|evaluat/i);
    expect(await attacked.coins()).toEqual([SEED + PAY + FEE]);
  });

  it('takes a deposit split into a second coin under the token pragma alone, as without one', async () => {
    const context = await satoshiPool(1, { pragmas: TOKEN_PRAGMA });
    await splitDeposit(context);
    expect(await context.coins()).toEqual([1_000n, SEED, PAY + FEE - 1_000n, PAY + FEE].sort((a, b) => Number(a - b)));
  });

  /** Opens a coin at the lock out of what the fee would have paid. The kept coin is exactly right. */
  const openCoin = (lock: Uint8Array) => (tx: any): void => {
    tx.outputs.push({ lockingBytecode: lock, valueSatoshis: 1_000n });
  };

  it('refuses a withdrawal that opens a coin from the fee, which only the pragma stops', async () => {
    const control = await satoshiPool(2, WITHOUT_PRAGMA);
    const send = (context: typeof control) => () => context.pool.call.take(context.bob.getAddress()).send();
    expect(await mutated(control.provider, send(control), openCoin(control.lock))).toBe('accepted');
    const attacked = await satoshiPool(2);
    const verdict = await mutated(attacked.provider, send(attacked), openCoin(attacked.lock));
    expect(verdict).not.toBe('accepted');
    expect(verdict).not.toBe('not broadcast');
  });

  it('refuses to drain a coin, which only the pragma stops', async () => {
    const payExactly = async ({ provider, alice, lock }: Awaited<ReturnType<typeof satoshiPool>>) => {
      const funding = (await alice.getUtxos()).filter((coin) => !coin.token)
        .sort((left, right) => Number(right.satoshis - left.satoshis))[0]!;
      await new TransactionBuilder({ provider })
        .addInput(funding, alice.unlockP2PKH())
        .addOutput({ to: lock, amount: PAY + FEE })
        .addOutput({ to: alice.getAddress(), amount: funding.satoshis - PAY - FEE - 3_000n })
        .send();
    };
    const control = await satoshiPool(0, WITHOUT_PRAGMA);
    await payExactly(control);
    await control.pool.call.take(control.bob.getAddress()).send();
    expect(await control.coins()).toEqual([SEED]);
    const attacked = await satoshiPool(0);
    await payExactly(attacked);
    await expect(attacked.pool.call.take(attacked.bob.getAddress()).send()).rejects.toThrow();
    expect(await attacked.coins()).toEqual([SEED, PAY + FEE]);
  });

  /** The master's coin is at vout 0, so a transaction spending it can create the token that outpoint names. */
  const newToken = (lock: Uint8Array) => (transaction: any) => {
    const index = transaction.outputs.findIndex((output: any) => same(output.lockingBytecode, lock));
    transaction.outputs[index].token = { amount: 1n, category: transaction.inputs[0].outpointTransactionHash };
  };

  it('refuses a new token on the coin, which only the satoshi pragma stops', async () => {
    // Without the pragma a call that leaves change on the coin is one this rule can reach. The token pragma alone
    // leaves the coin's lock as it is without one.
    for (const options of [WITHOUT_PRAGMA, { pragmas: TOKEN_PRAGMA }]) {
      const control = await satoshiPool(1, options);
      const funding = (await control.alice.getUtxos()).filter((coin) => !coin.token)
        .sort((left, right) => Number(right.satoshis - left.satoshis))[0]!;
      await new TransactionBuilder({ provider: control.provider })
        .addInput(funding, control.alice.unlockP2PKH())
        .addOutput({ to: control.lock, amount: PAY + FEE + 5_000n })
        .addOutput({ to: control.alice.getAddress(), amount: funding.satoshis - PAY - FEE - 8_000n })
        .send();
      const take = (): Promise<unknown> => control.pool.call.take(control.bob.getAddress()).send();
      expect(await mutated(control.provider, take, newToken(control.lock))).toBe('accepted');
    }

    const attacked = await satoshiPool(1);
    expect(await mutated(attacked.provider, () => attacked.pool.call.take(attacked.bob.getAddress()).send(), newToken(attacked.lock)))
      .toMatch(/Program failed|VERIFY|evaluat/i);
    await attacked.pool.call.take(attacked.bob.getAddress()).send();
    expect(await attacked.coins()).toEqual([SEED]);
  });

  it('is not disturbed by a coin paid to the lock from outside', async () => {
    const { provider, alice, bob, pool, lock, coins, deposit } = await satoshiPool(1);
    const funding = (await alice.getUtxos()).filter((coin) => !coin.token)
      .sort((left, right) => Number(right.satoshis - left.satoshis))[0]!;
    await new TransactionBuilder({ provider })
      .addInput(funding, alice.unlockP2PKH())
      .addOutput({ to: lock, amount: 700n })
      .addOutput({ to: alice.getAddress(), amount: funding.satoshis - 3_000n })
      .send();
    await deposit();
    await pool.call.take(bob.getAddress()).send();
    await pool.call.take(bob.getAddress()).send();
    expect(await coins()).toEqual([700n, SEED]);
  });

  it('still pays every note when a composer deposits into a coin paid from outside', async () => {
    const { provider, alice, bob, pool, lock, coins, deposit } = await satoshiPool(1);
    const funding = (await alice.getUtxos()).filter((coin) => !coin.token)
      .sort((left, right) => Number(right.satoshis - left.satoshis))[0]!;
    await new TransactionBuilder({ provider })
      .addInput(funding, alice.unlockP2PKH())
      .addOutput({ to: lock, amount: 700n })
      .addOutput({ to: alice.getAddress(), amount: funding.satoshis - 3_000n })
      .send();
    const listing = provider.getUtxos.bind(provider);
    provider.getUtxos = async (address: string) => (await listing(address)).filter((coin) => coin.satoshis !== SEED + PAY + FEE);
    await deposit();
    provider.getUtxos = listing;
    expect(await coins()).toEqual([SEED + PAY + FEE, 700n + PAY + FEE].sort((a, b) => Number(a - b)));
    await pool.call.take(bob.getAddress()).send();
    await pool.call.take(bob.getAddress()).send();
    expect(await coins()).toEqual([700n, SEED]);
  });
});

describe('a coin paid to the satoshi container\'s lock', () => {
  /** A coin of `satoshis`, with a token of another category when `token`, paid in as anyone can. */
  const payIn = async ({ provider, pool }: Awaited<ReturnType<typeof satoshiPool>>, satoshis: bigint, token: boolean) => {
    const txid = 'cd'.repeat(32);
    await provider.seedUtxo(pool.satoshiContainer.address, {
      txid, vout: 0, satoshis, ...(token ? { token: { category: ASSET, amount: 1n } } : {}),
    } as never);
    return txid;
  };
  /** Takes the slot from the real coin, and sweeps that into it through a filler. The fee is what the call allows. */
  const sweep = async (context: Awaited<ReturnType<typeof satoshiPool>>, paidIn: string) => {
    const { provider, alice, pool, lock } = context;
    const coins = await provider.getUtxos(pool.satoshiContainer.address);
    const coin = coins.find((candidate) => candidate.txid === paidIn)!;
    const real = coins.filter((candidate) => candidate.txid !== paidIn)[0]!;
    const unlocker = createSatoshiContainerUnlocker(pool.inner, 0, pool.categoryId);
    const builder: any = await pool.call.poke().build();
    const funding = (await alice.getUtxos()).filter((candidate) => !candidate.token).sort((left, right) => Number(right.satoshis - left.satoshis))[0]!;
    builder.inputs[2] = { ...coin, unlocker };
    builder.inputs.push({ ...real, unlocker }, { ...funding, unlocker: alice.unlockP2PKH() });
    builder.outputs[2] = { to: lock, amount: coin.satoshis + real.satoshis - FEE, ...(coin.token ? { token: coin.token } : {}) };
    builder.outputs.push({ to: fillerLockingBytecode(), amount: FILLER_SATOSHIS }, { to: alice.getAddress(), amount: funding.satoshis - 3_000n });
    return builder.send();
  };

  it('can take the slot and merge the real coin when it is plain', async () => {
    const context = await satoshiPool(1);
    await sweep(context, await payIn(context, 2_000n, false));
    expect((await context.coins()).length).toBe(1);
  });

  it('cannot when it holds a token, which would leave the money on a coin no client reads', async () => {
    const context = await satoshiPool(1);
    await expect(sweep(context, await payIn(context, 2_000n, true))).rejects.toThrow(/Program failed|VERIFY|evaluat/i);
  });
});

describe('the token container of pragma tokencontainer single', () => {
  it('stays one coin through deposits and withdrawals, down to what the deployment put there', async () => {
    const { pool, bob, coins, deposit } = await tokenPool(0);
    expect(await coins()).toEqual([1n]);
    await deposit();
    await deposit();
    expect(await coins()).toEqual([1n + 2n * TOKENS]);
    await pool.call.take(bob.getLockingBytecode()).send();
    await pool.call.take(bob.getLockingBytecode()).send();
    expect(await coins()).toEqual([1n]);
  });

  it('has one shape from the first deposit on', async () => {
    const { deposit } = await tokenPool(0);
    const first = decodeTransaction(hexToBin((await deposit()).hex)) as any;
    const second = decodeTransaction(hexToBin((await deposit()).hex)) as any;
    expect([second.inputs.length, second.outputs.length]).toEqual([first.inputs.length, first.outputs.length]);
  });

  it('refuses a call on a contract the deployment gave no container', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const [alice] = await provider.getSigners(1, { fundingUtxos: 4, genesisFundingUtxos: 1 });
    const fundingUtxo = (await alice.getUtxos()).find((utxo) => utxo.vout === 0 && !utxo.token)!;
    const { contract } = await StatefulContract.deploy(compileString(TOKEN_SOURCE) as never, [hexToBin(ASSET)], {
      provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(), initialBalance: SEED,
    });
    await expect((contract as any).connect(alice).call.deposit().withValue(FEE).send()).rejects.toThrow(/tokenContainers/);
  });

  it('accepts the unmodified transaction through the same path as the attacks below', async () => {
    const { provider, pool, bob } = await tokenPool(1);
    const verdict = await mutated(provider, () => pool.call.take(bob.getLockingBytecode()).send(), () => undefined);
    expect(verdict).toBe('accepted');
  });

  /** Deposits in two coins. The sum is right, the kept coin grows and the signatures are real. */
  const splitDeposit = async ({ pool, alice, lock, tokenCoin }: Awaited<ReturnType<typeof tokenPool>>) => pool.connect(alice)
    .call.deposit().addInput(await tokenCoin(TOKENS), alice.unlockP2PKH()).tokenContainerDeposit(ASSET, TOKENS - 10n)
    .withValue(FEE).addOutput({ to: lock, amount: 1_000n, token: { category: ASSET, amount: 10n } }).send();

  it('refuses a deposit split into a second coin, which only the pragma stops', async () => {
    const control = await tokenPool(1, WITHOUT_PRAGMA);
    await splitDeposit(control);
    expect((await control.coins()).length).toBe(2);
    const attacked = await tokenPool(1);
    await expect(splitDeposit(attacked)).rejects.toThrow();
    expect(await attacked.coins()).toEqual([1n + TOKENS]);
  });

  it('refuses to open the container from a pad in its slot, which only the pragma stops', async () => {
    const attacked = await tokenPool(0, { seeded: false });
    // The SDK refuses this up front. Without that, the transaction reaches the script.
    for (const fn of attacked.artifact.abi) if (fn.name === 'deposit') delete fn.blockLayout.singleTokenContainer;
    await expect(attacked.deposit()).rejects.toThrow(/Program failed|VERIFY|evaluat/i);
    expect(await attacked.coins()).toEqual([]);
    const control = await tokenPool(0, { pragmas: '', seeded: false });
    await control.deposit();
    expect(await control.coins()).toEqual([TOKENS]);
  });

  it('is opened by a deposit and takes a second coin under the satoshi pragma alone, as without one', async () => {
    const opened = await tokenPool(0, { pragmas: SATOSHI_PRAGMA, seeded: false });
    await opened.deposit();
    expect(await opened.coins()).toEqual([TOKENS]);
    await splitDeposit(opened);
    expect(await opened.coins()).toEqual([10n, TOKENS + TOKENS - 10n]);
  });

  it('refuses to drain a coin, which only the pragma stops', async () => {
    const payExactly = async ({ provider, alice, lock, tokenCoin }: Awaited<ReturnType<typeof tokenPool>>) => {
      const coin = await tokenCoin(TOKENS);
      const funding = (await alice.getUtxos()).filter((candidate) => !candidate.token)
        .sort((left, right) => Number(right.satoshis - left.satoshis))[0]!;
      await new TransactionBuilder({ provider })
        .addInput(coin, alice.unlockP2PKH())
        .addInput(funding, alice.unlockP2PKH())
        .addOutput({ to: lock, amount: 1_500n, token: { category: ASSET, amount: TOKENS } })
        .addOutput({ to: alice.getAddress(), amount: funding.satoshis - 2_000n })
        .send();
    };
    const control = await tokenPool(1, { pragmas: '', seeded: false });
    await control.pool.call.take(control.bob.getLockingBytecode()).send();
    expect(await control.coins()).toEqual([]);
    const attacked = await tokenPool(1);
    await payExactly(attacked);
    await attacked.pool.call.take(attacked.bob.getLockingBytecode()).send();
    await expect(attacked.pool.call.take(attacked.bob.getLockingBytecode()).send()).rejects.toThrow();
    expect(await attacked.coins()).toEqual([1n, TOKENS].sort((a, b) => Number(a - b)));
  });

  it('refuses to take a coin\'s satoshis in a call that does not name it, which only the token pragma stops', async () => {
    // A call that names the coin pins its value. One that does not keeps its lock, category and amount, nothing more.
    const attempt = async ({ provider, pool, alice, address }: Awaited<ReturnType<typeof tokenPool>>) => {
      const [coin] = (await provider.getUtxos(address)).filter((candidate) => candidate.token);
      const funding = (await alice.getUtxos()).filter((candidate) => !candidate.token)
        .sort((left, right) => Number(right.satoshis - left.satoshis))[0]!;
      const builder: any = await pool.call.bump().build();
      builder.inputs.push(
        { ...coin, unlocker: createTokenContainerUnlocker(pool.inner, 0, pool.categoryId, ASSET) },
        { ...funding, unlocker: alice.unlockP2PKH() },
      );
      builder.outputs.push(
        { to: address, amount: coin!.satoshis - 200n, token: coin!.token },
        { to: alice.getAddress(), amount: funding.satoshis - 20_000n },
      );
      return builder.send();
    };
    // The satoshi pragma alone leaves the coin's lock as it is without one.
    for (const options of [WITHOUT_PRAGMA, { pragmas: SATOSHI_PRAGMA }]) {
      const control = await tokenPool(1, options);
      await attempt(control);
      expect((await control.provider.getUtxos(control.address)).find((coin) => coin.token)?.satoshis).toBe(SEED - 200n);
    }
    const attacked = await tokenPool(1);
    await expect(attempt(attacked)).rejects.toThrow(/Program failed|VERIFY|evaluat/i);
    expect((await attacked.provider.getUtxos(attacked.address)).find((coin) => coin.token)?.satoshis).toBe(SEED);
  });

  it('lets a coin\'s satoshis grow', async () => {
    const { provider, pool, bob, lock } = await tokenPool(1);
    const verdict = await mutated(provider, () => pool.call.take(bob.getLockingBytecode()).send(), (transaction: any) => {
      transaction.outputs.find((output: any) => same(output.lockingBytecode, lock)).valueSatoshis += 100n;
    });
    expect(verdict).toBe('accepted');
  });

  /** Pays a coin of `amount` tokens and `satoshis` to the container's lock, as anyone can. */
  const payIn = async ({ provider, alice, lock, tokenCoin }: Awaited<ReturnType<typeof tokenPool>>, amount: bigint, satoshis: bigint) => {
    const coin = await tokenCoin(amount);
    const funding = (await alice.getUtxos()).filter((candidate) => !candidate.token)
      .sort((left, right) => Number(right.satoshis - left.satoshis))[0]!;
    await new TransactionBuilder({ provider })
      .addInput(coin, alice.unlockP2PKH())
      .addInput(funding, alice.unlockP2PKH())
      .addOutput({ to: lock, amount: satoshis, token: { category: ASSET, amount } })
      .addOutput({ to: alice.getAddress(), amount: funding.satoshis - 2_000n })
      .send();
  };

  it('is not stopped by a larger coin paid in at its dust floor', async () => {
    const pool = await tokenPool(0);
    await payIn(pool, 2n, 681n);
    await pool.deposit();
    expect(await pool.coins()).toEqual([2n, 1n + TOKENS]);
  });

  it('is not stopped by a larger coin a miner took below the dust floor', async () => {
    const pool = await tokenPool(1);
    await pool.provider.seedUtxo(pool.address, {
      txid: 'ee'.repeat(32), vout: 0, satoshis: 600n, token: { category: ASSET, amount: 5n * TOKENS },
    });
    await pool.pool.call.take(pool.bob.getLockingBytecode()).send();
    await pool.deposit();
    expect(await pool.coins()).toEqual([1n + TOKENS, 5n * TOKENS]);
  });

  it('takes a larger coin that can be recreated', async () => {
    const pool = await tokenPool(0);
    await payIn(pool, 2n, 1_200n);
    await pool.deposit();
    expect(await pool.coins()).toEqual([1n, 2n + TOKENS]);
  });

  it('refuses an NFT a script can see hung on a coin in a call that does not name it', async () => {
    const attempt = async ({ provider, pool, alice, address, tokenCoin }: Awaited<ReturnType<typeof tokenPool>>, nft: object) => {
      const held = (await provider.getUtxos(address)).find((coin) => coin.token)!;
      const bearer = { ...(await tokenCoin(0n)), txid: 'be'.repeat(32), token: { category: ASSET, amount: 0n, nft } };
      await provider.seedUtxo(alice.getAddress(), bearer as never);
      const funding = (await alice.getUtxos()).filter((candidate) => !candidate.token)
        .sort((left, right) => Number(right.satoshis - left.satoshis))[0]!;
      const builder: any = await pool.call.bump().build();
      builder.inputs.push(
        { ...held, unlocker: createTokenContainerUnlocker(pool.inner, 0, pool.categoryId, ASSET) },
        { ...bearer, unlocker: alice.unlockP2PKH() },
        { ...funding, unlocker: alice.unlockP2PKH() },
      );
      builder.outputs.push(
        { to: address, amount: held.satoshis, token: { ...held.token, nft } },
        { to: alice.getAddress(), amount: funding.satoshis - 20_000n },
      );
      return builder.send();
    };
    // The same transaction with the one NFT no script can see goes through, so the rule is what refuses the others.
    await attempt(await tokenPool(1), { capability: 'none', commitment: '' });
    for (const nft of [{ capability: 'none', commitment: 'ab' }, { capability: 'mutable', commitment: '' }, { capability: 'minting', commitment: '' }]) {
      await expect(attempt(await tokenPool(1), nft)).rejects.toThrow(/Program failed|VERIFY|evaluat/i);
    }
  });

  it('passes over a coin holding an NFT a script can see, whatever it holds', async () => {
    const context = await tokenPool(1);
    for (const [index, nft] of [{ capability: 'minting', commitment: '' }, { capability: 'mutable', commitment: '' }, { capability: 'none', commitment: 'ab' }].entries()) {
      await context.provider.seedUtxo(context.address, {
        txid: `${index + 1}`.padStart(64, 'e'), vout: 0, satoshis: SEED, token: { category: ASSET, amount: 5n * TOKENS, nft },
      } as never);
    }
    await context.pool.call.take(context.bob.getLockingBytecode()).send();
    await context.deposit();
    expect((await context.coins()).filter((amount) => amount === 1n + TOKENS).length).toBe(1);
  });

  it('carries an NFT with an empty commitment, which no script can see', async () => {
    const context = await tokenPool(0, { seeded: false }).catch(() => undefined);
    expect(context).toBeDefined();
    const { provider, address, pool, bob } = context!;
    await provider.seedUtxo(address, {
      txid: 'f'.repeat(64), vout: 0, satoshis: SEED, token: { category: ASSET, amount: 1n, nft: { capability: 'none', commitment: '' } },
    } as never);
    await context!.deposit();
    const held = (await provider.getUtxos(address)).find((coin) => coin.token)!;
    expect(held.token?.nft).toEqual({ capability: 'none', commitment: '' });
    await pool.call.take(bob.getLockingBytecode()).send();
    expect((await provider.getUtxos(address)).find((coin) => coin.token)!.token?.nft).toEqual({ capability: 'none', commitment: '' });
  });

  it('changes no other lock: only a token coin under the pragma reads its own value', () => {
    const category = hexToBin(ASSET);
    const master = new Uint8Array(35).fill(1);
    const valueReads = (script: readonly unknown[]): number => script.filter((item) => item === Op.OP_UTXOVALUE).length;
    const token = (keepsTokenless: boolean) => buildTokenContainerCovenantScript(category, category, master, { keepsTokenless });
    const satoshi = (keepsTokenless: boolean) => buildSatoshiContainerCovenantScript(category, master, { keepsTokenless });
    expect(valueReads(token(true))).toBe(1);
    expect(valueReads(token(false))).toBe(0);
    expect(valueReads(satoshi(true))).toBe(valueReads(satoshi(false)));
  });

  it('withdraws past coins paid to the lock from outside', async () => {
    const { provider, alice, bob, pool, lock, coins, deposit, tokenCoin } = await tokenPool(1);
    const stray = async (): Promise<void> => {
      const coin = await tokenCoin(1n);
      const funding = (await alice.getUtxos()).filter((candidate) => !candidate.token)
        .sort((left, right) => Number(right.satoshis - left.satoshis))[0]!;
      await new TransactionBuilder({ provider })
        .addInput(coin, alice.unlockP2PKH())
        .addInput(funding, alice.unlockP2PKH())
        .addOutput({ to: lock, amount: 1_500n, token: { category: ASSET, amount: 1n } })
        .addOutput({ to: alice.getAddress(), amount: funding.satoshis - 2_000n })
        .send();
    };
    await stray();
    await deposit();
    await stray();
    await pool.call.take(bob.getLockingBytecode()).send();
    expect((await coins()).reduce((sum, amount) => sum + amount, 0n)).toBe(3n + TOKENS);
    expect(await coins()).toEqual([1n, 1n, 1n + TOKENS]);
  });
});

describe('an upgrade that moves a satoshi container', () => {
  /** A contract whose one container is the satoshi one. Only the first version can be upgraded. */
  const vault = (
    name: string, pragmas: string, upgradeable: boolean,
  ): ReturnType<typeof compileString> => compileString(`pragma solidcash ^0.14.0;
${pragmas}contract ${name}(pubkey admin) {
  function pay(sig s, bytes20 recipient, int amount) {
    require(checkSig(s, admin));
    this.transfer(new LockingBytecodeP2PKH(recipient), amount);
  }
  ${upgradeable ? 'function migrate(sig s) upgrade { require(checkSig(s, admin)); }' : ''}
  function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
}`, { forceStateful: true });

  /** Deploys the first version with a satoshi container and upgrades it to a second under `pragmas`. */
  const upgradeTo = async (pragmas: string): ReturnType<typeof StatefulContract.upgrade> => {
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const fundingUtxo = { txid: 'a1cd'.repeat(16), vout: 0, satoshis: 100_000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);
    const { contract } = await StatefulContract.deploy(vault('VaultV1', '', true), [alicePub], {
      provider,
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialBalance: 5_000n,
      changeAddress: p2pkh.address,
    });
    const upgradeUtxo = { txid: 'a2cd'.repeat(16), vout: 0, satoshis: 100_000n };
    await provider.addUtxo('51', upgradeUtxo);
    return StatefulContract.upgrade({
      provider,
      oldContract: contract,
      upgradeFunctionName: 'migrate',
      upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
      newArtifact: vault('VaultV2', pragmas, false),
      newConstructorArgs: [alicePub],
      fundingUtxo: upgradeUtxo,
      funder: { generateLockingBytecode: () => hexToBin('51'), generateUnlockingBytecode: () => new Uint8Array() },
      changeAddress: p2pkh.address,
    });
  };

  it('is refused into a contract under the satoshi pragma, whose satoshi container takes the other form', async () => {
    await expect(upgradeTo(SATOSHI_PRAGMA)).rejects.toThrow(/is under `pragma satoshicontainer single`/);
  });

  it('goes through into a contract under the token pragma alone, whose satoshi container keeps its form', async () => {
    const result = await upgradeTo(TOKEN_PRAGMA);
    await result.contract.call.pay(new SignatureTemplate(alicePriv), alicePkh, 1_000n).send();
  });
});
