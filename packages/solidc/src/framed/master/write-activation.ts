/**
 * The condition a framed body's verified-mapping write runs under, published on its entry access as `activation`.
 *
 * A write a branch guards is skipped whenever the branch is not taken, and a frame that skips it declares no write: a
 * node the list holds is kept, and a key it does not hold is proved absent by its kept predecessor. A builder decides
 * which from the frame's own facts - its arguments, its state, its sender and the mapping nodes it holds - as it
 * decides a conditional call site, so the condition is published in the expression language a call site's condition
 * uses: the predicate of every branch on the path from the body to the write, an `else` arm's negated, joined by `&&`.
 * A branch whose other arm fails on every path (a modifier's `revert`) guards nothing: a frame that completes took
 * the write's arm.
 *
 * A predicate is read where its branch starts. A local is followed to the one value that reaches the predicate: its
 * initializer, the one assignment that runs before it, or, for a `bool` the body sets on branch arms or in a loop's
 * turns (a cached write's dirty flag, a lowered return's flag), the statements that set it, a branch both of whose
 * arms set it counting as its own path. A predicate that reads a value the body writes before the branch, or one no
 * frame fact carries (a call's result, the block's time), is not one the frame starts with, so the write is published
 * as skippable under a condition the builder cannot decide: `{ kind: 'unsupported' }`. A predicate that folds to
 * `true` is a write the body makes wherever it reaches it, which publishes none.
 *
 * An emit a branch guards publishes its condition the same way, on its `emits` row: the frame lists the event's
 * output whether or not the body reaches the emit, and a skipped emit's output carries the empty commitment. Two
 * exclusive arms that emit into one slot publish the condition either of them runs under.
 */

import { IntType } from '@solidcash/utils';
import {
  ArrayAssignNode,
  ArrayDeleteNode,
  ArrayPopNode,
  ArrayPushNode,
  AssignmentExpressionNode,
  AssignNode,
  BinaryOpNode,
  BlockNode,
  BoolLiteralNode,
  BranchNode,
  BreakNode,
  CastNode,
  ConsoleStatementNode,
  ConstantDefinitionNode,
  ContinueNode,
  DeleteLocalNode,
  DeleteStateNode,
  DoWhileNode,
  EmitStatementNode,
  ExpressionNode,
  ExternalCallExpression,
  FieldAccessNode,
  FunctionCallNode,
  FunctionCallStatementNode,
  FunctionDefinitionNode,
  HexLiteralNode,
  IdentifierNode,
  IntLiteralNode,
  MappingAccessNode,
  MappingAssignNode,
  MappingDeleteNode,
  MappingFieldAssignNode,
  Node,
  NullaryOpNode,
  ParameterNode,
  RequireNode,
  ReturnNode,
  RevertNode,
  StateAccessNode,
  StateArrayAssignNode,
  StateArrayDeleteNode,
  StateArrayPopNode,
  StateArrayPushNode,
  StateAssignNode,
  StringLiteralNode,
  TernaryOpNode,
  TryCatchNode,
  TupleAssignmentNode,
  TypeIntrospectionNode,
  UnaryOpNode,
  UncheckedNode,
  VariableDefinitionNode,
  WhileNode,
} from '../../ast/AST.js';
import { BinaryOperator, NullaryOperator, UnaryOperator } from '../../ast/Operator.js';
import { walkInvocationAst } from '../../analysis/InvocationAnalysis.js';

/** The activation of a write whose condition the frame's own facts do not decide. */
export const UNDECIDED_WRITE_ACTIVATION: ExternalCallExpression = { kind: 'unsupported' };

/** One predicate a statement sits under: a branch arm's, or a pre-test loop's where the loop is entered. */
interface PathGuard {
  /** The branch or the loop that tests it, which tells the two arms of one branch from two branches. */
  readonly owner: BranchNode | WhileNode;
  readonly condition: ExpressionNode;
  /** True for a branch's `else` arm. */
  readonly negated: boolean;
}

