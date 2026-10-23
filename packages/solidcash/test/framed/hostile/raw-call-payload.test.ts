import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import {
  argsHash,
  computeEvmFunctionSelector,
  computeFunctionSelector,
  concatBytes,
  decodeWitnessBlock,
  encodeMinimalDataPush,
  encodeWitnessBlockPush,
  splitFirstPush,
  validatorAddress,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import { fundShippedFacets } from '../shapes/harness.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * A low-level call routed to its target's fallback binds the selector its payload names (spec 4b, 17).
 *
 * `address(b).call(abi.encodeWithSignature("nonexistent()"))` names no function of B, so B's fallback runs it with
 * the payload's selector as its call data, and the caller's own code computes the record's digest from that
 * selector. B runs its fallback for any selector it has no body for, the fallback's own published one included, so
 * a builder could hand B that selector instead and restate the record's digest to match: B's frame and the call
 * data agree, and only the caller's binding of the payload it built refuses the record.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract B { address public lastFallbackSender; fallback() external payable { lastFallbackSender = msg.sender; } }'
  + ' contract A { B public b; constructor(B b_) { b = b_; }'
  + '   function poke() external {'
  + '     (bool ok, ) = address(b).call(abi.encodeWithSignature("nonexistent()")); require(ok); } }';

/** The selector the payload names (the source is evmCompat, so `abi.encodeWithSignature` folds keccak), and the one
 * B publishes for its fallback dispatcher, which follows the same evmCompat keccak scheme (D27) and no call names. */
const PAYLOAD_SELECTOR = computeEvmFunctionSelector('nonexistent()');
const FALLBACK_SELECTOR = computeFunctionSelector('__fallback()', true);

let run: Promise<FramedCallResult> | undefined;

/** B and A deployed, and A's `poke` composed and broadcast once. */
async function poked(): Promise<FramedCallResult> {
  run ??= (async (): Promise<FramedCallResult> => {
    const artifacts = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never);
    const { framedValidator } = await import('@solidcash/solidc');
    const validatorProgram = framedValidator.buildValidatorProgram();
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    await fundShippedFacets(provider);
    const categories = new Map<string, string>();
    const locks = new Map<string, Uint8Array>();
    for (const [index, [name, args]] of ([['B', []], ['A', ['B']]] as const).entries()) {
      const fundingUtxo = { txid: `${'73'.repeat(31)}${(0xa0 + index).toString(16)}`, vout: 0, satoshis: 500_000n };
      await provider.addUtxo(funder.address, fundingUtxo);
      const deployment = await deployStatefulContract(artifacts[name]!, args.map((arg) => locks.get(arg)!), {
        provider, fundingUtxo, changeAddress: funder.address,
        funder: funder.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      });
      categories.set(name, deployment.categoryId);
      locks.set(name, validatorAddress(hexToBin(deployment.categoryId), validatorProgram));
    }
    const user = encodeLockingBytecodeP2pkh(alicePkh);
    const callerUtxo = { txid: `${'74'.repeat(31)}01`, vout: 0, satoshis: 300_000n };
    await provider.addUtxo(binToHex(user), callerUtxo);
    return callFramedEntry({
      provider, artifact: artifacts.A!, categoryId: categories.get('A')!, functionName: 'poke', args: [],
      callerUtxo, callerLockingBytecode: user, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      vm: compositionMachine(),
      externals: Object.fromEntries([...categories].map(([name, categoryId]) =>
        [name, { artifact: artifacts[name]!, categoryId }])),
    });
  })();
  return run;
}

/** The input a participant of the composition sits at. */
const indexOf = (result: FramedCallResult, id: string): number =>
  result.draft.layout.participants.find((placed) => placed.id === id)!.index;

/** The machine's verdict on one input of a transaction. */
function verdict(result: FramedCallResult, transaction: FramedCallResult['transaction'], id: string): string {
  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: indexOf(result, id), sourceOutputs: result.sourceOutputs, transaction });
  return vm.stateSuccess(state) === true ? 'accepted' : String((state as { readonly error?: unknown }).error);
}

describe('a low-level call routed to its target\'s fallback binds the selector its payload names', () => {
  it('accepts the honest spend: the record and B\'s call data carry the payload\'s own selector', async () => {
    const result = await poked();
    expect(result.verdicts.filter((entry) => !entry.accepted)).toStrictEqual([]);
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual(['B.__fallback()', 'A.poke()']);
    const record = decodeWitnessBlock(splitFirstPush(result.draft.unlockingBytecodeOf('master')).payload).calls[0]!;
    expect(binToHex(record.argsHash)).toBe(binToHex(argsHash(PAYLOAD_SELECTOR, new Uint8Array(0))));
    const callData = splitFirstPush(splitFirstPush(result.draft.unlockingBytecodeOf('callee-master-1')).rest).payload;
    expect(binToHex(callData)).toBe(binToHex(PAYLOAD_SELECTOR));
  }, 180_000);

  it('refuses at the caller a record whose selector and digest are the fallback\'s own, which B would run', async () => {
    const result = await poked();
    const master = indexOf(result, 'master');
    const caller = splitFirstPush(result.draft.unlockingBytecodeOf('master'));
    const restated = (block: ReturnType<typeof decodeWitnessBlock>): Uint8Array =>
      concatBytes([encodeWitnessBlockPush(block), caller.rest]);
    // The caller's input rebuilt around its own block is the spend the machine accepted.
    const control = structuredClone(result.transaction);
    control.inputs[master]!.unlockingBytecode = restated(decodeWitnessBlock(caller.payload));
    expect(verdict(result, control, 'master')).toBe('accepted');

    const forged = structuredClone(result.transaction);
    // A's record states the digest of the fallback's own selector instead of the payload's.
    const block = decodeWitnessBlock(caller.payload);
    block.calls[0]!.argsHash = argsHash(FALLBACK_SELECTOR, new Uint8Array(0));
    forged.inputs[master]!.unlockingBytecode = restated(block);
    // B's call data carries that selector, so the record and the callee's own bytes agree.
    const callee = splitFirstPush(result.draft.unlockingBytecodeOf('callee-master-1'));
    forged.inputs[indexOf(result, 'callee-master-1')]!.unlockingBytecode = concatBytes([
      encodeMinimalDataPush(callee.payload), encodeMinimalDataPush(FALLBACK_SELECTOR), splitFirstPush(callee.rest).rest,
    ]);
    // B runs its fallback on the forged selector as it does on the payload's, and the validator finds the record and
    // B's call data in agreement; only the caller's own digest of the payload it built refuses the record.
    expect(['callee-master-1', 'validator', 'validator/1'].map((id) => verdict(result, forged, id)))
      .toStrictEqual(['accepted', 'accepted', 'accepted']);
    expect(verdict(result, forged, 'master')).toMatch(/^Program failed an OP_(EQUAL)?VERIFY operation\.$/);
  }, 180_000);
});
