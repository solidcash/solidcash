/**
 * Ordinary calls of the shapes a constructor's callee takes its block from (A14 item 5): a low-level call whose result
 * the function reads, an entry that iterates a collection, a keccak256 loop on side-cars of the shared pool (salt 0, as
 * a callee off input 0 needs), a keccak256 loop beside the chunks of dynamic state the function only reads, a sized
 * entry msg.sender keys, a stateful function that recovers keys in a loop, and a
 * keccak256 loop beside a call of another contract, each with its call record published, as a constructor's call
 * always publishes it. Then the same sized shapes in a contract another contract calls (D calls T, T co-spent in D's
 * transaction): T pushes onto a dynamic array, iterates a collection, or hashes in a loop, called by the transaction's
 * own contract or by a contract that contract calls (A calls D, which calls T). Last, the build of a call for
 * a contract caller its transaction does not hold, as a constructor's callee is built for the child. Each sent
 * transaction is checked by the VM; each tamper case changes one part of it and expects the covenant that binds that
 * part to refuse.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, hash160, hexToBin, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { SignatureTemplate, Signer } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { getDataNftAddress, getDynamicChunkAddress, getEntryNftAddress } from '../../src/stateful/covenant-helpers.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { isPoolInfoOutput } from '../../src/oracle/pool/index.js';
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
  /** A signer holding `coins` plain coins of 200,000 satoshis. */
  wallet(coins?: number): Promise<Signer>;
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
  const wallet = async (coins = 4): Promise<Signer> => {
    const signer = new Signer(alicePriv, provider);
    for (let index = 0; index < coins; index += 1) {
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

describe('an ordinary call whose keccak256 loop reads dynamic state it does not write', () => {
  // The function reads its array before the loop: its loop probe meets the read first.
  const SOURCE = `${P} contract T { int[] a; bytes32 h; int seen; function put(int x) public { a.push(x); }
      function f(bytes b, int k) external returns (int) {
        int v = a[0]; bytes32 x = 0x; for (int i = 0; i < k; i++) { x = keccak256(b); } h = x; seen = v; return v; } }`;

  it('lays out the chunks after the loop\'s side-cars, and refuses another digest or a side-car moved into the chunks',
    async () => {
      const { keccakComputeLockingBytecode } = await import('@solidcash/utils');
      const { computeSideCarStandIn } = await import('../../src/stateful/stateful-abi-resolve.js');
      const { keccak_256: keccak } = await import('@noble/hashes/sha3.js');
      const s = setup();
      const artifact = compileString(SOURCE, compileOptions('T'));
      const fn = artifact.abi.find((entry) => entry.name === 'f')!;
      expect(fn.keccakLoopReads).toBe(true);
      expect(fn.dynamicReads).toEqual(['a']);
      expect(fn.dynamicWrites ?? []).toEqual([]);
      const t = await s.deploy(artifact);
      const wallet = await s.wallet(6);
      await (t.contract.connect(wallet) as any).call.put(5n).send();
      await (t.contract.connect(wallet) as any).call.put(7n).send();
      // The call co-spends side-cars under the contract's own brand.
      const lock = keccakComputeLockingBytecode(hexToBin(t.categoryId).slice().reverse(), true);
      for (const index of [0, 1]) {
        await s.provider.seedUtxo(binToHex(lock), computeSideCarStandIn('keccak-loop-direct-read', lock, index));
      }
      const b = Uint8Array.of(8, 9);
      await (t.contract.connect(wallet) as any).call.f(b, 2n).send();
      const sent = s.sent[s.sent.length - 1]!;
      expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
      expect(await t.contract.getState()).toMatchObject({ seen: 5n });
      expect(binToHex(((await t.contract.getState()) as { h?: Uint8Array }).h!)).toBe(binToHex(keccak(b)));

      // The block, then one side-car per iteration, then the array's chunk, each recreated at its own index: each
      // side-car with the digest, the chunk as it was.
      const master = inputAt(sent, addressToLockScript(t.contract.address));
      const band = master + fn.blockLayout!.blockSize;
      expect(outputsAt(sent, lock)).toEqual([band, band + 1]);
      for (const index of [band, band + 1]) {
        expect(same(sent.sourceOutputs[index].lockingBytecode, lock)).toBe(true);
        expect(binToHex(sent.transaction.outputs[index]!.token!.nft!.commitment)).toBe(binToHex(keccak(b)));
      }
      const chunkLock = addressToLockScript(getDynamicChunkAddress(
        t.contract.inner as never, t.categoryId, 'a', 'int256[]',
      ));
      const chunks = sent.sourceOutputs.map((output, index) => (same(output.lockingBytecode, chunkLock) ? index : -1))
        .filter((index) => index >= 0);
      expect(chunks).toEqual([band + 2]);
      expect(outputsAt(sent, chunkLock)).toEqual(chunks);
      expect(binToHex(sent.transaction.outputs[band + 2]!.token!.nft!.commitment))
        .toBe(binToHex(sent.sourceOutputs[band + 2].token.nft.commitment));
      // Another digest: refused by the side-car and by the master, which reads it.
      const forged = withOutput(sent, band + 1, bumpCommitment);
      expect(inputPasses(s.provider, forged, band + 1)).toBe(false);
      expect(inputPasses(s.provider, forged, master)).toBe(false);
      // The last side-car moved into the chunk run, the chunk into the loop's: refused by the master, whose loop and
      // read each meet the other's input.
      expect(inputPasses(s.provider, swapIndexes(sent, band + 1, band + 2), master)).toBe(false);
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

/** `sent` without inputs and outputs `at` to `at + count - 1`, and the coins those inputs spend. */
const removeIndexes = (sent: Sent, at: number, count: number): Sent => {
  const keep = <T>(items: readonly T[]): T[] => items.filter((_item, index) => index < at || index >= at + count);
  return {
    sourceOutputs: keep(sent.sourceOutputs),
    transaction: { ...sent.transaction, inputs: keep(sent.transaction.inputs), outputs: keep(sent.transaction.outputs) },
  };
};

/** `sent` with inputs and outputs `to` to `to + count - 1` replaced by those at `from`, with their coins. */
const copyIndexes = (sent: Sent, from: number, to: number, count: number): Sent => {
  const copy = <T>(items: readonly T[]): T[] => items.map((item, index) => (
    index >= to && index < to + count ? items[from + index - to]! : item));
  return {
    sourceOutputs: copy(sent.sourceOutputs),
    transaction: { ...sent.transaction, inputs: copy(sent.transaction.inputs), outputs: copy(sent.transaction.outputs) },
  };
};

/** Coins of the shared pool an ecrecoverEvm loop takes: A, B and the stateful keccak side-car, `count` of each. */
async function seedEvmRecoveryPool(provider: MockNetworkProvider, count: number, tag: number): Promise<void> {
  const { ecrecoverComputeLockingBytecode, keccakComputeLockingBytecode } = await import('@solidcash/utils');
  const { computeSideCarStandIn } = await import('../../src/stateful/stateful-abi-resolve.js');
  await seedRecoveryPool(provider, count, tag);
  const lockB = ecrecoverComputeLockingBytecode(new Uint8Array(32), 'B');
  const lockK = keccakComputeLockingBytecode(new Uint8Array(32), true);
  for (let index = 0; index < count; index += 1) {
    await provider.seedUtxo(binToHex(lockB), computeSideCarStandIn(`recovery-loop-b-${tag}`, lockB, index));
    await provider.seedUtxo(binToHex(lockK), computeSideCarStandIn(`recovery-loop-k-${tag}`, lockK, index));
  }
}

/** The EVM address of the key `signed` signs with. */
async function evmOwner(): Promise<Uint8Array> {
  const { ethers } = await import('ethers');
  return hexToBin(new ethers.Wallet(`0x${'44'.repeat(32)}`).address.slice(2));
}

/** `output` with a byte of the x coordinate its recovery commits flipped: another key. */
const otherKey = (output: any): any => {
  const commitment = Uint8Array.from(output.token.nft.commitment);
  commitment[1] ^= 1;
  return { ...output, token: { ...output.token, nft: { ...output.token.nft, commitment } } };
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

  it('lays out the chunks the callee reads after its loop\'s side-cars, and refuses another digest or a side-car '
    + 'moved into the chunks', async () => {
    const { keccakComputeLockingBytecode } = await import('@solidcash/utils');
    const { computeSideCarStandIn } = await import('../../src/stateful/stateful-abi-resolve.js');
    const { keccak_256: keccak } = await import('@noble/hashes/sha3.js');
    // The callee reads its array before the loop: its loop probe meets the read first.
    const source = `${P} interface I { function f(bytes b, int k) external returns (int); }
      contract T { int[] a; bytes32 h; int seen; function put(int x) public { a.push(x); }
        function f(bytes b, int k) external returns (int) {
          int v = a[0]; bytes32 x = 0x; for (int i = 0; i < k; i++) { x = keccak256(b); } h = x; seen = v; return v; } }
      contract D { int got; function g(I t, bytes b, int k) external returns (bool) { got = t.f(b, k); return true; } }`;
    const s = setup();
    const artifact = compileString(source, compileOptions('T'));
    const fn = artifact.abi.find((entry) => entry.name === 'f')!;
    expect(fn.keccakLoopReads).toBe(true);
    expect(fn.dynamicReads).toEqual(['a']);
    expect(fn.dynamicWrites ?? []).toEqual([]);
    const t = await s.deploy(artifact);
    const d = await s.deploy(compileString(source, compileOptions('D')));
    const wallet = await s.wallet(6);
    await (t.contract.connect(wallet) as any).call.put(5n).send();
    await (t.contract.connect(wallet) as any).call.put(7n).send();
    const sharedLock = keccakComputeLockingBytecode(new Uint8Array(32), true);
    for (const index of [0, 1, 2]) {
      await s.provider.seedUtxo(binToHex(sharedLock), computeSideCarStandIn('keccak-loop-callee-read', sharedLock, index));
    }
    const tLock = addressToLockScript(t.contract.address);
    const b = Uint8Array.of(8, 9);
    await (d.contract.connect(wallet) as any).call.g(tLock, b, 2n).withExternalCall(t.contract).send();
    const sent = s.sent[s.sent.length - 1]!;
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
    expect(((await d.contract.getState()) as { got?: bigint }).got).toBe(5n);
    expect(await t.contract.getState()).toMatchObject({ seen: 5n });
    expect(binToHex(((await t.contract.getState()) as { h?: Uint8Array }).h!)).toBe(binToHex(keccak(b)));

    // The callee's block, then one shared side-car per iteration, then the array's chunk, each recreated at its own
    // index: the chunk as it was, each side-car with the digest.
    const master = inputAt(sent, tLock);
    const band = master + fn.blockLayout!.blockSize;
    expect(outputsAt(sent, sharedLock)).toEqual([band, band + 1]);
    for (const index of [band, band + 1]) {
      expect(same(sent.sourceOutputs[index].lockingBytecode, sharedLock)).toBe(true);
      expect(binToHex(sent.transaction.outputs[index]!.token!.nft!.commitment)).toBe(binToHex(keccak(b)));
    }
    const chunkLock = addressToLockScript(getDynamicChunkAddress(t.contract.inner as never, t.categoryId, 'a', 'int256[]'));
    const chunks = sent.sourceOutputs.map((output, index) => (same(output.lockingBytecode, chunkLock) ? index : -1))
      .filter((index) => index >= 0);
    expect(chunks).toEqual([band + 2]);
    expect(outputsAt(sent, chunkLock)).toEqual(chunks);
    expect(binToHex(sent.transaction.outputs[band + 2]!.token!.nft!.commitment))
      .toBe(binToHex(sent.sourceOutputs[band + 2].token.nft.commitment));
    // Another digest: refused by the side-car and by the callee, which reads it.
    const forged = withOutput(sent, band + 1, bumpCommitment);
    expect(inputPasses(s.provider, forged, band + 1)).toBe(false);
    expect(inputPasses(s.provider, forged, master)).toBe(false);
    // The last side-car moved into the chunk run, the chunk into the loop's: refused by the callee, whose loop and read
    // each meet the other's input.
    expect(inputPasses(s.provider, swapIndexes(sent, band + 1, band + 2), master)).toBe(false);
  });

  it('cannot meet a callee loop beside a write of dynamic state: the compiler refuses the function by name', () => {
    const source = `${P} interface I { function f(bytes b, int k) external returns (bool); }
      contract T { bytes32 h; int[] a; function f(bytes b, int k) external returns (bool) {
        bytes32 x = 0x; for (int i = 0; i < k; i++) { x = keccak256(b); } h = x; a.push(k); return true; } }
      contract D { bool ok; function g(I t, bytes b, int k) external returns (bool) { ok = t.f(b, k); return true; } }`;
    // The write's new chunks are checked from the first output after the block, where the loop recreates its first
    // side-car: no transaction holds both, so T does not compile and no call of T.f is ever built.
    expect(() => compileString(source, compileOptions('T'))).toThrow(new RegExp('keccak-loop-shares-trailing-band: '
      + '\'f\' hashes in a keccak256 loop, .* and writes the dynamic state \'a\', whose new chunks it checks at the '
      + 'outputs right after its block, where the loop recreates its side-cars'));
  });
});

describe('an ordinary call whose recovery loop meets an invalid recovery id', () => {
  // The loop counts every recovery call it runs, and call k reads its triple at master + blockSize + 3k. An address
  // projection answers address(0) for a recovery id other than 27 or 28 without reading its triple.
  const EVM = `${P} contract T(bytes20 owner) { int n; int zeros;
      function f(bytes32[] h, int[] v, bytes32[] r, bytes32[] s, int k) external returns (bool) {
        int z = 0;
        for (int i = 0; i < k; i++) {
          bytes20 a = ecrecoverEvm(h[i], v[i], r[i], s[i]);
          if (a == bytes20(0)) { z = z + 1; } else { require(a == owner); }
        }
        zeros = z; n = n + 1; return true; } }`;
  const P2PKH = `${P} contract T(bytes owner) { int n; int zeros;
      function f(bytes32[] h, int[] v, bytes32[] r, bytes32[] s, int k) external returns (bool) {
        int z = 0;
        for (int i = 0; i < k; i++) {
          bytes a = ecrecoverP2pkh(h[i], v[i], r[i], s[i]);
          if (a.length == 0) { z = z + 1; } else { require(a == owner); }
        }
        zeros = z; n = n + 1; return true; } }`;

  it('answers the zero address and leaves the call\'s slots to wallet coins, and refuses a recovery laid out as one '
    + 'or a later triple shifted into them', async () => {
    const { ecrecoverComputeLockingBytecode, keccakComputeLockingBytecode } = await import('@solidcash/utils');
    const s = setup();
    const g0 = await signed('invalid-v-evm-0');
    const g2 = await signed('invalid-v-evm-2');
    const t = await s.deploy(compileString(EVM, compileOptions('T')), [await evmOwner()]);
    await seedEvmRecoveryPool(s.provider, 2, 0xb1);
    const wallet = await s.wallet(8);
    // Call 1's recovery id is 30, which no signature has.
    await (t.contract.connect(wallet) as any).call.f(
      [g0.h, g0.h, g2.h], [g0.v, 30n, g2.v], [g0.r, g0.r, g2.r], [g0.s, g0.s, g2.s], 3n,
    ).withMaxFee(100_000n).send();
    const sent = s.sent[s.sent.length - 1]!;
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
    expect(await t.contract.getState()).toMatchObject({ n: 1n, zeros: 1n });

    // Call k holds master + 3 + 3k to master + 5 + 3k: A, B and the keccak side-car for calls 0 and 2, each recreated
    // at its index, and for call 1, which reads none of them, wallet coins returned at their own index.
    const master = inputAt(sent, addressToLockScript(t.contract.address));
    const salt = new Uint8Array(32);
    const triple = [
      ecrecoverComputeLockingBytecode(salt, 'A'), ecrecoverComputeLockingBytecode(salt, 'B'),
      keccakComputeLockingBytecode(salt, true),
    ];
    for (const call of [0, 2]) {
      triple.forEach((lock, slot) => {
        expect(same(sent.sourceOutputs[master + 3 + 3 * call + slot].lockingBytecode, lock)).toBe(true);
        expect(same(sent.transaction.outputs[master + 3 + 3 * call + slot]!.lockingBytecode, lock)).toBe(true);
      });
    }
    const walletLock = addressToLockScript(wallet.getAddress());
    for (const at of [master + 6, master + 7, master + 8]) {
      expect(same(sent.sourceOutputs[at].lockingBytecode, walletLock)).toBe(true);
      expect(same(sent.transaction.outputs[at]!.lockingBytecode, walletLock)).toBe(true);
      expect(sent.transaction.outputs[at]!.valueSatoshis).toBe(sent.sourceOutputs[at].valueSatoshis);
    }
    // Call 0 laid out as a call that reads nothing, its triple swapped with call 1's coins: its id is 28 or 27, so it
    // reads its own slots.
    const skipped = [0, 1, 2].reduce((tx, slot) => swapIndexes(tx, master + 3 + slot, master + 6 + slot), sent);
    expect(inputPasses(s.provider, skipped, master)).toBe(false);
    // Call 2's triple shifted into call 1's slots.
    expect(inputPasses(s.provider, removeIndexes(sent, master + 6, 3), master)).toBe(false);
    // Another key in call 0's B recreation: refused by B's covenant and by the master.
    const forged = withOutput(sent, master + 4, otherKey);
    expect(inputPasses(s.provider, forged, master + 4)).toBe(false);
    expect(inputPasses(s.provider, forged, master)).toBe(false);
    // Another digest in call 2's keccak recreation.
    expect(inputPasses(s.provider, withOutput(sent, master + 11, bumpCommitment), master)).toBe(false);
    // Call 2's A and B swapped, and its keccak side-car moved past the region.
    expect(inputPasses(s.provider, swapIndexes(sent, master + 9, master + 10), master)).toBe(false);
    expect(inputPasses(s.provider, swapIndexes(sent, master + 11, master + 12), master)).toBe(false);
  });

  it('reads a triple for each call that repeats a signature, and refuses one triple standing for both', async () => {
    const s = setup();
    const g = await signed('invalid-v-evm-repeat');
    const t = await s.deploy(compileString(EVM, compileOptions('T')), [await evmOwner()]);
    await seedEvmRecoveryPool(s.provider, 2, 0xb2);
    await (t.contract.connect(await s.wallet(8)) as any).call.f(
      [g.h, g.h, g.h], [g.v, 30n, g.v], [g.r, g.r, g.r], [g.s, g.s, g.s], 3n,
    ).withMaxFee(100_000n).send();
    const sent = s.sent[s.sent.length - 1]!;
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
    expect(await t.contract.getState()).toMatchObject({ n: 1n, zeros: 1n });
    const master = inputAt(sent, addressToLockScript(t.contract.address));
    // Call 0's triple in call 2's slots too: each binds the same arguments, but no transaction spends a coin twice.
    const reused = copyIndexes(sent, master + 3, master + 9, 3);
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(reused as never))
      .toMatch(/the same outpoint|duplicate/i);
    // Call 2's triple dropped and call 1's coins in its slots: call 2 reads its own slots.
    const dropped = copyIndexes(sent, master + 6, master + 9, 3);
    expect(inputPasses(s.provider, dropped, master)).toBe(false);
  });

  it('answers the zero address for a call whose id is 27 or 28 and whose r is 0, and refuses one no pair serves',
    async () => {
      const s = setup();
      const g = await signed('invalid-v-evm-no-key');
      const t = await s.deploy(compileString(EVM, compileOptions('T')), [await evmOwner()]);
      await seedEvmRecoveryPool(s.provider, 2, 0xb4);
      const wallet = await s.wallet(8);
      // Call 1's r is 0, outside [1, n): as the EVM, the call answers the zero address and reads no triple.
      await (t.contract.connect(wallet) as any).call.f(
        [g.h, g.h], [g.v, 27n], [g.r, new Uint8Array(32)], [g.s, g.s], 2n,
      ).withMaxFee(100_000n).send();
      const sent = s.sent[s.sent.length - 1]!;
      expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
      expect(await t.contract.getState()).toMatchObject({ n: 1n, zeros: 1n });
      // Call 1's key at infinity with R = G (a digest and s of 1): the side-cars' table cannot check that R, so no pair
      // over the shifted digest serves it, and the call is refused before it is sent.
      const word = (value: bigint): Uint8Array => Uint8Array.from(
        { length: 32 }, (_, i) => Number((value >> BigInt(8 * i)) & 0xffn));
      const gx = word(0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n);
      const before = s.sent.length;
      await expect((t.contract.connect(wallet) as any).call.f(
        [g.h, word(1n)], [g.v, 27n], [g.r, gx], [g.s, word(1n)], 2n,
      ).withMaxFee(100_000n).send()).rejects.toThrow(/no two-input split/);
      expect(s.sent).toHaveLength(before);
      expect(await t.contract.getState()).toMatchObject({ n: 1n });
    });

  it('answers an ecrecoverP2pkh call the empty address, and takes no slots after the last recovery', async () => {
    const { ecrecoverComputeLockingBytecode } = await import('@solidcash/utils');
    const s = setup();
    const g0 = await signed('invalid-v-p2pkh-0');
    const g1 = await signed('invalid-v-p2pkh-1');
    const owner = Uint8Array.from([0x76, 0xa9, 0x14, ...hash160(g0.key), 0x88, 0xac]);
    const t = await s.deploy(compileString(P2PKH, compileOptions('T')), [owner]);
    await seedRecoveryPool(s.provider, 2, 0xb3);
    const wallet = await s.wallet(8);
    // Call 0's id is 29, call 2's is 0 (the empty number): only call 1 recovers.
    await (t.contract.connect(wallet) as any).call.f(
      [g0.h, g1.h, g0.h], [29n, g1.v, 0n], [g0.r, g1.r, g0.r], [g0.s, g1.s, g0.s], 3n,
    ).send();
    const sent = s.sent[s.sent.length - 1]!;
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
    expect(await t.contract.getState()).toMatchObject({ n: 1n, zeros: 2n });
    // Call 0's slots hold wallet coins; call 1 reads A at master + 6 and B2 at master + 8, its middle input a wallet
    // coin; call 2 takes no slots, so no recovery covenant follows.
    const master = inputAt(sent, addressToLockScript(t.contract.address));
    const walletLock = addressToLockScript(wallet.getAddress());
    for (const at of [master + 3, master + 4, master + 5, master + 7]) {
      expect(same(sent.sourceOutputs[at].lockingBytecode, walletLock)).toBe(true);
    }
    const salt = new Uint8Array(32);
    expect(same(sent.sourceOutputs[master + 6].lockingBytecode, ecrecoverComputeLockingBytecode(salt, 'A'))).toBe(true);
    expect(same(sent.sourceOutputs[master + 8].lockingBytecode, ecrecoverComputeLockingBytecode(salt, 'B2'))).toBe(true);
    const recoveryLocks = (['A', 'B2', 'M', 'B3'] as const).map((role) => ecrecoverComputeLockingBytecode(salt, role));
    expect(sent.sourceOutputs.slice(master + 9).some((output) => recoveryLocks.some((lock) => (
      same(output.lockingBytecode, lock))))).toBe(false);
    // Call 1's triple shifted into call 0's slots, and another key in its B2 recreation.
    expect(inputPasses(s.provider, removeIndexes(sent, master + 3, 3), master)).toBe(false);
    expect(inputPasses(s.provider, withOutput(sent, master + 8, otherKey), master)).toBe(false);
  });
});

describe('an ordinary call whose stateful function recovers keys in a loop through a helper', () => {
  const PUBKEY = `${P} contract T(pubkey owner) { int n;
      function rec(bytes32 h, int v, bytes32 r, bytes32 s) private returns (pubkey) { return ecrecoverPubKey(h, v, r, s); }
      function f(bytes32[] h, int[] v, bytes32[] r, bytes32[] s, int k) external returns (bool) {
        for (int i = 0; i < k; i++) { require(rec(h[i], v[i], r[i], s[i]) == owner); } n = n + 1; return true; } }`;
  // A void helper that checks the address another helper recovers.
  const EVM = `${P} contract T(bytes20 owner) { int n;
      function signer(bytes32 h, int v, bytes32 r, bytes32 s) private pure returns (bytes20) {
        return ecrecoverEvm(h, v, r, s); }
      function check(bytes32 h, int v, bytes32 r, bytes32 s) private { require(signer(h, v, r, s) == owner); }
      function f(bytes32[] h, int[] v, bytes32[] r, bytes32[] s, int k) external returns (bool) {
        for (int i = 0; i < k; i++) { check(h[i], v[i], r[i], s[i]); } n = n + 1; return true; } }`;

  it('reads a triple per iteration after the block, each bound to its own iteration\'s arguments', async () => {
    const { ecrecoverComputeLockingBytecode } = await import('@solidcash/utils');
    const s = setup();
    const g0 = await signed('recovery-helper-loop-0');
    const g1 = await signed('recovery-helper-loop-1');
    const artifact = compileString(PUBKEY, compileOptions('T'));
    const fn = artifact.abi.find((entry) => entry.name === 'f')!;
    expect(fn.ecrecoverTrailingLoop).toBe(true);
    expect(fn.blockLayout!.slots.map((slot) => slot.kind)).toEqual(['master', 'dataNft', 'returnEvent']);
    const t = await s.deploy(artifact, [g0.key]);
    await seedRecoveryPool(s.provider, 2, 0xc1);
    await (t.contract.connect(await s.wallet()) as any).call.f(
      [g0.h, g1.h], [g0.v, g1.v], [g0.r, g1.r], [g0.s, g1.s], 2n,
    ).emitReturn().send();
    const sent = s.sent[s.sent.length - 1]!;
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
    expect(((await t.contract.getState()) as { n?: bigint }).n).toBe(1n);
    const master = inputAt(sent, addressToLockScript(t.contract.address));
    const salt = new Uint8Array(32);
    for (const k of [0, 1]) {
      expect(same(sent.sourceOutputs[master + 3 + 3 * k].lockingBytecode, ecrecoverComputeLockingBytecode(salt, 'A')))
        .toBe(true);
      expect(same(sent.sourceOutputs[master + 5 + 3 * k].lockingBytecode, ecrecoverComputeLockingBytecode(salt, 'B2')))
        .toBe(true);
    }
    // The two triples swapped: each iteration meets the other message's arguments in its A.
    const swapped = [0, 1, 2].reduce((tx, offset) => swapIndexes(tx, master + 3 + offset, master + 6 + offset), sent);
    expect(inputPasses(s.provider, swapped, master)).toBe(false);
    // Another key in the second B2's recreation, and that B2 moved past the region.
    expect(inputPasses(s.provider, withOutput(sent, master + 8, otherKey), master)).toBe(false);
    expect(inputPasses(s.provider, swapIndexes(sent, master + 8, master + 9), master)).toBe(false);
  });

  it('hashes each key an ecrecoverEvm helper recovers in its triple\'s keccak side-car', async () => {
    const { keccakComputeLockingBytecode } = await import('@solidcash/utils');
    const s = setup();
    const g0 = await signed('recovery-helper-loop-evm-0');
    const g1 = await signed('recovery-helper-loop-evm-1');
    const artifact = compileString(EVM, compileOptions('T'));
    expect(artifact.abi.find((entry) => entry.name === 'f')!.ecrecoverTrailingLoop).toBe(true);
    const t = await s.deploy(artifact, [await evmOwner()]);
    await seedEvmRecoveryPool(s.provider, 2, 0xc2);
    await (t.contract.connect(await s.wallet()) as any).call.f(
      [g0.h, g1.h], [g0.v, g1.v], [g0.r, g1.r], [g0.s, g1.s], 2n,
    ).withMaxFee(100_000n).send();
    const sent = s.sent[s.sent.length - 1]!;
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
    expect(((await t.contract.getState()) as { n?: bigint }).n).toBe(1n);
    // A, B and the keccak side-car per iteration, one triple after the other.
    const master = inputAt(sent, addressToLockScript(t.contract.address));
    const lockK = keccakComputeLockingBytecode(new Uint8Array(32), true);
    const keccaks = sent.sourceOutputs.map((output, index) => (same(output.lockingBytecode, lockK) ? index : -1))
      .filter((index) => index >= 0);
    expect(keccaks).toHaveLength(2);
    expect(keccaks[1]! - keccaks[0]!).toBe(3);
    // Another digest, another key in the second B's recreation, the triples swapped, and the second keccak side-car
    // moved past the region.
    expect(inputPasses(s.provider, withOutput(sent, keccaks[1]!, bumpCommitment), master)).toBe(false);
    expect(inputPasses(s.provider, withOutput(sent, keccaks[1]! - 1, otherKey), master)).toBe(false);
    const swapped = [0, 1, 2].reduce((tx, offset) => swapIndexes(tx, keccaks[0]! - 2 + offset, keccaks[1]! - 2 + offset),
      sent);
    expect(inputPasses(s.provider, swapped, master)).toBe(false);
    expect(inputPasses(s.provider, swapIndexes(sent, keccaks[1]!, keccaks[1]! + 1), master)).toBe(false);
  });
  // A helper in the loop's condition, behind `&&`: reduced in place, its recovery runs only where the condition reaches
  // it, as the loop's own call.
  it('reads the triples of a helper\'s recovery in the loop\'s condition, one per call it makes', async () => {
    const { ecrecoverComputeLockingBytecode } = await import('@solidcash/utils');
    const source = `${P} contract T(pubkey owner) { int n;
        function rec(bytes32 h, int v, bytes32 r, bytes32 s) private returns (pubkey) {
          return ecrecoverPubKey(h, v, r, s); }
        function f(bytes32[] h, int[] v, bytes32[] r, bytes32[] s, int k) external returns (bool) {
          int i = 0;
          while (i < k && rec(h[i], v[i], r[i], s[i]) == owner) { i = i + 1; }
          require(i == k); n = n + 1; return true; } }`;
    const s = setup();
    const g0 = await signed('recovery-helper-condition-0');
    const g1 = await signed('recovery-helper-condition-1');
    const artifact = compileString(source, compileOptions('T'));
    expect(artifact.abi.find((entry) => entry.name === 'f')!.ecrecoverTrailingLoop).toBe(true);
    const t = await s.deploy(artifact, [g0.key]);
    await seedRecoveryPool(s.provider, 2, 0xc3);
    await (t.contract.connect(await s.wallet()) as any).call.f(
      [g0.h, g1.h], [g0.v, g1.v], [g0.r, g1.r], [g0.s, g1.s], 2n,
    ).send();
    const sent = s.sent[s.sent.length - 1]!;
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
    expect(((await t.contract.getState()) as { n?: bigint }).n).toBe(1n);
    // The third check of the condition stops at `i < k`: two triples, after master, record and record slot.
    const master = inputAt(sent, addressToLockScript(t.contract.address));
    const lockA = ecrecoverComputeLockingBytecode(new Uint8Array(32), 'A');
    expect(sent.sourceOutputs.map((output, index) => (same(output.lockingBytecode, lockA) ? index : -1))
      .filter((index) => index >= 0)).toEqual([master + 3, master + 6]);
    const swapped = [0, 1, 2].reduce((tx, offset) => swapIndexes(tx, master + 3 + offset, master + 6 + offset), sent);
    expect(inputPasses(s.provider, swapped, master)).toBe(false);
    expect(inputPasses(s.provider, withOutput(sent, master + 5, otherKey), master)).toBe(false);
  });
});

describe('an ordinary call whose recovery loop runs beside a keccak256 of an unbounded bytes argument', () => {
  // A 2-of-2 check of one message: the chained keccak256 of the payload and one recovery per signature, the hash made
  // before the loop or checked after it.
  const SOURCES = {
    before: `${P} contract T(pubkey a, pubkey b) { int n; bytes32 last;
      function f(bytes payload, int[] v, bytes32[] r, bytes32[] s, int k) external returns (bool) {
        bytes32 d = keccak256(payload);
        int good = 0;
        for (int i = 0; i < k; i++) {
          pubkey q = ecrecoverPubKey(d, v[i], r[i], s[i]);
          if (q == a || q == b) { good = good + 1; }
        }
        require(good == k); last = d; n = n + 1; return true; } }`,
    after: `${P} contract T(pubkey a, pubkey b) { int n; bytes32 last;
      function f(bytes payload, bytes32 d, int[] v, bytes32[] r, bytes32[] s, int k) external returns (bool) {
        int good = 0;
        for (int i = 0; i < k; i++) {
          pubkey q = ecrecoverPubKey(d, v[i], r[i], s[i]);
          if (q == a || q == b) { good = good + 1; }
        }
        require(good == k); require(keccak256(payload) == d); last = d; n = n + 1; return true; } }`,
  } as const;

  for (const order of ['before', 'after'] as const) it('lays out the chain\'s side-cars after the block and the triples '
    + `after the chain (the hash ${order === 'before' ? 'made before' : 'checked after'} the loop)`, async () => {
    const SOURCE = SOURCES[order];
    const { ethers } = await import('ethers');
    const { ecrecoverComputeLockingBytecode, keccakChainLockingBytecode } = await import('@solidcash/utils');
    const { keccak_256: keccak } = await import('@noble/hashes/sha3.js');
    const payload = Uint8Array.from({ length: 300 }, (_, index) => (index * 7 + 3) & 0xff);
    const digest = keccak(payload);
    // The native recovery reads the digest as a little-endian number: sign the bytes reversed.
    const little = (hex: string): Uint8Array => Uint8Array.from(hexToBin(hex.replace(/^0x/, ''))).reverse();
    const keys = ['44', '55'].map((byte) => new ethers.SigningKey(`0x${byte.repeat(32)}`));
    const sigs = keys.map((key) => key.sign(Uint8Array.from(digest).reverse()));
    const s = setup();
    const artifact = compileString(SOURCE, compileOptions('T'));
    const fn = artifact.abi.find((entry) => entry.name === 'f')!;
    expect(fn.ecrecoverTrailingLoop).toBe(true);
    expect(fn.keccakChainReads).toBe(true);
    const t = await s.deploy(artifact, keys.map((key) => hexToBin(key.compressedPublicKey.slice(2))));
    await seedRecoveryPool(s.provider, 2, 0xd1);
    // The chain rides the caller's own brand, a side-car per step.
    const { computeSideCarStandIn } = await import('../../src/stateful/stateful-abi-resolve.js');
    const brand = hexToBin(t.categoryId).slice().reverse();
    for (const [step, kind] of (['start', 'cont', 'final'] as const).entries()) {
      const lock = keccakChainLockingBytecode(brand, kind, true);
      await s.provider.seedUtxo(binToHex(lock), computeSideCarStandIn('recovery-loop-chain', lock, step));
    }
    await (t.contract.connect(await s.wallet()) as any).call.f(
      payload, ...(order === 'after' ? [digest] : []),
      sigs.map((sig) => BigInt(sig.v)), sigs.map((sig) => little(sig.r)), sigs.map((sig) => little(sig.s)), 2n,
    ).emitReturn().withMaxFee(100_000n).send();
    const sent = s.sent[s.sent.length - 1]!;
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
    expect(binToHex(((await t.contract.getState()) as { last?: Uint8Array }).last!)).toBe(binToHex(digest));

    // After master, record and record slot: START, CONT and FINAL for the 300 bytes (136-byte blocks), then a triple
    // per signature.
    const master = inputAt(sent, addressToLockScript(t.contract.address));
    (['start', 'cont', 'final'] as const).forEach((kind, step) => {
      expect(same(sent.sourceOutputs[master + 3 + step].lockingBytecode, keccakChainLockingBytecode(brand, kind, true)))
        .toBe(true);
    });
    const salt = new Uint8Array(32);
    for (const k of [0, 1]) {
      expect(same(sent.sourceOutputs[master + 6 + 3 * k].lockingBytecode, ecrecoverComputeLockingBytecode(salt, 'A')))
        .toBe(true);
      expect(same(sent.sourceOutputs[master + 8 + 3 * k].lockingBytecode, ecrecoverComputeLockingBytecode(salt, 'B2')))
        .toBe(true);
    }
    // Another digest in FINAL's recreation: refused by FINAL's covenant and by the master.
    const forged = withOutput(sent, master + 5, bumpCommitment);
    expect(inputPasses(s.provider, forged, master + 5)).toBe(false);
    expect(inputPasses(s.provider, forged, master)).toBe(false);
    // The first triple's A moved into the chain, where FINAL is read, and the triples swapped.
    expect(inputPasses(s.provider, swapIndexes(sent, master + 5, master + 6), master)).toBe(false);
    const swapped = [0, 1, 2].reduce((tx, offset) => swapIndexes(tx, master + 6 + offset, master + 9 + offset), sent);
    expect(inputPasses(s.provider, swapped, master)).toBe(false);
    // Another key in the second B2's recreation, and that B2 moved past the region.
    expect(inputPasses(s.provider, withOutput(sent, master + 11, otherKey), master)).toBe(false);
    expect(inputPasses(s.provider, swapIndexes(sent, master + 11, master + 12), master)).toBe(false);
  });
});

/** `handle`, whose functions' calls through interface `name` reach `callee`. */
function withCallee<T>(handle: T, name: string, callee: unknown): T {
  (handle as unknown as { _registerResolvedExternal(name: string, contract: unknown): void })
    ._registerResolvedExternal(name, callee);
  return handle;
}

describe('an ordinary call of a contract whose callee pushes, iterates or hashes in a loop (A calls D, which calls T)', () => {
  it('lays out the chunks the transitive callee\'s run pins after its block, and refuses another chunk or result',
    async () => {
      const source = `${P} interface I { function f(int x) external returns (int); }
        interface ID { function g(I t, int x) external; }
        contract T { int[] a; function f(int x) external returns (int) { a.push(x); a.push(x + 1); return a.length; } }
        contract D { int got; function g(I t, int x) external { got = t.f(x); } }
        contract A { int n; function h(ID d, I t, int x) external { n = n + 1; d.g(t, x); } }`;
      const s = setup();
      const t = await s.deploy(compileString(source, compileOptions('T')));
      const d = await s.deploy(compileString(source, compileOptions('D')));
      const a = await s.deploy(compileString(source, compileOptions('A')));
      const wallet = await s.wallet(8);
      const tLock = addressToLockScript(t.contract.address);
      const dLock = addressToLockScript(d.contract.address);
      const chunkLock = addressToLockScript(getDynamicChunkAddress(t.contract.inner as never, t.categoryId, 'a', 'int256[]'));
      const dCallee = withCallee(d.contract, 'I', t.contract);
      // The first call writes one chunk; the second spends it and writes two, for four elements.
      for (const [x, length, written, spent, calls] of [[5n, 2n, 1, 0, 1n], [7n, 4n, 2, 1, 2n]] as const) {
        await (a.contract.connect(wallet) as any).call.h(dLock, tLock, x).withExternalCall(dCallee).send();
        const sent = s.sent[s.sent.length - 1]!;
        expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
        expect(((await a.contract.getState()) as { n?: bigint }).n).toBe(calls);
        expect(((await d.contract.getState()) as { got?: bigint }).got).toBe(length);
        // T's block of master, record and record slot follows D's, then T's new chunks; the old chunk is spent there.
        const dMaster = inputAt(sent, dLock);
        const tMaster = inputAt(sent, tLock);
        expect(tMaster).toBeGreaterThan(dMaster);
        const chunks = outputsAt(sent, chunkLock);
        expect(chunks).toEqual(Array.from({ length: written }, (_, index) => tMaster + 3 + index));
        const old = sent.sourceOutputs.map((output, index) => (same(output.lockingBytecode, chunkLock) ? index : -1))
          .filter((index) => index >= 0);
        expect(old).toEqual(Array.from({ length: spent }, (_, index) => tMaster + 3 + index));
        // Another chunk: refused by T, whose run pins it. Two chunks swapped.
        for (const index of chunks) {
          expect(inputPasses(s.provider, withOutput(sent, index, bumpCommitment), tMaster)).toBe(false);
        }
        if (written > 1) expect(inputPasses(s.provider, swapOutputs(sent, chunks[0]!, chunks[1]!), tMaster)).toBe(false);
        // Another result in T's call record: refused by D, which reads it, and by T.
        expect(sent.transaction.outputs[tMaster + 2]!.token?.nft?.capability).toBe('none');
        expect(inputPasses(s.provider, withOutput(sent, tMaster + 2, bumpCommitment), dMaster)).toBe(false);
        expect(inputPasses(s.provider, withOutput(sent, tMaster + 2, bumpCommitment), tMaster)).toBe(false);
        // The old chunk swapped with T's record-slot input: T reads another coin as the old value.
        if (spent > 0) expect(inputPasses(s.provider, swapInputs(sent, tMaster + 2, tMaster + 3), tMaster)).toBe(false);
      }
      expect(((await t.contract.getState()) as { a?: bigint[] }).a).toEqual([5n, 6n, 7n, 8n]);
    });

  it('co-spends the transitive callee\'s walk after its block, and refuses a walk missing an entry or another entry',
    async () => {
      const source = `${P} interface I { function f() external returns (int); }
        interface ID { function g(I t) external; }
        contract T { int total; enumerable mapping(bytes20 => int) bal; function put(bytes20 k, int v) public { bal[k] = v; }
          function f() external returns (int) { int sum = 0; for (int value of this.bal) { sum = sum + value; } total = sum; return sum; } }
        contract D { int got; function g(I t) external { got = t.f(); } }
        contract A { int n; function h(ID d, I t) external { n = n + 1; d.g(t); } }`;
      const s = setup();
      const t = await s.deploy(compileString(source, compileOptions('T')));
      const d = await s.deploy(compileString(source, compileOptions('D')));
      const a = await s.deploy(compileString(source, compileOptions('A')));
      const wallet = await s.wallet(8);
      await (t.contract.connect(wallet) as any).call.put(new Uint8Array(20).fill(1), 5n).send();
      await (t.contract.connect(wallet) as any).call.put(new Uint8Array(20).fill(2), 7n).send();
      const tLock = addressToLockScript(t.contract.address);
      const dLock = addressToLockScript(d.contract.address);
      await (a.contract.connect(wallet) as any).call.h(dLock, tLock).withExternalCall(withCallee(d.contract, 'I', t.contract))
        .send();
      const sent = s.sent[s.sent.length - 1]!;
      expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
      expect(((await a.contract.getState()) as { n?: bigint }).n).toBe(1n);
      expect(((await d.contract.getState()) as { got?: bigint }).got).toBe(12n);
      expect(((await t.contract.getState()) as { total?: bigint }).total).toBe(12n);

      // T's block of master, record and record slot follows D's, then the walk: the HEAD and both entries, each
      // recreated as it was at its own index.
      const dMaster = inputAt(sent, dLock);
      const tMaster = inputAt(sent, tLock);
      expect(tMaster).toBeGreaterThan(dMaster);
      const entryLock = addressToLockScript(getEntryNftAddress(t.contract.inner as never, t.categoryId, 'bal'));
      const walked = sent.sourceOutputs.map((output, index) => (same(output.lockingBytecode, entryLock) ? index : -1))
        .filter((index) => index >= 0);
      expect(walked).toEqual([tMaster + 3, tMaster + 4, tMaster + 5]);
      expect(outputsAt(sent, entryLock)).toEqual(walked);
      // The walk missing an entry, its input and its recreation left out: refused by T.
      expect(inputPasses(s.provider, removeIndexes(sent, tMaster + 4, 1), tMaster)).toBe(false);
      // An entry recreated with another value, and the two entries swapped with their outputs.
      expect(inputPasses(s.provider, withOutput(sent, tMaster + 4, bumpCommitment), tMaster)).toBe(false);
      expect(inputPasses(s.provider, swapIndexes(sent, tMaster + 4, tMaster + 5), tMaster)).toBe(false);
      // Another sum in T's record: refused by T. Another result in its call record: refused by D, which reads it.
      const [tRecord] = outputsAt(sent, addressToLockScript(getDataNftAddress(t.contract.inner as never, t.categoryId)));
      expect(inputPasses(s.provider, withOutput(sent, tRecord!, bumpCommitment), tMaster)).toBe(false);
      expect(inputPasses(s.provider, withOutput(sent, tMaster + 2, bumpCommitment), dMaster)).toBe(false);
    });

  it('co-spends a shared side-car per iteration after the transitive callee\'s block, and refuses another digest',
    async () => {
      const { keccakComputeLockingBytecode } = await import('@solidcash/utils');
      const { computeSideCarStandIn } = await import('../../src/stateful/stateful-abi-resolve.js');
      const { keccak_256: keccak } = await import('@noble/hashes/sha3.js');
      const source = `${P} interface I { function f(bytes b, int k) external returns (bool); }
        interface ID { function g(I t, bytes b, int k) external; }
        contract T { bytes32 h; function f(bytes b, int k) external returns (bool) {
          bytes32 x = 0x; for (int i = 0; i < k; i++) { x = keccak256(b); } h = x; return true; } }
        contract D { bool ok; function g(I t, bytes b, int k) external { ok = t.f(b, k); } }
        contract A { int n; function h(ID d, I t, bytes b, int k) external { n = n + 1; d.g(t, b, k); } }`;
      const s = setup();
      const t = await s.deploy(compileString(source, compileOptions('T')));
      const d = await s.deploy(compileString(source, compileOptions('D')));
      const a = await s.deploy(compileString(source, compileOptions('A')));
      const wallet = await s.wallet(8);
      const tLock = addressToLockScript(t.contract.address);
      const dLock = addressToLockScript(d.contract.address);
      const dCallee = withCallee(d.contract, 'I', t.contract);
      const b = Uint8Array.of(1, 2, 3);
      // No coin of the shared pool: refused by name before anything is sent.
      const before = s.sent.length;
      await expect((a.contract.connect(wallet) as any).call.h(dLock, tLock, b, 2n).withExternalCall(dCallee).send())
        .rejects.toThrow(/The call of T\.f cannot be laid out: its keccak256 loop needs 2 side-car coins of the shared /);
      expect(s.sent.length).toBe(before);

      const sharedLock = keccakComputeLockingBytecode(new Uint8Array(32), true);
      for (const index of [0, 1, 2]) {
        await s.provider.seedUtxo(binToHex(sharedLock), computeSideCarStandIn('keccak-loop-transitive', sharedLock, index));
      }
      await (a.contract.connect(wallet) as any).call.h(dLock, tLock, b, 2n).withExternalCall(dCallee).send();
      const sent = s.sent[s.sent.length - 1]!;
      expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
      expect(((await a.contract.getState()) as { n?: bigint }).n).toBe(1n);
      expect(((await d.contract.getState()) as { ok?: boolean }).ok).toBe(true);
      expect(binToHex(((await t.contract.getState()) as { h?: Uint8Array }).h!)).toBe(binToHex(keccak(b)));
      // T's block of master, record and record slot follows D's, then one shared side-car per iteration, each
      // recreated at its own index with the digest.
      const dMaster = inputAt(sent, dLock);
      const tMaster = inputAt(sent, tLock);
      expect(tMaster).toBeGreaterThan(dMaster);
      const sidecars = outputsAt(sent, sharedLock);
      expect(sidecars).toEqual([tMaster + 3, tMaster + 4]);
      for (const index of sidecars) {
        expect(same(sent.sourceOutputs[index].lockingBytecode, sharedLock)).toBe(true);
        expect(binToHex(sent.transaction.outputs[index]!.token!.nft!.commitment)).toBe(binToHex(keccak(b)));
      }
      // Another digest: refused by the side-car and by T, which reads it.
      const forged = withOutput(sent, tMaster + 4, bumpCommitment);
      expect(inputPasses(s.provider, forged, tMaster + 4)).toBe(false);
      expect(inputPasses(s.provider, forged, tMaster)).toBe(false);
      // A side-car's input moved to T's record slot: refused by T, which reads a side-car at the loop's index.
      expect(inputPasses(s.provider, swapInputs(sent, tMaster + 2, tMaster + 3), tMaster)).toBe(false);
    });
});

/**
 * In the transaction `builder` holds, the contract at `callerLock` names the master of the contract it calls (at
 * `calleeLock`) as the base of its calls and that contract's record as its result's index; either one moved by one
 * input or output is refused by the caller.
 */
function expectCalleeCoordinatesBound(
  s: Setup, builder: any, callerLock: Uint8Array, calleeLock: Uint8Array, calleeCategory: string,
): void {
  const program = builder.buildLibauthProgram(true) as Sent;
  const caller = inputAt(program, callerLock);
  expect(inputPasses(s.provider, program, caller)).toBe(true);
  const unlocker = builder.inputs[caller].unlocker as {
    params: unknown[];
    abiFunction: { inputs: ReadonlyArray<{ name: string }> };
    syncEncodedArgsFromParams(indices?: readonly number[]): void;
  };
  const at = (pattern: RegExp): number => unlocker.abiFunction.inputs.findIndex((input) => pattern.test(input.name));
  const base = at(/^__internal__externalCallInputBase$/);
  const result = at(/^__internal__externalReturnOutputIdx\d*$/);
  expect(unlocker.params[base]).toBe(BigInt(inputAt(program, calleeLock)));
  const record = program.transaction.outputs[Number(unlocker.params[result])]!;
  expect(binToHex(record.lockingBytecode)).toBe('51');
  expect(binToHex(record.token!.category)).toBe(calleeCategory);
  for (const index of [base, result]) {
    const placed = unlocker.params[index] as bigint;
    for (const moved of [placed - 1n, placed + 1n]) {
      unlocker.params[index] = moved;
      unlocker.syncEncodedArgsFromParams([index]);
      expect(inputPasses(s.provider, builder.buildLibauthProgram(true) as Sent, caller)).toBe(false);
    }
    unlocker.params[index] = placed;
    unlocker.syncEncodedArgsFromParams([index]);
  }
}

describe('a call of a contract that calls another, by a function that returns a value (A calls D, which calls T)', () => {
  const SOURCE = `${P} interface I { function f(int x) external returns (int); }
    interface ID { function g(I t, int x) external returns (int); }
    contract T { int calls; function f(int x) external returns (int) { calls = calls + 1; return x * 2; } }
    contract D { int got; function g(I t, int x) external returns (int) { got = t.f(x); return got + 1; } }
    contract A { int got; function h(ID d, I t, int x) external returns (int) { got = d.g(t, x); return got; } }`;

  for (const emitReturn of [false, true]) {
    it(`binds D's base and result index for T to the transaction ${emitReturn ? 'that publishes A\'s record' : 'sent plainly'}, `
      + 'and refuses either one moved', async () => {
      const s = setup();
      const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
      const d = await s.deploy(compileString(SOURCE, compileOptions('D')));
      const a = await s.deploy(compileString(SOURCE, compileOptions('A')));
      const wallet = await s.wallet(8);
      const tLock = addressToLockScript(t.contract.address);
      const dLock = addressToLockScript(d.contract.address);
      const dCallee = withCallee(d.contract, 'I', t.contract);
      const call = (): any => {
        const built = (a.contract.connect(wallet) as any).call.h(dLock, tLock, 5n).withExternalCall(dCallee);
        return emitReturn ? built.emitReturn() : built;
      };
      expectCalleeCoordinatesBound(s, await call().build(), dLock, tLock, t.categoryId);

      await call().send();
      const sent = s.sent[s.sent.length - 1]!;
      expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
      expect(((await a.contract.getState()) as { got?: bigint }).got).toBe(11n);
      expect(((await d.contract.getState()) as { got?: bigint }).got).toBe(10n);
      expect(((await t.contract.getState()) as { calls?: bigint }).calls).toBe(1n);
    });
  }

  for (const emitReturn of [false, true]) {
    it(`co-spends T's walk after its block for a caller that returns a value ${emitReturn ? 'and publishes its record'
      : 'sent plainly'}, and refuses a walk missing an entry`, async () => {
      const source = `${P} interface I { function f() external returns (int); }
        interface ID { function g(I t) external returns (int); }
        contract T { int total; enumerable mapping(bytes20 => int) bal; function put(bytes20 k, int v) public { bal[k] = v; }
          function f() external returns (int) { int sum = 0; for (int value of this.bal) { sum = sum + value; } total = sum; return sum; } }
        contract D { int got; function g(I t) external returns (int) { got = t.f(); return got; } }
        contract A { int got; function h(ID d, I t) external returns (int) { got = d.g(t); return got; } }`;
      const s = setup();
      const t = await s.deploy(compileString(source, compileOptions('T')));
      const d = await s.deploy(compileString(source, compileOptions('D')));
      const a = await s.deploy(compileString(source, compileOptions('A')));
      const wallet = await s.wallet(8);
      await (t.contract.connect(wallet) as any).call.put(new Uint8Array(20).fill(1), 5n).send();
      await (t.contract.connect(wallet) as any).call.put(new Uint8Array(20).fill(2), 7n).send();
      const tLock = addressToLockScript(t.contract.address);
      const dLock = addressToLockScript(d.contract.address);
      const dCallee = withCallee(d.contract, 'I', t.contract);
      const call = (): any => {
        const built = (a.contract.connect(wallet) as any).call.h(dLock, tLock).withExternalCall(dCallee);
        return emitReturn ? built.emitReturn() : built;
      };
      expectCalleeCoordinatesBound(s, await call().build(), dLock, tLock, t.categoryId);

      await call().send();
      const sent = s.sent[s.sent.length - 1]!;
      expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
      expect(((await a.contract.getState()) as { got?: bigint }).got).toBe(12n);
      expect(((await d.contract.getState()) as { got?: bigint }).got).toBe(12n);
      expect(((await t.contract.getState()) as { total?: bigint }).total).toBe(12n);
      // T's block of master, record and record slot, then the walk; an entry left out is refused by T.
      const tMaster = inputAt(sent, tLock);
      const entryLock = addressToLockScript(getEntryNftAddress(t.contract.inner as never, t.categoryId, 'bal'));
      const walked = sent.sourceOutputs.map((output, index) => (same(output.lockingBytecode, entryLock) ? index : -1))
        .filter((index) => index >= 0);
      expect(walked).toEqual([tMaster + 3, tMaster + 4, tMaster + 5]);
      expect(inputPasses(s.provider, removeIndexes(sent, tMaster + 4, 1), tMaster)).toBe(false);
    });
  }
});

/**
 * In the transaction `builder` holds, the input at `lock` passes and its witness `name` names index `named` (an input's
 * or an output's); the witness moved by one index either way is refused by that input.
 */
function expectWitnessNamesInput(s: Setup, builder: any, lock: Uint8Array, name: string, named: number): void {
  const program = builder.buildLibauthProgram(true) as Sent;
  const at = inputAt(program, lock);
  expect(inputPasses(s.provider, program, at)).toBe(true);
  const unlocker = builder.inputs[at].unlocker as {
    params: unknown[];
    abiFunction: { inputs: ReadonlyArray<{ name: string }> };
    syncEncodedArgsFromParams(indices?: readonly number[]): void;
  };
  const position = unlocker.abiFunction.inputs.findIndex((input) => input.name === name);
  expect(unlocker.params[position]).toBe(BigInt(named));
  for (const moved of [named - 1, named + 1]) {
    unlocker.params[position] = BigInt(moved);
    unlocker.syncEncodedArgsFromParams([position]);
    expect(inputPasses(s.provider, builder.buildLibauthProgram(true) as Sent, at)).toBe(false);
  }
  unlocker.params[position] = BigInt(named);
  unlocker.syncEncodedArgsFromParams([position]);
}

describe('nested coordinates read from the assembled transaction: a callee behind a published record, and a caller of two '
  + 'contracts', () => {
  it('names T\'s old chunk as its base, and T\'s master to the chunk, behind A\'s record slot (A calls D, which calls T)',
    async () => {
      const source = `${P} interface I { function f(int x) external returns (int); }
        interface ID { function g(I t, int x) external returns (int); }
        contract T { int[] a; function f(int x) external returns (int) { a.push(x); a.push(x + 1); return a.length; } }
        contract D { int got; function g(I t, int x) external returns (int) { got = t.f(x); return got; } }
        contract A { int got; function h(ID d, I t, int x) external returns (int) { got = d.g(t, x); return got; } }`;
      const s = setup();
      const t = await s.deploy(compileString(source, compileOptions('T')));
      const d = await s.deploy(compileString(source, compileOptions('D')));
      const a = await s.deploy(compileString(source, compileOptions('A')));
      const wallet = await s.wallet(8);
      const tLock = addressToLockScript(t.contract.address);
      const dLock = addressToLockScript(d.contract.address);
      const chunkLock = addressToLockScript(getDynamicChunkAddress(t.contract.inner as never, t.categoryId, 'a', 'int256[]'));
      const dCallee = withCallee(d.contract, 'I', t.contract);
      const call = (x: bigint): any => (a.contract.connect(wallet) as any).call.h(dLock, tLock, x)
        .withExternalCall(dCallee).emitReturn();
      // The first call writes one chunk; the second spends it and writes two, for four elements.
      for (const [x, length, written, spent] of [[5n, 2n, 1, 0], [7n, 4n, 2, 1]] as const) {
        if (spent > 0) {
          // T reads the old chunk at the input its base names, and the chunk's covenant authorizes its spend by the
          // master at the input its unlocker names: T's.
          const builder = await call(x).build();
          const program = builder.buildLibauthProgram(true) as Sent;
          const builtMaster = inputAt(program, tLock);
          const oldChunk = inputAt(program, chunkLock);
          expect(oldChunk).toBe(builtMaster + 3);
          expectWitnessNamesInput(s, builder, tLock, '__internal__dynamicChunkInputBase', oldChunk);
          const chunk = builder.inputs[oldChunk].unlocker as {
            params: unknown[]; abiFunction: { inputs: ReadonlyArray<{ name: string }> };
          };
          expect(chunk.params[chunk.abiFunction.inputs.findIndex((input) => input.name === 'masterInputIndex')])
            .toBe(BigInt(builtMaster));
          expect(inputPasses(s.provider, program, oldChunk)).toBe(true);
        }
        await call(x).send();
        const sent = s.sent[s.sent.length - 1]!;
        expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
        expect(((await a.contract.getState()) as { got?: bigint }).got).toBe(length);
        expect(((await d.contract.getState()) as { got?: bigint }).got).toBe(length);
        // A's block holds its record slot open (master, record, record slot), and D's block follows; T's follows D's.
        const dMaster = inputAt(sent, dLock);
        const tMaster = inputAt(sent, tLock);
        expect(dMaster).toBe(3);
        expect(tMaster).toBeGreaterThan(dMaster);
        // T's new chunks follow its block of master, record and record slot; the old chunk is spent at the same index.
        const chunks = outputsAt(sent, chunkLock);
        expect(chunks).toEqual(Array.from({ length: written }, (_, index) => tMaster + 3 + index));
        const old = sent.sourceOutputs.map((output, index) => (same(output.lockingBytecode, chunkLock) ? index : -1))
          .filter((index) => index >= 0);
        expect(old).toEqual(Array.from({ length: spent }, (_, index) => tMaster + 3 + index));
        // Another chunk: refused by T, whose run pins it.
        for (const index of chunks) {
          expect(inputPasses(s.provider, withOutput(sent, index, bumpCommitment), tMaster)).toBe(false);
        }
        // The old chunk swapped with T's record-slot input: T reads another coin as the old value.
        if (spent > 0) expect(inputPasses(s.provider, swapInputs(sent, tMaster + 2, tMaster + 3), tMaster)).toBe(false);
      }
      expect(((await t.contract.getState()) as { a?: bigint[] }).a).toEqual([5n, 6n, 7n, 8n]);
    });

  it('names the pool\'s one info coin, in D\'s block, for D and for T behind A\'s record slot (A calls D, which calls T)',
    async () => {
      const source = `${P} interface I { function f() external returns (int); }
        interface ID { function g(I t) external returns (int); }
        contract T { int n; function f() external returns (int) { n = int(block.number); return n; } }
        contract D { int n; int got; function g(I t) external returns (int) { n = int(block.number); got = t.f(); return got; } }
        contract A { int got; function h(ID d, I t) external returns (int) { got = d.g(t); return got; } }`;
      const s = setup();
      const t = await s.deploy(compileString(source, compileOptions('T')));
      const d = await s.deploy(compileString(source, compileOptions('D')));
      const a = await s.deploy(compileString(source, compileOptions('A')));
      const wallet = await s.wallet(8);
      const pool = (t.contract.inner as unknown as { oraclePool: string }).oraclePool;
      const tLock = addressToLockScript(t.contract.address);
      const dLock = addressToLockScript(d.contract.address);
      const dCallee = withCallee(d.contract, 'I', t.contract);
      const call = (): any => (a.contract.connect(wallet) as any).call.h(dLock, tLock).withExternalCall(dCallee)
        .emitReturn();
      const builder = await call().build();
      const program = builder.buildLibauthProgram(true) as Sent;
      // One info coin, in D's block; T, which has no block of its own, reads that coin too.
      const info = program.sourceOutputs.flatMap((output, index) => (isPoolInfoOutput(output, pool) ? [index] : []));
      expect(info).toHaveLength(1);
      const dMaster = inputAt(program, dLock);
      expect(dMaster).toBe(3);
      expect(info[0]!).toBeGreaterThan(dMaster);
      expect(info[0]!).toBeLessThan(inputAt(program, tLock));
      expectWitnessNamesInput(s, builder, dLock, '__internal__blockOracleInputIndex', info[0]!);
      expectWitnessNamesInput(s, builder, tLock, '__internal__blockOracleInputIndex', info[0]!);

      const height = BigInt(await s.provider.getBlockHeight());
      await call().send();
      const sent = s.sent[s.sent.length - 1]!;
      expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
      expect(((await t.contract.getState()) as { n?: bigint }).n).toBe(height);
      expect(((await d.contract.getState()) as { n?: bigint }).n).toBe(height);
      expect(((await a.contract.getState()) as { got?: bigint }).got).toBe(height);
    });

  for (const emitReturn of [false, true]) {
    it(`names the master of each contract D calls, T and U, ${emitReturn ? 'behind A\'s record slot' : 'sent plainly'}, `
      + 'and refuses either index moved or the two swapped', async () => {
      const source = `${P} interface IT { function f(int x) external returns (int); }
        interface IU { function g(int x) external returns (int); }
        interface ID { function h(IT t, IU u, int x) external returns (int); }
        contract T { int calls; function f(int x) external returns (int) { calls = calls + 1; return x * 2; } }
        contract U { int calls; function g(int x) external returns (int) { calls = calls + 1; return x + 3; } }
        contract D { int got; function h(IT t, IU u, int x) external returns (int) { got = t.f(x) + u.g(x); return got; } }
        contract A { int got; function k(ID d, IT t, IU u, int x) external returns (int) { got = d.h(t, u, x); return got; } }`;
      const s = setup();
      const t = await s.deploy(compileString(source, compileOptions('T')));
      const u = await s.deploy(compileString(source, compileOptions('U')));
      const d = await s.deploy(compileString(source, compileOptions('D')));
      const a = await s.deploy(compileString(source, compileOptions('A')));
      const wallet = await s.wallet(8);
      const tLock = addressToLockScript(t.contract.address);
      const uLock = addressToLockScript(u.contract.address);
      const dLock = addressToLockScript(d.contract.address);
      const dCallee = withCallee(withCallee(d.contract, 'IT', t.contract), 'IU', u.contract);
      const call = (): any => {
        const built = (a.contract.connect(wallet) as any).call.k(dLock, tLock, uLock, 5n).withExternalCall(dCallee);
        return emitReturn ? built.emitReturn() : built;
      };
      const builder = await call().build();
      const program = builder.buildLibauthProgram(true) as Sent;
      const masterOf: Record<string, number> = { IT: inputAt(program, tLock), IU: inputAt(program, uLock) };
      // D's frame names, for the call in each slot, the master of the contract that call reaches.
      const dAt = inputAt(program, dLock);
      const frame = builder.inputs[dAt].unlocker as {
        params: unknown[];
        abiFunction: {
          inputs: ReadonlyArray<{ name: string }>; externalCalls?: ReadonlyArray<{ interfaceName: string }>;
        };
        syncEncodedArgsFromParams(indices?: readonly number[]): void;
      };
      const witnesses = frame.abiFunction.inputs.flatMap((input, position) => {
        const slot = /^__internal__extcallMasterIdx(\d+)$/.exec(input.name)?.[1];
        const callee = slot === undefined ? undefined : frame.abiFunction.externalCalls?.[Number(slot)]?.interfaceName;
        return callee === undefined ? [] : [{ name: input.name, position, named: masterOf[callee]! }];
      });
      expect(witnesses).toHaveLength(2);
      expect(new Set(witnesses.map(({ named }) => named))).toEqual(new Set([masterOf.IT, masterOf.IU]));
      for (const { name, named } of witnesses) expectWitnessNamesInput(s, builder, dLock, name, named);
      // The two swapped: each call's identity check reads the other contract's master.
      const swap = (): void => {
        const [left, right] = witnesses.map(({ position }) => position) as [number, number];
        [frame.params[left], frame.params[right]] = [frame.params[right], frame.params[left]];
        frame.syncEncodedArgsFromParams([left, right]);
      };
      swap();
      expect(inputPasses(s.provider, builder.buildLibauthProgram(true) as Sent, dAt)).toBe(false);
      swap();

      await call().send();
      const sent = s.sent[s.sent.length - 1]!;
      expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
      expect(((await t.contract.getState()) as { calls?: bigint }).calls).toBe(1n);
      expect(((await u.contract.getState()) as { calls?: bigint }).calls).toBe(1n);
      expect(((await d.contract.getState()) as { got?: bigint }).got).toBe(18n);
      expect(((await a.contract.getState()) as { got?: bigint }).got).toBe(18n);
    });
  }
});

describe('a nested caller\'s calls matched by callsite', () => {
  it('names nothing for D\'s skipped first call and U\'s master and record for its second, then runs both '
    + '(A calls D, which calls T when asked, then U)', async () => {
    const source = `${P} interface IT { function f(int x) external returns (int); }
      interface IU { function g(int x) external returns (int); }
      interface ID { function h(IT t, IU u, int x, bool c) external returns (int); }
      contract T { int calls; function f(int x) external returns (int) { calls = calls + 1; return x * 2; } }
      contract U { int calls; function g(int x) external returns (int) { calls = calls + 1; return x + 3; } }
      contract D { int got; function h(IT t, IU u, int x, bool c) external returns (int) {
        int a = 0; if (c) { a = t.f(x); } got = a + u.g(x); return got; } }
      contract A { int got; function k(ID d, IT t, IU u, int x, bool c) external returns (int) {
        got = d.h(t, u, x, c); return got; } }`;
    const s = setup();
    const t = await s.deploy(compileString(source, compileOptions('T')));
    const u = await s.deploy(compileString(source, compileOptions('U')));
    const d = await s.deploy(compileString(source, compileOptions('D')));
    const a = await s.deploy(compileString(source, compileOptions('A')));
    const wallet = await s.wallet(8);
    const [tLock, uLock, dLock] = [t, u, d].map((deployed) => addressToLockScript(deployed.contract.address));
    const dCallee = withCallee(withCallee(d.contract, 'IT', t.contract), 'IU', u.contract);
    const call = (c: boolean): any => (a.contract.connect(wallet) as any).call.k(dLock, tLock, uLock, 5n, c)
      .withExternalCall(dCallee);

    // T's call not made: D's witnesses for its first call name nothing, and those for its second name U's master and
    // U's record, each refused by D moved by one index.
    const builder = await call(false).build();
    const program = builder.buildLibauthProgram(true) as Sent;
    expect(inputAt(program, tLock)).toBe(-1);
    const frame = builder.inputs[inputAt(program, dLock)].unlocker as {
      params: unknown[];
      abiFunction: {
        inputs: ReadonlyArray<{ name: string }>; externalCalls?: ReadonlyArray<{ interfaceName: string }>;
      };
    };
    expect(frame.abiFunction.externalCalls?.map((made) => made.interfaceName)).toEqual(['IT', 'IU']);
    const param = (name: string): unknown => frame.params[frame.abiFunction.inputs.findIndex((input) => (
      input.name === name))];
    expect(param('__internal__extcallMasterIdx0')).toBe(-1n);
    expect(param('__internal__externalReturnOutputIdx0')).toBe(-1n);
    const record = Number(param('__internal__externalReturnOutputIdx1'));
    expect(binToHex(program.transaction.outputs[record]!.lockingBytecode)).toBe('51');
    expect(binToHex(program.transaction.outputs[record]!.token!.category)).toBe(u.categoryId);
    expectWitnessNamesInput(s, builder, dLock, '__internal__extcallMasterIdx1', inputAt(program, uLock));
    expectWitnessNamesInput(s, builder, dLock, '__internal__externalReturnOutputIdx1', record);

    for (const [c, tCalls, uCalls, got] of [[false, 0n, 1n, 8n], [true, 1n, 2n, 18n]] as const) {
      await call(c).send();
      const sent = s.sent[s.sent.length - 1]!;
      expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
      expect(((await t.contract.getState()) as { calls?: bigint }).calls ?? 0n).toBe(tCalls);
      expect(((await u.contract.getState()) as { calls?: bigint }).calls).toBe(uCalls);
      expect(((await d.contract.getState()) as { got?: bigint }).got).toBe(got);
      expect(((await a.contract.getState()) as { got?: bigint }).got).toBe(got);
    }
  });

  it('names for each of D\'s calls the selector of the function it calls, when the two share a name '
    + '(A calls D, which calls T.f and U.f)', async () => {
    const source = `${P} interface IT { function f(int x) external returns (int); function n() external returns (int); }
      interface IU { function f(int x, int y) external returns (int); function n() external returns (int); }
      interface ID { function h(IT t, IU u, int x) external returns (int); }
      contract T { int calls; function f(int x) external returns (int) { calls = calls + 1; return x * 2; }
        function n() external returns (int) { return calls; } }
      contract U { int calls; function f(int x, int y) external returns (int) { calls = calls + 1; return x + y; }
        function n() external returns (int) { return calls; } }
      contract D { int got; function h(IT t, IU u, int x) external returns (int) { got = t.f(x) + u.f(x, 3); return got; } }
      contract A { int got; function k(ID d, IT t, IU u, int x) external returns (int) { got = d.h(t, u, x); return got; } }`;
    const s = setup();
    const t = await s.deploy(compileString(source, compileOptions('T')));
    const u = await s.deploy(compileString(source, compileOptions('U')));
    const d = await s.deploy(compileString(source, compileOptions('D')));
    const a = await s.deploy(compileString(source, compileOptions('A')));
    const wallet = await s.wallet(8);
    const [tLock, uLock, dLock] = [t, u, d].map((deployed) => addressToLockScript(deployed.contract.address));
    const dCallee = withCallee(withCallee(d.contract, 'IT', t.contract), 'IU', u.contract);
    const call = (): any => (a.contract.connect(wallet) as any).call.k(dLock, tLock, uLock, 5n)
      .withExternalCall(dCallee);
    const selectorOf = (deployed: DeployResult<Artifact>): string => deployed.contract.inner.artifact.abi
      .find((fn) => fn.name === 'f')!.selector!.toLowerCase();
    const expected: Record<string, string> = { IT: selectorOf(t), IU: selectorOf(u) };
    expect(expected.IT).not.toBe(expected.IU);

    // D's selector witness of each call holds the selector of the function that call names: T.f(int) for its first,
    // U.f(int,int) for its second.
    const builder = await call().build();
    const program = builder.buildLibauthProgram(true) as Sent;
    const frame = builder.inputs[inputAt(program, dLock)].unlocker as {
      params: unknown[];
      abiFunction: {
        inputs: ReadonlyArray<{ name: string }>; externalCalls?: ReadonlyArray<{ interfaceName: string }>;
      };
    };
    const witnesses = frame.abiFunction.inputs.flatMap((input, position) => {
      const slot = /^__internal__externalCallSelector(\d+)$/.exec(input.name)?.[1];
      const callee = slot === undefined ? undefined : frame.abiFunction.externalCalls?.[Number(slot)]?.interfaceName;
      return callee === undefined ? [] : [{ callee, held: binToHex(frame.params[position] as Uint8Array) }];
    });
    expect(witnesses.map(({ callee }) => callee)).toEqual(['IT', 'IU']);
    for (const { callee, held } of witnesses) expect(held).toBe(expected[callee]);
    expect(inputPasses(s.provider, program, inputAt(program, dLock))).toBe(true);

    await call().send();
    const sent = s.sent[s.sent.length - 1]!;
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
    expect(((await t.contract.getState()) as { calls?: bigint }).calls).toBe(1n);
    expect(((await u.contract.getState()) as { calls?: bigint }).calls).toBe(1n);
    expect(((await d.contract.getState()) as { got?: bigint }).got).toBe(18n);
    expect(((await a.contract.getState()) as { got?: bigint }).got).toBe(18n);
  });
});
