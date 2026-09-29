import { describe, expect, it } from 'vitest';
import {
  BlockNode, BoolLiteralNode, BranchNode, FunctionDefinitionNode, IdentifierNode, IntLiteralNode,
  MappingAssignNode, UncheckedNode,
} from '../../../src/ast/AST.js';
import { perCallBatchWriteSegment } from '../../../src/per-call/master/support.js';
import { compileStringMulti } from '../../../src/compiler.js';
import { publishedRefusals } from './refused-entry.js';

/**
 * The segment a body's derived mapping write lands in, when no call decides it.
 *
 * The derivation reads the records of the segment the write lands in, located by the number of calls the body makes
 * before it. The count walk refuses to descend through a branch that sits inside an expression, but a lowering
 * leaves such branches behind without any call in them — an unchecked arithmetic block keeps its disabled overflow
 * check as `if (false) revert`. A branch that reaches no call cannot move the segment, so the count walk must treat
 * it as making none rather than leaving the count open, or a body whose writes precede every (absent) call is
 * refused as if a call the source does not fix sat between them.
 *
 * The boundary stays: a branch that really does reach a call, or a call the source reaches conditionally, still
 * leaves the count open, and the derivation's own segment still refuses it.
 */

/** A branch that reaches no call, as lowering leaves an unchecked arithmetic block: `if (false) { revert }`. */
function callFreeBranch(): UncheckedNode {
  const condition = new BoolLiteralNode(false);
  return new UncheckedNode(new BlockNode([new BranchNode(condition, new BlockNode([]), new BlockNode([]))]));
}

/** A body whose one derived mapping write follows a call-free branch, and nowhere makes a call. */
function bodyWithCallFreeBranch(): FunctionDefinitionNode {
  const write = new MappingAssignNode('balances', [new IdentifierNode('to')], new IntLiteralNode(1n));
  write.entrySlotIndex = 0;
  const entry = new FunctionDefinitionNode('move', [], new BlockNode([callFreeBranch(), write]));
  entry.sortedBatchInfo = [{ collection: 'balances', slotIndices: [0] }];
  return entry;
}

describe('the segment a derived mapping write lands in', () => {
  it('is the frame\'s first when the write precedes every call a branch-free reach reaches', () => {
    expect(perCallBatchWriteSegment(bodyWithCallFreeBranch())).toBe(0);
  });

  it('leaves the count open when the control flow reaches a call, so the write stays refused', () => {
    // The same body with a conditional call before the write: the write's segment is the arm that ran, which the
    // source does not fix, so the derivation cannot read it.
    const source = 'pragma solidcash ^0.13.0;'
      + ' interface IOther { function ping(); }'
      + ' contract Other { function ping() { require(true); } }'
      + ' contract Ledger {'
      + '   mapping(address => uint) balances;'
      + '   function move(bool go, address to, uint amount) {'
      + '     if (go) { IOther(0x1111111111111111111111111111111111111111).ping.call(); }'
      + '     balances[to] = amount;'
      + '   }'
      + ' }';
    const refusals = publishedRefusals(compileStringMulti(source, { composition: 'per-call' }) as
      Record<string, { composition?: unknown }>);
    expect(refusals.map((refused) => refused.functionName)).toStrictEqual(['Ledger.move()']);
    expect(refusals[0]!.reason).toContain('cannot follow the segment the write lands in');
  });

  it('is served for a body whose writes precede every call it makes', () => {
    // The boundary the fix sits on: with the branch gone and no call beside the write, the derivation reads the
    // frame's first segment and the entry is served either way. The pair shows the refusal above is about the call.
    const source = 'pragma solidcash ^0.13.0;'
      + ' contract Ledger {'
      + '   mapping(address => uint) balances;'
      + '   function move(bool pick, address to, uint amount) {'
      + '     balances[to] = pick ? amount : 0;'
      + '     require(true);'
      + '   }'
      + ' }';
    expect(publishedRefusals(compileStringMulti(source, { composition: 'per-call' }) as
      Record<string, { composition?: unknown }>)).toStrictEqual([]);
  });
});
