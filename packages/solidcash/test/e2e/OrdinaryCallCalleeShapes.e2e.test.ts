/**
 * Ordinary calls of the shapes a constructor's callee takes its block from (A14 item 5): a low-level call whose result
 * the function reads, an entry that iterates a collection, a keccak256 loop on side-cars of the shared pool (salt 0, as
 * a callee off input 0 needs), a sized entry msg.sender keys, a stateful function that recovers keys in a loop, and a
 * keccak256 loop beside a call of another contract, each with its call record published, as a constructor's call
 * always publishes it. Then the same sized shapes in a contract another contract calls (D calls T, T co-spent in D's
 * transaction): T pushes onto a dynamic array, iterates a collection, or hashes in a loop. Last, the build of a call for
 * a contract caller its transaction does not hold, as a constructor's callee is built for the child. Each sent
 * transaction is checked by the VM; each tamper case changes one part of it and expects the covenant that binds that
 * part to refuse.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { SignatureTemplate, Signer } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { getDataNftAddress, getDynamicChunkAddress, getEntryNftAddress } from '../../src/stateful/covenant-helpers.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { addressToLockScript, solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Artifact } from '@solidcash/utils';
import type { Utxo } from '../../src/interfaces.js';
import type { DeployResult } from '../../src/stateful/stateful-lifecycle-types.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const P = 'pragma solidcash ^0.50.0;';
const compileOptions = (primary: string): never => ({
  deployer: true, genesisCalls: true, messageBus: false, primaryContractName: primary,
}) as never;

let serial = 0xf00;
const nextTxid = (): string => (serial++).toString(16).padStart(64, '0');

type Sent = { transaction: ReturnType<typeof decodeTransactionUnsafe>; sourceOutputs: any[] };

interface Setup {
  provider: MockNetworkProvider;
  deploy(artifact: Artifact, args?: unknown[]): Promise<DeployResult<Artifact>>;
  wallet(): Promise<Signer>;
  /** Every transaction sent so far, with the outputs its inputs spend. */
  sent: Sent[];
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
    const transaction = decodeTransactionUnsafe(hexToBin(hex));
    const sourceOutputs = await Promise.all(transaction.inputs.map(async (input) => {
      const spent = await provider.getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex);
      if (spent === undefined) throw new Error('an input of the transaction is not on the ledger');
      return solidCashOutputToLibauthOutput({
        to: spent.lockingBytecode, amount: spent.satoshis, ...(spent.token === undefined ? {} : { token: spent.token }),
      });
    }));
    sent.push({ transaction, sourceOutputs });
    return original(hex);
  };
  const deploy = async (artifact: Artifact, args: unknown[] = []): Promise<DeployResult<Artifact>> => {
    const fundingUtxo: Utxo = { txid: nextTxid(), vout: 0, satoshis: 2_000_000n };
    await provider.seedUtxo(binToHex(authorLock), fundingUtxo);
    return StatefulContract.deploy(artifact, args as never, {
      provider, fundingUtxo, funder, changeAddress: change.address, senderLockingBytecode: authorLock,
    } as never);
  };
  const wallet = async (): Promise<Signer> => {
    const signer = new Signer(alicePriv, provider);
    for (let index = 0; index < 4; index += 1) {
      await provider.seedUtxo(signer.getAddress(), { txid: nextTxid(), vout: 0, satoshis: 200_000n });
    }
    return signer;
  };
  return { provider, deploy, wallet, sent };
}

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

const bumpCommitment = (output: any): any => {
  const commitment = Uint8Array.from(output.token.nft.commitment);
  commitment[commitment.length - 1] ^= 1;
  return { ...output, token: { ...output.token, nft: { ...output.token.nft, commitment } } };
};

describe('an ordinary call whose low-level call result is read', () => {
  const SOURCE = `${P} interface IU { function g(int x) external returns (int); }
    contract U { int calls; function g(int x) external returns (int) { calls = calls + 1; return x * 2; } }
    contract T { int n; function f(address u, int x) external returns (bool) {
      (bool ok, bytes memory data) = u.call(abi.encodeWithSelector(IU.g.selector, x));
      require(ok && data.length > 0); n = n + 1; return ok; } }`;

  it('co-spends the function the payload names, with its record, and refuses the callee run on another argument',
    async () => {
      const s = setup();
      const u = await s.deploy(compileString(SOURCE, compileOptions('U')));
      const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
      const wallet = await s.wallet();
      const uLock = addressToLockScript(u.contract.address);
      // The callee is named without its function: the call's payload names `g` and its argument.
      await (t.contract.connect(wallet) as any).call.f(uLock, 21n).withExternalCall(u.contract).emitReturn().send();
      const sent = s.sent[s.sent.length - 1]!;
      expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
      expect(((await t.contract.getState()) as { n?: bigint }).n).toBe(1n);
      expect(((await u.contract.getState()) as { calls?: bigint }).calls).toBe(1n);

      // The payload encodes `x` as one push (a native compile), which T binds to U's argument push.
      const master = inputAt(sent, addressToLockScript(t.contract.address));
      const callee = inputAt(sent, uLock);
      const unlocking = Uint8Array.from(sent.transaction.inputs[callee]!.unlockingBytecode);
      const argument = unlocking.findIndex((byte, index) => byte === 0x01 && unlocking[index + 1] === 21);
      expect(argument).toBeGreaterThanOrEqual(0);
      unlocking[argument + 1] = 22;
      const reargued: Sent = {
        sourceOutputs: sent.sourceOutputs,
        transaction: {
          ...sent.transaction,
          inputs: sent.transaction.inputs.map((input, index) => (
            index === callee ? { ...input, unlockingBytecode: unlocking } : input)),
        },
      };
      expect(inputPasses(s.provider, reargued, master)).toBe(false);
    });

  it('refuses to name the callee of an opaque payload, which decodes to no function', async () => {
    const source = `${P} contract U { int calls; function g(int x) external returns (int) { calls = calls + 1; return x; } }
      contract T { int n; function f(address u, bytes payload) external returns (bool) {
        (bool ok, bytes memory data) = u.call(payload); require(ok); n = n + 1; return ok; } }`;
    const s = setup();
    const u = await s.deploy(compileString(source, compileOptions('U')));
    const t = await s.deploy(compileString(source, compileOptions('T')));
    const connected = t.contract.connect(await s.wallet()) as any;
    const call = connected.call.f(addressToLockScript(u.contract.address), hexToBin('00'));
    expect(() => call.withExternalCall(u.contract))
      .toThrow(/the low-level call at slot 0: its payload names no decoded function/);
  });
});

