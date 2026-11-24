/**
 * A4.4's collection journal: a constructor that writes a collection, created through Deploy<C>.
 *
 * `create` keeps a journal of the constructor's writes and verifies the finished list the SDK lays out: the HEAD's
 * link, the entries in increasing slot order each linked to the next, each holding the journal's last value for its
 * slot, every slot of the journal among them, the unused rows without a token, and the census counting the entries.
 * Each tampered creation below changes one thing and must fail `create`; the honest one must pass whole.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, createVirtualMachineBch2026, decodeTransaction, encodeLockingBytecodeP2pkh, hash256, hexToBin,
  lockingBytecodeToCashAddress, sha256,
} from '@bitauth/libauth';
import type { Transaction } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { SignatureTemplate, Signer } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { nextBudgetPad } from '../../src/stateful/deployer.js';
import { getEntryNftAddress } from '../../src/stateful/covenant-helpers.js';
import { clearGenesisReservations } from '../../src/stateful/genesis-reservations.js';
import { addressToLockScript } from '../../src/utils.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const P = 'pragma solidcash ^0.52.0;';
const vm = createVirtualMachineBch2026();

/** The slot the write path computes for an int key: sha256 of its minimal encoding, the top bit cleared. */
function slotOf(key: bigint): Uint8Array {
  const bytes: number[] = [];
  let value = key;
  while (value > 0n) { bytes.push(Number(value & 0xffn)); value >>= 8n; }
  if (bytes.length > 0 && (bytes[bytes.length - 1]! & 0x80) !== 0) bytes.push(0);
  const hash = sha256.hash(Uint8Array.from(bytes));
  hash[31] = hash[31]! & 0x7f;
  return hash;
}

async function createWith(
  source: string, seed: string, args: unknown[] = [], options: Record<string, unknown> = {},
): Promise<{
    result: any; transaction: Transaction; sourceOutputs: any[]; entryLock: (collection: string) => string;
    provider: MockNetworkProvider; artifact: ReturnType<typeof compileString>;
  }> {
  clearGenesisReservations();
  const provider = new MockNetworkProvider({ profile: 'production' });
  const artifact = compileString(source, { deployer: true, messageBus: false, ...options } as never);
  expect(artifact.deployerUnsupported).toBeUndefined();
  const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
  const fundingUtxo: Utxo = { txid: seed.repeat(32), vout: 0, satoshis: 500_000n };
  await provider.seedUtxo(binToHex(authorLock), fundingUtxo);
  const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const result: any = await StatefulContract.deploy(artifact, args as never, {
    provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
    changeAddress: change.address, senderLockingBytecode: authorLock,
  });
  const transaction = decodeTransaction(hexToBin(await provider.getRawTransaction(result.tx.txid)));
  if (typeof transaction === 'string') throw new Error(transaction);
  const prepOutputs = new Map<string, any>();
  for (const hex of result.prepTransactions ?? []) {
    const prep = decodeTransaction(hexToBin(hex));
    if (typeof prep === 'string') throw new Error(prep);
    const txid = binToHex(hash256(hexToBin(hex)).slice().reverse());
    prep.outputs.forEach((output, vout) => prepOutputs.set(`${txid}:${vout}`, output));
  }
  const sourceOutputs = transaction.inputs.map((input) => {
    const output = prepOutputs.get(`${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`);
    if (output === undefined) throw new Error('a creation input does not come from its prep');
    return output;
  });
  const entryLock = (collection: string): string => binToHex(addressToLockScript(
    getEntryNftAddress(result.contract.inner ?? result.contract, result.categoryId, collection),
  ));
  return { result, transaction, sourceOutputs, entryLock, provider, artifact };
}

const runsCreate = (transaction: any, sourceOutputs: any[]): boolean => {
  const state = vm.evaluate({ transaction, sourceOutputs, inputIndex: 0 } as never);
  return vm.stateSuccess(state) === true;
};

