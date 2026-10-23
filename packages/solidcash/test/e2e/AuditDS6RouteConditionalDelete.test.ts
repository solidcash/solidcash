import { describe, expect, it } from 'vitest';
import { compileString } from '@solidcash/solidc';

/**
 * DS-6, the message-bus route shape.
 *
 * The direct hole: when every sorted-batch target of a function is conditional and one is a conditional delete,
 * emitGuardedSortedBatchTransitionVerification ran the whole batch verifier (transition plus collection census)
 * only inside a guard the spender controls (a plain input at the delete slot). feat/parity closed that for direct
 * bodies.
 *
 * A message-bus route cannot reach that guard. A branch-guarded `delete m[k]` on the route is lowered into an
 * OP_INVOKE'd internal journal handler (compiler.ts clones every delete-bearing handler as INTERNAL), and the
 * route body `__message_bus1` dispatches handlers by call, never inline, so it holds no in-branch MappingDeleteNode
 * and computeBlockLayout gives the route no `softDelete` entry slot. emitGuardedSortedBatchTransitionVerification
 * then finds no soft-delete slot and computes no guard, so the route's per-target transition and its
 * collection-cardinality census (emitVerifyChunkUtxoCount) run unconditionally, with no spender-controlled input
 * to gate them behind. This file pins that: the audited guarded shape exists in the DIRECT build (handled by the
 * landed direct fix), and the route's own published block layout carries no soft-delete slot.
 *
 * The `require` in the branch keeps IfConvertConditionalEntryOp from turning the delete into an unconditional
 * write, so the soft-delete shape is the one the audit row names.
 */

const SOURCE = `contract CondDeleteBatch {
  mapping(int => int) m;
  mapping(int => int) owners;
  function set(int k, int v) external { m[k] = v; require(true); }
  function setOwner(int k, int v) external { owners[k] = v; require(true); }
  function drop(int k, int sel) external {
    if (sel > 0) { require(k != 3); delete m[k]; }
    require(true);
  }
  function moveOrDrop(int id, int to, int sel) external {
    if (sel > 0) { require(to != 3); owners[id] = to; } else { require(id != 3); delete m[id]; }
    require(true);
  }
}`;

const softDeleteEntries = (slots: ReadonlyArray<{ kind: string; softDelete?: boolean }> | undefined): number =>
  (slots ?? []).filter((slot) => slot.kind === 'entry' && slot.softDelete === true).length;

describe('DS-6 message-bus route: the conditional-delete guard is never emitted for the route', () => {
  it('keeps the guarded soft-delete shape in the direct build (handled by the landed direct fix)', () => {
    const artifact = compileString(SOURCE, { messageBus: false, forceStateful: true });
    for (const name of ['drop', 'moveOrDrop']) {
      const entry = artifact.abi.find((candidate) => candidate.name === name)!;
      const slots = entry.blockLayout!.slots;
      // The delete slot is a conditional soft-delete write: the shape DS-6 names, now settled by the direct fix.
      const guard = slots.find((slot) => slot.kind === 'entry' && slot.softDelete === true);
      expect(guard, `${name} soft-delete slot`).toBeDefined();
      expect(guard!.conditional).toBe(true);
    }
  });

  it('gives the route no soft-delete slot, so no spender-switchable guard gates its batch verifier', () => {
    const artifact = compileString(SOURCE, { messageBus: true, forceStateful: true });
    expect(artifact.messageBus).toBeDefined();
    // The route publishes its own block layout. A branch-guarded delete is lowered to an OP_INVOKE'd journal
    // handler, so the route body names no in-branch delete and the route layout carries no soft-delete slot: the
    // guard predicate in emitGuardedSortedBatchTransitionVerification is never satisfied for the route, and its
    // sorted-batch transition and collection census run unconditionally.
    const route = artifact.messageBus!.route;
    expect(softDeleteEntries(route.blockLayout?.slots)).toBe(0);
    // The direct wrappers the route unions are still published (and carry the guarded shape the direct fix owns),
    // so the route's cleanliness is not merely the delete being dropped from the artifact.
    expect(softDeleteEntries(artifact.abi.find((candidate) => candidate.name === 'drop')?.blockLayout?.slots))
      .toBe(1);
  });
});
