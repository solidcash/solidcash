import { describe, it, expect } from 'vitest';
import { compileString as _csRawSolidc } from '@solidcash/solidc';
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> => _csRawSolidc(s, o);
import {
  Contract,
  SignatureTemplate,
} from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider } from '../test-util.js';
import { alicePriv, alicePub, alicePkh, bobPkh } from '../fixture/vars.js';
import { Utxo } from '../../src/interfaces.js';

// Deploying a stateful contract with an EXPLICIT constructor body (one that runs logic / writes state, rather
// than relying on a synthesized initialState-only __construct) goes through the VM-inference probe in
// StatefulContract._deriveDeployCommitments. The probe spends the genesis master down the __construct branch,
// so the unlock script must push the constructor selector ahead of the redeem script - otherwise the entry
// dispatch underflows. These tests exercise that path end-to-end on the full-eval mock VM.

const provider = createTestProvider();
const p2pkh = new Contract(
  compileString('contract P2PKH(bytes20 pkh) { function spend(pubkey pk, sig s)'
    + ' { require(hash160(pk) == pkh); require(checkSig(s, pk)); } }'),
  [alicePkh],
  { provider },
);

// Returns the deploy result plus the genesis funding txid. On mocknet the funding UTXO keeps the given seed
// txid; on regtest addUtxo mutates it to the real one - either way the derived category equals that txid.
async function deploy(artifact: ReturnType<typeof compileString>, constructorArgs: unknown[],
  seed: string, initialState: Record<string, bigint>, initArgs?: unknown[], fundingSatoshis = 300_000n):
  Promise<{ result: Awaited<ReturnType<typeof StatefulContract.deploy>>; categoryId: string }> {
  const fundingUtxo: Utxo = { txid: seed.repeat(16), vout: 0, satoshis: fundingSatoshis };
  await provider.addUtxo(p2pkh.address, fundingUtxo);
  const result = await StatefulContract.deploy(artifact, constructorArgs as never, {
    provider,
    fundingUtxo,
    funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
    initialState,
    initArgs: initArgs as never,
    changeAddress: p2pkh.address,
  });
  return { result, categoryId: fundingUtxo.txid };
}

