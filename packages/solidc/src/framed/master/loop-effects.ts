/**
 * The effects a framed body makes once per turn of a loop: the events it emits, the value sends it lists and the
 * keccak256 side-cars it reads.
 *
 * A body binds such an effect where its source makes it, in the order the execution reaches it: the k-th event at
 * the frame's k-th listed event output, the k-th send at its k-th listed send output, and the k-th hash at the k-th
 * side-car after its own input. The head checks the listed outputs as one run whose length the block declares
 * (`frame-tail.ts`), and the body pins how many it made against that length where it ends, so a block can list
 * neither more nor fewer than the turns made. That is the run-time position mode a call inside a loop already has.
 * An effect the body reaches through a function it invokes rather than inlines is made where the call is, so it is
 * found there, and one on a branch inside a loop is made on the turns its predicates hold, which the run publishes
 * beside it (`PublishedLoopEffectRun.conditions`) for a builder to read on each turn as it reads the loop's bound.
 *
 * What a builder needs is the order the outputs take, which is the order the body makes the effects: a run of effects
 * the source makes once, then a run a loop repeats per turn, and so on. Each loop's turns are counted by the same
 * recurrence a loop's calls publish (`externalCallIterationDomains`), against the entry's own arguments and state. A
 * body whose order a builder could not reconstruct is refused by name: an effect on a branch beside a looped one, one
 * on a branch inside a loop whose predicates are not read on each turn, one in a nested loop, a do-while loop, a
 * collection iteration or a loop's condition, and one in a loop whose counter or bound is not such a recurrence.
 */

import type {
  CompilerOptions, ExternalCallExpression, PublishedLoopEffectRun, PublishedLoopEffects,
} from '@solidcash/utils';
import {
  AddressSendExpressionNode,
  AddressTransferStatementNode,
  BinaryOpNode,
  BranchNode,
  CollectionIterationNode,
  DoWhileNode,
  EmitStatementNode,
  type ExpressionNode,
  FunctionCallNode,
  FunctionDefinitionNode,
  Node,
  SwitchNode,
  TernaryOpNode,
  TransferStatementNode,
  TryCatchNode,
  WhileNode,
} from '../../ast/AST.js';
import { BinaryOperator } from '../../ast/Operator.js';
import { GlobalFunction } from '../../ast/Globals.js';
import { externalCallIterationDomains, type EnclosingPredicate } from '../../artifact/Artifact.js';

/** The three effects a loop can repeat. */
export type LoopEffectKind = keyof PublishedLoopEffects;

const KINDS: readonly LoopEffectKind[] = ['events', 'sends', 'hashes'];

/** How each kind names itself in a refusal, and what a builder lays for it. */
const WORDING: Readonly<Record<LoopEffectKind, { readonly effect: string; readonly laid: string }>> = {
  events: { effect: 'an event emitted', laid: 'event outputs' },
  sends: { effect: 'a value send', laid: 'send outputs' },
  hashes: { effect: 'a keccak256 call', laid: 'side-cars' },
};

/** One effect as the walk met it: its kind, its id, and the loops and branches around it. */
interface FoundEffect {
  readonly kind: LoopEffectKind;
  readonly id: number;
  readonly node: Node;
  /** Where the entry's own body makes it: the node itself, or the call that invokes the function making it. */
  readonly anchor: Node;
  /** The loops around it, outermost first; a loop no recurrence can count is marked `uncounted`. */
  readonly loops: readonly LoopFrame[];
  /** The branch predicates the entry's own body reaches it under, outermost first. */
  readonly predicates: readonly EnclosingPredicate[];
  /** True for one on a branch whose predicate is not the entry's own: a switch arm, or a branch of an invoked body. */
  readonly opaque: boolean;
}

/** Where the walk is: the loops and predicates around it, and the call in the entry's body it is inside, if any. */
interface WalkContext {
  readonly loops: readonly LoopFrame[];
  readonly predicates: readonly EnclosingPredicate[];
  readonly opaque: boolean;
  readonly anchor?: Node;
}

interface LoopFrame {
  readonly loop: Node;
  readonly uncounted: boolean;
}

/** Back-references and payloads the walk must not follow into another function's body. */
const SKIPPED_KEYS = new Set([
  'location', 'resolvedFunction', 'functionReference', 'definition', 'symbolTable', 'referencedContract',
  'stateVariable', 'collection', 'type', 'sourceCallNode', 'eventDefinition',
]);

