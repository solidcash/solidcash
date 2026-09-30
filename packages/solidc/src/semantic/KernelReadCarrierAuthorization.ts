import { createHash } from 'crypto';
import { binToHex } from '@bitauth/libauth';
import {
  ArrayAccessNode, AssignNode, BinaryOpNode, BlockNode, CastNode, CollectionNode, ExpressionNode,
  FunctionDefinitionNode, IdentifierNode, IntLiteralNode, KernelReadCarrierAuthorization,
  KernelReadCarrierDiscoveryPlan, MappingAccessNode, MappingAssignNode, Node, TupleIndexOpNode, UnaryOpNode,
  VariableDefinitionNode, WhileNode,
} from '../ast/AST.js';

import { BinaryOperator } from '../ast/Operator.js';
import {
  AbiFunction, abiTypeString, ArrayType, computeCollectionHash, computeCollectionSignature,
  computeFunctionSelector, computeFunctionSignature, EnumType, ExternalCallExpression, FixedType, FunctionType,
  IntType, isFixedWidthType, PrimitiveType, SortedUpsertLoopAbi, StructType, TupleType, ValueType,
} from '@solidcash/utils';

/** Immutable completed-ABI authority transferred from admission into one pristine code-generation pass. */
export type KernelReadCarrierFamilyScope = Readonly<{
  selectorHex: string;
  completedDescriptorDigest: string;
  streamDescriptorDigests: readonly string[];
}>;

export type KernelJournalDisposition = 'carrier' | 'eager-journal' | 'neutral';

export type KernelJournalDispositionStreamScope = Readonly<{
  journalAccessStreamIndex: number;
  descriptorDigest: string;
  disposition: KernelJournalDisposition;
}>;

/**
 * Ordered, names-free ownership of every runtime journal stream selected into one kernel handler family.
 * This remains compiler-private until the physical carrier protocol and its SDK consumer are released together.
 */
export type KernelJournalDispositionHandlerScope = Readonly<{
  selectorHex: string;
  completedDescriptorDigest: string;
  mode: KernelJournalDisposition;
  streams: readonly KernelJournalDispositionStreamScope[];
}>;

/** Compiler-private shared state. None of these fields may be serialized as an artifact capability. */
export type KernelReadCarrierAuthorizationBox = {
  hasSourceCandidate?: boolean;
  /** Cheap admission observed an admitted collection flow whose final journal shape requires body lowering. */
  hasJournalDispositionSourceCandidate?: boolean;
  observedScopes?: readonly KernelReadCarrierFamilyScope[];
  expectedScopes?: readonly KernelReadCarrierFamilyScope[];
  verifiedScopes?: readonly KernelReadCarrierFamilyScope[];
  mismatch?: boolean;
  /** Test/audit observation that codegen consumed this exact stream authority. */
  codegenMatchedStreams?: Set<string>;
  /** Pass-local evidence that the aggregate route emitted its authorized final-settlement path. */
  codegenMatchedRouteScopes?: Set<string>;
  /** Ordered disposition manifest expected by the artifact-producing pristine pass. */
  expectedKernelJournalDispositions?: readonly KernelJournalDispositionHandlerScope[];
  /** Exact manifest reproduced and consumed by that pass. */
  verifiedKernelJournalDispositions?: readonly KernelJournalDispositionHandlerScope[];
  /** Pass-local evidence that each selected handler consumed its exact disposition scope. */
  codegenMatchedKernelJournalDispositions?: string[];
  /** Pass-local evidence that the aggregate route consumed the complete ordered manifest. */
  codegenMatchedKernelJournalDispositionRoute?: boolean;
  /** Exact SCJD digest emitted by the authenticated aggregate route, when release publication is enabled. */
  codegenMatchedKernelJournalDispositionCommitment?: string;
  /** Release-gated request to emit and publish the bytecode-bound disposition protocol atomically. */
  publishKernelJournalDispositionProtocol?: boolean;
  /** Opaque compiler-owned identity for the artifact-producing pristine pass. */
  bindingToken?: object;
};

const kernelReadCarrierBindingTokens = new WeakSet<object>();

/** Create authority which cannot be forged through the structurally public compiler-options object. */
export function createKernelReadCarrierBindingToken(): object {
  const token = Object.freeze({});
  kernelReadCarrierBindingTokens.add(token);
  return token;
}

export function isKernelReadCarrierBindingToken(token: object | undefined): boolean {
  return token !== undefined && kernelReadCarrierBindingTokens.has(token);
}

/** Permanently revoke one pass token; identities are never reusable across codegen attempts. */
export function revokeKernelReadCarrierBindingToken(token: object | undefined): void {
  if (token !== undefined) kernelReadCarrierBindingTokens.delete(token);
}

/** Revoke and detach a box's pass token without clearing its audit observations. */
export function clearKernelReadCarrierBindingToken(
  box: KernelReadCarrierAuthorizationBox | undefined,
  token: object | undefined = box?.bindingToken,
): void {
  revokeKernelReadCarrierBindingToken(token);
  if (box && box.bindingToken === token) box.bindingToken = undefined;
}

const skippedLinks = new Set([
  'definition', 'functionReference', 'resolvedFunction', 'symbolTable', 'referencedContract',
  'stateVariable', 'collection', 'type', 'location',
]);

const digest = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const walk = (
  root: Node,
  visit: (node: Node, statementPath: readonly number[], loops: readonly WhileNode[]) => void,
): void => {
  const seen = new WeakSet<object>();
  const descend = (node: Node, statementPath: readonly number[], loops: readonly WhileNode[]): void => {
    if (seen.has(node)) return;
    seen.add(node);
    visit(node, statementPath, loops);
    if (node instanceof BlockNode) {
      for (const [index, statement] of (node.statements ?? []).entries()) {
        descend(statement, [...statementPath, index], loops);
      }
      return;
    }
    const nestedLoops = node instanceof WhileNode ? [...loops, node] : loops;
    for (const [key, value] of Object.entries(node)) {
      if (skippedLinks.has(key)) continue;
      if (value instanceof Node) descend(value, statementPath, nestedLoops);
      else if (Array.isArray(value)) {
        for (const item of value) if (item instanceof Node) descend(item, statementPath, nestedLoops);
      }
    }
  };
  descend(root, [], []);
};

