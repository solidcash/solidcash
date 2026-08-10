import { describe, expect, it } from 'vitest';
import { compileFile, compileFileSplit } from 'solidc';
import { asmToScript, scriptToBytecode } from '@solidcash/utils';
import {
  Contract, MockNetworkProvider, SignatureTemplate, Signer, StatefulContract,
} from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { getTokenContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { bobPriv } from '../fixture/vars.js';

const source = new URL('../../contracts/examples/MinimalNativeToken.scash', import.meta.url);

describe('MinimalNativeToken bytecode budget', () => {
  it('keeps full ERC20 allowances and immediate BchNative below 4.9 KB', () => {
    const artifact = compileFile(source, { messageBus: false });
    const artifactBytes = scriptToBytecode(asmToScript(artifact.bytecode)).length;
    expect(artifactBytes).toBe(4553);
    expect(artifact.constructorInputs).toEqual([]);
    expect(artifact.abi.find((entry) => entry.name === '__construct')).toBeUndefined();

    const abi = new Set(artifact.abi.map((entry) => entry.name));
    for (const name of [
      'transfer', 'approve', 'allowance', 'transferFrom',
      'wrap', 'withdraw',
    ]) expect(abi).toContain(name);
    for (const name of ['deposit', 'claimDeposit', 'cancelDeposit', '__updateBlockOracle']) {
      expect(abi).not.toContain(name);
    }
    expect(abi).not.toContain('setQuarantineBlocks');
    expect(abi).not.toContain('quarantineBlocks');
    expect(abi).not.toContain('name');
    expect(abi).not.toContain('symbol');
    expect(abi).not.toContain('decimals');
    expect(artifact.stateLayout?.variables.map((entry) => entry.name)).not.toContain('quarantineBlocks');
    expect(artifact.stateLayout?.variables.map((entry) => entry.name)).not.toContain('__block_number');
    expect(artifact.stateLayout?.collections.map((entry) => entry.name)).not.toContain('pendingDeposits');

    const deployed = new Contract(
      artifact,
      [],
      { provider: new MockNetworkProvider() },
    );
    expect(deployed.bytecode.length / 2).toBe(4553);

    expect(artifact.events.map((event) => event.name).sort()).toEqual(['Approval', 'Transfer']);

    const split = compileFileSplit(source, { messageBus: false });
    expect(Object.keys(split.facets)).toHaveLength(0);
  });

  it('mints ledger units on wrap and burns them on withdrawal', async () => {
    const artifact = compileFile(source, { messageBus: false });
    const provider = createTestProvider();
    const inner = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {
      _totalSupply: 0n,
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
    const bobLedgerAddress = addressToLockScript(bob.getAddress());
    const bearer = {
      txid: 'e1'.repeat(32), vout: 0, satoshis: 100_000n,
      token: { category: setup.categoryId, amount: 5n },
    };
    await provider.addUtxo(bob.getAddress(), bearer);
    await provider.addUtxo(bob.getAddress(), {
      txid: 'e2'.repeat(32), vout: 0, satoshis: 500_000n,
    });
    await token.connect(bob).call.wrap(5n)
      .addInput(bearer, new SignatureTemplate(bobPriv).unlockP2PKH())
      .tokenContainerDeposit(setup.categoryId, 5n)
      .send();
    expect(await token.state._balances(bobLedgerAddress)).toBe(5n);
    expect((await token.getState())._totalSupply).toBe(5n);

    await provider.addUtxo(bob.getAddress(), {
      txid: 'e3'.repeat(32), vout: 0, satoshis: 500_000n,
    });
    await token.connect(bob).call.withdraw(bob.getAddress(), 5n).send();
    expect(await token.state._balances(bobLedgerAddress)).toBe(0n);
    expect((await token.getState())._totalSupply).toBe(0n);
    const bearerBalance = (await provider.getUtxos(bob.getAddress()))
      .filter((utxo) => utxo.token?.category === setup.categoryId)
      .reduce((sum, utxo) => sum + (utxo.token?.amount ?? 0n), 0n);
    expect(bearerBalance).toBe(5n);
  });
});
