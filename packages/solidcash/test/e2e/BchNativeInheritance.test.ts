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
  createTestProvider, plainNumerics, setupStatefulUtxos,
} from '../test-util.js';
import { getTokenContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { aliceAddress, alicePriv, bobPriv } from '../fixture/vars.js';

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
  const inner = new Contract(artifact, [ownerAddress], { provider });
  const setup = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {
    owner: ownerAddress,
    _totalSupply: 0n,
    backedSupply: 0n,
  }, {
    saltContract: true,
    extraOutputs: (category) => [{
      address: getTokenContainerAddress(inner, category, category),
      satoshis: 1_200n,
      token: { amount: 1_000n },
    }],
  });
  const category = setup.categoryId;
  const token = StatefulContract.withCategory(inner, category);
  const owner = new Signer(alicePriv, provider);
  const bob = new Signer(bobPriv, provider);
  let nonce = 0xc000 + deployment * 0x100;
  const fund = async (signer: Signer): Promise<void> => {
    nonce += 1;
    await provider.addUtxo(signer.getAddress(), {
      txid: nonce.toString(16).padStart(64, 'c'), vout: 0, satoshis: 500_000n,
    });
  };
  return {
    provider, token, category, owner, bob, fund,
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
  await d.token.connect(d.bob).call.wrap(5n)
    .addInput(coin, new SignatureTemplate(bobPriv).unlockP2PKH())
    .tokenContainerDeposit(d.category, 5n)
    .send();
}

describe('BchNative inheritance', () => {
  it('composes exactly as MyToken is ERC20, BchNative, BlackList', () => {
    expect(artifact.contractName).toBe('MyToken');
    const abi = new Set(artifact.abi.map((entry) => entry.name));
    for (const name of [
      'transfer', 'approve', 'allowance', 'transferFrom',
      'wrap', 'withdraw',
      'blacklist', 'unblacklist', 'openSelf',
    ]) expect(abi).toContain(name);
    expect((artifact.stateLayout?.collections ?? []).map((entry) => entry.name))
      .toEqual(expect.arrayContaining(['_balances', '_allowances', 'blacklisted']));
    expect((artifact.stateLayout?.collections ?? []).map((entry) => entry.name))
      .not.toContain('pendingDeposits');
    expect((artifact.stateLayout?.variables ?? []).map((entry) => entry.name))
      .not.toContain('__block_number');
    expect(abi).not.toContain('setBacking');
    expect(abi).not.toContain('tick');
  });

  it('lets inherited blacklisting veto unwrap without entering BchNative storage', async () => {
    const d = await deploy();
    const connected = d.token.connect(d.owner);
    await d.fund(d.owner);
    await connected.call.openSelf().send();
    const coin = bearerCoin(d);
    await d.provider.addUtxo(d.owner.getAddress(), coin);
    await d.fund(d.owner);
    await connected.call.wrap(5n)
      .addInput(coin, new SignatureTemplate(alicePriv).unlockP2PKH())
      .tokenContainerDeposit(d.category, 5n)
      .send();
    const ownerAddress = addressToLockScript(d.owner.getAddress());
    expect(await d.token.state._balances(ownerAddress)).toBe(5n);
    expect((await d.token.getState())._totalSupply).toBe(5n);
    await d.fund(d.owner);
    await connected.call.blacklist(addressToLockScript(aliceAddress)).send();
    await d.fund(d.owner);
    await expect(connected.call.withdraw(d.bob.getAddress(), 5n).send()).rejects.toThrow();

    await d.fund(d.owner);
    await connected.call.unblacklist(addressToLockScript(aliceAddress)).send();
    await d.fund(d.owner);
    await connected.call.withdraw(d.bob.getAddress(), 5n).send();
    expect((plainNumerics(await d.token.getState()).backedSupply)).toBe(0n);
    expect(await d.token.state._balances(ownerAddress)).toBe(0n);
    expect((await d.token.getState())._totalSupply).toBe(0n);
    const bobBearer = await d.provider.getUtxos(d.bob.getAddress());
    expect(bobBearer
      .filter((utxo) => utxo.token?.category === d.category)
      .reduce((sum, utxo) => sum + (utxo.token?.amount ?? 0n), 0n)).toBe(5n);
  });

  it('lets inherited blacklisting veto wrap without entering BchNative storage', async () => {
    const d = await deploy();
    await openBob(d);
    await d.fund(d.owner);
    await d.token.connect(d.owner).call.blacklist(addressToLockScript(d.bob.getAddress())).send();
    const coin = bearerCoin(d);
    await d.provider.addUtxo(d.bob.getAddress(), coin);
    await d.fund(d.bob);
    await expect(d.token.connect(d.bob).call.wrap(5n)
      .addInput(coin, new SignatureTemplate(bobPriv).unlockP2PKH())
      .tokenContainerDeposit(d.category, 5n)
      .send()).rejects.toThrow();
  });

  it('wraps bearer CashTokens directly into ERC20 balance through the inherited base', async () => {
    const d = await deploy();
    await openBob(d);
    await wrapForBob(d, bearerCoin(d));
    expect(await d.token.state._balances(addressToLockScript(d.bob.getAddress()))).toBe(5n);
    const state = plainNumerics(await d.token.getState());
    expect(state.backedSupply).toBe(5n);
  });

  it('inherits OZ allowance spending, including the uint256 infinite sentinel', async () => {
    const d = await deploy();
    const owner = d.token.connect(d.owner);
    await d.fund(d.owner);
    await owner.call.openSelf().send();
    const coin = bearerCoin(d);
    await d.provider.addUtxo(d.owner.getAddress(), coin);
    await d.fund(d.owner);
    await owner.call.wrap(5n)
      .addInput(coin, new SignatureTemplate(alicePriv).unlockP2PKH())
      .tokenContainerDeposit(d.category, 5n)
      .send();
    await openBob(d);

    const bobAddress = addressToLockScript(d.bob.getAddress());
    const ownerAddress = addressToLockScript(d.owner.getAddress());
    await d.fund(d.owner);
    await owner.call.approve(bobAddress, 3n).send();
    await d.fund(d.bob);
    const state = await d.token.getState();
    await d.token.connect(d.bob).call.transferFrom(ownerAddress, bobAddress, 2n)
      .setState({ owner: state.owner })
      .send();
    expect(await d.token.state._allowances(ownerAddress, bobAddress)).toBe(1n);
    expect(await d.token.state._balances(bobAddress)).toBe(2n);

    await d.fund(d.bob);
    await expect(d.token.connect(d.bob).call.transferFrom(ownerAddress, bobAddress, 2n)
      .setState({ owner: state.owner })
      .send()).rejects.toThrow();

    const infinite = (1n << 256n) - 1n;
    await d.fund(d.owner);
    await owner.call.approve(bobAddress, infinite).send();
    await d.fund(d.bob);
    await d.token.connect(d.bob).call.transferFrom(ownerAddress, bobAddress, 2n)
      .setState({ owner: state.owner })
      .send();
    expect(await d.token.state._allowances(ownerAddress, bobAddress)).toBe(infinite);
    expect(await d.token.state._balances(bobAddress)).toBe(4n);
  });
});
