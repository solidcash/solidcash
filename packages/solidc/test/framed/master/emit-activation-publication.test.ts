import { describe, expect, it } from 'vitest';
import type { ExternalCallExpression } from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';

/**
 * The condition a per-call body's guarded emit runs under, as its `emits` row publishes it.
 *
 * A frame lists every emit's output, and one the body skips carries the empty commitment, so a builder decides the
 * condition from the frame's facts as it decides a guarded write's (`write-activation-publication.test.ts`), in the
 * same language. Exclusive arms that emit into one slot publish the condition either runs under. An emit every
 * completing path makes publishes none: one outside any branch, one past a branch whose other arm reverts, and one
 * on both arms of a branch. A predicate over a value the body writes before the branch is published as
 * `unsupported`, which a builder learns from the frame's own close.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'contract Emits {',
  '  address public owner;',
  '  uint256 public count;',
  '  mapping(address => bool) private allowed;',
  '  event Seen(address who);',
  '  event Counted(uint256 count);',
  '  event Picked(uint256 value);',
  '  function onArgument(address who, bool loud) external { if (loud) { emit Seen(who); } }',
  '  function onMapping(address who) external {',
  '    if (allowed[who] && msg.sender == owner) { emit Seen(who); }',
  '  }',
  '  function onElse(address who, bool quiet) external { if (quiet) { count += 1; } else { emit Seen(who); } }',
  '  function onEitherArm(bool high) external { if (high) { emit Picked(2); } else { emit Picked(1); } }',
  '  function onEitherOf(bool first, bool second) external {',
  '    if (first) { emit Picked(1); } else if (second) { emit Picked(2); }',
  '  }',
  '  function behindRevert(address who) external {',
  '    if (!allowed[who]) { revert("not allowed"); }',
  '    emit Seen(who);',
  '  }',
  '  function always(address who) external { emit Seen(who); }',
  '  function afterOwnWrite() external { count += 1; if (count > 2) { emit Counted(count); } }',
  '}',
].join('\n');

const artifact = compileString(SOURCE, { solidityImportCompat: true, composition: 'per-call' } as never);

/** The activation each emit of the entry publishes, in emit order. */
function activationsOf(entry: string): readonly (ExternalCallExpression | undefined)[] {
  return (artifact.abi.find((candidate) => candidate.name === entry)?.emits ?? []).map((emit) => emit.activation);
}

const forward = (paramIndex: number): ExternalCallExpression =>
  ({ kind: 'source', source: { kind: 'forward', paramIndex } });

describe('the condition a per-call guarded emit publishes', () => {
  it('serves every entry', () => {
    expect(artifact.composition?.refusedEntries ?? []).toStrictEqual([]);
  });

  it('publishes an argument, another mapping read beside the sender, and an else arm negated', () => {
    expect(activationsOf('onArgument')).toStrictEqual([forward(1)]);
    expect(activationsOf('onMapping')).toStrictEqual([{
      kind: 'binary', operator: '&&',
      left: { kind: 'stateAccess', name: 'allowed', args: [forward(0)], type: 'bool' },
      right: {
        kind: 'binary', operator: '==',
        left: { kind: 'source', source: { kind: 'msgSender' }, type: 'address' },
        right: { kind: 'state', name: 'owner' },
      },
    }]);
    expect(activationsOf('onElse')).toStrictEqual([{ kind: 'unary', operator: '!', expression: forward(1) }]);
  });

  it('publishes the condition either of two exclusive arms that emit into one slot runs under', () => {
    expect(activationsOf('onEitherOf')).toStrictEqual([{
      kind: 'binary', operator: '||', left: forward(0),
      right: {
        kind: 'binary', operator: '&&', left: { kind: 'unary', operator: '!', expression: forward(0) },
        right: forward(1),
      },
    }]);
  });

  it('publishes none for an emit every completing path makes', () => {
    expect(activationsOf('onEitherArm')).toStrictEqual([undefined]);
    expect(activationsOf('behindRevert')).toStrictEqual([undefined]);
    expect(activationsOf('always')).toStrictEqual([undefined]);
  });

  it('publishes a guard over a value the body writes before the branch as one the frame cannot decide', () => {
    expect(activationsOf('afterOwnWrite')).toStrictEqual([{ kind: 'unsupported' }]);
  });
});
