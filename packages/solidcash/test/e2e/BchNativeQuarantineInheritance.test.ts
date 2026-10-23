import {
  beforeAll, describe, expect, it,
} from 'vitest';
import { compileFile } from '@solidcash/solidc';
import { hexToBin } from '@bitauth/libauth';
import { URL } from 'url';
import type { Utxo } from '../../src/interfaces.js';
import {
  Contract,
  SignatureTemplate,
  Signer,
} from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import {
  NATIVE_TEST_CATEGORY, createTestProvider, plainNumerics, seedNativeToken, setupStatefulUtxos,
} from '../test-util.js';
import type { MockNetworkProvider } from '../../src/network/mock/index.js';
import { bobPriv } from '../fixture/vars.js';
import type { Artifact } from '@solidcash/utils';

const source = new URL('../fixture/bch_native_quarantine_token.scash', import.meta.url);
let artifact: Artifact;

beforeAll(() => {
  artifact = compileFile(source, { messageBus: false }) as Artifact;
});

describe('BchNativeQuarantine inheritance', () => {
  it('adds pending state and oracle timing only when explicitly inherited', () => {
    const abi = new Set(artifact.abi.map((entry) => entry.name));
    for (const name of ['wrap', 'unwrap', 'deposit', 'claimDeposit', 'cancelDeposit']) {
      expect(abi).toContain(name);
    }
    expect(abi).not.toContain('__updateBlockOracle');
    expect(artifact.usesBlockOracle).toBe(true);
    expect(artifact.stateLayout?.collections.map((entry) => entry.name)).toContain('pendingDeposits');
    expect(artifact.stateLayout?.variables.map((entry) => entry.name)).not.toContain('__block_number');
  });

  // QuarantineToken's 11,866-byte redeem script is consensus-impossible without splitting. Its structural
  // inheritance contract remains live above; this intentionally unsplit behavioral fixture is mock-only.
  it.skipIf(Boolean(process.env.TESTS_USE_REGTEST))('executes the inherited deposit behavior', async () => {
    const provider = createTestProvider();
    const inner = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {
      _totalSupply: 0n,
      backedSupply: 0n,
      _nativeCategory: hexToBin(NATIVE_TEST_CATEGORY),
    }, { saltContract: true });
    // The container binds the master lock, which is the category-pinned contract's.
    await seedNativeToken(provider as MockNetworkProvider, inner.withCategory(hexToBin(setup.categoryId)),
      setup.categoryId, { reserve: 1_000n });
    const token = StatefulContract.withCategory(inner, setup.categoryId);
    const bob = new Signer(bobPriv, provider);
    await provider.addUtxo(bob.getAddress(), {
      txid: 'd1'.repeat(32), vout: 0, satoshis: 500_000n,
    });
    await token.connect(bob).call.openSelf().send();

    const coin: Utxo = {
      txid: 'd2'.repeat(32), vout: 0, satoshis: 100_000n,
      token: { category: NATIVE_TEST_CATEGORY, amount: 5n },
    };
    await provider.addUtxo(bob.getAddress(), coin);
    await provider.addUtxo(bob.getAddress(), {
      txid: 'd3'.repeat(32), vout: 0, satoshis: 500_000n,
    });
    await token.connect(bob).call.deposit(5n)
      .addInput(coin, new SignatureTemplate(bobPriv).unlockP2PKH())
      .tokenContainerDeposit(NATIVE_TEST_CATEGORY, 5n)
      .send();

    const bobAddress = addressToLockScript(bob.getAddress());
    expect(await token.state.pendingDeposits(bobAddress)).toMatchObject({
      amount: 5n, unlockAt: 133_700n,
    });
    expect(plainNumerics(await token.getState()).backedSupply).toBe(5n);
  });
});
