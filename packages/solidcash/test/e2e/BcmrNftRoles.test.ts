/**
 * NFT roles (docs/bcmr/DESIGN.md, section 8): a generated collection classifies each NFT a deployment's category can
 * enumerate by the lock it sits at, selects a record of a multi-record layout by its leading index tag, shows a chunked
 * value by the length its record holds, and leaves a commitment that is not a run of native pushes classified only.
 */
import { binToHex, hexToBin, type NftCategory } from '@bitauth/libauth';
import { encodeEventParameter, type Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import {
  deploymentNftRoles, nftCategory, nftTypeKeyHex, parseNft, type DeploymentNftLocks, type NftParseRole,
} from '../../src/bcmr/index.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { compileString } from '../direct-compile.js';

// Four 33-byte pushes pass the 128-byte commitment, so `d` and `n` start a second record.
const SPLIT = `pragma solidcash >=0.8.0;
contract Split() {
  bytes32 a;
  bytes32 b;
  bytes32 c;
  bytes32 d;
  int n;
  function bump() { this.n = this.n + 1; require(this.n > 0); }
}`;

// One record holds `count` beside the note's length (a `bigint` field would take a data NFT of its own, D49).
const SHELF = `pragma solidcash >=0.8.0;
contract Shelf() {
  int count;
  string note;
  mapping(bigint => bigint) stock;
  event Restocked();
  event Dropped(bigint item) anonymous;
  function restock(bigint item, string label) {
    this.count = this.count + 1;
    this.stock[item] = this.count;
    this.note = label;
    emit Restocked();
    emit Dropped(item);
    require(this.count > 0);
  }
}`;

const TALLY = `pragma solidcash >=0.8.0;
contract Tally() {
  int total;
  event Counted(int value);
  event Reset();
  function count(int value) {
    emit Counted(value);
    emit Reset();
    require(value > 0);
  }
}`;

const TIMESTAMP = '2026-10-20T12:00:00.000Z';

interface Output {
  lockingBytecode: Uint8Array;
  token?: { category: Uint8Array; nft?: { capability: string; commitment: Uint8Array } };
}

type InitialState = NonNullable<Parameters<typeof StatefulContract.deploy>[2]['initialState']>;
type Signer = Awaited<ReturnType<MockNetworkProvider['getSigners']>>[number];

/** A deployment publishing a generated collection, and that collection. */
async function deployGenerated(artifact: Artifact, initialState: InitialState): Promise<{
  readonly alice: Signer;
  readonly result: Awaited<ReturnType<typeof StatefulContract.deploy>>;
  readonly nfts: NftCategory;
}> {
  const provider = new MockNetworkProvider();
  const [alice] = await provider.getSigners(1, { fundingUtxos: 2, genesisFundingUtxos: 2 });
  const fundingUtxo = (await alice!.getUtxos()).find((utxo) => utxo.vout === 0 && utxo.token === undefined)!;
  const result = await StatefulContract.deploy(artifact, [], {
    provider, fundingUtxo, funder: alice!.unlockP2PKH(), changeAddress: alice!.getAddress(), initialState,
    bcmr: { name: artifact.contractName, token: { symbol: 'ROLES', nfts: 'generated' }, timestamp: TIMESTAMP },
  });
  return { alice: alice!, result, nfts: result.registry!.registry.identities![result.categoryId]![TIMESTAMP]!.token!.nfts! };
}

function typesOf(nfts: NftCategory): Record<string, { name: string; fields?: string[] }> {
  return (nfts.parse as { types: Record<string, { name: string; fields?: string[] }> }).types;
}

/** An NFT as a client parsing it with the published bytecode reads it: its type key and field hex, or why it failed. */
function parseOutput(nfts: NftCategory, output: Output): { typeKey: string; fields: string[] } | string {
  const parsed = parseNft(hexToBin((nfts.parse as { bytecode: string }).bytecode), {
    lockingBytecode: output.lockingBytecode,
    category: output.token!.category,
    capability: output.token!.nft!.capability as 'none' | 'mutable' | 'minting',
    commitment: output.token!.nft!.commitment,
  });
  return typeof parsed === 'string' ? parsed : { typeKey: parsed.typeKey, fields: parsed.fields.map(binToHex) };
}

describe('generated NFT roles', () => {
  it('selects each record of a multi-record layout by its leading index tag', async () => {
    const artifact = compileString(SPLIT);
    expect(artifact.stateLayout!.dataNftCount).toBe(2);
    const { result, nfts } = await deployGenerated(artifact, {
      a: new Uint8Array(32).fill(0xaa), d: new Uint8Array(32).fill(0xdd), n: -1n,
    });
    const types = typesOf(nfts);
    expect(types[nftTypeKeyHex(1n)]).toMatchObject({ name: 'Identity authority' });
    expect(types[nftTypeKeyHex(3n)]).toMatchObject({ name: 'State record 0', fields: ['a', 'b', 'c'] });
    expect(types[nftTypeKeyHex(4n)]).toMatchObject({ name: 'State record 1', fields: ['d', 'n'] });

    // The authhead's NFT is the identity authority; both records share one lock, and the tag (OP_0, OP_1) leading
    // each commitment picks its type.
    const [authhead, ...rest] = result.tx.outputs;
    expect(parseOutput(nfts, authhead!)).toEqual({ typeKey: nftTypeKeyHex(1n), fields: [] });
    const records = rest
      .filter((output) => output.token?.nft?.capability === 'mutable')
      .map((output) => parseOutput(nfts, output));
    expect(records).toHaveLength(2);
    expect(records).toEqual(expect.arrayContaining([
      { typeKey: nftTypeKeyHex(3n), fields: ['aa'.repeat(32), '00'.repeat(32), '00'.repeat(32)] },
      { typeKey: nftTypeKeyHex(4n), fields: ['dd'.repeat(32), '81'] },
    ]));
  });

  it('labels entry, chunk and anonymous-event NFTs, and shows a chunked value by its length', async () => {
    const { alice, result, nfts } = await deployGenerated(compileString(SHELF), {});
    const types = typesOf(nfts);
    const names = ['Contract master', 'State record', 'stock entry', 'note chunk', 'Restocked event', 'Anonymous event'];
    expect(Object.values(types).map((type) => type.name)).toEqual(['Identity authority', ...names]);
    // The record holds the note's length; its bytes live in chunks.
    expect(types[nftTypeKeyHex(3n)]!.fields).toEqual(['count', 'note.length']);
    expect(nfts.fields!['note.length']).toEqual({ name: 'note length', encoding: { type: 'number' } });

    const shelf = result.contract.connect(alice) as unknown as {
      restock: (item: bigint, label: string) => { send: () => Promise<{ outputs: Output[] }> };
    };
    const call = await shelf.restock(4n, 'oak').send();
    const parsed = call.outputs
      .filter((output) => output.token?.nft !== undefined)
      .map((output) => parseOutput(nfts, output));
    const parsedNames = parsed.map((entry) => (typeof entry === 'string' ? entry : types[entry.typeKey]!.name));
    expect(parsedNames).toEqual(expect.arrayContaining(names));
    expect(parsed).toContainEqual({ typeKey: nftTypeKeyHex(3n), fields: ['01', '03'] });
  });

  it('leaves events in EVM notation and events without parameters classified only', () => {
    const lock = (byte: number): Uint8Array => Uint8Array.of(0xaa, 0x20, ...new Array(32).fill(byte), 0x87);
    const locks: DeploymentNftLocks = {
      authhead: lock(7),
      masters: [lock(1)],
      records: lock(2),
      entry: () => lock(3),
      chunk: () => lock(4),
      event: (event) => lock(event.name === 'Counted' ? 5 : 6),
    };
    const typeNamed = (roles: readonly NftParseRole[], name: string): NonNullable<NftParseRole['type']> => roles
      .map((role) => role.type)
      .find((type) => type?.name === name)!;
    const native = deploymentNftRoles(compileString(TALLY), locks);
    const evmArtifact = compileString(TALLY, { evmCompat: true });
    const evm = deploymentNftRoles(evmArtifact, locks);
    expect(typeNamed(native, 'Counted event').fields?.map((field) => field.id)).toEqual(['Counted.value']);
    // In EVM notation the value is a 32-byte word, not a push.
    expect(typeNamed(evm, 'Counted event').fields).toBeUndefined();
    expect(typeNamed(native, 'Reset event').fields).toBeUndefined();
    expect(typeNamed(evm, 'Reset event').fields).toBeUndefined();

    // A client reads the word-notated event as its type alone.
    const counted = evmArtifact.events!.find((event) => event.name === 'Counted')!;
    expect(counted.parameters[0]!.notation).toBe('evm');
    const collection = nftCategory(evm, new Uint8Array(32));
    expect(typesOf(collection)[nftTypeKeyHex(4n)]).toEqual({ name: 'Counted event', description: expect.any(String) });
    expect(parseOutput(collection, {
      lockingBytecode: lock(5),
      token: {
        category: new Uint8Array(32),
        nft: { capability: 'none', commitment: encodeEventParameter(7n, counted.parameters[0]!) },
      },
    })).toEqual({ typeKey: nftTypeKeyHex(4n), fields: [] });
  });
});
