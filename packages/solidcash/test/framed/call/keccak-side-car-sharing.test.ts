import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { KECCAK256_COMPUTE_STATEFUL_SHARED_LOCK, bytesEqual, type FunctionSplitBundle } from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc/runtime';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringSplit } from '../../../../solidc/src/compiler.js';
import { SignatureTemplate } from '../../../src/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import { alicePkh, alicePriv, bobPkh, carolPkh } from '../../fixture/vars.js';

/**
 * Calls that hash one preimage share one keccak side-car.
 *
 * `Router.twice` derives one pair's address twice, as a router does through each helper that needs it, and
 * `Router.both` derives two pairs' addresses. A per-entry master binds the side-car that holds its call's job, so
 * once the derivation has learned every job, the composition co-spends one side-car per job: one for `twice` and two
 * for `both`.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' library L { function pairFor(address a, address b) internal pure returns (address) {'
  + '   return address(uint160(uint256(keccak256(abi.encodePacked(a, b))))); } }'
  + ' contract Router { address public last;'
  + '   function twice(address a, address b) external {'
  + '     address p = L.pairFor(a, b); address q = L.pairFor(a, b); require(p == q); last = q; }'
  + '   function both(address a, address b) external {'
  + '     address p = L.pairFor(a, b); address q = L.pairFor(b, a); require(p != q); last = q; } }';

const VALIDATOR = framedValidator.buildValidatorProgram();

let coinNonce = 0x40;

function freshCoin(satoshis: bigint): Utxo {
  coinNonce += 1;
  return { txid: coinNonce.toString(16).padStart(64, '0'), vout: 0, satoshis };
}

interface Live {
  readonly provider: MockNetworkProvider;
  readonly categoryId: string;
  readonly split: FunctionSplitBundle;
}

let live: Promise<Live> | undefined;

/** The router, split one shard per entry and deployed once. */
async function deployed(): Promise<Live> {
  live ??= (async (): Promise<Live> => {
    const split = compileStringSplit(SOURCE, {
      split: 'func', composition: 'framed', evmCompat: true, suppressWarnings: true,
    } as never) as FunctionSplitBundle;
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
    const funding = freshCoin(800_000n);
    await provider.addUtxo(binToHex(callerLock), funding);
    const encoded = lockingBytecodeToCashAddress({ bytecode: callerLock, prefix: 'bchtest' });
    if (typeof encoded === 'string') throw new Error(encoded);
    const { categoryId } = await deployStatefulContract(split.logical, [], {
      provider, fundingUtxo: funding, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      changeAddress: encoded.address, threadCount: 1, validatorCount: 1, functionSplit: split,
    });
    return { provider, categoryId, split };
  })();
  return live;
}

async function enter(chain: Live, functionName: string, args: readonly Uint8Array[]): Promise<FramedCallResult> {
  const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = freshCoin(300_000n);
  await chain.provider.addUtxo(binToHex(callerLock), callerUtxo);
  return callFramedEntry({
    provider: chain.provider, artifact: chain.split.logical, categoryId: chain.categoryId, functionName,
    args: [...args], callerUtxo, callerLockingBytecode: callerLock,
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(), split: chain.split,
    vm: compositionMachine(), validatorProgram: VALIDATOR,
  });
}

/** How many inputs of the call's transaction spend a keccak side-car. */
function sideCarsSpent(result: FramedCallResult): number {
  return result.sourceOutputs.filter((output) =>
    bytesEqual(output.lockingBytecode, KECCAK256_COMPUTE_STATEFUL_SHARED_LOCK)).length;
}

function refusals(result: FramedCallResult): string {
  return result.verdicts.filter((verdict) => !verdict.accepted)
    .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ');
}

const [BOB, CAROL] = [bobPkh, carolPkh].map((pkh) => encodeLockingBytecodeP2pkh(pkh));

describe('keccak side-cars shared by calls that hash one preimage', () => {
  it('co-spends one side-car for two derivations of one pair', async () => {
    const result = await enter(await deployed(), 'twice', [BOB!, CAROL!]);
    expect({ refusals: refusals(result), sideCars: sideCarsSpent(result) }).toEqual({ refusals: '', sideCars: 1 });
    expect(result.accepted).toBe(true);
  });

  it('keeps one side-car per job when the jobs differ', async () => {
    const result = await enter(await deployed(), 'both', [BOB!, CAROL!]);
    expect({ refusals: refusals(result), sideCars: sideCarsSpent(result) }).toEqual({ refusals: '', sideCars: 2 });
    expect(result.accepted).toBe(true);
  });
});