describe('an ordinary call that iterates a collection with its call record', () => {
  const SOURCE = `${P} contract T { int total; enumerable mapping(bytes20 => int) bal;
      function put(bytes20 k, int v) public { bal[k] = v; }
      function f() external returns (int) { int sum = 0; for (int value of this.bal) { sum = sum + value; } total = sum; return sum; } }`;

  for (const emitReturn of [false, true]) {
    it(`walks the entries after the ${emitReturn ? 'whole block, record slot included' : 'compact block'}`, async () => {
      const s = setup();
      const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
      const wallet = await s.wallet();
      await (t.contract.connect(wallet) as any).call.put(new Uint8Array(20).fill(1), 5n).send();
      await (t.contract.connect(wallet) as any).call.put(new Uint8Array(20).fill(2), 7n).send();
      const call = (t.contract.connect(wallet) as any).call.f();
      await (emitReturn ? call.emitReturn() : call).send();
      const sent = s.sent[s.sent.length - 1]!;
      expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
      expect(((await t.contract.getState()) as { total?: bigint }).total).toBe(12n);

      const master = inputAt(sent, addressToLockScript(t.contract.address));
      const entryLock = addressToLockScript(getEntryNftAddress(t.contract.inner as never, t.categoryId, 'bal'));
      const walked = sent.sourceOutputs.map((output, index) => (same(output.lockingBytecode, entryLock) ? index : -1))
        .filter((index) => index >= 0);
      // The block is master, record and the record slot; a plain call compacts the slot away.
      const base = master + (emitReturn ? 3 : 2);
      expect(walked).toEqual([base, base + 1, base + 2]);
      if (emitReturn) {
        expect(sent.transaction.outputs[master + 2]!.token?.nft?.capability).toBe('none');
      }
      const dataLock = addressToLockScript(getDataNftAddress(t.contract.inner as never, t.categoryId));
      const record = sent.transaction.outputs.findIndex((output) => same(output.lockingBytecode, dataLock));
      expect(inputPasses(s.provider, withOutput(sent, record, bumpCommitment), master)).toBe(false);
    });
  }
});

describe('an ordinary call whose keccak256 loop takes its side-cars from the shared pool', () => {
  const SOURCE = `${P} contract T { bytes32 h; function f(bytes b, int k) external returns (bool) {
      bytes32 x = 0x; for (int i = 0; i < k; i++) { x = keccak256(b); } h = x; return true; } }`;

  it('runs the loop on salt-0 side-cars, as a callee off input 0 must, and refuses another digest', async () => {
    const { keccakComputeLockingBytecode } = await import('@solidcash/utils');
    const { computeSideCarStandIn } = await import('../../src/stateful/stateful-abi-resolve.js');
    const { StatefulFunctionCall } = await import('../../src/stateful/StatefulContract.js');
    const { keccak_256: keccak } = await import('@noble/hashes/sha3.js');
    const s = setup();
    const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
    const sharedLock = keccakComputeLockingBytecode(new Uint8Array(32), true);
    for (const index of [0, 1]) {
      await s.provider.seedUtxo(binToHex(sharedLock), computeSideCarStandIn('keccak-loop-ordinary', sharedLock, index));
    }
    // The pool as a creation lists it: no coin is minted on demand.
    const pool = new Proxy(s.provider, {
      get: (target, property, receiver): unknown => (property === 'addUtxo'
        ? undefined : Reflect.get(target, property, receiver)),
    });
    const connected = t.contract.connect(await s.wallet()) as any;
    const b = Uint8Array.of(4, 5, 6);
    const route = { abiFunction: t.contract.inner.artifact.abi.find((entry) => entry.name === 'f')!, emitReturn: true };
    await new StatefulFunctionCall(
      () => connected._createBuilder('f', [b, 2n], { ...route, sharedSidecarPool: pool }), connected, 'f', [b, 2n], route,
    ).send();
    const sent = s.sent[s.sent.length - 1]!;
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
    expect(binToHex(((await t.contract.getState()) as { h?: Uint8Array }).h!)).toBe(binToHex(keccak(b)));
    // One side-car per iteration after the block of master, record and record slot, each recreated at its index.
    const master = inputAt(sent, addressToLockScript(t.contract.address));
    const sidecars = sent.transaction.outputs.map((output, index) => (same(output.lockingBytecode, sharedLock) ? index : -1))
      .filter((index) => index >= 0);
    expect(sidecars).toEqual([master + 3, master + 4]);
    expect(inputPasses(s.provider, withOutput(sent, sidecars[1]!, bumpCommitment), master)).toBe(false);
  });
});

