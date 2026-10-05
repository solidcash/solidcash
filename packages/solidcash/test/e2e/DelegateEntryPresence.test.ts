import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeAuthenticationInstructions, decodeTransactionUnsafe, encodeAuthenticationInstructions,
  encodeLockingBytecodeP2sh32, encodeTransaction, hash256, hexToBin, utf8ToBin, type Output, type TransactionCommon,
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
 * An entry read beside a sorted write of its collection is kept by the contract that runs the body, directly and
 * through a proxy alike: once the entry takes its own write path, its read-only path binds nothing.
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

// No scalar state, so no data NFT: the implementation master sits at input 1, where a second predecessor's
// block-relative output index first reads as an absolute one.
const LEDGER = `pragma solidcash >=0.8.0;
contract Ledger() {
  mapping(string => string) notes;
  function initialize() public delegate { this.notes["k1"] = "alpha"; this.notes["k2"] = "bravo"; }
  function writeTwoReading(string a, string b, string c) public delegate {
    require(bytes(this.notes[c]).length != 0); this.notes[a] = "x1"; this.notes[b] = "y2";
  }
  function writeOneReading(string a, string c) public delegate {
    require(bytes(this.notes[c]).length != 0); this.notes[a] = "z3";
  }
}`;

const DIRECT_NOTES = `pragma solidcash >=0.8.0;
contract Notes() {
  mapping(string => string) notes;
  function seed() public { this.notes["k1"] = "alpha"; this.notes["k2"] = "bravo"; }
  function removeIf(string key) public { if (bytes(this.notes[key]).length != 0) { delete this.notes[key]; } }
  function writeTwoReading(string a, string b, string c) public {
    require(bytes(this.notes[c]).length != 0); this.notes[a] = "x1"; this.notes[b] = "y2";
  }
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
      // A funder or a mocknet fee input has no stored transaction; the fee input is the P2SH32 of the script it
      // pushes.
      const pushes = decodeAuthenticationInstructions(input.unlockingBytecode);
      const last = pushes[pushes.length - 1];
      const locks = [signerLock, ...(last !== undefined && 'data' in last
        ? [encodeLockingBytecodeP2sh32(hash256(last.data))] : [])];
      for (const lockingBytecode of locks) {
        const utxo = (await provider.getUtxosForLockingBytecode(lockingBytecode))
          .find((candidate) => candidate.txid === txid && candidate.vout === input.outpointIndex);
        if (utxo !== undefined) return { lockingBytecode, valueSatoshis: utxo.satoshis };
      }
      throw new Error(`No source output for ${txid}:${input.outpointIndex}`);
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

/**
 * Replays `hex` with `key`'s entry on its write path, its output changed by `change`. The entry's unlocking pushes
 * `<masterInputIndex> <flag>`: flag 1 naming the minting master at input 0 lifts the entry covenant's own
 * preservation, leaving the entry to the contract that runs the body.
 */
async function onWritePath(
  h: Awaited<ReturnType<typeof harness>>, hex: string, key: string,
  change: (tx: TransactionCommon, output: number) => void,
): Promise<string> {
  const tx = decodeTransactionUnsafe(hexToBin(hex));
  const input = await h.entryInput(tx, key);
  const pushes = decodeAuthenticationInstructions(tx.inputs[input]!.unlockingBytecode);
  pushes[0] = { opcode: 0x00 };
  pushes[1] = { opcode: 0x51 };
  tx.inputs[input]!.unlockingBytecode = encodeAuthenticationInstructions(pushes);
  change(tx, entryOutput(tx, key));
  return h.replay(tx);
}

const flipLastByte = (tx: TransactionCommon, output: number): void => {
  const commitment = tx.outputs[output]!.token!.nft!.commitment.slice();
  commitment[commitment.length - 1] ^= 1;
  tx.outputs[output]!.token!.nft!.commitment = commitment;
};
const drain = (tx: TransactionCommon, output: number): void => { tx.outputs[output]!.valueSatoshis -= 300n; };

async function deployNotes(source = NOTES): Promise<{
  h: Awaited<ReturnType<typeof harness>>;
  calls: Calls;
  selector(name: string): string;
  pushOf(name: string, input: string): number;
  stored(key: string): Promise<string>;
  storedCommitment(key: string): Promise<Uint8Array>;
}> {
  const h = await harness();
  const artifact = compileString(source);
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
  it('writes two keys beside a read of the same collection through a proxy, and keeps the read entry', async () => {
    const ledger = await deployNotes(LEDGER);
    // `k3` lands after the head and `k4` after the tail: two distinct predecessors, the second recreated at the
    // trailing band's second ordinal.
    const hex = await ledger.h.capture(() => ledger.calls.writeTwoReading!('k3', 'k4', 'k1').send());
    const frame = frameOf(hex, ledger.selector('writeTwoReading'));
    const read = entryOutput(decodeTransactionUnsafe(hexToBin(hex)), 'k1');
    // The collection's entry outputs are counted, the read entry among them: dropping it is refused.
    const missing = decodeTransactionUnsafe(hexToBin(hex));
    missing.outputs[read] = {
      lockingBytecode: missing.outputs[missing.outputs.length - 1]!.lockingBytecode,
      valueSatoshis: missing.outputs[read]!.valueSatoshis,
    };
    await expect(ledger.h.replay(missing)).resolves.toMatch(refusedAt(frame));
    // So is publishing a second copy of it.
    const extra = decodeTransactionUnsafe(hexToBin(hex));
    const copy = extra.outputs[read]!;
    extra.outputs[extra.outputs.length - 1]!.valueSatoshis -= copy.valueSatoshis;
    const nft = { ...copy.token!.nft!, commitment: copy.token!.nft!.commitment.slice() };
    extra.outputs.push({ ...copy, token: { ...copy.token!, nft } });
    await expect(ledger.h.replay(extra)).resolves.toMatch(refusedAt(frame));
    // And rewriting it on its write path, which the batch's writes never name.
    await expect(onWritePath(ledger.h, hex, 'k1', flipLastByte)).resolves.toMatch(refusedAt(frame));
    await expect(onWritePath(ledger.h, hex, 'k1', drain)).resolves.toMatch(refusedAt(frame));

    await expect(ledger.h.send(hex)).resolves.toBeTypeOf('string');
    await expect(ledger.stored('k3')).resolves.toBe(binToHex(Uint8Array.from([2, 0, 0, 0, ...utf8ToBin('x1')])));
    await expect(ledger.stored('k4')).resolves.toBe(binToHex(Uint8Array.from([2, 0, 0, 0, ...utf8ToBin('y2')])));
    await expect(ledger.stored('k1')).resolves.toBe(binToHex(Uint8Array.from([5, 0, 0, 0, ...utf8ToBin('alpha')])));
  });

  it('keeps a read entry beside a lone write through a proxy, even on the entry\'s write path', async () => {
    const ledger = await deployNotes(LEDGER);
    const hex = await ledger.h.capture(() => ledger.calls.writeOneReading!('k5', 'k2').send());
    const frame = frameOf(hex, ledger.selector('writeOneReading'));
    await expect(onWritePath(ledger.h, hex, 'k2', flipLastByte)).resolves.toMatch(refusedAt(frame));
    await expect(onWritePath(ledger.h, hex, 'k2', drain)).resolves.toMatch(refusedAt(frame));

    await expect(ledger.h.send(hex)).resolves.toBeTypeOf('string');
    await expect(ledger.stored('k5')).resolves.toBe(binToHex(Uint8Array.from([2, 0, 0, 0, ...utf8ToBin('z3')])));
    await expect(ledger.stored('k2')).resolves.toBe(binToHex(Uint8Array.from([5, 0, 0, 0, ...utf8ToBin('bravo')])));
  });

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
    // Two fixed targets take their order from the slot hashes and each proof's next field. The packed
    // rows blob is not read on that path, so this flips the successor the proof must match.
    const forged = decodeTransactionUnsafe(hexToBin(hex));
    const instructions = decodeAuthenticationInstructions(forged.inputs[frame]!.unlockingBytecode);
    const next = notes.pushOf('removeBothIf', '__internal__vmapBatchNext_0');
    const nextPush = instructions[next]!;
    expect('data' in nextPush).toBe(true);
    const data = ('data' in nextPush ? nextPush.data : new Uint8Array()).slice();
    expect(data.length).toBe(32);
    data[0] ^= 1;
    instructions[next] = { ...nextPush, data } as never;
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
    await expect(onWritePath(notes.h, hex, 'k1', flipLastByte)).resolves.toMatch(refusedAt(frame));
    await expect(onWritePath(notes.h, hex, 'k1', drain)).resolves.toMatch(refusedAt(frame));

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

  it('writes two keys beside a read directly, and keeps the read entry (control)', async () => {
    const h = await harness();
    const artifact = compileString(DIRECT_NOTES, { forceStateful: true });
    const contract = await getContractFactory(artifact, h.signer).deploy() as unknown as Calls & {
      inner: { withCategory(category: Uint8Array): unknown }; categoryId: string;
    };
    await contract.seed!().send();
    const address = getEntryNftAddress(contract.inner.withCategory(hexToBin(contract.categoryId)) as never,
      contract.categoryId, 'notes');
    const hex = await h.capture(() => contract.writeTwoReading!('k3', 'k4', 'k1').send());
    await expect(onWritePath(h, hex, 'k1', flipLastByte)).resolves.toMatch(refusedAt(0));
    await expect(onWritePath(h, hex, 'k1', drain)).resolves.toMatch(refusedAt(0));

    await expect(h.send(hex)).resolves.toBeTypeOf('string');
    const list = SortedList.fromUtxos(await h.provider.getUtxos(address));
    expect(binToHex(list.find(keyToSlotMulti([utf8ToBin('k1')]))!.value as Uint8Array))
      .toBe(binToHex(Uint8Array.from([5, 0, 0, 0, ...utf8ToBin('alpha')])));
    expect(binToHex(list.find(keyToSlotMulti([utf8ToBin('k4')]))!.value as Uint8Array))
      .toBe(binToHex(Uint8Array.from([2, 0, 0, 0, ...utf8ToBin('y2')])));
  });
});
