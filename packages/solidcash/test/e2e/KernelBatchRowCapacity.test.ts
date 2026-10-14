import { binToHex } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('kernel batch row capacity', () => {
  it.each([10, 255])('executes %s effect-bearing rows with distinct event slots', async (count) => {
    const artifact = compileString(`contract Tally() {
      int public count;
      event Tick(int count);
      function tick() public {
        this.count = this.count + 1;
        emit Tick(this.count);
        require(true);
      }
    }`, { forceStateful: true, messageBus: true, messageBusKernel: true,
      maximumInputBytes: 1_000_000, suppressWarnings: true });
    const provider = createMessageBusCapstoneTestProvider();
    const inner = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {}, { saltContract: true });
    const tally = StatefulContract.withCategory(inner, setup.categoryId);
    expect(() => tally.batch(Array.from({ length: 256 }, () => ({ function: 'tick', args: [] }))))
      .toThrow(/row count must be between 1 and 255/);
    const call = tally.batch(Array.from({ length: count }, () => ({ function: 'tick', args: [] })));
    const builder = await call.build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const failures = [];
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      const state = vm.evaluate({ inputIndex, transaction, sourceOutputs });
      if (vm.stateSuccess(state) !== true) failures.push({ inputIndex, error: state.error, ip: state.ip,
        instructions: state.instructions.slice(Math.max(0, state.ip - 5), state.ip + 2),
        stack: state.stack.slice(-6).map(binToHex) });
    }
    expect(failures).toEqual([]);
    // Each row owns one event output, an event window or a record of its runtime effect stream.
    const events = transaction.outputs.flatMap((output, index) => (output.token?.nft?.capability === 'none'
      && output.token.nft.commitment.length > 0 ? [index] : []));
    expect(events).toHaveLength(count);
    // The last row must own its own event; corrupting that output cannot be hidden in unused capacity.
    const forged = structuredClone(transaction);
    forged.outputs[events[count - 1]].token!.nft!.commitment[0] ^= 1;
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: 0, transaction: forged, sourceOutputs }))).not.toBe(true);
    await call.send();
    expect((await tally.getState()).count).toBe(BigInt(count));
  }, 180_000);
});
