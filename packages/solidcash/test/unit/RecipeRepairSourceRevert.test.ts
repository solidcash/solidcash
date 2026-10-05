import { bigIntToVmNumber, binToHex } from '@bitauth/libauth';
import { Op, type Artifact } from '@solidcash/utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type NetworkProvider from '../../src/network/NetworkProvider.js';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { gateWouldApplyDynamicChunkRepairsIfRecipe } from '../../src/message-bus/computed-dynamic-chunks.js';
import { gateWouldApplyValueChunkRepairsIfRecipe } from '../../src/message-bus/computed-value-chunks.js';
import {
  getMaterializationMode, setMaterializationMode,
} from '../../src/message-bus/materialization-mode.js';
import { provenSourceRevertIndependentOfRepair } from '../../src/message-bus/preflight.js';

const scenario = vi.hoisted(() => ({
  reads: [] as Array<{ opcode: number; coordinate: number }>,
  failingOpcode: 0x69,
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
            ip: 0, instructions: [{ opcode: read.opcode }], stack: [bigIntToVmNumber(BigInt(read.coordinate))],
          });
        }
        return {
          ip: 1, instructions: [{ opcode: scenario.failingOpcode }], error: scenario.error, stack: [], controlStack: [],
        };
      },
    }) as unknown as ReturnType<typeof actual.createVirtualMachineBch2026ForProvider>,
  };
});

// A caller frame that fails at its guard after a registry view returned false; its dynamic output is stale.
function fixture(message: string | null = 'member required'): TransactionBuilder {
  const body = {
    bytecode: binToHex(Uint8Array.of(scenario.failingOpcode)),
    requires: [{ ip: 0, line: 3, ...(message !== null && { message }) }],
    sourceMap: '',
  };
  const artifact = {
    contractName: 'Caller',
    source: 'contract Caller {\n function post() public {\n require(registered, "member required");\n } }',
    constructorInputs: [],
    debug: { invokeDebug: { 1: body } },
  } as unknown as Artifact;
  return {
    provider: {},
    inputs: [{ unlocker: { contract: { artifact } } }],
    outputs: [{ to: Uint8Array.of(0x51), token: { nft: { commitment: '00', capability: 'mutable' } } }],
    buildLibauthProgram: () => ({
      transaction: { inputs: [{ unlockingBytecode: new Uint8Array() }], outputs: [] },
      sourceOutputs: [],
    }),
  } as unknown as TransactionBuilder;
}

const staleChunk = new Map([[0, Uint8Array.of(0x00, 0x01, 0xaa)]]);

const gateDynamicChunk = (builder: TransactionBuilder): number => gateWouldApplyDynamicChunkRepairsIfRecipe(
  builder, staleChunk, (repair) => provenSourceRevertIndependentOfRepair(builder, repair),
);

describe('recipe repair gate surfaces a proven source revert', () => {
  const previous = getMaterializationMode();
  afterEach(() => {
    setMaterializationMode(previous);
    scenario.reads = [];
    scenario.failingOpcode = Op.OP_VERIFY;
  });

  it('reports the guard reason when the failing frame never reads the refused output', () => {
    setMaterializationMode('recipe');
    const builder = fixture();
    let thrown: unknown;
    try {
      gateDynamicChunk(builder);
    } catch (error) {
      thrown = error;
    }
    expect((thrown as Error).message).toContain('member required');
    expect(thrown).toMatchObject({ requireStatement: { ip: 0, message: 'member required' }, inputIndex: 0 });

    // The repair rewrites only the commitment, so a read of the same output's lock cannot change the frame.
    scenario.reads = [{ opcode: Op.OP_OUTPUTBYTECODE, coordinate: 0 }];
    expect(() => gateDynamicChunk(builder)).toThrow(/member required/);
  });

  it('keeps the refusal when the failure may depend on the refused repair', () => {
    setMaterializationMode('recipe');
    const builder = fixture();
    scenario.reads = [{ opcode: Op.OP_OUTPUTTOKENCOMMITMENT, coordinate: 0 }];
    expect(() => gateDynamicChunk(builder)).toThrow(/recipe mode forbids extracting/);

    scenario.reads = [{ opcode: Op.OP_OUTPUTBYTECODE, coordinate: 0 }];
    expect(() => gateWouldApplyValueChunkRepairsIfRecipe(
      builder, new Map([[0, Uint8Array.of(0x52)]]), new Map(),
      (repair) => provenSourceRevertIndependentOfRepair(builder, repair),
    )).toThrow(/recipe mode forbids extracting/);
  });

  it('keeps the refusal for a reasonless compiler guard at a folded verify', () => {
    setMaterializationMode('recipe');
    scenario.failingOpcode = Op.OP_EQUALVERIFY;
    const builder = fixture(null);
    expect(() => gateDynamicChunk(builder)).toThrow(/recipe mode forbids extracting/);
  });

  it('leaves devOracle repairs untouched', () => {
    setMaterializationMode('devOracle');
    const probe = vi.fn(() => new Error('unexpected'));
    expect(gateWouldApplyDynamicChunkRepairsIfRecipe(fixture(), staleChunk, probe)).toBe(1);
    expect(probe).not.toHaveBeenCalled();
  });
});