const identifier = (expression: ExpressionNode | undefined): string | undefined =>
  expression instanceof IdentifierNode ? expression.name : undefined;

const canonicalExpression = (
  expression: ExpressionNode,
  fn: FunctionDefinitionNode,
  counter: string,
): unknown | undefined => {
  if (expression instanceof IdentifierNode) {
    if (expression.name === counter) return ['counter'];
    const parameterIndex = fn.parameters.findIndex((parameter) => parameter.name === expression.name);
    return parameterIndex < 0 ? undefined : ['parameter', parameterIndex];
  }
  if (expression instanceof IntLiteralNode) return ['integer', expression.value.toString()];
  if (expression instanceof CastNode) {
    const inner = canonicalExpression(expression.expression, fn, counter);
    return inner === undefined ? undefined : ['cast', abiTypeString(expression.type), inner];
  }
  if (expression instanceof UnaryOpNode) {
    const inner = canonicalExpression(expression.expression, fn, counter);
    return inner === undefined ? undefined : ['unary', expression.operator, inner];
  }
  if (expression instanceof BinaryOpNode) {
    const left = canonicalExpression(expression.left, fn, counter);
    const right = canonicalExpression(expression.right, fn, counter);
    return left === undefined || right === undefined ? undefined : ['binary', expression.operator, left, right];
  }
  if (expression instanceof ArrayAccessNode) {
    const array = canonicalExpression(expression.array, fn, counter);
    const index = canonicalExpression(expression.index, fn, counter);
    return array === undefined || index === undefined ? undefined : ['array', array, index];
  }
  if (expression instanceof TupleIndexOpNode) {
    const tuple = canonicalExpression(expression.tuple, fn, counter);
    return tuple === undefined ? undefined : ['tuple-index', expression.index, tuple];
  }
  return undefined;
};

const canonicalLoop = (
  loop: WhileNode,
  fn: FunctionDefinitionNode,
  initializer: Node | undefined,
): { counter: string; shape: unknown } | undefined => {
  if (!(loop.condition instanceof BinaryOpNode) || loop.condition.operator !== BinaryOperator.LT) return undefined;
  const counter = identifier(loop.condition.left);
  if (!counter) return undefined;
  if (!(initializer instanceof VariableDefinitionNode) || initializer.name !== counter
    || !(initializer.expression instanceof IntLiteralNode) || initializer.expression.value !== 0n) return undefined;
  const statements = loop.block.statements ?? [];
  const update = statements.at(-1);
  if (!(update instanceof AssignNode) || update.identifier.name !== counter
    || !(update.expression instanceof BinaryOpNode) || update.expression.operator !== BinaryOperator.PLUS
    || identifier(update.expression.left) !== counter || !(update.expression.right instanceof IntLiteralNode)
    || update.expression.right.value !== 1n) return undefined;
  const bound = canonicalExpression(loop.condition.right, fn, counter);
  return bound === undefined ? undefined : {
    counter,
    shape: ['pre-test', '<', ['integer', '0'], bound, ['integer', '1']],
  };
};

const collectionOrdinal = (name: string, collections: readonly CollectionNode[]): number =>
  collections.findIndex((collection) => collection.name === name);

type SourceEdge = {
  loopPath: readonly number[];
  loopShape: unknown;
  keyShape: unknown;
  source: number;
  destination: number;
  valueType: string;
  keyArity: number;
};

/** Exact value family currently emitted by the route-final scalar settlement path. */
const isKernelReadCarrierScalarType = (type: CollectionNode['innermostValueType']): boolean => {
  if (type instanceof ValueType) return isKernelReadCarrierScalarType(type.underlyingType);
  return type.toString() === 'bool' || type === PrimitiveType.BIGINT
    || type instanceof IntType || type instanceof FixedType || type instanceof EnumType
    || (type instanceof FunctionType && !type.isExternal);
};

/**
 * First pass: discover one unambiguous direct mapping-read -> mapping-set family in a canonical counter loop.
 * Names are used only to resolve declarations while inspecting the AST; the returned frozen plan contains none.
 */
