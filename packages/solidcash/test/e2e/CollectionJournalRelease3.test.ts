import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { alicePkh } from '../fixture/vars.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

const SOURCE = `pragma solidcash >=0.8.0;
contract CollectionJournalRelease3() {
  mapping(bytes20 => bigint) balances;
  bigint[3] fixedScores;
  bytes data;

  function credit(bytes20 who, bigint amount) internal {
    this.balances[who] = this.balances[who] + amount;
  }

  function spend(bytes20 who, bigint amount) internal {
    require(this.balances[who] >= amount);
    this.balances[who] = this.balances[who] - amount;
  }

  function clear(bytes20 who) internal {
    delete this.balances[who];
  }

  function append(bytes part) internal {
    this.data = bytes.concat(this.data, part);
  }

  function clearData() internal {
    delete this.data;
  }

  function addFixed(int index, bigint amount) internal {
    this.fixedScores[index] = this.fixedScores[index] + amount;
  }

  function creditThree(bytes20 who, bigint a, bigint b, bigint c) {
    credit(who, a);
    credit(who, b);
    credit(who, c);
    require(a >= 0);
  }

  function spendTwice(bytes20 who, bigint a, bigint b) {
    spend(who, a);
    spend(who, b);
    require(a >= 0);
  }

  function creditLoop(bytes20 who, int count, bigint amount) {
    for (int i = 0; i < count; i = i + 1) {
      credit(who, amount);
    }
    require(count >= 0);
  }

  function clearThenCredit(bytes20 who, bigint amount) {
    clear(who);
    credit(who, amount);
    require(amount >= 0);
  }

  function replaceThenAppend(bytes discarded, bytes kept, bytes tail) {
    append(discarded);
    clearData();
    append(kept);
    append(tail);
    require(discarded.length >= 0);
  }

  function addFixedThree(int index, bigint a, bigint b, bigint c) {
    addFixed(index, a);
    addFixed(index, b);
    addFixed(index, c);
    require(index >= 0 && index < 3);
  }

  function checkFixed(int index, bigint expected) {
    require(this.fixedScores[index] == expected);
  }

  function checkData(bytes expected) {
    require(this.data == expected);
  }
}`;

async function deploy() {
  const provider = createTestProvider();
  const artifact = compileString(SOURCE, { forceStateful: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, {}, { saltContract: true },
  );
  return StatefulContract.withCategory(contract, categoryId);
}

async function balance(contract: StatefulContract): Promise<bigint | undefined> {
  const entries = await contract.getEntries('balances');
  // This fixture has one logical key. getEntries intentionally exposes the
  // decoded value without requiring callers to depend on backend key metadata.
  return entries[0]?.value as bigint | undefined;
}

describe('Release 3 collection journal SDK E2E', () => {
  it('auto-derives one entry settlement for three ordered helper calls', async () => {
    const contract = await deploy();
    await contract.creditThree(alicePkh, 2n, 3n, 5n).send();
    expect(await balance(contract)).toBe(10n);
  });

  it('checks each debit against the pending value and rejects same-key overspend', async () => {
    const contract = await deploy();
    await contract.creditThree(alicePkh, 4n, 3n, 3n).send();
    await expect(contract.spendTwice(alicePkh, 7n, 4n).send()).rejects.toThrow();
    expect(await balance(contract)).toBe(10n);

    await contract.spendTwice(alicePkh, 7n, 3n).send();
    expect(await balance(contract)).toBe(0n);
  });

  it('preserves replacement order across delete followed by a helper write', async () => {
    const contract = await deploy();
    await contract.creditThree(alicePkh, 10n, 20n, 30n).send();
    await contract.clearThenCredit(alicePkh, 9n).send();
    expect(await balance(contract)).toBe(9n);
  });

  it('threads one pending mapping value through a runtime helper loop', async () => {
    const contract = await deploy();
    await contract.creditLoop(alicePkh, 5n, 7n).send();
    expect(await balance(contract)).toBe(35n);
  });

  it('flushes ordered dynamic bytes replacement, delete, and append once', async () => {
    const contract = await deploy();
    await contract.replaceThenAppend(
      Uint8Array.from([0xde, 0xad]),
      Uint8Array.from([0xca, 0xfe]),
      Uint8Array.from([0xba, 0xbe]),
    ).send();
    await contract.checkData(Uint8Array.from([0xca, 0xfe, 0xba, 0xbe])).send();
  });

  it('threads one fixed-array element through three reusable helper calls', async () => {
    const contract = await deploy();
    await contract.addFixedThree(1n, 2n, 3n, 5n).send();
    await contract.checkFixed(1n, 10n).send();
    await contract.checkFixed(0n, 0n).send();
    await contract.checkFixed(2n, 0n).send();
  });
});
