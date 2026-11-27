/**
 * Records the SDK builds from values carry each value as its covenant pushes it. An event argument the call passes in
 * is that argument as the call passes it, so an all-zero byte array given as an `address` is address(0), OP_0, as the
 * call encodes it. A native call result pushes an address whole, so the 20 zero bytes a refused recovery answers stay
 * a 20-byte push. A detached event is written in the frame the event's emit writes, `notation: 'evm'` included.
 */
import { describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush, hexToBin } from '@bitauth/libauth';
import { encodeEventCommitment, type EventDefinitionAbi, type StructDefinitionInfo } from '@solidcash/utils';
import { eventValueOfSource } from '../../src/Argument.js';
import { synthesizeTransferFromEventCommitments } from '../../src/stateful/stb-token-writer-event-repair.js';
import {
  encodeExternalReturnValue, encodeExternalReturnValues,
} from '../../src/stateful/external-return-encoding.js';
import { encodeExternalReturnValue as encodeStatefulContractReturnValue } from '../../src/stateful/StatefulContract.js';
import { StatefulTransactionBuilder } from '../../src/stateful/StatefulTransactionBuilder.js';
import { createTestProvider } from '../test-util.js';

const ZERO20 = new Uint8Array(20);
const ZERO20_PUSH = `14${'00'.repeat(20)}`;
const P2PKH = hexToBin('76a91471782e8159265ed94bd35b8e699c08f53a6f38c688ac');
const P2PKH_PUSH = binToHex(encodeDataPush(P2PKH));

describe('a runtime event argument the call passes in', () => {
  it('is emitted as the call passes it; a value of the body\'s own keeps its bytes', () => {
    for (const kind of ['forward', 'arrayElement', 'constructorArg']) {
      const passedIn = eventValueOfSource({ kind: 'source', source: { kind } }, ZERO20, 'address');
      expect(passedIn, kind).toEqual(new Uint8Array(0));
      expect(binToHex(encodeEventCommitment([{ type: 'address' }], [passedIn as Uint8Array])), kind).toBe('00');
    }
    for (const expression of [{ kind: 'state' }, { kind: 'source', source: { kind: 'expression' } }]) {
      const own = eventValueOfSource(expression, ZERO20, 'address');
      expect(own).toBe(ZERO20);
      expect(binToHex(encodeEventCommitment([{ type: 'address' }], [own as Uint8Array]))).toBe(ZERO20_PUSH);
    }
    expect(eventValueOfSource({ kind: 'source', source: { kind: 'forward' } }, P2PKH, 'address')).toBe(P2PKH);
  });
});

describe('the transferFrom events the token writer repair builds', () => {
  it('carry an all-zero `to` argument as the call passes it', () => {
    const categoryId = 'bb'.repeat(32);
    const group = {
      functionName: 'transferFrom',
      categoryId,
      externalContract: {
        inner: {
          addressType: 'p2sh32',
          artifact: {
            structs: [],
            abi: [{
              name: 'transferFrom', inputs: [], outputs: [],
              emits: [
                { eventName: 'Approval', eventSignature: 'Approval(address,address,uint256)', emitIndex: 0 },
                { eventName: 'Transfer', eventSignature: 'Transfer(address,address,uint256)', emitIndex: 1 },
              ],
            }],
          },
        },
      },
      functionArgs: [P2PKH, ZERO20, 3n],
    };
    const host = {
      allInputs: [], externalCallUtxoGroups: [],
      findMintingInputIndex: (): number => -1, getExternalCallMasterInputIndex: (): number => -1,
    };
    // The allowance record after the debit, at the master's index plus three: 64 bytes, then the allowance 5.
    const plain = { to: Uint8Array.of(0x51), amount: 1000n };
    const allowance = {
      ...plain,
      token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: `${'00'.repeat(64)}05` } },
    };
    const events = synthesizeTransferFromEventCommitments(
      host as never, { outputs: [plain, plain, plain, allowance] } as never, group as never, 0,
    );
    expect(events).toBeDefined();
    // Approval(from, spender, 5): the spender is `to` here; Transfer(from, to, 3).
    expect(events![0]!.commitment).toBe(`${P2PKH_PUSH}0055`);
    expect(events![1]!.commitment).toBe(`${P2PKH_PUSH}0053`);
  });
});

describe('a native call result', () => {
  const structs: StructDefinitionInfo[] = [{
    name: 'Signed', fields: [{ name: 'who', type: 'address' }, { name: 'nonce', type: 'uint8' }],
  }];

  it('pushes the 20 zero bytes of a refused recovery as 20 bytes, and address(0) as OP_0', () => {
    expect(binToHex(encodeExternalReturnValue(ZERO20, 'address', [], false))).toBe(ZERO20_PUSH);
    expect(binToHex(encodeStatefulContractReturnValue(ZERO20, 'address', [], false))).toBe(ZERO20_PUSH);
    expect(binToHex(encodeExternalReturnValue(new Uint8Array(0), 'address', [], false))).toBe('00');
    expect(binToHex(encodeExternalReturnValues([ZERO20, 7n], ['address', 'uint8'], [], false)))
      .toBe(`${ZERO20_PUSH}57`);
    expect(binToHex(encodeExternalReturnValue({ who: ZERO20, nonce: 7n }, 'Signed', structs, false)))
      .toBe(`${ZERO20_PUSH}57`);
  });

});

describe('a detached event', () => {
  it('writes each argument in the frame its emit writes, an evm-notation number and 20 zero bytes too', () => {
    const categoryId = `${'aa'.repeat(31)}55`;
    const unlocker = {
      generateLockingBytecode: (): Uint8Array => P2PKH,
      generateUnlockingBytecode: (): Uint8Array => Uint8Array.of(1, 1),
    };
    const moved: EventDefinitionAbi = {
      name: 'Moved',
      signature: 'Moved(address,uint256)',
      parameters: [{ name: 'who', type: 'address' }, { name: 'amount', type: 'uint256', notation: 'evm' }],
    };
    const builder = new StatefulTransactionBuilder({
      provider: createTestProvider(),
      masterUtxo: {
        txid: 'bb'.repeat(32), vout: 0, satoshis: 10_000n, unlocker,
        token: { category: categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      },
      dataNftUtxos: [{
        txid: 'bb'.repeat(32), vout: 1, satoshis: 10_000n, unlocker,
        token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: '00' } },
      }],
      stateLayout: {
        variables: [{ name: 'counter', type: 'int', nftIndex: 0, fieldIndex: 0 }], dataNftCount: 1, commitmentLimit: 128,
      },
      categoryId,
      eventDefinitions: [moved],
    } as never);
    builder.emitDetachedEvent('Moved', ZERO20, 5n);
    const receipts = (builder as unknown as { detachedEventReceipts: Array<{ commitment: string }> })
      .detachedEventReceipts;
    expect(receipts.map((receipt) => receipt.commitment)).toEqual([`${ZERO20_PUSH}${'00'.repeat(31)}05`]);
  });
});
