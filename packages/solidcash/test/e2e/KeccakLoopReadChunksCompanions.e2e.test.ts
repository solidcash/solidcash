/**
 * A direct call of a function that reads dynamic state it does not write, hashes in a keccak256 loop, and then runs a
 * mapping loop, makes per-turn payments, emits events in a loop, or calls another contract.
 *
 * The loop reads side-car k from the input master + blockSize + k and recreates it at the output of that index; the
 * function finds the chunks it reads through its `__internal__dynamicChunkInputBase` witness. A mapping loop, payments or
 * events after the keccak256 loop start past its side-cars (the compiler's shared cursors) and past the read chunks
 * (which they count), so the build lays out the side-cars, then the chunks, then the run, each preserved coin at its own
 * index. A call of another contract is not laid out beside the chunks and the side-cars: the SDK refuses it by name
 * before anything is sent. Each sent transaction is checked by the VM, and each tamper case changes one part of it and
 * expects the covenant that binds that part to refuse.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import { keccak_256 as keccak } from '@noble/hashes/sha3.js';
import { keccakComputeLockingBytecode } from '@solidcash/utils';
import type { Artifact } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { SignatureTemplate, Signer } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { getDynamicChunkAddress } from '../../src/stateful/covenant-helpers.js';
import { computeSideCarStandIn } from '../../src/stateful/stateful-abi-resolve.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { addressToLockScript, solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';
import type { DeployResult } from '../../src/stateful/stateful-lifecycle-types.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const P = 'pragma solidcash ^0.52.0;';
const compileOptions = (primary: string): never => ({
  deployer: true, genesisCalls: true, primaryContractName: primary,
}) as never;

let serial = 0xc5a0;
const nextTxid = (): string => (serial++).toString(16).padStart(64, '0');

type Sent = { transaction: ReturnType<typeof decodeTransactionUnsafe>; sourceOutputs: any[] };

interface Setup {
  provider: MockNetworkProvider;
  deploy(artifact: Artifact, options?: Record<string, unknown>): Promise<DeployResult<Artifact>>;
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
  const deploy = async (artifact: Artifact, options: Record<string, unknown> = {}): Promise<DeployResult<Artifact>> => {
    const fundingUtxo: Utxo = { txid: nextTxid(), vout: 0, satoshis: 2_000_000n };
    await provider.seedUtxo(binToHex(authorLock), fundingUtxo);
    return StatefulContract.deploy(artifact, [] as never, {
      provider, fundingUtxo, funder, changeAddress: change.address, senderLockingBytecode: authorLock, ...options,
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
/** The indexes of the inputs of `sent` that spend a coin at `lock`. */
const inputsAt = (sent: Sent, lock: Uint8Array): number[] => sent.sourceOutputs
  .map((output, index) => (same(output.lockingBytecode, lock) ? index : -1)).filter((index) => index >= 0);
/** The indexes of the outputs of `sent` at `lock`. */
const outputsAt = (sent: Sent, lock: Uint8Array): number[] => sent.transaction.outputs
  .map((output, index) => (same(output.lockingBytecode, lock) ? index : -1)).filter((index) => index >= 0);

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

/** `sent` with inputs `left` and `right` swapped, with their coins and their outputs. */
const swapIndexes = (sent: Sent, left: number, right: number): Sent => {
  const swap = <T>(items: readonly T[]): T[] => items.map((item, at) => (
    at === left ? items[right]! : at === right ? items[left]! : item));
  return {
    sourceOutputs: swap(sent.sourceOutputs),
    transaction: { ...sent.transaction, inputs: swap(sent.transaction.inputs), outputs: swap(sent.transaction.outputs) },
  };
};

/** The read, then the keccak256 loop of `k` turns, before the run each test adds. */
const READ_AND_LOOP = 'int v = a[0]; bytes32 x = 0x; for (int i = 0; i < k; i++) { x = keccak256(b); } h = x;';
const ARRAY = 'int[] a; bytes32 h; int seen; function put(int x) public { a.push(x); }';

interface Called {
  s: Setup;
  t: DeployResult<Artifact>;
  fn: Artifact['abi'][number];
  wallet: Signer;
  b: Uint8Array;
  /** The master's input index and the first index after its block. */
  master: number;
  band: number;
  sent: Sent;
  result: any;
}

/**
 * Deploy T, push 5 and 7 onto `a` (one chunk), seed two side-cars under T's brand, call `f` with `args` and check that
 * the sent transaction passes the VM, that the state holds the digest and a[0], and that the two side-cars and the chunk
 * open the band after the block, each recreated at its own index: the side-cars with the digest, the chunk as it was.
 */
