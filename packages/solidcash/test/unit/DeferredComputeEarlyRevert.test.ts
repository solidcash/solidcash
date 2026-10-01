import { bigIntToVmNumber, binToHex } from '@bitauth/libauth';
import { Op, type Artifact } from '@solidcash/utils';
import { describe, expect, it, vi } from 'vitest';
import { FailedRequireError } from '../../src/Errors.js';
import type NetworkProvider from '../../src/network/NetworkProvider.js';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { probeEarlySourceRevertBeforeDeferredCompute } from '../../src/message-bus/deferred-compute-early-revert.js';

const scenario = vi.hoisted(() => ({
  reads: [] as Array<{ opcode: number; coordinate: number }>,
  error: 'Program failed an OP_VERIFY operation.',
}));

vi.mock('../../src/network/createVirtualMachine.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/network/createVirtualMachine.js')>();
  return {
    ...actual,
    createVirtualMachineBch2026ForProvider: (
      _provider: NetworkProvider,
      observer: Parameters<typeof actual.createVirtualMachineBch2026ForProvider>[1],
    ) => ({
      evaluate: () => {
        for (const read of scenario.reads) {
          if (!observer?.opcodes.has(read.opcode)) continue;
          observer.beforeOperation({
            ip: 0,
            instructions: [{ opcode: read.opcode }],
            stack: [bigIntToVmNumber(BigInt(read.coordinate))],
          });
        }
        return {
          ip: 1,
          instructions: [{ opcode: Op.OP_VERIFY }],
          error: scenario.error,
          stack: [],
          controlStack: [],
        };
      },
    }) as unknown as ReturnType<typeof actual.createVirtualMachineBch2026ForProvider>,
  };
});

function fixture(ambiguous = false): { builder: TransactionBuilder; provider: NetworkProvider } {
  const body = {
    bytecode: binToHex(Uint8Array.of(Op.OP_VERIFY)),
    requires: [{ ip: 0, line: 1, message: 'denied' }],
    sourceMap: '',
  };
  const artifact = {
    contractName: 'Guard',
    source: 'require(false, "denied");',
    constructorInputs: [],
    debug: { invokeDebug: ambiguous ? { 1: body, 2: body } : { 1: body } },
  } as unknown as Artifact;
  const builder = {
    inputs: [{ unlocker: { contract: { artifact } } }],
    buildLibauthProgram: () => ({ transaction: {}, sourceOutputs: [] }),
  } as unknown as TransactionBuilder;
  return { builder, provider: {} as NetworkProvider };
}

const candidate = [{ inputIndex: 0, inputBase: 0, offsets: [3] }];

describe('deferred-compute early source revert', () => {
  it('retains the recipe gate when the active body is ambiguous', () => {
    scenario.reads = [];
    const { builder, provider } = fixture(true);
    expect(probeEarlySourceRevertBeforeDeferredCompute(builder, provider, candidate)).toBeUndefined();
  });

  it('attributes only a source guard reached before reading unresolved sidecar values', () => {
    const { builder, provider } = fixture();
    scenario.reads = [];
    const attributed = probeEarlySourceRevertBeforeDeferredCompute(builder, provider, candidate);
    expect(attributed).toBeInstanceOf(FailedRequireError);
    expect(attributed?.message).toContain('denied');

    scenario.reads = [{ opcode: Op.OP_INPUTBYTECODE, coordinate: 3 }];
    expect(probeEarlySourceRevertBeforeDeferredCompute(builder, provider, candidate)).toBeUndefined();

    scenario.reads = [{ opcode: Op.OP_OUTPUTTOKENCOMMITMENT, coordinate: 3 }];
    expect(probeEarlySourceRevertBeforeDeferredCompute(builder, provider, candidate)).toBeUndefined();

    // A read of the sidecar's fixed output lock cannot depend on its unresolved result commitment.
    scenario.reads = [{ opcode: Op.OP_OUTPUTBYTECODE, coordinate: 3 }];
    expect(probeEarlySourceRevertBeforeDeferredCompute(builder, provider, candidate)).toBeInstanceOf(
      FailedRequireError,
    );
  });
});
