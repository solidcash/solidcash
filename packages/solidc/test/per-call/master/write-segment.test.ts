import { describe, expect, it } from 'vitest';
import {
  BlockNode, BoolLiteralNode, BranchNode, ExpressionStatementNode, ExternalFunctionCallNode,
  FunctionDefinitionNode, IdentifierNode, IntLiteralNode, MappingAssignNode, UncheckedNode,
} from '../../../src/ast/AST.js';
import { perCallBatchWriteFollowsEveryCall, perCallBatchWriteSegment } from '../../../src/per-call/master/support.js';
import { compileStringMulti } from '../../../src/compiler.js';
import { publishedRefusals } from './refused-entry.js';

/**
 * The segment a body's derived mapping write lands in, and whether the run's own call count names it.
 *
 * The derivation reads the records of the segment the write lands in. A body whose calls the source fixes names
 * that segment by a compile-time count; a body whose calls the execution decides names it by the call count the
 * witness block itself declares, which locates the write only when no call follows it. The first walk refuses to
 * descend through a branch that sits inside an expression, but a lowering leaves such branches behind without any
 * call in them — an unchecked arithmetic block keeps its disabled overflow check as `if (false) revert` — so a
 * branch that reaches no call must count as none rather than leaving the count open.
 *
 * The boundary stays: a call the source reaches after the write leaves the write's segment short of the declared
 * count, so the derivation cannot read it and the entry stays refused.
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

/** The same body with a conditional call before the write: the write's segment is the arm that ran. */
function bodyWithCallBeforeWrite(): FunctionDefinitionNode {
  const call = new ExpressionStatementNode(
    new ExternalFunctionCallNode('IOther', new IdentifierNode('target'), 'ping', []),
  );
  const write = new MappingAssignNode('balances', [new IdentifierNode('to')], new IntLiteralNode(1n));
  write.entrySlotIndex = 0;
  const entry = new FunctionDefinitionNode('move', [], new BlockNode([
    new BranchNode(new BoolLiteralNode(true), new BlockNode([call]), new BlockNode([])), write,
  ]));
  entry.sortedBatchInfo = [{ collection: 'balances', slotIndices: [0] }];
  return entry;
}

/** The same body with a call after the write, which the declared count does not account for. */
function bodyWithCallAfterWrite(): FunctionDefinitionNode {
  const call = new ExpressionStatementNode(
    new ExternalFunctionCallNode('IOther', new IdentifierNode('target'), 'ping', []),
  );
  const write = new MappingAssignNode('balances', [new IdentifierNode('to')], new IntLiteralNode(1n));
  write.entrySlotIndex = 0;
  const entry = new FunctionDefinitionNode('move', [], new BlockNode([write, call]));
  entry.sortedBatchInfo = [{ collection: 'balances', slotIndices: [0] }];
  return entry;
}

describe('the segment a derived mapping write lands in', () => {
  it('is the frame\'s first when the write precedes every call a branch-free reach reaches', () => {
    expect(perCallBatchWriteSegment(bodyWithCallFreeBranch())).toBe(0);
  });

  it('leaves the count open when a branch that reaches a call decides it', () => {
    expect(perCallBatchWriteSegment(bodyWithCallBeforeWrite())).toBeUndefined();
  });
});

describe('whether every call precedes the write', () => {
  it('is true when a call the source makes conditionally still precedes the write', () => {
    expect(perCallBatchWriteFollowsEveryCall(bodyWithCallBeforeWrite())).toBe(true);
  });

  it('is false when a call follows the write, whose segment the declared count then does not name', () => {
    expect(perCallBatchWriteFollowsEveryCall(bodyWithCallAfterWrite())).toBe(false);
  });

  it('is true for a body that makes no call at all', () => {
    expect(perCallBatchWriteFollowsEveryCall(bodyWithCallFreeBranch())).toBe(true);
  });
});

describe('an entry whose write follows a call the source does not fix', () => {
  const CALL = 'IOther(0x1111111111111111111111111111111111111111).ping.call();';
  const CALL_CONTRACT = ' interface IOther { function ping(); }'
    + ' contract Other { function ping() { require(true); } }';

  it('is served, reading the segment the run\'s declared call count names', () => {
    const source = `pragma solidcash ^0.13.0;${CALL_CONTRACT}`
      + ' contract Ledger {'
      + '   mapping(address => uint) balances;'
      + '   function move(bool go, address to, uint amount) {'
      + `     if (go) { ${CALL} }`
      + '     balances[to] = amount;'
      + '   }'
      + ' }';
    expect(publishedRefusals(compileStringMulti(source, { composition: 'per-call' }) as
      Record<string, { composition?: unknown }>)).toStrictEqual([]);
  });

  it('stays refused when a call follows the write, so the declared count does not name its segment', () => {
    const source = `pragma solidcash ^0.13.0;${CALL_CONTRACT}`
      + ' contract Ledger {'
      + '   mapping(address => uint) balances;'
      + '   function move(bool go, address to, uint amount) {'
      + `     if (go) { ${CALL} }`
      + '     balances[to] = amount;'
      + `     ${CALL}`
      + '   }'
      + ' }';
    const refusals = publishedRefusals(compileStringMulti(source, { composition: 'per-call' }) as
      Record<string, { composition?: unknown }>);
    expect(refusals.map((refused) => refused.functionName)).toStrictEqual(['Ledger.move()']);
    expect(refusals[0]!.reason).toContain('cannot follow the segment the write lands in');
  });

  it('is served when its write precedes every call it makes', () => {
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
