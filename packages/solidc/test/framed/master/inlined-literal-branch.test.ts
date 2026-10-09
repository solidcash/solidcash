import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../src/compiler.js';
import { publishedRefusals } from './refused-entry.js';

/**
 * A helper's branch on a boolean parameter the call site binds to a literal.
 *
 * `MarketplaceV1.refuseArbitration` inlines `_refund(jobId_, false)`, whose `if (byWorker)` arm rewrites the
 * whitelist entry keyed by the job's worker, a field of an element of the dynamic `jobs` array. The arm never runs
 * there, but its write reached the entry's write analysis and refused the body. After inlining, an arm a literal
 * argument rules out is dropped, so the body carries only the writes it can make; the entry that passes `true` keeps
 * the arm and its write.
 */

const OPTIONS = { composition: 'framed', evmCompat: true } as never;

/** The marketplace's refund shape, with the whitelist update behind the helper's own flag. */
const source = (refuseCall: string): string => 'pragma solidity ^0.8.20;'
  + ' interface IData { function arbitratorRefused(address who) external; function userRefunded(address who) external; }'
  + ' interface IEscrow { function refund(uint256 id) external; }'
  + ' contract Jobs {'
  + '   struct Roles { address worker; address arbitrator; }'
  + '   struct Job { uint8 state; uint256 escrowId; Roles roles; }'
  + '   Job[] jobs;'
  + '   address data;'
  + '   address escrow;'
  + '   mapping(uint256 => mapping(address => bool)) whitelist;'
  + '   function _update(uint256 jobId, address[] memory allowed, address[] memory disallowed) internal {'
  + '     require(jobs[jobId].state == 0, "not open");'
  + '     for (uint256 i = 0; i < allowed.length; i++) { whitelist[jobId][allowed[i]] = true; }'
  + '     for (uint256 i = 0; i < disallowed.length; i++) { whitelist[jobId][disallowed[i]] = false; }'
  + '   }'
  + '   function _refund(uint256 jobId, bool byWorker) internal {'
  + '     Job storage job = jobs[jobId];'
  + '     require(job.state == 1, "invalid state");'
  + '     IEscrow(escrow).refund(job.escrowId);'
  + '     job.state = 0;'
  + '     job.escrowId = 0;'
  + '     if (byWorker) {'
  + '       IData(data).userRefunded(job.roles.worker);'
  + '       address[] memory disallowed = new address[](1);'
  + '       disallowed[0] = job.roles.worker;'
  + '       _update(jobId, new address[](0), disallowed);'
  + '     }'
  + '     job.roles.worker = address(0);'
  + '   }'
  + '   function refuse(uint256 jobId, bool flag) public {'
  + '     Job storage job = jobs[jobId];'
  + '     require(job.roles.arbitrator == msg.sender, "not arbitrator");'
  + '     IData(data).arbitratorRefused(msg.sender);'
  + `     if (job.state == 1) { ${refuseCall} }`
  + '     job.roles.arbitrator = address(0);'
  + '   }'
  + '   function refund(uint256 jobId) public {'
  + '     require(jobs[jobId].roles.worker == msg.sender, "not worker");'
  + '     _refund(jobId, true);'
  + '   }'
  + ' }';

/** The collections an entry's published accesses name. */
function collectionsOf(artifacts: ReturnType<typeof compileStringMulti>, entry: string): string[] {
  const fn = artifacts.Jobs!.abi.find((candidate) => candidate.name === entry)!;
  return [...new Set((fn.entryAccesses ?? []).map((access) => access.collection))];
}

describe('a helper branch a literal argument rules out', () => {
  it('serves the entry that passes false, and its body no longer writes the whitelist', () => {
    const artifacts = compileStringMulti(source('_refund(jobId, false);'), OPTIONS);
    expect(publishedRefusals(artifacts)).toStrictEqual([]);
    expect(collectionsOf(artifacts, 'refuse')).not.toContain('whitelist');
    // The entry that passes true keeps the arm, and its write.
    expect(collectionsOf(artifacts, 'refund')).toContain('whitelist');
  });

  it('keeps the arm when the argument is not a literal, so the write stays refused', () => {
    const artifacts = compileStringMulti(source('_refund(jobId, flag);'), OPTIONS);
    expect(publishedRefusals(artifacts).map((refusal) => refusal.functionName)).toStrictEqual(['Jobs.refuse()']);
    expect(publishedRefusals(artifacts)[0]!.reason).toContain("reads an element of the dynamic state array 'jobs'");
  });
});
