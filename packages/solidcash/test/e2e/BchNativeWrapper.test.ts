/**
 * BchNativeWrapper: an ERC-20 over an existing CashTokens category, OpenZeppelin's ERC20Wrapper for CashTokens
 * (docs/wip/bch-native-wrapper/DESIGN.md). The ledger is private to the wrapper, so only its final wrap and unwrap
 * change the supply, and the deployment names the category it wraps instead of creating one.
 */
// cspell:ignore WEXM
import { readFileSync } from 'node:fs';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileFile, compileString } from 'solidc';
import { asmToScript, scriptToBytecode, type Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { NATIVE_TOKEN_EXTENSION } from '../../src/bcmr/index.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import type Signer from '../../src/Signer.js';
import { getTokenContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { TransactionBuilder } from '../../src/TransactionBuilder.js';
import type { Utxo } from '../../src/interfaces.js';
import { addressToLockScript } from '../../src/utils.js';

const CONTRACTS = new URL('../../contracts/', import.meta.url);
const TIMESTAMP = '2026-10-21T12:00:00.000Z';
const files = Object.fromEntries(['BchNative', 'BchNativeWrapper', 'BchNativeMultiplier', 'ERC20Metadata']
  .map((name) => [`/contracts/${name}.scash`, readFileSync(new URL(`${name}.scash`, CONTRACTS), 'utf8')]));
const HEADER = 'pragma solidcash >=0.8.0;\n'
  + 'import { BchNativeWrapper } from "./BchNativeWrapper.scash";\n'
  + 'import { BchNativeMultiplier } from "./BchNativeMultiplier.scash";\n'
  + 'import { ERC20Metadata } from "./ERC20Metadata.scash";\n';

/** A wrapper that derives from `bases` with `body` added, compiled beside the shipped contracts. */
function wrapper(name: string, bases: string, body = ''): Artifact {
  return compileString(`${HEADER}contract ${name}() is ${bases} {\n`
    + '    constructor(bytes32 underlying_) BchNativeWrapper(underlying_) { }\n'
    + `${body}}\n`, { files, rootFileId: '/contracts/Main.scash', messageBus: false, suppressWarnings: true }) as Artifact;
}

const minimal = compileFile(new URL('examples/MinimalWrappedToken.scash', CONTRACTS), { messageBus: false });

async function genesisCoin(signer: Signer, skip: readonly Utxo[] = []): Promise<Utxo> {
  const coin = (await signer.getUtxos()).find((utxo) => utxo.vout === 0 && utxo.token === undefined
    && utxo.satoshis >= 100_000n && !skip.some((other) => other.txid === utxo.txid));
  if (coin === undefined) throw new Error('no genesis coin left');
  return coin;
}

/** The issuer's own genesis of X, before any wrapper exists, minting each holder one coin of X. */
async function issue(
  provider: MockNetworkProvider, issuer: Signer, holders: readonly { holder: Signer; amount: bigint }[],
): Promise<{ category: string; coins: Utxo[] }> {
  const coin = await genesisCoin(issuer);
  const category = coin.txid;
  const builder = new TransactionBuilder({ provider }).addInput(coin, issuer.unlockP2PKH());
  for (const { holder, amount } of holders) {
    builder.addOutput({ to: holder.getLockingBytecode(), amount: 1_200n, token: { category, amount } });
  }
  builder.addOutput({ to: issuer.getLockingBytecode(), amount: coin.satoshis - 10_000n });
  const { txid } = await builder.send();
  return {
    category,
    coins: holders.map(({ amount }, vout) => ({ txid, vout, satoshis: 1_200n, token: { category, amount } })),
  };
}

async function tokensAt(provider: MockNetworkProvider, address: string, category: string): Promise<bigint> {
  return (await provider.getUtxos(address))
    .reduce((sum, utxo) => sum + (utxo.token?.category === category ? utxo.token.amount : 0n), 0n);
}

async function signers(provider: MockNetworkProvider, count: number): Promise<Signer[]> {
  return await provider.getSigners(count, { fundingUtxos: 8, genesisFundingUtxos: 3 }) as unknown as Signer[];
}

describe('BchNativeWrapper', () => {
  it('is an ERC-20 ledger with underlying() and BchNative\'s boundary, and nothing that mints', () => {
    // BchNative's boundary with ERC20.scash's ledger kept private, and the 75-byte underlying() view; call records
    // (D50) added 178 B (7512 -> 7690).
    expect(scriptToBytecode(asmToScript(minimal.bytecode)).length).toBe(7690);
    expect(minimal.abi.filter((entry) => entry.name !== '__construct').map((entry) => entry.name).sort()).toEqual([
      'allowance', 'approve', 'balanceOf', 'totalSupply', 'transfer', 'transferFrom', 'underlying', 'unwrap', 'wrap',
    ]);
    expect(minimal.abi.find((entry) => entry.name === '__construct')?.inputs.map((input) => input.name))
      .toEqual(['underlying_']);
    expect(minimal.events.map((event) => event.name).sort()).toEqual(['Approval', 'Transfer']);
    const keys = minimal.abi.flatMap((entry) => entry.tokenContainerAccesses ?? []);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((access) => access.keySource === 'state' && access.keyStateVariable === '_nativeCategory'))
      .toBe(true);
  });

  it('keeps the supply sealed: a derived contract cannot write the ledger or replace the boundary', () => {
    expect(() => wrapper('WriteLedger', 'BchNativeWrapper',
      '    function poke(address a) { this._balances[a] = 1; require(true); }\n'))
      .toThrow(/Cannot access private collection '_balances'/);
    expect(() => wrapper('WriteSupply', 'BchNativeWrapper',
      '    function poke() { this._totalSupply = 1; require(true); }\n'))
      .toThrow(/Cannot access private state variable '_totalSupply'/);
    expect(() => wrapper('LieSupply', 'BchNativeWrapper',
      '    function totalSupply() public view override returns (uint256) { return 42; }\n'))
      .toThrow(/Cannot override 'totalSupply': 'BchNativeWrapper' did not mark it 'virtual'/);
    expect(() => wrapper('WrapOverride', 'BchNativeWrapper',
      '    function wrap(int amount) override { require(amount > 0); }\n'))
      .toThrow(/Cannot override 'wrap'/);
    expect(() => wrapper('CreditOverride', 'BchNativeWrapper',
      '    function _nativeCredit(address a, uint256 v) internal override { require(v > 0); }\n'))
      .toThrow(/Cannot override '_nativeCredit'/);
    expect(() => wrapper('ScaleOverride', 'BchNativeWrapper, BchNativeMultiplier(100)',
      '    function _nativeAmount(int amount) internal view override returns (int) { return 0; }\n'))
      .toThrow(/Cannot override '_nativeAmount': 'BchNativeMultiplier' did not mark it 'virtual'/);
    // Policy composes: a transfer override reaches the ledger only through super.
    expect(() => wrapper('PolicyTransfer', 'BchNativeWrapper', '    function transfer(address to, uint256 value)'
      + ' override { require(to != msg.sender); super.transfer(to, value); }\n')).not.toThrow();
  });

  it('wraps a category its issuer created: bob wraps 600, pays alice 250, and alice unwraps them', async () => {
    const provider = new MockNetworkProvider();
    const [deployer, alice, bob, issuer] = await signers(provider, 4);
    const { category, coins: [bobCoin, aliceCoin] } = await issue(provider, issuer!, [
      { holder: bob!, amount: 600n }, { holder: alice!, amount: 101n },
    ]);
    const { contract: token, tx, categoryId } = await StatefulContract.deploy(minimal, [], {
      provider, fundingUtxo: await genesisCoin(deployer!), funder: deployer!.unlockP2PKH(),
      changeAddress: deployer!.getAddress(), initArgs: [hexToBin(category)], nativeToken: { category },
    });
    // The genesis creates C alone and mints nothing: no input or output carries X.
    expect(tx.inputs.some((input) => binToHex(input.outpointTransactionHash) === category)).toBe(false);
    expect(tx.outputs.some((output) => output.token !== undefined && binToHex(output.token.category) === category))
      .toBe(false);
    const views = token.callStatic as unknown as Record<string, () => Promise<unknown>>;
    const underlying = await views.underlying!();
    expect(underlying instanceof Uint8Array ? binToHex(underlying) : underlying).toBe(category);
    expect(await views.totalSupply!()).toBe(0n);

    const reserve = getTokenContainerAddress(token.inner, categoryId, category);
    const aliceKey = addressToLockScript(alice!.getAddress());
    const bobKey = addressToLockScript(bob!.getAddress());
    await token.connect(bob!).call.wrap(600n)
      .addInput(bobCoin!, bob!.unlockP2PKH()).tokenContainerDeposit(category, 600n).send();
    await token.connect(bob!).call.transfer(aliceKey, 250n).send();
    await token.connect(alice!).call.unwrap(alice!.getAddress(), 250n).send();
    expect(await views.totalSupply!()).toBe(350n);
    expect(await token.state._balances(bobKey)).toBe(350n);
    expect(await token.state._balances(aliceKey)).toBe(0n);
    expect(await tokensAt(provider, reserve, category)).toBe(350n);
    expect(await tokensAt(provider, alice!.getAddress(), category)).toBe(351n);

    // As on the EVM, a wrap moves exactly its amount: 101 deposited does not wrap 100, and the coin wraps 101.
    await expect(token.connect(alice!).call.wrap(100n)
      .addInput(aliceCoin!, alice!.unlockP2PKH()).tokenContainerDeposit(category, 101n).send()).rejects.toThrow();
    expect(await views.totalSupply!()).toBe(350n);
    await token.connect(alice!).call.wrap(101n)
      .addInput(aliceCoin!, alice!.unlockP2PKH()).tokenContainerDeposit(category, 101n).send();
    expect(await views.totalSupply!()).toBe(451n);
    expect(await tokensAt(provider, reserve, category)).toBe(451n);
  });

  it('scales through BchNativeMultiplier, and a qualified BchNative.wrap credits nothing', async () => {
    const provider = new MockNetworkProvider();
    const [deployer, bob, issuer] = await signers(provider, 3);
    const { category, coins: [five, six, more] } = await issue(provider, issuer!, [
      { holder: bob!, amount: 5n }, { holder: bob!, amount: 6n }, { holder: bob!, amount: 5n },
    ]);
    const scaled = wrapper('ScaledWrapped', 'BchNativeWrapper, BchNativeMultiplier(100)');
    const { contract: token, categoryId } = await StatefulContract.deploy(scaled, [], {
      provider, fundingUtxo: await genesisCoin(deployer!), funder: deployer!.unlockP2PKH(),
      changeAddress: deployer!.getAddress(), initArgs: [hexToBin(category)], nativeToken: { category, scale: 100n },
    });
    const bobKey = addressToLockScript(bob!.getAddress());
    await token.connect(bob!).call.wrap(500n)
      .addInput(five!, bob!.unlockP2PKH()).tokenContainerDeposit(category, 5n).send();
    expect(await token.state._balances(bobKey)).toBe(500n);
    // 550 is not a multiple of 100, whatever the deposit.
    await expect(token.connect(bob!).call.wrap(550n)
      .addInput(six!, bob!.unlockP2PKH()).tokenContainerDeposit(category, 6n).send()).rejects.toThrow();
    await token.connect(bob!).call.unwrap(bob!.getAddress(), 500n).send();
    expect((await token.getState())._totalSupply).toBe(0n);
    expect(await tokensAt(provider, getTokenContainerAddress(token.inner, categoryId, category), category)).toBe(0n);

    // BchNative's own boundary, reached by name, ends in the wrapper's failing credit hook.
    const qualified = wrapper('QualifiedWrap', 'BchNativeWrapper',
      '    function issue(int amount) { BchNative.wrap(amount); }\n');
    const { contract: other } = await StatefulContract.deploy(qualified, [], {
      provider, fundingUtxo: await genesisCoin(deployer!), funder: deployer!.unlockP2PKH(),
      changeAddress: deployer!.getAddress(), initArgs: [hexToBin(category)], nativeToken: { category },
    });
    await expect(other.connect(bob!).call.issue(5n)
      .addInput(more!, bob!.unlockP2PKH()).tokenContainerDeposit(category, 5n).send()).rejects.toThrow();
    expect((await other.getState())._totalSupply).toBe(0n);
  });

  it('refuses, before broadcasting, a category the deployment cannot wrap', async () => {
    const provider = new MockNetworkProvider();
    const [deployer, issuer] = await signers(provider, 2);
    const { category } = await issue(provider, issuer!, [{ holder: deployer!, amount: 10n }]);
    const funding = await genesisCoin(deployer!);
    const other = await genesisCoin(deployer!, [funding]);
    const base = {
      provider, fundingUtxo: funding, funder: deployer!.unlockP2PKH(), changeAddress: deployer!.getAddress(),
    };
    const deploy = (artifact: Artifact, initArgs: unknown[], nativeToken: object): Promise<unknown> =>
      StatefulContract.deploy(artifact, [], { ...base, initArgs, nativeToken } as never);
    const args = [hexToBin(category)];
    await expect(deploy(minimal, args, { category, funding: other })).rejects.toThrow(/nativeToken.funding creates/);
    await expect(deploy(minimal, args, { category, reserve: 1n })).rejects.toThrow(/nativeToken.reserve mints/);
    await expect(deploy(minimal, args, { category, bearer: { amount: 1n, to: deployer!.getAddress() } }))
      .rejects.toThrow(/nativeToken.bearer mints/);
    await expect(deploy(minimal, args, { category: 'x'.repeat(64) })).rejects.toThrow(/64 hex characters/);
    await expect(deploy(minimal, args, { category, scale: 0n })).rejects.toThrow(/must be positive/);
    await expect(deploy(minimal, [hexToBin(funding.txid)], { category: funding.txid }))
      .rejects.toThrow(/must differ from the contract category/);
    await expect(deploy(minimal, [hexToBin('ee'.repeat(32))], { category }))
      .rejects.toThrow(/keys its reserve by category e{64}/);
    await expect(deploy(minimal, [hexToBin(category).reverse()], { category })).rejects.toThrow(/not reversed/);
    // A constructor that credits units the genesis does not back.
    const credited = compileFile(new URL('../fixture/bcmr_metadata_token.scash', import.meta.url), { messageBus: false });
    await expect(deploy(credited, args, { category })).rejects.toThrow(/credits a totalSupply\(\) of 5000/);
    const counter = compileString('pragma solidcash >=0.8.0;\ncontract Counter() {\n  int count;\n'
      + '  function bump() { this.count = this.count + 1; require(this.count > 0); }\n}\n', { messageBus: false });
    await expect(StatefulContract.deploy(counter, [], { ...base, nativeToken: { category } }))
      .rejects.toThrow(/keys none/);
    const live = await deployer!.getUtxos();
    for (const coin of [funding, other]) {
      expect(live.some((utxo) => utxo.txid === coin.txid && utxo.vout === 0)).toBe(true);
    }
  });

  it('publishes the contract category alone, with the ledger\'s own fields and the wrapped category', async () => {
    const provider = new MockNetworkProvider();
    const [deployer, issuer] = await signers(provider, 2);
    const { category } = await issue(provider, issuer!, [{ holder: issuer!, amount: 1_000n }]);
    const artifact = wrapper('MetaWrapped', 'BchNativeWrapper, BchNativeMultiplier(100), '
      + 'ERC20Metadata("Wrapped Example", "WEXM")', '    function decimals() public view override returns (uint8) {'
      + ' return 10; }\n');
    const result = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo: await genesisCoin(deployer!), funder: deployer!.unlockP2PKH(),
      changeAddress: deployer!.getAddress(), initArgs: [hexToBin(category)],
      bcmr: { timestamp: TIMESTAMP }, nativeToken: { category, scale: 100n },
    });
    const identities = result.registry!.registry.identities!;
    // X's identity is its issuer's: the registry describes C alone.
    expect(Object.keys(identities)).toEqual([result.categoryId]);
    const snapshot = identities[result.categoryId]![TIMESTAMP]!;
    expect(snapshot.name).toBe('Wrapped Example');
    // decimals() as the ledger answers it: a wrapper has no bearer unit to scale it to.
    expect(snapshot.token).toEqual({ category: result.categoryId, symbol: 'WEXM', decimals: 10 });
    const reserveLock = addressToLockScript(getTokenContainerAddress(result.contract.inner, result.categoryId,
      category));
    expect(snapshot.extensions?.[NATIVE_TOKEN_EXTENSION]).toEqual({
      underlying: category, reserveLockingBytecode: binToHex(reserveLock), scale: '100', ledgerSupply: 'totalSupply()',
    });
  });
});
