/**
 * A resolved view of compiler-published lifecycle topology metadata.
 *
 * This planner deliberately performs no transaction construction and grants no
 * kernel admission. It fails closed unless the complete version-2 schema and
 * every identity rule match the canonical split/merge layouts understood here.
 */
export interface ResolvedKernelLifecycleSpan {
  mode: 'preserve' | 'consume' | 'create';
  offset: number;
  count: number;
}

export interface ResolvedKernelLifecycleResourcePrefix {
  dataNftCount: number;
  mode: 'preserve' | 'consume';
  nftIndices: readonly number[];
}

export interface ResolvedKernelLifecycleTopology {
  kind: 'split' | 'merge' | 'selfdestruct';
  categoryCensus: { inputCount: number; outputCount: number };
  resourcePrefix?: ResolvedKernelLifecycleResourcePrefix;
  inputSpans: readonly ResolvedKernelLifecycleSpan[];
  outputSpans: readonly ResolvedKernelLifecycleSpan[];
}

export interface KernelLifecycleTransactionPoint {
  lockingBytecode: string;
  tokenCategory: string;
  nftCapability: 'none' | 'mutable' | 'minting';
  nftCommitment: string;
  tokenAmount: bigint;
  satoshis: bigint;
}

export interface KernelLifecycleTransactionFrame {
  participantLockingBytecode: string;
  participantTokenCategory: string;
  inputBase: number;
  outputBase: number;
  inputs: readonly KernelLifecycleTransactionPoint[];
  outputs: readonly KernelLifecycleTransactionPoint[];
}

export interface BoundKernelLifecycleTransaction extends ResolvedKernelLifecycleTopology {
  participantLockingBytecode: string;
  participantTokenCategory: string;
  inputBase: number;
  outputBase: number;
  transcript: Uint8Array;
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const canonicalHex = (value: unknown, bytes: number | undefined, label: string): string => {
  if (typeof value !== 'string' || !/^(?:[0-9a-fA-F]{2})*$/.test(value)
    || value.length === 0 || (bytes !== undefined && value.length !== bytes * 2)) {
    throw new Error(`${label} must be canonical${bytes === undefined ? '' : ` ${bytes}-byte`} hex`);
  }
  return value.toLowerCase();
};

const coordinate = (value: unknown, label: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 0xffff) {
    throw new Error(`${label} must be a uint16 transaction coordinate`);
  }
  return value as number;
};

const hexBytes = (hex: string): Uint8Array => Uint8Array.from(
  hex.match(/../g)?.map((part) => Number.parseInt(part, 16)) ?? [],
);

const concat = (...parts: readonly Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let cursor = 0;
  for (const part of parts) { result.set(part, cursor); cursor += part.length; }
  return result;
};

const uint16 = (value: number): Uint8Array => Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
const framed = (value: Uint8Array): Uint8Array => concat(uint16(value.length), value);

const exactRecord = (value: unknown, expected: UnknownRecord, label: string): void => {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = Object.keys(expected).sort();
  if (actualKeys.length !== expectedKeys.length
    || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error(`${label} has an unsupported schema`);
  }
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (value[key] !== expectedValue) throw new Error(`${label}.${key} is not canonical`);
  }
};

const preservedIdentity = {
  lockingBytecode: 'participant', tokenCategory: 'participant', nftCapability: 'minting',
  nftCommitment: 'preserve', tokenAmount: 'nondecrease', satoshis: 'preserve',
} as const;
const splitPreservedIdentity = { ...preservedIdentity, tokenAmount: 'preserve' } as const;
const consumedIdentity = {
  lockingBytecode: 'participant', tokenCategory: 'participant', nftCapability: 'minting',
  nftCommitment: 'unconstrained', tokenAmount: 'unconstrained', satoshis: 'reclaim',
} as const;
const createdIdentity = {
  lockingBytecode: 'participant', tokenCategory: 'participant', nftCapability: 'minting',
  nftCommitment: 'empty', tokenAmount: 'zero', satoshis: 'funded',
} as const;

