import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { delegateImplMsgSenderCategory } from '../../src/stateful/covenant-helpers.js';

describe('delegateImplMsgSenderCategory', () => {
  const marketplace = 'a3cef94467cabf176d61e4793f3155f2afcb5b856bdbe6f2f6c57995a598083e';
  const marketplaceData = 'ee643a1671fbbe5333480fe40ff0fa72b65b6df0818805a2209586e991ca0af0';

  it('uses tx.origin (32 zero bytes) for this contract\'s own proxy implementation', () => {
    expect(delegateImplMsgSenderCategory(undefined, marketplace)).toEqual(new Uint8Array(32));
    expect(delegateImplMsgSenderCategory(marketplace, marketplace)).toEqual(new Uint8Array(32));
  });

  it('passes the caller category for a nested proxy implementation we invoked', () => {
    expect(binToHex(delegateImplMsgSenderCategory(marketplaceData, marketplace)))
      .toBe(binToHex(hexToBin(marketplace).reverse()));
  });
});
