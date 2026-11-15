/**
 * A sorted-mapping loop that emits an event every turn.
 *
 * The compiler runs such a loop through a permutation of its own, so its entries settle in slot order while its events
 * keep the source order. The covenant reads the event stream from past the complete fixed block and the entry band the
 * loop writes, and a plain call compacts that entry band into the block's inactive returnEvent slot, which leaves the
 * slot between the entries and the events. The SDK appended the events right after the entries, one output before
 * the covenant reads them, so every call failed preflight at input 0 (OP_VERIFY), even one update of one key. It now
 * pads the slot there, at the coordinate it already computed for the stream. Each call is checked with stock libauth's
 * standard VM under the production profile, honest and tampered, on the direct convention and the default one.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, bigIntToVmNumber, createVirtualMachineBch2026, decodeTransaction, encodeLockingBytecodeP2pkh, hexToBin,
  lockingBytecodeToCashAddress, vmNumberToBigInt,
} from '@bitauth/libauth';
import { compileString as compileDefault } from '@solidcash/solidc';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { SignatureTemplate, Signer } from '../../src/index.js';
import {
  StatefulContract, SortedList, bytesToSlotValue, getEntryNftAddress, keyToSlot,
} from '../../src/stateful/index.js';
import { solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { compileString as compileDirect } from '../direct-compile.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';

const vm = createVirtualMachineBch2026(true);
const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
const alice = new SignatureTemplate(alicePriv);

type Spend = { transaction: any; sourceOutputs: any[] };

/** Records every broadcast with the coins it spends, read from the ledger while they are still live. */
function captureBroadcasts(provider: MockNetworkProvider): Spend[] {
  const captured: Spend[] = [];
  const inner = provider.sendRawTransaction.bind(provider);
  provider.sendRawTransaction = async (hex: string) => {
    const transaction = decodeTransaction(hexToBin(hex));
    if (typeof transaction === 'string') throw new Error(transaction);
    const sourceOutputs = await Promise.all(transaction.inputs.map(async (input) => {
      const spent = await provider.getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex);
      if (spent === undefined) throw new Error('a spent coin is not on the ledger');
      return solidCashOutputToLibauthOutput({
        to: spent.lockingBytecode, amount: spent.satoshis, ...(spent.token === undefined ? {} : { token: spent.token }),
      });
    }));
    const txid = await inner(hex);
    captured.push({ transaction, sourceOutputs });
    return txid;
  };
  return captured;
}

/** Signs the wallet's P2PKH inputs again, as a builder signs its own transaction, and asks the standard VM. */
function verify(spend: Spend): true | string {
  const copy: Spend = structuredClone(spend);
  copy.transaction.inputs.forEach((_input: unknown, inputIndex: number) => {
    if (binToHex(copy.sourceOutputs[inputIndex].lockingBytecode) !== binToHex(aliceLock)) return;
    copy.transaction.inputs[inputIndex].unlockingBytecode = alice.unlockP2PKH().generateUnlockingBytecode({
      transaction: copy.transaction, sourceOutputs: copy.sourceOutputs, inputIndex,
    });
  });
  return vm.verify(copy as never) as true | string;
}

/** The outputs of a capability: 'none' marks an event, 'mutable' an entry. */
const outputsOf = (spend: Spend, capability: string): number[] => spend.transaction.outputs
  .map((output: any, index: number) => (output.token?.nft?.capability === capability ? index : -1))
  .filter((index: number) => index >= 0);

interface Book {
  /** Sends a call as alice and checks the transaction it broadcast with the VM; returns the events and the spend. */
  call: (fn: string, ...args: unknown[]) => Promise<{ events: string[]; spend: Spend }>;
  /** An entry's value, or undefined while the key has no entry. */
  bal: (key: bigint) => Promise<bigint | undefined>;
}

type Compile = (source: string) => any;
const conventions: Array<[string, Compile]> = [
  ['the direct convention', (source) => compileDirect(source, { suppressWarnings: true } as never)],
  ['the default convention', (source) => compileDefault(source, { suppressWarnings: true } as never)],
];

