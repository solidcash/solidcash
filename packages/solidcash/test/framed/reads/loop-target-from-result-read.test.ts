import { describe, expect, it } from 'vitest';
import {
  buildPushdataCommitment,
  bytesToHex,
  validatorAddress,
  type Artifact,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployMaster, stateRecordLockingBytecode } from '../../../src/framed/deploy/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { registerDeployment } from '../../../src/stateful/deployment-registry.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory,
} from '../../../../solidc/test/framed/master/validator-input.js';

/**
 * A read whose loop calls a contract an earlier call's result names.
 *
 * The reader asks a directory which store to read, then calls that store once per turn. The store's address is
 * the directory's answer, so the read cannot place the loop's calls from the reader's own facts: it reads in passes,
 * as it does for a loop bound by an earlier result, and plans the turns at the store the answer names. Two stores
 * are deployed and the other one is registered last, so a read that placed the turns by the interface's name
 * instead would reach it, and answer its values.
 */

const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;

const READER_CATEGORY = seededCategory('loop target from result reader');
const DIRECTORY_CATEGORY = seededCategory('loop target from result directory');
const NAMED_CATEGORY = seededCategory('loop target from result named store');
const OTHER_CATEGORY = seededCategory('loop target from result other store');
const DIRECTORY_ADDRESS = validatorAddress(DIRECTORY_CATEGORY, VALIDATOR_PROGRAM);
const NAMED_ADDRESS = validatorAddress(NAMED_CATEGORY, VALIDATOR_PROGRAM);
const OTHER_ADDRESS = validatorAddress(OTHER_CATEGORY, VALIDATOR_PROGRAM);

const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');
const empty = new Uint8Array(0);

/** A store answers ten times the index plus its base; the reader folds the turns of the store the directory names. */
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IStore { function at(int i) view returns (int); }'
  + ' interface IDirectory { function store() view returns (address); }'
  + ' contract Store {'
  + '   int public base;'
  + '   function at(int i) view returns (int) { return i * 10 + this.base; }'
  + ' }'
  + ' contract Directory {'
  + '   address public named;'
  + '   function store() view returns (address) { return this.named; }'
  + ' }'
  + ' contract Reader {'
  + '   int public turns;'
  + '   function sum() view returns (int) {'
  + `     address chosen = IDirectory(0x${hex(DIRECTORY_ADDRESS)}).store();`
  + '     int acc = 0;'
  + '     for (int i = 0; i < this.turns; i = i + 1) {'
  + '       acc = acc * 100 + IStore(chosen).at(i);'
  + '     }'
  + '     return acc;'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const reader = artifacts.Reader!;
const directory = artifacts.Directory!;
const store = artifacts.Store!;

/** One live UTXO as the provider holds it: a token of the category, with the commitment it carries. */
function utxo(txid: string, category: string, capability: 'minting' | 'mutable', commitment: Uint8Array, vout = 0) {
  return {
    txid, vout, satoshis: 20_000n,
    token: { category, amount: 0n, nft: { capability, commitment: bytesToHex(commitment) } },
  };
}

/** A data-NFT commitment as a layout materializes it. */
function recordOf(layout: Artifact['stateLayout'], values: Record<string, bigint | Uint8Array>): Uint8Array {
  return new Uint8Array(Buffer.from(buildPushdataCommitment(layout!, values, 0), 'hex'));
}

/** Funds one deployment: a master for every frame the read runs over it, its record, and the root's validator. */
async function fund(
  provider: MockNetworkProvider,
  options: {
    readonly artifact: Artifact;
    readonly category: Uint8Array;
    readonly seed: string;
    readonly masters: number;
    readonly record: Uint8Array;
    readonly withValidator?: boolean;
  },
): Promise<void> {
  const deployed = deployMaster(options.artifact, options.category, VALIDATOR_PROGRAM);
  const categoryHex = bytesToHex(options.category);
  const txid = (suffix: string, pad: string): string => `${options.seed}${suffix}`.padEnd(64, pad).slice(0, 64);
  for (let index = 0; index < options.masters; index += 1) {
    await provider.addUtxo(bytesToHex(deployed.lockingBytecode),
      utxo(txid('11', 'a'), categoryHex, 'minting', empty, index));
  }
  if (options.withValidator === true) {
    await provider.addUtxo(bytesToHex(deployed.address), utxo(txid('22', 'b'), categoryHex, 'mutable', empty));
  }
  await provider.addUtxo(bytesToHex(stateRecordLockingBytecode(categoryHex)),
    utxo(txid('33', 'c'), categoryHex, 'mutable', options.record));
}

/** Registers a store at its own address, as a deployment registers it, so a read can reach it by address. */
function register(provider: MockNetworkProvider, category: Uint8Array, address: Uint8Array): void {
  registerDeployment(provider, {
    contractName: 'Store', address: hex(address), lockingBytecode: hex(address),
    contract: { artifact: store, categoryId: bytesToHex(category) },
  });
}

/** The reader over two turns, a directory naming the first store, and both stores, the other registered last. */
async function chain(): Promise<MockNetworkProvider> {
  const provider = new MockNetworkProvider();
  await fund(provider, {
    artifact: reader, category: READER_CATEGORY, seed: 'a', masters: 1,
    record: recordOf(reader.stateLayout, { turns: 2n }), withValidator: true,
  });
  await fund(provider, {
    artifact: directory, category: DIRECTORY_CATEGORY, seed: 'b', masters: 1,
    record: recordOf(directory.stateLayout, { named: NAMED_ADDRESS }),
  });
  await fund(provider, {
    artifact: store, category: NAMED_CATEGORY, seed: 'c', masters: 2, record: recordOf(store.stateLayout, { base: 1n }),
  });
  await fund(provider, {
    artifact: store, category: OTHER_CATEGORY, seed: 'd', masters: 2, record: recordOf(store.stateLayout, { base: 5n }),
  });
  register(provider, NAMED_CATEGORY, NAMED_ADDRESS);
  register(provider, OTHER_CATEGORY, OTHER_ADDRESS);
  return provider;
}

describe('a read whose loop calls the contract an earlier call\'s result names', () => {
  it('reaches the store the directory names on every turn, not the one its interface last registered', async () => {
    const result = await readFramedEntry({
      provider: await chain(),
      artifact: reader,
      categoryId: bytesToHex(READER_CATEGORY),
      functionName: 'sum',
      args: [],
      externals: { IDirectory: { artifact: directory, categoryId: bytesToHex(DIRECTORY_CATEGORY) } },
      vm: compositionMachine(),
    });
    expect(result.objection).toBeUndefined();
    expect(result.accepted).toBe(true);
    // The named store's base is 1, so its turns answer 1 and 11; the other store's would answer 5 and 15 (515).
    expect(result.value).toBe(111n);
    expect(result.draft.runs.filter((run) => run.functionName === 'Store.at()')).toHaveLength(2);
  });
});
