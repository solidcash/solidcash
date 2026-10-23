/**
 * Labelled NFTs (docs/bcmr/DESIGN.md, section 8): a deployment that publishes `nfts: 'generated'` describes its own
 * NFTs, and a client parsing them with the published bytecode gets each NFT's type and fields.
 */
import { binToHex, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../solidc/src/compiler.js';
import { COMPOSITION_LIMITS } from '../../../solidc/test/framed/machine.js';
import {
  nftCategory, nftTypeKeyHex, parseNft, pushedFields, type NftParseRole,
} from '../../src/bcmr/index.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import Signer from '../../src/Signer.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { deployStatefulContract } from '../../src/stateful/sc-deploy.js';
import type { NftCategory } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { alicePriv } from '../fixture/vars.js';
import { fundShippedFacets } from '../framed/shapes/harness.js';

const LEDGER = `pragma solidcash >=0.8.0;
contract Ledger() {
  int total;
  bool open;
  bytes20 tag;
  event Moved(int amount, bool flag);
  function move(int amount) {
    this.total = this.total + amount;
    this.open = true;
    emit Moved(amount, true);
    require(this.total > 0);
  }
}`;

const NOTES = `pragma solidcash >=0.8.0;
contract Notes() {
  int count;
  event Noted(string text, int delta, bool flag, bytes4 code, bytes data);
  function note(string text, int delta, bytes4 code, bytes data) {
    this.count = this.count + 1;
    emit Noted(text, delta, false, code, data);
    require(this.count > 0);
  }
}`;

const FRAMED = 'pragma solidcash ^0.14.0; contract C { int n;'
  + ' function touch() { this.n = this.n + 1; require(this.n > 0); } }';

const TIMESTAMP = '2026-10-20T12:00:00.000Z';

interface Output {
  lockingBytecode: Uint8Array;
  token?: { category: Uint8Array; nft?: { capability: string; commitment: Uint8Array } };
}

function parseOutput(category: NftCategory, output: Output): ReturnType<typeof parseNft> {
  const bytecode = hexToBin((category.parse as { bytecode: string }).bytecode);
  return parseNft(bytecode, {
    lockingBytecode: output.lockingBytecode,
    category: output.token!.category,
    capability: output.token!.nft!.capability as 'none' | 'mutable' | 'minting',
    commitment: output.token!.nft!.commitment,
  });
}

describe('generated NFT labels', () => {
  it('labels a direct contract\'s master, record and events, and parses their fields', async () => {
    const provider = new MockNetworkProvider();
    const [alice] = await provider.getSigners(1, { fundingUtxos: 2, genesisFundingUtxos: 2 });
    const artifact = compileString(LEDGER, { forceStateful: true });
    const fundingUtxo = (await alice!.getUtxos()).find((utxo) => utxo.vout === 0 && utxo.token === undefined)!;
    const result = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder: alice!.unlockP2PKH(), changeAddress: alice!.getAddress(), initialState: {},
      bcmr: { name: 'Ledger', token: { symbol: 'LEDGER', nfts: 'generated' }, timestamp: TIMESTAMP },
    });
    const nfts = result.registry!.registry.identities![result.categoryId]![TIMESTAMP]!.token!.nfts!;
    const types = (nfts.parse as { types: Record<string, { name: string; fields?: string[] }> }).types;
    expect(Object.values(types).map((type) => type.name))
      .toEqual(['Identity authority', 'Contract master', 'State record', 'Moved event']);
    expect(types[nftTypeKeyHex(3n)]!.fields).toEqual(['total', 'open', 'tag']);
    expect(types[nftTypeKeyHex(4n)]!.fields).toEqual(['Moved.amount', 'Moved.flag']);

    expect(parseOutput(nfts, result.tx.outputs[0]!)).toMatchObject({ typeKey: nftTypeKeyHex(1n), fields: [] });
    const master = result.tx.outputs.find((output) => output.token?.nft?.capability === 'minting')!;
    expect(parseOutput(nfts, master)).toMatchObject({ typeKey: nftTypeKeyHex(2n), fields: [] });

    const ledger = result.contract.connect(alice!) as unknown as {
      move: (amount: bigint) => { send: () => Promise<{ outputs: Output[] }> };
    };
    const call = await ledger.move(5n).send();
    const record = call.outputs.find((output) => output.token?.nft?.capability === 'mutable')!;
    const recordParse = parseOutput(nfts, record);
    if (typeof recordParse === 'string') throw new Error(recordParse);
    expect(recordParse.typeKey).toBe(nftTypeKeyHex(3n));
    expect(recordParse.fields.map(binToHex)).toEqual(['05', '01', '00'.repeat(20)]);

    const event = call.outputs.find((output) => output.token?.nft?.capability === 'none')!;
    const eventParse = parseOutput(nfts, event);
    if (typeof eventParse === 'string') throw new Error(eventParse);
    expect(eventParse.typeKey).toBe(nftTypeKeyHex(4n));
    expect(eventParse.fields.map(binToHex)).toEqual(['05', '01']);
  });

  it('decodes OP_PUSHDATA1, OP_1NEGATE and OP_0 pushes, and shows strings as utf8 and bytes as hex', async () => {
    const provider = new MockNetworkProvider();
    const [alice] = await provider.getSigners(1, { fundingUtxos: 2, genesisFundingUtxos: 2 });
    const artifact = compileString(NOTES, { forceStateful: true });
    const fundingUtxo = (await alice!.getUtxos()).find((utxo) => utxo.vout === 0 && utxo.token === undefined)!;
    const result = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder: alice!.unlockP2PKH(), changeAddress: alice!.getAddress(), initialState: {},
      bcmr: { name: 'Notes', token: { symbol: 'NOTES', nfts: 'generated' }, timestamp: TIMESTAMP },
    });
    const nfts = result.registry!.registry.identities![result.categoryId]![TIMESTAMP]!.token!.nfts!;
    expect(nfts.fields).toMatchObject({
      'Noted.text': { encoding: { type: 'utf8' } },
      'Noted.delta': { encoding: { type: 'number' } },
      'Noted.flag': { encoding: { type: 'number' } },
      'Noted.code': { encoding: { type: 'hex' } },
      'Noted.data': { encoding: { type: 'hex' } },
    });

    const notes = result.contract.connect(alice!) as unknown as {
      note: (text: string, delta: bigint, code: Uint8Array, data: Uint8Array) => {
        send: () => Promise<{ outputs: Output[] }>;
      };
    };
    const text = binToHex(utf8ToBin('x'.repeat(80)));
    const call = await notes.note('x'.repeat(80), -1n, hexToBin('deadbeef'), hexToBin('cafe')).send();
    const event = call.outputs.find((output) => output.token?.nft?.capability === 'none')!;
    // The 80-byte string takes OP_PUSHDATA1, -1 is OP_1NEGATE and false is OP_0.
    expect(binToHex(event.token!.nft!.commitment)).toBe(`4c50${text}4f0004deadbeef02cafe`);
    const parsed = parseOutput(nfts, event);
    if (typeof parsed === 'string') throw new Error(parsed);
    expect(parsed.typeKey).toBe(nftTypeKeyHex(4n));
    expect(parsed.fields.map(binToHex)).toEqual([text, '81', '', 'deadbeef', 'cafe']);
  });

  it('labels a framed contract\'s identity, master, validator and record', async () => {
    const artifact = compileStringMulti(FRAMED, { composition: 'framed' }).C!;
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const alice = new Signer(alicePriv, provider);
    const fundingUtxo = { txid: 'd8'.repeat(32), vout: 0, satoshis: 2_000_000n };
    await provider.addUtxo(alice.getAddress(), fundingUtxo);
    await fundShippedFacets(provider);
    const result = await deployStatefulContract(artifact, [], {
      provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(),
      bcmr: { name: 'C', token: { symbol: 'FRAMED', nfts: 'generated' }, timestamp: TIMESTAMP },
    });
    const nfts = result.registry!.registry.identities![result.categoryId]![TIMESTAMP]!.token!.nfts!;
    const byCapability = (capability: string): Output => result.tx.outputs
      .find((output) => output.token?.nft?.capability === capability)! as Output;
    expect(parseOutput(nfts, byCapability('minting'))).toMatchObject({ typeKey: nftTypeKeyHex(2n) });
    const records = result.tx.outputs.filter((output) => output.token?.nft?.capability === 'mutable') as Output[];
    const parsed = records.map((output) => parseOutput(nfts, output));
    const keys = parsed.map((entry) => (typeof entry === 'string' ? entry : entry.typeKey));
    expect(keys[0]).toBe(nftTypeKeyHex(1n));
    expect(keys).toContain(nftTypeKeyHex(3n));
    expect(keys).toContain(nftTypeKeyHex(4n));
  });

  it('classifies a type only when its fields would not fit the parse budget', () => {
    const lock = Uint8Array.of(0xaa, 0x20, ...new Array(32).fill(1), 0x87);
    const fields = Array.from({ length: 40 }, (_, index) => ({
      id: `f${index}`, name: `f${index}`, encoding: { type: 'number' as const },
    }));
    const sample = Uint8Array.from(Array.from({ length: 40 }, () => [0x01, 0x7f]).flat());
    const roles: NftParseRole[] = [{
      lockingBytecode: lock, capability: 'mutable', type: { key: 1n, name: 'Wide', fields, sample },
    }];
    const category = nftCategory(roles, new Uint8Array(32));
    const types = (category.parse as { types: Record<string, { fields?: string[] }> }).types;
    expect(types[nftTypeKeyHex(1n)]!.fields).toBeUndefined();
    const parsed = parseNft(hexToBin((category.parse as { bytecode: string }).bytecode), {
      lockingBytecode: lock, category: new Uint8Array(32), capability: 'mutable', commitment: sample,
    });
    expect(parsed).toMatchObject({ typeKey: nftTypeKeyHex(1n), fields: [] });
  });

  it('flattens a struct into its members and leaves an array unlabelled', () => {
    const structs = [{ name: 'Pair', fields: [{ name: 'x', type: 'int' }, { name: 'y', type: 'bytes4' }] }];
    expect(pushedFields('p', 'p', 'Pair', structs)?.map((field) => field.id)).toEqual(['p.x', 'p.y']);
    expect(pushedFields('a', 'a', 'int[3]')).toBeUndefined();
    expect(pushedFields('f', 'f', 'fixed128x18')?.[0]?.encoding).toEqual({ type: 'number', decimals: 18 });
  });

  it('shows integers and booleans as numbers, strings as utf8, and bytes and addresses as hex', () => {
    const encoding = (type: string): unknown => pushedFields('v', 'v', type)?.[0]?.encoding;
    expect(encoding('int')).toEqual({ type: 'number' });
    expect(encoding('uint8')).toEqual({ type: 'number' });
    // Our false is an empty push, and BCMR's `boolean` wants exactly 0x00.
    expect(encoding('bool')).toEqual({ type: 'number' });
    expect(encoding('string')).toEqual({ type: 'utf8' });
    expect(encoding('bytes')).toEqual({ type: 'hex' });
    expect(encoding('bytes4')).toEqual({ type: 'hex' });
    expect(encoding('address')).toEqual({ type: 'hex' });
  });
});
