import { hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, layer3 } from '../../src/index.js';
import { createTestProvider } from '../test-util.js';

/**
 * Invocation-transcript-v1 section 3.3 makes a proxy/delegate pair ONE participant: the proxy master is the
 * owner and the immutable implementation input is its executor. This is intentionally a red end-to-end
 * publication fixture. It starts from compiler output and the production worklist, then stops at the first
 * boundary which prevents constructing the normative transaction. The legacy adjacent lowLevelCall slot is
 * not accepted as evidence for the missing participant-row fields.
 *
 * Remove `it.fails` only when all three cases reach BCH-2026: honest settles, executor substitution rejects,
 * and a forged final proxy commitment rejects. Until then a green legacy delegate transaction must not turn
 * the v1 row into a completion claim.
 */

const CONTROLLER = `aa20${'11'.repeat(32)}87`;
const CATEGORY = '22'.repeat(32);
const OPTIONS = {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: CONTROLLER,
  experimentalMessageBusControllerCategory: CATEGORY,
};

const IMPLEMENTATION = `pragma solidcash >=0.8.0;
contract V1PinnedDelegate() {
  bigint counter;
  function increment() delegate {
    this.counter = this.counter + 1;
    require(true);
  }
}`;

const FOREIGN_IMPLEMENTATION = IMPLEMENTATION.replace('V1PinnedDelegate', 'V1ForeignDelegate');

const PROXY = `pragma solidcash >=0.8.0;
contract V1DelegateProxy(address immutable implementation) {
  bigint counter;
  function increment(bytes calldata) public {
    implementation.delegatecall(calldata);
    require(calldata.length == 4);
  }
}`;

interface RequiredDelegateParticipant {
  executionKind: 1;
  executorInputIndex: number;
  executorLockingBytecode: string;
}

const prepareNormativeTransaction = (mode: 'honest' | 'foreign-executor' | 'forged-proxy-state') => {
  const provider = createTestProvider();
  const implementationArtifact = compileString(IMPLEMENTATION, OPTIONS);
  const foreignArtifact = compileString(FOREIGN_IMPLEMENTATION, OPTIONS);
  const implementation = new Contract(implementationArtifact, [], { provider });
  const foreign = new Contract(foreignArtifact, [], { provider });
  const proxyArtifact = compileString(PROXY, OPTIONS);
  const proxy = new Contract(proxyArtifact, [implementation.lockingBytecode], { provider });
  const selector = implementationArtifact.abi.find(({ name }) => name === 'increment')!.selector!;
  const plan = layer3.deriveCompiledGraphPlan({
    root: { artifact: proxyArtifact, lockingBytecode: proxy.lockingBytecode },
    function: 'increment',
    args: [hexToBin(selector)],
    targets: {},
  });
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  // Exercise the production finalizer too: today it emits a valid legacy owner frame, but has no fields with
  // which the SDK could place or authenticate a distinct delegate executor input.
  layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, [''], layout.projectionInputs,
  );

  expect(plan.participants).toHaveLength(1);
  expect(plan.participants[0].blockLayout.slots)
    .toContainEqual({ kind: 'lowLevelCall', offset: 2, slotIndex: 0 });

  const requestedExecutor = mode === 'foreign-executor'
    ? foreign.lockingBytecode : implementation.lockingBytecode;
  const participant = plan.participants[0] as typeof plan.participants[0]
    & Partial<RequiredDelegateParticipant>;
  if (participant.executionKind !== 1
    || participant.executorInputIndex === undefined
    || participant.executorLockingBytecode === undefined) {
    throw new Error(
      'L3_V1_DELEGATE_PARTICIPANT_UNREPRESENTABLE: participant 0 publishes a lowLevelCall slot but lacks '
      + 'executionKind=1, executorInputIndex, and executorLockingBytecode',
    );
  }

  // These are the two independent hostile witnesses the eventual transaction must carry through finalization.
  expect(participant.executorLockingBytecode).toBe(requestedExecutor);
  return { plan, forgedProxyCounter: mode === 'forged-proxy-state' ? 2n : 1n };
};

describe('invocation-transcript-v1 pinned one-hop delegate participant', () => {
  it.fails('settles one exact delegate executor and one final proxy-state flush', () => {
    prepareNormativeTransaction('honest');
  });

  it.fails('rejects a locking-bytecode substitution for the pinned delegate executor', () => {
    prepareNormativeTransaction('foreign-executor');
  });

  it.fails('rejects a forged final proxy state under the delegate settlement authority', () => {
    prepareNormativeTransaction('forged-proxy-state');
  });
});
