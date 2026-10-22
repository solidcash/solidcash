import {
  type AbiFunction, type Artifact, type CompilerOptions, type DebugInformation, type Script,
  scriptToAsm, type StateLayout, ArrayType,
  computeCollectionSignature, computeFunctionSelectorHex, type ExternalInterfaceInfo, MappingType, type Type,
  EnumType, StructType, type ExternalLibraryAbi, BUILTIN_LIBRARIES, resolveLibraries, sidecarCodeRange, isChunkableValueType,
  type ValueProvenance, type ValueProvenanceKind, type DynamicWriteGrowthAbi, ValueType,
  AddressType,
  abiTypeString, type ChildDeploymentValueRecipe, type FixedBchTransferAbi, type ExternalResultConsumerAbi,
  canonicalSelectorType, isEvmNotationScalarType,
  type ComputeSideCarRecipesAbi,
  ATOMIC_MESSAGE_BUS_MAX_ROWS, computeErrorSignature, computeEventSignature,
} from '@solidcash/utils';
import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { version } from '../version.js';
import {
  type Ast, StateVariableVisibility, InterfaceNode, InterfaceCollectionNode, ExternalCallMode,
  StructDefinitionNode, FunctionDefinitionNode, FunctionModifier, Node, ContractNode,
  ExpressionNode, TransferStatementNode, AddressTransferStatementNode, AddressSendExpressionNode,
  BlockNode, WhileNode, VariableDefinitionNode,
  DoWhileNode, CollectionIterationNode,
  BinaryOpNode, IdentifierNode, AssignNode, TupleAssignmentNode, ArrayAssignNode, ReturnNode, IntLiteralNode,
  RevertNode,
  ArrayNode, NewArrayNode, CastNode, FunctionCallNode, LiteralNode, LowLevelCallNode,
  SliceNode,
  LowLevelCallStatementNode, StateAccessNode, RequireNode, ExternalFunctionCallNode,
  StateAssignNode, MappingAssignNode, MappingFieldAssignNode, StateArrayAssignNode, StateArrayPushNode,
  ArrayPushNode,
  MappingAccessNode, ArrayAccessNode, FieldAccessNode, type ExternalCallExpression, type ExternalCallArgSource,
  type ExternalCallStatement, EmitStatementNode, TernaryOpNode, TokenContainerMethodStatementNode,
  UnaryOpNode, NullaryOpNode, BranchNode, BoolLiteralNode,
  SwitchNode, TryCatchNode, InstantiationNode, UncheckedNode,
  type EntryAccessInfo, type EventDefinitionNode,
} from '../ast/AST.js';
import { emittedEventSignatures } from '../analysis/InvocationAnalysis.js';
import { BinaryOperator, NullaryOperator, UnaryOperator } from '../ast/Operator.js';
import { containsStatefulOperation } from '../semantic/EnsureFinalRequireTraversal.js';
import { fixedForMaximum } from '../semantic/FixedForLoop.js';
import { parameterCommitmentSource } from '../semantic/SymbolTableTraversal.js';
import { stateNftPackingLimit } from '../semantic/maxEncodedSize.js';
import { hasEffectiveCallValue, hasExternalCallValueEffect } from '../semantic/branchOps.js';
import { externalResultEncoding } from '../semantic/ExternalResultEncoding.js';
import {
  analyzeChildDeploymentRecipes, analyzeFixedBchEffectRecipes, childDeploymentValueRecipe,
} from '../deploymentRecipes.js';
import { computeExpressionSiteKey } from '../ast/Location.js';
import { GlobalFunction } from '../ast/Globals.js';

/** The mapping key type as the SDK must ENCODE it. An enum key is int-backed (the compiler stores/derives it as
 * its integer member value), so it encodes as 'bigint' - its VM representation - not the enum name. The enum
 * name is still surfaced in the ABI (function params); only the state-encoding key type is normalized. */
function keyEncodingTypeString(type: Type): string {
  if (type instanceof ValueType) return keyEncodingTypeString(type.underlyingType);
  return type instanceof EnumType ? 'bigint' : type.toString();
}

// Covenant-bypass / full-state modifiers: a function carrying one may touch any state, so treat as a writer.
const STATE_WRITING_MODIFIERS = [
  FunctionModifier.UPGRADE, FunctionModifier.SELFDESTRUCT, FunctionModifier.UNSAFE,
];

/** Multiply two reached-count factors, where undefined means "not proven" and poisons the product. */
const composeCount = (outer: number | undefined, inner: number | undefined): number | undefined =>
  outer === undefined || inner === undefined ? undefined : outer * inner;

const safeSourceEffectOrdinal = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Replay expressions are JSON-shaped; detach every nested node before publishing compiler metadata. */
const cloneExternalCallExpression = (expression: ExternalCallExpression): ExternalCallExpression =>
  JSON.parse(JSON.stringify(expression)) as ExternalCallExpression;

/** Source-call/outlined-call-edge witness for one signature65 recovery candidate. */
const reachedSignature65Recovery = (func: FunctionDefinitionNode, sourceSite: string): boolean => {
  const callsIn = (root: Node | undefined): FunctionCallNode[] => {
    if (!root) return [];
    const calls: FunctionCallNode[] = [];
    const visited = new Set<Node>();
    const walk = (node: Node): void => {
      if (visited.has(node)) return;
      visited.add(node);
      if (node instanceof FunctionCallNode) calls.push(node);
      for (const [key, value] of Object.entries(node)) {
        if (['resolvedFunction', 'functionReference', 'definition', 'symbolTable',
          'referencedContract', 'stateVariable', 'collection'].includes(key)) continue;
        if (value instanceof Node) walk(value);
        else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) walk(item);
      }
    };
    walk(root);
    return calls;
  };
  const wrapperCalls = callsIn(func.body).filter((call) => call.identifier.name === 'ECDSA.recover'
    && call.location && computeExpressionSiteKey(call.location) === sourceSite);
  if (wrapperCalls.length !== 1) return false;
  const wrapper = wrapperCalls[0];
  const helper = wrapper.resolvedFunction;
  if (!helper || wrapper.parameters.length !== 2 || helper.parameters.length !== 2
    || helper.parameters[0].type.toString() !== 'bytes32'
    || helper.parameters[1].type.toString() !== 'bytes'
    || !helper.modifiers.includes(FunctionModifier.PURE)
    || !helper.modifiers.includes(FunctionModifier.INTERNAL)) return false;
  const recoverBuiltins = new Set([GlobalFunction.ECRECOVER_PUBKEY,
    GlobalFunction.ECRECOVER_P2PKH, GlobalFunction.ECRECOVER_EVM]);
  const found: number[] = [];
  const reached = new Set<FunctionDefinitionNode>();
  let hasSignatureLength65 = false;
  let forwardingValid = true;
  const signatureAssignments = new Map<string, ExpressionNode[]>();
  const walkHelper = (current: FunctionDefinitionNode, base: number): void => {
    if (reached.has(current)) { forwardingValid = false; return; }
    reached.add(current);
    const visit = (node: Node, visited = new Set<Node>()): void => {
      if (visited.has(node)) return;
      visited.add(node);
      if (node instanceof IntLiteralNode && node.value === 65n) hasSignatureLength65 = true;
      if (node instanceof AssignNode && ['r', 's', 'v'].includes(node.identifier.name)) {
        const prior = signatureAssignments.get(node.identifier.name) ?? [];
        prior.push(node.expression);
        signatureAssignments.set(node.identifier.name, prior);
      }
      for (const [key, value] of Object.entries(node)) {
        if (['resolvedFunction', 'functionReference', 'definition', 'symbolTable',
          'referencedContract', 'stateVariable', 'collection'].includes(key)) continue;
        if (value instanceof Node) visit(value, visited);
        else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) visit(item, visited);
      }
    };
    visit(current.body);
    for (const call of callsIn(current.body)) {
      const ordinal = call.recoveryEffectOrdinal;
      if (!Number.isSafeInteger(ordinal) || ordinal! < 0) continue;
      const builtin = recoverBuiltins.has(call.identifier.name as GlobalFunction);
      const next = call.resolvedFunction;
      if (!builtin && (!next || (next.recoveryEffectCount ?? next.ecrecoverCallCount ?? 0) === 0)) continue;
      // Every reached helper must forward the digest unchanged in its first formal argument. For a four-arg
      // recovery call, the v/r/s locals must also be passed in that order; a same-name wrapper which hashes
      // again or swaps r/s is not an admitted signature65 candidate.
      if (!(call.parameters[0] instanceof IdentifierNode)
        || call.parameters[0].name !== current.parameters[0]?.name) forwardingValid = false;
      if (call.parameters.length === 4
        && !call.parameters.slice(1).every((arg, index) => arg instanceof IdentifierNode
          && arg.name === ['v', 'r', 's'][index])) forwardingValid = false;
      if (builtin) {
        found.push(base + ordinal!);
      } else if (next) {
        walkHelper(next, base + ordinal!);
      }
    }
  };
  const rootOrdinal = wrapper.recoveryEffectOrdinal;
  if (!Number.isSafeInteger(rootOrdinal) || rootOrdinal! < 0) return false;
  walkHelper(helper, rootOrdinal!);
  const unwrapped = (value: ExpressionNode): ExpressionNode => {
    let current = value;
    while (current instanceof CastNode
      || (current instanceof UnaryOpNode && current.operator === UnaryOperator.REVERSE)) {
      current = current.expression;
    }
    return current;
  };
  const copiedSignatureAlias = (name: string): boolean => {
    if (name === helper.parameters[1].name) return true;
    if (!name.startsWith(`__memb_${helper.parameters[1].name}_`)) return false;
    return [...reached].some((owner) => {
      const declared = (owner.body?.statements ?? []).some((statement) => statement instanceof VariableDefinitionNode
        && statement.name === name && statement.expression instanceof NewArrayNode
        && statement.expression.size instanceof UnaryOpNode
        && statement.expression.size.operator === UnaryOperator.SIZE
        && statement.expression.size.expression instanceof IdentifierNode
        && statement.expression.size.expression.name === helper.parameters[1].name);
      const copied = (owner.body?.statements ?? []).some((statement) => {
        if (!(statement instanceof WhileNode)) return false;
        return (statement.block?.statements ?? []).some((write) => {
          if (!(write instanceof ArrayAssignNode) || write.name !== name) return false;
          const value = unwrapped(write.value);
          return value instanceof ArrayAccessNode && value.array instanceof IdentifierNode
            && value.array.name === helper.parameters[1].name;
        });
      });
      return declared && copied;
    });
  };
  const signatureWord = (name: 'r' | 's', start: bigint, end: bigint): boolean => {
    const assignments = signatureAssignments.get(name);
    if (assignments?.length !== 1) return false;
    const value = unwrapped(assignments[0]);
    return value instanceof SliceNode && value.start instanceof IntLiteralNode
      && value.end instanceof IntLiteralNode && value.start.value === start && value.end.value === end
      && value.element instanceof IdentifierNode && copiedSignatureAlias(value.element.name);
  };
  const signatureV = (): boolean => {
    const assignments = signatureAssignments.get('v');
    if (assignments?.length !== 1) return false;
    const value = unwrapped(assignments[0]);
    return value instanceof ArrayAccessNode && value.index instanceof IntLiteralNode
      && value.index.value === 64n && value.array instanceof IdentifierNode
      && copiedSignatureAlias(value.array.name);
  };
  // The source wrapper must map to exactly the first and only physical A/B pair. A same-name but unrelated
  // helper or a repeated helper call cannot borrow this candidate. The VM still verifies the four decoded args.
  return forwardingValid && hasSignatureLength65 && found.length === 1 && found[0] === 0
    && func.ecrecoverCallCount === 1 && signatureWord('r', 0n, 32n)
    && signatureWord('s', 32n, 64n) && signatureV();
};

type ComputeOperand = ComputeSideCarRecipesAbi['keccak'][number];

/**
 * A sole recovery whose operands the body computes from its own unwritten visible arguments has no pre-call
 * predicate. Publish those operands (casts and `.reverse()` over arguments); the A/B covenant still binds the
 * replayed blob to the value the body computes.
 */
const bodyRecoveryRecipe = (
  func: FunctionDefinitionNode,
  replayable: (node: ComputeOperand | undefined) => node is ComputeOperand,
  typed: (node: ComputeOperand) => ComputeOperand,
): ComputeSideCarRecipesAbi | undefined => {
  if ((func.keccakPreimageParams?.length ?? 0) !== 0 || func.ecrecoverCallCount !== 1
    || (func.ecrecoverEvmCallCount ?? 0) !== 0) return undefined;
  const skipped = new Set(['resolvedFunction', 'functionReference', 'definition', 'symbolTable',
    'referencedContract', 'stateVariable', 'collection']);
  const recoveries: FunctionCallNode[] = [];
  const written = new Set<string>();
  const visited = new Set<Node>();
  const walk = (node: Node): void => {
    if (visited.has(node)) return;
    visited.add(node);
    if (node instanceof FunctionCallNode && (node.identifier.name === GlobalFunction.ECRECOVER_PUBKEY
      || node.identifier.name === GlobalFunction.ECRECOVER_P2PKH)) recoveries.push(node);
    if (node instanceof AssignNode) written.add(node.identifier.name);
    if (node instanceof ArrayAssignNode || node instanceof VariableDefinitionNode) written.add(node.name);
    if (node instanceof TupleAssignmentNode) {
      for (const element of node.elements) if (element.name) written.add(element.name);
    }
    for (const [key, value] of Object.entries(node)) {
      if (skipped.has(key)) continue;
      if (value instanceof Node) walk(value);
      else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) walk(item);
    }
  };
  walk(func.body);
  // Direct-argument recoveries already resolve from `ecrecoverArgParams`.
  if (recoveries.length !== 1 || recoveries[0].parameters.length !== 4
    || recoveries[0].parameters.every((parameter) => parameter instanceof IdentifierNode)) return undefined;
  const visible = func.parameters.filter((parameter) => !parameter.name.startsWith('__internal__'));
  const operand = (expression: ExpressionNode): ComputeOperand | undefined => {
    if (expression instanceof IdentifierNode) {
      const paramIndex = visible.findIndex((parameter) => parameter.name === expression.name);
      return paramIndex < 0 || written.has(expression.name) ? undefined
        : { kind: 'source', source: { kind: 'forward', paramIndex } };
    }
    if (expression instanceof CastNode) {
      const inner = operand(expression.expression);
      return inner && { kind: 'cast', type: expression.type.toString(), expression: inner };
    }
    if (expression instanceof UnaryOpNode && expression.operator === UnaryOperator.REVERSE) {
      const inner = operand(expression.expression);
      return inner && { kind: 'unary', operator: UnaryOperator.REVERSE, expression: inner };
    }
    return undefined;
  };
  const args = recoveries[0].parameters.map(operand);
  if (args.some((arg) => arg === undefined)) return undefined;
  const recipeArgs = (args as ComputeOperand[]).map(typed);
  if (!recipeArgs.every(replayable)) return undefined;
  return {
    version: 1,
    keccak: [],
    ecrecover: [{
      kind: 'args4', args: recipeArgs as [ComputeOperand, ComputeOperand, ComputeOperand, ComputeOperand],
    }],
  };
};

/**
 * Publish compute operands only when one source predicate carries the complete, unambiguous call family.
 * `preCallRequires` are compiler-serialized from source `require` statements at their actual program point and
 * their producerResult leaves are canonicalized by resultConsumers() before this runs. They are not SDK guesses.
 * The nested Keccak traversal is PRE-order: codegen reserves an ordinal before visiting the call's argument.
 */
const computeSideCarRecipesOf = (
  func: FunctionDefinitionNode, compilerOptions: CompilerOptions,
): ComputeSideCarRecipesAbi | undefined => {
  type ComputeExpression = ComputeSideCarRecipesAbi['keccak'][number];
  const packedEvm = compilerOptions.evmCompat;
  // eslint-disable-next-line max-len
  const packedInteger = /^u?int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?$/;
  const packedBytes = /^bytes(?:[1-9]|[12][0-9]|3[0-2])?$/;
  const supportedPackedType = (type: string): boolean => {
    if (packedInteger.test(type) || packedBytes.test(type) || type === 'bool' || type === 'string') return true;
    if (type === 'address' || type === 'address payable') return true;
    if (!packedEvm && type === 'bigint') return true;
    // EVM packed dynamic arrays omit the length but pad each scalar element to one ABI word. The codegen's
    // packed-array lowering does not admit fixed arrays or dynamic/composite elements.
    const array = packedEvm ? /^(.+)\[\]$/.exec(type) : undefined;
    return array !== undefined && array !== null && (packedInteger.test(array[1])
      || /^bytes(?:[1-9]|[12][0-9]|3[0-2])$/.test(array[1]) || array[1] === 'bool');
  };
  const keccakCount = func.keccakPreimageParams?.length ?? 0;
  const recoveryCount = func.ecrecoverCallCount ?? 0;
  if ((keccakCount === 0 && recoveryCount === 0) || func.keccakInLoop || func.ecrecoverLoopReads) {
    return undefined;
  }
  if (keccakCount > 0 && (func.keccakComputeSites?.length !== keccakCount
    || new Set(func.keccakComputeSites).size !== keccakCount)) return undefined;
  const replayable = (node: ComputeExpression | undefined): node is ComputeExpression => {
    if (!node) return false;
    if (node.kind === 'literal') return node.type !== undefined
      && (typeof node.value === 'string' || typeof node.value === 'boolean');
    if (node.kind === 'source') return node.source?.kind === 'forward'
      && Number.isSafeInteger(node.source.paramIndex) && node.source.paramIndex! >= 0;
    if (node.kind === 'producerResult') return Number.isSafeInteger(node.callsiteId)
      && node.callsiteId! >= 0 && Number.isSafeInteger(node.resultIndex)
      && node.resultIndex! >= 0;
    if (node.kind === 'cast') return node.type !== undefined
      && (packedInteger.test(node.type) || packedBytes.test(node.type)
        || ['bigint', 'bool', 'string', 'address', 'address payable'].includes(node.type))
      && replayable(node.expression);
    if (node.kind === 'abiEncodePacked') return node.args !== undefined
      && node.fields?.length === node.args.length
      && node.fields.every((type) => supportedPackedType(type))
      && node.args.every(replayable);
    if (node.kind === 'bytesConcat' || node.kind === 'abiEncode') {
      return node.args !== undefined && node.args.every(replayable);
    }
    if (node.kind === 'unary') return node.operator === UnaryOperator.REVERSE && replayable(node.expression);
    return node.kind === 'call' && node.name === 'keccak256'
      && node.args?.length === 1 && replayable(node.args[0]);
  };
  const visibleTypes = func.parameters.filter((parameter) => !parameter.name.startsWith('__internal__'))
    .map((parameter) => abiTypeString(parameter.type));
  // A packed operand naming a handler argument has no AST type before type checking: publish the argument's ABI
  // type so the recipe is self-describing. Copies, so the shared pre-call predicate is left as published.
  const typed = (node: ComputeExpression): ComputeExpression => {
    const args = node.args?.map(typed);
    const operandType = (operand: ComputeExpression): string => operand.type
      ?? (operand.kind === 'source' && operand.source?.kind === 'forward'
        ? visibleTypes[operand.source.paramIndex ?? -1] ?? '' : '');
    return {
      ...node,
      ...(node.expression && { expression: typed(node.expression) }),
      ...(args && { args }),
      ...(node.kind === 'abiEncodePacked' && args && node.fields
        && { fields: node.fields.map((field, index) => field || operandType(args[index])) }),
    };
  };
  const candidates: ComputeSideCarRecipesAbi[] = [];
  const seenPredicates = new Set<string>();
  for (const call of func.externalCalls ?? []) {
    for (const predicate of call.preCallRequires ?? []) {
      const key = JSON.stringify(predicate);
      if (seenPredicates.has(key)) continue;
      seenPredicates.add(key);
      const keccak: ComputeExpression[] = [];
      const keccakSites: string[] = [];
      const ecrecover: ComputeSideCarRecipesAbi['ecrecover'][number][] = [];
      const visit = (node: ComputeExpression): void => {
        if (node.kind === 'call' && node.name === 'keccak256' && node.args?.length === 1) {
          keccak.push(typed(node.args[0]));
          keccakSites.push(node.computeSourceSite ?? '');
        }
        if ((compilerOptions.evmCompat)
          && node.kind === 'call' && node.name === 'ECDSA.recover' && node.args?.length === 2
          && node.computeSourceSite && reachedSignature65Recovery(func, node.computeSourceSite)) {
          ecrecover.push({ kind: 'signature65', hash: typed(node.args[0]), signature: typed(node.args[1]) });
        }
        if (node.kind === 'call' && ['ecrecoverPubKey', 'ecrecoverP2pkh', 'ecrecoverEvm']
          .includes(node.name ?? '') && node.args?.length === 4) {
          ecrecover.push({ kind: 'args4', args: node.args.map(typed) as [ComputeExpression, ComputeExpression,
            ComputeExpression, ComputeExpression] });
        }
        for (const child of [node.expression, node.left, node.right, node.condition,
          node.ifTrue, node.ifFalse, ...(node.args ?? [])]) {
          if (child) visit(child);
        }
      };
      visit(predicate);
      if (keccak.length !== keccakCount || ecrecover.length !== recoveryCount
        || keccakSites.some((site, index) => !site || site !== func.keccakComputeSites?.[index])
        || !keccak.every(replayable)
        || !ecrecover.every((recipe) => recipe.kind === 'signature65'
          ? replayable(recipe.hash) && replayable(recipe.signature)
          : recipe.args.every(replayable))) continue;
      candidates.push({ version: 1, keccak, ecrecover });
    }
  }
  if (candidates.length === 0) return bodyRecoveryRecipe(func, replayable, typed);
  const first = JSON.stringify(candidates[0]);
  if (!candidates.every((candidate) => JSON.stringify(candidate) === first)) return undefined;
  return candidates[0];
};

/** Fail-closed artifact publication gate for compiler-owned source-effect identities. */
export const sourceEffectOrderForArtifact = (
  declared: FunctionDefinitionNode['sourceEffectOrder'],
  externalCalls: readonly { sourceEffectOrdinal?: number; batchInvocations?: readonly {
    sourceEffectOrdinal?: number;
  }[] }[],
  entryAccesses: readonly Pick<EntryAccessInfo, 'operations' | 'mutationEffectOrdinals'>[],
): FunctionDefinitionNode['sourceEffectOrder'] => {
  const complete = externalCalls.every((call) => safeSourceEffectOrdinal(call.sourceEffectOrdinal)
    && (!call.batchInvocations || call.batchInvocations.every(
      (row) => safeSourceEffectOrdinal(row.sourceEffectOrdinal),
    ))) && entryAccesses.filter((access) =>
    access.operations.includes('write') || access.operations.includes('delete'))
    .every((access) => access.mutationEffectOrdinals?.length
      && access.mutationEffectOrdinals.every(safeSourceEffectOrdinal));
  return declared === 'linear' && !complete ? undefined : declared;
};

/**
 * Link a rolled external-call loop to the ABI array it directly fills. This is deliberately structural: the SDK
 * may use the provisional parent return's authenticated array length as the reached occurrence count only when
 * the call result is written into that exact array and that exact array is returned.
 */
export const resultArrayOutputOf = (
  body: BlockNode | undefined, target: ExpressionNode | undefined,
): number | undefined => {
  if (!body || !target || !body.statements) return undefined;
  const containsTarget = (value: unknown, seen = new Set<object>()): boolean => {
    if (value === target) return true;
    if (!(value instanceof Node) || seen.has(value)) return false;
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
      if (['location', 'resolvedFunction', 'functionReference', 'definition', 'symbolTable',
        'referencedContract', 'stateVariable', 'collection'].includes(key)) continue;
      if (child instanceof Node && containsTarget(child, seen)) return true;
      if (Array.isArray(child) && child.some((item) => containsTarget(item, seen))) return true;
    }
    return false;
  };

  // A for-loop is desugared to adjacent `{ loopVariable; while (...) { ...; update; } }` statements. Require
  // the array assignment to be a direct statement of that loop: a nested if/switch would make the number of
  // reached calls smaller than the authenticated returned-array length.
  let assignment: ArrayAssignNode | undefined;
  let loop: WhileNode | undefined;
  let loopVariable: VariableDefinitionNode | undefined;
  for (const block of [body, ...body.statements.filter((statement): statement is BlockNode =>
    statement instanceof BlockNode)]) {
    const statements = block.statements ?? [];
    for (let index = 1; index < statements.length; index += 1) {
      const candidateLoop = statements[index];
      const candidateVariable = statements[index - 1];
      if (!(candidateLoop instanceof WhileNode) || !(candidateVariable instanceof VariableDefinitionNode)) continue;
      const directAssignments = (candidateLoop.block.statements ?? []).filter((statement): statement is ArrayAssignNode =>
        statement instanceof ArrayAssignNode && containsTarget(statement.value));
      if (directAssignments.length !== 1) continue;
      if (assignment) return undefined;
      [assignment] = directAssignments;
      loop = candidateLoop;
      loopVariable = candidateVariable;
    }
  }
  if (!assignment || !loop || !loopVariable
    || loopVariable.loopInitialValue !== 0n || loopVariable.loopStepValue !== 1n
    || !(assignment.index instanceof IdentifierNode) || assignment.index.name !== loopVariable.name
    || !(loop.condition instanceof BinaryOpNode) || loop.condition.operator !== BinaryOperator.LT
    || !(loop.condition.left instanceof IdentifierNode) || loop.condition.left.name !== loopVariable.name) {
    return undefined;
  }

  const resultName = assignment.name;
  const sameBound = (left: ExpressionNode, right: ExpressionNode): boolean =>
    left === right || (left instanceof IdentifierNode && right instanceof IdentifierNode && left.name === right.name)
    || (left instanceof LiteralNode && right instanceof LiteralNode && left.value === right.value);
  const declarations = body.statements.filter((statement): statement is VariableDefinitionNode =>
    statement instanceof VariableDefinitionNode && statement.name === resultName
      && statement.expression instanceof NewArrayNode
      && sameBound(statement.expression.size, loop!.condition instanceof BinaryOpNode
        ? loop!.condition.right : statement.expression.size));
  if (declarations.length !== 1) return undefined;

  let targetWrites = 0;
  let competingWrite = false;
  const auditWrites = (value: unknown, seen = new Set<object>()): void => {
    if (!(value instanceof Node) || seen.has(value)) return;
    seen.add(value);
    const named = value as unknown as { name?: string; identifier?: { name?: string } };
    if (value instanceof ArrayAssignNode && value.name === resultName) {
      if (containsTarget(value.value)) targetWrites += 1;
      else competingWrite = true;
    } else if (named.name === resultName
      && /^(ArrayPushNode|ArrayPopNode|ArrayDeleteNode)$/.test(value.constructor.name)) {
      competingWrite = true;
    } else if (value instanceof AssignNode && named.identifier?.name === resultName) {
      competingWrite = true;
    }
    for (const [key, child] of Object.entries(value)) {
      if (['location', 'resolvedFunction', 'functionReference', 'definition', 'symbolTable',
        'referencedContract', 'stateVariable', 'collection'].includes(key)) continue;
      if (child instanceof Node) auditWrites(child, seen);
      else if (Array.isArray(child)) for (const item of child) auditWrites(item, seen);
    }
  };
  auditWrites(body);
  if (targetWrites !== 1 || competingWrite) return undefined;
  const returns = body.statements.filter((statement): statement is ReturnNode => statement instanceof ReturnNode);
  if (returns.length !== 1 || body.statements.at(-1) !== returns[0]) return undefined;
  const output = returns[0].expressions.findIndex((expression) =>
    expression instanceof IdentifierNode && expression.name === resultName);
  return output < 0 ? undefined : output;
};

/**
 * True when a loop body can stop short of its trip count.
 *
 * `continue` is rewritten into a branch before this runs, so it is caught by the branch rule, but a `return`
 * inside a loop survives to artifact generation as a plain sibling of the callsite: without this check
 * `for (i < 3) { if (flag) { return; } m(); }` would publish a floor of three while reaching zero.
 */
const loopCanExitEarly = (loop: WhileNode): boolean => {
  let found = false;
  const seen = new Set<Node>();
  const nonExecutable = new Set([
    'location', 'definition', 'resolvedFunction', 'functionReference', 'symbolTable',
    'referencedContract', 'stateVariable', 'collection', 'sourceCallNode', 'sourceActivationConditions',
  ]);
  const walk = (value: unknown): void => {
    if (found || !(value instanceof Node) || seen.has(value)) return;
    seen.add(value);
    if (/^(ReturnNode|BreakNode|ContinueNode)$/.test(value.constructor.name)) {
      found = true;
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (nonExecutable.has(key)) continue;
      if (child instanceof Node) walk(child);
      else if (Array.isArray(child)) for (const item of child) walk(item);
    }
  };
  walk(loop.block);
  return found;
};

type OccurrenceInfo = {
  occurrence: 'once' | 'conditional' | 'loop';
  maximumOccurrences?: number;
  minimumOccurrences?: number;
  occurrenceBoundSource?: 'literal' | 'guard' | 'structural';
};

/**
 * Classify one callsite's reached-occurrence count inside its function.
 *
 * Two independent quantities are tracked down every path to the callsite. `reachedMaximum` is the product of
 * the trip counts of every enclosing loop and is the published CEILING; one unproven loop poisons it, and
 * nesting multiplies rather than replaces - an inner literal loop under an outer one reaches
 * `outer * inner` rows, not `inner`. `reachedExact` is the same product restricted to paths that cross no
 * branch at all, so it is a FLOOR as well as a ceiling: it survives only when every enclosing loop has a
 * compile-time trip count and nothing conditional stands between the function entry and the callsite.
 */