describe('A4.4: a constructor writes a collection through Deploy<C>', () => {
  it('lays the entries out in slot order, and create refuses every other list', async () => {
    const { transaction, sourceOutputs, entryLock } = await createWith(
      `${P} contract C { mapping(int => int) m; int n; constructor() { m[5] = 2; m[3] = 4; } function f() public { n = n + 1; } }`,
      'b1',
    );
    expect(vm.verify({ transaction, sourceOutputs } as never)).toBe(true);
    const lock = entryLock('m');
    const rows = transaction.outputs.map((output, index) => ({ output, index }))
      .filter(({ output }) => binToHex(output.lockingBytecode) === lock);
    // The HEAD and the two entries share the entry lock; the HEAD is the one whose slot is 0.
    const head = rows.find(({ output }) => binToHex(output.token!.nft!.commitment.slice(0, 32)) === '00'.repeat(32))!;
    const entries = rows.filter((row) => row !== head);
    expect(entries).toHaveLength(2);
    const [first, second] = entries;
    const s5 = binToHex(slotOf(5n));
    const s3 = binToHex(slotOf(3n));
    const ascending = BigInt(`0x${[...slotOf(5n)].reverse().map((b) => b.toString(16).padStart(2, '0')).join('')}`)
      < BigInt(`0x${[...slotOf(3n)].reverse().map((b) => b.toString(16).padStart(2, '0')).join('')}`) ? [s5, s3] : [s3, s5];
    expect(binToHex(first!.output.token!.nft!.commitment.slice(0, 32))).toBe(ascending[0]);
    expect(binToHex(second!.output.token!.nft!.commitment.slice(0, 32))).toBe(ascending[1]);
    expect(binToHex(head!.output.token!.nft!.commitment.slice(32, 64))).toBe(ascending[0]);

    const tamper = (change: (copy: any) => void): boolean => {
      const copy = structuredClone(transaction);
      change(copy);
      return runsCreate(copy, sourceOutputs);
    };
    expect(tamper(() => undefined)).toBe(true);
    // The entries swapped: out of slot order, and the links no longer follow.
    expect(tamper((copy) => {
      const a = copy.outputs[first!.index];
      copy.outputs[first!.index] = copy.outputs[second!.index];
      copy.outputs[second!.index] = a;
    })).toBe(false);
    // Another value in an entry.
    expect(tamper((copy) => {
      const commitment = copy.outputs[first!.index].token.nft.commitment;
      copy.outputs[first!.index].token.nft.commitment = Uint8Array.from([...commitment.slice(0, 64), 9]);
    })).toBe(false);
    // The HEAD links to the second entry.
    expect(tamper((copy) => {
      const commitment = copy.outputs[head!.index].token.nft.commitment;
      copy.outputs[head!.index].token.nft.commitment = Uint8Array.from([
        ...commitment.slice(0, 32), ...hexToBin(ascending[1]!), ...commitment.slice(64),
      ]);
    })).toBe(false);
    // An entry missing: the second row holds no token, and the first links to none.
    expect(tamper((copy) => {
      copy.outputs[second!.index] = { lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 1200n };
      const commitment = copy.outputs[first!.index].token.nft.commitment;
      copy.outputs[first!.index].token.nft.commitment = Uint8Array.from([
        ...commitment.slice(0, 32), ...new Uint8Array(32), ...commitment.slice(64),
      ]);
    })).toBe(false);
    // A slot the journal does not hold, kept in order and linked.
    expect(tamper((copy) => {
      const forged = slotOf(77n);
      const commitment = copy.outputs[second!.index].token.nft.commitment;
      copy.outputs[second!.index].token.nft.commitment = Uint8Array.from([...forged, ...commitment.slice(32)]);
      const previous = copy.outputs[first!.index].token.nft.commitment;
      copy.outputs[first!.index].token.nft.commitment = Uint8Array.from([
        ...previous.slice(0, 32), ...forged, ...previous.slice(64),
      ]);
    })).toBe(false);
    // An entry at a lock that is not the collection's entry lock.
    expect(tamper((copy) => {
      copy.outputs[second!.index].lockingBytecode = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32), 0x87);
    })).toBe(false);
  }, 600_000);

  it('keeps one entry for a key written twice, and a row with a token where none belongs fails', async () => {
    const { transaction, sourceOutputs, entryLock } = await createWith(
      `${P} contract C { mapping(int => int) m; int n; constructor() { m[1] = 2; m[1] = 3; } function f() public { n = n + 1; } }`,
      'b2',
    );
    expect(vm.verify({ transaction, sourceOutputs } as never)).toBe(true);
    const lock = entryLock('m');
    const rows = transaction.outputs.map((output, index) => ({ output, index }))
      .filter(({ output }) => binToHex(output.lockingBytecode) === lock);
    // The HEAD and one entry, which holds the last value; the second row of the journal holds no token.
    expect(rows).toHaveLength(2);
    const entry = rows.find(({ output }) => binToHex(output.token!.nft!.commitment.slice(0, 32)) !== '00'.repeat(32))!;
    expect(binToHex(entry.output.token!.nft!.commitment.slice(64))).toBe('03');
    const filler = transaction.outputs.findIndex((output, index) => index > entry.index
      && output.token === undefined && binToHex(output.lockingBytecode) === '51');
    expect(filler).toBeGreaterThan(entry.index);
    const copy = structuredClone(transaction);
    copy.outputs[filler] = structuredClone(copy.outputs[entry.index]);
    expect(runsCreate(copy, sourceOutputs)).toBe(false);
    // The earlier value of the key is not what the entry may hold.
    const stale = structuredClone(transaction);
    stale.outputs[entry.index].token!.nft!.commitment = Uint8Array.from([
      ...entry.output.token!.nft!.commitment.slice(0, 64), 2,
    ]);
    expect(runsCreate(stale, sourceOutputs)).toBe(false);
  }, 600_000);

  it('reads the latest earlier write of a key equal at run time, and the default when none', async () => {
    const literal = await createWith(
      `${P} contract C { mapping(int => int) m; int x; int y; int z;
        constructor() { m[4] = 5; m[4] = m[4] + 1; x = m[4]; y = m[7]; z = m[4] + 10; }
        function f() public { x = x + 1; } }`,
      'b4',
    );
    const state = (await literal.result.contract.getState()) as { x?: bigint; y?: bigint; z?: bigint };
    expect(state.x).toBe(6n);
    expect(state.y).toBe(0n);
    expect(state.z).toBe(16n);
  }, 600_000);

  it('journals a literal 0 into bytes20 as 20 zero bytes, as the runtime write stores it', async () => {
    const created = await createWith(
      `${P} contract C { mapping(int => bytes20) m; int x;
        constructor() { m[1] = 0; x = 1; }
        function f() public { require(m[1] == bytes20(0)); x = x + 1; } }`,
      'b9',
    );
    const entry = created.transaction.outputs.find((output: any) => binToHex(output.lockingBytecode)
      === created.entryLock('m') && binToHex(output.token?.nft?.commitment ?? new Uint8Array()).startsWith(binToHex(slotOf(1n))));
    expect(entry).toBeDefined();
    expect(binToHex(entry.token.nft.commitment.slice(64))).toBe('00'.repeat(20));
  }, 600_000);

  it('reads by the slot of a key at run time: two key expressions equal at run time name one entry', async () => {
    const source = `${P} contract C(int a, int b) { mapping(int => int) m; int x; int y;
      constructor() { m[a] = 5; m[b] = m[b] + 1; x = m[a]; y = m[b]; }
      function f() public { x = x + 1; } }`;
    const equal = await createWith(source, 'b5', [4n, 4n]);
    const same = (await equal.result.contract.getState()) as { x?: bigint; y?: bigint };
    expect([same.x, same.y]).toEqual([6n, 6n]);
    const distinct = await createWith(source, 'b6', [4n, 9n]);
    const apart = (await distinct.result.contract.getState()) as { x?: bigint; y?: bigint };
    expect([apart.x, apart.y]).toEqual([5n, 1n]);
  }, 600_000);
  it('creates a child whose constructor writes a collection, through its creator', async () => {
    clearGenesisReservations();
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
    const { compileStringMulti } = await import('../direct-compile.js');
    const artifacts = compileStringMulti(`
      contract Child { mapping(int => int) m; int n; constructor() { m[2] = 7; m[1] = 9; } function f() public { n = n + 1; } }
      contract Maker { int made; function make() { new Child(); made = made + 1; } }`,
    { allowUnsafeOperations: true } as never);
    expect(artifacts.Maker.childDeployers?.Child?.collectionRows.map((row: any) => row.appendSites)).toEqual([2]);
    const deploymentFunding: Utxo = { txid: 'b7'.repeat(32), vout: 0, satoshis: 100_000n };
    await provider.seedUtxo(binToHex(authorLock), deploymentFunding);
    const deployed = await StatefulContract.deploy(artifacts.Maker, [], {
      provider, fundingUtxo: deploymentFunding, funder,
      initialState: { made: 0n }, changeAddress: change.address, senderLockingBytecode: authorLock,
    });
    const prepFunding: Utxo = { txid: 'b8'.repeat(32), vout: 0, satoshis: 100_000n };
    await provider.seedUtxo(binToHex(authorLock), prepFunding);
    const result = await StatefulContract.deployFrom({
      provider, factory: deployed.contract, deployFunctionName: 'make',
      deployFunctionArgs: [], childArtifact: artifacts.Child, childConstructorArgs: [],
      fundingUtxo: prepFunding, funder, changeAddress: change.address,
    });
    const coins = await provider.getUtxosByTokenCategory(result.childCategoryId);
    const commitments = coins.map((utxo) => utxo.token?.nft?.commitment ?? '').filter((commitment) => commitment.length === 2 * 65);
    // Two entries, the values the constructor wrote, each 32 bytes of slot, 32 of link and one byte of value.
    expect(commitments.map((commitment) => commitment.slice(128)).sort()).toEqual(['07', '09']);
    const head = coins.find((utxo) => (utxo.token?.nft?.commitment ?? '').startsWith('00'.repeat(32))
      && (utxo.token?.nft?.commitment ?? '').length === 256);
    expect(head).toBeDefined();
    expect(head!.token!.nft!.commitment.slice(64, 128)).not.toBe('00'.repeat(32));
  }, 600_000);
});

