import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, cashAddressToLockingBytecode, decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, expectScriptRejection, setupStatefulUtxos } from '../test-util.js';
import { getEntryNftAddress } from '../../src/stateful/covenant-helpers.js';

/**
 * A write ahead of a delete of the same mapping is that delete's swap-remove alias write: where the two keys meet, the
 * delete supersedes it. That holds only where the delete runs after it. A write arm whose delete sits in the other arm
 * still sets the key's node, and the delete arm still deletes it; an unconditional swap-remove still ends deleted. A
 * write whose delete sits in a later branch, a switch case or an else-if arm, on the straight line, in a nested block
 * or in an earlier branch or switch arm, keeps its value where that delete does not run; so does a write before an
 * if-converted delete. A loop's writes are cached and flushed once, before that delete: the last value is kept. A
 * cached read-modify-write, in a loop or not, reads the entry once and is flushed there too: the sum is kept. A read
 * of the delete's key after the write, in the delete's arm or before its branch, sees the written value where the
 * keys meet: a call whose require the written value fails is refused though the old value passes it.
 */

const WRITE_FIRST_SOURCE = `contract SameKeyWriteFirst {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function setOrDrop(int k, int j, int v, int sel) external {
    if (sel > 0) { require(j != 3); m[j] = v; } else { require(k != 3); delete m[k]; }
    require(true);
  }
}`;

const SWAP_REMOVE_SOURCE = `contract SameKeySwapRemove {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function swapRemove(int j, int last) external { m[j] = m[last]; delete m[last]; require(true); }
}`;

// The guard keeps the branch: an arm of entry ops alone is if-converted to a predicated write, with no alias.
const WRITE_THEN_DROP_SOURCE = `contract SameKeyWriteThenDrop {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function setThenDrop(int j, int k, int v, int sel) external {
    m[j] = v;
    if (sel > 0) { require(k != 3); delete m[k]; }
    require(true);
  }
}`;

// sel 2 runs the write's arm alone, 1 both arms, 0 the delete's alone.
const ARM_THEN_DROP_SOURCE = `contract SameKeyArmThenDrop {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function setThenDrop(int j, int k, int v, int sel) external {
    if (sel > 0) { require(j != 3); m[j] = v; }
    if (sel < 2) { require(k != 3); delete m[k]; }
    require(true);
  }
}`;

// sel 2 runs the write's case alone, 0 both, 1 the delete's arm alone.
const CASE_THEN_DROP_SOURCE = `contract SameKeyCaseThenDrop {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function setThenDrop(int j, int k, int v, int sel) external {
    switch (sel % 2) {
      case 0:
        m[j] = v;
    }
    if (sel < 2) { require(k != 3); delete m[k]; }
    require(true);
  }
}`;

const SWITCH_DROP_SOURCE = `contract SameKeySwitchDrop {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function setThenDrop(int j, int k, int v, int sel) external {
    m[j] = v;
    switch (sel) {
      case 1:
        require(k != 3);
        delete m[k];
    }
    require(true);
  }
}`;

const ELSE_IF_DROP_SOURCE = `contract SameKeyElseIfDrop {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function setThenDrop(int j, int k, int v, int sel) external {
    m[j] = v;
    if (sel == 1) { require(k != 4); } else if (sel == 2) { require(k != 3); delete m[k]; }
    require(true);
  }
}`;

// The one-statement arm is if-converted to `m[k] = sel > 0 ? 0 : m[k]`, a write that composes on the first.
const PREDICATED_DROP_SOURCE = `contract SameKeyPredicatedDrop {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function setThenDrop(int j, int k, int v, int sel) external {
    m[j] = v;
    if (sel > 0) { delete m[k]; }
    require(true);
  }
}`;

const BLOCK_THEN_DROP_SOURCE = `contract SameKeyBlockThenDrop {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function setThenDrop(int j, int k, int v, int sel) external {
    { m[j] = v; }
    if (sel > 0) { require(k != 3); delete m[k]; }
    require(true);
  }
}`;

