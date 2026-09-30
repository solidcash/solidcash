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
 * itself, so what the machine answers is about the entry's own code and not about a test's idea of the block. The
 * loop is the only difference between the two contracts below - one upserts a mapping whose key is an element of a
 * caller-supplied array, the other writes the same mapping once from a parameter - and the loop's own body makes no
 * call, so neither entry reaches a callee frame.
 *
 * The refusal is the run-time-loop upsert's own: the machine fails an `OP_VERIFY` inside the emitted loop body, at
 * an instruction the artifact's source map does not name, while the same head with the loop removed (or with a
 * parameter key) settles. It is recorded here as the shape's wall: the artifact publishes no write fact for it
 * either (`solidc/test/per-call/master/loop-upsert-segment.test.ts` pins that beside the machine's refusals of every
 * declaration), because the collection is carried by the run-time-loop machinery rather than by a verified batch.
 */

const LOOP_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Ledger {'
  + '   mapping(address => uint) balances;'
  + '   function move(address[] workers, uint amount) {'
  + '     for (int i = 0; i < workers.length; i = i + 1) { balances[workers[i]] = amount; }'
  + '     require(workers.length > 0);'
  + '   }'
  + '   function ping() { require(true); }'
  + ' }';

/** The control: the same mapping written once from a parameter, with no loop anywhere in the body. */
const PLAIN_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Ledger {'
  + '   mapping(address => uint) balances;'
  + '   function move(address to, uint amount) { balances[to] = amount; require(amount > 0); }'
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

/** Drives one entry of one contract through the shipped deploy and call path and reports the machine's answer. */
async function settled(
  source: string, entry: string, args: readonly unknown[],
): Promise<{ readonly accepted: boolean; readonly verdicts: readonly string[] }> {
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
  const answered = await callPerCallEntry({
    provider, artifact, categoryId: deployment.categoryId, functionName: entry, args: args as never,
    callerUtxo, callerLockingBytecode: user, funder: signature.unlockP2PKH(), vm: compositionMachine(),
  });
  return {
    accepted: answered.accepted,
    verdicts: answered.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.id}: ${String(verdict.objection ?? 'refused')}`),
  };
}

describe('a mapping upsert inside a run-time loop, through the shipped call path', () => {
  it('settles the same mapping written once from a parameter', async () => {
    const outcome = await settled(PLAIN_SOURCE, 'move', [KEY, 42n]);
    expect(outcome).toStrictEqual({ accepted: true, verdicts: [] });
  });

  it('refuses the loop upsert in the machine, on the frame the shipped path planned itself', async () => {
    const outcome = await settled(LOOP_SOURCE, 'move', [[KEY], 42n]);
    expect(outcome.accepted).toBe(false);
    expect(outcome.verdicts.join('; ')).toMatch(
      /frame "master" of Ledger\.move\(\) .*no source message \(Program failed an OP_VERIFY operation\.\)/,
    );
  });
});
