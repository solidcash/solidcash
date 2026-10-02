import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate, StatefulContract, TransactionBuilder } from '../../src/index.js';
import { Utxo } from '../../src/interfaces.js';
import { addressToLockScript } from '../../src/utils.js';
import { createFeeFunder, createTestProvider, expectScriptRejection } from '../test-util.js';
import { alicePkh, alicePriv, alicePub, bobAddress, carolAddress } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

/**
 * Value transfers in exclusive arms, on the direct convention. Semantic analysis gave the arms of a branch shared
 * transfer slots by position, taking one arm as the reference for how many there were:
 *  - it took the if arm whenever that arm held at least half the else arm's transfers, so an else arm sending twice
 *    beside one send in the if arm ran past the reserved slots and failed to compile;
 *  - the other arm's nested branch ended at its if arm's count, so the last send of a longer else arm shared a slot
 *    with the next send of its path, and the transaction was accepted with one of the two never paid;
 *  - that arm's numbering did not reach a `send` inside a declaration.
 * And the SDK read the transfer values a probe pins as one list in output order, so a path that skips a conditional
 * transfer slot put the next slot's values in it and could not settle. Each path now settles with exactly the sends
 * it makes, and a send redirected, missing, or added from the contract's value is refused.
 */
const contract = (name: string, body: string): string => `pragma solidcash >=0.8.0;
contract ${name}(pubkey admin) {
  int counter;
  function f(sig s, bool c, bool d, int x, address r1, address r2) {
    require(checkSig(s, admin));
    ${body}
    this.counter = this.counter + 1;
  }
  function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
}`;

// The else arm sends twice beside one send in the if arm (the transfer sibling of KashiPair's cook).
const ELSE_LONGER = contract('ElseLonger', `
    if (c) {
      payable(r1).transfer(1000);
    } else {
      payable(r1).transfer(1100);
      payable(r2).transfer(1200);
    }`);

// A conditional send, then one action of a chain, one of which sends twice, then a send every path makes.
const CHAIN = contract('Chain', `
    if (c) {
      payable(r2).transfer(900);
    }
    if (x == 1) {
      payable(r1).transfer(1001);
    } else if (x == 2) {
      payable(r1).transfer(1002);
      payable(r2).transfer(1003);
    } else if (x == 3) {
      payable(r2).transfer(1004);
    }
    payable(r1).transfer(500);`);

// The nested else arm is longer than its if arm, and a send follows the nested branch.
const NESTED_TAIL = contract('NestedTail', `
    if (c) {
      payable(r1).transfer(1000);
      payable(r1).transfer(1001);
      payable(r1).transfer(1002);
      payable(r1).transfer(1003);
    } else {
      if (d) {
        payable(r1).transfer(1100);
      } else {
        payable(r1).transfer(1200);
        payable(r2).transfer(1300);
      }
      payable(r1).transfer(1400);
    }`);

// A send inside a declaration, in the arm with fewer sends.
const SEND_IN_DECLARATION = contract('SendInDeclaration', `
    if (c) {
      bool ok = payable(r1).send(1002);
      require(ok);
    } else {
      payable(r1).transfer(1000);
      payable(r2).transfer(1001);
    }`);

// A conditional send before one every path makes: the path that skips it leaves the first slot unused.
const SKIPPED_SLOT = contract('SkippedSlot', `
    if (c) {
      payable(r1).transfer(1000);
    }
    payable(r2).transfer(2000);`);

const ATTACKER = hexToBin(`76a914${'11'.repeat(20)}88ac`);
const BOB = binToHex(addressToLockScript(bobAddress));
const CAROL = binToHex(addressToLockScript(carolAddress));

const raw = (builder: TransactionBuilder): string => binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const lockHex = (to: unknown): string => (typeof to === 'string'
  ? binToHex(addressToLockScript(to)) : binToHex(to as Uint8Array));

type Tamper = { kind: 'redirected' | 'missing' | 'extra'; slot?: number };

interface Row {
  outcome: string;
  // `bob:1000` for each output paying bob or carol, sorted.
  sends: string[];
  // What the satoshi container keeps of its 50,000.
  containerKeeps: bigint;
  // The reserved transfer slots this path pays from, and the ones it leaves unused.
  settled: number[];
  unsettled: number[];
}

/**
 * One honest `f(c, d, x)` paying bob (r1) and carol (r2) from a 50,000-satoshi container, optionally tampered with:
 * `redirected` pays one send's amount to another lock, `missing` drops one send's output, `extra` pays 1,000 more out
 * of the container to another lock, at an unused slot or appended. A fee input past the block pays for any of them,
 * and every input is signed after the change, so a refusal is the covenant's.
 */
