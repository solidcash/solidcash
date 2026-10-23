import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import {
  Contract,
  SignatureTemplate,
  TransactionBuilder,
} from '../../src/index.js';
import { getContractFactory } from '../../src/stateful/index.js';
import { type HDSigner } from '../../src/HDSigner.js';
import type { Unlocker, Utxo } from '../../src/interfaces.js';
import { addressToLockScript } from '../../src/utils.js';
import { alicePkh, alicePriv, alicePub, bobAddress } from '../fixture/vars.js';
import { createTestProvider, getSigners } from '../test-util.js';

/**
 * A constructor entered again on a live direct contract.
 *
 * A deployment derives its genesis by running the constructor's arm off chain, so the arm is dispatchable like any
 * entry. Nothing kept a later spend out of it: anyone could enter `__construct` on a live contract and run the
 * constructor again as its caller, taking over an owner or minting a supply twice, and a plain contract's coin was
 * spendable through a constructor that checks nothing. The arm now requires input 0 to spend the category's genesis
 * outpoint, which only the genesis spends.
 *
 * Each stateful contract is deployed honestly, which runs the guarded arm in the deployment's probe, and Bob then
 * enters its constructor: the spend is refused by the guard's name and the state the genesis wrote stands.
 */

const OWNED = `pragma solidcash ^0.14.0;
contract Owned {
  address public owner;
  int public n;
  constructor() { this.owner = msg.sender; }
  function bump() { require(msg.sender == this.owner); this.n = this.n + 1; }
}`;

/** A token whose constructor mints its supply to the deployer. */
const MINTED = `pragma solidcash ^0.14.0;
contract Minted {
  mapping(address => int) public balances;
  int public totalSupply;
  constructor() { this.totalSupply = this.totalSupply + 1000; this.balances[msg.sender] = 1000; }
  function burn() {
    require(this.balances[msg.sender] >= 1);
    this.totalSupply = this.totalSupply - 1;
    this.balances[msg.sender] = this.balances[msg.sender] - 1;
  }
}`;

/** A contract without state: a coin of it is spent only by its owner's signature. */
const VAULT = `contract Vault(bytes20 pkh) {
  constructor() {}
  function spend(pubkey pk, sig s) { require(hash160(pk) == pkh); require(checkSig(s, pk)); }
}`;

const GUARD = 'a constructor runs only in its genesis';

const hex = (value: unknown): string => (value instanceof Uint8Array ? binToHex(value) : String(value));

/** Bob's spend through the constructor, with the preflight naming the require the spend fails at. */
async function replay(contract: any, bob: HDSigner): Promise<string> {
  const previous = process.env.SOLIDC_DEBUG_FAILURE_POINT;
  process.env.SOLIDC_DEBUG_FAILURE_POINT = '1';
  try {
    const result = await contract.connect(bob).getFunction('__construct')();
    return `accepted ${String(result?.txid)}`;
  } catch (error) {
    return String(error);
  } finally {
    if (previous === undefined) delete process.env.SOLIDC_DEBUG_FAILURE_POINT;
    else process.env.SOLIDC_DEBUG_FAILURE_POINT = previous;
  }
}

describe('a direct constructor replayed on a live contract', () => {
  it('keeps the owner the genesis wrote', async () => {
    const [alice, bob] = await getSigners(2, { provider: createTestProvider(), fundingUtxos: 4 });
    const owned: any = await getContractFactory(compileString(OWNED), alice!).deploy();
    const aliceLock = binToHex(addressToLockScript(alice!.getAddress()));
    // The honest genesis ran the guarded constructor for Alice.
    expect(hex(await owned.owner())).toBe(aliceLock);

    expect(await replay(owned, bob!)).toContain(GUARD);
    expect(hex(await owned.owner())).toBe(aliceLock);
    await owned.bump().send();
    expect(await owned.n()).toBe(1n);
  });

  it('mints only at the genesis', async () => {
    const [alice, bob] = await getSigners(2, { provider: createTestProvider(), fundingUtxos: 4 });
    const minted: any = await getContractFactory(compileString(MINTED), alice!).deploy();
    // The honest genesis minted once, to Alice.
    expect(await minted.totalSupply()).toBe(1000n);
    expect(await minted.balances(alice!.getAddress())).toBe(1000n);

    expect(await replay(minted, bob!)).toContain(GUARD);
    expect(await minted.totalSupply()).toBe(1000n);
    expect(await minted.balances(bob!.getAddress())).toBe(0n);
  });

  it('spends a plain contract\'s coin only through its own entries', async () => {
    // A contract without state deploys no genesis of its own, so its coin carries no minting token to match.
    const provider = createTestProvider();
    const vault = new Contract(compileString(VAULT), [alicePkh], { provider });
    const coin: Utxo = { txid: 'ab'.repeat(32), vout: 0, satoshis: 100_000n };
    await provider.addUtxo(vault.address, coin);
    const spend = (unlocker: Unlocker): Promise<unknown> => new TransactionBuilder({ provider })
      .addInput(coin, unlocker).addOutput({ to: bobAddress, amount: 99_000n }).send();

    await expect(spend((vault.unlock as any).__construct())).rejects.toThrow(GUARD);
    await expect(spend(vault.unlock.spend(alicePub, new SignatureTemplate(alicePriv)))).resolves.toBeDefined();
  });
});
