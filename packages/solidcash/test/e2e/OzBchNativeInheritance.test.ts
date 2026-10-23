import {
  beforeAll, describe, expect, it,
} from 'vitest';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { compileFile, compileFileSplit } from '@solidcash/solidc';
import { asmToScript, buildChunkCommitment, scriptToBytecode, type Artifact } from '@solidcash/utils';
import type { Utxo } from '../../src/interfaces.js';
import {
  Contract,
  SignatureTemplate,
  Signer,
} from '../../src/index.js';
import {
  encodeEntryCommitment,
  slotValueToBytes,
  SplitContractBundle,
  StatefulContract,
} from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import {
  NATIVE_TEST_CATEGORY, createTestProvider, expectScriptRejection, seedNativeToken, setupStatefulUtxos,
} from '../test-util.js';
import { getDynamicChunkAddress, getEntryNftAddress } from '../../src/stateful/covenant-helpers.js';
import type { MockNetworkProvider } from '../../src/network/mock/index.js';
import {
  aliceAddress, alicePriv, bobPriv,
} from '../fixture/vars.js';

const source = new URL('../fixture/oz_bch_native_token.sol', import.meta.url);
let artifact: Artifact;

beforeAll(() => {
  artifact = compileFile(source, {
    evmCompat: true,
    messageBus: false,
    suppressWarnings: true,
  }) as Artifact;
});

