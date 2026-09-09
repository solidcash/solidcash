import type { ConstructedKeyVectorV1Abi, ExternalCallExpression } from '@solidcash/utils';

/** Strict v1 replay description shared with compiler artifact metadata. */
export type ConstructedKeyVectorV1 = ConstructedKeyVectorV1Abi;

export interface ConstructedKeyVectorReplay {
  values: readonly unknown[];
  /** Source-order consumer components; callers derive slots with their ordinary typed key encoder. */
  keys: readonly unknown[][];
}

/**
 * Evaluate the deliberately small expression vocabulary used by a v1 constructed-vector replay. This is not the
 * general SDK expression evaluator: no state reads, calls, identifiers, helpers, or source names are accepted.
 */
function evaluate(expression: ExternalCallExpression, rank: bigint, args: readonly unknown[]): unknown {
  const value = (candidate: ExternalCallExpression): unknown => evaluate(candidate, rank, args);
  if (expression.kind === 'literal') {
    if (expression.type === 'bool' && typeof expression.value === 'boolean') return expression.value;
    if ((expression.type === 'int' || expression.type === 'uint' || expression.type === 'bigint')
      && typeof expression.value === 'string' && /^-?[0-9]+$/.test(expression.value)) return BigInt(expression.value);
    if (expression.type?.match(/^bytes[0-9]*$/) && typeof expression.value === 'string'
      && /^[0-9a-fA-F]*$/.test(expression.value) && expression.value.length % 2 === 0) {
      return Uint8Array.from(expression.value.match(/.{2}/g)?.map((part) => Number.parseInt(part, 16)) ?? []);
    }
    throw new Error('constructed key vector has an unsupported literal');
  }
  if (expression.kind === 'source' && expression.source?.kind === 'loopIndex') return rank;
  if (expression.kind === 'source' && expression.source?.kind === 'forward'
    && Number.isSafeInteger(expression.source.paramIndex) && expression.source.paramIndex! >= 0) {
    const argument = args[expression.source.paramIndex!];
    if (typeof argument === 'bigint' || typeof argument === 'boolean' || argument instanceof Uint8Array) return argument;
    throw new Error('constructed key vector forward argument has an unsupported value');
  }
  if (expression.kind === 'unary' && expression.expression) {
    const operand = value(expression.expression);
    if (expression.operator === '-' && typeof operand === 'bigint') return -operand;
    if (expression.operator === '!' && typeof operand === 'boolean') return !operand;
    throw new Error('constructed key vector has an unsupported unary expression');
  }
  if (expression.kind === 'ternary' && expression.condition && expression.ifTrue && expression.ifFalse) {
    const condition = value(expression.condition);
    if (typeof condition !== 'boolean') throw new Error('constructed key vector ternary condition is not boolean');
    return value(condition ? expression.ifTrue : expression.ifFalse);
  }
  if (expression.kind === 'binary' && expression.left && expression.right) {
    const left = value(expression.left);
    const right = value(expression.right);
    if (typeof left === 'bigint' && typeof right === 'bigint') {
      switch (expression.operator) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': if (right !== 0n) return left / right; break;
        case '%': if (right !== 0n) return left % right; break;
        case '==': return left === right;
        case '!=': return left !== right;
        case '<': return left < right;
        case '<=': return left <= right;
        case '>': return left > right;
        case '>=': return left >= right;
      }
    }
    if (typeof left === 'boolean' && typeof right === 'boolean') {
      if (expression.operator === '&&') return left && right;
      if (expression.operator === '||') return left || right;
      if (expression.operator === '==') return left === right;
      if (expression.operator === '!=') return left !== right;
    }
    throw new Error('constructed key vector has an unsupported binary expression');
  }
  throw new Error(`constructed key vector refuses expression kind '${expression.kind}'`);
}

const integer = (value: unknown, label: string): bigint => {
  if (typeof value !== 'bigint') throw new Error(`constructed key vector ${label} is not an integer`);
  return value;
};

