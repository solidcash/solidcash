import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { compileFile } from 'solidc';
import { asmToScript, scriptToBytecode } from '@solidcash/utils';
import {
  Contract,
  SignatureTemplate,
  Signer,
} from '../../src/index.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { getTokenContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { bobPriv } from '../fixture/vars.js';

const source = new URL('../fixture/bch_native_multiplier_token.scash', import.meta.url);

// MultiplierToken is ERC20, BchNative, BchNativeMultiplier(100): one native
// CashToken base unit backs 100 ERC20 ledger units.
describe('BchNativeMultiplier', () => {
  it('compiles the scaled boundary with a write-once immutable multiplier', () => {
    const artifact = compileFile(source, { messageBus: false });
    const artifactBytes = scriptToBytecode(asmToScript(artifact.bytecode)).length;
    // The scale layer adds the % / / conversion and the immutable read to wrap and
    // unwrap; it stays well inside the P2SH32 input-script budget.
    expect(artifactBytes).toBeLessThan(7_500);
    expect(artifact.constructorInputs).toEqual([]);
    // The immutable must be written at construction, so a constructor entry exists
    // even though it takes no runtime arguments (the scale factor is baked in).
    const construct = artifact.abi.find((entry) => entry.name === '__construct');
    expect(construct).toBeDefined();
    expect(construct?.inputs).toEqual([]);

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
    }, {
      saltContract: true,
      extraOutputs: (category) => [{
        // The container binds the master lock, which is the category-pinned contract's.
        address: getTokenContainerAddress(inner.withCategory(hexToBin(category)), category, category),
        satoshis: 1_200n,
        token: { amount: 1_000n },
      }, {
        address: bob.getAddress(), satoshis: 100_000n, token: { amount: 5n },
      }],
    });
    const token = StatefulContract.withCategory(inner, setup.categoryId);
    const bobLedgerAddress = addressToLockScript(bob.getAddress());
    const bearer = setup.extraUtxos![1];

    // Five native base units, presented against wrap(500), deposit into the
    // reserve container and credit 500 ledger units through the x100 scale.
    await provider.addUtxo(bob.getAddress(), {
      txid: 'e2'.repeat(32), vout: 0, satoshis: 500_000n,
    });
    await token.connect(bob).call.wrap(500n)
      .addInput(bearer, new SignatureTemplate(bobPriv).unlockP2PKH())
      .tokenContainerDeposit(setup.categoryId, 5n)
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
      .filter((utxo) => utxo.token?.category === setup.categoryId)
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
    }, {
      saltContract: true,
      extraOutputs: (category) => [{
        // The container binds the master lock, which is the category-pinned contract's.
        address: getTokenContainerAddress(inner.withCategory(hexToBin(category)), category, category),
        satoshis: 1_200n,
        token: { amount: 1_000n },
      }, {
        address: bob.getAddress(), satoshis: 100_000n, token: { amount: 5n },
      }],
    });
    const token = StatefulContract.withCategory(inner, setup.categoryId);
    const bearer = setup.extraUtxos![1];

    // 5 % 100 != 0, so the boundary refuses before any reserve movement.
    await provider.addUtxo(bob.getAddress(), {
      txid: 'e4'.repeat(32), vout: 0, satoshis: 500_000n,
    });
    await expect(token.connect(bob).call.wrap(5n)
      .addInput(bearer, new SignatureTemplate(bobPriv).unlockP2PKH())
      .tokenContainerDeposit(setup.categoryId, 5n)
      .send()).rejects.toThrow();
  });
});
