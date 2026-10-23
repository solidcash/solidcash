import { binToHex } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../src/index.js';
import type { ContractUnlocker } from '../../src/interfaces.js';
import { createEntryNftUnlocker } from '../../src/stateful/covenant-helpers.js';
import type { ExternalCallUtxoGroup } from '../../src/stateful/external-call-utxo-group.js';
import { rebindDeriveFullExternalResourceMaster } from '../../src/stateful/sc-derive-full-return-witness-helpers.js';
import type { StatefulTransactionBuilder } from '../../src/stateful/StatefulTransactionBuilder.js';
import { createTestProvider } from '../test-util.js';

// The full derivation rebinds a participant's records to its master's input index. Each record keeps the covenant
// it carries: a delegated participant's records bind the proxy master's lock, not the executing implementation's,
// and a block shared with another call to the same callee holds that call's records under their own collection.

const SOURCE = `contract Ledger(int salt) {
  mapping(int => int) balances;
  mapping(int => int) notes;

  function put(int key, int amount) public {
    this.balances[key] = amount;
    this.notes[key] = amount;
    require(salt >= 0);
  }
}`;

const CATEGORY = '11'.repeat(32);

const lockOf = (unlocker: ContractUnlocker): string => binToHex(unlocker.generateLockingBytecode());

const ledgers = (): { owner: Contract; other: Contract } => {
  const provider = createTestProvider();
  const artifact = compileString(SOURCE, {});
  return {
    owner: new Contract(artifact, [1n], { provider, addressType: 'p2sh32' }),
    other: new Contract(artifact, [2n], { provider, addressType: 'p2sh32' }),
  };
};

const record = (contract: Contract, collection: string): {
  txid: string; vout: number; satoshis: bigint; unlocker: ContractUnlocker;
  token: { category: string; amount: bigint; nft: { capability: 'mutable'; commitment: string } };
} => ({
  txid: '22'.repeat(32),
  vout: 0,
  satoshis: 1000n,
  token: { category: CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: '00'.repeat(40) } },
  unlocker: createEntryNftUnlocker(contract, 0, CATEGORY, collection),
});

const routeOf = (collection: string): object => ({
  abiFunction: {
    name: 'put',
    inputs: [],
    entryAccesses: [{ slotIndex: 0, collection, keyParams: ['key'], operations: ['write'] }],
  },
});

const groupOf = (owner: Contract, entry: object, extra: object): ExternalCallUtxoGroup => ({
  categoryId: CATEGORY,
  externalContract: { inner: owner },
  functionName: 'put',
  blockLayout: { blockSize: 2, slots: [{ kind: 'master', offset: 0 }, { kind: 'entry', offset: 1, slotIndex: 0 }] },
  blockInputs: [{ txid: '33'.repeat(32), vout: 0, satoshis: 1000n }, entry],
  ...extra,
}) as unknown as ExternalCallUtxoGroup;

describe('derive-full entry rebind', () => {
  it('keeps a delegated participant entry at the proxy lock and moves only the master index', () => {
    const { owner: proxy, other: implementation } = ledgers();
    expect(proxy.lockingBytecode).not.toBe(implementation.lockingBytecode);
    const entry = record(proxy, 'balances');
    const proxyEntryLock = lockOf(entry.unlocker);
    const delegateGroup = {
      externalContract: { inner: implementation }, functionName: 'put', compilerRoute: routeOf('balances'),
    };
    const stb = {
      getLowLevelCallUtxoGroups: () => [delegateGroup],
      rebindCategoryEntryUnlockers: () => undefined,
    } as unknown as StatefulTransactionBuilder;

    expect(rebindDeriveFullExternalResourceMaster(stb, groupOf(proxy, entry, { delegateCallGroupIndex: 0 }), 9)).toBe(true);

    expect(lockOf(entry.unlocker)).toBe(proxyEntryLock);
    expect(lockOf(entry.unlocker)).not.toBe(lockOf(createEntryNftUnlocker(implementation, 9, CATEGORY, 'balances')));
    expect(entry.unlocker.params).toEqual([1n, 9n]);
  });

  it('keeps a record of another collection that a shared block carries at the slot', () => {
    const { owner } = ledgers();
    const entry = record(owner, 'balances');
    const balancesLock = lockOf(entry.unlocker);
    const stb = {
      getLowLevelCallUtxoGroups: () => [],
      rebindCategoryEntryUnlockers: () => undefined,
    } as unknown as StatefulTransactionBuilder;

    expect(rebindDeriveFullExternalResourceMaster(stb, groupOf(owner, entry, { compilerRoute: routeOf('notes') }), 7))
      .toBe(true);

    expect(lockOf(entry.unlocker)).toBe(balancesLock);
    expect(lockOf(entry.unlocker)).not.toBe(lockOf(createEntryNftUnlocker(owner, 7, CATEGORY, 'notes')));
    expect(entry.unlocker.params).toEqual([1n, 7n]);
  });
});
