import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { compileFile } from '@solidcash/solidc';
import { asmToScript, scriptToBytecode } from '@solidcash/utils';
import {
  Contract,
  SignatureTemplate,
  Signer,
} from '../../src/index.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import {
  NATIVE_TEST_CATEGORY, createTestProvider, seedNativeToken, setupStatefulUtxos,
} from '../test-util.js';
import { bobPriv } from '../fixture/vars.js';

const source = new URL('../fixture/bch_native_multiplier_token.scash', import.meta.url);

// MultiplierToken is ERC20, BchNative, BchNativeMultiplier(100): one native
// CashToken base unit backs 100 ERC20 ledger units.
describe('BchNativeMultiplier', () => {
  it('compiles the scaled boundary with a write-once immutable multiplier', () => {
    const artifact = compileFile(source, { messageBus: false });
    const artifactBytes = scriptToBytecode(asmToScript(artifact.bytecode)).length;
    // The scale layer adds the % / / conversion and the immutable read to wrap and
    // unwrap through BchNative's scale hook; it stays well inside the P2SH32
    // input-script budget (8_636 after the 10-14..10-17 hardening, 8_750 with
    // BchNative's own bearer category, 8_811 with the bound on what a named minting
    // container mints, security NAMED-MINT-1, 7_568 with always-run sorted writes
    // laid out unconditionally, 7_618 with the containers' destroy arm, 7_514 once
    // only a master that can retire carries it, and 7_513 with the scale as an
    // override of BchNative's `_nativeAmount` hook).
    expect(artifactBytes).toBeLessThan(7_700);
    expect(artifact.constructorInputs).toEqual([]);
    // The immutables are written at construction: the scale factor is baked in, and the
    // bearer category is the constructor's one argument.
    const construct = artifact.abi.find((entry) => entry.name === '__construct');
    expect(construct?.inputs.map((input) => input.name)).toEqual(['nativeCategory_']);

    const abi = new Set(artifact.abi.map((entry) => entry.name));
    for (const name of ['transfer', 'approve', 'allowance', 'transferFrom', 'wrap', 'unwrap']) {
      expect(abi).toContain(name);
    }
    for (const name of ['deposit', 'claimDeposit', 'cancelDeposit']) {
      expect(abi).not.toContain(name);
    }
    const multiplierVar = artifact.stateLayout?.variables.find((entry) => entry.name === '_nativeMultiplier');
    expect(multiplierVar?.immutable).toBe(true);
    expect(artifact.events.map((event) => event.name).sort()).toEqual(['Approval', 'Transfer']);

    const deployed = new Contract(artifact, [], { provider: new MockNetworkProvider() });
    expect(deployed.bytecode.length / 2).toBe(artifactBytes);
  });

  it('scales wrap and unwrap: 500 ledger units bridge 5 native CashTokens', async () => {
    const artifact = compileFile(source, { messageBus: false });
    const provider = createTestProvider();
    const bob = new Signer(bobPriv, provider);
    const inner = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {
      _totalSupply: 0n,
      _nativeMultiplier: 100n,
      _nativeCategory: hexToBin(NATIVE_TEST_CATEGORY),
    }, { saltContract: true });
    // The container binds the master lock, which is the category-pinned contract's.
    const native = await seedNativeToken(
      provider as MockNetworkProvider, inner.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
      { reserve: 1_000n, holders: [{ address: bob.getAddress(), amount: 5n }] },
    );
    const token = StatefulContract.withCategory(inner, setup.categoryId);
    const bobLedgerAddress = addressToLockScript(bob.getAddress());
    const bearer = native.holders[0]!;

    // Five native base units, presented against wrap(500), deposit into the
    // reserve container and credit 500 ledger units through the x100 scale.
    await provider.addUtxo(bob.getAddress(), {
      txid: 'e2'.repeat(32), vout: 0, satoshis: 500_000n,
    });
    await token.connect(bob).call.wrap(500n)
      .addInput(bearer, new SignatureTemplate(bobPriv).unlockP2PKH())
      .tokenContainerDeposit(NATIVE_TEST_CATEGORY, 5n)
      .send();
    expect(await token.state._balances(bobLedgerAddress)).toBe(500n);
    expect((await token.getState())._totalSupply).toBe(500n);

    // unwrap(500) burns the ledger units and returns 5 native base units.
    await provider.addUtxo(bob.getAddress(), {
      txid: 'e3'.repeat(32), vout: 0, satoshis: 500_000n,
    });
    await token.connect(bob).call.unwrap(bob.getAddress(), 500n).send();
    expect(await token.state._balances(bobLedgerAddress)).toBe(0n);
    expect((await token.getState())._totalSupply).toBe(0n);
    const bearerBalance = (await provider.getUtxos(bob.getAddress()))
      .filter((utxo) => utxo.token?.category === NATIVE_TEST_CATEGORY)
      .reduce((sum, utxo) => sum + (utxo.token?.amount ?? 0n), 0n);
    expect(bearerBalance).toBe(5n);
  });

  it('rejects boundary amounts that are not an exact multiple of the multiplier', async () => {
    const artifact = compileFile(source, { messageBus: false });
    const provider = createTestProvider();
    const bob = new Signer(bobPriv, provider);
    const inner = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {
      _totalSupply: 0n,
      _nativeMultiplier: 100n,
      _nativeCategory: hexToBin(NATIVE_TEST_CATEGORY),
    }, { saltContract: true });
    // The container binds the master lock, which is the category-pinned contract's.
    const native = await seedNativeToken(
      provider as MockNetworkProvider, inner.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
      { reserve: 1_000n, holders: [{ address: bob.getAddress(), amount: 5n }] },
    );
    const token = StatefulContract.withCategory(inner, setup.categoryId);
    const bearer = native.holders[0]!;

    // 5 % 100 != 0, so the boundary refuses before any reserve movement.
    await provider.addUtxo(bob.getAddress(), {
      txid: 'e4'.repeat(32), vout: 0, satoshis: 500_000n,
    });
    await expect(token.connect(bob).call.wrap(5n)
      .addInput(bearer, new SignatureTemplate(bobPriv).unlockP2PKH())
      .tokenContainerDeposit(NATIVE_TEST_CATEGORY, 5n)
      .send()).rejects.toThrow();
  });
});