/** The predicates from a body down to a statement, outermost first, and what runs before each. */
interface StatementPath {
  readonly guards: readonly PathGuard[];
  /** Per guard, the statements that run before its predicate is read. */
  readonly before: readonly (readonly Node[])[];
  /** The statements that run before the statement itself. */
  readonly prior: readonly Node[];
}

/** True when `root`'s subtree holds `target`. */
function holds(root: Node, target: Node): boolean {
  let found = false;
  walkInvocationAst(root, (node) => {
    if (node === target) found = true;
  });
  return found;
}

/** True when every path through a block ends in a failure: a revert, or a `require(false)`. */
function endsInFailure(block: BlockNode | undefined): boolean {
  const last = (block?.statements ?? []).filter((statement) => !(statement instanceof ConsoleStatementNode)).at(-1);
  if (last instanceof BlockNode) return endsInFailure(last);
  if (last instanceof UncheckedNode) return endsInFailure(last.block);
  if (last instanceof TryCatchNode) return endsInFailure(last.tryBlock);
  if (last instanceof BranchNode) return endsInFailure(last.ifBlock) && endsInFailure(last.elseBlock);
  return last instanceof RevertNode
    || (last instanceof RequireNode && last.expression instanceof BoolLiteralNode && !last.expression.value);
}

/** True when a statement can leave the code after it unreached: it returns, breaks or continues on some path. */
function exitsEarly(statement: Node): boolean {
  let exits = false;
  walkInvocationAst(statement, (node) => {
    if (node instanceof ReturnNode || node instanceof BreakNode || node instanceof ContinueNode) exits = true;
  });
  return exits;
}

/**
 * The predicates between `body` and `target`, or undefined when the body does not hold it at a statement, one that
 * runs before it can leave it unreached, or a construct other than a block or a branch arm encloses it. With
 * `entered`, which asks whether `target` runs at least once, a loop encloses it too: a `do` loop's body runs once
 * wherever the loop is reached, and a pre-test loop's where its predicate holds on entry.
 */
function pathTo(body: BlockNode, target: Node, entered = false): StatementPath | undefined {
  const guards: PathGuard[] = [];
  const before: Node[][] = [];
  const prior: Node[] = [];
  // Inside a loop a predicate is read once per turn, so only the first turn's reading is known: no further one.
  let looped = false;
  const walk = (statements: readonly Node[]): boolean => {
    for (const statement of statements) {
      if (statement === target) return true;
      if (!holds(statement, target)) {
        if (exitsEarly(statement)) return false;
        prior.push(statement);
        continue;
      }
      if (statement instanceof BlockNode) return walk(statement.statements ?? []);
      if (statement instanceof UncheckedNode) return walk(statement.block.statements ?? []);
      if (entered && statement instanceof DoWhileNode) {
        looped = true;
        return walk(statement.block.statements ?? []);
      }
      if (looped) return false;
      if (entered && statement instanceof WhileNode) {
        guards.push({ owner: statement, condition: statement.condition, negated: false });
        before.push([...prior]);
        looped = true;
        return walk(statement.block.statements ?? []);
      }
      if (!(statement instanceof BranchNode)) return false;
      const inIf = holds(statement.ifBlock, target);
      const arm = inIf ? statement.ifBlock : statement.elseBlock;
      if (arm === undefined || (!inIf && !holds(arm, target))) return false;
      // A frame that completes took the arm that holds `target` wherever the other arm fails on every path.
      if (!endsInFailure(inIf ? statement.elseBlock : statement.ifBlock)) {
        guards.push({ owner: statement, condition: statement.condition, negated: !inIf });
        before.push([...prior]);
      }
      return walk(arm.statements ?? []);
    }
    return false;
  };
  return walk(body.statements ?? []) ? { guards, before, prior } : undefined;
}

/**
 * The paths of a disjunction with every pair that differs only in the arm of their last branch joined into the
 * prefix they share, since either arm then holds; a path with no guard holds whenever its point is reached.
 */
