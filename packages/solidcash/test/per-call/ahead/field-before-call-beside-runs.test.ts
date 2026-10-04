import { describe, expect, it } from 'vitest';
import {
  compilePerCall, deployPlain, deployProxied, enterProxied, newWorld, recordMet,
} from './composition-world.js';

/**
 * Walls ahead: a field written before an external call into the data record whose dynamic values the entry appends
 * to past the call. A record a dynamic write sizes is published as written in the frame's last segment alone, where
 * the epilogue pins the runs (`perCallRecordWriteSegments`), while the body writes the count into it before the
 * call; the frame stops at the call on an `OP_VERIFY`. The same entry without the count settles, its runs laid past
 * the call (`call/dynamic-run-order.test.ts`), so the wall is the count's record, not the runs.
 *
 * The file runs only under `PER_CALL_AHEAD=1`.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IPing { function ping(uint256 k) external; }',
  'contract Sink {',
  '  uint256 lastPing;',
  '  function ping(uint256 k) external { lastPing = k; }',
  '}',
  'contract Journal {',
  '  address public implementation;',
  '  address public sink;',
  '  uint256 public entries;',
  '  string[] notes;',
  '  uint256[] stamps;',
  '  function initialize(address sink_) public { sink = sink_; }',
  '  function log(string calldata note, uint256 stamp) external {',
  '    entries += 1;',
  '    IPing(sink).ping(stamp);',
  '    stamps.push(stamp);',
  '    notes.push(note);',
  '  }',
  '}',
].join('\n');

describe.runIf(process.env.PER_CALL_AHEAD === '1')('ahead: a field written before a call beside runs past it', () => {
  it('through the hop: refuses a count written before a call beside two arrays appended past it (should settle '
    + 'once served)', async () => {
    const { Sink, Journal } = compilePerCall(SOURCE);
    const world = await newWorld(0x76);
    const sink = await deployPlain(world, Sink!);
    const journal = await deployProxied(world, Journal!, [sink.address]);
    const logged = await enterProxied(world, journal, 'log', ['first note', 5n], {
      IPing: { artifact: Sink!, categoryId: sink.categoryId },
    });
    recordMet('field-before-call-beside-runs', logged.error?.message);
    expect(logged.error?.message).toMatch(new RegExp('"log" entry did not settle through the proxy: frame '
      + '"implementation-master" of Journal\\.log\\(\\) at line \\d+: no source message \\(Program failed an '
      + 'OP_VERIFY operation\\.\\)'));
    expect(logged.coinSpent).toBe(false);
  }, 600_000);
});
