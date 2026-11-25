/**
 * A direct call of a function that hashes in a keccak256 loop or chain and writes one key of a sorted mapping, with and
 * without dynamic state it only reads.
 *
 * A fixed write of a sorted mapping is a sorted batch: its target node is checked at the output of its entry slot, in the
 * block, and the predecessor it spends and rewrites (P') is found through its `__internal__vmapBatchProof_N` and
 * `__internal__vmapBatchPredOut_N` witnesses. So the side-cars still open the band after the block (the loop reads
 * side-car k at master + blockSize + k, the chain its FINAL side-car at master + blockSize + n/136), the chunks the
 * function only reads follow them, and P' follows both. The empty map's HEAD is the predecessor of the key written.
 * Each sent transaction is checked by the VM, and each tamper case changes one part of it and expects the covenant that
 * binds that part to refuse; a later call reads the written key.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import { keccak_256 as keccak } from '@noble/hashes/sha3.js';
import { keccakChainLockingBytecode, keccakComputeLockingBytecode } from '@solidcash/utils';
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

let serial = 0xc6a0;
const nextTxid = (): string => (serial++).toString(16).padStart(64, '0');

type Sent = { transaction: ReturnType<typeof decodeTransactionUnsafe>; sourceOutputs: any[] };

interface Setup {
  provider: MockNetworkProvider;
  deploy(artifact: Artifact): Promise<DeployResult<Artifact>>;
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
  const deploy = async (artifact: Artifact): Promise<DeployResult<Artifact>> => {
    const fundingUtxo: Utxo = { txid: nextTxid(), vout: 0, satoshis: 2_000_000n };
    await provider.seedUtxo(binToHex(authorLock), fundingUtxo);
    return StatefulContract.deploy(artifact, [] as never, {
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

const LOOP = 'bytes32 x = 0x; for (int i = 0; i < k; i++) { x = keccak256(b); } h = x;';
const ARRAY = 'int[] a; int seen; function put(int x) public { a.push(x); }';
const CHECK = 'function check(int key) public view { require(values[key] == 1); }';

interface Shape {
  /** The source, whose entry `f` hashes, writes `values[key] = 1` and, with `reads`, reads `a[0]`. */
  source: string;
  /** Whether `f` hashes in a chain (a 300-byte parameter: START, CONT and FINAL) rather than a 2-turn loop. */
  chain: boolean;
  reads: boolean;
  args: (b: Uint8Array) => unknown[];
}

/**
 * Deploy T, push 5 and 7 onto `a` when the function reads it (one chunk), seed T's side-cars, call `f` and check:
 * - the sent transaction passes the VM, and the state holds the digest (and a[0]);
 * - the side-cars open the band after the block, each recreated at its own index, the last with the digest; the chunk
 *   follows them, recreated as it was; the HEAD is spent at the entry slot, which takes the new node, and its rewrite
 *   P' follows the side-cars and the chunk, with HEAD's own slot;
 * - another P' is refused by the master, and so is the last side-car swapped with the chunk;
 * - a later call reads the written key as 1.
 */
