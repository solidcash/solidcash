import { describe, expect, it } from 'vitest';
import { FramedCompositionRefusedError } from '../../../src/framed/composer/refusal.js';
import { endsPlanSearch } from '../../../src/framed/call/transport-failure.js';

/**
 * What ends a call's search over plans. A dropped connection and a node's refusal say nothing about the plan they
 * interrupted, so a search that took them for a failed plan reported another plan's refusal: `addLiquidityETH` read
 * `WETH9: Error` on a devnet under load whose only fault was a request that timed out, and on a transaction that had
 * simply lost a race for a coin.
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
    'the transaction was rejected by network rules.\n\nbad-txns-inputs-missingorspent (code 16)\n',
    'the transaction was rejected by network rules.\n\ntxn-mempool-conflict (code 18)\n',
    'the transaction was rejected by network rules.\n\nMissing inputs\n',
    'the transaction was rejected by network rules.\n\ntx-size (code 64)\n',
  ])('stops on "%s"', (message) => {
    expect(endsPlanSearch(new Error(message))).toBe(true);
  });

  it.each([
    'the callee "swap" reads a mapping node an earlier frame of its contract created, but no frame of the call places an output for it',
    'FRAMED_COMPOSITION_REFUSED: frame "master" of Pair.swap() at line 12',
    'a settlement lists created output 9, which the plan\'s trailing region does not create',
  ])('leaves a planning failure to the search: "%s"', (message) => {
    expect(endsPlanSearch(new Error(message))).toBe(false);
  });

  it('never reads a contract\'s own refusal as the network, whatever its revert string says', () => {
    const refused = Object.create(FramedCompositionRefusedError.prototype) as Error;
    Object.defineProperty(refused, 'message', { value: 'frame "master" of Auction.bid() at line 9: auction timed out' });
    expect(endsPlanSearch(refused)).toBe(false);
  });

  it('reads nothing but an error as a failure', () => {
    expect(endsPlanSearch('timed out')).toBe(false);
    expect(endsPlanSearch(undefined)).toBe(false);
  });
});