const resolveCount = (
  count: unknown,
  parameters: readonly unknown[],
  expectedSource: 'fixed' | 'parameter',
  expectedParameterIndex: number,
  expectedAddend: number,
  label: string,
  expectedFixedValue = 1,
): number => {
  if (!isRecord(count)) throw new Error(`${label}.count must be an object`);
  if (expectedSource === 'fixed') {
    exactRecord(count, { source: 'fixed', value: expectedFixedValue }, `${label}.count`);
    return expectedFixedValue;
  }
  exactRecord(count, {
    source: 'parameter', parameterIndex: expectedParameterIndex, addend: expectedAddend,
  }, `${label}.count`);
  const parameter = parameters[expectedParameterIndex];
  const numeric = typeof parameter === 'bigint'
    ? parameter
    : typeof parameter === 'number' && Number.isSafeInteger(parameter) ? BigInt(parameter) : undefined;
  if (numeric === undefined || numeric <= 0n || numeric > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label}.count parameter must be a positive safe integer`);
  }
  const resolved = numeric + BigInt(expectedAddend);
  if (resolved > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label}.count exceeds safe integer bounds`);
  }
  return Number(resolved);
};

const resolveSpan = (
  value: unknown,
  parameters: readonly unknown[],
  mode: ResolvedKernelLifecycleSpan['mode'],
  offset: number,
  identity: UnknownRecord,
  countSource: 'fixed' | 'parameter',
  parameterIndex: number,
  label: string,
): ResolvedKernelLifecycleSpan => {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  const keys = Object.keys(value).sort();
  if (keys.join(',') !== 'count,identity,mode,offset') throw new Error(`${label} has an unsupported schema`);
  if (value.mode !== mode || value.offset !== offset) throw new Error(`${label} placement is not canonical`);
  exactRecord(value.identity, identity, `${label}.identity`);
  const count = resolveCount(value.count, parameters, countSource, parameterIndex, 0, label);
  if (!Number.isSafeInteger(offset + count)) throw new Error(`${label} range exceeds safe integer bounds`);
  return { mode, offset, count };
};

const resolveResourcePrefix = (
  value: unknown,
  kind: ResolvedKernelLifecycleTopology['kind'],
): ResolvedKernelLifecycleResourcePrefix | undefined => {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error('resourcePrefix must be an object');
  const keys = Object.keys(value).sort();
  if (keys.join(',') !== 'dataNftCount,mode,nftIndices') {
    throw new Error('resourcePrefix has an unsupported schema');
  }
  const expectedMode = kind === 'selfdestruct' ? 'consume' : 'preserve';
  if (value.mode !== expectedMode) throw new Error('resourcePrefix.mode is not canonical');
  if (!Number.isSafeInteger(value.dataNftCount) || (value.dataNftCount as number) < 1
    || (value.dataNftCount as number) > 0xffff) {
    throw new Error('resourcePrefix.dataNftCount must be a positive uint16');
  }
  if (!Array.isArray(value.nftIndices) || value.nftIndices.length !== value.dataNftCount
    || value.nftIndices.some((index, position) => !Number.isSafeInteger(index) || (index as number) < 0
      || (index as number) > 0xffff || (index as number) !== position)) {
    throw new Error('resourcePrefix.nftIndices must be compact 0..D-1');
  }
  return {
    dataNftCount: value.dataNftCount as number,
    mode: expectedMode,
    nftIndices: Object.freeze([...(value.nftIndices as number[])]),
  };
};

