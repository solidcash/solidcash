import { describe, it, expect } from 'vitest';
import { compileString as _csRawSolidc } from '@solidcash/solidc';
import {
  Contract,
  SignatureTemplate,
} from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';

// This suite exercises + asserts the DEFAULT (entry-model) push/pop byte format. vmap push/pop (the default now) is
// covered by SortedMappingArrayElementWrite; opt this file out so it keeps testing the default entry model.
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> =>
  _csRawSolidc(s, o);
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv, aliceAddress } from '../fixture/vars.js';

const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

// `mapping(K => T[])` with `.push()` / `.pop()`: a read-modify-write of the entry's dynamic-array value. Uses a
// An `address` key is passed as a CashAddress here; the SDK normalizes it to the locking bytecode for both the
// write and the entry search (see Argument.ts / StatefulContract key resolution).
const SRC = `pragma solidcash >=0.8.0;
contract C() {
  mapping(address => uint256[]) m;
  function push(address k, uint256 v, pubkey pk, sig s) { require(checkSig(s, pk)); m[k].push(v); }
  function pop(address k, pubkey pk, sig s) { require(checkSig(s, pk)); m[k].pop(); }
}`;

const LONG_SRC = `pragma solidcash >=0.8.0;
struct Record { uint8 kind; bytes payload; }
contract LongRecords() {
  mapping(address => Record[]) records;
  function push(address key, Record record, pubkey pk, sig s) {
    require(checkSig(s, pk));
    records[key].push(record);
  }
  function requireLength(address key, uint256 expected, pubkey pk, sig s) view {
    require(checkSig(s, pk));
    require(records[key].length == expected);
  }
}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function dep(): Promise<any> {
  const provider = createTestProvider();
  const art = compileString(SRC, { evmCompat: true });
  const contract = new Contract(art, [], { provider });
  const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
  return StatefulContract.withCategory(contract, categoryId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function longDep(): Promise<any> {
  const provider = createTestProvider();
  const art = compileString(LONG_SRC, { evmCompat: true });
  const contract = new Contract(art, [], { provider });
  const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
  return StatefulContract.withCategory(contract, categoryId);
}

describe('mapping(K => T[]) .push() / .pop()', () => {
  it('compiles; push is a read-modify-write entry access', () => {
    const art = compileString(SRC, { evmCompat: true });
    expect(art.contractName).toBe('C');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ea = (art.abi.find((f: any) => f.name === 'push') as any)?.entryAccesses?.[0];
    expect(ea.operations).toEqual(['read', 'write']);
  });

  it('push encodes the value into the entry array', async () => {
    const sc = await dep();
    await sc.push(aliceAddress, 0xABCDn, alicePub, sig()).send();
    expect((await sc.getEntries('m'))[0].value).toEqual([0xABCDn]);
  });

  it('push,push accumulates [a, b] across txs (co-spends + appends to the prior entry)', async () => {
    const sc = await dep();
    await sc.push(aliceAddress, 0x42n, alicePub, sig()).send();
    expect((await sc.getEntries('m'))[0].value).toEqual([0x42n]);
    await sc.push(aliceAddress, 0x37n, alicePub, sig()).send();
    expect((await sc.getEntries('m'))[0].value).toEqual([0x42n, 0x37n]);
  });

  it('pop drops the last element', async () => {
    const sc = await dep();
    await sc.push(aliceAddress, 0x42n, alicePub, sig()).send();
    await sc.push(aliceAddress, 0x37n, alicePub, sig()).send();
    await sc.pop(aliceAddress, alicePub, sig()).send();
    expect((await sc.getEntries('m'))[0].value).toEqual([0x42n]);
  });

  it('preserves long struct-array values across sequential pushes', async () => {
    const sc = await longDep();
    const first = new Uint8Array(177).fill(0x41);
    const second = new Uint8Array(117).fill(0x42);
    await sc.push(aliceAddress, [1n, first], alicePub, sig()).send();
    await sc.push(aliceAddress, [2n, second], alicePub, sig()).send();
    expect((await sc.getEntries('records'))[0].value).toEqual([
      { kind: 1n, payload: first },
      { kind: 2n, payload: second },
    ]);
  });

  it('decodes the element count of a mapping-backed variable-width array', async () => {
    const sc = await longDep();
    await sc.push(aliceAddress, [1n, new Uint8Array([0x41])], alicePub, sig()).send();
    await sc.push(aliceAddress, [2n, new Uint8Array([0x42])], alicePub, sig()).send();
    await expect(sc.requireLength(aliceAddress, 2n, alicePub, sig()).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  });
});
