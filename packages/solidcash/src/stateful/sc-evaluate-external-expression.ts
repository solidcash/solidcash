/**
 * phase-boundary extract: SC class-body extract — evaluate compiler-described external-call expressions.
 */

import { hexToBin, utf8ToBin } from '@bitauth/libauth';
import {
  decodePushdataValue,
  hash160 as hash160Sync,
  type ArgSource,
  type Artifact,
  type ExternalCallExpression,
  type ExternalCallStatement,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import { addressToLockScript } from '../utils.js';
import { decodeAuthenticatedProducerResultVector } from './external-return-encoding.js';
import { p2pkhLockingBytecode } from './legacy-job-event-wire.js';
import { artifactUsesSolidityAbi } from './solidityAbi.js';

export interface EvaluateExternalExpressionHost {
  resolveExternalArgs(
    argSources: readonly ArgSource[] | undefined,
    functionArgs: FunctionArgument[],
    artifact: Artifact,
    state?: Record<string, unknown>,
    callerInputs?: readonly { type: string }[],
    externalReturns?: ReadonlyMap<string, FunctionArgument>,
    occurrenceIndex?: number,
    stateIncludesPriorWrites?: boolean,
    executionSelfAddress?: FunctionArgument,
  ): FunctionArgument[] | undefined;
}

export function evaluateExternalExpression(
host: EvaluateExternalExpressionHost,
expression: ExternalCallExpression,
functionArgs: FunctionArgument[],
artifact: Artifact,
state?: Record<string, unknown>,
callerInputs?: readonly { type: string }[],
externalReturns?: ReadonlyMap<string, FunctionArgument>,
occurrenceIndex = 0,
stateIncludesPriorWrites = false,
executionSelfAddress?: FunctionArgument,
localBindings?: ReadonlyMap<string, FunctionArgument>,
stateLengthDeltas?: Readonly<Record<string, bigint>>,
strictFieldAccess = false,
): FunctionArgument | undefined {
  const evaluate = (candidate: ExternalCallExpression): FunctionArgument | undefined => (
    evaluateExternalExpression(host,
      candidate, functionArgs, artifact, state, callerInputs, externalReturns, occurrenceIndex,
      stateIncludesPriorWrites, executionSelfAddress, localBindings, stateLengthDeltas, strictFieldAccess,
    )
  );
  const concat = (parts: Uint8Array[]): Uint8Array => {
    const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let offset = 0;
    for (const part of parts) {
      result.set(part, offset);
      offset += part.length;
    }
    return result;
  };
  const numberLe = (value: bigint, width: number): Uint8Array => {
    const result = new Uint8Array(width);
    const bits = BigInt(width * 8);
    let normalized = ((value % (1n << bits)) + (1n << bits)) % (1n << bits);
    for (let i = 0; i < width; i++) {
      result[i] = Number(normalized & 0xffn);
      normalized >>= 8n;
    }
    return result;
  };
  const numberBe = (value: bigint, width: number): Uint8Array => {
    const result = new Uint8Array(width);
    const bits = BigInt(width * 8);
    let normalized = ((value % (1n << bits)) + (1n << bits)) % (1n << bits);
    for (let i = width - 1; i >= 0; i--) {
      result[i] = Number(normalized & 0xffn);
      normalized >>= 8n;
    }
    return result;
  };
  const inferredType = (candidate: ExternalCallExpression): string => {
    if (candidate.type) return candidate.type;
    if (candidate.kind === 'call' && candidate.name
      && (artifact.structs ?? artifact.stateLayout?.structs)
        ?.some((struct) => struct.name === candidate.name)) return candidate.name;
    if (candidate.kind === 'source' && candidate.source) {
      const { source } = candidate;
      if (source.kind === 'literal') return source.type ?? '';
      if (source.kind === 'forward') {
        return source.paramIndex === undefined ? '' : callerInputs?.[source.paramIndex]?.type ?? '';
      }
      if (source.kind === 'arrayElement' && source.paramIndex !== undefined) {
        const arrayType = callerInputs?.[source.paramIndex]?.type ?? '';
        return arrayType.match(/^(.*)\[(?:\d*)\]$/)?.[1] ?? '';
      }
    }
    return '';
  };
  const solidityImportCompat = artifactUsesSolidityAbi(artifact);
  // The type the artifact's own declarations give a read: a struct field through its struct, a state variable
  // through the state layout, an element through its array's type.
  const declaredType = (candidate: ExternalCallExpression): string => {
    const published = inferredType(candidate);
    if (published) return published;
    if (candidate.kind === 'field' && candidate.expression && candidate.name) {
      const struct = declaredType(candidate.expression);
      return (artifact.structs ?? artifact.stateLayout?.structs)?.find((entry) => entry.name === struct)
        ?.fields.find((field) => field.name === candidate.name)?.type ?? '';
    }
    if (candidate.kind === 'state' && candidate.name) {
      return artifact.stateLayout?.variables.find((variable) => variable.name === candidate.name)?.type ?? '';
    }
    if (candidate.kind === 'arrayAccess' && candidate.left) {
      return declaredType(candidate.left).match(/^(.*)\[\d*\]$/)?.[1] ?? '';
    }
    return '';
  };
  // The compiler publishes a struct field read inside `abi.encodePacked` with no type (it serializes before type
  // checking), and an imported-Solidity body packs an `address` as its 20-byte identity, so such a field is packed
  // by its declared type rather than as the locking bytecode it stores.
  const packedFieldType = (candidate: ExternalCallExpression | undefined): string => {
    if (!solidityImportCompat || candidate?.kind !== 'field') return '';
    const type = declaredType(candidate);
    return type === 'address' || type === 'address payable' ? type : '';
  };
  const isStandardLockingBytecode = (locking: Uint8Array): boolean => (
    locking.length === 0
    || (locking.length === 35 && locking[0] === 0xaa && locking[1] === 0x20 && locking[34] === 0x87)
    || (locking.length === 23 && locking[0] === 0xa9 && locking[1] === 0x14 && locking[22] === 0x87)
    || (locking.length === 25 && locking[0] === 0x76 && locking[1] === 0xa9
      && locking[2] === 0x14 && locking[23] === 0x88 && locking[24] === 0xac)
  );
  const narrowAddress = (locking: Uint8Array): Uint8Array => {
    if (locking.length === 0) return new Uint8Array(20);
    if (locking.length === 20) return locking;
    if (locking.length === 23) return locking.slice(2, 22);
    if (locking.length === 35) return hash160Sync(locking);
    return locking.slice(3, 23);
  };
  const readsAuthenticatedState = (
    candidate: ExternalCallExpression | undefined,
    seen = new Set<object>(),
  ): boolean => {
    if (!candidate || typeof candidate !== 'object' || seen.has(candidate)) return false;
    seen.add(candidate);
    if (candidate.kind === 'state' || candidate.kind === 'stateAccess') return true;
    return Object.values(candidate).some((child) => (
      Array.isArray(child)
        ? child.some((item) => readsAuthenticatedState(item as ExternalCallExpression, seen))
        : readsAuthenticatedState(child as ExternalCallExpression, seen)
    ));
  };
  const asBytes = (
    value: FunctionArgument,
    typeHint = '',
    sourceExpression?: ExternalCallExpression,
  ): Uint8Array | undefined => {
    if (typeHint === 'bool' || typeof value === 'boolean') {
      return new Uint8Array([value ? 1 : 0]);
    }
    if (typeof value === 'bigint' || typeof value === 'number') {
      const widthMatch = typeHint.match(/^u?int(\d+)$/);
      // Solidity abi.encodePacked uses the declared natural width, big-endian (and two's-complement for signed
      // values). Native SolidCash keeps its BCH VM-number contract below: little-endian sign-magnitude with one
      // spare sign bit. Mixing the two encoded uint16(2) as 02 00 00 where Solidity bytecode emits 00 02.
      if (solidityImportCompat && widthMatch) {
        return numberBe(BigInt(value), Math.ceil(Number(widthMatch[1]) / 8));
      }
      // Some imported-Solidity expression metadata cannot preserve the source field's numeric type. Solidity's
      // only safe fallback for an untyped packed number is its 256-bit big-endian ABI word. Explicitly typed
      // numeric fields retain the compiler's BCH-native width/endianness contract below.
      if (solidityImportCompat && stateIncludesPriorWrites && !widthMatch
        && readsAuthenticatedState(sourceExpression)) {
        return numberBe(BigInt(value), 32);
      }
      // Native SolidCash packed integers use OP_NUM2BIN sign-magnitude width: one sign bit beyond the
      // declared Solidity width, in BCH little-endian order (IntType.byteWidth).
      return numberLe(BigInt(value), widthMatch ? Math.ceil((Number(widthMatch[1]) + 1) / 8) : 32);
    }
    // An ethers `bytesN` argument arrives as a `0x`-prefixed hex STRING. UTF-8-encoding it packed the 66
    // characters of "0xa0b1.." where the covenant expects raw bytes, which also desynchronises the
    // enclosing length prefix. Dynamic `bytes` has no 32-byte ceiling (signatures are commonly 65 bytes),
    // so decode every canonical even-width hex value when the expression type is bytes/bytesN. Anything
    // else (including a user string that merely starts with malformed hex) keeps the text encoding.
    if (typeof value === 'string') {
      const canonicalHex = /^0x(?:[0-9a-fA-F]{2})*$/.test(value);
      if (typeHint === 'uint160' && isZeroAddressValue(value)) return new Uint8Array();
      if (canonicalHex && typeHint === 'uint160' && value.length === 42) {
        return concat([hexToBin(value.slice(2)), new Uint8Array([0])]);
      }
      if (typeHint === 'uint160') {
        const locking = addressToLockScript(value);
        // Packed uint160(address) on BCH is the locking bytecode (p2sh32 cannot be rebuilt from 20 bytes).
        if (isStandardLockingBytecode(locking)) return locking;
        const narrowed = locking.length === 20 ? locking
          : locking.length === 23 ? locking.slice(2, 22) : locking.slice(3, 23);
        return concat([narrowed, new Uint8Array([0])]);
      }
      // Packed `address` on BCH is locking bytecode (p2sh20=23, p2pkh=25, p2sh32=35), never a
      // 20-byte account id. Solidity compatibility is the exception: the compiler applies its documented
      // lossy address -> bytes20 conversion before EVM packed encoding. Match that conversion here while
      // retaining full BCH locking bytecode for native SolidCash artifacts.
      if (typeHint === 'address' || typeHint === 'address payable') {
        let locking: Uint8Array | undefined;
        if (canonicalHex && (value.length === 42 || value.length === 48
          || value.length === 52 || value.length === 72)) {
          locking = hexToBin(value.slice(2));
        } else if (value.includes(':')) {
          locking = addressToLockScript(value);
        }
        if (locking) {
          if (solidityImportCompat) return narrowAddress(locking);
          return locking.length === 20 ? p2pkhLockingBytecode(locking) : locking;
        }
        return utf8ToBin(value);
      }
      const isBytesHint = typeHint.startsWith('bytes');
      if (canonicalHex && (isBytesHint || value.length === 66)) {
        return hexToBin(value.slice(2));
      }
      return utf8ToBin(value);
    }
    if (value instanceof Uint8Array) {
      if (typeHint === 'uint160' && isZeroAddressValue(value)) return new Uint8Array();
      if (typeHint === 'uint160') {
        if (isStandardLockingBytecode(value)) return value;
        const narrowed = value.length === 0 ? new Uint8Array(20)
          : value.length === 20 ? value
            : value.length === 23 ? value.slice(2, 22) : value.slice(3, 23);
        return concat([narrowed, new Uint8Array([0])]);
      }
      if (typeHint === 'address' || typeHint === 'address payable') {
        if (solidityImportCompat) return narrowAddress(value);
        if (isStandardLockingBytecode(value)) return value;
        if (value.length === 20) return p2pkhLockingBytecode(value);
        return value;
      }
      return value;
    }
    return undefined;
  };
  const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean => (
    left.length === right.length && left.every((byte, index) => byte === right[index])
  );
  const isZeroAddressValue = (value: FunctionArgument): boolean => {
    if (typeof value === 'bigint' || typeof value === 'number') return BigInt(value) === 0n;
    if (value instanceof Uint8Array) return value.length === 0 || value.every((byte) => byte === 0);
    return typeof value === 'string' && /^0x0{40}$/i.test(value);
  };
  const valuesEqual = (
    left: FunctionArgument,
    right: FunctionArgument,
    leftExpression: ExternalCallExpression,
    rightExpression: ExternalCallExpression,
  ): boolean => {
    const leftType = inferredType(leftExpression);
    const rightType = inferredType(rightExpression);
    if (leftType.startsWith('address') || rightType.startsWith('address')) {
      if (isZeroAddressValue(left) && isZeroAddressValue(right)) return true;
      const leftBytes = asBytes(left, 'address');
      const rightBytes = asBytes(right, 'address');
      return leftBytes !== undefined && rightBytes !== undefined && bytesEqual(leftBytes, rightBytes);
    }
    if ((typeof left === 'bigint' || typeof left === 'number')
      && (typeof right === 'bigint' || typeof right === 'number')) {
      return BigInt(left) === BigInt(right);
    }
    if (left instanceof Uint8Array && right instanceof Uint8Array) return bytesEqual(left, right);
    return left === right;
  };

  if (expression.kind === 'identifier' && expression.name) {
    return localBindings?.get(expression.name);
  }
  if (expression.kind === 'source' && expression.source) {
    return host.resolveExternalArgs(
      [expression.source], functionArgs, artifact, state, callerInputs, externalReturns,
      occurrenceIndex, stateIncludesPriorWrites, executionSelfAddress,
    )?.[0];
  }
  if (expression.kind === 'literal') {
    if (typeof expression.value === 'string'
      && (expression.type === 'bigint'
        || /^(?:u?int(?:\d+)?|u?fixed(?:\d+x\d+)?)$/u.test(expression.type ?? ''))) {
      try { return BigInt(expression.value); } catch { return undefined; }
    }
    if (expression.type === 'bool' && typeof expression.value === 'boolean') return expression.value;
    if (expression.type === 'string' && typeof expression.value === 'string') return expression.value;
    if (typeof expression.value === 'string' && expression.type?.startsWith('bytes')) {
      return hexToBin(expression.value);
    }
    return undefined;
  }
  if (expression.kind === 'state' && expression.name) {
    return state?.[expression.name] as FunctionArgument | undefined;
  }
  if (expression.kind === 'stateAccess' && expression.name) {
    let value = state?.[expression.name] as unknown;
    for (const keyExpression of expression.args ?? []) {
      const key = evaluate(keyExpression);
      if (key === undefined) return undefined;
      if (Array.isArray(value)) value = value[Number(key)];
      else if (value && typeof value === 'object') value = (value as Record<string, unknown>)[String(key)];
      else return undefined;
    }
    return value as FunctionArgument | undefined;
  }
  if (expression.kind === 'field' && expression.expression && expression.name) {
    let base = evaluate(expression.expression);
    if (base instanceof Uint8Array) {
      const structType = inferredType(expression.expression);
      const structs = artifact.structs ?? artifact.stateLayout?.structs;
      if (structs?.some((candidate) => candidate.name === structType)) {
        try {
          const decoded = decodePushdataValue(base, 0, structType, structs);
          if (decoded.bytesConsumed === base.length) base = decoded.value as FunctionArgument;
        } catch {
          return undefined;
        }
      }
    }
    if (base && typeof base === 'object' && !Array.isArray(base) && !(base instanceof Uint8Array)) {
      const value = (base as unknown as Record<string, FunctionArgument>)[expression.name];
      if (value !== undefined) return value;
    }
    // Solidity structs are carried by the SDK as positional argument arrays. Preserve their declared type
    // through nested `source(forward)` expressions so a transitive edge can resolve `input.currency` or
    // `input.amount` without requiring the caller to convert the struct into a non-ABI object first.
    if (Array.isArray(base)) {
      const structType = inferredType(expression.expression);
      const fields = (artifact.structs ?? artifact.stateLayout?.structs)
        ?.find((candidate) => candidate.name === structType)?.fields;
      const fieldIndex = fields?.findIndex((field) => field.name === expression.name) ?? -1;
      if (fieldIndex >= 0 && fieldIndex < base.length) {
        return base[fieldIndex] as FunctionArgument;
      }
    }
    if (strictFieldAccess) return undefined;
    if (expression.type === 'bool') return false;
    if (expression.type?.startsWith('uint') || expression.type?.startsWith('int')) return 0n;
    return undefined;
  }
  if (expression.kind === 'unary' && expression.expression) {
    const value = evaluate(expression.expression);
    if (value === undefined) return undefined;
    if (expression.operator === '.length') {
      if (typeof value === 'string' || Array.isArray(value) || value instanceof Uint8Array) {
        // Same-function dynamic writes (jobs.push then w[jobs.length-1]) must see the post-write
        // length. fixedKeySources already apply stateLengthDeltas via evalComputedKey; varyingKeyExpressions
        // must match or publishJobPost whitelist keys resolve to -1 against empty pre-state.
        const stateName = expression.expression.kind === 'state' ? expression.expression.name : undefined;
        const writeDelta = stateName ? stateLengthDeltas?.[stateName] ?? 0n : 0n;
        const legacyDelta = !stateIncludesPriorWrites && typeof expression.value === 'string'
          ? BigInt(expression.value) : 0n;
        return BigInt(value.length) + writeDelta + legacyDelta;
      }
    }
    if (expression.operator === '!') return !value;
    if (expression.operator === '-' && (typeof value === 'bigint' || typeof value === 'number')) {
      return -BigInt(value);
    }
    return undefined;
  }
  if (expression.kind === 'addressCodeLength' && expression.expression) {
    const value = evaluate(expression.expression);
    const bytes = value instanceof Uint8Array ? value
      : typeof value === 'string' && /^(?:0x)?[0-9a-f]+$/iu.test(value)
        ? hexToBin(value.replace(/^0x/iu, '')) : undefined;
    if (!bytes) return undefined;
    // Match graph codegen's authenticated contract-address predicate: P2SH20/P2SH32 are code-bearing,
    // while P2PKH and the zero address are not. Only zero/nonzero is observable from this recipe.
    return bytes.length === 23 || bytes.length === 35 ? 1n : 0n;
  }
  if (expression.kind === 'abiDecode' && expression.expression && expression.fields?.length) {
    const value = evaluate(expression.expression);
    if (!(value instanceof Uint8Array)) return undefined;
    const decoded = decodeAuthenticatedProducerResultVector(
      value,
      expression.fields,
      artifact.structs ?? artifact.stateLayout?.structs,
      artifactUsesSolidityAbi(artifact),
      artifact.enums,
    );
    if (!decoded) return undefined;
    return decoded.length === 1 ? decoded[0] : decoded as unknown as FunctionArgument;
  }
  if (expression.kind === 'binary' && expression.left && expression.right) {
    const left = evaluate(expression.left);
    if (left === undefined) return undefined;
    if (expression.operator === '&&') {
      if (!Boolean(left)) return false;
      const right = evaluate(expression.right);
      return right === undefined ? undefined : Boolean(right);
    }
    if (expression.operator === '||') {
      if (Boolean(left)) return true;
      const right = evaluate(expression.right);
      return right === undefined ? undefined : Boolean(right);
    }
    const right = evaluate(expression.right);
    if (right === undefined) return undefined;
    if (expression.operator === '==') return valuesEqual(left, right, expression.left, expression.right);
    if (expression.operator === '!=') return !valuesEqual(left, right, expression.left, expression.right);
    if ((typeof left === 'bigint' || typeof left === 'number')
      && (typeof right === 'bigint' || typeof right === 'number')) {
      const a = BigInt(left);
      const b = BigInt(right);
      if (expression.operator === '+') return a + b;
      if (expression.operator === '-') return a - b;
      if (expression.operator === '*') return a * b;
      if (expression.operator === '/') return a / b;
      if (expression.operator === '%') return a % b;
      if (expression.operator === '&') return a & b;
      if (expression.operator === '|') return a | b;
      if (expression.operator === '^') return a ^ b;
      if (expression.operator === '<') return a < b;
      if (expression.operator === '<=') return a <= b;
      if (expression.operator === '>') return a > b;
      if (expression.operator === '>=') return a >= b;
    }
    return undefined;
  }
  if (expression.kind === 'ternary' && expression.condition && expression.ifTrue && expression.ifFalse) {
    return evaluate(expression.condition) ? evaluate(expression.ifTrue) : evaluate(expression.ifFalse);
  }
  if (expression.kind === 'cast' && expression.expression) {
    const value = evaluate(expression.expression);
    if (value === undefined) return undefined;
    if (expression.type === 'bytes' && typeof value === 'string') return utf8ToBin(value);
    if (expression.type?.startsWith('uint') || expression.type?.startsWith('int')) {
      if (typeof value === 'bigint' || typeof value === 'number') return BigInt(value);
      if (value instanceof Uint8Array) {
        let bytes = value;
        if (expression.type === 'uint160') {
          if (value.length === 0) bytes = new Uint8Array(20);
          else if (value.length === 20) bytes = value;
          else if (value.length === 23) bytes = value.slice(2, 22);
          else bytes = value.slice(3, 23);
        }
        let result = 0n;
        for (let i = bytes.length - 1; i >= 0; i--) {
          result = (result << 8n) | BigInt(bytes[i]);
        }
        return result;
      }
    }
    return value;
  }
  if (expression.kind === 'array') {
    const values = (expression.args ?? []).map(evaluate);
    return values.every((value) => value !== undefined)
      ? values as unknown as FunctionArgument
      : undefined;
  }
  if (expression.kind === 'newArray' && expression.args?.[0]) {
    const size = evaluate(expression.args[0]);
    if (typeof size !== 'bigint' && typeof size !== 'number') return undefined;
    const length = Number(size);
    if (!Number.isSafeInteger(length) || length < 0 || length > 10_000) return undefined;
    const empty: FunctionArgument = expression.type === 'bool' ? false
      : expression.type?.startsWith('uint') || expression.type?.startsWith('int') ? 0n
        : expression.type === 'string' ? '' : new Uint8Array();
    return Array.from({ length }, () => empty) as FunctionArgument;
  }
  if (expression.kind === 'externalCall') {
    return externalReturns?.get(JSON.stringify(expression));
  }
  if (expression.kind === 'producerResult') {
    return externalReturns?.get(JSON.stringify(expression));
  }
  if (expression.kind === 'arrayAccess' && expression.left && expression.right) {
    const array = evaluate(expression.left);
    const index = evaluate(expression.right);
    return Array.isArray(array) && (typeof index === 'bigint' || typeof index === 'number')
      ? array[Number(index)] as FunctionArgument
      : undefined;
  }
  if (expression.kind === 'bytesConcat' || expression.kind === 'abiEncodePacked') {
    const values = (expression.args ?? []).map(evaluate);
    if (values.some((value) => value === undefined)) return undefined;
    const parts = values.map((value, index) => asBytes(
      value as FunctionArgument,
      expression.fields?.[index] || inferredType(expression.args?.[index]!) || packedFieldType(expression.args?.[index]),
      expression.args?.[index],
    ));
    return parts.every((part): part is Uint8Array => part !== undefined) ? concat(parts) : undefined;
  }
  if (expression.kind === 'call') {
    const values = (expression.args ?? []).map(evaluate);
    if (values.some((value) => value === undefined)) return undefined;
    if (expression.parameters && expression.statements
      && expression.parameters.length === values.length) {
      const bindings = new Map(localBindings);
      expression.parameters.forEach((name, index) => bindings.set(name, values[index]!));
      let remainingIterations = 10_000;
      let invalid = false;
      type Execution = { returned: boolean; value?: FunctionArgument };
      const evaluateWith = (candidate: ExternalCallExpression): FunctionArgument | undefined => (
        evaluateExternalExpression(host,
          candidate, functionArgs, artifact, state, callerInputs, externalReturns, occurrenceIndex,
          stateIncludesPriorWrites, executionSelfAddress, bindings,
        )
      );
      const defaultValue = (type: string | undefined): FunctionArgument => {
        if (type === 'bool') return false;
        if (type === 'string') return '';
        if (type?.endsWith('[]')) return [];
        if (type?.startsWith('bytes') || type?.startsWith('address')) return new Uint8Array();
        return 0n;
      };
      const execute = (statements: readonly ExternalCallStatement[]): Execution => {
        for (const statement of statements) {
          if (statement.kind === 'variable' && statement.name) {
            const value = statement.expression
              ? evaluateWith(statement.expression) : defaultValue(statement.type);
            if (value === undefined) { invalid = true; return { returned: false }; }
            bindings.set(statement.name, value);
          } else if (statement.kind === 'assign' && statement.name && statement.expression) {
            const value = evaluateWith(statement.expression);
            if (value === undefined) { invalid = true; return { returned: false }; }
            bindings.set(statement.name, value);
          } else if (statement.kind === 'while' && statement.condition && statement.statements) {
            while (true) {
              const condition = evaluateWith(statement.condition);
              if (condition === undefined) { invalid = true; return { returned: false }; }
              if (!condition) break;
              if (remainingIterations <= 0) { invalid = true; return { returned: false }; }
              remainingIterations -= 1;
              const result = execute(statement.statements);
              if (result.returned || invalid) return result;
            }
          } else if (statement.kind === 'branch' && statement.condition && statement.statements) {
            const condition = evaluateWith(statement.condition);
            if (condition === undefined) { invalid = true; return { returned: false }; }
            const result = execute(condition ? statement.statements : statement.elseStatements ?? []);
            if (result.returned || invalid) return result;
          } else if (statement.kind === 'return' && statement.expression) {
            const value = evaluateWith(statement.expression);
            if (value === undefined) { invalid = true; return { returned: false }; }
            return { returned: true, value };
          } else if (statement.kind === 'expression' && statement.expression) {
            if (evaluateWith(statement.expression) === undefined) {
              invalid = true;
              return { returned: false };
            }
          } else if (statement.kind === 'block' && statement.statements) {
            const result = execute(statement.statements);
            if (result.returned || invalid) return result;
          } else {
            invalid = true;
            return { returned: false };
          }
        }
        return { returned: false };
      };
      const result = execute(expression.statements);
      if (!invalid && result.returned) return result.value;
    }
    // Struct constructors are admitted only by the artifact's exact declared schema; spelling is not authority.
    if (expression.name && expression.type === expression.name
      && (artifact.structs ?? artifact.stateLayout?.structs)
        ?.some((candidate) => candidate.name === expression.name
          && candidate.fields.length === values.length)) {
      return values as unknown as FunctionArgument;
    }
  }
  return undefined;
}
