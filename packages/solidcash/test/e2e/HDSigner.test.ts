import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import {
  deriveSeedFromBip39Mnemonic, deriveHdPrivateNodeFromSeed, deriveHdPath,
} from '@bitauth/libauth';
import {
  HDSigner, HDPublicSigner, signersFromMnemonic, BCH_DEFAULT_HD_PATH, BCH_ACCOUNT_BRANCH,
  Signer, Network, MockNetworkProvider, getContractFactory,
} from '../../src/index.js';
import { getSigners, getSigner, DEFAULT_TEST_MNEMONIC } from '../test-util.js';

// Standard BIP-39 test vector (Trezor), 12 words.
const MNEMONIC = 'legal winner thank year wave sausage worth useful legal winner thank yellow';

describe('HDSigner (BIP-32 / BIP-39 HD signer)', () => {
  it('pins the BCH derivation path (coin type 145)', () => {
    expect(BCH_DEFAULT_HD_PATH).toBe("m/44'/145'/0'/0/0");
    expect(BCH_ACCOUNT_BRANCH).toBe("m/44'/145'/0'/0");
  });

  it('derives the canonical account-0 address, matching a hand-rolled libauth derivation', () => {
    const provider = new MockNetworkProvider();
    const hd = HDSigner.fromPhrase(MNEMONIC, provider);
    expect(hd.derivationPath).toBe(BCH_DEFAULT_HD_PATH);
    // Cross-check the full chain: seed -> master -> m/44'/145'/0'/0/0 -> privkey -> address.
    const node = deriveHdPath(
      deriveHdPrivateNodeFromSeed(deriveSeedFromBip39Mnemonic(MNEMONIC)), BCH_DEFAULT_HD_PATH,
    );
    const expected = new Signer(node.privateKey, provider);
    expect(hd.getAddress(Network.MAINNET)).toBe(expected.getAddress(Network.MAINNET));
    expect(hd.getAddress(Network.MAINNET).startsWith('bitcoincash:')).toBe(true);
  });

  it('is deterministic - same phrase + path -> same address', () => {
    const p = new MockNetworkProvider();
    expect(HDSigner.fromPhrase(MNEMONIC, p).getAddress())
      .toBe(HDSigner.fromPhrase(MNEMONIC, p).getAddress());
  });

  it('deriveChild yields a distinct, deterministic child', () => {
    const p = new MockNetworkProvider();
    const hd = HDSigner.fromPhrase(MNEMONIC, p, BCH_ACCOUNT_BRANCH);
    const child1 = hd.deriveChild(1);
    expect(child1.getAddress()).not.toBe(hd.deriveChild(0).getAddress());
    expect(child1.derivationPath).toBe(`${BCH_ACCOUNT_BRANCH}/1`);
    expect(hd.deriveChild(1).getAddress()).toBe(child1.getAddress());
  });

  it('round-trips through the extended private key (xprv)', () => {
    const p = new MockNetworkProvider();
    const hd = HDSigner.fromPhrase(MNEMONIC, p);
    expect(hd.extendedKey).toMatch(/^(xprv|tprv)/); // xprv on mainnet, tprv on test networks
    const reimported = HDSigner.fromExtendedKey(hd.extendedKey, p);
    expect(reimported.getAddress()).toBe(hd.getAddress());
  });

  it('createRandom produces a valid, unique wallet', () => {
    const p = new MockNetworkProvider();
    const a = HDSigner.createRandom(p);
    const b = HDSigner.createRandom(p);
    expect(a.mnemonic).toBeDefined();
    expect(a.getAddress()).not.toBe(b.getAddress());
    expect(a.getAddress(Network.MAINNET).startsWith('bitcoincash:')).toBe(true);
  });

  it('fromSeed derives without a mnemonic attached', () => {
    const p = new MockNetworkProvider();
    const seed = deriveSeedFromBip39Mnemonic(MNEMONIC);
    const hd = HDSigner.fromSeed(seed, p);
    expect(hd.mnemonic).toBeUndefined();
    expect(hd.getAddress()).toBe(HDSigner.fromPhrase(MNEMONIC, p).getAddress());
  });

  it('rejects an invalid mnemonic', () => {
    const p = new MockNetworkProvider();
    expect(() => HDSigner.fromPhrase('not a valid bip39 phrase at all', p)).toThrow(/mnemonic/i);
  });
});

describe('signersFromMnemonic (hardhat getSigners analogue)', () => {
  it('expands one mnemonic into N distinct deterministic signers', () => {
    const p = new MockNetworkProvider();
    const signers = signersFromMnemonic(MNEMONIC, p, { count: 5 });
    expect(signers).toHaveLength(5);
    const addrs = signers.map((s) => s.getAddress());
    expect(new Set(addrs).size).toBe(5);
    expect(signersFromMnemonic(MNEMONIC, p, { count: 5 }).map((s) => s.getAddress())).toEqual(addrs);
  });

  it('agrees with the explicit-path HDSigner idiom and honors initialIndex', () => {
    const p = new MockNetworkProvider();
    const batch = signersFromMnemonic(MNEMONIC, p, { count: 3 });
    for (let i = 0; i < 3; i++) {
      const explicit = HDSigner.fromPhrase(MNEMONIC, p, `${BCH_ACCOUNT_BRANCH}/${i}`);
      expect(batch[i].getAddress()).toBe(explicit.getAddress());
    }
    const offset = signersFromMnemonic(MNEMONIC, p, { initialIndex: 1, count: 2 });
    expect(offset[0].getAddress()).toBe(batch[1].getAddress());
  });
});