describe('BchNative with npm OpenZeppelin ERC20', () => {
  it('composes with the unmodified OZ 5.0.2 implementation', () => {
    // 9_100 held (9_024) before the October per-entry hardening; shared pins brought it to 9_417. The 10-14..10-17
    // hardening (per-call merges, minted-root bindings, the direct outside-layout walk) took it to 10_539, past the
    // 10_000-byte single-input limit, so the unsplit script no longer deploys and the token ships split, as the
    // facet title below settles. BchNative's own bearer category added 56 B (10_595); dropping the container merge
    // path and refusing unnamed minting containers took 27 B off, and the bound on what a named minting container
    // mints (security NAMED-MINT-1) added 88 B (10_656). Laying always-run sorted writes out unconditionally, with
    // the direct outside-layout walk shared, took it to 9_258, under the single-input limit again. The containers'
    // destroy arm added 50 B (9_308), and the forged-log pin, which an event declared in IERC20 now gets as a
    // contract-level one does (SEC-10), 70 B (9_378). This budget guards further growth.
    expect(scriptToBytecode(asmToScript(artifact.bytecode)).length).toBeLessThan(9_450);
    expect(artifact.contractName).toBe('OzNativeToken');
    const abi = new Set(artifact.abi.map((entry) => entry.name));
    for (const name of [
      'name', 'symbol', 'decimals', 'totalSupply', 'balanceOf',
      'transfer', 'approve', 'allowance', 'transferFrom', 'wrap', 'unwrap',
    ]) expect(abi).toContain(name);
    expect(artifact.stateLayout?.variables.map((entry) => entry.name))
      .toEqual(['_nativeCategory', '_totalSupply', '_name', '_symbol']);
    expect(artifact.stateLayout?.collections.map((entry) => entry.name))
      .toEqual(['_balances', '_allowances']);
  });

  it('executes the outlined OZ name and symbol getter tails', async () => {
    const provider = createTestProvider();
    const inner = new Contract(artifact, [], { provider });
    const labels = { _name: 'SolidCash Native', _symbol: 'SCN' };
    const { categoryId } = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {
      _totalSupply: 0n,
      ...labels,
    }, {
      saltContract: true,
      extraOutputs: (category) => Object.entries(labels).map(([name, value]) => ({
        // A chunk binds the master lock, which is the category-pinned contract's.
        address: getDynamicChunkAddress(inner.withCategory(hexToBin(category)), category, name, 'string'),
        satoshis: 1_200n,
        token: {
          amount: 0n,
          nft: { capability: 'mutable', commitment: buildChunkCommitment(0, new TextEncoder().encode(value)) },
        },
      })),
    });
    const token = StatefulContract.withCategory(inner, categoryId);
    expect((await token.call.name().emitReturn().send()).txid).toMatch(/^[0-9a-f]{64}$/);
    expect((await token.call.symbol().emitReturn().send()).txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('wraps, transfers, spends allowance, and unwraps through OZ storage', async () => {
    const provider = createTestProvider();
    const alice = new Signer(alicePriv, provider);
    const bob = new Signer(bobPriv, provider);
    const inner = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {
      _totalSupply: 0n,
      _name: '',
      _symbol: '',
      _nativeCategory: hexToBin(NATIVE_TEST_CATEGORY),
    }, { saltContract: true });
    // The container binds the master lock, which is the category-pinned contract's.
    const native = await seedNativeToken(
      provider as MockNetworkProvider, inner.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
      { reserve: 1_000n, holders: [{ address: bob.getAddress(), amount: 5n }] },
    );
    const token = StatefulContract.withCategory(inner, setup.categoryId);
    let nonce = 0xf0;
    const fund = async (signer: Signer): Promise<void> => {
      nonce += 1;
      await provider.addUtxo(signer.getAddress(), {
        txid: nonce.toString(16).padStart(64, 'f'), vout: 0, satoshis: 500_000n,
      });
    };
    const bearer = native.holders[0] as Utxo;
    await fund(bob);
    await token.connect(bob).call.wrap(5n)
      .addInput(bearer, new SignatureTemplate(bobPriv).unlockP2PKH())
      .tokenContainerDeposit(NATIVE_TEST_CATEGORY, 5n)
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
    await token.connect(bob).call.unwrap(bob.getAddress(), 2n).send();
    expect(await token.state._balances(bobLedger)).toBe(0n);
    expect((await token.getState())._totalSupply).toBe(3n);
    const bearerBalance = (await provider.getUtxos(bob.getAddress()))
      .filter((utxo) => utxo.token?.category === NATIVE_TEST_CATEGORY)
      .reduce((sum, utxo) => sum + (utxo.token?.amount ?? 0n), 0n);
    expect(bearerBalance).toBe(2n);
  });

  it('wraps on the root, unwraps and inserts a transfer balance through split facets within 9 KB shards', async () => {
    const split = compileFileSplit(source, {
      evmCompat: true, messageBus: false, maxShardBytes: 9_000,
      // The unsplit redeem script is over the 9 KB shard budget, so a shard plan is needed rather than merely
      // asked for. This title checks that wrap can stay on the root while unwrap and transfer run on facets
      // whose scripts also fit.
      forceSplit: true,
      suppressWarnings: true,
      rootFunctions: ['wrap'],
    });
    for (const shard of [split.root, ...Object.values(split.facets)]) {
      expect(scriptToBytecode(asmToScript(shard.bytecode)).length).toBeLessThan(9_000);
    }
    expect(split.manifest.routes.find((route) => route.function === 'wrap')?.target).toBe('root');
    const unwrapTarget = split.manifest.routes.find((route) => route.function === 'unwrap')?.target;
    expect(unwrapTarget).not.toBe('root');
    const facetUnwrap = split.facets[unwrapTarget!]!.abi.find((entry) => entry.name === 'unwrap');
    expect(facetUnwrap?.tokenContainerAccesses).toHaveLength(1);
    expect(facetUnwrap?.tokenContainerTransferSites).toHaveLength(1);

    const provider = createTestProvider();
    const bob = new Signer(bobPriv, provider);
    const funding = [];
    for (const byte of ['a1', 'a2', 'a3', 'a4', 'a5', 'a6']) {
      funding.push(await provider.addUtxo(bob.getAddress(), {
        txid: byte.repeat(32), vout: 0, satoshis: 1_000_000n,
      }));
    }
    const deployed = await SplitContractBundle.from(split, bob).deploy([hexToBin(NATIVE_TEST_CATEGORY)], {
      fundingUtxo: funding[0],
      facetOverrides: Object.fromEntries(split.manifest.facets.map((facet, index) => [
        facet.name, { fundingUtxo: funding[index + 1] },
      ])),
      initialState: { _totalSupply: 0n, _name: '', _symbol: '' },
    });
    const category = deployed.categoryId;
    const reserveAddress = deployed.root.getTokenContainerAddress(NATIVE_TEST_CATEGORY);
    await provider.addUtxo(reserveAddress, {
      txid: 'b1'.repeat(32), vout: 0, satoshis: 1_200n,
      token: { category: NATIVE_TEST_CATEGORY, amount: 1_000n },
    });
    const bearer = await provider.addUtxo(bob.getAddress(), {
      txid: 'b2'.repeat(32), vout: 0, satoshis: 100_000n,
      token: { category: NATIVE_TEST_CATEGORY, amount: 5n },
    });
    await deployed.call.wrap(5n)
      .addInput(bearer, new SignatureTemplate(bobPriv).unlockP2PKH())
      .tokenContainerDeposit(NATIVE_TEST_CATEGORY, 5n)
      .send();
    expect(await deployed.root.state._balances(addressToLockScript(bob.getAddress()))).toBe(5n);
    expect((await deployed.root.getState())._totalSupply).toBe(5n);
    const reserveAfterWrap = await provider.getUtxos(reserveAddress);
    expect(reserveAfterWrap.find((utxo) => utxo.token?.category === NATIVE_TEST_CATEGORY)?.token?.amount)
      .toBe(1_005n);

    await provider.addUtxo(bob.getAddress(), {
      txid: 'b3'.repeat(32), vout: 0, satoshis: 500_000n,
    });
    await deployed.call.unwrap(bob.getAddress(), 2n).send();
    expect(await deployed.root.state._balances(addressToLockScript(bob.getAddress()))).toBe(3n);
    expect((await deployed.root.getState())._totalSupply).toBe(3n);
    const reserveAfterUnwrap = await provider.getUtxos(reserveAddress);
    expect(reserveAfterUnwrap.find((utxo) => utxo.token?.category === NATIVE_TEST_CATEGORY)?.token?.amount)
      .toBe(1_003n);
    const unwrapped = (await provider.getUtxos(bob.getAddress()))
      .filter((utxo) => utxo.token?.category === NATIVE_TEST_CATEGORY)
      .reduce((sum, utxo) => sum + (utxo.token?.amount ?? 0n), 0n);
    expect(unwrapped).toBe(2n);

    await provider.addUtxo(bob.getAddress(), {
      txid: 'b4'.repeat(32), vout: 0, satoshis: 500_000n,
    });
    const aliceLedger = addressToLockScript(aliceAddress);
    await deployed.call.transfer(aliceLedger, 1n).send();
    expect(await deployed.root.state._balances(addressToLockScript(bob.getAddress()))).toBe(2n);
    expect(await deployed.root.state._balances(aliceLedger)).toBe(1n);
    expect((await deployed.root.getState())._totalSupply).toBe(3n);

    // The root excludes only this facet-censused collection from its mutable-NFT population equation.
    // The facet must still reject a forged extra node at that address, while the root must reject one at
    // any unrelated address. Both transactions are raw so no SDK finalization can quietly remove the attack.
    const forgedEntry = await deployed.call.transfer(aliceLedger, 1n).build();
    const entryFunder = await provider.addUtxo(bob.getAddress(), {
      txid: 'b5'.repeat(32), vout: 0, satoshis: 500_000n,
    });
    forgedEntry.addInput(entryFunder, new SignatureTemplate(bobPriv).unlockP2PKH());
    forgedEntry.addOutput({
      to: getEntryNftAddress(deployed.root.inner, category, '_balances'),
      amount: 1_200n,
      token: {
        category, amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: binToHex(encodeEntryCommitment(
            new Uint8Array(32).fill(0x77), slotValueToBytes(0n), Uint8Array.of(99),
          )),
        },
      },
    });
    const forgedOutcome = await provider.sendRawTransaction(
      binToHex(encodeTransaction(forgedEntry.buildLibauthTransaction())),
    ).then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expectScriptRejection(forgedOutcome, 2);

    const unclaimedMutable = await deployed.call.transfer(aliceLedger, 1n).build();
    const otherFunder = await provider.addUtxo(bob.getAddress(), {
      txid: 'b6'.repeat(32), vout: 0, satoshis: 500_000n,
    });
    unclaimedMutable.addInput(otherFunder, new SignatureTemplate(bobPriv).unlockP2PKH());
    unclaimedMutable.addOutput({
      to: addressToLockScript(bob.getAddress()), amount: 1_200n,
      token: { category, amount: 0n, nft: { capability: 'mutable', commitment: 'ff' } },
    });
    const unclaimedOutcome = await provider.sendRawTransaction(
      binToHex(encodeTransaction(unclaimedMutable.buildLibauthTransaction())),
    ).then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expectScriptRejection(unclaimedOutcome, 0);
  }, 300_000);
});