export const occurrenceInfoOf = (
  fn: FunctionDefinitionNode, target: Node | undefined,
): OccurrenceInfo => {
  if (!target) return { occurrence: 'once' };
  let found: 'once' | 'conditional' | 'loop' = 'once';
  let maximumOccurrences: number | undefined;
  let minimumOccurrences: number | undefined;
  let literalBound = false;
  const seen = new Set<object>();
  // Loops whose trip count the enclosing block already folded in, so the generic walk does not re-enter them.
  const counted = new Set<Node>();
  const visit = (
    value: unknown, context: 'once' | 'conditional' | 'loop',
    reachedMaximum: number | undefined, reachedExact: number | undefined,
  ): void => {
    if (!(value instanceof Node) || seen.has(value)) return;
    seen.add(value);
    if (value === target) {
      found = context;
      maximumOccurrences = context === 'loop' ? reachedMaximum : 1;
      minimumOccurrences = context === 'loop' ? reachedExact : undefined;
      // `once`/`conditional` carry their provenance in the class itself, so only a loop bound - which could
      // also have come from a require guard - spends artifact bytes recording where it came from.
      literalBound = context === 'loop' && reachedMaximum !== undefined;
      return;
    }
    if (value instanceof BlockNode) {
      const statements = value.statements ?? [];
      statements.forEach((statement, index) => {
        if (statement instanceof WhileNode) {
          const trips = fixedForMaximum(statements[index - 1], statement)
            ?? statement.compilerAuthenticatedMaximumIterations;
          counted.add(statement);
          const exactTrips = loopCanExitEarly(statement) ? undefined : trips;
          visit(statement, 'loop', composeCount(reachedMaximum, trips), composeCount(reachedExact, exactTrips));
        } else {
          visit(statement, context, reachedMaximum, reachedExact);
        }
      });
      return;
    }
    if (value instanceof TryCatchNode) {
      // Only the successful operation/body path exists on BCH; a script failure aborts before any catch body.
      visit(value.expression, context, reachedMaximum, reachedExact);
      visit(value.tryBlock, context, reachedMaximum, reachedExact);
      return;
    }
    const kind = value.constructor.name;
    const isLoop = /^(WhileNode|DoWhileNode)$/.test(kind);
    const nested = isLoop
      ? 'loop'
      : /^(BranchNode|SwitchNode|SwitchCaseNode)$/.test(kind) && context === 'once'
        ? 'conditional'
        : context;
    // A loop the enclosing block did not fold in (a do-while, or a while whose header is not a canonical
    // literal for-loop) contributes an unproven number of trips, so both quantities stop being proven.
    const childMaximum = isLoop && !counted.has(value) ? undefined : reachedMaximum;
    // Anything that can skip the callsite kills the FLOOR while leaving the ceiling intact. A ternary arm is
    // listed here but deliberately not in the `conditional` classification above: it can skip a reach, but
    // changing which class a callsite reports would change published behaviour rather than tighten a bound.
    const childExact = (isLoop && !counted.has(value))
      || /^(BranchNode|SwitchNode|SwitchCaseNode|TernaryOpNode)$/.test(kind) ? undefined : reachedExact;
    for (const [key, child] of Object.entries(value)) {
      if ([
        'resolvedFunction', 'functionReference', 'definition', 'symbolTable',
        'referencedContract', 'stateVariable', 'collection',
      ].includes(key)) continue;
      if (child instanceof Node) visit(child, nested, childMaximum, childExact);
      else if (Array.isArray(child)) for (const item of child) visit(item, nested, childMaximum, childExact);
    }
  };
  visit(fn.body, 'once', 1, 1);
  return {
    occurrence: found,
    ...(maximumOccurrences !== undefined && { maximumOccurrences }),
    ...(minimumOccurrences !== undefined && { minimumOccurrences }),
    ...(literalBound ? { occurrenceBoundSource: 'literal' as const } : {}),
  };
};

/**
 * Publish the exact recurrence of one canonical pre-test external-call loop.
 *
 * This is intentionally a small forward interpreter, not an initializer lookup. A local or parameter can be
 * assigned several times before the loop, and an if-without-else joins the assigned arm with the incoming value.
 * Every identifier used by the recurrence is therefore replaced with its value at the loop entry. The only
 * identifier left live is the induction counter itself. Returning external calls are represented by their
 * already-assigned physical result identity; this metadata never clones an executable call node.
 *
 * `targets`, when given, names the nodes whose loops are read instead of the external calls, each by its own key:
 * a framed body's effects repeated per turn are counted by the same recurrence (`framed/master/loop-effects.ts`).
 */
const externalCallIterationDomainLists = (
  fn: FunctionDefinitionNode, compilerOptions: CompilerOptions,
  interfaces: readonly InterfaceNode[], targets?: ReadonlyMap<Node, number>,
): ReadonlyMap<number, readonly {
  sourceLoopId: number;
  counterName: string;
  initialValue: ExternalCallExpression;
  stepValue: ExternalCallExpression;
  continueCondition: ExternalCallExpression;
  maximumIterations: number;
}[]> => {
  if (!fn.body || (targets === undefined && !fn.externalCalls?.length)) return new Map();
  type Binding = ExternalCallExpression | undefined;
  type ReplayState = { bindings: Map<object | string, Binding>; reachable: boolean };
  const visible = fn.parameters.filter((parameter) => !parameter.name.startsWith('__internal__'));
  const initial: ReplayState = { bindings: new Map(), reachable: true };
  visible.forEach((parameter, index) => {
    initial.bindings.set(parameter, { kind: 'source', source: { kind: 'forward', paramIndex: index } });
    initial.bindings.set(`name:${parameter.name}`, {
      kind: 'source', source: { kind: 'forward', paramIndex: index },
    });
  });
  const clone = (state: ReplayState): ReplayState => ({
    bindings: new Map(state.bindings), reachable: state.reachable,
  });
  const same = (left: Binding, right: Binding): boolean =>
    left !== undefined && right !== undefined && JSON.stringify(left) === JSON.stringify(right);
  const definitionKey = (identifier: IdentifierNode): object | string => {
    const definition = identifier.definition?.definition;
    return definition && typeof definition === 'object' ? definition : `name:${identifier.name}`;
  };
  const callByNode = new Map<Node, number>((fn.externalCalls ?? [])
    .filter((call) => call.sourceCallNode !== undefined)
    .map((call) => [call.sourceCallNode!, call.slotIndex] as const));
  const skip = new Set([
    'location', 'resolvedFunction', 'functionReference', 'definition', 'symbolTable',
    'referencedContract', 'stateVariable', 'collection', 'sourceCallNode',
  ]);
  const contains = (root: unknown, target: Node, seen = new Set<object>()): boolean => {
    if (root === target) return true;
    if (!(root instanceof Node) || seen.has(root)) return false;
    seen.add(root);
    for (const [key, child] of Object.entries(root)) {
      if (skip.has(key)) continue;
      if (child instanceof Node && contains(child, target, seen)) return true;
      if (Array.isArray(child) && child.some((item) => contains(item, target, seen))) return true;
    }
    return false;
  };
  type LoopContext = { block: BlockNode; index: number; loop: WhileNode };
  const loopContexts = new Map<number, readonly LoopContext[]>();
  const loopIds = new Map<WhileNode, number>();
  const indexLoopContexts = (
    value: unknown, stack: readonly LoopContext[] = [], ancestors = new Set<object>(),
  ): void => {
    if (!(value instanceof Node) || ancestors.has(value)) return;
    ancestors = new Set(ancestors).add(value);
    const callsiteId = (targets ?? callByNode).get(value);
    if (callsiteId !== undefined) loopContexts.set(callsiteId, stack);
    if (value instanceof BlockNode) {
      for (const [index, statement] of (value.statements ?? []).entries()) {
        if (statement instanceof WhileNode) {
          if (!loopIds.has(statement)) loopIds.set(statement, loopIds.size);
          // A call in the pre-test condition is not a body occurrence and therefore has no affine body domain.
          indexLoopContexts(statement.condition, stack, ancestors);
          indexLoopContexts(statement.block, [...stack, { block: value, index, loop: statement }], ancestors);
        } else {
          indexLoopContexts(statement, stack, ancestors);
        }
      }
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (skip.has(key)) continue;
      if (child instanceof Node) indexLoopContexts(child, stack, ancestors);
      else if (Array.isArray(child)) child.forEach((item) => indexLoopContexts(item, stack, ancestors));
    }
  };
  indexLoopContexts(fn.body);
  const stateWrites = new Map<string, StateAssignNode[]>();
  const indexStateWrites = (value: unknown, seen = new Set<object>()): void => {
    if (!(value instanceof Node) || seen.has(value)) return;
    seen.add(value);
    if (value instanceof StateAssignNode) {
      const writes = stateWrites.get(value.name) ?? [];
      writes.push(value);
      stateWrites.set(value.name, writes);
    }
    for (const [key, child] of Object.entries(value)) {
      if (skip.has(key)) continue;
      if (child instanceof Node) indexStateWrites(child, seen);
      else if (Array.isArray(child)) child.forEach((item) => indexStateWrites(item, seen));
    }
  };
  indexStateWrites(fn.body);
  const serialize = (
    expression: ExpressionNode, state: ReplayState, counter?: VariableDefinitionNode,
    seen = new Set<Node>(),
  ): ExternalCallExpression | undefined => {
    if (seen.has(expression)) return undefined;
    seen = new Set(seen).add(expression);
    if (expression instanceof IdentifierNode) {
      const definition = expression.definition?.definition;
      if (counter && (definition === counter || (!definition && expression.name === counter.name))) {
        return { kind: 'identifier', name: counter.name };
      }
      const byDefinition = definition && typeof definition === 'object'
        ? state.bindings.get(definition) : undefined;
      return byDefinition ?? state.bindings.get(`name:${expression.name}`);
    }
    if (expression instanceof IntLiteralNode) {
      return { kind: 'literal', type: 'bigint', value: expression.value.toString() };
    }
    if (expression instanceof BoolLiteralNode) {
      return { kind: 'literal', type: 'bool', value: expression.value };
    }
    if (expression instanceof LiteralNode) {
      const value = expression.value instanceof Uint8Array ? binToHex(expression.value) : String(expression.value);
      return { kind: 'literal', value, ...(expression.type && { type: expression.type.toString() }) };
    }
    if (expression instanceof StateAccessNode) {
      const key = `state:${expression.name}`;
      return state.bindings.has(key) ? state.bindings.get(key) : { kind: 'state', name: expression.name };
    }
    if (expression instanceof ArrayAccessNode) {
      const left = serialize(expression.array, state, counter, seen);
      const right = serialize(expression.index, state, counter, seen);
      return left && right && { kind: 'arrayAccess', left, right };
    }
    if (expression instanceof CastNode) {
      const inner = serialize(expression.expression, state, counter, seen);
      return inner && { kind: 'cast', type: expression.type.toString(), expression: inner };
    }
    if (expression instanceof UnaryOpNode) {
      const inner = serialize(expression.expression, state, counter, seen);
      return inner && { kind: 'unary', operator: expression.operator, expression: inner };
    }
    if (expression instanceof FieldAccessNode) {
      const inner = serialize(expression.expression, state, counter, seen);
      return inner && (expression.name === 'length'
        ? { kind: 'unary', operator: '.length', expression: inner }
        : { kind: 'field', name: expression.name, expression: inner });
    }
    if (expression instanceof BinaryOpNode) {
      const left = serialize(expression.left, state, counter, seen);
      const right = serialize(expression.right, state, counter, seen);
      return left && right && { kind: 'binary', operator: expression.operator, left, right };
    }
    if (expression instanceof TernaryOpNode) {
      const condition = serialize(expression.condition, state, counter, seen);
      const ifTrue = serialize(expression.ifTrue, state, counter, seen);
      const ifFalse = serialize(expression.ifFalse, state, counter, seen);
      return condition && ifTrue && ifFalse && { kind: 'ternary', condition, ifTrue, ifFalse };
    }
    if (expression instanceof ExternalFunctionCallNode) {
      const callsiteId = expression.callInfo?.externalCallSlotIndex ?? callByNode.get(expression);
      if (callsiteId === undefined || callsiteId < 0 || expression.callInfo?.hasReturnValues !== true
        || expression.callInfo.returnTypes?.length !== 1) return undefined;
      return {
        kind: 'producerResult', callsiteId, resultIndex: 0,
        ...(expression.type && { type: expression.type.toString() }),
      };
    }
    return undefined;
  };
  const join = (condition: Binding, ifValue: Binding, elseValue: Binding): Binding => {
    if (same(ifValue, elseValue)) return ifValue;
    return condition && ifValue && elseValue
      ? { kind: 'ternary', condition, ifTrue: ifValue, ifFalse: elseValue } : undefined;
  };
  const processBlock = (block: BlockNode, state: ReplayState): boolean => {
    for (const statement of block.statements ?? []) {
      if (!state.reachable) break;
      if (statement instanceof VariableDefinitionNode) {
        const value = statement.expression ? serialize(statement.expression, state) : undefined;
        state.bindings.set(statement, value);
        state.bindings.set(`name:${statement.name}`, value);
      } else if (statement instanceof AssignNode) {
        const value = serialize(statement.expression, state);
        const key = definitionKey(statement.identifier);
        state.bindings.set(key, value);
        state.bindings.set(`name:${statement.identifier.name}`, value);
      } else if (statement instanceof StateAssignNode) {
        state.bindings.set(`state:${statement.name}`, serialize(statement.expression, state));
      } else if (statement instanceof TupleAssignmentNode) {
        const callsiteId = statement.tuple instanceof ExternalFunctionCallNode
          ? statement.tuple.callInfo?.externalCallSlotIndex ?? callByNode.get(statement.tuple)
          : undefined;
        const returnTypes = statement.tuple instanceof ExternalFunctionCallNode
          ? statement.tuple.callInfo?.returnTypes : undefined;
        for (const [index, element] of statement.elements.entries()) {
          if (element.skip || !element.name) continue;
          const tupleValue = statement.tupleExpressions?.[index]
            ? serialize(statement.tupleExpressions[index], state)
            : callsiteId !== undefined && callsiteId >= 0 && returnTypes?.[index]
              ? {
                kind: 'producerResult' as const, callsiteId, resultIndex: index,
                type: returnTypes[index].toString(),
              }
              : undefined;
          state.bindings.set(`name:${element.name}`, tupleValue);
        }
      } else if (statement instanceof BranchNode) {
        const condition = serialize(statement.condition, state);
        const before = clone(state);
        const ifState = clone(state);
        const elseState = clone(state);
        if (!processBlock(statement.ifBlock, ifState)
          || (statement.elseBlock && !processBlock(statement.elseBlock, elseState))) return false;
        if (!ifState.reachable && !elseState.reachable) {
          state.reachable = false;
          continue;
        }
        // A terminating arm cannot contribute bindings to a later loop header. Include bindings
        // created by either surviving arm, not only names present before the branch.
        const keys = new Set([...before.bindings.keys(), ...ifState.bindings.keys(),
          ...elseState.bindings.keys()]);
        for (const key of keys) {
          const prior = before.bindings.has(key) ? before.bindings.get(key)
            : typeof key === 'string' && key.startsWith('state:')
              ? { kind: 'state', name: key.slice('state:'.length) } : undefined;
          const ifValue = ifState.bindings.has(key) ? ifState.bindings.get(key) : prior;
          const elseValue = elseState.bindings.has(key) ? elseState.bindings.get(key) : prior;
          state.bindings.set(key, !ifState.reachable ? elseValue : !elseState.reachable ? ifValue
            : join(condition, ifValue, elseValue));
        }
      } else if (statement instanceof BlockNode || statement instanceof UncheckedNode) {
        if (!processBlock(statement instanceof BlockNode ? statement : statement.block, state)) return false;
      } else if (statement instanceof WhileNode) {
        // A preceding canonical loop can be crossed after invalidating every local it may change.
        // State effects are read at the later call's actual entry; reference-data mutations cannot be
        // reconstructed from a source parameter, so leave those later domains unpublished.
        const update = statement.block.statements?.at(-1);
        if (statement.forLoopUpdateCount !== 1 || !(update instanceof AssignNode)) return false;
        let safe = true;
        const changed = new Set<object | string>();
        const seen = new Set<Node>();
        const check = (value: unknown): void => {
          if (!safe || !(value instanceof Node) || seen.has(value)) return;
          seen.add(value);
          if (value instanceof AssignNode) {
            if (value.isReferenceDataWrite) { safe = false; return; }
            changed.add(definitionKey(value.identifier));
            changed.add(`name:${value.identifier.name}`);
          } else if (value instanceof TupleAssignmentNode
            || /^(AssignmentExpressionNode|DeleteLocalNode|Array(?:Push|Pop|Assign|Delete)Node)$/.test(
              value.constructor.name,
            ) || (value instanceof FunctionCallNode && value.resolvedFunction)) {
            safe = false;
            return;
          }
          for (const [key, child] of Object.entries(value)) {
            if (skip.has(key)) continue;
            if (child instanceof Node) check(child);
            else if (Array.isArray(child)) child.forEach(check);
          }
        };
        check(statement.block);
        if (!safe) return false;
        for (const key of changed) state.bindings.set(key, undefined);
      } else if (/^(ReturnNode|RevertNode)$/.test(statement.constructor.name)) {
        // Terminating arms contribute no value to a later loop's entry state.
        state.reachable = false;
      } else if (statement instanceof TryCatchNode
        || statement instanceof SwitchNode || /^(BreakNode|ContinueNode)$/.test(
        statement.constructor.name,
      )) {
        return false;
      }
    }
    return true;
  };
  const replayBefore = (
    block: BlockNode, target: Node, state: ReplayState,
    canSkipPriorLoop: (loop: WhileNode) => boolean,
  ): boolean => {
    for (const statement of block.statements ?? []) {
      if (statement === target) return true;
      if (!contains(statement, target)) {
        // A completed earlier loop need not be symbolically replayed if it cannot change any input to
        // this recurrence. Its own calls/effects remain separate compiler graph edges.
        if (statement instanceof WhileNode && canSkipPriorLoop(statement)) continue;
        if (!processBlock(new BlockNode([statement]), state)) return false;
        if (!state.reachable) return false;
        continue;
      }
      if (statement instanceof BlockNode) return replayBefore(statement, target, state, canSkipPriorLoop);
      if (statement instanceof UncheckedNode) return replayBefore(statement.block, target, state, canSkipPriorLoop);
      if (statement instanceof BranchNode) {
        if (contains(statement.ifBlock, target)) {
          return replayBefore(statement.ifBlock, target, state, canSkipPriorLoop);
        }
        if (statement.elseBlock && contains(statement.elseBlock, target)) {
          return replayBefore(statement.elseBlock, target, state, canSkipPriorLoop);
        }
      }
      return false;
    }
    return false;
  };
  const assignedIn = (root: Node, dependency: object | string, counter: VariableDefinitionNode): boolean => {
    let assigned = false;
    const visit = (value: unknown, seen = new Set<object>()): void => {
      if (assigned || !(value instanceof Node) || seen.has(value)) return;
      seen.add(value);
      if (value instanceof AssignNode) {
        const key = definitionKey(value.identifier);
        const isCounterUpdate = key === counter
          || (typeof key === 'string' && key === `name:${counter.name}`);
        if (!isCounterUpdate && key === dependency) { assigned = true; return; }
      }
      if (value instanceof StateAssignNode && dependency === `state:${value.name}`) {
        assigned = true;
        return;
      }
      for (const [key, child] of Object.entries(value)) {
        if (skip.has(key)) continue;
        if (child instanceof Node) visit(child, seen);
        else if (Array.isArray(child)) child.forEach((item) => visit(item, seen));
      }
    };
    visit(root);
    return assigned;
  };
  const dependencies = (root: ExpressionNode, counter: VariableDefinitionNode): Set<object | string> => {
    const result = new Set<object | string>();
    const visit = (value: unknown, seen = new Set<object>()): void => {
      if (!(value instanceof Node) || seen.has(value)) return;
      seen.add(value);
      if (value instanceof IdentifierNode) {
        const key = definitionKey(value);
        if (key !== counter && key !== `name:${counter.name}`) result.add(key);
      }
      if (value instanceof StateAccessNode) result.add(`state:${value.name}`);
      for (const [key, child] of Object.entries(value)) {
        if (skip.has(key)) continue;
        if (child instanceof Node) visit(child, seen);
        else if (Array.isArray(child)) child.forEach((item) => visit(item, seen));
      }
    };
    visit(root);
    return result;
  };

  const recurrenceHasLiveExternalRead = (root: ExpressionNode): boolean => {
    let found = false;
    const visit = (value: unknown, seen = new Set<object>()): void => {
      if (found || !(value instanceof Node) || seen.has(value)) return;
      seen.add(value);
      if (value instanceof StateAccessNode || value instanceof MappingAccessNode
        || value instanceof FunctionCallNode || value instanceof ExternalFunctionCallNode
        || value instanceof LowLevelCallNode) { found = true; return; }
      for (const [key, child] of Object.entries(value)) {
        if (skip.has(key)) continue;
        if (child instanceof Node) visit(child, seen);
        else if (Array.isArray(child)) child.forEach((item) => visit(item, seen));
      }
    };
    visit(root);
    return found;
  };

  const interfaceNames = new Set(interfaces.map((iface) => iface.name));
  const priorLoopHasOpaqueLocalEffect = (
    root: WhileNode, recurrenceDependencies: ReadonlySet<object | string>,
  ): boolean => {
    let found = false;
    const touchesRecurrence = (value: unknown, seen = new Set<object>()): boolean => {
      if (!(value instanceof Node) || seen.has(value)) return false;
      seen.add(value);
      if (value instanceof IdentifierNode && (recurrenceDependencies.has(definitionKey(value))
        || recurrenceDependencies.has(`name:${value.name}`))) return true;
      if (value instanceof StateAccessNode
        && recurrenceDependencies.has(`state:${value.name}`)) return true;
      return Object.entries(value).some(([key, child]) => !skip.has(key)
        && (child instanceof Node ? touchesRecurrence(child, seen)
          : Array.isArray(child) && child.some((item) => touchesRecurrence(item, seen))));
    };
    const visit = (value: unknown, seen = new Set<object>()): void => {
      if (found || !(value instanceof Node) || seen.has(value)) return;
      seen.add(value);
      const interfaceCast = value instanceof FunctionCallNode && value.parameters.length === 1
        && value.resolvedFunction === undefined && value.lexicalIndirectCall !== true
        && interfaceNames.has(value.identifier.name);
      // A prior internal helper cannot mutate a later loop's local bound unless that bound reaches the call.
      // Its unrelated state effects do not change a recurrence derived only from other
      // input arguments; state reads are separately excluded by stableRead below. Keep calls that touch a
      // recurrence dependency conservative, along with local aggregate mutations and tuple assignments.
      if ((value instanceof FunctionCallNode && !interfaceCast && touchesRecurrence(value))
        || value instanceof TupleAssignmentNode
        || /^(ArrayAssignNode|ArrayPushNode|ArrayPopNode|ArrayDeleteNode|DeleteLocalNode|AssignmentExpressionNode)$/
          .test(value.constructor.name)) { found = true; return; }
      for (const [key, child] of Object.entries(value)) {
        if (skip.has(key)) continue;
        if (child instanceof Node) visit(child, seen);
        else if (Array.isArray(child)) child.forEach((item) => visit(item, seen));
      }
    };
    visit(root);
    return found;
  };

  const usesStateSnapshotAfterWrite = (
    value: unknown, seen = new Set<object>(),
  ): boolean => {
    if (!value || typeof value !== 'object' || seen.has(value)) return false;
    seen.add(value);
    const expression = value as { kind?: string; name?: string };
    if (expression.kind === 'state' && expression.name && stateWrites.has(expression.name)) return true;
    return Object.values(value).some((child) => usesStateSnapshotAfterWrite(child, seen));
  };

  type Domain = {
    sourceLoopId: number;
    counterName: string;
    initialValue: ExternalCallExpression;
    stepValue: ExternalCallExpression;
    continueCondition: ExternalCallExpression;
    maximumIterations: number;
  };
  const result = new Map<number, Domain[]>();
  const sites = targets === undefined ? fn.externalCalls!
    : [...targets].map(([sourceCallNode, slotIndex]) => ({ sourceCallNode, slotIndex }));
  for (const call of sites) {
    const target = call.sourceCallNode;
    if (!target) continue;
    const enclosing = loopContexts.get(call.slotIndex) ?? [];
    if (enclosing.length === 0) continue;
    const domains: Domain[] = [];
    for (const [depth, { block, index, loop }] of enclosing.entries()) {
      const counter = block.statements?.[index - 1];
      if (!(counter instanceof VariableDefinitionNode) || !counter.isLoopVariable || !counter.expression
      || loop.forLoopUpdateCount !== 1 || loopCanExitEarly(loop)) break;
      const update = loop.block.statements?.at(-1);
      if (!(update instanceof AssignNode) || update.identifier.name !== counter.name
      || !(update.expression instanceof BinaryOpNode)
      || ![BinaryOperator.PLUS, BinaryOperator.MINUS].includes(update.expression.operator)) break;
      const counterOnLeft = update.expression.left instanceof IdentifierNode
      && update.expression.left.name === counter.name;
      const counterOnRight = update.expression.operator === BinaryOperator.PLUS
      && update.expression.right instanceof IdentifierNode
      && update.expression.right.name === counter.name;
      if (!counterOnLeft && !counterOnRight) break;
      let counterAssignments = 0;
      const countCounterAssignments = (value: unknown, seen = new Set<object>()): void => {
        if (!(value instanceof Node) || seen.has(value)) return;
        seen.add(value);
        if (value instanceof AssignNode) {
          const key = definitionKey(value.identifier);
          if (key === counter || key === `name:${counter.name}`) counterAssignments += 1;
        }
        for (const [key, child] of Object.entries(value)) {
          if (skip.has(key)) continue;
          if (child instanceof Node) countCounterAssignments(child, seen);
          else if (Array.isArray(child)) child.forEach((item) => countCounterAssignments(item, seen));
        }
      };
      countCounterAssignments(loop.block);
      if (counterAssignments !== 1) break;
      const magnitude = counterOnLeft ? update.expression.right : update.expression.left;
      const deps = new Set([
        ...dependencies(counter.expression, counter),
        ...dependencies(loop.condition, counter),
        ...dependencies(magnitude, counter),
      ]);
      if ([...deps].some((dependency) => {
        if (assignedIn(loop.block, dependency, counter)) return true;
        const ancestorWrite = enclosing.slice(0, depth).some((ancestor) =>
          assignedIn(ancestor.loop.block, dependency, counter));
        if (!ancestorWrite) return false;
        const stateName = typeof dependency === 'string' && dependency.startsWith('state:')
          ? dependency.slice('state:'.length) : undefined;
        const writes = stateName === undefined ? undefined : stateWrites.get(stateName);
        // Writes in direct prefix statements (including a replayable branch) execute before this inner
        // header on each outer reach. A missing branch arm still retains a pre-call snapshot in the
        // serialized recurrence, which the guard below rejects. Writes elsewhere may carry over.
        const prefix = block.statements?.slice(0, index - 1) ?? [];
        return !(depth === 1 && writes?.length && writes.every((write) => prefix.some((statement) =>
          statement === write || (statement instanceof BranchNode && contains(statement, write)))));
      })) {
        break;
      }
      const state = clone(initial);
      // The inner header may read a local assigned earlier in this exact outer iteration (notably a
      // single-result external call). Replay only the enclosing outer body prefix: that producer identity
      // is then occurrence-qualified by the SDK before evaluating this inner recurrence. An earlier loop
      // in the prefix is not replayable here, so it still withholds the domain.
      if (depth === 0 && !replayBefore(fn.body, counter, state, (prior) => {
        const stableRead = ![counter.expression!, loop.condition, magnitude].some(recurrenceHasLiveExternalRead);
        const earlyExit = loopCanExitEarly(prior);
        const opaqueEffect = priorLoopHasOpaqueLocalEffect(prior, deps);
        const dependencyWrites = [...deps].filter((dependency) => assignedIn(prior, dependency, counter));
        return stableRead && !earlyExit && !opaqueEffect && dependencyWrites.length === 0;
      })) break;
      if (depth === 1) {
        const outerContext = enclosing[0]!;
        const outerCounter = outerContext.block.statements?.[outerContext.index - 1];
        if (!(outerCounter instanceof VariableDefinitionNode)
          || domains[0]?.counterName !== outerCounter.name) break;
        // This symbolic source is substituted with the already reached outer coordinate by the SDK before
        // any inner-domain expression is evaluated. It must not be interpreted as occurrence zero here.
        const outerReference: ExternalCallExpression = {
          kind: 'source', source: {
            kind: 'loopIndex', counterName: outerCounter.name, initialValue: '0', stepValue: '1',
          },
        };
        state.bindings.set(outerCounter, outerReference);
        state.bindings.set(`name:${outerCounter.name}`, outerReference);
        if (!replayBefore(block, counter, state, () => false)) break;
      }
      const initialValue = serialize(counter.expression, state);
      // The declaration starts the live induction binding only after its initializer is evaluated.
      state.bindings.set(counter, { kind: 'identifier', name: counter.name });
      state.bindings.set(`name:${counter.name}`, { kind: 'identifier', name: counter.name });
      const continueCondition = serialize(loop.condition, state, counter);
      const serializedMagnitude = serialize(magnitude, state, counter);
      const stepValue = serializedMagnitude && update.expression.operator === BinaryOperator.MINUS
        ? {
          kind: 'binary' as const, operator: BinaryOperator.MINUS,
          left: { kind: 'literal' as const, type: 'bigint', value: '0' }, right: serializedMagnitude,
        }
        : serializedMagnitude;
      const maximumIterations = fixedForMaximum(counter, loop)
      ?? loop.compilerAuthenticatedMaximumIterations
      ?? (compilerOptions.messageBusKernel === true ? ATOMIC_MESSAGE_BUS_MAX_ROWS : undefined);
      if (!initialValue || !stepValue || !continueCondition || maximumIterations === undefined) break;
      // A serialized state read after any write in this handler would use the SDK's pre-call snapshot, not
      // necessarily the value reached by this loop. Direct, unconditional prefix writes above serialize to
      // their value expression instead; conditional/local-alias fallbacks remain deliberately unpublished.
      if ([initialValue, stepValue, continueCondition].some((expression) =>
        usesStateSnapshotAfterWrite(expression))) break;
      domains.push({
        sourceLoopId: loopIds.get(loop)!,
        counterName: counter.name, initialValue, stepValue, continueCondition, maximumIterations,
      });
    }
    if (domains.length === enclosing.length) result.set(call.slotIndex, domains);
  }
  return result;
};

/**
 * The single-loop recurrence of each key `externalCallIterationDomainLists` counts, as one domain: what a framed
 * body's loop effects publish (`framed/master/loop-effects.ts`, which passes `targets`). A key inside nested loops
 * has no single domain and is left out.
 */
export const externalCallIterationDomains = (
  fn: FunctionDefinitionNode, compilerOptions: CompilerOptions, targets?: ReadonlyMap<Node, number>,
): ReadonlyMap<number, {
  counterName: string;
  initialValue: ExternalCallExpression;
  stepValue: ExternalCallExpression;
  continueCondition: ExternalCallExpression;
  maximumIterations: number;
}> => {
  const single = new Map<number, {
    counterName: string;
    initialValue: ExternalCallExpression;
    stepValue: ExternalCallExpression;
    continueCondition: ExternalCallExpression;
    maximumIterations: number;
  }>();
  for (const [key, domains] of externalCallIterationDomainLists(fn, compilerOptions, [], targets)) {
    if (domains.length !== 1) continue;
    const { counterName, initialValue, stepValue, continueCondition, maximumIterations } = domains[0]!;
    single.set(key, { counterName, initialValue, stepValue, continueCondition, maximumIterations });
  }
  return single;
};

