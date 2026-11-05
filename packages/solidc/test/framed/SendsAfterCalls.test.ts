import { describe, expect, it } from 'vitest';
import type { PublishedEntryStopSites } from '@solidcash/utils';
import { compileStringMulti } from '../../src/compiler.js';

/**
 * A send the entry makes no call after is published as following every call, however many a loop before it makes.
 *
 * `after_` sends once its loop of calls is done: how many calls precede the send is open, but none follows it, so its
 * call into a contract's `receive()` takes its place after all of them. `between` sends before its loop, which calls
 * after it, so its send is not published as following the calls.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' interface ISink { function add(uint256 v) external; }'
  + ' contract Payer { uint256 public unit = 1;'
  + '   function after_(ISink sink, uint256[] memory xs, address payable to) external payable {'
  + '     for (uint256 i = 0; i < xs.length; i++) { sink.add(xs[i]); }'
  + '     (bool ok,) = to.call{value: msg.value}(""); require(ok, "send"); }'
  + '   function between(ISink sink, uint256[] memory xs, address payable to) external payable {'
  + '     (bool ok,) = to.call{value: msg.value}(""); require(ok, "send");'
  + '     for (uint256 i = 0; i < xs.length; i++) { sink.add(xs[i]); } } }';

const payer = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never).Payer!;
const published = (name: string): PublishedEntryStopSites => payer.composition!.stopSites!.entries
  .find((entry) => entry.functionName === `Payer.${name}()`)!;

describe('a send the entry makes no call after', () => {
  it('follows every call, though a loop before it leaves their count open', () => {
    expect(published('after_').sendCallsBefore).toBeUndefined();
    expect(published('after_').sendsAfterCalls).toStrictEqual([true]);
  });

  it('is not published as following the calls when a loop calls after it', () => {
    expect(published('between').sendsAfterCalls).toStrictEqual([false]);
  });
});
