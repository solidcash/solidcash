import { describe, expect, it } from 'vitest';
import { assertMessageBusVerifierProgram, type MessageBusVerifierProgram } from '../src/message-bus-verifier.js';

const program = (): MessageBusVerifierProgram => ({
  verifyFunctionId: 7,
  inputCount: 3,
  inputs: [
    { name: 'activeInputIndex', type: 'bigint' },
    { name: 'expectedLocalRows', type: 'bigint' },
    { name: 'localBatch', type: 'bytes' },
  ],
  results: [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }],
  functions: [{ id: 7, name: '__message_bus_verify_atomic', bytecode: '51' }],
});

describe('message-bus replacement verifier-program metadata', () => {
  it('accepts only the fixed three-result replacement shape', () => {
    expect(() => assertMessageBusVerifierProgram(program())).not.toThrow();
    const malformed = program() as unknown as { results: unknown[] };
    malformed.results = [{ type: 'bytes32' }, { type: 'bytes32' }];
    expect(() => assertMessageBusVerifierProgram(malformed)).toThrow(/replacement shape/);
  });

  it('rejects duplicate or unbound function IDs before covenant construction', () => {
    const duplicate = program() as unknown as { functions: unknown[] };
    duplicate.functions = [
      { id: 7, name: '__message_bus_verify_atomic', bytecode: '51' },
      { id: 7, name: '__internal_7', bytecode: '51' },
    ];
    expect(() => assertMessageBusVerifierProgram(duplicate)).toThrow(/function table/);
    const wrongEntrypoint = program() as unknown as { functions: { name: string }[] };
    wrongEntrypoint.functions[0].name = '__internal_7';
    expect(() => assertMessageBusVerifierProgram(wrongEntrypoint)).toThrow(/function table/);
  });

  it('rejects renamed, retyped, and unsupported verifier ABI inputs', () => {
    const renamed = program() as unknown as { inputs: { name: string; type: string }[] };
    renamed.inputs[0].name = 'master';
    expect(() => assertMessageBusVerifierProgram(renamed)).toThrow(/function table/);
    const retyped = program() as unknown as { inputs: { name: string; type: string }[] };
    retyped.inputs[2].type = 'bytes32';
    expect(() => assertMessageBusVerifierProgram(retyped)).toThrow(/function table/);
    const unsupported = program() as unknown as { inputCount: number; inputs: unknown[] };
    unsupported.inputCount = 4;
    unsupported.inputs.push({ name: 'extra', type: 'bigint' });
    expect(() => assertMessageBusVerifierProgram(unsupported)).toThrow(/function table/);
  });
});
