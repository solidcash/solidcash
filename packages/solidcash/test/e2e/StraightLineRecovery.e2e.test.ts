/**
 * Straight-line recoveries in stateful functions on the production profile: BCH's 2026 limits, the standard relay
 * policy, and no coin the network does not already hold.
 *
 * A two-covenant recovery reads A and B2 and leaves its middle slot to a coin no covenant reads, which the call's wallet
 * fills and an output at the same index returns. A width-0 recovery reads A, M and B3. `ecrecoverEvm` and
 * `ecrecoverP2pkh` answer the zero address, as the EVM's precompile does, for every argument it refuses: for a `v`
 * other than 27 or 28, or an `r` or `s` outside [1, n), without reading their slots, which take wallet coins; for an
 * `r` in range that no curve point has, once the pad of the pool's A in the first slot proves it; and for a key at
 * infinity, once a pair over the digest shifted by -2^128 r mod n recovers 2^128 G. Each sent transaction is checked by
 * the VM; each tamper case changes one part of it and expects the input that binds that part to refuse.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeAuthenticationInstructions, decodeTransactionUnsafe, encodeAuthenticationInstructions,
  encodeLockingBytecodeP2pkh, hash160, hexToBin, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { SignatureTemplate, Signer } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { broadcastDeployerPreps, buildDeployerPrep } from '../../src/stateful/deployer.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { addressToLockScript, solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { computeEcrecoverWitness } from '../../src/ecrecover/ecrecoverRecovery.js';
import { probeEcrecoverSplit } from '../../src/ecrecover/ecrecoverComputeSidecar.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Artifact } from '@solidcash/utils';
import type { Output, Unlocker, Utxo } from '../../src/interfaces.js';
import type { DeployResult } from '../../src/stateful/stateful-lifecycle-types.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const P = 'pragma solidcash ^0.52.0;';
const compileOptions = (primary: string): never => ({
  deployer: true, genesisCalls: true, messageBus: false, primaryContractName: primary,
}) as never;

let serial = 0x5100;
const nextTxid = (): string => (serial++).toString(16).padStart(64, '0');

type Sent = { transaction: ReturnType<typeof decodeTransactionUnsafe>; sourceOutputs: any[] };

/** The outputs a transaction's inputs spend, read from the provider's ledger. */
async function spentOutputs(provider: MockNetworkProvider, hex: string): Promise<Sent> {
  const transaction = decodeTransactionUnsafe(hexToBin(hex));
  const sourceOutputs = await Promise.all(transaction.inputs.map(async (input) => {
    const spent = await provider.getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex);
    if (spent === undefined) throw new Error('an input of the transaction is not on the ledger');
    return solidCashOutputToLibauthOutput({
      to: spent.lockingBytecode, amount: spent.satoshis, ...(spent.token === undefined ? {} : { token: spent.token }),
    });
  }));
  return { transaction, sourceOutputs };
}

interface Setup {
  provider: MockNetworkProvider;
  authorLock: Uint8Array;
  deploy(artifact: Artifact, args?: unknown[], extra?: Record<string, unknown>): Promise<DeployResult<Artifact>>;
  wallet(): Promise<Signer>;
  /** Every transaction sent so far, with the outputs its inputs spend. */
  sent: Sent[];
  /** The creation of `artifact` with `extra`, captured instead of broadcast. */
  capture(artifact: Artifact, extra: Record<string, unknown>): Promise<Sent>;
}

function setup(): Setup {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
  const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
  const sent: Sent[] = [];
  const original = provider.sendRawTransaction.bind(provider);
  (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
    sent.push(await spentOutputs(provider, hex));
    return original(hex);
  };
  const fund = async (): Promise<Utxo> => {
    const utxo: Utxo = { txid: nextTxid(), vout: 0, satoshis: 2_000_000n };
    await provider.seedUtxo(binToHex(authorLock), utxo);
    return utxo;
  };
  const deploy = async (
    artifact: Artifact, args: unknown[] = [], extra: Record<string, unknown> = {},
  ): Promise<DeployResult<Artifact>> => StatefulContract.deploy(artifact, args as never, {
    provider, fundingUtxo: await fund(), funder, changeAddress: change.address, senderLockingBytecode: authorLock,
    ...extra,
  } as never);
  const wallet = async (): Promise<Signer> => {
    const signer = new Signer(alicePriv, provider);
    for (let index = 0; index < 6; index += 1) {
      await provider.seedUtxo(signer.getAddress(), { txid: nextTxid(), vout: 0, satoshis: 200_000n });
    }
    return signer;
  };
  const capture = async (artifact: Artifact, extra: Record<string, unknown>): Promise<Sent> => {
    const fundingUtxo = await fund();
    const { prep } = await buildDeployerPrep({
      children: [{ deployer: artifact.deployer!, contractName: artifact.contractName }],
      fundingUtxos: [fundingUtxo], authorSigner: funder, authorLockingBytecode: authorLock,
      changeLockingBytecode: authorLock, provider,
    });
    await broadcastDeployerPreps([prep], provider);
    const send = provider.sendRawTransaction.bind(provider);
    let captured: Sent | undefined;
    (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
      const creation = await spentOutputs(provider, hex);
      const deployerLock = artifact.deployer!.lockingBytecode;
      if (!creation.sourceOutputs.some((output) => binToHex(output.lockingBytecode) === deployerLock)) return send(hex);
      captured = creation;
      throw new Error('creation captured');
    };
    try {
      await expect(StatefulContract.deploy(artifact, [], {
        provider, fundingUtxo, funder, changeAddress: change.address, senderLockingBytecode: authorLock,
        deployerPrep: prep, ...extra,
      } as never)).rejects.toThrow('creation captured');
    } finally {
      (provider as any).sendRawTransaction = send;
    }
    return captured!;
  };
  return { provider, authorLock, deploy, wallet, sent, capture };
}

type Signed = { h: Uint8Array; v: bigint; r: Uint8Array; s: Uint8Array; key: Uint8Array; address: Uint8Array };

const little = (hex: string): Uint8Array => Uint8Array.from(hexToBin(hex.replace(/^0x/, ''))).reverse();

/**
 * A signature by one fixed key over `message`, in the little-endian words the native recovery reads, with the key and
 * EVM address it recovers. Its ladder splits over two covenants (a width-0 one would take A, M and B3 instead).
 */
async function signed(message: string): Promise<Signed> {
  const { ethers } = await import('ethers');
  const wallet = new ethers.Wallet(`0x${'44'.repeat(32)}`);
  const parsed = ethers.Signature.from(await wallet.signMessage(message));
  const result = {
    h: little(ethers.hashMessage(message)), v: BigInt(parsed.v), r: little(parsed.r), s: little(parsed.s),
    key: hexToBin(wallet.signingKey.compressedPublicKey.replace(/^0x/, '')), address: hexToBin(wallet.address.slice(2)),
  };
  const coin = { txid: 'aa'.repeat(32), vout: 0, satoshis: 100_000n,
    token: { category: 'ee'.repeat(32), amount: 0n, nft: { capability: 'mutable' as const, commitment: '' } } };
  probeEcrecoverSplit(computeEcrecoverWitness(result.h, Number(result.v), result.r, result.s), new Uint8Array(32), coin,
    { ...coin, txid: 'bb'.repeat(32) });
  return result;
}

/** A measured width-0 signature: its ladder fits no two-covenant split, so it takes A, M and B3. */
const WIDTH0 = {
  digest: '398eed067d4a815e6ba5220239bf7ebf7b4fcf2c51faee52f0db375644c0aa67',
  v: 27,
  r: 'd94a22918b3e004b321a8d499c70d153be8a3bd7c85591c5709bf8013e8af39c',
  s: '6a8ff1cd7003b7480a579bbd9d5ba68e17a04e0d3842226b6cb651176def9d32',
};

/** Coins of the recovery pool under `salt`, `count` of each role, and of the stateful keccak lock with `keccak`. */
async function seedPool(
  provider: MockNetworkProvider, salt: Uint8Array, count: number, tag: number, keccak = false,
): Promise<void> {
  const { ecrecoverComputeLockingBytecode, keccakComputeLockingBytecode } = await import('@solidcash/utils');
  const locks = [
    ...(['A', 'B2', 'M', 'B3'] as const).map((role) => ecrecoverComputeLockingBytecode(salt, role)),
    ...(keccak ? [keccakComputeLockingBytecode(salt, true)] : []),
  ];
  for (const [lockIndex, lock] of locks.entries()) {
    for (let index = 0; index < count; index += 1) {
      await provider.seedUtxo(binToHex(lock), {
        txid: `${tag.toString(16).padStart(2, '0')}${lockIndex.toString(16)}${index.toString(16).padStart(2, '0')}`
          .padEnd(64, '0'),
        vout: 0, satoshis: 100_000n,
        token: { category: 'ed'.repeat(31) + '17', amount: 0n, nft: { capability: 'mutable', commitment: '' } },
      });
    }
  }
}

