import {
  ArrayAssignNode, ArrayDeleteNode, ArrayPopNode, ArrayPushNode, AssemblyStatementNode, AssignmentExpressionNode,
  AssignNode, BinaryOpNode, BlockNode, BranchNode, BreakNode, ContinueNode, ContractNode, DoWhileNode,
  ExpressionStatementNode, FunctionCallNode, FunctionDefinitionNode, IdentifierNode, InstantiationNode,
  MappingAccessNode, MappingAssignNode, MappingDeleteNode, MappingFieldAssignNode, ModifierDefinitionNode, Node,
  ParameterNode, PlaceholderStatementNode, ReturnNode, RevertNode, StateAccessNode, StateArrayAssignNode,
  StateArrayDeleteNode, StateArrayPopNode, StateArrayPushNode, StateAssignNode, StatementNode, SwitchNode,
  TernaryOpNode, TryCatchNode, TupleAssignmentNode, UncheckedNode, VariableDefinitionNode, WhileNode,
} from '../ast/AST.js';
import {
  YulAssignmentNode, YulBlockNode, YulBreakNode, YulContinueNode, YulExpressionNode, YulExpressionStatementNode,
  YulForLoopNode, YulFunctionCallNode, YulIfNode, YulLeaveNode, YulNode, YulPathNode, YulSwitchNode,
  YulVariableDeclarationNode,
} from '../ast/YulAST.js';
import { Modifier } from '../ast/Globals.js';
import { BinaryOperator } from '../ast/Operator.js';
import { UninitializedPointerError } from '../Errors.js';

/** Pointer variables that may still be unassigned, plus reads made while one possibly was. */
interface FlowState {
  unassigned: Set<string>;
  accesses: Map<Node, string>;
}

type Flow = FlowState | null;

interface Exit {
  state: FlowState;
  node: Node;
}

interface LoopFrame {
  breaks: FlowState[];
  continues: FlowState[];
}

interface Pointer {
  label: string;
  location: string;
  isReturn: boolean;
}

export interface PointerFlowContext {
  modifier(name: string): ModifierDefinitionNode | undefined;
  functions(name: string): FunctionDefinitionNode[];
  isStateName(name: string): boolean;
}

const SKIPPED_KEYS = new Set([
  'location', 'definition', 'resolvedFunction', 'functionReference', 'symbolTable', 'referencedContract',
  'stateVariable', 'collection', 'errorDefinition',
]);
const TERMINATING_YUL = new Set(['revert', 'return', 'stop', 'invalid', 'selfdestruct']);

function pointerLocation(modifiers: readonly string[]): string | undefined {
  const location = modifiers.find((m) => m === Modifier.MEMORY || m === Modifier.CALLDATA || m === Modifier.STORAGE);
  return location === Modifier.STORAGE || location === Modifier.CALLDATA ? location : undefined;
}

function copy(state: FlowState): FlowState {
  return { unassigned: new Set(state.unassigned), accesses: new Map(state.accesses) };
}

function merge(...flows: Flow[]): Flow {
  const live = flows.filter((flow): flow is FlowState => flow !== null);
  if (live.length === 0) return null;
  return {
    unassigned: new Set(live.flatMap((flow) => [...flow.unassigned])),
    accesses: new Map(live.flatMap((flow) => [...flow.accesses])),
  };
}

/** Source-level child nodes, excluding back-references and nested declarations. */
function childNodes(node: Node): Node[] {
  const children: Node[] = [];
  const callee = node instanceof FunctionCallNode || node instanceof InstantiationNode;
  for (const [key, value] of Object.entries(node)) {
    if (!SKIPPED_KEYS.has(key) && !(callee && key === 'identifier')) {
      if (value instanceof Node) children.push(value);
      else if (Array.isArray(value)) children.push(...value.filter((item): item is Node => item instanceof Node));
    }
  }
  return children.filter((child) => !(child instanceof ContractNode) && !(child instanceof FunctionDefinitionNode)
    && !(child instanceof ModifierDefinitionNode));
}

