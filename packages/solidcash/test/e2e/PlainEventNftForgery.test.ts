import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import {
  Contract, StatefulContract, TransactionBuilder, getEventNftAddress, readEventsFromChain,
} from '../../src/index.js';
import { createFeeFunder, createTestProvider, expectScriptRejection, setupStatefulUtxos }
  from '../test-util.js';

/**
 * SEC-10 / SEC-11, general form. Both were reported as reserved-SLOT bugs: a one-armed conditional emit (SEC-10)
 * or a reserved transfer slot (SEC-11) is an output index the covenant looks at on some paths and not others.
 * Measured here: the forgery never needed a reserved slot. An event NFT is an own-category IMMUTABLE (0x00) NFT,
 * the co-spent master is a MINTING NFT of that category, and nothing conserved the immutable class - so any
 * spender could APPEND one past the block, on a function with no branch and no emit statement at all.
 *
 * The repair is `emitOwnCategoryImmutableNftOutputPin` (every own-category zero-FT immutable NFT output must sit
 * at an `event`/`returnEvent` block offset) plus the `OP_ELSE` binding of a conditional emit slot.
 */

const NOEMIT = `pragma solidcash >=0.8.0;
contract NoEmitPlain() {
  bigint counter;
  event Fired(bigint value);
  function bump(bigint x) {
    this.counter = this.counter + x;
    require(x > 0);
  }
}`;

const UNCOND = `pragma solidcash >=0.8.0;
contract UncondEmitPlain() {
  bigint counter;
  event Fired(bigint value);
  function bump(bigint x) {
    emit Fired(x);
    this.counter = this.counter + x;
    require(x > 0);
  }
}`;

const COND = `pragma solidcash >=0.8.0;
contract CondEmitPlain() {
  bigint counter;
  event Fired(bigint value);
  function bump(bigint x) {
    if (x > 100) { emit Fired(x); }
    this.counter = this.counter + x;
    require(x > 0);
  }
}`;

const FORGED_COMMITMENT = binToHex(new Uint8Array([0x03, 0x3f, 0x42, 0x0f])); // decodes to 999999

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));

interface Row {
  outcome: string;
  events: bigint[];
}

/**
 * Build one honest `bump(x)` row, then optionally append a spender-minted NFT past the end of the block.
 * `category: 'own'` is the forgery; `category: 'foreign'` is the guard negative control.
 */
const run = async (
  source: string, x: bigint, append?: 'own' | 'foreign',
): Promise<Row> => {
  const artifact = compileString(source);
  const provider = createTestProvider();
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
  );
  const salted = contract.withCategory(hexToBin(categoryId));
  const sc = StatefulContract.withCategory(contract, categoryId);
  const builder = await (sc as any).bump(x).build();
  const eventAddress = getEventNftAddress(salted, categoryId, artifact.events![0].signature);

  // A funding input past the block pays the fee in every row, so the honest control and the forged row differ
  // only in the appended OUTPUT.
  const { utxo, unlocker } = await createFeeFunder(provider, 20_000n);
  builder.addInput(utxo, unlocker);

  if (append) {
    if (append === 'own') {
      builder.addOutput({
        to: eventAddress,
        amount: 1000n,
        token: {
          category: categoryId,
          amount: 0n,
          nft: { capability: 'none', commitment: FORGED_COMMITMENT },
        },
      });
    } else {
      builder.addOutput({ to: eventAddress, amount: 1000n });
    }
  }

  let outcome = 'ACCEPTED';
  try {
    await provider.sendRawTransaction(raw(builder));
  } catch (error) {
    outcome = `REJECTED: ${(error as Error).message}`;
  }
  const events = outcome === 'ACCEPTED'
    ? (await readEventsFromChain(provider as any, eventAddress, categoryId, artifact.events![0]))
      .map((event: any) => event.values.value)
    : [];
  return { outcome, events };
};

describe('forged event NFTs appended past the block', () => {
  // Honest positive controls: the same builds, with nothing appended, still settle.
  it('settles the honest no-emit row', async () => {
    expect((await run(NOEMIT, 4n)).outcome).toBe('ACCEPTED');
  }, 300_000);

  it('settles the honest unconditional-emit row and logs it', async () => {
    const row = await run(UNCOND, 200n);
    expect(row.outcome).toBe('ACCEPTED');
    expect(row.events).toEqual([200n]);
  }, 300_000);

  it('settles the honest not-taken conditional row with no log', async () => {
    const row = await run(COND, 4n);
    expect(row.outcome).toBe('ACCEPTED');
    expect(row.events).toEqual([]);
  }, 300_000);

  // THE MEASUREMENT. One variable against each control above: one appended output.
  it('refuses an appended own-category event NFT on a function that never emits', async () => {
    const row = await run(NOEMIT, 4n, 'own');
    expectScriptRejection(row.outcome, 0);
  }, 300_000);

  it('refuses an appended own-category event NFT beside a genuine emit', async () => {
    const row = await run(UNCOND, 200n, 'own');
    expectScriptRejection(row.outcome, 0);
  }, 300_000);

  it('refuses an appended own-category event NFT on a not-taken conditional row', async () => {
    const row = await run(COND, 4n, 'own');
    expectScriptRejection(row.outcome, 0);
  }, 300_000);

  /**
   * Guard negative control. The pin is scoped to own-category zero-FT immutable NFTs, NOT to "any extra output":
   * the same appended output carrying no token at all is still accepted, so the refusals above discriminate on
   * the token property and not merely on the presence of an output past the block.
   */
  it('still admits an appended token-free output past the block', async () => {
    expect((await run(NOEMIT, 4n, 'foreign')).outcome).toBe('ACCEPTED');
  }, 300_000);
});
