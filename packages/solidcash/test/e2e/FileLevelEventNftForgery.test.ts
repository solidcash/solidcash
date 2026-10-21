import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import {
  Contract,
  TransactionBuilder,
} from '../../src/index.js';
import {
  StatefulContract,
  getEventNftAddress,
  readEventsFromChain,
} from '../../src/stateful/index.js';
import { createFeeFunder, createTestProvider, expectScriptRejection, setupStatefulUtxos }
  from '../test-util.js';

/**
 * SEC-10 for an event declared OUTSIDE the contract. A stateful contract that emits only a file-level event declares
 * none itself, and the forged-log pin was scoped to declared events, so a spender could append an own-category
 * immutable NFT that reads back as a log at the event address. Mirrors PlainEventNftForgery's contract-level rows.
 */

const FILE_LEVEL = `pragma solidcash >=0.8.0;
event Fired(bigint value);
contract FileEventPlain() {
  bigint counter;
  function bump(bigint x) {
    emit Fired(x);
    this.counter = this.counter + x;
    require(x > 0);
  }
  function quiet(bigint x) {
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

const artifact = compileString(FILE_LEVEL);

/** Build one honest call, then optionally append a spender-minted own-category immutable NFT past the block. */
const run = async (fn: 'bump' | 'quiet', x: bigint, forge: boolean): Promise<Row> => {
  const provider = createTestProvider();
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
  );
  const salted = contract.withCategory(hexToBin(categoryId));
  const sc = StatefulContract.withCategory(contract, categoryId);
  const builder = await (sc as any)[fn](x).build();
  const eventAddress = getEventNftAddress(salted, categoryId, artifact.events![0].signature);

  // A funding input past the block pays the fee in every row, so honest and forged rows differ only in the output.
  const { utxo, unlocker } = await createFeeFunder(provider, 20_000n);
  builder.addInput(utxo, unlocker);
  if (forge) {
    builder.addOutput({
      to: eventAddress,
      amount: 1000n,
      token: {
        category: categoryId,
        amount: 0n,
        nft: { capability: 'none', commitment: FORGED_COMMITMENT },
      },
    });
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

describe('forged event NFTs for a file-level event', () => {
  it('settles the honest emit row and logs it', async () => {
    const row = await run('bump', 200n, false);
    expect(row.outcome).toBe('ACCEPTED');
    expect(row.events).toEqual([200n]);
  }, 300_000);

  it('settles the honest no-emit row', async () => {
    expect((await run('quiet', 4n, false)).outcome).toBe('ACCEPTED');
  }, 300_000);

  it('refuses an appended own-category event NFT beside a genuine file-level emit', async () => {
    expectScriptRejection((await run('bump', 200n, true)).outcome, 0);
  }, 300_000);

  it('refuses an appended own-category event NFT on a function that never emits', async () => {
    expectScriptRejection((await run('quiet', 4n, true)).outcome, 0);
  }, 300_000);
});