function forEachNode(node: Node, visit: (node: Node) => void): void {
  visit(node);
  for (const child of childNodes(node)) forEachNode(child, visit);
}

/**
 * Solidity's control-flow check for storage and calldata pointers (solc TypeError 3464): a pointer return variable
 * must be assigned on every path that returns normally, and no pointer may be read on a normally returning path
 * before it is assigned. Reverting paths are exempt, as in solc.
 */
export default class PointerAssignmentAnalysis {
  private reverting = new Map<FunctionDefinitionNode, boolean>();

  constructor(private context: PointerFlowContext) {}

  check(fn: FunctionDefinitionNode): void {
    if (fn.isAbstract) return;
    const modifiers = this.resolveModifiers(fn);
    if (!modifiers) return;
    const pointers = this.pointers(fn, modifiers);
    if (pointers.size === 0) return;
    const exits = new PointerFlow(this, fn, modifiers, pointers).run();
    for (const exit of exits) {
      const [access] = exit.state.accesses;
      if (access) throw this.error(access[0], pointers.get(access[1])!, 'accessed');
    }
    for (const exit of exits) {
      const unassigned = [...exit.state.unassigned].find((name) => pointers.get(name)?.isReturn);
      if (unassigned !== undefined) throw this.error(exit.node, pointers.get(unassigned)!, 'returned');
    }
  }

  /** A statement-level call to a function that reverts on every path ends the caller's path, as in solc. */
  callAlwaysReverts(call: FunctionCallNode): boolean {
    const candidates = this.context.functions(call.identifier.name);
    return candidates.length > 0 && candidates.every((fn) => this.alwaysReverts(fn));
  }

  private alwaysReverts(fn: FunctionDefinitionNode): boolean {
    const known = this.reverting.get(fn);
    if (known !== undefined) return known;
    this.reverting.set(fn, false);
    const modifiers = fn.isAbstract ? undefined : this.resolveModifiers(fn);
    const result = modifiers !== undefined && new PointerFlow(this, fn, modifiers, new Map()).run().length === 0;
    this.reverting.set(fn, result);
    return result;
  }

  /** Implemented modifiers in invocation order (undefined = unimplemented); undefined if one is unknown. */
  private resolveModifiers(fn: FunctionDefinitionNode): Array<ModifierDefinitionNode | undefined> | undefined {
    const resolved: Array<ModifierDefinitionNode | undefined> = [];
    for (const invocation of fn.customModifiers) {
      const definition = this.context.modifier(invocation.name);
      if (!definition) return undefined;
      resolved.push(definition.isAbstract ? undefined : definition);
    }
    return resolved;
  }