async function callBesideBatch(shape: Shape): Promise<void> {
  const s = setup();
  const artifact = compileString(shape.source, compileOptions('T'));
  const fn = artifact.abi.find((entry) => entry.name === 'f')!;
  expect(shape.chain ? fn.keccakChainReads : fn.keccakLoopReads).toBe(true);
  expect(fn.sortedBatchInfo?.map((batch) => batch.collection)).toEqual(['values']);
  expect(fn.dynamicReads ?? []).toEqual(shape.reads ? ['a'] : []);
  const t = await s.deploy(artifact);
  const wallet = await s.wallet(6);
  if (shape.reads) {
    await (t.contract.connect(wallet) as any).call.put(5n).send();
    await (t.contract.connect(wallet) as any).call.put(7n).send();
  }
  const salt = hexToBin(t.categoryId).slice().reverse();
  const lock = shape.chain ? keccakChainLockingBytecode(salt, 'final', true) : keccakComputeLockingBytecode(salt, true);
  const sideCarCount = shape.chain ? 3 : 2;
  for (let index = 0; index < sideCarCount; index += 1) {
    await s.provider.seedUtxo(binToHex(lock), computeSideCarStandIn('keccak-beside-batch', lock, index));
  }
  const b = shape.chain
    ? Uint8Array.from({ length: 300 }, (_, index) => (index * 13 + 7) & 0xff) : Uint8Array.of(8, 9);
  await (t.contract.connect(wallet) as any).call.f(...shape.args(b)).send();
  const sent = s.sent[s.sent.length - 1]!;
  expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
  expect(binToHex(((await t.contract.getState()) as { h?: Uint8Array }).h!)).toBe(binToHex(keccak(b)));
  if (shape.reads) expect(await t.contract.getState()).toMatchObject({ seen: 5n });

  const master = inputAt(sent, addressToLockScript(t.contract.address));
  const band = master + fn.blockLayout!.blockSize;
  const sideCars = Array.from({ length: sideCarCount }, (_, index) => band + index);
  expect(inputsAt(sent, lock)).toEqual(sideCars);
  expect(outputsAt(sent, lock)).toEqual(sideCars);
  expect(binToHex(sent.transaction.outputs[band + sideCarCount - 1]!.token!.nft!.commitment)).toBe(binToHex(keccak(b)));
  let next = band + sideCarCount;
  if (shape.reads) {
    const chunkLock = addressToLockScript(getDynamicChunkAddress(t.contract.inner as never, t.categoryId, 'a', 'int256[]'));
    expect(inputsAt(sent, chunkLock)).toEqual([next]);
    expect(outputsAt(sent, chunkLock)).toEqual([next]);
    expect(binToHex(sent.transaction.outputs[next]!.token!.nft!.commitment))
      .toBe(binToHex(sent.sourceOutputs[next].token.nft.commitment));
    // The last side-car moved into the chunk run, the chunk into the side-cars': refused by the master.
    expect(inputPasses(s.provider, swapIndexes(sent, next - 1, next), master)).toBe(false);
    next += 1;
  }
  // The new node at the entry slot's output, HEAD spent at its input, and P' (HEAD re-pointed) after the band.
  const entrySlot = master + fn.blockLayout!.slots.find((slot) => slot.kind === 'entry')!.offset;
  const entryLock = sent.transaction.outputs[entrySlot]!.lockingBytecode;
  expect(inputsAt(sent, entryLock)).toEqual([entrySlot]);
  expect(outputsAt(sent, entryLock)).toEqual([entrySlot, next]);
  expect(binToHex(sent.transaction.outputs[next]!.token!.nft!.commitment).slice(0, 64))
    .toBe(binToHex(sent.sourceOutputs[entrySlot].token.nft.commitment).slice(0, 64));
  // Another P': refused by the master.
  expect(inputPasses(s.provider, withOutput(sent, next, bumpCommitment), master)).toBe(false);
  const before = s.sent.length;
  await (t.contract.connect(wallet) as any).call.check(7n).send();
  expect(s.sent.length).toBe(before + 1);
}

describe('a direct call whose keccak256 side-cars sit beside a fixed write of a sorted mapping', () => {
  it('lays out a loop\'s side-cars, then the rewritten predecessor, when the write runs after the loop', async () => {
    await callBesideBatch({
      source: `${P} contract T { bytes32 h; mapping(int => int) values; ${CHECK}
        function f(bytes b, int k, int key) external returns (bool) { ${LOOP} this.values[key] = 1; return true; } }`,
      chain: false, reads: false, args: (b) => [b, 2n, 7n],
    });
  });

  it('lays out a chain\'s side-cars, then the rewritten predecessor, the write running first', async () => {
    await callBesideBatch({
      source: `${P} contract T { bytes32 h; mapping(int => int) values; ${CHECK}
        function f(bytes b, int key) external returns (bool) { this.values[key] = 1; h = keccak256(b); return true; } }`,
      chain: true, reads: false, args: (b) => [b, 7n],
    });
  });

  it('lays out a loop\'s side-cars, the chunk it reads, then the rewritten predecessor', async () => {
    await callBesideBatch({
      source: `${P} contract T { ${ARRAY} bytes32 h; mapping(int => int) values; ${CHECK}
        function f(bytes b, int k, int key) external returns (int) { int v = a[0]; ${LOOP} this.values[key] = 1;
          seen = v; return v; } }`,
      chain: false, reads: true, args: (b) => [b, 2n, 7n],
    });
  });

  it('lays out a chain\'s side-cars, the chunk it reads, then the rewritten predecessor', async () => {
    await callBesideBatch({
      source: `${P} contract T { ${ARRAY} bytes32 h; mapping(int => int) values; ${CHECK}
        function f(bytes b, int key) external returns (int) { int v = a[0]; this.values[key] = 1; h = keccak256(b);
          seen = v; return v; } }`,
      chain: true, reads: true, args: (b) => [b, 7n],
    });
  });
});
