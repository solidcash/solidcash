import { describe, expect, it } from 'vitest';
import type { AbiFunctionReference } from '@solidcash/utils';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  solidityImportCompat: true,
  maximumInputBytes: 1_000_000,
} as const;

const handlerReferences = (
  references: readonly (string | AbiFunctionReference)[],
): readonly (string | AbiFunctionReference)[] => references;

const OVERLOADED_SOURCE = `pragma solidity ^0.8.0;
  contract Overloaded {
    function work() public { require(true); }
    function work(uint value) public { require(value == value); }
    function control() public { require(true); }
  }
`;

const handlerByArity = (
  artifact: ReturnType<typeof compileString>,
  name: string,
  arity: number,
) => artifact.messageBus?.handlers.find((handler) => (
  handler.name === name && handler.inputs.length === arity
));

describe('selector-authoritative message-bus handler filtering', () => {
  it('keeps legacy name selection as an explicit selection of every overload', () => {
    const artifact = compileString(OVERLOADED_SOURCE, {
      ...KERNEL,
      messageBusHandlers: ['work'],
    });

    const overloads = artifact.messageBus?.handlers.filter((handler) => handler.name === 'work') ?? [];
    expect(overloads).toHaveLength(2);
    expect(overloads.map((handler) => handler.inputs.length).sort()).toEqual([0, 1]);
    expect(overloads.every((handler) => handler.eligible)).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(false);
  });

  it('selects exactly one overload for an exact { name, selector } reference', () => {
    const discovery = compileString(OVERLOADED_SOURCE, KERNEL);
    const selectedSelector = handlerByArity(discovery, 'work', 1)?.selector;
    expect(selectedSelector).toBeTypeOf('string');

    const artifact = compileString(OVERLOADED_SOURCE, {
      ...KERNEL,
      messageBusHandlers: handlerReferences([{ name: 'work', selector: selectedSelector! }]),
    });

    expect(handlerByArity(artifact, 'work', 1)).toMatchObject({
      selector: selectedSelector,
      eligible: true,
    });
    expect(handlerByArity(artifact, 'work', 0)?.eligible).toBe(false);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(false);
  });

  it.each([
    ['unknown selector', (workSelector: string, _controlSelector: string) => ({
      name: 'work', selector: workSelector === '00000000' ? 'ffffffff' : '00000000',
    })],
    ['selector belonging to another name', (_workSelector: string, controlSelector: string) => ({
      name: 'work', selector: controlSelector,
    })],
  ] as const)('fails closed for an exact reference with %s', (_label, makeBadReference) => {
    const discovery = compileString(OVERLOADED_SOURCE, KERNEL);
    const workSelector = handlerByArity(discovery, 'work', 0)?.selector;
    const controlSelector = artifactHandler(discovery, 'control')?.selector;
    expect(workSelector).toBeTypeOf('string');
    expect(controlSelector).toBeTypeOf('string');

    const artifact = compileString(OVERLOADED_SOURCE, {
      ...KERNEL,
      messageBusHandlers: handlerReferences([
        { name: 'control', selector: controlSelector! },
        makeBadReference(workSelector!, controlSelector!),
      ]),
    });

    expect(artifactHandler(artifact, 'control')).toMatchObject({
      selector: controlSelector,
      eligible: true,
    });
    expect(artifact.messageBus?.handlers.filter((handler) => handler.name === 'work')
      .every((handler) => !handler.eligible)).toBe(true);
  });

  it('does not let a late-fenced overload remove or widen a good sibling selected by the binder', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Vault {
        function pay(address payable recipient) public {
          recipient.transfer(1);
          require(true);
        }

        function pay(address payable recipient, uint amount) public {
          uint adjusted = amount;
          adjusted = adjusted + 1;
          recipient.transfer(adjusted);
          recipient.transfer(adjusted);
          require(true);
        }
      }
    `, {
      ...KERNEL,
      messageBusHandlers: ['pay'],
    });

    expect(handlerByArity(artifact, 'pay', 1)).toMatchObject({ eligible: true });
    expect(handlerByArity(artifact, 'pay', 2)).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LAYOUT',
    });

    const transferSlots = artifact.messageBus?.route.blockLayout?.slots
      .filter((slot) => slot.kind === 'transfer') ?? [];
    expect(transferSlots).toHaveLength(artifact.messageBus?.maximumRows);
  });
});

function artifactHandler(artifact: ReturnType<typeof compileString>, name: string) {
  return artifact.messageBus?.handlers.find((handler) => handler.name === name);
}
