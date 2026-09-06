import {
  ArrayAccessNode, ArrayPopNode, ArrayPushNode, AssignNode, BinaryOpNode, BlockNode, BoolLiteralNode,
  BranchNode, BreakNode, ContractNode,
  DoWhileNode, FunctionCallNode, FunctionCallStatementNode, FunctionDefinitionNode, IdentifierNode,
  ExpressionNode, NewArrayNode, Node, ReturnNode, SourceFileNode, StatementNode, UnaryOpNode,
  StateAccessNode, StateAssignNode, VariableDefinitionNode, WhileNode, IntLiteralNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';
import { BinaryOperator, UnaryOperator } from '../ast/Operator.js';
import { ArrayType, BytesType, PrimitiveType, StructType } from '@solidcash/utils';

type RecursiveFoldVariant =
  | { kind: 'binary'; operator: BinaryOperator; recursiveOnLeft: boolean }
  | { kind: 'unary'; operator: UnaryOperator };

type RecursiveFoldStep =
  | (Extract<RecursiveFoldVariant, { kind: 'binary' }> & { operand: ExpressionNode })
  | Extract<RecursiveFoldVariant, { kind: 'unary' }>;

interface RecursiveFoldShape { variants: RecursiveFoldVariant[]; }

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
  private fixedScalarStateNames = new Set<string>();

  visitSourceFile(node: SourceFileNode): Node {
    this.lowerMutualGroups(node.freeFunctions);
    node.freeFunctions = node.freeFunctions.map((fn) => this.visit(fn) as FunctionDefinitionNode);
    node.contract = this.visit(node.contract) as ContractNode;
    node.importedContracts = node.importedContracts.map((contract) => this.visit(contract) as ContractNode);
    return node;
  }

  visitContract(node: ContractNode): Node {
    const parentStateNames = this.fixedScalarStateNames;
    this.fixedScalarStateNames = new Set(node.stateVariables.filter((state) =>
      !state.isDynamic && state.type !== PrimitiveType.STRING
      && !(state.type instanceof ArrayType) && !(state.type instanceof StructType)
      && !(state.type instanceof BytesType && state.type.bound === undefined))
      .map((state) => state.name));
    this.lowerMutualGroups(node.functions);
    node.functions = node.functions.map((fn) => this.visit(fn) as FunctionDefinitionNode);
    if (node.constructorDef) node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    if (node.fallbackDef) node.fallbackDef = this.visit(node.fallbackDef) as FunctionDefinitionNode;
    if (node.receiveDef) node.receiveDef = this.visit(node.receiveDef) as FunctionDefinitionNode;
    this.fixedScalarStateNames = parentStateNames;
    return node;
  }

  /**
   * Lower a strongly-connected group of homogeneous mutual tail calls to a small program-counter loop. Each
   * public/internal entry keeps its own ABI and starts the shared state machine at its corresponding body. This
   * covers cycles of any length while deliberately excluding overloads, heterogeneous frames, and calls nested in
   * source loops. A single-result binary fold may use the continuation stack implemented below. Fixed-width
   * scalar writes are supported only where source evaluation captures the continuation before descent; other
   * non-tail work still requires a more general continuation representation.
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
    const variants: RecursiveFoldShape['variants'] = [];
    let sawFold = false;
    const scalarStateWrites = new Set<string>();
    const continuationSteps: RecursiveFoldStep[] = [];
    let valid = true;
    const persistentEffects = new Set([
      'DeleteStateNode', 'StateArrayPushNode', 'StateArrayPopNode',
      'StateArrayAssignNode', 'StateArrayDeleteNode', 'MappingAssignNode', 'MappingFieldAssignNode',
      'MappingDeleteNode', 'EmitStatementNode', 'ExternalFunctionCallNode', 'LowLevelCallNode',
      'LowLevelCallStatementNode', 'TransferStatementNode', 'AddressTransferStatementNode',
      'AddressSendExpressionNode', 'TokenContainerMethodStatementNode', 'SelfdestructStatementNode',
      'MethodCallNode', 'MethodCallStatementNode', 'IndirectCallNode', 'InstantiationNode',
      'AssignmentExpressionNode', 'AssemblyStatementNode',
    ]);
    group.forEach((fn) => {
      this.walkNodes(fn.body!, (candidate) => {
        if (candidate instanceof StateAssignNode) {
          if (!this.fixedScalarStateNames.has(candidate.name)) valid = false;
          else scalarStateWrites.add(candidate.name);
        } else if (persistentEffects.has(candidate.constructor.name)) valid = false;
        if (candidate instanceof FunctionCallNode && !names.has(candidate.identifier.name)) valid = false;
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
        for (const step of extracted.steps) {
          if (!variants.some((variant) => variant.kind === step.kind && variant.operator === step.operator
            && (variant.kind === 'unary' || (step.kind === 'binary'
              && variant.recursiveOnLeft === step.recursiveOnLeft)))) {
            variants.push(step.kind === 'binary'
              ? { kind: 'binary', operator: step.operator, recursiveOnLeft: step.recursiveOnLeft }
              : { kind: 'unary', operator: step.operator });
          }
          continuationSteps.push(step);
        }
        sawFold = true;
      });
    });
    // `recur(...) OP operand` reaches operand after the deeper call in source. Capturing it before descent remains
    // equivalent unless deeper frames can mutate scalar state read by that operand.
    if (scalarStateWrites.size > 0) {
      continuationSteps.filter((step): step is Extract<RecursiveFoldStep, { kind: 'binary' }> =>
        step.kind === 'binary' && step.recursiveOnLeft).forEach((step) =>
        this.walkNodes(step.operand, (candidate) => {
          if ((candidate instanceof StateAccessNode || candidate instanceof IdentifierNode)
            && scalarStateWrites.has(candidate.name)) valid = false;
        }));
    }
    return valid && sawFold ? { variants } : undefined;
  }

  private foldedRecursiveReturn(
    expression: Node | undefined, names: ReadonlySet<string>, fold?: RecursiveFoldShape,
  ): { call: FunctionCallNode; steps: (RecursiveFoldStep & { variantIndex: number })[] } | undefined {
    if (!fold || !expression) return undefined;
    const extracted = this.extractRecursiveFold(expression, names);
    if (!extracted || extracted.steps.length === 0) return undefined;
    const steps = extracted.steps.map((step) => ({
      ...step,
      variantIndex: fold.variants.findIndex((variant) => variant.kind === step.kind
        && variant.operator === step.operator && (variant.kind === 'unary'
          || (step.kind === 'binary' && variant.recursiveOnLeft === step.recursiveOnLeft))),
    }));
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
      const combined = variant.kind === 'unary'
        ? this.stamp(new UnaryOpNode(variant.operator, result()), root.location)
        : this.stamp(new BinaryOpNode(
          variant.recursiveOnLeft ? result() : cloneNode(operand) as ExpressionNode,
          variant.operator,
          variant.recursiveOnLeft ? cloneNode(operand) as ExpressionNode : result(),
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
              continuationName, step.kind === 'binary' ? step.operand
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
    const temps = root.parameters.map((parameter, index) => this.stamp(new VariableDefinitionNode(
      parameter.type, [], `__tail_${frame}_${parameter.name}`, call.parameters[index],
    ), location));
    const assignments = root.parameters.map((parameter, index) => this.stamp(new AssignNode(
      this.stamp(new IdentifierNode(parameter.name), location),
      this.stamp(new IdentifierNode(temps[index].name), location),
    ), location));
    const select = this.stamp(new AssignNode(
      this.stamp(new IdentifierNode(modeName), location),
      this.stamp(new IntLiteralNode(BigInt(target.index)), location),
    ), location);
    const repeat = this.stamp(new AssignNode(
      this.stamp(new IdentifierNode(repeatName), location), this.stamp(new BoolLiteralNode(true), location),
    ), location);
    return [...temps, ...assignments, select, repeat];
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
    const selfCalls = this.countSelfCalls(node.body, node.name);
    const selfNames = new Set([node.name]);
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
      ...results, ...(continuation ? [continuation, continuationTags!] : []), iteration, repeat, loop,
      ...(unwind ? [unwind] : []), ...(finalReturn ? [finalReturn] : []),
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
            continuationName, step.kind === 'binary' ? step.operand
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
    const temps = fn.parameters.map((parameter, index) => {
      const name = `__tail_${frame}_${parameter.name}`;
      return this.stamp(new VariableDefinitionNode(parameter.type, [], name, call.parameters[index]), location);
    });
    const assignments = fn.parameters.map((parameter, index) => this.stamp(new AssignNode(
      this.stamp(new IdentifierNode(parameter.name), location),
      this.stamp(new IdentifierNode(temps[index].name), location),
    ), location));
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
    return [...temps, ...assignments, increment, repeat];
  }

  private stamp<T extends Node>(node: T, location: Node['location']): T {
    node.location = location;
    return node;
  }
}
