/**
 * A14 item 6, A4.4: Deploy<C>'s own side-cars at a top-level deployment sit at the side-car base in the order of
 * `create`'s side-car slots, and a 2-way recovery's middle slot takes a wallet coin. The production-profile mock mints
 * nothing on request, and here no coin may be seeded once the deployment starts, so every input is a coin a real network
 * would hold.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { computeSideCarStandIn } from '../../src/stateful/stateful-abi-resolve.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const P = 'pragma solidcash ^0.51.0;';
const SOURCE = `${P} contract C(bytes32 hh, int v, bytes32 r, bytes32 s, pubkey expected) { bytes32 h; int n;
  constructor(bytes b) { h = keccak256(b); require(ecrecoverPubKey(hh, v, r, s) == expected); n = 1; } }`;

describe('Deploy<C> side-cars at a top-level deployment (A4.4, A14 item 6)', () => {
  it('follows create\'s slot order and fills the middle slot with a wallet coin, minting nothing', async () => {
    const { ethers } = await import('ethers');
    const { keccak_256: keccak } = await import('@noble/hashes/sha3.js');
    const { ecrecoverComputeLockingBytecode, keccakComputeLockingBytecode } = await import('@solidcash/utils');
    const provider = new MockNetworkProvider({ profile: 'production' });
    expect((provider as { addUtxo?: unknown }).addUtxo).toBeUndefined();
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const artifact = compileString(SOURCE, { deployer: true, messageBus: false });
    const slots = artifact.deployer!.abi.find((entry) => entry.name === 'create')!.blockLayout!.slots
      .filter((slot) => slot.kind === 'keccakSideCar' || slot.kind === 'ecrecoverSideCar')
      .sort((left, right) => left.offset - right.offset).map((slot) => slot.kind);
    // The keccak side-car is create's first side-car slot, then the recovery's A, M and B.
    expect(slots).toEqual(['keccakSideCar', 'ecrecoverSideCar', 'ecrecoverSideCar', 'ecrecoverSideCar']);

    const salt = new Uint8Array(32);
    const keccakLock = keccakComputeLockingBytecode(salt, true);
    await provider.seedUtxo(binToHex(keccakLock), computeSideCarStandIn('deployer-sidecar-order', keccakLock, 0));
    const roles = ['A', 'B2', 'M', 'B3'] as const;
    for (const [index, role] of roles.entries()) {
      await provider.seedUtxo(binToHex(ecrecoverComputeLockingBytecode(salt, role)), {
        txid: `${(0xc0 + index).toString(16)}`.repeat(2).padEnd(64, '0'), vout: 0, satoshis: 100_000n,
        token: { category: 'ed'.repeat(31) + '14', amount: 0n, nft: { capability: 'mutable', commitment: '' } },
      });
    }
    const fundingUtxo: Utxo = { txid: '6d'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.seedUtxo(binToHex(authorLock), fundingUtxo);
    // From here on nothing may put a coin on the ledger but a broadcast transaction.
    (provider as any).seedUtxo = async (): Promise<never> => {
      throw new Error('a coin was minted for the deployment');
    };
    const captured: Array<{ transaction: ReturnType<typeof decodeTransactionUnsafe>; sourceOutputs: any[] }> = [];
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
      captured.push({ transaction, sourceOutputs });
      return original(hex);
    };

    const wallet = new ethers.Wallet(`0x${'55'.repeat(32)}`);
    const message = 'deployer-sidecar-order';
    const parsed = ethers.Signature.from(await wallet.signMessage(message));
    const little = (hex: string): Uint8Array => Uint8Array.from(hexToBin(hex.replace(/^0x/, ''))).reverse();
    const b = Uint8Array.from([9, 8, 7, 6]);
    const result = await StatefulContract.deploy(artifact, [
      little(ethers.hashMessage(message)), BigInt(parsed.v), little(parsed.r), little(parsed.s),
      hexToBin(wallet.signingKey.compressedPublicKey.replace(/^0x/, '')),
    ], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      changeAddress: change.address, senderLockingBytecode: authorLock, initArgs: [b],
    } as never);
    const state = (await result.contract.getState()) as { h?: Uint8Array; n?: bigint };
    expect(state.n).toBe(1n);
    expect(binToHex(state.h!)).toBe(binToHex(keccak(b)));

    const creation = captured.find(({ sourceOutputs }) => sourceOutputs.some((output) => (
      binToHex(output.lockingBytecode) === artifact.deployer!.lockingBytecode)))!;
    expect(creation).toBeDefined();
    const lockAt = (index: number): string => binToHex(creation.transaction.outputs[index]!.lockingBytecode);
    const spentAt = (index: number): string => binToHex(creation.sourceOutputs[index]!.lockingBytecode);
    // Inputs 0 and 1 are the deployer and author coins; output 0 is the identity and output 1 the change, so the
    // side-car base is 2: keccak, then the recovery's A, a wallet coin beside the OP_1 filler, and B.
    expect(spentAt(2)).toBe(binToHex(keccakLock));
    expect(lockAt(2)).toBe(binToHex(keccakLock));
    expect(spentAt(3)).toBe(binToHex(ecrecoverComputeLockingBytecode(salt, 'A')));
    expect(spentAt(4)).toBe(binToHex(authorLock));
    expect(lockAt(4)).toBe('51');
    expect(spentAt(5)).toBe(binToHex(ecrecoverComputeLockingBytecode(salt, 'B2')));
    // Every input is the deployer coin, a wallet coin or a coin of the shared pool.
    const known = new Set([
      artifact.deployer!.lockingBytecode, binToHex(authorLock), binToHex(keccakLock),
      ...roles.map((role) => binToHex(ecrecoverComputeLockingBytecode(salt, role))),
    ]);
    expect(creation.sourceOutputs.every((output) => known.has(binToHex(output.lockingBytecode)))).toBe(true);

    const vm = createVirtualMachineBch2026ForProvider(provider);
    expect(vm.verify(creation as never)).toBe(true);
    // The order is what create reads: with the keccak side-car and the recovery's A swapped, `create` refuses.
    const swap = <T>(items: readonly T[]): T[] => items.map((item, index) => (
      index === 2 ? items[3]! : index === 3 ? items[2]! : item));
    const swapped = {
      sourceOutputs: swap(creation.sourceOutputs),
      transaction: {
        ...creation.transaction,
        inputs: swap(creation.transaction.inputs),
        outputs: swap(creation.transaction.outputs),
      },
    };
    const run = vm.evaluate({ ...swapped, inputIndex: 0 } as never);
    expect(vm.stateSuccess(run as never)).not.toBe(true);
  }, 300_000);
});
