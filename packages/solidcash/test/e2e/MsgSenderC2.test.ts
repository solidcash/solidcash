import { describe, it, expect, beforeAll } from 'vitest';
import { compileString } from 'solidc';
import { vmNumberToBigInt } from '@bitauth/libauth';
import { Contract, StatefulContract, Signer, SignatureTemplate } from '../../src/index.js';
import { keyToSlot, getEntryNftAddress, SortedList } from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { alicePriv, alicePub, alicePkh, bobPriv, bobPub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// A msg.sender-keyed C2 (sorted) mapping - the ERC20 `_balances[msg.sender]` shape. On BCH msg.sender (direct call) =
// tx.origin = the first native P2PKH input's lockscript (emitTxOrigin). The SDK: (1) records a `msgSender` keySource,
// (2) computes slot = keyToSlot(the connected Signer's P2PKH lockscript), (3) forces the signer's native P2PKH funder
// input so emitTxOrigin resolves to it. Sound: a wrong SDK slot fails the on-chain slot==keyToSlot(msg.sender) check;
// a caller cannot forge someone else's msg.sender without their P2PKH signature (cross-sender isolation).
const SRC = `contract C() {
  mapping(address => int) bal;
  function setSelf(int v, pubkey pk, sig s) { require(checkSig(s, pk)); this.bal[msg.sender] = v; }
  function chk(int exp, pubkey pk, sig s) { require(checkSig(s, pk)); require(this.bal[msg.sender] == exp); }
}`;

describe('msg.sender-keyed C2 end-to-end (native P2PKH sender = tx.origin)', () => {
  const provider = createTestProvider();
  const aliceSig = new SignatureTemplate(alicePriv);
  const bobSig = new SignatureTemplate(bobPriv);
  const alice = new Signer(alicePriv, provider);
  const bob = new Signer(bobPriv, provider);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0x8c00;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
  const fund = async (signer: Signer): Promise<void> => {
    await provider.addUtxo(signer.getAddress(), { txid: uid(), vout: 0, satoshis: 200000n });
  };

  let deployed: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];
  let categoryId: string;
  const valOf = async (addr: string): Promise<bigint | undefined> => {
    const ea = getEntryNftAddress(deployed.inner, categoryId, 'bal');
    const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(keyToSlot(addressToLockScript(addr)));
    return e ? vmNumberToBigInt(e.value, { requireMinimalEncoding: false }) as bigint : undefined;
  };

  beforeAll(async () => {
    const art = compileString(SRC, { forceStateful: true });
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    ({ contract: deployed, categoryId } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, aliceSig), initialState: {}, changeAddress: p2pkh.address,
    }));
  });

  it('alice: insert + update + read; wrong value reverts', async () => {
    const sc = deployed.connect(alice);
    await fund(alice);
    await sc.setSelf(100n, alicePub, aliceSig).send();         // insert bal[alice] = 100
    expect(await valOf(alice.getAddress())).toBe(100n);
    await fund(alice);
    await expect(sc.chk(100n, alicePub, aliceSig).send()).resolves.toBeDefined();
    await fund(alice);
    await expect(sc.chk(42n, alicePub, aliceSig).send()).rejects.toThrow(); // adversarial: not 42
    await fund(alice);
    await sc.setSelf(250n, alicePub, aliceSig).send();         // UPDATE bal[alice] = 250
    expect(await valOf(alice.getAddress())).toBe(250n);
  });

  it('cross-sender isolation: bob reads his OWN slot (0), writes his own, alice untouched', async () => {
    const scBob = deployed.connect(bob);
    await fund(bob);
    await expect(scBob.chk(0n, bobPub, bobSig).send()).resolves.toBeDefined(); // bob absent -> 0 (bracket-proven)
    await fund(bob);
    await scBob.setSelf(500n, bobPub, bobSig).send();          // bal[bob] = 500 (distinct entry)
    expect(await valOf(bob.getAddress())).toBe(500n);
    expect(await valOf(alice.getAddress())).toBe(250n);        // alice's balance is untouched by bob
    // bob cannot read alice's balance as his own: his msg.sender is his slot, which holds 500 not 250.
    await fund(bob);
    await expect(scBob.chk(250n, bobPub, bobSig).send()).rejects.toThrow();
  });
});

