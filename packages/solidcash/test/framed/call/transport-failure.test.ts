import { describe, expect, it } from 'vitest';
import { FramedCompositionRefusedError } from '../../../src/framed/composer/refusal.js';
import { isTransportFailure } from '../../../src/framed/call/transport-failure.js';

/**
 * What ends a call's search over plans. A dropped connection says nothing about the plan it interrupted, so a search
 * that took it for a failed plan reported another plan's refusal: a devnet under load read `WETH9: Error` on an
 * `addLiquidityETH` whose only fault was a request that timed out.
 */
describe('what stops a call\'s search over plans', () => {
  it.each([
    'MemCashNetworkProvider: blockchain.transaction.get timed out after 10000ms (endpoint 127.0.0.1:8497)',
    'Connection lost',
    "Unable to send request to a disconnected server '127.0.0.1'.",
    'MemCashNetworkProvider: not connected',
    'TokenWebSocket: cannot write to a socket that is not open',
    'Request timeout',
    'connect ECONNREFUSED 127.0.0.1:50003',
  ])('stops on "%s"', (message) => {
    expect(isTransportFailure(new Error(message))).toBe(true);
  });

  it.each([
    'the callee "swap" reads a mapping node an earlier frame of its contract created, but no frame of the call places an output for it',
    'FRAMED_COMPOSITION_REFUSED: frame "master" of Pair.swap() at line 12',
    'a settlement lists created output 9, which the plan\'s trailing region does not create',
  ])('leaves a planning failure to the search: "%s"', (message) => {
    expect(isTransportFailure(new Error(message))).toBe(false);
  });

  it('never reads a contract\'s own refusal as the network, whatever its revert string says', () => {
    const refused = Object.create(FramedCompositionRefusedError.prototype) as Error;
    Object.defineProperty(refused, 'message', { value: 'frame "master" of Auction.bid() at line 9: auction timed out' });
    expect(isTransportFailure(refused)).toBe(false);
  });

  it('reads nothing but an error as a failure', () => {
    expect(isTransportFailure('timed out')).toBe(false);
    expect(isTransportFailure(undefined)).toBe(false);
  });
});