export function discoverKernelReadCarrier(
  fn: FunctionDefinitionNode,
  collections: readonly CollectionNode[],
): KernelReadCarrierDiscoveryPlan | undefined {
  const priorPlan = fn.messageBusKernelReadCarrierDiscovery;
  // A pristine clone can mechanically retain metadata from an earlier attempt. Re-derive the exact source fact;
  // a rewritten body must not launder that stale plan into a later authorization pass.
  fn.messageBusKernelReadCarrierDiscovery = undefined;
  fn.messageBusKernelReadCarrierSourceParameterCount = undefined;
  fn.messageBusKernelReadCarrierSyntheticParameterRoles = undefined;
  if (!fn.body) return undefined;
  const edges: SourceEdge[] = [];
  const loopPaths = new WeakMap<WhileNode, readonly number[]>();
  let sawUnrepresentableReadToSet = false;
  walk(fn.body, (node, statementPath, loops) => {
    if (node instanceof WhileNode) loopPaths.set(node, statementPath);
    if (!(node instanceof MappingAssignNode) || !(node.expression instanceof MappingAccessNode)
      || loops.length !== 1) return;
    const loop = loops[0];
    const loopPath = loopPaths.get(loop);
    const loopIndex = loopPath?.length === 1 ? loopPath[0] : undefined;
    const initializer = loopIndex === undefined ? undefined : (fn.body.statements ?? [])[loopIndex - 1];
    const canonical = canonicalLoop(loop, fn, initializer);
    if (!canonical || !loopPath || loopPath.length !== 1 || statementPath.length !== loopPath.length + 1
      || !loopPath.every((component, index) => statementPath[index] === component)
      || node.keys.length !== node.expression.keys.length) {
      sawUnrepresentableReadToSet = true;
      return;
    }
    const destination = collectionOrdinal(node.name, collections);
    const source = collectionOrdinal(node.expression.name, collections);
    if (source < 0 || destination < 0 || source === destination) {
      sawUnrepresentableReadToSet = true;
      return;
    }
    const sourceCollection = collections[source];
    const destinationCollection = collections[destination];
    const sourceType = sourceCollection.innermostValueType;
    const destinationType = destinationCollection.innermostValueType;
    if (!isFixedWidthType(sourceType) || !isKernelReadCarrierScalarType(sourceType)
      || sourceType instanceof ArrayType || sourceType instanceof StructType
      || sourceType instanceof TupleType || sourceType.toString() !== destinationType.toString()) {
      sawUnrepresentableReadToSet = true;
      return;
    }
    const sourceKeys = node.expression.keys.map((key) => canonicalExpression(key, fn, canonical.counter));
    const destinationKeys = node.keys.map((key) => canonicalExpression(key, fn, canonical.counter));
    if (sourceKeys.some((key) => key === undefined) || destinationKeys.some((key) => key === undefined)
      || JSON.stringify(sourceKeys) !== JSON.stringify(destinationKeys)) {
      sawUnrepresentableReadToSet = true;
      return;
    }
    edges.push({
      loopPath,
      loopShape: canonical.shape,
      keyShape: sourceKeys,
      source,
      destination,
      valueType: abiTypeString(sourceType),
      keyArity: sourceKeys.length,
    });
  });
  if (edges.length === 0 || sawUnrepresentableReadToSet) return undefined;
  const first = edges[0];
  if (!edges.every((edge) => edge.source === first.source && edge.valueType === first.valueType
    && edge.keyArity === first.keyArity && JSON.stringify(edge.loopPath) === JSON.stringify(first.loopPath)
    && JSON.stringify(edge.loopShape) === JSON.stringify(first.loopShape)
    && JSON.stringify(edge.keyShape) === JSON.stringify(first.keyShape))) return undefined;
  const destinations = edges.map((edge) => edge.destination);
  if (new Set(destinations).size !== destinations.length) return undefined;
  const basis = {
    version: 1,
    sourceCollectionOrdinal: first.source,
    destinationCollectionOrdinals: destinations,
    valueType: first.valueType,
    keyArity: first.keyArity,
    executionCoordinate: first.loopPath,
    loopShape: first.loopShape,
    keyShape: first.keyShape,
  } as const;
  const plan = new KernelReadCarrierDiscoveryPlan(
    digest(['kernel-read-carrier-discovery-v1', basis]), first.source, Object.freeze([...destinations]),
    first.valueType, first.keyArity, Object.freeze([...first.loopPath]),
    JSON.stringify(first.loopShape), JSON.stringify(first.keyShape),
  );
  const exactPrior = priorPlan?.digest === plan.digest
    && priorPlan.sourceCollectionOrdinal === plan.sourceCollectionOrdinal
    && sameJson(priorPlan.destinationCollectionOrdinals, plan.destinationCollectionOrdinals)
    && priorPlan.valueType === plan.valueType && priorPlan.keyArity === plan.keyArity
    && sameJson(priorPlan.executionCoordinate, plan.executionCoordinate)
    && priorPlan.loopShape === plan.loopShape && priorPlan.keyShape === plan.keyShape;
  fn.messageBusKernelReadCarrierDiscovery = exactPrior ? priorPlan : plan;
  fn.messageBusKernelReadCarrierSourceParameterCount = fn.parameters.length;
  return fn.messageBusKernelReadCarrierDiscovery;
}

const sameJson = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

export const freezeKernelJournalDispositions = (
  scopes: readonly KernelJournalDispositionHandlerScope[],
): readonly KernelJournalDispositionHandlerScope[] => Object.freeze(scopes.map((scope) => Object.freeze({
  selectorHex: scope.selectorHex.toLowerCase(),
  completedDescriptorDigest: scope.completedDescriptorDigest,
  mode: scope.mode,
  streams: Object.freeze(scope.streams.map((stream) => Object.freeze({ ...stream }))),
})));

export const sameKernelJournalDispositions = (
  left: readonly KernelJournalDispositionHandlerScope[],
  right: readonly KernelJournalDispositionHandlerScope[],
): boolean => sameJson(left, right);

export const kernelJournalDispositionScopeKey = (
  scope: KernelJournalDispositionHandlerScope,
): string => `${scope.selectorHex}:${scope.completedDescriptorDigest}:${scope.mode}:`
  + scope.streams.map((stream) => `${stream.journalAccessStreamIndex}:${stream.descriptorDigest}:`
    + stream.disposition).join(',');

const sortedUpsertLoopAbiFields = Object.freeze({
  collection: true, collectionHash: true, journalAccessStreamIndex: true, settlementIdentity: true,
  journalExecutionGroup: true, fixedKeyParams: true, fixedKeySources: true, varyingArrayParam: true,
  varyingKeyIndices: true, varyingKeyExpressions: true, constructedKeyReplay: true,
  multiArmConstructedKeyReplay: true, crossArrayKeyReplay: true, nestedHelperReturnReplay: true,
  sameIterationMutableSelectionReplay: true, keyDecodeTupleIndex: true, keyDecodeTupleTypes: true,
  predicateArrayParam: true, predicateEquals: true, valueArrayParam: true, valueArrayIndexParam: true,
  valueArrayOffset: true, valueScalarParam: true, valueConst: true, valueBool: true, valueRuntimeLocal: true,
  valueRuntimeExpression: true, valueTraceWitnessParam: true, valueTraceLocal: true,
  valueTraceInitial: true, valueTraceUpdates: true, valueTraceAfterUpdates: true,
  prefixCountWitnessParam: true, prefixCountCondition: true, mutation: true,
  mutationValueArrayParam: true, mutationValueArrayIndexParam: true, mutationValueScalarParam: true,
  mutationValueConst: true, mutationValueExpression: true, mutationIndexArrayParam: true,
  mutationIndexArrayIndexParam: true, mutationIndexScalarParam: true, mutationIndexConst: true,
  mutationIndexExpression: true, oldValuesWitnessParam: true, oldValuesWitnessDomain: true,
  sourceOrderIndexParam: true, inputCountParam: true, outputCountParam: true, condition: true,
  iterationCondition: true, iterationBreakCondition: true, iterationBound: true,
  iterationExactBound: true, iterationStep: true, op: true,
} satisfies Record<keyof SortedUpsertLoopAbi, true>);

const hasOnlyKnownDescriptorFields = (access: SortedUpsertLoopAbi): boolean =>
  Object.keys(access).every((field) => field in sortedUpsertLoopAbiFields || field === 'iterationCounter');

