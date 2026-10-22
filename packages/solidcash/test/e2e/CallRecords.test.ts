import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, decodeAuthenticationInstructions, decodeTransactionUnsafe, encodeAuthenticationInstructions,
  encodeDataPush, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileStringMulti } from 'solidc';
import { sha256 } from '@solidcash/utils';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { callRecordDigest } from '../../src/stateful/call-record.js';
import { createTestProvider, expectScriptRejection, setupStatefulUtxos } from '../test-util.js';

/**
 * Direct call records (docs/wip/call-records/DESIGN.md): a direct callee's return carrier is the record of the
 * call it answers, `digest || form || result`. The callee digests the call it executed and holds the transaction
 * to the records it pinned; the caller digests its own call and reads only its record.
 */

const SOURCE = `
interface IQuote {
  function quote(int x) external view returns (int);
  function current() external view returns (int);
  function wide() external view returns (bytes);
  function setQ(int v) external;
}
contract Quoter {
  int q;
  function setQ(int v) public { this.q = v; }
  function quote(int x) public returns (int) { return this.q + x; }
  function current() public returns (int) { return this.q; }
  function wide() public returns (bytes) {
    bytes32 h = sha256(bytes(this.q));
    return bytes.concat(h, h, h, h);
  }
}
contract Reader {
  int seen;
  bytes32 tag;
  function sync(address src, int x) public { this.seen = IQuote(src).quote(x); }
  function twice(address src) public {
    int a = IQuote(src).current();
    int b = IQuote(src).current();
    this.seen = a * 10 + b;
  }
  function readWide(address src) public { this.tag = sha256(IQuote(src).wide()); }
}`;

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;
type Output = Tx['outputs'][number];
type Instruction = { opcode: number; data?: Uint8Array };

let compiled: ReturnType<typeof compileStringMulti> | undefined;
const artifacts = (): ReturnType<typeof compileStringMulti> => {
  compiled ??= compileStringMulti(SOURCE, {});
  return compiled;
};

interface Deployed {
  provider: Provider; quoter: StatefulContract<any>; reader: StatefulContract<any>;
  quoterAddr: Uint8Array; quoterCat: string; readerCat: string;
}

async function deploy(quote: bigint): Promise<Deployed> {
  const provider = createTestProvider();
  const arts = artifacts();
  const q = new Contract(arts.Quoter, [], { provider });
  const { categoryId: quoterCat } = await setupStatefulUtxos(
    provider, q, arts.Quoter.stateLayout!, { q: 0n }, { saltContract: true },
  );
  const r = new Contract(arts.Reader, [], { provider });
  const { categoryId: readerCat } = await setupStatefulUtxos(
    provider, r, arts.Reader.stateLayout!, { seen: 0n, tag: new Uint8Array(32) }, { saltContract: true },
  );
  const quoter = StatefulContract.withCategory(q, quoterCat);
  const reader = StatefulContract.withCategory(r, readerCat);
  await quoter.setQ(quote).send();
  const quoterAddr = hexToBin(q.withCategory(hexToBin(quoterCat)).lockingBytecode);
  return { provider, quoter, reader, quoterAddr, quoterCat, readerCat };
}

async function capture(provider: Provider, run: () => Promise<unknown>): Promise<string> {
  let captured = '';
  const send = provider.sendRawTransaction.bind(provider);
  (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
    captured = hex;
    throw new Error('capture-only');
  };
  await expect(run()).rejects.toThrow('capture-only');
  (provider as any).sendRawTransaction = send;
  expect(captured).not.toBe('');
  return captured;
}

const outcomeOf = (provider: Provider, hex: string): Promise<string> => provider.sendRawTransaction(hex)
  .then(() => 'ACCEPTED').catch((e: Error) => e.message);
const decode = (hex: string): Tx => decodeTransactionUnsafe(hexToBin(hex));
const encode = (tx: Tx): string => binToHex(encodeTransaction(tx));
const ofCategory = (output: Output, category: string): boolean => output.token !== undefined
  && [category, binToHex(hexToBin(category).reverse())].includes(binToHex(output.token.category));
