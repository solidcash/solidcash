import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeAuthenticationInstructions, decodeTransactionUnsafe, encodeAuthenticationInstructions,
  encodeTransaction, hexToBin, utf8ToBin, type Output, type TransactionCommon,
} from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import {
  SignatureTemplate, Signer, SortedList, getContractFactory, getEntryNftAddress, keyToSlotMulti, upgrades,
} from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { alicePriv } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

/**
 * A direct delegate executor spends the proxy's entries after its own co-spent implementation block. The checks an
 * entry's presence gates (a guarded delete's rewrite, a guarded batch's transition, a read-only entry's
 * preservation) must look for it there: read beside the proxy master, they find another input and are skipped.
 */
const NOTES = `pragma solidcash >=0.8.0;
contract Notes() {
  int count;
  mapping(string => string) notes;
  function initialize() public delegate {
    this.notes["k1"] = "alpha"; this.notes["k2"] = "bravo"; this.notes["k3"] = "delta"; this.count = 0;
  }
  function removeIf(string key) public delegate { if (bytes(this.notes[key]).length != 0) { delete this.notes[key]; } }
  function removeBothIf(string a, string b) public delegate {
    if (bytes(this.notes[a]).length != 0) { delete this.notes[a]; delete this.notes[b]; }
  }
  function check(string key) public delegate { require(bytes(this.notes[key]).length != 0); this.count = this.count + 1; }
}`;

const DIRECT_NOTES = `pragma solidcash >=0.8.0;
contract Notes() {
  mapping(string => string) notes;
  function seed() public { this.notes["k1"] = "alpha"; this.notes["k2"] = "bravo"; }
  function removeIf(string key) public { if (bytes(this.notes[key]).length != 0) { delete this.notes[key]; } }
}`;

const DELETED = '00000000';

type Call = { send(): Promise<unknown> };
type Calls = Record<string, (...args: unknown[]) => Call>;
type StateHandle = { inner: { withCategory(category: Uint8Array): unknown }; categoryId: string };
type Network = { sendRawTransaction(hex: string): Promise<string>; getRawTransaction(txid: string): Promise<string> };

/** Builds, captures and replays transactions against one funded mock network, re-signing the funder. */
async function harness(): Promise<{
  provider: ReturnType<typeof createTestProvider>;
  signer: Signer;
  capture(run: () => Promise<unknown>): Promise<string>;
  replay(tx: TransactionCommon): Promise<string>;
  send(hex: string): Promise<string>;
  entryInput(tx: TransactionCommon, key: string): Promise<number>;
}> {
  const provider = createTestProvider();
  const signer = new Signer(alicePriv, provider);
  for (const seed of Array.from({ length: 24 }, (_unused, index) => (index + 1).toString(16).padStart(2, '0'))) {
    await provider.addUtxo(signer.getAddress(), { txid: seed.repeat(32), vout: 0, satoshis: 1_000_000n });
  }
  const network = provider as unknown as Network;
  const send = network.sendRawTransaction.bind(network);
  const signerLock = addressToLockScript(signer.getAddress());
  const sourceOutputs = async (tx: TransactionCommon): Promise<Output[]> => Promise.all(tx.inputs.map(async (input) => {
    const txid = binToHex(input.outpointTransactionHash);
    try {
      return decodeTransactionUnsafe(hexToBin(await network.getRawTransaction(txid))).outputs[input.outpointIndex]!;
    } catch {
      const utxo = (await provider.getUtxos(signer.getAddress()))
        .find((candidate) => candidate.txid === txid && candidate.vout === input.outpointIndex)!;
      return { lockingBytecode: signerLock, valueSatoshis: utxo.satoshis };
    }
  }));
  return {
    provider,
    signer,
    async capture(run): Promise<string> {
      let captured = '';
      network.sendRawTransaction = async (hex: string): Promise<string> => {
        captured = hex;
        throw new Error('capture-only');
      };
      await expect(run()).rejects.toThrow('capture-only');
      network.sendRawTransaction = send;
      return captured;
    },
    // A changed transaction is re-signed, so its refusal can only come from a covenant.
    async replay(tx): Promise<string> {
      const outputs = await sourceOutputs(tx);
      const unlocker = new SignatureTemplate(alicePriv).unlockP2PKH();
      outputs.forEach((output, inputIndex) => {
        if (binToHex(output.lockingBytecode) !== binToHex(signerLock)) return;
        tx.inputs[inputIndex]!.unlockingBytecode = unlocker.generateUnlockingBytecode({
          transaction: tx as never, sourceOutputs: outputs as never, inputIndex,
        });
      });
      return send(binToHex(encodeTransaction(tx))).then(() => 'settled', (error: Error) => error.message);
    },
    send,
    async entryInput(tx, key): Promise<number> {
      const slot = binToHex(keyToSlotMulti([utf8ToBin(key)]));
      return (await sourceOutputs(tx)).findIndex((output) => output.token?.nft !== undefined
        && binToHex(output.token.nft.commitment.slice(0, 32)) === slot);
    },
  };
}