describe('explicit-constructor stateful deploy (genesis derivation)', () => {
  it('deploys a minimal explicit constructor that writes a scalar', async () => {
    const artifact = compileString(`
      contract C() {
          int count;
          constructor() { this.count = 1; }
          function bump() { this.count = this.count + 1; }
      }
    `);
    const { result, categoryId } = await deploy(artifact, [], 'a1b2', { count: 1n });
    expect(result.categoryId).toBe(categoryId);
  });

  it('deploys literal empty dynamic values without phantom chunk outputs', async () => {
    const artifact = compileString(`
      contract C() {
          string label;
          string symbol;
          constructor() { this.label = ""; this.symbol = ""; }
          function read() view returns (string) { return this.label; }
      }
    `);
    // Covers the conservative 5,000-sat fee and fixed NFTs, but not phantom reservations for empty chunks.
    const { result } = await deploy(artifact, [], 'e0f1', {}, undefined, 9_000n);
    expect(await result.contract.getState()).toMatchObject({ label: '', symbol: '' });
    // Output 0 is the category's authhead, whose identity NFT is mutable too.
    expect(result.tx.outputs.slice(1).filter((output) => output.token?.nft?.capability === 'mutable'))
      .toHaveLength(artifact.stateLayout!.dataNftCount);
  });

  it('retains a conditional dynamic write after an initial empty literal', async () => {
    const artifact = compileString(`
      contract C() {
          string label;
          constructor(bool replace) {
              this.label = "";
              if (replace) { this.label = "nonempty"; }
          }
          function read() view returns (string) { return this.label; }
      }
    `);
    const { result: empty } = await deploy(artifact, [], 'e1f2', {}, [false]);
    expect((await empty.contract.getState()).label).toBe('');
    const { result: replaced } = await deploy(artifact, [], 'e2f3', {}, [true]);
    expect((await replaced.contract.getState()).label).toBe('nonempty');
  });

  it('deploys the final dynamic value after repeated conditional writes', async () => {
    const artifact = compileString(`
      contract C() {
          string label;
          constructor(bool choose, string left, string right) {
              if (choose) { this.label = left; } else { this.label = right; }
              if (choose) { this.label = right; } else { this.label = left; }
          }
          function read() view returns (string) { return this.label; }
      }
    `);
    const { result: trueBranch } = await deploy(artifact, [], 'e3f4', {}, [true, 'left', 'right']);
    expect((await trueBranch.contract.getState()).label).toBe('right');
    const { result: falseBranch } = await deploy(artifact, [], 'e4f5', {}, [false, 'left', 'right']);
    expect((await falseBranch.contract.getState()).label).toBe('left');
  });

  it('progressively derives multiple NFTs from one fixed constructor pre-state', async () => {
    const artifact = compileString(`
      contract C() {
          int counter;
          int fee;
          int untouched;
          constructor(int value) {
              this.counter = this.counter + 1;
              this.fee = value;
          }
          function read() view returns (int) { return this.counter; }
      }
    `, { commitmentLimit: 4 });
    const { result } = await deploy(artifact, [], 'b2c3', {}, [100n]);
    const state = await result.contract.getState();
    expect(artifact.stateLayout!.dataNftCount).toBeGreaterThan(1);
    expect(state).toMatchObject({ counter: 1n, fee: 100n, untouched: 0n });
  });

  it('derives a finite if/else dynamic constructor assignment from its runtime arguments', async () => {
    const artifact = compileString(`
      contract C() {
          string selected;
          constructor(bool takeLeft, string left, string right) {
              if (takeLeft) {
                  this.selected = left;
              } else {
                  this.selected = right;
              }
          }
          function read() view returns (string) { return this.selected; }
      }
    `);

    expect(artifact.abi.find((entry) => entry.name === '__construct')?.dynamicWriteSources)
      .toMatchObject({ selected: { kind: 'ternary' } });

    const left = 'left branch '.repeat(14);
    const right = 'chosen right branch '.repeat(20);
    const { result: rightResult } = await deploy(artifact, [], 'b3c4', {}, [false, left, right]);
    expect(await rightResult.contract.getState()).toMatchObject({ selected: right });

    const { result: leftResult } = await deploy(artifact, [], 'b4c5', {}, [true, left, right]);
    expect(await leftResult.contract.getState()).toMatchObject({ selected: left });
  });

  it('derives multiple ordered and nested dynamic assignments with branch-dependent chunk counts', async () => {
    const artifact = compileString(`
      contract C() {
          int scalar;
          string selected;
          bytes memo;
          constructor(int route, bool flip, string left, string middle, string right, bytes a, bytes b) {
              this.scalar = 1;
              string aliasValue = left;
              if (flip) { aliasValue = middle; }
              if (route == 0) {
                  this.selected = aliasValue;
              } else if (route == 1) {
                  this.selected = right;
              } else {
                  this.selected = flip ? middle : left;
              }
              this.scalar = 2;
              if (flip) { this.memo = a; } else { this.memo = b; }
          }
          function read() view returns (int) { return this.scalar; }
      }
    `);
    expect(Object.keys(artifact.abi.find((entry) => entry.name === '__construct')
      ?.dynamicWriteSources ?? {}).sort()).toEqual(['memo', 'selected']);

    const short = 'short';
    const middle = 'middle branch '.repeat(12);
    const long = 'long branch with several chunks '.repeat(14);
    const smallMemo = new Uint8Array([1, 2, 3]);
    const largeMemo = new Uint8Array(290).fill(7);

    const { result: shortResult } = await deploy(
      artifact, [], 'b5c6', {}, [0n, false, short, middle, long, largeMemo, smallMemo],
    );
    expect(await shortResult.contract.getState()).toMatchObject({
      scalar: 2n, selected: short, memo: smallMemo,
    });

    const { result: longResult } = await deploy(
      artifact, [], 'b6c7', {}, [1n, true, short, middle, long, largeMemo, smallMemo],
    );
    expect(await longResult.contract.getState()).toMatchObject({
      scalar: 2n, selected: long, memo: largeMemo,
    });

    const mutableOutputs = (result: typeof shortResult): number => result.tx.outputs
      .filter((output) => output.token?.nft?.capability === 'mutable').length;
    expect(mutableOutputs(longResult)).toBeGreaterThan(mutableOutputs(shortResult));
  });

  it('uses the full constructor NFT layout inside a sparse internal helper', async () => {
    const artifact = compileString(`
      contract C() {
          int first;
          int second;
          int third;
          constructor() { initializeThird(); }
          function initializeThird() internal { this.third = 7; }
          function read() view returns (int) { return this.third; }
      }
    `, { commitmentLimit: 4 });
    expect(artifact.stateLayout!.dataNftCount).toBe(3);
    const constructor = artifact.abi.find((entry) => entry.name === '__construct')!;
    expect(constructor.requiredNftIndices).toEqual([0, 1, 2]);

    const { result } = await deploy(artifact, [], 'd4e5', {});
    expect(await result.contract.getState()).toMatchObject({ first: 0n, second: 0n, third: 7n });
  });

  it('derives constructor event commitments using immutable event outputs', async () => {
    const artifact = compileString(`
      contract C() {
          int count;
          event Initialized(int version);
          constructor() {
              this.count = 1;
              emit Initialized(1);
          }
          function read() view returns (int) { return this.count; }
      }
    `);
    const { result } = await deploy(artifact, [], 'f7a8', {});
    expect(result.tx.outputs.some((output) => output.token?.nft?.capability === 'none')).toBe(true);
  });

  it('deploys a constructor that reads an uninitialized mapping (read-before-write, returns default)', async () => {
    // The MultiSig uniqueness pattern: at genesis the mapping is empty, so require(!isOwner[owner]) passes.
    const artifact = compileString(`
      contract Registry(bytes20 owner) {
          mapping(bytes20 => bool) isMember;
          int count;
          constructor() {
              require(!this.isMember[owner]);
              this.count = 1;
          }
          function join(bytes20 who) { this.isMember[who] = true; this.count = this.count + 1; }
      }
    `);
    const { result, categoryId } = await deploy(artifact, [alicePkh], 'c3d4', { count: 1n });
    expect(result.categoryId).toBe(categoryId);
  });

  it('deploys a constructor that reads then writes a mapping entry; the entry persists', async () => {
    const artifact = compileString(`
      contract Registry(bytes20 owner) {
          mapping(bytes20 => bool) isMember;
          int count;
          constructor() {
              require(!this.isMember[owner]);
              this.isMember[owner] = true;
              this.count = 1;
          }
          function check(bytes20 who) { require(this.isMember[who]); }
      }
    `);
    const { result, categoryId } = await deploy(artifact, [alicePkh], 'e5f6', { count: 1n });
    expect(result.categoryId).toBe(categoryId);

    // The genesis entry for `owner` exists: check(owner) reads true and spends; check(bob) reads the default
    // (false) and must fail.
    const okTx = await result.contract.call.check(alicePkh).send();
    expect(okTx.txid).toBeDefined();
    await expect(result.contract.call.check(bobPkh).send()).rejects.toThrow(
      /^messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\.$/,
    );
  });

  it('derives a constructor write to every key of a nested vmap mapping', async () => {
    const artifact = compileString(`
      contract Registry() {
          mapping(int => mapping(int => int)) values;
          constructor() { this.values[1][2] = 3; }
          function check(int a, int b, int expected) { require(this.values[a][b] == expected); }
      }
    `);
    const { result } = await deploy(artifact, [], 'a7b8', {});
    expect((await result.contract.call.check(1n, 2n, 3n).send()).txid).toBeDefined();
    expect((await result.contract.call.check(1n, 3n, 0n).send()).txid).toBeDefined();
  });
});
