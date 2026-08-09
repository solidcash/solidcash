import {
  beforeAll, describe, expect, it,
} from 'vitest';
import { compileFile } from 'solidc';
import { URL } from 'url';
import type { Artifact } from '@solidcash/utils';
import type { Utxo } from '../../src/interfaces.js';
import {
  Contract, SignatureTemplate, Signer, StatefulContract,
} from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';
import {
  createTestProvider, genesisFtContainer, plainNumerics, setupStatefulUtxos,
} from '../test-util.js';
import {
  aliceAddress, alicePriv, bobPkh, bobPriv,
} from '../fixture/vars.js';

const fx = (name: string): URL => new URL(`../fixture/${name}`, import.meta.url);

let artifact: Artifact;

beforeAll(() => {
  artifact = compileFile(fx('bch_native_token.scash'), { messageBus: false }) as Artifact;
});

interface Deployed {
  provider: ReturnType<typeof createTestProvider>;
  token: StatefulContract;
  category: string;
  owner: Signer;
  bob: Signer;
  fund: (signer: Signer) => Promise<void>;
}

let deployment = 0;

async function deploy(): Promise<Deployed> {
  deployment += 1;
  const provider = createTestProvider();
  const ownerAddress = addressToLockScript(aliceAddress);
  const category = `${'b'.repeat(62)}${deployment.toString(16).padStart(2, '0')}`;
  const inner = new Contract(artifact, [ownerAddress], { provider });
  await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {
    owner: ownerAddress,
    totalSupply: 0n,
    backingCategory: new Uint8Array(32),
    backingSet: false,
    containerSeen: 0n,
    backedSupply: 0n,
    quarantineBlocks: 0n,
    clock: 0n,
  }, { saltContract: true, categoryOverride: category });
  const token = StatefulContract.withCategory(inner, category);
  const reserve = await genesisFtContainer(provider, inner, category, [1_000n]);
  const owner = new Signer(alicePriv, provider);
  const bob = new Signer(bobPriv, provider);
  let nonce = 0xc000 + deployment * 0x100;
  const fund = async (signer: Signer): Promise<void> => {
    nonce += 1;
    await provider.addUtxo(signer.getAddress(), {
      txid: nonce.toString(16).padStart(64, 'c'), vout: 0, satoshis: 500_000n,
    });
  };
  await fund(owner);
  await fund(bob);
  await token.connect(owner).call.setBacking(reserve.category).send();
  return {
    provider, token, category: reserve.category, owner, bob, fund,
  };
}

function bearerCoin(d: Deployed): Utxo {
  return {
    txid: `${(0xd0 + deployment).toString(16)}`.repeat(32), vout: 0, satoshis: 100_000n,
    token: { category: d.category, amount: 5n },
  };
}

async function openBob(d: Deployed): Promise<void> {
  await d.fund(d.bob);
  await d.token.connect(d.bob).call.openSelf().send();
}

async function wrapForBob(d: Deployed, coin: Utxo): Promise<void> {
  await d.provider.addUtxo(d.bob.getAddress(), coin);
  await d.fund(d.bob);
  await d.token.connect(d.bob).call.wrap(d.category, 5n)
    .addInput(coin, new SignatureTemplate(bobPriv).unlockP2PKH())
    .tokenContainerDeposit(d.category, 5n)
    .send();
}

describe('BchNative inheritance', () => {
  it('composes exactly as MyToken is ERC20, BchNative, BlackList', () => {
    expect(artifact.contractName).toBe('MyToken');
    const abi = new Set(artifact.abi.map((entry) => entry.name));
    for (const name of [
      'transfer', 'setBacking', 'wrap', 'withdraw', 'deposit', 'claimDeposit', 'cancelDeposit',
      'blacklist', 'unblacklist', 'openSelf',
    ]) expect(abi).toContain(name);
    expect((artifact.stateLayout?.collections ?? []).map((entry) => entry.name))
      .toEqual(expect.arrayContaining(['balances', 'blacklisted', 'pendingDeposits']));
  });

  it('lets inherited blacklisting veto unwrap without entering BchNative storage', async () => {
    const d = await deploy();
    const connected = d.token.connect(d.owner);
    await d.fund(d.owner);
    await connected.call.issue(100n).send();
    await d.fund(d.owner);
    await connected.call.blacklist(addressToLockScript(aliceAddress)).send();
    await d.fund(d.owner);
    await expect(connected.call.withdraw(d.category, bobPkh, 10n).send()).rejects.toThrow();

    await d.fund(d.owner);
    await connected.call.unblacklist(addressToLockScript(aliceAddress)).send();
    await d.fund(d.owner);
    await connected.call.withdraw(d.category, bobPkh, 10n).send();
    expect((plainNumerics(await d.token.getState()).backedSupply)).toBe(90n);
  });

  it('lets inherited blacklisting veto wrap without entering BchNative storage', async () => {
    const d = await deploy();
    await openBob(d);
    await d.fund(d.owner);
    await d.token.connect(d.owner).call.blacklist(addressToLockScript(d.bob.getAddress())).send();
    const coin = bearerCoin(d);
    await d.provider.addUtxo(d.bob.getAddress(), coin);
    await d.fund(d.bob);
    await expect(d.token.connect(d.bob).call.wrap(d.category, 5n)
      .addInput(coin, new SignatureTemplate(bobPriv).unlockP2PKH())
      .tokenContainerDeposit(d.category, 5n)
      .send()).rejects.toThrow();
  });

  it('wraps bearer CashTokens directly into ERC20 balance through the inherited base', async () => {
    const d = await deploy();
    await openBob(d);
    await wrapForBob(d, bearerCoin(d));
    expect(await d.token.state.balances(addressToLockScript(d.bob.getAddress()))).toBe(5n);
    const state = plainNumerics(await d.token.getState());
    expect(state.backedSupply).toBe(5n);
    expect(state.containerSeen).toBe(1_005n);
  });
});