const expressionSource = (
  expression: ExpressionNode, fn: FunctionDefinitionNode, contract: ContractNode,
): { kind: 'forward' | 'constructorArg' | 'literal' | 'msgSender' | 'expression';
  paramIndex?: number; paramName?: string; value?: string; type?: string } => {
  const shaped = expression as unknown as { name?: string; value?: unknown; type?: Type };
  if (expression.constructor.name === 'NullaryOpNode'
    && (expression as unknown as { operator?: string }).operator === 'msg.sender') {
    return { kind: 'msgSender' };
  }
  if (expression.constructor.name === 'IdentifierNode' && shaped.name === '__message_bus_graph_caller') {
    return { kind: 'msgSender' };
  }
  if (expression.constructor.name === 'IdentifierNode' && shaped.name) {
    const visible = fn.parameters.filter((parameter) => !parameter.name.startsWith('__internal__'));
    const parameterIndex = visible.findIndex((parameter) => parameter.name === shaped.name);
    if (parameterIndex >= 0) return { kind: 'forward', paramIndex: parameterIndex };
    if (contract.parameters.some((parameter) => parameter.name === shaped.name)) {
      return { kind: 'constructorArg', paramName: shaped.name };
    }
  }
  const kind = expression.constructor.name;
  if (kind === 'BoolLiteralNode') {
    return { kind: 'literal', value: String(shaped.value), type: 'bool' };
  }
  if (kind === 'IntLiteralNode') {
    return { kind: 'literal', value: String(shaped.value), type: shaped.type?.toString() ?? 'bigint' };
  }
  if (kind === 'StringLiteralNode') {
    return { kind: 'literal', value: String(shaped.value), type: 'string' };
  }
  if (kind === 'HexLiteralNode' && shaped.value instanceof Uint8Array) {
    return {
      kind: 'literal', value: binToHex(shaped.value), type: shaped.type?.toString() ?? 'bytes',
    };
  }
  return { kind: 'expression' };
};

/**
 * The global builtins a body may call by name.
 *
 * Each computes a value from its own operands (a blockhash read takes a co-spent oracle input, and a signature or
 * recovery check answers from its arguments), so no call to one writes a state variable. The constructor replay
 * charges every call it cannot resolve to a declared body as a possible mutation of any dynamic value, because an
 * unknown callee may write through an alias; a builtin is known not to, so charging it would blank the write count
 * of every dynamic value the body states — which is what a constructor that hashes its own arguments lost.
 */
const GLOBAL_BUILTIN_CALLS = new Set<string>(Object.values(GlobalFunction));

/**
 * Publish finite replay programs for constructor-time dynamic state.
 *
 * This is intentionally a small symbolic interpreter rather than an AST pattern match. Constructors commonly
 * initialise scalar bookkeeping around several independent dynamic values, and Solidity spells an else-if as a
 * nested branch in the outer else block. Walking statements in source order also matters for local aliases:
 *
 *     string chosen = left;
 *     if (flip) chosen = right;
 *     this.label = chosen;
 *
 * Only a final value determined after at least one write on every path is published. A later replayable write
 * may supersede an earlier one, including on just one branch. An expression which reads state, calls a helper,
 * crosses an unsupported control-flow construct, or otherwise cannot be represented by
 * ExternalCallExpression remains absent. The SDK then uses its authoritative VM-probe fallback.
 *
 * A non-constructor entry never assigns a whole dynamic value: its write is an append, and the value it produces
 * is the live value plus the element. The same map therefore carries, for such an entry, the ELEMENT its single
 * push appends, under the pushed variable's name. A body that pushes the element type's default and then fills
 * its fields in place rebuilds that element once per field write; the fields are folded into the stated element,
 * so what is published is the element the body writes rather than the default the push appended. A field value
 * the vocabulary cannot state leaves the element unstated, as any other unrepresentable value does - except the
 * machine's own clock (`block.timestamp`), which is published as a read of the register it desugars to, so an
 * element a body stamps with the transaction's time is the element the consumer states. The run's
 * width is the live value's plus that element, so the element is what a consumer has to state; the same
 * one-write-per-path proof applies. Only the framed convention
 * reads this entry shape, so the other conventions' artifacts are unchanged.
 */
const dynamicWriteSourcesOf = (
  func: FunctionDefinitionNode, contract: ContractNode | undefined,
  compilerOptions: CompilerOptions = {},
): Readonly<Record<string, ExternalCallExpression>> => {
  const appendMode = func.name !== '__construct';
  if (!func.body) return {};
  if (appendMode && compilerOptions.composition !== 'framed') return {};
  const dynamicNames = new Set(func.dynamicWrites ?? []);
  if (dynamicNames.size === 0) return {};
  // This replay deliberately models only terminating straight-line/if control flow. An abrupt completion that can
  // precede a dynamic write is an all-metadata boundary: otherwise `if (stop) return; this.s = value` would look
  // like one write on both paths even though the first path completes without it. A completion the body reaches
  // only after every dynamic write (the `return jobId` that closes a value-returning entry) skips nothing and is
  // not a boundary.
  //
  // A loop, a traversal or a switch is NOT a boundary by itself. The replay never walks into one, so a dynamic
  // write it holds is left to the invalidation below, which charges the variable and keeps it absent - the same
  // answer the boundary gave, but for the write rather than for the whole body. A body whose loop writes nothing
  // dynamic (a tag scan, an unthreaded guard) therefore keeps a dynamic write it makes elsewhere.
  // A `revert` is not a boundary: it aborts the deployment, so no successful genesis exists on the path that
  // reaches it, and a write the body reaches before one is still assigned on every path that completes.
  const abruptControl = new Set(['ReturnNode', 'BreakNode', 'ContinueNode', 'TryCatchNode']);
  // Source-order positions: an abrupt completion bounds the replay only when it sits before a dynamic write, so
  // every dynamic write a completing path could skip has a higher position than the completion that skips it.
  let firstAbrupt = Number.POSITIVE_INFINITY;
  let lastDynamicWrite = -1;
  let scanPosition = 0;
  const scanControlFlow = (value: unknown, seen = new Set<object>()): void => {
    if (!(value instanceof Node) || seen.has(value)) return;
    seen.add(value);
    const position = scanPosition++;
    if (abruptControl.has(value.constructor.name)) firstAbrupt = Math.min(firstAbrupt, position);
    const scanned = value as unknown as { name?: string };
    if (scanned.name && dynamicNames.has(scanned.name)
      && /(?:Assign|Push|Pop|Delete)Node$/.test(value.constructor.name)) {
      lastDynamicWrite = Math.max(lastDynamicWrite, position);
    }
    for (const [key, child] of Object.entries(value)) {
      if (['location', 'definition', 'resolvedFunction', 'functionReference', 'symbolTable',
        'stateVariable', 'collection'].includes(key)) continue;
      if (child instanceof Node) scanControlFlow(child, seen);
      else if (Array.isArray(child)) child.forEach((item) => scanControlFlow(item, seen));
    }
  };
  scanControlFlow(func.body);
  if (firstAbrupt < lastDynamicWrite) return {};
  const visible = func.parameters.filter((parameter) => !parameter.name.startsWith('__internal__'));
  type Binding = ExternalCallExpression | undefined;
  type Write = { minimum: number; maximum: number; value?: ExternalCallExpression; indexKey?: string };
  type ReplayState = {
    bindings: Map<object, Binding>;
    blockedNames: Set<string>;
    writes: Map<string, Write>;
  };
  const initial: ReplayState = {
    bindings: new Map(),
    blockedNames: new Set(),
    writes: new Map([...dynamicNames].map((name) => [name, { minimum: 0, maximum: 0 }])),
  };
  const cloneState = (state: ReplayState): ReplayState => ({
    bindings: new Map(state.bindings),
    blockedNames: new Set(state.blockedNames),
    writes: new Map([...state.writes].map(([name, write]) => [name, { ...write }])),
  });
  const sameExpression = (left: Binding, right: Binding): boolean =>
    left !== undefined && right !== undefined && JSON.stringify(left) === JSON.stringify(right);
  const joinExpression = (
    condition: Binding, ifTrue: Binding, ifFalse: Binding,
  ): Binding => {
    if (sameExpression(ifTrue, ifFalse)) return ifTrue;
    return condition && ifTrue && ifFalse
      ? { kind: 'ternary', condition, ifTrue, ifFalse }
      : undefined;
  };
  const definitionOf = (identifier: IdentifierNode): object | undefined => {
    const definition = identifier.definition?.definition;
    return definition && typeof definition === 'object' ? definition : undefined;
  };
  const serialize = (expression: ExpressionNode, state: ReplayState): ExternalCallExpression | undefined => {
    if (expression instanceof IdentifierNode) {
      const definition = definitionOf(expression);
      if (definition && state.bindings.has(definition)) return state.bindings.get(definition);
      if (state.blockedNames.has(expression.name)) return undefined;
      const parameterIndex = visible.findIndex((parameter) => parameter.name === expression.name);
      if (parameterIndex >= 0) {
        return { kind: 'source', source: { kind: 'forward', paramIndex: parameterIndex } };
      }
      if (contract?.parameters.some((parameter) => parameter.name === expression.name)) {
        return { kind: 'source', source: { kind: 'constructorArg', paramName: expression.name } };
      }
      return undefined;
    }
    const shaped = expression as unknown as { value?: unknown; type?: Type };
    if (expression.constructor.name === 'BoolLiteralNode') {
      return { kind: 'literal', value: shaped.value as boolean, type: 'bool' };
    }
    if (expression.constructor.name === 'IntLiteralNode') {
      return { kind: 'literal', value: String(shaped.value), type: 'bigint' };
    }
    if (expression.constructor.name === 'StringLiteralNode') {
      return { kind: 'literal', value: String(shaped.value), type: 'string' };
    }
    if (expression.constructor.name === 'HexLiteralNode' && shaped.value instanceof Uint8Array) {
      return { kind: 'literal', value: binToHex(shaped.value), type: shaped.type?.toString() ?? 'bytes' };
    }
    // Appended-element vocabulary: the nodes a push operand commonly is beyond the constructor's own. A
    // constructor write keeps the narrower set above, so its published shape is unchanged.
    if (appendMode && expression instanceof NullaryOpNode
      && (expression.operator === NullaryOperator.MSG_SENDER
        || expression.operator === NullaryOperator.TX_ORIGIN)) {
      return { kind: 'source', source: { kind: 'msgSender' } };
    }
    // The machine's own clock is a register of the contract's state, so an element field the body fills with it is
    // a read of that register: the consumer resolves it from the state its plan runs on, exactly as the direct
    // convention's appended-element recipe does.
    if (appendMode && ((expression instanceof NullaryOpNode
      && expression.operator === NullaryOperator.BLOCK_TIMESTAMP)
      || (expression instanceof StateAccessNode && expression.name === '__block_timestamp'))) {
      return { kind: 'state', name: '__block_timestamp', type: expression.type?.toString() ?? 'uint32' };
    }
    if (appendMode && (expression instanceof InstantiationNode || expression instanceof FunctionCallNode)) {
      // Only a call spelled exactly as a declared struct constructs one; a function returning a struct has the
      // struct as its type but a different callee name, so it stays unnamed rather than read as a construction.
      const struct = expression.type;
      if (!(struct instanceof StructType) || expression.identifier.name !== struct.name) return undefined;
      const args = expression.parameters.map((parameter) => serialize(parameter, state));
      return args.every((argument): argument is ExternalCallExpression => argument !== undefined)
        ? { kind: 'call', name: struct.name, type: struct.name, args } : undefined;
    }
    if (appendMode && expression instanceof FieldAccessNode) {
      const inner = serialize(expression.expression, state);
      return inner && {
        kind: 'field', name: expression.name, expression: inner,
        ...(expression.type && { type: expression.type.toString() }),
      };
    }
    if (appendMode && expression instanceof ArrayAccessNode) {
      const left = serialize(expression.array, state);
      const right = serialize(expression.index, state);
      return left && right && {
        kind: 'arrayAccess', left, right,
        ...(expression.type && { type: expression.type.toString() }),
      };
    }
    if (appendMode && expression instanceof NewArrayNode) {
      // An element type's default value can contain an array: a struct field of array type, or an array element
      // type that is itself an array, both default to a zero-length `new T[](0)`. The shipped evaluator speaks
      // this node, so an append of such a default stays statable instead of leaving the whole element unnamed.
      const size = serialize(expression.size, state);
      return size && { kind: 'newArray', type: expression.elementType.toString(), args: [size] };
    }
    if (expression instanceof CastNode) {
      const inner = serialize(expression.expression, state);
      return inner && { kind: 'cast', type: expression.type.toString(), expression: inner };
    }
    if (expression instanceof UnaryOpNode) {
      const inner = serialize(expression.expression, state);
      return inner && { kind: 'unary', operator: expression.operator, expression: inner };
    }
    if (expression instanceof BinaryOpNode) {
      const left = serialize(expression.left, state);
      const right = serialize(expression.right, state);
      return left && right && { kind: 'binary', operator: expression.operator, left, right };
    }
    if (expression instanceof TernaryOpNode) {
      const condition = serialize(expression.condition, state);
      const ifTrue = serialize(expression.ifTrue, state);
      const ifFalse = serialize(expression.ifFalse, state);
      return condition && ifTrue && ifFalse && { kind: 'ternary', condition, ifTrue, ifFalse };
    }
    return undefined;
  };

  // True when an expression reads the named dynamic variable itself. A write whose value does so rebuilds an
  // element of that value in place (the read-modify-write a struct field fill through a storage pointer lowers
  // to) rather than replacing the value or an element with an independent one.
  const readsVariable = (expression: ExpressionNode, name: string): boolean => {
    const seen = new Set<object>();
    const visit = (value: unknown): boolean => {
      if (!(value instanceof Node) || seen.has(value)) return false;
      seen.add(value);
      if ((value instanceof MappingAccessNode || value instanceof StateAccessNode
        || value instanceof IdentifierNode) && value.name === name) return true;
      for (const [key, child] of Object.entries(value)) {
        if (['location', 'definition', 'symbolTable', 'stateVariable', 'collection'].includes(key)) continue;
        if (child instanceof Node && visit(child)) return true;
        if (Array.isArray(child) && child.some((item) => visit(item))) return true;
      }
      return false;
    };
    return visit(expression);
  };

  const definitionIds = new Map<object, number>();
  // A structural key for an element index. Two rebuilds that name the same index fold into one stated element;
  // any index form this replay cannot pin leaves the key undefined, and a rebuild with an unpinned index is
  // left unstated rather than folded into an element it might not name.
  const indexKey = (expression: ExpressionNode): string | undefined => {
    if (expression instanceof IdentifierNode) {
      const definition = expression.definition?.definition;
      if (definition && typeof definition === 'object') {
        const known = definitionIds.get(definition);
        if (known !== undefined) return `definition:${known}`;
        definitionIds.set(definition, definitionIds.size);
        return `definition:${definitionIds.size - 1}`;
      }
      return `name:${expression.name}`;
    }
    return expression instanceof IntLiteralNode ? `literal:${expression.value}` : undefined;
  };

  const sameIndexExpression = (left: ExpressionNode, right: ExpressionNode): boolean => {
    if (left === right) return true;
    const leftKey = indexKey(left);
    const rightKey = indexKey(right);
    return leftKey !== undefined && rightKey !== undefined && leftKey === rightKey;
  };

  // The field path a construction argument reads off the appended element, or undefined when the argument is not
  // such a read. The read must be rooted at the pushed variable indexed by the same expression the rebuild writes,
  // so a rebuild that reads a different element than it writes is not folded into the stated one.
  const elementReadPath = (
    expression: ExpressionNode, name: string, index: ExpressionNode,
  ): readonly string[] | undefined => {
    const path: string[] = [];
    let current: ExpressionNode = expression;
    while (current instanceof FieldAccessNode) {
      path.unshift(current.name);
      current = current.expression;
    }
    const key = current instanceof MappingAccessNode && current.name === name && current.keys?.length === 1
      ? current.keys[0]
      : current instanceof ArrayAccessNode
        && ((current.array instanceof IdentifierNode && current.array.name === name)
          || (current.array instanceof StateAccessNode && current.array.name === name))
        ? current.index
        : undefined;
    return key !== undefined && sameIndexExpression(key, index) ? path : undefined;
  };

  // Resolve a field path of the stated element, descending through nested constructions.
  const elementField = (
    element: ExternalCallExpression, struct: StructType, path: readonly string[],
  ): ExternalCallExpression | undefined => {
    let member: ExternalCallExpression | undefined = element;
    let type: Type = struct;
    for (const fieldName of path) {
      if (member?.kind !== 'call' || !(type instanceof StructType)) return undefined;
      const fieldIndex: number = type.fields.findIndex((field) => field.name === fieldName);
      if (fieldIndex < 0) return undefined;
      member = member.args?.[fieldIndex];
      type = type.fields[fieldIndex].type;
    }
    return member;
  };

  // Fold one in-place rebuild of the appended element into the element already stated. The rebuild constructs the
  // element's own type; each argument either reads a field of that element (kept from the stated element) or
  // states the field's new value. A construction this replay cannot follow, a field value it cannot state, and a
  // rebuild that names an element other than the one already stated all leave the variable unstated.
  const foldElementRebuild = (
    write: Write, statement: StateArrayAssignNode, state: ReplayState,
  ): ExternalCallExpression | undefined => {
    const element = write.value;
    const construction = statement.value;
    if (!element || element.kind !== 'call' || !element.name
      || !(construction instanceof FunctionCallNode) || !(construction.type instanceof StructType)) {
      return undefined;
    }
    const struct = construction.type;
    const pinned = indexKey(statement.index);
    if (pinned === undefined || construction.identifier.name !== struct.name
      || struct.name !== element.name || construction.parameters.length !== struct.fields.length) {
      return undefined;
    }
    if (write.indexKey !== undefined && write.indexKey !== pinned) return undefined;
    write.indexKey = pinned;
    const folded = (expression: ExpressionNode): ExternalCallExpression | undefined => {
      const path = elementReadPath(expression, statement.name, statement.index);
      if (path !== undefined) return elementField(element, struct, path);
      if (expression instanceof FunctionCallNode && expression.type instanceof StructType
        && expression.identifier.name === expression.type.name) {
        const args = expression.parameters.map((parameter) => folded(parameter));
        return args.every((argument): argument is ExternalCallExpression => argument !== undefined)
          ? { kind: 'call', name: expression.type.name, args, type: expression.type.name } : undefined;
      }
      return serialize(expression, state);
    };
    const args = construction.parameters.map((parameter) => folded(parameter));
    return args.every((argument): argument is ExternalCallExpression => argument !== undefined)
      ? { kind: 'call', name: element.name, args, ...(element.type !== undefined && { type: element.type }) }
      : undefined;
  };

  // A field-rebuild join that overwrites every field no longer reads the array: the constructor IS the element
  // the body writes. An indexed assignment the source spelled as a whole-element replacement is not marked, so
  // it stays unstated. A constructor this replay cannot follow leaves the variable unstated too.
  const replaceRebuiltElement = (
    write: Write, statement: StateArrayAssignNode, state: ReplayState,
  ): ExternalCallExpression | undefined => {
    const construction = statement.value;
    if (!(construction instanceof FunctionCallNode) || !(construction.type instanceof StructType)) return undefined;
    const struct = construction.type;
    const pinned = indexKey(statement.index);
    if (pinned === undefined || construction.identifier.name !== struct.name
      || construction.fieldNames !== undefined
      || construction.parameters.length !== struct.fields.length) {
      return undefined;
    }
    if (write.indexKey !== undefined && write.indexKey !== pinned) return undefined;
    if (write.value !== undefined && (write.value.kind !== 'call' || write.value.name !== struct.name)) {
      return undefined;
    }
    const args = construction.parameters.map((parameter) => serialize(parameter, state));
    if (!args.every((argument): argument is ExternalCallExpression => argument !== undefined)) return undefined;
    write.indexKey = pinned;
    return { kind: 'call', name: struct.name, args, type: struct.name };
  };

  const invalidateUnknownMutations = (node: Node, state: ReplayState): void => {
    const seen = new Set<object>();
    const visit = (value: unknown): void => {
      if (!(value instanceof Node) || seen.has(value)) return;
      seen.add(value);
      if (value instanceof AssignNode) {
        const definition = definitionOf(value.identifier);
        if (definition) state.bindings.set(definition, undefined);
        else state.blockedNames.add(value.identifier.name);
      }
      if (value instanceof FunctionCallNode) {
        // A call can mutate reference-like locals through aliases, so no local substitution survives it.
        for (const key of state.bindings.keys()) state.bindings.set(key, undefined);
        if (!(value.resolvedFunction instanceof FunctionDefinitionNode) && !appendMode
          && !GLOBAL_BUILTIN_CALLS.has(value.identifier.name)) {
          // The callee is not known, so it may write any dynamic value. A resolved callee is visited by this same
          // walk below, so the writes it really makes are counted from its own body rather than assumed.
          //
          // For an entry's append the blanket charge is dropped: an unresolved callee there is a value producer - a
          // construction or a builtin - which cannot write a dynamic value, and any write node its own operands
          // carry is still charged by the walk below. The constructor replay keeps the charge for a callee whose
          // name is not one of the global builtins: it has a VM-probe fallback, and a named builtin, which writes
          // nothing, is the only unresolved callee whose writes this replay can rule out.
          for (const write of state.writes.values()) {
            write.maximum = Number.POSITIVE_INFINITY;
            write.value = undefined;
          }
        }
      }
      const named = value as unknown as { name?: string };
      if (named.name && dynamicNames.has(named.name)
        && /(?:Assign|Push|Pop|Delete)Node$/.test(value.constructor.name)) {
        const write = state.writes.get(named.name)!;
        write.maximum = Number.POSITIVE_INFINITY;
        write.value = undefined;
      }
      for (const [key, child] of Object.entries(value)) {
        if (['location', 'definition', 'symbolTable', 'stateVariable', 'collection'].includes(key)) continue;
        if (child instanceof Node) visit(child);
        else if (Array.isArray(child)) child.forEach(visit);
      }
    };
    visit(node);
  };

  // True when a subtree carries a completion the replay honours: a return, break or continue ends the arm, and a
  // caught failure of a `try` ends it too, so an arm holding one does not always run to its final statement.
  const hasHonouredCompletion = (node: Node): boolean => {
    const seen = new Set<object>();
    const visit = (value: unknown): boolean => {
      if (!(value instanceof Node) || seen.has(value)) return false;
      seen.add(value);
      if (abruptControl.has(value.constructor.name)) return true;
      for (const [key, child] of Object.entries(value)) {
        if (['location', 'definition', 'symbolTable'].includes(key)) continue;
        if (child instanceof Node && visit(child)) return true;
        if (Array.isArray(child) && child.some((item) => visit(item))) return true;
      }
      return false;
    };
    return visit(node);
  };

  // True when every path that reaches the end of an arm aborts it: its last statement is a `revert` and it holds no
  // completion that would end it earlier. Such an arm contributes no completing path, so it neither halves the write
  // count nor blanks the value; the other arm alone is what every completing path took.
  const armAlwaysReverts = (block: BlockNode): boolean =>
    block.statements?.at(-1) instanceof RevertNode && !hasHonouredCompletion(block);

  const processBlock = (block: BlockNode, state: ReplayState): ReplayState => {
    for (const statement of block.statements ?? []) {
      if (statement instanceof VariableDefinitionNode) {
        if (statement.expression) invalidateUnknownMutations(statement.expression, state);
        state.bindings.set(statement, statement.expression
          ? serialize(statement.expression, state) : undefined);
        continue;
      }
      if (statement instanceof AssignNode) {
        invalidateUnknownMutations(statement.expression, state);
        const value = serialize(statement.expression, state);
        const definition = definitionOf(statement.identifier);
        if (definition) state.bindings.set(definition, value);
        else {
          state.blockedNames.add(statement.identifier.name);
          // Do not let a later unresolved identifier accidentally resolve as a pristine parameter.
        }
        continue;
      }
      // An entry's dynamic write is an append: the pushed element is the value this map publishes. Any other
      // write to the same variable (a whole-value assignment, a pop, an indexed write) falls through to the
      // invalidation below, which marks it unbounded and so keeps it absent.
      if (appendMode && statement instanceof StateArrayPushNode && dynamicNames.has(statement.name)) {
        // The element itself is not invalidated: a struct construction is a call node, and the very value this
        // write pushes is the one such a node produces. A call the serializer cannot name makes the value
        // undefined anyway, so nothing is guessed.
        const write = state.writes.get(statement.name)!;
        write.minimum += 1;
        write.maximum += 1;
        write.value = serialize(statement.value, state);
        continue;
      }
      // A write that rebuilds an element of the pushed variable in place does not add an element: the run still
      // grows by the one element the push appended, and the element rebuilt is that one. The fields it writes are
      // folded into the stated element, so what this map publishes is the element the body writes rather than the
      // default the push appended before the rebuild replaced its fields. Consecutive field writes are joined into
      // one constructor first; once that constructor names every field it no longer reads the array, but it is
      // still the rebuild (marked fieldRebuild) and the constructor itself is the element. A rebuild this replay
      // cannot follow leaves the variable unstated rather than defaulted. A write whose value does not read the
      // variable and is not that marked rebuild replaces it (or an element) with an independent value, which this
      // replay does not model, so it falls through to the invalidation and keeps the entry absent.
      if (appendMode && statement instanceof StateArrayAssignNode && dynamicNames.has(statement.name)
        && (readsVariable(statement.value, statement.name) || statement.fieldRebuild === true)) {
        const write = state.writes.get(statement.name)!;
        const folded = readsVariable(statement.value, statement.name)
          ? foldElementRebuild(write, statement, state)
          : replaceRebuiltElement(write, statement, state);
        if (folded !== undefined) {
          write.value = folded;
          continue;
        }
        write.maximum = Number.POSITIVE_INFINITY;
        write.value = undefined;
        continue;
      }
      if (!appendMode && statement instanceof StateAssignNode && dynamicNames.has(statement.name)) {
        invalidateUnknownMutations(statement.expression, state);
        const write = state.writes.get(statement.name)!;
        write.minimum += 1;
        write.maximum += 1;
        write.value = serialize(statement.expression, state);
        continue;
      }
      if (statement instanceof BranchNode) {
        invalidateUnknownMutations(statement.condition, state);
        const condition = serialize(statement.condition, state);
        const incomingBindingKeys = new Set(state.bindings.keys());
        const ifState = processBlock(statement.ifBlock, cloneState(state));
        const elseState = statement.elseBlock
          ? processBlock(statement.elseBlock, cloneState(state)) : cloneState(state);
        // An arm whose last statement is a `revert` never completes: a revert aborts, and no abrupt completion the
        // replay would honour (a return, break or continue) survives the scan above. Such an arm contributes no
        // completing path, so it neither halves the write count nor blanks the value; the other arm alone is what
        // every completing path took. This is the `if (guard) { revert } else { body }` shape a modifier guard
        // lowers to, and the same fact the constructor replay already applies to a write after such a branch.
        const ifAborts = armAlwaysReverts(statement.ifBlock);
        const elseAborts = statement.elseBlock !== undefined && armAlwaysReverts(statement.elseBlock);
        if (ifAborts !== elseAborts) {
          const surviving = ifAborts ? elseState : ifState;
          for (const [key, value] of surviving.bindings) state.bindings.set(key, value);
          state.blockedNames = surviving.blockedNames;
          state.writes = surviving.writes;
          continue;
        }
        // Both arms revert, so the branch itself never completes and nothing past it is reached on a completing
        // path; no dynamic value can be published from it.
        if (ifAborts && elseAborts) {
          for (const name of dynamicNames) {
            state.writes.set(name, { minimum: 0, maximum: Number.POSITIVE_INFINITY, value: undefined });
          }
          continue;
        }
        for (const key of incomingBindingKeys) {
          state.bindings.set(key, joinExpression(
            condition, ifState.bindings.get(key), elseState.bindings.get(key),
          ));
        }
        state.blockedNames = new Set([...ifState.blockedNames, ...elseState.blockedNames]);
        for (const name of dynamicNames) {
          const ifWrite = ifState.writes.get(name)!;
          const elseWrite = elseState.writes.get(name)!;
          state.writes.set(name, {
            minimum: Math.min(ifWrite.minimum, elseWrite.minimum),
            maximum: Math.max(ifWrite.maximum, elseWrite.maximum),
            value: joinExpression(condition, ifWrite.value, elseWrite.value),
          });
        }
        continue;
      }
      if (statement instanceof BlockNode) {
        const incomingBindingKeys = new Set(state.bindings.keys());
        const nested = processBlock(statement, cloneState(state));
        for (const key of incomingBindingKeys) state.bindings.set(key, nested.bindings.get(key));
        state.blockedNames = nested.blockedNames;
        state.writes = nested.writes;
        continue;
      }

      // Requirements, scalar state writes, events, and other side-effect-free-for-replay statements may sit
      // beside a dynamic initialiser. If an unfamiliar construct hides a relevant mutation, fail closed only
      // for the affected value/binding rather than discarding independent constructor metadata.
      invalidateUnknownMutations(statement, state);
    }
    return state;
  };

  const completed = processBlock(func.body, initial);
  // A constructor's write is a whole-value assignment, so the last one every completing path makes is the value it
  // leaves, however many precede it. An entry's write is an append, and the stated element is the whole append only
  // when every completing path pushes exactly one: several pushes leave the variable unstated, and its growth alone
  // sizes the run, so a consumer refuses the element by name rather than sizing the run as one element.
  return Object.fromEntries([...completed.writes]
    .filter(([, write]) => write.value !== undefined && (appendMode
      ? write.minimum === 1 && write.maximum === 1
      : write.minimum >= 1 && Number.isFinite(write.maximum)))
    .map(([name, write]) => [name, write.value!]));
};

/**
 * Publish how many elements a framed entry's own write appends to each dynamic value it writes.
 *
 * A framed body holds a dynamic value in a run of chunk records at the value's own collection covenant, and an
 * append grows that run. The hop has to state the run's width before the body runs, and the width is the value the
 * deployment holds plus the elements the write appends. The element's own bytes are published separately, in
 * `dynamicWriteSources`, whenever the artifact's vocabulary can state them; this map is what remains when it cannot
 * - a `push()` whose in-place field fills name a machine value the vocabulary has no word for still grows the run
 * by that one element, and the run can be sized without stating the element at all.
 *
 * The count is the same on every completing path that appends. A write the body performs inside a run-time loop
 * appends the count once per turn, so the total is the loop's width: the loop's array is published when the call
 * carries it (`varyingArrayParam`), and the loop is marked `looping` when the compiler cannot pin its width to a
 * call parameter, so a consumer refuses that shape by name rather than guessing a width. A variable whose write the
 * body also performs the other way - an assignment, a pop, or a straight push beside a loop - is left absent.
 *
 * Only the framed convention reads this fact; the other conventions' artifacts are unchanged.
 */
