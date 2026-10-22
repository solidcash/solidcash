import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { type Artifact, type EventDefinitionAbi, buildEventNftCovenantScript, computeEventNameHash } from '@solidcash/utils';
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
import { scriptToAddress } from '../../src/utils.js';
import { createFeeFunder, createTestProvider, expectScriptRejection, setupStatefulUtxos }
  from '../test-util.js';

/**
 * EVENT-SCOPE-2 residual. A stateful contract whose file declares an event it never emits has no events of its own, so
 * its covenant pins no forged log (SEC-10), yet its artifact listed that event and the SDK read a forged own-category
 * immutable NFT beside any call as its log. The artifact now lists, as Solidity's ABI does, only the events the contract
 * declares or emits; the covenant is unchanged. A contract that emits its file-level event is unchanged.
 */

const DECLARED_ONLY = `pragma solidcash >=0.8.0;
event Fired(bigint value);
contract FileEventDeclared() {
  bigint counter;
  function quiet(bigint x) {
    this.counter = this.counter + x;
    require(x > 0);
  }
}`;

const EMITTED = `pragma solidcash >=0.8.0;
event Fired(bigint value);
contract FileEventEmitted() {
  bigint counter;
  function bump(bigint x) {
    emit Fired(x);
    this.counter = this.counter + x;
    require(x > 0);
  }
}`;

const FIRED: EventDefinitionAbi = {
  name: 'Fired', signature: 'Fired(bigint)', parameters: [{ name: 'value', type: 'bigint' }],
};
const FORGED_COMMITMENT = binToHex(new Uint8Array([0x03, 0x3f, 0x42, 0x0f])); // decodes to 999999

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));

/** Build one honest call, then optionally append a spender-minted own-category immutable NFT at Fired's address. */
const run = async (artifact: Artifact, fn: string, x: bigint, forge: boolean): Promise<{
  outcome: string; provider: ReturnType<typeof createTestProvider>; contract: Contract;
  sc: ReturnType<typeof StatefulContract.withCategory>; categoryId: string; firedAddress: string;
}> => {
  const provider = createTestProvider();
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
  );
  const sc = StatefulContract.withCategory(contract, categoryId);
  const builder = await (sc as any)[fn](x).build();
  // Built by hand: getEventNftAddress resolves only an event the artifact lists.
  const firedAddress = scriptToAddress(
    buildEventNftCovenantScript(hexToBin(categoryId), computeEventNameHash(FIRED.signature)),
    contract.provider.network, contract.addressType, true,
  );

  // A funding input past the block pays the fee in every row, so honest and forged rows differ only in the output.
  const { utxo, unlocker } = await createFeeFunder(provider, 20_000n);
  builder.addInput(utxo, unlocker);
  if (forge) {
    builder.addOutput({
      to: firedAddress,
      amount: 1000n,
      token: { category: categoryId, amount: 0n, nft: { capability: 'none', commitment: FORGED_COMMITMENT } },
    });
  }

  let outcome = 'ACCEPTED';
  try {
    await provider.sendRawTransaction(raw(builder));
  } catch (error) {
    outcome = `REJECTED: ${(error as Error).message}`;
  }
  return { outcome, provider, contract, sc, categoryId, firedAddress };
};

describe('a file-level event the contract never emits', () => {
  const artifact = compileString(DECLARED_ONLY);

  it('is not listed', () => {
    expect(artifact.events).toBeUndefined();
  });

  it('reads a forged NFT at its address beside a call as no log', async () => {
    const row = await run(artifact, 'quiet', 4n, true);
    // The covenant is unchanged: it pins no log, so the forged NFT settles at the address a Fired log would use.
    expect(row.outcome).toBe('ACCEPTED');
    const handDecoded = await readEventsFromChain(row.provider as any, row.firedAddress, row.categoryId, FIRED);
    expect(handDecoded.map((event) => event.values.value)).toEqual([999999n]);
    // No SDK reader resolves an event the artifact does not list.
    expect((await row.sc.queryFilter('*')).map((log) => log.args.value)).toEqual([]);
    await expect(row.sc.queryEvents('Fired')).rejects.toThrow(/Unknown event/);
    expect(() => getEventNftAddress(row.contract, row.categoryId, FIRED.signature)).toThrow(/Unknown event/);
  }, 300_000);

  it('is left out beside a file-level event the contract emits', () => {
    const both = compileString(EMITTED.replace('event Fired', 'event Unused(bigint value);\nevent Fired'));
    expect(both.events?.map((event) => event.signature)).toEqual([FIRED.signature]);
  });

  it('is not listed when only a catch clause, which never runs, emits it', () => {
    const caught = compileString('event Fired(uint256 v); interface I { function g() external returns (uint256); }'
      + ' contract C { uint256 n; function f(I i) external {'
      + ' try i.g() returns (uint256 v) { this.n = v; } catch { emit Fired(0); this.n = 2; } } }',
    { evmCompat: true, enforceFinalRequire: false, allowUnsafeOperations: true });
    expect(caught.events).toBeUndefined();
  });
});

describe('a file-level event the contract emits (unchanged)', () => {
  const artifact = compileString(EMITTED);

  it('is listed and its honest emit reads back as the log', async () => {
    expect(artifact.events?.map((event) => event.signature)).toEqual([FIRED.signature]);
    const row = await run(artifact, 'bump', 200n, false);
    expect(row.outcome).toBe('ACCEPTED');
    expect((await row.sc.queryFilter('*')).map((log) => log.args.value)).toEqual([200n]);
  }, 300_000);

  it('refuses a forged event NFT beside its call', async () => {
    expectScriptRejection((await run(artifact, 'bump', 200n, true)).outcome, 0);
  }, 300_000);
});
