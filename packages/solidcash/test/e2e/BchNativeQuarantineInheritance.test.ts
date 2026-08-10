import { describe, expect, it } from 'vitest';
import { compileFile } from 'solidc';
import { URL } from 'url';
import type { Utxo } from '../../src/interfaces.js';
import {
  Contract, SignatureTemplate, Signer, StatefulContract,
} from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';
import {
  createTestProvider, plainNumerics, setupStatefulUtxos,
} from '../test-util.js';
import { getTokenContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { alicePub, bobPriv } from '../fixture/vars.js';

const source = new URL('../fixture/bch_native_quarantine_token.scash', import.meta.url);

describe('BchNativeQuarantine inheritance', () => {
  it('adds pending state and oracle timing only when explicitly inherited', async () => {
    const artifact = compileFile(source, { messageBus: false });
    const abi = new Set(artifact.abi.map((entry) => entry.name));
    for (const name of ['wrap', 'withdraw', 'deposit', 'claimDeposit', 'cancelDeposit', '__updateBlockOracle']) {
      expect(abi).toContain(name);
    }
    expect(artifact.stateLayout?.collections.map((entry) => entry.name)).toContain('pendingDeposits');
    expect(artifact.stateLayout?.variables.map((entry) => entry.name)).toContain('__block_number');

    const provider = createTestProvider();
    const inner = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {
      _totalSupply: 0n,
      backedSupply: 0n,
      __block_number: 133_700n,
      __blockOracleOwner: alicePub,
    }, {
      saltContract: true,
      extraOutputs: (category) => [{
        address: getTokenContainerAddress(inner, category, category),
        satoshis: 1_200n,
        token: { amount: 1_000n },
      }],
    });
    const token = StatefulContract.withCategory(inner, setup.categoryId);
    const bob = new Signer(bobPriv, provider);
    await provider.addUtxo(bob.getAddress(), {
      txid: 'd1'.repeat(32), vout: 0, satoshis: 500_000n,
    });
    await token.connect(bob).call.openSelf().send();

    const coin: Utxo = {
      txid: 'd2'.repeat(32), vout: 0, satoshis: 100_000n,
      token: { category: setup.categoryId, amount: 5n },
    };
    await provider.addUtxo(bob.getAddress(), coin);
    await provider.addUtxo(bob.getAddress(), {
      txid: 'd3'.repeat(32), vout: 0, satoshis: 500_000n,
    });
    await token.connect(bob).call.deposit(5n)
      .addInput(coin, new SignatureTemplate(bobPriv).unlockP2PKH())
      .tokenContainerDeposit(setup.categoryId, 5n)
      .send();

    const bobAddress = addressToLockScript(bob.getAddress());
    expect(await token.state.pendingDeposits(bobAddress)).toMatchObject({
      amount: 5n, unlockAt: 133_700n,
    });
    expect(plainNumerics(await token.getState()).backedSupply).toBe(5n);
  });
});
