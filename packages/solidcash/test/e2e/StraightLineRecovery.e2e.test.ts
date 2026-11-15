/**
 * Straight-line recoveries in stateful functions on the production profile: BCH's 2026 limits, the standard relay
 * policy, and no coin the network does not already hold.
 *
 * A two-covenant recovery reads A and B2 and leaves its middle slot to a coin no covenant reads, which the call's wallet
 * fills and an output at the same index returns. A width-0 recovery reads A, M and B3. Each sent transaction is checked
 * by the VM; each tamper case changes one part of it and expects the input that binds that part to refuse.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, hash160, hexToBin, lockingBytecodeToCashAddress,
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
import type { Utxo } from '../../src/interfaces.js';
import type { DeployResult } from '../../src/stateful/stateful-lifecycle-types.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const P = 'pragma solidcash ^0.50.0;';
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

/** The P2PKH locking bytecode of a compressed key: what `ecrecoverP2pkh` answers. */
const p2pkhOf = (key: Uint8Array): Uint8Array => encodeLockingBytecodeP2pkh(hash160(key));

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
});