// The multitransfer DEBIT half: `for(i) bal[msg.sender] -= amts[i]`. A same-(msg.sender)-key scalar RMW in a loop -
// CacheMappingEntryInLoop reads bal[msg.sender] ONCE into a local, applies every subtraction, flushes ONE upsert
// (its flush is a single msg.sender C2 write, proven above). Without caching each iteration would be its own upsert
// and double-spend the entry NFT. VM-proven exact + a wrong value reverts.
describe('msg.sender-keyed C2 RMW in a loop (multitransfer debit)', () => {
  const provider = createTestProvider();
  const aliceSig = new SignatureTemplate(alicePriv);
  const alice = new Signer(alicePriv, provider);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0xae00;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
  const RSRC = `contract C() {
    mapping(address => int) bal;
    function setSelf(int v, pubkey pk, sig s) { require(checkSig(s, pk)); this.bal[msg.sender] = v; }
    function debitMany(int[] amts, pubkey pk, sig s) { require(checkSig(s, pk)); for (int i = 0; i < amts.length; i++) { this.bal[msg.sender] -= amts[i]; } }
    function chk(int exp, pubkey pk, sig s) { require(checkSig(s, pk)); require(this.bal[msg.sender] == exp); }
  }`;

  it('bal[msg.sender] = 100 then debitMany([10,20,30]) = 40 (exact); chk(60) reverts', async () => {
    const art = compileString(RSRC, { forceStateful: true });
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract: deployed, categoryId } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, aliceSig), initialState: {}, changeAddress: p2pkh.address,
    });
    const sc = deployed.connect(alice);
    const fund = async (): Promise<void> => { await provider.addUtxo(alice.getAddress(), { txid: uid(), vout: 0, satoshis: 200000n }); };
    await fund();
    await sc.setSelf(100n, alicePub, aliceSig).send();       // bal[alice] = 100
    await fund();
    await sc.debitMany([10n, 20n, 30n], alicePub, aliceSig).send(); // bal[alice] -= 10,20,30 -> 40 (one upsert)
    const ea = getEntryNftAddress(deployed.inner, categoryId, 'bal');
    const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(keyToSlot(addressToLockScript(alice.getAddress())));
    expect(e && vmNumberToBigInt(e.value, { requireMinimalEncoding: false })).toBe(40n);
    await fund();
    await expect(sc.chk(40n, alicePub, aliceSig).send()).resolves.toBeDefined();
    await fund();
    await expect(sc.chk(60n, alicePub, aliceSig).send()).rejects.toThrow(); // not the intermediate 60
  });
});

// tx.origin resolves the same way (the first native P2PKH input) for a direct call.
describe('tx.origin-keyed C2 end-to-end', () => {
  const provider = createTestProvider();
  const aliceSig = new SignatureTemplate(alicePriv);
  const alice = new Signer(alicePriv, provider);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0x9d00;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
  const TSRC = `contract C() {
    mapping(address => int) bal;
    function setSelf(int v, pubkey pk, sig s) { require(checkSig(s, pk)); this.bal[tx.origin] = v; }
    function chk(int exp, pubkey pk, sig s) { require(checkSig(s, pk)); require(this.bal[tx.origin] == exp); }
  }`;

  it('setSelf(7) via tx.origin; chk(7) reads it back, chk(8) reverts', async () => {
    const art = compileString(TSRC, { forceStateful: true });
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract: deployed } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, aliceSig), initialState: {}, changeAddress: p2pkh.address,
    });
    const sc = deployed.connect(alice);
    await provider.addUtxo(alice.getAddress(), { txid: uid(), vout: 0, satoshis: 200000n });
    await sc.setSelf(7n, alicePub, aliceSig).send();
    await provider.addUtxo(alice.getAddress(), { txid: uid(), vout: 0, satoshis: 200000n });
    await expect(sc.chk(7n, alicePub, aliceSig).send()).resolves.toBeDefined();
    await provider.addUtxo(alice.getAddress(), { txid: uid(), vout: 0, satoshis: 200000n });
    await expect(sc.chk(8n, alicePub, aliceSig).send()).rejects.toThrow();
  });
});