const journalParameterFields = new Set([
  'varyingArrayParam', 'predicateArrayParam', 'valueArrayParam', 'valueArrayIndexParam', 'valueScalarParam',
  'valueTraceWitnessParam', 'prefixCountWitnessParam', 'mutationValueArrayParam',
  'mutationValueArrayIndexParam', 'mutationValueScalarParam', 'mutationIndexArrayParam',
  'mutationIndexArrayIndexParam', 'mutationIndexScalarParam', 'oldValuesWitnessParam',
  'sourceOrderIndexParam', 'inputCountParam', 'outputCountParam',
]);

const journalLocalFields = new Set(['valueRuntimeLocal', 'valueTraceLocal']);
const unsupportedNamedJournalFields = new Set([
  'stateVarName', 'stateArrayName', 'expressionLabel', 'name', 'parameters', 'statements',
]);
const nonSemanticJournalFields = new Set(['canonical']);

/**
 * Alpha-normalize a completed journal descriptor. Public and compiler operands become ABI ordinals; local
 * spellings become typed roles. Descriptor forms which still expose a state/helper spelling are not guessed at:
 * they receive no authority until their semantic producer publishes an ordinal of its own.
 */
const canonicalJournalValue = (
  value: unknown,
  key: string | undefined,
  parameterOrdinal: (name: string) => number | undefined,
): unknown | undefined => {
  if (value === undefined) return null;
  if (key === 'collection' || key === 'fixedKeyParams' || key === 'iterationCounter') return null;
  if (nonSemanticJournalFields.has(key ?? '')) return null;
  if (journalParameterFields.has(key ?? '')) {
    if (typeof value !== 'string') return undefined;
    const ordinal = parameterOrdinal(value);
    return ordinal === undefined ? undefined : ['parameter', ordinal];
  }
  if (journalLocalFields.has(key ?? '')) return typeof value === 'string' ? ['local-role', key] : undefined;
  if (unsupportedNamedJournalFields.has(key ?? '')) return undefined;
  if (Array.isArray(value)) {
    const normalized = value.map((entry) => canonicalJournalValue(entry, undefined, parameterOrdinal));
    return normalized.some((entry) => entry === undefined) ? undefined : normalized;
  }
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    if (object.kind === 'param') {
      if (typeof object.paramName !== 'string') return undefined;
      const ordinal = parameterOrdinal(object.paramName);
      if (ordinal === undefined) return undefined;
      const normalized: Record<string, unknown> = { kind: 'param', parameterOrdinal: ordinal };
      for (const nestedKey of Object.keys(object).sort()) {
        if (nestedKey === 'kind' || nestedKey === 'paramName' || nonSemanticJournalFields.has(nestedKey)) continue;
        const nested = canonicalJournalValue(object[nestedKey], nestedKey, parameterOrdinal);
        if (nested === undefined) return undefined;
        normalized[nestedKey] = nested;
      }
      return normalized;
    }
    const normalized: Record<string, unknown> = {};
    for (const nestedKey of Object.keys(object).sort()) {
      if (nonSemanticJournalFields.has(nestedKey)) continue;
      const nested = canonicalJournalValue(object[nestedKey], nestedKey, parameterOrdinal);
      if (nested === undefined) return undefined;
      normalized[nestedKey] = nested;
    }
    return normalized;
  }
  return value;
};

const genericJournalStreamDigest = (
  access: SortedUpsertLoopAbi,
  completedFunction: AbiFunction,
): string | undefined => {
  if (!hasOnlyKnownDescriptorFields(access) || !/^[0-9a-f]{40}$/i.test(access.collectionHash)) return undefined;
  const parameterOrdinal = (name: string): number | undefined => {
    const matches = completedFunction.inputs
      .map((input, ordinal) => input.name === name ? ordinal : -1).filter((ordinal) => ordinal >= 0);
    return matches.length === 1 ? matches[0] : undefined;
  };
  const normalized: Record<string, unknown> = { collectionHash: access.collectionHash.toLowerCase() };
  for (const key of Object.keys(access).sort()) {
    if (key === 'collectionHash' || key === 'collection' || key === 'fixedKeyParams'
      || key === 'iterationCounter') continue;
    const raw = (access as unknown as Record<string, unknown>)[key];
    // AST-backed descriptors can retain own-properties whose value is undefined while their serialized ABI
    // counterpart omits those fields. Both mean the same absent semantic property.
    if (raw === undefined) continue;
    const value = canonicalJournalValue(raw, key, parameterOrdinal);
    if (value === undefined) return undefined;
    normalized[key] = value;
  }
  return digest(['kernel-journal-stream-disposition-v1', normalized]);
};

/**
 * Produce one coherent handler disposition from completed ABI facts. A carrier scope must match its exact
 * completed authorization; ordinary journal streams remain eager, and handlers without streams are neutral.
 */
export function deriveKernelJournalDispositionHandlerScope(
  completedFunction: AbiFunction | undefined,
  carrierScope?: KernelReadCarrierFamilyScope,
): KernelJournalDispositionHandlerScope | undefined {
  const selectorHex = completedFunction?.selector?.toLowerCase();
  if (!completedFunction || !selectorHex || !/^[0-9a-f]{8}$/.test(selectorHex)) return undefined;
  const accesses = completedFunction.sortedUpsertLoopInfo ?? [];
  const mode: KernelJournalDisposition = carrierScope ? 'carrier'
    : accesses.length > 0 ? 'eager-journal' : 'neutral';
  if (carrierScope && (carrierScope.selectorHex.toLowerCase() !== selectorHex
    || carrierScope.streamDescriptorDigests.length !== accesses.length)) return undefined;
  const streams: KernelJournalDispositionStreamScope[] = [];
  const seen = new Set<number>();
  for (const [ordinal, access] of accesses.entries()) {
    if (access.journalAccessStreamIndex !== ordinal || seen.has(ordinal)) return undefined;
    seen.add(ordinal);
    const descriptorDigest = carrierScope?.streamDescriptorDigests[ordinal]
      ?? genericJournalStreamDigest(access, completedFunction);
    if (!descriptorDigest || !/^[0-9a-f]{64}$/.test(descriptorDigest)) return undefined;
    streams.push(Object.freeze({
      journalAccessStreamIndex: ordinal, descriptorDigest, disposition: mode,
    }));
  }
  const completedDescriptorDigest = carrierScope?.completedDescriptorDigest ?? digest([
    'kernel-journal-handler-disposition-v1', selectorHex,
    mode, streams.map((stream) => stream.descriptorDigest),
  ]);
  if (!/^[0-9a-f]{64}$/.test(completedDescriptorDigest)) return undefined;
  return Object.freeze({
    selectorHex, completedDescriptorDigest, mode, streams: Object.freeze(streams),
  });
}

