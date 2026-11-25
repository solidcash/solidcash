import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, decodeAuthenticationInstructions, decodeTransactionUnsafe, encodeAuthenticationInstructions,
  encodeDataPush, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileString as compileAutomatic } from '@solidcash/solidc';
import { compileString, compileStringMulti } from '../direct-compile.js';
import { Contract, SignatureTemplate } from '../../src/index.js';
import { StatefulContract, getSatoshiContainerAddress } from '../../src/stateful/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider, expectScriptRejection, setupStatefulUtxos } from '../test-util.js';

/**
 * A direct call that no call record binds (a method returning nothing, or a call naming fewer arguments than its
 * method declares) checks the arguments it names against its callee's unlocking pushes, as D8 does for a compat
 * raw call. A callee run on other arguments beside a genuine caller run is refused by the caller's input.
 */

const SOURCE = `
interface ISink {
  function put(int x) external;
  function deposit(int id) external;
  function tag(int label, pubkey owner, sig s) external;
}
contract Sink {
  int last;
  function put(int x) public { this.last = x; }
  function deposit(int id) public payable { this.last = id; }
  function tag(int label, pubkey owner, sig s) public {
    require(checkSig(s, owner));
    this.last = label;
  }
}
contract Source {
  int count;
  function relay(address sink, int x) public { ISink(sink).put(x + 1); this.count = this.count + 1; }
  function fund(address sink, int id) public { ISink(sink).deposit{value: 2000}(id); this.count = this.count + 1; }
  function label(address sink, int x) public { ISink(sink).tag(x); this.count = this.count + 1; }
}`;

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;
type Output = Tx['outputs'][number];
type Instruction = { opcode: number; data?: Uint8Array };

let compiled: ReturnType<typeof compileStringMulti> | undefined;
const artifacts = (): ReturnType<typeof compileStringMulti> => {
  compiled ??= compileStringMulti(SOURCE);
  return compiled;
};

interface Deployed {
  provider: Provider; sink: StatefulContract<any>; source: StatefulContract<any>;
  sinkAddr: Uint8Array; sinkCat: string; sourceCat: string;
}