const dynamicWriteGrowthOf = (
  func: FunctionDefinitionNode,
  _contract: ContractNode | undefined,
  compilerOptions: CompilerOptions = {},
): Readonly<Record<string, DynamicWriteGrowthAbi>> => {
  if (compilerOptions.composition !== 'framed' || func.name === '__construct' || !func.body) return {};
  const names = new Set(func.dynamicWrites ?? []);
  if (names.size === 0) return {};
  const parameterNames = new Set(func.parameters
    .filter((parameter) => !parameter.name.startsWith('__internal__'))
    .map((parameter) => parameter.name));

  // True when an expression reads the named array (the state variable or the loop cache the pass redirects writes
  // through): an indexed write whose own value does so rebuilds an element in place (no element is appended).
  const readsVariable = (expression: ExpressionNode, name: string): boolean => {
    const seen = new Set<object>();
    const visit = (value: unknown): boolean => {
      if (!(value instanceof Node) || seen.has(value)) return false;
      seen.add(value);
      if ((value instanceof MappingAccessNode || value instanceof StateAccessNode
        || value instanceof IdentifierNode) && value.name === name) return true;
      for (const [key, child] of Object.entries(value)) {
        if (['location', 'definition', 'symbolTable', 'stateVariable', 'collection'].includes(key)) continue;
        if (child instanceof Node && visit(child)) return true;
        if (Array.isArray(child) && child.some((item) => visit(item))) return true;
      }
      return false;
    };
    return visit(expression);
  };

  // A dynamic state array written inside a loop is cached in a local (`CacheDynamicArrayInLoop`), so the writes are
  // spelled `__dlcache_<name>` and a flush writes the local back at every exit. Both spellings name the state
  // array, and the flush is the write the body's own append produced rather than a second, independent one.
  const dynamicName = (name: string): string | undefined => {
    const root = name.startsWith('__dlcache_') ? name.slice('__dlcache_'.length) : name;
    return names.has(root) ? root : undefined;
  };
  const writeTarget = (statement: Node): string | undefined => {
    const named = statement as unknown as { name?: string };
    if (named.name === undefined || !/(?:Push|Pop|Delete|Assign)Node$/.test(statement.constructor.name)) {
      return undefined;
    }
    return dynamicName(named.name);
  };
  const isCacheFlush = (statement: Node, target: string): boolean =>
    statement instanceof StateAssignNode && statement.name === target
    && statement.expression instanceof IdentifierNode && statement.expression.name === `__dlcache_${target}`;

  const abruptControl = new Set(['ReturnNode', 'BreakNode', 'ContinueNode', 'TryCatchNode']);
  const hasAbrupt = (value: unknown, seen = new Set<object>()): boolean => {
    if (!(value instanceof Node) || seen.has(value)) return false;
    seen.add(value);
    if (abruptControl.has(value.constructor.name)) return true;
    for (const [key, child] of Object.entries(value)) {
      if (['location', 'definition', 'symbolTable'].includes(key)) continue;
      if (child instanceof Node && hasAbrupt(child, seen)) return true;
      if (Array.isArray(child) && child.some((item) => hasAbrupt(item, seen))) return true;
    }
    return false;
  };
  const armAlwaysReverts = (block: BlockNode): boolean =>
    block.statements?.at(-1) instanceof RevertNode && !hasAbrupt(block);

  // True when a statement writes a dynamic value in a way this analysis does not model as an append, or calls a
  // helper that does. Fail closed: the variable is left absent rather than counted short.
  const touchesDynamicWrite = (value: unknown, seen = new Set<object>()): boolean => {
    if (!(value instanceof Node) || seen.has(value)) return false;
    seen.add(value);
    if (value instanceof FunctionCallNode) {
      const callee = value.resolvedFunction;
      if (callee !== undefined && callee !== func && callee.body !== undefined
        && touchesDynamicWrite(callee.body, seen)) return true;
    }
    if (writeTarget(value) !== undefined) return true;
    for (const [key, child] of Object.entries(value)) {
      if (['location', 'definition', 'symbolTable', 'resolvedFunction', 'functionReference',
        'stateVariable', 'collection'].includes(key)) continue;
      if (child instanceof Node && touchesDynamicWrite(child, seen)) return true;
      if (Array.isArray(child) && child.some((item) => touchesDynamicWrite(item, seen))) return true;
    }
    return false;
  };

  // The name of a call parameter whose array length bounds the expression, when one does. `for (i < who.length)`
  // is the loop whose width the call itself states; any other bound is a width the call does not carry.
  const lengthParamOf = (value: unknown, seen = new Set<object>()): string | undefined => {
    if (!(value instanceof Node) || seen.has(value)) return undefined;
    seen.add(value);
    if (value instanceof UnaryOpNode && value.operator === UnaryOperator.SIZE
      && value.expression instanceof IdentifierNode && parameterNames.has(value.expression.name)) {
      return value.expression.name;
    }
    for (const [key, child] of Object.entries(value)) {
      if (['location', 'definition', 'symbolTable'].includes(key)) continue;
      if (child instanceof Node) {
        const found = lengthParamOf(child, seen);
        if (found !== undefined) return found;
      } else if (Array.isArray(child)) {
        for (const item of child) {
          const found = lengthParamOf(item, seen);
          if (found !== undefined) return found;
        }
      }
    }
    return undefined;
  };

  const isLoopNode = (node: Node): boolean =>
    node instanceof WhileNode || node instanceof DoWhileNode || node instanceof CollectionIterationNode;
  const loopBodyOf = (node: Node): BlockNode =>
    node instanceof WhileNode || node instanceof DoWhileNode ? node.block : (node as CollectionIterationNode).body;
  const loopConditionOf = (node: Node): ExpressionNode | undefined =>
    node instanceof WhileNode || node instanceof DoWhileNode ? node.condition : undefined;

  const addCounts = (target: Map<string, number>, source: ReadonlyMap<string, number>): void => {
    for (const [name, count] of source) target.set(name, (target.get(name) ?? 0) + count);
  };
  const sameCounts = (left: ReadonlyMap<string, number>, right: ReadonlyMap<string, number>): boolean => {
    for (const name of names) if ((left.get(name) ?? 0) !== (right.get(name) ?? 0)) return false;
    return true;
  };

  // The elements one turn of a loop appends. A nested loop, an early exit, or any other write to a dynamic value
  // makes the per-turn count indeterminate, so the whole loop is left unstated rather than counted short.
  const perTurnAppends = (block: BlockNode): Map<string, number> | undefined => {
    const state = new Map<string, number>();
    for (const statement of block.statements ?? []) {
      const target = writeTarget(statement);
      if (target !== undefined) {
        if (statement instanceof StateArrayPushNode || statement instanceof ArrayPushNode) {
          state.set(target, (state.get(target) ?? 0) + 1);
          continue;
        }
        if ((statement instanceof StateArrayAssignNode || statement instanceof ArrayAssignNode)
          && readsVariable(statement.value, statement.name)) continue;
        if (isCacheFlush(statement, target)) continue;
        return undefined;
      }
      if (statement instanceof BranchNode) {
        const ifCounts = perTurnAppends(statement.ifBlock);
        const elseCounts = statement.elseBlock ? perTurnAppends(statement.elseBlock) : new Map<string, number>();
        if (ifCounts === undefined || elseCounts === undefined) return undefined;
        const ifAborts = armAlwaysReverts(statement.ifBlock);
        const elseAborts = statement.elseBlock !== undefined && armAlwaysReverts(statement.elseBlock);
        if (ifAborts !== elseAborts) { addCounts(state, ifAborts ? elseCounts : ifCounts); continue; }
        if (ifAborts && elseAborts) return undefined;
        if (!sameCounts(ifCounts, elseCounts)) return undefined;
        addCounts(state, ifCounts);
        continue;
      }
      if (statement instanceof BlockNode) {
        const nested = perTurnAppends(statement);
        if (nested === undefined) return undefined;
        addCounts(state, nested);
        continue;
      }
      if (isLoopNode(statement) || hasAbrupt(statement) || touchesDynamicWrite(statement)) return undefined;
    }
    return state;
  };

  interface Growth { straight: number; loop?: { perTurn: number; arrayParam?: string } }
  const blockAppends = (block: BlockNode): Map<string, Growth> | undefined => {
    const state = new Map<string, Growth>();
    const bumpStraight = (name: string): void => {
      const growth = state.get(name) ?? { straight: 0 };
      growth.straight += 1;
      state.set(name, growth);
    };
    // Fold in growth a statement that always runs contributes: the counts add, and one variable cannot carry two
    // appending loops, whose widths would have to be added rather than named.
    const addGrowth = (source: ReadonlyMap<string, Growth>): boolean => {
      for (const [name, growth] of source) {
        const existing = state.get(name) ?? { straight: 0 };
        const loops = [existing.loop, growth.loop].filter(
          (loop): loop is NonNullable<Growth['loop']> => loop !== undefined,
        );
        if (loops.length > 1) return false;
        state.set(name, {
          straight: existing.straight + growth.straight,
          ...(loops.length === 0 ? {} : { loop: loops[0]! }),
        });
      }
      return true;
    };
    // Fold in one arm of a branch, which every completing path either took or did not: the arms must agree for the
    // write to be the same one on every path.
    const sameGrowth = (left: ReadonlyMap<string, Growth>, right: ReadonlyMap<string, Growth>): boolean => {
      for (const name of names) {
        const one = left.get(name) ?? { straight: 0 };
        const other = right.get(name) ?? { straight: 0 };
        if (one.straight !== other.straight) return false;
        if ((one.loop === undefined) !== (other.loop === undefined)) return false;
        if (one.loop !== undefined && other.loop !== undefined
          && (one.loop.perTurn !== other.loop.perTurn || one.loop.arrayParam !== other.loop.arrayParam)) {
          return false;
        }
      }
      return true;
    };
    for (const statement of block.statements ?? []) {
      const target = writeTarget(statement);
      if (target !== undefined) {
        if (statement instanceof StateArrayPushNode || statement instanceof ArrayPushNode) {
          bumpStraight(target);
          continue;
        }
        if ((statement instanceof StateArrayAssignNode || statement instanceof ArrayAssignNode)
          && readsVariable(statement.value, statement.name)) continue;
        if (isCacheFlush(statement, target)) continue;
        return undefined;
      }
      if (statement instanceof BranchNode) {
        const ifState = blockAppends(statement.ifBlock);
        const elseState = statement.elseBlock ? blockAppends(statement.elseBlock) : new Map<string, Growth>();
        if (ifState === undefined || elseState === undefined) return undefined;
        const ifAborts = armAlwaysReverts(statement.ifBlock);
        const elseAborts = statement.elseBlock !== undefined && armAlwaysReverts(statement.elseBlock);
        // One arm always reverts, so every completing path took the other: only it contributes.
        if (ifAborts !== elseAborts) {
          if (!addGrowth(ifAborts ? elseState : ifState)) return undefined;
          continue;
        }
        if (ifAborts && elseAborts) return undefined;
        if (!sameGrowth(ifState, elseState) || !addGrowth(ifState)) return undefined;
        continue;
      }
      if (statement instanceof BlockNode) {
        const nested = blockAppends(statement);
        if (nested === undefined || !addGrowth(nested)) return undefined;
        continue;
      }
      if (isLoopNode(statement)) {
        const turn = perTurnAppends(loopBodyOf(statement));
        if (turn === undefined) return undefined;
        const condition = loopConditionOf(statement);
        const arrayParam = condition === undefined ? undefined : lengthParamOf(condition);
        for (const [name, perTurn] of turn) {
          const existing = state.get(name);
          if (existing !== undefined && (existing.loop !== undefined || existing.straight > 0)) return undefined;
          state.set(name, {
            straight: 0,
            loop: { perTurn, ...(arrayParam === undefined ? {} : { arrayParam }) },
          });
        }
        continue;
      }
      if (touchesDynamicWrite(statement)) return undefined;
    }
    return state;
  };

  const completed = blockAppends(func.body);
  if (completed === undefined) return {};
  const growth: Record<string, DynamicWriteGrowthAbi> = {};
  for (const name of names) {
    const found = completed.get(name);
    if (found === undefined || (found.straight === 0 && found.loop === undefined)) continue;
    if (found.loop !== undefined) {
      // A straight push beside a loop append is not one count, so the variable stays unstated.
      if (found.straight > 0) continue;
      growth[name] = {
        elements: found.loop.perTurn,
        ...(found.loop.arrayParam === undefined
          ? { looping: true } : { varyingArrayParam: found.loop.arrayParam }),
      };
      continue;
    }
    growth[name] = { elements: found.straight };
  }
  return growth;
};

/**
 * Publish the order a framed frame declares the runs of chunk records its dynamic writes occupy.
 *
 * The frame's write segment declares, past its own state records, every sorted batch's groups in `sortedBatchInfo`
 * order and then one run per written dynamic value, in state declaration order: the order code generation pins the
 * runs in (`emitDynamicWriteVerification`) and a read steps past them in (`dynamicReadPriorRuns`). `dynamicWrites`
 * lists the values in the order the body's writes were emitted, which need not be that one, so a consumer that lays
 * several runs, or one beside several batches, lays them by this list. One run beside at most one batch sits past
 * that batch's groups and needs no statement: such an entry publishes none, and no other convention publishes any.
 */
const dynamicWriteOrderOf = (
  func: FunctionDefinitionNode,
  contract: ContractNode | undefined,
  compilerOptions: CompilerOptions = {},
): readonly string[] => {
  if (compilerOptions.composition !== 'framed' || contract === undefined || func.name === '__construct') return [];
  const written = new Set(func.dynamicWrites ?? []);
  if (written.size === 0 || (written.size === 1 && (func.sortedBatchInfo?.length ?? 0) <= 1)) return [];
  return contract.stateVariables.filter((variable) => written.has(variable.name)).map((variable) => variable.name);
};

/** Publish only straight-line, single dynamic writes whose value has a fully typed pre-state recipe. */
const dynamicWriteRecipesOf = (
  func: FunctionDefinitionNode, contract: ContractNode | undefined,
): Readonly<Record<string, ChildDeploymentValueRecipe>> => {
  if (func.name === '__construct' || !func.body || !contract) return {};
  const statements = func.body.statements ?? [];
  const writes = statements.filter((statement): statement is StateAssignNode => statement instanceof StateAssignNode);
  if (writes.length !== 1 || statements.some((statement) =>
    !(statement instanceof StateAssignNode)
    && !(statement instanceof RequireNode
      && statement.expression instanceof BoolLiteralNode && statement.expression.value))) return {};
  const write = writes[0];
  const variable = contract.stateVariables.find((candidate) => candidate.name === write.name && candidate.isDynamic);
  if (!variable || !(write.expression.type?.toString() === variable.type.toString())) return {};
  const visible = func.parameters.filter((parameter) => !parameter.name.startsWith('__internal__'));
  const inputs = new Map(visible.map((parameter, index) => [parameter.name, index]));
  const inputTypes = new Map(visible.map((parameter) => [parameter.name, abiTypeString(parameter.type)]));
  const aliases = new Map<object, ChildDeploymentValueRecipe>([[variable, {
    kind: 'state', name: variable.name, resultType: abiTypeString(variable.type),
  }]]);
  const definitions = new Map<string, object>([[`this.${variable.name}`, variable]]);
  const recipe = childDeploymentValueRecipe(
    write.expression, inputs, true, inputTypes, aliases, definitions,
  );
  return recipe?.resultType === abiTypeString(variable.type) ? { [variable.name]: recipe } : {};
};