function joinArms(paths: readonly StatementPath[]): readonly StatementPath[] {
  const joined = [...paths];
  for (let changed = true; changed;) {
    changed = false;
    for (let left = 0; left < joined.length && !changed; left += 1) {
      for (let right = left + 1; right < joined.length && !changed; right += 1) {
        const a = joined[left]!.guards;
        const b = joined[right]!.guards;
        const last = a.length - 1;
        if (a.length === 0 || a.length !== b.length || a[last]!.owner !== b[last]!.owner
          || a[last]!.negated === b[last]!.negated
          || a.slice(0, last).some((guard, index) => guard.owner !== b[index]!.owner
            || guard.negated !== b[index]!.negated)) continue;
        joined.splice(right, 1);
        joined[left] = { ...joined[left]!, guards: a.slice(0, last), before: joined[left]!.before.slice(0, last) };
        changed = true;
      }
    }
  }
  return joined;
}

/** The names the statements write: state fields, collections, arrays and locals, through the helpers they invoke. */
function namesWritten(statements: readonly Node[]): ReadonlySet<string> {
  const names = new Set<string>();
  const seen = new Set<FunctionDefinitionNode>();
  const visit = (node: Node): void => {
    if (node instanceof StateAssignNode || node instanceof DeleteStateNode || node instanceof MappingAssignNode
      || node instanceof MappingFieldAssignNode || node instanceof MappingDeleteNode
      || node instanceof StateArrayAssignNode || node instanceof StateArrayPushNode
      || node instanceof StateArrayPopNode || node instanceof StateArrayDeleteNode || node instanceof ArrayAssignNode
      || node instanceof ArrayPushNode || node instanceof ArrayPopNode || node instanceof ArrayDeleteNode) {
      names.add(node.name);
    } else if (node instanceof AssignNode || node instanceof DeleteLocalNode) {
      names.add(node.identifier.name);
    } else if (node instanceof AssignmentExpressionNode) {
      names.add(node.assign.identifier.name);
    } else if (node instanceof TupleAssignmentNode) {
      for (const element of node.elements) if (element.name !== undefined) names.add(element.name);
    }
    // A helper the body invokes rather than inlines writes where it is called.
    const callee = node instanceof FunctionCallNode ? node.resolvedFunction
      : node instanceof FunctionCallStatementNode ? node.call.resolvedFunction : undefined;
    if (callee?.body !== undefined && !seen.has(callee)) {
      seen.add(callee);
      walkInvocationAst(callee.body, visit);
    }
  };
  for (const statement of statements) walkInvocationAst(statement, visit);
  return names;
}

/** The predicate of a write that runs wherever the body reaches it, and of one it never reaches. */
const ALWAYS: ExternalCallExpression = { kind: 'literal', type: 'bool', value: true };
const NEVER: ExternalCallExpression = { kind: 'literal', type: 'bool', value: false };

/** The value of a `bool` literal predicate, or undefined for any other. */
function constantOf(predicate: ExternalCallExpression): boolean | undefined {
  return predicate.kind === 'literal' && predicate.type === 'bool' && typeof predicate.value === 'boolean'
    ? predicate.value : undefined;
}

/** True for an activation the frame's write runs under wherever the body reaches it. */
export function isAlwaysActive(activation: ExternalCallExpression): boolean {
  return constantOf(activation) === true;
}

function not(predicate: ExternalCallExpression): ExternalCallExpression {
  const constant = constantOf(predicate);
  if (constant !== undefined) return constant ? NEVER : ALWAYS;
  return { kind: 'unary', operator: '!', expression: predicate };
}

function both(left: ExternalCallExpression, right: ExternalCallExpression): ExternalCallExpression {
  const [a, b] = [constantOf(left), constantOf(right)];
  if (a === false || b === false) return NEVER;
  if (a === true) return right;
  return b === true ? left : { kind: 'binary', operator: '&&', left, right };
}

function either(left: ExternalCallExpression, right: ExternalCallExpression): ExternalCallExpression {
  const [a, b] = [constantOf(left), constantOf(right)];
  if (a === true || b === true) return ALWAYS;
  if (a === false) return right;
  return b === false ? left : { kind: 'binary', operator: '||', left, right };
}

