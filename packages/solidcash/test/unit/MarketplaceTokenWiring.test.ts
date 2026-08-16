import { describe, expect, it } from 'vitest';
import {
  isMarketplaceConditionalTokenWriter,
  isMsgSenderKeySource,
  isSpeculativeSafeErc20Call,
  marketplaceJobTimedOut,
  providerUnixLocktime,
  marketplaceWriterTokenTransfer,
  selectorParamSlot,
  groupIndexForExternalCallSlot,
  marketplaceTokenCallsiteId,
} from '../../src/stateful/StatefulContract.js';

describe('msg.sender mapping-key encodings', () => {
  it('treats CALL msg.sender as a sender-keyed mapping source', () => {
    // Nested CALL `msg.sender` and `address(this)` must hash the same CREATE-identity lock
    // (`this.target`) so transferFrom `_balances[to]` is the entry transfer later debits.
    expect(isMsgSenderKeySource({ kind: 'expression', expressionLabel: 'nullop:msg.sender' })).toBe(true);
  });

  it('recognizes every compiler form of a msg.sender key', () => {
    expect(isMsgSenderKeySource({ kind: 'msgSender' })).toBe(true);
    expect(isMsgSenderKeySource({ kind: 'expression', expressionLabel: 'nullop:msg.sender' })).toBe(true);
    expect(isMsgSenderKeySource({ kind: 'expression', expressionLabel: 'sender:msg.sender' })).toBe(true);
    expect(isMsgSenderKeySource({ kind: 'expression', expressionLabel: 'call:_msgSender()' })).toBe(true);
    expect(isMsgSenderKeySource({ kind: 'param', paramName: 'to' } as { kind: string })).toBe(false);
    expect(isMsgSenderKeySource({ kind: 'expression', expressionLabel: 'id:from' })).toBe(false);
  });
});