/** The salt of a contract's own (branded) side-car pool: its category, reversed. */
const brand = (categoryId: string): Uint8Array => hexToBin(categoryId).slice().reverse();

const same = (left: Uint8Array, right: Uint8Array): boolean => binToHex(left) === binToHex(right);
const inputAt = (sent: Sent, lock: Uint8Array): number => sent.sourceOutputs
  .findIndex((output) => same(output.lockingBytecode, lock));

/** The VM's verdict on one input of `sent`. */
function inputPasses(provider: MockNetworkProvider, sent: Sent, inputIndex: number): boolean {
  const vm = createVirtualMachineBch2026ForProvider(provider);
  return vm.stateSuccess(vm.evaluate({ ...sent, inputIndex } as never) as never) === true;
}

/** `sent` with output `index` replaced. */
const withOutput = (sent: Sent, index: number, change: (output: any) => any): Sent => ({
  sourceOutputs: sent.sourceOutputs,
  transaction: {
    ...sent.transaction,
    outputs: sent.transaction.outputs.map((output, at) => (at === index ? change(output) : output)),
  },
});

/** `sent` with inputs `left` and `right` swapped, with their coins and their outputs. */
const swapIndexes = (sent: Sent, left: number, right: number): Sent => {
  const swap = <T>(items: readonly T[]): T[] => items.map((item, at) => (
    at === left ? items[right]! : at === right ? items[left]! : item));
  return {
    sourceOutputs: swap(sent.sourceOutputs),
    transaction: { ...sent.transaction, inputs: swap(sent.transaction.inputs), outputs: swap(sent.transaction.outputs) },
  };
};

/** `sent` with the coin input `index` spends replaced by `output`. */
const withSpentCoin = (sent: Sent, index: number, output: any): Sent => ({
  transaction: sent.transaction,
  sourceOutputs: sent.sourceOutputs.map((spent, at) => (at === index ? output : spent)),
});

/** A recovered key in B's recreation with one byte of its x coordinate changed. */
const otherKey = (output: any): any => {
  const commitment = Uint8Array.from(output.token.nft.commitment);
  commitment[1] ^= 1;
  return { ...output, token: { ...output.token, nft: { ...output.token.nft, commitment } } };
};

const bumpCommitment = (output: any): any => {
  const commitment = Uint8Array.from(output.token.nft.commitment);
  commitment[commitment.length - 1] ^= 1;
  return { ...output, token: { ...output.token, nft: { ...output.token.nft, commitment } } };
};

/**
 * `sent` with the master's push of the recovery's `v` replaced by a push of `to`. The arguments are pushed last first,
 * so `v` is the push between those of `r` and of the digest `h`.
 */
function withMasterV(sent: Sent, master: number, h: Uint8Array, r: Uint8Array, to: number): Sent {
  const instructions = decodeAuthenticationInstructions(sent.transaction.inputs[master]!.unlockingBytecode);
  const pushes = (index: number, data: Uint8Array): boolean => {
    const instruction = instructions[index] as { data?: Uint8Array } | undefined;
    return instruction?.data !== undefined && same(instruction.data, data);
  };
  const at = instructions.findIndex((_, index) => pushes(index - 1, r) && pushes(index + 1, h));
  expect(at).toBeGreaterThan(0);
  const rewritten = instructions.map((instruction, index) => (index === at
    ? { opcode: 0x01, data: Uint8Array.of(to) } : instruction));
  const unlockingBytecode = encodeAuthenticationInstructions(rewritten as never);
  return {
    sourceOutputs: sent.sourceOutputs,
    transaction: {
      ...sent.transaction,
      inputs: sent.transaction.inputs.map((input, index) => (index === master ? { ...input, unlockingBytecode } : input)),
    },
  };
}

/** The P2PKH locking bytecode of a compressed key: what `ecrecoverP2pkh` answers. */
const p2pkhOf = (key: Uint8Array): Uint8Array => encodeLockingBytecodeP2pkh(hash160(key));

/** The first push of input `index`'s unlocking bytecode: a recovery side-car's pad. */
const padOf = (sent: Sent, index: number): Uint8Array => (
  decodeAuthenticationInstructions(sent.transaction.inputs[index]!.unlockingBytecode)[0] as { data: Uint8Array }).data;

/** `sent` with the pad of input `index` opening with `word` (32 bytes) and zero after it, its length kept. */
function withPad(sent: Sent, index: number, word: Uint8Array): Sent {
  const instructions = decodeAuthenticationInstructions(sent.transaction.inputs[index]!.unlockingBytecode);
  const pad = new Uint8Array((instructions[0] as { data: Uint8Array }).data.length);
  pad.set(word);
  const unlockingBytecode = encodeAuthenticationInstructions(
    [{ ...instructions[0], data: pad }, ...instructions.slice(1)] as never);
  return {
    sourceOutputs: sent.sourceOutputs,
    transaction: {
      ...sent.transaction,
      inputs: sent.transaction.inputs.map((input, at) => (at === index ? { ...input, unlockingBytecode } : input)),
    },
  };
}

/** A little-endian word read as an unsigned number. */
const unsignedOf = (word: Uint8Array): bigint => BigInt(`0x${binToHex(Uint8Array.from(word).reverse()) || '0'}`);

/** The digest shifted by -2^128 r mod n: a pair recovers the key of (h, v, r, s) plus 2^128 G from it. */
const shiftedDigest = (h: Uint8Array, r: Uint8Array): Uint8Array => {
  const order = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
  const value = (((unsignedOf(h) - (unsignedOf(r) << 128n)) % order) + order) % order;
  return Uint8Array.from({ length: 32 }, (_, index) => Number((value >> BigInt(8 * index)) & 0xffn));
};

/** Arguments whose key is the point at infinity, drawn from `tag`: R = (z/s) G, so that s R = z G. */
async function infinityArgs(tag: string): Promise<[Uint8Array, bigint, Uint8Array, Uint8Array]> {
  const { secp256k1 } = await import('@noble/curves/secp256k1');
  const { sha256, utf8ToBin } = await import('@bitauth/libauth');
  const order = secp256k1.CURVE.n;
  const word = (value: bigint): Uint8Array => Uint8Array.from(
    { length: 32 }, (_, i) => Number((value >> BigInt(8 * i)) & 0xffn));
  for (let draw = 0; ; draw += 1) {
    const drawn = (part: string): bigint => BigInt(`0x${binToHex(sha256.hash(utf8ToBin(`${tag}/${part}/${draw}`)))}`) % order;
    const z = drawn('z'), s = drawn('s') || 1n;
    let inverse = 1n;
    for (let b = s, e = order - 2n; e > 0n; b = (b * b) % order, e >>= 1n) if (e & 1n) inverse = (inverse * b) % order;
    const point = secp256k1.ProjectivePoint.BASE.multiply((z * inverse) % order).toAffine();
    if (point.x < order) return [word(z), 27n + (point.y & 1n), word(point.x), word(s)];
  }
}

/**
 * `sent` with a genuine two-covenant pair over `witness` at the A slot `a` and the B2 slot `a + 2`, on the coins
 * already there, or undefined when the witness's ladder fits no two-covenant split.
 */
async function withPair(sent: Sent, a: number, witness: ReturnType<typeof computeEcrecoverWitness>, salt: Uint8Array):
Promise<Sent | undefined> {
  const { buildEcrecoverComputeSidecars } = await import('../../src/ecrecover/ecrecoverComputeSidecar.js');
  const coin = (index: number): Utxo => ({
    txid: 'cc'.repeat(32), vout: index, satoshis: sent.sourceOutputs[index].valueSatoshis,
    token: { category: 'ee'.repeat(32), amount: 0n, nft: { capability: 'mutable', commitment: '' } },
  });
  let chunkA: number;
  try {
    chunkA = probeEcrecoverSplit(witness, salt, coin(a), coin(a + 2));
  } catch {
    return undefined;
  }
  const pair = buildEcrecoverComputeSidecars(witness, chunkA, salt, coin(a), coin(a + 2), undefined, 'B2');
  const replaced = new Map<number, { unlocker: Unlocker; recreate: Output }>([
    [a, { unlocker: pair.unlockerA, recreate: pair.recreateA }],
    [a + 2, { unlocker: pair.unlockerB, recreate: pair.recreateB }],
  ]);
  return {
    sourceOutputs: sent.sourceOutputs,
    transaction: {
      ...sent.transaction,
      inputs: sent.transaction.inputs.map((input, index) => {
        const entry = replaced.get(index);
        return entry === undefined ? input
          : { ...input, unlockingBytecode: entry.unlocker.generateUnlockingBytecode({} as never) };
      }),
      outputs: sent.transaction.outputs.map((output, index) => {
        const entry = replaced.get(index);
        if (entry === undefined) return output;
        const commitment = hexToBin(entry.recreate.token!.nft!.commitment);
        return { ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment } } };
      }),
    },
  };
}