/** Every effect of the body in the order its source makes them, with the loops and branches around each. */
function effectsOf(fn: FunctionDefinitionNode): readonly FoundEffect[] {
  const found: FoundEffect[] = [];
  let hashes = 0;
  // The functions being walked through, so a recursive one is walked once per path.
  const invoking = new Set<FunctionDefinitionNode>([fn]);
  const walkBody = (body: Node | undefined, context: WalkContext): void => {
    const seen = new Set<Node>();
    const visit = (value: unknown, current: WalkContext): void => {
      if (!(value instanceof Node) || seen.has(value)) return;
      seen.add(value);
      step(value, current, visit);
    };
    visit(body, context);
  };
  /** A branch arm: under the predicate when the entry's own body states it, and opaque inside an invoked one. */
  const arm = (context: WalkContext, expression: ExpressionNode | undefined, negated: boolean): WalkContext => (
    expression === undefined || context.anchor !== undefined
      ? { ...context, opaque: true }
      : { ...context, predicates: [...context.predicates, { expression, negated }] });
  const step = (value: Node, context: WalkContext, visit: (value: unknown, context: WalkContext) => void): void => {
    const { loops } = context;
    const add = (kind: LoopEffectKind, id: number): void => {
      found.push({
        kind, id, node: value, anchor: context.anchor ?? value, loops, predicates: context.predicates,
        opaque: context.opaque,
      });
    };
    if (value instanceof EmitStatementNode && value.runtimeLoopEvent === undefined) add('events', value.emitIndex);
    if (value instanceof TransferStatementNode || value instanceof AddressTransferStatementNode
      || value instanceof AddressSendExpressionNode) add('sends', value.transferIndex);
    if (value instanceof FunctionCallNode && value.identifier.name === GlobalFunction.KECCAK256) {
      add('hashes', hashes);
      hashes += 1;
    }
    if (value instanceof WhileNode || value instanceof DoWhileNode || value instanceof CollectionIterationNode) {
      // A pre-test loop's condition runs once more than its body, so an effect there is counted by no recurrence.
      const condition: LoopFrame = { loop: value, uncounted: true };
      const body: LoopFrame = { loop: value, uncounted: !(value instanceof WhileNode) };
      if (!(value instanceof CollectionIterationNode)) visit(value.condition, { ...context, loops: [...loops, condition] });
      visit(value instanceof CollectionIterationNode ? value.body : value.block, { ...context, loops: [...loops, body] });
      return;
    }
    if (value instanceof BranchNode) {
      visit(value.condition, context);
      visit(value.ifBlock, arm(context, value.condition, false));
      visit(value.elseBlock, arm(context, value.condition, true));
      return;
    }
    if (value instanceof TernaryOpNode) {
      visit(value.condition, context);
      visit(value.ifTrue, arm(context, value.condition, false));
      visit(value.ifFalse, arm(context, value.condition, true));
      return;
    }
    if (value instanceof SwitchNode) {
      visit(value.expression, context);
      for (const branch of [...value.cases, value.defaultCase]) visit(branch, arm(context, undefined, false));
      return;
    }
    if (value instanceof BinaryOpNode
      && (value.operator === BinaryOperator.AND || value.operator === BinaryOperator.OR)) {
      // The right operand runs only when the left one does not decide the value.
      visit(value.left, context);
      visit(value.right, arm(context, value.left, value.operator === BinaryOperator.OR));
      return;
    }
    if (value instanceof TryCatchNode) {
      // BCH script failure aborts the spend, so a catch clause is no path.
      visit(value.expression, context);
      visit(value.tryBlock, context);
      return;
    }
    // A function the body invokes rather than inlines makes its effects where the call is, in the call's context.
    const invoked = value instanceof FunctionCallNode ? value.resolvedFunction : undefined;
    if (invoked?.body !== undefined && !invoking.has(invoked)) {
      for (const parameter of value instanceof FunctionCallNode ? value.parameters : []) visit(parameter, context);
      invoking.add(invoked);
      walkBody(invoked.body, { ...context, anchor: context.anchor ?? value });
      invoking.delete(invoked);
      return;
    }
    for (const key in value) {
      if (SKIPPED_KEYS.has(key)) continue;
      const child = value[key as keyof Node] as unknown;
      if (Array.isArray(child)) for (const item of child) visit(item, context);
      else visit(child, context);
    }
  };
  walkBody(fn.body, { loops: [], predicates: [], opaque: false });
  return found;
}