describe('A4.4: a constructor writes a struct-valued collection through Deploy<C>', () => {
  // A struct value is its fields' pushes, as a direct function stores it in an entry: uint64 a as a minimal number
  // (OP_1 … OP_16 for 1 to 16), bytes20 b as 0x14 and 20 bytes, bool c as 0x51 or 0x00.
  const W = '11'.repeat(20);
  const ZERO = '00'.repeat(20);
  const SOURCE = `${P} contract C(bytes20 w) { struct S { uint64 a; bytes20 b; bool c; } mapping(int => S) m;
    uint64 x; bool y; uint64 z;
    constructor() {
      m[1] = S(5, w, true); m[2].a = 7; m[2].c = true; x = m[1].a + m[2].a; y = m[2].c; m[1].a = 9; z = m[1].a + 1;
    }
    function check(int k, uint64 a, bytes20 b, bool c) { require(m[k].a == a); require(m[k].b == b); require(m[k].c == c); } }`;

  it('lays out a whole write and field writes, and the first call reads every field', async () => {
    const { result, transaction, sourceOutputs, entryLock, provider, artifact } = await createWith(SOURCE, 'c1', [hexToBin(W)]);
    expect(artifact.deployer?.collectionRows.map((row: any) => [row.collection, row.appendSites])).toEqual([['m', 4]]);
    expect(vm.verify({ transaction, sourceOutputs } as never)).toBe(true);
    const lock = entryLock('m');
    const rows = transaction.outputs.map((output, index) => ({ output, index }))
      .filter(({ output }) => binToHex(output.lockingBytecode) === lock);
    const commitment = (index: number): string => binToHex(transaction.outputs[index]!.token!.nft!.commitment);
    const head = rows.find(({ index }) => commitment(index).startsWith('00'.repeat(32)))!;
    const entries = rows.filter((row) => row !== head);
    // Two keys, four appends: the value of key 1 is its whole write with a changed by the last field write, the value
    // of key 2 the default with a and c written.
    expect(entries).toHaveLength(2);
    const values = new Map(entries.map(({ index }) => [commitment(index).slice(0, 64), commitment(index).slice(128)]));
    expect(values.get(binToHex(slotOf(1n)))).toBe(`5914${W}51`);
    expect(values.get(binToHex(slotOf(2n)))).toBe(`5714${ZERO}51`);
    // The constructor's own reads saw the journal: 5 + 7 before key 1's field write, key 2's c, and key 1's a after
    // its field write.
    const state = (await result.contract.getState()) as { x?: bigint; y?: boolean; z?: bigint };
    expect(state.x).toBe(12n);
    expect(state.y).toBe(true);
    expect(state.z).toBe(10n);

    // Each tampered creation changes one entry row's commitment, and create must refuse it.
    const one = entries.find(({ index }) => commitment(index).startsWith(binToHex(slotOf(1n))))!.index;
    const two = entries.find(({ index }) => commitment(index).startsWith(binToHex(slotOf(2n))))!.index;
    const withValue = (index: number, value: string): boolean => {
      const copy = structuredClone(transaction);
      const nft = copy.outputs[index]!.token!.nft!;
      nft.commitment = hexToBin(`${binToHex(nft.commitment).slice(0, 128)}${value}`);
      return runsCreate(copy, sourceOutputs);
    };
    expect(withValue(one, `5914${W}51`)).toBe(true);
    expect(withValue(one, `5814${W}51`)).toBe(false);       // field a changed
    expect(withValue(one, `5914${W}00`)).toBe(false);       // field c changed
    expect(withValue(one, `5914${'12'.repeat(20)}51`)).toBe(false); // field b changed
    expect(withValue(one, `5514${W}51`)).toBe(false);       // the whole write before key 1's field write
    expect(withValue(one, `5914${W}`)).toBe(false);         // a field missing
    expect(withValue(two, `0014${ZERO}00`)).toBe(false);    // the default, as if the field writes did not run
    expect(withValue(two, `5714${ZERO}5151`)).toBe(false);  // a byte more
    // The two entries' values swapped, the slots and links kept.
    expect((() => {
      const copy = structuredClone(transaction);
      const left = copy.outputs[one]!.token!.nft!;
      const right = copy.outputs[two]!.token!.nft!;
      const [l, r] = [binToHex(left.commitment), binToHex(right.commitment)];
      left.commitment = hexToBin(`${l.slice(0, 128)}${r.slice(128)}`);
      right.commitment = hexToBin(`${r.slice(0, 128)}${l.slice(128)}`);
      return runsCreate(copy, sourceOutputs);
    })()).toBe(false);

    const signer = new Signer(alicePriv, provider);
    for (let index = 0; index < 4; index += 1) {
      await provider.seedUtxo(signer.getAddress(), {
        txid: `${(0xc4 + index).toString(16)}`.repeat(2).padEnd(64, '0'), vout: 0, satoshis: 100_000n,
      });
    }
    const connected = result.contract.connect(signer) as any;
    await connected.call.check(1n, 9n, hexToBin(W), true).send();
    await connected.call.check(2n, 7n, hexToBin(ZERO), true).send();
    await connected.call.check(3n, 0n, hexToBin(ZERO), false).send();   // an unwritten key is the default struct
    await expect(connected.call.check(1n, 5n, hexToBin(W), true).send()).rejects.toThrow();
  }, 600_000);

  it('creates a child that writes nested and compound fields under two keys, through its creator', async () => {
    clearGenesisReservations();
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
    const { compileStringMulti } = await import('../direct-compile.js');
    // Child's own artifact here is a plain compile, so its constructor keeps to reads its static plan serves.
    const artifacts = compileStringMulti(`
      contract Child { struct T { uint64 p; bool q; } struct S { uint64 a; T t; bytes4 tag; }
        mapping(int => mapping(int => S)) mm; uint64 n;
        constructor() {
          this.mm[2][1] = S(1, T(2, true), 0x01020304); n = mm[2][1].t.p; mm[2][1].t.q = false;
          mm[1][2].a += 3; mm[1][2].a += 4; this.mm[1][2].t.p = 5; mm[3][3].t = T(6, true);
        }
        function check(int i, int j, uint64 a, uint64 p, bool q, bytes4 tag) {
          require(mm[i][j].a == a); require(mm[i][j].t.p == p); require(mm[i][j].t.q == q); require(mm[i][j].tag == tag);
        } }
      contract Maker { int made; function make() { new Child(); made = made + 1; } }`,
    { allowUnsafeOperations: true } as never);
    expect(artifacts.Maker.childDeployers?.Child?.collectionRows.map((row: any) => row.appendSites)).toEqual([6]);
    const deploymentFunding: Utxo = { txid: 'c8'.repeat(32), vout: 0, satoshis: 100_000n };
    await provider.seedUtxo(binToHex(authorLock), deploymentFunding);
    const deployed = await StatefulContract.deploy(artifacts.Maker, [], {
      provider, fundingUtxo: deploymentFunding, funder,
      initialState: { made: 0n }, changeAddress: change.address, senderLockingBytecode: authorLock,
    });
    const prepFunding: Utxo = { txid: 'c9'.repeat(32), vout: 0, satoshis: 100_000n };
    await provider.seedUtxo(binToHex(authorLock), prepFunding);
    const result: any = await StatefulContract.deployFrom({
      provider, factory: deployed.contract, deployFunctionName: 'make',
      deployFunctionArgs: [], childArtifact: artifacts.Child, childConstructorArgs: [],
      fundingUtxo: prepFunding, funder, changeAddress: change.address,
    });
    // Three entries: S(7, T(5, false), 0) built field by field from the default, S(1, T(2, true), 0x01020304) with
    // its nested q cleared, and the default with its nested struct replaced whole. A nested struct is encoded inline.
    const coins = await provider.getUtxosByTokenCategory(result.childCategoryId);
    // Each entry is 32 bytes of slot, 32 of link and 8 of value.
    const values = coins.map((utxo) => utxo.token?.nft?.commitment ?? '')
      .filter((commitment) => commitment.length === 2 * 72).map((commitment) => commitment.slice(128)).sort();
    expect(values).toEqual(['0056510400000000', '5152000401020304', '5755000400000000']);
    expect((await result.child.getState() as { n?: bigint }).n).toBe(2n);

    const signer = new Signer(alicePriv, provider);
    for (let index = 0; index < 4; index += 1) {
      await provider.seedUtxo(signer.getAddress(), {
        txid: `${(0xca + index).toString(16)}`.repeat(2).padEnd(64, '0'), vout: 0, satoshis: 100_000n,
      });
    }
    const child = result.child.connect(signer) as any;
    await child.call.check(1n, 2n, 7n, 5n, false, hexToBin('00000000')).send();
    await child.call.check(2n, 1n, 1n, 2n, false, hexToBin('01020304')).send();
    await child.call.check(3n, 3n, 0n, 6n, true, hexToBin('00000000')).send();
    await expect(child.call.check(2n, 1n, 1n, 2n, true, hexToBin('01020304')).send()).rejects.toThrow();
  }, 600_000);
});

