import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

/** CALLER-EDGE-1 on a route: it settles no record, so it refuses an edge of its category itself. */
const SOURCE = `contract Caller() {
  bigint calls;
  function poke() public { this.calls = this.calls + 1; }
  function poke2() public { this.calls = this.calls + 2; }
}`;

describe('a caller edge beside a message-bus route', () => {
  it.each([
    ['a kernel route', { messageBusKernel: true, maximumInputBytes: 1_000_000 }],
    ['a batch route', {}],
  ])('is refused by %s', async (_, options) => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(SOURCE, {
      forceStateful: true, messageBus: true, suppressWarnings: true, ...options,
    });
    const base = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, { calls: 0n }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(base.withCategory(hexToBin(categoryId)), categoryId) as any;
    const builder = await contract.batch([{ function: 'poke', args: [] }]).build();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const honest = builder.buildLibauthTransaction();
    const master = sourceOutputs.find((output) => output.token?.nft?.capability === 'minting')!;
    const forged = structuredClone(honest);
    forged.outputs.push({
      lockingBytecode: hexToBin('5161'),
      valueSatoshis: 800n,
      token: { amount: 0n, category: master.token!.category, nft: { capability: 'none', commitment: new Uint8Array(32).fill(3) } },
    });

    const vm = createVirtualMachineBch2026ForProvider(provider);
    const settles = (transaction: typeof honest): boolean => transaction.inputs.every((_input, inputIndex) => (
      vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })) === true));
    expect(settles(honest)).toBe(true);
    expect(settles(forged)).toBe(false);
  }, 120_000);
});
