import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { alicePkh, bobPkh, carolPkh } from '../fixture/vars.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

const SOURCE = `pragma solidcash >=0.8.0;
contract CollectionJournalRelease3() {
  mapping(bytes20 => bigint) balances;
  bigint[3] fixedScores;
  bigint[] dynamicScores;
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

  function pushDynamic(bigint value) internal {
    this.dynamicScores.push(value);
  }

  function setDynamic(int index, bigint value) internal {
    this.dynamicScores[index] = value;
  }

  function popDynamic() internal {
    this.dynamicScores.pop();
  }

  function deleteDynamic(int index) internal {
    delete dynamicScores[index];
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

  function pushDynamicThree(bigint a, bigint b, bigint c) {
    pushDynamic(a);
    pushDynamic(b);
    pushDynamic(c);
    require(a >= 0);
  }

  function checkDynamic(int index, bigint expected) {
    require(this.dynamicScores[index] == expected);
  }

  function reviseDynamic() {
    setDynamic(1, 7);
    popDynamic();
    pushDynamic(11);
    require(true);
  }

  function deleteDynamicAt(int index) {
    deleteDynamic(index);
    require(index >= 0);
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
  it('preserves three-value OP_INVOKE tuple ordering', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract Tuple3() {
      bigint result;
      function step(bigint a, bigint b, bigint c) internal returns (bigint, bigint, bigint) {
        return (a + 1, b + 10, c + 100);
      }
      function run() {
        bigint a = 1;
        bigint b = 2;
        bigint c = 3;
        (a, b, c) = step(a, b, c);
        this.result = a * 10000 + b * 100 + c;
        require(true);
      }
      function check() { require(this.result == 21303); }
    }`, { forceStateful: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const tuple = StatefulContract.withCategory(inner, categoryId);
    await tuple.run().send();
    await tuple.check().send();
  });

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

  it('threads ordered dynamic-array appends through reusable helper calls', async () => {
    const contract = await deploy();
    await contract.pushDynamicThree(2n, 3n, 5n).send();
    await contract.checkDynamic(0n, 2n).send();
    await contract.checkDynamic(1n, 3n).send();
    await contract.checkDynamic(2n, 5n).send();

    await contract.reviseDynamic().send();
    await contract.checkDynamic(0n, 2n).send();
    await contract.checkDynamic(1n, 7n).send();
    await contract.checkDynamic(2n, 11n).send();

    await contract.deleteDynamicAt(0n).send();
    await contract.checkDynamic(0n, 11n).send();
    await contract.checkDynamic(1n, 7n).send();
  });

  it('executes repeated ERC-20 transferFrom against one three-entry journal', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract JournalToken() {
        mapping(bytes20 => bigint) balances;
        mapping(bytes20 => mapping(bytes20 => bigint)) allowances;

        function mint(bytes20 to, bigint amount) {
          this.balances[to] = this.balances[to] + amount;
          require(amount >= 0);
        }
        function approve(bytes20 owner, bytes20 spender, bigint amount) {
          this.allowances[owner][spender] = amount;
          require(amount >= 0);
        }
        function transferFrom(
          bytes20 from, bytes20 to, bytes20 spender, bigint amount
        ) internal {
          require(this.allowances[from][spender] >= amount);
          require(this.balances[from] >= amount);
          this.allowances[from][spender] = this.allowances[from][spender] - amount;
          this.balances[from] = this.balances[from] - amount;
          this.balances[to] = this.balances[to] + amount;
        }
        function transferFromTwice(
          bytes20 from, bytes20 to, bytes20 spender, bigint a, bigint b
        ) {
          transferFrom(from, to, spender, a);
          transferFrom(from, to, spender, b);
          require(a >= 0);
        }
        function checkBalance(bytes20 owner, bigint expected) {
          require(this.balances[owner] == expected);
        }
        function checkAllowance(bytes20 owner, bytes20 spender, bigint expected) {
          require(this.allowances[owner][spender] == expected);
        }
      }
    `, { forceStateful: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const token = StatefulContract.withCategory(inner, categoryId);
    await token.mint(alicePkh, 100n).send();
    await token.mint(bobPkh, 10n).send();
    await token.approve(alicePkh, carolPkh, 80n).send();

    await token.transferFromTwice(alicePkh, bobPkh, carolPkh, 30n, 20n).send();
    await token.checkBalance(alicePkh, 50n).send();
    await token.checkBalance(bobPkh, 60n).send();
    await token.checkAllowance(alicePkh, carolPkh, 30n).send();

    await expect(
      token.transferFromTwice(alicePkh, bobPkh, carolPkh, 20n, 20n).send(),
    ).rejects.toThrow();
    await token.checkBalance(alicePkh, 50n).send();
    await token.checkBalance(bobPkh, 60n).send();
    await token.checkAllowance(alicePkh, carolPkh, 30n).send();
  });

  it('preserves dependent MasterChef-style updates across two mapping entries', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract JournalChef() {
        mapping(bigint => bigint) accumulated;
        mapping(bigint => bigint) rewards;
        function update(bigint pool, bigint amount) internal {
          this.accumulated[pool] = this.accumulated[pool] + amount;
          this.rewards[pool] = this.rewards[pool] + this.accumulated[pool];
        }
        function updateTwice(bigint pool, bigint a, bigint b) {
          update(pool, a);
          update(pool, b);
          require(a >= 0);
        }
        function check(bigint pool, bigint expectedAcc, bigint expectedReward) {
          require(this.accumulated[pool] == expectedAcc);
          require(this.rewards[pool] == expectedReward);
        }
      }
    `, { forceStateful: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const chef = StatefulContract.withCategory(inner, categoryId);
    await chef.updateTwice(7n, 2n, 3n).send();
    await chef.check(7n, 5n, 7n).send();
  });
});