describe('an ordinary call of a sized function that msg.sender keys', () => {
  const SOURCE = `${P} contract T { int[] a; mapping(address => int) owner;
      function f(int x) external returns (bool) { a.push(x); owner[msg.sender] = x; return true; } }`;

  it('keys the entry by its sender and lays out the array\'s chunk, with its record', async () => {
    const s = setup();
    const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
    const wallet = await s.wallet();
    await (t.contract.connect(wallet) as any).call.f(9n).emitReturn().send();
    const sent = s.sent[s.sent.length - 1]!;
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
    expect(await (t.contract as any).owner(addressToLockScript(wallet.getAddress()))).toBe(9n);
  });
});

describe('an ordinary build for a contract caller its transaction does not hold (A7)', () => {
  const SOURCE = `${P} contract T { address[] members; function add(address a) public { members.push(a); }
      function f() external returns (bool) { members.push(msg.sender); return true; } }`;
  const CALLER = Uint8Array.of(0xaa, 0x20, ...Array.from({ length: 32 }, (_, index) => index + 1), 0x87);
  const CATEGORY = Array.from({ length: 32 }, (_, index) => (0x80 + index).toString(16)).join('');

  it('sizes what it stores by the caller\'s lock, which its coin names, and binds the call to the caller\'s edge',
    async () => {
      const { parseChunkCommitment } = await import('@solidcash/utils');
      const { callRecordDigest } = await import('../../src/stateful/call-record.js');
      const s = setup();
      const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
      const wallet = await s.wallet();
      // 1 + 26 + 26 + 36 bytes of members: a P2PKH sender's push fits the first chunk, the 35-byte caller's does not.
      const p2sh32 = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x5a), 0x87);
      const members = [encodeLockingBytecodeP2pkh(alicePkh), encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(3)), p2sh32];
      for (const member of members) {
        await (t.contract.connect(wallet) as any).call.add(member).send();
      }
      const identity = {
        txid: 'c1'.repeat(32), vout: 0, satoshis: 1000n,
        token: { category: CATEGORY, amount: 0n, nft: { capability: 'minting' as const, commitment: '' } },
        unlocker: { generateLockingBytecode: () => CALLER, generateUnlockingBytecode: () => new Uint8Array() },
      };
      const call = (t.contract.connect(wallet) as any).call.f().emitReturn()
        .withCallerIdentity(CALLER, CATEGORY)._withStandInCaller({ identity });
      const built = await call.build();
      const program = built.buildLibauthProgram(true) as Sent;
      const vm = createVirtualMachineBch2026ForProvider(s.provider);
      const passes = (candidate: Sent): boolean => vm.stateSuccess(
        vm.evaluate({ ...candidate, inputIndex: 0 } as never) as never) === true;
      expect(passes(program)).toBe(true);
      // The caller's coin follows every input, and its recreation and its edge every output: none moves a slot of the
      // block.
      const last = program.transaction.inputs.length - 1;
      expect(binToHex(program.transaction.inputs[last]!.outpointTransactionHash)).toBe(identity.txid);
      const tail = program.transaction.outputs.slice(-2);
      expect(tail.every((output) => binToHex(output.token!.category) === CATEGORY)).toBe(true);
      expect(same(tail[0]!.lockingBytecode, CALLER)).toBe(true);
      const edge = program.transaction.outputs.length - 1;
      expect(binToHex(program.transaction.outputs[edge]!.lockingBytecode)).toBe('5161');
      const fn = t.contract.inner.artifact.abi.find((entry: { name: string }) => entry.name === 'f')!;
      expect(binToHex(program.transaction.outputs[edge]!.token!.nft!.commitment))
        .toBe(`${binToHex(callRecordDigest(fn, [])!)}03`);
      // The push is the caller's, which takes a second chunk.
      const dataLock = addressToLockScript(getDataNftAddress(t.contract.inner as never, t.categoryId));
      const chunkLock = program.transaction.outputs.find((output) => output.token !== undefined
        && binToHex(output.token.category) === t.categoryId && output.token.nft?.capability === 'mutable'
        && !same(output.lockingBytecode, dataLock))?.lockingBytecode;
      expect(chunkLock).toBeDefined();
      const chunks = program.transaction.outputs.filter((output) => same(output.lockingBytecode, chunkLock!))
        .map((output) => parseChunkCommitment(binToHex(output.token!.nft!.commitment)))
        .sort((left, right) => left.chunkIndex - right.chunkIndex);
      expect(chunks.map((chunk) => chunk.chunkData.length)).toEqual([120, 5]);
      const blob = binToHex(Uint8Array.from(chunks.flatMap((chunk) => [...chunk.chunkData])));
      expect(blob.endsWith(`23${binToHex(CALLER)}`)).toBe(true);

      // Without the edge, or with the coin at another lock, the run refuses the caller.
      const withoutEdge = withOutput(program, edge, (output) => ({ ...output, token: undefined }));
      expect(passes(withoutEdge)).toBe(false);
      const moved: Sent = {
        transaction: program.transaction,
        sourceOutputs: program.sourceOutputs.map((output, index) => (index === last
          ? { ...output, lockingBytecode: p2sh32 } : output)),
      };
      expect(passes(moved)).toBe(false);
      // Such a call serves a block of another transaction: it is never sent.
      await expect(call.send()).rejects.toThrow(/stand-in caller .* is never sent/);
    });
});

type Signed = { h: Uint8Array; v: bigint; r: Uint8Array; s: Uint8Array; key: Uint8Array };

