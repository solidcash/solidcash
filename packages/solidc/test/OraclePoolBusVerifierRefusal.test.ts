/**
 * MESSAGE_BUS_ORACLE_POOL_INDIRECT_READ. A detached message-bus verifier carries the bodies its closure invokes by
 * literal id, read from literal OP_DEFINEs. The pool binding helper of a contract with function-pointer pool readers
 * is defined at run time from `__oraclePool`, so a verifier body that invokes it, or makes an indirect call while the
 * contract defines it, is refused by name. A default build then falls back to the direct artifact.
 */
import { describe, expect, it } from 'vitest';
import { Op, encodeInt, scriptToBytecode, type Script } from '@solidcash/utils';
import { SolidcDiagnosticError } from '../src/index.js';
import { extractMessageBusVerifierProgram } from '../src/compiler.js';

const VERIFY_ID = 3;
/** GenerateTargetTraversal's ORACLE_POOL_BINDING_SUBROUTINE_ID. */
const BINDING_ID = -127n;

type Extract = typeof extractMessageBusVerifierProgram;

/** The extraction over a participant whose verifier body is `body`, defining the binding helper when `bound`. */
function extract(body: Script, bound: boolean): ReturnType<Extract> {
  const ast = {
    contract: {
      name: 'Reader',
      functions: [{ name: '__message_bus_verify_atomic', functionId: VERIFY_ID, parameters: [] }],
    },
  };
  const traversal = {
    detachedVerifierBytecodes: new Map([[VERIFY_ID, scriptToBytecode(body)]]),
    invokedFunctionBytecodes: new Map<number, Uint8Array>(),
    outlinedSubroutineBytecodes: new Map<number, Uint8Array>(),
    entryPointBytecodes: new Map<string, Uint8Array>(),
    allocatedHelperIds: new Set<bigint>(),
    oraclePoolBindingId: bound ? BINDING_ID : undefined,
  };
  return extractMessageBusVerifierProgram(
    ast as unknown as Parameters<Extract>[0], traversal as unknown as Parameters<Extract>[1], [],
  );
}

function refusal(body: Script): unknown {
  try {
    extract(body, true);
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('a message-bus verifier that reaches a function-pointer pool reader', () => {
  it('is refused by name when it invokes the pool binding helper', () => {
    const error = refusal([encodeInt(BINDING_ID), Op.OP_INVOKE]);
    expect(error).toBeInstanceOf(SolidcDiagnosticError);
    expect(error).toMatchObject({
      code: 'MESSAGE_BUS_ORACLE_POOL_INDIRECT_READ', context: { functionName: '__message_bus_verify_atomic' },
    });
    expect((error as Error).message).toContain('Call the reader directly');
  });

  it('is refused by name when it makes an indirect call while the contract defines the helper', () => {
    expect(refusal([Op.OP_DUP, Op.OP_INVOKE])).toMatchObject({ code: 'MESSAGE_BUS_ORACLE_POOL_INDIRECT_READ' });
  });

  it('extracts the same verifier when the contract defines no binding helper', () => {
    const program = extract([Op.OP_DUP, Op.OP_INVOKE], false);
    expect(program?.verifyFunctionId).toBe(VERIFY_ID);
    expect(program?.functions.map((fn) => fn.id)).toEqual([VERIFY_ID]);
  });

  it('extracts a verifier whose invokes are literal ids other than the helper', () => {
    const program = extract([encodeInt(7n), Op.OP_INVOKE], true);
    expect(program?.functions.map((fn) => fn.id)).toEqual([VERIFY_ID]);
  });
});