const canonicalCompletedType = (
  spelling: string | undefined,
  fn: FunctionDefinitionNode,
  collections: readonly CollectionNode[],
): string | undefined => {
  if (!spelling) return undefined;
  const candidates = [
    ...fn.parameters.map((parameter) => parameter.type),
    ...collections.flatMap((collection) => [...collection.allKeyTypes, collection.innermostValueType]),
  ];
  const resolved = candidates.find((type) => type.toString() === spelling);
  if (resolved) return abiTypeString(resolved);
  return /^(?:u?int\d*|bigint|bool|bytes(?:[1-9]|[12]\d|3[0-2])?|address)$/.test(spelling)
    ? spelling : undefined;
};

const canonicalCompletedExpression = (
  expression: ExternalCallExpression | undefined,
  fn: FunctionDefinitionNode,
  collections: readonly CollectionNode[],
): unknown | undefined => {
  if (!expression) return undefined;
  if (expression.kind === 'source') {
    if (expression.source?.kind === 'loopIndex') return ['counter'];
    if (expression.source?.kind === 'forward' && expression.source.paramIndex !== undefined) {
      return ['parameter', expression.source.paramIndex];
    }
    return undefined;
  }
  if (expression.kind === 'literal') {
    if (expression.type === 'bool') return ['boolean', expression.value];
    return ['integer', String(expression.value)];
  }
  if (expression.kind === 'cast' && expression.expression) {
    const inner = canonicalCompletedExpression(expression.expression, fn, collections);
    const type = canonicalCompletedType(expression.type, fn, collections);
    return inner === undefined || type === undefined ? undefined : ['cast', type, inner];
  }
  if (expression.kind === 'unary' && expression.expression) {
    const inner = canonicalCompletedExpression(expression.expression, fn, collections);
    return inner === undefined ? undefined : ['unary', expression.operator, inner];
  }
  if (expression.kind === 'binary' && expression.left && expression.right) {
    const left = canonicalCompletedExpression(expression.left, fn, collections);
    const right = canonicalCompletedExpression(expression.right, fn, collections);
    return left === undefined || right === undefined ? undefined : ['binary', expression.operator, left, right];
  }
  if (expression.kind === 'arrayAccess' && expression.left && expression.right) {
    const array = canonicalCompletedExpression(expression.left, fn, collections);
    const index = canonicalCompletedExpression(expression.right, fn, collections);
    return array === undefined || index === undefined ? undefined : ['array', array, index];
  }
  if (expression.kind === 'tupleIndex' && expression.expression && expression.resultIndex !== undefined) {
    const tuple = canonicalCompletedExpression(expression.expression, fn, collections);
    return tuple === undefined ? undefined : ['tuple-index', expression.resultIndex, tuple];
  }
  return undefined;
};

const canonicalFixedKey = (
  source: NonNullable<SortedUpsertLoopAbi['fixedKeySources']>[number],
  fn: FunctionDefinitionNode,
): unknown | undefined => {
  if (source.kind === 'param' && source.paramName) {
    const index = fn.parameters.findIndex((parameter) => parameter.name === source.paramName);
    return index < 0 ? undefined : ['parameter', index];
  }
  if (source.kind === 'constant' && source.constantValue !== undefined) {
    return ['integer', source.constantValue];
  }
  if (source.kind === 'msgSender') return ['sender', source.senderOp ?? 'msg.sender'];
  return undefined;
};

const canonicalCompletedKey = (
  access: SortedUpsertLoopAbi,
  fn: FunctionDefinitionNode,
  collections: readonly CollectionNode[],
  keyArity: number,
): unknown[] | undefined => {
  if (access.varyingKeyExpressions) {
    const keys = access.varyingKeyExpressions.map((expression) =>
      canonicalCompletedExpression(expression, fn, collections));
    return keys.length === keyArity && keys.every((key) => key !== undefined) ? keys : undefined;
  }
  const fixed = (access.fixedKeySources ?? []).map((source) => canonicalFixedKey(source, fn));
  if (fixed.some((key) => key === undefined)) return undefined;
  const varyingIndices = access.varyingKeyIndices ?? [keyArity - 1];
  const keys: unknown[] = [];
  let fixedIndex = 0;
  for (let index = 0; index < keyArity; index += 1) {
    keys.push(varyingIndices.includes(index) ? ['counter'] : fixed[fixedIndex++]);
  }
  return fixedIndex === fixed.length && keys.every((key) => key !== undefined) ? keys : undefined;
};

const canonicalValueRecipe = (
  access: SortedUpsertLoopAbi,
  read: SortedUpsertLoopAbi,
  fn: FunctionDefinitionNode,
): unknown => {
  const parameterOrdinal = (name: string | undefined): number | undefined => name === undefined
    ? undefined : fn.parameters.findIndex((parameter) => parameter.name === name);
  return {
    carrierWitness: access.valueArrayParam === read.oldValuesWitnessParam,
    carrierIndex: access.valueArrayIndexParam === read.varyingArrayParam,
    scalarParameterOrdinal: parameterOrdinal(access.valueScalarParam),
    valueConst: access.valueConst,
    valueOffset: access.valueArrayOffset,
    runtimeExpression: access.valueRuntimeExpression === true,
    runtimeLocal: access.valueRuntimeLocal !== undefined,
    mutation: access.mutation,
    mutationValueArrayParameterOrdinal: parameterOrdinal(access.mutationValueArrayParam),
    mutationValueArrayIndex: access.mutationValueArrayIndexParam !== undefined,
    mutationValueScalarParameterOrdinal: parameterOrdinal(access.mutationValueScalarParam),
    mutationValueConst: access.mutationValueConst,
    mutationIndexArrayParameterOrdinal: parameterOrdinal(access.mutationIndexArrayParam),
    mutationIndexArrayIndex: access.mutationIndexArrayIndexParam !== undefined,
    mutationIndexScalarParameterOrdinal: parameterOrdinal(access.mutationIndexScalarParam),
    mutationIndexConst: access.mutationIndexConst,
    valueTrace: access.valueTraceWitnessParam !== undefined,
    prefixCount: access.prefixCountWitnessParam !== undefined,
  };
};

