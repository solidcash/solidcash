import { bigIntToVmNumber, hexToBin } from '@bitauth/libauth';
import type { AbiFunction, Artifact, ChildDeploymentValueRecipe } from '@solidcash/utils';
import { describe, expect, it, vi } from 'vitest';
import { evaluateChildDeploymentRecipe } from '../../src/message-bus/compose-recipes.js';
import { loadFixedEffectEntries } from '../../src/message-bus/fixed-effect-entries.js';
import { evaluateFixedEffectPredicate } from '../../src/message-bus/message-bus.js';
import {
  bindSatoshiContainerSelection, resolveSatoshiContainerRouteAbi, resolveSelectedSatoshiContainerRequired,
} from '../../src/message-bus/selected-satoshi-container.js';
import { keyToSlotMulti } from '../../src/stateful/SortedList.js';

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