/** Resolve only the exact lifecycle layouts currently published by the compiler. */
export function planKernelLifecycleTopology(
  topology: unknown,
  parameters: readonly unknown[],
): ResolvedKernelLifecycleTopology {
  if (!isRecord(topology)) throw new Error('lifecycle topology must be an object');
  const keys = Object.keys(topology).sort();
  const allowed = keys.join(',') === 'categoryCensus,coordinate,inputSpans,kind,outputSpans,version'
    || keys.join(',') === 'categoryCensus,coordinate,inputSpans,kind,outputSpans,resourcePrefix,version';
  if (!allowed) {
    throw new Error('lifecycle topology has an unsupported schema');
  }
  if (topology.version !== 2 || topology.coordinate !== 'participant') {
    throw new Error('unsupported lifecycle topology version or coordinate system');
  }
  if (topology.kind !== 'split' && topology.kind !== 'merge' && topology.kind !== 'selfdestruct') {
    throw new Error('unsupported lifecycle topology kind');
  }
  if (!Array.isArray(topology.inputSpans) || !Array.isArray(topology.outputSpans)) {
    throw new Error('lifecycle topology spans must be arrays');
  }
  if (!isRecord(topology.categoryCensus)) throw new Error('categoryCensus must be an object');
  const censusKeys = Object.keys(topology.categoryCensus).sort();
  if (censusKeys.join(',') !== 'inputCount,nftCapability,outputCount,tokenCategory'
    || topology.categoryCensus.tokenCategory !== 'participant'
    || topology.categoryCensus.nftCapability !== 'minting') {
    throw new Error('categoryCensus is not canonical');
  }
  const resourcePrefix = resolveResourcePrefix(topology.resourcePrefix, topology.kind);
  const trailingOffset = 1 + (resourcePrefix?.dataNftCount ?? 0);

  if (topology.kind === 'selfdestruct') {
    if (topology.inputSpans.length !== 1 || topology.outputSpans.length !== 0) {
      throw new Error('selfdestruct lifecycle topology has non-canonical span cardinality');
    }
    const fixedParameterIndex = 0;
    return {
      kind: 'selfdestruct',
      categoryCensus: {
        inputCount: resolveCount(topology.categoryCensus.inputCount, parameters, 'fixed', fixedParameterIndex, 0,
          'categoryCensus.inputCount', 1),
        outputCount: resolveCount(topology.categoryCensus.outputCount, parameters, 'fixed', fixedParameterIndex, 0,
          'categoryCensus.outputCount', 0),
      },
      ...(resourcePrefix && { resourcePrefix }),
      inputSpans: [resolveSpan(topology.inputSpans[0], parameters, 'consume', 0,
        consumedIdentity, 'fixed', fixedParameterIndex, 'inputSpans[0]')],
      outputSpans: [],
    };
  }

  const parameterCounts = [...topology.inputSpans, ...topology.outputSpans]
    .map((span) => isRecord(span) && isRecord(span.count) && span.count.source === 'parameter'
      ? span.count.parameterIndex : undefined)
    .filter((index): index is number => typeof index === 'number' && Number.isSafeInteger(index) && index >= 0);
  if (parameterCounts.length === 0 || !parameterCounts.every((index) => index === parameterCounts[0])) {
    throw new Error('lifecycle topology must use one canonical count parameter');
  }
  const parameterIndex = parameterCounts[0]!;
  const categoryCensus = topology.kind === 'split' ? {
    inputCount: resolveCount(topology.categoryCensus.inputCount, parameters, 'fixed', parameterIndex, 0,
      'categoryCensus.inputCount'),
    outputCount: resolveCount(topology.categoryCensus.outputCount, parameters, 'parameter', parameterIndex, 1,
      'categoryCensus.outputCount'),
  } : {
    inputCount: resolveCount(topology.categoryCensus.inputCount, parameters, 'parameter', parameterIndex, 1,
      'categoryCensus.inputCount'),
    outputCount: resolveCount(topology.categoryCensus.outputCount, parameters, 'fixed', parameterIndex, 0,
      'categoryCensus.outputCount'),
  };

  if (topology.kind === 'split') {
    if (topology.inputSpans.length !== 1 || topology.outputSpans.length !== 2) {
      throw new Error('split lifecycle topology has non-canonical span cardinality');
    }
    return {
      kind: 'split',
      categoryCensus,
      ...(resourcePrefix && { resourcePrefix }),
      inputSpans: [resolveSpan(topology.inputSpans[0], parameters, 'preserve', 0,
        splitPreservedIdentity, 'fixed', parameterIndex, 'inputSpans[0]')],
      outputSpans: [
        resolveSpan(topology.outputSpans[0], parameters, 'preserve', 0,
          splitPreservedIdentity, 'fixed', parameterIndex, 'outputSpans[0]'),
        resolveSpan(topology.outputSpans[1], parameters, 'create', trailingOffset,
          createdIdentity, 'parameter', parameterIndex, 'outputSpans[1]'),
      ],
    };
  }

  if (topology.inputSpans.length !== 2 || topology.outputSpans.length !== 1) {
    throw new Error('merge lifecycle topology has non-canonical span cardinality');
  }
  return {
    kind: 'merge',
    categoryCensus,
    ...(resourcePrefix && { resourcePrefix }),
    inputSpans: [
      resolveSpan(topology.inputSpans[0], parameters, 'preserve', 0,
        preservedIdentity, 'fixed', parameterIndex, 'inputSpans[0]'),
      resolveSpan(topology.inputSpans[1], parameters, 'consume', trailingOffset,
        consumedIdentity, 'parameter', parameterIndex, 'inputSpans[1]'),
    ],
    outputSpans: [resolveSpan(topology.outputSpans[0], parameters, 'preserve', 0,
      preservedIdentity, 'fixed', parameterIndex, 'outputSpans[0]')],
  };
}