async function deploy(): Promise<Deployed> {
  const provider = createTestProvider();
  const arts = artifacts();
  const s = new Contract(arts.Sink, [], { provider });
  const { categoryId: sinkCat } = await setupStatefulUtxos(
    provider, s, arts.Sink.stateLayout!, { last: 0n }, { saltContract: true },
  );
  const r = new Contract(arts.Source, [], { provider });
  const { categoryId: sourceCat } = await setupStatefulUtxos(
    provider, r, arts.Source.stateLayout!, { count: 0n }, { saltContract: true },
  );
  return {
    provider,
    sink: StatefulContract.withCategory(s, sinkCat),
    source: StatefulContract.withCategory(r, sourceCat),
    sinkAddr: hexToBin(s.withCategory(hexToBin(sinkCat)).lockingBytecode),
    sinkCat,
    sourceCat,
  };
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
const masterInput = (tx: Tx, category: string): number => tx.outputs.findIndex((output) => (
  ofCategory(output, category) && output.token?.nft?.capability === 'minting'));
const stateOutput = (tx: Tx, category: string): Output => tx.outputs.find((output) => (
  ofCategory(output, category) && output.token?.nft?.capability === 'mutable'))!;
/** A callee's call record: an output of its category under the record carrier's `OP_TRUE` lock. */
const recordOf = (tx: Tx, category: string): Output | undefined => tx.outputs.find((output) => (
  ofCategory(output, category) && binToHex(output.lockingBytecode) === '51'));

/** Rewrite input `input`'s ABI argument `name` of `fn`: one push per ABI input, the first just before the redeem. */
function setArgument(tx: Tx, input: number, artifact: any, fn: string, name: string, value: bigint): void {
  const names = artifact.abi.find((entry: any) => entry.name === fn)!.inputs.map((entry: any) => entry.name);
  const position = names.indexOf(name);
  expect(position).toBeGreaterThanOrEqual(0);
  const instructions = decodeAuthenticationInstructions(tx.inputs[input].unlockingBytecode) as Instruction[];
  expect(instructions.length).toBeGreaterThanOrEqual(names.length + 1);
  instructions[instructions.length - 2 - position] = decodeAuthenticationInstructions(
    encodeDataPush(bigIntToVmNumber(value)),
  )[0] as Instruction;
  tx.inputs[input].unlockingBytecode = encodeAuthenticationInstructions(instructions as any);
}

const relay = (d: Deployed, x: bigint, put = x + 1n): Promise<unknown> => (d.source as any)
  .relay(d.sinkAddr, x).withExternalCall(d.sink, 'put', [put]).send();
// The SDK refuses at preflight (input 0, the caller) or at its derivation probe of the caller's run.
const refusedByCaller = /(preflight failed at input 0|VM failed at ip \d+ opcode \d+): Program failed an OP_(EQUAL)?VERIFY/;

describe('direct void call arguments', () => {
  it('settles a void call whose callee runs the arguments the caller passed', async () => {
    const d = await deploy();
    await relay(d, 7n);
    expect((await d.sink.getState()).last).toBe(8n);
    expect((await d.source.getState()).count).toBe(1n);
  }, 300_000);

  it('refuses a callee run on another argument, which the caller agreeing with makes valid', async () => {
    const d = await deploy();
    const honest = decode(await capture(d.provider, () => relay(d, 7n)));
    // A self-consistent callee run on x = 9: its argument, the state it writes and the void record it pins.
    const other = await deploy();
    const forged = decode(await capture(other.provider, () => relay(other, 8n)));
    const tx = decode(encode(honest));
    setArgument(tx, masterInput(tx, d.sinkCat), artifacts().Sink, 'put', 'x', 9n);
    stateOutput(tx, d.sinkCat).token!.nft!.commitment = stateOutput(forged, other.sinkCat).token!.nft!.commitment
      .slice();
    // The record's digest names the method, the arguments and the reader's input, not the category, so the forged
    // run's `digest(put, [9]) || 01` is the record this run pins.
    const record = recordOf(tx, d.sinkCat);
    const forgedRecord = recordOf(forged, other.sinkCat);
    expect(record?.token?.nft?.commitment).not.toEqual(forgedRecord?.token?.nft?.commitment);
    record!.token!.nft!.commitment = forgedRecord!.token!.nft!.commitment.slice();
    // The same transaction with the caller's own argument agreeing is valid: only the caller's read of the record
    // refuses it.
    const control = decode(encode(tx));
    setArgument(control, masterInput(control, d.sourceCat), artifacts().Source, 'relay', 'x', 8n);
    // F1: Source pins an own-category edge committing to the call it makes. Editing relay.x = 8 makes Source
    // recompute its edge as digest(put, [9]); update the stale edge record (OP_1 OP_NOP carrier) to match, as the
    // SDK would when building that call. The digest is category-independent, so the forged x=9 run's edge carries
    // the right commitment under d's own Source category.
    const edgeOf = (t: Tx, cat: string): Output | undefined => t.outputs.find((output) => (
      output.lockingBytecode.length === 2 && output.lockingBytecode[0] === 0x51
      && output.lockingBytecode[1] === 0x61 && ofCategory(output, cat)));
    const controlEdge = edgeOf(control, d.sourceCat);
    const forgedEdge = edgeOf(forged, other.sourceCat);
    if (controlEdge !== undefined && forgedEdge !== undefined) {
      controlEdge.token!.nft!.commitment = forgedEdge.token!.nft!.commitment.slice();
    }
    expectScriptRejection(await outcomeOf(d.provider, encode(tx)), masterInput(tx, d.sourceCat));
    expect(await outcomeOf(d.provider, encode(control))).toBe('ACCEPTED');
    expect((await d.sink.getState()).last).toBe(9n);
  }, 300_000);

  it('binds the argument a call names and leaves the ones it does not to the callee', async () => {
    const d = await deploy();
    const label = (x: bigint, named: bigint): Promise<unknown> => (d.source as any).label(d.sinkAddr, x)
      .withExternalCall(d.sink, 'tag', [named, alicePub, new SignatureTemplate(alicePriv)]).send();
    await expect(label(5n, 6n)).rejects.toThrow(refusedByCaller);
    await label(5n, 5n);
    expect((await d.sink.getState()).last).toBe(5n);
  }, 300_000);

  it('binds the argument of a void call that carries value', async () => {
    const d = await deploy();
    // The caller pays the value from its satoshi container.
    await (d.provider as any).addUtxo(getSatoshiContainerAddress(d.source.inner, d.sourceCat), {
      txid: '5c'.repeat(32), vout: 0, satoshis: 100_000n,
    });
    const fund = (id: bigint, named: bigint): Promise<unknown> => (d.source as any).fund(d.sinkAddr, id)
      .withExternalCall(d.sink, 'deposit', [named]).send();
    // The record names the argument, so the run on another one fails the caller's read or the callee's own pin.
    await expect(fund(3n, 4n)).rejects.toThrow(/Program failed an OP_(EQUAL)?VERIFY/);
    await fund(3n, 3n);
    expect((await d.sink.getState()).last).toBe(3n);
    expect((await d.source.getState()).count).toBe(1n);
  }, 300_000);
});

describe('direct void call arguments in the caller bytecode', () => {
  const caller = (argument: string): string => `
interface ISink { function put(int x) external; }
contract Source {
  int count;
  function relay(address sink, int x) public { ISink(sink).put(${argument}); this.count = this.count + 1; }
  function bump() public { this.count = this.count + 1; }
}`;
  const relayBody = (artifact: any): string => {
    const selector = artifact.abi.find((entry: any) => entry.name === 'relay')!.selector as string;
    return artifact.functionBodies?.[selector] ?? artifact.bytecode;
  };

  it.each([
    ['messageBus: false', (source: string): any => compileString(source)],
    ['automatic', (source: string): any => compileAutomatic(source)],
  ])('depends on the argument expression (%s)', (_mode, compile) => {
    const bodies = ['x', 'x + 1', '7'].map((argument) => relayBody(compile(caller(argument))));
    expect(new Set(bodies).size).toBe(3);
  });
});
