import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { hexToBin } from '@bitauth/libauth';
import {
  Contract,
  Signer,
} from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos, plainNumerics } from '../test-util.js';
import { alicePriv } from '../fixture/vars.js';

// =============================================================================
// Two writes in one vmap batch that land on ONE key at runtime.
//
// `bal[msg.sender]` and `bal[this.owner]` are distinct key SOURCES, so the
// compiler emits two entry slots. Whenever the owner is the sender they are the
// same key - which, for the ERC-20 fee shape this models, is every transfer out
// of freshly issued supply. Deduping the two writes in the planner settles but
// drops the second one (owner 60 instead of 67); the writes must COMPOSE.
//
// Compose-on-alias: the later slot is the alias row (predOut -2) exactly when its
// slot hash equals an earlier one's, and then names that slot's proof input and
// successor. Both writes run in source order, a read takes the latest earlier
// write of its key, and the key's last write pins the one node at the earliest
// equal slot's output.
// =============================================================================
const SRC = `pragma solidcash >=0.8.0;
contract T(address initialOwner) {
  public address owner;
  mapping(address => int) public bal;
  public int fee;
  constructor() { this.owner = initialOwner; this.fee = 0; }
  function seed(address k, int v) { this.bal[k] = v; }
  function setFee(int f) { this.fee = f; }
  function move(address to, int v) {
    address sender = msg.sender;
    require(this.bal[sender] >= v);
    this.bal[sender] = this.bal[sender] - v;
    this.bal[to] = this.bal[to] + (v - this.fee);
    this.bal[this.owner] = this.bal[this.owner] + this.fee;
  }
}`;

const TOKEN = `pragma solidcash >=0.8.0;
contract Token() {
  mapping(address => int) public bal;
  function seed(address k, int v) { this.bal[k] = v; }
  function transfer(address to, int amount) {
    address sender = msg.sender;
    require(this.bal[sender] >= amount);
    this.bal[sender] = this.bal[sender] - amount;
    this.bal[to] = this.bal[to] + amount;
  }
}`;

const RECIPIENT = hexToBin('aa'.repeat(20));
const THIRD_PARTY = hexToBin('bb'.repeat(20));
const SENDER = addressToLockScript(new Signer(alicePriv, createTestProvider()).getAddress());

interface Fixture {
  sc: StatefulContract;
  signer: Signer;
  read: (k: Uint8Array) => Promise<bigint>;
  entryOffset: (slotIndex: number) => bigint;
}

async function setup(source: string, args: Uint8Array[], state: Record<string, unknown>): Promise<Fixture> {
  const provider = createTestProvider();
  const art = compileString(source, args.length === 0 ? { forceStateful: true } : {});
  const contract = new Contract(art, args, { provider });
  const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, state, { saltContract: true });
  const sc = StatefulContract.withCategory(contract, categoryId);
  const signer = new Signer(alicePriv, provider);
  for (const txid of ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'ea']) {
    await provider.addUtxo(signer.getAddress(), { txid: txid.repeat(32), vout: 0, satoshis: 500000n });
  }
  const read = async (k: Uint8Array): Promise<bigint> =>
    plainNumerics((await (sc.state as Record<string, (x: Uint8Array) => Promise<unknown>>).bal(k)) ?? 0n) as bigint;
  const writer = art.abi.find((fn) => fn.name === 'move' || fn.name === 'transfer')!;
  const entryOffset = (slotIndex: number): bigint => BigInt(writer.blockLayout!.slots
    .find((slot) => slot.kind === 'entry' && slot.slotIndex === slotIndex)!.offset);
  return { sc, signer, read, entryOffset };
}

const feeSetup = async (owner: Uint8Array): Promise<Fixture> => {
  const fixture = await setup(SRC, [owner], { owner, fee: 0n });
  const { sc, signer } = fixture;
  await sc.connect(signer).call.seed(SENDER, 100n).send();
  await sc.connect(signer).call.seed(RECIPIENT, 0n).send();
  if (owner !== SENDER) await sc.connect(signer).call.seed(owner, 0n).send();
  await sc.connect(signer).call.setFee(7n).send();
  return fixture;
};