/** A signature by one fixed key, in the little-endian words the native recovery reads, with the key it recovers. */
async function signed(message: string): Promise<Signed> {
  const { ethers } = await import('ethers');
  const wallet = new ethers.Wallet(`0x${'44'.repeat(32)}`);
  const parsed = ethers.Signature.from(await wallet.signMessage(message));
  const little = (hex: string): Uint8Array => Uint8Array.from(hexToBin(hex.replace(/^0x/, ''))).reverse();
  return {
    h: little(ethers.hashMessage(message)), v: BigInt(parsed.v), r: little(parsed.r), s: little(parsed.s),
    key: hexToBin(wallet.signingKey.compressedPublicKey.replace(/^0x/, '')),
  };
}

/** Coins of the shared recovery pool (salt 0), `count` of each role. */
async function seedRecoveryPool(provider: MockNetworkProvider, count: number, tag: number): Promise<void> {
  const { ecrecoverComputeLockingBytecode } = await import('@solidcash/utils');
  for (const [roleIndex, role] of (['A', 'B2', 'M', 'B3'] as const).entries()) {
    for (let index = 0; index < count; index += 1) {
      await provider.seedUtxo(binToHex(ecrecoverComputeLockingBytecode(new Uint8Array(32), role)), {
        txid: `${tag.toString(16).padStart(2, '0')}${roleIndex.toString(16)}${index.toString(16).padStart(2, '0')}`
          .padEnd(64, '0'),
        vout: 0, satoshis: 100_000n,
        token: { category: 'ed'.repeat(31) + '13', amount: 0n, nft: { capability: 'mutable', commitment: '' } },
      });
    }
  }
}

/** `sent` with inputs `left` and `right` swapped, with their coins and their outputs. */
const swapIndexes = (sent: Sent, left: number, right: number): Sent => {
  const swap = <T>(items: readonly T[]): T[] => items.map((item, at) => (
    at === left ? items[right]! : at === right ? items[left]! : item));
  return {
    sourceOutputs: swap(sent.sourceOutputs),
    transaction: { ...sent.transaction, inputs: swap(sent.transaction.inputs), outputs: swap(sent.transaction.outputs) },
  };
};

