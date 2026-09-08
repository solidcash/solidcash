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

export interface ResolvedKernelLifecycleTopology {
  kind: 'split' | 'merge';
  categoryCensus: { inputCount: number; outputCount: number };
  inputSpans: readonly ResolvedKernelLifecycleSpan[];
  outputSpans: readonly ResolvedKernelLifecycleSpan[];
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

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
): number => {
  if (!isRecord(count)) throw new Error(`${label}.count must be an object`);
  if (expectedSource === 'fixed') {
    exactRecord(count, { source: 'fixed', value: 1 }, `${label}.count`);
    return 1;
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

/** Resolve only the exact lifecycle layouts currently published by the compiler. */
export function planKernelLifecycleTopology(
  topology: unknown,
  parameters: readonly unknown[],
): ResolvedKernelLifecycleTopology {
  if (!isRecord(topology)) throw new Error('lifecycle topology must be an object');
  const keys = Object.keys(topology).sort();
  if (keys.join(',') !== 'categoryCensus,coordinate,inputSpans,kind,outputSpans,version') {
    throw new Error('lifecycle topology has an unsupported schema');
  }
  if (topology.version !== 2 || topology.coordinate !== 'participant') {
    throw new Error('unsupported lifecycle topology version or coordinate system');
  }
  if (topology.kind !== 'split' && topology.kind !== 'merge') {
    throw new Error('unsupported lifecycle topology kind');
  }
  if (!Array.isArray(topology.inputSpans) || !Array.isArray(topology.outputSpans)) {
    throw new Error('lifecycle topology spans must be arrays');
  }

  const parameterCounts = [...topology.inputSpans, ...topology.outputSpans]
    .map((span) => isRecord(span) && isRecord(span.count) && span.count.source === 'parameter'
      ? span.count.parameterIndex : undefined)
    .filter((index): index is number => typeof index === 'number' && Number.isSafeInteger(index) && index >= 0);
  if (parameterCounts.length === 0 || !parameterCounts.every((index) => index === parameterCounts[0])) {
    throw new Error('lifecycle topology must use one canonical count parameter');
  }
  const parameterIndex = parameterCounts[0]!;
  if (!isRecord(topology.categoryCensus)) throw new Error('categoryCensus must be an object');
  const censusKeys = Object.keys(topology.categoryCensus).sort();
  if (censusKeys.join(',') !== 'inputCount,nftCapability,outputCount,tokenCategory'
    || topology.categoryCensus.tokenCategory !== 'participant'
    || topology.categoryCensus.nftCapability !== 'minting') {
    throw new Error('categoryCensus is not canonical');
  }
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
      inputSpans: [resolveSpan(topology.inputSpans[0], parameters, 'preserve', 0,
        preservedIdentity, 'fixed', parameterIndex, 'inputSpans[0]')],
      outputSpans: [
        resolveSpan(topology.outputSpans[0], parameters, 'preserve', 0,
          preservedIdentity, 'fixed', parameterIndex, 'outputSpans[0]'),
        resolveSpan(topology.outputSpans[1], parameters, 'create', 1,
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
    inputSpans: [
      resolveSpan(topology.inputSpans[0], parameters, 'preserve', 0,
        preservedIdentity, 'fixed', parameterIndex, 'inputSpans[0]'),
      resolveSpan(topology.inputSpans[1], parameters, 'consume', 1,
        consumedIdentity, 'parameter', parameterIndex, 'inputSpans[1]'),
    ],
    outputSpans: [resolveSpan(topology.outputSpans[0], parameters, 'preserve', 0,
      preservedIdentity, 'fixed', parameterIndex, 'outputSpans[0]')],
  };
}
