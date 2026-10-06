/**
 * The effects a per-call body makes once per turn of a loop: the events it emits, the value sends it lists and the
 * keccak256 side-cars it reads.
 *
 * A body binds such an effect where its source makes it, in the order the execution reaches it: the k-th event at
 * the frame's k-th listed event output, the k-th send at its k-th listed send output, and the k-th hash at the k-th
 * side-car after its own input. The head checks the listed outputs as one run whose length the block declares
 * (`frame-tail.ts`), and the body pins how many it made against that length where it ends, so a block can list
 * neither more nor fewer than the turns made. That is the run-time position mode a call inside a loop already has.
 *
 * What a builder needs is the order the outputs take, which is the order the body makes the effects: a run of effects
 * the source makes once, then a run a loop repeats per turn, and so on. Each loop's turns are counted by the same
 * recurrence a loop's calls publish (`externalCallIterationDomains`), against the entry's own arguments and state. A
 * body whose order a builder could not reconstruct is refused by name: an effect on a branch beside a looped one, one
 * in a nested loop, a do-while loop, a collection iteration or a loop's condition, and one in a loop whose counter or
 * bound is not such a recurrence.
 */

import type { CompilerOptions, PublishedLoopEffectRun, PublishedLoopEffects } from '@solidcash/utils';
import {
  AddressSendExpressionNode,
  AddressTransferStatementNode,
  BinaryOpNode,
  BranchNode,
  CollectionIterationNode,
  DoWhileNode,
  EmitStatementNode,
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
import { externalCallIterationDomains } from '../../artifact/Artifact.js';

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
  /** The loops around it, outermost first; a loop no recurrence can count is marked `uncounted`. */
  readonly loops: readonly LoopFrame[];
  readonly branched: boolean;
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
  const seen = new Set<Node>();
  const visit = (value: unknown, loops: readonly LoopFrame[], branched: boolean): void => {
    if (!(value instanceof Node) || seen.has(value)) return;
    seen.add(value);
    const add = (kind: LoopEffectKind, id: number): void => {
      found.push({ kind, id, node: value, loops, branched });
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
      if (!(value instanceof CollectionIterationNode)) visit(value.condition, [...loops, condition], branched);
      visit(value instanceof CollectionIterationNode ? value.body : value.block, [...loops, body], branched);
      return;
    }
    if (value instanceof BranchNode) {
      visit(value.condition, loops, branched);
      visit(value.ifBlock, loops, true);
      visit(value.elseBlock, loops, true);
      return;
    }
    if (value instanceof SwitchNode || value instanceof TernaryOpNode) {
      const [decides, ...arms] = value instanceof TernaryOpNode
        ? [value.condition, value.ifTrue, value.ifFalse]
        : [value.expression, ...value.cases, value.defaultCase];
      visit(decides, loops, branched);
      for (const arm of arms) visit(arm, loops, true);
      return;
    }
    if (value instanceof BinaryOpNode
      && (value.operator === BinaryOperator.AND || value.operator === BinaryOperator.OR)) {
      // The right operand runs only when the left one does not decide the value.
      visit(value.left, loops, branched);
      visit(value.right, loops, true);
      return;
    }
    if (value instanceof TryCatchNode) {
      // BCH script failure aborts the spend, so a catch clause is no path.
      visit(value.expression, loops, branched);
      visit(value.tryBlock, loops, branched);
      return;
    }
    for (const key in value) {
      if (SKIPPED_KEYS.has(key)) continue;
      const child = value[key as keyof Node] as unknown;
      if (Array.isArray(child)) for (const item of child) visit(item, loops, branched);
      else visit(child, loops, branched);
    }
  };
  visit(fn.body, [], false);
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
  // The recurrence of each loop around a looped effect, keyed by the effect's position in `found`.
  const targets = new Map<Node, number>();
  found.forEach((effect, position) => {
    if (effect.loops.length === 1 && !effect.loops[0]!.uncounted) targets.set(effect.node, position);
  });
  const domains = externalCallIterationDomains(fn, compilerOptions, targets);
  const effects: Partial<Record<LoopEffectKind, readonly PublishedLoopEffectRun[]>> = {};
  for (const kind of KINDS) {
    if (!looped.has(kind)) continue;
    const { effect: what, laid } = WORDING[kind];
    const refusal = (where: string): BodyLoopEffects => ({
      reason: `${what} ${where}, so a builder cannot count the ${laid} the body binds in turn`,
    });
    const ofKind = found.map((effect, position) => ({ effect, position })).filter(({ effect }) => effect.kind === kind);
    if (ofKind.some(({ effect }) => effect.branched)) return refusal('on a branch beside one in a loop');
    if (ofKind.some(({ effect }) => effect.loops.length > 1 || effect.loops.some((frame) => frame.uncounted))) {
      return refusal('in a nested loop, a do-while loop, a collection iteration or a loop condition');
    }
    const runs: PublishedLoopEffectRun[] = [];
    let current: { loop: Node | undefined; ids: number[] } | undefined;
    for (const { effect, position } of ofKind) {
      const loop = effect.loops[0]?.loop;
      if (loop !== undefined && !domains.has(position)) {
        return refusal('in a loop whose counter or bound is not a recurrence the entry\'s own facts fix');
      }
      if (current === undefined || current.loop !== loop) {
        current = { loop, ids: [] };
        const iterationDomain = loop === undefined ? undefined : domains.get(position);
        runs.push({ ids: current.ids, ...(iterationDomain === undefined ? {} : { iterationDomain }) });
      }
      current.ids.push(effect.id);
    }
    effects[kind] = runs;
  }
  return { effects };
}