  private pointers(fn: FunctionDefinitionNode, modifiers: Array<ModifierDefinitionNode | undefined>):
  Map<string, Pointer> {
    const pointers = new Map<string, Pointer>();
    // A fallback/receive with a pointer return is an invalid signature, reported by type checking.
    if (!fn.isFallback && !fn.isReceive) {
      fn.returnTypes.forEach((_type, index) => {
        const location = pointerLocation(fn.returnModifiers[index] ?? []);
        if (!location) return;
        const name = fn.returnNames[index];
        const label = name !== undefined && !name.startsWith('__ret_') ? `Variable '${name}'` : 'Unnamed return variable';
        pointers.set(name ?? `#return${index}`, { label, location, isReturn: true });
      });
    }
    // Leading declarations of the named returns synthesized by NamedReturnTransformation (library-only path).
    const synthetic = new Set((fn.body.statements ?? []).slice(0, fn.returnNames.length).filter((statement, index) =>
      statement instanceof VariableDefinitionNode && statement.name === fn.returnNames[index] && !statement.expression
      && statement.modifier.length === 0 && statement.allowUnused));
    const declarations = new Map<string, number>();
    const declare = (name: string): void => { declarations.set(name, (declarations.get(name) ?? 0) + 1); };
    const locals = new Map<string, string>();
    const bodies: Node[] = [fn.body, ...modifiers.flatMap((modifier) => modifier?.statements ?? [])];
    for (const modifier of modifiers) modifier?.parameters.forEach((parameter) => declare(parameter.name));
    for (const body of bodies) {
      forEachNode(body, (node) => {
        if (node instanceof VariableDefinitionNode && !synthetic.has(node)) {
          declare(node.name);
          const location = pointerLocation(node.modifier);
          if (location && !node.expression) locals.set(node.name, location);
        } else if (node instanceof ParameterNode) {
          declare(node.name);
        } else if (node instanceof TupleAssignmentNode) {
          node.elements.forEach((element) => { if (element.type && element.name) declare(element.name); });
        }
      });
    }
    for (const [name, location] of locals) {
      if (!pointers.has(name) && declarations.get(name) === 1) {
        pointers.set(name, { label: `Variable '${name}'`, location, isReturn: false });
      }
    }
    // Shadowed or reused names are not tracked: a by-name analysis could confuse the two variables.
    for (const name of [...pointers.keys()]) {
      const pointer = pointers.get(name)!;
      if (this.context.isStateName(name) || (pointer.isReturn && declarations.has(name))) pointers.delete(name);
    }
    return pointers;
  }

  private error(node: Node, pointer: Pointer, use: 'accessed' | 'returned'): UninitializedPointerError {
    return new UninitializedPointerError(node, pointer.label, pointer.location, use);
  }
}

/** One walk over a function, its modifiers inlined at their placeholders, collecting the normally returning paths. */
class PointerFlow {
  private loops: LoopFrame[] = [];
  private yulLoops: LoopFrame[] = [];
  private returnTargets: Exit[][] = [];
  private placeholders: Array<(state: FlowState) => Flow> = [];
  private assembly?: AssemblyStatementNode;

  constructor(
    private analysis: PointerAssignmentAnalysis,
    private fn: FunctionDefinitionNode,
    private modifiers: Array<ModifierDefinitionNode | undefined>,
    private pointers: Map<string, Pointer>,
  ) {}

  run(): Exit[] {
    const returns = [...this.pointers].filter(([, pointer]) => pointer.isReturn).map(([name]) => name);
    const exits: Exit[] = [];
    this.chain(0, { unassigned: new Set(returns), accesses: new Map() }, exits);
    return exits;
  }

  // Modifier `index` (or the body), whose normal completions flow to `target`.
  private chain(index: number, state: FlowState, target: Exit[]): void {
    if (index === this.modifiers.length) {
      const { loops, placeholders } = this;
      this.loops = [];
      this.placeholders = [];
      this.returnTargets.push(target);
      const end = this.statement(this.fn.body, state);
      this.returnTargets.pop();
      this.loops = loops;
      this.placeholders = placeholders;
      if (end) target.push({ state: end, node: this.fn });
      return;
    }
    let entry = state;
    for (const argument of this.fn.customModifiers[index].args) entry = this.expression(argument, entry);
    const definition = this.modifiers[index];
    if (!definition) {
      this.chain(index + 1, entry, target);
      return;
    }
    this.placeholders.push((at: FlowState): Flow => {
      const inner: Exit[] = [];
      const { loops } = this;
      this.loops = [];
      this.chain(index + 1, at, inner);
      this.loops = loops;
      return merge(...inner.map((exit) => exit.state));
    });
    this.returnTargets.push(target);
    const end = this.statements(definition.statements, entry);
    this.returnTargets.pop();
    this.placeholders.pop();
    if (end) target.push({ state: end, node: this.fn });
  }

  private statements(statements: readonly Node[], state: FlowState): Flow {
    let flow: Flow = state;
    for (const statement of statements) {
      if (!flow) return null;
      flow = this.statement(statement, flow);
    }
    return flow;
  }

