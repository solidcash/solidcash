import { describe, expect, it } from 'vitest';
import { encodeCashAddress, utf8ToBin } from '@bitauth/libauth';
import { bytesToHex, buildChunkCommitment, buildPushdataCommitment, encodeInt, splitValueIntoChunks } from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { REAL_VALIDATOR_PROGRAM, seededCategory } from '../../../../solidc/test/framed/master/validator-input.js';
import { encodeFunctionArgument } from '../../../src/Argument.js';
import { collectionKeyEncoding } from '../../../src/framed/composer/index.js';
import {
  chunkRecordLockingBytecode,
  deployMaster,
  entryRecordLockingBytecode,
  satoshiContainerLockingBytecode,
  stateRecordLockingBytecode,
} from '../../../src/framed/deploy/index.js';
import { readFramedEntry, readFramedStorage } from '../../../src/framed/read/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { encodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';

/**
 * Reading storage from the UTXOs themselves.
 *
 * The contract keeps a dynamic string, two records and a mapping. `directStateReturn` names the record a getter
 * returns, `directMappingReturn` names a mapping getter, and `balanceReaders` names the native-balance getter.
 * `readFramedStorage` answers all of them from one snapshot; a body that computes (`return total * 2;`) publishes no
 * proof and stays with the framed read. A getter of named returns that leaves one unassigned (Uniswap V2's
 * `getReserves` on a pair that keeps no time) publishes that output as `null` and reads its zero.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Store {'
  + '   string public name;'
  + '   uint256 public total;'
  + '   uint256 public a;'
  + '   uint256 public b;'
  + '   mapping(address => uint256) public balances;'
  + '   function readTotal() public view returns (uint256) { return total; }'
  + '   function reserves() public view returns (uint256, uint256) { return (a, b); }'
  + '   function getReserves() public view returns (uint256 x, uint256 y, uint32 last) { x = a; y = b; }'
  + '   function withAddress() public view returns (uint256 x, address who) { x = a; }'
  + '   function double() public view returns (uint256) { return total * 2; }'
  + '   function contractBalance() public view returns (uint256) { return address(this).balance; }'
  + ' }';

const artifact = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true }).Store!;
const layout = artifact.stateLayout!;
const category = seededCategory('static storage read');
const categoryHex = bytesToHex(category);
const NAME = 'Store Token';
const ACCOUNT = encodeCashAddress({ prefix: 'bchtest', type: 'p2pkh',
  payload: Uint8Array.from({ length: 20 }, () => 7) }).address;
const OTHER = encodeCashAddress({ prefix: 'bchtest', type: 'p2pkh',
  payload: Uint8Array.from({ length: 20 }, () => 9) }).address;
const BALANCE = 900n;
const CONTAINER = 7_000n;

function tokenUtxo(txid: string, satoshis: bigint, capability: 'minting' | 'mutable', commitment: string): Utxo {
  return {
    txid, vout: 0, satoshis,
    token: { category: categoryHex, amount: 0n, nft: { capability, commitment } },
  };
}

async function chain(): Promise<MockNetworkProvider> {
  const provider = new MockNetworkProvider();
  const deployed = deployMaster(artifact, category, REAL_VALIDATOR_PROGRAM);

  await provider.addUtxo(bytesToHex(deployed.lockingBytecode), tokenUtxo('11'.repeat(32), 2_000n, 'minting', ''));
  await provider.addUtxo(bytesToHex(deployed.address), tokenUtxo('22'.repeat(32), 1_200n, 'mutable', ''));

  await provider.addUtxo(
    bytesToHex(stateRecordLockingBytecode(categoryHex)),
    tokenUtxo('33'.repeat(32), 1_200n, 'mutable', buildPushdataCommitment(layout, {
      name: NAME, total: 42n, a: 1n, b: 2n,
    }, 0)),
  );

  const chunks = splitValueIntoChunks(utf8ToBin(NAME));
  const chunkLock = bytesToHex(chunkRecordLockingBytecode(categoryHex, 'name', 'string'));
  for (const [index, chunk] of chunks.entries()) {
    await provider.addUtxo(chunkLock, tokenUtxo(
      (0x40 + index).toString(16).padStart(2, '0').repeat(32), 1_200n, 'mutable',
      buildChunkCommitment(index, chunk, layout.commitmentLimit),
    ));
  }

  const collection = layout.collections!.find((candidate) => candidate.name === 'balances')!;
  const key = encodeFunctionArgument(ACCOUNT, 'address') as Uint8Array;
  const slot = keyToSlotMulti([key], collectionKeyEncoding(artifact, 'balances'));
  await provider.addUtxo(
    bytesToHex(entryRecordLockingBytecode(categoryHex, collection.signature)),
    tokenUtxo('55'.repeat(32), 1_200n, 'mutable',
      bytesToHex(encodeEntryCommitment(slot, new Uint8Array(32), encodeInt(BALANCE)))),
  );

  await provider.addUtxo(bytesToHex(satoshiContainerLockingBytecode(categoryHex)), {
    txid: '66'.repeat(32), vout: 0, satoshis: CONTAINER,
  });
  return provider;
}

describe('reading framed storage without a transaction', () => {
  it('answers records, dynamic strings, mapping values and the native balance', async () => {
    const provider = await chain();
    const storage = await readFramedStorage({ provider, artifact, categoryId: categoryHex });

    expect(storage.state.name).toBe(NAME);
    expect(storage.state.total).toBe(42n);
    expect(storage.state.name$len).toBeUndefined();

    expect(await storage.read('name')).toEqual([NAME]);
    expect(await storage.read('total')).toEqual([42n]);
    expect(await storage.read('readTotal')).toEqual([42n]);
    expect(await storage.read('reserves')).toEqual([1n, 2n]);
    // The named return nothing assigns is its type's zero; an unassigned address has none, so it stays framed.
    expect(await storage.read('getReserves')).toEqual([1n, 2n, 0n]);
    expect(await storage.read('withAddress')).toBeUndefined();
    expect(await storage.read('balances', [ACCOUNT])).toEqual([BALANCE]);
    expect(await storage.read('balances', [OTHER])).toEqual([0n]);
    expect(await storage.read('contractBalance')).toEqual([CONTAINER]);
    // A body that computes publishes no `directStateReturn`, so it stays on the framed read.
    expect(await storage.read('double')).toBeUndefined();
    expect(await storage.read('missing')).toBeUndefined();
  });

  it('returns the values the framed read returns', async () => {
    const provider = await chain();
    const storage = await readFramedStorage({ provider, artifact, categoryId: categoryHex });
    for (const [functionName, args, expected] of [
      ['name', [], NAME],
      ['total', [], 42n],
      ['reserves', [], [1n, 2n]],
      ['getReserves', [], [1n, 2n, 0n]],
      ['balances', [ACCOUNT], BALANCE],
    ] as const) {
      const framed = await readFramedEntry({
        provider, artifact, categoryId: categoryHex, functionName, args: args as never,
        vm: compositionMachine(),
      });
      expect(framed.accepted).toBe(true);
      expect(await storage.read(functionName, args as never)).toEqual(framed.values);
      expect(framed.values).toEqual(Array.isArray(expected) ? expected : [expected]);
    }
  });
});