const PROJECTIONS = [
  { name: 'ecrecoverPubKey', owner: 'pubkey', expected: (g: Signed) => g.key, keccak: false },
  { name: 'ecrecoverP2pkh', owner: 'address', expected: (g: Signed) => p2pkhOf(g.key), keccak: false },
  { name: 'ecrecoverEvm', owner: 'bytes20', expected: (g: Signed) => g.address, keccak: true },
] as const;

describe('an ordinary call that recovers a key straight-line', () => {
  for (const projection of PROJECTIONS) {
    it(`takes a wallet coin for the middle input of a two-covenant ${projection.name}, returned at its own index`,
      async () => {
        const { ecrecoverComputeLockingBytecode, keccakComputeLockingBytecode } = await import('@solidcash/utils');
        const source = `${P} contract T(${projection.owner} owner) { int n;
          function f(bytes32 h, int v, bytes32 r, bytes32 s) external returns (bool) {
            require(${projection.name}(h, v, r, s) == owner); n = n + 1; return true; } }`;
        const s = setup();
        const g = await signed(`straight-line-${projection.name}`);
        const artifact = compileString(source, compileOptions('T'));
        const fn = artifact.abi.find((entry) => entry.name === 'f')!;
        // The block: master, record, the recovery's three slots, and the record slot.
        expect(fn.blockLayout!.slots.map((slot) => slot.kind)).toEqual([
          'master', 'dataNft',
          ...(projection.keccak ? ['keccakSideCar'] : []),
          'ecrecoverSideCar', 'ecrecoverSideCar', 'ecrecoverSideCar', 'returnEvent',
        ]);
        const t = await s.deploy(artifact, [projection.expected(g)]);
        const salt = brand(t.categoryId);
        await seedPool(s.provider, salt, 1, 0xc1, projection.keccak);
        const wallet = await s.wallet();
        await (t.contract.connect(wallet) as any).call.f(g.h, g.v, g.r, g.s).send();
        const sent = s.sent[s.sent.length - 1]!;
        expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
        expect(((await t.contract.getState()) as { n?: bigint }).n).toBe(1n);

        // A, the wallet coin and B2 at the recovery's slots, each recreated at its own index.
        const master = inputAt(sent, addressToLockScript(t.contract.address));
        const a = master + (projection.keccak ? 3 : 2);
        const lockA = ecrecoverComputeLockingBytecode(salt, 'A');
        const lockB = ecrecoverComputeLockingBytecode(salt, 'B2');
        const walletLock = addressToLockScript(wallet.getAddress());
        expect(same(sent.sourceOutputs[a].lockingBytecode, lockA)).toBe(true);
        expect(same(sent.sourceOutputs[a + 1].lockingBytecode, walletLock)).toBe(true);
        expect(same(sent.sourceOutputs[a + 2].lockingBytecode, lockB)).toBe(true);
        expect(same(sent.transaction.outputs[a]!.lockingBytecode, lockA)).toBe(true);
        expect(same(sent.transaction.outputs[a + 1]!.lockingBytecode, walletLock)).toBe(true);
        expect(sent.transaction.outputs[a + 1]!.valueSatoshis).toBe(sent.sourceOutputs[a + 1].valueSatoshis);
        expect(same(sent.transaction.outputs[a + 2]!.lockingBytecode, lockB)).toBe(true);

        // Another key in B's recreation: refused by B's covenant and by the master, which reads it.
        const forged = withOutput(sent, a + 2, otherKey);
        expect(inputPasses(s.provider, forged, a + 2)).toBe(false);
        expect(inputPasses(s.provider, forged, master)).toBe(false);
        // A and B swapped, and the wallet coin where the master reads A.
        expect(inputPasses(s.provider, swapIndexes(sent, a, a + 2), master)).toBe(false);
        expect(inputPasses(s.provider, swapIndexes(sent, a, a + 1), master)).toBe(false);
        if (projection.keccak) {
          // Another digest in the keccak side-car's recreation: the master reads the address from it.
          const keccak = master + 2;
          expect(same(sent.sourceOutputs[keccak].lockingBytecode, keccakComputeLockingBytecode(salt, true))).toBe(true);
          expect(inputPasses(s.provider, withOutput(sent, keccak, bumpCommitment), master)).toBe(false);
        }

        // No covenant reads the middle slot: B2 chains from A two inputs back, and the master reads A and B by their
        // slots. A coin of another lock there, or its value paid elsewhere, leaves the master, the record, A and B as
        // they were; the wallet's own signatures, which sign every spent coin and every output, refuse both.
        const covenants = [master, master + 1, a, a + 2];
        const otherLock = withSpentCoin(sent, a + 1, {
          ...sent.sourceOutputs[a + 1], lockingBytecode: hexToBin(`aa20${'11'.repeat(32)}87`),
        });
        const paidElsewhere = withOutput(sent, a + 1, (output) => ({
          ...output, lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 1000n,
        }));
        for (const edited of [otherLock, paidElsewhere]) {
          for (const index of covenants) expect(inputPasses(s.provider, edited, index)).toBe(true);
          const signedByWallet = sent.sourceOutputs.map((output, index) => (same(output.lockingBytecode, walletLock)
            ? index : -1)).filter((index) => index >= 0 && index !== a + 1);
          expect(signedByWallet.length).toBeGreaterThan(0);
          for (const index of signedByWallet) expect(inputPasses(s.provider, edited, index)).toBe(false);
        }

        // A's pad opening with a word, as an off-curve proof's does: an address projection reads the word and refuses,
        // since no word proves that the signer's r, a point's x-coordinate, has no point; ecrecoverPubKey drops the pad
        // unread. A itself only drops its pad.
        for (const word of [leWord(1n), leWord(curveY(unsignedOf(g.r))!)]) {
          const proved = withPad(sent, a, word);
          expect(inputPasses(s.provider, proved, master)).toBe(projection.name === 'ecrecoverPubKey');
          expect(inputPasses(s.provider, proved, a)).toBe(true);
        }

        // The pair a builder lays out to claim that these arguments recover the point at infinity: a genuine pair over
        // the digest shifted by -2^128 r mod n. It recovers the signer's key plus 2^128 G, not 2^128 G, so every
        // projection refuses it, though each side-car of it is valid.
        const claimed = await withPair(sent, a, computeEcrecoverWitness(shiftedDigest(g.h, g.r), Number(g.v), g.r, g.s),
          salt);
        if (claimed !== undefined) {
          expect(inputPasses(s.provider, claimed, a)).toBe(true);
          expect(inputPasses(s.provider, claimed, a + 2)).toBe(true);
          expect(inputPasses(s.provider, claimed, master)).toBe(false);
        }
      });
  }

  it('takes A, M and B3 from the pool for a width-0 recovery, and refuses a middle input of another lock', async () => {
    const { ethers } = await import('ethers');
    const { ecrecoverComputeLockingBytecode } = await import('@solidcash/utils');
    const signature = ethers.Signature.from({ r: `0x${WIDTH0.r}`, s: `0x${WIDTH0.s}`, v: WIDTH0.v });
    const owner = hexToBin(ethers.SigningKey.computePublicKey(
      ethers.SigningKey.recoverPublicKey(`0x${WIDTH0.digest}`, signature), true).slice(2));
    const source = `${P} contract T(pubkey owner) { int n;
      function f(bytes32 h, int v, bytes32 r, bytes32 s) external returns (bool) {
        require(ecrecoverPubKey(h, v, r, s) == owner); n = n + 1; return true; } }`;
    const s = setup();
    const t = await s.deploy(compileString(source, compileOptions('T')), [owner]);
    const salt = brand(t.categoryId);
    await seedPool(s.provider, salt, 1, 0xc2);
    await (t.contract.connect(await s.wallet()) as any).call.f(
      little(WIDTH0.digest), BigInt(WIDTH0.v), little(WIDTH0.r), little(WIDTH0.s),
    ).send();
    const sent = s.sent[s.sent.length - 1]!;
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
    expect(((await t.contract.getState()) as { n?: bigint }).n).toBe(1n);
    const master = inputAt(sent, addressToLockScript(t.contract.address));
    const roles = (['A', 'M', 'B3'] as const).map((role) => ecrecoverComputeLockingBytecode(salt, role));
    roles.forEach((lock, offset) => expect(same(sent.sourceOutputs[master + 2 + offset].lockingBytecode, lock)).toBe(true));
    // M's checkpoint is what B3 ladders from, so the master requires M's own covenant there (audit ECR-1).
    const otherLock = withSpentCoin(sent, master + 3, {
      ...sent.sourceOutputs[master + 3], lockingBytecode: hexToBin(`aa20${'11'.repeat(32)}87`),
    });
    expect(inputPasses(s.provider, otherLock, master)).toBe(false);
    expect(inputPasses(s.provider, withOutput(sent, master + 4, otherKey), master)).toBe(false);
  });

  it('lays out a recovery beside a fixed keccak256 side-car, ecrecoverEvm sharing its batch', async () => {
    const { ecrecoverComputeLockingBytecode, keccakComputeLockingBytecode } = await import('@solidcash/utils');
    const { keccak_256: keccak } = await import('@noble/hashes/sha3.js');
    const source = `${P} contract T(pubkey owner) { bytes32 d; int n;
        function f(bytes32 b, bytes32 h, int v, bytes32 r, bytes32 s) external returns (bool) {
          d = keccak256(b); require(ecrecoverPubKey(h, v, r, s) == owner); n = n + 1; return true; } }
      contract E(bytes20 owner) { bytes32 d; int n;
        function f(bytes32 b, bytes32 h, int v, bytes32 r, bytes32 s) external returns (bool) {
          d = keccak256(b); require(ecrecoverEvm(h, v, r, s) == owner); n = n + 1; return true; } }`;
    for (const [primary, tag] of [['T', 0xc3], ['E', 0xc4]] as const) {
      const s = setup();
      const g = await signed(`straight-line-beside-keccak-${primary}`);
      const t = await s.deploy(compileString(source, compileOptions(primary)), [primary === 'T' ? g.key : g.address]);
      const salt = brand(t.categoryId);
      // The pool offers a keccak coin per keccak256 call, though an ecrecoverEvm's preimage shares the first one's
      // side-car.
      await seedPool(s.provider, salt, 2, tag, true);
      const wallet = await s.wallet();
      const b = new Uint8Array(32).fill(7);
      await (t.contract.connect(wallet) as any).call.f(b, g.h, g.v, g.r, g.s).send();
      const sent = s.sent[s.sent.length - 1]!;
      expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
      expect(binToHex(((await t.contract.getState()) as { d?: Uint8Array }).d!)).toBe(binToHex(keccak(b)));
      // Master, record, the keccak side-car, then A, the wallet coin and B2.
      const master = inputAt(sent, addressToLockScript(t.contract.address));
      expect(same(sent.sourceOutputs[master + 2].lockingBytecode, keccakComputeLockingBytecode(salt, true))).toBe(true);
      expect(same(sent.sourceOutputs[master + 3].lockingBytecode, ecrecoverComputeLockingBytecode(salt, 'A'))).toBe(true);
      expect(same(sent.sourceOutputs[master + 4].lockingBytecode, addressToLockScript(wallet.getAddress()))).toBe(true);
      expect(same(sent.sourceOutputs[master + 5].lockingBytecode, ecrecoverComputeLockingBytecode(salt, 'B2'))).toBe(true);
      // Another digest (the first of the batch, which `d` reads), and another key.
      const digest = withOutput(sent, master + 2, (output) => {
        const commitment = Uint8Array.from(output.token.nft.commitment);
        commitment[0] ^= 1;
        return { ...output, token: { ...output.token, nft: { ...output.token.nft, commitment } } };
      });
      expect(inputPasses(s.provider, digest, master)).toBe(false);
      expect(inputPasses(s.provider, withOutput(sent, master + 5, otherKey), master)).toBe(false);
      if (primary === 'E') {
        // The batch's second digest is the recovered key's, which the address is cut from.
        expect(inputPasses(s.provider, withOutput(sent, master + 2, bumpCommitment), master)).toBe(false);
      }
    }
  });

  it('takes a wallet coin for each of two recoveries, and binds each triple to its own arguments', async () => {
    const source = `${P} contract T(pubkey a, pubkey b) { int n;
      function f(bytes32 h1, int v1, bytes32 r1, bytes32 s1, bytes32 h2, int v2, bytes32 r2, bytes32 s2)
        external returns (bool) {
        require(ecrecoverPubKey(h1, v1, r1, s1) == a); require(ecrecoverPubKey(h2, v2, r2, s2) == b); n = n + 1;
        return true; } }`;
    const s = setup();
    const g1 = await signed('straight-line-two-0');
    const g2 = await signed('straight-line-two-1');
    const t = await s.deploy(compileString(source, compileOptions('T')), [g1.key, g2.key]);
    await seedPool(s.provider, brand(t.categoryId), 2, 0xc5);
    const wallet = await s.wallet();
    await (t.contract.connect(wallet) as any).call.f(g1.h, g1.v, g1.r, g1.s, g2.h, g2.v, g2.r, g2.s).send();
    const sent = s.sent[s.sent.length - 1]!;
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
    const master = inputAt(sent, addressToLockScript(t.contract.address));
    const walletLock = addressToLockScript(wallet.getAddress());
    expect(same(sent.sourceOutputs[master + 3].lockingBytecode, walletLock)).toBe(true);
    expect(same(sent.sourceOutputs[master + 6].lockingBytecode, walletLock)).toBe(true);
    expect(binToHex(sent.transaction.inputs[master + 3]!.outpointTransactionHash))
      .not.toBe(binToHex(sent.transaction.inputs[master + 6]!.outpointTransactionHash));
    // The two triples swapped: each recovery then meets the other's arguments in its A.
    const swapped = [0, 1, 2].reduce((tx, offset) => swapIndexes(tx, master + 2 + offset, master + 5 + offset), sent);
    expect(inputPasses(s.provider, swapped, master)).toBe(false);
  });

  it('learns a helper\'s recovery arguments from the run and takes a wallet coin for its middle input', async () => {
    const source = `${P} contract T(bytes20 owner) { int n;
      function signer(bytes32 digest, int vv, bytes32 rr, bytes32 ss) private pure returns (bytes20) {
        return ecrecoverEvm(digest, vv, rr, ss); }
      function f(bytes32 h, int v, bytes32 r, bytes32 s) external returns (bool) {
        require(signer(h, v, r, s) == owner); n = n + 1; return true; } }`;
    const s = setup();
    const g = await signed('straight-line-helper');
    const artifact = compileString(source, compileOptions('T'));
    expect((artifact.abi.find((entry) => entry.name === 'f')!.ecrecoverArgParams ?? []).flat()
      .filter((param) => param !== null)).toEqual([]);
    const t = await s.deploy(artifact, [g.address]);
    await seedPool(s.provider, brand(t.categoryId), 1, 0xc6, true);
    const wallet = await s.wallet();
    await (t.contract.connect(wallet) as any).call.f(g.h, g.v, g.r, g.s).send();
    const sent = s.sent[s.sent.length - 1]!;
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
    expect(((await t.contract.getState()) as { n?: bigint }).n).toBe(1n);
    const master = inputAt(sent, addressToLockScript(t.contract.address));
    expect(same(sent.sourceOutputs[master + 4].lockingBytecode, addressToLockScript(wallet.getAddress()))).toBe(true);
    expect(inputPasses(s.provider, withOutput(sent, master + 5, otherKey), master)).toBe(false);
  });

  it('learns a helper\'s width-0 recovery from the run and switches its slots to A, M and B3', async () => {
    const { ethers } = await import('ethers');
    const { ecrecoverComputeLockingBytecode } = await import('@solidcash/utils');
    const signature = ethers.Signature.from({ r: `0x${WIDTH0.r}`, s: `0x${WIDTH0.s}`, v: WIDTH0.v });
    const owner = hexToBin(ethers.SigningKey.computePublicKey(
      ethers.SigningKey.recoverPublicKey(`0x${WIDTH0.digest}`, signature), true).slice(2));
    const source = `${P} contract T(pubkey owner) { int n;
      function key(bytes32 digest, int vv, bytes32 rr, bytes32 ss) private pure returns (pubkey) {
        return ecrecoverPubKey(digest, vv, rr, ss); }
      function f(bytes32 h, int v, bytes32 r, bytes32 s) external returns (bool) {
        require(key(h, v, r, s) == owner); n = n + 1; return true; } }`;
    const s = setup();
    const t = await s.deploy(compileString(source, compileOptions('T')), [owner]);
    const salt = brand(t.categoryId);
    await seedPool(s.provider, salt, 1, 0xc8);
    await (t.contract.connect(await s.wallet()) as any).call.f(
      little(WIDTH0.digest), BigInt(WIDTH0.v), little(WIDTH0.r), little(WIDTH0.s),
    ).send();
    const sent = s.sent[s.sent.length - 1]!;
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
    expect(((await t.contract.getState()) as { n?: bigint }).n).toBe(1n);
    const master = inputAt(sent, addressToLockScript(t.contract.address));
    (['A', 'M', 'B3'] as const).forEach((role, offset) => expect(same(sent.sourceOutputs[master + 2 + offset].lockingBytecode,
      ecrecoverComputeLockingBytecode(salt, role))).toBe(true));
    expect(inputPasses(s.provider, withOutput(sent, master + 4, otherKey), master)).toBe(false);
  });

  it('answers the zero address through a helper for every argument the precompile refuses', async () => {
    // A helper's arguments are learned from the run: those the range rules refuse are never read, so the pair laid
    // out before the run (the placeholder recovery's) holds their slots; an r no point has and a key at infinity are
    // read, and their slots are laid out as a direct call's are.
    const { ecrecoverComputeLockingBytecode } = await import('@solidcash/utils');
    const source = `${P} contract T { bytes20 who; int n;
      function signer(bytes32 digest, int vv, bytes32 rr, bytes32 ss) private pure returns (bytes20) {
        return ecrecoverEvm(digest, vv, rr, ss); }
      function f(bytes32 h, int v, bytes32 r, bytes32 s) external returns (bool) {
        who = signer(h, v, r, s); n = n + 1; return true; } }`;
    const k = await signed('straight-line-helper-refused');
    const s = setup();
    const t = await s.deploy(compileString(source, compileOptions('T')));
    const salt = brand(t.categoryId);
    await seedPool(s.provider, salt, 2, 0xc9, true);
    const wallet = await s.wallet();
    const cases: Array<[[Uint8Array, bigint, Uint8Array, Uint8Array], string]> = [
      [[k.h, 0n, k.r, k.s], '00'.repeat(20)], [[k.h, k.v, k.r, leWord(ORDER)], '00'.repeat(20)],
      [[k.h, 27n, leWord(firstX(1n, false)), k.s], '00'.repeat(20)],
      [await infinityArgs('straight-line-helper-infinity'), '00'.repeat(20)],
      [[k.h, k.v, k.r, k.s], binToHex(k.address)],
    ];
    for (const [index, [args, who]] of cases.entries()) {
      await (t.contract.connect(wallet) as any).call.f(...args).send();
      const sent = s.sent[s.sent.length - 1]!;
      expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never), `case ${index}`).toBe(true);
      const state = (await t.contract.getState()) as { who?: Uint8Array; n?: bigint };
      expect(binToHex(state.who ?? new Uint8Array()), `case ${index}`).toBe(who);
      expect(state.n).toBe(BigInt(index + 1));
      if (index === 2) {
        // The off-curve r: the first slot's A carries the proof.
        const a = inputAt(sent, ecrecoverComputeLockingBytecode(salt, 'A'));
        const w = unsignedOf(padOf(sent, a));
        const x = firstX(1n, false);
        expect(modulo(w * w + x ** 3n + 7n, PRIME)).toBe(0n);
      }
    }
  });

  it('refuses before sending when the call has no signer to fill the middle input', async () => {
    const source = `${P} contract T(pubkey owner) { int n;
      function f(bytes32 h, int v, bytes32 r, bytes32 s) external returns (bool) {
        require(ecrecoverPubKey(h, v, r, s) == owner); n = n + 1; return true; } }`;
    const s = setup();
    const g = await signed('straight-line-no-signer');
    const t = await s.deploy(compileString(source, compileOptions('T')), [g.key]);
    await seedPool(s.provider, brand(t.categoryId), 1, 0xc7);
    const before = s.sent.length;
    await expect((t.contract as any).call.f(g.h, g.v, g.r, g.s).send())
      .rejects.toThrow(/middle input, which no covenant reads, takes a wallet coin.*connect a signer/);
    expect(s.sent).toHaveLength(before);
  });
});