  private statement(node: Node, state: FlowState): Flow {
    if (node instanceof BlockNode) return this.statements(node.statements ?? [], state);
    if (node instanceof UncheckedNode) return this.statement(node.block, state);
    if (node instanceof VariableDefinitionNode) return this.declaration(node, state);
    if (node instanceof AssignNode) return this.assignment(node, state);
    if (node instanceof TupleAssignmentNode) return this.tupleAssignment(node, state);
    if (node instanceof ReturnNode) return this.returnStatement(node, state);
    if (node instanceof RevertNode) {
      this.expressionChildren(node, state);
      return null;
    }
    if (node instanceof BranchNode) {
      const condition = this.expression(node.condition, state);
      const taken = this.statement(node.ifBlock, copy(condition));
      return merge(taken, node.elseBlock ? this.statement(node.elseBlock, copy(condition)) : condition);
    }
    if (node instanceof WhileNode) return this.whileLoop(node, state);
    if (node instanceof DoWhileNode) return this.doWhileLoop(node, state);
    if (node instanceof BreakNode) return this.jump(this.loops, true, state);
    if (node instanceof ContinueNode) return this.jump(this.loops, false, state);
    if (node instanceof TryCatchNode) {
      const call = this.expression(node.expression, state);
      const clauses = node.catchClauses.map((clause) => this.statement(clause.block, copy(call)));
      return merge(this.statement(node.tryBlock, copy(call)), ...clauses);
    }
    if (node instanceof SwitchNode) {
      const head = this.expression(node.expression, state);
      const arms = node.cases.map((arm) => this.statement(arm.body, copy(head)));
      return merge(...arms, node.defaultCase ? this.statement(node.defaultCase, copy(head)) : head);
    }
    if (node instanceof AssemblyStatementNode) return this.assemblyStatement(node, state);
    if (node instanceof PlaceholderStatementNode) {
      const placeholder = this.placeholders[this.placeholders.length - 1];
      return placeholder ? placeholder(state) : state;
    }
    if (node instanceof ExpressionStatementNode) {
      const after = this.expression(node.expression, state);
      return node.expression instanceof FunctionCallNode && this.analysis.callAlwaysReverts(node.expression)
        ? null : after;
    }
    return this.opaqueStatement(node, state);
  }

  private declaration(node: VariableDefinitionNode, state: FlowState): FlowState {
    const after = node.expression ? this.expression(node.expression, state) : state;
    const pointer = this.pointers.get(node.name);
    if (pointer && !pointer.isReturn) {
      if (node.expression) after.unassigned.delete(node.name);
      else after.unassigned.add(node.name);
    }
    return after;
  }

  // solc records an assignment's left side before its right, so `b = b` binds `b` before reading it (accepted).
  private assignment(node: AssignNode, state: FlowState): FlowState {
    const target = node.identifier.name;
    const root = this.rootOf(target);
    // A field/element write through the pointer reads it; only a whole-variable assignment binds it.
    const binds = root !== undefined && !node.isReferenceDataWrite && root === target;
    if (binds) state.unassigned.delete(root);
    const after = this.expression(node.expression, state);
    if (root !== undefined && !binds) this.use(target, node.identifier, after);
    return after;
  }

  private tupleAssignment(node: TupleAssignmentNode, state: FlowState): FlowState {
    for (const element of node.elements) {
      const root = element.name && !element.skip ? this.rootOf(element.name) : undefined;
      if (root !== undefined && root === element.name) state.unassigned.delete(root);
      else if (root !== undefined) this.use(element.name!, node, state);
    }
    let after = state;
    for (const value of node.tupleExpressions ?? [node.tuple]) after = this.expression(value, after);
    return after;
  }

  private returnStatement(node: ReturnNode, state: FlowState): Flow {
    let after = state;
    for (const value of node.expressions) after = this.expression(value, after);
    if (node.isYulReturn) return null;
    if (node.expressions.length > 0) {
      for (const [name, pointer] of this.pointers) if (pointer.isReturn) after.unassigned.delete(name);
    }
    this.returnTargets[this.returnTargets.length - 1]?.push({ state: after, node });
    return null;
  }

