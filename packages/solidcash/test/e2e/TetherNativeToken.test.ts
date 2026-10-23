import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileFile, compileFileSplit } from '@solidcash/solidc';
import { asmToScript, scriptToBytecode, type Artifact } from '@solidcash/utils';
import { NATIVE_TOKEN_EXTENSION } from '../../src/bcmr/index.js';
import type { Signer } from '../../src/index.js';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import type { DeployedContract } from '../../src/stateful/ContractFactory.js';
import { SplitContractBundle, type SplitContract } from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { NATIVE_TEST_CATEGORY, createTestProvider, getSigners } from '../test-util.js';

// The verified source of USDT at 0xdAC17F958D2ee523a2206206994597C13D831ec7 (solc v0.4.18), exactly as Etherscan
// serves it: CRLF line endings, no trailing newline.
const tetherSource = new URL('../fixture/tether/TetherToken.sol', import.meta.url);
const nativeSource = new URL('../fixture/tether/TetherNativeToken.sol', import.meta.url);
const VERIFIED_SOURCE_SHA256 = '36bf0b5747dfe7f79a03c9bc09af63e93e352d3c61199fbf025fd2c962b485f8';
const MAX_UINT = 2n ** 256n - 1n;
const TIMESTAMP = '2026-10-22T12:00:00.000Z';

const options = { evmCompat: true, messageBus: false, suppressWarnings: true };
const scriptBytes = (artifact: Artifact): number => scriptToBytecode(asmToScript(artifact.bytecode)).length;

