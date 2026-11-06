/**
 * `pragma containers single`: a contract keeps one coin per container. The deployment opens them, a call recreates them
 * and refuses to open another. Each attack is the SDK's own transaction with one thing changed, judged by the VM.
 */
import { binToHex, decodeTransaction, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';
import MockNetworkProvider from '../src/network/MockNetworkProvider.js';
import { StatefulContract } from '../src/stateful/index.js';
import { TransactionBuilder } from '../src/index.js';
import { addressToLockScript } from '../src/utils.js';

const PAY = 100_000n;
const FEE = 30_000n;
const TOKENS = 100n;
const SEED = 1_200n;
const ASSET = 'a1b2c3d4e5f60718293a4b5c6d7e8f900123456789abcdef0011223344556677';

const SATOSHI_SOURCE = `pragma solidcash ^0.14.0;
pragma containers single;
contract Tip() {
  int constant PAY = 100000;
  int constant FEE = 30000;
  event E(uint32 indexed n);
  uint32 n;
  constructor() { this.n = 0; }
  function deposit() public payable { require(msg.value == PAY + FEE, "value"); this.n = this.n + 1; emit E(this.n); }
  function take(address to) public { this.n = this.n + 1; this.transfer(to, PAY); this.payMinerFee(FEE); }
}`;

const TOKEN_SOURCE = `pragma solidcash ^0.14.0;
pragma containers single;
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

const WITHOUT_PRAGMA = { pragma: false };
const withoutPragma = (source: string): string => source.replace('pragma containers single;\n', '');

async function satoshiPool(deposits: number, { pragma = true } = {}) {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const [alice, bob] = await provider.getSigners(2, { fundingUtxos: 8, genesisFundingUtxos: 2 });
  const fundingUtxo = (await alice.getUtxos()).find((utxo) => utxo.vout === 0 && !utxo.token && utxo.satoshis >= 200_000n)!;
  const source = pragma ? SATOSHI_SOURCE : withoutPragma(SATOSHI_SOURCE);
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

async function tokenPool(deposits: number, { pragma = true, seeded = true } = {}) {
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
  const artifact = compileString(pragma ? TOKEN_SOURCE : withoutPragma(TOKEN_SOURCE)) as any;
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

describe('the satoshi container of pragma containers single', () => {
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

  it('needs the deployment to open it', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const [alice] = await provider.getSigners(1, { fundingUtxos: 2, genesisFundingUtxos: 1 });
    const fundingUtxo = (await alice.getUtxos()).find((utxo) => utxo.vout === 0 && !utxo.token)!;
    await expect(StatefulContract.deploy(compileString(SATOSHI_SOURCE) as never, [], {
      provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(),
    })).rejects.toThrow(/initialBalance/);
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

  it('refuses a new token on the coin, which only the pragma stops', async () => {
    // Without the pragma a call that leaves change on the coin is one this rule can reach.
    const control = await satoshiPool(1, WITHOUT_PRAGMA);
    const funding = (await control.alice.getUtxos()).filter((coin) => !coin.token)
      .sort((left, right) => Number(right.satoshis - left.satoshis))[0]!;
    await new TransactionBuilder({ provider: control.provider })
      .addInput(funding, control.alice.unlockP2PKH())
      .addOutput({ to: control.lock, amount: PAY + FEE + 5_000n })
      .addOutput({ to: control.alice.getAddress(), amount: funding.satoshis - PAY - FEE - 8_000n })
      .send();
    expect(await mutated(control.provider, () => control.pool.call.take(control.bob.getAddress()).send(), newToken(control.lock)))
      .toBe('accepted');

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

describe('the token container of pragma containers single', () => {
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
    for (const fn of attacked.artifact.abi) if (fn.name === 'deposit') delete fn.blockLayout.singleContainers;
    await expect(attacked.deposit()).rejects.toThrow(/Program failed|VERIFY|evaluat/i);
    expect(await attacked.coins()).toEqual([]);
    const control = await tokenPool(0, { pragma: false, seeded: false });
    await control.deposit();
    expect(await control.coins()).toEqual([TOKENS]);
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
    const control = await tokenPool(1, { pragma: false, seeded: false });
    await control.pool.call.take(control.bob.getLockingBytecode()).send();
    expect(await control.coins()).toEqual([]);
    const attacked = await tokenPool(1);
    await payExactly(attacked);
    await attacked.pool.call.take(attacked.bob.getLockingBytecode()).send();
    await expect(attacked.pool.call.take(attacked.bob.getLockingBytecode()).send()).rejects.toThrow();
    expect(await attacked.coins()).toEqual([1n, TOKENS].sort((a, b) => Number(a - b)));
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
