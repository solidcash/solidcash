/**
 * Pure, fail-closed replay of compiler-published compute operands. These values are planner candidates:
 * the participant and producer covenants still bind every return, side-car argument and result in the VM.
 */
import { hexToBin, utf8ToBin } from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import type { Artifact, ExternalCallExpression } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import { encodeEvmInvocationResult } from '../stateful/evm-abi-result.js';

export class PendingComputeProducerResult extends Error {
  constructor(readonly callsiteId: number) {
    super(`messageBus: compute recipe awaits an exact producer candidate at callsite ${callsiteId}`);
  }
}

export interface ComputeRecipeContext {
  readonly artifact: Artifact;
  readonly args: readonly FunctionArgument[];
  readonly inputTypes: readonly string[];
  /** Exact caller-prepared or deterministic state-derived candidate; never a schema-shaped placeholder. */
  readonly producerResult: (expression: ExternalCallExpression) => FunctionArgument | undefined;
}

const bytesOf = (value: FunctionArgument, type: string): Uint8Array => {
  if (value instanceof Uint8Array) return Uint8Array.from(value);
  if (typeof value === 'string') {
    if (type === 'string') return utf8ToBin(value);
    if (/^0x(?:[0-9a-f]{2})*$/i.test(value)) return hexToBin(value.slice(2));
    if (/^bytes(?:[1-9]|[12][0-9]|3[0-2])?$/.test(type)
      && /^(?:[0-9a-f]{2})*$/i.test(value)) {
      const bytes = hexToBin(value);
      const width = /^bytes(\d+)$/.exec(type)?.[1];
      if (width !== undefined && bytes.length !== Number(width)) {
        throw new Error(`messageBus: compute recipe ${type} literal has ${bytes.length} bytes`);
      }
      return bytes;
    }
  }
  throw new Error(`messageBus: compute recipe requires canonical ${type} bytes`);
};

const numericOf = (value: FunctionArgument, type: string): bigint => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^(?:-?\d+|0x[0-9a-f]+)$/i.test(value)) return BigInt(value);
  throw new Error(`messageBus: compute recipe requires canonical ${type} integer`);
};

const expressionType = (expression: ExternalCallExpression, ctx: ComputeRecipeContext): string => {
  if (expression.type) return expression.type;
  if (expression.kind === 'source' && expression.source?.kind === 'forward'
    && expression.source.paramIndex !== undefined) {
    return ctx.inputTypes[expression.source.paramIndex] ?? '';
  }
  if (expression.kind === 'producerResult') return expression.type ?? '';
  if (expression.kind === 'literal' && typeof expression.value === 'string') return 'string';
  if (expression.kind === 'call' && expression.name === 'keccak256') return 'bytes32';
  if (expression.kind === 'abiEncode' || expression.kind === 'bytesConcat'
    || expression.kind === 'abiEncodePacked') return 'bytes';
  return '';
};

