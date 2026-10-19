import { describe, expect, it } from 'vitest';
import type { ExternalCallAbi } from '@solidcash/utils';
import { allocateCreateBuilderSharedFunders } from '../../src/stateful/sc-allocate-create-builder-shared-funders.js';

const callee = {
  categoryId: 'ab'.repeat(31) + '54',
  inner: { artifact: { abi: [{
    name: 'transferFrom', blockLayout: { slots: [{ kind: 'master' }, { kind: 'returnEvent' }] },
  }] } },
};
const funder = { txid: 'cd'.repeat(32), vout: 0, satoshis: 10_000n };
const host = {
  getSignerUtxos: async () => [funder],
  unlockP2PKH: () => ({
    generateLockingBytecode: () => new Uint8Array(),
    generateUnlockingBytecode: () => new Uint8Array(),
  }),
};

describe('create-builder nested funder allocation', () => {
  it('reserves a return-event funder for a named direct callee', async () => {
    const result = await allocateCreateBuilderSharedFunders(host, [{
      interfaceName: 'IToken', functionName: 'transferFrom', requiredDataNftIndices: [],
    }] as ExternalCallAbi[], [{ externalContract: callee, functionName: 'transferFrom' }], undefined);
    expect(result.sharedFunderPool).toHaveLength(1);
  });

  it('reserves a return-event funder for a selector-bound raw callee', async () => {
    const result = await allocateCreateBuilderSharedFunders(host, [{
      interfaceName: '__raw__', functionName: '__raw__', rawSelector: '4b6685e7',
      requiredDataNftIndices: [],
    }] as ExternalCallAbi[], [{ externalContract: callee, functionName: 'transferFrom' }], undefined);
    expect(result.sharedFunderPool).toHaveLength(1);
  });
});
