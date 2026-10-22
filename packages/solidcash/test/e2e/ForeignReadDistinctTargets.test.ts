import { hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate } from '../../src/index.js';
import { StatefulContract, getDataNftLockingBytecode } from '../../src/stateful/index.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * A function co-spends one record per foreign read slot (an interface's data NFT, or one of its collections), pinned
 * to the address of the slot's first read. A read of that slot through another address was served the first target's
 * record, so a reader of two instances of one interface read one value twice. That read is now refused at compile
 * time; a read through the same address keeps sharing its slot. An outState read's slot is keyed the same way.
 */
const ICOUNTER = `interface ICounter {
  public bigint counter;
  function increment(pubkey owner, sig s);
}`;

const COUNTER = `pragma solidcash >=0.8.0;
${ICOUNTER}
contract Counter() is ICounter {
  bigint counter;
  function increment(pubkey owner, sig s) {
    require(checkSig(s, owner));
    this.counter = this.counter + 1;
  }
}`;

const PAIR_READER = `pragma solidcash >=0.8.0;
${ICOUNTER}
contract PairReader(bytes first, bytes second) {
  bigint left;
  bigint right;
  function sync(pubkey pk, sig s) {
    require(checkSig(s, pk));
    this.left = ICounter(first).counter;
    this.right = ICounter(second).counter;
  }
}`;

const IBANK = `interface IBank {
  public mapping(bytes20 => bigint) balances;
  function poke(pubkey pk, sig s);
}`;

// The second target is the caller's argument: it was served the entry at the constructor's target.
const PAIR_BANK = `pragma solidcash >=0.8.0;
${IBANK}
contract PairBank(bytes first) {
  bigint seen;
  function sync(bytes other, bytes20 who, pubkey pk, sig s) {
    require(checkSig(s, pk));
    this.seen = IBank(first).balances[who] + IBank(other).balances[who];
  }
}`;

const SAME_BANK = `pragma solidcash >=0.8.0;
${IBANK}
contract SameBank(bytes first) {
  bigint seen;
  function sync(bytes20 who, pubkey pk, sig s) {
    require(checkSig(s, pk));
    this.seen = IBank(first).balances[who] + IBank(first).balances[who];
  }
}`;

const TWICE_READER = `pragma solidcash >=0.8.0;
${ICOUNTER}
contract TwiceReader(bytes counterAddr) {
  bigint total;
  function sync(pubkey pk, sig s) {
    require(checkSig(s, pk));
    this.total = ICounter(counterAddr).counter + ICounter(counterAddr).counter;
  }
}`;

// The same reads of the post-transaction output state.
function outState(source: string): string {
  return source.replaceAll(').counter', ').outState.counter').replaceAll(').balances[', ').outState.balances[');
}

// The pin checks the value the address name holds at the end of the function, which a later assignment moves.
const MOVED_READER = `pragma solidcash >=0.8.0;
${ICOUNTER}
contract MovedReader() {
  bigint seen;
  function sync(bytes target, bytes other, pubkey pk, sig s) {
    require(checkSig(s, pk));
    this.seen = ICounter(target).counter;
    target = other;
    require(target.length > 0);
  }
}`;

// At the end of the function the name `t` is the second declaration's.
const REDECLARED_READER = `pragma solidcash >=0.8.0;
${ICOUNTER}
contract RedeclaredReader() {
  bigint seen;
  function sync(bytes a, bytes b, pubkey pk, sig s) {
    require(checkSig(s, pk));
    if (a.length > 0) {
      bytes t = a;
      this.seen = ICounter(t).counter;
    }
    bytes t = b;
    require(t.length > 0);
  }
}`;

/** A genesis's data-NFT lock: its covenant binds the master at the contract's category-pinned lock. */
function pinnedDataNftLock(contract: Contract, categoryId: string): Uint8Array {
  return getDataNftLockingBytecode(categoryId, hexToBin(contract.withCategory(hexToBin(categoryId)).lockingBytecode));
}