type Connected = ReturnType<StatefulContract['connect']>;
const forged = (fixture: Fixture, slotIndex: number, witness: { proof?: bigint; predOut?: bigint }): Connected => {
  const sc = fixture.sc.connect(fixture.signer);
  (sc as unknown as StatefulContract)._setRawVMapBatchWitness(slotIndex, witness);
  return sc;
};

describe('vmap batch: two slots resolving to one key at runtime', () => {
  it('settles when the three keys are distinct (control)', async () => {
    const { sc, signer, read } = await feeSetup(THIRD_PARTY);
    await sc.connect(signer).call.move(RECIPIENT, 40n).send();
    expect(await read(SENDER)).toBe(60n);
    expect(await read(RECIPIENT)).toBe(33n);
    expect(await read(THIRD_PARTY), 'the owner was credited the fee').toBe(7n);
  });

  it('composes the debit and the fee credit when the sender IS the owner', async () => {
    const { sc, signer, read } = await feeSetup(SENDER);
    await sc.connect(signer).call.move(RECIPIENT, 40n).send();
    // The fee credit reads the debited balance: 100 - 40 + 7. Deduping would leave 60.
    expect(await read(SENDER)).toBe(67n);
    expect(await read(RECIPIENT)).toBe(33n);
  });

  it('composes three writes of one key in source order', async () => {
    const { sc, signer, read } = await feeSetup(SENDER);
    // Sender, recipient and owner are one key: 100 - 40, + 33, + 7.
    await sc.connect(signer).call.move(SENDER, 40n).send();
    expect(await read(SENDER)).toBe(100n);
    expect(await read(RECIPIENT)).toBe(0n);
  });

  it('refuses an alias row that claims a node of its own, or names another entry', async () => {
    const fixture = await feeSetup(SENDER);
    const { read, entryOffset } = fixture;
    // Slot 2 (the owner) is the sender's key: it must be the alias row of slot 0.
    await expect(forged(fixture, 2, { predOut: -1n }).call.move(RECIPIENT, 40n).send()).rejects.toThrow();
    // An alias row names its owner's proof input; the recipient's entry is a separate node.
    await expect(forged(fixture, 2, { proof: entryOffset(1) }).call.move(RECIPIENT, 40n).send()).rejects.toThrow();
    expect(await read(SENDER)).toBe(100n);
    expect(await read(RECIPIENT)).toBe(0n);
  });

  it('refuses an alias claim for distinct keys, which would drop a write', async () => {
    const fixture = await feeSetup(THIRD_PARTY);
    await expect(forged(fixture, 2, { predOut: -2n }).call.move(RECIPIENT, 40n).send()).rejects.toThrow();
    expect(await fixture.read(SENDER)).toBe(100n);
    expect(await fixture.read(THIRD_PARTY)).toBe(0n);
  });
});

describe('vmap batch: ERC-20 self-transfer', () => {
  it('leaves the balance unchanged and still refuses an overdraw', async () => {
    const { sc, signer, read } = await setup(TOKEN, [], {});
    await sc.connect(signer).call.seed(SENDER, 100n).send();
    await sc.connect(signer).call.transfer(SENDER, 40n).send();
    expect(await read(SENDER)).toBe(100n);
    await expect(sc.connect(signer).call.transfer(SENDER, 101n).send()).rejects.toThrow();
    expect(await read(SENDER)).toBe(100n);
    await sc.connect(signer).call.transfer(RECIPIENT, 40n).send();
    expect(await read(SENDER)).toBe(60n);
    expect(await read(RECIPIENT)).toBe(40n);
  });

  it('refuses a self-transfer whose alias row claims a node of its own', async () => {
    const fixture = await setup(TOKEN, [], {});
    await fixture.sc.connect(fixture.signer).call.seed(SENDER, 100n).send();
    await expect(forged(fixture, 1, { predOut: -1n }).call.transfer(SENDER, 40n).send()).rejects.toThrow();
    expect(await fixture.read(SENDER)).toBe(100n);
  });
});
