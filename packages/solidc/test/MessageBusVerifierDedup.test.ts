import { binToHex, createVirtualMachineBch2026, decodeAuthenticationInstructions, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { encodeInt, type MessageBusVerifierProgram, Op, scriptToBytecode } from '@solidcash/utils';
import {
  deduplicateMessageBusVerifierStackSuffix, outlineMessageBusVerifierArms,
} from '../src/messageBusVerifierDedup.js';

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

describe('detached message-bus verifier arm outlining', () => {
  // Evaluate `<flag> <program>` where the program defines its functions and invokes the verify body.
  const evaluate = (program: MessageBusVerifierProgram, flag: bigint): ReturnType<
  ReturnType<typeof createVirtualMachineBch2026>['evaluate']
  > => {
    const lockingBytecode = scriptToBytecode([
      ...program.functions.flatMap((fn) => [hexToBin(fn.bytecode), encodeInt(BigInt(fn.id)), Op.OP_DEFINE]),
      encodeInt(BigInt(program.verifyFunctionId)), Op.OP_INVOKE,
    ]);
    const transaction = {
      version: 2,
      locktime: 0,
      inputs: [{
        outpointIndex: 0,
        outpointTransactionHash: new Uint8Array(32),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: scriptToBytecode([encodeInt(3n), encodeInt(flag)]),
      }],
      outputs: [{ lockingBytecode: Uint8Array.from([Op.OP_1]), valueSatoshis: 1000n }],
    };
    return createVirtualMachineBch2026().evaluate({
      inputIndex: 0, transaction, sourceOutputs: [{ lockingBytecode, valueSatoshis: 1000n }],
    } as any);
  };
  // [value, flag]: IF adds 41 (the long arm, holding a short nested arm), ELSE subtracts 1 (a short arm); a loop
  // then adds 2 three times through a five-instruction arm.
  const longArm = Array.from({ length: 40 }, () => Op.OP_1ADD);
  const body = scriptToBytecode([
    Op.OP_IF, ...longArm, Op.OP_1, Op.OP_IF, Op.OP_1ADD, Op.OP_ENDIF,
    Op.OP_ELSE, Op.OP_1SUB, Op.OP_ENDIF,
    encodeInt(0n), Op.OP_BEGIN, Op.OP_1, Op.OP_IF, Op.OP_SWAP, Op.OP_1ADD, Op.OP_1ADD, Op.OP_SWAP, Op.OP_1ADD,
    Op.OP_ENDIF, Op.OP_DUP, encodeInt(3n), Op.OP_NUMEQUAL, Op.OP_UNTIL, Op.OP_DROP,
  ]);

  it('outlines long and in-loop arms, keeps short ones, and preserves the stack transform', () => {
    const program = baseProgram(body);
    const outlined = outlineMessageBusVerifierArms(program);
    const arms = outlined.functions.filter((fn) => fn.name.startsWith('__outlined_arm_'));
    // The long IF arm and the five-instruction loop arm; the short nested and ELSE arms stay inline.
    expect(arms).toHaveLength(2);
    expect(new Set(outlined.functions.map((fn) => fn.id)).size).toBe(outlined.functions.length);
    expect(arms.map((fn) => fn.id)).not.toContain(17);
    for (const flag of [0n, 1n]) {
      const original = evaluate(program, flag);
      const result = evaluate(outlined, flag);
      expect(original.error).toBeUndefined();
      expect(original.stack).toEqual([encodeInt(flag === 1n ? 50n : 8n)]);
      expect(result.error).toBeUndefined();
      expect(result.stack).toEqual(original.stack);
    }
    // Not taken, the long arm costs a push and an invoke instead of its body.
    expect(evaluate(outlined, 0n).metrics.operationCost).toBeLessThan(evaluate(program, 0n).metrics.operationCost);
  });

  it('leaves frame-bound and unbalanced bodies unchanged', () => {
    const frameBound = baseProgram(scriptToBytecode([Op.OP_IF, ...longArm, Op.OP_ACTIVEBYTECODE, Op.OP_ENDIF]));
    expect(outlineMessageBusVerifierArms(frameBound)).toEqual(frameBound);
    const unbalanced = baseProgram(scriptToBytecode([Op.OP_IF, ...longArm]));
    expect(outlineMessageBusVerifierArms(unbalanced)).toEqual(unbalanced);
  });
});
