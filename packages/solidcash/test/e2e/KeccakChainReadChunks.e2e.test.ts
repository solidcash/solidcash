/**
 * A direct call of a function that hashes an unbounded parameter in a keccak256 chain and reads dynamic state it does not
 * write. The chain reads its FINAL side-car from the input master + blockSize + n/136, after one START/CONT side-car per
 * full 136-byte block, and each step takes its state from the input before it; the function finds the chunks it reads
 * through its `__internal__dynamicChunkInputBase` witness. So the side-cars open the band after the block and the chunks
 * follow them, each coin recreated at its own index. The sent transaction is checked by the VM, and each tamper case
 * changes one part of it and expects the covenant that binds that part to refuse.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import { keccak_256 as keccak } from '@noble/hashes/sha3.js';
import { keccakChainLockingBytecode } from '@solidcash/utils';
import type { Artifact } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { SignatureTemplate, Signer } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { getDynamicChunkAddress } from '../../src/stateful/covenant-helpers.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { addressToLockScript, solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';
import type { DeployResult } from '../../src/stateful/stateful-lifecycle-types.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const P = 'pragma solidcash ^0.52.0;';
const compileOptions = (primary: string): never => ({
  deployer: true, genesisCalls: true, messageBus: false, primaryContractName: primary,
}) as never;

let serial = 0xc4a0;
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

describe('a direct call whose keccak256 chain reads dynamic state it does not write', () => {
  // The function reads its array before it hashes.
  const SOURCE = `${P} contract T { int[] a; bytes32 h; int seen; function put(int x) public { a.push(x); }
      function f(bytes b) external returns (int) { int v = a[0]; h = keccak256(b); seen = v; return v; } }`;

  it('lays out the chunks after the chain\'s side-cars, and refuses another digest or FINAL moved into the chunks',
    async () => {
      const s = setup();
      const artifact = compileString(SOURCE, compileOptions('T'));
      const fn = artifact.abi.find((entry) => entry.name === 'f')!;
      expect(fn.keccakChainReads).toBe(true);
      expect(fn.keccakLoopReads ?? false).toBe(false);
      expect(fn.dynamicReads).toEqual(['a']);
      expect(fn.dynamicWrites ?? []).toEqual([]);
      const t = await s.deploy(artifact);
      const wallet = await s.wallet(6);
      await (t.contract.connect(wallet) as any).call.put(5n).send();
      await (t.contract.connect(wallet) as any).call.put(7n).send();
      // 300 bytes: a START and a CONT side-car for its two full 136-byte blocks, then FINAL, each a coin under the
      // contract's own brand (every step shares one lock).
      const { computeSideCarStandIn } = await import('../../src/stateful/stateful-abi-resolve.js');
      const chainLock = keccakChainLockingBytecode(hexToBin(t.categoryId).slice().reverse(), 'final', true);
      for (const index of [0, 1, 2]) {
        await s.provider.seedUtxo(binToHex(chainLock), computeSideCarStandIn('keccak-chain-direct-read', chainLock, index));
      }
      const b = Uint8Array.from({ length: 300 }, (_, index) => (index * 13 + 7) & 0xff);
      await (t.contract.connect(wallet) as any).call.f(b).send();
      const sent = s.sent[s.sent.length - 1]!;
      expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
      expect(await t.contract.getState()).toMatchObject({ seen: 5n });
      expect(binToHex(((await t.contract.getState()) as { h?: Uint8Array }).h!)).toBe(binToHex(keccak(b)));

      // The block, then START, CONT and FINAL, then the array's chunk, each recreated at its own index: FINAL with the
      // digest, the chunk as it was.
      const master = inputAt(sent, addressToLockScript(t.contract.address));
      const band = master + fn.blockLayout!.blockSize;
      expect(inputsAt(sent, chainLock)).toEqual([band, band + 1, band + 2]);
      expect(outputsAt(sent, chainLock)).toEqual([band, band + 1, band + 2]);
      expect(binToHex(sent.transaction.outputs[band + 2]!.token!.nft!.commitment)).toBe(binToHex(keccak(b)));
      const chunkLock = addressToLockScript(getDynamicChunkAddress(
        t.contract.inner as never, t.categoryId, 'a', 'int256[]',
      ));
      expect(inputsAt(sent, chunkLock)).toEqual([band + 3]);
      expect(outputsAt(sent, chunkLock)).toEqual([band + 3]);
      expect(binToHex(sent.transaction.outputs[band + 3]!.token!.nft!.commitment))
        .toBe(binToHex(sent.sourceOutputs[band + 3].token.nft.commitment));
      // Another digest in FINAL's recreation: refused by FINAL and by the master, which reads it.
      const forged = withOutput(sent, band + 2, bumpCommitment);
      expect(inputPasses(s.provider, forged, band + 2)).toBe(false);
      expect(inputPasses(s.provider, forged, master)).toBe(false);
      // FINAL moved into the chunk run, the chunk into the chain's: refused by the master, whose chain read and array
      // read each meet the other's coin.
      expect(inputPasses(s.provider, swapIndexes(sent, band + 2, band + 3), master)).toBe(false);
    });
});