const canonicalCompletedDescriptor = (
  accesses: readonly SortedUpsertLoopAbi[],
  read: SortedUpsertLoopAbi,
  fn: FunctionDefinitionNode,
  collections: readonly CollectionNode[],
  keyArity: number,
): readonly unknown[] | undefined => {
  const streams = accesses.map((access) => {
    const ordinal = collectionOrdinal(access.collection, collections);
    const key = canonicalCompletedKey(access, fn, collections, keyArity);
    const conditions = [access.condition, access.iterationCondition, access.iterationBreakCondition,
      access.iterationBound, access.iterationStep].map((expression) => expression === undefined
      ? null : canonicalCompletedExpression(expression, fn, collections));
    if (ordinal < 0 || !key || conditions.some((condition, index) => condition === undefined
      && [access.condition, access.iterationCondition, access.iterationBreakCondition,
        access.iterationBound, access.iterationStep][index] !== undefined)) return undefined;
    return {
      collectionOrdinal: ordinal,
      collectionHash: access.collectionHash,
      op: access.op,
      executionGroup: access.journalExecutionGroup,
      accessStreamIndex: access.journalAccessStreamIndex,
      permutationParameterOrdinal: fn.parameters.findIndex((parameter) =>
        parameter.name === access.varyingArrayParam),
      settlementIdentity: access.settlementIdentity,
      key,
      value: canonicalValueRecipe(access, read, fn),
      conditions,
      selection: {
        predicateArrayParameterOrdinal: access.predicateArrayParam === undefined
          ? undefined : fn.parameters.findIndex((parameter) => parameter.name === access.predicateArrayParam),
        predicateEquals: access.predicateEquals,
        selectedSource: access.oldValuesWitnessDomain === 'selected-source',
        sourceOrderIndex: access.sourceOrderIndexParam !== undefined,
      },
      exactBound: access.iterationExactBound === true,
      countParameters: {
        input: access.inputCountParam !== undefined,
        output: access.outputCountParam !== undefined,
        sharedInputWithRead: access.inputCountParam !== undefined
          && access.inputCountParam === read.inputCountParam,
        sharedOutputWithRead: access.outputCountParam !== undefined
          && access.outputCountParam === read.outputCountParam,
      },
    };
  });
  return streams.some((stream) => stream === undefined) ? undefined : streams as readonly unknown[];
};

const exactSettlement = (access: SortedUpsertLoopAbi, mutation: boolean): boolean =>
  access.settlementIdentity?.accessStreamIndex === access.journalAccessStreamIndex
  && access.settlementIdentity.accessOrdinalSource === 'access-program-order'
  && access.settlementIdentity.recordOrdinalScope === 'global-journal'
  && sameJson(access.settlementIdentity.recordOrdinalSources,
    ['target-record-ordinal', 'predecessor-record-ordinal'])
  && access.settlementIdentity.settlementRole === (mutation ? 'mutation-settlement' : 'carrier-only')
  && access.settlementIdentity.settlementOwnership === (mutation ? 'last-mutating-access' : 'none')
  && access.settlementIdentity.recordDispositionSource
    === (mutation ? 'mutation-settlement' : 'authenticated-carrier');

const exactUnconditionalDomain = (access: SortedUpsertLoopAbi): boolean =>
  access.condition === undefined && access.iterationCondition === undefined
  && access.iterationBreakCondition === undefined && access.iterationBound === undefined
  && access.iterationStep === undefined && access.iterationExactBound !== true
  && access.predicateArrayParam === undefined && access.predicateEquals === undefined
  && access.sourceOrderIndexParam === undefined && access.inputCountParam === undefined
  && access.outputCountParam === undefined;

const exactCarrierValue = (access: SortedUpsertLoopAbi, read: SortedUpsertLoopAbi): boolean =>
  access.valueArrayParam === read.oldValuesWitnessParam
  && (access.op === 'read' ? access.valueArrayIndexParam === undefined
    : access.valueArrayIndexParam === read.varyingArrayParam)
  && access.valueScalarParam === undefined && access.valueConst === undefined
  && access.valueArrayOffset === undefined && access.valueRuntimeLocal === undefined
  && access.valueRuntimeExpression !== true && access.mutation === undefined
  && access.mutationValueArrayParam === undefined && access.mutationValueArrayIndexParam === undefined
  && access.mutationValueScalarParam === undefined && access.mutationValueConst === undefined
  && access.mutationValueExpression === undefined && access.mutationIndexArrayParam === undefined
  && access.mutationIndexArrayIndexParam === undefined && access.mutationIndexScalarParam === undefined
  && access.mutationIndexConst === undefined && access.mutationIndexExpression === undefined
  && access.valueTraceWitnessParam === undefined && access.valueTraceLocal === undefined
  && access.valueTraceInitial === undefined && access.valueTraceUpdates === undefined
  && access.valueTraceAfterUpdates === undefined && access.prefixCountWitnessParam === undefined
  && access.prefixCountCondition === undefined;

/**
 * This carrier family has no selection, structural mutation, constructed-key replay, or ABI-blob decode phase.
 * List every optional protocol field explicitly so a descriptor cannot gain authority merely because a new
 * producer and consumer happen to agree on an unsupported bit of metadata.
 */
const exactCarrierProtocolShape = (access: SortedUpsertLoopAbi): boolean =>
  access.constructedKeyReplay !== true
  && access.multiArmConstructedKeyReplay !== true
  && access.crossArrayKeyReplay !== true
  && access.nestedHelperReturnReplay !== true
  && access.sameIterationMutableSelectionReplay !== true
  && access.keyDecodeTupleIndex === undefined && access.keyDecodeTupleTypes === undefined
  && access.predicateArrayParam === undefined && access.predicateEquals === undefined
  && access.oldValuesWitnessDomain === undefined && access.sourceOrderIndexParam === undefined
  && access.inputCountParam === undefined && access.outputCountParam === undefined
  && access.condition === undefined && access.iterationCondition === undefined
  && access.iterationBreakCondition === undefined && access.iterationBound === undefined
  && access.iterationExactBound !== true && access.iterationStep === undefined
  // The compiler's pre-artifact descriptor has this internal field even though the public ABI intentionally
  // omits it. This family derives its counter from runtimeCounterLoopCounters, so a second descriptor is drift.
  && (access as SortedUpsertLoopAbi & { iterationCounter?: unknown }).iterationCounter === undefined;