/** The secp256k1 group order. */
const ORDER = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

/** A 32-byte little-endian word, the form the recovery takes its scalars in. */
const leWord = (value: bigint): Uint8Array => {
  const word = new Uint8Array(32);
  for (let index = 0, x = value; index < 32; index += 1, x >>= 8n) word[index] = Number(x & 0xffn);
  return word;
};

/** The secp256k1 field prime. */
const PRIME = 2n ** 256n - 2n ** 32n - 977n;

const modulo = (a: bigint, m: bigint): bigint => ((a % m) + m) % m;

const power = (base: bigint, exponent: bigint, m: bigint): bigint => {
  let result = 1n;
  for (let b = modulo(base, m), e = exponent; e > 0n; b = (b * b) % m, e >>= 1n) {
    if ((e & 1n) === 1n) result = (result * b) % m;
  }
  return result;
};

/** A y with y^2 = x^3 + 7 mod p, or undefined when no curve point has x as its x-coordinate. */
const curveY = (x: bigint): bigint | undefined => {
  const alpha = modulo(x ** 3n + 7n, PRIME);
  const y = power(alpha, (PRIME + 1n) / 4n, PRIME);
  return (y * y) % PRIME === alpha ? y : undefined;
};

/** The smallest x from `from` on that a curve point has (`onCurve`) or that none has. */
const firstX = (from: bigint, onCurve: boolean): bigint => {
  let x = from;
  while ((curveY(x) !== undefined) !== onCurve) x += 1n;
  return x;
};