  private whileLoop(node: WhileNode, state: FlowState): Flow {
    const entry = this.expression(node.condition, state);
    const statements = node.block.statements ?? [];
    const split = Math.max(0, statements.length - node.forLoopUpdateCount);
    const frame: LoopFrame = { breaks: [], continues: [] };
    this.loops.push(frame);
    const bodyEnd = this.statements(statements.slice(0, split), copy(entry));
    const beforeUpdate = merge(bodyEnd, ...frame.continues);
    const updated = beforeUpdate ? this.statements(statements.slice(split), beforeUpdate) : null;
    this.loops.pop();
    // The body may run zero times; the loop exits only through its condition or a break.
    const again = updated ? this.expression(node.condition, updated) : null;
    return merge(entry, again, ...frame.breaks);
  }

  private doWhileLoop(node: DoWhileNode, state: FlowState): Flow {
    const frame: LoopFrame = { breaks: [], continues: [] };
    this.loops.push(frame);
    const bodyEnd = this.statement(node.block, state);
    this.loops.pop();
    const atCondition = merge(bodyEnd, ...frame.continues);
    return merge(atCondition ? this.expression(node.condition, atCondition) : null, ...frame.breaks);
  }

  private jump(frames: LoopFrame[], isBreak: boolean, state: FlowState): Flow {
    const frame = frames[frames.length - 1];
    if (frame) (isBreak ? frame.breaks : frame.continues).push(state);
    return null;
  }

  // Unmodelled statements: evaluate their expressions; nested bodies may run any number of times.
  private opaqueStatement(node: Node, state: FlowState): Flow {
    let after = state;
    const bodies: StatementNode[] = [];
    for (const child of childNodes(node)) {
      if (child instanceof StatementNode) bodies.push(child);
      else after = this.expression(child, after);
    }
    this.useNamed(node, after);
    if (bodies.length === 0) return after;
    const frame: LoopFrame = { breaks: [], continues: [] };
    this.loops.push(frame);
    const ends = bodies.map((body) => this.statement(body, copy(after)));
    this.loops.pop();
    return merge(after, ...ends, ...frame.breaks, ...frame.continues);
  }

  private expressionChildren(node: Node, state: FlowState): FlowState {
    let after = state;
    for (const child of childNodes(node)) after = this.expression(child, after);
    return after;
  }

  private expression(node: Node, state: FlowState): FlowState {
    if (node instanceof IdentifierNode) {
      this.use(node.name, node, state);
      return state;
    }
    if (node instanceof AssignmentExpressionNode) {
      if (!node.prelude && !node.result) return this.assignment(node.assign, state);
      const after = this.statements(node.prelude ?? [], state) ?? state;
      return node.result ? this.expression(node.result, after) : after;
    }
    if (node instanceof BinaryOpNode
      && (node.operator === BinaryOperator.AND || node.operator === BinaryOperator.OR)) {
      const left = this.expression(node.left, state);
      return merge(left, this.expression(node.right, copy(left)))!;
    }
    if (node instanceof TernaryOpNode) {
      const condition = this.expression(node.condition, state);
      return merge(this.expression(node.ifTrue, copy(condition)), this.expression(node.ifFalse, copy(condition)))!;
    }
    if (node instanceof StatementNode) return this.statement(node, state) ?? state;
    const after = this.expressionChildren(node, state);
    this.useNamed(node, after);
    return after;
  }

  // Lowered reads and writes that name their variable instead of holding an IdentifierNode.
  private useNamed(node: Node, state: FlowState): void {
    if (node instanceof StateAccessNode || node instanceof StateAssignNode) {
      // An exact name is a state variable; a path (`p.x`, `p__x`) goes through a pointer.
      if (this.rootOf(node.name) !== node.name) this.use(node.name, node, state);
    } else if (node instanceof ArrayAssignNode || node instanceof ArrayDeleteNode || node instanceof ArrayPopNode
      || node instanceof ArrayPushNode || node instanceof MappingAccessNode || node instanceof MappingAssignNode
      || node instanceof MappingDeleteNode || node instanceof MappingFieldAssignNode
      || node instanceof StateArrayAssignNode || node instanceof StateArrayDeleteNode
      || node instanceof StateArrayPopNode || node instanceof StateArrayPushNode) {
      this.use(node.name, node, state);
    }
  }