const run = async (source: string, [c, d, x]: [boolean, boolean, bigint], tamper?: Tamper): Promise<Row> => {
  const artifact = compileString(source);
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const fundingUtxo: Utxo = { txid: 'a1cd'.repeat(16), vout: 0, satoshis: 200_000n };
  await provider.addUtxo(p2pkh.address, fundingUtxo);
  const { contract: deployed } = await StatefulContract.deploy(artifact, [alicePub], {
    provider,
    fundingUtxo,
    funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
    initialState: { counter: 0n },
    changeAddress: p2pkh.address,
    initialBalance: 50_000n,
  });
  const builder = await (deployed as any).call.f(new SignatureTemplate(alicePriv), c, d, x, bobAddress, carolAddress)
    .build();
  const { utxo, unlocker } = await createFeeFunder(provider, 20_000n);
  builder.addInput(utxo, unlocker);

  const fn = (artifact.abi as any[]).find((entry) => entry.name === 'f');
  const transferSlots = (fn.blockLayout.slots as any[]).filter((slot) => slot.kind === 'transfer');
  const container = (fn.blockLayout.slots as any[]).find((slot) => slot.kind === 'satoshiContainer');
  const outputs = builder.outputs as { to: unknown; amount: bigint }[];
  const pays = (slot: any): boolean => [BOB, CAROL].includes(lockHex(outputs[slot.offset]?.to));
  const settled = transferSlots.filter(pays).map((slot) => slot.slotIndex);
  const unsettled = transferSlots.filter((slot) => !pays(slot)).map((slot) => slot.slotIndex);

  if (tamper) {
    const slot = transferSlots.find((candidate) => candidate.slotIndex === tamper.slot);
    if (tamper.kind === 'redirected') outputs[slot.offset].to = ATTACKER;
    if (tamper.kind === 'missing') outputs.splice(slot.offset, 1);
    if (tamper.kind === 'extra') {
      outputs[container.offset].amount -= 1000n;
      const forged = { to: ATTACKER, amount: 1000n };
      if (slot === undefined) outputs.push(forged); else outputs[slot.offset] = forged;
    }
  }

  let outcome = 'ACCEPTED';
  try {
    await provider.sendRawTransaction(raw(builder));
  } catch (error) {
    outcome = `REJECTED: ${(error as Error).message}`;
  }
  const sends = outputs.filter((output) => [BOB, CAROL].includes(lockHex(output.to)))
    .map((output) => `${lockHex(output.to) === BOB ? 'bob' : 'carol'}:${output.amount}`).sort();
  return { outcome, sends, containerKeeps: outputs[container.offset].amount, settled, unsettled };
};

/**
 * The path settles with exactly `expected` and the container pays exactly their sum; each of its sends redirected
 * or missing, and a send added from the contract's value at each slot it leaves unused or past the block, is refused.
 */
const settlesExactly = async (
  source: string, args: [boolean, boolean, bigint], expected: string[],
): Promise<void> => {
  const honest = await run(source, args);
  expect(honest.outcome).toBe('ACCEPTED');
  expect(honest.sends).toEqual([...expected].sort());
  const paid = expected.reduce((sum, send) => sum + BigInt(send.split(':')[1]), 0n);
  expect(honest.containerKeeps).toBe(50_000n - paid);
  expect(honest.settled).toHaveLength(expected.length);
  for (const slot of honest.settled) {
    expectScriptRejection((await run(source, args, { kind: 'redirected', slot })).outcome, 0);
    expectScriptRejection((await run(source, args, { kind: 'missing', slot })).outcome, 0);
  }
  for (const slot of [...honest.unsettled, undefined]) {
    expectScriptRejection((await run(source, args, { kind: 'extra', slot })).outcome, 0);
  }
};

describe('an else arm sending twice beside one send in the if arm', () => {
  it('settles each arm with its sends', async () => {
    await settlesExactly(ELSE_LONGER, [true, false, 0n], ['bob:1000']);
    await settlesExactly(ELSE_LONGER, [false, false, 0n], ['bob:1100', 'carol:1200']);
  }, 300_000);
});

describe('a chain of actions, one sending twice, between sends of the path', () => {
  it('pays every send of the action that sends twice, which a shared slot dropped', async () => {
    await settlesExactly(CHAIN, [true, false, 2n], ['carol:900', 'bob:1002', 'carol:1003', 'bob:500']);
    await settlesExactly(CHAIN, [false, false, 2n], ['bob:1002', 'carol:1003', 'bob:500']);
  }, 300_000);

  it('settles the other actions, and no action, with their sends', async () => {
    await settlesExactly(CHAIN, [true, false, 1n], ['carol:900', 'bob:1001', 'bob:500']);
    await settlesExactly(CHAIN, [false, false, 3n], ['carol:1004', 'bob:500']);
    await settlesExactly(CHAIN, [true, false, 4n], ['carol:900', 'bob:500']);
    await settlesExactly(CHAIN, [false, false, 4n], ['bob:500']);
  }, 300_000);
});

describe('sends in nested arms', () => {
  it('settles every send of a path through a longer nested else arm', async () => {
    await settlesExactly(NESTED_TAIL, [true, false, 0n], ['bob:1000', 'bob:1001', 'bob:1002', 'bob:1003']);
    await settlesExactly(NESTED_TAIL, [false, true, 0n], ['bob:1100', 'bob:1400']);
    await settlesExactly(NESTED_TAIL, [false, false, 0n], ['bob:1200', 'carol:1300', 'bob:1400']);
  }, 300_000);

  it('settles a send inside a declaration in the arm with fewer sends', async () => {
    await settlesExactly(SEND_IN_DECLARATION, [true, false, 0n], ['bob:1002']);
    await settlesExactly(SEND_IN_DECLARATION, [false, false, 0n], ['bob:1000', 'carol:1001']);
  }, 300_000);
});

describe('a path that skips a conditional send', () => {
  it('settles with the send it makes past the unused slot', async () => {
    await settlesExactly(SKIPPED_SLOT, [true, false, 0n], ['bob:1000', 'carol:2000']);
    await settlesExactly(SKIPPED_SLOT, [false, false, 0n], ['carol:2000']);
  }, 300_000);
});