async function callBesideReadAndLoop(
  source: string, args: (b: Uint8Array) => unknown[], deployOptions: Record<string, unknown> = {},
): Promise<Called> {
  const s = setup();
  const artifact = compileString(source, compileOptions('T'));
  const fn = artifact.abi.find((entry) => entry.name === 'f')!;
  expect(fn.keccakLoopReads).toBe(true);
  expect(fn.keccakLoopPrecedesTrailingUser).toBe(true);
  expect(fn.dynamicReads).toEqual(['a']);
  expect(fn.dynamicWrites ?? []).toEqual([]);
  const t = await s.deploy(artifact, deployOptions);
  const wallet = await s.wallet(6);
  await (t.contract.connect(wallet) as any).call.put(5n).send();
  await (t.contract.connect(wallet) as any).call.put(7n).send();
  const lock = keccakComputeLockingBytecode(hexToBin(t.categoryId).slice().reverse(), true);
  for (const index of [0, 1]) {
    await s.provider.seedUtxo(binToHex(lock), computeSideCarStandIn('keccak-loop-read-beside', lock, index));
  }
  const b = Uint8Array.of(8, 9);
  const result = await (t.contract.connect(wallet) as any).call.f(...args(b)).send();
  const sent = s.sent[s.sent.length - 1]!;
  expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
  expect(await t.contract.getState()).toMatchObject({ seen: 5n });
  expect(binToHex(((await t.contract.getState()) as { h?: Uint8Array }).h!)).toBe(binToHex(keccak(b)));

  const master = inputAt(sent, addressToLockScript(t.contract.address));
  const band = master + fn.blockLayout!.blockSize;
  expect(inputsAt(sent, lock)).toEqual([band, band + 1]);
  expect(outputsAt(sent, lock)).toEqual([band, band + 1]);
  for (const index of [band, band + 1]) {
    expect(binToHex(sent.transaction.outputs[index]!.token!.nft!.commitment)).toBe(binToHex(keccak(b)));
  }
  const chunkLock = addressToLockScript(getDynamicChunkAddress(t.contract.inner as never, t.categoryId, 'a', 'int256[]'));
  expect(inputsAt(sent, chunkLock)).toEqual([band + 2]);
  expect(outputsAt(sent, chunkLock)).toEqual([band + 2]);
  expect(binToHex(sent.transaction.outputs[band + 2]!.token!.nft!.commitment))
    .toBe(binToHex(sent.sourceOutputs[band + 2].token.nft.commitment));
  // The last side-car moved into the chunk run, the chunk into the loop's: refused by the master, whose loop and read
  // each meet the other's coin.
  expect(inputPasses(s.provider, swapIndexes(sent, band + 1, band + 2), master)).toBe(false);
  return { s, t, fn, wallet, b, master, band, sent, result };
}

