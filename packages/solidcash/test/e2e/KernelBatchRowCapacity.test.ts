import { binToHex } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

// A top-level kernel emit streams its records into the participant's 64-slot trailing band; a conditional one keeps
// one event window per row, up to the 255-row batch ceiling.
const tally = (emit: string): string => `contract Tally() {
  int public count;
  event Tick(int count);
  function tick() public {
    this.count = this.count + 1;
    ${emit}
    require(true);
  }
}`;
const STREAMED = 'emit Tick(this.count);';
const WINDOWED = 'if (this.count > 0) emit Tick(this.count);';

type TallySetup = {
  provider: ReturnType<typeof createMessageBusCapstoneTestProvider>;
  contract: ReturnType<typeof StatefulContract.withCategory>;
};

async function deployTally(emit: string): Promise<TallySetup> {
  const artifact = compileString(tally(emit), { forceStateful: true, messageBus: true, messageBusKernel: true,
    maximumInputBytes: 1_000_000, suppressWarnings: true });
  const provider = createMessageBusCapstoneTestProvider();
  const inner = new Contract(artifact, [], { provider });
  const setup = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {}, { saltContract: true });
  return { provider, contract: StatefulContract.withCategory(inner, setup.categoryId) };
}

const ticks = (count: number): Array<{ function: string; args: never[] }> => Array.from(
  { length: count }, () => ({ function: 'tick', args: [] }),
);

describe('kernel batch row capacity', () => {
  it.each([
    { layout: 'streamed', emit: STREAMED, count: 10 },
    { layout: 'streamed', emit: STREAMED, count: 64 },
    { layout: 'windowed', emit: WINDOWED, count: 255 },
  ])('executes $count effect-bearing rows, each owning its $layout event', async ({ emit, count }) => {
    const { provider, contract } = await deployTally(emit);
    expect(() => contract.batch(ticks(256))).toThrow(/row count must be between 1 and 255/);
    const call = contract.batch(ticks(count));
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
    expect((await contract.getState()).count).toBe(BigInt(count));
  }, 180_000);

  it('refuses a streamed batch with more records than the trailing band holds', async () => {
    const { contract } = await deployTally(STREAMED);
    await expect(contract.batch(ticks(65)).build()).rejects.toThrow(/exceed balanced trailing capacity \(65 > 64\)/);
  }, 180_000);
});