/** What a predicate is read against: the statements that run before it, and the locals already being followed. */
interface ReadPoint {
  readonly prior: readonly Node[];
  readonly following: ReadonlySet<VariableDefinitionNode>;
}

/** The serializer of one body's predicates, over the contract's constants. */
class ActivationSerializer {
  private readonly visible: readonly ParameterNode[];

  constructor(
    private readonly entry: FunctionDefinitionNode,
    private readonly constants: ReadonlyMap<string, ExpressionNode>,
  ) {
    this.visible = entry.parameters.filter((parameter) => !parameter.name.startsWith('__internal__'));
  }

  /** The conjunction of the predicates on the path to `write`, or undefined when one is not the frame's to decide. */
  activationOf(write: Node): ExternalCallExpression | undefined {
    const path = pathTo(this.entry.body, write);
    return path === undefined ? undefined : this.guardsHold(path, new Set());
  }

  /**
   * The disjunction of the conditions `sites` run under, two arms of one branch joined into the path they share, or
   * undefined when one is not the frame's to decide.
   */
  activationOfAny(sites: readonly Node[]): ExternalCallExpression | undefined {
    const paths = sites.map((site) => pathTo(this.entry.body, site));
    if (paths.length === 0 || paths.some((path) => path === undefined)) return undefined;
    let reached = NEVER;
    for (const path of joinArms(paths as StatementPath[])) {
      const taken = this.guardsHold(path, new Set());
      if (taken === undefined) return undefined;
      reached = either(reached, taken);
    }
    return reached;
  }

  /** The conjunction of `path`'s guards, each read where its branch starts or its loop is entered. */
  private guardsHold(
    path: StatementPath, following: ReadonlySet<VariableDefinitionNode>,
  ): ExternalCallExpression | undefined {
    let combined = ALWAYS;
    for (const [index, { condition, negated }] of path.guards.entries()) {
      const predicate = this.serialize(condition, { prior: path.before[index]!, following });
      if (predicate === undefined) return undefined;
      combined = both(combined, negated ? not(predicate) : predicate);
    }
    return combined;
  }

