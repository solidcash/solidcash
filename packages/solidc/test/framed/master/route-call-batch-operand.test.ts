import { describe, expect, it } from 'vitest';
import { compileString } from '../../../src/compiler.js';

/**
 * A framed compile under message-bus options builds the kernel route for the lowering it performs, then drops the
 * route's bodies. The route forwards the created-record count an entry that writes a sorted mapping takes, so its call
 * resolves against every parameter, while a source call leaves out the sorted-batch operands a master derives. Before,
 * the route failed its own type check on every such entry, and the admission ladder fell through to a narrower rung
 * after a full recompile.
 */

const OPTIONS = {
  evmCompat: true, messageBus: true, optimizeForCompilationSpeed: true, suppressWarnings: true,
  composition: 'framed',
};

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'contract Escrow {',
  '  struct Deal { address payee; uint256 amount; }',
  '  mapping(uint256 => Deal) private deals;',
  '  mapping(address => uint256) private owed;',
  '  function open(uint256 id, address payee, uint256 amount) external { deals[id] = Deal(payee, amount); }',
  '  function release(uint256 id) external { owed[deals[id].payee] += deals[id].amount; }',
  '}',
].join('\n');

describe('a framed compile whose message-bus route calls an entry that writes a sorted mapping', () => {
  it('compiles at the first admission rung, with no attempt caught', () => {
    const failures: { readonly stage: string; readonly message: string }[] = [];
    const artifact = compileString(SOURCE, { ...OPTIONS, __attemptFailureBox: { failures } } as never);
    expect(artifact.composition?.convention).toBe('framed');
    expect(failures.map((failure) => `${failure.stage}: ${failure.message.slice(0, 120)}`)).toStrictEqual([]);
  });
});
