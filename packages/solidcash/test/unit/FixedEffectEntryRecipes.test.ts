import { bigIntToVmNumber, hexToBin } from '@bitauth/libauth';
import type { AbiFunction, Artifact, ChildDeploymentValueRecipe, FixedBchTransferAbi } from '@solidcash/utils';
import { describe, expect, it, vi } from 'vitest';
import { evaluateChildDeploymentRecipe, materializeFixedBchTransfer } from '../../src/message-bus/compose-recipes.js';
import { loadFixedEffectEntries } from '../../src/message-bus/fixed-effect-entries.js';
import { evaluateFixedEffectPredicate } from '../../src/message-bus/message-bus.js';
import {
  bindSatoshiContainerSelection, resolveSatoshiContainerRouteAbi, resolveSelectedSatoshiContainerRequired,
} from '../../src/message-bus/selected-satoshi-container.js';
import { keyToSlotMulti } from '../../src/stateful/SortedList.js';
import { createTestProvider } from '../test-util.js';

const collection = { name: 'payments', signature: 'payments:mapping(int256 => Payment)',
  kind: 'mapping', keyType: 'int256', valueType: 'Payment', sorted: true } as const;
const artifact = { stateLayout: { collections: [collection], structs: [{ name: 'Payment', fields: [
  { name: 'amount', type: 'int256' }, { name: 'enabled', type: 'bool' },
  { name: 'recipient', type: 'bytes25' }, { name: 'flags', type: 'bool[2]' },
] }] } } as unknown as Artifact;
const entryRecipe = (path: readonly (string | number)[], resultType: string): ChildDeploymentValueRecipe => ({
  kind: 'entry', collection: collection.signature, keys: [{ kind: 'handlerInput', inputIndex: 0, resultType: 'int256' }],
  path, resultType,
});
const recipient = hexToBin(`76a914${'12'.repeat(20)}88ac`);
const incoming = { slot: keyToSlotMulti([bigIntToVmNumber(7n)], collection),
  value: { amount: 2_000n, enabled: true, recipient, flags: [false, true] } };