const transferEffects = (
  fn: FunctionDefinitionNode, contract: ContractNode,
): readonly FixedBchTransferAbi[] => {
  const transfers: {
    transferIndex: number; recipient: ExpressionNode; amount: ExpressionNode; callOption?: 'value';
    condition?: ExpressionNode; conditionUnsupported?: true;
    node?: TransferStatementNode | AddressTransferStatementNode | AddressSendExpressionNode
    | ExternalFunctionCallNode | InstantiationNode;
  }[] = [];
  const visibleInputs = fn.parameters.filter((parameter) => !parameter.name.startsWith('__internal__'));
  const inputIndex = new Map(visibleInputs.map((parameter, index) => [parameter.name, index]));
  const inputTypes = new Map(visibleInputs.map((parameter) => [parameter.name, abiTypeString(parameter.type)]));
  const reassignedDefinitions = new Set<object>();
  const reassignedNames = new Set<string>();
  const scanAssignments = (value: unknown, scanned = new WeakSet<object>()): void => {
    if (Array.isArray(value)) { value.forEach((item) => scanAssignments(item, scanned)); return; }
    if (!(value instanceof Node) || scanned.has(value)) return;
    scanned.add(value);
    if (value instanceof AssignNode) {
      reassignedNames.add(value.identifier.name);
      const definition = value.identifier.definition?.definition;
      if (definition) reassignedDefinitions.add(definition);
    }
    if (value instanceof TryCatchNode) {
      scanAssignments(value.expression, scanned);
      scanAssignments(value.tryBlock, scanned);
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (['resolvedFunction', 'functionReference', 'definition', 'symbolTable',
        'referencedContract', 'stateVariable', 'collection'].includes(key)) continue;
      scanAssignments(child, scanned);
    }
  };
  scanAssignments(fn.body);
  const operandRecipe = (
    expression: ExpressionNode, resolving = new Set<object>(),
  ): ChildDeploymentValueRecipe | undefined => {
    const direct = childDeploymentValueRecipe(expression, inputIndex, false, inputTypes);
    if (direct) return direct;
    if (!(expression instanceof IdentifierNode) || reassignedNames.has(expression.name)) return undefined;
    const definition = expression.definition?.definition;
    if (!(definition instanceof VariableDefinitionNode) || !definition.expression
      || reassignedDefinitions.has(definition) || resolving.has(definition)) return undefined;
    const nested = new Set(resolving);
    nested.add(definition);
    return operandRecipe(definition.expression, nested);
  };
  const fixedEffectRecipes = analyzeFixedBchEffectRecipes(
    fn, contract.functions, contract.stateVariables, contract.collections,
  );
  const contractRecipientRecipes = analyzeChildDeploymentRecipes(fn);
  const activationExpression = (
    recipe: ChildDeploymentValueRecipe,
  ): ExternalCallExpression => {
    const containsEntry = (value: unknown): boolean => value !== null && typeof value === 'object'
      && ((value as { kind?: string }).kind === 'entry' || Object.values(value).some(containsEntry));
    if (containsEntry(recipe)) return { kind: 'fixedEffectRecipe', fixedEffectRecipe: recipe };
    if (recipe.kind === 'entry') throw new Error('Entry recipe must use the typed activation protocol');
    if (recipe.kind === 'handlerInput') {
      return { kind: 'source', source: { kind: 'forward', paramIndex: recipe.inputIndex } };
    }
    if (recipe.kind === 'state') {
      return { kind: 'state', name: recipe.name };
    }
    if (recipe.kind === 'logicalCaller') {
      throw new Error('Logical-caller recipe cannot be used as a fixed-effect activation');
    }
    if (recipe.kind === 'intLiteral') {
      // External-call expressions use the VM's canonical integer literal spelling; casts around bounded values
      // retain their source width independently.
      return { kind: 'literal', type: 'bigint', value: recipe.value };
    }
    if (recipe.kind === 'boolLiteral') {
      return { kind: 'literal', type: 'bool', value: recipe.value };
    }
    if (recipe.kind === 'bytesLiteral') {
      return { kind: 'literal', type: recipe.resultType, value: recipe.value };
    }
    if (recipe.kind === 'cast') {
      return { kind: 'cast', type: recipe.resultType, expression: activationExpression(recipe.operand) };
    }
    if (recipe.kind === 'unary') {
      return { kind: 'unary', operator: recipe.operator, expression: activationExpression(recipe.operand) };
    }
    if (recipe.kind === 'aggregate') {
      throw new Error('Aggregate recipe cannot be used as a fixed-effect activation');
    }
    if (recipe.kind === 'concat' || recipe.kind === 'hash') {
      throw new Error('Byte operation recipe cannot be used as a fixed-effect activation');
    }
    if (recipe.kind === 'conditional') {
      return {
        kind: 'ternary',
        condition: activationExpression(recipe.condition),
        ifTrue: activationExpression(recipe.ifTrue),
        ifFalse: activationExpression(recipe.ifFalse),
      };
    }
    return {
      kind: 'binary', operator: recipe.operator,
      left: activationExpression(recipe.left), right: activationExpression(recipe.right),
    };
  };
  const seen = new Set<object>();
  const combine = (
    outer: ExpressionNode | undefined, inner: ExpressionNode, negate: boolean,
  ): ExpressionNode => {
    const selected = negate ? new UnaryOpNode(UnaryOperator.NOT, inner) : inner;
    return outer ? new BinaryOpNode(outer, BinaryOperator.AND, selected) : selected;
  };
  const visit = (value: unknown, condition?: ExpressionNode, conditionUnsupported = false): void => {
    if (!(value instanceof Node) || seen.has(value)) return;
    seen.add(value);
    if (value instanceof TransferStatementNode && !value.runtimeLoopTransfer) {
      transfers.push({
        transferIndex: value.transferIndex, recipient: value.lockingBytecode, amount: value.amount,
        condition, node: value, ...(conditionUnsupported && { conditionUnsupported: true }),
      });
      return;
    }
    if (value instanceof AddressTransferStatementNode || value instanceof AddressSendExpressionNode) {
      transfers.push({
        transferIndex: value.transferIndex, recipient: value.addressExpression, amount: value.amount,
        condition, node: value, ...(conditionUnsupported && { conditionUnsupported: true }),
      });
      return;
    }
    if (value instanceof ExternalFunctionCallNode && value.interfaceName === '__raw__'
      && value.callOptions?.value
      && value.valueTransferIndex >= 0) {
      transfers.push({
        transferIndex: value.valueTransferIndex,
        recipient: value.addressExpression,
        amount: value.callOptions.value,
        callOption: 'value',
        condition,
        node: value,
        ...(conditionUnsupported && { conditionUnsupported: true }),
      });
    }
    if (value instanceof InstantiationNode && value.referencedContract
      && !value.isStatefulDeploy && hasEffectiveCallValue(value.callOptions?.value)) {
      transfers.push({
        transferIndex: value.transferIndex,
        recipient: value,
        amount: value.callOptions.value,
        condition,
        node: value,
        ...(conditionUnsupported && { conditionUnsupported: true }),
      });
      return;
    }
    if (value instanceof BranchNode) {
      visit(value.condition, condition, conditionUnsupported);
      visit(value.ifBlock, combine(condition, value.condition, false), conditionUnsupported);
      if (value.elseBlock) {
        visit(value.elseBlock, combine(condition, value.condition, true), conditionUnsupported);
      }
      return;
    }
    if (value instanceof SwitchNode) {
      let defaultCondition = condition;
      for (const arm of value.cases) {
        const matches = new BinaryOpNode(value.expression, BinaryOperator.EQ, arm.value);
        visit(arm.body, combine(condition, matches, false), conditionUnsupported);
        const misses = new BinaryOpNode(value.expression, BinaryOperator.NE, arm.value);
        defaultCondition = defaultCondition
          ? new BinaryOpNode(defaultCondition, BinaryOperator.AND, misses) : misses;
      }
      if (value.defaultCase) visit(value.defaultCase, defaultCondition, conditionUnsupported);
      return;
    }
    if (value instanceof TryCatchNode) {
      // Failed foreign execution aborts the BCH transaction; among successful spends the try body is therefore
      // the straight-line continuation and requires no additional activation witness.
      visit(value.tryBlock, condition, conditionUnsupported);
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if ([
        'resolvedFunction', 'functionReference', 'definition', 'symbolTable',
        'referencedContract', 'stateVariable', 'collection',
      ].includes(key)) continue;
      if (child instanceof Node) visit(child, condition, conditionUnsupported);
      else if (Array.isArray(child)) for (const item of child) visit(item, condition, conditionUnsupported);
    }
  };
  visit(fn.body);
  return transfers.sort((a, b) => a.transferIndex - b.transferIndex).map((transfer) => {
    const effect = transfer.node && fixedEffectRecipes.get(transfer.node);
    const preserveFixedOperandShape = (
      recipe: ChildDeploymentValueRecipe | undefined,
    ): ChildDeploymentValueRecipe | undefined => recipe?.kind === 'handlerInput'
      ? { kind: 'handlerInput', inputIndex: recipe.inputIndex } : recipe;
    const recipientRecipe = preserveFixedOperandShape(
      effect?.recipient ?? (!transfer.node ? operandRecipe(transfer.recipient) : undefined),
    );
    const amountRecipe = preserveFixedOperandShape(
      effect?.amount ?? (!transfer.node ? operandRecipe(transfer.amount) : undefined),
    );
    const derivedRecipient = transfer.node instanceof InstantiationNode
      && transfer.node.referencedContract && transfer.node.creationBytecode
      ? (() => {
        const analysis = contractRecipientRecipes.get(transfer.node);
        const constructorInputs = transfer.node.referencedContract.parameters.map((parameter) => ({
          name: parameter.name, type: abiTypeString(parameter.type),
        }));
        const constructorArgs = analysis?.constructorArgs.slice(0, constructorInputs.length);
        if (!constructorArgs || constructorArgs.some((recipe) => recipe === undefined)
          || (transfer.node!.callOptions?.salt !== undefined && analysis?.salt === undefined)) return undefined;
        return {
          contractName: transfer.node!.referencedContract!.name,
          creationBytecode: transfer.node!.creationBytecode!,
          constructorInputs,
          constructorArgs: constructorArgs as ChildDeploymentValueRecipe[],
          ...(analysis?.salt && { salt: analysis.salt }),
        };
      })() : undefined;
    // Inlined low-level helpers can retain their source branch in this artifact walk after flow analysis has
    // flattened that branch around the cloned effect node. Recover a condition expressed directly in handler
    // inputs/literals through the same executable recipe language; aliases still require the flow snapshot.
    const conditionRecipe = effect?.activation
      ?? (transfer.condition ? operandRecipe(transfer.condition) : undefined);
    if (transfer.callOption && !conditionRecipe
      && (globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_TRANSFER_EFFECTS === '1') {
      console.error('fixed-bch-callvalue-activation-missing', {
        function: fn.name,
        hasTreeCondition: transfer.condition !== undefined,
        effect,
      });
    }
    if (transfer.condition && !conditionRecipe
      && (globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_TRANSFER_EFFECTS === '1') {
      const candidate = transfer.condition as ExpressionNode & {
        operator?: unknown; left?: ExpressionNode; right?: ExpressionNode;
      };
      console.error('fixed-bch-condition-recipe-missing', {
        function: fn.name,
        node: candidate.constructor.name,
        operator: candidate.operator,
        type: candidate.type?.toString(),
        left: candidate.left && {
          node: candidate.left.constructor.name,
          name: (candidate.left as IdentifierNode).name,
          type: candidate.left.type?.toString(),
          recipe: operandRecipe(candidate.left),
        },
        right: candidate.right && {
          node: candidate.right.constructor.name,
          type: candidate.right.type?.toString(),
          recipe: operandRecipe(candidate.right),
        },
      });
    }
    const condition = conditionRecipe && activationExpression(conditionRecipe);
    return {
      transferIndex: transfer.transferIndex,
      recipient: expressionSource(transfer.recipient, fn, contract),
      amount: expressionSource(transfer.amount, fn, contract),
      ...(recipientRecipe && { recipientRecipe }),
      ...(derivedRecipient && { derivedRecipient }),
      ...(amountRecipe && { amountRecipe }),
      ...(transfer.callOption && { callOption: transfer.callOption }),
      ...(transfer.conditionUnsupported || (effect && !effect.activationSupported && !condition)
        ? { condition: null }
        : condition ? { condition }
          : transfer.condition ? { condition: null } : {}),
    };
  });
};

/**
 * X135. True when every dynamic (chunk-backed) write this function publishes was RESERVED by the route's
 * journal rather than performed by the function.
 *
 * `GenerateTargetTraversal` pre-allocates one chunk slot per dynamic journal slot a handler HOLDS, and a
 * handler holds a slot it only READS: the epilogue then writes the pre-state value back unchanged, which is a
 * real co-spend of the chunk UTXOs and no state change at all. `dynamicWrites` stays published because the
 * build shape needs it - the SDK consumes and recreates those chunks - but a write-back is not a mutation,
 * and `writesState` is the flag that answers "output state == input state".
 *
 * Measured: ERC-20 `name()` / `symbol()` are `writesState: false` compiled DIRECT and were `true` compiled in
 * bus mode, from the same unchanged body. `decimals()` / `totalSupply()` never moved, because their journal
 * slots are scalar and X105 already gated the scalar sibling of this leak.
 *
 * SOUNDNESS. `scalarJournal` is set at GTT:2711 exactly when journal context is live AND the writer closure
 * reached this function, and that closure is transitive over internal calls (GTT:1745-1755) and over function
 * pointers (L2-F3), so a false answer cannot hide a write behind a helper. `journalContextArity` is set only
 * for a handler carrying live journal context, so DIRECT-mode dynamic writes - which carry none - are never
 * gated. The caller has already returned true for `scalarJournal`, so reaching here means "not a writer".
 */
const journalReservedDynamicWritesOnly = (func: FunctionDefinitionNode): boolean =>
  (func.journalContextArity ?? 0) > 0 && func.scalarJournal !== true;

/**
 * Conservatively decide whether a function mutates any covenant-derived state. Returns false ONLY when the body
 * has no stateful statement (state/array/mapping write, delete, emit, transfer, low-level/token-container op)
 * AND the function has no external call, child deploy, library delegate, dynamic-storage write, split/merge, or
 * covenant-bypass modifier. Any doubt -> true, so a misclassified writer never gets the SDK's derivation skip.
 */
function computeWritesState(func: FunctionDefinitionNode): boolean {
  if (func.sourceReadOnly) return false;
  if (func.scalarJournal) return true;
  if (containsStatefulOperation(func.body?.statements)) return true;
  if ((func.externalCalls?.length ?? 0) > 0) return true;
  if ((func.deployTargets?.length ?? 0) > 0) return true;
  if ((func.libraryDelegateCalls?.length ?? 0) > 0) return true;
  if ((func.dynamicWrites?.length ?? 0) > 0 && !journalReservedDynamicWritesOnly(func)) return true;
  if ((func.lowLevelCalls?.length ?? 0) > 0) return true;
  if (func.splitCountParam !== undefined || func.mergeCountParam !== undefined) return true;
  if (func.modifiers.some((m) => STATE_WRITING_MODIFIERS.includes(m))) return true;
  if (func.entryAccesses?.some((ea) => ea.operations.some((op) => op !== 'read'))) return true;
  return false;
}

// ----------------------------------------------------------------------------------------------------------
// X37. Value provenance: where a covenant-critical value came from, rather than what type it was spelled as.
// ----------------------------------------------------------------------------------------------------------

/**
 * How much a spender controls each provenance, weakest first.
 *
 * A value the caller passes is weakest. `computed` sits next because "the compiler could not say" is never
 * evidence of authority. The order exists so several binding sites, several key-set members, or several
 * signature guards can be folded into ONE published answer that always keeps the weakest: the published
 * field can then only ever understate the authority in force, which is a refusal, never an admission.
 */
const PROVENANCE_STRENGTH: Record<ValueProvenanceKind, number> = {
  parameter: 0, computed: 1, stateVar: 2, constructorArg: 3, literal: 4,
};

const COMPUTED_PROVENANCE: ValueProvenance = { kind: 'computed' };

const weakerProvenance = (left: ValueProvenance, right: ValueProvenance): ValueProvenance =>
  (PROVENANCE_STRENGTH[right.kind] < PROVENANCE_STRENGTH[left.kind] ? right : left);

// Links that leave the function body and reach whole other functions or contracts, where a same-named local
// would answer a different question. The same escape list the result-consumer walk below uses.
const PROVENANCE_WALK_SKIP = new Set([
  'location', 'resolvedFunction', 'functionReference', 'definition', 'symbolTable',
  'referencedContract', 'stateVariable', 'collection',
]);

/** Which argument of each signature builtin is the KEY the signature is checked against. */
const SIGNATURE_CHECK_KEY_ARGUMENT: Record<string, number> = {
  checkSig: 1, checkMultiSig: 1, checkDataSig: 2,
};

/**
 * Everything the provenance answers need from one function body, collected in ONE walk.
 *
 * `bindings` holds every expression that can bind a local name - the declaration initializer AND every later
 * assignment. Collecting the assignments is what makes the fold sound: resolving only the declaration would
 * let `address t = impl; t = address(target); t.delegatecall(input);` publish the constructor argument while
 * the call reaches the caller's bytes. Block scoping is deliberately ignored, so two same-named locals in
 * sibling blocks fold to the weaker of the two. `bound` also holds names bound by a form with no nameable
 * expression (a tuple destructure), which must resolve to `computed` rather than escape to the outer scopes.
 *
 * Building the index up front is what keeps this affordable: resolving each alias with its own walk turned
 * artifact generation into a per-identifier re-traversal of the whole body.
 */
interface ProvenanceIndex {
  bindings: Map<string, ExpressionNode[]>;
  bound: Set<string>;
  reassigned: Set<string>;
  calls: (LowLevelCallNode | LowLevelCallStatementNode)[];
  signatureChecks: FunctionCallNode[];
}

const bindName = (index: ProvenanceIndex, name: string, expression?: ExpressionNode): void => {
  index.bound.add(name);
  if (!expression) return;
  const existing = index.bindings.get(name);
  if (existing) existing.push(expression);
  else index.bindings.set(name, [expression]);
};

const indexBody = (fn: FunctionDefinitionNode): ProvenanceIndex => {
  const index: ProvenanceIndex = {
    bindings: new Map(), bound: new Set(), reassigned: new Set(), calls: [], signatureChecks: [],
  };
  const seen = new Set<object>();
  const walk = (value: unknown): void => {
    if (!(value instanceof Node) || seen.has(value)) return;
    seen.add(value);
    if (value instanceof VariableDefinitionNode) bindName(index, value.name, value.expression);
    else if (value instanceof AssignNode) {
      index.reassigned.add(value.identifier.name);
      bindName(index, value.identifier.name, value.expression);
    } else if (value instanceof TupleAssignmentNode) {
      for (const element of value.elements) if (!element.skip && element.name) {
        index.reassigned.add(element.name);
        bindName(index, element.name);
      }
    } else if (value instanceof LowLevelCallNode || value instanceof LowLevelCallStatementNode) {
      index.calls.push(value);
    } else if (value instanceof FunctionCallNode
      && SIGNATURE_CHECK_KEY_ARGUMENT[value.identifier.name] !== undefined) {
      index.signatureChecks.push(value);
    }
    // eslint-disable-next-line no-restricted-syntax, guard-for-in
    for (const key in value) {
      if (PROVENANCE_WALK_SKIP.has(key)) continue;
      const child = (value as unknown as Record<string, unknown>)[key];
      if (child instanceof Node) walk(child);
      else if (Array.isArray(child)) for (const item of child) walk(item);
    }
  };
  walk(fn.body);
  return index;
};

/**
 * Resolve an expression to where its value came from.
 *
 * Casts are stripped and local aliases are followed, so a `bytes` parameter re-spelled as an address -
 * `address t = address(target); t.delegatecall(input);` - resolves to `parameter`. That is the whole point:
 * the published TYPE of a delegatecall target says nothing about who chose it, and refusing `bytes`
 * parameters is not available because every admitted class carries a `bytes` calldata parameter.
 *
 * A function parameter answers `parameter` before its bindings are consulted: reassigning a parameter only
 * narrows it on the paths that run the assignment, so the caller's value survives on the others.
 */
const provenanceOf = (
  expression: ExpressionNode | undefined, fn: FunctionDefinitionNode, contract: ContractNode | undefined,
  index: ProvenanceIndex, resolving: Set<string> = new Set(),
): ValueProvenance => {
  if (!expression) return COMPUTED_PROVENANCE;
  if (expression instanceof CastNode) return provenanceOf(expression.expression, fn, contract, index, resolving);
  if (expression instanceof LiteralNode) return { kind: 'literal' };
  if (expression instanceof StateAccessNode) return { kind: 'stateVar', name: expression.name };
  // A key set (`checkMultiSig(sigs, [a, b])`) is only as strong as its weakest member.
  if (expression instanceof ArrayNode) {
    return expression.elements.length === 0 ? COMPUTED_PROVENANCE
      : expression.elements
        .map((element) => provenanceOf(element, fn, contract, index, resolving))
        .reduce(weakerProvenance);
  }
  if (!(expression instanceof IdentifierNode)) return COMPUTED_PROVENANCE;
  const { name } = expression;
  if (fn.parameters.some((parameter) => parameter.name === name)) return { kind: 'parameter', name };
  if (resolving.has(name)) return COMPUTED_PROVENANCE; // an alias cycle - refuse rather than pick an arm
  if (index.bound.has(name)) {
    const bindings = index.bindings.get(name);
    if (!bindings) return COMPUTED_PROVENANCE;
    resolving.add(name);
    const candidates = bindings.map((binding) => provenanceOf(binding, fn, contract, index, resolving));
    // Branch-lowered locals can have several assignments with equally strong but different origins. Picking the
    // first constructor argument would falsely describe a ternary target as fixed; disagreement is computed.
    const first = JSON.stringify(candidates[0]);
    const resolved = candidates.some((candidate) => JSON.stringify(candidate) !== first)
      ? COMPUTED_PROVENANCE : candidates.reduce(weakerProvenance);
    resolving.delete(name);
    return resolved;
  }
  if (contract?.parameters.some((parameter) => parameter.name === name)) return { kind: 'constructorArg', name };
  if (contract?.stateVariables.some((variable) => variable.name === name)) return { kind: 'stateVar', name };
  if (contract?.constantDefinitions.some((constant) => constant.name === name)) return { kind: 'literal' };
  return COMPUTED_PROVENANCE;
};

/**
 * Per-callIndex target provenance for this function's low-level calls.
 *
 * The call nodes carry the same `callIndex` the symbol-table pre-scan used to build `func.lowLevelCalls`, so
 * the rows line up by that index rather than by re-deriving the pre-scan's walk order here.
 */
const lowLevelCallTargets = (
  fn: FunctionDefinitionNode, contract: ContractNode | undefined, index: ProvenanceIndex,
): (ValueProvenance | undefined)[] => {
  const targets: (ValueProvenance | undefined)[] = [];
  for (const call of index.calls) {
    const resolved = provenanceOf(call.targetExpression, fn, contract, index);
    const existing = targets[call.callIndex];
    // Two nodes claiming one index means this walk and the pre-scan disagree; publish the weakest of them.
    targets[call.callIndex] = existing ? weakerProvenance(existing, resolved) : resolved;
  }
  return targets;
};

/** Publish only exact, side-effect-free call target recipes. A mutable local or any unsupported expression
 * remains unpublished, so SDK consumers cannot mistake a guessed origin for the address used by the script.
 * A target that reads a reassigned local is `null`: it has no exact source, and the call site's serialized
 * `targetSource` must not stand in for one, since that follows the local's declaration rather than its writes. */
const lowLevelCallTargetSources = (
  fn: FunctionDefinitionNode, index: ProvenanceIndex,
): (ExternalCallArgSource | null | undefined)[] => {
  const parameters = fn.parameters.filter((parameter) => !parameter.name.startsWith('__internal__'));
  let readsReassigned = false;
  const expressionOf = (value: ExpressionNode, resolving = new Set<string>()): ExternalCallExpression | undefined => {
    if (value instanceof IdentifierNode) {
      if (index.reassigned.has(value.name)) {
        readsReassigned = true;
        return undefined;
      }
      const paramIndex = parameters.findIndex((parameter) => parameter.name === value.name);
      if (paramIndex >= 0) return { kind: 'source', source: { kind: 'forward', paramIndex } };
      if (resolving.has(value.name)) return undefined;
      const definition = value.definition?.definition;
      const bindings = index.bindings.get(value.name);
      if (!(definition instanceof VariableDefinitionNode) || !definition.expression
        || bindings?.length !== 1 || bindings[0] !== definition.expression) return undefined;
      return expressionOf(definition.expression, new Set(resolving).add(value.name));
    }
    if (value instanceof CastNode) {
      const inner = expressionOf(value.expression, resolving);
      if (!inner) return undefined;
      const definition = value.expression instanceof IdentifierNode
        ? value.expression.definition?.definition : undefined;
      const identityAddressCast = value.type instanceof AddressType
        && (value.expression.type instanceof AddressType
          || (definition instanceof VariableDefinitionNode && definition.type instanceof AddressType));
      return identityAddressCast || value.type.toString() === value.expression.type?.toString()
        ? inner : { kind: 'cast', type: value.type.toString(), expression: inner };
    }
    if (value instanceof TernaryOpNode) {
      const condition = expressionOf(value.condition, resolving);
      const ifTrue = expressionOf(value.ifTrue, resolving);
      const ifFalse = expressionOf(value.ifFalse, resolving);
      return condition && ifTrue && ifFalse ? { kind: 'ternary', condition, ifTrue, ifFalse } : undefined;
    }
    return undefined;
  };
  const sources: (ExternalCallArgSource | null | undefined)[] = [];
  for (const call of index.calls) {
    readsReassigned = false;
    const expression = expressionOf(call.targetExpression);
    if (readsReassigned) sources[call.callIndex] = null;
    if (!expression || sources[call.callIndex] === null) continue;
    sources[call.callIndex] = expression.kind === 'source' && expression.source?.kind === 'forward'
      ? expression.source : { kind: 'expression', expression };
  }
  return sources;
};

/**
 * X51. The signature guard as the artifact publishes it: the weakest key any check in this body can be
 * satisfied against, plus what that key is PINNED to when the compiler proved a pin. Undefined when the body has
 * no signature check at all. A check whose key argument is absent resolves to `computed`, not to nothing.
 *
 * WHY THE SECOND FIELD EXISTS. `key` alone reads the standard BCH authorization idiom as unguarded:
 * `require(hash160(pk) == pkh); require(checkSig(s, pk))` publishes `{parameter, pk}`, because what makes it
 * authority is a separate require the key provenance does not describe. A consumer cannot reconstruct that from
 * types - a `bytes20` constructor argument beside a `pubkey` parameter is exactly the type reasoning X37 exists
 * to remove - so the compiler publishes the fact instead. `parameterCommitmentSource` is the same walk SEC-17's
 * diagnostic decides on, X46's writer strengthening included: a commitment against state this body already
 * overwrote from a caller parameter is not a commitment and yields nothing here either.
 *
 * THE FOLD IS THE WEAKEST, like `key`. Every check contributes a bound on the authority a spender must defeat:
 * what its key is pinned to when it is pinned, and its own key provenance when it is not. `keyCommitment` is the
 * weakest of those, so ONE unpinned parameter key anywhere in the body drags the published answer down to
 * `parameter` and no consumer allow-list admits it. The field appears only when at least one check IS pinned;
 * a body with no pin publishes no `keyCommitment`, which reads back as `unknown`. Understating the authority in
 * force is a refusal, never an admission - the same discipline `key` is folded under.
 */
const signatureGuardOf = (
  fn: FunctionDefinitionNode, contract: ContractNode | undefined, index: ProvenanceIndex,
): { key: ValueProvenance; keyCommitment?: ValueProvenance } | undefined => {
  let weakestKey: ValueProvenance | undefined;
  let weakestBound: ValueProvenance | undefined;
  let anyPinned = false;
  for (const check of index.signatureChecks) {
    const key = provenanceOf(
      check.parameters[SIGNATURE_CHECK_KEY_ARGUMENT[check.identifier.name]], fn, contract, index,
    );
    // Only a parameter can be pinned: every other kind is already something the caller does not hand in.
    const pinned = key.kind === 'parameter' && key.name !== undefined
      ? parameterCommitmentSource(key.name, fn)
      : undefined;
    if (pinned) anyPinned = true;
    const bound = pinned ? provenanceOf(pinned, fn, contract, index) : key;
    weakestKey = weakestKey ? weakerProvenance(weakestKey, key) : key;
    weakestBound = weakestBound ? weakerProvenance(weakestBound, bound) : bound;
  }
  if (!weakestKey) return undefined;
  return { key: weakestKey, ...(anyPinned && weakestBound && { keyCommitment: weakestBound }) };
};

interface ControlSite { block: BlockNode; index: number }

/**
 * X62. Prove that every delegatecall is reached only after a signature requirement on the same control-flow
 * path. Merely finding `checkSig` in the function is insufficient: a check in an optional branch authorizes no
 * code after that branch. This deliberately recognizes only requirements whose truth entails the signature
 * check (`checkSig(..)` itself, or an `&&` containing it); an `||` may succeed without evaluating the check.
 */
const signatureGuardDominatesDelegatecalls = (fn: FunctionDefinitionNode): boolean => {
  const guards: ControlSite[][] = [];
  const delegates: ControlSite[][] = [];
  const requiredCheck = (expression: ExpressionNode): boolean => {
    if (expression instanceof FunctionCallNode
      && SIGNATURE_CHECK_KEY_ARGUMENT[expression.identifier.name] !== undefined) return true;
    return expression instanceof BinaryOpNode && expression.operator === BinaryOperator.AND
      && (requiredCheck(expression.left) || requiredCheck(expression.right));
  };
  const seen = new Set<object>();
  const walk = (value: unknown, path: ControlSite[]): void => {
    if (!(value instanceof Node) || seen.has(value)) return;
    seen.add(value);
    if (value instanceof RequireNode && requiredCheck(value.expression)) guards.push(path);
    if ((value instanceof LowLevelCallNode || value instanceof LowLevelCallStatementNode)
      && value.callMode === 'delegatecall') delegates.push(path);
    if (value instanceof BlockNode) {
      for (const [index, statement] of (value.statements ?? []).entries()) {
        walk(statement, [...path, { block: value, index }]);
      }
      return;
    }
    // eslint-disable-next-line no-restricted-syntax, guard-for-in
    for (const key in value) {
      if (PROVENANCE_WALK_SKIP.has(key)) continue;
      const child = (value as unknown as Record<string, unknown>)[key];
      if (child instanceof Node) walk(child, path);
      else if (Array.isArray(child)) for (const item of child) walk(item, path);
    }
  };
  walk(fn.body, []);
  if (delegates.length === 0) return false;
  const dominates = (guard: ControlSite[], call: ControlSite[]): boolean => {
    const guardSite = guard[guard.length - 1];
    if (!guardSite) return false;
    const callLevel = call.findIndex((site) => site.block === guardSite.block);
    if (callLevel < 0 || guard.length - 1 !== callLevel) return false;
    return guard.slice(0, -1).every((site, index) => call[index]?.block === site.block
      && call[index]?.index === site.index)
      && guardSite.index < call[callLevel].index;
  };
  return delegates.every((call) => guards.some((guard) => dominates(guard, call)));
};

/** Publish only a direct, unconditional struct-parameter update whose source is the chain timestamp. */
function argumentFieldUpdatesOf(func: FunctionDefinitionNode): AbiFunction['argumentFieldUpdates'] {
  const timestamp = (expression: ExpressionNode): boolean => {
    if (expression instanceof CastNode) return timestamp(expression.expression);
    return (expression instanceof NullaryOpNode && expression.operator === NullaryOperator.BLOCK_TIMESTAMP)
      || (expression instanceof StateAccessNode && expression.name === '__block_timestamp');
  };
  const originalField = (expression: ExpressionNode, parameter: string, field: string): boolean =>
    expression instanceof FieldAccessNode && expression.name === field
      && expression.expression instanceof IdentifierNode && expression.expression.name === parameter;
  const writeCount = new Map<string, number>();
  const seen = new Set<Node>();
  const countWrites = (node: Node): void => {
    if (seen.has(node)) return;
    seen.add(node);
    if (node instanceof AssignNode) {
      writeCount.set(node.identifier.name, (writeCount.get(node.identifier.name) ?? 0) + 1);
    }
    for (const [key, value] of Object.entries(node)) {
      if (['location', 'type', 'definition', 'symbolTable', 'resolvedFunction', 'functionReference']
        .includes(key)) continue;
      if (value instanceof Node) countWrites(value);
      else if (Array.isArray(value)) for (const child of value) if (child instanceof Node) countWrites(child);
    }
  };
  if (func.body) countWrites(func.body);
  const updates: NonNullable<AbiFunction['argumentFieldUpdates']>[number][] = [];
  for (const statement of func.body?.statements ?? []) {
    if (!(statement instanceof AssignNode) || !statement.isReferenceDataWrite
      || !(statement.expression instanceof FunctionCallNode)) continue;
    const parameter = func.parameters.find((candidate) => candidate.name === statement.identifier.name
      && candidate.type instanceof StructType);
    if (!parameter || !(parameter.type instanceof StructType)
      || writeCount.get(parameter.name) !== 1) continue;
    const fields = parameter.type.fields;
    const rebuild = statement.expression;
    if (rebuild.identifier.name !== parameter.type.name || rebuild.parameters.length !== fields.length) continue;
    const changed = fields.flatMap((field, index) => timestamp(rebuild.parameters[index]) ? [index] : []);
    if (changed.length !== 1) continue;
    const [fieldIndex] = changed;
    if (!rebuild.parameters.every((value, index) => index === fieldIndex
      || originalField(value, parameter.name, fields[index].name))) continue;
    updates.push({ parameter: parameter.name, fieldPath: [fields[fieldIndex].name], source: 'blockTimestamp' });
  }
  return updates.length === 0 ? undefined : updates;
}

/** Build the common metadata fields for an ABI function entry. */
function buildFunctionAbiMetadata(
  func: FunctionDefinitionNode, isStateful = false, contract?: ContractNode,
  interfaces: readonly InterfaceNode[] = [], compilerOptions: CompilerOptions = {},
): Partial<AbiFunction> {
  const dynamicWriteSources = dynamicWriteSourcesOf(func, contract, compilerOptions);
  const dynamicWriteGrowth = dynamicWriteGrowthOf(func, contract, compilerOptions);
  const dynamicWriteOrder = dynamicWriteOrderOf(func, contract, compilerOptions);
  const dynamicWriteRecipes = dynamicWriteRecipesOf(func, contract);
  const iterationDomains = externalCallIterationDomainLists(func, compilerOptions, interfaces);
  const possibleSelectorTargets = (
    interfaceName: string, parameters: readonly ExpressionNode[],
  ): readonly { functionName: string; selector: string }[] => {
    const iface = interfaces.find((candidate) => candidate.name === interfaceName);
    if (!iface) return [];
    const types = parameters.map((parameter) => parameter.type?.toString());
    return iface.functions.filter((candidate) =>
      candidate.parameters.length === types.length
      && candidate.parameters.every((parameter, index) => parameter.type.toString() === types[index]))
      .map((candidate) => {
        const signature = `${candidate.name}(${candidate.parameters
          .map((parameter) => (compilerOptions.evmCompat
            ? canonicalSelectorType(parameter.type) : abiTypeString(parameter.type))).join(',')})`;
        return {
          functionName: candidate.name,
          selector: computeFunctionSelectorHex(signature, compilerOptions.evmCompat === true),
        };
      })
      .sort((left, right) => left.selector.localeCompare(right.selector));
  };
  const resultConsumers = (): readonly ExternalResultConsumerAbi[] => {
    const slots = func.externalCalls ?? [];
    const slotByCall = new Map<Node, number>(slots
      .filter((slot) => !!slot.sourceCallNode)
      .map((slot) => [slot.sourceCallNode!, slot.slotIndex] as const));
    const visit = (value: unknown, action: (node: Node) => void, seen = new Set<object>()): void => {
      if (!(value instanceof Node) || seen.has(value)) return;
      seen.add(value);
      action(value);
      for (const [key, child] of Object.entries(value)) {
        if ([
          'resolvedFunction', 'functionReference', 'definition', 'symbolTable',
          'referencedContract', 'stateVariable', 'collection',
        ].includes(key)) continue;
        if (child instanceof Node) visit(child, action, seen);
        else if (Array.isArray(child)) for (const item of child) visit(item, action, seen);
      }
    };
    if (func.body && slots.length >= 2
      && slots.some((slot) => slot.returnTypes?.length === 1)) {
    // A result can flow through state before a later call consumes it:
    // `items[i].id = producer.make(); consumer.use(items[i].id)`. Pre-transaction state cannot resolve that
    // consumer argument. Convert only an exact, dominating whole-field write into the external-call expression
    // form the SDK already knows how to derive. Computed writes remain unsupported rather than substituting a
    // raw result for an arithmetic or partial expression.
    type StatePath = { root: string; keys: readonly string[]; fields: readonly string[] };
    type StatementPosition = { block: BlockNode; index: number };
    type StateResultWrite = StatePath & {
      producerCallsiteId: number;
      producer: typeof slots[number];
      position: StatementPosition;
    };
    const visibleParameters = func.parameters.filter((parameter) =>
      !parameter.name.startsWith('__internal__'));
    const expressionKey = (expression: ExpressionNode, seen = new Set<Node>()): string => {
      if (seen.has(expression)) return `cycle:${expression.constructor.name}`;
      seen = new Set(seen);
      seen.add(expression);
      if (expression instanceof IdentifierNode) {
        const parameter = visibleParameters.findIndex((candidate) => candidate.name === expression.name);
        return parameter >= 0 ? `param:${parameter}` : `id:${expression.name}`;
      }
      if (expression instanceof LiteralNode) {
        const value = expression.value instanceof Uint8Array
          ? binToHex(expression.value) : String(expression.value);
        return `literal:${value}`;
      }
      if (expression instanceof CastNode) {
        return `cast:${expression.type.toString()}:${expressionKey(expression.expression, seen)}`;
      }
      if (expression instanceof BinaryOpNode) {
        return `binary:${expression.operator}:${expressionKey(expression.left, seen)}`
          + `:${expressionKey(expression.right, seen)}`;
      }
      if (expression instanceof FieldAccessNode) {
        return `field:${expressionKey(expression.expression, seen)}:${expression.name}`;
      }
      if (expression instanceof MappingAccessNode) {
        return `access:${expression.name}:${expression.keys.map((key) => expressionKey(key, seen)).join('|')}`;
      }
      if (expression instanceof ArrayAccessNode) {
        return `array:${expressionKey(expression.array, seen)}:${expressionKey(expression.index, seen)}`;
      }
      if (expression instanceof StateAccessNode) return `state:${expression.name}`;
      return `${expression.constructor.name}:${expression.location?.start.line ?? 0}`
        + `:${expression.location?.start.column ?? 0}`;
    };
    const serializedKey = (expression: ExternalCallExpression): string => {
      if (expression.kind === 'source' && expression.source?.kind === 'forward') {
        return `param:${expression.source.paramIndex}`;
      }
      if (expression.kind === 'literal') return `literal:${String(expression.value)}`;
      if (expression.kind === 'cast' && expression.expression) {
        return `cast:${expression.type ?? ''}:${serializedKey(expression.expression)}`;
      }
      if (expression.kind === 'binary' && expression.left && expression.right) {
        return `binary:${expression.operator}:${serializedKey(expression.left)}:${serializedKey(expression.right)}`;
      }
      if (expression.kind === 'field' && expression.expression && expression.name) {
        return `field:${serializedKey(expression.expression)}:${expression.name}`;
      }
      if (expression.kind === 'stateAccess' && expression.name) {
        return `access:${expression.name}:${(expression.args ?? []).map(serializedKey).join('|')}`;
      }
      if (expression.kind === 'arrayAccess' && expression.left && expression.right) {
        return `array:${serializedKey(expression.left)}:${serializedKey(expression.right)}`;
      }
      if (expression.kind === 'state' && expression.name) return `state:${expression.name}`;
      return JSON.stringify(expression);
    };
    const serializedStatePath = (expression: ExternalCallExpression): StatePath | undefined => {
      if (expression.kind === 'field' && expression.expression && expression.name) {
        const base = serializedStatePath(expression.expression);
        return base && { ...base, fields: [...base.fields, expression.name] };
      }
      if (expression.kind === 'stateAccess' && expression.name) {
        return {
          root: expression.name,
          keys: (expression.args ?? []).map(serializedKey),
          fields: [],
        };
      }
      if (expression.kind === 'arrayAccess' && expression.left && expression.right) {
        const base = serializedStatePath(expression.left);
        return base && { ...base, keys: [...base.keys, serializedKey(expression.right)] };
      }
      if (expression.kind === 'state' && expression.name) return { root: expression.name, keys: [], fields: [] };
      return undefined;
    };
    const sameStatePath = (left: StatePath, right: StatePath): boolean =>
      left.root === right.root
      && left.keys.join('\0') === right.keys.join('\0')
      && left.fields.join('\0') === right.fields.join('\0');
    const statementPositions = new Map<Node, StatementPosition>();
    const indexStatements = (block: BlockNode): void => {
      (block.statements ?? []).forEach((statement, index) => {
        const position = { block, index };
        const indexNode = (value: unknown, seen = new Set<object>()): void => {
          if (!(value instanceof Node) || seen.has(value)) return;
          seen.add(value);
          statementPositions.set(value, position);
          if (value instanceof BlockNode) {
            indexStatements(value);
            return;
          }
          for (const [key, child] of Object.entries(value)) {
            if ([
              'resolvedFunction', 'functionReference', 'definition', 'symbolTable',
              'referencedContract', 'stateVariable', 'collection',
            ].includes(key)) continue;
            if (child instanceof Node) indexNode(child, seen);
            else if (Array.isArray(child)) for (const item of child) indexNode(item, seen);
          }
        };
        indexNode(statement);
      });
    };
    if (func.body) indexStatements(func.body);
    const producerLeaves = (
      expression: ExpressionNode, fields: readonly string[] = [],
    ): readonly { producer: typeof slots[number]; fields: readonly string[] }[] => {
      const producerSlot = slotByCall.get(expression);
      if (producerSlot !== undefined) {
        const producer = slots.find((slot) => slot.slotIndex === producerSlot);
        return producer?.returnTypes?.length === 1 ? [{ producer, fields }] : [];
      }
      if (!(expression instanceof FunctionCallNode)) return [];
      const structFields = expression.type instanceof StructType
        ? expression.type.fields
        : contract?.structDefinitions.find((candidate) =>
          candidate.name === expression.identifier.name)?.fields;
      if (!structFields || structFields.length !== expression.parameters.length) return [];
      return expression.parameters.flatMap((parameter, index) =>
        producerLeaves(parameter, [...fields, structFields[index].name]));
    };
    const stateWrites: StateResultWrite[] = [];
    // CacheDynamicArrayInLoop rewrites writes through `__dlcache_<name>` while external-call expression metadata
    // deliberately keeps the authenticated state name. Both spellings identify the same state collection.
    const stateRoot = (name: string): string => name.startsWith('__dlcache_')
      ? name.slice('__dlcache_'.length) : name;
    visit(func.body, (node) => {
      let base: StatePath | undefined;
      let value: ExpressionNode | undefined;
      if (node instanceof StateAssignNode) {
        base = { root: stateRoot(node.name), keys: [], fields: [] };
        value = node.expression;
      } else if (node instanceof StateArrayAssignNode || node instanceof ArrayAssignNode) {
        base = { root: stateRoot(node.name), keys: [expressionKey(node.index)], fields: [] };
        value = node.value;
      } else if (node instanceof MappingAssignNode) {
        base = { root: stateRoot(node.name), keys: node.keys.map((key) => expressionKey(key)), fields: [] };
        value = node.expression;
      } else if (node instanceof MappingFieldAssignNode) {
        base = {
          root: stateRoot(node.name),
          keys: node.keys.map((key) => expressionKey(key)),
          fields: [node.fieldName, ...(node.trailingMembers ?? [])],
        };
        value = node.expression;
      }
      const position = statementPositions.get(node);
      if (!base || !value || !position) return;
      for (const leaf of producerLeaves(value)) {
        stateWrites.push({
          ...base,
          fields: [...base.fields, ...leaf.fields],
          producerCallsiteId: leaf.producer.slotIndex,
          producer: leaf.producer,
          position,
        });
      }
    });
    const producerExpression = (write: StateResultWrite): ExternalCallExpression => ({
      // This value was produced by the already-indexed callsite. Keep the dependency as an authenticated result
      // identity; duplicating target/arguments here makes metadata look like a second executable call.
      kind: 'producerResult',
      callsiteId: write.producer.slotIndex,
      resultIndex: 0,
      type: write.producer.returnTypes![0].toString(),
    });
    const rewriteStateRead = (
      expression: ExternalCallExpression, write: StateResultWrite,
    ): { expression: ExternalCallExpression; changed: boolean } => {
      const path = serializedStatePath(expression);
      if (path && sameStatePath(path, write)) return { expression: producerExpression(write), changed: true };
      let changed = false;
      const rewrite = (child: ExternalCallExpression | undefined): ExternalCallExpression | undefined => {
        if (!child) return child;
        const rewrittenChild = rewriteStateRead(child, write);
        changed ||= rewrittenChild.changed;
        return rewrittenChild.expression;
      };
      const args = expression.args?.map((child) => rewrite(child)!);
      return {
        expression: {
          ...expression,
          ...(expression.expression && { expression: rewrite(expression.expression) }),
          ...(expression.left && { left: rewrite(expression.left) }),
          ...(expression.right && { right: rewrite(expression.right) }),
          ...(expression.condition && { condition: rewrite(expression.condition) }),
          ...(expression.ifTrue && { ifTrue: rewrite(expression.ifTrue) }),
          ...(expression.ifFalse && { ifFalse: rewrite(expression.ifFalse) }),
          ...(args && { args }),
        },
        changed,
      };
    };
    for (const slot of slots) {
      const consumerPosition = slot.sourceCallNode && statementPositions.get(slot.sourceCallNode);
      if (!consumerPosition || !slot.argSources) continue;
      slot.argSources.forEach((source) => {
        if (source.kind !== 'expression' || !source.expression) return;
        for (const write of stateWrites) {
          if (write.position.block !== consumerPosition.block
            || write.position.index >= consumerPosition.index
            || write.producerCallsiteId >= slot.slotIndex) continue;
          const rewritten = rewriteStateRead(source.expression, write);
          if (!rewritten.changed) continue;
          source.expression = rewritten.expression;
        }
      });
    }
    }

    // Canonical serialized argument expressions are the sole dependency authority. AST definitions are useful
    // while constructing those expressions, but revisiting them here can conflate equal-shaped call nodes or
    // publish a dependency which the final argument recipe no longer consumes. Normalize the remaining legacy
    // `externalCall` spelling only after stable physical callsite assignment, then derive and validate the edge
    // set from the exact producerResult components which code generation and the SDK evaluate.
    const producerByCallsite = new Map(slots.map((slot) => [slot.slotIndex, slot] as const));
    const result = new Map<string, ExternalResultConsumerAbi>();
    const canonicalRecipes = new Map<string, WeakMap<ExternalCallExpression, ExternalCallExpression>>();
    const canonicalize = (
      expression: ExternalCallExpression,
      consumerCallsiteId: number,
      lane: number | 'condition' | 'iterationDomain',
      dominanceCallsiteId = consumerCallsiteId,
    ): ExternalCallExpression => {
      // A reconstructed local can share its earlier values through many fields. Preserve that DAG while
      // normalizing, without reusing a producer's validation or dependency edges in another consumer lane.
      const context = `${consumerCallsiteId}:${lane}:${dominanceCallsiteId}`;
      let recipes = canonicalRecipes.get(context);
      if (recipes === undefined) {
        recipes = new WeakMap();
        canonicalRecipes.set(context, recipes);
      }
      const cached = recipes.get(expression);
      if (cached !== undefined) return cached;
      const rewrite = (child: ExternalCallExpression | undefined): ExternalCallExpression | undefined =>
        child && canonicalize(child, consumerCallsiteId, lane, dominanceCallsiteId);
      const rewriteSource = (source: ExternalCallArgSource | undefined): ExternalCallArgSource | undefined =>
        source && {
          ...source,
          ...(source.expression && { expression: rewrite(source.expression) }),
          ...(source.stepExpression && { stepExpression: rewrite(source.stepExpression) }),
        };
      const rewriteStatement = (statement: ExternalCallStatement): ExternalCallStatement => ({
        ...statement,
        ...(statement.index && { index: rewrite(statement.index) }),
        ...(statement.expression && { expression: rewrite(statement.expression) }),
        ...(statement.condition && { condition: rewrite(statement.condition) }),
        ...(statement.statements && { statements: statement.statements.map(rewriteStatement) }),
        ...(statement.elseStatements && { elseStatements: statement.elseStatements.map(rewriteStatement) }),
      });
      const normalized: ExternalCallExpression = {
        ...expression,
        ...(expression.source && { source: rewriteSource(expression.source) }),
        ...(expression.target && { target: rewrite(expression.target) }),
        ...(expression.expression && { expression: rewrite(expression.expression) }),
        ...(expression.left && { left: rewrite(expression.left) }),
        ...(expression.right && { right: rewrite(expression.right) }),
        ...(expression.condition && { condition: rewrite(expression.condition) }),
        ...(expression.ifTrue && { ifTrue: rewrite(expression.ifTrue) }),
        ...(expression.ifFalse && { ifFalse: rewrite(expression.ifFalse) }),
        ...(expression.args && { args: expression.args.map((child) => rewrite(child)!) }),
        ...(expression.statements && { statements: expression.statements.map(rewriteStatement) }),
      };
      if (normalized.kind !== 'externalCall' && normalized.kind !== 'producerResult') {
        recipes.set(expression, normalized);
        return normalized;
      }
      const producerCallsiteId = normalized.callsiteId;
      const producer = producerCallsiteId === undefined
        ? undefined : producerByCallsite.get(producerCallsiteId);
      if (!producer || !producer.returnTypes || producer.returnTypes.length === 0) {
        throw new Error(`Result dependency in '${func.name}' references a non-returning producer callsite`);
      }
      if (producerCallsiteId! >= dominanceCallsiteId) {
        throw new Error(`Result dependency in '${func.name}' does not follow its producer callsite`);
      }
      const resultIndex = normalized.resultIndex
        ?? (producer.returnTypes.length === 1 ? 0 : undefined);
      if (resultIndex === undefined || !Number.isInteger(resultIndex)
        || resultIndex < 0 || resultIndex >= producer.returnTypes.length) {
        throw new Error(`Result dependency in '${func.name}' selects an invalid producer result`);
      }
      const key = `${consumerCallsiteId}:${lane}:${producerCallsiteId}:${resultIndex}`
        + `:${normalized.sourceCallsiteId ?? ''}`;
      const producerSourceCallsiteId = normalized.sourceCallsiteId ?? producerCallsiteId!;
      result.set(key, {
        consumerCallsiteId,
        ...(lane === 'condition' ? { condition: true as const }
          : lane === 'iterationDomain' ? { iterationDomain: true as const }
            : { argument: lane }),
        producerCallsiteId: producerCallsiteId!,
        producerSourceCallsiteId,
        resultIndex,
      });
      const producerResult: ExternalCallExpression = {
        kind: 'producerResult',
        callsiteId: producerCallsiteId,
        sourceCallsiteId: producerSourceCallsiteId,
        resultIndex,
        ...(normalized.type && { type: normalized.type }),
      };
      recipes.set(expression, producerResult);
      return producerResult;
    };
    const canonicalizeSources = (
      sources: ExternalCallArgSource[] | undefined,
      consumerCallsiteId: number,
      dominanceCallsiteId = consumerCallsiteId,
    ): void => {
      sources?.forEach((source, argument) => {
        if (source.expression) {
          source.expression = canonicalize(
            source.expression, consumerCallsiteId, argument, dominanceCallsiteId,
          );
        }
        if (source.stepExpression) {
          source.stepExpression = canonicalize(
            source.stepExpression, consumerCallsiteId, argument, dominanceCallsiteId,
          );
        }
      });
    };
    for (const slot of slots) {
      canonicalizeSources(slot.argSources, slot.slotIndex);
      canonicalizeSources(slot.rawArgSources, slot.slotIndex);
      if (slot.condition) {
        slot.condition = canonicalize(slot.condition, slot.slotIndex, 'condition');
      }
      if (slot.preCallRequires) {
        // Compute recipes may reuse one of these source-point predicates. Give its producer leaves the same
        // physical callsite, tuple-component, and repeated-owner source identity as every other graph use.
        slot.preCallRequires = slot.preCallRequires.map((predicate) =>
          canonicalize(predicate, slot.slotIndex, 'condition'));
      }
      for (const domain of iterationDomains.get(slot.slotIndex) ?? []) {
        domain.initialValue = canonicalize(domain.initialValue, slot.slotIndex, 'iterationDomain');
        domain.stepValue = canonicalize(domain.stepValue, slot.slotIndex, 'iterationDomain');
        domain.continueCondition = canonicalize(
          domain.continueCondition, slot.slotIndex, 'iterationDomain',
        );
      }
      for (const row of slot.batchInvocations ?? []) {
        // A repeated-owner batch has one physical consumer lane, but each row retains its exact source position.
        // Validate dominance against that source position while publishing the physical lane consumed by the SDK.
        canonicalizeSources(row.argSources, slot.slotIndex, row.sourceCallsiteId);
        if (row.condition) {
          row.condition = canonicalize(
            row.condition, slot.slotIndex, 'condition', row.sourceCallsiteId,
          );
        }
      }
    }
    return [...result.values()].sort((left, right) =>
      left.consumerCallsiteId - right.consumerCallsiteId
      || (left.argument ?? Number.MAX_SAFE_INTEGER) - (right.argument ?? Number.MAX_SAFE_INTEGER)
      || left.producerCallsiteId - right.producerCallsiteId
      || (left.resultIndex ?? 0) - (right.resultIndex ?? 0));
  };
  const consumers = resultConsumers();
  const computeSideCarRecipes = computeSideCarRecipesOf(func, compilerOptions);
  // X37. Both walks are paid for only by a function that has the construct they describe: a body with no
  // low-level call and no signature check resolves nothing and publishes nothing.
  const provenance = indexBody(func);
  const callTargets = lowLevelCallTargets(func, contract, provenance);
  const callTargetSources = lowLevelCallTargetSources(func, provenance);
  const delegateForwarding = (() => {
    const statements = func.body.statements ?? [];
    if (statements.length !== 2) return undefined;
    const [call, terminal] = statements;
    if (!(call instanceof LowLevelCallStatementNode) || call.callMode !== ExternalCallMode.DELEGATECALL
      || !(terminal instanceof RequireNode)) return undefined;
    const metadata = func.lowLevelCalls?.[call.callIndex];
    if (metadata?.occurrence !== 'once' || metadata.dataParamIndex === undefined) return undefined;
    const visibleParameters = func.parameters.filter((parameter) => !parameter.name.startsWith('__internal__'));
    const payloadParameter = visibleParameters[metadata.dataParamIndex];
    const terminalIsTrue = terminal.expression instanceof BoolLiteralNode
      && terminal.expression.value === true;
    // The shipped proxy retains a non-empty calldata guard after the terminal delegatecall. Promotion already
    // decodes the same payload to one exact implementation selector, so this check is implied by the promoted
    // frame and has no state/effect of its own. Keep every other terminal expression fail-closed.
    const terminalIsDecodedPayloadGuard = terminal.expression instanceof BinaryOpNode
      && terminal.expression.operator === BinaryOperator.GT
      && terminal.expression.left instanceof UnaryOpNode
      && terminal.expression.left.operator === UnaryOperator.SIZE
      && terminal.expression.left.expression instanceof IdentifierNode
      && terminal.expression.left.expression.name === payloadParameter?.name
      && terminal.expression.left.expression.definition?.definition === payloadParameter
      && payloadParameter.type?.toString() === 'bytes'
      && terminal.expression.right instanceof LiteralNode
      && terminal.expression.right.value === 0n;
    if (!terminalIsTrue && !terminalIsDecodedPayloadGuard) return undefined;
    const target = callTargets[call.callIndex] ?? COMPUTED_PROVENANCE;
    if (target.kind !== 'constructorArg' && target.kind !== 'literal') return undefined;
    const literalTarget = (
      expression: ExpressionNode,
      resolving = new Set<string>(),
    ): Uint8Array | undefined => {
      if (expression instanceof CastNode) return literalTarget(expression.expression, resolving);
      if (expression instanceof LiteralNode) {
        return expression.constructor.name === 'HexLiteralNode'
          && expression.value instanceof Uint8Array ? expression.value : undefined;
      }
      if (!(expression instanceof IdentifierNode) || resolving.has(expression.name)) return undefined;
      resolving.add(expression.name);
      const localBindings = provenance.bindings.get(expression.name);
      const constant = contract?.constantDefinitions.find((candidate) => candidate.name === expression.name);
      const candidates = localBindings ?? (constant?.expression ? [constant.expression] : []);
      const values = candidates.map((candidate) => literalTarget(candidate, resolving));
      resolving.delete(expression.name);
      if (values.length === 0 || values.some((value) => value === undefined)) return undefined;
      const first = binToHex(values[0]!);
      return values.every((value) => binToHex(value!) === first) ? values[0] : undefined;
    };
    const targetBinding = target.kind === 'constructorArg'
      ? (() => {
        const input = contract?.parameters.findIndex((parameter) => parameter.name === target.name) ?? -1;
        return input >= 0 && target.name !== undefined
          ? { kind: 'constructorArg' as const, input, name: target.name } : undefined;
      })()
      : (() => {
        const lockingBytecode = literalTarget(call.targetExpression);
        return lockingBytecode === undefined ? undefined
          : { kind: 'literal' as const, lockingBytecode: binToHex(lockingBytecode) };
      })();
    if (!targetBinding) return undefined;
    return {
      version: 1 as const,
      callIndex: call.callIndex,
      payloadInput: metadata.dataParamIndex,
      target,
      targetBinding,
      frame: {
        stateOwner: 'participant' as const,
        executor: 'target-input' as const,
        calldata: 'payload-input' as const,
        outputOwner: 'participant' as const,
      },
      terminalRequire: true as const,
    };
  })();
  const signatureGuard = signatureGuardOf(func, contract, provenance);
  // Graph handlers execute behind the synthetic route, while their loop-write metadata is discovered during
  // code generation on the cloned handler itself. The SDK plans the physical trailing outputs from the route
  // ABI, so publish the union there; otherwise a reached `mapping(K => V[]).push(...)` receives only a generic
  // mutable placeholder and its handler covenant correctly rejects the missing entry-NFT output.
  const routeEntryLoopWrites = func.messageBusRoute
    ? [...new Set([
      ...(func.entryLoopWrites ?? []),
      ...(contract?.functions ?? []).filter((candidate) => candidate.graphEmissionHandler)
        .flatMap((candidate) => candidate.entryLoopWrites ?? []),
    ])]
    : func.entryLoopWrites;
  const loopSignatureFunctions = func.messageBusRoute
    ? [func, ...(contract?.functions ?? []).filter((candidate) => candidate.graphEmissionHandler)]
    : [func];
  const routeEntryLoopWriteSignatures = Object.fromEntries(loopSignatureFunctions
    .flatMap((candidate) => candidate.entryAccesses ?? [])
    // Codegen may mark its private entry-slot copy as inLoop after semantic traversal; the authoritative
    // collection name is entryLoopWrites, so match that name rather than requiring the AST flag to survive.
    .filter((access) => routeEntryLoopWrites?.includes(access.collection))
    .map((access) => [access.collection, access.collectionSignature]));
  const visibleParameters = func.parameters.filter((parameter) =>
    !parameter.name.startsWith('__internal__'));
  const localInitializers = new Map<string, ExpressionNode[]>();
  const reassignedLocals = new Set<string>();
  const collectLocalInitializers = (candidate: Node): void => {
    if (candidate instanceof VariableDefinitionNode && candidate.expression) {
      const definitions = localInitializers.get(candidate.name) ?? [];
      definitions.push(candidate.expression);
      localInitializers.set(candidate.name, definitions);
    }
    if (candidate instanceof AssignNode) reassignedLocals.add(candidate.identifier.name);
    if (candidate instanceof TryCatchNode) {
      collectLocalInitializers(candidate.expression);
      collectLocalInitializers(candidate.tryBlock);
      return;
    }
    for (const [key, value] of Object.entries(candidate)) {
      if (['location', 'resolvedFunction', 'functionReference', 'definition', 'symbolTable',
        'referencedContract', 'stateVariable', 'collection', 'type', 'runtimeLoopEventCondition'].includes(key)) {
        continue;
      }
      if (value instanceof Node) collectLocalInitializers(value);
      else if (Array.isArray(value)) {
        for (const item of value) if (item instanceof Node) collectLocalInitializers(item);
      }
    }
  };
  if (func.body) collectLocalInitializers(func.body);
  const serializeCondition = (
    expression: ExpressionNode,
    counter?: EmitStatementNode['runtimeLoopEventCounter'],
    resolving = new Set<string>(),
    preservedLocals = new Set<string>(),
  ): ExternalCallExpression | undefined => {
    if (expression instanceof LiteralNode) {
      const value = expression.value;
      if (typeof value === 'bigint') return { kind: 'literal', type: 'bigint', value: value.toString() };
      if (typeof value === 'boolean') return { kind: 'literal', type: 'bool', value };
      if (typeof value === 'string') return { kind: 'literal', type: 'string', value };
      if (value instanceof Uint8Array) {
        return { kind: 'literal', type: `bytes${value.length}`, value: binToHex(value) };
      }
      return undefined;
    }
    if (expression instanceof IdentifierNode) {
      if (preservedLocals.has(expression.name)) return { kind: 'identifier', name: expression.name };
      if (counter?.name === expression.name) {
        const stepExpression = counter.stepExpression
          ? serializeCondition(counter.stepExpression, undefined, resolving, preservedLocals) : undefined;
        if (counter.stepExpression && !stepExpression) return undefined;
        return {
          kind: 'source',
          source: {
            kind: 'loopIndex',
            initialValue: counter.initialValue.toString(),
            ...(stepExpression
              ? { stepExpression }
              : { stepValue: counter.stepValue.toString() }),
          },
        };
      }
      const parameter = visibleParameters.findIndex((candidate) => candidate.name === expression.name);
      if (parameter >= 0) return { kind: 'source', source: { kind: 'forward', paramIndex: parameter } };
      if (resolving.has(expression.name)) return undefined;
      const definitions = localInitializers.get(expression.name) ?? [];
      return definitions.length === 1
        ? serializeCondition(definitions[0], counter, new Set(resolving).add(expression.name), preservedLocals)
        : undefined;
    }
    if (expression instanceof StateAccessNode) return { kind: 'state', name: expression.name };
    if (expression instanceof CastNode) {
      const inner = serializeCondition(expression.expression, counter, resolving, preservedLocals);
      return inner && { kind: 'cast', type: expression.type.toString(), expression: inner };
    }
    if (expression instanceof UnaryOpNode) {
      const inner = serializeCondition(expression.expression, counter, resolving, preservedLocals);
      return inner && { kind: 'unary', operator: expression.operator, expression: inner };
    }
    if (expression instanceof BinaryOpNode) {
      const left = serializeCondition(expression.left, counter, resolving, preservedLocals);
      const right = serializeCondition(expression.right, counter, resolving, preservedLocals);
      return left && right && { kind: 'binary', operator: expression.operator, left, right };
    }
    if (expression instanceof TernaryOpNode) {
      const condition = serializeCondition(expression.condition, counter, resolving, preservedLocals);
      const ifTrue = serializeCondition(expression.ifTrue, counter, resolving, preservedLocals);
      const ifFalse = serializeCondition(expression.ifFalse, counter, resolving, preservedLocals);
      return condition && ifTrue && ifFalse && { kind: 'ternary', condition, ifTrue, ifFalse };
    }
    if (expression instanceof FieldAccessNode) {
      const inner = serializeCondition(expression.expression, counter, resolving, preservedLocals);
      return inner && (expression.name === 'length'
        ? { kind: 'unary', operator: '.length', expression: inner }
        : { kind: 'field', name: expression.name, expression: inner });
    }
    if (expression instanceof MappingAccessNode) {
      const args = expression.keys.map((key) => serializeCondition(key, counter, resolving, preservedLocals));
      return args.every((arg): arg is ExternalCallExpression => arg !== undefined)
        ? { kind: 'stateAccess', name: expression.name, args } : undefined;
    }
    if (expression instanceof ArrayAccessNode) {
      const left = serializeCondition(expression.array, counter, resolving, preservedLocals);
      const right = serializeCondition(expression.index, counter, resolving, preservedLocals);
      return left && right && { kind: 'arrayAccess', left, right };
    }
    return undefined;
  };
  const runtimeLoopEvents = (() => {
    if (!func.runtimeLoopEvents?.length || !func.body) return [];
    const sites = new Map<number, EmitStatementNode[]>();
    const seen = new Set<Node>();
    const walk = (node: Node): void => {
      if (seen.has(node)) return;
      seen.add(node);
      if (node instanceof EmitStatementNode && node.runtimeLoopEvent) {
        const group = sites.get(node.runtimeLoopEvent.loopIndex) ?? [];
        group[node.runtimeLoopEvent.siteIndex] = node;
        sites.set(node.runtimeLoopEvent.loopIndex, group);
      }
      for (const [key, value] of Object.entries(node)) {
        if (['location', 'resolvedFunction', 'functionReference', 'definition', 'symbolTable',
          'referencedContract', 'stateVariable', 'collection', 'type'].includes(key)) continue;
        if (value instanceof Node) walk(value);
        else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) walk(item);
      }
    };
    walk(func.body);
    return func.runtimeLoopEvents.map((loop) => {
      const eventSites = sites.get(loop.loopIndex) ?? [];
      const preservedLocals = new Set(loop.iterationDomain ? [loop.iterationDomain.counterName] : []);
      const conditions = eventSites.map((emit) => emit.runtimeLoopEventCondition
        ? serializeCondition(
          emit.runtimeLoopEventCondition, emit.runtimeLoopEventCounter, new Set(), preservedLocals,
        ) ?? null
        : null);
      const serializedArguments = loop.iterationDomain === undefined && loop.staticArguments !== true
        ? undefined : eventSites.map((emit) => (emit.runtimeLoopEventArguments ?? emit.args)
          .map((argument) => serializeCondition(
            argument, emit.runtimeLoopEventCounter, new Set(), preservedLocals,
          )));
      const iterationBreakCondition = loop.iterationBreakCondition && serializeCondition(
        loop.iterationBreakCondition, eventSites[0]?.runtimeLoopEventCounter, new Set(), preservedLocals,
      );
      const sourceBound = loop.permutationParam
        ? func.runtimeCounterLoopBounds?.get(loop.permutationParam) : undefined;
      const iterationBound = sourceBound && serializeCondition(
        sourceBound, undefined, new Set(), preservedLocals,
      );
      if (eventSites.some((emit, index) => emit.runtimeLoopEventCondition && conditions[index] === null)) {
        throw new Error(`Runtime event condition in '${func.name}' cannot be represented in artifact metadata`);
      }
      if (serializedArguments?.some((site) => site.some((argument) => argument === undefined))) {
        throw new Error(`Runtime event arguments in '${func.name}' cannot be represented in artifact metadata`);
      }
      if (loop.iterationBreakCondition && !iterationBreakCondition) {
        throw new Error(`Runtime event break condition in '${func.name}' cannot be represented in artifact metadata`);
      }
      if (sourceBound && !iterationBound) {
        throw new Error(`Runtime event bound in '${func.name}' cannot be represented in artifact metadata`);
      }
      return {
        ...(loop.permutationParam !== undefined && { permutationParam: loop.permutationParam }),
        ...(iterationBound && { iterationBound }),
        ...(loop.repeatCount !== undefined && { repeatCount: loop.repeatCount }),
        ...(loop.iterationDomain !== undefined && { iterationDomain: loop.iterationDomain }),
        eventSignatures: eventSites.map((emit) => emit.eventDefinition!.signature),
        ...(serializedArguments !== undefined && {
          arguments: serializedArguments as ExternalCallExpression[][],
        }),
        ...(conditions.some((condition) => condition !== null) && { conditions }),
        ...(iterationBreakCondition && { iterationBreakCondition }),
        ...(loop.effectSequence !== undefined && { effectSequence: loop.effectSequence }),
        ...(eventSites.some((emit) => emit.runtimeLoopEffectOrder !== undefined) && {
          effectOrder: eventSites.map((emit, index) => emit.runtimeLoopEffectOrder ?? index),
        }),
        ...(loop.chunked && { chunked: true as const }),
      };
    });
  })();
  const runtimeLoopTransfers = (() => {
    if (!func.runtimeLoopTransfers?.length || !func.body) return [];
    const sites = new Map<number, Array<TransferStatementNode | TokenContainerMethodStatementNode>>();
    const seen = new Set<Node>();
    const walk = (node: Node): void => {
      if (seen.has(node)) return;
      seen.add(node);
      if ((node instanceof TransferStatementNode || node instanceof TokenContainerMethodStatementNode)
        && node.runtimeLoopTransfer) {
        const group = sites.get(node.runtimeLoopTransfer.loopIndex) ?? [];
        group[node.runtimeLoopTransfer.siteIndex] = node;
        sites.set(node.runtimeLoopTransfer.loopIndex, group);
      }
      for (const [key, value] of Object.entries(node)) {
        if (['location', 'resolvedFunction', 'functionReference', 'definition', 'symbolTable',
          'referencedContract', 'stateVariable', 'collection', 'type'].includes(key)) continue;
        if (value instanceof Node) walk(value);
        else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) walk(item);
      }
    };
    walk(func.body);
    return func.runtimeLoopTransfers.map((loop) => {
      const transferSites = sites.get(loop.loopIndex) ?? [];
      const conditions = transferSites.map((transfer) => transfer.runtimeLoopTransferCondition
        ? serializeCondition(transfer.runtimeLoopTransferCondition, transfer.runtimeLoopTransferCounter) ?? null
        : null);
      if (transferSites.some((transfer, index) =>
        transfer.runtimeLoopTransferCondition && conditions[index] === null)) {
        throw new Error(`Runtime transfer condition in '${func.name}' cannot be represented in artifact metadata`);
      }
      const sourceBound = loop.permutationParam
        ? func.runtimeCounterLoopBounds?.get(loop.permutationParam) : undefined;
      const iterationBound = sourceBound && serializeCondition(
        sourceBound, undefined, new Set(), new Set(),
      );
      if (sourceBound && !iterationBound) {
        throw new Error(`Runtime transfer bound in '${func.name}' cannot be represented in artifact metadata`);
      }
      return {
        permutationParam: loop.permutationParam,
        ...(iterationBound && { iterationBound }),
        siteCount: transferSites.length,
        ...(transferSites.some((transfer) => transfer instanceof TokenContainerMethodStatementNode) && {
          siteKinds: transferSites.map((transfer) => transfer instanceof TokenContainerMethodStatementNode
            ? (transfer.methodName === 'transferNft' ? 'nft' as const : 'token' as const)
            : 'bch' as const),
          tokenContainerSlots: transferSites.map((transfer) =>
            transfer instanceof TokenContainerMethodStatementNode ? transfer.tokenContainerSlotIndex : null),
        }),
        ...(conditions.some((condition) => condition !== null) && { conditions }),
        ...(loop.effectSequence !== undefined && { effectSequence: loop.effectSequence }),
        ...(transferSites.some((transfer) => transfer.runtimeLoopEffectOrder !== undefined) && {
          effectOrder: transferSites.map((transfer, index) => transfer.runtimeLoopEffectOrder ?? index),
        }),
      };
    });
  })();
  const tokenContainerTransferSites = (() => {
    if (!func.body || !func.tokenContainerAccesses?.some((access) =>
      access.transferCount > 0 || access.transferNftCount > 0)) return [];
    const sites: Array<{
      transferIndex: number;
      tokenContainerSlot: number;
      kind: 'token' | 'nft';
      condition?: ExternalCallExpression | null;
    }> = [];
    const usesReassignedLocal = (root: ExpressionNode): boolean => {
      let found = false;
      const seen = new Set<Node>();
      const scan = (candidate: Node): void => {
        if (found || seen.has(candidate)) return;
        seen.add(candidate);
        if (candidate instanceof IdentifierNode && reassignedLocals.has(candidate.name)) {
          found = true;
          return;
        }
        for (const [key, value] of Object.entries(candidate)) {
          if (['location', 'resolvedFunction', 'functionReference', 'definition', 'symbolTable',
            'referencedContract', 'stateVariable', 'collection', 'type'].includes(key)) continue;
          if (value instanceof Node) scan(value);
          else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) scan(item);
        }
      };
      scan(root);
      return found;
    };
    const combine = (
      outer: ExpressionNode | undefined, inner: ExpressionNode, negate: boolean,
    ): ExpressionNode => {
      const selected = negate ? new UnaryOpNode(UnaryOperator.NOT, inner) : inner;
      if (!outer) return selected;
      return new BinaryOpNode(outer, BinaryOperator.AND, selected);
    };
    const visit = (candidate: Node, condition?: ExpressionNode): void => {
      if (candidate instanceof TokenContainerMethodStatementNode) {
        if (!candidate.runtimeLoopTransfer) {
          sites.push({
            transferIndex: candidate.transferIndex,
            tokenContainerSlot: candidate.tokenContainerSlotIndex,
            kind: candidate.methodName === 'transferNft' ? 'nft' : 'token',
            ...(condition !== undefined && {
              condition: usesReassignedLocal(condition) ? null : serializeCondition(condition) ?? null,
            }),
          });
        }
        return;
      }
      if (candidate instanceof BranchNode) {
        visit(candidate.ifBlock, combine(condition, candidate.condition, false));
        if (candidate.elseBlock) visit(candidate.elseBlock, combine(condition, candidate.condition, true));
        return;
      }
      if (candidate instanceof SwitchNode) {
        let defaultCondition = condition;
        for (const arm of candidate.cases) {
          const matches = new BinaryOpNode(candidate.expression, BinaryOperator.EQ, arm.value);
          visit(arm.body, combine(condition, matches, false));
          const misses = new BinaryOpNode(candidate.expression, BinaryOperator.NE, arm.value);
          defaultCondition = defaultCondition ? new BinaryOpNode(
            defaultCondition, BinaryOperator.AND, misses,
          ) : misses;
        }
        if (candidate.defaultCase) visit(candidate.defaultCase, defaultCondition);
        return;
      }
      // Script failure is fatal, so catch bodies are unreachable in SolidCash.
      if (candidate instanceof TryCatchNode) {
        visit(candidate.tryBlock, condition);
        return;
      }
      for (const [key, value] of Object.entries(candidate)) {
        if (['location', 'resolvedFunction', 'functionReference', 'definition', 'symbolTable',
          'referencedContract', 'stateVariable', 'collection', 'type',
          'runtimeLoopTransferCondition'].includes(key)) continue;
        if (value instanceof Node) visit(value, condition);
        else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) visit(item, condition);
      }
    };
    visit(func.body);
    return sites.sort((left, right) => left.transferIndex - right.transferIndex);
  })();
  const directMappingReturn = (() => {
    const statements = func.body?.statements;
    if (!statements || statements.length !== 1 || !(statements[0] instanceof ReturnNode)) return undefined;
    const returned = statements[0].expressions;
    if (returned.length !== 1 || !(returned[0] instanceof MappingAccessNode) || returned[0].arrayIndex) {
      return undefined;
    }
    const keyParams: string[] = [];
    for (const key of returned[0].keys) {
      if (!(key instanceof IdentifierNode)) return undefined;
      const parameter = visibleParameters.find((candidate) => candidate.name === key.name);
      if (!parameter || key.definition?.definition !== parameter) return undefined;
      keyParams.push(key.name);
    }
    return keyParams.length > 0 ? { collection: returned[0].name, keyParams } : undefined;
  })();
  const directCollectionLengthReturn = (() => {
    if (!func.sourceReadOnly && !func.modifiers.includes(FunctionModifier.VIEW)
      && !func.modifiers.includes(FunctionModifier.PURE)) return undefined;
    if ((func.externalCalls?.length ?? 0) !== 0 || func.body?.statements?.length !== 1) return undefined;
    const statement = func.body.statements[0];
    if (!(statement instanceof ReturnNode) || statement.expressions.length !== 1) return undefined;
    const length = statement.expressions[0];
    if (!(length instanceof UnaryOpNode) || length.operator !== UnaryOperator.SIZE
      || !(length.expression instanceof MappingAccessNode) || length.expression.arrayIndex) return undefined;
    const mapping = length.expression;
    if (!(mapping.collection?.innermostValueType instanceof ArrayType)
      || mapping.keys.length === 0 || func.returnTypes.length !== 1
      || !/^(?:u?int(?:\d+)?|bigint)$/.test(func.returnTypes[0].toString())) return undefined;
    const keyParams: string[] = [];
    for (const key of mapping.keys) {
      if (!(key instanceof IdentifierNode)) return undefined;
      const parameter = visibleParameters.find((candidate) => candidate.name === key.name);
      if (!parameter || key.definition?.definition !== parameter) return undefined;
      keyParams.push(key.name);
    }
    return { collection: mapping.name, keyParams };
  })();
  const directExternalReturn = (() => {
    if (!func.modifiers.includes(FunctionModifier.VIEW)
      && !func.modifiers.includes(FunctionModifier.PURE)
      && func.sourceReadOnly !== true) return undefined;
    const statements = func.body?.statements;
    if (!statements || statements.length === 0) return undefined;
    // Address-target synthesis may prepend a pure capture such as
    // `__extaddr_source_IFoo = IFoo(source)`. It does not transform the return value.
    const pureAddressCapture = (statement: Node): boolean => {
      if (!(statement instanceof VariableDefinitionNode) || !statement.name.startsWith('__extaddr_')) {
        return false;
      }
      const source = statement.expression instanceof CastNode
        ? statement.expression.expression : statement.expression;
      return source instanceof IdentifierNode
        || (source instanceof StateAccessNode && source.stateVariable !== undefined);
    };
    if (!statements.slice(0, -1).every(pureAddressCapture)) return undefined;
    const last = statements[statements.length - 1];
    if (!(last instanceof ReturnNode)) return undefined;
    const returned = last.expressions;
    if (returned.length !== 1 || !(returned[0] instanceof ExternalFunctionCallNode)) return undefined;
    const matchingCalls = (func.externalCalls ?? []).filter((call) => call.sourceCallNode === returned[0]);
    if ((func.externalCalls ?? []).length !== 1 || matchingCalls.length !== 1
      || !matchingCalls[0].hasReturnValues
      || matchingCalls[0].batchInvocations || matchingCalls[0].condition
      || matchingCalls[0].callValueEffect || matchingCalls[0].opaqueReturn) return undefined;
    return { callsiteId: matchingCalls[0].slotIndex };
  })();
  // Late semantic rewrites may introduce graph calls or entry mutations after the source program-point pass.
  // Never advertise a linear authority domain unless every emitted effect retained its compiler-owned identity.
  const publishedSourceEffectOrder = sourceEffectOrderForArtifact(
    func.sourceEffectOrder, func.externalCalls ?? [], func.entryAccesses ?? [],
  );
  const argumentFieldUpdates = argumentFieldUpdatesOf(func);
  return {
    ...(argumentFieldUpdates && { argumentFieldUpdates }),
    ...(isStateful && { writesState: computeWritesState(func) }),
    ...(func.scalarJournalRecursive && { recursiveStateHandler: true }),
    ...(func.graphEffectFrame && { graphEffectFrame: { ...func.graphEffectFrame } }),
    ...(func.requiredNftIndices !== undefined
      && { requiredNftIndices: func.requiredNftIndices }),
    ...(func.messageBusConstructedKeyVectorDescriptors?.length && {
      // Descriptors have already crossed the narrow typed proof-program boundary. Copy the outer list so later
      // compiler lowering cannot mutate published metadata; no AST node or source-local identity escapes.
      constructedKeyVectors: func.messageBusConstructedKeyVectorDescriptors.map((descriptor) => ({ ...descriptor })),
    }),
    ...(func.messageBusAffineRecursiveFrameDescriptors?.length && {
      affineRecursiveFrames: func.messageBusAffineRecursiveFrameDescriptors.map((descriptor) => ({
        ...descriptor,
        parameterProgressions: descriptor.parameterProgressions.map((progression) => ({ ...progression })),
        accesses: descriptor.accesses.map((access) => ({ ...access, key: [...access.key] })),
      })),
    }),
    ...(func.entryAccesses && func.entryAccesses.some((ea) => !ea.inLoop
      || compilerOptions.composition === 'framed') && {
      // Loop mapping writes (inLoop) are surfaced via entryLoopWrites, not as fixed entry slots; exclude them
      // here so the SDK's static-entry path does not allocate a slot / derive them positionally. A framed frame
      // declares its records in its witness block instead, where the slot's slotIndex is the coordinate the frame
      // plans the loop's per-turn nodes from.
      entryAccesses: func.entryAccesses.filter((ea) => !ea.inLoop
        || compilerOptions.composition === 'framed').map((ea) => ({
        slotIndex: ea.slotIndex,
        collection: ea.collection,
        keyParams: ea.keyParams,
        ...(ea.keySources && (ea.keySources.some((ks) => ks.kind !== 'param')
          || ea.keyParams.some((name) => /_sender(?:_|$)/.test(name))) && {
          keySources: ea.keySources.map((ks, index) => {
            const syntheticSender = ks.kind === 'param'
              && /_sender(?:_|$)/.test(ea.keyParams[index] ?? '');
            return {
              kind: syntheticSender ? 'msgSender' : ks.kind,
              ...(ks.paramName && { paramName: ks.paramName }),
              ...(ks.stateVarName && { stateVarName: ks.stateVarName }),
              ...(ks.stateArrayName && { stateArrayName: ks.stateArrayName }),
              ...(ks.kind === 'constant' && { constantValue: ks.constantValue }),
              ...((ks.kind === 'msgSender' || syntheticSender) && { senderOp: ks.senderOp ?? 'msg.sender' }),
              ...(ks.kind === 'expression' && { expressionLabel: ks.canonical }),
              ...(ks.postWriteExpressionLabel && { postWriteExpressionLabel: ks.postWriteExpressionLabel }),
              ...(ks.preWriteMappingCollections?.length && {
                preWriteMappingCollections: [...ks.preWriteMappingCollections],
              }),
            };
          }),
        }),
        operations: ea.operations,
        ...(ea.mutationEffectOrdinals?.length && {
          mutationEffectOrdinals: [...ea.mutationEffectOrdinals],
        }),
        ...(ea.chunkableArrayValue && { chunkableArrayValue: true }),
        ...(ea.aliasCondDeleteSlot !== undefined && { aliasCondDeleteSlot: ea.aliasCondDeleteSlot }),
        ...(ea.runtimeAliasPriorSlots?.length
          && { runtimeAliasPriorSlots: ea.runtimeAliasPriorSlots }),
        ...(ea.composeAliasPriorSlots?.length && { composeAliasPriorSlots: [...ea.composeAliasPriorSlots] }),
        ...(ea.sharedProofPriorSlot !== undefined && { sharedProofPriorSlot: ea.sharedProofPriorSlot }),
        ...(ea.valueParam !== undefined && { valueParam: ea.valueParam }),
        ...(ea.valueSource !== undefined && { valueSource: ea.valueSource }),
        ...(ea.storedValueSource !== undefined && {
          storedValueSource: {
            ...ea.storedValueSource,
            expression: cloneExternalCallExpression(ea.storedValueSource.expression),
          },
        }),
        ...(ea.storedElementSource !== undefined && {
          storedElementSource: {
            ...ea.storedElementSource,
            expression: cloneExternalCallExpression(ea.storedElementSource.expression),
          },
        }),
        ...(ea.arrayMutation !== undefined && { arrayMutation: ea.arrayMutation }),
        ...((() => {
          const pooledActivation = func.messageBusPooledChunkableArrayPush === true
            && ea.arrayMutation === 'push'
            && func.messageBusPooledChunkableArrayPushActivation !== undefined
            && (func.messageBusPooledChunkableArrayPushEffectOrdinal === undefined
              || (ea.mutationEffectOrdinals?.includes(func.messageBusPooledChunkableArrayPushEffectOrdinal)
                ?? false))
            ? func.messageBusPooledChunkableArrayPushActivation
            : undefined;
          const stamped = ea.activation
            ?? func.messageBusFixedChunkableResources?.find((resource) =>
              resource.collection === ea.collection
              && (ea.mutationEffectOrdinals?.includes(resource.effectOrdinal) ?? false))
              ?.activation
            ?? pooledActivation;
          return stamped !== undefined
            ? { activation: cloneExternalCallExpression(stamped) }
            : {};
        })()),
      })),
    }),
    ...(publishedSourceEffectOrder !== undefined && { sourceEffectOrder: publishedSourceEffectOrder }),
    ...(directMappingReturn && { directMappingReturn }),
    ...(directCollectionLengthReturn && { directCollectionLengthReturn }),
    ...(directExternalReturn && { directExternalReturn }),
    ...(func.emitInfos && func.emitInfos.length > 0 && {
      emits: func.emitInfos.map((ei) => ({
        eventName: ei.eventName,
        eventSignature: ei.eventSignature,
        emitIndex: ei.emitIndex,
        ...(ei.activation !== undefined && { activation: cloneExternalCallExpression(ei.activation) }),
      })),
    }),
    ...(runtimeLoopEvents.length > 0 && { runtimeLoopEvents }),
    ...(runtimeLoopTransfers.length > 0 && { runtimeLoopTransfers }),
    ...(tokenContainerTransferSites.length > 0 && { tokenContainerTransferSites }),
    ...(func.transferInfos && func.transferInfos.length > 0 && {
      transferCount: func.transferInfos.length,
      ...(contract && { transfers: transferEffects(func, contract) }),
    }),
    ...(func.deployTargets && func.deployTargets.length > 0 && {
      deployTargets: func.deployTargets.map((dt) => ({
        contractName: dt.contractName,
        dataNftCount: dt.dataNftCount,
        ...(dt.entryNftCount !== undefined && { entryNftCount: dt.entryNftCount }),
        ...(dt.constructorArgs && { constructorArgs: dt.constructorArgs }),
        ...(dt.salt && { salt: dt.salt }),
        ...(dt.creationBytecode && { creationBytecode: dt.creationBytecode }),
        ...(dt.hasFoldedChildCall && { hasFoldedChildCall: true }),
        ...(dt.childLayoutDigest && { childLayoutDigest: dt.childLayoutDigest }),
        ...(dt.genesisState && { genesisState: dt.genesisState }),
        ...(dt.genesisEntries && { genesisEntries: dt.genesisEntries }),
      })),
    }),
    ...(func.externalReads && func.externalReads.length > 0 && {
      externalReads: func.externalReads.map((er) => ({
        interfaceName: er.interfaceName,
        kind: er.kind,
        ...(er.nftIndex !== undefined && { nftIndex: er.nftIndex }),
        ...(er.collectionName && { collectionName: er.collectionName }),
        ...(er.collectionSignature && { collectionSignature: er.collectionSignature }),
        ...(er.addressParam && { addressParam: er.addressParam }),
      })),
    }),
    ...(func.externalCalls && func.externalCalls.length > 0 && {
      externalCalls: func.externalCalls.map((ec) => {
        const rawCall = ec.interfaceName === '__raw__' && ec.functionName === '__raw__';
        // A grouped call owns one physical route even when its logical rows are conditional or repeated.
        // Publish row cardinality below; the outer callsite itself is the singular co-spend.
        const structuralOccurrence = ec.batchInvocations
          ? { occurrence: 'once' as const }
          : occurrenceInfoOf(func, ec.sourceCallNode);
        // The source call can be hoisted out of its branch during lowering while its compiler-published
        // condition still records the branch that reaches it. In that case it is not a mandatory `once`
        // edge: the graph may have zero rows until the guard's authenticated producer result is known.
        const occurrenceInfo = ec.condition && structuralOccurrence.occurrence === 'once'
          && !ec.batchInvocations
          ? { occurrence: 'conditional' as const, maximumOccurrences: 1 }
          : structuralOccurrence;
        const resultArrayOutput = !ec.condition && occurrenceInfo.occurrence === 'loop'
          ? ec.resultArrayOutput ?? ec.sourceCallNode?.resultArrayOutput
            ?? resultArrayOutputOf(func.body, ec.sourceCallNode) : undefined;
        if (ec.callerIdentity === undefined && compilerOptions.messageBusKernel === true) {
          throw new Error(`Kernel callsite ${func.name}:${ec.slotIndex} lacks caller identity metadata`);
        }
        return {
          callsiteId: ec.slotIndex,
          ...(compilerOptions.composition !== 'framed' && ec.readonlyReturnBindingSelector !== undefined && {
            readonlyReturnBinding: { version: 1 as const, selector: binToHex(ec.readonlyReturnBindingSelector) },
          }),
          ...(ec.sourceEffectOrdinal !== undefined && { sourceEffectOrdinal: ec.sourceEffectOrdinal }),
          ...(ec.sourceCallNode && {
            sourceLocation: {
              line: ec.sourceCallNode.location.start.line,
              column: ec.sourceCallNode.location.start.column,
            },
          }),
          ...occurrenceInfo,
          ...(ec.condition && { condition: ec.condition }),
          ...(!ec.batchInvocations && ec.preCallRequires?.length && {
            preCallRequires: ec.preCallRequires,
          }),
          ...(iterationDomains.get(ec.slotIndex)?.length === 1 && {
            iterationDomain: iterationDomains.get(ec.slotIndex)![0],
          }),
          ...((iterationDomains.get(ec.slotIndex)?.length ?? 0) > 1 && {
            nestedIterationDomains: iterationDomains.get(ec.slotIndex)!,
          }),
          ...(resultArrayOutput !== undefined && { resultArrayOutput }),
          interfaceName: ec.interfaceName,
          functionName: ec.functionName,
          ...(ec.callerIdentity !== undefined && { callerIdentity: ec.callerIdentity }),
          ...(ec.addressParam && { addressParam: ec.addressParam }),
          ...(ec.addressStateVar && { addressStateVar: ec.addressStateVar }),
          ...(ec.addressLiteral && { addressLiteral: ec.addressLiteral }),
          ...(ec.loopArrayVar && { loopArrayVar: ec.loopArrayVar }),
          ...(ec.selectorArrayVar && { selectorArrayVar: ec.selectorArrayVar }),
          ...(ec.selectorArrayVar && ec.sourceCallNode && {
            possibleTargets: possibleSelectorTargets(ec.interfaceName, ec.sourceCallNode.parameters),
          }),
          ...(ec.addressIsMsgSender && { addressIsMsgSender: true }),
          ...(ec.addressSource && { addressSource: ec.addressSource }),
          ...(ec.fnPtrCall && { fnPtrCall: true }),
          // Explicit (true AND false) for regular direct calls so the SDK skips a single-method callee's (absent)
          // witness selector; call/staticcall/delegatecall inject no selector param.
          ...(!ec.callMode && { needsSelectorVerification: !!ec.needsSelectorVerification }),
          requiredDataNftIndices: ec.requiredDataNftIndices,
          ...(ec.hasReturnValues && { hasReturnValues: true }),
          ...(ec.returnTypes && ec.returnTypes.length > 0 && {
            returnTypes: ec.returnTypes.map((t) => t.toString()),
            ...(!ec.opaqueReturn && { resultEncoding: externalResultEncoding(ec.returnTypes, compilerOptions) }),
          }),
          ...(ec.returnEventSignature && { returnEventSignature: ec.returnEventSignature }),
          ...(ec.computedOffset !== undefined && ec.computedOffset > 0 && { computedOffset: ec.computedOffset }),
          ...(ec.callMode && ec.callMode !== ExternalCallMode.REGULAR && { callMode: ec.callMode }),
          // Publish false too: absence denotes a legacy artifact, not a proven value-free edge.
          callValueEffect: rawCall && (func.graphRawCallValueEffect === true || hasExternalCallValueEffect(ec)),
          ...(ec.opaqueReturn && { opaqueReturn: true }),
          ...(ec.rawFunctionName && { rawFunctionName: ec.rawFunctionName }),
          ...(ec.rawSelector && { rawSelector: binToHex(ec.rawSelector) }),
          ...(ec.rawArgSources && { rawArgSources: ec.rawArgSources }),
          // Publish the empty list too. Omission means legacy/unknown provenance to SDK consumers; a present empty
          // list is the proof that this call has zero arguments and needs no runtime argument resolution.
          ...(ec.argSources && { argSources: ec.argSources }),
          ...(ec.batchInvocations && {
            batchInvocations: ec.batchInvocations.map((row) => ({
              selector: binToHex(row.selector),
              sourceCallsiteId: row.sourceCallsiteId,
              sourceEffectOrdinal: row.sourceEffectOrdinal,
              logicalIndex: row.logicalIndex,
              callValueEffect: rawCall && (func.graphRawCallValueEffect === true || hasExternalCallValueEffect(row)),
              inputs: row.parameterTypes.map((type, index) => ({
                name: `arg${index}`, type: abiTypeString(type),
              })),
              ...(row.argSources && { argSources: row.argSources }),
              ...(row.occurrence && row.occurrence !== 'once' && { occurrence: row.occurrence }),
              ...(row.condition && { condition: row.condition }),
            })),
          }),
        };
      }),
    }),
    ...(consumers.length > 0 && { resultConsumers: consumers }),
    ...(func.externalOutStateReads && func.externalOutStateReads.length > 0 && {
      externalOutStateReads: func.externalOutStateReads.map((os) => ({
        interfaceName: os.interfaceName,
        ...(os.addressParam && { addressParam: os.addressParam }),
        requiredDataNftIndices: os.requiredDataNftIndices,
      })),
    }),
    ...(func.tokenContainerAccesses && func.tokenContainerAccesses.length > 0 && {
      tokenContainerAccesses: func.tokenContainerAccesses.map((da) => ({
        keyParam: da.keyParam,
        ...(da.keySource && da.keySource !== 'param' && { keySource: da.keySource }),
        ...(da.keyStateVariable && { keyStateVariable: da.keyStateVariable }),
        operations: da.operations,
        // An omitted count is the pre-count-schema spelling for exactly one operation. Runtime-loop effects
        // deliberately remain in `operations` (the container itself is still read/authenticated) while owning
        // zero fixed output slots, so publish the explicit zero to keep old-artifact fallback from manufacturing
        // one dummy transfer on a zero-trip loop.
        ...((da.transferCount !== 1 || !da.operations.includes('transfer'))
          && { transferCount: da.transferCount }),
        ...((da.transferNftCount !== 1 || !da.operations.includes('transferNft'))
          && { transferNftCount: da.transferNftCount }),
        ...(da.readsOutput === true && { readsOutput: true }),
      })),
    }),
    ...(func.usesMsgSender && { usesMsgSender: true }),
    ...(func.usesMsgData && { usesMsgData: true }),
    // Absent means no signature check was proven - a body with none, or an artifact predating the field.
    // Both read as "unguarded"; absent is never a proof of authority.
    ...(signatureGuard && { signatureGuard }),
    ...(signatureGuardDominatesDelegatecalls(func) && { signatureGuardDominatesDelegatecalls: true }),
    ...(func.usedLibraries && func.usedLibraries.length > 0 && { externalLibraries: func.usedLibraries }),
    ...(func.libraryCallCounts && func.libraryCallCounts.size > 0
      && { externalLibraryCalls: Object.fromEntries(func.libraryCallCounts) }),
    ...(func.keccakCompute && { keccakCompute: true }),
    ...(func.keccakPreimageParams && func.keccakPreimageParams.length > 0
      && { keccakPreimageParams: func.keccakPreimageParams }),
    ...(func.keccakInLoop && { keccakInLoop: true }),
    ...(func.keccakLoopReads && { keccakLoopReads: true }),
    ...(func.keccakLoopPrecedesTrailingUser && { keccakLoopPrecedesTrailingUser: true }),
    ...(func.keccakChainReads && { keccakChainReads: true }),
    ...(func.ecrecoverCompute && { ecrecoverCompute: true }),
    ...(computeSideCarRecipes && { computeSideCarRecipes }),
    ...(func.ecrecoverArgParams && func.ecrecoverArgParams.length > 0
      && { ecrecoverArgParams: func.ecrecoverArgParams }),
    ...((func.ecrecoverEvmFlags?.length || func.ecrecoverClosureEvmFlags?.length) && {
      // Preserve the full vector, including an all-false native/P2PKH plan. Consumers need its length to
      // distinguish one non-EVM recovery call from no recovery call at all.
      ecrecoverEvmFlags: func.ecrecoverEvmFlags?.length
        ? func.ecrecoverEvmFlags : func.ecrecoverClosureEvmFlags,
    }),
    ...(func.ecrecoverLoopReads && { ecrecoverLoopReads: true }),
    ...(func.unsafeTier !== undefined && { unsafeTier: func.unsafeTier }),
    ...(func.lowLevelCalls && func.lowLevelCalls.length > 0 && {
      lowLevelCalls: func.lowLevelCalls.map((lc, index) => ({
        callMode: lc.callMode,
        // Preserve the compiler-resolved payload source. Delegate-frame planning must bind the exact calldata
        // value consumed by this occurrence; dropping this field forces SDK code to guess from argument order.
        ...(lc.dataParamIndex !== undefined && { dataParamIndex: lc.dataParamIndex }),
        ...(lc.occurrence !== undefined && { occurrence: lc.occurrence }),
        ...(lc.maximumOccurrences !== undefined && { maximumOccurrences: lc.maximumOccurrences }),
        ...(lc.condition !== undefined && { condition: lc.condition }),
        // Always published, `computed` included, so a row that carries NO `target` identifies an artifact
        // compiled before the field existed. Absent is read as unknown, never as an unconstrained target.
        target: callTargets[index] ?? COMPUTED_PROVENANCE,
        // The exact, side-effect-free target recipe when one is proven; otherwise the serialized target of a
        // Solidity-compat call site, for the SDK to name the pinned callee - never for a target that reads a
        // reassigned local (`null`), which has no exact source. The payload rides beside it.
        ...(callTargetSources[index] !== null && (callTargetSources[index] ?? lc.targetSource) !== undefined && {
          targetSource: callTargetSources[index] ?? lc.targetSource,
        }),
        ...(lc.dataSource !== undefined && { dataSource: lc.dataSource }),
      })),
    }),
    ...(delegateForwarding && { delegateForwarding }),
    ...(func.libraryDelegateCalls && func.libraryDelegateCalls.length > 0 && {
      libraryDelegateCalls: func.libraryDelegateCalls.map((ld) => ({
        library: ld.library,
        functionName: ld.functionName,
        ...(ld.args.length > 0 && { args: ld.args }),
      })),
    }),
    ...(func.collectionIterations && func.collectionIterations.length > 0 && {
      collectionIterations: func.collectionIterations.map((ci) => ({
        collection: ci.collection,
        mode: ci.mode,
        iterationIndex: ci.iterationIndex,
        ...(ci.windowCursor !== undefined && { windowCursor: ci.windowCursor }),
        ...(ci.windowBound !== undefined && { windowBound: ci.windowBound }),
      })),
    }),
    ...(func.dynamicReads && func.dynamicReads.length > 0 && { dynamicReads: [...func.dynamicReads] }),
    ...(func.dynamicWrites && func.dynamicWrites.length > 0 && { dynamicWrites: [...func.dynamicWrites] }),
    ...(Object.keys(dynamicWriteSources).length > 0 && { dynamicWriteSources }),
    ...(Object.keys(dynamicWriteGrowth).length > 0 && { dynamicWriteGrowth }),
    ...(dynamicWriteOrder.length > 0 && { dynamicWriteOrder }),
    ...(Object.keys(dynamicWriteRecipes).length > 0 && { dynamicWriteRecipes }),
    ...(routeEntryLoopWrites && routeEntryLoopWrites.some(
      (collection) => !func.sortedBatchInfo?.some((batch) => batch.collection === collection),
    ) && {
      // A fixed atomic batch materializes every target in its block-layout entry slots and uses only its
      // non-target predecessor rewrites as trailing outputs. It is not a runtime loop-output collection: exposing
      // it here makes the SDK attempt to decode vmap slot/link commitments as legacy key/value loop commitments.
      entryLoopWrites: routeEntryLoopWrites.filter(
        (collection) => !func.sortedBatchInfo?.some((batch) => batch.collection === collection),
      ),
      ...(Object.keys(routeEntryLoopWriteSignatures).length > 0 && {
        entryLoopWriteSignatures: routeEntryLoopWriteSignatures,
      }),
    }),
    ...(func.sortedInsertLoops && func.sortedInsertLoops.length > 0 && { sortedInsertLoops: [...func.sortedInsertLoops] }),
    ...(func.sortedInsertLoopInfo && func.sortedInsertLoopInfo.length > 0 && {
      sortedInsertLoopInfo: [...func.sortedInsertLoopInfo],
    }),
    ...(func.sortedUpsertLoopInfo && func.sortedUpsertLoopInfo.length > 0 && {
      sortedUpsertLoopInfo: func.sortedUpsertLoopInfo.map((info) => {
        const prefixCountLocals = info.prefixCountWitnessParam
          ? new Set([info.prefixCountWitnessParam]) : new Set<string>();
        const varyingKeyExpressions = info.varyingKeyExpressions?.map((expression) =>
          serializeCondition(expression, info.iterationCounter, new Set(), prefixCountLocals));
        const condition = info.condition && serializeCondition(info.condition);
        const iterationCondition = info.iterationCondition && serializeCondition(
          info.iterationCondition,
          info.iterationCounter,
        );
        const iterationBreakCondition = info.iterationBreakCondition && serializeCondition(
          info.iterationBreakCondition,
          info.iterationCounter,
        );
        const iterationBound = info.iterationBound && serializeCondition(info.iterationBound);
        const iterationStep = info.iterationCounter?.stepExpression
          && serializeCondition(info.iterationCounter.stepExpression);
        const mutationValueExpression = info.mutationValueExpression && serializeCondition(
          info.mutationValueExpression, info.iterationCounter,
        );
        const mutationIndexExpression = info.mutationIndexExpression && serializeCondition(
          info.mutationIndexExpression, info.iterationCounter,
        );
        const traceLocals = info.valueTraceLocal ? new Set([info.valueTraceLocal]) : new Set<string>();
        const valueTraceInitial = info.valueTraceInitial && serializeCondition(
          info.valueTraceInitial, info.iterationCounter,
        );
        const valueTraceUpdates = info.valueTraceUpdates?.map((update) => ({
          condition: update.condition && serializeCondition(
            update.condition, info.iterationCounter, new Set(), traceLocals,
          ),
          expression: serializeCondition(
            update.expression, info.iterationCounter, new Set(), traceLocals,
          ),
        }));
        const valueTraceAfterUpdates = info.valueTraceAfterUpdates?.map((update) => ({
          condition: update.condition && serializeCondition(
            update.condition, info.iterationCounter, new Set(), traceLocals,
          ),
          expression: serializeCondition(
            update.expression, info.iterationCounter, new Set(), traceLocals,
          ),
        }));
        const prefixCountCondition = info.prefixCountCondition && serializeCondition(
          info.prefixCountCondition, info.iterationCounter,
        );
        if (info.condition && !condition) {
          throw new Error(`Runtime loop condition in '${func.name}' cannot be represented in artifact metadata`);
        }
        if (info.iterationCondition && !iterationCondition) {
          throw new Error(`Runtime loop iteration condition in '${func.name}' cannot be represented in artifact metadata`);
        }
        if (info.iterationBreakCondition && !iterationBreakCondition) {
          throw new Error(`Runtime loop break condition in '${func.name}' cannot be represented in artifact metadata`);
        }
        if (info.iterationBound && !iterationBound) {
          throw new Error(`Runtime loop bound in '${func.name}' cannot be represented in artifact metadata`);
        }
        if (info.iterationCounter?.stepExpression && !iterationStep) {
          throw new Error(`Runtime loop step in '${func.name}' cannot be represented in artifact metadata`);
        }
        if (info.mutationValueExpression && !mutationValueExpression) {
          throw new Error(`Runtime loop mutation value in '${func.name}' cannot be represented in artifact metadata`);
        }
        if (info.mutationIndexExpression && !mutationIndexExpression) {
          throw new Error(`Runtime loop mutation index in '${func.name}' cannot be represented in artifact metadata`);
        }
        if (varyingKeyExpressions?.some((expression) => expression === undefined)) {
          throw new Error(`Runtime loop key in '${func.name}' cannot be represented in artifact metadata`);
        }
        if (info.valueTraceInitial && !valueTraceInitial) {
          throw new Error(`Runtime loop value trace initial value in '${func.name}' cannot be represented`);
        }
        if (valueTraceUpdates?.some((update, index) => !update.expression
          || (!!info.valueTraceUpdates?.[index].condition && !update.condition))) {
          throw new Error(`Runtime loop value trace update in '${func.name}' cannot be represented`);
        }
        if (valueTraceAfterUpdates?.some((update, index) => !update.expression
          || (!!info.valueTraceAfterUpdates?.[index].condition && !update.condition))) {
          throw new Error(`Runtime loop value trace trailing update in '${func.name}' cannot be represented`);
        }
        if (info.prefixCountCondition && !prefixCountCondition) {
          throw new Error(`Runtime loop prefix-count predicate in '${func.name}' cannot be represented`);
        }
        return {
          ...info,
          varyingKeyExpressions: varyingKeyExpressions as ExternalCallExpression[] | undefined,
          condition,
          iterationCondition,
          iterationBreakCondition,
          iterationBound,
          iterationStep,
          mutationValueExpression,
          mutationIndexExpression,
          valueTraceInitial,
          valueTraceUpdates: valueTraceUpdates as Array<{
            condition?: ExternalCallExpression; expression: ExternalCallExpression;
          }> | undefined,
          valueTraceAfterUpdates: valueTraceAfterUpdates as Array<{
            condition?: ExternalCallExpression; expression: ExternalCallExpression;
          }> | undefined,
          prefixCountCondition,
          iterationCounter: undefined,
          ...(info.fixedKeySources && { fixedKeySources: info.fixedKeySources.map((source) => ({
            kind: source.kind,
            ...(source.paramName && { paramName: source.paramName }),
            ...(source.stateVarName && { stateVarName: source.stateVarName }),
            ...(source.stateArrayName && { stateArrayName: source.stateArrayName }),
            ...(source.kind === 'constant' && { constantValue: source.constantValue }),
            ...(source.kind === 'msgSender' && { senderOp: source.senderOp ?? 'msg.sender' }),
            ...(source.kind === 'expression' && { expressionLabel: source.canonical }),
          })) }),
        };
      }),
    }),
    ...(func.sortedBatchInfo && func.sortedBatchInfo.length > 0 && { sortedBatchInfo: [...func.sortedBatchInfo] }),
    ...(func.blockhashReads && func.blockhashReads.length > 0 && { blockhashReads: [...func.blockhashReads] }),
    ...(func.usesBlockOracle && { usesBlockOracle: true }),
    ...(func.messageBusBlockhashReadWidth && func.messageBusBlockhashReads && {
      graphBlockhashOracle: {
        inputBaseParameter: '__internal__blockhashInputIndex' as const,
        rowCount: func.messageBusMaximumRows!,
        readWidth: func.messageBusBlockhashReadWidth,
        slotCount: func.messageBusMaximumRows! * func.messageBusBlockhashReadWidth,
        reads: [...func.messageBusBlockhashReads],
      },
    }),
    ...(func.blockLayout && { blockLayout: func.blockLayout }),
  };
}

