/* eslint-disable @typescript-eslint/explicit-function-return-type */
/**
 * A coin a call adds by hand. When the connected signer's own coin covers the fee by itself the SDK adds no funder,
 * so it used to add no change either: the whole surplus went to the miner, refused only by the fee cap in `send()`
 * and by nothing once a built call was sent. A production-profile mock behaves as a real node here.
 */
import { decodeTransaction, hexToBin, binToHex } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';
import MockNetworkProvider from '../src/network/MockNetworkProvider.js';
import {
  StatefulContract, genesisOutpointKey, releaseGenesisOutpoint, reserveGenesisOutpoint,
} from '../src/stateful/index.js';

const SOURCE = `pragma solidcash ^0.50.0;
contract Counter() {
  uint32 n;
  constructor() { this.n = 0; }
  function bump() public { this.n = this.n + 1; }
}`;

const LOGGED = `pragma solidcash ^0.50.0;
contract Logged() {
  event Bumped(uint32 n);
  uint32 n;
  constructor() { this.n = 0; }
  function bump() public { this.n = this.n + 1; emit Bumped(this.n); }
}`;

const hex = (bytes: Uint8Array): string => binToHex(bytes);

let nextCoin = 0;
async function setup(source = SOURCE) {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const [alice, bob] = await provider.getSigners(2, { fundingUtxos: 4, genesisFundingUtxos: 2 });
  const fundingUtxo = (await alice.getUtxos()).find((utxo) => utxo.vout === 0 && !utxo.token && utxo.satoshis >= 200_000n)!;
  const { contract } = await StatefulContract.deploy(compileString(source) as never, [], {
    provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(),
  });
  const coin = async (owner: typeof alice, satoshis: bigint) => {
    nextCoin += 1;
    return provider.seedUtxo(owner.getAddress(), {
      txid: `${'d1'.repeat(31)}${nextCoin.toString(16).padStart(2, '0')}`, vout: 0, satoshis,
    });
  };
  return { provider, alice, bob, counter: contract as any, coin };
}

const decoded = (details: { hex: string }) => decodeTransaction(hexToBin(details.hex)) as any;

describe('a coin added by hand', () => {
  it("returns the signer's surplus as change when it covers the fee alone", async () => {
    const { alice, counter, coin } = await setup();
    const own = await coin(alice, 1_000_000n);
    const before = await counter.getState();
    const details = await counter.connect(alice).call.bump().addInput(own, alice.unlockP2PKH()).send();
    const transaction = decoded(details);
    // The master and the state record, then the coin: no other coin of the signer's was spent.
    expect(transaction.inputs).toHaveLength(3);
    expect(hex(transaction.inputs[2].outpointTransactionHash)).toBe(own.txid);
    const change = transaction.outputs
      .filter((output: any) => hex(output.lockingBytecode) === hex(alice.getLockingBytecode()));
    expect(change).toHaveLength(1);
    // The master and the state record are recreated at what they held, so the coin pays everything past them.
    const past = transaction.outputs.slice(2).reduce((sum: bigint, output: any) => sum + output.valueSatoshis, 0n);
    const fee = own.satoshis - past;
    const size = BigInt(details.hex.length / 2);
    // 1 sat/B, with the few bytes of margin a signature's length can take.
    expect(fee).toBeGreaterThanOrEqual(size);
    expect(fee).toBeLessThanOrEqual(size + 40n);
    expect((await counter.getState()).n).toBe(before.n + 1n);
  });

  it("keeps paying change from the SDK's own funders when the coin falls short", async () => {
    const { alice, counter, coin } = await setup();
    const small = await coin(alice, 700n);
    const details = await counter.connect(alice).call.bump().addInput(small, alice.unlockP2PKH()).send();
    const transaction = decoded(details);
    expect(transaction.inputs.length).toBeGreaterThan(3);
    expect(transaction.outputs
      .some((output: any) => hex(output.lockingBytecode) === hex(alice.getLockingBytecode()))).toBe(true);
  });

  it("does not take another key's coin as the signer's", async () => {
    const { alice, bob, counter, coin } = await setup();
    const theirs = await coin(bob, 1_000_000n);
    await expect(counter.connect(alice).call.bump().addInput(theirs, bob.unlockP2PKH()).send())
      .rejects.toThrow(/maximum fee cap/);
  });

  it('has no one to return change to without a signer, so the cap refuses the burn', async () => {
    const { alice, counter, coin } = await setup();
    const own = await coin(alice, 1_000_000n);
    await expect(counter.call.bump().addInput(own, alice.unlockP2PKH()).send()).rejects.toThrow(/maximum fee cap/);
  });

  it("holds a built call to the call's fee cap when its caller sends it", async () => {
    const { alice, counter, coin } = await setup();
    const own = await coin(alice, 100_000n);
    const built = await counter.connect(alice).call.bump().addInput(own, alice.unlockP2PKH()).build();
    await expect(built.send()).rejects.toThrow(/fee/i);
    const allowed = await counter.connect(alice).call.bump().addInput(own, alice.unlockP2PKH())
      .withMaxFee(200_000n).build();
    const details = await allowed.send();
    expect(details.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('keeps a reserved genesis coin where the call put it, after the funder of an event slot', async () => {
    const { provider, counter } = await setup(LOGGED);
    // A signer whose plain coins are all at vout 0, so the SDK has only genesis-capable coins to fund the event's
    // slot with, and the coin the call adds is the first of them.
    const [, , carol] = await provider.getSigners(3, { fundingUtxos: 1, genesisFundingUtxos: 1 });
    await provider.seedUtxo(carol.getAddress(), { txid: 'e1'.repeat(32), vout: 0, satoshis: 1_000_000n });
    const genesis = (await carol.getUtxos())[0];
    expect(genesis.vout).toBe(0);
    const key = genesisOutpointKey(genesis.txid, genesis.vout);
    const position = async () => {
      const built = await counter.connect(carol).call.bump().addInput(genesis, carol.unlockP2PKH()).build();
      return built.inputs.map((input: any) => `${input.txid}:${input.vout}`).indexOf(key);
    };
    // Unreserved, the SDK funds the slot with it and the coin the call added is the same input, one place early.
    expect(await position()).toBe(2);
    reserveGenesisOutpoint(key);
    try {
      // The master, the state record and the event's own funder, then the coin.
      expect(await position()).toBe(3);
      const details = await counter.connect(carol).call.bump().addInput(genesis, carol.unlockP2PKH()).send();
      expect(hex(decoded(details).inputs[3].outpointTransactionHash)).toBe(genesis.txid);
    } finally {
      releaseGenesisOutpoint(key);
    }
  });
});
