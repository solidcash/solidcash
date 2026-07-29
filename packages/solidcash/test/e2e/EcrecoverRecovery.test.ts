import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, hexToBin, hash160 } from '@bitauth/libauth';
import { ethers } from 'ethers';
import { secp256k1 } from '@noble/curves/secp256k1';
import { SHARED_LIBRARY_SALT, ecrecoverComputeLockingBytecode, keccakComputeLockingBytecode } from '@solidcash/utils';
import { Contract, StatefulContract, TransactionBuilder, MockNetworkProvider } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { computeEcrecoverWitness } from '../../src/ecrecover/ecrecoverRecovery.js';
import { probeEcrecoverSplit } from '../../src/ecrecover/ecrecoverComputeSidecar.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// A recovery side-car's OWN NFT category (distinct from the consuming contract's; each of the A/B pair carries one).
const SIDECAR_CAT = 'ee'.repeat(32);

// Authenticate a signer via on-chain secp256k1 recovery: the recovered pubkey must equal the baked owner.
const SOURCE = `
contract Auth(pubkey owner) {
    function verify(bytes32 h, int v, bytes32 r, bytes32 s) {
        require(ecrecoverPubKey(h, v, r, s) == owner);
    }
}`;

// reverse ethers big-endian hex -> the BCH-native little-endian bytes32 the contract + covenant use
const leBytes = (h: string): Uint8Array => hexToBin(h.replace(/^0x/, '')).slice().reverse();

async function deployPair(provider: MockNetworkProvider, salt: Uint8Array, n: number): Promise<void> {
  for (const role of ['A', 'B'] as const) {
    const lock = binToHex(ecrecoverComputeLockingBytecode(salt, role));
    for (let i = 0; i < n; i++) {
      await provider.addUtxo(lock, {
        ...randomUtxo({ satoshis: 100_000n }),
        token: { category: SIDECAR_CAT, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
      });
    }
  }
}

// ecrecoverEvm ALSO co-spends a keccak side-car (over the uncompressed key) per call. In a loop the keccak side-car
// rides the STATEFUL (forward self-preserving) covenant, so `stateful` selects the loop variant.
async function deployKeccak(provider: MockNetworkProvider, salt: Uint8Array, n: number, stateful = false): Promise<void> {
  const lock = binToHex(keccakComputeLockingBytecode(salt, stateful));
  for (let i = 0; i < n; i++) {
    await provider.addUtxo(lock, {
      ...randomUtxo({ satoshis: 100_000n }),
      token: { category: SIDECAR_CAT, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
    });
  }
}

interface Recovery { h: Uint8Array; v: bigint; r: Uint8Array; s: Uint8Array; owner: Uint8Array; wallet: ethers.HDNodeWallet; }

// build a signature + the (LE) args + the recovered pubkey the contract authenticates against. `owner` is the
// STANDARD compressed pubkey (0x02/03 || Qx big-endian) - exactly what ethers returns and what ecrecoverPubKey emits.
async function recovery(message: string, wallet?: ethers.HDNodeWallet): Promise<Recovery> {
  const w = wallet ?? ethers.Wallet.createRandom();
  const sig = await w.signMessage(message);
  const digest = ethers.hashMessage(message);
  const { r, s, v } = ethers.Signature.from(sig);
  const h = leBytes(digest), rLe = leBytes(r), sLe = leBytes(s);
  const ownerHex = ethers.SigningKey.computePublicKey(ethers.SigningKey.recoverPublicKey(digest, sig), true);
  return { h, v: BigInt(v), r: rLe, s: sLe, owner: hexToBin(ownerHex.slice(2)), wallet: w };
}

// the SDK's 34-byte on-chain commitment (parity || Qx-LE) back to a standard big-endian compressed pubkey
const toStdCompressed = (q: Uint8Array): string =>
  '0x' + q[0].toString(16).padStart(2, '0') + [...q.slice(1, 33)].reverse().map((b) => b.toString(16).padStart(2, '0')).join('');

// A dummy side-car pair for probing whether a signature has a valid 2-covenant split.
const dummySc = (v: number): { txid: string; vout: number; satoshis: bigint; token: { category: string; amount: bigint; nft: { capability: 'mutable'; commitment: string } } } =>
  ({ txid: (v ? 'bb' : 'aa').repeat(32), vout: v, satoshis: 100000n, token: { category: 'ee'.repeat(32), amount: 0n, nft: { capability: 'mutable', commitment: '' } } });
// A small fraction of signatures are "width-0": their GLV ladder is too long for the 2-covenant (A+B) split, so
// recovery fails closed with "no ladder split fits both side-cars' op-budget for this signature ... Re-sign to obtain
// a different signature, which will decompose differently". Measured on this tree at 4/300 = 1.33% of random signers
// over a fixed message. EVERY positive-path test below draws a fresh random signature: ten of them were unguarded,
// so a full run of this file flaked at about 1 - 0.9867^10 = 12.6%, and the STATEFUL test alone at 1.33% - which is
// the rate at which it was reported failing.
//
// This applies the remedy the error text itself prescribes: re-sign with a fresh message until the split probe
// accepts. The probe builds both side-car covenants and evaluates them on the VM in an isolated two-input
// transaction, and it settles on the split with the widest budget margin rather than the first that fits. Per its
// own documentation the verdict is salt-independent, so a signature it accepts under SHARED_LIBRARY_SALT also
// splits for the BRANDED pair a stateful contract co-spends - that part is cited, not measured here.
//
// BOUNDED, so the fixture still fails loudly rather than spinning. At 1.33% the chance of 24 consecutive width-0
// draws is about 1e-45, so exhausting the budget means the split search is broken for ALL signatures - a real
// regression - and that is reported with the last probe failure rather than hanging the run.
const MAX_RESIGN = 24;
async function goodRecovery(prefix: string, wallet: ethers.HDNodeWallet): Promise<Recovery> {
  let lastFailure = '(none)';
  for (let t = 0; t < MAX_RESIGN; t++) {
    const g = await recovery(`${prefix}-${t}`, wallet);
    try { probeEcrecoverSplit(computeEcrecoverWitness(g.h, Number(g.v), g.r, g.s), SHARED_LIBRARY_SALT, dummySc(0), dummySc(1)); return g; }
    catch (error) { lastFailure = (error as Error).message; }   // width-0 signature, try the next message
  }
  throw new Error(`no signature with a valid 2-covenant ladder split in ${MAX_RESIGN} re-signings of "${prefix}". `
    + `At the measured 1.33% width-0 rate this is a broken split search, not an unlucky scalar. Last: ${lastFailure}`);
}
// A fresh random signer whose signature is known to decompose. Positive-path tests use this; the negative-path ones
// keep bare `recovery()` on purpose - they assert a REJECTION, which a width-0 draw cannot turn into a false pass.
const goodSigner = (prefix: string): Promise<Recovery> => goodRecovery(prefix, ethers.Wallet.createRandom());

describe('ecrecoverPubKey recovery side-car (compiler + SDK + VM e2e)', () => {
  it('records the recovery-side-car dependency in the artifact', () => {
    const artifact = compileString(SOURCE);
    const fn = artifact.abi.find((f) => f.name === 'verify');
    expect(fn?.ecrecoverCompute).toBe(true);
    expect(fn?.ecrecoverArgParams).toEqual([['h', 'v', 'r', 's']]);
  });

  it('spends a contract that authenticates a signer via ecrecoverPubKey (auto-co-spends the A+B recovery pair)', async () => {
    const artifact = compileString(SOURCE);
    const provider = new MockNetworkProvider();
    const { h, v, r, s, owner } = await goodSigner('auth-e2e');
    const contract = new Contract(artifact, [owner], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    await deployPair(provider, SHARED_LIBRARY_SALT, 1);
    const tx = await new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(), contract.unlock.verify(h, v, r, s))
      .addOutput({ to: contract.address, amount: 800_000n })
      .send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects when the baked owner is a different signer', async () => {
    const artifact = compileString(SOURCE);
    const provider = new MockNetworkProvider();
    const { h, v, r, s } = await recovery('auth-neg');
    const wrongOwner = new Uint8Array(33); wrongOwner[0] = 0x02; // valid-shape compressed pubkey, wrong key
    const contract = new Contract(artifact, [wrongOwner], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    await deployPair(provider, SHARED_LIBRARY_SALT, 1);
    await expect(new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(), contract.unlock.verify(h, v, r, s))
      .addOutput({ to: contract.address, amount: 800_000n })
      .send()).rejects.toThrow();
  });

  // CONFORMANCE: the same message signed by ethers recovers to the SAME public key / address in ethers AND in the
  // SolidCash recovery witness (which the covenant recomputes on-chain). This is the ethers == solc == solidc identity.
  it('CONFORMANCE: SDK recovery matches ethers.recoverPublicKey / computeAddress (== Solidity ecrecover address)', async () => {
    for (let t = 0; t < 4; t++) {
      const { h, v, r, s, owner, wallet } = await recovery('conformance-' + t);
      const sig = await wallet.signMessage('conformance-' + t);
      const digest = ethers.hashMessage('conformance-' + t);
      // ethers' own recovery, in standard compressed form == the pubkey the SDK/contract authenticate against
      const ethersPub = ethers.SigningKey.computePublicKey(ethers.SigningKey.recoverPublicKey(digest, sig), true);
      expect(binToHex(owner), `pubkey t=${t}`).toBe(ethersPub.slice(2));
      // the SDK's 34-byte on-chain commitment normalizes to the same standard pubkey (what the covenant commits)
      expect(toStdCompressed(computeEcrecoverWitness(h, Number(v), r, s).compressedQ), `commitment t=${t}`).toBe(ethersPub);
      // and the EVM address both derive (Solidity's ecrecover returns exactly this)
      expect(ethers.computeAddress(ethersPub), `address t=${t}`).toBe(wallet.address);
    }
  });

  // 0 ecrecovers: a function that never calls ecrecoverPubKey needs no side-car and spends alone.
  it('0 ecrecovers: no recovery side-car dependency, spends with no co-spend', async () => {
    const artifact = compileString('contract NoRec() { function f(int x) { require(x > 0); } }');
    expect(artifact.abi.find((fn) => fn.name === 'f')?.ecrecoverCompute).toBeUndefined();
    const provider = new MockNetworkProvider();
    const contract = new Contract(artifact, [], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    const tx = await new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(), contract.unlock.f(5n))
      .addOutput({ to: contract.address, amount: 999_000n })   // small fee: this is a tiny 1-in/1-out tx
      .send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  // N ecrecovers: two independent recoveries in one function co-spend TWO A+B pairs (one per call, read by slot).
  const TWO = `
  contract Two(pubkey a, pubkey b) {
      function f(bytes32 h1, int v1, bytes32 r1, bytes32 s1, bytes32 h2, int v2, bytes32 r2, bytes32 s2) {
          require(ecrecoverPubKey(h1, v1, r1, s1) == a);
          require(ecrecoverPubKey(h2, v2, r2, s2) == b);
      }
  }`;
  it('N ecrecovers: two recoveries in one function auto-co-spend two A+B pairs', async () => {
    const artifact = compileString(TWO);
    expect(artifact.abi.find((fn) => fn.name === 'f')?.ecrecoverArgParams).toHaveLength(2);
    const provider = new MockNetworkProvider();
    const g1 = await goodSigner('two-a'), g2 = await goodSigner('two-b');
    const contract = new Contract(artifact, [g1.owner, g2.owner], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    await deployPair(provider, SHARED_LIBRARY_SALT, 2);
    const tx = await new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(),
        contract.unlock.f(g1.h, g1.v, g1.r, g1.s, g2.h, g2.v, g2.r, g2.s))
      .addOutput({ to: contract.address, amount: 800_000n })
      .send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  // BRANCH: ecrecover inside a conditional. The call is counted statically (one pair deployed + co-spent), and the
  // self-verifying side-car validates independently, so the tx is sound whether or not the branch binds it.
  const BRANCH = `
  contract Branch(pubkey owner) {
      function f(bytes32 h, int v, bytes32 r, bytes32 s, int sel) {
          if (sel > 0) {
              require(ecrecoverPubKey(h, v, r, s) == owner);
          } else {
              require(sel == 0);
          }
      }
  }`;
  it('BRANCH: ecrecover in a taken branch authenticates the signer', async () => {
    const artifact = compileString(BRANCH);
    expect(artifact.abi.find((fn) => fn.name === 'f')?.ecrecoverCompute).toBe(true);
    const provider = new MockNetworkProvider();
    const { h, v, r, s, owner } = await goodSigner('branch');
    const contract = new Contract(artifact, [owner], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    await deployPair(provider, SHARED_LIBRARY_SALT, 1);
    const tx = await new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(), contract.unlock.f(h, v, r, s, 1n))
      .addOutput({ to: contract.address, amount: 800_000n })
      .send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  // ecrecoverP2pkh: the recovered pubkey projected to the signer's 25-byte P2PKH locking bytecode.
  const P2PKH = `
  contract AuthP2pkh() {
      function verify(bytes32 h, int v, bytes32 r, bytes32 s, bytes expected) {
          require(ecrecoverP2pkh(h, v, r, s) == expected);
      }
  }`;
  it('ecrecoverP2pkh: recovers the signer 0x76a914||hash160(pubkey)||0x88ac locking bytecode', async () => {
    const artifact = compileString(P2PKH);
    const provider = new MockNetworkProvider();
    const { h, v, r, s, owner } = await goodSigner('p2pkh');
    const expected = hexToBin('76a914' + binToHex(hash160(owner)) + '88ac');  // hash160 of the standard pubkey
    const contract = new Contract(artifact, [], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    await deployPair(provider, SHARED_LIBRARY_SALT, 1);
    const tx = await new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(), contract.unlock.verify(h, v, r, s, expected))
      .addOutput({ to: contract.address, amount: 800_000n })
      .send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  // ecrecoverEvm: the recovered pubkey projected to the 20-byte EVM address = keccak256(uncompressed key)[12:]. This
  // co-spends the recovery pair AND a keccak side-car (over the uncompressed key), bound by compress(preimage) == Q.
  const EVM = `
  contract AuthEvm(bytes20 owner) {
      function verify(bytes32 h, int v, bytes32 r, bytes32 s) {
          require(ecrecoverEvm(h, v, r, s) == owner);
      }
  }`;
  it('ecrecoverEvm: recovers the signer EVM address (keccak256(uncompressed)[12:], == ethers/Solidity)', async () => {
    const artifact = compileString(EVM);
    expect(artifact.abi.find((fn) => fn.name === 'verify')?.ecrecoverEvmFlags).toEqual([true]);
    const provider = new MockNetworkProvider();
    const { h, v, r, s, wallet } = await goodSigner('evm');
    const owner = hexToBin(wallet.address.slice(2));  // the signer's 20-byte EVM address (what Solidity ecrecover gives)
    const contract = new Contract(artifact, [owner], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    await deployPair(provider, SHARED_LIBRARY_SALT, 1);
    await deployKeccak(provider, SHARED_LIBRARY_SALT, 1);
    const tx = await new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(), contract.unlock.verify(h, v, r, s))
      .addOutput({ to: contract.address, amount: 800_000n })
      .send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ecrecoverEvm: rejects a wrong EVM address', async () => {
    const artifact = compileString(EVM);
    const provider = new MockNetworkProvider();
    const { h, v, r, s } = await recovery('evm-neg');
    const contract = new Contract(artifact, [new Uint8Array(20)], { provider });  // zero address, not the signer
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    await deployPair(provider, SHARED_LIBRARY_SALT, 1);
    await deployKeccak(provider, SHARED_LIBRARY_SALT, 1);
    await expect(new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(), contract.unlock.verify(h, v, r, s))
      .addOutput({ to: contract.address, amount: 800_000n })
      .send()).rejects.toThrow();
  });

  // LOOP: a fixed-bound loop over array-indexed sigs unrolls to N syntactic recovery calls (each its own pair), and
  // the loop variable substitution turns h[i] into h[0], h[1], ... which the SDK resolves per array element.
  const LOOP = `
  contract AuthLoop(pubkey owner) {
      function verify(bytes32[] h, int[] v, bytes32[] r, bytes32[] s) {
          for (int i = 0; i < 2; i++) {
              require(ecrecoverPubKey(h[i], v[i], r[i], s[i]) == owner);
          }
      }
  }`;
  it('LOOP (fixed-bound): dynamic per-iteration recovery pairs, authenticates each', async () => {
    const artifact = compileString(LOOP);
    const vfn = artifact.abi.find((fn) => fn.name === 'verify');
    expect(vfn?.ecrecoverLoopReads).toBe(true);
    expect(vfn?.ecrecoverArgParams).toEqual([['h[]', 'v[]', 'r[]', 's[]']]);
    const provider = new MockNetworkProvider();
    const w = ethers.Wallet.createRandom();
    const g0 = await goodRecovery('loop-0', w), g1 = await goodRecovery('loop-1', w);  // same signer, two messages
    const contract = new Contract(artifact, [g0.owner], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    await deployPair(provider, SHARED_LIBRARY_SALT, 2);   // one A+B pair per iteration
    const tx = await new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(),
        contract.unlock.verify([g0.h, g1.h], [g0.v, g1.v], [g0.r, g1.r], [g0.s, g1.s]))
      .addOutput({ to: contract.address, amount: 800_000n })
      .send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  // The GENERAL case: a RUNTIME-bound loop (the count is a parameter, not a literal). The SDK co-spends N = the
  // sig-array length pairs; the contract reads pair k forward at [master+1+2k] per iteration.
  const LOOP_N = `
  contract AuthLoopN(pubkey owner) {
      function verify(bytes32[] h, int[] v, bytes32[] r, bytes32[] s, int n) {
          for (int i = 0; i < n; i++) {
              require(ecrecoverPubKey(h[i], v[i], r[i], s[i]) == owner);
          }
      }
  }`;
  it('LOOP (runtime-bound): dynamic N=3 recovery pairs from a for(i<n) loop', async () => {
    const artifact = compileString(LOOP_N);
    const provider = new MockNetworkProvider();
    const w = ethers.Wallet.createRandom();
    const g = await Promise.all([0, 1, 2].map((k) => goodRecovery('loopn-' + k, w)));  // same signer, 3 messages
    const contract = new Contract(artifact, [g[0].owner], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    await deployPair(provider, SHARED_LIBRARY_SALT, 3);   // one A+B pair per iteration
    const tx = await new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(),
        contract.unlock.verify(g.map((x) => x.h), g.map((x) => x.v), g.map((x) => x.r), g.map((x) => x.s), 3n))
      .addOutput({ to: contract.address, amount: 700_000n })
      .send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  // Per-iteration integrity is an OP_UTXOBYTECODE == baked-lock compare (not re-hashing the ~11 KB of A+B covenants),
  // so the master's op-budget now supports ~15 iterations (was ~3). N=4 exercises past the old op-budget cap; beyond
  // ~5 recoveries the 100 KB STANDARD tx-size limit binds instead (each side-car unlocking is ~10 KB of op-budget pad).
  it('LOOP (runtime-bound): N=4 recovery pairs fit the master op-budget (cap lifted from ~3)', async () => {
    const artifact = compileString(LOOP_N);
    const provider = new MockNetworkProvider();
    const w = ethers.Wallet.createRandom();
    const g = await Promise.all([0, 1, 2, 3].map((k) => goodRecovery('loop4-' + k, w)));
    const contract = new Contract(artifact, [g[0].owner], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 2_000_000n }));
    await deployPair(provider, SHARED_LIBRARY_SALT, 4);
    const tx = await new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(),
        contract.unlock.verify(g.map((x) => x.h), g.map((x) => x.v), g.map((x) => x.r), g.map((x) => x.s), 4n))
      .addOutput({ to: contract.address, amount: 1_500_000n })
      .send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  // STATEFUL: a contract WITH storage that also authenticates via ecrecoverPubKey. The recovery pair is BRANDED to the
  // contract's token category (rides its own category), positioned at the ecrecoverSideCar block-layout slots, and
  // threaded through auto-derivation (the state is derived by probing the master, which reads the pair).
  const STATEFUL = `
  contract StatefulAuth(pubkey owner) {
      int count;
      function bump(bytes32 h, int v, bytes32 r, bytes32 s) {
          require(ecrecoverPubKey(h, v, r, s) == owner);
          this.count = this.count + 1;
      }
  }`;
  it('STATEFUL: a stateful contract authenticates via ecrecoverPubKey + increments state', async () => {
    const artifact = compileString(STATEFUL);
    expect(artifact.abi.find((fn) => fn.name === 'bump')?.ecrecoverCompute).toBe(true);
    const provider = createTestProvider();
    const { h, v, r, s, owner } = await goodSigner('stateful');
    const contract = new Contract(artifact, [owner], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { count: 0n }, { saltContract: true },
    );
    const salt = hexToBin(categoryId).slice().reverse();   // branded: the covenant/resolve use the reversed category
    for (const role of ['A', 'B'] as const) {
      await provider.addUtxo(binToHex(ecrecoverComputeLockingBytecode(salt, role)), {
        ...randomUtxo({ satoshis: 100_000n }),
        token: { category: SIDECAR_CAT, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
      });
    }
    const sc = StatefulContract.withCategory(contract, categoryId);
    const tx = await sc.bump(h, v, r, s).send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  // ecrecoverEvm INSIDE a loop: each iteration co-spends a recovery pair AND a keccak side-car (stride 3: A,B,K per
  // iteration, forward-indexed at [master+3k+1/+2/+3]), projecting each recovered key to its 20-byte EVM address.
  const LOOP_EVM = `
  contract AuthLoopEvm(bytes20 owner) {
      function verify(bytes32[] h, int[] v, bytes32[] r, bytes32[] s, int n) {
          for (int i = 0; i < n; i++) {
              require(ecrecoverEvm(h[i], v[i], r[i], s[i]) == owner);
          }
      }
  }`;
  it('LOOP + ecrecoverEvm (runtime-bound): recovers each signer EVM address (N=3)', async () => {
    const artifact = compileString(LOOP_EVM);
    expect(artifact.abi.find((fn) => fn.name === 'verify')?.ecrecoverLoopReads).toBe(true);
    const provider = new MockNetworkProvider();
    const w = ethers.Wallet.createRandom();
    const g = await Promise.all([0, 1, 2].map((k) => goodRecovery('evmloop-' + k, w)));  // same signer, 3 messages
    const owner = hexToBin(w.address.slice(2));
    const contract = new Contract(artifact, [owner], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 2_000_000n }));
    await deployPair(provider, SHARED_LIBRARY_SALT, 3);
    await deployKeccak(provider, SHARED_LIBRARY_SALT, 3, true);   // STATEFUL keccak side-cars (forward self-preserving)
    const tx = await new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(),
        contract.unlock.verify(g.map((x) => x.h), g.map((x) => x.v), g.map((x) => x.r), g.map((x) => x.s), 3n))
      .addOutput({ to: contract.address, amount: 1_500_000n })
      .send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('LOOP + ecrecoverEvm: rejects when one iteration signer is an imposter', async () => {
    const artifact = compileString(LOOP_EVM);
    const provider = new MockNetworkProvider();
    const w = ethers.Wallet.createRandom(), imposter = ethers.Wallet.createRandom();
    const g = [await recovery('el-0', w), await recovery('el-1', imposter), await recovery('el-2', w)];
    const contract = new Contract(artifact, [hexToBin(w.address.slice(2))], { provider });  // owner = w; g[1] imposter
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 2_000_000n }));
    await deployPair(provider, SHARED_LIBRARY_SALT, 3);
    await deployKeccak(provider, SHARED_LIBRARY_SALT, 3, true);
    await expect(new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(),
        contract.unlock.verify(g.map((x) => x.h), g.map((x) => x.v), g.map((x) => x.r), g.map((x) => x.s), 3n))
      .addOutput({ to: contract.address, amount: 1_500_000n })
      .send()).rejects.toThrow();
  });

  it('LOOP (fixed-bound): rejects when one iteration signature is wrong', async () => {
    const artifact = compileString(LOOP);
    const provider = new MockNetworkProvider();
    const w = ethers.Wallet.createRandom(), other = ethers.Wallet.createRandom();
    const g0 = await goodRecovery('loop-a', w), g1 = await goodRecovery('loop-b', other);  // g1 is a DIFFERENT signer
    const contract = new Contract(artifact, [g0.owner], { provider });  // owner = w, so g1 must fail
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    await deployPair(provider, SHARED_LIBRARY_SALT, 2);
    await expect(new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(),
        contract.unlock.verify([g0.h, g1.h], [g0.v, g1.v], [g0.r, g1.r], [g0.s, g1.s]))
      .addOutput({ to: contract.address, amount: 800_000n })
      .send()).rejects.toThrow();
  });
});