const carriers = (tx: Tx, category: string): number[] => tx.outputs.flatMap((output, index) => (
  ofCategory(output, category) && binToHex(output.lockingBytecode) === '51'
    && output.token?.nft?.capability === 'none' ? [index] : []));
const masterIndex = (tx: Tx, category: string): number => tx.outputs.findIndex((output) => (
  ofCategory(output, category) && output.token?.nft?.capability === 'minting'));
const stateOutput = (tx: Tx, category: string): Output => tx.outputs.find((output) => (
  ofCategory(output, category) && output.token?.nft?.capability === 'mutable'))!;

/** Rewrite input `input`'s ABI argument `name` of `fn`: one push per ABI input, after the selector push. */
function setArgument(tx: Tx, input: number, artifact: any, fn: string, name: string, value: bigint): void {
  const names = artifact.abi.find((entry: any) => entry.name === fn)!.inputs.map((entry: any) => entry.name);
  const position = names.indexOf(name);
  expect(position).toBeGreaterThanOrEqual(0);
  const instructions = decodeAuthenticationInstructions(tx.inputs[input].unlockingBytecode) as Instruction[];
  expect(instructions).toHaveLength(names.length + 2);
  instructions[instructions.length - 2 - position] = decodeAuthenticationInstructions(
    encodeDataPush(bigIntToVmNumber(value)),
  )[0] as Instruction;
  tx.inputs[input].unlockingBytecode = encodeAuthenticationInstructions(instructions as any);
}

/** The input spending the master of `category` in `tx`, found by the master output it preserves. */
const masterInput = (tx: Tx, category: string): number => masterIndex(tx, category);

// P2SH32 of `OP_1`, spent with a push of its redeem script.
const FUNDER = 'aa20953ccfa596a6c6d39e5980194539124fdcff116a571455a212baed811f585ee087';
const FUNDER_UNLOCK = Uint8Array.from([0x01, 0x51]);

/** Append a 1000-sat copy of `template`, paid for by an injected anyone-can-spend coin. */
async function appendCopy(provider: Provider, tx: Tx, template: Output): Promise<void> {
  const txid = (0x9000 + Math.floor(Math.random() * 0x6fff)).toString(16).padStart(64, '0');
  await (provider as any).addUtxo(FUNDER, { txid, vout: 0, satoshis: 40000n });
  tx.inputs.push({
    outpointTransactionHash: hexToBin(txid), outpointIndex: 0, sequenceNumber: 0xffffffff,
    unlockingBytecode: FUNDER_UNLOCK,
  });
  tx.outputs.push({ lockingBytecode: hexToBin(FUNDER), valueSatoshis: 37000n });
  tx.outputs.push({
    ...template, valueSatoshis: 1000n,
    token: { ...template.token!, nft: { ...template.token!.nft!, commitment: template.token!.nft!.commitment.slice() } },
  } as Output);
}

const sendSync = (d: Deployed, x: bigint): Promise<unknown> => (d.reader as any)
  .sync(d.quoterAddr, x).withExternalCall(d.quoter, 'quote', [x]).send();

