/**
 * Evaluate a compiler-published fixed-effect activation expression against one call's arguments and state.
 *
 * The expression vocabulary is the artifact's own `ExternalCallExpression`; an unresolved operand yields
 * `undefined`, which callers treat as "cannot decide" and fail closed.
 */

import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import type { ExternalCallExpression } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';

export function evaluateFixedEffectPredicate(
  expression: ExternalCallExpression, args: readonly FunctionArgument[],
  state: Readonly<Record<string, FunctionArgument>> = {},
): unknown {
  if (expression.kind === 'literal') {
    if (expression.type === 'bigint' && typeof expression.value === 'string') return BigInt(expression.value);
    if (expression.type === 'bool' && typeof expression.value === 'boolean') return expression.value;
    if (expression.type === 'string' && typeof expression.value === 'string') return expression.value;
    if (expression.type?.startsWith('bytes') && typeof expression.value === 'string') {
      return hexToBin(expression.value);
    }
    return undefined;
  }
  if (expression.kind === 'source' && expression.source?.kind === 'forward'
    && expression.source.paramIndex !== undefined) return args[expression.source.paramIndex];
  if (expression.kind === 'state') return Object.hasOwn(state, expression.name ?? '')
    ? state[expression.name!] : undefined;
  if (expression.kind === 'cast') return expression.expression
    ? evaluateFixedEffectPredicate(expression.expression, args, state) : undefined;
  if (expression.kind === 'unary' && expression.expression) {
    const value = evaluateFixedEffectPredicate(expression.expression, args, state);
    if (expression.operator === '!') return typeof value === 'boolean' ? !value : undefined;
    if (expression.operator === '-' && typeof value === 'bigint') return -value;
    if (expression.operator === '.length' && (typeof value === 'string' || value instanceof Uint8Array
      || Array.isArray(value))) return BigInt(value.length);
    return undefined;
  }
  if (expression.kind === 'binary' && expression.left && expression.right) {
    const left = evaluateFixedEffectPredicate(expression.left, args, state);
    if (left === undefined) return undefined;
    if (expression.operator === '&&' && typeof left === 'boolean' && !left) return false;
    if (expression.operator === '||' && typeof left === 'boolean' && left) return true;
    const right = evaluateFixedEffectPredicate(expression.right, args, state);
    if (right === undefined) return undefined;
    // An address(0) cast evaluates to the numeric literal zero here, while an authenticated address argument
    // can arrive as empty bytes or an all-zero 20/32-byte ABI word. Match the compiler's address comparison
    // domain before deciding whether a conditional fixed effect (such as a BCH transfer) is active.
    const addressComparison = expression.left.type?.startsWith('address')
      || expression.right.type?.startsWith('address');
    const zeroAddress = (value: unknown): boolean => (
      (typeof value === 'bigint' || typeof value === 'number') && BigInt(value) === 0n
      || value instanceof Uint8Array && [0, 20, 32].includes(value.length)
        && value.every((byte) => byte === 0)
      || typeof value === 'string' && /^(?:0x)?(?:0{40}|0{64})$/iu.test(value)
    );
    let equal: boolean;
    if (addressComparison && zeroAddress(left) && zeroAddress(right)) equal = true;
    else if (left instanceof Uint8Array && right instanceof Uint8Array) {
      equal = left.length === right.length && left.every((byte, index) => byte === right[index]);
    } else if ((typeof left === 'bigint' || typeof left === 'number')
      && (typeof right === 'bigint' || typeof right === 'number')) equal = BigInt(left) === BigInt(right);
    else equal = left === right;
    switch (expression.operator) {
      case '&&': return typeof left === 'boolean' && typeof right === 'boolean' ? left && right : undefined;
      case '||': return typeof left === 'boolean' && typeof right === 'boolean' ? left || right : undefined;
      case '==': return equal;
      case '!=': return !equal;
      case '<': return typeof left === 'bigint' && typeof right === 'bigint' ? left < right : undefined;
      case '<=': return typeof left === 'bigint' && typeof right === 'bigint' ? left <= right : undefined;
      case '>': return typeof left === 'bigint' && typeof right === 'bigint' ? left > right : undefined;
      case '>=': return typeof left === 'bigint' && typeof right === 'bigint' ? left >= right : undefined;
      case '+': return typeof left === 'bigint' && typeof right === 'bigint' ? left + right : undefined;
      case '-': return typeof left === 'bigint' && typeof right === 'bigint' ? left - right : undefined;
      case '*': return typeof left === 'bigint' && typeof right === 'bigint' ? left * right : undefined;
      case '/': return typeof left === 'bigint' && typeof right === 'bigint' && right !== 0n ? left / right : undefined;
      case '%': return typeof left === 'bigint' && typeof right === 'bigint' && right !== 0n ? left % right : undefined;
      default: return undefined;
    }
  }
  if (expression.kind === 'ternary' && expression.condition && expression.ifTrue && expression.ifFalse) {
    const selected = evaluateFixedEffectPredicate(expression.condition, args, state);
    return typeof selected === 'boolean'
      ? evaluateFixedEffectPredicate(selected ? expression.ifTrue : expression.ifFalse, args, state) : undefined;
  }
  return undefined;
}