describe('Tether USDT verbatim with BchNative', () => {
  it('keeps the Etherscan-verified source byte for byte', () => {
    const digest = createHash('sha256').update(readFileSync(tetherSource)).digest('hex');
    expect(digest).toBe(VERIFIED_SOURCE_SHA256);
  });

  it('compiles the Solidity 0.4 source to the complete USDT ABI', () => {
    const artifact = compileFile(tetherSource, options) as Artifact;
    expect(artifact.contractName).toBe('TetherToken');
    const abi = new Set(artifact.abi.map((entry) => entry.name));
    for (const name of [
      'transfer', 'transferFrom', 'approve', 'allowance', 'balanceOf', 'totalSupply', 'issue', 'redeem',
      'setParams', 'pause', 'unpause', 'deprecate', 'transferOwnership', 'addBlackList', 'removeBlackList',
      'destroyBlackFunds', 'getBlackListStatus', 'getOwner', 'name', 'symbol', 'decimals', 'owner', 'paused',
      'deprecated', 'upgradedAddress', 'balances', 'allowed', 'isBlackListed', 'basisPointsRate', 'maximumFee',
      'MAX_UINT', '_totalSupply',
    ]) expect(abi).toContain(name);
    expect(artifact.abi.find((entry) => entry.name === 'balanceOf')?.modifiers).toContain('view');
    const constructor = artifact.abi.find((entry) => entry.name === '__construct');
    expect(constructor?.inputs.map((input) => input.name).filter((name) => !name.startsWith('__internal__')))
      .toEqual(['_initialSupply', '_name', '_symbol', '_decimals']);
  });

  it('deploys through its own constructor and runs USDT and the CashTokens boundary', async () => {
    const split = compileFileSplit(nativeSource, options);
    for (const shard of [split.root, ...Object.values(split.facets)]) expect(scriptBytes(shard)).toBeLessThan(10_000);

    const provider = createTestProvider();
    const [treasury, admin, alice, bob, successor] = await getSigners(5, { provider, fundingUtxos: 40 });
    const usdt = await SplitContractBundle.from(split, treasury).deploy([
      1_000_000n, 'Tether USD', 'USDT', 6n, hexToBin(NATIVE_TEST_CATEGORY),
    ]);
    const as = (signer: Signer): SplitContract => usdt.connect(signer);
    const key = (signer: Signer): Uint8Array => addressToLockScript(signer.getAddress());
    const balance = (signer: Signer): Promise<bigint> => usdt.root.state.balances(key(signer));
    const state = (): Promise<Record<string, unknown>> => usdt.root.getState();
    const owner = async (): Promise<string> => binToHex((await state()).owner as Uint8Array);
    const refused = (call: { send: () => Promise<unknown> }): Promise<void> =>
      expect(call.send()).rejects.toThrow();

    // Ownable's constructor made the deployer the owner; TetherToken's credited it the initial supply.
    expect(await state()).toMatchObject({
      _totalSupply: 1_000_000n, decimals: 6n, paused: false, deprecated: false, basisPointsRate: 0n, maximumFee: 0n,
    });
    expect(await owner()).toBe(binToHex(key(treasury)));
    expect(await balance(treasury)).toBe(1_000_000n);

    // Known limit: transfer and transferFrom also hold the owner's fee credit `balances[owner] += fee`. When the owner
    // sends or receives, two writes land on one balance entry, which one call cannot compose here yet, so the SDK
    // refuses the transaction rather than build a wrong one. A separate administrator account avoids the shape.
    await expect(as(treasury).call.transfer(key(alice), 1n).send()).rejects.toThrow('duplicate slot');
    await as(treasury).call.transferOwnership(key(admin)).send();
    expect(await owner()).toBe(binToHex(key(admin)));

    await as(treasury).call.transfer(key(alice), 10_000n).send();
    expect(await balance(treasury)).toBe(990_000n);
    expect(await balance(alice)).toBe(10_000n);

    // approve, its race guard, and a finite allowance spent by transferFrom.
    await as(alice).call.approve(key(bob), 3_000n).send();
    await refused(as(alice).call.approve(key(bob), 1_000n));
    await as(bob).call.transferFrom(key(alice), key(bob), 2_000n).send();
    expect(await balance(alice)).toBe(8_000n);
    expect(await balance(bob)).toBe(2_000n);
    expect(await usdt.root.state.allowed(key(alice), key(bob))).toBe(1_000n);

    // An infinite (MAX_UINT) allowance is not decremented.
    await as(alice).call.approve(key(bob), 0n).send();
    await as(alice).call.approve(key(bob), MAX_UINT).send();
    await as(bob).call.transferFrom(key(alice), key(bob), 500n).send();
    expect(await usdt.root.state.allowed(key(alice), key(bob))).toBe(MAX_UINT);
    expect(await balance(bob)).toBe(2_500n);

    // Pausable and BlackList gate transfers; destroyBlackFunds burns a blacklisted balance.
    await as(admin).call.pause().send();
    await refused(as(bob).call.transfer(key(alice), 1n));
    await as(admin).call.unpause().send();
    await as(admin).call.addBlackList(key(alice)).send();
    await refused(as(alice).call.transfer(key(bob), 1n));
    await refused(as(bob).call.transferFrom(key(alice), key(bob), 1n));
    await as(admin).call.destroyBlackFunds(key(alice)).send();
    await as(admin).call.removeBlackList(key(alice)).send();
    expect(await balance(alice)).toBe(0n);
    expect((await state())._totalSupply).toBe(992_500n);

    // Owner-only supply management.
    await refused(as(bob).call.issue(1n));
    await as(admin).call.issue(7_500n).send();
    await as(admin).call.redeem(2_500n).send();
    expect(await balance(admin)).toBe(5_000n);
    expect((await state())._totalSupply).toBe(997_500n);

    // The fee schedule: 10 bp capped at 5 whole tokens, credited to the owner.
    await as(admin).call.setParams(10n, 5n).send();
    expect(await state()).toMatchObject({ basisPointsRate: 10n, maximumFee: 5_000_000n });
    await as(bob).call.transfer(key(alice), 2_000n).send();
    expect(await balance(bob)).toBe(500n);
    expect(await balance(alice)).toBe(1_998n);
    expect(await balance(admin)).toBe(5_002n);

    // BchNative: CashTokens of the token's own bearer category back the ledger. Mocknet seeds the reserve that a
    // genesis premint would hold.
    const category = NATIVE_TEST_CATEGORY;
    const container = usdt.root.getTokenContainerAddress(category);
    await provider.addUtxo(container, {
      txid: 'c1'.repeat(32), vout: 0, satoshis: 1_200n, token: { category, amount: 1_000_000n },
    });
    const bearer = await provider.addUtxo(bob.getAddress(), {
      txid: 'c2'.repeat(32), vout: 0, satoshis: 100_000n, token: { category, amount: 300n },
    });
    const tokensAt = async (address: string): Promise<bigint> => (await provider.getUtxos(address))
      .reduce((sum, utxo) => sum + (utxo.token?.category === category ? utxo.token.amount : 0n), 0n);

    await as(bob).call.wrap(300n).addInput(bearer, bob.unlockP2PKH()).tokenContainerDeposit(category, 300n).send();
    expect(await balance(bob)).toBe(800n);
    expect((await state())._totalSupply).toBe(997_800n);
    expect(await tokensAt(container)).toBe(1_000_300n);

    await as(bob).call.unwrap(bob.getAddress(), 120n).send();
    expect(await balance(bob)).toBe(680n);
    expect((await state())._totalSupply).toBe(997_680n);
    expect(await tokensAt(container)).toBe(1_000_180n);
    expect(await tokensAt(bob.getAddress())).toBe(120n);

    // The owner pays out through the bearer boundary, which writes its balance once.
    await as(admin).call.unwrap(alice.getAddress(), 1_000n).send();
    expect(await balance(admin)).toBe(4_002n);
    expect(await tokensAt(alice.getAddress())).toBe(1_000n);
    expect(await tokensAt(container)).toBe(999_180n);

    // The boundary follows Tether's policy: no unwrap while paused or for a blacklisted holder.
    await as(admin).call.pause().send();
    await refused(as(bob).call.unwrap(bob.getAddress(), 1n));
    await as(admin).call.unpause().send();
    await as(admin).call.addBlackList(key(bob)).send();
    await refused(as(bob).call.unwrap(bob.getAddress(), 1n));
    await as(admin).call.removeBlackList(key(bob)).send();

    // Tether's own view functions read the ledger.
    const read = (call: unknown): Promise<bigint> => (call as { staticCall: () => Promise<bigint> }).staticCall();
    expect(await read(as(bob).call.balanceOf(key(bob)))).toBe(680n);
    expect(await read(as(bob).call.totalSupply())).toBe(996_680n);

    // Ownership moves on; the previous owner loses its rights; deprecation closes the wrap boundary.
    await as(admin).call.transferOwnership(key(successor)).send();
    await refused(as(admin).call.issue(1n));
    const coin = (txid: string): Promise<Utxo> => provider.addUtxo(alice.getAddress(), {
      txid, vout: 0, satoshis: 100_000n, token: { category, amount: 10n },
    });
    const wrapTen = (bearerCoin: Utxo): { send: () => Promise<unknown> } => as(alice).call.wrap(10n)
      .addInput(bearerCoin, alice.unlockP2PKH()).tokenContainerDeposit(category, 10n);
    await wrapTen(await coin('c3'.repeat(32))).send();
    expect(await balance(alice)).toBe(2_008n);
    await as(successor).call.deprecate(key(successor)).send();
    expect(await state()).toMatchObject({ deprecated: true });
    await refused(wrapTen(await coin('c4'.repeat(32))));
    expect(await balance(alice)).toBe(2_008n);
  }, 900_000);

  it('premints its reserve and publishes its registry through its facets, refusing before broadcasting', async () => {
    const split = compileFileSplit(nativeSource, options);
    const provider = new MockNetworkProvider();
    const [treasury, alice] = await provider.getSigners(2, { fundingUtxos: 8, genesisFundingUtxos: 8 });
    const coins = async (): Promise<string[]> => (await treasury.getUtxos())
      .map((utxo) => `${utxo.txid}:${utxo.vout}`).sort();
    const token = (await treasury.getUtxos()).find((utxo) => utxo.vout === 0)!;
    const factory = SplitContractBundle.from(split, treasury);
    const args = [1_000_000n, 'Tether USD', 'USDT', 6n, hexToBin(token.txid)];

    // totalSupply() is a facet's: the probe reads it through the facet, and a premint short of it broadcasts nothing.
    const before = await coins();
    await expect(factory.deploy(args, { nativeToken: { funding: token, reserve: 999_999n } }))
      .rejects.toThrow(/totalSupply\(\) of 1000000/);
    expect(await coins()).toEqual(before);

    const usdt = await factory.deploy(args, {
      nativeToken: { funding: token, reserve: 1_000_000n }, bcmr: { timestamp: TIMESTAMP },
    });
    const container = usdt.root.getTokenContainerAddress(token.txid);
    const { identities } = (usdt.root as DeployedContract).deploymentRegistry()!.registry;
    const snapshot = identities![token.txid]![TIMESTAMP]!;
    expect(snapshot.name).toBe('Tether USD');
    expect(snapshot.token).toEqual({ category: token.txid, symbol: 'USDT', decimals: 6 });
    expect(snapshot.extensions?.[NATIVE_TOKEN_EXTENSION]).toEqual({
      reserveLockingBytecode: binToHex(addressToLockScript(container)), scale: '1', ledgerSupply: 'totalSupply()',
    });
    expect(identities![usdt.categoryId]![TIMESTAMP]!.name).toBe('Tether USD contract');

    // The premint backs what the constructor credited: the owner unwraps through the facet that holds unwrap.
    const tokensAt = async (address: string): Promise<bigint> => (await provider.getUtxos(address))
      .reduce((sum, utxo) => sum + (utxo.token?.category === token.txid ? utxo.token.amount : 0n), 0n);
    expect(await tokensAt(container)).toBe(1_000_000n);
    await usdt.call.unwrap(alice.getAddress(), 1_000n).send();
    expect(await tokensAt(alice.getAddress())).toBe(1_000n);
    expect(await tokensAt(container)).toBe(999_000n);
    expect(await usdt.callStatic.totalSupply()).toBe(999_000n);
  }, 900_000);
});
