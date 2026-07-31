import { describe, expect, it } from 'vitest';
import { compileString as compile } from 'solidc';
import {
  bigIntToVmNumber, binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { bytesToSlotValue, encodeEntryCommitment, keyToSlot } from '../../src/stateful/SortedList.js';
import { alicePkh } from '../fixture/vars.js';

/**
 * S1 follow-up: the collection-address output cardinality pin, widened.
 *
 * The pin used to be emitted only when a collection owned exactly ONE entry slot in the function. A slot is
 * created by a READ as well as by a write, while the batch route is entered on the count of WRITES, so
 * `m[a] = m[b] + 1` had two slots, one write, no batch verifier and no pin - and both C2 arms then accepted a
 * fabricated node for a key the handler never wrote. `S1ReviewMultiSlotForgery.test.ts` owns that two-slot
 * regression; this file covers the shapes that file does not: three slots, a read of the SAME key as the write,
 * a still-suppressed loop shape, and the delegate condition.
 */

const SOURCE = `contract S1Cardinality {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  // Three slots for one collection: two reads and one write.
  function combine(int a, int b, int c) external { m[a] = m[b] + m[c] + 1; require(true); }
  // Two slots where the read key EQUALS the write key, so one physical entry backs both.
  function bump(int k) external { m[k] = m[k] + 1; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
}`;

// A dynamic loop write keeps the pin suppressed: its output count is only known at runtime and the loop
// teardown pins it with its own scan.
const LOOP_SOURCE = `contract S1CardinalityLoop {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function fill(int[] keys, int[] values, int n) external {
    for (int i = 0; i < n; i = i + 1) { m[keys[i]] = values[i]; }
    require(n >= 0);
  }
}`;

const KEYS = Array.from({ length: 60 }, (_, i) => BigInt(i + 1))
  .map((k) => ({ k, s: bytesToSlotValue(keyToSlot(bigIntToVmNumber(k))) }))
  .sort((a, b) => (a.s < b.s ? -1 : 1));
const FAR = KEYS[0];
const OTHER = KEYS[1];
const LOW = KEYS[10];
const MID = KEYS[11];
const HIGH = KEYS[12];
const UNWRITTEN_SLOT = keyToSlot(bigIntToVmNumber(9999n));

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;

async function deploy(source: string): Promise<{ provider: Provider; sc: StatefulContract<any> }> {
  const provider = createTestProvider();
  const artifact = compile(source, { forceStateful: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, {}, { saltContract: true },
  );
  return { provider, sc: StatefulContract.withCategory(contract, categoryId) };
}

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

function entryOutputIndices(tx: Tx): number[] {
  return tx.outputs.flatMap((o, i) => ((o.token?.nft?.commitment.length ?? 0) >= 64 ? [i] : []));
}

function appendEntryOutput(tx: Tx, sourceIndex: number, commitment: Uint8Array): void {
  const source = tx.outputs[sourceIndex];
  tx.outputs[tx.outputs.length - 1].valueSatoshis = 1n;
  tx.outputs.push({
    ...source,
    valueSatoshis: 1n,
    lockingBytecode: source.lockingBytecode.slice(),
    token: { ...source.token!, nft: { ...source.token!.nft!, commitment } },
  });
}

async function expectCovenantRejection(provider: Provider, hex: string): Promise<void> {
  const outcome = await provider.sendRawTransaction(hex)
    .then(() => 'ACCEPTED').catch((error: Error) => error.message);
  expect(outcome).toContain('mandatory-script-verify-flag-failed');
  expect(outcome).toContain('error in evaluating input index 0');
}

const forged = (): Uint8Array =>
  encodeEntryCommitment(UNWRITTEN_SLOT, new Uint8Array(32), hexToBin('e703'));

describe('S1 collection-address cardinality across multi-slot shapes', () => {
  // Three slots, one write: the expected count is the write's own footprint plus one per co-spent read.
  it('rejects an extra node alongside a three-slot insert', async () => {
    const { provider, sc } = await deploy(SOURCE);
    await sc.getFunction('set')(FAR.k, 5n).send();
    await sc.getFunction('set')(OTHER.k, 6n).send();
    await sc.getFunction('set')(LOW.k, 11n).send();
    await sc.getFunction('set')(HIGH.k, 22n).send();
    const hex = await capture(provider, () => sc.getFunction('combine')(MID.k, FAR.k, OTHER.k).send());
    await expectCovenantRejection(provider, mutate(hex, (tx) =>
      appendEntryOutput(tx, entryOutputIndices(tx)[0], forged())));
    await expect(provider.sendRawTransaction(hex)).resolves.toBeTypeOf('string');
  }, 180_000);

  it('rejects an extra node alongside a three-slot update', async () => {
    const { provider, sc } = await deploy(SOURCE);
    await sc.getFunction('set')(FAR.k, 5n).send();
    await sc.getFunction('set')(OTHER.k, 6n).send();
    await sc.getFunction('set')(LOW.k, 11n).send();
    const hex = await capture(provider, () => sc.getFunction('combine')(LOW.k, FAR.k, OTHER.k).send());
    await expectCovenantRejection(provider, mutate(hex, (tx) =>
      appendEntryOutput(tx, entryOutputIndices(tx)[0], forged())));
    await expect(provider.sendRawTransaction(hex)).resolves.toBeTypeOf('string');
  }, 180_000);

  // Read-modify-write of ONE key: the read and the write canonicalize to one physical entry, so the extra count
  // must stay zero. If the widened guard counted slots blindly this honest transaction would stop settling.
  it('settles a same-key read-modify-write and still rejects an extra node', async () => {
    const { provider, sc } = await deploy(SOURCE);
    await sc.getFunction('set')(LOW.k, 11n).send();
    const hex = await capture(provider, () => sc.getFunction('bump')(LOW.k).send());
    await expectCovenantRejection(provider, mutate(hex, (tx) =>
      appendEntryOutput(tx, entryOutputIndices(tx)[0], forged())));
    await expect(provider.sendRawTransaction(hex)).resolves.toBeTypeOf('string');
    await sc.getFunction('check')(LOW.k, 12n).send();
  }, 180_000);

  // The forged key must stay unreadable after the honest transaction settles.
  it('leaves the unwritten key unreadable after an honest three-slot write', async () => {
    const { sc } = await deploy(SOURCE);
    await sc.getFunction('set')(FAR.k, 5n).send();
    await sc.getFunction('set')(OTHER.k, 6n).send();
    await sc.getFunction('set')(LOW.k, 11n).send();
    await sc.getFunction('combine')(MID.k, FAR.k, OTHER.k).send();
    await sc.getFunction('check')(MID.k, 12n).send();
    await expect(sc.getFunction('check')(9999n, 999n).send()).rejects.toThrow('layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.');
  }, 180_000);

  // A runtime loop write still suppresses the pin, and must still settle: its output count is not statically
  // known, and the loop teardown carries its own count scan.
  it('still admits a dynamic loop write, whose count is pinned by the loop teardown', async () => {
    const { sc } = await deploy(LOOP_SOURCE);
    await sc.getFunction('set')(FAR.k, 1n).send();
    await sc.getFunction('fill')([LOW.k, MID.k], [7n, 8n], 2n).send();
  }, 180_000);
});

/**
 * The fifth suppressing condition is `!this.currentFunctionIsDelegate`. Worker A reported it as untested rather
 * than cleared, so it is measured here instead of reasoned about: on this baseline a C2 sorted mapping write
 * inside a `delegate` function has no settling instance at all, so there is no honest transaction to attack.
 * The scalar control uses the same proxy shape and settles, so the failure is the C2 write and not the harness.
 */
// The scalar control is the exact pair `Delegatecall.test.ts` already settles; the C2 pair adds one mapping and
// one delegate function to it, so the only difference between the two runs is the C2 write itself.
const DELEGATE_SCALAR_IMPL = `pragma solidcash >=0.8.0;
contract DelegateImpl() {
    bigint counter;
    function increment() delegate { this.counter = this.counter + 1; }
    function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
}`;
const DELEGATE_SCALAR_PROXY = `pragma solidcash >=0.8.0;
contract DelegatecallProxy() {
    bigint counter;
    function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
    fallback(bytes input) external {
        address impl = address(0x76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac);
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`;
const DELEGATE_C2_IMPL = `pragma solidcash >=0.8.0;
contract DelegateImpl() {
    bigint counter;
    mapping(bytes20 => bigint) balances;
    function increment() delegate { this.counter = this.counter + 1; }
    function credit(bytes20 who, bigint amount) delegate {
      this.balances[who] = this.balances[who] + amount;
    }
    function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
}`;
const DELEGATE_C2_PROXY = `pragma solidcash >=0.8.0;
contract DelegatecallProxy() {
    bigint counter;
    mapping(bytes20 => bigint) balances;
    function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
    fallback(bytes input) external {
        address impl = address(0x76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac);
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`;

async function runDelegate(
  implSource: string, proxySource: string, fn: string, args: unknown[],
  initialState: Record<string, unknown> = {},
): Promise<string> {
  const provider = createTestProvider();
  const implArtifact = compile(implSource);
  const proxyArtifact = compile(proxySource);
  const proxyContract = new Contract(proxyArtifact, [], { provider });
  const { categoryId: proxyCatId } = await setupStatefulUtxos(
    provider, proxyContract, proxyArtifact.stateLayout!, initialState, { saltContract: true },
  );
  const implContract = new Contract(implArtifact, [], { provider });
  const { categoryId: implCatId } = await setupStatefulUtxos(
    provider, implContract, implArtifact.stateLayout!, initialState, { saltContract: true },
  );
  const proxySc = StatefulContract.withCategory(proxyContract, proxyCatId);
  const implSc = StatefulContract.withCategory(implContract, implCatId);
  return (proxySc.call as any).__fallback()
    .withDelegatecall(implSc, fn, args)
    .send()
    .then(() => 'ACCEPTED')
    .catch((error: Error) => error.message);
}

describe('S1 cardinality: the delegate suppressing condition, measured', () => {
  it('has no settling instance: a C2 write inside a delegate function fails at the proxy', async () => {
    // Recorded, not endorsed. When delegate C2 writes are enabled, the pin's delegate exclusion must be
    // revisited before this shape is admitted - it is currently guarding an unreachable shape.
    const outcome = await runDelegate(
      DELEGATE_C2_IMPL, DELEGATE_C2_PROXY, 'credit', [alicePkh, 7n], { counter: 0n },
    );
    expect(outcome).toContain('mandatory-script-verify-flag-failed');
    expect(outcome).toContain('error in evaluating input index 0');
  }, 180_000);

  it('control: the same proxy shape settles a scalar delegate write', async () => {
    expect(await runDelegate(
      DELEGATE_SCALAR_IMPL, DELEGATE_SCALAR_PROXY, 'increment', [], { counter: 0n },
    )).toBe('ACCEPTED');
  }, 180_000);
});
