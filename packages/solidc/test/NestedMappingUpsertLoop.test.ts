import { beforeAll, describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

// An external function hands its calldata arrays to an internal helper whose loop updates a nested mapping under a
// loop-invariant outer key (`balanceOf[to][ids[i]] += values[i]`). Inlining the helper must leave the loop reading
// the ABI arrays, not a compiler copy of them, so the write reaches the verified-mapping upsert loop.
const source = `
pragma solidity ^0.8.20;

contract BatchLedger {
  event BatchMoved(address indexed account, uint256[] ids, uint256[] values);

  mapping(address => mapping(uint256 => uint256)) public balanceOf;

  function batchCredit(uint256[] calldata ids, uint256[] calldata values) external {
    _batchCredit(msg.sender, ids, values);
  }

  function batchDebit(uint256[] calldata ids, uint256[] calldata values) external {
    _batchDebit(msg.sender, ids, values);
  }

  function _batchCredit(address to, uint256[] calldata ids, uint256[] calldata values) internal {
    require(to != address(0), "zero account");
    require(ids.length == values.length, "length mismatch");
    for (uint256 i = 0; i < ids.length; i++) {
      balanceOf[to][ids[i]] += values[i];
    }
    emit BatchMoved(to, ids, values);
  }

  function _batchDebit(address from, uint256[] calldata ids, uint256[] calldata values) internal {
    require(ids.length == values.length, "length mismatch");
    for (uint256 i = 0; i < ids.length; i++) {
      balanceOf[from][ids[i]] -= values[i];
    }
    emit BatchMoved(from, ids, values);
  }
}
`;

type Artifact = ReturnType<typeof compileString>;

describe('nested-mapping upsert loop in a helper over calldata arrays', () => {
  let artifact: Artifact;
  beforeAll(() => { artifact = compileString(source, { evmCompat: true }); });
  const loopOf = (name: string): NonNullable<Artifact['abi'][number]['sortedUpsertLoopInfo']>[number] | undefined => (
    artifact.abi.find((entry) => entry.name === name)?.sortedUpsertLoopInfo?.[0]
  );

  it('compiles the credit loop as an upsert keyed by the ABI arrays', () => {
    expect(loopOf('batchCredit')).toMatchObject({
      collection: 'balanceOf', varyingArrayParam: 'ids', valueArrayParam: 'values', op: '+',
    });
  });

  it('compiles the debit loop the same way', () => {
    expect(loopOf('batchDebit')).toMatchObject({
      collection: 'balanceOf', varyingArrayParam: 'ids', valueArrayParam: 'values', op: '-',
    });
  });
});
