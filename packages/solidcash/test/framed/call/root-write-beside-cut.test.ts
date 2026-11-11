import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, lockingBytecodeToCashAddress, sha256 } from '@bitauth/libauth';
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
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { collectionKeyEncoding } from '../../../src/framed/composer/mapping-plan.js';
import { bytesToSlotValue, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { alicePkh, alicePriv } from '../../fixture/vars.js';

/**
 * An entry that rewrites a mapping node beside a helper of its own contract that keeps the same node.
 *
 * `burn` reads the holder's balance, calls the `fee` helper, and writes the balance back; the split cuts `fee` out as
 * an INTERNAL frame of its own masters. `fee` writes `balanceOf[feeTo]` only when `k` is not zero. A skipped write
 * still declares the node that brackets its absent key, kept, as the helper's one record for it, and with the holder's
 * node the only one below `feeTo`'s slot, that node is the holder's: the node `burn` itself rewrites. The entry named it
 * by its slot and the helper by the id the contract's frames share, so the call placed one node as two inputs, the
 * derivation accepted each, and the broadcast refused the transaction ("Duplicate input detected"). That is
 * UniswapV2Pair's `burn` with the protocol fee on and `kLast` zero, whenever the pair's own LP node sat right below
 * `feeTo`'s, which its random category decided for about half of the pairs a run created.
 *
 * With `k` set, `fee` inserts `feeTo` after the holder's node, relinking it, before `burn` rewrites its value: one
 * input again, its declarations chained in the order the frames run.
 */

const FRAMED = { composition: 'framed' as const, suppressWarnings: true, evmCompat: true, forceStateful: true };
const VALIDATOR = framedValidator.buildValidatorProgram();
const SOURCE = `pragma solidity ^0.8.0;
contract Ledger {
  uint public kLast;
  mapping(address => uint) public balanceOf;
  function credit(address to, uint amount) public {
    balanceOf[to] = balanceOf[to] + amount;
  }
  function fee(address feeTo, uint k) internal returns (bool) {
    bytes memory b = hex"${'ab'.repeat(3000)}";
    require(b.length > 0);
    if (k != 0) balanceOf[feeTo] = balanceOf[feeTo] + k;
    return k != 0;
  }
  function burn(address holder, address feeTo, uint k, uint amount) public {
    uint held = balanceOf[holder];
    bool on = fee(feeTo, k);
    balanceOf[holder] = held - amount;
    if (on) kLast = held;
  }
}`;

const open = compileStringSplit(SOURCE, { split: 'func', ...FRAMED });
const inlined = asmToBytecode(open.shards.find((shard) => shard.function === 'burn')!.artifact.bytecode).length;
const split = compileStringSplit(SOURCE, { split: 'func', ...FRAMED, maxShardBytes: inlined - 1 });

const encoding = collectionKeyEncoding(split.logical, 'balanceOf');
const slotOf = (lock: Uint8Array): bigint => bytesToSlotValue(keyToSlotMulti([lock], encoding));
const HOLDER = encodeLockingBytecodeP2pkh(alicePkh);
/** The first of a run of P2PKH locks whose slot lies above the holder's: the holder's node brackets it. */
const FEE_TO = ((): Uint8Array => {
  for (let at = 0; ; at += 1) {
    const lock = encodeLockingBytecodeP2pkh(sha256.hash(new TextEncoder().encode(`fee-to ${at}`)).slice(0, 20));
    if (slotOf(lock) > slotOf(HOLDER)) return lock;
  }
})();

let nonce = 0x8400;
function freshCoin(satoshis: bigint): Utxo {
  nonce += 1;
  return { txid: nonce.toString(16).padStart(64, '0'), vout: 0, satoshis };
}

describe('an entry that rewrites a node a helper of its contract keeps', () => {
  it('cuts the helper as one INTERNAL shard', () => {
    expect(split.internalCuts.map((cut) => cut.name)).toStrictEqual(['fee(address,uint256)']);
  });

  it('spends the node once, whether the helper skips its write or relinks the node', async () => {
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
    const call = async (
      functionName: string, args: readonly (Uint8Array | bigint)[],
    ): Promise<Awaited<ReturnType<typeof callFramedEntry>>> => {
      const callerUtxo = freshCoin(300_000n);
      await provider.addUtxo(binToHex(callerLock), callerUtxo);
      const result = await callFramedEntry({
        provider, artifact: split.logical, categoryId, functionName, args: [...args], callerUtxo,
        callerLockingBytecode: callerLock, funder: signature.unlockP2PKH(), split, vm: compositionMachine(),
        validatorProgram: VALIDATOR,
      });
      const objections = result.verdicts.filter((verdict) => !verdict.accepted)
        .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ');
      expect(result.accepted, `${functionName}: ${objections}`).toBe(true);
      return result;
    };
    const balanceOf = async (lock: Uint8Array): Promise<unknown> => (await readFramedEntry({
      provider, artifact: split.logical, categoryId, functionName: 'balanceOf', args: [lock], vm: compositionMachine(),
    })).value;

    await call('credit', [HOLDER, 100n]);

    // `fee` skips its write, keeping the holder's node, which `burn` then rewrites.
    const skipped = await call('burn', [HOLDER, FEE_TO, 0n, 30n]);
    expect(skipped.completed.map((frame) => [frame.functionName, frame.kind])).toStrictEqual([
      ['Ledger.fee()', FrameKind.INTERNAL], ['Ledger.burn()', FrameKind.ROOT],
    ]);
    const inputs = skipped.transaction.inputs.map((input) =>
      `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`);
    expect(new Set(inputs).size).toBe(inputs.length);
    expect([await balanceOf(HOLDER), await balanceOf(FEE_TO)]).toStrictEqual([70n, 0n]);

    // `fee` inserts `feeTo` after the holder's node, relinking it, and `burn` rewrites its value after.
    await call('burn', [HOLDER, FEE_TO, 5n, 30n]);
    expect([await balanceOf(HOLDER), await balanceOf(FEE_TO)]).toStrictEqual([40n, 5n]);
    const state = await readFramedState(provider, categoryId, split.logical.stateLayout!);
    expect(state.byNft[0]!.kLast).toBe(70n);
  }, 600_000);
});