  private serialize(expression: ExpressionNode, at: ReadPoint): ExternalCallExpression | undefined {
    const typed = <T extends ExternalCallExpression>(value: T): T => (expression.type === undefined
      ? value : { ...value, type: expression.type.toString() });
    if (expression instanceof BoolLiteralNode) return { kind: 'literal', type: 'bool', value: expression.value };
    if (expression instanceof IntLiteralNode) return { kind: 'literal', type: 'bigint', value: expression.value.toString() };
    if (expression instanceof StringLiteralNode) return { kind: 'literal', type: 'string', value: expression.value };
    if (expression instanceof HexLiteralNode) {
      return {
        kind: 'literal',
        type: `bytes${expression.value.byteLength}`,
        value: [...expression.value].map((byte) => byte.toString(16).padStart(2, '0')).join(''),
      };
    }
    if (expression instanceof TypeIntrospectionNode) {
      const type = expression.resolvedType;
      if (!(type instanceof IntType) || (expression.property !== 'min' && expression.property !== 'max')) {
        return undefined;
      }
      const bound = expression.property === 'min' ? type.minValue : type.maxValue;
      return { kind: 'literal', type: 'bigint', value: bound.toString() };
    }
    if (expression instanceof NullaryOpNode) {
      return expression.operator === NullaryOperator.MSG_SENDER
        ? { kind: 'source', source: { kind: 'msgSender' }, type: 'address' } : undefined;
    }
    if (expression instanceof IdentifierNode) return this.identifier(expression, at);
    if (expression instanceof StateAccessNode) {
      return this.writtenBefore(at, expression.name) ? undefined : { kind: 'state', name: expression.name };
    }
    if (expression instanceof MappingAccessNode) {
      if (expression.arrayIndex !== undefined || expression.isTokenContainerAccess === true
        || expression.isGenesisRead === true || this.writtenBefore(at, expression.name)) return undefined;
      const args: ExternalCallExpression[] = [];
      for (const key of expression.keys) {
        const serialized = this.serialize(key, at);
        if (serialized === undefined) return undefined;
        args.push(serialized);
      }
      return typed({ kind: 'stateAccess', name: expression.name, args });
    }
    if (expression instanceof FieldAccessNode) {
      const member = expression.enumType?.members.find((candidate) => candidate.name === expression.name);
      if (member !== undefined) return { kind: 'literal', type: 'bigint', value: member.value.toString() };
      const inner = this.serialize(expression.expression, at);
      if (inner === undefined) return undefined;
      // A `bool` or integer field read from a value the builder cannot state evaluates to its type's default when
      // typed, which would decide the write from a guess; an address field keeps its type for the comparison.
      const type = expression.type?.toString();
      return type === undefined || /^(?:bool|bigint|u?int\d*)$/.test(type)
        ? { kind: 'field', name: expression.name, expression: inner }
        : { kind: 'field', name: expression.name, expression: inner, type };
    }
    if (expression instanceof CastNode) {
      const inner = this.serialize(expression.expression, at);
      return inner === undefined ? undefined : { kind: 'cast', type: expression.type.toString(), expression: inner };
    }
    if (expression instanceof UnaryOpNode) {
      if (expression.operator !== UnaryOperator.NOT && expression.operator !== UnaryOperator.NEGATE
        && expression.operator !== UnaryOperator.SIZE) return undefined;
      const inner = this.serialize(expression.expression, at);
      return inner === undefined ? undefined : { kind: 'unary', operator: expression.operator, expression: inner };
    }
    if (expression instanceof BinaryOpNode) {
      if (expression.operator === BinaryOperator.SPLIT) return undefined;
      const left = this.serialize(expression.left, at);
      const right = left === undefined ? undefined : this.serialize(expression.right, at);
      return right === undefined ? undefined : { kind: 'binary', operator: expression.operator, left: left!, right };
    }
    if (expression instanceof TernaryOpNode) {
      const condition = this.serialize(expression.condition, at);
      const ifTrue = condition === undefined ? undefined : this.serialize(expression.ifTrue, at);
      const ifFalse = ifTrue === undefined ? undefined : this.serialize(expression.ifFalse, at);
      return ifFalse === undefined ? undefined : { kind: 'ternary', condition: condition!, ifTrue: ifTrue!, ifFalse };
    }
    return undefined;
  }

  /** True when a statement that runs before the read point writes `name`. */
  private writtenBefore(at: ReadPoint, name: string): boolean {
    return namesWritten(at.prior).has(name);
  }

  /** A parameter, a contract constant, `this`, or a local followed to the value that reaches the read point. */
  private identifier(identifier: IdentifierNode, at: ReadPoint): ExternalCallExpression | undefined {
    const definition = identifier.definition?.definition;
    if (identifier.name === 'this') return { kind: 'source', source: { kind: 'selfAddress' }, type: 'address' };
    const parameter = this.visible.findIndex((candidate) => candidate === definition
      || (definition === undefined && candidate.name === identifier.name));
    if (parameter >= 0) {
      return this.writtenBefore(at, identifier.name)
        ? undefined : { kind: 'source', source: { kind: 'forward', paramIndex: parameter } };
    }
    const constant = definition instanceof ConstantDefinitionNode ? definition.expression
      : definition === undefined ? this.constants.get(identifier.name) : undefined;
    if (constant !== undefined) return this.serialize(constant, { prior: [], following: at.following });
    if (!(definition instanceof VariableDefinitionNode) || at.following.has(definition)) return undefined;
    return this.local(definition, at);
  }