describe('an ordinary call whose stateful function recovers keys in a loop', () => {
  const SCALAR = `${P} contract T(pubkey owner) { int n;
      function f(bytes32 h, int v, bytes32 r, bytes32 s, int k) external returns (bool) {
        for (int i = 0; i < k; i++) { require(ecrecoverPubKey(h, v, r, s) == owner); } n = n + 1; return true; } }`;
  const ARRAY = `${P} contract T(pubkey owner) { int n;
      function f(bytes32[] h, int[] v, bytes32[] r, bytes32[] s, int k) external returns (bool) {
        for (int i = 0; i < k; i++) { require(ecrecoverPubKey(h[i], v[i], r[i], s[i]) == owner); } n = n + 1; return true; } }`;

  it('reads a triple from the shared pool per iteration after the block, and refuses another key or a moved one',
    async () => {
      const { ecrecoverComputeLockingBytecode } = await import('@solidcash/utils');
      const s = setup();
      const g = await signed('recovery-loop-scalar');
      const artifact = compileString(SCALAR, compileOptions('T'));
      const fn = artifact.abi.find((entry) => entry.name === 'f')!;
      // No recovery slot in the block: master, record and the record slot.
      expect(fn.ecrecoverTrailingLoop).toBe(true);
      expect(fn.blockLayout!.slots.map((slot) => slot.kind)).toEqual(['master', 'dataNft', 'returnEvent']);
      const t = await s.deploy(artifact, [g.key]);
      await seedRecoveryPool(s.provider, 2, 0xa1);
      const wallet = await s.wallet();
      await (t.contract.connect(wallet) as any).call.f(g.h, g.v, g.r, g.s, 2n).emitReturn().send();
      const sent = s.sent[s.sent.length - 1]!;
      expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
      expect(((await t.contract.getState()) as { n?: bigint }).n).toBe(1n);

      // Iteration k reads A at master + 3 + 3k and B2 two inputs on; the middle input is a wallet coin returned at its
      // own index. Each side-car recreates at its own index.
      const master = inputAt(sent, addressToLockScript(t.contract.address));
      const lockA = ecrecoverComputeLockingBytecode(new Uint8Array(32), 'A');
      const lockB = ecrecoverComputeLockingBytecode(new Uint8Array(32), 'B2');
      const walletLock = addressToLockScript(wallet.getAddress());
      for (const k of [0, 1]) {
        const a = master + 3 + 3 * k;
        expect(same(sent.sourceOutputs[a].lockingBytecode, lockA)).toBe(true);
        expect(same(sent.sourceOutputs[a + 2].lockingBytecode, lockB)).toBe(true);
        expect(same(sent.transaction.outputs[a]!.lockingBytecode, lockA)).toBe(true);
        expect(same(sent.transaction.outputs[a + 2]!.lockingBytecode, lockB)).toBe(true);
        expect(same(sent.sourceOutputs[a + 1].lockingBytecode, walletLock)).toBe(true);
        expect(same(sent.transaction.outputs[a + 1]!.lockingBytecode, walletLock)).toBe(true);
        expect(sent.transaction.outputs[a + 1]!.valueSatoshis).toBe(sent.sourceOutputs[a + 1].valueSatoshis);
      }
      // Another key in B's recreation (a byte of its x coordinate): refused by B's covenant and by the master, which
      // reads it.
      const forged = withOutput(sent, master + 5, (output) => {
        const commitment = Uint8Array.from(output.token.nft.commitment);
        commitment[1] ^= 1;
        return { ...output, token: { ...output.token, nft: { ...output.token.nft, commitment } } };
      });
      expect(inputPasses(s.provider, forged, master + 5)).toBe(false);
      expect(inputPasses(s.provider, forged, master)).toBe(false);
      // A triple moved: A and B swapped.
      expect(inputPasses(s.provider, swapIndexes(sent, master + 3, master + 5), master)).toBe(false);
      // An input other than the shared A covenant where the loop reads A.
      expect(inputPasses(s.provider, swapIndexes(sent, master + 3, master + 4), master)).toBe(false);
    });

  it('binds each iteration to its own element\'s arguments in the array form', async () => {
    const s = setup();
    const g0 = await signed('recovery-loop-array-0');
    const g1 = await signed('recovery-loop-array-1');
    const t = await s.deploy(compileString(ARRAY, compileOptions('T')), [g0.key]);
    await seedRecoveryPool(s.provider, 2, 0xa2);
    await (t.contract.connect(await s.wallet()) as any).call.f(
      [g0.h, g1.h], [g0.v, g1.v], [g0.r, g1.r], [g0.s, g1.s], 2n,
    ).send();
    const sent = s.sent[s.sent.length - 1]!;
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
    expect(((await t.contract.getState()) as { n?: bigint }).n).toBe(1n);
    // The two triples swapped: each iteration then meets the other message's arguments in its A.
    const master = inputAt(sent, addressToLockScript(t.contract.address));
    const swapped = [0, 1, 2].reduce((tx, offset) => swapIndexes(tx, master + 3 + offset, master + 6 + offset), sent);
    expect(inputPasses(s.provider, swapped, master)).toBe(false);
  });

  it('hashes each key an ecrecoverEvm loop recovers in its triple\'s keccak side-car', async () => {
    const { ethers } = await import('ethers');
    const { ecrecoverComputeLockingBytecode, keccakComputeLockingBytecode } = await import('@solidcash/utils');
    const { computeSideCarStandIn } = await import('../../src/stateful/stateful-abi-resolve.js');
    const source = `${P} contract T(bytes20 owner) { int n;
        function f(bytes32[] h, int[] v, bytes32[] r, bytes32[] s, int k) external returns (bool) {
          for (int i = 0; i < k; i++) { require(ecrecoverEvm(h[i], v[i], r[i], s[i]) == owner); } n = n + 1; return true; } }`;
    const s = setup();
    const g0 = await signed('recovery-loop-evm-0');
    const g1 = await signed('recovery-loop-evm-1');
    const owner = hexToBin(new ethers.Wallet(`0x${'44'.repeat(32)}`).address.slice(2));
    const t = await s.deploy(compileString(source, compileOptions('T')), [owner]);
    await seedRecoveryPool(s.provider, 2, 0xa3);
    const lockB = ecrecoverComputeLockingBytecode(new Uint8Array(32), 'B');
    const lockK = keccakComputeLockingBytecode(new Uint8Array(32), true);
    for (const index of [0, 1]) {
      await s.provider.seedUtxo(binToHex(lockB), computeSideCarStandIn('recovery-loop-evm-b', lockB, index));
      await s.provider.seedUtxo(binToHex(lockK), computeSideCarStandIn('recovery-loop-evm-k', lockK, index));
    }
    await (t.contract.connect(await s.wallet()) as any).call.f(
      [g0.h, g1.h], [g0.v, g1.v], [g0.r, g1.r], [g0.s, g1.s], 2n,
    ).withMaxFee(100_000n).send();
    const sent = s.sent[s.sent.length - 1]!;
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
    // Iteration k: A, B and the keccak side-car at master + 3 + 3k; another digest is refused by the master.
    const master = inputAt(sent, addressToLockScript(t.contract.address));
    expect(same(sent.sourceOutputs[master + 5].lockingBytecode, lockK)).toBe(true);
    expect(inputPasses(s.provider, withOutput(sent, master + 5, bumpCommitment), master)).toBe(false);
  });

  it('lays out the triples before the block of a contract the function calls', async () => {
    const source = `${P} interface IU { function g(int x) external returns (int); }
      contract U { int calls; function g(int x) external returns (int) { calls = calls + 1; return x * 2; } }
      contract T(pubkey owner) { int n;
        function f(IU u, bytes32[] h, int[] v, bytes32[] r, bytes32[] s, int k) external returns (bool) {
          for (int i = 0; i < k; i++) { require(ecrecoverPubKey(h[i], v[i], r[i], s[i]) == owner); } n = u.g(k);
          return true; } }`;
    const s = setup();
    const g0 = await signed('recovery-loop-call-0');
    const g1 = await signed('recovery-loop-call-1');
    const u = await s.deploy(compileString(source, compileOptions('U')));
    const t = await s.deploy(compileString(source, compileOptions('T')), [g0.key]);
    await seedRecoveryPool(s.provider, 2, 0xa4);
    const uLock = addressToLockScript(u.contract.address);
    await (t.contract.connect(await s.wallet()) as any).call.f(
      uLock, [g0.h, g1.h], [g0.v, g1.v], [g0.r, g1.r], [g0.s, g1.s], 2n,
    ).withExternalCall(u.contract).emitReturn().send();
    const sent = s.sent[s.sent.length - 1]!;
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
    expect(((await t.contract.getState()) as { n?: bigint }).n).toBe(4n);
    // Master, record and record slot, two triples, then the callee's block.
    const master = inputAt(sent, addressToLockScript(t.contract.address));
    expect(inputAt(sent, uLock)).toBe(master + 9);
    // A triple moved past the callee's block.
    expect(inputPasses(s.provider, swapIndexes(sent, master + 8, master + 9), master)).toBe(false);
  });
});