describe('a direct call whose keccak256 loop reads dynamic state it does not write, beside another run', () => {
  it('lays out a mapping loop after the side-cars and the chunk, and writes its entries', async () => {
    const source = `${P} contract T { ${ARRAY} mapping(int => int) values;
        function check(int key) public view { require(values[key] == 1); }
        function f(bytes b, int k, int[] keys) external returns (int) { ${READ_AND_LOOP}
          for (int j = 0; j < keys.length; j++) { this.values[keys[j]] = 1; } seen = v; return v; } }`;
    const { s, t, wallet, master, band, sent } = await callBesideReadAndLoop(source, (b) => [b, 2n, [1n, 2n]]);
    // The mapping loop's coins follow the chunk: the empty map's HEAD, spent at band + 3, and from there HEAD re-pointed
    // to key 1, then the two new nodes, each an entry of T's category under one lock.
    const entryLock = sent.sourceOutputs[band + 3].lockingBytecode as Uint8Array;
    expect(binToHex(sent.sourceOutputs[band + 3].token.category))
      .toBe(binToHex(sent.sourceOutputs[master].token.category));
    expect(inputsAt(sent, entryLock)).toEqual([band + 3]);
    expect(outputsAt(sent, entryLock)).toEqual([band + 3, band + 4, band + 5]);
    // Another value in the last new node: refused by the master.
    expect(inputPasses(s.provider, withOutput(sent, band + 5, bumpCommitment), master)).toBe(false);
    // Both keys were written: a call that reads each finds 1.
    const before = s.sent.length;
    await (t.contract.connect(wallet) as any).call.check(1n).send();
    await (t.contract.connect(wallet) as any).call.check(2n).send();
    expect(s.sent.length).toBe(before + 2);
  });

  it('lays out per-turn payments after the side-cars and the chunk, and refuses a payment sent elsewhere', async () => {
    const source = `${P} contract T { ${ARRAY}
        function f(bytes b, int k, bytes20[] recipients, int amount) external returns (int) { ${READ_AND_LOOP}
          for (int i = 0; i < recipients.length; i++) {
            this.transfer(new LockingBytecodeP2PKH(recipients[i]), amount);
          }
          seen = v; return v; } }`;
    const recipientA = new Uint8Array(20).fill(0x33);
    const recipientB = new Uint8Array(20).fill(0x44);
    const { s, fn, master, band, sent } = await callBesideReadAndLoop(
      source, (b) => [b, 2n, [recipientA, recipientB], 1000n], { initialBalance: 50_000n },
    );
    expect(fn.runtimeLoopTransfers?.length).toBe(1);
    // Each payment at the index the covenant checks: past the side-cars and the chunk, in turn order.
    const lockA = encodeLockingBytecodeP2pkh(recipientA);
    const lockB = encodeLockingBytecodeP2pkh(recipientB);
    expect(outputsAt(sent, lockA)).toEqual([band + 3]);
    expect(outputsAt(sent, lockB)).toEqual([band + 4]);
    expect(sent.transaction.outputs[band + 3]!.valueSatoshis).toBe(1000n);
    expect(sent.transaction.outputs[band + 4]!.valueSatoshis).toBe(1000n);
    // The first payment sent to another recipient: refused by the master.
    const redirected = withOutput(sent, band + 3, (output) => ({
      ...output, lockingBytecode: encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x55)),
    }));
    expect(inputPasses(s.provider, redirected, master)).toBe(false);
  });

  it('lays out a loop\'s events after the side-cars and the chunk, and refuses them in another order', async () => {
    const source = `${P} contract T { ${ARRAY} event Tick(int i);
        function f(bytes b, int k, int n) external returns (int) { ${READ_AND_LOOP}
          for (int i = 0; i < n; i++) { emit Tick(i); } seen = v; return v; } }`;
    const { s, fn, master, band, sent } = await callBesideReadAndLoop(source, (b) => [b, 2n, 2n]);
    expect(fn.runtimeLoopEvents?.length).toBe(1);
    // The events are the immutable NFTs, at the indexes the covenant checks: past the side-cars and the chunk.
    const events = sent.transaction.outputs
      .map((output, index) => (output.token?.nft?.capability === 'none' ? index : -1)).filter((index) => index >= 0);
    expect(events).toEqual([band + 3, band + 4]);
    // The two events' records swapped: refused by the master.
    const first = sent.transaction.outputs[band + 3]!;
    const second = sent.transaction.outputs[band + 4]!;
    const swapped = withOutput(withOutput(sent, band + 3, () => second), band + 4, () => first);
    expect(inputPasses(s.provider, swapped, master)).toBe(false);
  });

  it('refuses by name, before sending, a call of another contract beside the side-cars and the chunks', async () => {
    const source = `${P} interface IU { function g(int x) external returns (int); }
      contract U { int calls; function g(int x) external returns (int) { calls = calls + 1; return x * 2; } }
      contract T { int n; ${ARRAY}
        function f(IU u, bytes b, int k) external returns (bool) { ${READ_AND_LOOP} n = u.g(k); seen = v;
          return true; } }`;
    const s = setup();
    const u = await s.deploy(compileString(source, compileOptions('U')));
    const artifact = compileString(source, compileOptions('T'));
    const fn = artifact.abi.find((entry) => entry.name === 'f')!;
    expect(fn.keccakLoopReads).toBe(true);
    expect(fn.dynamicReads).toEqual(['a']);
    expect(fn.externalCalls?.length).toBe(1);
    const t = await s.deploy(artifact);
    const wallet = await s.wallet(6);
    await (t.contract.connect(wallet) as any).call.put(5n).send();
    const lock = keccakComputeLockingBytecode(hexToBin(t.categoryId).slice().reverse(), true);
    for (const index of [0, 1]) {
      await s.provider.seedUtxo(binToHex(lock), computeSideCarStandIn('keccak-loop-read-call', lock, index));
    }
    const before = s.sent.length;
    await expect((t.contract.connect(wallet) as any).call.f(addressToLockScript(u.contract.address),
      Uint8Array.of(3), 2n).withExternalCall(u.contract).emitReturn().send())
      .rejects.toThrow(new RegExp('The call of T\\.f cannot be laid out: its keccak256 loop reads side-car k at '
        + 'master \\+ blockSize \\+ k, the chunks of dynamic state it only reads would follow the side-cars, and the '
        + 'SDK lays out the blocks of the contracts it calls beside no such run'));
    expect(s.sent.length).toBe(before);
  });
});