const slotOf = (key: string): string => binToHex(keyToSlotMulti([utf8ToBin(key)]));
const entryOutput = (tx: TransactionCommon, key: string): number => tx.outputs.findIndex((output) =>
  output.token?.nft !== undefined && binToHex(output.token.nft.commitment.slice(0, 32)) === slotOf(key));
const frameOf = (hex: string, selector: string): number => decodeTransactionUnsafe(hexToBin(hex)).inputs
  .findIndex((input) => {
    const [first] = decodeAuthenticationInstructions(input.unlockingBytecode);
    return first !== undefined && 'data' in first && binToHex(first.data) === selector;
  });
const refusedAt = (input: number): RegExp => new RegExp(`input index ${input}: Program failed`);

async function deployNotes(): Promise<{
  h: Awaited<ReturnType<typeof harness>>;
  calls: Calls;
  selector(name: string): string;
  pushOf(name: string, input: string): number;
  stored(key: string): Promise<string>;
  storedCommitment(key: string): Promise<Uint8Array>;
}> {
  const h = await harness();
  const artifact = compileString(NOTES);
  const proxy = await upgrades.deployProxy(getContractFactory(artifact, h.signer), []) as unknown as
    Calls & { proxy: StateHandle };
  const address = getEntryNftAddress(proxy.proxy.inner.withCategory(hexToBin(proxy.proxy.categoryId)) as never,
    proxy.proxy.categoryId, 'notes');
  const nodes = async (): Promise<Awaited<ReturnType<typeof h.provider.getUtxos>>> => h.provider.getUtxos(address);
  const abi = (name: string): (typeof artifact.abi)[number] =>
    (artifact.delegateArtifact ?? artifact).abi.find((entry) => entry.name === name)!;
  return {
    h,
    calls: proxy,
    selector: (name) => abi(name).selector!,
    // The frame pushes its selector, then its arguments last-first.
    pushOf: (name, input) => abi(name).inputs.length - abi(name).inputs.findIndex((item) => item.name === input),
    async stored(key): Promise<string> {
      const entry = SortedList.fromUtxos(await nodes()).find(keyToSlotMulti([utf8ToBin(key)]));
      return entry ? binToHex(entry.value as Uint8Array) : 'absent';
    },
    async storedCommitment(key): Promise<Uint8Array> {
      const node = (await nodes()).find((utxo) => String(utxo.token?.nft?.commitment ?? '').startsWith(slotOf(key)));
      return hexToBin(String(node?.token?.nft?.commitment ?? ''));
    },
  };
}

