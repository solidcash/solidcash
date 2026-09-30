import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callPerCallEntry } from '../../../src/per-call/call/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A mapping upsert that runs inside a run-time loop, driven through the shipped call path.
 *
 * The whole point of asking here rather than at a hand-built witness: the shipped path plans the frame's records
 * itself, so what the machine answers is about the entry's own code and not about a test's idea of the block.
 *
 * Two bodies are asked. The first writes one key, handed to the body as an argument, once per turn of a loop whose
 * trip count the execution decides: the shipped path accepts that spend, and the case after it mutates the
 * transaction the path assembled - the record the entry wrote carries a commitment its code did not compute - and
 * the machine refuses it. The second body writes a key that is an element of a caller-supplied array, so a different
 * node per turn: the per-call layout does declare the collection's `entry` slot and the artifact publishes the
 * in-loop access, but the call path has no record protocol for a loop's per-turn nodes, so it refuses the write by
 * name at the seam that planning replaces (`touches mapping "balances" as write outside a sorted batch, which a
 * call does not plan`). The two bodies differ only in where the key comes from, which is what separates the loop
 * upsert the path serves from the one it does not yet.
 */

const FIXED_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Ledger {'
  + '   mapping(address => uint) balances;'
  + '   function move(address to, uint amount, int turns) {'
  + '     for (int i = 0; i < turns; i = i + 1) { balances[to] = amount; }'
  + '     require(turns > 0);'
  + '   }'
  + '   function ping() { require(true); }'
  + ' }';

const VARYING_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Ledger {'
  + '   mapping(address => uint) balances;'
  + '   function move(address[] workers, uint amount) {'
  + '     for (int i = 0; i < workers.length; i = i + 1) { balances[workers[i]] = amount; }'
  + '     require(workers.length > 0);'
  + '   }'
  + '   function ping() { require(true); }'
  + ' }';

/** A 32-byte outpoint hash whose bytes are not all the same, so a byte-order bug cannot hide in it. */
function outpointHash(seed: number): string {
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (seed + index * 7) & 0xff;
  return binToHex(bytes);
}

/** The address the write names, in the form the shipped encoder takes for an `address`. */
const KEY = binToHex(new Uint8Array(20).fill(0x44));

type CallResult = Awaited<ReturnType<typeof callPerCallEntry>>;

/** Drives one entry of one contract through the shipped deploy and call path and reports what it answered. */
async function call(source: string, entry: string, args: readonly unknown[]): Promise<CallResult> {
  const artifact = compileStringMulti(source, { composition: 'per-call' }).Ledger!;
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const fundingUtxo = { txid: outpointHash(0x30), vout: 0, satoshis: 500_000n };
  await provider.addUtxo(funder.address, fundingUtxo);
  await fundShippedFacets(provider);
  const deployment = await deployStatefulContract(artifact, [], {
    provider, fundingUtxo, funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address,
  });
  const user = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: outpointHash(0x50), vout: 0, satoshis: 200_000n };
  await provider.addUtxo(binToHex(user), callerUtxo);
  return callPerCallEntry({
    provider, artifact, categoryId: deployment.categoryId, functionName: entry, args: args as never,
    callerUtxo, callerLockingBytecode: user, funder: signature.unlockP2PKH(), vm: compositionMachine(),
  });
}

/** The verdicts of a refused call, as one line, for the assertion that names the reason. */
const objectionsOf = (answered: CallResult): string => answered.verdicts
  .filter((verdict) => !verdict.accepted)
  .map((verdict) => `${verdict.participant}: ${String(verdict.objection ?? 'refused')}`)
  .join('; ');

/** The commitment of an output's token, or undefined for one that carries no NFT. */
const commitmentOf = (output: { readonly token?: { readonly nft?: { readonly commitment?: Uint8Array } } }):
Uint8Array | undefined => output.token?.nft?.commitment;

describe('a mapping upsert inside a run-time loop, through the shipped call path', () => {
  it('the machine accepts the run-time-loop upsert, and refuses the record it wrote being changed', async () => {
    // The machine is the BCH-2026 VM: `accepted` is true only when every participant's verdict is accepted, so this
    // assertion is the machine's verdict on the well-formed spend of a mapping upsert that runs inside a loop.
    const answered = await call(FIXED_SOURCE, 'move', [KEY, 42n, 2n]);
    expect({ accepted: answered.accepted, objections: objectionsOf(answered) })
      .toStrictEqual({ accepted: true, objections: '' });

    // The record the entry wrote is the output whose commitment differs from the input's at the same index.
    const index = answered.transaction.outputs.findIndex((output, at) =>
      commitmentOf(output) !== undefined
      && binToHex(commitmentOf(output)!) !== binToHex(commitmentOf(answered.sourceOutputs[at]!) ?? new Uint8Array()));
    expect(index).toBeGreaterThanOrEqual(0);

    // The mutated spend: the same transaction with one byte of that commitment changed, so the record no longer
    // carries the value the entry's own code computed.
    const committed = commitmentOf(answered.transaction.outputs[index]!)!;
    const changed = new Uint8Array(committed);
    changed[changed.length - 1] = (changed[changed.length - 1]! ^ 0x01) & 0xff;
    const mutated = {
      ...answered.transaction,
      outputs: answered.transaction.outputs.map((output, at) => (at === index
        ? { ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: changed } } }
        : output)),
    };
    const master = answered.verdicts.findIndex((verdict) => verdict.accepted);
    expect(master).toBeGreaterThanOrEqual(0);
    const vm = compositionMachine();
    const state = vm.evaluate({
      inputIndex: master, sourceOutputs: answered.sourceOutputs, transaction: mutated,
    });
    expect(vm.stateSuccess(state)).not.toBe(true);
  });

  it('the shipped path refuses the loop upsert whose key varies per turn, at the protocol it does not plan', async () => {
    // The refusal is by name now rather than the machine's: the per-call lane has no record protocol for a loop's
    // per-turn nodes, and the frame the plan builds declares none of them for the collection, which is what
    // `solidc/test/per-call/master/loop-upsert-segment.test.ts` shows the machine reading as the no-record sentinel
    // when it is handed such a frame. This named refusal is the seam the per-turn planning replaces.
    await expect(call(VARYING_SOURCE, 'move', [[KEY], 42n])).rejects.toThrow(
      /entry "move" touches mapping "balances" as write outside a sorted batch, which a call does not plan/,
    );
  });
});
