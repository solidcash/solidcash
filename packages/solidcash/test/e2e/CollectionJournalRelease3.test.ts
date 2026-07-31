import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { hexToBin } from '@bitauth/libauth';
import { alicePkh, bobPkh, carolPkh } from '../fixture/vars.js';
import { createTestProvider, getTxOutputs, setupStatefulUtxos } from '../test-util.js';

const inputZeroVerifyFailure = /^layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\.$/;

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

async function deploy(): Promise<StatefulContract> {
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
    await expect(contract.spendTwice(alicePkh, 7n, 4n).send()).rejects.toThrow(inputZeroVerifyFailure);
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
    ).rejects.toThrow(inputZeroVerifyFailure);
    await token.checkBalance(alicePkh, 50n).send();
    await token.checkBalance(bobPkh, 60n).send();
    await token.checkAllowance(alicePkh, carolPkh, 30n).send();
  });

  it('does not stale-read a shared literal-key debit across two multi-entry helper calls', async () => {
    const provider = createTestProvider();
    const sourceKey = new Uint8Array(20).fill(0x11);
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract LiteralKeyJournal() {
        mapping(bytes20 => bigint) balances;
        function mint(bytes20 to, bigint amount) {
          this.balances[to] = this.balances[to] + amount;
          require(amount >= 0);
        }
        function move(bytes20 from, bytes20 to, bigint amount) internal {
          require(this.balances[from] >= amount);
          this.balances[from] = this.balances[from] - amount;
          this.balances[to] = this.balances[to] + amount;
        }
        function drainTwice(bytes20 first, bytes20 second, bigint a, bigint b) {
          move(0x1111111111111111111111111111111111111111, first, a);
          move(0x1111111111111111111111111111111111111111, second, b);
          require(a >= 0 && b >= 0);
        }
        function check(bytes20 owner, bigint expected) {
          require(this.balances[owner] == expected);
        }
      }
    `, { forceStateful: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const token = StatefulContract.withCategory(inner, categoryId);
    await token.mint(sourceKey, 100n).send();
    await token.mint(bobPkh, 0n).send();
    await token.mint(carolPkh, 0n).send();

    await token.drainTwice(bobPkh, carolPkh, 30n, 30n).send();
    await token.check(sourceKey, 40n).send();
    await token.check(bobPkh, 30n).send();
    await token.check(carolPkh, 30n).send();
  });

  it('flushes a multi-entry journal before early, nested, loop, and value returns', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract EarlyReturnJournal() {
        mapping(bytes20 => bigint) balances;
        function mint(bytes20 to, bigint amount) {
          this.balances[to] = this.balances[to] + amount;
          require(amount >= 0);
        }
        function move(bytes20 from, bytes20 to, bigint amount) internal {
          require(this.balances[from] >= amount);
          this.balances[from] = this.balances[from] - amount;
          this.balances[to] = this.balances[to] + amount;
        }
        function payOnce(bytes20 from, bytes20 to, bigint amount, bigint skip) {
          move(from, to, amount);
          if (skip == 1) { return; }
          require(amount >= 0);
        }
        function payNested(bytes20 from, bytes20 to, bigint amount, bigint skip) {
          move(from, to, amount);
          if (skip > 0) { if (skip == 2) { return; } }
          require(amount >= 0);
        }
        function payLoop(bytes20 from, bytes20 to, bigint amount, bigint skip) {
          move(from, to, amount);
          for (bigint i = 0; i < 2; i = i + 1) { if (i == skip) { return; } }
          require(amount >= 0);
        }
        function payValue(bytes20 from, bytes20 to, bigint amount, bigint skip) returns (bigint) {
          move(from, to, amount);
          if (skip == 1) { return 11; }
          return 22;
        }
        function check(bytes20 owner, bigint expected) {
          require(this.balances[owner] == expected);
        }
      }
    `, { forceStateful: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const token = StatefulContract.withCategory(inner, categoryId);
    await token.mint(alicePkh, 200n).send();
    await token.mint(bobPkh, 0n).send();

    await token.payOnce(alicePkh, bobPkh, 10n, 1n).send();
    await token.payNested(alicePkh, bobPkh, 20n, 2n).send();
    await token.payLoop(alicePkh, bobPkh, 30n, 0n).send();
    await token.payValue(alicePkh, bobPkh, 40n, 1n).send();
    await token.check(alicePkh, 100n).send();
    await token.check(bobPkh, 100n).send();

    await token.payOnce(alicePkh, bobPkh, 1n, 0n).send();
    await token.payNested(alicePkh, bobPkh, 1n, 0n).send();
    await token.payLoop(alicePkh, bobPkh, 1n, 9n).send();
    await token.check(alicePkh, 97n).send();
    await token.check(bobPkh, 103n).send();
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

  it('executes a returning chunk-array writer through the inlined path', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract ReturningArrayJournal() {
        bigint[] scores;
        function append(bigint value) internal returns (bigint) {
          this.scores.push(value);
          return this.scores.length;
        }
        function apply(bigint a, bigint b) {
          bigint first = append(a);
          bigint second = append(b);
          require(first == 1 && second == 2);
        }
        function check(bigint a, bigint b) {
          require(this.scores.length == 2 && this.scores[0] == a && this.scores[1] == b);
        }
      }
    `, { forceStateful: true });
    expect(artifact.invocationAnalysis?.functions.find((fn) => fn.name === 'append')).toBeUndefined();
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);

    await contract.apply(5n, 7n).send();
    await contract.check(5n, 7n).send();
  });

  it('executes token-container helper effects twice in source order', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract SequentialTokenEffects() {
        function send(bytes32 category, bytes recipient, bigint amount) internal {
          this.tokens[category].transfer(recipient, amount);
        }
        function sendTwice(
          bytes32 category, bytes firstRecipient, bigint firstAmount,
          bytes secondRecipient, bigint secondAmount
        ) {
          send(category, firstRecipient, firstAmount);
          send(category, secondRecipient, secondAmount);
          require(firstAmount >= 0 && secondAmount >= 0);
        }
      }
    `, { forceStateful: true });
    expect(artifact.abi.find((entry) => entry.name === 'sendTwice')
      ?.tokenContainerAccesses).toHaveLength(1);
    expect(artifact.abi.find((entry) => entry.name === 'sendTwice')
      ?.tokenContainerAccesses?.[0]?.operations).toContain('transfer');
    expect(artifact.abi.find((entry) => entry.name === 'sendTwice')
      ?.blockLayout?.slots.filter((slot) => slot.kind === 'tcTransfer')).toHaveLength(2);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const { categoryId: tokenCategory } = await provider.addTokenUtxosDynamic((category) => [{
      address: contract.getTokenContainerAddress(category),
      satoshis: 1200n,
      token: { amount: 1000n },
    }]);

    const tx = await contract.sendTwice(
      hexToBin(tokenCategory), Uint8Array.of(0x51), 125n, Uint8Array.of(0x52), 275n,
    ).send();
    const outputs = getTxOutputs(tx);
    expect(outputs.filter((output) => output.token?.category === tokenCategory)
      .map((output) => output.token!.amount).sort((a, b) => Number(a - b)))
      .toEqual([125n, 275n, 600n]);
  });
});