describe('an ordinary call whose keccak256 loop runs beside a call of another contract', () => {
  const SOURCE = `${P} interface IU { function g(int x) external returns (int); }
    contract U { int calls; function g(int x) external returns (int) { calls = calls + 1; return x * 2; } }
    contract T { bytes32 h; int n; function f(IU u, bytes b, int k) external returns (bool) {
      bytes32 x = 0x; for (int i = 0; i < k; i++) { x = keccak256(b); } h = x; n = u.g(k); return true; } }
    contract R { bytes32 h; int n; function f(address u, bytes b, int k) external returns (bool) {
      bytes32 x = 0x; for (int i = 0; i < k; i++) { x = keccak256(b); } h = x;
      (bool ok, bytes memory data) = u.call(abi.encodeWithSelector(IU.g.selector, k));
      require(ok && data.length > 0); n = n + 1; return true; } }`;

  for (const [primary, b] of [['T', Uint8Array.of(3)], ['R', Uint8Array.of(4, 5, 6)]] as const) {
    it(`recreates the loop's side-cars before the callee's block (${primary === 'T' ? 'a typed call' : 'a low-level call'})`,
      async () => {
        const { keccakComputeLockingBytecode } = await import('@solidcash/utils');
        const { computeSideCarStandIn } = await import('../../src/stateful/stateful-abi-resolve.js');
        const { keccak_256: keccak } = await import('@noble/hashes/sha3.js');
        const s = setup();
        const u = await s.deploy(compileString(SOURCE, compileOptions('U')));
        const t = await s.deploy(compileString(SOURCE, compileOptions(primary)));
        // The ordinary call co-spends side-cars under the caller's own brand.
        const lock = keccakComputeLockingBytecode(hexToBin(t.categoryId).slice().reverse(), true);
        for (const index of [0, 1]) {
          await s.provider.seedUtxo(binToHex(lock), computeSideCarStandIn(`keccak-loop-call-${primary}`, lock, index));
        }
        const uLock = addressToLockScript(u.contract.address);
        await (t.contract.connect(await s.wallet()) as any).call.f(uLock, b, 2n).withExternalCall(u.contract)
          .emitReturn().send();
        const sent = s.sent[s.sent.length - 1]!;
        expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
        expect(binToHex(((await t.contract.getState()) as { h?: Uint8Array }).h!)).toBe(binToHex(keccak(b)));
        expect(((await u.contract.getState()) as { calls?: bigint }).calls).toBe(1n);

        // The side-cars sit after the caller's block of master, record and record slot, each recreated at its own
        // index with the digest, and the callee's block follows them.
        const master = inputAt(sent, addressToLockScript(t.contract.address));
        const sidecars = sent.transaction.outputs.map((output, index) => (same(output.lockingBytecode, lock) ? index : -1))
          .filter((index) => index >= 0);
        expect(sidecars).toEqual([master + 3, master + 4]);
        for (const index of sidecars) {
          expect(same(sent.sourceOutputs[index].lockingBytecode, lock)).toBe(true);
          expect(binToHex(sent.transaction.outputs[index]!.token!.nft!.commitment)).toBe(binToHex(keccak(b)));
        }
        expect(inputAt(sent, uLock)).toBe(master + 5);
        // Another digest: refused by the side-car and by the master that reads it.
        const forged = withOutput(sent, master + 4, bumpCommitment);
        expect(inputPasses(s.provider, forged, master + 4)).toBe(false);
        expect(inputPasses(s.provider, forged, master)).toBe(false);
        // A side-car moved past the callee's block, as a copy of its input stood at its index before.
        expect(inputPasses(s.provider, swapIndexes(sent, master + 4, master + 5), master)).toBe(false);
      });
  }
});

/** `sent` with inputs `left` and `right` swapped, with their coins; every output stays where it was. */
const swapInputs = (sent: Sent, left: number, right: number): Sent => {
  const swap = <T>(items: readonly T[]): T[] => items.map((item, at) => (
    at === left ? items[right]! : at === right ? items[left]! : item));
  return {
    sourceOutputs: swap(sent.sourceOutputs),
    transaction: { ...sent.transaction, inputs: swap(sent.transaction.inputs) },
  };
};

/** `sent` with outputs `left` and `right` swapped. */
const swapOutputs = (sent: Sent, left: number, right: number): Sent => ({
  sourceOutputs: sent.sourceOutputs,
  transaction: {
    ...sent.transaction,
    outputs: sent.transaction.outputs.map((output, at) => (
      at === left ? sent.transaction.outputs[right]! : at === right ? sent.transaction.outputs[left]! : output)),
  },
});

/** The indexes of the outputs of `sent` at `lock`. */
const outputsAt = (sent: Sent, lock: Uint8Array): number[] => sent.transaction.outputs
  .map((output, index) => (same(output.lockingBytecode, lock) ? index : -1)).filter((index) => index >= 0);

