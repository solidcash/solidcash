import { describe, expect, it } from 'vitest';
import { compileString as compile } from 'solidc';
import {
  bigIntToVmNumber, binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { Contract, SignatureTemplate, StatefulContract, TransactionBuilder } from '../../../src/index.js';
import { createTestProvider, expectScriptRejection, setupStatefulUtxos } from '../../test-util.js';
import { randomUtxo } from '../../../src/utils.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import {
  createReadOnlyEntryNftUnlocker, getEntryNftAddress,
} from '../../../src/stateful/covenant-helpers.js';
import {
  bytesToSlotValue, decodeEntryCommitment, encodeEntryCommitment, keyToSlot, slotValueToBytes,
} from '../../../src/stateful/SortedList.js';

/**
 * S1 - mapping insertion and deletion journal transitions.
 *
 * Every hostile case mutates a transaction that the SDK derived and this test CAPTURED without broadcasting, then
 * re-submits the mutation against the same still-unspent inputs. A rejection is therefore covenant evidence, not
 * replay detection, and each block re-sends the untouched transaction as its honest control. Rejections assert the
 * exact BCH-2026 failure rather than "some error", so a construction bug cannot masquerade as a proof.
 *
 * Mutations that add an output pay for the extra bytes out of the trailing change output, otherwise the mock relay
 * rejects on fee before the script ever runs and the case proves nothing.
 */

const SOURCE = `contract S1MappingJournal {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function clear(int k) external { delete m[k]; require(true); }
  function twice(int k, int a, int b) external { m[k] = a; m[k] = b; require(true); }
}`;

// Slots are sha256(key)-derived, so the three keys used for a bracketed insert are chosen by sorting candidates
// rather than by their numeric value: KEYS[i].s is strictly ascending.
const KEYS = Array.from({ length: 60 }, (_, i) => BigInt(i + 1))
  .map((k) => ({ k, s: bytesToSlotValue(keyToSlot(bigIntToVmNumber(k))) }))
  .sort((a, b) => (a.s < b.s ? -1 : 1));
const LOW = KEYS[10];
const MID = KEYS[11];
const HIGH = KEYS[12];
const UNWRITTEN_SLOT = keyToSlot(bigIntToVmNumber(9999n));

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;

interface Deployment {
  provider: Provider;
  contract: Contract<any, any>;
  sc: StatefulContract<any>;
  categoryId: string;
}

