import { hexToBin } from '@bitauth/libauth';
import { compileString } from '../../../../solidc/src/compiler.js';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract, getTokenContainerAddress } from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

describe('graph token-site bitmap and NFT occurrence packing', () => {
  it('keeps NFT authority out of reached row 8 when all conditional NFT transfers are skipped', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`contract Vault {
      function maybeSend(bytes32 category, address recipient, bool go) public {
        require(this.tokens[category].tokenAmount >= 0);
        if (go) { this.tokens[category].transferNft(recipient, hex"aa", 1); }
        require(true);
      }
    }`, { forceStateful: true, messageBus: true, messageBusKernel: true });
    const base = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
    const inner = base.withCategory(hexToBin(categoryId));
    const contract = StatefulContract.withCategory(inner, categoryId);
    const seeded = await provider.addTokenUtxosDynamic((category) => [{
      address: getTokenContainerAddress(inner, categoryId, category),
      satoshis: 1200n,
      token: { amount: 50n, nft: { capability: 'mutable', commitment: 'aa' } },
    }]);
    const builder = await contract.batch(Array.from({ length: 9 }, () => ({
      function: 'maybeSend', args: [hexToBin(seeded.categoryId), Uint8Array.of(0x51), false],
    }))).build();
    const { transaction, sourceOutputs } = builder.buildLibauthProgram();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const route = builder.inputs.findIndex((input) => 'abiFunction' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(route).toBeGreaterThanOrEqual(0);
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: route, transaction, sourceOutputs }))).toBe(true);
    const preserved = transaction.outputs.find((output) => output.token?.nft?.capability === 'mutable'
      && output.token.amount === 50n);
    expect(preserved).toBeDefined();
    preserved!.token!.nft!.capability = 'none';
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: route, transaction, sourceOutputs })))
      .toMatch(/^Program failed an OP_(EQUAL)?VERIFY operation\.$/);
    const taken = await contract.batch([{
      function: 'maybeSend', args: [hexToBin(seeded.categoryId), Uint8Array.of(0x51), true],
    }]).build();
    const takenProgram = taken.buildLibauthProgram();
    const takenRoute = taken.inputs.findIndex((input) => 'abiFunction' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: takenRoute, ...takenProgram }))).toBe(true);
    expect(taken.outputs.some((output) => output.token?.category === seeded.categoryId
      && output.token.nft?.commitment === 'aa' && output.token.amount === 0n)).toBe(true);
  }, 120_000);
});
