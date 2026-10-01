import { binToHex, createVirtualMachineBch2026, decodeAuthenticationInstructions, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { encodeInt, type MessageBusVerifierProgram, Op, scriptToBytecode } from '@solidcash/utils';
import { deduplicateMessageBusVerifierStackSuffix } from '../src/messageBusVerifierDedup.js';

const suffix = scriptToBytecode(Array.from({ length: 12 }, () => [Op.OP_SWAP, Op.OP_TOALTSTACK]).flat());
const baseProgram = (body: Uint8Array): MessageBusVerifierProgram => ({
  verifyFunctionId: 0,
  inputCount: 3,
  inputs: [
    { name: 'activeInputIndex', type: 'bigint' },
    { name: 'expectedLocalRows', type: 'bigint' },
    { name: 'localBatch', type: 'bytes' },
  ],
  functions: [
    { id: 0, name: '__message_bus_verify_atomic', bytecode: binToHex(body) },
    { id: 17, name: 'existing helper', bytecode: '51' },
  ],
});

describe('detached message-bus verifier stack-suffix outlining', () => {
  it('leaves a verifier without repeated instruction-aligned suffixes unchanged', () => {
    const program = baseProgram(scriptToBytecode([suffix, Op.OP_DROP]));
    expect(deduplicateMessageBusVerifierStackSuffix(program)).toEqual(program);
  });

  it('outlines repeated suffix instructions with an unoccupied function id', () => {
    // An identical byte sequence inside a push is data, not a candidate instruction span.
    const oneSuffix = Array.from({ length: 12 }, () => [Op.OP_SWAP, Op.OP_TOALTSTACK]).flat();
    const body = scriptToBytecode([
      suffix, Op.OP_DROP,
      ...oneSuffix, Op.OP_NOP, ...oneSuffix, Op.OP_NOP,
      ...oneSuffix, Op.OP_NOP, ...oneSuffix,
    ]);
    const program = baseProgram(body);
    const optimized = deduplicateMessageBusVerifierStackSuffix(program);
    expect(optimized.functions).toHaveLength(3);
    const helper = optimized.functions[2];
    expect(helper.id).not.toBe(17);
    expect(hexToBin(helper.bytecode)).toEqual(suffix);
    expect(hexToBin(optimized.functions[0].bytecode).length).toBeLessThan(body.length);
    expect(decodeAuthenticationInstructions(hexToBin(optimized.functions[0].bytecode))
      .filter((instruction) => instruction.opcode === Op.OP_INVOKE)).toHaveLength(4);

    const outlinedLock = scriptToBytecode([
      ...optimized.functions.flatMap((fn) => [hexToBin(fn.bytecode), encodeInt(BigInt(fn.id)), Op.OP_DEFINE]),
      encodeInt(0n), Op.OP_INVOKE,
    ]);
    const unlockingBytecode = scriptToBytecode(Array.from({ length: 49 }, (_, i) => encodeInt(BigInt(i + 1))));
    const evaluate = (lockingBytecode: Uint8Array): ReturnType<
    ReturnType<typeof createVirtualMachineBch2026>['evaluate']
    > => {
      const vm = createVirtualMachineBch2026();
      const transaction = {
        version: 2,
        locktime: 0,
        inputs: [{
          outpointIndex: 0,
          outpointTransactionHash: new Uint8Array(32),
          sequenceNumber: 0xffffffff,
          unlockingBytecode,
        }],
        outputs: [{ lockingBytecode: Uint8Array.from([Op.OP_1]), valueSatoshis: 1000n }],
      };
      const sourceOutputs = [{ lockingBytecode, valueSatoshis: 1000n }];
      return vm.evaluate({ inputIndex: 0, transaction, sourceOutputs } as any);
    };
    const originalState = evaluate(body);
    const outlinedState = evaluate(outlinedLock);
    expect(originalState.error).toBeUndefined();
    expect(outlinedState.error).toBeUndefined();
    expect(outlinedState.stack).toEqual(originalState.stack);
    expect(outlinedState.alternateStack).toEqual(originalState.alternateStack);
  });
});