describe('an ordinary call of a contract whose function pushes onto a dynamic array (D calls T)', () => {
  const SOURCE = `${P} interface I { function f(int x) external returns (int); }
    contract T { int[] a; function f(int x) external returns (int) { a.push(x); a.push(x + 1); return a.length; } }
    contract D { int got; function g(I t, int x) external returns (bool) { got = t.f(x); return true; } }`;

  it('lays out the chunks the callee\'s run pins after its block, and refuses another chunk, result or chunk input',
    async () => {
      const s = setup();
      const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
      const d = await s.deploy(compileString(SOURCE, compileOptions('D')));
      const wallet = await s.wallet();
      const tLock = addressToLockScript(t.contract.address);
      const chunkLock = addressToLockScript(getDynamicChunkAddress(t.contract.inner as never, t.categoryId, 'a', 'int256[]'));
      const dRecordLock = addressToLockScript(getDataNftAddress(d.contract.inner as never, d.categoryId));
      // The first call writes one chunk; the second spends it and writes two, for four elements.
      for (const [x, length, written, spent] of [[5n, 2n, 1, 0], [7n, 4n, 2, 1]] as const) {
        await (d.contract.connect(wallet) as any).call.g(tLock, x).withExternalCall(t.contract).send();
        const sent = s.sent[s.sent.length - 1]!;
        expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
        expect(((await d.contract.getState()) as { got?: bigint }).got).toBe(length);
        // The callee's block of master, record and record slot after the caller's, then its new chunks; the old
        // chunk is spent at the same index.
        const master = inputAt(sent, tLock);
        expect(master).toBe(2);
        const chunks = outputsAt(sent, chunkLock);
        expect(chunks).toEqual(Array.from({ length: written }, (_, index) => master + 3 + index));
        const old = sent.sourceOutputs.map((output, index) => (same(output.lockingBytecode, chunkLock) ? index : -1))
          .filter((index) => index >= 0);
        expect(old).toEqual(Array.from({ length: spent }, (_, index) => master + 3 + index));
        // Another chunk: refused by the callee, whose run pins it.
        for (const index of chunks) {
          expect(inputPasses(s.provider, withOutput(sent, index, bumpCommitment), master)).toBe(false);
        }
        // A chunk moved past the caller's edge record, or two chunks swapped.
        const edge = sent.transaction.outputs.findIndex((output) => binToHex(output.lockingBytecode) === '5161');
        expect(edge).toBe(chunks.at(-1)! + 1);
        expect(inputPasses(s.provider, swapOutputs(sent, chunks.at(-1)!, edge), master)).toBe(false);
        if (written > 1) expect(inputPasses(s.provider, swapOutputs(sent, chunks[0]!, chunks[1]!), master)).toBe(false);
        // Another result in the callee's call record: refused by the caller, which reads it, and by the callee.
        expect(sent.transaction.outputs[master + 2]!.token?.nft?.capability).toBe('none');
        expect(inputPasses(s.provider, withOutput(sent, master + 2, bumpCommitment), 0)).toBe(false);
        expect(inputPasses(s.provider, withOutput(sent, master + 2, bumpCommitment), master)).toBe(false);
        // Another value in the caller's record.
        const [dRecord] = outputsAt(sent, dRecordLock);
        expect(inputPasses(s.provider, withOutput(sent, dRecord!, bumpCommitment), 0)).toBe(false);
        // The old chunk swapped with the record slot's input: the callee reads another coin as the old value.
        if (spent > 0) expect(inputPasses(s.provider, swapInputs(sent, master + 2, master + 3), master)).toBe(false);
      }
      expect(((await t.contract.getState()) as { a?: bigint[] }).a).toEqual([5n, 6n, 7n, 8n]);
    });
});

describe('an ordinary call of a contract whose function iterates a collection and returns an int (D calls T)', () => {
  const SOURCE = `${P} interface I { function f() external returns (int); }
    contract T { int total; enumerable mapping(bytes20 => int) bal; function put(bytes20 k, int v) public { bal[k] = v; }
      function f() external returns (int) { int sum = 0; for (int value of this.bal) { sum = sum + value; } total = sum; return sum; } }
    contract D { int got; function g(I t) external returns (int) { got = t.f(); return got; } }`;

  for (const emitReturn of [false, true]) {
    it(`co-spends the walk after the callee's block${emitReturn ? ' behind the caller\'s record slot' : ''}, and `
      + 'refuses another sum, result, entry or order', async () => {
      const s = setup();
      const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
      const d = await s.deploy(compileString(SOURCE, compileOptions('D')));
      const wallet = await s.wallet();
      await (t.contract.connect(wallet) as any).call.put(new Uint8Array(20).fill(1), 5n).send();
      await (t.contract.connect(wallet) as any).call.put(new Uint8Array(20).fill(2), 7n).send();
      const tLock = addressToLockScript(t.contract.address);
      const call = (d.contract.connect(wallet) as any).call.g(tLock).withExternalCall(t.contract);
      await (emitReturn ? call.emitReturn() : call).send();
      const sent = s.sent[s.sent.length - 1]!;
      expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
      expect(((await d.contract.getState()) as { got?: bigint }).got).toBe(12n);
      expect(((await t.contract.getState()) as { total?: bigint }).total).toBe(12n);

      // The callee's block of master, record and record slot, then the walk: the HEAD and both entries, each
      // recreated as it was at its own index.
      const master = inputAt(sent, tLock);
      expect(master).toBe(emitReturn ? 3 : 2);
      const entryLock = addressToLockScript(getEntryNftAddress(t.contract.inner as never, t.categoryId, 'bal'));
      const walked = sent.sourceOutputs.map((output, index) => (same(output.lockingBytecode, entryLock) ? index : -1))
        .filter((index) => index >= 0);
      expect(walked).toEqual([master + 3, master + 4, master + 5]);
      expect(outputsAt(sent, entryLock)).toEqual(walked);
      for (const index of walked) {
        expect(binToHex(sent.transaction.outputs[index]!.token!.nft!.commitment))
          .toBe(binToHex(sent.sourceOutputs[index].token.nft.commitment));
      }
      // Another sum in the callee's record: refused by the callee.
      const [tRecord] = outputsAt(sent, addressToLockScript(getDataNftAddress(t.contract.inner as never, t.categoryId)));
      expect(inputPasses(s.provider, withOutput(sent, tRecord!, bumpCommitment), master)).toBe(false);
      // Another result in its call record: refused by the caller, which reads it, and by the callee.
      expect(sent.transaction.outputs[master + 2]!.token?.nft?.capability).toBe('none');
      expect(inputPasses(s.provider, withOutput(sent, master + 2, bumpCommitment), 0)).toBe(false);
      expect(inputPasses(s.provider, withOutput(sent, master + 2, bumpCommitment), master)).toBe(false);
      // An entry recreated with another value: refused by the callee and by the entry's covenant.
      expect(inputPasses(s.provider, withOutput(sent, master + 4, bumpCommitment), master)).toBe(false);
      expect(inputPasses(s.provider, withOutput(sent, master + 4, bumpCommitment), master + 4)).toBe(false);
      // The two entries swapped, with their outputs: the walk no longer follows the chain.
      expect(inputPasses(s.provider, swapIndexes(sent, master + 4, master + 5), master)).toBe(false);
    });
  }
});