export function evaluateComputeRecipeExpression(
  expression: ExternalCallExpression,
  ctx: ComputeRecipeContext,
): FunctionArgument {
  const evaluate = (value: ExternalCallExpression): FunctionArgument => (
    evaluateComputeRecipeExpression(value, ctx)
  );
  if (expression.kind === 'source' && expression.source?.kind === 'forward') {
    const index = expression.source.paramIndex;
    if (!Number.isSafeInteger(index) || index! < 0 || index! >= ctx.args.length) {
      throw new Error('messageBus: compute recipe names an invalid handler argument');
    }
    return ctx.args[index!];
  }
  if (expression.kind === 'producerResult') {
    const id = expression.callsiteId;
    if (!Number.isSafeInteger(id) || id! < 0 || !Number.isSafeInteger(expression.resultIndex)
      || expression.resultIndex! < 0) {
      throw new Error('messageBus: compute recipe names an invalid producer result');
    }
    const result = ctx.producerResult(expression);
    if (result === undefined) throw new PendingComputeProducerResult(id!);
    return result;
  }
  if (expression.kind === 'literal') {
    if (typeof expression.value === 'string') return expression.value;
    if (typeof expression.value === 'boolean') return expression.value;
    throw new Error('messageBus: compute recipe has an unsupported literal');
  }
  if (expression.kind === 'abiEncode') {
    if (ctx.artifact.compiler?.options?.solidityImportCompat !== true) {
      throw new Error('messageBus: compute recipe abi.encode needs Solidity ABI');
    }
    const children = expression.args ?? [];
    const types = children.map((child) => expressionType(child, ctx));
    if (types.some((type) => type === '')) {
      throw new Error('messageBus: compute recipe abi.encode has an untyped operand');
    }
    const values = children.map((child, index) => {
      const value = evaluate(child);
      return /^(?:u?int(?:\d+)?|bigint)$/.test(types[index])
        ? numericOf(value, types[index]) : value;
    });
    return encodeEvmInvocationResult(values as Parameters<typeof encodeEvmInvocationResult>[0],
      types, ctx.artifact.structs ?? ctx.artifact.stateLayout?.structs, ctx.artifact.enums);
  }
  if (expression.kind === 'bytesConcat') {
    const children = expression.args ?? [];
    if (children.length === 0) throw new Error('messageBus: compute recipe bytes.concat has no operands');
    const values = children.map((child) => bytesOf(evaluate(child), expressionType(child, ctx)));
    return Uint8Array.from(values.flatMap((value) => [...value]));
  }
  if (expression.kind === 'call' && expression.name === 'keccak256') {
    if (expression.args?.length !== 1) {
      throw new Error('messageBus: compute recipe keccak256 must have one operand');
    }
    return keccak_256(bytesOf(evaluate(expression.args[0]), expressionType(expression.args[0], ctx)));
  }
  throw new Error(`messageBus: unsupported compute recipe expression ${expression.kind}`);
}

/** ECDSA signature65 calldata uses [rBE32 | sBE32 | v1]; the recovery side-car binds LE scalars. */
export function evaluateSignature65RecoveryArgument(
  hash: ExternalCallExpression,
  signature: ExternalCallExpression,
  ctx: ComputeRecipeContext,
): Uint8Array {
  const digest = bytesOf(evaluateComputeRecipeExpression(hash, ctx), expressionType(hash, ctx));
  const sig = bytesOf(evaluateComputeRecipeExpression(signature, ctx), expressionType(signature, ctx));
  if (digest.length !== 32 || sig.length !== 65 || (sig[64] !== 27 && sig[64] !== 28)) {
    throw new Error('messageBus: compute recipe requires a canonical 32-byte digest and 65-byte signature');
  }
  return Uint8Array.from([
    ...digest.slice().reverse(), sig[64],
    ...sig.slice(0, 32).reverse(), ...sig.slice(32, 64).reverse(),
  ]);
}

/** Exact four-argument recovery call; Solidity's builtin reverses bytes32 scalars at its boundary. */
export function evaluateArgs4RecoveryArgument(
  args: readonly [ExternalCallExpression, ExternalCallExpression,
    ExternalCallExpression, ExternalCallExpression],
  ctx: ComputeRecipeContext,
): Uint8Array {
  const [hash, v, r, s] = args.map((value) => evaluateComputeRecipeExpression(value, ctx));
  const hashBytes = bytesOf(hash, expressionType(args[0], ctx));
  const rBytes = bytesOf(r, expressionType(args[2], ctx));
  const sBytes = bytesOf(s, expressionType(args[3], ctx));
  const recoveryId = numericOf(v, expressionType(args[1], ctx));
  if (hashBytes.length !== 32 || rBytes.length !== 32 || sBytes.length !== 32
    || (recoveryId !== 27n && recoveryId !== 28n)) {
    throw new Error('messageBus: compute recipe recovery arguments are non-canonical');
  }
  const solidity = ctx.artifact.compiler?.options?.solidityImportCompat === true;
  return Uint8Array.from([
    ...(solidity ? hashBytes.reverse() : hashBytes), Number(recoveryId),
    ...(solidity ? rBytes.reverse() : rBytes), ...(solidity ? sBytes.reverse() : sBytes),
  ]);
}