/** Extract optional key/value name annotations from a MappingType for the artifact. */
function mappingNameFields(type: Type): Record<string, unknown> {
  if (!(type instanceof MappingType)) return {};
  const result: Record<string, unknown> = {};
  if (type.keyName) result.keyName = type.keyName;
  // Get the innermost value name and count depth
  let depth = 1;
  let inner: MappingType = type;
  while (inner.valueType instanceof MappingType) {
    inner = inner.valueType;
    depth++;
  }
  if (inner.valueName) result.valueName = inner.valueName;
  // For nested mappings, collect all key names if any are present
  if (depth > 1) {
    const keyNames: (string | undefined)[] = [];
    let cur: MappingType = type;
    keyNames.push(cur.keyName);
    while (cur.valueType instanceof MappingType) {
      cur = cur.valueType;
      keyNames.push(cur.keyName);
    }
    if (keyNames.some((n) => n !== undefined)) {
      result.keyNames = keyNames;
    }
  }
  return result;
}

// A source file with no compilable contract - a standalone interface, a file-level enum/struct, or an
// inline-only library - is a valid compilation unit in Solidity (solc emits an ABI with empty bytecode).
// Mirror that: emit a minimal artifact carrying the primary interface's ABI and any declared enums / events /
// errors, with empty bytecode. There is no executable contract, so it is not instantiable (isLibrary: true).
export function generateDeclarationArtifact(
  ast: Ast,
  source: string,
  compilerOptions: CompilerOptions = {},
): Artifact {
  const primary = ast.interfaceDefinitions.find((i) => i.name === ast.libraryName)
    ?? ast.interfaceDefinitions[0];
  // Imported libraries can lift unrelated errors/events into the file-level namespace. An interface factory
  // describes only that interface and its bases, independent of which concrete root imported it.
  const interfaceScope: InterfaceNode[] = [];
  const collectInterfaceScope = (iface: InterfaceNode): void => {
    if (interfaceScope.includes(iface)) return;
    interfaceScope.push(iface);
    for (const parentName of iface.parents) {
      const parent = ast.interfaceDefinitions.find((entry) => entry.name === parentName);
      if (parent) collectInterfaceScope(parent);
    }
  };
  if (primary) collectInterfaceScope(primary);
  // A standalone abstract contract (compiled under evmCompat) has no interface, but its own
  // public/external functions form the ABI - solc emits an ABI + empty bytecode for abstract contracts.
  const abstractContract = ast.contract?.isAbstract ? ast.contract : undefined;
  const declFunctions = primary?.functions
    ?? abstractContract?.functions.filter((fn) => fn.isEntryPoint)
    ?? [];
  const abi: AbiFunction[] = declFunctions.map((fn) => ({
    name: fn.name,
    inputs: fn.parameters.map((p) => ({ name: p.name, type: abiTypeString(p.type) })),
    ...(fn.returnTypes.length > 0 && {
      outputs: fn.returnTypes.map((t) => ({ type: abiTypeString(t) })),
      resultEncoding: externalResultEncoding(fn.returnTypes, compilerOptions),
    }),
  }));

  const allEnums = [
    ...(ast.enumDefinitions || []),
    ...ast.interfaceDefinitions.flatMap((i) => i.enumDefinitions || []),
    ...(abstractContract?.enumDefinitions || []),
  ];
  const enums = allEnums.length > 0
    ? allEnums.map((e) => ({
      name: e.name,
      // Enum values are ordinals; fall back to the member index if a merged/reconstructed enum lost its value
      // (some import-merge paths carry names only) rather than crashing on undefined.toString().
      members: e.members.map((m, i) => ({ name: m.name, value: (m.value ?? BigInt(i)).toString() })),
    }))
    : undefined;

  const allEventDefs = primary ? interfaceScope.flatMap((iface) => iface.eventDefinitions) : [
    ...(ast.eventDefinitions || []), ...(abstractContract?.eventDefinitions || []),
  ];
  const events = allEventDefs.length > 0
    ? [...new Map(allEventDefs.map((ev) => {
      const signature = ev.signature || computeEventSignature(ev.name, ev.parameters.map((p) => abiTypeString(p.type)));
      return [signature, {
        name: ev.name,
        signature,
        parameters: ev.parameters.map((p) => ({
          name: p.name,
          type: abiTypeString(p.type),
          ...(p.indexed && { indexed: true }),
          ...(compilerOptions.evmCompat && isEvmNotationScalarType(p.type) && { notation: 'evm' as const }),
        })),
        ...(ev.isAnonymous && { anonymous: true }),
      }] as const;
    })).values()]
    : undefined;

  const allErrors = primary ? interfaceScope.flatMap((iface) => iface.errorDefinitions) : [
    ...(ast.errorDefinitions || []), ...(abstractContract?.errorDefinitions || []),
  ];
  const errors = allErrors.length > 0
    ? [...new Map(allErrors.map((err) => {
      const signature = err.signature || computeErrorSignature(err.name, err.parameters.map((p) => abiTypeString(p.type)));
      return [signature, {
        name: err.name,
        signature,
        parameters: err.parameters.map((p) => ({ name: p.name, type: abiTypeString(p.type) })),
      }] as const;
    })).values()]
    : undefined;

  return {
    contractName: ast.libraryName ?? abstractContract?.name ?? 'definitions',
    constructorInputs: [],
    abi,
    bytecode: '',
    source,
    isLibrary: true,
    ...(enums && { enums }),
    ...(events && { events }),
    ...(errors && { errors }),
    compiler: {
      name: 'solidc', version,
      options: {
        evmCompat: compilerOptions.evmCompat,
        ...(compilerOptions.addressForm !== undefined && { addressForm: compilerOptions.addressForm }),
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

export function generateArtifact(
  ast: Ast,
  script: Script,
  source: string,
  debug: DebugInformation,
  compilerOptions: CompilerOptions,
  functionBodies?: Record<string, string>,
  fingerprint?: string,
): Artifact {
  const { contract } = ast;

  const constructorInputs = contract.parameters
    .map((parameter) => ({ name: parameter.name, type: abiTypeString(parameter.type) }));

  // Exclude internal/private functions from the ABI (they're implementation details)
  const abiFunctions = contract.functions.filter((func) => {
    const v = func.visibility;
    return v !== 'internal' && v !== 'private';
  });

  // Mirror the stateLayout gate below: writesState is only meaningful (and only emitted) for stateful contracts.
  const isStateful = contract.stateVariables.length > 0 || contract.collections.length > 0
    || compilerOptions.forceStateful || contract.usesBlockhash || contract.deploysStatefulChild
    || contract.deploysWithValue
    || contract.functions.some((func) => func.modifiers.includes(FunctionModifier.SELFDESTRUCT));

  const abi: AbiFunction[] = abiFunctions.map((func) => ({
    name: func.name,
    ...(func.mappingArrayPagination && { mappingArrayPagination: func.mappingArrayPagination }),
    ...(func.functionSelector && { selector: binToHex(func.functionSelector) }),
    // A caller several OP_INVOKE edges above a runtime journal receives a physical copy of the leaf's hidden
    // context so generated calls have one typed frame. Those forwarded operands are route-owned implementation
    // details; publishing them as source inputs leaks the depth of the helper closure and makes equivalent
    // source signatures ABI-incompatible. Parameters introduced by the function's own lowering remain present:
    // SDK journal planning still consumes those physical witness declarations.
    inputs: func.parameters.filter((parameter) => !parameter.kernelJournalForwardedContext).map((parameter) => ({
      name: parameter.name,
      type: abiTypeString(parameter.type),
    })),
    ...(func.returnTypes.length > 0 && {
      outputs: func.returnTypes.map((type) => ({ type: abiTypeString(type) })),
      // The compiler-generated route always carries its aggregate vector in one compact outer bytes field.
      // Individual handler rows independently publish EVM or compact result encodings inside that carrier.
      resultEncoding: func.messageBusRoute
        ? 'compact-pushdata-v1' : externalResultEncoding(func.returnTypes, compilerOptions),
    }),
    ...(func.settlesCallRecord === true && { callRecord: true }),
    ...(func.modifiers.length > 0 && {
      modifiers: func.modifiers.map((m) => m.toString()),
    }),
    ...(func.nativeSelfBatchDispatcher && { nativeSelfBatchDispatcher: true }),
    ...buildFunctionAbiMetadata(func, isStateful, contract, ast.interfaceDefinitions, compilerOptions),
    ...(func.splitCountParam && { splitCountParam: func.splitCountParam }),
    ...(func.mergeCountParam && { mergeCountParam: func.mergeCountParam }),
  }));

  if (contract.constructorDef) {
    abi.push({
      name: contract.constructorDef.name, // '__construct'
      // The selector is needed to spend down the constructor branch at genesis (the SDK deploy probe and the
      // genesis tx push it ahead of the redeem script); without it the entry dispatch underflows.
      ...(contract.constructorDef.functionSelector
        && { selector: binToHex(contract.constructorDef.functionSelector) }),
      inputs: contract.constructorDef.parameters.map((parameter) => ({
        name: parameter.name,
        type: abiTypeString(parameter.type),
      })),
      ...(contract.constructorDef.modifiers.length > 0 && {
        modifiers: contract.constructorDef.modifiers.map((m) => m.toString()),
      }),
      ...buildFunctionAbiMetadata(contract.constructorDef, false, contract, ast.interfaceDefinitions, compilerOptions),
    });
  }

  if (contract.fallbackDef) {
    abi.push({
      name: '__fallback',
      ...(contract.fallbackDef.functionSelector && { selector: binToHex(contract.fallbackDef.functionSelector) }),
      inputs: [],
      isFallback: true,
      // A fallback that declares a return publishes it like any other body: a proxy's fallback returns the bytes
      // its delegate recorded, and a caller that holds only the proxy's artifact reads that fact here.
      ...(contract.fallbackDef.returnTypes.length > 0 && {
        outputs: contract.fallbackDef.returnTypes.map((type) => ({ type: abiTypeString(type) })),
        resultEncoding: externalResultEncoding(contract.fallbackDef.returnTypes, compilerOptions),
      }),
      ...(contract.fallbackDef.modifiers.length > 0 && {
        modifiers: contract.fallbackDef.modifiers.map((m) => m.toString()),
      }),
      ...buildFunctionAbiMetadata(contract.fallbackDef, false, contract, ast.interfaceDefinitions, compilerOptions),
    });
  }

  if (contract.receiveDef) {
    abi.push({
      name: '__receive',
      ...(contract.receiveDef.functionSelector && { selector: binToHex(contract.receiveDef.functionSelector) }),
      inputs: [],
      isReceive: true,
      modifiers: ['payable'],
      ...buildFunctionAbiMetadata(contract.receiveDef, false, contract, ast.interfaceDefinitions, compilerOptions),
    });
  }

  const bytecode = scriptToAsm(script);

  // Struct field layouts (name + ordered field types). Emitted so the SDK can encode struct-typed function
  // and constructor arguments (Solidity encodes a struct as an ABI tuple). Shared by the top-level artifact
  // field (reachable for stateless contracts, which have no stateLayout) and the stateLayout's own copy (the
  // stateful state machinery passes the self-contained layout around, not the whole artifact).
  const structDefs = [...(ast.structDefinitions || []), ...contract.structDefinitions].map((sd) => ({
    name: sd.name,
    fields: sd.fields.map((f) => ({
      name: f.name,
      type: f.type instanceof EnumType ? 'bigint' : f.type.toString(),
    })),
  }));

  // Build state layout if the contract has state variables or collections, or forceStateful is set (a
  // zero-state stateful contract gets an empty stateLayout so the SDK sees it as stateful and bakes the
  // master-NFT self-pin covenant; see the forceStateful compiler option).
  let stateLayout: StateLayout | undefined;
  if (contract.stateVariables.length > 0 || contract.collections.length > 0
    || compilerOptions.forceStateful || contract.usesBlockhash || contract.deploysStatefulChild
    || contract.deploysWithValue
    || contract.functions.some((func) => func.modifiers.includes(FunctionModifier.SELFDESTRUCT))) {
    stateLayout = {
      variables: contract.stateVariables.map((sv) => ({
        name: sv.name,
        // Enums are nominal at callable ABI boundaries, but state commitments contain their integer ordinal.
        // Publishing the physical type lets the shared state codec encode/decode enum state without a separate
        // artifact-level nominal-type registry on every StateLayout consumer.
        type: sv.type instanceof EnumType ? 'bigint' : abiTypeString(sv.type),
        nftIndex: sv.nftIndex,
        fieldIndex: sv.fieldIndex,
        ...(sv.visibility !== StateVariableVisibility.PUBLIC && { visibility: sv.visibility }),
        ...(sv.immutable && { immutable: true }),
        ...(sv.isPacked && { packed: true }),
        ...(sv.isDynamic && { dynamic: true }),
        ...(sv.contractTypeName && { contractType: sv.contractTypeName }),
      })),
      dataNftCount: contract.stateVariables.length > 0
        ? Math.max(...contract.stateVariables.map((sv) => sv.nftIndex)) + 1
        : 0,
      commitmentLimit: compilerOptions.commitmentLimit ?? 128,
      ...(compilerOptions.tagSingletonDataNfts === true && contract.stateVariables.length > 0
        && contract.stateVariables.every((variable) => variable.nftIndex === 0) && { taggedDataNfts: true as const }),
      ...(contract.constructorDef && {
        constructorInputs: contract.constructorDef.parameters.map((p) => ({
          name: p.name,
          type: abiTypeString(p.type),
        })),
      }),
      ...(contract.deployReads.length > 0 && { deployReads: contract.deployReads }),
      ...(contract.collections.length > 0 && {
        collections: contract.collections.map((coll) => ({
          name: coll.name,
          signature: computeCollectionSignature(coll.name, coll.type.toString()),
          kind: (coll.type instanceof ArrayType ? 'array' : 'mapping') as 'mapping' | 'array',
          keyType: keyEncodingTypeString(coll.keyType),
          valueType: coll.innermostValueType.toString(),
          ...(coll.sorted && (compilerOptions.evmCompat)
            && compilerOptions.composition !== 'framed'
            && coll.allKeyTypes.some((type) => /^address(?: payable)?$/.test(keyEncodingTypeString(type)))
            && { addressKeyEncoding: 'identity20' as const }),
          ...(coll.depth > 1 && {
            keyTypes: coll.allKeyTypes.map(keyEncodingTypeString),
          }),
          ...mappingNameFields(coll.type),
          ...(coll.type instanceof ArrayType && {
            elementType: coll.type.elementType.toString(),
            ...(coll.type.bound !== undefined && { bound: coll.type.bound }),
          }),
          ...(coll.immutable && { immutable: true }),
          ...(coll.sorted && { sorted: true }),
          ...(coll.sorted && isChunkableValueType(coll.innermostValueType) && { chunkableValue: true }),
          ...(coll.enumerable && { enumerable: true }),
        })),
      }),
      ...(contract.collections.some((c) => !(c.type instanceof ArrayType)) && {
        mappings: contract.collections
          .filter((coll) => !(coll.type instanceof ArrayType))
          .map((coll) => ({
            name: coll.name,
            signature: computeCollectionSignature(coll.name, coll.type.toString()),
            kind: 'mapping' as const,
            keyType: keyEncodingTypeString(coll.keyType),
            valueType: coll.innermostValueType.toString(),
            ...(coll.sorted && (compilerOptions.evmCompat)
              && compilerOptions.composition !== 'framed'
              && coll.allKeyTypes.some((type) => /^address(?: payable)?$/.test(keyEncodingTypeString(type)))
              && { addressKeyEncoding: 'identity20' as const }),
            ...(coll.depth > 1 && {
              keyTypes: coll.allKeyTypes.map(keyEncodingTypeString),
            }),
            ...mappingNameFields(coll.type),
            ...(coll.immutable && { immutable: true }),
            ...(coll.sorted && { sorted: true }),
            ...(coll.sorted && isChunkableValueType(coll.innermostValueType) && { chunkableValue: true }),
            ...(coll.enumerable && { enumerable: true }),
          })),
      }),
      ...(structDefs.length > 0 && { structs: structDefs }),
    };
  }

  // Build events from file-level (library imports), contract-level, emitted sibling-contract event defs, and the
  // definitions retained by each surviving emit site. The last source matters because lowering can inline or erase
  // the emit statement itself (an inherited internal helper such as OpenZeppelin's `_approve`), so the handler's
  // `emits` metadata can name a schema that no longer has a statement to be discovered from. Deduplicate by
  // signature exactly as before.
  const emittedEventDefs = contract.functions
    .flatMap((func) => func.emitInfos ?? [])
    .flatMap((info) => (info.eventDefinition ? [info.eventDefinition] : []));
  const ownEventDefs = [...contract.eventDefinitions, ...contract.emittedForeignEvents, ...emittedEventDefs];
  // Solidity's rule: a file-level, library or imported event is listed only when the contract emits it. SEC-10 pins
  // forged logs only for a contract with events, so listing one it never emits let a forged own-category immutable NFT
  // beside any call read as its log. A split shard holds some bodies only and lists what its logical contract emits.
  const listedSignatures = new Set([
    ...ownEventDefs.map((ev) => ev.signature),
    ...((compilerOptions as { __logicalContractEvents?: readonly string[] }).__logicalContractEvents ?? []),
  ]);
  let emittedSignatures: Set<string> | undefined;
  const listsFileEvent = (ev: EventDefinitionNode): boolean => listedSignatures.has(ev.signature)
    || (emittedSignatures ??= emittedEventSignatures(contract)).has(ev.signature);
  const allEventDefs = [
    ...(ast.eventDefinitions || []).filter(listsFileEvent), ...ownEventDefs,
  ].filter((ev, i, a) => a.findIndex((e) => e.signature === ev.signature) === i);
  const events = allEventDefs.length > 0
    ? allEventDefs.map((ev) => ({
      name: ev.name,
      signature: ev.signature,
      parameters: ev.parameters.map((p) => ({
        name: p.name,
        type: abiTypeString(p.type),
        ...(p.indexed && { indexed: true }),
        ...(compilerOptions.evmCompat && isEvmNotationScalarType(p.type) && { notation: 'evm' as const }),
      })),
      ...(ev.isAnonymous && { anonymous: true }),
    }))
    : undefined;

  // Build errors from both file-level and contract-level error definitions
  const allErrors = [...(ast.errorDefinitions || []), ...contract.errorDefinitions];
  const errors = allErrors.length > 0
    ? allErrors.map((err) => ({
      name: err.name,
      signature: err.signature,
      parameters: err.parameters.map((p) => ({ name: p.name, type: abiTypeString(p.type) })),
    }))
    : undefined;

  // Build enums from file-level, interface-level, and contract-level enum definitions
  const allEnums = [
    ...(ast.enumDefinitions || []),
    ...ast.interfaceDefinitions.flatMap((i) => i.enumDefinitions || []),
    ...contract.enumDefinitions,
  ];
  const enums = allEnums.length > 0
    ? allEnums.map((e) => ({
      name: e.name,
      // Enum values are ordinals; fall back to the member index if a merged/reconstructed enum lost its value
      // (some import-merge paths carry names only) rather than crashing on undefined.toString().
      members: e.members.map((m, i) => ({ name: m.name, value: (m.value ?? BigInt(i)).toString() })),
    }))
    : undefined;

  // Collect external interface info from all referenced interfaces
  const referencedInterfaces = new Set<string>();
  for (const func of contract.functions) {
    if (func.externalReads) {
      for (const er of func.externalReads) {
        referencedInterfaces.add(er.interfaceName);
      }
    }
    if (func.externalCalls) {
      for (const ec of func.externalCalls) {
        referencedInterfaces.add(ec.interfaceName);
      }
    }
    if (func.externalOutStateReads) {
      for (const os of func.externalOutStateReads) {
        referencedInterfaces.add(os.interfaceName);
      }
    }
  }

  const externalInterfaces: ExternalInterfaceInfo[] | undefined = referencedInterfaces.size > 0
    ? [...referencedInterfaces].map((ifaceName) => {
      const iface = ast.interfaceDefinitions.find((i) => i.name === ifaceName);
      if (!iface) return undefined;
      return buildExternalInterfaceInfo(iface, compilerOptions, ast.interfaceDefinitions);
    }).filter((x): x is ExternalInterfaceInfo => x !== undefined)
    : undefined;

  // External script libraries the contract depends on, with a self-describing descriptor. Branded
  // (category-salted side-car) for stateful contracts; shared otherwise. See docs/external-libraries.md.
  const resolvedLibraries = resolveLibraries(compilerOptions.userLibraries);
  const allFns = [contract.constructorDef, contract.fallbackDef, contract.receiveDef, ...contract.functions];
  const usedLibraryNames = [...new Set(allFns.flatMap((f) => f?.usedLibraries ?? []))];
  const inlinedNames = new Set(allFns.flatMap((f) => f?.inlinedLibraries ?? []));
  const externalLibraries: ExternalLibraryAbi[] | undefined = usedLibraryNames.length > 0
    ? usedLibraryNames.map((name) => {
      const lib = resolvedLibraries[name];
      // result-NFT (compute) model: the side-car COMPUTES keccak in its own budget and returns it in its NFT
      // commitment; the contract never loads a blob, so the inline-loader fields (blobHash/codeBegin/codeEnd) do
      // not apply (they would describe a blob that is never inlined). keccak256 is always the compute model.
      const isResultNft = name === 'keccak256' && allFns.some((f) => f?.keccakCompute);
      if (isResultNft) {
        return {
          name,
          branded: stateLayout !== undefined,
          abi: lib.abi,
          resultNft: true,
          // minInstances = the max keccak256 call count across functions (side-cars to deploy at creation);
          // unbounded flags a keccak-in-loop function whose runtime count exceeds that static minimum.
          minInstances: Math.max(0, ...allFns.map((f) => {
            const calls = f?.keccakPreimageParams?.length ?? 0;
            return f?.keccakInLoop ? calls : Math.ceil(calls / 3);
          })),
          ...(allFns.some((f) => f?.keccakInLoop) && { unbounded: true }),
        };
      }
      // inline / side-car-blob model: the loader strips to codeBegin/codeEnd in the side-car input bytecode.
      const range = sidecarCodeRange(lib.blob);
      return {
        name,
        blobHash: binToHex(lib.blobHash),
        branded: stateLayout !== undefined,
        inline: inlinedNames.has(name), // inlined into the contract bytecode -> SDK skips the side-car
        codeBegin: range.codeBegin,
        codeEnd: range.codeEnd,
        abi: lib.abi,
        // built-ins resolve by name in the SDK; user libraries embed their blob
        ...(BUILTIN_LIBRARIES[name] ? {} : { code: binToHex(lib.blob) }),
      };
    })
    : undefined;

  return {
    contractName: contract.name,
    constructorInputs,
    abi,
    bytecode,
    source,
    debug,
    ...(functionBodies && { functionBodies }),
    ...(fingerprint && { fingerprint }),
    ...(stateLayout && { stateLayout }),
    ...(structDefs.length > 0 && { structs: structDefs }),
    ...(externalInterfaces && externalInterfaces.length > 0 && { externalInterfaces }),
    ...(events && { events }),
    ...(errors && { errors }),
    ...(enums && { enums }),
    ...(externalLibraries && { externalLibraries }),
    ...(contract.isLibraryContract && { isLibrary: true }),
    ...(contract.isBrandedLibrary && { brandedLibrary: true }),
    compiler: {
      name: 'solidc',
      version,
      options: {
        evmCompat: compilerOptions.evmCompat,
        enforceFunctionParameterTypes: compilerOptions.enforceFunctionParameterTypes,
        enforceLocktimeGuard: compilerOptions.enforceLocktimeGuard,
        enforceFinalRequire: compilerOptions.enforceFinalRequire,
        allowUnsafeOperations: compilerOptions.allowUnsafeOperations,
        commitmentLimit: compilerOptions.commitmentLimit,
        ...(compilerOptions.tagSingletonDataNfts === true && { tagSingletonDataNfts: true }),
        messageBus: compilerOptions.messageBus,
        // Published only when the source chose it: omitting it follows the mode, which `resolveAddressForm`
        // re-derives on the artifact, so an artifact that names no form reads back the one its compile used
        // without every artifact gaining a field. The SDK's value emulation reads it back through
        // `artifactAddressForm`, so an explicit 'bytecode' compile is not mistaken for the 'hash' default.
        ...(compilerOptions.addressForm !== undefined && { addressForm: compilerOptions.addressForm }),
        ...(compilerOptions.messageBus && compilerOptions.messageBusKernel !== undefined
          && { messageBusKernel: compilerOptions.messageBusKernel }),
        ...(compilerOptions.messageBusEntryPoolCapacity !== undefined
          && { messageBusEntryPoolCapacity: compilerOptions.messageBusEntryPoolCapacity }),
        ...(compilerOptions.messageBusDirectParticipant === true && { messageBusDirectParticipant: true }),
        ...(compilerOptions.sourceMap === false && { sourceMap: false }),
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

function buildExternalInterfaceInfo(
  iface: InterfaceNode,
  compilerOptions: CompilerOptions,
  allInterfaces: InterfaceNode[],
): ExternalInterfaceInfo {
  // Collect all state variables including from parent interfaces
  const allVars = getAllInterfaceStateVarsFlat(iface, allInterfaces);

  // Build state layout using same bin-packing as compiler
  const commitmentLimit = compilerOptions.commitmentLimit ?? 128;
  const variables: { name: string; type: string; nftIndex: number; fieldIndex: number; visibility?: string }[] = [];
  let nftIndex = 0;
  let fieldIndex = 0;
  let currentNftUsed = 0;

  // Collect struct definitions from the interface and parents for size computation
  const structDefs = collectInterfaceStructDefs(iface, allInterfaces);

  for (const sv of allVars) {
    const typeStr = sv.type.toString();
    const maxSize = getMaxEncodedSize(typeStr, structDefs);
    const isExternal = sv.visibility === StateVariableVisibility.EXTERNAL;
    const isStruct = structDefs.some((s) => s.name === typeStr);

    if (isExternal) {
      if (currentNftUsed > 0) { nftIndex++; fieldIndex = 0; currentNftUsed = 0; }
      variables.push({ name: sv.name, type: typeStr, nftIndex, fieldIndex: 0, visibility: 'external' });
      nftIndex++; fieldIndex = 0; currentNftUsed = 0;
    } else if (isStruct) {
      // Struct must be placed last in its NFT (same rule as SymbolTableTraversal)
      if (currentNftUsed + maxSize > stateNftPackingLimit(commitmentLimit, nftIndex,
        compilerOptions.tagSingletonDataNfts) && currentNftUsed > 0) {
        nftIndex++; fieldIndex = 0; currentNftUsed = 0;
      }
      variables.push({ name: sv.name, type: typeStr, nftIndex, fieldIndex });
      fieldIndex++; currentNftUsed += maxSize;
      // Force next var to go to a new NFT since struct must be last
      nftIndex++; fieldIndex = 0; currentNftUsed = 0;
    } else {
      if (currentNftUsed + maxSize > stateNftPackingLimit(commitmentLimit, nftIndex,
        compilerOptions.tagSingletonDataNfts) && currentNftUsed > 0) {
        nftIndex++; fieldIndex = 0; currentNftUsed = 0;
      }
      variables.push({ name: sv.name, type: typeStr, nftIndex, fieldIndex });
      fieldIndex++; currentNftUsed += maxSize;
    }
  }

  const dataNftCount = variables.length > 0 ? Math.max(...variables.map((v) => v.nftIndex)) + 1 : 0;

  // Collect collections
  const allCollections = getAllInterfaceCollectionsFlat(iface, allInterfaces);
  const collections = allCollections.length > 0
    ? allCollections.map((coll) => ({
      name: coll.name,
      signature: computeCollectionSignature(coll.name, coll.type.toString()),
      kind: (coll.type instanceof ArrayType ? 'array' : 'mapping') as 'mapping' | 'array',
      keyType: keyEncodingTypeString(coll.keyType),
      valueType: coll.innermostValueType.toString(),
      ...mappingNameFields(coll.type),
    }))
    : undefined;

  // Build interface function ABIs
  const ifaceFunctions = iface.functions.map((func) => {
    const paramTypes = func.parameters.map((p) => (compilerOptions.evmCompat
      ? canonicalSelectorType(p.type) : abiTypeString(p.type)));
    const sig = `${func.name}(${paramTypes.join(',')})`;
    return {
      name: func.name,
      inputs: func.parameters.map((p) => ({ name: p.name, type: abiTypeString(p.type) })),
      selector: computeFunctionSelectorHex(sig, compilerOptions.evmCompat === true),
    };
  });

  return {
    name: iface.name,
    stateLayout: {
      variables,
      dataNftCount,
      commitmentLimit,
      ...(compilerOptions.tagSingletonDataNfts === true && dataNftCount === 1 && { taggedDataNfts: true as const }),
      ...(collections && { collections }),
    },
    ...(ifaceFunctions.length > 0 && { abi: ifaceFunctions }),
  };
}

function getAllInterfaceStateVarsFlat(
  iface: InterfaceNode,
  allInterfaces: InterfaceNode[],
): typeof iface.stateVariables {
  const varMap = new Map<string, typeof iface.stateVariables[0]>();

  // Recursively collect from parent interfaces first (parents override by order)
  for (const parentName of iface.parents) {
    const parent = allInterfaces.find((i) => i.name === parentName);
    if (!parent) continue;
    for (const sv of getAllInterfaceStateVarsFlat(parent, allInterfaces)) {
      varMap.set(sv.name, sv);
    }
  }

  // Then add/override with the interface's own state variables
  for (const sv of iface.stateVariables) {
    varMap.set(sv.name, sv);
  }

  return [...varMap.values()];
}

function getAllInterfaceCollectionsFlat(
  iface: InterfaceNode,
  allInterfaces: InterfaceNode[],
): InterfaceCollectionNode[] {
  const collMap = new Map<string, InterfaceCollectionNode>();

  for (const parentName of iface.parents) {
    const parent = allInterfaces.find((i) => i.name === parentName);
    if (!parent) continue;
    for (const coll of getAllInterfaceCollectionsFlat(parent, allInterfaces)) {
      collMap.set(coll.name, coll);
    }
  }

  for (const coll of iface.collections) {
    collMap.set(coll.name, coll);
  }

  return [...collMap.values()];
}

function collectInterfaceStructDefs(
  iface: InterfaceNode,
  allInterfaces: InterfaceNode[],
): StructDefinitionNode[] {
  const structMap = new Map<string, StructDefinitionNode>();
  for (const parentName of iface.parents) {
    const parent = allInterfaces.find((i) => i.name === parentName);
    if (!parent) continue;
    for (const sd of collectInterfaceStructDefs(parent, allInterfaces)) {
      structMap.set(sd.name, sd);
    }
  }
  for (const sd of (iface.structDefinitions ?? [])) {
    structMap.set(sd.name, sd);
  }
  return [...structMap.values()];
}

function getMaxEncodedSize(typeStr: string, structDefs?: StructDefinitionNode[]): number {
  // Check struct types first (recursive sum of field sizes)
  if (structDefs) {
    const structDef = structDefs.find((s) => s.name === typeStr);
    if (structDef) {
      return structDef.fields.reduce(
        (sum, f) => sum + getMaxEncodedSize(f.type.toString(), structDefs), 0,
      );
    }
  }
  if (typeStr === 'bool') return 1;
  if (typeStr === 'bigint') return 9;
  if (typeStr === 'pubkey') return 34;
  if (typeStr === 'sig') return 74;
  if (typeStr === 'datasig') return 66;
  // Bounded int types (int8, uint256, etc.)
  const intMatch = typeStr.match(/^u?int(\d+)$/);
  if (intMatch) {
    const bits = parseInt(intMatch[1], 10);
    const dataBytes = Math.ceil((bits + 1) / 8);
    if (dataBytes <= 75) return dataBytes + 1;
    if (dataBytes <= 255) return dataBytes + 2;
    return dataBytes + 3;
  }
  // Fixed-point types (fixed128x18, ufixed64x8)
  const fixedMatch = typeStr.match(/^u?fixed(\d+)x\d+$/);
  if (fixedMatch) {
    const bits = parseInt(fixedMatch[1], 10);
    const dataBytes = Math.ceil((bits + 1) / 8);
    if (dataBytes <= 75) return dataBytes + 1;
    if (dataBytes <= 255) return dataBytes + 2;
    return dataBytes + 3;
  }
  const bytesMatch = typeStr.match(/^bytes(\d+)$/);
  if (bytesMatch) {
    const n = parseInt(bytesMatch[1], 10);
    if (n === 0) return 1;
    if (n === 1) return 2;
    if (n <= 75) return n + 1;
    if (n <= 255) return n + 2;
    return n + 3;
  }
  return 9;
}

// strip verbose debug info (and optionally source) from artifact for production use
export function stripArtifact(
  artifact: Artifact,
  options?: { stripSource?: boolean },
): Omit<Artifact, 'debug'> {
  const stripped = { ...artifact };
  delete stripped.debug;
  delete stripped.functionBodies;
  if (options?.stripSource) {
    (stripped as any).source = '';
  }
  return stripped;
}
