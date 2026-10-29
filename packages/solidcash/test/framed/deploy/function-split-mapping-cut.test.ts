import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { FrameKind, asmToBytecode } from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc/runtime';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringSplit } from '../../../../solidc/src/compiler.js';
import { SignatureTemplate } from '../../../src/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readFramedState } from '../../../src/framed/deploy/index.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import { alicePkh, alicePriv } from '../../fixture/vars.js';

/**
 * A helper cut out of its entry that writes a mapping, called twice by the entry, the second time for `address(0)`.
 *
 * `pub` calls `mark` for its sender and then for the zero address, and the split cuts both calls to one helper: each
 * runs as an INTERNAL frame of the cut's own masters, adds to `total`, writes a node of `marks` and returns the node's
 * value. The zero address reaches its frame as the empty lock a call argument states for it, which the record's
 * digest binds on both sides. Three calls settle one after another, each one's frames reading the record and the nodes
 * the calls before it left, so `total` ends at the sum of every amount the six frames added.
 */

const FRAMED = { composition: 'framed' as const, suppressWarnings: true, evmCompat: true, forceStateful: true };
const VALIDATOR = framedValidator.buildValidatorProgram();
const SOURCE = `pragma solidity ^0.8.0;
contract Book {
  uint public total;
  mapping(address => uint) public marks;
  function mark(address who, uint112 k) internal returns (uint) {
    bytes memory b = hex"${'ab'.repeat(3000)}";
    require(b.length > 0);
    total = total + k;
    marks[who] = marks[who] + k;
    return marks[who];
  }
  function pub(uint id, uint112 k) public {
    uint v = mark(msg.sender, k);
    mark(address(0), 1);
    require(v >= k && id >= 0);
  }
}`;

const open = compileStringSplit(SOURCE, { split: 'func', ...FRAMED });
const inlined = asmToBytecode(open.shards.find((shard) => shard.function === 'pub')!.artifact.bytecode).length;
const split = compileStringSplit(SOURCE, { split: 'func', ...FRAMED, maxShardBytes: inlined - 1 });

let nonce = 0x7300;
function freshCoin(satoshis: bigint): Utxo {
  nonce += 1;
  return { txid: nonce.toString(16).padStart(64, '0'), vout: 0, satoshis };
}

describe('an internal cut that writes a mapping', () => {
  it('cuts both calls to the helper as one INTERNAL shard', () => {
    expect(split.internalCuts.map((cut) => cut.name)).toStrictEqual(['mark(address,uint112)']);
  });

  it('settles each call with both helper frames, across three calls', async () => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
    const funding = freshCoin(800_000n);
    await provider.addUtxo(binToHex(callerLock), funding);
    const encoded = lockingBytecodeToCashAddress({ bytecode: callerLock, prefix: 'bchtest' });
    if (typeof encoded === 'string') throw new Error(encoded);
    const { categoryId } = await deployStatefulContract(split.logical, [], {
      provider, fundingUtxo: funding, funder: signature.unlockP2PKH(), changeAddress: encoded.address,
      threadCount: 4, validatorCount: 1, functionSplit: split,
    });
    for (const [at, [id, k]] of ([[7n, 5n], [7n, 2n], [3n, 1n]] as const).entries()) {
      const callerUtxo = freshCoin(300_000n);
      await provider.addUtxo(binToHex(callerLock), callerUtxo);
      const result = await callFramedEntry({
        provider, artifact: split.logical, categoryId, functionName: 'pub', args: [id, k], callerUtxo,
        callerLockingBytecode: callerLock, funder: signature.unlockP2PKH(), split, vm: compositionMachine(),
        validatorProgram: VALIDATOR,
      });
      const objections = result.verdicts.filter((verdict) => !verdict.accepted)
        .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ');
      expect(result.accepted, `call ${at}: ${objections}`).toBe(true);
      expect(result.completed.map((frame) => [frame.functionName, frame.kind])).toStrictEqual([
        ['Book.mark()', FrameKind.INTERNAL], ['Book.mark()', FrameKind.INTERNAL], ['Book.pub()', FrameKind.ROOT],
      ]);
    }
    const state = await readFramedState(provider, categoryId, split.logical.stateLayout!);
    expect(state.byNft[0]!.total).toBe(11n);
  }, 600_000);
});
