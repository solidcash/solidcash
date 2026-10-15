/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import {
  hexToBin, vmNumberToBigInt, binToHex, decodeTransactionUnsafe, encodeTransaction,
} from '@bitauth/libauth';
import { Contract, SignatureTemplate } from '../../src/index.js';
import {
  StatefulContract,
  keyToSlot,
  keyToSlotMulti,
  getEntryNftAddress,
  SortedList,
} from '../../src/stateful/index.js';
import { alicePriv, alicePub, alicePkh, aliceAddress } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';
import { addressToLockScript } from '../../src/utils.js';

const TOKEN = `pragma solidcash >=0.8.0;
interface IToken { function transferFrom(address from, address to, int amount); }
contract SushiToken() is IToken {
    mapping(address => int) _balances;
    mapping(address => mapping(address => int)) _allowances;
    function setBalance(address who, int amount) { this._balances[who] = amount; }
    function setAllowance(address owner, address spender, int amount) { this._allowances[owner][spender] = amount; }
    function transferFrom(address from, address to, int amount) {
        require(this._balances[from] >= amount);
        require(this._allowances[from][msg.sender] >= amount);
        this._balances[from] = this._balances[from] - amount;
        this._balances[to] = this._balances[to] + amount;
        this._allowances[from][msg.sender] = this._allowances[from][msg.sender] - amount;
    }
}`;

const CALLER = `pragma solidcash >=0.8.0;
interface IToken { function transferFrom(address from, address to, int amount); }
contract SushiBar() {
    bigint calls;
    function enter(address token, address from, int amount, pubkey pk, sig s) {
        require(checkSig(s, pk));
        IToken(token).transferFrom(from, address(this), amount);
        this.calls = this.calls + 1;
    }
}`;

const fromLedger = addressToLockScript(aliceAddress);

describe('SushiBar.enter -> SushiToken.transferFrom (cross-contract vmap write)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0x1b00;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
  const fund = async (addr: string): Promise<void> => {
    await provider.addUtxo(addr, { txid: uid(), vout: 0, satoshis: 200000n });
  };
  const deploy = async (art: any, ctorArgs: any[]): Promise<any> => {
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    return StatefulContract.deploy(art, ctorArgs, {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig),
      initialState: {}, changeAddress: p2pkh.address,
    });
  };
  const balancesOf = async (
    token: any, catToken: string, who: Uint8Array,
  ): Promise<bigint | undefined> => {
    const ea = getEntryNftAddress(token.inner, catToken, '_balances');
    const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(keyToSlot(who));
    return e ? vmNumberToBigInt(e.value, { requireMinimalEncoding: false }) as bigint : undefined;
  };
  const allowanceOf = async (
    token: any, catToken: string, owner: Uint8Array, spender: Uint8Array,
  ): Promise<bigint | undefined> => {
    const ea = getEntryNftAddress(token.inner, catToken, '_allowances');
    const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(keyToSlotMulti([owner, spender]));
    return e ? vmNumberToBigInt(e.value, { requireMinimalEncoding: false }) as bigint : undefined;
  };

  it('settles transferFrom and both _balances and _allowances entries read back', async () => {
    const artToken = compileString(TOKEN, { forceStateful: true });
    const artCaller = compileString(CALLER, { forceStateful: true });
    const { contract: token, categoryId: tokenCat } = await deploy(artToken, []);
    const { contract: caller } = await deploy(artCaller, []);
    const barLedger = addressToLockScript(caller.address);

    await fund(token.address);
    await token.setBalance(fromLedger, 100n).send();
    await fund(token.address);
    await token.setAllowance(fromLedger, barLedger, 30n).send();
    expect(await balancesOf(token, tokenCat, fromLedger)).toBe(100n);
    expect(await allowanceOf(token, tokenCat, fromLedger, barLedger)).toBe(30n);

    await fund(caller.address);
    const tx = await caller.enter(token.inner.lockingBytecode, fromLedger, 20n, alicePub, sig)
      .withExternalCall(token, 'transferFrom', [fromLedger, barLedger, 20n]).send();
    expect(tx.txid).toBeDefined();

    expect(await balancesOf(token, tokenCat, fromLedger)).toBe(80n);
    expect(await balancesOf(token, tokenCat, barLedger)).toBe(20n);
    expect(await allowanceOf(token, tokenCat, fromLedger, barLedger)).toBe(10n);
  });

  it('rejects a wrong predecessor proof co-spent for the callee transferFrom batch', async () => {
    const artToken = compileString(TOKEN, { forceStateful: true });
    const artCaller = compileString(CALLER, { forceStateful: true });
    const { contract: token, categoryId: tokenCat } = await deploy(artToken, []);
    const { contract: caller } = await deploy(artCaller, []);
    const barLedger = addressToLockScript(caller.address);

    await fund(token.address);
    await token.setBalance(fromLedger, 100n).send();
    await fund(token.address);
    await token.setAllowance(fromLedger, barLedger, 30n).send();

    let captured = '';
    const send = provider.sendRawTransaction.bind(provider);
    (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
      captured = hex;
      throw new Error('capture-only');
    };
    await fund(caller.address);
    await expect(caller.enter(token.inner.lockingBytecode, fromLedger, 20n, alicePub, sig)
      .withExternalCall(token, 'transferFrom', [fromLedger, barLedger, 20n]).send())
      .rejects.toThrow('capture-only');
    (provider as any).sendRawTransaction = send;
    expect(captured).not.toBe('');

    const ea = getEntryNftAddress(token.inner, tokenCat, '_allowances');
    const allowanceUtxos = (await provider.getUtxos(ea)).filter((u) => (
      u.token?.category === tokenCat && (u.token?.nft?.commitment?.length ?? 0) > 0
    ));
    const targetSlot = keyToSlotMulti([fromLedger, barLedger]);
    const exact = SortedList.fromUtxos(allowanceUtxos).find(targetSlot);
    expect(exact).toBeDefined();
    // The allowance write is an UPDATE: its proof input is the exact entry. Swap it for a DIFFERENT entry
    // (the collection HEAD) as a deliberately wrong predecessor.
    const wrong = allowanceUtxos.find((u) => !(u.txid === exact!.utxo.txid && u.vout === exact!.utxo.vout));
    expect(wrong).toBeDefined();

    const tx = decodeTransactionUnsafe(hexToBin(captured));
    const entryInputIndex = tx.inputs.findIndex((input) => (
      binToHex(input.outpointTransactionHash) === exact!.utxo.txid && input.outpointIndex === exact!.utxo.vout
    ));
    expect(entryInputIndex).toBeGreaterThanOrEqual(0);

    const mutated = decodeTransactionUnsafe(hexToBin(captured));
    mutated.inputs[entryInputIndex].outpointTransactionHash = hexToBin(wrong!.txid);
    mutated.inputs[entryInputIndex].outpointIndex = wrong!.vout;
    await expect(send(binToHex(encodeTransaction(mutated))))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);

    await expect(send(captured)).resolves.toBeTypeOf('string');
  });
});
