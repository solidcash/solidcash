import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { FrameKind, asmToBytecode, type FunctionSplitBundle } from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc/runtime';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringSplit } from '../../../../solidc/src/compiler.js';
import { SignatureTemplate } from '../../../src/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readFramedState } from '../../../src/framed/deploy/index.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import { alicePkh, alicePriv } from '../../fixture/vars.js';

/**
 * A helper cut out of its entry that only reads the record its entry then writes, driven through the shipped call
 * path.
 *
 * `pub` calls `peek`, which carries most of the code and reads `x`; `pub` then writes `x` and `y` from the result. So
 * `peek` runs as an INTERNAL frame that declares `pub`'s record kept, and `pub` writes the record after it: the
 * record's output is the end of its declaration chain, `pub`'s write, not the view the kept declaration carries.
 * `UniswapV2Pair.mint` entered directly is this shape, its helpers reading the record its last segment writes.
 */

const FRAMED = { composition: 'framed' as const, suppressWarnings: true };
const VALIDATOR = framedValidator.buildValidatorProgram();
const SOURCE = `pragma solidcash ^0.51.0;
contract Ledger {
  int x;
  int y;
  function peek(int k) internal returns (int) {
    bytes b = hex"${'ab'.repeat(3000)}";
    require(b.length > 0);
    return this.x + k;
  }
  function pub(int k) {
    int v = peek(k);
    this.x = v;
    this.y = v;
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

interface Live {
  readonly provider: MockNetworkProvider;
  readonly categoryId: string;
  readonly callerLock: Uint8Array;
}

async function deploy(bundle: FunctionSplitBundle): Promise<Live> {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
  const funding = freshCoin(800_000n);
  await provider.addUtxo(binToHex(callerLock), funding);
  const encoded = lockingBytecodeToCashAddress({ bytecode: callerLock, prefix: 'bchtest' });
  if (typeof encoded === 'string') throw new Error(encoded);
  const { categoryId } = await deployStatefulContract(bundle.logical, [], {
    provider, fundingUtxo: funding, funder: signature.unlockP2PKH(), changeAddress: encoded.address,
    threadCount: 1, validatorCount: 1, functionSplit: bundle,
  });
  return { provider, categoryId, callerLock };
}

async function enter(live: Live, by: bigint): Promise<FramedCallResult> {
  const callerUtxo = freshCoin(300_000n);
  await live.provider.addUtxo(binToHex(live.callerLock), callerUtxo);
  return callFramedEntry({
    provider: live.provider, artifact: split.logical, categoryId: live.categoryId, functionName: 'pub', args: [by],
    callerUtxo, callerLockingBytecode: live.callerLock, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
    split, vm: compositionMachine(), validatorProgram: VALIDATOR,
  });
}

const objections = (result: FramedCallResult): string => result.verdicts.filter((verdict) => !verdict.accepted)
  .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ');

describe('an internal cut that reads the record its entry then writes', () => {
  it('cuts the helper into an INTERNAL shard', () => {
    expect(split.internalCuts.map((cut) => cut.name)).toStrictEqual(['peek(int256)']);
  });

  it('recreates the record with the entry\'s write, across two calls', async () => {
    const live = await deploy(split);
    const first = await enter(live, 5n);
    expect({ accepted: first.accepted, objections: objections(first) }).toStrictEqual({ accepted: true, objections: '' });
    expect(first.completed.map((frame) => [frame.functionName, frame.kind]))
      .toStrictEqual([['Ledger.peek()', FrameKind.INTERNAL], ['Ledger.pub()', FrameKind.ROOT]]);
    expect((await readFramedState(live.provider, live.categoryId, split.logical.stateLayout!)).byNft)
      .toStrictEqual([{ x: 5n, y: 5n }]);

    const second = await enter(live, 2n);
    expect(second.accepted, objections(second)).toBe(true);
    expect((await readFramedState(live.provider, live.categoryId, split.logical.stateLayout!)).byNft)
      .toStrictEqual([{ x: 7n, y: 7n }]);
  }, 600_000);
});
