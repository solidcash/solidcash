import { describe, expect, it } from 'vitest';
import { compileFile, compileFileSplit, compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import {
  asmToScript, bytecodeToScript, decodeInt, Op, scriptToBytecode,
} from '@solidcash/utils';
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
import { alicePriv, bobPriv } from '../fixture/vars.js';

const source = new URL('../../contracts/examples/MinimalNativeToken.scash', import.meta.url);

describe('MinimalNativeToken bytecode budget', () => {
  it('keeps full ERC20 allowances and immediate BchNative below 8 KB', () => {
    const artifact = compileFile(source, { messageBus: false });
    const artifactBytes = scriptToBytecode(asmToScript(artifact.bytecode)).length;
    // Pinned to the build with the per-entry covenant hardening, its checks, return and event pins and one-target
    // transitions shared as one helper each, re-measured at feat/per-call-fix ac92c7446 after the merged slot passes
    // (7503 -> 7500), then with present-entry checks, deep rotations and constant struct defaults shared or folded
    // (7500 -> 7473); the 8 KB title stays the budget.
    expect(artifactBytes).toBe(7473);
    expect(artifact.constructorInputs).toEqual([]);
    expect(artifact.abi.find((entry) => entry.name === '__construct')).toBeUndefined();

    const abi = new Set(artifact.abi.map((entry) => entry.name));
    for (const name of [
      'transfer', 'approve', 'allowance', 'transferFrom',
      'wrap', 'unwrap',
    ]) expect(abi).toContain(name);
    for (const name of ['deposit', 'claimDeposit', 'cancelDeposit']) {
      expect(abi).not.toContain(name);
    }
    // Immediate BchNative has no quarantine timing, so it reads no block oracle and has no lock pin to bind.
    expect(artifact.usesBlockOracle).toBeUndefined();
    expect(artifact.blockOracleLockSlots).toBeUndefined();
    expect(abi).not.toContain('setQuarantineBlocks');
    expect(abi).not.toContain('quarantineBlocks');
    expect(abi).not.toContain('name');
    expect(abi).not.toContain('symbol');
    expect(abi).not.toContain('decimals');
    expect(artifact.stateLayout?.variables.map((entry) => entry.name)).not.toContain('quarantineBlocks');
    expect(artifact.stateLayout?.collections.map((entry) => entry.name)).not.toContain('pendingDeposits');

    const deployed = new Contract(
      artifact,
      [],
      { provider: new MockNetworkProvider() },
    );
    // The deployed locking bytecode tracks the artifact bytecode above.
    expect(deployed.bytecode.length / 2).toBe(7473);

    expect(artifact.events.map((event) => event.name).sort()).toEqual(['Approval', 'Transfer']);

    const split = compileFileSplit(source, { messageBus: false });
    expect(Object.keys(split.facets)).toHaveLength(0);
  });

  it('mints ledger units on wrap and burns them on unwrap', async () => {
    const artifact = compileFile(source, { messageBus: false });
    const provider = createTestProvider();
    const bob = new Signer(bobPriv, provider);
    const inner = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {
      _totalSupply: 0n,
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
    await token.connect(bob).call.unwrap(bob.getAddress(), 5n).send();
    expect(await token.state._balances(bobLedgerAddress)).toBe(0n);
    expect((await token.getState())._totalSupply).toBe(0n);
    const bearerBalance = (await provider.getUtxos(bob.getAddress()))
      .filter((utxo) => utxo.token?.category === setup.categoryId)
      .reduce((sum, utxo) => sum + (utxo.token?.amount ?? 0n), 0n);
    expect(bearerBalance).toBe(5n);
  });

  it('shares integer mapping reads without changing allowance spends', async () => {
    const artifact = compileFile(source, { messageBus: false });
    expect(artifact.debug.invokeDebug?.['-18']?.name).toBe('compiler helper -18');
    const transferFrom = artifact.abi.find((entry) => entry.name === 'transferFrom')!;
    const body = bytecodeToScript(hexToBin(artifact.functionBodies![transferFrom.selector]));
    const readInvokes = body.filter((opcode, index) => opcode === Op.OP_INVOKE
      && body[index - 1] instanceof Uint8Array && decodeInt(body[index - 1] as Uint8Array) === -18n);
    expect(readInvokes.length).toBeGreaterThanOrEqual(1);
    const delegate = compileString(
      'library ReadFacet { mapping(bytes20=>uint256) balances;'
      + ' function f(bytes20 a, bytes20 b, bytes20 c) public {'
      + ' require(this.balances[a] == this.balances[b] || this.balances[c] == 0); } }',
      { brandLibrary: true, messageBus: false },
    );
    expect(delegate.debug.invokeDebug?.['-18']?.name).not.toBe('compiler helper -18');

    const provider = createTestProvider();
    const alice = new Signer(alicePriv, provider);
    const bob = new Signer(bobPriv, provider);
    const inner = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {
      _totalSupply: 0n,
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
    let nonce = 0xe4;
    const fund = async (signer: Signer): Promise<void> => {
      nonce += 1;
      await provider.addUtxo(signer.getAddress(), {
        txid: nonce.toString(16).padStart(64, 'e'), vout: 0, satoshis: 500_000n,
      });
    };
    await fund(bob);
    await token.connect(bob).call.wrap(5n)
      .addInput(setup.extraUtxos![1], new SignatureTemplate(bobPriv).unlockP2PKH())
      .tokenContainerDeposit(setup.categoryId, 5n)
      .send();

    const aliceLedger = addressToLockScript(alice.getAddress());
    const bobLedger = addressToLockScript(bob.getAddress());
    await fund(bob);
    await token.connect(bob).call.approve(aliceLedger, 2n).send();
    await fund(alice);
    await token.connect(alice).call.transferFrom(bobLedger, aliceLedger, 2n).send();
    expect(await token.state._allowances(bobLedger, aliceLedger)).toBe(0n);
    expect(await token.state._balances(bobLedger)).toBe(3n);
    expect(await token.state._balances(aliceLedger)).toBe(2n);
  });
});