  private use(name: string, node: Node, state: FlowState): void {
    const root = this.rootOf(name);
    if (root !== undefined && state.unassigned.has(root) && !state.accesses.has(node)) state.accesses.set(node, root);
  }

  private rootOf(name: string): string | undefined {
    if (this.pointers.has(name)) return name;
    return [...this.pointers.keys()].find((key) => name.startsWith(`${key}.`) || name.startsWith(`${key}__`));
  }

  private assemblyStatement(node: AssemblyStatementNode, state: FlowState): Flow {
    if (!node.yulBlock) return state;
    const previous = this.assembly;
    this.assembly = node;
    const after = this.yulBlock(node.yulBlock, state);
    this.assembly = previous;
    return after;
  }

  private yulBlock(block: YulBlockNode, state: FlowState): Flow {
    let flow: Flow = state;
    for (const statement of block.statements as YulNode[]) {
      if (!flow) return null;
      flow = this.yulStatement(statement, flow);
    }
    return flow;
  }

  // solc models Yul control flow and builtins, but not calls to Yul functions (their bodies are skipped).
  private yulStatement(node: YulNode, state: FlowState): Flow {
    if (node instanceof YulBlockNode) return this.yulBlock(node, state);
    if (node instanceof YulVariableDeclarationNode) return node.value ? this.yulExpression(node.value, state) : state;
    if (node instanceof YulAssignmentNode) {
      const after = this.yulExpression(node.value, state);
      for (const path of node.paths) if (this.pointers.has(path.base)) after.unassigned.delete(path.base);
      return after;
    }
    if (node instanceof YulIfNode) {
      const condition = this.yulExpression(node.condition, state);
      return merge(condition, this.yulBlock(node.body, copy(condition)));
    }
    if (node instanceof YulSwitchNode) {
      const head = this.yulExpression(node.expression, state);
      const arms = node.cases.map((arm) => this.yulBlock(arm.body, copy(head)));
      return merge(...arms, node.defaultBody ? this.yulBlock(node.defaultBody, copy(head)) : head);
    }
    if (node instanceof YulForLoopNode) {
      const pre = this.yulBlock(node.pre, state);
      if (!pre) return null;
      const entry = this.yulExpression(node.condition, pre);
      const frame: LoopFrame = { breaks: [], continues: [] };
      this.yulLoops.push(frame);
      const bodyEnd = merge(this.yulBlock(node.body, copy(entry)), ...frame.continues);
      const post = bodyEnd ? this.yulBlock(node.post, bodyEnd) : null;
      this.yulLoops.pop();
      return merge(entry, post ? this.yulExpression(node.condition, post) : null, ...frame.breaks);
    }
    if (node instanceof YulBreakNode) return this.jump(this.yulLoops, true, state);
    if (node instanceof YulContinueNode) return this.jump(this.yulLoops, false, state);
    if (node instanceof YulLeaveNode) return null;
    if (node instanceof YulExpressionStatementNode) {
      const after = this.yulExpression(node.expression, state);
      return node.expression instanceof YulFunctionCallNode && TERMINATING_YUL.has(node.expression.name)
        ? null : after;
    }
    return state;
  }

  private yulExpression(node: YulExpressionNode, state: FlowState): FlowState {
    if (node instanceof YulPathNode && this.assembly) this.use(node.base, this.assembly, state);
    if (node instanceof YulFunctionCallNode) {
      return node.args.reduce((after, argument) => this.yulExpression(argument, after), state);
    }
    return state;
  }
}