describe('direct call records', () => {
  it('records the result of the call it answers, and the caller reads it', async () => {
    const d = await deploy(5n);
    const tx = decode(await capture(d.provider, () => sendSync(d, 7n)));
    const [record] = carriers(tx, d.quoterCat);
    expect(carriers(tx, d.quoterCat)).toHaveLength(1);
    const commitment = tx.outputs[record!].token!.nft!.commitment;
    const quote = artifacts().Quoter.abi.find((entry: any) => entry.name === 'quote')!;
    expect(binToHex(commitment.slice(0, 32))).toBe(binToHex(callRecordDigest(quote, [7n])!));
    expect(commitment[32]).toBe(1);
    expect(binToHex(commitment.slice(33))).toBe(binToHex(encodeDataPush(bigIntToVmNumber(12n))));

    await expect(sendSync(d, 7n)).resolves.toBeDefined();
    expect((await d.reader.getState()).seen).toBe(12n);
  }, 300_000);

  it('refuses a callee run on other arguments than the caller passed', async () => {
    const d = await deploy(5n);
    const honest = decode(await capture(d.provider, () => sendSync(d, 7n)));
    // A self-consistent callee run on x = 8: its argument, the record it pins, and the caller state that result.
    const other = await deploy(5n);
    const forged = decode(await capture(other.provider, () => sendSync(other, 8n)));
    const tx = decode(encode(honest));
    setArgument(tx, masterInput(tx, d.quoterCat), artifacts().Quoter, 'quote', 'x', 8n);
    const [record] = carriers(tx, d.quoterCat);
    tx.outputs[record!].token!.nft!.commitment = forged.outputs[carriers(forged, other.quoterCat)[0]!].token!.nft!
      .commitment.slice();
    stateOutput(tx, d.readerCat).token!.nft!.commitment = stateOutput(forged, other.readerCat).token!.nft!.commitment
      .slice();
    expectScriptRejection(await outcomeOf(d.provider, encode(tx)), masterInput(tx, d.readerCat));
  }, 300_000);

  it('refuses a carrier of the callee category beside the record it pinned', async () => {
    const d = await deploy(5n);
    const tx = decode(await capture(d.provider, () => sendSync(d, 7n)));
    const [record] = carriers(tx, d.quoterCat);
    await appendCopy(d.provider, tx, tx.outputs[record!]!);
    expectScriptRejection(await outcomeOf(d.provider, encode(tx)), masterInput(tx, d.quoterCat));
  }, 300_000);

  it('refuses a carrier of the callee category beside a run that returns nothing', async () => {
    const d = await deploy(5n);
    const record = decode(await capture(d.provider, () => sendSync(d, 7n)));
    const template = record.outputs[carriers(record, d.quoterCat)[0]!]!;
    const tx = decode(await capture(d.provider, () => d.quoter.setQ(6n).send()));
    await appendCopy(d.provider, tx, template);
    expectScriptRejection(await outcomeOf(d.provider, encode(tx)), masterInput(tx, d.quoterCat));
  }, 300_000);

  it('records a result past the inline capacity by its hash, which the caller takes from its witness', async () => {
    const d = await deploy(5n);
    const tx = decode(await capture(d.provider, () => (d.reader as any)
      .readWide(d.quoterAddr).withExternalCall(d.quoter, 'wide', []).send()));
    const [record] = carriers(tx, d.quoterCat);
    const commitment = tx.outputs[record!].token!.nft!.commitment;
    expect(commitment[32]).toBe(2);
    expect(commitment).toHaveLength(65);

    await (d.reader as any).readWide(d.quoterAddr).withExternalCall(d.quoter, 'wide', []).send();
    const h = sha256(bigIntToVmNumber(5n));
    expect(binToHex((await d.reader.getState()).tag as Uint8Array))
      .toBe(binToHex(sha256(Uint8Array.of(...h, ...h, ...h, ...h))));
  }, 300_000);

  it('settles a call no contract made with no record', async () => {
    const d = await deploy(5n);
    const tx = decode(await capture(d.provider, () => (d.quoter as any).quote(7n).send()));
    expect(carriers(tx, d.quoterCat)).toHaveLength(0);
    const answered = decode(await capture(d.provider, () => sendSync(d, 7n)));
    await appendCopy(d.provider, tx, answered.outputs[carriers(answered, d.quoterCat)[0]!]!);
    expectScriptRejection(await outcomeOf(d.provider, encode(tx)), masterInput(tx, d.quoterCat));
  }, 300_000);

  it('lets two identical zero-argument reads share the one record', async () => {
    const d = await deploy(5n);
    const call = (): Promise<unknown> => (d.reader as any).twice(d.quoterAddr)
      .withExternalCall(d.quoter, 'current', []).withExternalCall(d.quoter, 'current', []).send();
    const tx = decode(await capture(d.provider, call));
    expect(carriers(tx, d.quoterCat)).toHaveLength(1);
    await call();
    expect((await d.reader.getState()).seen).toBe(55n);
  }, 300_000);
});