describe('HDPublicSigner (watch-only xpub)', () => {
  it('neuter() derives the same address without a private key', () => {
    const p = new MockNetworkProvider();
    const hd = HDSigner.fromPhrase(MNEMONIC, p);
    const watch = hd.neuter();
    expect(watch.getAddress()).toBe(hd.getAddress());
    expect((watch as unknown as { privateKey?: unknown }).privateKey).toBeUndefined();
    expect((watch as unknown as { signMessage?: unknown }).signMessage).toBeUndefined();
  });

  it('derives child addresses matching the signing signer', () => {
    const p = new MockNetworkProvider();
    const hd = HDSigner.fromPhrase(MNEMONIC, p, BCH_ACCOUNT_BRANCH);
    const watch = hd.neuter();
    expect(watch.deriveChild(2).getAddress()).toBe(hd.deriveChild(2).getAddress());
  });

  it('round-trips through the extended public key (xpub)', () => {
    const p = new MockNetworkProvider();
    const watch = HDSigner.fromPhrase(MNEMONIC, p).neuter();
    expect(watch.extendedKey).toMatch(/^(xpub|tpub)/); // xpub on mainnet, tpub on test networks
    expect(HDPublicSigner.fromExtendedKey(watch.extendedKey, p).getAddress()).toBe(watch.getAddress());
  });
});

describe('HDSigner as a drop-in ContractFactory runner', () => {
  const SOURCE = `
contract Poke() {
    function poke(int x) {
        require(x >= 0);
    }
}
`;
  it('funds and deploys a forceStateful contract via getContractFactory', async () => {
    const artifact = compileString(SOURCE, { forceStateful: true });
    const provider = new MockNetworkProvider();
    const hd = HDSigner.fromPhrase(MNEMONIC, provider);
    await provider.addUtxo(hd.getAddress(), { txid: `${'00'.repeat(31)}01`, vout: 0, satoshis: 1_000_000n });
    const sc = await getContractFactory(artifact, hd).deploy();
    await expect(sc.poke(1n)).resolves.toBeDefined();
  });
});

describe('getSigners (hardhat ethers.getSigners analogue)', () => {
  const SOURCE = `
contract Poke() {
    function poke(int x) {
        require(x >= 0);
    }
}
`;

  it('returns N pre-funded, distinct signers from the default mnemonic', async () => {
    const [owner, addr1, addr2] = await getSigners(3);
    expect(new Set([owner, addr1, addr2].map((s) => s.getAddress())).size).toBe(3);
    for (const s of [owner, addr1, addr2]) {
      expect((await s.getUtxos()).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('account 0 matches the default-path HDSigner from the hardhat mnemonic', async () => {
    const [owner] = await getSigners(1);
    expect(owner.getAddress())
      .toBe(HDSigner.fromPhrase(DEFAULT_TEST_MNEMONIC, owner.provider).getAddress());
  });

  it('each signer deploys independently via getContractFactory', async () => {
    const artifact = compileString(SOURCE, { forceStateful: true });
    const [owner, addr1] = await getSigners(2);
    const scA = await getContractFactory(artifact, owner).deploy();
    const scB = await getContractFactory(artifact, addr1).deploy();
    await expect(scA.poke(1n)).resolves.toBeDefined();
    await expect(scB.poke(1n)).resolves.toBeDefined();
  });

  it('getSigner(i) returns a single funded signer at index i', async () => {
    const s = await getSigner(2);
    expect((await s.getUtxos()).length).toBeGreaterThanOrEqual(1);
    const [, , third] = await getSigners(3);
    expect(s.getAddress()).toBe(third.getAddress());
  });
});

describe('MockNetworkProvider.getSigners (provider-level, hre.ethers.getSigners parity)', () => {
  const SOURCE = `
contract Poke() {
    function poke(int x) {
        require(x >= 0);
    }
}
`;

  it('returns N pre-funded, distinct signers bound to the provider', async () => {
    const provider = new MockNetworkProvider();
    const [owner, addr1, addr2] = await provider.getSigners(3);
    expect(new Set([owner, addr1, addr2].map((s) => s.getAddress())).size).toBe(3);
    for (const s of [owner, addr1, addr2]) {
      expect(s.provider).toBe(provider);
      expect((await s.getUtxos()).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('uses the hardhat default mnemonic', async () => {
    const provider = new MockNetworkProvider();
    const [owner] = await provider.getSigners(1);
    expect(owner.getAddress())
      .toBe(HDSigner.fromPhrase(MockNetworkProvider.DEFAULT_MNEMONIC, provider).getAddress());
  });

  it('a provider signer deploys via getContractFactory', async () => {
    const artifact = compileString(SOURCE, { forceStateful: true });
    const provider = new MockNetworkProvider();
    const [owner] = await provider.getSigners(1);
    const sc = await getContractFactory(artifact, owner).deploy();
    await expect(sc.poke(1n)).resolves.toBeDefined();
  });

  it('getSigner(i) returns a single funded signer on the provider', async () => {
    const provider = new MockNetworkProvider();
    const s = await provider.getSigner(1);
    expect((await s.getUtxos()).length).toBeGreaterThanOrEqual(1);
    expect(s.getAddress()).toBe(
      HDSigner.fromPhrase(MockNetworkProvider.DEFAULT_MNEMONIC, provider, `${BCH_ACCOUNT_BRANCH}/1`).getAddress(),
    );
  });
});
