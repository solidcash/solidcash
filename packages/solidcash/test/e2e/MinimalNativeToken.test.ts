import { describe, expect, it } from 'vitest';
import { compileFile, compileFileSplit, compileString } from '@solidcash/solidc';
import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  asmToScript, buildTokenContainerCovenantScript, bytecodeToScript, decodeInt, Op, scriptToBytecode,
} from '@solidcash/utils';
import {
  Contract,
  SignatureTemplate,
  Signer,
  TransactionBuilder,
} from '../../src/index.js';
import { directConventionMasterLock, getTokenContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { createUnlockingBytecode } from '../../src/utils.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import {
  NATIVE_TEST_CATEGORY, createTestProvider, seedNativeToken, setupStatefulUtxos,
} from '../test-util.js';
import { alicePriv, bobPriv, bobTokenAddress } from '../fixture/vars.js';

const source = new URL('../../contracts/examples/MinimalNativeToken.scash', import.meta.url);

describe('MinimalNativeToken bytecode budget', () => {
  it('keeps full ERC20 allowances and immediate BchNative below 8.5 KB', () => {
    const artifact = compileFile(source, { messageBus: false });
    const artifactBytes = scriptToBytecode(asmToScript(artifact.bytecode)).length;
    // Pinned to the build with the per-entry covenant hardening, its checks, return and event pins and one-target
    // transitions shared as one helper each, re-measured at feat/per-call-fix ac92c7446 after the merged slot passes
    // (7503 -> 7500), then with present-entry checks, deep rotations and constant struct defaults shared or folded
    // (7500 -> 7473). The 10-14..10-17 hardening (per-call merges, minted-root bindings, the direct outside-layout
    // walk) then added 897 B (7473 -> 8370), and BchNative's own bearer category (its immutable and the constructor
    // that sets it) 201 B (8370 -> 8571). The container covenant it derives lost its merge path (8571 -> 8524), its
    // keep of an unnamed container refuses a minting NFT (8524 -> 8544), and each named slot bounds the mints of a
    // minting container (8544 -> 8632). Laying always-run sorted writes out unconditionally, with the direct
    // outside-layout walk shared, took 1,197 B off (8632 -> 7435); the 8.5 KB title is the budget.
    // The container master pin's selfdestruct arm (no master recreated) added 50 B (7435 -> 7485).
    // Only a master that can retire (a selfdestruct entry) carries that arm; this one cannot: 7374 B over 2286a2d7c.
    // The C3 count-path record pin (each own-category record held at its own index) added 54 B (7374 -> 7428), and
    // BchNative's `_nativeAmount` scale hook, which wrap and unwrap share as one function, with the exact reserve
    // growth wrap checks, 17 B (7428 -> 7445). Call records (D50: each returning entry digests its call and pins
    // its record, with one shared count of its carriers) added 154 B (7445 -> 7599).
    expect(artifactBytes).toBe(7599);
    expect(artifact.constructorInputs).toEqual([]);
    expect(artifact.abi.find((entry) => entry.name === '__construct')?.inputs.map((input) => input.name))
      .toEqual(['nativeCategory_']);

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
    expect(deployed.bytecode.length / 2).toBe(artifactBytes);

    expect(artifact.events.map((event) => event.name).sort()).toEqual(['Approval', 'Transfer']);

    const split = compileFileSplit(source, { messageBus: false });
    expect(Object.keys(split.facets)).toHaveLength(0);
  });

  it('refuses a token container spend without its master: the container has no merge path', async () => {
    const artifact = compileFile(source, { messageBus: false });
    const provider = createTestProvider();
    const bob = new Signer(bobPriv, provider);
    const inner = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {
      _totalSupply: 0n, _nativeCategory: hexToBin(NATIVE_TEST_CATEGORY),
    }, { saltContract: true });
    const master = inner.withCategory(hexToBin(setup.categoryId));
    const { reserve } = await seedNativeToken(
      provider as MockNetworkProvider, master, setup.categoryId, { reserve: 1_000n },
    );
    const coin = { txid: 'e6'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.addUtxo(bob.getAddress(), coin);
    const covenant = scriptToBytecode(buildTokenContainerCovenantScript(
      hexToBin(setup.categoryId), hexToBin(NATIVE_TEST_CATEGORY), directConventionMasterLock(master),
    ));
    const containerLock = addressToLockScript(getTokenContainerAddress(master, setup.categoryId, NATIVE_TEST_CATEGORY));
    // `<merge output 0> <flag 0>`: the reserve kept whole at output 0, which a merge path admitted.
    const unlocking = createUnlockingBytecode('p2sh32', covenant, [Uint8Array.of(), Uint8Array.of()]);
    const outcome = await new TransactionBuilder({ provider })
      .addInput(reserve, {
        generateLockingBytecode: () => containerLock, generateUnlockingBytecode: () => unlocking,
      } as never)
      .addInput(coin, new SignatureTemplate(bobPriv).unlockP2PKH())
      .addOutput({ to: containerLock, amount: reserve.satoshis, token: reserve.token })
      .addOutput({ to: bob.getAddress(), amount: 490_000n })
      .send()
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expect(outcome).not.toBe('ACCEPTED');
    expect(outcome).toContain('input index 0');
  });

  it('mints ledger units on wrap and burns them on unwrap', async () => {
    const artifact = compileFile(source, { messageBus: false });
    const provider = createTestProvider();
    const bob = new Signer(bobPriv, provider);
    const inner = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {
      _totalSupply: 0n, _nativeCategory: hexToBin(NATIVE_TEST_CATEGORY),
    }, { saltContract: true });
    // The container binds the master lock, which is the category-pinned contract's.
    const native = await seedNativeToken(
      provider as MockNetworkProvider, inner.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
      { reserve: 1_000n, holders: [{ address: bob.getAddress(), amount: 5n }] },
    );
    const token = StatefulContract.withCategory(inner, setup.categoryId);
    const bobLedgerAddress = addressToLockScript(bob.getAddress());
    const bearer = native.holders[0]!;
    await provider.addUtxo(bob.getAddress(), {
      txid: 'e2'.repeat(32), vout: 0, satoshis: 500_000n,
    });
    await token.connect(bob).call.wrap(5n)
      .addInput(bearer, new SignatureTemplate(bobPriv).unlockP2PKH())
      .tokenContainerDeposit(NATIVE_TEST_CATEGORY, 5n)
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
      .filter((utxo) => utxo.token?.category === NATIVE_TEST_CATEGORY)
      .reduce((sum, utxo) => sum + (utxo.token?.amount ?? 0n), 0n);
    expect(bearerBalance).toBe(5n);
  });

  it('deploys a bearer supply of its own category, which a first wrap admits into a new container', async () => {
    const artifact = compileFile(source, { messageBus: false });
    const provider = createTestProvider();
    const bob = new Signer(bobPriv, provider);
    const fundingUtxo = { txid: 'f1'.repeat(32), vout: 0, satoshis: 3_000_000n };
    const tokenFunding = { txid: 'f2'.repeat(32), vout: 0, satoshis: 100_000n };
    await provider.addUtxo(bob.getAddress(), fundingUtxo);
    await provider.addUtxo(bob.getAddress(), tokenFunding);
    const category = tokenFunding.txid;
    const { contract: token, tx } = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder: bob.unlockP2PKH(), changeAddress: bob.getAddress(),
      initArgs: [hexToBin(category)],
      nativeToken: { funding: tokenFunding, bearer: { amount: 1_000n, to: bobTokenAddress } },
    });
    // The genesis mints the whole supply to bob and premints no reserve, so no container exists yet.
    const vout = tx.outputs.findIndex((output) => output.token !== undefined
      && binToHex(output.token.category) === category);
    expect(tx.outputs[vout]!.token!.amount).toBe(1_000n);
    const bearer = {
      txid: tx.txid, vout, satoshis: tx.outputs[vout]!.valueSatoshis, token: { category, amount: 1_000n },
    };
    await provider.addUtxo(bob.getAddress(), { txid: 'e4'.repeat(32), vout: 0, satoshis: 500_000n });
    await token.connect(bob).call.wrap(1_000n)
      .addInput(bearer, new SignatureTemplate(bobPriv).unlockP2PKH())
      .tokenContainerDeposit(category, 1_000n)
      .send();
    const bobLedgerAddress = addressToLockScript(bob.getAddress());
    expect(await token.state._balances(bobLedgerAddress)).toBe(1_000n);

    await provider.addUtxo(bob.getAddress(), { txid: 'e5'.repeat(32), vout: 0, satoshis: 500_000n });
    await token.connect(bob).call.unwrap(bob.getAddress(), 400n).send();
    expect(await token.state._balances(bobLedgerAddress)).toBe(600n);
    expect((await token.getState())._totalSupply).toBe(600n);
    const bearerBalance = (await provider.getUtxos(bob.getAddress()))
      .filter((utxo) => utxo.token?.category === category)
      .reduce((sum, utxo) => sum + (utxo.token?.amount ?? 0n), 0n);
    expect(bearerBalance).toBe(400n);
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
      _totalSupply: 0n, _nativeCategory: hexToBin(NATIVE_TEST_CATEGORY),
    }, { saltContract: true });
    // The container binds the master lock, which is the category-pinned contract's.
    const native = await seedNativeToken(
      provider as MockNetworkProvider, inner.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
      { reserve: 1_000n, holders: [{ address: bob.getAddress(), amount: 5n }] },
    );
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
      .addInput(native.holders[0]!, new SignatureTemplate(bobPriv).unlockP2PKH())
      .tokenContainerDeposit(NATIVE_TEST_CATEGORY, 5n)
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