const expectedCollectionHash = (collection: CollectionNode | undefined): string | undefined => collection
  ? binToHex(computeCollectionHash(computeCollectionSignature(collection.name, collection.type.toString())))
  : undefined;

const exactFixedKeyMetadata = (access: SortedUpsertLoopAbi): boolean => {
  const sources = access.fixedKeySources ?? [];
  const expectedParams = sources.flatMap((source) => source.kind === 'param' && source.paramName
    ? [source.paramName] : []);
  return sameJson(access.fixedKeyParams, expectedParams)
    && sources.every((source) => source.kind === 'param' || source.kind === 'constant'
      || source.kind === 'msgSender');
};

const canonicalSourceAbi = (
  fn: FunctionDefinitionNode, selectorOverride?: string,
): { selector: string; inputTypes: readonly string[] } | undefined => {
  const count = fn.messageBusKernelReadCarrierSourceParameterCount;
  if (!Number.isSafeInteger(count) || count! < 0 || count! > fn.parameters.length) return undefined;
  const inputTypes = fn.parameters.slice(0, count).map((parameter) => abiTypeString(parameter.type));
  const selector = selectorOverride
    ?? binToHex(computeFunctionSelector(computeFunctionSignature(fn.name, inputTypes)));
  if (!/^[0-9a-f]{8}$/.test(selector)) return undefined;
  return { selector, inputTypes };
};

/**
 * Second pass: confirm completed codegen descriptors still express exactly the source-owned carrier family.
 * This returns private authority, not admission: the compiler's separate release flag remains the final gate.
 */