const validElement = (value: unknown, type: string): boolean => {
  if (/^(?:u?int\d*|bigint)$/.test(type)) return typeof value === 'bigint';
  if (type === 'bool') return typeof value === 'boolean';
  const bytes = type.match(/^bytes([1-9]|[12][0-9]|3[0-2])$/);
  return bytes !== null && value instanceof Uint8Array && value.length === Number(bytes[1]);
};

/** Replay a fixed-width constructed vector and derive source-order consumer key components. */
export function replayConstructedKeyVectorV1(
  descriptor: ConstructedKeyVectorV1,
  args: readonly unknown[],
  consumerRanks: readonly bigint[],
): ConstructedKeyVectorReplay {
  if (descriptor.version !== 1 || !Number.isSafeInteger(descriptor.vectorOrdinal) || descriptor.vectorOrdinal < 0
    || descriptor.producer.writes.length === 0) throw new Error('constructed key vector has an unsupported descriptor');
  const length = integer(evaluate(descriptor.allocationLength, 0n, args), 'allocation length');
  if (length < 0n || length > 65_535n) throw new Error('constructed key vector allocation length is out of range');
  const start = integer(evaluate(descriptor.producer.domain.start, 0n, args), 'domain start');
  const bound = integer(evaluate(descriptor.producer.domain.bound, 0n, args), 'domain bound');
  const step = integer(evaluate(descriptor.producer.domain.step, 0n, args), 'domain step');
  if (step === 0n) throw new Error('constructed key vector domain step is zero');
  const compare = (value: bigint): boolean => {
    switch (descriptor.producer.domain.comparison) {
      case '<': return value < bound;
      case '<=': return value <= bound;
      case '>': return value > bound;
      case '>=': return value >= bound;
    }
  };
  const values: unknown[] = Array.from({ length: Number(length) }, () => undefined);
  let rank = start;
  let iterations = 0;
  while (descriptor.producer.domain.kind === 'post-test' || compare(rank)) {
    if (iterations++ > 65_535) throw new Error('constructed key vector producer domain exceeds v1 limit');
    for (const write of descriptor.producer.writes) {
      if (write.condition !== undefined && evaluate(write.condition, rank, args) !== true) continue;
      const index = integer(evaluate(write.index, rank, args), 'write index');
      if (index < 0n || index >= length) throw new Error('constructed key vector write index is out of range');
      const element = evaluate(write.value, rank, args);
      if (!validElement(element, descriptor.elementType)) throw new Error('constructed key vector write has wrong element type');
      values[Number(index)] = element;
    }
    rank += step;
    if (descriptor.producer.domain.kind === 'post-test' && !compare(rank)) break;
  }
  if (values.some((entry) => entry === undefined)) throw new Error('constructed key vector producer does not cover allocation');
  const fixed = descriptor.consumer.fixedComponents;
  const components = new Set([descriptor.consumer.vectorElementComponent, ...fixed.map((item) => item.component)]);
  if (components.size !== fixed.length + 1 || [...components].some((component) => !Number.isSafeInteger(component) || component < 0)) {
    throw new Error('constructed key vector consumer component relation is invalid');
  }
  const keyWidth = descriptor.consumer.keyComponentCount;
  if (!Number.isSafeInteger(keyWidth) || keyWidth <= 0 || [...components].some((component) => component >= keyWidth)) {
    throw new Error('constructed key vector consumer key arity is invalid');
  }
  const keys = consumerRanks.map((consumerRank) => {
    const index = integer(evaluate(descriptor.consumer.index, consumerRank, args), 'consumer index');
    if (index < 0n || index >= length) throw new Error('constructed key vector consumer index is out of range');
    const key = new Array<unknown>(keyWidth);
    key[descriptor.consumer.vectorElementComponent] = values[Number(index)];
    for (const component of fixed) key[component.component] = evaluate(component.expression, consumerRank, args);
    if (key.some((component) => component === undefined)) throw new Error('constructed key vector key has a gap');
    return key;
  });
  return { values, keys };
}