describe('foreign reads of distinct targets', () => {
  it('refuses a read of a second target of one interface record', () => {
    expect(() => compileString(PAIR_READER)).toThrow(
      /'ICounter\(second\)\.counter' reads the data NFT 0 of 'ICounter' that this function already reads through 'first'/,
    );
    expect(() => compileString(PAIR_BANK)).toThrow(
      /'IBank\(other\)\.balances' reads the collection 'balances' of 'IBank' that this function already reads through/,
    );
  });

  it('keeps a same-address double read on its one slot, reading the target\'s value', async () => {
    const reader = compileString(TWICE_READER);
    expect(reader.abi.find((f) => f.name === 'sync')!.externalReads).toEqual([
      { interfaceName: 'ICounter', kind: 'data', nftIndex: 0, addressParam: 'counterAddr' },
    ]);
    expect(compileString(SAME_BANK).abi.find((f) => f.name === 'sync')!.externalReads).toEqual([{
      interfaceName: 'IBank',
      kind: 'entry',
      collectionName: 'balances',
      collectionSignature: 'balances:mapping(bytes20 => bigint)',
      addressParam: 'first',
    }]);

    const provider = createTestProvider();
    const counterArtifact = compileString(COUNTER);
    const counter = new Contract(counterArtifact, [], { provider });
    const { categoryId: counterCategory } = await setupStatefulUtxos(
      provider, counter, counterArtifact.stateLayout!, { counter: 21n }, { saltContract: true },
    );
    const readerContract = new Contract(reader, [pinnedDataNftLock(counter, counterCategory)], { provider });
    const { categoryId: readerCategory } = await setupStatefulUtxos(
      provider, readerContract, reader.stateLayout!, { total: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(readerContract, readerCategory, {
      externals: { ICounter: StatefulContract.withCategory(counter, counterCategory) },
    });

    const tx = await sc.sync(alicePub, new SignatureTemplate(alicePriv)).send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
    expect((await sc.getState()).total).toBe(42n);
  }, 180_000);

  it('refuses an outState read of a second target of one interface record', () => {
    expect(() => compileString(outState(PAIR_READER))).toThrow(
      /'ICounter\(second\)\.outState\.counter' reads the output data NFT 0 of 'ICounter' that this function already/,
    );
    expect(() => compileString(outState(PAIR_BANK))).toThrow(
      /'IBank\(other\)\.outState\.balances' reads the output collection 'balances' of 'IBank' that this function/,
    );
  });

  it('keeps a same-address double outState read on its one slot, reading the target\'s output', async () => {
    const reader = compileString(outState(TWICE_READER));
    expect(reader.abi.find((f) => f.name === 'sync')!.externalOutStateReads).toEqual([
      { interfaceName: 'ICounter', addressParam: 'counterAddr', requiredDataNftIndices: [0] },
    ]);
    expect(compileString(outState(SAME_BANK)).abi.find((f) => f.name === 'sync')!.externalOutStateReads).toEqual([
      { interfaceName: 'IBank', addressParam: 'first', requiredDataNftIndices: [] },
    ]);

    const provider = createTestProvider();
    const counterArtifact = compileString(COUNTER);
    const counter = new Contract(counterArtifact, [], { provider });
    const { categoryId: counterCategory } = await setupStatefulUtxos(
      provider, counter, counterArtifact.stateLayout!, { counter: 21n }, { saltContract: true },
    );
    const readerContract = new Contract(
      reader, [counter.withCategory(hexToBin(counterCategory)).lockingBytecode], { provider },
    );
    const { categoryId: readerCategory } = await setupStatefulUtxos(
      provider, readerContract, reader.stateLayout!, { total: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(readerContract, readerCategory);
    const counterSc = StatefulContract.withCategory(counter, counterCategory);

    const tx = await sc.sync(alicePub, new SignatureTemplate(alicePriv))
      .withExternalCall(counterSc, 'increment', [alicePub, new SignatureTemplate(alicePriv)])
      .send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
    expect((await counterSc.getState()).counter).toBe(22n);
    expect((await sc.getState()).total).toBe(44n);
  }, 180_000);

  it('refuses a read through an address the function assigns or declares again', () => {
    for (const source of [MOVED_READER, outState(MOVED_READER)]) {
      expect(() => compileString(source)).toThrow(
        /External read 'ICounter\(target\)' reads through 'target', which this function assigns or declares again/,
      );
    }
    for (const source of [REDECLARED_READER, outState(REDECLARED_READER)]) {
      expect(() => compileString(source)).toThrow(/External read 'ICounter\(t\)' reads through 't', which this function/);
    }
  });
});