export function authorizeKernelReadCarrier(
  fn: FunctionDefinitionNode,
  completedFunction: AbiFunction | undefined,
  collections: readonly CollectionNode[],
  sourceSelectorOverride?: string,
): KernelReadCarrierAuthorization | undefined {
  const plan = fn.messageBusKernelReadCarrierDiscovery;
  if (!plan || !completedFunction) return undefined;
  const sourceAbi = canonicalSourceAbi(fn, sourceSelectorOverride);
  if (!sourceAbi || completedFunction.selector !== sourceAbi.selector
    || completedFunction.inputs.length < sourceAbi.inputTypes.length
    || !sameJson(completedFunction.inputs.slice(0, sourceAbi.inputTypes.length).map((input) => input.type),
      sourceAbi.inputTypes)) return undefined;
  const accesses = completedFunction.sortedUpsertLoopInfo ?? [];
  if (!accesses.every(hasOnlyKnownDescriptorFields)) return undefined;
  const reads = accesses.filter((access) => access.op === 'read');
  const mutations = accesses.filter((access) => access.op !== 'read');
  if (reads.length !== 1 || mutations.length !== plan.destinationCollectionOrdinals.length) return undefined;
  const read = reads[0];
  const readOrdinal = collectionOrdinal(read.collection, collections);
  const mutationOrdinals = mutations.map((mutation) => collectionOrdinal(mutation.collection, collections));
  if (readOrdinal !== plan.sourceCollectionOrdinal
    || !sameJson(mutationOrdinals, plan.destinationCollectionOrdinals)
    || !read.oldValuesWitnessParam || read.valueArrayParam !== read.oldValuesWitnessParam
    || read.oldValuesWitnessDomain === 'selected-source'
    || !Number.isSafeInteger(read.journalExecutionGroup) || read.journalExecutionGroup! < 0
    || read.journalAccessStreamIndex !== 0 || !exactSettlement(read, false)
    || !exactUnconditionalDomain(read) || !exactCarrierValue(read, read)
    || !exactCarrierProtocolShape(read) || !exactFixedKeyMetadata(read)) return undefined;
  const readCollection = collections[readOrdinal];
  if (!readCollection || abiTypeString(readCollection.innermostValueType) !== plan.valueType
    || readCollection.allKeyTypes.length !== plan.keyArity
    || read.collectionHash !== expectedCollectionHash(readCollection)) return undefined;
  const completedCounter = fn.runtimeCounterLoopCounters?.get(read.varyingArrayParam);
  const sourceLoop = JSON.parse(plan.loopShape) as unknown[];
  const sourceBound = sourceLoop[3];
  if (!completedCounter || completedCounter.initialValue !== 0n || completedCounter.stepValue !== 1n
    || completedCounter.stepExpression !== undefined
    || !sameJson(sourceLoop.slice(0, 3), ['pre-test', '<', ['integer', '0']])
    || !Array.isArray(sourceBound) || sourceBound[0] !== 'parameter'
    || !Number.isSafeInteger(sourceBound[1])
    || completedCounter.boundParameterOrdinal !== sourceBound[1]
    || !sameJson(sourceLoop.at(-1), ['integer', '1'])) return undefined;
  const sourceParameterCount = fn.messageBusKernelReadCarrierSourceParameterCount!;
  if ((sourceBound[1] as number) < 0 || (sourceBound[1] as number) >= sourceParameterCount) return undefined;
  const permutationOrdinals = accesses.map((access) => fn.parameters.findIndex((parameter) =>
    parameter.name === access.varyingArrayParam));
  const roles = fn.messageBusKernelReadCarrierSyntheticParameterRoles;
  const completedOperandMatches = (name: string): boolean => {
    const parameter = fn.parameters.find((candidate) => candidate.name === name);
    const input = completedFunction.inputs.find((candidate) => candidate.name === name);
    return parameter !== undefined && input?.type === abiTypeString(parameter.type);
  };
  if (permutationOrdinals.some((ordinal) => ordinal < sourceParameterCount)
    || new Set(permutationOrdinals).size !== 1
    || roles?.get(read.varyingArrayParam) !== 'counter-permutation'
    || roles?.get(read.oldValuesWitnessParam!) !== 'old-values-witness'
    || !completedOperandMatches(read.varyingArrayParam)
    || !completedOperandMatches(read.oldValuesWitnessParam!)
    || fn.parameters.findIndex((parameter) => parameter.name === read.oldValuesWitnessParam)
      < sourceParameterCount) return undefined;
  const distinctCollections = new Set([read.collectionHash, ...mutations.map((mutation) => mutation.collectionHash)]);
  if (distinctCollections.size !== mutations.length + 1) return undefined;
  // Dense carrier settlement is address-wide. Any eager/fixed/classic stream touching one of these collection
  // covenants would bypass the final carrier census even though its local read/set descriptors look consistent.
  const selectedCollections = new Set([
    collections[plan.sourceCollectionOrdinal]?.name,
    ...plan.destinationCollectionOrdinals.map((ordinal) => collections[ordinal]?.name),
  ].filter((name): name is string => name !== undefined));
  // Generated physical clones retain the structural `entryAccesses` for the same counter-loop nodes after
  // publishing their specialized journal descriptors. Those are not a second eager path. Account for exactly
  // one structural loop entry per authenticated stream; any fixed access or surplus loop access still proves a
  // competing settlement path and fails closed.
  const journalAccessCountByCollection = new Map<string, number>();
  for (const access of accesses) {
    journalAccessCountByCollection.set(
      access.collection, (journalAccessCountByCollection.get(access.collection) ?? 0) + 1,
    );
  }
  const structuralLoopCountByCollection = new Map<string, number>();
  const isStructuralLoopAccess = (
    entry: NonNullable<AbiFunction['entryAccesses']>[number],
  ): boolean => (entry as typeof entry & { inLoop?: boolean }).inLoop === true;
  for (const entry of completedFunction.entryAccesses ?? []) {
    if (!isStructuralLoopAccess(entry) || !selectedCollections.has(entry.collection)) continue;
    structuralLoopCountByCollection.set(
      entry.collection, (structuralLoopCountByCollection.get(entry.collection) ?? 0) + 1,
    );
  }
  const hasEagerCollision = completedFunction.entryAccesses?.some((entry) =>
    selectedCollections.has(entry.collection) && !isStructuralLoopAccess(entry)) === true
    || [...structuralLoopCountByCollection].some(([collection, count]) =>
      count > (journalAccessCountByCollection.get(collection) ?? 0))
    || completedFunction.entryLoopWrites?.some((collection) => selectedCollections.has(collection)) === true
    || completedFunction.sortedInsertLoops?.some((collection) => selectedCollections.has(collection)) === true
    || completedFunction.sortedInsertLoopInfo?.some((entry) => selectedCollections.has(entry.collection)) === true
    || completedFunction.sortedBatchInfo?.some((entry) => selectedCollections.has(entry.collection)) === true
    || completedFunction.collectionIterations?.some((entry) => selectedCollections.has(entry.collection)) === true;
  if (hasEagerCollision) return undefined;
  const valid = mutations.every((mutation, index) => {
    const collection = collections[mutationOrdinals[index]];
    return mutation.op === 'set'
      && mutation.journalAccessStreamIndex === index + 1
      && exactSettlement(mutation, true)
      && exactUnconditionalDomain(mutation)
      && exactCarrierValue(mutation, read)
      && exactCarrierProtocolShape(mutation)
      && exactFixedKeyMetadata(mutation)
      && mutation.collectionHash === expectedCollectionHash(collection)
      && Number.isSafeInteger(mutation.journalExecutionGroup)
      && mutation.journalExecutionGroup === read.journalExecutionGroup
      && mutation.varyingArrayParam === read.varyingArrayParam
      && mutation.valueArrayParam === read.oldValuesWitnessParam
      && mutation.valueArrayIndexParam === read.varyingArrayParam
      && mutation.valueRuntimeLocal === undefined && mutation.mutation === undefined
      && mutation.valueRuntimeExpression !== true
      && abiTypeString(collection?.innermostValueType) === plan.valueType
      && collection.allKeyTypes.length === plan.keyArity
      && sameJson(read.fixedKeySources, mutation.fixedKeySources)
      && sameJson(read.varyingKeyIndices, mutation.varyingKeyIndices)
      && sameJson(read.varyingKeyExpressions, mutation.varyingKeyExpressions)
      && sameJson(read.keyDecodeTupleIndex, mutation.keyDecodeTupleIndex)
      && sameJson(read.keyDecodeTupleTypes, mutation.keyDecodeTupleTypes)
      && sameJson(read.condition, mutation.condition)
      && sameJson(read.iterationCondition, mutation.iterationCondition)
      && sameJson(read.iterationBound, mutation.iterationBound)
      && sameJson(read.iterationStep, mutation.iterationStep)
      && sameJson(read.sourceOrderIndexParam, mutation.sourceOrderIndexParam);
  });
  if (!valid) return undefined;
  const completedKeys = accesses.map((access) =>
    canonicalCompletedKey(access, fn, collections, plan.keyArity));
  if (completedKeys.some((key) => key === undefined)
    || completedKeys.some((key) => JSON.stringify(key) !== plan.keyShape)) return undefined;
  const completedDescriptor = canonicalCompletedDescriptor(
    accesses, read, fn, collections, plan.keyArity,
  );
  if (!completedDescriptor) return undefined;
  const streamDescriptorDigests = completedDescriptor.map((stream, streamIndex) =>
    digest(['kernel-read-carrier-stream-v1', sourceAbi.selector, streamIndex, stream]));
  const completedDescriptorDigest = digest([
    'kernel-read-carrier-completed-v1',
    { handlerSelector: sourceAbi.selector, visibleInputTypes: sourceAbi.inputTypes },
    streamDescriptorDigests,
  ]);
  return new KernelReadCarrierAuthorization(
    digest(['kernel-read-carrier-authorization-v1', plan.digest, completedDescriptorDigest]),
    plan.digest,
    sourceAbi.selector,
    Object.freeze(streamDescriptorDigests),
    completedDescriptorDigest,
  );
}

/**
 * Recompute late authority for the current completed pass. A cloned verdict is never evidence: clear it before
 * validating this pass's descriptors, and leave it absent on every mismatch.
 */
export function refreshKernelReadCarrierAuthorization(
  fn: FunctionDefinitionNode,
  completedFunction: AbiFunction | undefined,
  collections: readonly CollectionNode[],
  sourceSelectorOverride?: string,
): KernelReadCarrierAuthorization | undefined {
  fn.messageBusKernelReadCarrierAuthorization = undefined;
  const authorization = authorizeKernelReadCarrier(
    fn, completedFunction, collections, sourceSelectorOverride,
  );
  if (authorization) fn.messageBusKernelReadCarrierAuthorization = authorization;
  return authorization;
}
