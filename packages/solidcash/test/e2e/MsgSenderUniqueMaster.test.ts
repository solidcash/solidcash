import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// msg.sender minting-path hardening: emitMsgSenderMintingVerification now enforces EXACTLY ONE co-spent
// minting NFT of the SDK-declared caller category. Contract A calls Bank.deposit(); inside Bank,
// msg.sender resolves to A via A's co-spent minting master. If a SECOND minting NFT of A's category is
// co-spent (peer-mode ambiguity), msg.sender could otherwise resolve to a builder-chosen one of several;
// the covenant now fails closed. The honest single-master tx (same code path) still succeeds, so the
// rejection below is attributable to the injected duplicate.
const IBANK = 'interface IBank { function deposit(int amt); }';
const BANK = `pragma solidcash >=0.8.0;
${IBANK}
contract Bank() is IBank {
  mapping(address => int) bal;
  function deposit(int amt) { this.bal[msg.sender] = amt; }
}`;
const CALLER = `pragma solidcash >=0.8.0;
${IBANK}
contract Caller(bytes bankAddr) {
  bigint calls;
  function pay(int amt, pubkey pk, sig s) {
    require(checkSig(s, pk));
    IBank(bankAddr).deposit(amt);
    this.calls = this.calls + 1;
  }
}`;

async function setup(): Promise<{ provider: any; scCaller: any; scBank: any; catCaller: string }> {
  const provider = createTestProvider();
  const artBank = compileString(BANK, { forceStateful: true });
  const artCaller = compileString(CALLER, { forceStateful: true });
  const bank = new Contract(artBank, [], { provider });
  const { categoryId: catBank } = await setupStatefulUtxos(provider, bank, artBank.stateLayout!, {}, { saltContract: true });
  const bankAddr = bank.withCategory(hexToBin(catBank)).lockingBytecode;
  const caller = new Contract(artCaller, [bankAddr], { provider });
  const { categoryId: catCaller } = await setupStatefulUtxos(
    provider, caller, artCaller.stateLayout!, { calls: 0n }, { saltContract: true },
  );
  return {
    provider,
    scCaller: StatefulContract.withCategory(caller, catCaller),
    scBank: StatefulContract.withCategory(bank, catBank),
    catCaller,
  };
}

describe('msg.sender minting-path uniqueness (exactly one co-spent caller master)', () => {
  it('POSITIVE: A calls Bank.deposit(); msg.sender resolves to A from its single co-spent master', async () => {
    const { scCaller, scBank } = await setup();
    const tx = await scCaller.pay(7n, alicePub, new SignatureTemplate(alicePriv))
      .withExternalCall(scBank, 'deposit', [7n]).send();
    expect(tx.txid).toBeDefined();
  });

  it('HOSTILE: a second co-spent minting NFT of the caller category is rejected (fail-closed)', async () => {
    const { provider, scCaller, scBank, catCaller } = await setup();
    const builder = await scCaller.pay(7n, alicePub, new SignatureTemplate(alicePriv))
      .withExternalCall(scBank, 'deposit', [7n]).build();
    // Inject a duplicate minting NFT of A's category at a P2PKH address (burned to fee); the only new fact
    // vs the POSITIVE tx is the second category-A minting master. Lazy signing re-signs over the final tx.
    const p2 = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const dupe = randomUtxo({
      satoshis: 1000n,
      token: { category: catCaller, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
    await provider.addUtxo(p2.address, dupe);
    builder.addInput(dupe, p2.unlock.spend(alicePub, new SignatureTemplate(alicePriv)));
    const raw = binToHex(encodeTransaction(builder.buildLibauthTransaction(true)));
    await expect(provider.sendRawTransaction(raw)).rejects.toThrow();
  });
});
