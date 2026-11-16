import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { FrameKind, asmToBytecode, type FunctionSplitBundle, type WitnessBlock } from '@solidcash/utils';
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
 * A helper cut out of its entry that writes state and returns a value, driven through the shipped call path.
 *
 * `pub` calls `bump`, which carries most of the code, writes `x` and returns it; `pub` then writes the result to `y`
 * and requires the two to agree. The split's cap is one byte under `pub` with `bump` inlined, so `bump` runs as an
 * INTERNAL frame of its own master: it keeps `pub`'s sender, address and value, writes `pub`'s record, which the
 * validator chains through both frames, and its result is the one `pub`'s call records. The control hands the
 * internal frame a message call's sender, which the validator refuses (V5).
 */

const FRAMED = { composition: 'framed' as const, suppressWarnings: true };
const VALIDATOR = framedValidator.buildValidatorProgram();
const SOURCE = `pragma solidcash ^0.51.0;
contract Ledger {
  int x;
  int y;
  function bump(int k) internal returns (int) {
    bytes b = hex"${'ab'.repeat(3000)}";
    require(b.length > 0);
    this.x = this.x + k;
    return this.x;
  }
  function pub(int k) {
    int v = bump(k);
    this.y = v;
    require(this.y == this.x);
  }
}`;

const open = compileStringSplit(SOURCE, { split: 'func', ...FRAMED });
const inlined = asmToBytecode(open.shards.find((shard) => shard.function === 'pub')!.artifact.bytecode).length;
const split = compileStringSplit(SOURCE, { split: 'func', ...FRAMED, maxShardBytes: inlined - 1 });

let nonce = 0x7100;
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

describe('an internal cut that writes state and returns a value', () => {
  it('cuts the helper into an INTERNAL shard that fits the cap, beside an entry that fits too', () => {
    expect(split.internalCuts.map((cut) => cut.name)).toStrictEqual(['bump(int256)']);
    expect(split.internalCuts[0]!.wholeSpendBytes).toBeLessThan(inlined);
    expect(split.shards.find((shard) => shard.function === 'pub')!.wholeSpendBytes).toBeLessThan(inlined);
  });

  it('settles the entry with the helper running in its context, and carries the record across two calls', async () => {
    const live = await deploy(split);
    const first = await enter(live, 5n);
    expect({ accepted: first.accepted, objections: objections(first) }).toStrictEqual({ accepted: true, objections: '' });
    expect(first.completed.map((frame) => [frame.functionName, frame.kind]))
      .toStrictEqual([['Ledger.bump()', FrameKind.INTERNAL], ['Ledger.pub()', FrameKind.ROOT]]);
    const root = first.draft.blockOf('master');
    const helper = first.draft.blockOf(first.completed[0]!.master);
    expect([helper.sender, helper.self, helper.value]).toStrictEqual([root.sender, root.self, root.value]);
    expect((await readFramedState(live.provider, live.categoryId, split.logical.stateLayout!)).byNft)
      .toStrictEqual([{ x: 5n, y: 5n }]);

    const second = await enter(live, 2n);
    expect(second.accepted, objections(second)).toBe(true);
    expect((await readFramedState(live.provider, live.categoryId, split.logical.stateLayout!)).byNft)
      .toStrictEqual([{ x: 7n, y: 7n }]);
  }, 600_000);

  it('refuses the internal frame given a message call\'s sender', async () => {
    const live = await deploy(split);
    const result = await enter(live, 5n);
    expect(result.accepted, objections(result)).toBe(true);
    const helperMaster = result.completed[0]!.master;
    const block = result.draft.blockOf(helperMaster) as WitnessBlock;
    // A message call's callee sees its caller's address as its sender; an internal frame keeps its caller's sender.
    (block as { sender: Uint8Array }).sender = Uint8Array.from(result.draft.blockOf('master').self);
    const program = result.draft.programFor('master');
    const vm = compositionMachine();
    const refusedBy = result.draft.layout.participants.filter((placed) => vm.stateSuccess(vm.evaluate({
      inputIndex: placed.index, sourceOutputs: program.sourceOutputs, transaction: program.transaction,
    })) !== true).map((placed) => placed.id);
    expect(refusedBy).toContain('validator/1');
  }, 600_000);
});