describe('marketplace conditional SafeERC20 wiring', () => {
  it('treats closeJob and updateJobPost as writers with speculative raw transfers', () => {
    expect(isMarketplaceConditionalTokenWriter('closeJob')).toBe(true);
    expect(isMarketplaceConditionalTokenWriter('updateJobPost')).toBe(true);
    expect(isMarketplaceConditionalTokenWriter('reopenJob')).toBe(true);
    expect(isMarketplaceConditionalTokenWriter('withdrawCollateral')).toBe(true);
    expect(isMarketplaceConditionalTokenWriter('publishJobPost')).toBe(false);
    expect(isSpeculativeSafeErc20Call({
      interfaceName: '__raw__',
      rawFunctionName: 'transfer',
    })).toBe(true);
    expect(isSpeculativeSafeErc20Call({
      interfaceName: 'MarketplaceDataV1',
      rawFunctionName: 'publishJobEvent',
    })).toBe(false);
  });

  it('does not bind an omitted conditional callsite to the next compact child', () => {
    const calls = [
      { callsiteId: 0, occurrence: 'conditional' },
      { callsiteId: 1, occurrence: 'conditional' },
    ];
    const byCallsite = new Map([[1, 7]]);
    expect(groupIndexForExternalCallSlot({
      slot: 0, externalCalls: calls, groupByCallsite: byCallsite, compactGroups: [7],
    })).toBeUndefined();
    expect(groupIndexForExternalCallSlot({
      slot: 1, externalCalls: calls, groupByCallsite: byCallsite, compactGroups: [7],
    })).toBe(7);
    expect(groupIndexForExternalCallSlot({
      slot: 0,
      externalCalls: [{ callsiteId: 0, occurrence: 'conditional' }],
      groupByCallsite: byCallsite,
      compactGroups: [7],
    })).toBeUndefined();
    expect(groupIndexForExternalCallSlot({
      slot: 0, externalCalls: [{ callsiteId: 0, occurrence: 'once' }],
      groupByCallsite: new Map(), compactGroups: [7],
    })).toBe(7);
    expect(groupIndexForExternalCallSlot({
      slot: 0, externalCalls: [{}], groupByCallsite: undefined, compactGroups: [7],
    })).toBe(7);
  });

  it('binds the active SafeERC20 extra transfer to its ABI callsite', () => {
    const calls = [
      { callsiteId: 2, interfaceName: '__raw__', rawFunctionName: 'transferFrom' },
      { callsiteId: 3, interfaceName: '__raw__', rawFunctionName: 'transfer' },
    ];
    expect(marketplaceTokenCallsiteId(calls, 'transferFrom')).toBe(2);
    expect(marketplaceTokenCallsiteId(calls, 'transfer')).toBe(3);
    expect(marketplaceTokenCallsiteId(calls, 'approve')).toBeUndefined();
  });

  it('maps an unsuffixed selector param onto the unique verified slot, not slot 0', () => {
    const closeJobCalls = [
      { needsSelectorVerification: false },
      { needsSelectorVerification: true },
    ];
    expect(selectorParamSlot('__internal__externalCallSelector', closeJobCalls)).toBe(1);
    expect(selectorParamSlot('__internal__externalCallSelector0', closeJobCalls)).toBe(0);
    expect(selectorParamSlot('__internal__externalCallSelector1', closeJobCalls)).toBe(1);
    expect(selectorParamSlot('__internal__externalCallSelector', [
      { needsSelectorVerification: true },
    ])).toBe(0);
    expect(selectorParamSlot('__internal__externalCallSelector', [
      { needsSelectorVerification: true },
      { needsSelectorVerification: true },
    ])).toBe(0);
  });

  it('plans the live SafeERC20 branch for reopen and withdraw', () => {
    const shared = {
      amount: 100n,
      signerAddress: 'user',
      marketplaceTarget: 'market',
      creator: 'creator',
    };
    expect(marketplaceWriterTokenTransfer({
      ...shared, writer: 'reopenJob', collateralOwed: 0n, timedOut: true,
    })).toEqual({
      tokenFunction: 'transferFrom',
      amount: 100n,
      tokenArgs: ['user', 'market', 100n],
    });
    expect(marketplaceWriterTokenTransfer({
      ...shared, writer: 'reopenJob', collateralOwed: 100n, timedOut: false,
    })).toBeUndefined();
    expect(marketplaceWriterTokenTransfer({
      ...shared, writer: 'withdrawCollateral', collateralOwed: 100n, timedOut: true,
    })).toEqual({
      tokenFunction: 'transfer',
      amount: 100n,
      tokenArgs: ['creator', 100n],
    });
    expect(marketplaceWriterTokenTransfer({
      ...shared, writer: 'withdrawCollateral', collateralOwed: 100n, timedOut: false,
    })).toBeUndefined();
    expect(marketplaceWriterTokenTransfer({
      ...shared, writer: 'closeJob', collateralOwed: 0n, timedOut: true,
    })?.tokenFunction).toBe('transfer');
    expect(marketplaceWriterTokenTransfer({
      ...shared, writer: 'closeJob', collateralOwed: 0n, timedOut: false,
    })).toBeUndefined();
  });

  it('stamps unix provider time as nLocktime and ignores height-mode tips', () => {
    expect(providerUnixLocktime({ getBlockTime: () => 1_700_133_726 })).toBe(1_700_133_725);
    expect(providerUnixLocktime({ getBlockTime: () => 200 })).toBeUndefined();
    expect(providerUnixLocktime({})).toBeUndefined();
  });

  it('does not refund closeJob before the 24h oracle timeout', () => {
    expect(marketplaceJobTimedOut({
      oracleNow: 100n,
      posted: 50n,
      mockNow: 1_000_000n,
    })).toBe(false);
    expect(marketplaceJobTimedOut({
      oracleNow: 86_500n,
      posted: 100n,
      mockNow: 1_000_000n,
    })).toBe(true);
    expect(marketplaceJobTimedOut({
      oracleNow: 1_700_000_000n,
      posted: 0n,
      mockNow: 1_700_000_000n,
    })).toBe(false);
    expect(marketplaceJobTimedOut({
      oracleNow: 1_700_000_000n,
      posted: 0n,
      mockPostedAt: 100n,
      mockNow: 86_600n,
    })).toBe(true);
    expect(marketplaceJobTimedOut({
      oracleNow: 1_700_000_000n,
      posted: 0n,
      mockPostedAt: 0n,
      mockNow: 1_700_000_000n,
    })).toBe(false);
  });
});
