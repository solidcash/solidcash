import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import { Contract, StatefulContract } from '../../src/index.js';
import { parsePushdataCommitment } from '@solidcash/utils';
import { createTestProvider, getTxOutputs, setupStatefulUtxos } from '../test-util.js';

// Phase 3: a consumer that registered the dependency ArtifactMap (registerArtifacts / ContractBundle) calls
// L.f() with NO registerLibrary. The SDK resolves the library co-spend from the bundle - artifact by name from
// the child registry, live category from the indexer (getUtxosForLockingBytecode on the baked __libAddr ctor
// arg) - retiring the per-instance registerLibrary. See docs/multi-contract-artifacts.md (Phase 3).
describe('library-contracts: L.f() co-spend resolved from a registered bundle (no registerLibrary)', () => {
  const COUNTER = 'library Counter { bigint count; function increment() public { this.count = this.count + 1; } }';
  const CONSUMER = 'import { Counter } from "./counter.scash"; '
    + 'contract C() { bigint count; function bump() { Counter.increment(); } }';
  const resolver = (p: string): { source: string; id: string } | undefined =>
    (p.includes('counter') ? { source: COUNTER, id: 'counter' } : undefined);

  it('auto-resolves the library instance from registerArtifacts + getUtxos', async () => {
    const provider = createTestProvider();
    const counterArt = compileString(COUNTER);
    const consumerArt = compileString(CONSUMER, { importResolver: resolver });

    const counter = new Contract(counterArt, [], { provider });
    const { categoryId: counterCat } = await setupStatefulUtxos(
      provider, counter, counterArt.stateLayout!, { count: 0n }, { saltContract: true },
    );
    const counterAddr = hexToBin(counter.withCategory(hexToBin(counterCat)).lockingBytecode);

    const consumer = new Contract(consumerArt, [counterAddr], { provider });
    const { categoryId: consumerCat } = await setupStatefulUtxos(
      provider, consumer, consumerArt.stateLayout!, { count: 0n }, { saltContract: true },
    );

    const consumerSc = StatefulContract.withCategory(consumer, consumerCat);
    // Register the whole dependency map - NOT a per-instance registerLibrary.
    consumerSc.registerArtifacts({
      [counterArt.contractName]: counterArt,
      [consumerArt.contractName]: consumerArt,
    });

    const tx = await consumerSc.call.bump().send();
    expect(tx.txid).toBeDefined();

    // The library's increment ran against the consumer's own state via the auto-resolved co-spend: 0 -> 1.
    const consumerNft = getTxOutputs(tx).find(
      (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === consumerCat,
    );
    const state = parsePushdataCommitment(consumerNft!.token!.nft!.commitment, consumerArt.stateLayout!, 0);
    expect(state.count).toBe(1n);
  });

  it('still raises the clear error when neither a library instance nor its artifact is registered', async () => {
    const provider = createTestProvider();
    const counterArt = compileString(COUNTER);
    const consumerArt = compileString(CONSUMER, { importResolver: resolver });
    const counter = new Contract(counterArt, [], { provider });
    const { categoryId: counterCat } = await setupStatefulUtxos(
      provider, counter, counterArt.stateLayout!, { count: 0n }, { saltContract: true },
    );
    const counterAddr = hexToBin(counter.withCategory(hexToBin(counterCat)).lockingBytecode);
    const consumer = new Contract(consumerArt, [counterAddr], { provider });
    const { categoryId: consumerCat } = await setupStatefulUtxos(
      provider, consumer, consumerArt.stateLayout!, { count: 0n }, { saltContract: true },
    );
    const consumerSc = StatefulContract.withCategory(consumer, consumerCat);
    // No registerArtifacts, no registerLibrary -> the fallback finds nothing, the existing error stands.
    await expect(consumerSc.call.bump().send()).rejects.toThrow(/not.*registered|registerLibrary/i);
  });
});