describe('an ordinary call of a contract whose function hashes in a loop (D calls T)', () => {
  const SOURCE = `${P} interface I { function f(bytes b, int k) external returns (bool); }
    contract T { bytes32 h; function f(bytes b, int k) external returns (bool) {
      bytes32 x = 0x; for (int i = 0; i < k; i++) { x = keccak256(b); } h = x; return true; } }
    contract D { bool ok; function g(I t, bytes b, int k) external returns (bool) { ok = t.f(b, k); return true; } }`;

  it('co-spends a shared side-car per iteration after the callee\'s block, and refuses another digest or a moved one',
    async () => {
      const { keccakComputeLockingBytecode } = await import('@solidcash/utils');
      const { computeSideCarStandIn } = await import('../../src/stateful/stateful-abi-resolve.js');
      const { keccak_256: keccak } = await import('@noble/hashes/sha3.js');
      const s = setup();
      const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
      const d = await s.deploy(compileString(SOURCE, compileOptions('D')));
      const wallet = await s.wallet();
      const tLock = addressToLockScript(t.contract.address);
      const b = Uint8Array.of(1, 2, 3);
      // No coin of the shared pool: refused by name before anything is sent.
      const before = s.sent.length;
      await expect((d.contract.connect(wallet) as any).call.g(tLock, b, 2n).withExternalCall(t.contract).send())
        .rejects.toThrow(/The call of T\.f cannot be laid out: its keccak256 loop needs 2 side-car coins of the shared /);
      expect(s.sent.length).toBe(before);

      const sharedLock = keccakComputeLockingBytecode(new Uint8Array(32), true);
      for (const index of [0, 1, 2]) {
        await s.provider.seedUtxo(binToHex(sharedLock), computeSideCarStandIn('keccak-loop-callee-dt', sharedLock, index));
      }
      await (d.contract.connect(wallet) as any).call.g(tLock, b, 2n).withExternalCall(t.contract).send();
      const sent = s.sent[s.sent.length - 1]!;
      expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
      expect(((await d.contract.getState()) as { ok?: boolean }).ok).toBe(true);
      expect(binToHex(((await t.contract.getState()) as { h?: Uint8Array }).h!)).toBe(binToHex(keccak(b)));
      // The callee's block of master, record and record slot, then one shared side-car per iteration, each recreated
      // at its own index with the digest.
      const master = inputAt(sent, tLock);
      expect(master).toBe(2);
      const sidecars = outputsAt(sent, sharedLock);
      expect(sidecars).toEqual([master + 3, master + 4]);
      for (const index of sidecars) {
        expect(same(sent.sourceOutputs[index].lockingBytecode, sharedLock)).toBe(true);
        expect(binToHex(sent.transaction.outputs[index]!.token!.nft!.commitment)).toBe(binToHex(keccak(b)));
      }
      // Another digest: refused by the side-car and by the callee, which reads it.
      const forged = withOutput(sent, master + 4, bumpCommitment);
      expect(inputPasses(s.provider, forged, master + 4)).toBe(false);
      expect(inputPasses(s.provider, forged, master)).toBe(false);
      // A side-car's input moved to the record slot: refused by the callee, which reads a side-car at the loop's index.
      expect(inputPasses(s.provider, swapInputs(sent, master + 2, master + 3), master)).toBe(false);
      // Another result in the callee's call record: refused by the caller, which reads it.
      expect(inputPasses(s.provider, withOutput(sent, master + 2, bumpCommitment), 0)).toBe(false);
    });

  it('refuses by name a callee loop that shares the inputs after its block with another run', async () => {
    const source = `${P} interface I { function f(bytes b, int k) external returns (bool); }
      contract T { bytes32 h; int[] a; function f(bytes b, int k) external returns (bool) {
        bytes32 x = 0x; for (int i = 0; i < k; i++) { x = keccak256(b); } h = x; a.push(k); return true; } }
      contract D { bool ok; function g(I t, bytes b, int k) external returns (bool) { ok = t.f(b, k); return true; } }`;
    const s = setup();
    const t = await s.deploy(compileString(source, compileOptions('T')));
    const d = await s.deploy(compileString(source, compileOptions('D')));
    const before = s.sent.length;
    await expect((d.contract.connect(await s.wallet()) as any).call.g(addressToLockScript(t.contract.address),
      Uint8Array.of(1), 2n).withExternalCall(t.contract).send())
      .rejects.toThrow(new RegExp('The call of T\\.f cannot be laid out: its keccak256 loop shares the inputs after its '
        + 'block with the chunks of dynamic state it writes'));
    expect(s.sent.length).toBe(before);
  });
});