// The loop writes the key twice: v, then v + 1.
const LOOP_THEN_DROP_SOURCE = `contract SameKeyLoopThenDrop {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function setThenDrop(int j, int k, int v, int sel) external {
    for (int i = 0; i < 2; i++) { m[j] = v + i; }
    if (sel > 0) { require(k != 3); delete m[k]; }
    require(true);
  }
}`;

// The loop writes the key n times: v up to v + n - 1.
const RUNTIME_LOOP_THEN_DROP_SOURCE = `contract SameKeyRuntimeLoopThenDrop {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function setThenDrop(int j, int k, int v, int sel, int n) external {
    for (int i = 0; i < n; i++) { m[j] = v + i; }
    if (sel > 0) { require(k != 3); delete m[k]; }
    require(true);
  }
}`;

// The loop adds v to the key twice.
const LOOP_ADD_THEN_DROP_SOURCE = `contract SameKeyLoopAddThenDrop {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function addThenDrop(int j, int k, int v, int sel) external {
    for (int i = 0; i < 2; i++) { m[j] += v; }
    if (sel > 0) { require(k != 3); delete m[k]; }
    require(true);
  }
}`;

// The loop adds v to the key n times.
const RUNTIME_LOOP_ADD_THEN_DROP_SOURCE = `contract SameKeyRuntimeLoopAddThenDrop {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function addThenDrop(int j, int k, int v, int sel, int n) external {
    for (int i = 0; i < n; i++) { m[j] += v; }
    if (sel > 0) { require(k != 3); delete m[k]; }
    require(true);
  }
}`;

// The read-modify-write is cached as a loop's is.
const ADD_THEN_DROP_SOURCE = `contract SameKeyAddThenDrop {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function addThenDrop(int j, int k, int v, int sel) external {
    m[j] += v;
    if (sel > 0) { require(k != 3); delete m[k]; }
    require(true);
  }
}`;

// The delete's arm reads the mapping after the loop's last write.
const LOOP_ADD_THEN_READ_DROP_SOURCE = `contract SameKeyLoopAddThenReadDrop {
  mapping(int => int) m;
  function addThenDrop(int j, int k, int v, int sel) external {
    for (int i = 0; i < 2; i++) { m[j] += v; }
    if (sel > 0) { require(m[k] < 1000); delete m[k]; }
    require(true);
  }
}`;

// The delete's arm reads the key the write may have set.
const WRITE_THEN_READ_DROP_SOURCE = `contract SameKeyWriteThenReadDrop {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function setThenDrop(int j, int k, int v, int sel) external {
    m[j] = v;
    if (sel > 0) { require(m[k] < 100); delete m[k]; }
    require(true);
  }
}`;

// The key is read between the write and the delete's branch.
const WRITE_READ_THEN_DROP_SOURCE = `contract SameKeyWriteReadThenDrop {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function setThenDrop(int j, int k, int v, int sel) external {
    m[j] = v;
    require(m[k] < 100);
    if (sel > 0) { require(k != 3); delete m[k]; }
    require(true);
  }
}`;

// The loop's write-only cache flushes before the delete's arm, which reads the key: v, then v + 1.
const LOOP_THEN_READ_DROP_SOURCE = `contract SameKeyLoopThenReadDrop {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function setThenDrop(int j, int k, int v, int sel) external {
    for (int i = 0; i < 2; i++) { m[j] = v + i; }
    if (sel > 0) { require(m[k] < 100); delete m[k]; }
    require(true);
  }
}`;

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;

interface Deployed { provider: Provider; sc: StatefulContract<any>; pinned: Contract; cat: string; deleteSlot?: number }

