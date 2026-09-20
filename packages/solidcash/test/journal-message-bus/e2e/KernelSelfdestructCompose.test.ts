import { hexToBin } from '@bitauth/libauth';
import { type Artifact } from '@solidcash/utils';
import { compileStringMulti } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract, messageBus } from '../../../src/index.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
} as const;

/**
 * Selfdestruct permanently destroys participant topology. Kernel admission refuses the handler as
 * `KERNEL_LIFECYCLE` (no diagnostic lifecycleTopology spans), and messageBus.compose fails closed
 * at batch eligibility before any VM evaluation.
 */
describe('kernel selfdestruct compose fence', () => {
  it('compiles KERNEL_LIFECYCLE refusal then refuses messageBus.compose for selfdestruct', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`
      interface IVictim {
        function kill();
        function idle();
      }
      contract Coordinator(address victim) {
        function run() public {
          IVictim(victim).kill();
          require(true);
        }
        function rest() public {
          IVictim(victim).idle();
          require(true);
        }
      }
      contract Victim() {
        function kill() public selfdestruct { require(true); }
        function idle() public { require(true); }
      }
    `, KERNEL);

    const kill = artifacts.Victim.messageBus?.handlers.find((handler) => handler.name === 'kill');
    expect(kill).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LIFECYCLE',
    });
    expect(kill).not.toHaveProperty('lifecycleTopology');
    expect(artifacts.Victim.messageBus?.handlers.find((handler) => handler.name === 'idle'))
      .toMatchObject({ eligible: true });

    const connect = async (artifact: Artifact, args: readonly unknown[] = []): Promise<StatefulContract> => {
      const base = new Contract(artifact, args as never[], { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const victim = await connect(artifacts.Victim);
    const coordinator = await connect(artifacts.Coordinator, [hexToBin(victim.inner.lockingBytecode)]);
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);

    await expect(messageBus.compose({
      preparedCalls: [
        { contract: coordinator, functionName: 'run', args: [] },
        { contract: victim, functionName: 'kill', args: [] },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build()).rejects.toThrow(/Handler 'kill' is not batch eligible: KERNEL_LIFECYCLE/);

    await expect(messageBus.compose({
      preparedCalls: [
        { contract: coordinator, functionName: 'rest', args: [] },
        { contract: victim, functionName: 'idle', args: [] },
      ],
      funder: await createBareP2pkhFeeFunder(provider, 500_000n),
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build()).resolves.toBeTruthy();
  }, 180_000);
});
