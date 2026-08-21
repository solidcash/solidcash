/* eslint-disable max-len -- contract source fixtures remain readable as complete declarations */
import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { hexToBin } from '@bitauth/libauth';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// Cross-contract callee sorted writes support scalar UPDATE/INSERT/msg.sender (see CrossContractSortedWrite),
// loop writes (see CrossContractLoopWrite), and long values whose continuation NFTs are placed after all fixed
// participants. The function name is intentionally ordinary: chunk placement is selected from ABI/storage metadata.
describe('cross-contract callee chunkable sorted writes', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0x7c00;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
  const fund = async (addr: string): Promise<void> => { await provider.addUtxo(addr, { txid: uid(), vout: 0, satoshis: 300000n }); };
  const deploy = async (art: any, ctorArgs: any[]): Promise<any> => {
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    return StatefulContract.deploy(art, ctorArgs, {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });
  };
  it('persists a chunked (>60 B) value through an ordinary external call', async () => {
    const IBANK = 'interface IBank { function setBlob(int k, bytes v); }';
    const BANK = `pragma solidcash >=0.8.0;\n${IBANK}\ncontract Bank() is IBank {
      mapping(int => bytes) blob;
      function setBlob(int k, bytes v) { this.blob[k] = v; }
      function chk(int k, bytes exp, pubkey pk, sig s) { require(checkSig(s, pk)); require(this.blob[k] == exp); }
    }`;
    const CALLER = `pragma solidcash >=0.8.0;\n${IBANK}\ncontract Caller(bytes bankAddr) { bigint calls; function poke(int k, bytes v, pubkey pk, sig s) { require(checkSig(s, pk)); IBank(bankAddr).setBlob(k, v); this.calls = this.calls + 1; } }`;
    const artBank = compileString(BANK, { forceStateful: true });
    const artCaller = compileString(CALLER, { forceStateful: true });
    const { contract: bank, categoryId: catBank } = await deploy(artBank, []);
    await fund(bank.address);
    await bank.setBlob(2n, Uint8Array.from([0x01])).send(); // seed
    const bankAddr = bank.inner.withCategory(hexToBin(catBank)).lockingBytecode;
    const { contract: caller } = await deploy(artCaller, [bankAddr]);
    await fund(caller.address);
    const big = new Uint8Array(80).fill(0x5a);
    const write = await caller.poke(9n, big, alicePub, sig)
      .withExternalCall(bank, 'setBlob', [9n, big]).send();
    expect(write.txid).toBeDefined();
    await fund(bank.address);
    expect((await bank.chk(9n, big, alicePub, sig).send()).txid).toBeDefined();
  });
});