async function deploy(): Promise<Deployment> {
  const provider = createTestProvider();
  const artifact = compile(SOURCE, { forceStateful: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, {}, { saltContract: true },
  );
  return { provider, contract, categoryId, sc: StatefulContract.withCategory(contract, categoryId) };
}

/** Derive and capture a transaction without broadcasting it, leaving every input unspent. */
async function capture(provider: Provider, run: () => Promise<unknown>): Promise<string> {
  let captured = '';
  const send = provider.sendRawTransaction.bind(provider);
  (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
    captured = hex;
    throw new Error('capture-only');
  };
  await expect(run()).rejects.toThrow('capture-only');
  (provider as any).sendRawTransaction = send;
  expect(captured).not.toBe('');
  return captured;
}

function mutate(hex: string, apply: (tx: Tx) => void): string {
  const tx = decodeTransactionUnsafe(hexToBin(hex));
  apply(tx);
  return binToHex(encodeTransaction(tx));
}

/** Clone an existing token output, funding the extra bytes from an output that can afford them. */
function appendEntryOutput(tx: Tx, sourceIndex: number, commitment?: Uint8Array): void {
  const source = tx.outputs[sourceIndex];
  // A 1-satoshi output is below the dust threshold on a real node, so BCHN refuses the forgery with
  // `dust (code 64)` before the covenant can object, which proves nothing. On live regtest use a dust-viable
  // value funded from the LARGEST output, since the trailing output is not reliably fat change.
  const liveRegtest = process.env.TESTS_USE_REGTEST === 'true';
  const appendedValue = liveRegtest ? 1200n : 1n;
  if (liveRegtest) {
    const donor = tx.outputs.reduce(
      (best, out, index, all) => (out.valueSatoshis > all[best].valueSatoshis ? index : best), 0,
    );
    const needed = appendedValue + 500n;
    if (tx.outputs[donor].valueSatoshis <= needed) {
      throw new Error(`appendEntryOutput: no output can fund ${needed} satoshis; the forgery would be malformed.`);
    }
    tx.outputs[donor].valueSatoshis -= needed;
  } else {
    tx.outputs[tx.outputs.length - 1].valueSatoshis = 1n;
  }
  tx.outputs.push({
    ...source,
    valueSatoshis: appendedValue,
    lockingBytecode: source.lockingBytecode.slice(),
    token: {
      ...source.token!,
      nft: { ...source.token!.nft!, commitment: commitment ?? source.token!.nft!.commitment.slice() },
    },
  });
}

/** Raise the fee out of an output that can afford it, so a mutation that grows the transaction still relays. */
function fundExtraBytes(tx: Tx, satoshis = 200n): void {
  // The trailing output is not reliably fat change on a live node; draining it pushes it under the dust
  // threshold and BCHN then refuses with `dust (code 64)` before the covenant can object.
  if (process.env.TESTS_USE_REGTEST !== 'true') {
    tx.outputs[tx.outputs.length - 1].valueSatoshis -= satoshis;
    return;
  }
  const donor = tx.outputs.reduce(
    (best, out, index, all) => (out.valueSatoshis > all[best].valueSatoshis ? index : best), 0,
  );
  if (tx.outputs[donor].valueSatoshis <= satoshis + 500n) {
    throw new Error(`fundExtraBytes: no output can fund ${satoshis} satoshis; the forgery would be malformed.`);
  }
  tx.outputs[donor].valueSatoshis -= satoshis;
}

function commitmentOf(tx: Tx, index: number): ReturnType<typeof decodeEntryCommitment> {
  return decodeEntryCommitment(tx.outputs[index].token!.nft!.commitment);
}

function setCommitment(tx: Tx, index: number, commitment: Uint8Array): void {
  tx.outputs[index].token!.nft!.commitment = commitment;
}

/**
 * The covenant refused the transaction inside the BCH-2026 VM. Naming input 0 matters: mutating outputs also
 * invalidates the fee input's signature, so an assertion that accepted any failure would be satisfied by a
 * NULLFAIL at the funding input and would prove nothing about the collection covenant.
 */
async function expectCovenantRejection(provider: Provider, hex: string): Promise<void> {
  const outcome = await provider.sendRawTransaction(hex)
    .then(() => 'ACCEPTED').catch((error: Error) => error.message);
  expect(outcome).toContain('mandatory-script-verify-flag-failed');
  expectScriptRejection(outcome, 0);
  // Not the opcode: BCHN's short form names whatever tripped, and the same tamper surfaces as OP_VERIFY or
  // OP_EQUALVERIFY depending on where the covenant objects. `expectScriptRejection` above already
  // required a script-verify refusal, which is the property under test.
}

/** BCH token validation refused the transaction: no minting authority exists for the forged category. */
async function expectTokenValidationRejection(provider: Provider, hex: string): Promise<void> {
  const outcome = await provider.sendRawTransaction(hex)
    .then(() => 'ACCEPTED').catch((error: Error) => error.message);
  // Same refusal, different wording: the mock says `Transaction violates token validation`, BCHN says
  // `bad-txns-token-invalid-category`. Both mean CashTokens itself refused the foreign category.
  expect(outcome).toMatch(/Transaction violates token validation|bad-txns-token-invalid-category/);
}

async function expectAccepted(provider: Provider, hex: string): Promise<void> {
  await expect(provider.sendRawTransaction(hex)).resolves.toBeTypeOf('string');
}

/**
 * A cold-key insert with a REAL predecessor and a REAL successor: LOW and HIGH are already present, so inserting
 * MID must relink LOW to MID and give MID the successor LOW used to own. The block-layout entry slot carries the
 * newly minted node at output 1; the rewritten predecessor is the trailing insert witness at output 2.
 */
async function capturedBracketedInsert(): Promise<{ deployment: Deployment; hex: string }> {
  const deployment = await deploy();
  await deployment.sc.getFunction('set')(LOW.k, 11n).send();
  await deployment.sc.getFunction('set')(HIGH.k, 22n).send();
  const hex = await capture(deployment.provider, () => deployment.sc.getFunction('set')(MID.k, 33n).send());
  return { deployment, hex };
}

describe('S1 mapping insertion journal transitions', () => {
  it('inserts a cold key between an authenticated predecessor and successor', async () => {
    const { deployment, hex } = await capturedBracketedInsert();
    const tx = decodeTransactionUnsafe(hexToBin(hex));
    const inserted = commitmentOf(tx, 1);
    const predecessor = commitmentOf(tx, 2);
    // The predecessor keeps its own slot and value and now points at the inserted key.
    expect(bytesToSlotValue(predecessor.slot)).toBe(LOW.s);
    expect(bytesToSlotValue(predecessor.nextKey)).toBe(MID.s);
    expect(binToHex(predecessor.value)).toBe('0b');
    // The inserted node owns the successor the predecessor used to own, so nothing is skipped.
    expect(bytesToSlotValue(inserted.slot)).toBe(MID.s);
    expect(bytesToSlotValue(inserted.nextKey)).toBe(HIGH.s);
    expect(binToHex(inserted.value)).toBe('21');
    await expectAccepted(deployment.provider, hex);
  });

  it('inserts past the list tail through the +infinity successor sentinel', async () => {
    const deployment = await deploy();
    await deployment.sc.getFunction('set')(LOW.k, 11n).send();
    const hex = await capture(deployment.provider, () => deployment.sc.getFunction('set')(HIGH.k, 22n).send());
    const inserted = commitmentOf(decodeTransactionUnsafe(hexToBin(hex)), 1);
    expect(bytesToSlotValue(inserted.slot)).toBe(HIGH.s);
    expect(bytesToSlotValue(inserted.nextKey)).toBe(0n);
    await expectAccepted(deployment.provider, hex);
  });

  // Attacks the predecessor -> inserted-key link: the new node would be unreachable from the list head.
  it('rejects an insert whose predecessor keeps its old successor link', async () => {
    const { deployment, hex } = await capturedBracketedInsert();
    await expectCovenantRejection(deployment.provider, mutate(hex, (tx) => {
      const predecessor = commitmentOf(tx, 2);
      setCommitment(tx, 2, encodeEntryCommitment(
        predecessor.slot, slotValueToBytes(HIGH.s), predecessor.value,
      ));
    }));
    await expectAccepted(deployment.provider, hex);
  });

  // Attacks the inserted-key -> successor link: HIGH and everything after it would be stranded.
  it('rejects an insert whose new node strands the successor', async () => {
    const { deployment, hex } = await capturedBracketedInsert();
    await expectCovenantRejection(deployment.provider, mutate(hex, (tx) => {
      const inserted = commitmentOf(tx, 1);
      setCommitment(tx, 1, encodeEntryCommitment(inserted.slot, new Uint8Array(32), inserted.value));
    }));
    await expectAccepted(deployment.provider, hex);
  });

  // Attacks successor ordering by making the new node point backwards at its own predecessor.
  it('rejects an insert whose new node links back to its predecessor', async () => {
    const { deployment, hex } = await capturedBracketedInsert();
    await expectCovenantRejection(deployment.provider, mutate(hex, (tx) => {
      const inserted = commitmentOf(tx, 1);
      setCommitment(tx, 1, encodeEntryCommitment(
        inserted.slot, slotValueToBytes(LOW.s), inserted.value,
      ));
    }));
    await expectAccepted(deployment.provider, hex);
  });

  // Attacks the identity of the inserted entry: the settled slot must be the key the handler actually wrote.
  it('rejects an insert whose new node claims a slot outside the proven gap', async () => {
    const { deployment, hex } = await capturedBracketedInsert();
    await expectCovenantRejection(deployment.provider, mutate(hex, (tx) => {
      const inserted = commitmentOf(tx, 1);
      setCommitment(tx, 1, encodeEntryCommitment(
        slotValueToBytes(HIGH.s + 1n), inserted.nextKey, inserted.value,
      ));
    }));
    await expectAccepted(deployment.provider, hex);
  });

  // Attacks an untouched neighbour: an insert may relink the predecessor but must never restate its value.
  it('rejects an insert that rewrites the predecessor value', async () => {
    const { deployment, hex } = await capturedBracketedInsert();
    await expectCovenantRejection(deployment.provider, mutate(hex, (tx) => {
      const predecessor = commitmentOf(tx, 2);
      setCommitment(tx, 2, encodeEntryCommitment(predecessor.slot, predecessor.nextKey, hexToBin('63')));
    }));
    await expectAccepted(deployment.provider, hex);
  });

  // Attacks authority by locking bytecode: the inserted node must live under the collection entry covenant.
  it('rejects a new node minted outside the collection entry covenant', async () => {
    const { deployment, hex } = await capturedBracketedInsert();
    await expectCovenantRejection(deployment.provider, mutate(hex, (tx) => {
      tx.outputs[1].lockingBytecode = tx.outputs[tx.outputs.length - 1].lockingBytecode.slice();
    }));
    await expectAccepted(deployment.provider, hex);
  });

  // Attacks authority by capability: a non-mutable node can never be spent again by the collection covenant.
  it('rejects a new node minted without the mutable entry capability', async () => {
    const { deployment, hex } = await capturedBracketedInsert();
    await expectCovenantRejection(deployment.provider, mutate(hex, (tx) => {
      tx.outputs[1].token!.nft!.capability = 'none';
    }));
    await expectAccepted(deployment.provider, hex);
  });

  // Attacks authority by category: only the contract's own category may carry its collection nodes.
  it('rejects a new node minted under a foreign token category', async () => {
    const { deployment, hex } = await capturedBracketedInsert();
    await expectTokenValidationRejection(deployment.provider, mutate(hex, (tx) => {
      tx.outputs[1].token!.category = hexToBin('33'.repeat(32));
    }));
    await expectAccepted(deployment.provider, hex);
  });

  // Attacks unique authority over the inserted key: two nodes for one slot fork the list, and a later read can
  // authenticate either of them.
  it('rejects a second authority for the inserted key in the same transaction', async () => {
    const { deployment, hex } = await capturedBracketedInsert();
    await expectCovenantRejection(deployment.provider, mutate(hex, (tx) => appendEntryOutput(tx, 1)));
    await expectAccepted(deployment.provider, hex);
  });

  // Attacks value fabrication: a node for a key the handler never wrote would still satisfy every per-entry
  // authentication a later read performs.
  it('rejects a fabricated node for a key the handler never wrote', async () => {
    const { deployment, hex } = await capturedBracketedInsert();
    await expectCovenantRejection(deployment.provider, mutate(hex, (tx) => appendEntryOutput(
      tx, 1, encodeEntryCommitment(UNWRITTEN_SLOT, new Uint8Array(32), hexToBin('e703')),
    )));
    await expectAccepted(deployment.provider, hex);
  });
});

describe('S1 mapping deletion journal transitions', () => {
  async function capturedDelete(): Promise<{ deployment: Deployment; hex: string }> {
    const deployment = await deploy();
    await deployment.sc.getFunction('set')(LOW.k, 11n).send();
    await deployment.sc.getFunction('set')(HIGH.k, 22n).send();
    const hex = await capture(deployment.provider, () => deployment.sc.getFunction('clear')(LOW.k).send());
    return { deployment, hex };
  }

  it('deletes a present key by clearing its value and preserving its successor link', async () => {
    const { deployment, hex } = await capturedDelete();
    const deleted = commitmentOf(decodeTransactionUnsafe(hexToBin(hex)), 1);
    expect(bytesToSlotValue(deleted.slot)).toBe(LOW.s);
    // The successor link survives the delete, so HIGH stays reachable.
    expect(bytesToSlotValue(deleted.nextKey)).toBe(HIGH.s);
    expect(deleted.value.length).toBe(0);
    await expectAccepted(deployment.provider, hex);
  });

  // Attacks value retention: a delete that leaves the old value settles a state the handler never produced.
  it('rejects a delete that keeps the old value', async () => {
    const { deployment, hex } = await capturedDelete();
    await expectCovenantRejection(deployment.provider, mutate(hex, (tx) => {
      const deleted = commitmentOf(tx, 1);
      // Restoring the value grows the commitment, so the added byte is paid for out of the change output.
      setCommitment(tx, 1, encodeEntryCommitment(deleted.slot, deleted.nextKey, hexToBin('0b')));
      fundExtraBytes(tx);
    }));
    await expectAccepted(deployment.provider, hex);
  });

  // Attacks the successor link: a delete must not strand the rest of the list behind the cleared node.
  it('rejects a delete that strands the successor', async () => {
    const { deployment, hex } = await capturedDelete();
    await expectCovenantRejection(deployment.provider, mutate(hex, (tx) => {
      const deleted = commitmentOf(tx, 1);
      setCommitment(tx, 1, encodeEntryCommitment(deleted.slot, new Uint8Array(32), deleted.value));
    }));
    await expectAccepted(deployment.provider, hex);
  });

  // Attacks value duplication: the deleted value must not survive in a second node for the same slot.
  it('rejects a delete that resurrects the value in a second node', async () => {
    const { deployment, hex } = await capturedDelete();
    await expectCovenantRejection(deployment.provider, mutate(hex, (tx) => appendEntryOutput(
      tx, 1, encodeEntryCommitment(slotValueToBytes(LOW.s), slotValueToBytes(HIGH.s), hexToBin('0b')),
    )));
    await expectAccepted(deployment.provider, hex);
  });

  // Attacks entry fabrication on the delete route, which mints no new node of its own.
  it('rejects a fabricated node minted alongside a delete', async () => {
    const { deployment, hex } = await capturedDelete();
    await expectCovenantRejection(deployment.provider, mutate(hex, (tx) => appendEntryOutput(
      tx, 1, encodeEntryCommitment(UNWRITTEN_SLOT, new Uint8Array(32), hexToBin('e703')),
    )));
    await expectAccepted(deployment.provider, hex);
  });
});

describe('S1 one final authorized flush per physical entry slot', () => {
  async function capturedRepeatedWrite(): Promise<{ deployment: Deployment; hex: string }> {
    const deployment = await deploy();
    await deployment.sc.getFunction('set')(LOW.k, 11n).send();
    const hex = await capture(
      deployment.provider, () => deployment.sc.getFunction('twice')(LOW.k, 44n, 55n).send(),
    );
    return { deployment, hex };
  }

  it('settles two writes to one key as a single authorized entry output', async () => {
    const { deployment, hex } = await capturedRepeatedWrite();
    const tx = decodeTransactionUnsafe(hexToBin(hex));
    const entryOutputs = tx.outputs.filter((output) =>
      (output.token?.nft?.commitment?.length ?? 0) >= 64);
    // Read-your-writes: one physical output carrying only the final value.
    expect(entryOutputs.length).toBe(1);
    expect(binToHex(decodeEntryCommitment(entryOutputs[0].token!.nft!.commitment).value)).toBe('37');
    await expectAccepted(deployment.provider, hex);
  });

  it('rejects settling the intermediate value of a repeated write', async () => {
    const { deployment, hex } = await capturedRepeatedWrite();
    await expectCovenantRejection(deployment.provider, mutate(hex, (tx) => {
      const settled = commitmentOf(tx, 1);
      setCommitment(tx, 1, encodeEntryCommitment(settled.slot, settled.nextKey, hexToBin('2c')));
    }));
    await expectAccepted(deployment.provider, hex);
  });

  // Attacks flush cardinality: one physical slot must not settle twice with two different values.
  it('rejects a second flush of the same physical entry slot', async () => {
    const { deployment, hex } = await capturedRepeatedWrite();
    await expectCovenantRejection(deployment.provider, mutate(hex, (tx) => {
      const settled = commitmentOf(tx, 1);
      appendEntryOutput(tx, 1, encodeEntryCommitment(settled.slot, settled.nextKey, hexToBin('2c')));
    }));
    await expectAccepted(deployment.provider, hex);
  });
});

interface EntryContext {
  deployment: Deployment;
  address: string;
  entry: any;
  p2pkh: Contract<any, any>;
  fee: any;
}

describe('S1 entry authority is held only by the contract master', () => {
  async function insertedEntry(): Promise<EntryContext> {
    const deployment = await deploy();
    await deployment.sc.getFunction('set')(LOW.k, 11n).send();
    const address = getEntryNftAddress(deployment.contract, deployment.categoryId, 'm');
    const entries = await deployment.provider.getUtxos(address);
    const entry = entries.find((utxo: any) =>
      bytesToSlotValue(decodeEntryCommitment(hexToBin(utxo.token!.nft!.commitment)).slot) === LOW.s);
    if (!entry) throw new Error('S1 fixture did not create the inserted entry');
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider: deployment.provider });
    const fee = randomUtxo({ satoshis: 20_000n });
    await deployment.provider.addUtxo(p2pkh.address, fee);
    return { deployment, address, entry, p2pkh, fee };
  }

  /** Spend the entry without co-spending the master: the covenant's read path must fully preserve it. */
  function masterlessSpend(ctx: EntryContext, commitment: string): TransactionBuilder {
    const { deployment, address, entry, p2pkh, fee } = ctx;
    const tx = new TransactionBuilder({ provider: deployment.provider });
    tx.addInput(entry, createReadOnlyEntryNftUnlocker(deployment.contract, deployment.categoryId, 'm'));
    tx.addInput(fee, p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)));
    tx.addOutput({
      to: address,
      amount: entry.satoshis,
      token: {
        category: deployment.categoryId,
        amount: 0n,
        nft: { capability: 'mutable', commitment },
      },
    });
    tx.addOutput({ to: p2pkh.address, amount: 15_000n });
    return tx;
  }

  it('preserves an entry spent without the master', async () => {
    const ctx = await insertedEntry();
    const preserved = ctx.entry.token!.nft!.commitment!;
    const hex = binToHex(encodeTransaction(masterlessSpend(ctx, preserved).buildLibauthTransaction()));
    await expectAccepted(ctx.deployment.provider, hex);
  });

  // Attacks forged authority: rewriting an entry requires the contract master, not just the entry itself.
  it('rejects rewriting an entry value without the contract master', async () => {
    const ctx = await insertedEntry();
    const decoded = decodeEntryCommitment(hexToBin(ctx.entry.token!.nft!.commitment!));
    const forged = binToHex(encodeEntryCommitment(decoded.slot, decoded.nextKey, hexToBin('63')));
    const hex = binToHex(encodeTransaction(masterlessSpend(ctx, forged).buildLibauthTransaction()));
    await expectCovenantRejection(ctx.deployment.provider, hex);
  });

  // Attacks forged authority over the link field specifically: a masterless relink could strand the tail.
  it('rejects relinking an entry without the contract master', async () => {
    const ctx = await insertedEntry();
    const decoded = decodeEntryCommitment(hexToBin(ctx.entry.token!.nft!.commitment!));
    const forged = binToHex(encodeEntryCommitment(decoded.slot, slotValueToBytes(HIGH.s), decoded.value));
    const hex = binToHex(encodeTransaction(masterlessSpend(ctx, forged).buildLibauthTransaction()));
    await expectCovenantRejection(ctx.deployment.provider, hex);
  });
});
