import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { alicePkh, bobPkh } from '../fixture/vars.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * D2/R19 settling proof for the tail-return relaxation in LowerCollectionJournalHelpers.
 *
 * The multi-entry journal defers both write-backs to the end of the wrapper, so the question the compile-level
 * test cannot answer is whether the values actually reach state when the wrapper ends in `return true;` - the
 * Solidity ERC-20 wrapper shape. If the write-backs were still appended after the return they would be
 * unreachable and BOTH balances would keep their pre-call values while the transaction still settled. Reading
 * both entries back after the send is what distinguishes the two.
 */
const SOURCE = `pragma solidcash >=0.8.0;
contract TailReturnToken() {
  mapping(bytes20 => bigint) balances;

  function _transfer(bytes20 from, bytes20 to, bigint value) internal {
    require(this.balances[from] >= value);
    this.balances[from] = this.balances[from] - value;
    this.balances[to] = this.balances[to] + value;
  }

  function seed(bytes20 who, bigint amount) {
    this.balances[who] = this.balances[who] + amount;
    require(amount >= 0);
  }

  function transfer(bytes20 from, bytes20 to, bigint value) returns (bool) {
    _transfer(from, to, value);
    return true;
  }

  function check(bytes20 who, bigint expected) {
    require(this.balances[who] == expected);
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

describe('collection journal with a tail-return wrapper, on the VM', () => {
  it('settles both write-backs of a wrapper that ends in `return true`', async () => {
    const token = await deploy();
    await token.seed(alicePkh, 10n).send();
    await token.transfer(alicePkh, bobPkh, 4n).send();

    // The load-bearing assertion. A write-back stranded after the return would leave both of these at their
    // pre-call values (10 and 0) on a transaction that still settled.
    await token.check(alicePkh, 6n).send();
    await token.check(bobPkh, 4n).send();
  });

  it('refuses a transfer the sender cannot cover, on the same contract', async () => {
    const token = await deploy();
    await token.seed(alicePkh, 10n).send();
    await expect(token.transfer(alicePkh, bobPkh, 11n).send()).rejects.toThrow();
    await token.check(alicePkh, 10n).send();
    await token.check(bobPkh, 0n).send();
  });

  it('keeps the journalled entries independent across two sequential transfers', async () => {
    const token = await deploy();
    await token.seed(alicePkh, 10n).send();
    await token.transfer(alicePkh, bobPkh, 4n).send();
    await token.transfer(bobPkh, alicePkh, 1n).send();
    await token.check(alicePkh, 7n).send();
    await token.check(bobPkh, 3n).send();
  });
});
