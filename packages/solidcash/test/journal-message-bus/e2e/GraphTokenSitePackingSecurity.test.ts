import { binToHex, hexToBin, type Output, type Transaction } from '@bitauth/libauth';
import { compileString } from '../../../../solidc/src/compiler.js';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract, getTokenContainerAddress } from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { addressToLockScript } from '../../../src/utils.js';
import { setupStatefulUtxos } from '../../test-util.js';
import { carolAddress } from '../../fixture/vars.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const VAULT = `contract Vault {
  function maybeSend(bytes32 category, address recipient, bool go) public {
    require(this.tokens[category].tokenAmount >= 0);
    if (go) { this.tokens[category].transferNft(recipient, hex"aa", 1); }
    require(true);
  }
}`;
const OPTIONS = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;

/** A built batch and the index of its route input. */
interface RouteProgram { transaction: Transaction; sourceOutputs: Output[]; input: number }

describe('graph token-site bitmap and NFT occurrence packing', () => {
  it('keeps NFT authority out of reached row 8 when all conditional NFT transfers are skipped', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(VAULT, OPTIONS);
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

  // NAMED-MINT-1, route side (docs/security/security-audit-2026-10-16.md). A spent minting container lets its
  // transaction mint the category, so the route admits an output of it away from the container's lock only in a
  // token-transfer window (this route has no effect span) and with no fungible amount, and a window no row sends
  // from is token-less.
  it('bounds what a route mints beside its named minting container', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(VAULT, OPTIONS);
    const base = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
    const inner = base.withCategory(hexToBin(categoryId));
    const contract = StatefulContract.withCategory(inner, categoryId);
    // The category's genesis: the minting container, and fungible tokens carol holds outside it.
    const seeded = await provider.addTokenUtxosDynamic((category) => [{
      address: getTokenContainerAddress(inner, categoryId, category),
      satoshis: 1200n,
      token: { amount: 50n, nft: { capability: 'minting', commitment: '' } },
    }, { address: carolAddress, satoshis: 1000n, token: { amount: 5n } }]);
    const route = artifact.messageBus!.route;
    const frame = route.graphEffectFrame!;
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const build = async (go: boolean): Promise<RouteProgram> => {
      const builder = await contract.batch([{
        function: 'maybeSend', args: [hexToBin(seeded.categoryId), Uint8Array.of(0x51), go],
      }]).build();
      const input = builder.inputs.findIndex((candidate) => 'abiFunction' in candidate.unlocker
        && candidate.unlocker.abiFunction.name === route.name);
      return { ...builder.buildLibauthProgram(), input };
    };
    const verdict = (program: RouteProgram): unknown =>
      vm.stateSuccess(vm.evaluate({ inputIndex: program.input, ...program }));
    const idle = await build(false);
    const sent = await build(true);
    expect(verdict(idle)).toBe(true);
    expect(verdict(sent)).toBe(true);
    // The windows run from `first` to `end`, one per site; row 0 owns the first and its send mints there.
    const first = sent.input + route.blockLayout!.slots.find((slot) => slot.kind === 'tcTransfer'
      && slot.slotIndex === frame.tokenTransferBase)!.offset;
    const end = first + frame.sites * frame.tokenTransferWidth;
    const send = sent.transaction.outputs[first]!.token!;
    expect(send.nft).toEqual({ capability: 'mutable', commitment: hexToBin('aa') });
    expect(idle.transaction.outputs[first]!.token).toBeUndefined();
    const carol = addressToLockScript(carolAddress);
    const mint = (amount = 0n): Output['token'] =>
      ({ category: send.category, amount, nft: { capability: 'none', commitment: hexToBin('ee') } });
    // `program` with `token` on output `index`, appending a token-less output to reach it.
    const withToken = (program: RouteProgram, index: number, token: Output['token']): RouteProgram => {
      const outputs = program.transaction.outputs.map((output) => ({ ...output }));
      while (outputs.length <= index) outputs.push({ lockingBytecode: carol, valueSatoshis: 1000n });
      outputs[index] = { ...outputs[index]!, token };
      return { ...program, transaction: { ...program.transaction, outputs } };
    };
    // `program` also spending carol's fungible tokens of the category.
    const withOutsideFungible = (program: RouteProgram): RouteProgram => {
      const { txid, vout, satoshis, token } = seeded.utxos[1]!;
      return {
        ...program,
        transaction: {
          ...program.transaction,
          inputs: [...program.transaction.inputs, {
            outpointTransactionHash: hexToBin(txid), outpointIndex: vout, sequenceNumber: 0,
            unlockingBytecode: Uint8Array.of(),
          }],
        },
        sourceOutputs: [...program.sourceOutputs, {
          lockingBytecode: carol, valueSatoshis: satoshis, token: { category: send.category, amount: token!.amount },
        }],
      };
    };
    const refused = /^Program failed an OP_(EQUAL|NUMEQUAL)?VERIFY operation\.$/;
    // 1. An NFT minted past every window is refused, beside a send or not; a token-less output there is not.
    expect(verdict(withToken(sent, end, undefined))).toBe(true);
    for (const program of [sent, idle]) expect(verdict(withToken(program, end, mint()))).toMatch(refused);
    // 2. An NFT minted in the window of a site no row reached (the second and the last), or in the window of the
    // row that ran without sending.
    for (const index of [first + 1, end - 1]) expect(verdict(withToken(sent, index, mint()))).toMatch(refused);
    expect(verdict(withToken(idle, first, mint()))).toMatch(refused);
    // 3. A mint carrying fungible tokens carol brings in, as the row's own send or past the windows. Spending them
    // beside the route without an output of the category is not refused.
    expect(verdict(withOutsideFungible(sent))).toBe(true);
    expect(verdict(withOutsideFungible(withToken(sent, first, { ...send, amount: 5n })))).toMatch(refused);
    expect(verdict(withOutsideFungible(withToken(sent, end, mint(5n))))).toMatch(refused);
    // 4. The send mints from the container's minting NFT, which the container keeps: coming back without it,
    // fungible-only or mutable, is refused.
    const lock = binToHex(addressToLockScript(getTokenContainerAddress(inner, categoryId, seeded.categoryId)));
    const kept = sent.transaction.outputs.findIndex((output) => binToHex(output.lockingBytecode) === lock);
    expect(sent.transaction.outputs[kept]!.token)
      .toEqual({ category: send.category, amount: 50n, nft: { capability: 'minting', commitment: Uint8Array.of() } });
    for (const nft of [undefined, { capability: 'mutable' as const, commitment: Uint8Array.of() }]) {
      expect(verdict(withToken(sent, kept, { category: send.category, amount: 50n, ...(nft && { nft }) }))).not.toBe(true);
    }
  }, 300_000);
});
