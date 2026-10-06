import { describe, expect, it } from 'vitest';
import type { ExternalCallExpression } from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';

/**
 * The condition a framed body's guarded verified-mapping write runs under, as its entry access publishes it.
 *
 * The condition is the conjunction of the predicates on the write's path, read where each branch starts, in the
 * language a conditional call site's condition is published in: an argument, `msg.sender`, a state field, a mapping
 * value. A branch whose other arm fails guards nothing, and a write the body makes wherever it reaches it - a cached
 * write flushed on a flag every path sets - publishes none. A predicate the frame's own facts do not decide is
 * published as `unsupported`, so a builder knows the write is skippable but not when.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'contract Guards {',
  '  address public owner;',
  '  bool public paused;',
  '  uint256 public count;',
  '  mapping(address => bool) private allowed;',
  '  mapping(address => uint256) private balances;',
  '  mapping(address => uint256) private limits;',
  '  function onArgument(address who, uint256 amount, bool add) external {',
  '    if (add) { balances[who] = amount; count += 1; }',
  '  }',
  '  function onTwoArms(address who, uint256 amount, bool high) external {',
  '    if (amount > 10) { if (!high) { balances[who] = amount; count += 1; } }',
  '  }',
  '  function onOtherMapping(address who, uint256 amount) external {',
  '    if (allowed[who] && msg.sender == owner) { balances[who] = amount; count += 1; }',
  '  }',
  '  function afterEarlyReturn(address who, uint256 amount) external {',
  '    if (!allowed[who]) { return; }',
  '    balances[who] = amount;',
  '    count += 1;',
  '  }',
  '  function behindRevert(address who, uint256 amount) external {',
  '    if (paused) { revert("paused"); }',
  '    if (msg.sender != owner) { revert("owner"); }',
  '    balances[who] = amount;',
  '    count += 1;',
  '  }',
  '  function onCachedFlag(address who, uint256 amount, bool add) external {',
  '    if (add) { balances[who] = balances[who] + amount; count += 1; }',
  '  }',
  '  function onFlagBothArms(address who, uint256 amount, bool add) external {',
  '    if (add) { balances[who] = balances[who] + amount; } else { balances[who] = balances[who] + 1; }',
  '    count += 1;',
  '  }',
  '  function belowMaximum(address who, uint256 amount) external {',
  '    uint256 limit = limits[who];',
  '    if (limit != type(uint256).max) { limits[who] = limit - amount; count += 1; }',
  '  }',
  '  function afterOwnWrite(address who, uint256 amount) external {',
  '    count += 1;',
  '    if (count > 2) { balances[who] = amount; count += 10; }',
  '  }',
  '}',
].join('\n');

const artifact = compileString(SOURCE, { solidityImportCompat: true, composition: 'framed' } as never);

/** The activation the entry publishes for its write of `collection`. */
function activationOf(entry: string, collection: string): ExternalCallExpression | undefined {
  return artifact.abi.find((candidate) => candidate.name === entry)?.entryAccesses
    ?.find((access) => access.collection === collection && access.operations.some((operation) => operation !== 'read'))
    ?.activation;
}

const forward = (paramIndex: number): ExternalCallExpression =>
  ({ kind: 'source', source: { kind: 'forward', paramIndex } });
const sender: ExternalCallExpression = { kind: 'source', source: { kind: 'msgSender' }, type: 'address' };
const not = (expression: ExternalCallExpression): ExternalCallExpression => ({ kind: 'unary', operator: '!', expression });
const allowedOf = (who: ExternalCallExpression): ExternalCallExpression =>
  ({ kind: 'stateAccess', name: 'allowed', args: [who], type: 'bool' });

describe('the condition a framed guarded mapping write publishes', () => {
  it('serves every entry', () => {
    expect(artifact.composition?.refusedEntries ?? []).toStrictEqual([]);
  });

  it('publishes an argument, a conjunction of nested arms and another mapping read where the branch starts', () => {
    expect(activationOf('onArgument', 'balances')).toStrictEqual(forward(2));
    expect(activationOf('onTwoArms', 'balances')).toStrictEqual({
      kind: 'binary', operator: '&&',
      left: { kind: 'binary', operator: '>', left: forward(1), right: { kind: 'literal', type: 'bigint', value: '10' } },
      right: not(forward(2)),
    });
    expect(activationOf('onOtherMapping', 'balances')).toStrictEqual({
      kind: 'binary', operator: '&&', left: allowedOf(forward(0)),
      right: { kind: 'binary', operator: '==', left: sender, right: { kind: 'state', name: 'owner' } },
    });
  });

  it('publishes the guard an early return puts the write under', () => {
    expect(activationOf('afterEarlyReturn', 'balances')).toStrictEqual(not(not(allowedOf(forward(0)))));
  });

  it('publishes the flag a cached read-modify-write is flushed on as the arm that sets it', () => {
    expect(activationOf('onCachedFlag', 'balances')).toStrictEqual(forward(2));
  });

  it('publishes a bound of the value type the guard compares with', () => {
    expect(activationOf('belowMaximum', 'limits')).toStrictEqual({
      kind: 'binary', operator: '!=',
      left: { kind: 'stateAccess', name: 'limits', args: [forward(0)], type: 'uint256' },
      right: { kind: 'literal', type: 'bigint', value: ((1n << 256n) - 1n).toString() },
    });
  });

  it('publishes none for a write every completing path makes', () => {
    // The arms that revert leave the frame no completing path that skips the write.
    expect(activationOf('behindRevert', 'balances')).toBeUndefined();
    // Both arms set the flag the write is flushed on.
    expect(activationOf('onFlagBothArms', 'balances')).toBeUndefined();
  });

  it('publishes a guard over a value the body writes before the branch as one the frame cannot decide', () => {
    expect(activationOf('afterOwnWrite', 'balances')).toStrictEqual({ kind: 'unsupported' });
  });
});