describe('a straight-line recovery whose arguments recover no key', () => {
  const SOURCE = `${P} contract E { bytes20 who; int n;
      function f(bytes32 h, int v, bytes32 r, bytes32 s) external returns (bool) {
        who = ecrecoverEvm(h, v, r, s); n = n + 1; return true; } }
    contract Q { address who; int n;
      function f(bytes32 h, int v, bytes32 r, bytes32 s) external returns (bool) {
        who = ecrecoverP2pkh(h, v, r, s); n = n + 1; return true; } }
    contract K { pubkey who; int n;
      function f(bytes32 h, int v, bytes32 r, bytes32 s) external returns (bool) {
        who = ecrecoverPubKey(h, v, r, s); n = n + 1; return true; } }`;

  for (const [primary, zero] of [['E', '00'.repeat(20)], ['Q', '']] as const) {
    for (const v of [0n, 29n]) {
      it(`answers the zero address for v = ${v} under ${primary === 'E' ? 'ecrecoverEvm' : 'ecrecoverP2pkh'}, `
        + 'reading none of the wallet coins in its slots', async () => {
        const { ecrecoverComputeLockingBytecode } = await import('@solidcash/utils');
        const s = setup();
        const g = await signed('straight-line-invalid-v');
        const t = await s.deploy(compileString(SOURCE, compileOptions(primary)));
        const salt = brand(t.categoryId);
        await seedPool(s.provider, salt, 1, 0xd0, primary === 'E');
        const wallet = await s.wallet();
        await (t.contract.connect(wallet) as any).call.f(g.h, v, g.r, g.s).send();
        const sent = s.sent[s.sent.length - 1]!;
        expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
        const state = (await t.contract.getState()) as { who?: Uint8Array; n?: bigint };
        expect(binToHex(state.who ?? new Uint8Array())).toBe(zero);
        expect(state.n).toBe(1n);
        // The three slots hold wallet coins, each returned at its own index; no coin of the recovery pool is spent.
        const master = inputAt(sent, addressToLockScript(t.contract.address));
        const a = master + (primary === 'E' ? 3 : 2);
        const walletLock = addressToLockScript(wallet.getAddress());
        for (const index of [a, a + 1, a + 2]) {
          expect(same(sent.sourceOutputs[index].lockingBytecode, walletLock)).toBe(true);
          expect(same(sent.transaction.outputs[index]!.lockingBytecode, walletLock)).toBe(true);
          expect(sent.transaction.outputs[index]!.valueSatoshis).toBe(sent.sourceOutputs[index].valueSatoshis);
        }
        for (const role of ['A', 'B2', 'M', 'B3'] as const) {
          expect(inputAt(sent, ecrecoverComputeLockingBytecode(salt, role))).toBe(-1);
        }
        // The same transaction with v = 27: the master now reads its side-cars, which these coins are not.
        expect(inputPasses(s.provider, withMasterV(sent, master, g.h, g.r, 27), master)).toBe(false);
      });
    }
  }

  const g = signed('straight-line-no-key');
  const GX = 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n;
  // R = G, s = 1 and a digest of 1: the recovered key is (G - G)/r, the point at infinity. Its R is a base of the
  // side-cars' GLV table, whose check meets the doubling G + G that its affine additions cannot take, so no pair
  // serves it, shifted digest or not, as none serves any recovery whose R is G.
  for (const primary of ['E', 'Q'] as const) {
    it(`refuses ${primary === 'E' ? 'ecrecoverEvm' : 'ecrecoverP2pkh'} before sending for a key at infinity whose R is `
      + 'G, which no side-car pair serves', async () => {
      const s = setup();
      const t = await s.deploy(compileString(SOURCE, compileOptions(primary)));
      await seedPool(s.provider, brand(t.categoryId), 1, 0xd7, primary === 'E');
      const before = s.sent.length;
      await expect((t.contract.connect(await s.wallet()) as any).call.f(leWord(1n), 27n, leWord(GX), leWord(1n)).send())
        .rejects.toThrow(/no 3-covenant ladder split fits/);
      expect(s.sent).toHaveLength(before);
    });
  }

  for (const [primary, zero] of [['E', '00'.repeat(20)], ['Q', '']] as const) {
    it(`answers the zero address under ${primary === 'E' ? 'ecrecoverEvm' : 'ecrecoverP2pkh'} for a key at infinity, `
      + 'which a pair recovering 2^128 G from the digest shifted by -2^128 r mod n proves', async () => {
      const { ecrecoverComputeLockingBytecode } = await import('@solidcash/utils');
      const { secp256k1 } = await import('@noble/curves/secp256k1');
      const atInfinity = await infinityArgs(`straight-line-infinity-${primary}`);
      const s = setup();
      const t = await s.deploy(compileString(SOURCE, compileOptions(primary)));
      const salt = brand(t.categoryId);
      await seedPool(s.provider, salt, 1, 0xd1, primary === 'E');
      await (t.contract.connect(await s.wallet()) as any).call.f(...atInfinity).send();
      const sent = s.sent[s.sent.length - 1]!;
      expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
      const state = (await t.contract.getState()) as { who?: Uint8Array; n?: bigint };
      expect(binToHex(state.who ?? new Uint8Array())).toBe(zero);
      expect(state.n).toBe(1n);
      // The pool's A and B2 hold the first and last slots, A bound to the shifted digest and B2 committing 2^128 G.
      const master = inputAt(sent, addressToLockScript(t.contract.address));
      const a = master + (primary === 'E' ? 3 : 2);
      expect(same(sent.sourceOutputs[a].lockingBytecode, ecrecoverComputeLockingBytecode(salt, 'A'))).toBe(true);
      expect(same(sent.sourceOutputs[a + 2].lockingBytecode, ecrecoverComputeLockingBytecode(salt, 'B2'))).toBe(true);
      const argBlobA = (decodeAuthenticationInstructions(sent.transaction.inputs[a]!.unlockingBytecode)[1] as {
        data: Uint8Array }).data;
      expect(binToHex(argBlobA.slice(0, 32))).toBe(binToHex(shiftedDigest(atInfinity[0], atInfinity[2])));
      expect(binToHex(argBlobA.slice(32)))
        .toBe(binToHex(Uint8Array.from([Number(atInfinity[1]), ...atInfinity[2], ...atInfinity[3]])));
      const target = secp256k1.ProjectivePoint.BASE.multiply(1n << 128n).toRawBytes(true);
      const commitment = sent.transaction.outputs[a + 2]!.token!.nft!.commitment;
      expect(binToHex(Uint8Array.from([commitment[0]!, ...commitment.slice(1, 33).reverse()]))).toBe(binToHex(target));
      // Another key in B2's recreation: refused by B2's covenant and by the master, which reads it.
      const forged = withOutput(sent, a + 2, otherKey);
      expect(inputPasses(s.provider, forged, a + 2)).toBe(false);
      expect(inputPasses(s.provider, forged, master)).toBe(false);
      // The same transaction with the master's s moved by one: its arguments now recover a key, and the pair proves
      // nothing of them.
      expect(inputPasses(s.provider, withMasterS(sent, master, atInfinity[2], atInfinity[3], leWord(2n)), master))
        .toBe(false);
    });
  }

  /** `sent` with the master's push of the recovery's `s` (the push before that of `r`) replaced by a push of `to`. */
  const withMasterS = (sent: Sent, master: number, r: Uint8Array, s: Uint8Array, to: Uint8Array): Sent => {
    const instructions = decodeAuthenticationInstructions(sent.transaction.inputs[master]!.unlockingBytecode);
    const at = instructions.findIndex((instruction, index) => {
      const data = (instruction as { data?: Uint8Array }).data;
      const next = (instructions[index + 1] as { data?: Uint8Array } | undefined)?.data;
      return data !== undefined && same(data, s) && next !== undefined && same(next, r);
    });
    expect(at).toBeGreaterThanOrEqual(0);
    const rewritten = instructions.map((instruction, index) => (index === at ? { opcode: 0x20, data: to } : instruction));
    const unlockingBytecode = encodeAuthenticationInstructions(rewritten as never);
    return {
      sourceOutputs: sent.sourceOutputs,
      transaction: {
        ...sent.transaction,
        inputs: sent.transaction.inputs.map((input, index) => (index === master ? { ...input, unlockingBytecode } : input)),
      },
    };
  };

  for (const [primary, zero] of [['E', '00'.repeat(20)], ['Q', '']] as const) {
    it(`answers the zero address under ${primary === 'E' ? 'ecrecoverEvm' : 'ecrecoverP2pkh'} for an r or s outside `
      + '[1, n), reading none of the wallet coins in its slots, as the EVM does', async () => {
      const { ecrecoverComputeLockingBytecode } = await import('@solidcash/utils');
      const k = await g;
      // An x in [n, p) that a curve point has: side-car A would take it reduced mod n.
      const rAbove = firstX(ORDER + 1n, true);
      const s = setup();
      const t = await s.deploy(compileString(SOURCE, compileOptions(primary)));
      const salt = brand(t.categoryId);
      await seedPool(s.provider, salt, 1, 0xd4, primary === 'E');
      const wallet = await s.wallet();
      const cases = [
        [k.h, k.v, k.r, leWord(ORDER)], [k.h, k.v, k.r, leWord(0n)], [k.h, k.v, k.r, leWord(2n ** 256n - 1n)],
        [k.h, k.v, leWord(ORDER), k.s], [k.h, k.v, leWord(0n), k.s], [k.h, k.v, leWord(2n ** 256n - 1n), k.s],
        [k.h, 27n, leWord(rAbove), k.s],
      ] as Array<[Uint8Array, bigint, Uint8Array, Uint8Array]>;
      for (const [index, args] of cases.entries()) {
        await (t.contract.connect(wallet) as any).call.f(...args).send();
        const sent = s.sent[s.sent.length - 1]!;
        expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
        const state = (await t.contract.getState()) as { who?: Uint8Array; n?: bigint };
        expect(binToHex(state.who ?? new Uint8Array())).toBe(zero);
        expect(state.n).toBe(BigInt(index + 1));
        const master = inputAt(sent, addressToLockScript(t.contract.address));
        const a = master + (primary === 'E' ? 3 : 2);
        const walletLock = addressToLockScript(wallet.getAddress());
        for (const slot of [a, a + 1, a + 2]) expect(same(sent.sourceOutputs[slot].lockingBytecode, walletLock)).toBe(true);
        for (const role of ['A', 'B2', 'M', 'B3'] as const) {
          expect(inputAt(sent, ecrecoverComputeLockingBytecode(salt, role))).toBe(-1);
        }
        if (index === 0) {
          // The same transaction with the signer's own s: the master now reads its side-cars, which these coins are not.
          expect(inputPasses(s.provider, withMasterS(sent, master, k.r, leWord(ORDER), k.s), master)).toBe(false);
        }
      }
    });
  }

  for (const [primary, zero] of [['E', '00'.repeat(20)], ['Q', '']] as const) {
    it(`answers the zero address under ${primary === 'E' ? 'ecrecoverEvm' : 'ecrecoverP2pkh'} for an r in range that `
      + 'no curve point has, which the pad of the side-car A in its first slot proves', async () => {
      const { ecrecoverComputeLockingBytecode } = await import('@solidcash/utils');
      const k = await g;
      const x = firstX(1n, false);
      const s = setup();
      const t = await s.deploy(compileString(SOURCE, compileOptions(primary)));
      const salt = brand(t.categoryId);
      await seedPool(s.provider, salt, 1, 0xd6, primary === 'E');
      const wallet = await s.wallet();
      await (t.contract.connect(wallet) as any).call.f(k.h, 27n, leWord(x), k.s).send();
      const sent = s.sent[s.sent.length - 1]!;
      expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
      const state = (await t.contract.getState()) as { who?: Uint8Array; n?: bigint };
      expect(binToHex(state.who ?? new Uint8Array())).toBe(zero);
      expect(state.n).toBe(1n);
      // The first slot holds a coin of the pool's A, whose pad opens with w, w^2 = -(x^3 + 7) mod p; the other two hold
      // wallet coins, returned at their own index.
      const master = inputAt(sent, addressToLockScript(t.contract.address));
      const a = master + (primary === 'E' ? 3 : 2);
      expect(same(sent.sourceOutputs[a].lockingBytecode, ecrecoverComputeLockingBytecode(salt, 'A'))).toBe(true);
      const w = unsignedOf(padOf(sent, a));
      expect(modulo(w * w + x ** 3n + 7n, PRIME)).toBe(0n);
      const walletLock = addressToLockScript(wallet.getAddress());
      for (const slot of [a + 1, a + 2]) expect(same(sent.sourceOutputs[slot].lockingBytecode, walletLock)).toBe(true);
      // Another w, or none (a zero pad, so the master binds A's arguments, which are a placeholder's): refused, though A
      // itself only drops its pad.
      for (const word of [leWord(w + 1n), leWord(0n)]) {
        const edited = withPad(sent, a, word);
        expect(inputPasses(s.provider, edited, master)).toBe(false);
        expect(inputPasses(s.provider, edited, a)).toBe(true);
      }
      // The same transaction for an x a point has: no w proves it has none.
      const onCurve = firstX(x, true);
      const pushes = decodeAuthenticationInstructions(sent.transaction.inputs[master]!.unlockingBytecode);
      const rAt = pushes.findIndex((instruction) => {
        const data = (instruction as { data?: Uint8Array }).data;
        return data !== undefined && same(data, leWord(x));
      });
      expect(rAt).toBeGreaterThan(0);
      const moved = encodeAuthenticationInstructions(pushes.map((instruction, index) => (
        index === rAt ? { opcode: 0x20, data: leWord(onCurve) } : instruction)) as never);
      expect(inputPasses(s.provider, {
        sourceOutputs: sent.sourceOutputs,
        transaction: {
          ...sent.transaction,
          inputs: sent.transaction.inputs.map((input, index) => (
            index === master ? { ...input, unlockingBytecode: moved } : input)),
        },
      }, master)).toBe(false);
    });
  }

  it('answers the zero address for an s of 0 though a genuine pair for those arguments holds its slots', async () => {
    // Side-car A takes s = 0 as it comes, so a pair recovers (-z/r)G from these arguments, which a builder could lay out
    // where the call reads; the call answers the zero address for them all the same, as it reads no side-car.
    const { ecrecoverComputeLockingBytecode } = await import('@solidcash/utils');
    const { buildEcrecoverComputeSidecars } = await import('../../src/ecrecover/ecrecoverComputeSidecar.js');
    const k = await g;
    const s = setup();
    const t = await s.deploy(compileString(SOURCE, compileOptions('Q')));
    const salt = brand(t.categoryId);
    await seedPool(s.provider, salt, 1, 0xd5);
    await (t.contract.connect(await s.wallet()) as any).call.f(k.h, k.v, k.r, leWord(0n)).send();
    const sent = s.sent[s.sent.length - 1]!;
    expect(binToHex(((await t.contract.getState()) as { who?: Uint8Array }).who ?? new Uint8Array())).toBe('');
    const master = inputAt(sent, addressToLockScript(t.contract.address));
    const a = master + 2;
    const witness = computeEcrecoverWitness(k.h, Number(k.v), k.r, leWord(0n));
    const [coinA, coinB] = await Promise.all((['A', 'B2'] as const).map(async (role) => (
      await s.provider.getUtxosForLockingBytecode(ecrecoverComputeLockingBytecode(salt, role)))[0]!));
    const chunkA = probeEcrecoverSplit(witness, salt, coinA!, coinB!);
    const pair = buildEcrecoverComputeSidecars(witness, chunkA, salt, coinA!, coinB!, undefined, 'B2');
    const placed = [[a, coinA!, pair.unlockerA, pair.recreateA], [a + 2, coinB!, pair.unlockerB, pair.recreateB]] as const;
    const hostile: Sent = {
      sourceOutputs: sent.sourceOutputs.map((output, index) => {
        const entry = placed.find(([at]) => at === index);
        return entry === undefined ? output : solidCashOutputToLibauthOutput({
          to: entry[3].to as Uint8Array, amount: entry[1].satoshis, token: entry[1].token,
        });
      }),
      transaction: {
        ...sent.transaction,
        inputs: sent.transaction.inputs.map((input, index) => {
          const entry = placed.find(([at]) => at === index);
          return entry === undefined ? input : {
            ...input, outpointTransactionHash: hexToBin(entry[1].txid), outpointIndex: entry[1].vout,
            unlockingBytecode: entry[2].generateUnlockingBytecode({} as never),
          };
        }),
        outputs: sent.transaction.outputs.map((output, index) => {
          const entry = placed.find(([at]) => at === index);
          return entry === undefined ? output : solidCashOutputToLibauthOutput(entry[3]);
        }),
      },
    };
    // The pair holds its slots, each side-car valid, and the master still answers the zero address its state says.
    expect(inputPasses(s.provider, hostile, a)).toBe(true);
    expect(inputPasses(s.provider, hostile, a + 2)).toBe(true);
    expect(inputPasses(s.provider, hostile, master)).toBe(true);
  });

  it('refuses ecrecoverPubKey before sending for a v other than 27 or 28, which it reads its side-cars for',
    async () => {
      const s = setup();
      const t = await s.deploy(compileString(SOURCE, compileOptions('K')));
      await seedPool(s.provider, brand(t.categoryId), 1, 0xd2);
      const wallet = await s.wallet();
      const k = await g;
      const before = s.sent.length;
      for (const v of [0n, 29n]) {
        await expect((t.contract.connect(wallet) as any).call.f(k.h, v, k.r, k.s).send())
          .rejects.toThrow(/preflight failed at input 0: Program failed an OP_VERIFY operation/);
      }
      expect(s.sent).toHaveLength(before);
      expect(((await t.contract.getState()) as { n?: bigint }).n).toBe(0n);
    });

  it('refuses ecrecoverPubKey for arguments the precompile refuses, though a genuine pair for them holds its slots',
    async () => {
      // ecrecoverPubKey has no zero key, so it refuses what the precompile refuses. Side-car A takes an s of 0 as it
      // comes, and reads a two-byte v's first byte as the recovery id and its second as r's first: a pair recovers a
      // key from each, which the call would answer if it bound the pair alone.
      const { secp256k1 } = await import('@noble/curves/secp256k1');
      const source = `${P} contract K { int n;
        function g(bytes32 h, int v, bytes32 r, bytes32 s, pubkey expected) external returns (bool) {
          require(ecrecoverPubKey(h, v, r, s) == expected); n = n + 1; return true; } }`;
      // A signature with recovery id 27 whose r's low byte is below 0x80, so that v = 27 + 256 r[0] takes two bytes,
      // and whose s = 0 counterpart's ladder splits over two covenants as its own does.
      const splits = (witness: ReturnType<typeof computeEcrecoverWitness>): boolean => {
        const coin = { txid: 'aa'.repeat(32), vout: 0, satoshis: 100_000n,
          token: { category: 'ee'.repeat(32), amount: 0n, nft: { capability: 'mutable' as const, commitment: '' } } };
        try {
          probeEcrecoverSplit(witness, new Uint8Array(32), coin, { ...coin, txid: 'bb'.repeat(32) });
          return true;
        } catch {
          return false;
        }
      };
      let k: Signed | undefined;
      for (let attempt = 0; k === undefined; attempt += 1) {
        const drawn = await signed(`straight-line-pubkey-refuses-${attempt}`);
        if (drawn.v === 27n && drawn.r[0]! < 0x80 && splits(computeEcrecoverWitness(drawn.h, 27, drawn.r, leWord(0n)))) {
          k = drawn;
        }
      }
      const s = setup();
      const t = await s.deploy(compileString(source, compileOptions('K')));
      const salt = brand(t.categoryId);
      await seedPool(s.provider, salt, 1, 0xd8);
      await (t.contract.connect(await s.wallet()) as any).call.g(k.h, k.v, k.r, k.s, k.key).send();
      const sent = s.sent[s.sent.length - 1]!;
      const master = inputAt(sent, addressToLockScript(t.contract.address));
      const a = master + 2;
      /** `sent` with the master's pushes `from` (in order) replaced by `to`. */
      const withPushes = (from: Uint8Array[], to: Uint8Array[]): Sent => {
        const instructions = decodeAuthenticationInstructions(sent.transaction.inputs[master]!.unlockingBytecode);
        const at = instructions.findIndex((_, index) => from.every((data, offset) => {
          const pushed = (instructions[index + offset] as { data?: Uint8Array } | undefined)?.data;
          return pushed !== undefined && same(pushed, data);
        }));
        expect(at).toBeGreaterThanOrEqual(0);
        const rewritten = [...instructions.slice(0, at), ...to.map((data) => ({ opcode: data.length, data })),
          ...instructions.slice(at + from.length)];
        const unlockingBytecode = encodeAuthenticationInstructions(rewritten as never);
        return {
          sourceOutputs: sent.sourceOutputs,
          transaction: {
            ...sent.transaction,
            inputs: sent.transaction.inputs.map((input, index) => (
              index === master ? { ...input, unlockingBytecode } : input)),
          },
        };
      };
      // An s of 0: the pair recovers (-z/r) G, which the call is told to expect.
      const zeroS = computeEcrecoverWitness(k.h, 27, k.r, leWord(0n));
      const keyOfZeroS = Uint8Array.from([zeroS.compressedQ[0]!, ...zeroS.compressedQ.slice(1, 33).reverse()]);
      const sZero = await withPair(withPushes([k.key, k.s], [keyOfZeroS, leWord(0n)]), a, zeroS, salt);
      // v = 27 + 256 r[0]: the call's blob is 98 bytes, which A parses as the signature itself.
      const blob = Uint8Array.from([...k.h, 27, k.r[0]!, ...k.r.slice(1), k.s[0]!, ...k.s.slice(1), 0]);
      const twoByteV = await withPair(
        withPushes([k.s, k.r, Uint8Array.of(27)], [Uint8Array.from([...k.s.slice(1), 0]),
          Uint8Array.from([...k.r.slice(1), k.s[0]!]), Uint8Array.of(27, k.r[0]!)]),
        a, { ...computeEcrecoverWitness(k.h, 27, k.r, k.s), argBlob: blob }, salt,
      );
      expect(sZero).toBeDefined();
      expect(twoByteV).toBeDefined();
      for (const hostile of [sZero!, twoByteV!]) {
        expect(inputPasses(s.provider, hostile, a)).toBe(true);
        expect(inputPasses(s.provider, hostile, a + 2)).toBe(true);
        expect(inputPasses(s.provider, hostile, master)).toBe(false);
      }
      expect(secp256k1.ProjectivePoint.fromHex(keyOfZeroS).equals(secp256k1.ProjectivePoint.fromHex(k.key))).toBe(false);
    });

  it('builds a call whose recovery sits in a branch the run skips, and refuses it when the branch runs', async () => {
    const source = `${P} contract T(pubkey owner) { int n;
      function f(bytes32 h, int v, bytes32 r, bytes32 s, int sel) external returns (bool) {
        if (sel > 0) { require(ecrecoverPubKey(h, v, r, s) == owner); } n = n + 1; return true; } }`;
    const s = setup();
    const k = await g;
    const t = await s.deploy(compileString(source, compileOptions('T')), [k.key]);
    await seedPool(s.provider, brand(t.categoryId), 1, 0xd3);
    const wallet = await s.wallet();
    const zero = new Uint8Array(32);
    await (t.contract.connect(wallet) as any).call.f(zero, 0n, zero, zero, 0n).send();
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(s.sent[s.sent.length - 1]! as never)).toBe(true);
    expect(((await t.contract.getState()) as { n?: bigint }).n).toBe(1n);
    const before = s.sent.length;
    await expect((t.contract.connect(wallet) as any).call.f(zero, 0n, zero, zero, 1n).send())
      .rejects.toThrow(/preflight failed at input 0/);
    expect(s.sent).toHaveLength(before);
  });
});