  /** The value a local holds at the read point, or undefined when the body does not fix it there. */
  private local(definition: VariableDefinitionNode, at: ReadPoint): ExternalCallExpression | undefined {
    const following = new Set(at.following).add(definition);
    const declared = pathTo(this.entry.body, definition);
    if (declared === undefined) return undefined;
    // The writes of the local that run before the read point; one this does not follow leaves it unfixed.
    const assignments: AssignNode[] = [];
    const unfollowed: Node[] = [];
    const visit = (node: Node): void => {
      if (node instanceof AssignNode && node.identifier.name === definition.name) assignments.push(node);
      else if ((node instanceof DeleteLocalNode && node.identifier.name === definition.name)
        || (node instanceof AssignmentExpressionNode && node.assign.identifier.name === definition.name)
        || (node instanceof TupleAssignmentNode && node.elements.some((element) => element.name === definition.name))) {
        unfollowed.push(node);
      }
    };
    for (const statement of at.prior) walkInvocationAst(statement, visit);
    if (unfollowed.length > 0) return undefined;
    if (assignments.length === 0) {
      return definition.expression === undefined
        ? undefined : this.serialize(definition.expression, { prior: declared.prior, following });
    }
    // One assignment that runs whenever the read point is reached carries the value the predicate reads.
    const once = assignments.length === 1 ? pathTo(this.entry.body, assignments[0]!) : undefined;
    if (once !== undefined && once.guards.length === 0) {
      return this.serialize(assignments[0]!.expression, { prior: once.prior, following });
    }
    // A flag the body sets on branch arms or in a loop's turns: its declared value unless a statement that sets the
    // other value ran at least once.
    const initial = definition.expression;
    if (!(initial instanceof BoolLiteralNode)) return undefined;
    if (assignments.some((assignment) => !(assignment.expression instanceof BoolLiteralNode)
      || assignment.expression.value === initial.value)) return undefined;
    const paths = assignments.map((assignment) => pathTo(this.entry.body, assignment, true));
    if (paths.some((path) => path === undefined)) return undefined;
    let reached = NEVER;
    for (const path of joinArms(paths as StatementPath[])) {
      const taken = this.guardsHold(path, following);
      if (taken === undefined) return undefined;
      reached = either(reached, taken);
    }
    return initial.value ? not(reached) : reached;
  }
}

/** The write node of a framed body's entry slot, when the body itself holds it rather than a helper it calls. */
function framedSlotWrite(entry: FunctionDefinitionNode, slotIndex: number): Node | undefined {
  let found: Node | undefined;
  walkInvocationAst(entry.body, (node) => {
    if (found !== undefined) return;
    if ((node instanceof MappingAssignNode || node instanceof MappingFieldAssignNode
      || node instanceof MappingDeleteNode) && node.entrySlotIndex === slotIndex) found = node;
  });
  return found;
}

/**
 * The activation of a framed body's write of `slotIndex`, a write some branch arm guards: the conjunction of the
 * predicates on its path, `true` where they hold wherever the body reaches the write (`isAlwaysActive`), or
 * `UNDECIDED_WRITE_ACTIVATION` when one is not the frame's to decide.
 */
export function framedWriteActivation(
  entry: FunctionDefinitionNode,
  slotIndex: number,
  constants: ReadonlyMap<string, ExpressionNode>,
): ExternalCallExpression {
  const write = framedSlotWrite(entry, slotIndex);
  const activation = write === undefined ? undefined : new ActivationSerializer(entry, constants).activationOf(write);
  return activation ?? UNDECIDED_WRITE_ACTIVATION;
}

/**
 * The activation of a framed body's emit at `emitIndex`, an emit some branch arm guards: the disjunction of the
 * conditions the slot's emits run under, since exclusive arms may emit into one slot, `true` where they hold wherever
 * the body reaches the slot (`isAlwaysActive`), or `UNDECIDED_WRITE_ACTIVATION` when one is not the frame's to decide.
 */
export function framedEmitActivation(
  entry: FunctionDefinitionNode,
  emitIndex: number,
  constants: ReadonlyMap<string, ExpressionNode>,
): ExternalCallExpression {
  const sites: Node[] = [];
  walkInvocationAst(entry.body, (node) => {
    if (node instanceof EmitStatementNode && node.runtimeLoopEvent === undefined && node.emitIndex === emitIndex) {
      sites.push(node);
    }
  });
  return new ActivationSerializer(entry, constants).activationOfAny(sites) ?? UNDECIDED_WRITE_ACTIVATION;
}