/** Which kinds of effect the body makes inside a loop. */
export function loopEffectKinds(fn: FunctionDefinitionNode): ReadonlySet<LoopEffectKind> {
  return new Set(effectsOf(fn).filter((effect) => effect.loops.length > 0).map((effect) => effect.kind));
}

/** The runs a builder lays a body's looped effects by, or why it cannot. */
export interface BodyLoopEffects {
  readonly effects?: PublishedLoopEffects;
  readonly reason?: string;
}

/**
 * The runs of each kind of effect the body makes inside a loop, in execution order, or the reason a builder could
 * not lay them. A kind the body makes no looped effect of is absent: its count is the one its source fixes.
 */
export function bodyLoopEffects(fn: FunctionDefinitionNode, compilerOptions: CompilerOptions): BodyLoopEffects {
  const found = effectsOf(fn);
  const looped = new Set(found.filter((effect) => effect.loops.length > 0).map((effect) => effect.kind));
  if (looped.size === 0) return {};
  // The recurrence of each loop around a looped effect, and the predicates the effect is made under on a turn,
  // keyed by where the entry's own body makes it: effects one invoked function makes share their call's.
  const targets = new Map<Node, number>();
  const predicates = new Map<number, readonly EnclosingPredicate[]>();
  for (const effect of found) {
    if (effect.loops.length !== 1 || effect.loops[0]!.uncounted || targets.has(effect.anchor)) continue;
    targets.set(effect.anchor, targets.size);
    predicates.set(targets.size - 1, effect.predicates);
  }
  const domains = externalCallIterationDomains(fn, compilerOptions, targets, predicates);
  const domainOf = (effect: FoundEffect): ReturnType<typeof domains.get> => {
    const key = targets.get(effect.anchor);
    return key === undefined ? undefined : domains.get(key);
  };
  const effects: Partial<Record<LoopEffectKind, readonly PublishedLoopEffectRun[]>> = {};
  for (const kind of KINDS) {
    if (!looped.has(kind)) continue;
    const { effect: what, laid } = WORDING[kind];
    const refusal = (where: string): BodyLoopEffects => ({
      reason: `${what} ${where}, so a builder cannot count the ${laid} the body binds in turn`,
    });
    const ofKind = found.filter((effect) => effect.kind === kind);
    if (ofKind.some((effect) => effect.opaque || (effect.loops.length === 0 && effect.predicates.length > 0))) {
      return refusal('on a branch beside one in a loop');
    }
    if (ofKind.some((effect) => effect.loops.length > 1 || effect.loops.some((frame) => frame.uncounted))) {
      return refusal('in a nested loop, a do-while loop, a collection iteration or a loop condition');
    }
    const runs: PublishedLoopEffectRun[] = [];
    let current: { loop: Node | undefined; ids: number[]; conditions: (ExternalCallExpression | null)[] } | undefined;
    for (const effect of ofKind) {
      const loop = effect.loops[0]?.loop;
      const domain = loop === undefined ? undefined : domainOf(effect);
      if (loop !== undefined && domain === undefined) {
        return refusal('in a loop whose counter or bound is not a recurrence the entry\'s own facts fix');
      }
      // A predicate the turn cannot read leaves the effect's turns uncounted.
      if (domain?.condition === null) return refusal('on a branch in a loop whose predicate a turn does not read');
      if (current === undefined || current.loop !== loop) {
        current = { loop, ids: [], conditions: [] };
        const iterationDomain = domain === undefined ? undefined : (({ condition: _condition, ...rest }) => rest)(domain);
        runs.push({ ids: current.ids, ...(iterationDomain === undefined ? {} : { iterationDomain }) });
      }
      current.ids.push(effect.id);
      current.conditions.push(domain?.condition ?? null);
      // A run whose effects are each made on every turn publishes no conditions.
      if (current.conditions.some((condition) => condition !== null)) {
        (runs[runs.length - 1] as { conditions?: readonly (ExternalCallExpression | null)[] }).conditions =
          current.conditions;
      }
    }
    effects[kind] = runs;
  }
  return { effects };
}