describe('a constructor callee that recovers a key straight-line (A7, A14 items 5 and 6)', () => {
  it('fills the middle slot of a callee whose block a run sizes with a creation wallet coin and the filler',
    async () => {
      const { ecrecoverComputeLockingBytecode, BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX } = await import('@solidcash/utils');
      const source = `${P} interface I { function f(bytes32 h, int v, bytes32 r, bytes32 s, int x) external returns (bool); }
        contract T(pubkey owner) { int[] a;
          function f(bytes32 h, int v, bytes32 r, bytes32 s, int x) external returns (bool) {
            require(ecrecoverPubKey(h, v, r, s) == owner); a.push(x); return true; } }
        contract C { bool ok; constructor(I t, bytes32 h, int v, bytes32 r, bytes32 s) { ok = t.f(h, v, r, s, 5); }
          function read() { require(ok); } }`;
      const s = setup();
      const g = await signed('straight-line-sized-callee');
      const t = await s.deploy(compileString(source, compileOptions('T')), [g.key]);
      expect(t.contract.inner.artifact.abi.find((entry) => entry.name === 'f')?.dynamicWrites?.length).toBeGreaterThan(0);
      const shared = new Uint8Array(32);
      await seedPool(s.provider, shared, 2, 0xe1);
      const tLock = addressToLockScript(t.contract.address);
      const c = compileString(source, compileOptions('C'));
      const extra = { initArgs: [tLock, g.h, g.v, g.r, g.s], constructorCallees: [{ contract: t.contract }] };
      // Plain coins at the funder's lock for the slots of the callee's block that take a wallet coin.
      await s.wallet();
      const captured = await s.capture(c, extra);
      expect(createVirtualMachineBch2026ForProvider(s.provider).verify(captured as never)).toBe(true);
      // A, then a wallet coin of the creation with the filler, then B2; no output pays the neutral funder lock.
      const master = inputAt(captured, tLock);
      const a = inputAt(captured, ecrecoverComputeLockingBytecode(shared, 'A'));
      expect(a).toBeGreaterThan(master);
      expect(same(captured.sourceOutputs[a + 1].lockingBytecode, s.authorLock)).toBe(true);
      expect(binToHex(captured.transaction.outputs[a + 1]!.lockingBytecode)).toBe('51');
      expect(captured.transaction.outputs[a + 1]!.valueSatoshis).toBe(1000n);
      expect(same(captured.sourceOutputs[a + 2].lockingBytecode, ecrecoverComputeLockingBytecode(shared, 'B2'))).toBe(true);
      expect(captured.transaction.outputs.filter((output) => (
        binToHex(output.lockingBytecode) === BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX))).toHaveLength(0);
      // Another key in B's recreation: refused by the callee, which reads it.
      expect(inputPasses(s.provider, withOutput(captured, a + 2, otherKey), master)).toBe(false);
      const created = await s.deploy(c, [], extra);
      expect(((await created.contract.getState()) as { ok?: boolean }).ok).toBe(true);
    });

  it('creates through a callee whose ecrecoverP2pkh answers the zero address for v = 0', async () => {
    const { ecrecoverComputeLockingBytecode } = await import('@solidcash/utils');
    const source = `${P} interface I { function f(bytes32 h, int v, bytes32 r, bytes32 s) external returns (bool); }
      contract T { address who; int n; function f(bytes32 h, int v, bytes32 r, bytes32 s) external returns (bool) {
        who = ecrecoverP2pkh(h, v, r, s); n = n + 1; return true; } }
      contract C { bool ok; constructor(I t, bytes32 h, int v, bytes32 r, bytes32 s) { ok = t.f(h, v, r, s); }
        function read() { require(ok); } }`;
    const s = setup();
    const g = await signed('straight-line-callee-invalid-v');
    const t = await s.deploy(compileString(source, compileOptions('T')));
    const shared = new Uint8Array(32);
    await seedPool(s.provider, shared, 1, 0xe2);
    const tLock = addressToLockScript(t.contract.address);
    const c = compileString(source, compileOptions('C'));
    const extra = { initArgs: [tLock, g.h, 0n, g.r, g.s], constructorCallees: [{ contract: t.contract }] };
    const captured = await s.capture(c, extra);
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(captured as never)).toBe(true);
    // No coin of the shared pool: the callee's three recovery slots take creation wallet coins with the filler.
    for (const role of ['A', 'B2', 'M', 'B3'] as const) {
      expect(inputAt(captured, ecrecoverComputeLockingBytecode(shared, role))).toBe(-1);
    }
    const master = inputAt(captured, tLock);
    expect(inputPasses(s.provider, withMasterV(captured, master, g.h, g.r, 27), master)).toBe(false);
    const created = await s.deploy(c, [], extra);
    expect(((await created.contract.getState()) as { ok?: boolean }).ok).toBe(true);
    const state = (await t.contract.getState()) as { who?: Uint8Array; n?: bigint };
    expect(binToHex(state.who ?? new Uint8Array())).toBe('');
    expect(state.n).toBe(1n);
  });
});
