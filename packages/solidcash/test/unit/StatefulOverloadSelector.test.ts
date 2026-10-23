import { describe, expect, it, vi } from 'vitest';
import { compileString } from '@solidcash/solidc';
import type { Artifact } from '@solidcash/utils';
import type { FunctionArgument } from '../../src/Argument.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { StatefulFunctionCall } from '../../src/stateful/StatefulContract.js';
import { createTestProvider } from '../test-util.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
} as const;

type PreparedCall = StatefulFunctionCall & {
  _messageBusCompositionDescriptor(): {
    functionName: string;
    selector: string;
    args: readonly FunctionArgument[];
  };
};

type StatefulCallable = (...args: FunctionArgument[]) => PreparedCall;

const attach = (source: string): { artifact: Artifact; contract: StatefulContract } => {
  const artifact = compileString(source, KERNEL);
  return {
    artifact,
    contract: new StatefulContract('00'.repeat(32), artifact, createTestProvider()),
  };
};

const abiEntry = (
  artifact: Artifact, name: string, types: readonly string[],
): { entry: Artifact['abi'][number]; selector: string } => {
  const entry = artifact.abi.find((candidate) => candidate.name === name
    && candidate.inputs.filter((input) => !input.name.startsWith('__internal__'))
      .map((input) => input.type).join(',') === types.join(','));
  const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === name
    && candidate.inputs.filter((input) => !input.name.startsWith('__internal__'))
      .map((input) => input.type).join(',') === types.join(','));
  expect(entry).toBeDefined();
  const selector = handler?.selector ?? entry?.selector;
  expect(selector).toMatch(/^[0-9a-f]{8}$/);
  return { entry: entry!, selector: selector! };
};

const signatureOf = (entry: Artifact['abi'][number]): string => (
  `${entry.name}(${entry.inputs.filter((input) => !input.name.startsWith('__internal__'))
    .map((input) => input.type).join(',')})`
);

const callNamespace = (contract: StatefulContract): Record<string, StatefulCallable> => (
  contract.call as unknown as Record<string, StatefulCallable>
);

describe('StatefulContract overload selector identity', () => {
  it('dispatches different-arity overloads from call and getFunction while retaining each exact selector', () => {
    const { artifact, contract } = attach(`pragma solidcash ^0.14.0;
      contract Overloaded() {
        int stored;
        function act() public { this.stored = 1; require(true); }
        function act(int next) public { this.stored = next; require(true); }
      }
    `);
    const noArgs = abiEntry(artifact, 'act', []);
    const oneArg = abiEntry(artifact, 'act', ['int256']);

    expect(callNamespace(contract).act()._messageBusCompositionDescriptor()).toMatchObject({
      functionName: 'act', selector: noArgs.selector, args: [],
    });
    expect((contract.getFunction('act')() as PreparedCall)._messageBusCompositionDescriptor()).toMatchObject({
      functionName: 'act', selector: noArgs.selector, args: [],
    });
    expect(callNamespace(contract).act(7n)._messageBusCompositionDescriptor()).toMatchObject({
      functionName: 'act', selector: oneArg.selector, args: [7n],
    });
    expect((contract.getFunction('act')(9n) as PreparedCall)._messageBusCompositionDescriptor()).toMatchObject({
      functionName: 'act', selector: oneArg.selector, args: [9n],
    });
  });

  it('exposes same-arity overloads by explicit ABI signature on call and getFunction', () => {
    const { artifact, contract } = attach(`pragma solidcash ^0.14.0;
      contract Overloaded() {
        int stored;
        function choose(int next) public { this.stored = next; require(true); }
        function choose(bool enabled) public { this.stored = enabled ? 1 : 0; require(true); }
      }
    `);
    const intEntry = abiEntry(artifact, 'choose', ['int256']);
    const boolEntry = abiEntry(artifact, 'choose', ['bool']);
    const intSignature = signatureOf(intEntry.entry);
    const boolSignature = signatureOf(boolEntry.entry);

    expect(callNamespace(contract)[intSignature](11n)._messageBusCompositionDescriptor()).toMatchObject({
      functionName: 'choose', selector: intEntry.selector, args: [11n],
    });
    expect((contract.getFunction(boolSignature)(true) as PreparedCall)
      ._messageBusCompositionDescriptor()).toMatchObject({
      functionName: 'choose', selector: boolEntry.selector, args: [true],
    });
  });

  it('refuses a bare name when same-arity overloads cannot be selected without guessing', () => {
    const { contract } = attach(`pragma solidcash ^0.14.0;
      contract Overloaded() {
        int stored;
        function choose(int next) public { this.stored = next; require(true); }
        function choose(bool enabled) public { this.stored = enabled ? 1 : 0; require(true); }
      }
    `);

    expect(() => callNamespace(contract).choose(1n)).toThrow(/Ambiguous call to overloaded function 'choose'/);
    expect(() => contract.getFunction('choose')(1n)).toThrow(/Ambiguous call to overloaded function 'choose'/);
  });

  it('makes callStatic signature-aware and passes the exact ABI into return derivation', async () => {
    const { artifact, contract } = attach(`pragma solidcash ^0.14.0;
      contract Overloaded() {
        int stored;
        function read(int next) public view returns (int) { return next; }
        function read(bool enabled) public view returns (bool) { return enabled; }
      }
    `);
    const intEntry = abiEntry(artifact, 'read', ['int256']);
    const boolEntry = abiEntry(artifact, 'read', ['bool']);
    const derive = vi.spyOn(contract as never, '_deriveReturnValue' as never).mockImplementation((
      _name: string, _args: FunctionArgument[], _calls: unknown, exact: Artifact['abi'][number],
    ) => Promise.resolve(exact.selector) as never);
    const callStatic = contract.callStatic as unknown as Record<string, (...args: FunctionArgument[]) => Promise<unknown>>;

    await expect(callStatic[signatureOf(intEntry.entry)](4n)).resolves.toBe(intEntry.selector);
    await expect(callStatic[signatureOf(boolEntry.entry)](true)).resolves.toBe(boolEntry.selector);
    expect(() => callStatic.read(4n)).toThrow(/Ambiguous call to overloaded function 'read'/);
    expect(derive).toHaveBeenCalledTimes(2);
  });

  it('resolves batch rows by canonical signature or selector and refuses an ambiguous bare name', () => {
    const { artifact, contract } = attach(`pragma solidcash ^0.14.0;
      contract Overloaded() {
        int stored;
        function choose(int next) public { this.stored = next; require(true); }
        function choose(bool enabled) public { this.stored = enabled ? 1 : 0; require(true); }
      }
    `);
    const intEntry = abiEntry(artifact, 'choose', ['int256']);
    const boolEntry = abiEntry(artifact, 'choose', ['bool']);

    expect(contract.batch([{ function: signatureOf(intEntry.entry), args: [12n] }]))
      .toBeInstanceOf(StatefulFunctionCall);
    expect(contract.batch([{ function: 'choose', selector: boolEntry.selector, args: [true] }]))
      .toBeInstanceOf(StatefulFunctionCall);
    expect(() => contract.batch([{ function: 'choose', args: [1n] }]))
      .toThrow(/Ambiguous call to overloaded function 'choose'/);
    expect(() => contract.batch([{
      function: signatureOf(intEntry.entry), selector: boolEntry.selector, args: [true],
    }])).toThrow(/requested selector/);
  });
});