let seed = 0x6b0;
async function setup(source: string, compile: Compile): Promise<Book> {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const captured = captureBroadcasts(provider);
  const change = lockingBytecodeToCashAddress({ bytecode: aliceLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const artifact = compile(source);
  const coin = (): Utxo => { seed += 1; return { txid: seed.toString(16).padStart(64, '0'), vout: 0, satoshis: 400_000n }; };
  const funding = coin();
  await provider.seedUtxo(binToHex(aliceLock), funding);
  const { contract, categoryId } = await StatefulContract.deploy(artifact, [], {
    provider, fundingUtxo: funding, funder: alice.unlockP2PKH(), initialState: {}, changeAddress: change.address,
    senderLockingBytecode: aliceLock,
  } as never);
  for (let i = 0; i < 8; i += 1) await provider.seedUtxo(binToHex(aliceLock), coin());
  const signed = contract.connect(new Signer(alicePriv, provider)) as unknown as Record<string, any>;
  const entries = getEntryNftAddress(contract.inner, categoryId, 'bal');
  return {
    call: async (fn, ...args) => {
      const before = captured.length;
      const result = await signed[fn](...args).send();
      expect(captured.length).toBe(before + 1);
      const spend = captured[captured.length - 1]!;
      expect(verify(spend)).toBe(true);
      return { events: (result.events ?? []).map((event: any) => `${event.args.k}:${event.args.v}`), spend };
    },
    bal: async (key) => {
      const entry = SortedList.fromUtxos(await provider.getUtxos(entries)).find(keyToSlot(bigIntToVmNumber(key)));
      return entry ? vmNumberToBigInt(entry.value, { requireMinimalEncoding: false }) as bigint : undefined;
    },
  };
}

// Three int keys by slot. Passed as [HI, MID, LO] the keys run against the slot order the entries settle in.
const slotOf = (key: bigint): bigint => bytesToSlotValue(keyToSlot(bigIntToVmNumber(key)));
const [LO, MID, HI] = [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n].sort((a, b) => (slotOf(a) < slotOf(b) ? -1 : 1));
const book = (body: string): string => `contract Book() { mapping(int => int) bal; event Seen(int k, int v);
  function seed(int a, int v) { this.bal[a] = v; }
  function put(int[] ks, int[] vs) { for (int i = 0; i < ks.length; i++) { ${body} } } }`;
const STORE = 'this.bal[ks[i]] = vs[i]; emit Seen(ks[i], i);';
const CREDIT = 'this.bal[ks[i]] += vs[i]; emit Seen(ks[i], i);';

describe.each(conventions)('a sorted-mapping loop that emits an event every turn, on %s', (_label, compile) => {
  it('stores and logs one update and one insert', async () => {
    const loop = await setup(book(STORE), compile);
    await loop.call('seed', MID, 5n);
    expect((await loop.call('put', [MID], [9n])).events).toStrictEqual([`${MID}:0`]);
    expect(await loop.bal(MID)).toBe(9n);
    expect((await loop.call('put', [HI], [7n])).events).toStrictEqual([`${HI}:0`]);
    expect([await loop.bal(MID), await loop.bal(HI)]).toStrictEqual([9n, 7n]);
  }, 600_000);

  it('settles distinct keys given against the slot order, and logs them in the order given', async () => {
    const loop = await setup(book(STORE), compile);
    await loop.call('seed', MID, 5n);
    const { events } = await loop.call('put', [HI, MID, LO], [1n, 2n, 3n]);
    expect(events).toStrictEqual([`${HI}:0`, `${MID}:1`, `${LO}:2`]);
    expect([await loop.bal(HI), await loop.bal(MID), await loop.bal(LO)]).toStrictEqual([1n, 2n, 3n]);
    // A repeated key runs every turn: the last value stays and each turn logs.
    expect((await loop.call('put', [LO, LO], [4n, 6n])).events).toStrictEqual([`${LO}:0`, `${LO}:1`]);
    expect(await loop.bal(LO)).toBe(6n);
  }, 600_000);

  it('credits each key by its own amount and logs every turn', async () => {
    const loop = await setup(book(CREDIT), compile);
    await loop.call('seed', MID, 5n);
    expect((await loop.call('put', [MID], [9n])).events).toStrictEqual([`${MID}:0`]);
    expect(await loop.bal(MID)).toBe(14n);
    const { events } = await loop.call('put', [HI, MID, LO], [1n, 2n, 3n]);
    expect(events).toStrictEqual([`${HI}:0`, `${MID}:1`, `${LO}:2`]);
    expect([await loop.bal(HI), await loop.bal(MID), await loop.bal(LO)]).toStrictEqual([1n, 16n, 3n]);
    // A repeated key credits every turn.
    expect((await loop.call('put', [LO, LO], [4n, 6n])).events).toStrictEqual([`${LO}:0`, `${LO}:1`]);
    expect(await loop.bal(LO)).toBe(13n);
  }, 600_000);

  it('stores another entry plus one where each turn also logs, as the EVM does', async () => {
    // The turn's read of entry 7 is an operand of its own, not the old value of the entry the turn writes.
    const loop = await setup(book('this.bal[ks[i]] = this.bal[7] + 1; emit Seen(ks[i], i);'), compile);
    await loop.call('seed', 3n, 5n);
    await loop.call('seed', 7n, 50n);
    expect((await loop.call('put', [3n, 4n], [0n, 0n])).events).toStrictEqual(['3:0', '4:1']);
    expect([await loop.bal(3n), await loop.bal(4n), await loop.bal(7n)]).toStrictEqual([51n, 51n, 50n]);
  }, 600_000);

  it('refuses a changed event, events in another order, and a changed entry', async () => {
    const loop = await setup(book(STORE), compile);
    await loop.call('seed', MID, 5n);
    const { spend } = await loop.call('put', [HI, MID, LO], [1n, 2n, 3n]);
    const events = outputsOf(spend, 'none');
    const entries = outputsOf(spend, 'mutable');
    expect(events).toHaveLength(3);
    const commitment = (output: number): Uint8Array => spend.transaction.outputs[output].token.nft.commitment;
    const forge = (change: (forged: Spend) => void): Spend => {
      const forged: Spend = structuredClone(spend);
      change(forged);
      return forged;
    };
    // One event's payload carries another turn's index.
    expect(verify(forge((forged) => {
      forged.transaction.outputs[events[0]!].token.nft.commitment = commitment(events[1]!);
    }))).not.toBe(true);
    // The first two events swapped: each record still sits at an event output, in another order.
    expect(verify(forge((forged) => {
      forged.transaction.outputs[events[0]!].token.nft.commitment = commitment(events[1]!);
      forged.transaction.outputs[events[1]!].token.nft.commitment = commitment(events[0]!);
    }))).not.toBe(true);
    // An entry that stores another value: its last commitment byte is the value tail.
    for (const entry of entries) {
      expect(verify(forge((forged) => {
        const bytes = Uint8Array.from(commitment(entry));
        bytes[bytes.length - 1] ^= 0x08;
        forged.transaction.outputs[entry].token.nft.commitment = bytes;
      }))).not.toBe(true);
    }
  }, 600_000);
});