describe('entry presence in a direct delegate executor', () => {
  it('deletes a guarded entry through a proxy, and refuses keeping it', async () => {
    const notes = await deployNotes();
    const hex = await notes.h.capture(() => notes.calls.removeIf!('k2').send());
    const frame = frameOf(hex, notes.selector('removeIf'));
    const kept = decodeTransactionUnsafe(hexToBin(hex));
    kept.outputs[entryOutput(kept, 'k2')]!.token!.nft!.commitment = await notes.storedCommitment('k2');
    await expect(notes.h.replay(kept)).resolves.toMatch(refusedAt(frame));

    await expect(notes.h.send(hex)).resolves.toBeTypeOf('string');
    await expect(notes.stored('k2')).resolves.toBe(DELETED);
    await expect(notes.stored('k1')).resolves.toBe(binToHex(Uint8Array.from([5, 0, 0, 0, ...utf8ToBin('alpha')])));
  });

  it('checks every target of a guarded batch through a proxy', async () => {
    const notes = await deployNotes();
    const hex = await notes.h.capture(() => notes.calls.removeBothIf!('k1', 'k3').send());
    const frame = frameOf(hex, notes.selector('removeBothIf'));
    for (const key of ['k1', 'k3']) {
      const kept = decodeTransactionUnsafe(hexToBin(hex));
      kept.outputs[entryOutput(kept, key)]!.token!.nft!.commitment = await notes.storedCommitment(key);
      await expect(notes.h.replay(kept)).resolves.toMatch(refusedAt(frame));
    }
    // The batch's own topology is verified too: a rows witness the outputs do not follow is refused.
    const forged = decodeTransactionUnsafe(hexToBin(hex));
    const instructions = decodeAuthenticationInstructions(forged.inputs[frame]!.unlockingBytecode);
    const rows = notes.pushOf('removeBothIf', '__internal__vmapBatchRows_notes');
    const rowsPush = instructions[rows]!;
    expect('data' in rowsPush).toBe(true);
    const data = ('data' in rowsPush ? rowsPush.data : new Uint8Array()).slice();
    data[40] ^= 1;
    instructions[rows] = { ...rowsPush, data } as never;
    forged.inputs[frame]!.unlockingBytecode = encodeAuthenticationInstructions(instructions);
    await expect(notes.h.replay(forged)).resolves.toMatch(refusedAt(frame));

    await expect(notes.h.send(hex)).resolves.toBeTypeOf('string');
    await expect(notes.stored('k1')).resolves.toBe(DELETED);
    await expect(notes.stored('k3')).resolves.toBe(DELETED);
  });

  it('keeps a read-only entry unchanged through a proxy, even on the entry\'s write path', async () => {
    const notes = await deployNotes();
    const hex = await notes.h.capture(() => notes.calls.check!('k1').send());
    const frame = frameOf(hex, notes.selector('check'));
    const writePath = async (change: (tx: TransactionCommon, output: number) => void): Promise<string> => {
      const tx = decodeTransactionUnsafe(hexToBin(hex));
      const input = await notes.h.entryInput(tx, 'k1');
      // The entry's unlocking pushes `<masterInputIndex> <flag>`: flag 1 names the co-spent proxy master and
      // lifts the entry covenant's own preservation, leaving it to the executor.
      const pushes = decodeAuthenticationInstructions(tx.inputs[input]!.unlockingBytecode);
      pushes[0] = { opcode: 0x00 };
      pushes[1] = { opcode: 0x51 };
      tx.inputs[input]!.unlockingBytecode = encodeAuthenticationInstructions(pushes);
      change(tx, entryOutput(tx, 'k1'));
      return notes.h.replay(tx);
    };
    await expect(writePath((tx, output) => {
      const commitment = tx.outputs[output]!.token!.nft!.commitment.slice();
      commitment[commitment.length - 1] ^= 1;
      tx.outputs[output]!.token!.nft!.commitment = commitment;
    })).resolves.toMatch(refusedAt(frame));
    await expect(writePath((tx, output) => { tx.outputs[output]!.valueSatoshis -= 300n; }))
      .resolves.toMatch(refusedAt(frame));

    await expect(notes.h.send(hex)).resolves.toBeTypeOf('string');
    await expect(notes.stored('k1')).resolves.toBe(binToHex(Uint8Array.from([5, 0, 0, 0, ...utf8ToBin('alpha')])));
  });

  it('deletes a guarded entry directly, and refuses keeping it (control)', async () => {
    const h = await harness();
    const artifact = compileString(DIRECT_NOTES, { forceStateful: true });
    const contract = await getContractFactory(artifact, h.signer).deploy() as unknown as Calls & {
      inner: { withCategory(category: Uint8Array): unknown }; categoryId: string;
    };
    await contract.seed!().send();
    const address = getEntryNftAddress(contract.inner.withCategory(hexToBin(contract.categoryId)) as never,
      contract.categoryId, 'notes');
    const hex = await h.capture(() => contract.removeIf!('k2').send());
    const kept = decodeTransactionUnsafe(hexToBin(hex));
    const node = (await h.provider.getUtxos(address))
      .find((utxo) => String(utxo.token?.nft?.commitment ?? '').startsWith(slotOf('k2')));
    kept.outputs[entryOutput(kept, 'k2')]!.token!.nft!.commitment = hexToBin(String(node?.token?.nft?.commitment));
    // The master at input 0 executes the body, ahead of every funder whose signature the change also breaks.
    await expect(h.send(binToHex(encodeTransaction(kept))).then(() => 'settled', (error: Error) => error.message))
      .resolves.toMatch(refusedAt(0));

    await expect(h.send(hex)).resolves.toBeTypeOf('string');
    const entry = SortedList.fromUtxos(await h.provider.getUtxos(address)).find(keyToSlotMulti([utf8ToBin('k2')]));
    expect(binToHex(entry!.value as Uint8Array)).toBe(DELETED);
  });
});