describe('A4.4 "Bounds": create within its journals\' cost bound', () => {
  // The most a create input holds today: twelve appends of 64-byte structs, the largest value an entry takes, and two
  // looks. One more append and the code no longer fits 10,000 bytes.
  const W = 'ab'.repeat(15);
  const source = (appends: number): string => `${P} contract C(bytes15 w) {
    struct S { bytes15 a; bytes15 b; bytes15 c; bytes15 d; } mapping(int => S) m; bytes15 x; bytes15 y;
    constructor() { ${Array.from({ length: appends }, (_, i) => `m[${i + 1}] = S(w, w, w, w);`).join(' ')}
      x = m[1].a; y = m[2].d; }
    function f() public { x = y; } }`;
  const costOf = (transaction: any, sourceOutputs: any[]): number => Number(
    (vm.evaluate({ transaction, sourceOutputs, inputIndex: 0 } as never) as any).metrics.operationCost,
  );

  it('creates a constructor at its bound, whose journals cost less than the bound, and refuses one past it', async () => {
    const box: Record<string, unknown> = {};
    compileString(source(12), { deployer: true, messageBus: false, __deployerTestBox: box } as never);
    const bound = box.journalCost as number;
    // At the bound: the deployer is built and the creation passes.
    const at = await createWith(source(12), 'd1', [hexToBin(W)], { __deployerTestBox: { journalBudget: bound } });
    expect(vm.verify({ transaction: at.transaction, sourceOutputs: at.sourceOutputs } as never)).toBe(true);
    // What the journals cost in the VM: the creation less the same contract's creation with no collection access.
    const control = await createWith(source(0).replace('x = m[1].a; y = m[2].d;', 'x = w; y = w;'), 'd2', [hexToBin(W)]);
    const journals = costOf(at.transaction, at.sourceOutputs) - costOf(control.transaction, control.sourceOutputs);
    expect(journals).toBeGreaterThan(0);
    expect(journals).toBeLessThanOrEqual(bound);
    // Past it: one more append is refused.
    const past = compileString(source(13), {
      deployer: true, messageBus: false, __deployerTestBox: { journalBudget: bound },
    } as never);
    expect(past.deployerUnsupported).toBe('ctor-collection-shape');
  }, 600_000);

  it('grows the budget pad up to the 10,000 bytes of the create unlocking', () => {
    expect(nextBudgetPad(new Uint8Array(), 4_000)?.length).toBe(1);
    expect(nextBudgetPad(new Uint8Array(64), 4_000)?.length).toBe(128);
    // 9,000 bytes with a pad of 4,096, a push of 4,099: the rest is 4,901 bytes, so a pad of 5,096 at most.
    expect(nextBudgetPad(new Uint8Array(4_096), 9_000)?.length).toBe(5_096);
    expect(nextBudgetPad(new Uint8Array(5_096), 10_000)).toBeUndefined();
  });
});