/** Bind the published lifecycle spans to concrete transaction identities and a transaction-wide category census. */
export function bindKernelLifecycleTransaction(
  topology: unknown,
  parameters: readonly unknown[],
  frame: KernelLifecycleTransactionFrame,
): BoundKernelLifecycleTransaction {
  const plan = planKernelLifecycleTopology(topology, parameters);
  if (plan.kind === 'selfdestruct') {
    throw new Error('selfdestruct lifecycle uses selector-derived authority without a V3 transcript bind');
  }
  const owner = canonicalHex(frame.participantLockingBytecode, undefined, 'participant locking bytecode');
  const category = canonicalHex(frame.participantTokenCategory, 32, 'participant token category');
  const inputBase = coordinate(frame.inputBase, 'lifecycle input base');
  const outputBase = coordinate(frame.outputBase, 'lifecycle output base');
  if (plan.kind === 'split' && outputBase !== inputBase) {
    throw new Error('split lifecycle input and output bases must match');
  }

  const validatePoint = (
    point: KernelLifecycleTransactionPoint | undefined,
    label: string,
  ): KernelLifecycleTransactionPoint => {
    if (!point) throw new Error(`${label} is absent`);
    if (canonicalHex(point.lockingBytecode, undefined, `${label} locking bytecode`) !== owner
      || canonicalHex(point.tokenCategory, 32, `${label} token category`) !== category
      || point.nftCapability !== 'minting') {
      throw new Error(`${label} does not preserve the participant minting identity`);
    }
    if (!/^(?:[0-9a-fA-F]{2})*$/.test(point.nftCommitment)
      || typeof point.tokenAmount !== 'bigint' || point.tokenAmount < 0n
      || typeof point.satoshis !== 'bigint' || point.satoshis < 0n) {
      throw new Error(`${label} has a non-canonical value or commitment`);
    }
    return point;
  };

  for (const span of plan.inputSpans) {
    for (let index = 0; index < span.count; index += 1) {
      validatePoint(frame.inputs[inputBase + span.offset + index], `lifecycle input ${span.offset + index}`);
    }
  }
  for (const span of plan.outputSpans) {
    for (let index = 0; index < span.count; index += 1) {
      validatePoint(frame.outputs[outputBase + span.offset + index], `lifecycle output ${span.offset + index}`);
    }
  }

  const preservedInput = validatePoint(frame.inputs[inputBase], 'preserved lifecycle input');
  const preservedOutput = validatePoint(frame.outputs[outputBase], 'preserved lifecycle output');
  if (preservedOutput.nftCommitment.toLowerCase() !== preservedInput.nftCommitment.toLowerCase()
    || (plan.kind === 'split'
      ? preservedOutput.tokenAmount !== preservedInput.tokenAmount
      : preservedOutput.tokenAmount < preservedInput.tokenAmount)
    || preservedOutput.satoshis !== preservedInput.satoshis) {
    throw new Error('lifecycle preserved master changes commitment, token amount, or satoshis');
  }
  if (plan.kind === 'split') {
    for (const span of plan.outputSpans.filter((candidate) => candidate.mode === 'create')) {
      for (let index = 0; index < span.count; index += 1) {
        const created = frame.outputs[outputBase + span.offset + index]!;
        if (created.nftCommitment.length !== 0 || created.tokenAmount !== 0n || created.satoshis <= 0n) {
          throw new Error('lifecycle created master must be empty, token-free, and funded');
        }
      }
    }
  }

  const categoryCount = (points: readonly KernelLifecycleTransactionPoint[]): number => points.filter((point) =>
    point.nftCapability === 'minting'
    && point.tokenCategory.toLowerCase() === category).length;
  const inputCount = categoryCount(frame.inputs);
  const outputCount = categoryCount(frame.outputs);
  if (inputCount !== plan.categoryCensus.inputCount || outputCount !== plan.categoryCensus.outputCount) {
    throw new Error(
      `lifecycle category census is ${inputCount}/${outputCount}, expected `
      + `${plan.categoryCensus.inputCount}/${plan.categoryCensus.outputCount}`,
    );
  }

  const transcript = concat(
    hexBytes('4b4c4332'), // `KLC2`
    Uint8Array.of(plan.kind === 'split' ? 0 : 1),
    uint16(inputBase), uint16(outputBase),
    framed(hexBytes(owner)), hexBytes(category),
    uint16(plan.categoryCensus.inputCount), uint16(plan.categoryCensus.outputCount),
    framed(hexBytes(preservedInput.nftCommitment)), framed(hexBytes(preservedOutput.nftCommitment)),
  );
  return Object.freeze({
    ...plan, participantLockingBytecode: owner, participantTokenCategory: category,
    inputBase, outputBase, transcript,
  });
}
