import { describe, it, expect } from 'vitest';
import { compileString as _csRawSolidc } from 'solidc';
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> => _csRawSolidc(s, o);
import {
  Contract, SignatureTemplate, StatefulContract,
} from '../../src/index.js';
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
  seed: string, initialState: Record<string, bigint>, initArgs?: unknown[]):
  Promise<{ result: Awaited<ReturnType<typeof StatefulContract.deploy>>; categoryId: string }> {
  const fundingUtxo: Utxo = { txid: seed.repeat(16), vout: 0, satoshis: 300000n };
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
    await expect(result.contract.call.check(bobPkh).send()).rejects.toThrow();
  });
});
