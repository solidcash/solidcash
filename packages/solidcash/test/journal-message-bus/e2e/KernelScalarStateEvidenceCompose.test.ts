import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { discoverMessageBusComputedResourceOutputs } from '../../../src/message-bus/preflight.js';
import {
  createCompositionSettlementSession, runWithCompositionSettlementSession,
} from '../../../src/stateful/value-chunk-persist.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';
import { messageBusVmAccepts } from './vm-accepts.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
  maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;

describe('kernel scalar state comes from executed writes', () => {
  it.each([
    { name: 'event-only write', body: '', expected: 7n },
    { name: 'mapping write', body: 'this.records[0] = amount;', expected: 7n },
    { name: 'non-unit scalar increment', body: 'this.version = this.version + amount;', expected: 10n },
  ])('settles a $name without guessing from the integer field or event argument', async ({ body, expected }) => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`interface IProbe { function touch() external; }
    contract Store() {
      int version;
      bool enabled;
      ${body.includes('records') ? 'mapping(int => int) records;' : ''}
      event Notice(int value);
      function apply(address probe, int amount) public {
        ${body}
        emit Notice(99);
        IProbe(probe).touch();
        require(this.enabled);
      }
    }`, KERNEL);
    const base = new Contract(artifact, [], { provider });
    const seeded = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, { version: 7n, enabled: true }, { saltContract: true },
    );
    const store = StatefulContract.withCategory(base.withCategory(hexToBin(seeded.categoryId)), seeded.categoryId);
    const probeArtifact = compileString('contract Probe() { function touch() public { require(true); } }', KERNEL);
    const probeBase = new Contract(probeArtifact, [], { provider });
    const probeSeeded = await setupStatefulUtxos(
      provider, probeBase, probeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const probe = StatefulContract.withCategory(
      probeBase.withCategory(hexToBin(probeSeeded.categoryId)), probeSeeded.categoryId,
    );
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      calls: [store.call.apply(probe.inner.lockingBytecode, 3n), probe.call.touch()],
      funder, changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    expect(messageBusVmAccepts(builder)).toBe(true);
    if (body.includes('this.version =')) {
      const dataIndex = builder.inputs.findIndex((input) => input.token?.category === store.categoryId
        && input.token.nft?.capability === 'mutable');
      expect(dataIndex).toBeGreaterThanOrEqual(0);
      const output = builder.outputs[dataIndex].token!.nft!;
      const correct = output.commitment;
      const prior = builder.inputs[dataIndex].token!.nft!.commitment;
      output.commitment = prior;
      try {
        for (const phase of ['open', 'running', 'finalized']) {
          const session = createCompositionSettlementSession();
          if (phase !== 'open') session.constraintFixpoint.recordDomainPass('fixture', 'initial');
          if (phase === 'finalized') session.constraintFixpoint.finalize();
          const before = session.constraintFixpoint.getPassCount();
          for (let repeat = 0; repeat < 2; repeat += 1) {
            const proposals = runWithCompositionSettlementSession(session, () =>
              discoverMessageBusComputedResourceOutputs(builder));
            expect(binToHex(proposals.get(dataIndex)!)).toBe(correct);
            expect(output.commitment).toBe(prior);
            expect(session.constraintFixpoint.getPassCount()).toBe(before);
            expect(session.constraintFixpoint.getPhase()).toBe(phase);
          }
        }
      } finally {
        output.commitment = correct;
      }
    }
    // Rebuilding for send must rediscover exact state even after the first build finalized its session.
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/u) });
    expect((await store.getState()).version).toBe(expected);
  }, 180_000);
});
