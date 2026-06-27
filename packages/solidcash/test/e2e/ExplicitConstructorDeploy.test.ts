import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
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

async function deploy(artifact: ReturnType<typeof compileString>, constructorArgs: unknown[],
  seed: string, initialState: Record<string, bigint>): ReturnType<typeof StatefulContract.deploy> {
  const fundingUtxo: Utxo = { txid: seed.repeat(16), vout: 0, satoshis: 300000n };
  await provider.addUtxo(p2pkh.address, fundingUtxo);
  return StatefulContract.deploy(artifact, constructorArgs as never, {
    provider,
    fundingUtxo,
    funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
    initialState,
    changeAddress: p2pkh.address,
  });
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
    const result = await deploy(artifact, [], 'a1b2', { count: 1n });
    expect(result.categoryId).toBe('a1b2'.repeat(16));
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
    const result = await deploy(artifact, [alicePkh], 'c3d4', { count: 1n });
    expect(result.categoryId).toBe('c3d4'.repeat(16));
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
    const result = await deploy(artifact, [alicePkh], 'e5f6', { count: 1n });
    expect(result.categoryId).toBe('e5f6'.repeat(16));

    // The genesis entry for `owner` exists: check(owner) reads true and spends; check(bob) reads the default
    // (false) and must fail.
    const okTx = await result.contract.call.check(alicePkh).send();
    expect(okTx.txid).toBeDefined();
    await expect(result.contract.call.check(bobPkh).send()).rejects.toThrow();
  });
});
