import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

/**
 * Kernel route admission for a handler that runs a runtime transfer loop (`runtimeLoopTransfers`). A CHUNKED wide
 * emit beside it is refused (`KERNEL_LAYOUT`): the runtime effect stream's one record per site would have to share
 * the trailing band with the transfer records, and the learner cannot read transfer records yet. A COMPACT narrow
 * emit still streams.
 */
const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;

describe('kernel route runtime-transfer + emit admission boundary', () => {
  it('refuses a wide emit beside a runtime transfer loop', () => {
    const artifact = compileString(`pragma solidcash ^0.14.0;
      contract KernelTransferWideEvent() {
        event Wide(bytes32 a, bytes32 b, bytes32 c, bytes32 d, bytes32 e);
        int count;
        function pay(int n, bytes recipient, bytes32 a) public {
          for (int i = 0; i < n; i = i + 1) {
            this.transfer(recipient, 2000 + i);
          }
          emit Wide(a, a, a, a, a);
          require(true);
        }
      }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('streams a narrow emit beside a runtime transfer loop compact', () => {
    const artifact = compileString(`pragma solidcash ^0.14.0;
      contract KernelTransferNarrowEvent() {
        event Narrow(int value);
        int count;
        function pay(int n, bytes recipient) public {
          for (int i = 0; i < n; i = i + 1) {
            this.transfer(recipient, 2000 + i);
          }
          emit Narrow(n);
          require(true);
        }
      }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay');
    expect(handler).toMatchObject({ eligible: true });
    expect(handler?.emits).toBeUndefined();
    expect(handler?.runtimeLoopEvents).toEqual([
      expect.objectContaining({ eventSignatures: [artifact.events![0]!.signature] }),
    ]);
    expect((handler?.runtimeLoopEvents as { chunked?: true }[])[0].chunked).toBeUndefined();
  });
});
