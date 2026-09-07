import {
  ArrayAccessNode, ArrayAssignNode, ArrayDeleteNode, ArrayPopNode, ArrayPushNode, AssignNode, BinaryOpNode,
  BlockNode, BoolLiteralNode, CastNode,
  BranchNode, BreakNode, ContractNode,
  DeleteStateNode, DoWhileNode, EmitStatementNode, FunctionCallNode, FunctionCallStatementNode,
  FunctionDefinitionNode, FunctionModifier, IdentifierNode,
  ExpressionNode, ExternalCallExpression, FieldAccessNode, LiteralNode, MappingAccessNode, MappingAssignNode,
  MappingDeleteNode, MappingFieldAssignNode,
  NewArrayNode, Node, RequireNode, ReturnNode, SourceFileNode, StatementNode, UnaryOpNode,
  StateAccessNode, StateAssignNode, SwitchNode, TernaryOpNode, VariableDefinitionNode, WhileNode, IntLiteralNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';
import { BinaryOperator, UnaryOperator } from '../ast/Operator.js';
import { ArrayType, IntType, MappingType, PrimitiveType } from '@solidcash/utils';

type RecursiveFoldVariant =
  | {
    kind: 'binary';
    operator: BinaryOperator;
    recursiveOnLeft: boolean;
    deferredOperandKey?: string;
    deferredOperand?: ExpressionNode;
  }
  | { kind: 'unary'; operator: UnaryOperator };

type RecursiveFoldStep =
  | (Extract<RecursiveFoldVariant, { kind: 'binary' }> & { operand: ExpressionNode })
  | Extract<RecursiveFoldVariant, { kind: 'unary' }>;

interface RecursiveFoldShape {
  variants: RecursiveFoldVariant[];
  deferredOperandKeys: ReadonlySet<string>;
}

interface AffineMappingRecursion {
  inductionIndex: number;
  baseIndex: number;
  stepExpression: ExpressionNode;
}

interface AffinePostEffectRecursion {
  inductionIndex: number;
  stepExpression: ExpressionNode;
  parameterProgressions: AffineParameterProgression[];
  resultDefinition: VariableDefinitionNode;
  baseReturn: ReturnNode;
  effects: StatementNode[];
  emits: Array<{ node: EmitStatementNode; condition?: ExpressionNode }>;
}

interface AffineVoidPostEffectRecursion {
  inductionIndex: number;
  stepExpression: ExpressionNode;
  parameterProgressions: AffineParameterProgression[];
  effects: StatementNode[];
  emits: Array<{ node: EmitStatementNode; condition?: ExpressionNode }>;
}

interface AffineVoidMixedEventRecursion {
  inductionIndex: number;
  stepExpression: ExpressionNode;
  parameterProgressions: AffineParameterProgression[];
  prefix: StatementNode[];
  suffix: StatementNode[];
  prefixEmits: Array<{ node: EmitStatementNode; condition?: ExpressionNode }>;
  suffixEmits: Array<{ node: EmitStatementNode; condition?: ExpressionNode }>;
}

interface AffineParameterProgression {
  parameterIndex: number;
  subtract: boolean;
  stepExpression: ExpressionNode;
  /** Coefficient of the descending induction parameter in a counter-dependent additive step. */
  counterSlope?: ExpressionNode;
}

interface AffineEventRecursion {
  inductionIndex: number;
  stepValue: ExternalCallExpression;
  continueCondition: ExternalCallExpression;
  emits: Array<{ node: EmitStatementNode; condition?: ExpressionNode }>;
  stepExpression?: ExpressionNode;
  parameterProgressions?: AffineParameterProgression[];
}

type AffineRecursiveMappingWrite = MappingAssignNode | MappingDeleteNode;

interface AffineRecursiveMappingRead {
  node: MappingAccessNode;
  consumer: StatementNode;
}

/**
 * Lower conservative self- or mutually tail-recursive helpers to ordinary loops before helper inlining:
 *
 *   function step(T x) returns (T r) { if (done) r = value; else r = step(next); }
 *
 * becomes, schematically:
 *
 *   function step(T x) returns (T r) {
 *     bool repeat = true;
 *     while (repeat) { repeat = false; if (done) r = value; else { T t = next; x = t; repeat = true; } }
 *   }
 *
 * This matters for BCH external-call helpers. Once such a helper is cloned into an entry point, its outgoing
 * calls belong to that entry's physical covenant layout (including loop-indexed groups); invoking the original
 * recursive subroutine would incorrectly re-enter a separately inferred layout. Tail lowering keeps every
 * eventual call in the one caller-owned frame while preserving dynamic recursion depth as loop iterations.
 *
 * Self recursion supports named or unnamed result tuples and void calls. A mutual cycle additionally requires one
 * homogeneous parameter/result frame and unambiguous function names. Every recursive call must be tail-positioned
 * through enclosing blocks/branches. Calls in conditions, loops, arguments, or before later statements are left
 * untouched.
 */
export default class LowerTailRecursion extends AstTraversal {
  private counter = 0;
  private finiteArraySpecializationBudget = 256;
  private scalarStateNames = new Set<string>();
  private structConstructorNames = new Set<string>();
  private sortedMappingNames = new Set<string>();

  /** Return the constant component of the deliberately narrow recursive key grammar `counter +/- literal`.
   * Keeping the coefficient exactly one lets resource domains be compared without an SMT-style expression
   * solver. The recursive step supplies the common progression for every retained frame. */
  private affineRecursiveKeyOffset(key: ExpressionNode, inductionName: string): bigint | undefined {
    if (key instanceof IdentifierNode && key.name === inductionName) return 0n;
    if (!(key instanceof BinaryOpNode) || !(key.right instanceof IntLiteralNode)
      || !(key.left instanceof IdentifierNode) || key.left.name !== inductionName) return undefined;
    if (key.operator === BinaryOperator.PLUS) return key.right.value;
    if (key.operator === BinaryOperator.MINUS) return -key.right.value;
    return undefined;
  }

  /** Collect collection reads which the counter-loop pass can turn into authenticated old-value vectors. A
   * mapping assignment consumes its vector in physical key order. Requirements consume their vectors in
   * recursive source order, carrying finite replayable if/else reachability into the selected domain. Predicates,
   * event arguments, destination keys, and other effects remain outside this slice. */
  private affineRecursiveMappingReads(
    effects: readonly StatementNode[], writes: readonly AffineRecursiveMappingWrite[], inductionName: string,
  ): AffineRecursiveMappingRead[] | undefined {
    const reads: AffineRecursiveMappingRead[] = [];
    let valid = true;
    const containsMappingRead = (node: Node): boolean => {
      if (node instanceof MappingAccessNode) return true;
      return Object.entries(node).some(([key, child]) => {
        if (['resolvedFunction', 'definition', 'symbolTable', 'location', 'type', 'collection'].includes(key)) {
          return false;
        }
        if (child instanceof Node) return containsMappingRead(child);
        return Array.isArray(child) && child.some((item) => item instanceof Node && containsMappingRead(item));
      });
    };
    const collect = (node: Node, consumer: StatementNode): void => {
      if (node instanceof MappingAccessNode) {
        // A collection-dependent key would require authenticating the inner read before deriving the outer row.
        if (node.keys.length !== 1 || node.keys.some(containsMappingRead)
          || this.affineRecursiveKeyOffset(node.keys[0], inductionName) === undefined) valid = false;
        else reads.push({ node, consumer });
        return;
      }
      for (const [key, child] of Object.entries(node)) {
        if (['resolvedFunction', 'definition', 'symbolTable', 'location', 'type', 'collection'].includes(key)) {
          continue;
        }
        if (child instanceof Node) collect(child, consumer);
        else if (Array.isArray(child)) {
          for (const item of child) if (item instanceof Node) collect(item, consumer);
        }
      }
    };
    for (const write of writes) {
      if (!(write instanceof MappingAssignNode)) continue;
      // A read used to derive the destination key has no typed value-vector slot in the row IR.
      if (write.keys.some(containsMappingRead)) return undefined;
      collect(write.expression, write);
    }
    const collectRequirements = (effect: StatementNode): void => {
      if (effect instanceof RequireNode) collect(effect.expression, effect);
      else if (effect instanceof BlockNode) {
        for (const nested of effect.statements ?? []) collectRequirements(nested);
      } else if (effect instanceof BranchNode) {
        collectRequirements(effect.ifBlock);
        if (effect.elseBlock) collectRequirements(effect.elseBlock);
      } else if (effect instanceof SwitchNode) {
        for (const arm of effect.cases) collectRequirements(arm.body);
        if (effect.defaultCase) collectRequirements(effect.defaultCase);
      }
    };
    for (const effect of effects) collectRequirements(effect);
    return valid ? reads : undefined;
  }

  /** Prove that every physical entry is owned by at most one recursive resource stream. A same-key read nested
   * in its own assignment is an ordinary authenticated RMW. Every other read/write or write/write pair sharing a
   * collection must have disjoint affine domains for all retained frames. For a constant positive step, two
   * `counter + offset` progressions intersect exactly when their offset difference is a step multiple no larger
   * than the 63-frame span. Runtime steps cannot establish cross-stream disjointness and fail closed. */
  private affineRecursiveResourcesSound(
    writes: readonly AffineRecursiveMappingWrite[], reads: readonly AffineRecursiveMappingRead[],
    inductionName: string, stepExpression: ExpressionNode,
  ): boolean {
    const writeOffsets = new Map<AffineRecursiveMappingWrite, bigint>();
    for (const write of writes) {
      if (write.keys.length !== 1) return false;
      const offset = this.affineRecursiveKeyOffset(write.keys[0], inductionName);
      if (offset === undefined) return false;
      writeOffsets.set(write, offset);
    }
    const step = stepExpression instanceof IntLiteralNode && stepExpression.value > 0n
      ? stepExpression.value : undefined;
    const disjoint = (left: bigint, right: bigint): boolean => {
      if (step === undefined) return false;
      const difference = left >= right ? left - right : right - left;
      return difference % step !== 0n || difference / step > 63n;
    };
    for (let left = 0; left < writes.length; left += 1) {
      for (let right = left + 1; right < writes.length; right += 1) {
        if (writes[left].name === writes[right].name
          && !disjoint(writeOffsets.get(writes[left])!, writeOffsets.get(writes[right])!)) return false;
      }
    }
    for (const read of reads) {
      const readOffset = this.affineRecursiveKeyOffset(read.node.keys[0], inductionName)!;
      for (const write of writes) {
        if (write.name !== read.node.name) continue;
        const sameEntryRmw = write === read.consumer && readOffset === writeOffsets.get(write);
        if (!sameEntryRmw && !disjoint(readOffset, writeOffsets.get(write)!)) return false;
      }
    }
    // One consumer can share repeated occurrences of the exact same read plan. Distinct consumers become
    // distinct physical streams, so their domains must be disjoint; otherwise the SDK would have to consume the
    // same entry NFT twice. Different offsets inside one consumer likewise need independent disjoint streams.
    for (let left = 0; left < reads.length; left += 1) {
      const leftRead = reads[left];
      const leftOffset = this.affineRecursiveKeyOffset(leftRead.node.keys[0], inductionName)!;
      for (let right = left + 1; right < reads.length; right += 1) {
        const rightRead = reads[right];
        if (leftRead.node.name !== rightRead.node.name) continue;
        const rightOffset = this.affineRecursiveKeyOffset(rightRead.node.keys[0], inductionName)!;
        if (leftRead.consumer === rightRead.consumer && leftOffset === rightOffset) continue;
        if (!disjoint(leftOffset, rightOffset)) return false;
      }
    }
    return true;
  }

  /** Prove the sole changing recursive argument is `counter - positiveInvariant`. Positivity is checked both
   * statically when possible and by the lowered function for runtime recipes; all other arguments must retain
   * their source-frame values, making a parameter-derived step invariant across recursive frames. */
  private descendingAffineStep(
    call: FunctionCallNode, node: FunctionDefinitionNode, inductionIndex: number, inductionName: string,
  ): ExpressionNode | undefined {
    // This pass runs before semantic arity diagnostics. A malformed recursive call must remain unlowered for the
    // ordinary checker rather than indexing beyond the source parameters during speculative affine recognition.
    if (call.parameters.length !== node.parameters.length) return undefined;
    const next = call.parameters[inductionIndex];
    if (!(next instanceof BinaryOpNode) || next.operator !== BinaryOperator.MINUS
      || !(next.left instanceof IdentifierNode) || next.left.name !== inductionName) return undefined;
    if (call.parameters.some((argument, index) => index !== inductionIndex
      && (!(argument instanceof IdentifierNode) || argument.name !== node.parameters[index].name))) return undefined;
    if (!this.affineEventExpression(next.right, node, inductionName, false)) return undefined;
    if (next.right instanceof IntLiteralNode && next.right.value <= 0n) return undefined;
    return next.right;
  }

  /** Recognize frame values which remain reconstructible from the public arguments and the terminating rank.
   * The termination parameter must descend by a positive invariant. Any other changing integral parameter may
   * add or subtract an invariant integral expression. A step cannot depend on a changing parameter: accepting
   * that would turn an apparently affine replay recipe into a recurrence requiring a per-frame trace. */
  private affineParameterProgressions(
    call: FunctionCallNode, node: FunctionDefinitionNode, inductionIndex: number,
  ): AffineParameterProgression[] | undefined {
    if (call.parameters.length !== node.parameters.length) return undefined;
    const progressions: AffineParameterProgression[] = [];
    for (let index = 0; index < call.parameters.length; index += 1) {
      const argument = call.parameters[index];
      const parameter = node.parameters[index];
      if (argument instanceof IdentifierNode && argument.name === parameter.name) continue;
      const integral = parameter.type instanceof IntType || parameter.type === PrimitiveType.INT
        || parameter.type === PrimitiveType.BIGINT;
      if (!integral || !(argument instanceof BinaryOpNode)) return undefined;
      let subtract = false;
      let stepExpression: ExpressionNode | undefined;
      if (argument.left instanceof IdentifierNode && argument.left.name === parameter.name
        && (argument.operator === BinaryOperator.PLUS || argument.operator === BinaryOperator.MINUS)) {
        subtract = argument.operator === BinaryOperator.MINUS;
        stepExpression = argument.right;
      } else if (argument.operator === BinaryOperator.PLUS
        && argument.right instanceof IdentifierNode && argument.right.name === parameter.name) {
        stepExpression = argument.left;
      }
      // Source expressions naturally associate `value + cursor + invariant` to the left. Peel an additive
      // spine containing exactly one positive occurrence of the carried parameter and retain the other terms as
      // its per-frame delta. This is normalization by syntax, not by identifier spelling or contract shape.
      if (!stepExpression && index !== inductionIndex) {
        const terms: Array<{ expression: ExpressionNode; negative: boolean }> = [];
        let parameterTerms = 0;
        const flatten = (candidate: ExpressionNode, negative = false): void => {
          if (candidate instanceof BinaryOpNode
            && (candidate.operator === BinaryOperator.PLUS || candidate.operator === BinaryOperator.MINUS)) {
            flatten(candidate.left, negative);
            flatten(candidate.right, candidate.operator === BinaryOperator.MINUS ? !negative : negative);
          } else if (candidate instanceof IdentifierNode && candidate.name === parameter.name) {
            if (negative) parameterTerms = 2;
            else parameterTerms += 1;
          } else terms.push({ expression: candidate, negative });
        };
        flatten(argument);
        if (parameterTerms === 1 && terms.length > 0) {
          stepExpression = terms.reduce<ExpressionNode | undefined>((sum, term) => {
            const signed = term.negative
              ? this.stamp(new UnaryOpNode(UnaryOperator.NEGATE, term.expression), term.expression.location)
              : term.expression;
            return sum ? this.stamp(new BinaryOpNode(
              sum, BinaryOperator.PLUS, signed,
            ), argument.location) : signed;
          }, undefined);
        }
      }
      if (!stepExpression) return undefined;
      progressions.push({ parameterIndex: index, subtract, stepExpression });
    }
    const changingNames = new Set(progressions.map(({ parameterIndex }) => node.parameters[parameterIndex].name));
    for (const progression of progressions) {
      let changingDependency = false;
      this.walkNodes(progression.stepExpression, (candidate) => {
        if (candidate instanceof IdentifierNode && changingNames.has(candidate.name)
          && candidate.name !== node.parameters[inductionIndex].name) changingDependency = true;
      });
      if (changingDependency) return undefined;
      const counterSlope = this.affineCounterSlope(
        progression.stepExpression, node, node.parameters[inductionIndex].name,
      );
      if (counterSlope === false) return undefined;
      if (counterSlope) {
        // The prefix formula regroups per-frame additions. That is exact for bigint, but not for checked bounded
        // arithmetic: a closed-form intermediate may overflow even when every source-ordered update succeeds.
        // Require both the carried value and its counter to be BCH-native bigint rather than weakening checks.
        if (node.parameters[progression.parameterIndex].type !== PrimitiveType.BIGINT
          || node.parameters[inductionIndex].type !== PrimitiveType.BIGINT) return undefined;
        progression.counterSlope = counterSlope;
      }
    }
    const induction = progressions.find(({ parameterIndex }) => parameterIndex === inductionIndex);
    if (!induction?.subtract
      || (induction.stepExpression instanceof IntLiteralNode && induction.stepExpression.value <= 0n)) {
      return undefined;
    }
    return progressions;
  }

  /**
   * Prove that an additive recursive step is affine in the descending counter and return its coefficient.
   * Counter-free subexpressions stay opaque, but must be replayable integral expressions. A multiplication may
   * have at most one counter-dependent side. Division, modulo, casts, ternaries, and other operators over the
   * counter are intentionally refused because their per-frame integer/width semantics are not affine.
   */
  private affineCounterSlope(
    expression: ExpressionNode, node: FunctionDefinitionNode, inductionName: string,
  ): ExpressionNode | undefined | false {
    const containsInduction = (candidate: Node): boolean => {
      let found = false;
      this.walkNodes(candidate, (part) => {
        if (part instanceof IdentifierNode && part.name === inductionName) found = true;
      });
      return found;
    };
    const counterFree = (candidate: ExpressionNode): boolean =>
      !containsInduction(candidate)
      && this.affineEventExpression(candidate, node, inductionName, false) !== undefined
      && this.isAffineIntegralExpression(candidate, node);
    const combine = (
      left: ExpressionNode | undefined, operator: BinaryOperator, right: ExpressionNode | undefined,
      location: Node['location'],
    ): ExpressionNode | undefined => {
      if (!left) return right && (operator === BinaryOperator.MINUS
        ? this.stamp(new UnaryOpNode(UnaryOperator.NEGATE, right), location) : right);
      if (!right) return left;
      return this.stamp(new BinaryOpNode(left, operator, right), location);
    };
    const slope = (candidate: ExpressionNode): ExpressionNode | undefined | false => {
      if (!containsInduction(candidate)) return counterFree(candidate) ? undefined : false;
      if (candidate instanceof IdentifierNode) {
        return candidate.name === inductionName
          ? this.stamp(new IntLiteralNode(1n), candidate.location) : false;
      }
      if (candidate instanceof UnaryOpNode && candidate.operator === UnaryOperator.NEGATE) {
        const inner = slope(candidate.expression);
        return inner === false || inner === undefined ? false
          : this.stamp(new UnaryOpNode(UnaryOperator.NEGATE, inner), candidate.location);
      }
      if (!(candidate instanceof BinaryOpNode)) return false;
      if (candidate.operator === BinaryOperator.PLUS || candidate.operator === BinaryOperator.MINUS) {
        const left = slope(candidate.left);
        const right = slope(candidate.right);
        if (left === false || right === false) return false;
        return combine(left, candidate.operator, right, candidate.location);
      }
      if (candidate.operator !== BinaryOperator.MUL) return false;
      const leftDepends = containsInduction(candidate.left);
      const rightDepends = containsInduction(candidate.right);
      if (leftDepends === rightDepends) return false;
      const dependent = leftDepends ? candidate.left : candidate.right;
      const invariant = leftDepends ? candidate.right : candidate.left;
      if (!counterFree(invariant)) return false;
      const coefficient = slope(dependent);
      if (coefficient === false || coefficient === undefined) return false;
      return this.stamp(new BinaryOpNode(
        coefficient, BinaryOperator.MUL, cloneNode(invariant),
      ), candidate.location);
    };
    return slope(expression);
  }

  visitSourceFile(node: SourceFileNode): Node {
    this.lowerMutualGroups(node.freeFunctions);
    node.freeFunctions = node.freeFunctions.map((fn) => this.visit(fn) as FunctionDefinitionNode);
    node.contract = this.visit(node.contract) as ContractNode;
    node.importedContracts = node.importedContracts.map((contract) => this.visit(contract) as ContractNode);
    return node;
  }

  visitContract(node: ContractNode): Node {
    const parentStateNames = this.scalarStateNames;
    const parentStructConstructorNames = this.structConstructorNames;
    const parentSortedMappingNames = this.sortedMappingNames;
    this.scalarStateNames = new Set(node.stateVariables.filter((state) =>
      !(state.type instanceof ArrayType))
      .map((state) => state.name));
    this.structConstructorNames = new Set(node.structDefinitions.map((definition) => definition.name));
    this.sortedMappingNames = new Set(node.collections.filter((collection) =>
      collection.sorted && collection.type instanceof MappingType).map((collection) => collection.name));
    const functionsByName = new Map<string, FunctionDefinitionNode[]>();
    for (const fn of node.functions) {
      const overloads = functionsByName.get(fn.name) ?? [];
      overloads.push(fn);
      functionsByName.set(fn.name, overloads);
    }
    // Run before tail/control normalization: literal base selection and recursive source order are still explicit.
    // The specialized block replaces the source call, so later memory lowering and kernel key replay consume the
    // same finite executable statements rather than independently reconstructing recursion metadata.
    this.finiteArraySpecializationBudget = 256;
    for (const fn of node.functions) {
      if (fn.body) this.specializeFiniteArrayCalls(fn.body, functionsByName);
    }
    this.lowerMutualGroups(node.functions);
    node.functions = node.functions.map((fn) => this.visit(fn) as FunctionDefinitionNode);
    if (node.constructorDef) node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    if (node.fallbackDef) node.fallbackDef = this.visit(node.fallbackDef) as FunctionDefinitionNode;
    if (node.receiveDef) node.receiveDef = this.visit(node.receiveDef) as FunctionDefinitionNode;
    this.scalarStateNames = parentStateNames;
    this.structConstructorNames = parentStructConstructorNames;
    this.sortedMappingNames = parentSortedMappingNames;
    return node;
  }

  private finiteLiteral(expression: ExpressionNode): bigint | boolean | undefined {
    if (expression instanceof IntLiteralNode) return expression.value;
    if (expression instanceof BoolLiteralNode) return expression.value;
    if (expression instanceof CastNode) return this.finiteLiteral(expression.expression);
    if (expression instanceof UnaryOpNode) {
      const value = this.finiteLiteral(expression.expression);
      if (expression.operator === UnaryOperator.NOT && typeof value === 'boolean') return !value;
      if (expression.operator === UnaryOperator.NEGATE && typeof value === 'bigint') return -value;
      if (expression.operator === UnaryOperator.INVERT && typeof value === 'bigint') return ~value;
      return undefined;
    }
    if (!(expression instanceof BinaryOpNode)) return undefined;
    const left = this.finiteLiteral(expression.left);
    const right = this.finiteLiteral(expression.right);
    if (left === undefined || right === undefined) return undefined;
    if (typeof left === 'bigint' && typeof right === 'bigint') {
      if (expression.operator === BinaryOperator.PLUS) return left + right;
      if (expression.operator === BinaryOperator.MINUS) return left - right;
      if (expression.operator === BinaryOperator.MUL) return left * right;
      if (expression.operator === BinaryOperator.DIV && right !== 0n) return left / right;
      if (expression.operator === BinaryOperator.MOD && right !== 0n) return left % right;
      if (expression.operator === BinaryOperator.LT) return left < right;
      if (expression.operator === BinaryOperator.LE) return left <= right;
      if (expression.operator === BinaryOperator.GT) return left > right;
      if (expression.operator === BinaryOperator.GE) return left >= right;
      if (expression.operator === BinaryOperator.EQ) return left === right;
      if (expression.operator === BinaryOperator.NE) return left !== right;
    }
    if (typeof left === 'boolean' && typeof right === 'boolean') {
      if (expression.operator === BinaryOperator.AND) return left && right;
      if (expression.operator === BinaryOperator.OR) return left || right;
      if (expression.operator === BinaryOperator.EQ) return left === right;
      if (expression.operator === BinaryOperator.NE) return left !== right;
    }
    return undefined;
  }

  private specializeNode<T extends Node>(
    source: T,
    scalars: ReadonlyMap<string, ExpressionNode>,
    arrays: ReadonlyMap<string, string>,
  ): T {
    const replace = (candidate: Node): Node => {
      if (candidate instanceof IdentifierNode && scalars.has(candidate.name)) {
        const value = cloneNode(scalars.get(candidate.name)!) as ExpressionNode;
        value.location = candidate.location;
        return value;
      }
      const value = cloneNode(candidate) as Node;
      const named = value as unknown as { name?: unknown };
      if (typeof named.name === 'string' && arrays.has(named.name)) named.name = arrays.get(named.name)!;
      for (const key of Object.keys(value)) {
        if (['location', 'definition', 'symbol', 'type', 'resolvedFunction', 'functionReference', 'collection']
          .includes(key)) continue;
        const child = (value as unknown as Record<string, unknown>)[key];
        if (child instanceof Node) (value as unknown as Record<string, unknown>)[key] = replace(child);
        else if (Array.isArray(child)) {
          (value as unknown as Record<string, unknown>)[key] = child.map((item) =>
            item instanceof Node ? replace(item) : item);
        }
      }
      return value;
    };
    return replace(source) as T;
  }

  private finiteArraySpecialization(
    statement: FunctionCallStatementNode,
    functionsByName: ReadonlyMap<string, FunctionDefinitionNode[]>,
  ): BlockNode | undefined {
    const call = statement.call;
    const targets = (functionsByName.get(call.identifier.name) ?? [])
      .filter((candidate) => candidate.parameters.length === call.parameters.length);
    if (targets.length !== 1) return undefined;
    const target = targets[0];
    if (!target.body || target.returnTypes.length !== 0
      || !target.modifiers.includes(FunctionModifier.PURE)
      || !(target.modifiers.includes(FunctionModifier.INTERNAL)
        || target.modifiers.includes(FunctionModifier.PRIVATE))
      || this.countSelfCalls(target.body, target.name) !== 1) return undefined;

    const rootScalars = new Map<string, ExpressionNode>();
    const rootArrays = new Map<string, string>();
    for (let index = 0; index < target.parameters.length; index += 1) {
      const parameter = target.parameters[index];
      const argument = call.parameters[index];
      if (parameter.type instanceof ArrayType) {
        if (!(argument instanceof IdentifierNode) || !parameter.modifier.includes('memory')) return undefined;
        rootArrays.set(parameter.name, argument.name);
      } else {
        // Specialization erases parameter binding and branch/recursive-argument evaluation. Only BCH-native
        // bigint arithmetic is unbounded, so folding a checked int/uint/fixed expression here could otherwise
        // erase a source overflow even when the final recursive path reaches a literal base case.
        if (parameter.type !== PrimitiveType.BIGINT || !(argument instanceof IntLiteralNode)) return undefined;
        if (this.finiteLiteral(argument) === undefined) return undefined;
        rootScalars.set(parameter.name, argument);
      }
    }
    if (rootArrays.size === 0) return undefined;

    let reachedBaseReturn = false;
    const expand = (
      block: BlockNode,
      scalars: ReadonlyMap<string, ExpressionNode>,
      arrays: ReadonlyMap<string, string>,
    ): { statements: StatementNode[]; returned: boolean } | undefined => {
      const expanded: StatementNode[] = [];
      for (const source of block.statements ?? []) {
        if (source instanceof BranchNode) {
          const condition = this.specializeNode(source.condition, scalars, arrays);
          const selected = this.finiteLiteral(condition);
          if (typeof selected !== 'boolean') return undefined;
          const arm = selected ? source.ifBlock : source.elseBlock;
          if (!arm) continue;
          const selectedStatements = expand(arm, scalars, arrays);
          if (!selectedStatements) return undefined;
          expanded.push(...selectedStatements.statements);
          if (selectedStatements.returned) return { statements: expanded, returned: true };
          continue;
        }
        if (source instanceof ReturnNode) {
          if (source.expressions.length !== 0) return undefined;
          reachedBaseReturn = true;
          return { statements: expanded, returned: true };
        }
        if (source instanceof FunctionCallStatementNode
          && source.call.identifier.name === target.name
          && source.call.parameters.length === target.parameters.length) {
          this.finiteArraySpecializationBudget -= 1;
          if (this.finiteArraySpecializationBudget < 0) return undefined;
          const nextScalars = new Map<string, ExpressionNode>();
          const nextArrays = new Map<string, string>();
          let numericMeasure = false;
          let strictlyDecreases = false;
          for (let index = 0; index < target.parameters.length; index += 1) {
            const parameter = target.parameters[index];
            const argument = this.specializeNode(source.call.parameters[index], scalars, arrays);
            if (parameter.type instanceof ArrayType) {
              if (!(argument instanceof IdentifierNode)
                || ![...arrays.values()].includes(argument.name)) return undefined;
              nextArrays.set(parameter.name, argument.name);
              continue;
            }
            const current = scalars.get(parameter.name);
            const currentLiteral = current && this.finiteLiteral(current);
            const nextLiteral = this.finiteLiteral(argument);
            if (currentLiteral === undefined || nextLiteral === undefined
              || typeof currentLiteral !== typeof nextLiteral) return undefined;
            if (typeof currentLiteral === 'bigint' && typeof nextLiteral === 'bigint') {
              numericMeasure = true;
              if (nextLiteral > currentLiteral) return undefined;
              if (nextLiteral < currentLiteral) strictlyDecreases = true;
            } else if (nextLiteral !== currentLiteral) return undefined;
            nextScalars.set(parameter.name, argument);
          }
          if (!numericMeasure || !strictlyDecreases) return undefined;
          const nested = expand(target.body, nextScalars, nextArrays);
          if (!nested) return undefined;
          expanded.push(...nested.statements);
          continue;
        }
        if (source instanceof ArrayAssignNode || source instanceof ArrayDeleteNode
          || source instanceof ArrayPushNode || source instanceof ArrayPopNode) {
          const mutation = this.specializeNode(source, scalars, arrays);
          if (![...arrays.values()].includes(mutation.name)) return undefined;
          expanded.push(mutation);
          continue;
        }
        if (source instanceof BlockNode) {
          const nested = expand(source, scalars, arrays);
          if (!nested) return undefined;
          expanded.push(...nested.statements);
          if (nested.returned) return { statements: expanded, returned: true };
          continue;
        }
        return undefined;
      }
      return { statements: expanded, returned: false };
    };
    const result = expand(target.body, rootScalars, rootArrays);
    if (!result || !reachedBaseReturn) return undefined;
    const block = new BlockNode(result.statements);
    block.location = statement.location;
    block.scoped = true;
    return block;
  }

  private specializeFiniteArrayCalls(
    block: BlockNode,
    functionsByName: ReadonlyMap<string, FunctionDefinitionNode[]>,
  ): void {
    const statements: StatementNode[] = [];
    for (const statement of block.statements ?? []) {
      const specialized = statement instanceof FunctionCallStatementNode
        ? this.finiteArraySpecialization(statement, functionsByName) : undefined;
      if (specialized) {
        // Keep the specialized mutations in their caller's lexical array scope. Introducing a nested scoped
        // block here would make later memory lowering allocate a distinct local-array frame while kernel replay
        // still attributes the writes to the caller array.
        statements.push(...(specialized.statements ?? []));
        continue;
      }
      if (statement instanceof BlockNode) this.specializeFiniteArrayCalls(statement, functionsByName);
      else if (statement instanceof BranchNode) {
        this.specializeFiniteArrayCalls(statement.ifBlock, functionsByName);
        if (statement.elseBlock) this.specializeFiniteArrayCalls(statement.elseBlock, functionsByName);
      } else if (statement instanceof SwitchNode) {
        for (const arm of statement.cases) this.specializeFiniteArrayCalls(arm.body, functionsByName);
        if (statement.defaultCase) this.specializeFiniteArrayCalls(statement.defaultCase, functionsByName);
      } else if (statement instanceof WhileNode || statement instanceof DoWhileNode) {
        this.specializeFiniteArrayCalls(statement.block, functionsByName);
      }
      statements.push(statement);
    }
    block.statements = statements;
  }

  /**
   * Lower a strongly-connected group of homogeneous mutual tail calls to a small program-counter loop. Each
   * public/internal entry keeps its own ABI and starts the shared state machine at its corresponding body. This
   * covers cycles of any length while deliberately excluding overloads, heterogeneous frames, and calls nested in
   * source loops. A single-result binary fold may use the continuation stack implemented below. Scalar state
   * writes are supported where source evaluation captures the continuation before descent; collection work still
   * requires a more general continuation representation.
   */
  private lowerMutualGroups(functions: FunctionDefinitionNode[]): void {
    const overloads = new Map<string, FunctionDefinitionNode[]>();
    for (const fn of functions) overloads.set(fn.name, [...(overloads.get(fn.name) ?? []), fn]);
    const byName = new Map([...overloads].filter(([, group]) => group.length === 1)
      .map(([name, group]) => [name, group[0]]));
    const edges = new Map<FunctionDefinitionNode, Set<FunctionDefinitionNode>>();
    for (const fn of functions) {
      const targets = new Set<FunctionDefinitionNode>();
      if (fn.body) this.walkNodes(fn.body, (candidate) => {
        if (candidate instanceof FunctionCallNode) {
          const target = byName.get(candidate.identifier.name);
          if (target) targets.add(target);
        }
      });
      edges.set(fn, targets);
    }

    let nextIndex = 0;
    const indices = new Map<FunctionDefinitionNode, number>();
    const low = new Map<FunctionDefinitionNode, number>();
    const stack: FunctionDefinitionNode[] = [];
    const active = new Set<FunctionDefinitionNode>();
    const groups: FunctionDefinitionNode[][] = [];
    const connect = (fn: FunctionDefinitionNode): void => {
      indices.set(fn, nextIndex);
      low.set(fn, nextIndex);
      nextIndex += 1;
      stack.push(fn);
      active.add(fn);
      for (const target of edges.get(fn) ?? []) {
        if (!indices.has(target)) {
          connect(target);
          low.set(fn, Math.min(low.get(fn)!, low.get(target)!));
        } else if (active.has(target)) {
          low.set(fn, Math.min(low.get(fn)!, indices.get(target)!));
        }
      }
      if (low.get(fn) !== indices.get(fn)) return;
      const group: FunctionDefinitionNode[] = [];
      while (stack.length > 0) {
        const member = stack.pop()!;
        active.delete(member);
        group.push(member);
        if (member === fn) break;
      }
      if (group.length > 1) groups.push(group);
    };
    for (const fn of functions) if (!indices.has(fn)) connect(fn);

    for (const unordered of groups) {
      const group = functions.filter((fn) => unordered.includes(fn));
      const names = new Set(group.map((fn) => fn.name));
      // A recursive call in the conditional RHS is still tail-positioned, but only on the path which reaches it.
      // Spell that source short circuit as ordinary control flow before fold recognition so the row loop never
      // turns a skipped recursive operand into an unconditional iteration. The recursive-LHS form needs a deferred
      // continuation environment and deliberately remains outside this normalization.
      for (const fn of group) this.normalizeRightShortCircuitReturns(fn.body!, names);
      const first = group[0];
      const sameFrame = group.every((fn) => fn.body
        && fn.customModifiers.length === 0
        && fn.parameters.length === first.parameters.length
        && fn.parameters.every((parameter, index) =>
          parameter.type.toString() === first.parameters[index].type.toString()
          && parameter.modifier.join('\0') === first.parameters[index].modifier.join('\0'))
        && fn.returnTypes.length === first.returnTypes.length
        && fn.returnTypes.every((type, index) => type.toString() === first.returnTypes[index].toString())
        && fn.returnModifiers.every((modifier, index) =>
          modifier.join('\0') === (first.returnModifiers[index] ?? []).join('\0'))
        && (fn.returnNames.length === 0 || fn.returnNames.length === fn.returnTypes.length));
      const fold = sameFrame ? this.recursiveFoldShape(group, names) : undefined;
      if (!sameFrame || group.some((fn) => !fn.body
        || !this.groupCallsHaveArity(fn.body, names, first.parameters.length)
        || !this.groupBaseReturnsHaveArity(
          fn.body, names, first.returnTypes.length, fn.returnNames.length === fn.returnTypes.length,
        )
        || this.groupCallInSourceLoop(fn.body, names)
        || this.returnInSourceLoop(fn.body)
        || !this.validGroupTailBlock(
          fn.body, names, fn.returnNames, fn.returnTypes.length > 0, fold,
        ))) continue;

      // Snapshot every source body before rewriting any member: each ABI entry receives the same complete
      // dispatcher, merely with a different initial program counter.
      const sourceBodies = new Map(group.map((fn) => [fn, cloneNode(fn.body!) as BlockNode]));
      for (let rootIndex = 0; rootIndex < group.length; rootIndex += 1) {
        this.lowerMutualEntry(group[rootIndex], rootIndex, group, sourceBodies, fold);
      }
    }
  }

  private lowerMutualEntry(
    root: FunctionDefinitionNode,
    rootIndex: number,
    group: readonly FunctionDefinitionNode[],
    sourceBodies: ReadonlyMap<FunctionDefinitionNode, BlockNode>,
    fold?: RecursiveFoldShape,
  ): void {
    const frame = this.counter++;
    const modeName = `__tail_mode_${frame}`;
    const repeatName = `__tail_repeat_${frame}`;
    const unnamedResults = root.returnTypes.length > 0 && root.returnNames.length === 0;
    const resultNames = unnamedResults
      ? root.returnTypes.map((_type, index) => `__tail_result_${frame}_${index}`)
      : root.returnNames;
    const continuationName = fold ? `__tail_continuations_${frame}` : undefined;
    const continuationTagName = fold ? `__tail_continuation_tags_${frame}` : undefined;
    const byName = new Map(group.map((fn, index) => [fn.name, { fn, index }]));
    const arms = group.map((member) => {
      const renamed = cloneNode(sourceBodies.get(member)!) as BlockNode;
      const names = new Map<string, string>();
      member.parameters.forEach((parameter, index) => names.set(parameter.name, root.parameters[index].name));
      member.returnNames.forEach((name, index) => names.set(name, resultNames[index]));
      this.renameIdentifiers(renamed, names);
      return this.transformMutualBlock(
        renamed, root, byName, resultNames, modeName, repeatName, fold,
        continuationName, continuationTagName,
      );
    });
    let dispatch: BranchNode | undefined;
    for (let index = arms.length - 1; index >= 0; index -= 1) {
      const condition = this.stamp(new BinaryOpNode(
        this.stamp(new IdentifierNode(modeName), root.location), BinaryOperator.EQ,
        this.stamp(new IntLiteralNode(BigInt(index)), root.location),
      ), root.location);
      dispatch = this.stamp(new BranchNode(
        condition, arms[index], dispatch ? this.stamp(new BlockNode([dispatch]), root.location) : undefined,
      ), root.location);
    }
    const clearRepeat = this.stamp(new AssignNode(
      this.stamp(new IdentifierNode(repeatName), root.location),
      this.stamp(new BoolLiteralNode(false), root.location),
    ), root.location);
    const loopBody = this.stamp(new BlockNode([clearRepeat, dispatch!]), root.location);
    const loop = this.stamp(new WhileNode(
      this.stamp(new IdentifierNode(repeatName), root.location), loopBody,
    ), root.location);
    const mode = this.stamp(new VariableDefinitionNode(
      PrimitiveType.BIGINT, [], modeName, this.stamp(new IntLiteralNode(BigInt(rootIndex)), root.location),
    ), root.location);
    const repeat = this.stamp(new VariableDefinitionNode(
      PrimitiveType.BOOL, [], repeatName, this.stamp(new BoolLiteralNode(true), root.location),
    ), root.location);
    const results = unnamedResults ? resultNames.map((name, index) => this.stamp(
      new VariableDefinitionNode(root.returnTypes[index], [], name), root.location,
    )) : [];
    const continuation = fold ? this.stamp(new VariableDefinitionNode(
      new ArrayType(root.returnTypes[0]), [], continuationName!, this.stamp(new NewArrayNode(
        root.returnTypes[0], this.stamp(new IntLiteralNode(0n), root.location),
      ), root.location),
    ), root.location) : undefined;
    const continuationTags = fold ? this.stamp(new VariableDefinitionNode(
      new ArrayType(PrimitiveType.BIGINT), [], continuationTagName!, this.stamp(new NewArrayNode(
        PrimitiveType.BIGINT, this.stamp(new IntLiteralNode(0n), root.location),
      ), root.location),
    ), root.location) : undefined;
    const unwind = fold ? this.foldUnwind(
      root, resultNames[0], continuationName!, continuationTagName!, fold,
    ) : undefined;
    const finalReturn = unnamedResults ? this.stamp(new ReturnNode(resultNames.map((name) =>
      this.stamp(new IdentifierNode(name), root.location))), root.location) : undefined;
    root.body = this.stamp(new BlockNode([
      ...results, ...(continuation ? [continuation, continuationTags!] : []), mode, repeat, loop,
      ...(unwind ? [unwind] : []), ...(finalReturn ? [finalReturn] : []),
    ]), root.location);
  }

  /**
   * Recognize a linear recursion fold. Each recursive result may be nested within an effect-free binary spine.
   * Its sibling operands are captured from outside to inside before advancing the state machine, then applied in
   * reverse order after the base case, exactly reproducing the source call stack without placing journal values
   * in recursive OP_INVOKE frames.
   */
  private recursiveFoldShape(
    group: readonly FunctionDefinitionNode[], names: ReadonlySet<string>,
  ): RecursiveFoldShape | undefined {
    if (group[0].returnTypes.length !== 1) return undefined;
    let sawFold = false;
    const scalarStateWrites = new Set<string>();
    let writesMapping = false;
    const continuationSteps: RecursiveFoldStep[] = [];
    let valid = true;
    const invariantParameters = new Map(group.map((fn) => {
      const invariant = new Set(fn.parameters.map((parameter) => parameter.name));
      this.walkNodes(fn.body!, (candidate) => {
        if (!(candidate instanceof FunctionCallNode) || !names.has(candidate.identifier.name)) return;
        fn.parameters.forEach((parameter, index) => {
          const argument = candidate.parameters[index];
          if (!(argument instanceof IdentifierNode) || argument.name !== parameter.name) {
            invariant.delete(parameter.name);
          }
        });
      });
      return [fn, invariant] as const;
    }));
    const stableMappingKey = (expression: ExpressionNode, stableNames: ReadonlySet<string>): boolean => {
      let stable = true;
      this.walkNodes(expression, (candidate) => {
        if (candidate instanceof IdentifierNode && !stableNames.has(candidate.name)) stable = false;
        if (candidate instanceof StateAccessNode || candidate instanceof ArrayAccessNode
          || candidate instanceof FunctionCallNode) stable = false;
      });
      return stable;
    };
    const persistentEffects = new Set([
      'StateArrayPushNode', 'StateArrayPopNode', 'StateArrayAssignNode', 'StateArrayDeleteNode',
      'EmitStatementNode', 'ExternalFunctionCallNode', 'LowLevelCallNode',
      'LowLevelCallStatementNode', 'TransferStatementNode', 'AddressTransferStatementNode',
      'AddressSendExpressionNode', 'TokenContainerMethodStatementNode', 'SelfdestructStatementNode',
      'MethodCallNode', 'MethodCallStatementNode', 'IndirectCallNode', 'InstantiationNode',
      'AssignmentExpressionNode', 'AssemblyStatementNode',
    ]);
    group.forEach((fn) => {
      this.walkNodes(fn.body!, (candidate) => {
        if (candidate instanceof StateAssignNode || candidate instanceof DeleteStateNode) {
          if (!this.scalarStateNames.has(candidate.name)) valid = false;
          else scalarStateWrites.add(candidate.name);
        } else if (candidate instanceof MappingAssignNode || candidate instanceof MappingDeleteNode
          || candidate instanceof MappingFieldAssignNode) {
          writesMapping = true;
          if (!candidate.keys.every((key) => stableMappingKey(key, invariantParameters.get(fn)!))) valid = false;
        } else if (persistentEffects.has(candidate.constructor.name)) valid = false;
        if (candidate instanceof FunctionCallNode && !names.has(candidate.identifier.name)
          && !this.structConstructorNames.has(candidate.identifier.name)) valid = false;
        if (!(candidate instanceof ReturnNode) || candidate.expressions.length !== 1) return;
        const expression = candidate.expressions[0];
        const callCount = this.countGroupCalls(expression, names);
        if (callCount === 0 || this.isGroupCall(expression, names)) return;
        if (callCount !== 1) {
          valid = false;
          return;
        }
        const extracted = this.extractRecursiveFold(expression, names);
        if (!extracted || extracted.steps.length === 0) {
          valid = false;
          return;
        }
        continuationSteps.push(...extracted.steps);
        sawFold = true;
      });
    });
    // `recur(...) OP operand` reaches operand after the deeper call in source. Capturing it before descent remains
    // equivalent unless deeper frames can mutate scalar state read by that operand.
    const deferredOperands = new Map<string, ExpressionNode>();
    if (scalarStateWrites.size > 0) {
      continuationSteps.filter((step): step is Extract<RecursiveFoldStep, { kind: 'binary' }> =>
        step.kind === 'binary' && step.recursiveOnLeft).forEach((step) => {
        let overlaps = false;
        this.walkNodes(step.operand, (candidate) => {
          if ((candidate instanceof StateAccessNode || candidate instanceof IdentifierNode)
            && scalarStateWrites.has(candidate.name)) overlaps = true;
        });
        if (!overlaps) return;
        const key = this.deferredStateExpressionKey(step.operand);
        if (key === undefined) valid = false;
        else if (!deferredOperands.has(key)) {
          deferredOperands.set(key, cloneNode(step.operand) as ExpressionNode);
        }
      });
    }
    // A recursive-first continuation is evaluated after deeper frames in source. Mapping writes can change an
    // authenticated entry during those frames, so do not capture any such operand before descent until mapping
    // dependency analysis can prove the operand disjoint.
    if (writesMapping && continuationSteps.some((step) => step.kind === 'binary' && step.recursiveOnLeft)) {
      valid = false;
    }
    const variants: RecursiveFoldShape['variants'] = [];
    for (const step of continuationSteps) {
      const key = step.kind === 'binary' && step.recursiveOnLeft
        ? this.deferredStateExpressionKey(step.operand) : undefined;
      const deferredOperandKey = key !== undefined && deferredOperands.has(key) ? key : undefined;
      if (variants.some((variant) => variant.kind === step.kind && variant.operator === step.operator
        && (variant.kind === 'unary' || (step.kind === 'binary'
          && variant.recursiveOnLeft === step.recursiveOnLeft
          && variant.deferredOperandKey === deferredOperandKey)))) continue;
      variants.push(step.kind === 'binary'
        ? {
          kind: 'binary', operator: step.operator, recursiveOnLeft: step.recursiveOnLeft,
          ...(deferredOperandKey !== undefined && {
            deferredOperandKey,
            deferredOperand: deferredOperands.get(deferredOperandKey),
          }),
        }
        : { kind: 'unary', operator: step.operator });
    }
    return valid && sawFold ? {
      variants, deferredOperandKeys: new Set(deferredOperands.keys()),
    } : undefined;
  }

  /**
   * Canonicalize the deliberately small expression class that can be evaluated after recursive descent without
   * retaining a source frame. Every leaf is persistent scalar/struct state or a literal; the admitted composites
   * are pure. Parameters, locals, collection reads, calls, and transaction-context expressions fail closed.
   */
  private deferredStateExpressionKey(expression: ExpressionNode): string | undefined {
    let sawState = false;
    const keyOf = (candidate: ExpressionNode): unknown[] | undefined => {
      if (candidate instanceof StateAccessNode) {
        if (!this.scalarStateNames.has(candidate.name)) return undefined;
        sawState = true;
        return ['state', candidate.name];
      }
      if (candidate instanceof LiteralNode) {
        const value = candidate.value instanceof Uint8Array
          ? [...candidate.value].map((byte) => byte.toString(16).padStart(2, '0')).join('')
          : String(candidate.value);
        return ['literal', candidate.constructor.name, value];
      }
      if (candidate instanceof FieldAccessNode) {
        const nested = keyOf(candidate.expression);
        return nested === undefined ? undefined : ['field', candidate.name, nested];
      }
      if (candidate instanceof CastNode) {
        const nested = keyOf(candidate.expression);
        return nested === undefined
          ? undefined : ['cast', candidate.type.toString(), candidate.isUnsafe, nested];
      }
      if (candidate instanceof UnaryOpNode) {
        if (![UnaryOperator.NOT, UnaryOperator.NEGATE, UnaryOperator.INVERT,
          UnaryOperator.SIZE, UnaryOperator.REVERSE].includes(candidate.operator)) return undefined;
        const nested = keyOf(candidate.expression);
        return nested === undefined ? undefined : ['unary', candidate.operator, nested];
      }
      if (candidate instanceof BinaryOpNode) {
        const left = keyOf(candidate.left);
        const right = keyOf(candidate.right);
        return left === undefined || right === undefined
          ? undefined : ['binary', candidate.operator, left, right];
      }
      if (candidate instanceof TernaryOpNode) {
        const condition = keyOf(candidate.condition);
        const ifTrue = keyOf(candidate.ifTrue);
        const ifFalse = keyOf(candidate.ifFalse);
        return condition === undefined || ifTrue === undefined || ifFalse === undefined
          ? undefined : ['ternary', condition, ifTrue, ifFalse];
      }
      return undefined;
    };
    const key = keyOf(expression);
    return key !== undefined && sawState ? JSON.stringify(key) : undefined;
  }

  private foldedRecursiveReturn(
    expression: Node | undefined, names: ReadonlySet<string>, fold?: RecursiveFoldShape,
  ): { call: FunctionCallNode; steps: (RecursiveFoldStep & { variantIndex: number })[] } | undefined {
    if (!fold || !expression) return undefined;
    const extracted = this.extractRecursiveFold(expression, names);
    if (!extracted || extracted.steps.length === 0) return undefined;
    const steps = extracted.steps.map((step) => {
      const key = step.kind === 'binary' && step.recursiveOnLeft
        ? this.deferredStateExpressionKey(step.operand) : undefined;
      const deferredOperandKey = key !== undefined && fold.deferredOperandKeys.has(key) ? key : undefined;
      return {
        ...step,
        ...(deferredOperandKey !== undefined && { deferredOperandKey }),
        variantIndex: fold.variants.findIndex((variant) => variant.kind === step.kind
          && variant.operator === step.operator && (variant.kind === 'unary'
            || (step.kind === 'binary' && variant.recursiveOnLeft === step.recursiveOnLeft
              && variant.deferredOperandKey === deferredOperandKey))),
      };
    });
    if (steps.some((step) => step.variantIndex < 0)) return undefined;
    return { call: extracted.call, steps };
  }

  private extractRecursiveFold(
    expression: ExpressionNode, names: ReadonlySet<string>,
  ): { call: FunctionCallNode; steps: RecursiveFoldStep[] } | undefined {
    if (this.isGroupCall(expression, names)) return { call: expression, steps: [] };
    if (expression instanceof UnaryOpNode && [
      UnaryOperator.NOT, UnaryOperator.NEGATE, UnaryOperator.INVERT,
    ].includes(expression.operator)) {
      const nested = this.extractRecursiveFold(expression.expression, names);
      if (!nested) return undefined;
      return {
        call: nested.call,
        steps: [{ kind: 'unary', operator: expression.operator }, ...nested.steps],
      };
    }
    if (!(expression instanceof BinaryOpNode)
      || expression.operator === BinaryOperator.AND || expression.operator === BinaryOperator.OR) return undefined;
    const leftCalls = this.countGroupCalls(expression.left, names);
    const rightCalls = this.countGroupCalls(expression.right, names);
    if ((leftCalls === 1) === (rightCalls === 1) || leftCalls + rightCalls !== 1) return undefined;
    const recursiveOnLeft = leftCalls === 1;
    const nested = this.extractRecursiveFold(
      recursiveOnLeft ? expression.left : expression.right, names,
    );
    if (!nested) return undefined;
    return {
      call: nested.call,
      steps: [{
        kind: 'binary',
        operator: expression.operator,
        recursiveOnLeft,
        operand: recursiveOnLeft ? expression.right : expression.left,
      }, ...nested.steps],
    };
  }

  private foldUnwind(
    root: FunctionDefinitionNode, resultName: string, continuationName: string,
    continuationTagName: string, fold: RecursiveFoldShape,
  ): WhileNode {
    const length = (): UnaryOpNode => this.stamp(new UnaryOpNode(
      UnaryOperator.SIZE, this.stamp(new IdentifierNode(continuationName), root.location),
    ), root.location);
    const index = this.stamp(new BinaryOpNode(
      length(), BinaryOperator.MINUS, this.stamp(new IntLiteralNode(1n), root.location),
    ), root.location);
    const operand = this.stamp(new ArrayAccessNode(
      this.stamp(new IdentifierNode(continuationName), root.location), index,
    ), root.location);
    const result = (): IdentifierNode => this.stamp(new IdentifierNode(resultName), root.location);
    const tag = this.stamp(new ArrayAccessNode(
      this.stamp(new IdentifierNode(continuationTagName), root.location), cloneNode(index) as ExpressionNode,
    ), root.location);
    let dispatch: BranchNode | undefined;
    for (let variantIndex = fold.variants.length - 1; variantIndex >= 0; variantIndex -= 1) {
      const variant = fold.variants[variantIndex];
      const selectedOperand = variant.kind === 'binary' && variant.deferredOperand !== undefined
        ? cloneNode(variant.deferredOperand) as ExpressionNode
        : cloneNode(operand) as ExpressionNode;
      const combined = variant.kind === 'unary'
        ? this.stamp(new UnaryOpNode(variant.operator, result()), root.location)
        : this.stamp(new BinaryOpNode(
          variant.recursiveOnLeft ? result() : selectedOperand,
          variant.operator,
          variant.recursiveOnLeft ? selectedOperand : result(),
        ), root.location);
      const assign = this.stamp(new AssignNode(result(), combined), root.location);
      dispatch = this.stamp(new BranchNode(
        this.stamp(new BinaryOpNode(
          cloneNode(tag) as ExpressionNode, BinaryOperator.EQ,
          this.stamp(new IntLiteralNode(BigInt(variantIndex)), root.location),
        ), root.location),
        this.stamp(new BlockNode([assign]), root.location),
        dispatch ? this.stamp(new BlockNode([dispatch]), root.location) : undefined,
      ), root.location);
    }
    const pop = this.stamp(new ArrayPopNode(continuationName), root.location);
    const popTag = this.stamp(new ArrayPopNode(continuationTagName), root.location);
    return this.stamp(new WhileNode(
      this.stamp(new BinaryOpNode(
        length(), BinaryOperator.GT, this.stamp(new IntLiteralNode(0n), root.location),
      ), root.location),
      this.stamp(new BlockNode([dispatch!, pop, popTag]), root.location),
    ), root.location);
  }

  private walkNodes(node: Node, visit: (candidate: Node) => void): void {
    visit(node);
    for (const [key, child] of Object.entries(node)) {
      if (['resolvedFunction', 'definition', 'symbolTable', 'location'].includes(key)) continue;
      if (child instanceof Node) this.walkNodes(child, visit);
      else if (Array.isArray(child)) {
        for (const item of child) if (item instanceof Node) this.walkNodes(item, visit);
      }
    }
  }

  private renameIdentifiers(node: Node, names: ReadonlyMap<string, string>): void {
    if (node instanceof IdentifierNode && names.has(node.name)) node.name = names.get(node.name)!;
    for (const [key, child] of Object.entries(node)) {
      if (['resolvedFunction', 'definition', 'symbolTable', 'location'].includes(key)
        || (node instanceof FunctionCallNode && key === 'identifier')) continue;
      if (child instanceof Node) this.renameIdentifiers(child, names);
      else if (Array.isArray(child)) {
        for (const item of child) if (item instanceof Node) this.renameIdentifiers(item, names);
      }
    }
  }

  private isGroupCall(node: Node | undefined, names: ReadonlySet<string>): node is FunctionCallNode {
    return node instanceof FunctionCallNode && names.has(node.identifier.name);
  }

  private countGroupCalls(node: Node, names: ReadonlySet<string>): number {
    let count = this.isGroupCall(node, names) ? 1 : 0;
    for (const [key, child] of Object.entries(node)) {
      if (['resolvedFunction', 'definition', 'symbolTable', 'location'].includes(key)) continue;
      if (child instanceof Node) count += this.countGroupCalls(child, names);
      else if (Array.isArray(child)) {
        for (const item of child) if (item instanceof Node) count += this.countGroupCalls(item, names);
      }
    }
    return count;
  }

  /**
   * Normalize `return guard && recur(...)` / `return guard || recur(...)` to branches. The right side may itself
   * contain another right-recursive short-circuit spine, so normalize the selected return recursively. This is
   * source-equivalent for arbitrary guards: the guard is evaluated exactly once and the recursive expression is
   * reached only on the same path as Solidity's short-circuit evaluation.
   */
  private normalizeRightShortCircuitReturns(block: BlockNode, names: ReadonlySet<string>): void {
    block.statements = (block.statements ?? []).map((statement) => {
      if (statement instanceof ReturnNode && statement.expressions.length === 1) {
        return this.normalizeRightShortCircuitReturn(statement, names);
      }
      if (statement instanceof BranchNode) {
        this.normalizeRightShortCircuitReturns(statement.ifBlock, names);
        if (statement.elseBlock) this.normalizeRightShortCircuitReturns(statement.elseBlock, names);
      } else if (statement instanceof BlockNode) {
        this.normalizeRightShortCircuitReturns(statement, names);
      }
      return statement;
    });
  }

  private normalizeRightShortCircuitReturn(
    statement: ReturnNode, names: ReadonlySet<string>,
  ): StatementNode {
    const expression = statement.expressions[0];
    if (!(expression instanceof BinaryOpNode)
      || (expression.operator !== BinaryOperator.AND && expression.operator !== BinaryOperator.OR)
      || this.countGroupCalls(expression.left, names) !== 0
      || this.countGroupCalls(expression.right, names) !== 1) return statement;

    const rightReturn = this.stamp(new ReturnNode([expression.right]), statement.location);
    const normalizedRight = this.normalizeRightShortCircuitReturn(rightReturn, names);
    const constant = this.stamp(new BoolLiteralNode(expression.operator === BinaryOperator.OR), statement.location);
    const constantReturn = this.stamp(new ReturnNode([constant]), statement.location);
    const ifStatement = expression.operator === BinaryOperator.AND ? normalizedRight : constantReturn;
    const elseStatement = expression.operator === BinaryOperator.AND ? constantReturn : normalizedRight;
    return this.stamp(new BranchNode(
      expression.left,
      this.stamp(new BlockNode([ifStatement]), statement.location),
      this.stamp(new BlockNode([elseStatement]), statement.location),
    ), statement.location);
  }

  private groupCallsHaveArity(node: Node, names: ReadonlySet<string>, arity: number): boolean {
    if (this.isGroupCall(node, names) && node.parameters.length !== arity) return false;
    return Object.entries(node).every(([key, child]) => {
      if (['resolvedFunction', 'definition', 'symbolTable', 'location'].includes(key)) return true;
      if (child instanceof Node) return this.groupCallsHaveArity(child, names, arity);
      return !Array.isArray(child) || child.every((item) => !(item instanceof Node)
        || this.groupCallsHaveArity(item, names, arity));
    });
  }

  private groupBaseReturnsHaveArity(
    node: Node, names: ReadonlySet<string>, arity: number, allowBareResultReturn: boolean,
  ): boolean {
    if (node instanceof ReturnNode
      && !(node.expressions.length === 1 && this.isGroupCall(node.expressions[0], names))) {
      return node.expressions.length === arity
        || (arity > 0 && allowBareResultReturn && node.expressions.length === 0);
    }
    return Object.entries(node).every(([key, child]) => {
      if (['resolvedFunction', 'definition', 'symbolTable', 'location'].includes(key)) return true;
      if (child instanceof Node) {
        return this.groupBaseReturnsHaveArity(child, names, arity, allowBareResultReturn);
      }
      return !Array.isArray(child) || child.every((item) => !(item instanceof Node)
        || this.groupBaseReturnsHaveArity(item, names, arity, allowBareResultReturn));
    });
  }

  private groupCallInSourceLoop(
    node: Node, names: ReadonlySet<string>, insideLoop = false,
  ): boolean {
    if (insideLoop && this.isGroupCall(node, names)) return true;
    const childInsideLoop = insideLoop || node instanceof WhileNode || node instanceof DoWhileNode;
    return Object.entries(node).some(([key, child]) => {
      if (['resolvedFunction', 'definition', 'symbolTable', 'location'].includes(key)) return false;
      if (child instanceof Node) return this.groupCallInSourceLoop(child, names, childInsideLoop);
      return Array.isArray(child) && child.some((item) => item instanceof Node
        && this.groupCallInSourceLoop(item, names, childInsideLoop));
    });
  }

  private returnInSourceLoop(node: Node, insideLoop = false): boolean {
    if (insideLoop && node instanceof ReturnNode) return true;
    const childInsideLoop = insideLoop || node instanceof WhileNode || node instanceof DoWhileNode;
    return Object.entries(node).some(([key, child]) => {
      if (['resolvedFunction', 'definition', 'symbolTable', 'location'].includes(key)) return false;
      if (child instanceof Node) return this.returnInSourceLoop(child, childInsideLoop);
      return Array.isArray(child) && child.some((item) => item instanceof Node
        && this.returnInSourceLoop(item, childInsideLoop));
    });
  }

  private validGroupTailBlock(
    block: BlockNode, names: ReadonlySet<string>, returnNames: readonly string[], hasResults: boolean,
    fold?: RecursiveFoldShape,
  ): boolean {
    const statements = block.statements ?? [];
    for (let index = 0; index < statements.length; index += 1) {
      const statement = statements[index];
      const calls = this.countGroupCalls(statement, names);
      if (calls === 0) continue;
      if (index !== statements.length - 1
        || !this.validGroupTailStatement(statement, names, returnNames, hasResults, fold)) return false;
    }
    return true;
  }

  private validGroupTailStatement(
    statement: StatementNode, names: ReadonlySet<string>, returnNames: readonly string[], hasResults: boolean,
    fold?: RecursiveFoldShape,
  ): boolean {
    if (statement instanceof AssignNode) {
      return returnNames.length === 1 && statement.identifier.name === returnNames[0]
        && this.isGroupCall(statement.expression, names);
    }
    if (statement instanceof ReturnNode) {
      return hasResults && statement.expressions.length === 1
        && (this.isGroupCall(statement.expressions[0], names)
          || this.foldedRecursiveReturn(statement.expressions[0], names, fold) !== undefined);
    }
    if (statement instanceof FunctionCallStatementNode) {
      return !hasResults && this.isGroupCall(statement.call, names);
    }
    if (statement instanceof BranchNode) {
      if (this.countGroupCalls(statement.condition, names) > 0) return false;
      return this.validGroupTailBlock(statement.ifBlock, names, returnNames, hasResults, fold)
        && (!statement.elseBlock
          || this.validGroupTailBlock(statement.elseBlock, names, returnNames, hasResults, fold));
    }
    if (statement instanceof BlockNode) {
      return this.validGroupTailBlock(statement, names, returnNames, hasResults, fold);
    }
    return false;
  }

  private transformMutualBlock(
    block: BlockNode,
    root: FunctionDefinitionNode,
    members: ReadonlyMap<string, { fn: FunctionDefinitionNode; index: number }>,
    resultNames: readonly string[],
    modeName: string,
    repeatName: string,
    fold?: RecursiveFoldShape,
    continuationName?: string,
    continuationTagName?: string,
  ): BlockNode {
    block.statements = (block.statements ?? []).flatMap((statement) => {
      if (statement instanceof AssignNode && resultNames.length === 1
        && statement.identifier.name === resultNames[0]
        && statement.expression instanceof FunctionCallNode
        && members.has(statement.expression.identifier.name)) {
        return this.mutualRecur(statement.expression, root, members, modeName, repeatName, statement.location);
      }
      if (statement instanceof ReturnNode) {
        const folded = this.foldedRecursiveReturn(statement.expressions[0], new Set(members.keys()), fold);
        if (folded && continuationName && continuationTagName) {
          const pushes = folded.steps.flatMap((step) => [
            this.stamp(new ArrayPushNode(
              continuationName, step.kind === 'binary' && step.deferredOperandKey === undefined ? step.operand
                : this.stamp(new IdentifierNode(resultNames[0]), statement.location),
            ), statement.location),
            this.stamp(new ArrayPushNode(
              continuationTagName, this.stamp(new IntLiteralNode(BigInt(step.variantIndex)), statement.location),
            ), statement.location),
          ]);
          return [...pushes, ...this.mutualRecur(
            folded.call, root, members, modeName, repeatName, statement.location,
          )];
        }
        if (statement.expressions.length === 1 && statement.expressions[0] instanceof FunctionCallNode
          && members.has(statement.expressions[0].identifier.name)) {
          return this.mutualRecur(
            statement.expressions[0], root, members, modeName, repeatName, statement.location,
          );
        }
        const exit = this.stamp(new BreakNode(), statement.location);
        if (resultNames.length === 0 || statement.expressions.length === 0) return [exit];
        return [
          ...resultNames.map((name, index) => this.stamp(new AssignNode(
            this.stamp(new IdentifierNode(name), statement.location), statement.expressions[index],
          ), statement.location)),
          exit,
        ];
      }
      if (resultNames.length === 0 && statement instanceof FunctionCallStatementNode
        && members.has(statement.call.identifier.name)) {
        return this.mutualRecur(statement.call, root, members, modeName, repeatName, statement.location);
      }
      if (statement instanceof BranchNode) {
        statement.ifBlock = this.transformMutualBlock(
          statement.ifBlock, root, members, resultNames, modeName, repeatName, fold,
          continuationName, continuationTagName,
        );
        if (statement.elseBlock) statement.elseBlock = this.transformMutualBlock(
          statement.elseBlock, root, members, resultNames, modeName, repeatName, fold,
          continuationName, continuationTagName,
        );
      } else if (statement instanceof BlockNode) {
        return [this.transformMutualBlock(
          statement, root, members, resultNames, modeName, repeatName, fold,
          continuationName, continuationTagName,
        )];
      }
      return [statement];
    });
    return block;
  }

  private mutualRecur(
    call: FunctionCallNode,
    root: FunctionDefinitionNode,
    members: ReadonlyMap<string, { fn: FunctionDefinitionNode; index: number }>,
    modeName: string,
    repeatName: string,
    location: Node['location'],
  ): StatementNode[] {
    const target = members.get(call.identifier.name)!;
    const frame = this.counter++;
    const changed = root.parameters.flatMap((parameter, index) => {
      const argument = call.parameters[index];
      if (argument instanceof IdentifierNode && argument.name === parameter.name) return [];
      const temp = this.stamp(new VariableDefinitionNode(
        parameter.type, [], `__tail_${frame}_${parameter.name}`, argument,
      ), location);
      const assignment = this.stamp(new AssignNode(
        this.stamp(new IdentifierNode(parameter.name), location),
        this.stamp(new IdentifierNode(temp.name), location),
      ), location);
      return [{ temp, assignment }];
    });
    const select = this.stamp(new AssignNode(
      this.stamp(new IdentifierNode(modeName), location),
      this.stamp(new IntLiteralNode(BigInt(target.index)), location),
    ), location);
    const repeat = this.stamp(new AssignNode(
      this.stamp(new IdentifierNode(repeatName), location), this.stamp(new BoolLiteralNode(true), location),
    ), location);
    return [...changed.map(({ temp }) => temp), ...changed.map(({ assignment }) => assignment), select, repeat];
  }

  /**
   * Recognize the smallest recursion domain which can reuse the authenticated counter-loop journal unchanged:
   * one or more sorted-mapping sets/deletes under replayable pre-recursion branches, then
   * `if (counter == 0) return base`, then the sole recursive edge with `counter - 1`. Pure local definitions may
   * precede or separate those operations. Other parameters must be forwarded unchanged. The source reaches
   * exactly counter+1 distinct frames, so the ordinary counter-loop lowering can publish an authenticated compact
   * occurrence stream for each branch predicate. Collections remain unique: two conditionally overlapping streams
   * over one mapping require read-your-writes/collision planning which this rank proof intentionally does not infer.
   */
  private affineMappingRecursion(node: FunctionDefinitionNode): AffineMappingRecursion | undefined {
    if (!node.body || node.returnTypes.length !== 1 || node.customModifiers.length > 0) return undefined;
    const statements = node.body.statements ?? [];
    if (statements.length < 3) return undefined;
    const recursiveReturn = statements.at(-1)!;
    const prefix = statements.slice(0, -1);
    const baseShape = (statement: StatementNode): statement is BranchNode => statement instanceof BranchNode
      && statement.elseBlock === undefined
      && (statement.ifBlock.statements ?? []).length === 1
      && statement.ifBlock.statements![0] instanceof ReturnNode
      && (statement.ifBlock.statements![0] as ReturnNode).expressions.length === 1;
    const mappingWrites: Array<MappingAssignNode | MappingDeleteNode> = [];
    const collectEffectTree = (statement: StatementNode): boolean => {
      if (statement instanceof MappingAssignNode || statement instanceof MappingDeleteNode) {
        mappingWrites.push(statement);
        return true;
      }
      if (statement instanceof EmitStatementNode) {
        return statement.args.every((argument) =>
          this.affineEventExpression(argument, node, '', true) !== undefined);
      }
      if (statement instanceof BlockNode) {
        return (statement.statements ?? []).every(collectEffectTree);
      }
      if (statement instanceof BranchNode) {
        // This serializer is also the SDK evaluator's accepted expression language. Proving it here prevents a
        // lowered route from depending on state, loop-carried locals, or an opaque helper merely because the later
        // counter-loop pass happened to find a mapping write below the branch.
        if (!this.affineEventExpression(statement.condition, node, '', true)) return false;
        return collectEffectTree(statement.ifBlock)
          && (!statement.elseBlock || collectEffectTree(statement.elseBlock));
      }
      return false;
    };
    const bases = prefix.map((statement, index) => ({ statement, index }))
      .filter((candidate) => baseShape(candidate.statement));
    if (bases.length !== 1) return undefined;
    for (let index = 0; index < prefix.length; index += 1) {
      const statement = prefix[index];
      if (statement === bases[0].statement || statement instanceof VariableDefinitionNode) continue;
      if (index >= bases[0].index || !collectEffectTree(statement)) return undefined;
    }
    if (mappingWrites.length === 0) return undefined;
    const base = bases[0].statement as BranchNode;
    if (mappingWrites.some((write) => !this.sortedMappingNames.has(write.name) || write.keys.length !== 1)
      || new Set(mappingWrites.map((write) => write.name)).size !== mappingWrites.length
      || !(recursiveReturn instanceof ReturnNode) || recursiveReturn.expressions.length !== 1
      || !this.isSelfCall(recursiveReturn.expressions[0], node.name)
    ) return undefined;
    const call = recursiveReturn.expressions[0];
    const condition = base.condition;
    if (!(condition instanceof BinaryOpNode) || condition.operator !== BinaryOperator.EQ) return undefined;
    const zeroSide = condition.left instanceof IntLiteralNode && condition.left.value === 0n
      ? condition.right : condition.right instanceof IntLiteralNode && condition.right.value === 0n
        ? condition.left : undefined;
    if (!(zeroSide instanceof IdentifierNode)) return undefined;
    const inductionIndex = node.parameters.findIndex((parameter) =>
      parameter.name === zeroSide.name && (parameter.type instanceof IntType
        || parameter.type === PrimitiveType.INT || parameter.type === PrimitiveType.BIGINT));
    const affineKey = (key: ExpressionNode): boolean => {
      if (key instanceof IdentifierNode) return key.name === zeroSide.name;
      if (!(key instanceof BinaryOpNode) || !(key.right instanceof IntLiteralNode)) return false;
      if (key.operator !== BinaryOperator.PLUS && key.operator !== BinaryOperator.MINUS) return false;
      return key.left instanceof IdentifierNode && key.left.name === zeroSide.name;
    };
    if (inductionIndex < 0 || mappingWrites.some((write) => !affineKey(write.keys[0]))) return undefined;
    const stepExpression = this.descendingAffineStep(call, node, inductionIndex, zeroSide.name);
    if (!stepExpression) return undefined;
    // The restricted prefix makes branch reachability replayable. Reject hidden collection/effect work inside its
    // values or the base expression; those need a general authenticated frame trace rather than this rank stream.
    let unsupported = false;
    const allowedWrites = new Set<Node>(mappingWrites);
    this.walkNodes(node.body, (candidate) => {
      if (allowedWrites.has(candidate) || candidate === call) return;
      if (candidate instanceof MappingAssignNode || candidate instanceof MappingDeleteNode
        || candidate instanceof MappingFieldAssignNode || candidate instanceof MappingAccessNode
        || candidate instanceof ArrayAccessNode || candidate instanceof StateAssignNode
        || candidate instanceof DeleteStateNode || candidate instanceof WhileNode
        || candidate instanceof DoWhileNode || candidate instanceof FunctionCallNode) unsupported = true;
    });
    return unsupported ? undefined : { inductionIndex, baseIndex: bases[0].index, stepExpression };
  }

  /** Recognize the call-stack-ordered counterpart of the pre-recursion stream above:
   *
   *   if (counter == 0) return base;
   *   T result = recur(counter - 1, invariant...);
   *   mapping[counter] = value; // optionally below replayable branches
   *   return result;
   *
   * Frames unwind from 1 through the public counter, so this exact shape is an ordinary ascending affine loop.
   * Keeping the recursive result unchanged avoids needing a general statement-continuation bytecode/trace. */
  private affinePostEffectRecursion(node: FunctionDefinitionNode): AffinePostEffectRecursion | undefined {
    if (!node.body || node.returnTypes.length !== 1 || node.customModifiers.length > 0) return undefined;
    const statements = node.body.statements ?? [];
    if (statements.length < 4) return undefined;
    const [base, resultDefinition, ...tail] = statements;
    const finalReturn = tail.at(-1);
    const effects = tail.slice(0, -1);
    if (!(base instanceof BranchNode) || base.elseBlock !== undefined
      || (base.ifBlock.statements ?? []).length !== 1
      || !(base.ifBlock.statements![0] instanceof ReturnNode)
      || base.ifBlock.statements![0].expressions.length !== 1
      || !(resultDefinition instanceof VariableDefinitionNode)
      || !this.isSelfCall(resultDefinition.expression, node.name)
      || !(finalReturn instanceof ReturnNode) || finalReturn.expressions.length !== 1
      || !(finalReturn.expressions[0] instanceof IdentifierNode)
      || finalReturn.expressions[0].name !== resultDefinition.name) return undefined;

    const condition = base.condition;
    if (!(condition instanceof BinaryOpNode) || condition.operator !== BinaryOperator.EQ) return undefined;
    const zeroSide = condition.left instanceof IntLiteralNode && condition.left.value === 0n
      ? condition.right : condition.right instanceof IntLiteralNode && condition.right.value === 0n
        ? condition.left : undefined;
    if (!(zeroSide instanceof IdentifierNode)) return undefined;
    const inductionIndex = node.parameters.findIndex((parameter) =>
      parameter.name === zeroSide.name && (parameter.type instanceof IntType
        || parameter.type === PrimitiveType.INT || parameter.type === PrimitiveType.BIGINT));
    if (inductionIndex < 0) return undefined;
    const call = resultDefinition.expression;
    const parameterProgressions = this.affineParameterProgressions(call, node, inductionIndex);
    const stepExpression = parameterProgressions
      ?.find(({ parameterIndex }) => parameterIndex === inductionIndex)?.stepExpression;
    if (!parameterProgressions || !stepExpression) return undefined;

    // The post-call result is invariant across retained frames because the only accepted final return is the
    // unchanged recursive result. Make that exact base-case value available while proving event predicates and
    // arguments. This is a definition-identity-free source recipe (not a spelling convention): ambiguous or
    // cyclic locals still fail in affineEventExpression.
    const replayAliases = new Map<string, ExpressionNode>([[
      resultDefinition.name,
      this.replaceIdentifier(
        cloneNode(base.ifBlock.statements![0].expressions[0]) as ExpressionNode,
        zeroSide.name,
        () => this.stamp(new IntLiteralNode(0n), base.ifBlock.statements![0].location),
      ) as ExpressionNode,
    ]]);

    const mappingWrites: Array<MappingAssignNode | MappingDeleteNode> = [];
    const emits: AffinePostEffectRecursion['emits'] = [];
    const conjunction = (left: ExpressionNode | undefined, right: ExpressionNode): ExpressionNode => left
      ? this.stamp(new BinaryOpNode(left, BinaryOperator.AND, right), right.location) : right;
    const affineKey = (key: ExpressionNode): boolean => {
      if (key instanceof IdentifierNode) return key.name === zeroSide.name;
      return key instanceof BinaryOpNode && key.right instanceof IntLiteralNode
        && (key.operator === BinaryOperator.PLUS || key.operator === BinaryOperator.MINUS)
        && key.left instanceof IdentifierNode && key.left.name === zeroSide.name;
    };
    const collectEffectTree = (statement: StatementNode, path?: ExpressionNode): boolean => {
      if (statement instanceof MappingAssignNode || statement instanceof MappingDeleteNode) {
        mappingWrites.push(statement);
        return true;
      }
      if (statement instanceof EmitStatementNode) {
        if (statement.args.some((argument) =>
          !this.affineEventExpression(argument, node, zeroSide.name, true, replayAliases))) return false;
        emits.push({ node: statement, condition: path });
        return true;
      }
      if (statement instanceof RequireNode) {
        if (this.affineEventExpression(
          statement.expression, node, zeroSide.name, true, replayAliases,
        ) !== undefined) return true;
        let mappingRead = false;
        this.walkNodes(statement.expression, (candidate) => {
          if (candidate instanceof MappingAccessNode) mappingRead = true;
        });
        return mappingRead;
      }
      if (statement instanceof BlockNode) {
        return (statement.statements ?? []).every((nested) => collectEffectTree(nested, path));
      }
      if (statement instanceof BranchNode) {
        if (!this.affineEventExpression(
          statement.condition, node, zeroSide.name, true, replayAliases,
        )) return false;
        if (!collectEffectTree(statement.ifBlock, conjunction(path, statement.condition))) return false;
        if (!statement.elseBlock) return true;
        const inverse = this.stamp(new UnaryOpNode(
          UnaryOperator.NOT, statement.condition,
        ), statement.condition.location);
        return collectEffectTree(statement.elseBlock, conjunction(path, inverse));
      }
      if (statement instanceof SwitchNode) {
        if (!this.affineEventExpression(
          statement.expression, node, zeroSide.name, true, replayAliases,
        )) return false;
        let unmatched = path;
        for (const arm of statement.cases) {
          if (!this.affineEventExpression(
            arm.value, node, zeroSide.name, true, replayAliases,
          )) return false;
          const match = this.stamp(new BinaryOpNode(
            statement.expression, BinaryOperator.EQ, arm.value,
          ), arm.location ?? statement.location);
          if (!collectEffectTree(arm.body, conjunction(unmatched, match))) return false;
          const inverse = this.stamp(new UnaryOpNode(
            UnaryOperator.NOT, match,
          ), arm.location ?? statement.location);
          unmatched = conjunction(unmatched, inverse);
        }
        return !statement.defaultCase || collectEffectTree(statement.defaultCase, unmatched);
      }
      if (statement instanceof BreakNode) return true;
      return false;
    };
    if (effects.length === 0 || !effects.every((effect) => collectEffectTree(effect))
      || mappingWrites.some((write) => !this.sortedMappingNames.has(write.name)
        || write.keys.length !== 1 || !affineKey(write.keys[0]))) return undefined;
    const mappingReads = this.affineRecursiveMappingReads(effects, mappingWrites, zeroSide.name);
    if (!mappingReads || mappingWrites.length + mappingReads.length + emits.length === 0
      || !this.affineRecursiveResourcesSound(
        mappingWrites, mappingReads, zeroSide.name, stepExpression,
      )) return undefined;

    // Calls, collection reads, or additional persistent effects inside base/value expressions need a genuine
    // authenticated frame environment. The accepted mapping statements themselves are the only effects here.
    let unsupported = false;
    const allowedEffects = new Set<Node>([
      ...mappingWrites, ...mappingReads.map(({ node: read }) => read),
      ...emits.map(({ node: emit }) => emit),
    ]);
    this.walkNodes(node.body, (candidate) => {
      if (allowedEffects.has(candidate) || candidate === call) return;
      if (candidate instanceof MappingAssignNode || candidate instanceof MappingDeleteNode
        || candidate instanceof MappingFieldAssignNode || candidate instanceof MappingAccessNode
        || candidate instanceof ArrayAccessNode || candidate instanceof StateAccessNode
        || candidate instanceof StateAssignNode
        || candidate instanceof DeleteStateNode || candidate instanceof WhileNode
        || candidate instanceof DoWhileNode || candidate instanceof FunctionCallNode) unsupported = true;
    });
    return unsupported ? undefined : {
      inductionIndex, stepExpression, parameterProgressions, resultDefinition,
      baseReturn: base.ifBlock.statements![0] as ReturnNode, effects, emits,
    };
  }

  /** Void counterpart of affinePostEffectRecursion. A bare zero-frame return contributes no effect; each
   * retained frame performs its statements while unwinding from 1 through counter. Replayable requirements may
   * follow the mapping operations because they consume no journal row and are evaluated at the same frame rank. */
  private affineVoidPostEffectRecursion(node: FunctionDefinitionNode): AffineVoidPostEffectRecursion | undefined {
    if (!node.body || node.returnTypes.length !== 0 || node.customModifiers.length > 0) return undefined;
    const [base, recursiveStatement, ...effects] = node.body.statements ?? [];
    if (!(base instanceof BranchNode) || base.elseBlock !== undefined
      || (base.ifBlock.statements ?? []).length !== 1
      || !(base.ifBlock.statements![0] instanceof ReturnNode)
      || base.ifBlock.statements![0].expressions.length !== 0
      || !(recursiveStatement instanceof FunctionCallStatementNode)
      || !this.isSelfCall(recursiveStatement.call, node.name) || effects.length === 0) return undefined;
    const condition = base.condition;
    if (!(condition instanceof BinaryOpNode) || condition.operator !== BinaryOperator.EQ) return undefined;
    const zeroSide = condition.left instanceof IntLiteralNode && condition.left.value === 0n
      ? condition.right : condition.right instanceof IntLiteralNode && condition.right.value === 0n
        ? condition.left : undefined;
    if (!(zeroSide instanceof IdentifierNode)) return undefined;
    const inductionIndex = node.parameters.findIndex((parameter) =>
      parameter.name === zeroSide.name && (parameter.type instanceof IntType
        || parameter.type === PrimitiveType.INT || parameter.type === PrimitiveType.BIGINT));
    if (inductionIndex < 0) return undefined;
    const call = recursiveStatement.call;
    const parameterProgressions = this.affineParameterProgressions(call, node, inductionIndex);
    const stepExpression = parameterProgressions
      ?.find(({ parameterIndex }) => parameterIndex === inductionIndex)?.stepExpression;
    if (!parameterProgressions || !stepExpression) return undefined;

    const writes: Array<MappingAssignNode | MappingDeleteNode> = [];
    const emits: AffineVoidPostEffectRecursion['emits'] = [];
    const conjunction = (left: ExpressionNode | undefined, right: ExpressionNode): ExpressionNode => left
      ? this.stamp(new BinaryOpNode(left, BinaryOperator.AND, right), right.location) : right;
    const affineKey = (key: ExpressionNode): boolean => key instanceof IdentifierNode
      ? key.name === zeroSide.name
      : key instanceof BinaryOpNode && key.right instanceof IntLiteralNode
        && (key.operator === BinaryOperator.PLUS || key.operator === BinaryOperator.MINUS)
        && key.left instanceof IdentifierNode && key.left.name === zeroSide.name;
    const collect = (statement: StatementNode, path?: ExpressionNode): boolean => {
      if (statement instanceof MappingAssignNode || statement instanceof MappingDeleteNode) {
        writes.push(statement);
        return true;
      }
      if (statement instanceof EmitStatementNode) {
        if (statement.args.some((argument) =>
          !this.affineEventExpression(argument, node, zeroSide.name, true))) return false;
        emits.push({ node: statement, condition: path });
        return true;
      }
      if (statement instanceof RequireNode) {
        if (this.affineEventExpression(statement.expression, node, zeroSide.name, true) !== undefined) return true;
        let mappingRead = false;
        this.walkNodes(statement.expression, (candidate) => {
          if (candidate instanceof MappingAccessNode) mappingRead = true;
        });
        return mappingRead;
      }
      if (statement instanceof BlockNode) {
        return (statement.statements ?? []).every((nested) => collect(nested, path));
      }
      if (statement instanceof BranchNode) {
        if (!this.affineEventExpression(statement.condition, node, zeroSide.name, true)
          || !collect(statement.ifBlock, conjunction(path, statement.condition))) return false;
        if (!statement.elseBlock) return true;
        const inverse = this.stamp(new UnaryOpNode(
          UnaryOperator.NOT, statement.condition,
        ), statement.condition.location);
        return collect(statement.elseBlock, conjunction(path, inverse));
      }
      if (statement instanceof SwitchNode) {
        if (!this.affineEventExpression(statement.expression, node, zeroSide.name, true)) return false;
        let unmatched = path;
        for (const arm of statement.cases) {
          if (!this.affineEventExpression(arm.value, node, zeroSide.name, true)) return false;
          const match = this.stamp(new BinaryOpNode(
            statement.expression, BinaryOperator.EQ, arm.value,
          ), arm.location ?? statement.location);
          if (!collect(arm.body, conjunction(unmatched, match))) return false;
          const inverse = this.stamp(new UnaryOpNode(
            UnaryOperator.NOT, match,
          ), arm.location ?? statement.location);
          unmatched = conjunction(unmatched, inverse);
        }
        return !statement.defaultCase || collect(statement.defaultCase, unmatched);
      }
      if (statement instanceof BreakNode) return true;
      return false;
    };
    if (!effects.every((effect) => collect(effect))
      || writes.some((write) => !this.sortedMappingNames.has(write.name)
        || write.keys.length !== 1 || !affineKey(write.keys[0]))) return undefined;
    const mappingReads = this.affineRecursiveMappingReads(effects, writes, zeroSide.name);
    if (!mappingReads || writes.length + mappingReads.length + emits.length === 0
      || !this.affineRecursiveResourcesSound(
        writes, mappingReads, zeroSide.name, stepExpression,
      )) return undefined;
    let unsupported = false;
    const allowed = new Set<Node>([
      ...writes, ...mappingReads.map(({ node: read }) => read), ...emits.map(({ node: emit }) => emit),
    ]);
    this.walkNodes(node.body, (candidate) => {
      if (allowed.has(candidate) || candidate === call) return;
      if (candidate instanceof MappingAssignNode || candidate instanceof MappingDeleteNode
        || candidate instanceof MappingFieldAssignNode || candidate instanceof MappingAccessNode
        || candidate instanceof ArrayAccessNode || candidate instanceof StateAccessNode
        || candidate instanceof StateAssignNode
        || candidate instanceof DeleteStateNode || candidate instanceof WhileNode
        || candidate instanceof DoWhileNode || candidate instanceof FunctionCallNode) unsupported = true;
    });
    return unsupported ? undefined : {
      inductionIndex, stepExpression, parameterProgressions, effects, emits,
    };
  }

  /** Exact mixed-order void recursion: prefix effects run from the public frame through the base frame, then
   * suffix effects run while unwinding from the innermost retained frame back to the public frame. Keeping both
   * halves to independently replayable event trees lets them use two ordinary runtime occurrence domains. */
  private affineVoidMixedEventRecursion(node: FunctionDefinitionNode): AffineVoidMixedEventRecursion | undefined {
    if (!node.body || node.returnTypes.length !== 0 || node.customModifiers.length > 0) return undefined;
    const statements = node.body.statements ?? [];
    const baseShape = (statement: StatementNode): statement is BranchNode => statement instanceof BranchNode
      && statement.elseBlock === undefined && (statement.ifBlock.statements ?? []).length === 1
      && statement.ifBlock.statements![0] instanceof ReturnNode
      && statement.ifBlock.statements![0].expressions.length === 0;
    const bases = statements.map((statement, index) => ({ statement, index }))
      .filter(({ statement }) => baseShape(statement));
    if (bases.length !== 1) return undefined;
    const { statement: base, index: baseIndex } = bases[0] as { statement: BranchNode; index: number };
    const recursiveStatement = statements[baseIndex + 1];
    if (!(recursiveStatement instanceof FunctionCallStatementNode)
      || !this.isSelfCall(recursiveStatement.call, node.name)
      || recursiveStatement.call.parameters.length !== node.parameters.length) return undefined;
    const prefix = statements.slice(0, baseIndex);
    const suffix = statements.slice(baseIndex + 2);
    if (prefix.length === 0 || suffix.length === 0) return undefined;
    const condition = base.condition;
    if (!(condition instanceof BinaryOpNode) || condition.operator !== BinaryOperator.EQ) return undefined;
    const zeroSide = condition.left instanceof IntLiteralNode && condition.left.value === 0n
      ? condition.right : condition.right instanceof IntLiteralNode && condition.right.value === 0n
        ? condition.left : undefined;
    if (!(zeroSide instanceof IdentifierNode)) return undefined;
    const inductionIndex = node.parameters.findIndex((parameter) =>
      parameter.name === zeroSide.name && (parameter.type instanceof IntType
        || parameter.type === PrimitiveType.INT || parameter.type === PrimitiveType.BIGINT));
    if (inductionIndex < 0) return undefined;
    const call = recursiveStatement.call;
    const parameterProgressions = this.affineParameterProgressions(call, node, inductionIndex);
    const stepExpression = parameterProgressions
      ?.find(({ parameterIndex }) => parameterIndex === inductionIndex)?.stepExpression;
    if (!parameterProgressions || !stepExpression) return undefined;

    const collect = (
      effects: readonly StatementNode[], emits: Array<{ node: EmitStatementNode; condition?: ExpressionNode }>,
    ): boolean => {
      const conjunction = (left: ExpressionNode | undefined, right: ExpressionNode): ExpressionNode => left
        ? this.stamp(new BinaryOpNode(left, BinaryOperator.AND, right), right.location) : right;
      const visit = (statement: StatementNode, path?: ExpressionNode): boolean => {
        if (statement instanceof EmitStatementNode) {
          if (statement.args.some((argument) =>
            !this.affineEventExpression(argument, node, zeroSide.name, true))) return false;
          emits.push({ node: statement, condition: path });
          return true;
        }
        if (statement instanceof BlockNode) return (statement.statements ?? []).every((child) => visit(child, path));
        if (statement instanceof BranchNode) {
          if (!this.affineEventExpression(statement.condition, node, zeroSide.name, true)
            || !visit(statement.ifBlock, conjunction(path, statement.condition))) return false;
          if (!statement.elseBlock) return true;
          const inverse = this.stamp(new UnaryOpNode(
            UnaryOperator.NOT, statement.condition,
          ), statement.condition.location);
          return visit(statement.elseBlock, conjunction(path, inverse));
        }
        return false;
      };
      return effects.every((effect) => visit(effect));
    };
    const prefixEmits: AffineVoidMixedEventRecursion['prefixEmits'] = [];
    const suffixEmits: AffineVoidMixedEventRecursion['suffixEmits'] = [];
    if (!collect(prefix, prefixEmits) || !collect(suffix, suffixEmits)
      || prefixEmits.length === 0 || suffixEmits.length === 0) return undefined;
    return {
      inductionIndex, stepExpression, parameterProgressions, prefix, suffix, prefixEmits, suffixEmits,
    };
  }

  /** Serialize only expressions whose value can be reconstructed from the public call frame and current
   * induction value. In particular, state reads and local temporaries are excluded: replaying either would need
   * an authenticated per-frame trace rather than an affine domain. */
  private isAffineIntegralExpression(
    expression: ExpressionNode,
    node: FunctionDefinitionNode,
    aliases: ReadonlyMap<string, ExpressionNode> = new Map(),
    resolvingAliases: ReadonlySet<string> = new Set(),
  ): boolean {
    if (expression.type === PrimitiveType.INT || expression.type === PrimitiveType.BIGINT
      || expression.type instanceof IntType || expression instanceof IntLiteralNode) return true;
    if (expression instanceof IdentifierNode) {
      const alias = aliases.get(expression.name);
      if (alias) {
        return !resolvingAliases.has(expression.name) && this.isAffineIntegralExpression(
          alias, node, aliases, new Set(resolvingAliases).add(expression.name),
        );
      }
      const parameter = node.parameters.find((candidate) => candidate.name === expression.name);
      return parameter?.type === PrimitiveType.INT || parameter?.type === PrimitiveType.BIGINT
        || parameter?.type instanceof IntType;
    }
    if (expression instanceof CastNode) return /^(?:u?int)(?:\d+)?$/.test(expression.type.toString());
    if (expression instanceof FieldAccessNode && expression.name === 'length') return true;
    if (expression instanceof UnaryOpNode && expression.operator === UnaryOperator.NEGATE) {
      return this.isAffineIntegralExpression(expression.expression, node, aliases, resolvingAliases);
    }
    if (expression instanceof BinaryOpNode && ['+', '-', '*', '/', '%'].includes(expression.operator)) {
      return this.isAffineIntegralExpression(expression.left, node, aliases, resolvingAliases)
        && this.isAffineIntegralExpression(expression.right, node, aliases, resolvingAliases);
    }
    if (expression instanceof TernaryOpNode) {
      return this.isAffineIntegralExpression(expression.ifTrue, node, aliases, resolvingAliases)
        && this.isAffineIntegralExpression(expression.ifFalse, node, aliases, resolvingAliases);
    }
    return false;
  }

  private affineEventExpression(
    expression: ExpressionNode, node: FunctionDefinitionNode, inductionName: string,
    allowInduction: boolean,
    aliases: ReadonlyMap<string, ExpressionNode> = new Map(),
    resolvingAliases: ReadonlySet<string> = new Set(),
  ): ExternalCallExpression | undefined {
    if (expression instanceof LiteralNode) {
      if (typeof expression.value === 'bigint') {
        return { kind: 'literal', type: 'bigint', value: expression.value.toString() };
      }
      if (typeof expression.value === 'boolean') return { kind: 'literal', type: 'bool', value: expression.value };
      if (typeof expression.value === 'string') {
        return { kind: 'literal', type: 'string', value: expression.value };
      }
      return undefined;
    }
    if (expression instanceof IdentifierNode) {
      if (expression.name === inductionName) {
        return allowInduction ? { kind: 'identifier', name: expression.name } : undefined;
      }
      const alias = aliases.get(expression.name);
      if (alias) {
        if (resolvingAliases.has(expression.name)) return undefined;
        return this.affineEventExpression(
          alias, node, inductionName, allowInduction, aliases,
          new Set(resolvingAliases).add(expression.name),
        );
      }
      const visible = node.parameters.filter((parameter) => !parameter.name.startsWith('__internal__'));
      const index = visible.findIndex((parameter) => parameter.name === expression.name);
      return index < 0 ? undefined : { kind: 'source', source: { kind: 'forward', paramIndex: index } };
    }
    if (expression instanceof CastNode) {
      const target = expression.type.toString();
      if (target !== 'bytes' && !/^(?:u?int)(?:\d+)?$/.test(target)) return undefined;
      const inner = this.affineEventExpression(
        expression.expression, node, inductionName, allowInduction, aliases, resolvingAliases,
      );
      return inner && { kind: 'cast', type: target, expression: inner };
    }
    if (expression instanceof UnaryOpNode) {
      if (!['!', '-'].includes(expression.operator)) return undefined;
      const inner = this.affineEventExpression(
        expression.expression, node, inductionName, allowInduction, aliases, resolvingAliases,
      );
      return inner && { kind: 'unary', operator: expression.operator, expression: inner };
    }
    if (expression instanceof BinaryOpNode) {
      if (!['&&', '||', '==', '!=', '+', '-', '*', '/', '%', '<', '<=', '>', '>=']
        .includes(expression.operator)) return undefined;
      if (['+', '-', '*', '/', '%', '<', '<=', '>', '>='].includes(expression.operator)) {
        if (!this.isAffineIntegralExpression(expression.left, node, aliases, resolvingAliases)
          || !this.isAffineIntegralExpression(expression.right, node, aliases, resolvingAliases)) return undefined;
      }
      const left = this.affineEventExpression(
        expression.left, node, inductionName, allowInduction, aliases, resolvingAliases,
      );
      const right = this.affineEventExpression(
        expression.right, node, inductionName, allowInduction, aliases, resolvingAliases,
      );
      return left && right && { kind: 'binary', operator: expression.operator, left, right };
    }
    if (expression instanceof TernaryOpNode) {
      const condition = this.affineEventExpression(
        expression.condition, node, inductionName, allowInduction, aliases, resolvingAliases,
      );
      const ifTrue = this.affineEventExpression(
        expression.ifTrue, node, inductionName, allowInduction, aliases, resolvingAliases,
      );
      const ifFalse = this.affineEventExpression(
        expression.ifFalse, node, inductionName, allowInduction, aliases, resolvingAliases,
      );
      return condition && ifTrue && ifFalse && { kind: 'ternary', condition, ifTrue, ifFalse };
    }
    if (expression instanceof FieldAccessNode && expression.name === 'length') {
      const inner = this.affineEventExpression(
        expression.expression, node, inductionName, allowInduction, aliases, resolvingAliases,
      );
      return inner && { kind: 'unary', operator: '.length', expression: inner };
    }
    return undefined;
  }

  /** Recognize a direct do-while-shaped recursive event stream. Keeping the prefix grammar to emits and branches
   * makes every accepted event argument and predicate independently replayable, and rules out hidden effects or
   * state mutations between frames. */
  private affineEventRecursion(node: FunctionDefinitionNode): AffineEventRecursion | undefined {
    if (!node.body || node.customModifiers.length > 0) return undefined;
    const statements = node.body.statements ?? [];
    if (statements.length < 2) return undefined;
    const recursiveStatement = statements.at(-1)!;
    const base = statements.at(-2)!;
    const recursiveCall = recursiveStatement instanceof ReturnNode
      && recursiveStatement.expressions.length === 1
      && this.isSelfCall(recursiveStatement.expressions[0], node.name)
      ? recursiveStatement.expressions[0]
      : recursiveStatement instanceof FunctionCallStatementNode
        && this.isSelfCall(recursiveStatement.call, node.name)
        ? recursiveStatement.call : undefined;
    if (!recursiveCall
      || !(base instanceof BranchNode) || base.elseBlock !== undefined
      || (base.ifBlock.statements ?? []).length !== 1
      || !(base.ifBlock.statements![0] instanceof ReturnNode)) return undefined;
    const exactZeroSide = base.condition instanceof BinaryOpNode
      && base.condition.operator === BinaryOperator.EQ
      ? base.condition.left instanceof IntLiteralNode && base.condition.left.value === 0n
        ? base.condition.right : base.condition.right instanceof IntLiteralNode && base.condition.right.value === 0n
          ? base.condition.left : undefined
      : undefined;
    const exactInductionIndex = exactZeroSide instanceof IdentifierNode
      ? node.parameters.findIndex((parameter) => parameter.name === exactZeroSide.name
        && (parameter.type instanceof IntType || parameter.type === PrimitiveType.INT
          || parameter.type === PrimitiveType.BIGINT))
      : -1;
    const exactProgressionCandidate = exactInductionIndex >= 0
      ? this.affineParameterProgressions(recursiveCall, node, exactInductionIndex) : undefined;
    // Keep the established single-counter domain unchanged. Rank reconstruction is needed only when an
    // additional parameter varies and would otherwise be serialized as its public-frame value.
    const exactProgressions = exactProgressionCandidate && exactProgressionCandidate.length > 1
      ? exactProgressionCandidate : undefined;
    const varying = recursiveCall.parameters.flatMap((argument, index) =>
      argument instanceof IdentifierNode && argument.name === node.parameters[index]?.name ? [] : [index]);
    if (!exactProgressions && varying.length !== 1) return undefined;
    const inductionIndex = exactProgressions ? exactInductionIndex : varying[0];
    const induction = node.parameters[inductionIndex];
    if (!induction || (!(induction.type instanceof IntType)
      && induction.type !== PrimitiveType.INT && induction.type !== PrimitiveType.BIGINT)) return undefined;
    const next = recursiveCall.parameters[inductionIndex];
    let stepExpression: ExpressionNode | undefined;
    let negateStep = false;
    if (exactProgressions) {
      stepExpression = exactProgressions.find(({ parameterIndex }) => parameterIndex === inductionIndex)
        ?.stepExpression;
      negateStep = true;
    } else if (next instanceof BinaryOpNode && next.operator === BinaryOperator.PLUS) {
      if (next.left instanceof IdentifierNode && next.left.name === induction.name) stepExpression = next.right;
      else if (next.right instanceof IdentifierNode && next.right.name === induction.name) stepExpression = next.left;
    } else if (next instanceof BinaryOpNode && next.operator === BinaryOperator.MINUS
      && next.left instanceof IdentifierNode && next.left.name === induction.name) {
      stepExpression = next.right;
      negateStep = true;
    }
    if (!stepExpression) return undefined;
    const serializedStep = this.affineEventExpression(stepExpression, node, induction.name, false);
    const serializedBase = this.affineEventExpression(base.condition, node, induction.name, true);
    if (!serializedStep || !serializedBase) return undefined;

    const emits: AffineEventRecursion['emits'] = [];
    const conjunction = (left: ExpressionNode | undefined, right: ExpressionNode): ExpressionNode => left
      ? this.stamp(new BinaryOpNode(left, BinaryOperator.AND, right), right.location) : right;
    const collect = (block: BlockNode, path?: ExpressionNode): boolean => (block.statements ?? []).every((statement) => {
      if (statement instanceof EmitStatementNode) {
        if (statement.args.some((argument) =>
          !this.affineEventExpression(argument, node, induction.name, true))) return false;
        emits.push({ node: statement, condition: path });
        return true;
      }
      if (statement instanceof BlockNode) return collect(statement, path);
      if (statement instanceof BranchNode) {
        if (!this.affineEventExpression(statement.condition, node, induction.name, true)) return false;
        const ifPath = conjunction(path, statement.condition);
        if (!collect(statement.ifBlock, ifPath)) return false;
        if (!statement.elseBlock) return true;
        const inverse = this.stamp(new UnaryOpNode(UnaryOperator.NOT, statement.condition), statement.condition.location);
        return collect(statement.elseBlock, conjunction(path, inverse));
      }
      return false;
    });
    if (!collect(this.stamp(new BlockNode(statements.slice(0, -2)), node.body.location)) || emits.length === 0) {
      return undefined;
    }
    return {
      inductionIndex,
      stepValue: negateStep
        ? { kind: 'unary', operator: UnaryOperator.NEGATE, expression: serializedStep }
        : serializedStep,
      continueCondition: { kind: 'unary', operator: UnaryOperator.NOT, expression: serializedBase },
      emits,
      ...(exactProgressions ? { stepExpression, parameterProgressions: exactProgressions } : {}),
    };
  }

  private publishAffineEventRecursion(
    node: FunctionDefinitionNode, plan: AffineEventRecursion, iterationName: string,
  ): RequireNode[] {
    const loopIndex = node.runtimeLoopEvents?.length ?? 0;
    const induction = node.parameters[plan.inductionIndex];
    const visibleIndex = node.parameters.slice(0, plan.inductionIndex)
      .filter((parameter) => !parameter.name.startsWith('__internal__')).length;
    const exact = plan.stepExpression !== undefined && plan.parameterProgressions !== undefined;
    const quotient: ExternalCallExpression | undefined = exact ? {
      kind: 'binary', operator: BinaryOperator.DIV,
      left: { kind: 'source', source: { kind: 'forward', paramIndex: visibleIndex } },
      right: this.affineEventExpression(plan.stepExpression!, node, induction.name, false)!,
    } : undefined;
    node.runtimeLoopEvents = [...(node.runtimeLoopEvents ?? []), {
      loopIndex,
      iterationDomain: {
        counterName: exact ? iterationName : induction.name,
        initialValue: exact
          ? { kind: 'literal', type: 'bigint', value: '0' }
          : { kind: 'source', source: { kind: 'forward', paramIndex: visibleIndex } },
        stepValue: exact ? { kind: 'literal', type: 'bigint', value: '1' } : plan.stepValue,
        continueCondition: exact ? {
          kind: 'binary', operator: BinaryOperator.LT,
          left: { kind: 'identifier', name: iterationName }, right: quotient!,
        } : plan.continueCondition,
        maximumIterations: 64,
      },
    }];
    node.runtimeCounterLoopOutputCapacity = (node.runtimeCounterLoopOutputCapacity ?? 0)
      + plan.emits.length * 64;
    plan.emits.forEach(({ node: emit, condition }, siteIndex) => {
      if (exact) {
        // The ordinary lowered loop already mutates parameters to their current-frame values. Preserve those
        // executable arguments, and publish separate source-frame/rank recipes for SDK replay.
        emit.runtimeLoopEventArguments = emit.args.map((argument) => this.replaceAffineProgressions(
          cloneNode(argument) as ExpressionNode, node, plan.parameterProgressions!,
          iterationName, plan.inductionIndex, plan.stepExpression!, false,
        ) as ExpressionNode);
        condition = condition ? this.replaceAffineProgressions(
          cloneNode(condition) as ExpressionNode, node, plan.parameterProgressions!,
          iterationName, plan.inductionIndex, plan.stepExpression!, false,
        ) as ExpressionNode : undefined;
      }
      emit.runtimeLoopEvent = { loopIndex, siteIndex };
      emit.runtimeLoopEventCondition = condition;
      if (exact) emit.runtimeLoopEventCounter = { name: iterationName, initialValue: 0n, stepValue: 1n };
      emit.runtimeLoopEffectOrder = siteIndex;
    });
    if (exact) return this.affineFrameGuards(
      node, this.stamp(new IdentifierNode(induction.name), node.location), plan.stepExpression!, 63n,
    );
    return [this.stamp(new RequireNode(this.stamp(new BinaryOpNode(
      this.stamp(new IdentifierNode(iterationName), node.location), BinaryOperator.LT,
      this.stamp(new IntLiteralNode(64n), node.location),
    ), node.location), 'recursive event limit'), node.location)];
  }

  private hasVaryingRecursiveMappingWrite(node: FunctionDefinitionNode): boolean {
    if (!node.body) return false;
    const varying = new Set<string>();
    this.walkNodes(node.body, (candidate) => {
      if (!this.isSelfCall(candidate, node.name)) return;
      node.parameters.forEach((parameter, index) => {
        const argument = candidate.parameters[index];
        if (!(argument instanceof IdentifierNode) || argument.name !== parameter.name) varying.add(parameter.name);
      });
    });
    const usesVaryingParameter = (key: ExpressionNode): boolean => {
      let result = false;
      this.walkNodes(key, (part) => {
        if (part instanceof IdentifierNode && varying.has(part.name)) result = true;
      });
      return result;
    };
    let found = false;
    this.walkNodes(node.body, (candidate) => {
      if (!(candidate instanceof MappingAssignNode || candidate instanceof MappingDeleteNode
        || candidate instanceof MappingFieldAssignNode)) return;
      if (candidate.keys.some(usesVaryingParameter)) found = true;
    });
    return found;
  }

  /** A varying recursive mapping read needs an authenticated occurrence stream just like a write. If none of the
   * exact affine plans above claimed it, retaining the recursive body is the fail-closed representation: the
   * generic tail loop has no per-frame mapping-key witness and must not make one varying entry look invariant. */
  private hasVaryingRecursiveMappingRead(node: FunctionDefinitionNode): boolean {
    if (!node.body) return false;
    const varying = new Set<string>();
    this.walkNodes(node.body, (candidate) => {
      if (!this.isSelfCall(candidate, node.name)) return;
      node.parameters.forEach((parameter, index) => {
        const argument = candidate.parameters[index];
        if (!(argument instanceof IdentifierNode) || argument.name !== parameter.name) varying.add(parameter.name);
      });
    });
    let found = false;
    this.walkNodes(node.body, (candidate) => {
      if (!(candidate instanceof MappingAccessNode)) return;
      this.walkNodes(candidate, (part) => {
        if (part instanceof IdentifierNode && varying.has(part.name)) found = true;
      });
    });
    return found;
  }

  private replaceAffineInduction(
    node: Node, inductionName: string, rankName: string, stepExpression: ExpressionNode,
  ): Node {
    if (node instanceof IdentifierNode && node.name === inductionName) {
      return this.affineFrameAtRank(node, rankName, stepExpression, false);
    }
    for (const [key, child] of Object.entries(node)) {
      if (['resolvedFunction', 'definition', 'symbolTable', 'location', 'type'].includes(key)
        || (node instanceof FunctionCallNode && key === 'identifier')) continue;
      if (child instanceof Node) {
        (node as unknown as Record<string, unknown>)[key] = this.replaceAffineInduction(
          child, inductionName, rankName, stepExpression,
        );
      } else if (Array.isArray(child)) {
        (node as unknown as Record<string, unknown>)[key] = child.map((item) => item instanceof Node
          ? this.replaceAffineInduction(item, inductionName, rankName, stepExpression) : item);
      }
    }
    return node;
  }

  private replaceIdentifier(
    node: Node, identifierName: string, replacement: () => ExpressionNode,
  ): Node {
    if (node instanceof IdentifierNode && node.name === identifierName) return replacement();
    for (const [key, child] of Object.entries(node)) {
      if (['resolvedFunction', 'definition', 'symbolTable', 'location', 'type'].includes(key)
        || (node instanceof FunctionCallNode && key === 'identifier')) continue;
      if (child instanceof Node) {
        (node as unknown as Record<string, unknown>)[key] = this.replaceIdentifier(
          child, identifierName, replacement,
        );
      } else if (Array.isArray(child)) {
        (node as unknown as Record<string, unknown>)[key] = child.map((item) => item instanceof Node
          ? this.replaceIdentifier(item, identifierName, replacement) : item);
      }
    }
    return node;
  }

  private affineFrameAtRank(
    induction: IdentifierNode, rankName: string, stepExpression: ExpressionNode, unwind: boolean,
  ): ExpressionNode {
    const rank = this.stamp(new IdentifierNode(rankName), induction.location);
    const offset = stepExpression instanceof IntLiteralNode && stepExpression.value === 1n
      ? rank
      : this.stamp(new BinaryOpNode(
        rank, BinaryOperator.MUL, cloneNode(stepExpression),
      ), induction.location);
    return unwind ? offset : this.stamp(new BinaryOpNode(
      cloneNode(induction), BinaryOperator.MINUS, offset,
    ), induction.location);
  }

  private affineProgressionAtRank(
    node: FunctionDefinitionNode, progression: AffineParameterProgression, rankName: string,
    inductionIndex: number, inductionStep: ExpressionNode, unwind: boolean, location: Node['location'],
  ): ExpressionNode {
    const parameter = node.parameters[progression.parameterIndex];
    const rank = this.stamp(new IdentifierNode(rankName), location);
    const depth = unwind ? this.stamp(new BinaryOpNode(
      this.stamp(new BinaryOpNode(
        this.stamp(new IdentifierNode(node.parameters[inductionIndex].name), location), BinaryOperator.DIV,
        cloneNode(inductionStep),
      ), location), BinaryOperator.MINUS, rank,
    ), location) : rank;
    let offset: ExpressionNode;
    if (!progression.counterSlope) {
      offset = progression.stepExpression instanceof IntLiteralNode
        && progression.stepExpression.value === 1n
        ? depth
        : this.stamp(new BinaryOpNode(
          cloneNode(depth), BinaryOperator.MUL, cloneNode(progression.stepExpression),
        ), location);
    } else {
      // cursor(j) = cursor(0) - j * inductionStep. For an affine delta `a * cursor + b`, the exact prefix is
      // depth * delta(cursor(0)) - a * inductionStep * depth * (depth - 1) / 2. Keeping the source delta intact
      // retains its checked expression shape; bigint users additionally receive the unrestricted closed form.
      const gross = this.stamp(new BinaryOpNode(
        cloneNode(depth), BinaryOperator.MUL, cloneNode(progression.stepExpression),
      ), location);
      const triangular = this.stamp(new BinaryOpNode(
        this.stamp(new BinaryOpNode(
          cloneNode(depth), BinaryOperator.MUL,
          this.stamp(new BinaryOpNode(
            cloneNode(depth), BinaryOperator.MINUS, this.stamp(new IntLiteralNode(1n), location),
          ), location),
        ), location),
        BinaryOperator.DIV, this.stamp(new IntLiteralNode(2n), location),
      ), location);
      const drift = this.stamp(new BinaryOpNode(
        this.stamp(new BinaryOpNode(
          cloneNode(progression.counterSlope), BinaryOperator.MUL, cloneNode(inductionStep),
        ), location), BinaryOperator.MUL, triangular,
      ), location);
      offset = this.stamp(new BinaryOpNode(gross, BinaryOperator.MINUS, drift), location);
    }
    return this.stamp(new BinaryOpNode(
      this.stamp(new IdentifierNode(parameter.name), location),
      progression.subtract ? BinaryOperator.MINUS : BinaryOperator.PLUS,
      offset,
    ), location);
  }

  private replaceAffineProgressions(
    source: Node, node: FunctionDefinitionNode, progressions: readonly AffineParameterProgression[],
    rankName: string, inductionIndex: number, inductionStep: ExpressionNode, unwind: boolean,
  ): Node {
    const byName = new Map(progressions.map((progression) => [
      node.parameters[progression.parameterIndex].name, progression,
    ]));
    const replace = (candidate: Node): Node => {
      if (candidate instanceof IdentifierNode) {
        const progression = byName.get(candidate.name);
        if (progression) return this.affineProgressionAtRank(
          node, progression, rankName, inductionIndex, inductionStep, unwind, candidate.location,
        );
      }
      for (const [key, child] of Object.entries(candidate)) {
        if (['resolvedFunction', 'definition', 'symbolTable', 'location', 'type'].includes(key)
          || (candidate instanceof FunctionCallNode && key === 'identifier')) continue;
        if (child instanceof Node) (candidate as unknown as Record<string, unknown>)[key] = replace(child);
        else if (Array.isArray(child)) {
          (candidate as unknown as Record<string, unknown>)[key] = child.map((item) =>
            item instanceof Node ? replace(item) : item);
        }
      }
      return candidate;
    };
    return replace(source);
  }

  /** The accepted recursion reaches zero exactly. These guards make the iterative replacement fail closed for a
   * zero/negative runtime step, an endpoint between steps, or a call whose exact recursive frame count exceeds
   * the journal ceiling. `maximumQuotient` is 63 for a pre-order stream (which also visits zero) and 64 for an
   * unwind stream (whose zero frame has no effect). */
  private affineFrameGuards(
    node: FunctionDefinitionNode, induction: IdentifierNode, stepExpression: ExpressionNode,
    maximumQuotient: bigint,
  ): RequireNode[] {
    const at = <T extends Node>(value: T): T => this.stamp(value, node.location);
    const step = (): ExpressionNode => cloneNode(stepExpression);
    const cursor = (): IdentifierNode => at(new IdentifierNode(induction.name));
    const message = 'recursive affine frame count must be exact and between 0 and 64';
    return [
      at(new RequireNode(at(new BinaryOpNode(step(), BinaryOperator.GT, at(new IntLiteralNode(0n)))), message)),
      at(new RequireNode(at(new BinaryOpNode(cursor(), BinaryOperator.GE, at(new IntLiteralNode(0n)))), message)),
      at(new RequireNode(at(new BinaryOpNode(
        at(new BinaryOpNode(cursor(), BinaryOperator.MOD, step())), BinaryOperator.EQ,
        at(new IntLiteralNode(0n)),
      )), message)),
      at(new RequireNode(at(new BinaryOpNode(
        at(new BinaryOpNode(cursor(), BinaryOperator.DIV, step())), BinaryOperator.LE,
        at(new IntLiteralNode(maximumQuotient)),
      )), message)),
    ];
  }

  /** Publish the post-recursion unwind as an exact event domain. Runtime event domains are do-while-shaped, so
   * the zero-frame call exposes one metadata rank whose per-site guard is false; no physical event is emitted. */
  private publishAffinePostEvents(
    node: FunctionDefinitionNode,
    plan: AffinePostEffectRecursion | AffineVoidPostEffectRecursion,
    rankName: string,
    effects: readonly StatementNode[],
  ): void {
    if (plan.emits.length === 0) return;
    const induction = node.parameters[plan.inductionIndex];
    const visibleIndex = node.parameters.slice(0, plan.inductionIndex)
      .filter((parameter) => !parameter.name.startsWith('__internal__')).length;
    const loopIndex = node.runtimeLoopEvents?.length ?? 0;
    const serializedStep = this.affineEventExpression(plan.stepExpression, node, induction.name, false);
    if (!serializedStep) return;
    const quotient: ExternalCallExpression = {
      kind: 'binary', operator: BinaryOperator.DIV,
      left: { kind: 'source', source: { kind: 'forward', paramIndex: visibleIndex } },
      right: serializedStep,
    };
    node.runtimeLoopEvents = [...(node.runtimeLoopEvents ?? []), {
      loopIndex,
      iterationDomain: {
        counterName: rankName,
        initialValue: { kind: 'literal', type: 'bigint', value: '1' },
        stepValue: { kind: 'literal', type: 'bigint', value: '1' },
        continueCondition: {
          kind: 'binary', operator: BinaryOperator.LT,
          left: { kind: 'identifier', name: rankName },
          right: quotient,
        },
        maximumIterations: 64,
      },
    }];
    node.runtimeCounterLoopOutputCapacity = (node.runtimeCounterLoopOutputCapacity ?? 0)
      + plan.emits.length * 64;
    const clonedEmits: EmitStatementNode[] = [];
    for (const effect of effects) this.walkNodes(effect, (candidate) => {
      if (candidate instanceof EmitStatementNode) clonedEmits.push(candidate);
    });
    if (clonedEmits.length !== plan.emits.length) return;
    clonedEmits.forEach((emit, siteIndex) => {
      const frame = (): ExpressionNode => this.affineFrameAtRank(
        this.stamp(new IdentifierNode(induction.name), emit.location), rankName,
        plan.stepExpression, true,
      );
      const sourceCondition = plan.emits[siteIndex].condition;
      const condition = sourceCondition ? ('parameterProgressions' in plan
        ? this.replaceAffineProgressions(
          cloneNode(sourceCondition) as ExpressionNode, node, plan.parameterProgressions,
          rankName, plan.inductionIndex, plan.stepExpression, true,
        )
        : this.replaceIdentifier(
          cloneNode(sourceCondition) as ExpressionNode, induction.name, frame,
        )) as ExpressionNode : undefined;
      const reachedFrame = this.stamp(new BinaryOpNode(
        this.stamp(new IdentifierNode(rankName), emit.location), BinaryOperator.LE,
        this.stamp(new BinaryOpNode(
          this.stamp(new IdentifierNode(induction.name), emit.location), BinaryOperator.DIV,
          cloneNode(plan.stepExpression),
        ), emit.location),
      ), emit.location);
      emit.runtimeLoopEvent = { loopIndex, siteIndex };
      emit.runtimeLoopEventCondition = condition
        ? this.stamp(new BinaryOpNode(reachedFrame, BinaryOperator.AND, condition), emit.location)
        : reachedFrame;
      emit.runtimeLoopEventCounter = { name: rankName, initialValue: 1n, stepValue: 1n };
      emit.runtimeLoopEffectOrder = siteIndex;
    });
  }

  private publishAffineMixedPreEvents(
    node: FunctionDefinitionNode, plan: AffineVoidMixedEventRecursion,
    rankName: string, effects: readonly StatementNode[],
  ): void {
    const induction = node.parameters[plan.inductionIndex];
    const visibleIndex = node.parameters.slice(0, plan.inductionIndex)
      .filter((parameter) => !parameter.name.startsWith('__internal__')).length;
    const serializedStep = this.affineEventExpression(plan.stepExpression, node, induction.name, false);
    if (!serializedStep) return;
    const quotient: ExternalCallExpression = {
      kind: 'binary', operator: BinaryOperator.DIV,
      left: { kind: 'source', source: { kind: 'forward', paramIndex: visibleIndex } },
      right: serializedStep,
    };
    const loopIndex = node.runtimeLoopEvents?.length ?? 0;
    node.runtimeLoopEvents = [...(node.runtimeLoopEvents ?? []), {
      loopIndex,
      iterationDomain: {
        counterName: rankName,
        initialValue: { kind: 'literal', type: 'bigint', value: '0' },
        stepValue: { kind: 'literal', type: 'bigint', value: '1' },
        continueCondition: {
          kind: 'binary', operator: BinaryOperator.LT,
          left: { kind: 'identifier', name: rankName }, right: quotient,
        },
        maximumIterations: 64,
      },
    }];
    node.runtimeCounterLoopOutputCapacity = (node.runtimeCounterLoopOutputCapacity ?? 0)
      + plan.prefixEmits.length * 64;
    const clonedEmits: EmitStatementNode[] = [];
    for (const effect of effects) this.walkNodes(effect, (candidate) => {
      if (candidate instanceof EmitStatementNode) clonedEmits.push(candidate);
    });
    if (clonedEmits.length !== plan.prefixEmits.length) return;
    clonedEmits.forEach((emit, siteIndex) => {
      const sourceCondition = plan.prefixEmits[siteIndex].condition;
      emit.runtimeLoopEvent = { loopIndex, siteIndex };
      emit.runtimeLoopEventCondition = sourceCondition ? this.replaceAffineProgressions(
        cloneNode(sourceCondition) as ExpressionNode, node, plan.parameterProgressions,
        rankName, plan.inductionIndex, plan.stepExpression, false,
      ) as ExpressionNode : undefined;
      emit.runtimeLoopEventCounter = { name: rankName, initialValue: 0n, stepValue: 1n };
      emit.runtimeLoopEffectOrder = siteIndex;
    });
  }

  private lowerAffineVoidMixedEventRecursion(
    node: FunctionDefinitionNode, plan: AffineVoidMixedEventRecursion, frame: number,
  ): void {
    const induction = node.parameters[plan.inductionIndex];
    const preRankName = `__tail_pre_rank_${frame}`;
    const postRankName = `__tail_unwind_rank_${frame}`;
    const replaceEffects = (effects: readonly StatementNode[], rankName: string, unwind: boolean): StatementNode[] =>
      effects.map((effect) => this.replaceAffineProgressions(
        cloneNode(effect) as StatementNode, node, plan.parameterProgressions,
        rankName, plan.inductionIndex, plan.stepExpression, unwind,
      ) as StatementNode);
    const preEffects = replaceEffects(plan.prefix, preRankName, false);
    const postEffects = replaceEffects(plan.suffix, postRankName, true);
    this.publishAffineMixedPreEvents(node, plan, preRankName, preEffects);
    this.publishAffinePostEvents(node, {
      inductionIndex: plan.inductionIndex,
      stepExpression: plan.stepExpression,
      parameterProgressions: plan.parameterProgressions,
      effects: plan.suffix,
      emits: plan.suffixEmits,
    }, postRankName, postEffects);
    const quotient = (): ExpressionNode => this.stamp(new BinaryOpNode(
      this.stamp(new IdentifierNode(induction.name), node.location), BinaryOperator.DIV,
      cloneNode(plan.stepExpression),
    ), node.location);
    const phase = (
      rankName: string, initialValue: bigint, effects: readonly StatementNode[],
    ): [VariableDefinitionNode, WhileNode] => {
      const rank = this.stamp(new VariableDefinitionNode(
        induction.type, [], rankName, this.stamp(new IntLiteralNode(initialValue), node.location),
      ), node.location);
      rank.isLoopVariable = true;
      rank.loopInitialValue = initialValue;
      rank.loopStepValue = 1n;
      const increment = this.stamp(new AssignNode(
        this.stamp(new IdentifierNode(rankName), node.location),
        this.stamp(new BinaryOpNode(
          this.stamp(new IdentifierNode(rankName), node.location), BinaryOperator.PLUS,
          this.stamp(new IntLiteralNode(1n), node.location),
        ), node.location),
      ), node.location);
      const loop = this.stamp(new WhileNode(
        this.stamp(new BinaryOpNode(
          this.stamp(new IdentifierNode(rankName), node.location), BinaryOperator.LE, quotient(),
        ), node.location),
        this.stamp(new BlockNode([...effects, increment]), node.location),
      ), node.location);
      loop.forLoopUpdateCount = 1;
      return [rank, loop];
    };
    const [preRank, preLoop] = phase(preRankName, 0n, preEffects);
    const [postRank, postLoop] = phase(postRankName, 1n, postEffects);
    const guards = this.affineFrameGuards(
      node, this.stamp(new IdentifierNode(induction.name), node.location), plan.stepExpression, 63n,
    );
    node.body = this.stamp(new BlockNode([
      ...guards, preRank, preLoop, postRank, postLoop,
    ]), node.location);
  }

  private lowerAffinePostEffectRecursion(
    node: FunctionDefinitionNode, plan: AffinePostEffectRecursion, frame: number,
  ): void {
    const induction = node.parameters[plan.inductionIndex];
    const rankName = `__tail_unwind_rank_${frame}`;
    const terminalRankName = `__tail_terminal_rank_${frame}`;
    const terminalRank = this.stamp(new VariableDefinitionNode(
      induction.type, [], terminalRankName, this.stamp(new BinaryOpNode(
        this.stamp(new IdentifierNode(induction.name), node.location), BinaryOperator.DIV,
        cloneNode(plan.stepExpression),
      ), node.location),
    ), node.location);
    const baseExpression = this.replaceAffineProgressions(
      cloneNode(plan.baseReturn.expressions[0]) as ExpressionNode, node, plan.parameterProgressions,
      terminalRankName, plan.inductionIndex, plan.stepExpression, false,
    ) as ExpressionNode;
    const result = this.stamp(new VariableDefinitionNode(
      plan.resultDefinition.type, [...plan.resultDefinition.modifier], plan.resultDefinition.name, baseExpression,
    ), plan.resultDefinition.location);
    const effects = plan.effects.map((effect) => this.replaceAffineProgressions(
      cloneNode(effect) as StatementNode, node, plan.parameterProgressions,
      rankName, plan.inductionIndex, plan.stepExpression, true,
    ) as StatementNode);
    this.publishAffinePostEvents(node, plan, rankName, effects);
    const increment = this.stamp(new AssignNode(
      this.stamp(new IdentifierNode(rankName), node.location),
      this.stamp(new BinaryOpNode(
        this.stamp(new IdentifierNode(rankName), node.location), BinaryOperator.PLUS,
        this.stamp(new IntLiteralNode(1n), node.location),
      ), node.location),
    ), node.location);
    const loop = this.stamp(new WhileNode(
      this.stamp(new BinaryOpNode(
        this.stamp(new IdentifierNode(rankName), node.location), BinaryOperator.LE,
        this.stamp(new BinaryOpNode(
          this.stamp(new IdentifierNode(induction.name), node.location), BinaryOperator.DIV,
          cloneNode(plan.stepExpression),
        ), node.location),
      ), node.location),
      this.stamp(new BlockNode([...effects, increment]), node.location),
    ), node.location);
    loop.forLoopUpdateCount = 1;
    const rank = this.stamp(new VariableDefinitionNode(
      induction.type, [], rankName, this.stamp(new IntLiteralNode(1n), node.location),
    ), node.location);
    rank.isLoopVariable = true;
    rank.loopInitialValue = 1n;
    rank.loopStepValue = 1n;
    const guards = this.affineFrameGuards(
      node, this.stamp(new IdentifierNode(induction.name), node.location), plan.stepExpression, 64n,
    );
    const finalReturn = this.stamp(new ReturnNode([
      this.stamp(new IdentifierNode(result.name), node.location),
    ]), node.location);
    node.body = this.stamp(new BlockNode([
      ...guards, terminalRank, result, rank, loop, finalReturn,
    ]), node.location);
  }

  private lowerAffineVoidPostEffectRecursion(
    node: FunctionDefinitionNode, plan: AffineVoidPostEffectRecursion, frame: number,
  ): void {
    const induction = node.parameters[plan.inductionIndex];
    const rankName = `__tail_unwind_rank_${frame}`;
    const effects = plan.effects.map((effect) => this.replaceAffineProgressions(
      cloneNode(effect) as StatementNode, node, plan.parameterProgressions,
      rankName, plan.inductionIndex, plan.stepExpression, true,
    ) as StatementNode);
    this.publishAffinePostEvents(node, plan, rankName, effects);
    const increment = this.stamp(new AssignNode(
      this.stamp(new IdentifierNode(rankName), node.location),
      this.stamp(new BinaryOpNode(
        this.stamp(new IdentifierNode(rankName), node.location), BinaryOperator.PLUS,
        this.stamp(new IntLiteralNode(1n), node.location),
      ), node.location),
    ), node.location);
    const loop = this.stamp(new WhileNode(
      this.stamp(new BinaryOpNode(
        this.stamp(new IdentifierNode(rankName), node.location), BinaryOperator.LE,
        this.stamp(new BinaryOpNode(
          this.stamp(new IdentifierNode(induction.name), node.location), BinaryOperator.DIV,
          cloneNode(plan.stepExpression),
        ), node.location),
      ), node.location),
      this.stamp(new BlockNode([...effects, increment]), node.location),
    ), node.location);
    loop.forLoopUpdateCount = 1;
    const rank = this.stamp(new VariableDefinitionNode(
      induction.type, [], rankName, this.stamp(new IntLiteralNode(1n), node.location),
    ), node.location);
    rank.isLoopVariable = true;
    rank.loopInitialValue = 1n;
    rank.loopStepValue = 1n;
    const guards = this.affineFrameGuards(
      node, this.stamp(new IdentifierNode(induction.name), node.location), plan.stepExpression, 64n,
    );
    node.body = this.stamp(new BlockNode([...guards, rank, loop]), node.location);
  }

  private lowerAffineMappingRecursion(
    node: FunctionDefinitionNode, plan: AffineMappingRecursion, returnNames: readonly string[], frame: number,
  ): void {
    const induction = node.parameters[plan.inductionIndex];
    const rankName = `__tail_rank_${frame}`;
    const transformed = this.replaceAffineInduction(
      cloneNode(node.body!) as BlockNode, induction.name, rankName, plan.stepExpression,
    ) as BlockNode;
    const recursiveReturn = transformed.statements!.pop() as ReturnNode;
    if (!this.isSelfCall(recursiveReturn.expressions[0], node.name)) return;
    const base = transformed.statements![plan.baseIndex] as BranchNode;
    const baseReturn = base.ifBlock.statements![0] as ReturnNode;
    base.ifBlock.statements = [
      ...returnNames.map((name, index) => this.stamp(new AssignNode(
        this.stamp(new IdentifierNode(name), baseReturn.location), baseReturn.expressions[index],
      ), baseReturn.location)),
      this.stamp(new BreakNode(), baseReturn.location),
    ];
    const increment = this.stamp(new AssignNode(
      this.stamp(new IdentifierNode(rankName), node.location),
      this.stamp(new BinaryOpNode(
        this.stamp(new IdentifierNode(rankName), node.location), BinaryOperator.PLUS,
        this.stamp(new IntLiteralNode(1n), node.location),
      ), node.location),
    ), node.location);
    transformed.statements!.push(increment);
    const bound = this.stamp(new BinaryOpNode(
      this.stamp(new BinaryOpNode(
        this.stamp(new IdentifierNode(induction.name), node.location), BinaryOperator.DIV,
        cloneNode(plan.stepExpression),
      ), node.location), BinaryOperator.PLUS,
      this.stamp(new IntLiteralNode(1n), node.location),
    ), node.location);
    const loop = this.stamp(new WhileNode(
      this.stamp(new BinaryOpNode(
        this.stamp(new IdentifierNode(rankName), node.location), BinaryOperator.LT, bound,
      ), node.location), transformed,
    ), node.location);
    loop.forLoopUpdateCount = 1;
    const rank = this.stamp(new VariableDefinitionNode(
      induction.type, [], rankName, this.stamp(new IntLiteralNode(0n), node.location),
    ), node.location);
    rank.isLoopVariable = true;
    rank.loopInitialValue = 0n;
    rank.loopStepValue = 1n;
    const guards = this.affineFrameGuards(
      node, this.stamp(new IdentifierNode(induction.name), node.location), plan.stepExpression, 63n,
    );
    const unnamedResults = node.returnNames.length === 0;
    const results = unnamedResults ? returnNames.map((name, index) => this.stamp(
      new VariableDefinitionNode(node.returnTypes[index], [], name), node.location,
    )) : [];
    const finalReturn = unnamedResults ? this.stamp(new ReturnNode(returnNames.map((name) =>
      this.stamp(new IdentifierNode(name), node.location))), node.location) : undefined;
    node.body = this.stamp(new BlockNode([
      ...results, ...guards, rank, loop, ...(finalReturn ? [finalReturn] : []),
    ]), node.location);
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    const voidFunction = node.returnTypes.length === 0;
    const namedResults = node.returnTypes.length > 0 && node.returnNames.length === node.returnTypes.length;
    const unnamedResults = node.returnTypes.length > 0 && node.returnNames.length === 0;
    if (!node.body || (!voidFunction && !namedResults && !unnamedResults)) return node;
    const frame = this.counter;
    // Kernel admission runs before NamedReturnTransformation. Give unnamed results private locals so base-case
    // returns and the final loop tuple have the same ordinary control-flow representation as named results,
    // without changing the source ABI's intentionally empty output names.
    const returnNames = unnamedResults
      ? node.returnTypes.map((_type, index) => `__tail_result_${frame}_${index}`)
      : node.returnNames;
    const selfNames = new Set([node.name]);
    const sourceSelfCalls = this.countSelfCalls(node.body, node.name);
    if (sourceSelfCalls > 0) this.normalizeRightShortCircuitReturns(node.body, selfNames);
    const selfCalls = this.countSelfCalls(node.body, node.name);
    const affineVoidMixedEvent = selfCalls === 1 ? this.affineVoidMixedEventRecursion(node) : undefined;
    if (affineVoidMixedEvent) {
      this.counter += 1;
      this.lowerAffineVoidMixedEventRecursion(node, affineVoidMixedEvent, frame);
      return node;
    }
    const affineVoidPostEffect = selfCalls === 1 ? this.affineVoidPostEffectRecursion(node) : undefined;
    if (affineVoidPostEffect) {
      this.counter += 1;
      this.lowerAffineVoidPostEffectRecursion(node, affineVoidPostEffect, frame);
      return node;
    }
    const affinePostEffect = selfCalls === 1 ? this.affinePostEffectRecursion(node) : undefined;
    if (affinePostEffect) {
      this.counter += 1;
      this.lowerAffinePostEffectRecursion(node, affinePostEffect, frame);
      return node;
    }
    const affineMapping = selfCalls === 1 ? this.affineMappingRecursion(node) : undefined;
    if (affineMapping) {
      this.counter += 1;
      this.lowerAffineMappingRecursion(node, affineMapping, returnNames, frame);
      return node;
    }
    const affineEvent = selfCalls === 1 ? this.affineEventRecursion(node) : undefined;
    // A varying entry cannot use the invariant-entry cache, and the ordinary repeat loop publishes no key stream.
    // Leave every shape outside the exact rank proof above recursive so kernel admission fails closed.
    if (this.hasVaryingRecursiveMappingWrite(node) || this.hasVaryingRecursiveMappingRead(node)) {
      node.unloweredVaryingRecursiveMappingRead = this.hasVaryingRecursiveMappingRead(node);
      return node;
    }
    const fold = selfCalls > 0 ? this.recursiveFoldShape([node], selfNames) : undefined;
    if (selfCalls === 0 || !this.selfCallsHaveArity(node.body, node.name, node.parameters.length)
      || !this.baseReturnsHaveArity(node.body, node.name, node.returnTypes.length, namedResults)
      || this.hasBaseReturnInSourceLoop(node.body, node.name)
      || !this.validTailBlock(node.body, node.name, returnNames, fold)) return node;
    this.counter += 1;

    const iterationName = `__tail_iteration_${frame}`;
    const repeatName = `__tail_repeat_${frame}`;
    const continuationName = fold ? `__tail_continuations_${frame}` : undefined;
    const continuationTagName = fold ? `__tail_continuation_tags_${frame}` : undefined;
    const transformed = this.transformBlock(
      node.body, node, returnNames, iterationName, repeatName, fold, continuationName, continuationTagName,
    );
    const clearRepeat = this.stamp(new AssignNode(
      this.stamp(new IdentifierNode(repeatName), node.location),
      this.stamp(new BoolLiteralNode(false), node.location),
    ), node.location);
    const eventFrameGuards = affineEvent
      ? this.publishAffineEventRecursion(node, affineEvent, iterationName) : undefined;
    transformed.statements = [clearRepeat, ...(transformed.statements ?? [])];
    const loop = this.stamp(new WhileNode(
      this.stamp(new IdentifierNode(repeatName), node.location), transformed,
    ), node.location);
    const iteration = this.stamp(new VariableDefinitionNode(
      PrimitiveType.BIGINT, [], iterationName, this.stamp(new IntLiteralNode(0n), node.location),
    ), node.location);
    const repeat = this.stamp(new VariableDefinitionNode(
      PrimitiveType.BOOL, [], repeatName, this.stamp(new BoolLiteralNode(true), node.location),
    ), node.location);
    const results = unnamedResults
      ? returnNames.map((name, index) => this.stamp(
        new VariableDefinitionNode(node.returnTypes[index], [], name), node.location,
      ))
      : [];
    const continuation = fold ? this.stamp(new VariableDefinitionNode(
      new ArrayType(node.returnTypes[0]), [], continuationName!, this.stamp(new NewArrayNode(
        node.returnTypes[0], this.stamp(new IntLiteralNode(0n), node.location),
      ), node.location),
    ), node.location) : undefined;
    const continuationTags = fold ? this.stamp(new VariableDefinitionNode(
      new ArrayType(PrimitiveType.BIGINT), [], continuationTagName!, this.stamp(new NewArrayNode(
        PrimitiveType.BIGINT, this.stamp(new IntLiteralNode(0n), node.location),
      ), node.location),
    ), node.location) : undefined;
    const unwind = fold ? this.foldUnwind(
      node, returnNames[0], continuationName!, continuationTagName!, fold,
    ) : undefined;
    const finalReturn = unnamedResults
      ? this.stamp(new ReturnNode(returnNames.map((name) =>
        this.stamp(new IdentifierNode(name), node.location))), node.location)
      : undefined;
    node.body = this.stamp(new BlockNode([
      ...results, ...(continuation ? [continuation, continuationTags!] : []),
      ...(affineEvent?.parameterProgressions ? eventFrameGuards ?? [] : []), iteration, repeat, loop,
      ...(!affineEvent?.parameterProgressions ? eventFrameGuards ?? [] : []), ...(unwind ? [unwind] : []),
      ...(finalReturn ? [finalReturn] : []),
    ]), node.location);
    return node;
  }

  private isSelfCall(node: Node | undefined, name: string): node is FunctionCallNode {
    return node instanceof FunctionCallNode && node.identifier.name === name;
  }

  private countSelfCalls(node: Node, name: string): number {
    let count = this.isSelfCall(node, name) ? 1 : 0;
    for (const [key, child] of Object.entries(node)) {
      if (['resolvedFunction', 'definition', 'symbolTable', 'location'].includes(key)) continue;
      if (child instanceof Node) count += this.countSelfCalls(child, name);
      else if (Array.isArray(child)) {
        for (const item of child) if (item instanceof Node) count += this.countSelfCalls(item, name);
      }
    }
    return count;
  }

  private selfCallsHaveArity(node: Node, name: string, arity: number): boolean {
    if (this.isSelfCall(node, name) && node.parameters.length !== arity) return false;
    return Object.entries(node).every(([key, child]) => {
      if (['resolvedFunction', 'definition', 'symbolTable', 'location'].includes(key)) return true;
      if (child instanceof Node) return this.selfCallsHaveArity(child, name, arity);
      return !Array.isArray(child) || child.every((item) =>
        !(item instanceof Node) || this.selfCallsHaveArity(item, name, arity));
    });
  }

  private baseReturnsHaveArity(
    node: Node, name: string, arity: number, allowBareResultReturn: boolean,
  ): boolean {
    if (node instanceof ReturnNode
      && !(node.expressions.length === 1 && this.isSelfCall(node.expressions[0], name))) {
      return node.expressions.length === arity
        || (arity > 0 && allowBareResultReturn && node.expressions.length === 0);
    }
    return Object.entries(node).every(([key, child]) => {
      if (['resolvedFunction', 'definition', 'symbolTable', 'location'].includes(key)) return true;
      if (child instanceof Node) return this.baseReturnsHaveArity(child, name, arity, allowBareResultReturn);
      return !Array.isArray(child) || child.every((item) => !(item instanceof Node)
        || this.baseReturnsHaveArity(item, name, arity, allowBareResultReturn));
    });
  }

  private hasBaseReturnInSourceLoop(node: Node, name: string, insideLoop = false): boolean {
    if (insideLoop && node instanceof ReturnNode
      && !(node.expressions.length === 1 && this.isSelfCall(node.expressions[0], name))) return true;
    const childInsideLoop = insideLoop || node instanceof WhileNode || node instanceof DoWhileNode;
    return Object.entries(node).some(([key, child]) => {
      if (['resolvedFunction', 'definition', 'symbolTable', 'location'].includes(key)) return false;
      if (child instanceof Node) return this.hasBaseReturnInSourceLoop(child, name, childInsideLoop);
      return Array.isArray(child) && child.some((item) =>
        item instanceof Node && this.hasBaseReturnInSourceLoop(item, name, childInsideLoop));
    });
  }

  private validTailBlock(
    block: BlockNode, name: string, returnNames: readonly string[], fold?: RecursiveFoldShape,
  ): boolean {
    const statements = block.statements ?? [];
    for (let index = 0; index < statements.length; index += 1) {
      const statement = statements[index];
      const calls = this.countSelfCalls(statement, name);
      if (calls === 0) continue;
      if (index !== statements.length - 1
        || !this.validTailStatement(statement, name, returnNames, fold)) return false;
    }
    return true;
  }

  private validTailStatement(
    statement: StatementNode, name: string, returnNames: readonly string[], fold?: RecursiveFoldShape,
  ): boolean {
    if (statement instanceof AssignNode) {
      return returnNames.length === 1 && statement.identifier.name === returnNames[0]
        && this.isSelfCall(statement.expression, name);
    }
    if (statement instanceof ReturnNode) {
      return returnNames.length > 0 && statement.expressions.length === 1
        && (this.isSelfCall(statement.expressions[0], name)
          || this.foldedRecursiveReturn(statement.expressions[0], new Set([name]), fold) !== undefined);
    }
    if (statement instanceof FunctionCallStatementNode) {
      return returnNames.length === 0 && this.isSelfCall(statement.call, name);
    }
    if (statement instanceof BranchNode) {
      if (this.countSelfCalls(statement.condition, name) > 0) return false;
      return this.validTailBlock(statement.ifBlock, name, returnNames, fold)
        && (!statement.elseBlock || this.validTailBlock(statement.elseBlock, name, returnNames, fold));
    }
    if (statement instanceof BlockNode) return this.validTailBlock(statement, name, returnNames, fold);
    // A recursive call nested in an existing loop has different break/continue ownership and is not lowered.
    if (statement instanceof WhileNode || statement instanceof DoWhileNode) return false;
    return false;
  }

  private transformBlock(
    block: BlockNode, fn: FunctionDefinitionNode, returnNames: readonly string[],
    iterationName: string, repeatName: string, fold?: RecursiveFoldShape,
    continuationName?: string, continuationTagName?: string,
  ): BlockNode {
    block.statements = (block.statements ?? []).flatMap((statement) =>
      this.transformStatement(
        statement, fn, returnNames, iterationName, repeatName, fold, continuationName, continuationTagName,
      ));
    return block;
  }

  private transformStatement(
    statement: StatementNode, fn: FunctionDefinitionNode, returnNames: readonly string[],
    iterationName: string, repeatName: string, fold?: RecursiveFoldShape,
    continuationName?: string, continuationTagName?: string,
  ): StatementNode[] {
    if (returnNames.length === 1 && statement instanceof AssignNode && statement.identifier.name === returnNames[0]
      && this.isSelfCall(statement.expression, fn.name)) {
      return this.recur(statement.expression, fn, iterationName, repeatName, statement.location);
    }
    if (statement instanceof ReturnNode) {
      const folded = this.foldedRecursiveReturn(statement.expressions[0], new Set([fn.name]), fold);
      if (folded && continuationName && continuationTagName) {
        const pushes = folded.steps.flatMap((step) => [
          this.stamp(new ArrayPushNode(
            continuationName, step.kind === 'binary' && step.deferredOperandKey === undefined ? step.operand
              : this.stamp(new IdentifierNode(returnNames[0]), statement.location),
          ), statement.location),
          this.stamp(new ArrayPushNode(
            continuationTagName, this.stamp(new IntLiteralNode(BigInt(step.variantIndex)), statement.location),
          ), statement.location),
        ]);
        return [...pushes, ...this.recur(
          folded.call, fn, iterationName, repeatName, statement.location,
        )];
      }
      if (statement.expressions.length === 1 && this.isSelfCall(statement.expressions[0], fn.name)) {
        return this.recur(statement.expressions[0], fn, iterationName, repeatName, statement.location);
      }
      const exit = this.stamp(new BreakNode(), statement.location);
      if (returnNames.length === 0 || statement.expressions.length === 0) return [exit];
      const results = returnNames.map((returnName, index) => this.stamp(new AssignNode(
        this.stamp(new IdentifierNode(returnName), statement.location), statement.expressions[index],
      ), statement.location));
      return [...results, exit];
    }
    if (returnNames.length === 0 && statement instanceof FunctionCallStatementNode
      && this.isSelfCall(statement.call, fn.name)) {
      return this.recur(statement.call, fn, iterationName, repeatName, statement.location);
    }
    if (statement instanceof BranchNode) {
      statement.ifBlock = this.transformBlock(
        statement.ifBlock, fn, returnNames, iterationName, repeatName, fold,
        continuationName, continuationTagName,
      );
      if (statement.elseBlock) {
        statement.elseBlock = this.transformBlock(
          statement.elseBlock, fn, returnNames, iterationName, repeatName, fold,
          continuationName, continuationTagName,
        );
      }
    } else if (statement instanceof BlockNode) {
      return [this.transformBlock(
        statement, fn, returnNames, iterationName, repeatName, fold, continuationName, continuationTagName,
      )];
    }
    return [statement];
  }

  private recur(
    call: FunctionCallNode, fn: FunctionDefinitionNode, iterationName: string,
    repeatName: string, location: Node['location'],
  ): StatementNode[] {
    const frame = this.counter++;
    const changed = fn.parameters.flatMap((parameter, index) => {
      const argument = call.parameters[index];
      if (argument instanceof IdentifierNode && argument.name === parameter.name) return [];
      const name = `__tail_${frame}_${parameter.name}`;
      const temp = this.stamp(new VariableDefinitionNode(parameter.type, [], name, argument), location);
      const assignment = this.stamp(new AssignNode(
        this.stamp(new IdentifierNode(parameter.name), location),
        this.stamp(new IdentifierNode(name), location),
      ), location);
      return [{ temp, assignment }];
    });
    const nextIteration = this.stamp(new BinaryOpNode(
      this.stamp(new IdentifierNode(iterationName), location), BinaryOperator.PLUS,
      this.stamp(new IntLiteralNode(1n), location),
    ), location);
    const increment = this.stamp(new AssignNode(
      this.stamp(new IdentifierNode(iterationName), location), nextIteration,
    ), location);
    const repeat = this.stamp(new AssignNode(
      this.stamp(new IdentifierNode(repeatName), location), this.stamp(new BoolLiteralNode(true), location),
    ), location);
    return [
      ...changed.map(({ temp }) => temp), ...changed.map(({ assignment }) => assignment), increment, repeat,
    ];
  }

  private stamp<T extends Node>(node: T, location: Node['location']): T {
    node.location = location;
    return node;
  }
}