describe('authenticated fixed-effect entry recipes', () => {
  it('omits a satoshi container when the selected authenticated transfer amount is zero', async () => {
    const handler: AbiFunction = {
      name: 'refund', selector: 'aabbccdd', inputs: [{ name: 'key', type: 'int256' }],
      blockLayout: { blockSize: 2, slots: [{ kind: 'master', offset: 0 },
        { kind: 'satoshiContainer', offset: 1 }] },
      transferCount: 1,
      transfers: [{ transferIndex: 0, recipient: { kind: 'forward', paramIndex: 1 },
        amount: { kind: 'literal', type: 'bigint', value: '1' },
        amountRecipe: entryRecipe(['amount'], 'int256') }],
    };
    const selection = { artifact: { ...artifact, abi: [handler] }, selectors: [handler.selector] };
    const host = { getState: async () => ({}), getEntries: async () => [incoming] };

    expect(await resolveSelectedSatoshiContainerRequired({ ...selection, args: [[8n]] }, host)).toBe(false);
    expect(await resolveSelectedSatoshiContainerRequired({ ...selection, args: [[7n]] }, host)).toBe(true);
    expect(await resolveSelectedSatoshiContainerRequired({ ...selection, args: [undefined] }, host)).toBe(true);
  });

  it('omits a container only after resolving every exact selected row against incoming entries', async () => {
    const handler: AbiFunction = { name: 'pay', selector: '11223344', inputs: [{ name: 'key', type: 'int256' }],
      blockLayout: { blockSize: 2, slots: [{ kind: 'master', offset: 0 }, { kind: 'satoshiContainer', offset: 1 }] },
      transferCount: 1, transfers: [{ transferIndex: 0, recipient: { kind: 'forward', paramIndex: 1 },
        amount: { kind: 'literal', type: 'bigint', value: '2000' },
        condition: { kind: 'fixedEffectRecipe', fixedEffectRecipe: entryRecipe(['enabled'], 'bool') } }] };
    const selectedArtifact = { ...artifact, abi: [handler] };
    const host = { getState: async () => ({}), getEntries: async () => [incoming] };
    const selection = { artifact: selectedArtifact, selectors: [handler.selector], args: [[8n]] };
    expect(await resolveSelectedSatoshiContainerRequired(selection, host)).toBe(false);
    expect(await resolveSelectedSatoshiContainerRequired({ ...selection, args: [[7n]] }, host)).toBe(true);
    expect(await resolveSelectedSatoshiContainerRequired({ ...selection,
      selectors: [handler.selector, handler.selector], args: [[8n], [7n]] }, host)).toBe(true);
    expect(await resolveSelectedSatoshiContainerRequired({ ...selection, args: [undefined] }, host)).toBe(true);
    expect(await resolveSelectedSatoshiContainerRequired({ ...selection, selectors: ['ffffffff'] }, host))
      .toBeUndefined();
    expect(await resolveSelectedSatoshiContainerRequired({ ...selection,
      artifact: { ...selectedArtifact, abi: [{ ...handler, transferCount: 2 }] } }, host)).toBe(true);
    const route = { ...handler, transferCount: 8 };
    bindSatoshiContainerSelection(route, selection);
    // Later caller annotations cannot change the captured row. The original ABI is not mutated either.
    selection.args[0][0] = 7n;
    expect(await resolveSatoshiContainerRouteAbi(route, host)).toMatchObject({
      transferCount: 0, messageBusActiveSatoshiContainer: false,
    });
    expect(route.transferCount).toBe(8);
    expect(await resolveSatoshiContainerRouteAbi({ ...route }, host)).toEqual(route);
    const alreadyNarrowedRoute = { ...handler, transferCount: 0, messageBusActiveSatoshiContainer: false };
    bindSatoshiContainerSelection(alreadyNarrowedRoute, selection);
    expect(await resolveSatoshiContainerRouteAbi(alreadyNarrowedRoute, host)).toBe(alreadyNarrowedRoute);
    const logical = { ...handler, transfers: [{ ...handler.transfers![0], condition: {
      kind: 'fixedEffectRecipe', fixedEffectRecipe: { kind: 'logicalCaller', resultType: 'address' } as const,
    } }] };
    expect(await resolveSelectedSatoshiContainerRequired({ ...selection, args: [[8n]],
      artifact: { ...selectedArtifact, abi: [logical] } }, host)).toBe(true);
  });

  it('activates address-zero fixed effects across empty and ABI-word forms', () => {
    const zeroAddress: Parameters<typeof evaluateFixedEffectPredicate>[0] = {
      kind: 'binary', operator: '==',
      left: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
      right: { kind: 'cast', type: 'address',
        expression: { kind: 'literal', type: 'bigint', value: '0' } },
    };
    for (const value of [new Uint8Array(), new Uint8Array(20), new Uint8Array(32)]) {
      expect(evaluateFixedEffectPredicate(zeroAddress, [value])).toBe(true);
    }
    expect(evaluateFixedEffectPredicate(zeroAddress, [recipient])).toBe(false);
  });

  it('materializes Solidity BCH recipients as P2PKH without rewriting native locking bytecode', () => {
    const transfer: FixedBchTransferAbi = {
      transferIndex: 0,
      recipient: { kind: 'forward', paramIndex: 0 },
      amount: { kind: 'forward', paramIndex: 1 },
    };
    const solidityArtifact = { ...artifact, compiler: { options: { evmCompat: true } } } as Artifact;
    const provider = createTestProvider();
    const identity = recipient.slice(3, 23);
    const abiWord = new Uint8Array(32);
    abiWord.set(identity, 12);
    const materialize = (address: Uint8Array): Uint8Array => materializeFixedBchTransfer(
      transfer, [address, 1_000n], ['address', 'uint256'], solidityArtifact, provider,
    ).lockingBytecode;
    expect(materialize(identity)).toEqual(recipient);
    expect(materialize(abiWord)).toEqual(recipient);
    expect(materialize(recipient)).toEqual(recipient);
    abiWord[0] = 1;
    expect(() => materialize(abiWord)).toThrow(/malformed Solidity address word/);
  });

  it('resolves captured slot keys and typed leaves with one authenticated collection read', async () => {
    const amount = entryRecipe(['amount'], 'int256');
    const flag = entryRecipe(['flags', 1], 'bool');
    const host = { getEntries: vi.fn(async () => [incoming]) };
    const resolve = await loadFixedEffectEntries([amount, flag], artifact, host);
    expect(evaluateChildDeploymentRecipe(amount, [7n], ['int256'], false, {}, undefined, resolve)).toBe(2_000n);
    expect(evaluateChildDeploymentRecipe(flag, [7n], ['int256'], false, {}, undefined, resolve)).toBe(true);
    expect(host.getEntries).toHaveBeenCalledExactlyOnceWith(collection.signature);
    expect(evaluateChildDeploymentRecipe(amount, [8n], ['int256'], false, {}, undefined, resolve)).toBe(0n);
  });

  it('evaluates typed entry conditions but leaves context-free planning conservative', async () => {
    const condition: ChildDeploymentValueRecipe = { kind: 'binary', operator: '&&', resultType: 'bool',
      left: entryRecipe(['enabled'], 'bool'), right: { kind: 'binary', operator: '>', resultType: 'bool',
        left: entryRecipe(['amount'], 'int256'), right: { kind: 'intLiteral', value: '1000', resultType: 'int256' } } };
    const resolve = await loadFixedEffectEntries([condition], artifact, { getEntries: async () => [incoming] });
    expect(evaluateChildDeploymentRecipe(condition, [7n], ['int256'], false, {}, undefined, resolve)).toBe(true);
    expect(evaluateChildDeploymentRecipe(condition, [8n], ['int256'], false, {}, undefined, resolve)).toBe(false);
    expect(evaluateFixedEffectPredicate({ kind: 'fixedEffectRecipe', fixedEffectRecipe: condition }, [7n]))
      .toBeUndefined();
    expect(() => evaluateChildDeploymentRecipe(condition, [7n], ['int256'], false))
      .toThrow(/authenticated entry recipe context/);
  });

  it('rejects invalid paths and leaf types instead of reading arbitrary object properties', async () => {
    for (const recipe of [entryRecipe(['__proto__'], 'int256'), entryRecipe(['flags', 2], 'bool'),
      entryRecipe(['amount'], 'bool'), entryRecipe(['flags'], 'bool')]) {
      const resolve = await loadFixedEffectEntries([recipe], artifact, { getEntries: async () => [incoming] });
      expect(() => evaluateChildDeploymentRecipe(recipe, [7n], ['int256'], false, {}, undefined, resolve)).toThrow();
    }
  });

  it('rejects duplicate authenticated slots and missing collection schemas', async () => {
    const recipe = entryRecipe(['amount'], 'int256');
    const resolve = await loadFixedEffectEntries([recipe], artifact, { getEntries: async () => [incoming, incoming] });
    expect(() => evaluateChildDeploymentRecipe(recipe, [7n], ['int256'], false, {}, undefined, resolve))
      .toThrow(/duplicate entries/);
    await expect(loadFixedEffectEntries([recipe], {} as Artifact, { getEntries: async () => [] }))
      .rejects.toThrow(/collection.*unavailable/);
  });

  it('uses canonical address identities for nested mapping keys', async () => {
    const nested = { ...collection, signature: 'payments:mapping(address => mapping(int256 => Payment))',
      keyType: 'address', keyTypes: ['address', 'int256'], addressKeyEncoding: 'identity20' as const };
    const nestedArtifact = { ...artifact, stateLayout: { ...artifact.stateLayout!, collections: [nested] } };
    const recipe: ChildDeploymentValueRecipe = { kind: 'entry', collection: nested.signature,
      keys: [{ kind: 'handlerInput', inputIndex: 0, resultType: 'address' },
        { kind: 'intLiteral', value: '7', resultType: 'int256' }], path: ['amount'], resultType: 'int256' };
    const row = { ...incoming, slot: keyToSlotMulti([recipient.slice(3, 23), bigIntToVmNumber(7n)], nested) };
    const resolve = await loadFixedEffectEntries([recipe], nestedArtifact, { getEntries: async () => [row] });
    expect(evaluateChildDeploymentRecipe(recipe, [recipient], ['address'], false, {}, undefined, resolve)).toBe(2_000n);
  });
});