async function deploy(source: string, name: string, alias = true): Promise<Deployed> {
  const provider = createTestProvider();
  const artifact = compileString(source, { forceStateful: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, {}, { saltContract: true },
  );
  const pinned = contract.category ? contract : contract.withCategory(hexToBin(categoryId));
  const sc = StatefulContract.withCategory(contract, categoryId);
  await sc.getFunction('set')(7n, 70n).send();
  await sc.getFunction('set')(20n, 200n).send();
  const fn = artifact.abi.find((entry) => entry.name === name)!;
  // The write is the swap-remove alias of the delete after it, unless that delete was if-converted.
  const owner = fn.entryAccesses?.find((access) => access.aliasCondDeleteSlot !== undefined)?.aliasCondDeleteSlot;
  expect(owner !== undefined).toBe(alias);
  if (owner === undefined) return { provider, sc, pinned, cat: categoryId };
  const deleteSlot = fn.blockLayout!.slots.find((slot) => slot.kind === 'entry' && slot.slotIndex === owner)!.offset;
  return { provider, sc, pinned, cat: categoryId, deleteSlot };
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

const outcomeOf = (provider: Provider, hex: string): Promise<string> => provider.sendRawTransaction(hex)
  .then(() => 'ACCEPTED').catch((e: Error) => e.message);

/**
 * The call writes 300 to key 7, whose one node sits at the delete's slot (an alias write) or carries 300 (none); that
 * node with another value is refused.
 */
async function expectForgedValueRefused(source: string, name: string, args: bigint[], alias = true): Promise<void> {
  const { provider, sc, pinned, cat, deleteSlot } = await deploy(source, name, alias);
  const hex = await capture(provider, () => sc.getFunction(name)(...args).send());
  const tx = decodeTransactionUnsafe(hexToBin(hex));
  const lock = (cashAddressToLockingBytecode(getEntryNftAddress(pinned, cat, 'm')) as { bytecode: Uint8Array })
    .bytecode;
  const written = binToHex(bigIntToVmNumber(300n));
  const at = deleteSlot ?? tx.outputs.findIndex((output) => binToHex(output.lockingBytecode) === binToHex(lock)
    && binToHex(output.token?.nft?.commitment.slice(64) ?? new Uint8Array()) === written);
  expect(at).toBeGreaterThanOrEqual(0);
  // The key's one node carries the written value.
  const node = tx.outputs[at];
  expect(binToHex(node.lockingBytecode)).toBe(binToHex(lock));
  const nft = node.token!.nft!;
  expect(binToHex(nft.commitment.slice(64))).toBe(written);
  tx.outputs[at] = { ...node, token: { ...node.token!, nft: {
    ...nft, commitment: Uint8Array.from([...nft.commitment.slice(0, 64), ...bigIntToVmNumber(4242n)]),
  } } };
  expectScriptRejection(await outcomeOf(provider, binToHex(encodeTransaction(tx as Tx))), 0);
  await expect(provider.sendRawTransaction(hex)).resolves.toBeTypeOf('string');
  await expect(sc.getFunction('check')(7n, 300n).send()).resolves.toBeDefined();
}

describe('a write before a delete of the same key in the other arm', () => {
  it('sets the key on the write arm', async () => {
    const { sc } = await deploy(WRITE_FIRST_SOURCE, 'setOrDrop');
    await sc.getFunction('setOrDrop')(7n, 7n, 300n, 1n).send();
    await expect(sc.getFunction('check')(7n, 300n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('deletes the key on the delete arm', async () => {
    const { sc } = await deploy(WRITE_FIRST_SOURCE, 'setOrDrop');
    await sc.getFunction('setOrDrop')(7n, 7n, 999n, 0n).send();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('refuses the write arm setting the key\'s node to another value', async () => {
    await expectForgedValueRefused(WRITE_FIRST_SOURCE, 'setOrDrop', [7n, 7n, 300n, 1n]);
  }, 300_000);
});

describe('a write before a delete of the same key in a later branch', () => {
  it('sets the key where the delete does not run', async () => {
    const { sc } = await deploy(WRITE_THEN_DROP_SOURCE, 'setThenDrop');
    await sc.getFunction('setThenDrop')(7n, 7n, 300n, 0n).send();
    await expect(sc.getFunction('check')(7n, 300n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('deletes the key where the delete runs', async () => {
    const { sc } = await deploy(WRITE_THEN_DROP_SOURCE, 'setThenDrop');
    await sc.getFunction('setThenDrop')(7n, 7n, 300n, 1n).send();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('sets one key and deletes the other only where the delete runs', async () => {
    const { sc } = await deploy(WRITE_THEN_DROP_SOURCE, 'setThenDrop');
    await sc.getFunction('setThenDrop')(20n, 7n, 300n, 0n).send();
    await expect(sc.getFunction('check')(20n, 300n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(7n, 70n).send()).resolves.toBeDefined();
    await sc.getFunction('setThenDrop')(7n, 20n, 400n, 1n).send();
    await expect(sc.getFunction('check')(7n, 400n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 0n).send()).resolves.toBeDefined();
  }, 300_000);

  it('refuses the key\'s node taking another value where the delete does not run', async () => {
    await expectForgedValueRefused(WRITE_THEN_DROP_SOURCE, 'setThenDrop', [7n, 7n, 300n, 0n]);
  }, 300_000);
});

describe('a write in an earlier arm before a delete of the same key in a later branch', () => {
  it('sets the key where the delete does not run', async () => {
    const { sc } = await deploy(ARM_THEN_DROP_SOURCE, 'setThenDrop');
    await sc.getFunction('setThenDrop')(7n, 7n, 300n, 2n).send();
    await expect(sc.getFunction('check')(7n, 300n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('deletes the key where the delete runs', async () => {
    const { sc } = await deploy(ARM_THEN_DROP_SOURCE, 'setThenDrop');
    await sc.getFunction('setThenDrop')(7n, 7n, 300n, 1n).send();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('refuses the key\'s node taking another value where the delete does not run', async () => {
    await expectForgedValueRefused(ARM_THEN_DROP_SOURCE, 'setThenDrop', [7n, 7n, 300n, 2n]);
  }, 300_000);
});

describe('a write in an earlier switch case before a delete of the same key in a later branch', () => {
  it('sets the key where the delete does not run', async () => {
    const { sc } = await deploy(CASE_THEN_DROP_SOURCE, 'setThenDrop');
    await sc.getFunction('setThenDrop')(7n, 7n, 300n, 2n).send();
    await expect(sc.getFunction('check')(7n, 300n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('deletes the key where the delete runs', async () => {
    const { sc } = await deploy(CASE_THEN_DROP_SOURCE, 'setThenDrop');
    await sc.getFunction('setThenDrop')(7n, 7n, 300n, 0n).send();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('refuses the key\'s node taking another value where the delete does not run', async () => {
    await expectForgedValueRefused(CASE_THEN_DROP_SOURCE, 'setThenDrop', [7n, 7n, 300n, 2n]);
  }, 300_000);
});

describe('a write before a delete of the same key under a switch case', () => {
  it('sets the key where the case does not run', async () => {
    const { sc } = await deploy(SWITCH_DROP_SOURCE, 'setThenDrop');
    await sc.getFunction('setThenDrop')(7n, 7n, 300n, 0n).send();
    await expect(sc.getFunction('check')(7n, 300n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('deletes the key where the case runs', async () => {
    const { sc } = await deploy(SWITCH_DROP_SOURCE, 'setThenDrop');
    await sc.getFunction('setThenDrop')(7n, 7n, 300n, 1n).send();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('refuses the key\'s node taking another value where the case does not run', async () => {
    await expectForgedValueRefused(SWITCH_DROP_SOURCE, 'setThenDrop', [7n, 7n, 300n, 0n]);
  }, 300_000);
});

describe('a write before a delete of the same key in an else-if arm', () => {
  it('sets the key where another arm runs', async () => {
    const { sc } = await deploy(ELSE_IF_DROP_SOURCE, 'setThenDrop');
    await sc.getFunction('setThenDrop')(7n, 7n, 300n, 1n).send();
    await expect(sc.getFunction('check')(7n, 300n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('deletes the key where the delete\'s arm runs', async () => {
    const { sc } = await deploy(ELSE_IF_DROP_SOURCE, 'setThenDrop');
    await sc.getFunction('setThenDrop')(7n, 7n, 300n, 2n).send();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);
});

describe('a write before an if-converted delete of the same key', () => {
  it('sets the key where the delete does not run', async () => {
    const { sc } = await deploy(PREDICATED_DROP_SOURCE, 'setThenDrop', false);
    await sc.getFunction('setThenDrop')(7n, 7n, 300n, 0n).send();
    await expect(sc.getFunction('check')(7n, 300n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('deletes the key where the delete runs', async () => {
    const { sc } = await deploy(PREDICATED_DROP_SOURCE, 'setThenDrop', false);
    await sc.getFunction('setThenDrop')(7n, 7n, 300n, 1n).send();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('refuses the key\'s node taking another value where the delete does not run', async () => {
    await expectForgedValueRefused(PREDICATED_DROP_SOURCE, 'setThenDrop', [7n, 7n, 300n, 0n], false);
  }, 300_000);
});

describe('a write in a nested block before a delete of the same key in a later branch', () => {
  it('sets the key where the delete does not run', async () => {
    const { sc } = await deploy(BLOCK_THEN_DROP_SOURCE, 'setThenDrop');
    await sc.getFunction('setThenDrop')(7n, 7n, 300n, 0n).send();
    await expect(sc.getFunction('check')(7n, 300n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('deletes the key where the delete runs', async () => {
    const { sc } = await deploy(BLOCK_THEN_DROP_SOURCE, 'setThenDrop');
    await sc.getFunction('setThenDrop')(7n, 7n, 300n, 1n).send();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('refuses the key\'s node taking another value where the delete does not run', async () => {
    await expectForgedValueRefused(BLOCK_THEN_DROP_SOURCE, 'setThenDrop', [7n, 7n, 300n, 0n]);
  }, 300_000);
});

describe('a write in a fixed-bound loop before a delete of the same key in a later branch', () => {
  it('sets the key to the last iteration\'s value where the delete does not run', async () => {
    const { sc } = await deploy(LOOP_THEN_DROP_SOURCE, 'setThenDrop');
    await sc.getFunction('setThenDrop')(7n, 7n, 300n, 0n).send();
    await expect(sc.getFunction('check')(7n, 301n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('deletes the key where the delete runs', async () => {
    const { sc } = await deploy(LOOP_THEN_DROP_SOURCE, 'setThenDrop');
    await sc.getFunction('setThenDrop')(7n, 7n, 300n, 1n).send();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('sets one key and deletes the other only where the delete runs', async () => {
    const { sc } = await deploy(LOOP_THEN_DROP_SOURCE, 'setThenDrop');
    await sc.getFunction('setThenDrop')(20n, 7n, 300n, 0n).send();
    await expect(sc.getFunction('check')(20n, 301n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(7n, 70n).send()).resolves.toBeDefined();
    await sc.getFunction('setThenDrop')(7n, 20n, 400n, 1n).send();
    await expect(sc.getFunction('check')(7n, 401n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 0n).send()).resolves.toBeDefined();
  }, 300_000);

  it('refuses the key\'s node taking another value where the delete does not run', async () => {
    await expectForgedValueRefused(LOOP_THEN_DROP_SOURCE, 'setThenDrop', [7n, 7n, 299n, 0n]);
  }, 300_000);
});

describe('a write in a runtime loop before a delete of the same key in a later branch', () => {
  it('sets the key to the last iteration\'s value where the delete does not run', async () => {
    const { sc } = await deploy(RUNTIME_LOOP_THEN_DROP_SOURCE, 'setThenDrop');
    await sc.getFunction('setThenDrop')(7n, 7n, 300n, 0n, 3n).send();
    await expect(sc.getFunction('check')(7n, 302n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('deletes the key where the delete runs', async () => {
    const { sc } = await deploy(RUNTIME_LOOP_THEN_DROP_SOURCE, 'setThenDrop');
    await sc.getFunction('setThenDrop')(7n, 7n, 300n, 1n, 2n).send();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('keeps the key where the loop does not run, and deletes it where only the delete runs', async () => {
    const { sc } = await deploy(RUNTIME_LOOP_THEN_DROP_SOURCE, 'setThenDrop');
    await sc.getFunction('setThenDrop')(7n, 7n, 300n, 0n, 0n).send();
    await expect(sc.getFunction('check')(7n, 70n).send()).resolves.toBeDefined();
    await sc.getFunction('setThenDrop')(7n, 7n, 300n, 1n, 0n).send();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('refuses the key\'s node taking another value where the delete does not run', async () => {
    await expectForgedValueRefused(RUNTIME_LOOP_THEN_DROP_SOURCE, 'setThenDrop', [7n, 7n, 299n, 0n, 2n]);
  }, 300_000);
});

describe('a read-modify-write in a fixed-bound loop before a delete of the same key in a later branch', () => {
  it('keeps the sum where the delete does not run', async () => {
    const { sc } = await deploy(LOOP_ADD_THEN_DROP_SOURCE, 'addThenDrop');
    await sc.getFunction('addThenDrop')(7n, 7n, 100n, 0n).send();
    await expect(sc.getFunction('check')(7n, 270n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('deletes the key where the delete runs', async () => {
    const { sc } = await deploy(LOOP_ADD_THEN_DROP_SOURCE, 'addThenDrop');
    await sc.getFunction('addThenDrop')(7n, 7n, 100n, 1n).send();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('adds to one key and deletes the other only where the delete runs', async () => {
    const { sc } = await deploy(LOOP_ADD_THEN_DROP_SOURCE, 'addThenDrop');
    await sc.getFunction('addThenDrop')(20n, 7n, 100n, 0n).send();
    await expect(sc.getFunction('check')(20n, 400n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(7n, 70n).send()).resolves.toBeDefined();
    await sc.getFunction('addThenDrop')(7n, 20n, 10n, 1n).send();
    await expect(sc.getFunction('check')(7n, 90n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 0n).send()).resolves.toBeDefined();
  }, 300_000);

  it('refuses the key\'s node taking another value where the delete does not run', async () => {
    // 70 + 2 * 115 = 300.
    await expectForgedValueRefused(LOOP_ADD_THEN_DROP_SOURCE, 'addThenDrop', [7n, 7n, 115n, 0n]);
  }, 300_000);

  it('keeps the flush after the delete where the delete\'s arm reads the mapping', () => {
    const artifact = compileString(LOOP_ADD_THEN_READ_DROP_SOURCE, { forceStateful: true });
    const fn = artifact.abi.find((entry) => entry.name === 'addThenDrop')!;
    expect(fn.entryAccesses?.some((access) => access.aliasCondDeleteSlot !== undefined)).toBe(false);
  });
});

describe('a read-modify-write before a delete of the same key in a later branch', () => {
  it('keeps the sum where the delete does not run', async () => {
    const { sc } = await deploy(ADD_THEN_DROP_SOURCE, 'addThenDrop');
    await sc.getFunction('addThenDrop')(7n, 7n, 100n, 0n).send();
    await expect(sc.getFunction('check')(7n, 170n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('deletes the key where the delete runs', async () => {
    const { sc } = await deploy(ADD_THEN_DROP_SOURCE, 'addThenDrop');
    await sc.getFunction('addThenDrop')(7n, 7n, 100n, 1n).send();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);
});

describe('a read-modify-write in a runtime loop before a delete of the same key in a later branch', () => {
  it('keeps the sum where the delete does not run', async () => {
    const { sc } = await deploy(RUNTIME_LOOP_ADD_THEN_DROP_SOURCE, 'addThenDrop');
    await sc.getFunction('addThenDrop')(7n, 7n, 10n, 0n, 3n).send();
    await expect(sc.getFunction('check')(7n, 100n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('deletes the key where the delete runs', async () => {
    const { sc } = await deploy(RUNTIME_LOOP_ADD_THEN_DROP_SOURCE, 'addThenDrop');
    await sc.getFunction('addThenDrop')(7n, 7n, 10n, 1n, 2n).send();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('keeps the key where the loop does not run, and deletes it where only the delete runs', async () => {
    const { sc } = await deploy(RUNTIME_LOOP_ADD_THEN_DROP_SOURCE, 'addThenDrop');
    await sc.getFunction('addThenDrop')(7n, 7n, 10n, 0n, 0n).send();
    await expect(sc.getFunction('check')(7n, 70n).send()).resolves.toBeDefined();
    await sc.getFunction('addThenDrop')(7n, 7n, 10n, 1n, 0n).send();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('refuses the key\'s node taking another value where the delete does not run', async () => {
    // 70 + 2 * 115 = 300.
    await expectForgedValueRefused(RUNTIME_LOOP_ADD_THEN_DROP_SOURCE, 'addThenDrop', [7n, 7n, 115n, 0n, 2n]);
  }, 300_000);
});

// Key 7 holds 70: 70 < 100 passes each require, so only the written value can fail it.
describe('a read of the key after a write before a delete of it in a later branch', () => {
  it('sees the written value in the delete\'s arm where the keys meet', async () => {
    const { sc } = await deploy(WRITE_THEN_READ_DROP_SOURCE, 'setThenDrop');
    await sc.getFunction('setThenDrop')(7n, 7n, 50n, 1n).send();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('refuses where the written value fails the arm\'s require', async () => {
    const { sc } = await deploy(WRITE_THEN_READ_DROP_SOURCE, 'setThenDrop');
    await expect(sc.getFunction('setThenDrop')(7n, 7n, 300n, 1n).send()).rejects.toThrow();
    await expect(sc.getFunction('check')(7n, 70n).send()).resolves.toBeDefined();
  }, 300_000);

  it('sees the other key\'s own value where the keys differ', async () => {
    const { sc } = await deploy(WRITE_THEN_READ_DROP_SOURCE, 'setThenDrop');
    await sc.getFunction('setThenDrop')(20n, 7n, 300n, 1n).send();
    await expect(sc.getFunction('check')(20n, 300n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
  }, 300_000);

  it('sees the written value before the delete\'s branch where the keys meet', async () => {
    const { sc } = await deploy(WRITE_READ_THEN_DROP_SOURCE, 'setThenDrop');
    await sc.getFunction('setThenDrop')(7n, 7n, 50n, 0n).send();
    await expect(sc.getFunction('check')(7n, 50n).send()).resolves.toBeDefined();
    await sc.getFunction('setThenDrop')(7n, 7n, 60n, 1n).send();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('refuses where the written value fails the require before the delete\'s branch', async () => {
    const { sc } = await deploy(WRITE_READ_THEN_DROP_SOURCE, 'setThenDrop');
    await expect(sc.getFunction('setThenDrop')(7n, 7n, 300n, 0n).send()).rejects.toThrow();
    await expect(sc.getFunction('check')(7n, 70n).send()).resolves.toBeDefined();
  }, 300_000);

  it('sees a loop\'s last value in the delete\'s arm where the keys meet', async () => {
    const { sc } = await deploy(LOOP_THEN_READ_DROP_SOURCE, 'setThenDrop');
    await sc.getFunction('setThenDrop')(7n, 7n, 50n, 1n).send();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('refuses where a loop\'s last value fails the arm\'s require', async () => {
    // 99, then 100: only the last fails `< 100`.
    const { sc } = await deploy(LOOP_THEN_READ_DROP_SOURCE, 'setThenDrop');
    await expect(sc.getFunction('setThenDrop')(7n, 7n, 99n, 1n).send()).rejects.toThrow();
    await expect(sc.getFunction('check')(7n, 70n).send()).resolves.toBeDefined();
  }, 300_000);
});

describe('an unconditional swap-remove', () => {
  it('moves the last entry over another and deletes the last', async () => {
    const { sc } = await deploy(SWAP_REMOVE_SOURCE, 'swapRemove');
    await sc.getFunction('swapRemove')(20n, 7n).send();
    await expect(sc.getFunction('check')(20n, 70n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
  }, 300_000);

  it('deletes the key when the keys meet', async () => {
    const { sc } = await deploy(SWAP_REMOVE_SOURCE, 'swapRemove');
    await sc.getFunction('swapRemove')(7n, 7n).send();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);
});
