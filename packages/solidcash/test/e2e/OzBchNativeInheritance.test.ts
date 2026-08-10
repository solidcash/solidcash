import {
  beforeAll, describe, expect, it,
} from 'vitest';
import { compileFile } from 'solidc';
import { asmToScript, scriptToBytecode, type Artifact } from '@solidcash/utils';
import type { Utxo } from '../../src/interfaces.js';
import {
  Contract, SignatureTemplate, Signer, StatefulContract,
} from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { getTokenContainerAddress } from '../../src/stateful/covenant-helpers.js';
import {
  aliceAddress, alicePriv, bobPriv,
} from '../fixture/vars.js';

const source = new URL('../fixture/oz_bch_native_token.sol', import.meta.url);
let artifact: Artifact;

beforeAll(() => {
  artifact = compileFile(source, {
    solidityImportCompat: true,
    messageBus: false,
  }) as Artifact;
});

describe('BchNative with npm OpenZeppelin ERC20', () => {
  it('composes with the unmodified OZ 5.0.2 implementation below 6 KB', () => {
    expect(scriptToBytecode(asmToScript(artifact.bytecode)).length).toBe(5969);
    expect(artifact.contractName).toBe('OzNativeToken');
    const abi = new Set(artifact.abi.map((entry) => entry.name));
    for (const name of [
      'name', 'symbol', 'decimals', 'totalSupply', 'balanceOf',
      'transfer', 'approve', 'allowance', 'transferFrom', 'wrap', 'withdraw',
    ]) expect(abi).toContain(name);
    expect(artifact.stateLayout?.variables.map((entry) => entry.name))
      .toEqual(['_totalSupply', '_name', '_symbol']);
    expect(artifact.stateLayout?.collections.map((entry) => entry.name))
      .toEqual(['_balances', '_allowances']);
  });

  it('wraps, transfers, spends allowance, and unwraps through OZ storage', async () => {
    const provider = createTestProvider();
    const inner = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {
      _totalSupply: 0n,
      _name: '',
      _symbol: '',
    }, {
      saltContract: true,
      extraOutputs: (category) => [{
        address: getTokenContainerAddress(inner, category, category),
        satoshis: 1_200n,
        token: { amount: 1_000n },
      }],
    });
    const token = StatefulContract.withCategory(inner, setup.categoryId);
    const alice = new Signer(alicePriv, provider);
    const bob = new Signer(bobPriv, provider);
    let nonce = 0xf0;
    const fund = async (signer: Signer): Promise<void> => {
      nonce += 1;
      await provider.addUtxo(signer.getAddress(), {
        txid: nonce.toString(16).padStart(64, 'f'), vout: 0, satoshis: 500_000n,
      });
    };
    const bearer: Utxo = {
      txid: 'f1'.repeat(32), vout: 0, satoshis: 100_000n,
      token: { category: setup.categoryId, amount: 5n },
    };
    await provider.addUtxo(bob.getAddress(), bearer);
    await fund(bob);
    await token.connect(bob).call.wrap(5n)
      .addInput(bearer, new SignatureTemplate(bobPriv).unlockP2PKH())
      .tokenContainerDeposit(setup.categoryId, 5n)
      .send();

    const aliceLedger = addressToLockScript(aliceAddress);
    const bobLedger = addressToLockScript(bob.getAddress());
    expect(await token.state._balances(bobLedger)).toBe(5n);
    expect((await token.getState())._totalSupply).toBe(5n);

    await fund(bob);
    await token.connect(bob).call.transfer(aliceLedger, 1n).send();
    expect(await token.state._balances(bobLedger)).toBe(4n);
    expect(await token.state._balances(aliceLedger)).toBe(1n);

    await fund(bob);
    await token.connect(bob).call.approve(aliceLedger, 2n).send();
    expect(await token.state._allowances(bobLedger, aliceLedger)).toBe(2n);

    await fund(alice);
    await token.connect(alice).call.transferFrom(bobLedger, aliceLedger, 2n).send();
    expect(await token.state._balances(bobLedger)).toBe(2n);
    expect(await token.state._balances(aliceLedger)).toBe(3n);
    expect(await token.state._allowances(bobLedger, aliceLedger)).toBe(0n);

    await fund(bob);
    await token.connect(bob).call.withdraw(bob.getAddress(), 2n).send();
    expect(await token.state._balances(bobLedger)).toBe(0n);
    expect((await token.getState())._totalSupply).toBe(3n);
    const bearerBalance = (await provider.getUtxos(bob.getAddress()))
      .filter((utxo) => utxo.token?.category === setup.categoryId)
      .reduce((sum, utxo) => sum + (utxo.token?.amount ?? 0n), 0n);
    expect(bearerBalance).toBe(2n);
  });
});
