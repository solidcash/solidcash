import { describe, expect, it } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import {
  assertPreparedInvocationIdentity,
  type PreparedAtomicMessageBusCall,
} from '../../src/message-bus/compose.js';
import type { PlannedGraphInvocation } from '../../src/message-bus/graph.js';
import { resolvePreparedProducerEntry } from '../../src/stateful/StatefulContract.js';

/**
 * A prepared child invocation authorizes a value-chunk producer effect domain through the selector it transports.
 * Overloads share a name, so a first-by-name ABI match can name a different dispatch target than the caller meant
 * while still producing a plausible four-byte selector - the wrong producer, silently. These tests pin the two
 * halves of the fix: resolution never accepts a bare ambiguous name, and transport is refused when it disagrees
 * with the graph row the composer planned.
 */

const ONE_ARG_SELECTOR = '11111111';
const TWO_ARG_SELECTOR = '22222222';

/** Callee whose ABI lists the one-argument overload first: `.find(name)` would pick it for both overloads. */
const overloadedCallee = (): Artifact => ({
  contractName: 'Overloaded',
  constructorInputs: [],
  source: '',
  bytecode: '',
  abi: [
    { name: 'pick', selector: ONE_ARG_SELECTOR, inputs: [{ name: 'a', type: 'int' }] },
    {
      name: 'pick', selector: TWO_ARG_SELECTOR,
      inputs: [{ name: 'a', type: 'int' }, { name: 'b', type: 'int' }],
    },
    { name: 'keep', selector: '33333333', inputs: [] },
  ],
} as Artifact);

/** A separate deployment that advertises the same logical name under a third selector. */
const foreignCallee = (): Artifact => ({
  contractName: 'Foreign',
  constructorInputs: [],
  source: '',
  bytecode: '',
  abi: [
    { name: 'pick', selector: '44444444', inputs: [{ name: 'a', type: 'int' }] },
  ],
} as Artifact);

const plannedInvocation = (selectorHex: string): PlannedGraphInvocation => ({
  index: 0,
  parent: null,
  callee: 1,
  function: 'pick',
  selectorHex,
  producerPath: { status: 'unavailable' },
} as unknown as PlannedGraphInvocation);

const preparedInvocation = (selector?: string): PreparedAtomicMessageBusCall => ({
  contract: {} as PreparedAtomicMessageBusCall['contract'],
  functionName: 'pick',
  args: [],
  producerPath: { status: 'unavailable' },
  ...(selector !== undefined && { selector }),
} as PreparedAtomicMessageBusCall);

describe('prepared producer selector authority', () => {
  describe('resolvePreparedProducerEntry', () => {
    it('prefers the compiler-published selector over the first ABI entry sharing the name', () => {
      const resolved = resolvePreparedProducerEntry([overloadedCallee()], 'pick', TWO_ARG_SELECTOR.toUpperCase());

      expect(resolved?.selector).toBe(TWO_ARG_SELECTOR);
      expect(resolved?.inputs).toHaveLength(2);
    });

    it('resolves against the delegate executor before a forwarder advertising the same name', () => {
      const resolved = resolvePreparedProducerEntry(
        [overloadedCallee(), foreignCallee()], 'pick', TWO_ARG_SELECTOR,
      );

      expect(resolved?.selector).toBe(TWO_ARG_SELECTOR);
    });

    it('withholds authority when two distinct overload selectors share a name and none was published', () => {
      expect(resolvePreparedProducerEntry([overloadedCallee()], 'pick')).toBeUndefined();
    });

    it('accepts a name whose matching entries all agree on one selector', () => {
      const aliased = overloadedCallee();
      (aliased.abi as unknown as Array<{ selector?: string }>)[1].selector = ONE_ARG_SELECTOR;

      expect(resolvePreparedProducerEntry([aliased], 'pick')?.selector).toBe(ONE_ARG_SELECTOR);
    });

    it('fails closed for a malformed or unadvertised published selector', () => {
      expect(resolvePreparedProducerEntry([overloadedCallee()], 'pick', 'not-a-selector')).toBeUndefined();
      expect(resolvePreparedProducerEntry([overloadedCallee()], 'pick', '99999999')).toBeUndefined();
    });

    it('resolves a unique name and refuses a name the callee does not declare', () => {
      expect(resolvePreparedProducerEntry([overloadedCallee()], 'keep')?.selector).toBe('33333333');
      expect(resolvePreparedProducerEntry([overloadedCallee()], 'absent')).toBeUndefined();
    });
  });

  describe('assertPreparedInvocationIdentity', () => {
    it('refuses a transported selector that names a different overload than the graph row', () => {
      expect(() => assertPreparedInvocationIdentity(
        preparedInvocation(ONE_ARG_SELECTOR), plannedInvocation(TWO_ARG_SELECTOR), 0,
      )).toThrow(/selector disagrees with the compiled graph/);
    });

    it('accepts the graph row selector, case-insensitively', () => {
      expect(() => assertPreparedInvocationIdentity(
        preparedInvocation(TWO_ARG_SELECTOR), plannedInvocation(TWO_ARG_SELECTOR), 0,
      )).not.toThrow();
      expect(() => assertPreparedInvocationIdentity(
        preparedInvocation(TWO_ARG_SELECTOR.toUpperCase()), plannedInvocation(TWO_ARG_SELECTOR), 0,
      )).not.toThrow();
    });

    it('accepts a withheld selector, which runtime-dispatched edges legitimately carry', () => {
      expect(() => assertPreparedInvocationIdentity(
        preparedInvocation(), plannedInvocation(TWO_ARG_SELECTOR), 0,
      )).not.toThrow();
    });
  });
});
