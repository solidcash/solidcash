import { describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import {
  buildPushdataCommitment, concatBytes, encodeWitnessBlock, parsePushdataCommitment, splitFirstPush,
  type Artifact, type WitnessBlock,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A return the early-return nesting did not reach, on the plain call path.
 *
 * Code generation emits no jump for a return: a void `return;` emits nothing, so the statements after it ran unless
 * the nesting had moved them into the other arm of the branch it ends. It did not for a return under a further
 * condition, and it did not visit `receive()` or `fallback()` at all, so `f`, `receive()` and `fallback()` below
 * each wrote `x` with their return taken. Each now skips the write with the return taken and makes it without. The
 * master accepts the spend as planned and refuses the same spend with the record restated to the other path's `x`.
 * A value send runs `receive()` where a contract has one, so `fallback()` is driven on a contract of its own.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Guarded { uint256 public x; uint256 public y;'
  + '   function setY(uint256 v) external { y = v; }'
  + '   function f(bool a, bool b) external { if (a) { if (b) return; } x = x + 1; }'
  + '   receive() external payable { if (y == 1) return; x = x + 10; } }'
  + ' contract Fallen { uint256 public x; uint256 public y;'
  + '   function setY(uint256 v) external { y = v; }'
  + '   fallback() external payable { if (y > 0) { if (y == 2) return; } x = x + 100; } }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed', solidityImportCompat: true } as never);

/** A 32-byte outpoint hash whose bytes are not all the same. */
function outpointHash(seed: number): string {
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (seed + index * 7) & 0xff;
  return binToHex(bytes);
}

type CallResult = Awaited<ReturnType<typeof callFramedEntry>>;

interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly artifact: Artifact;
  readonly categoryId: string;
  readonly snapshot: SnapshotRestorer;
}

const deployments = new Map<string, Promise<Deployed>>();

/** Deploys `name` once, and rewinds the chain to that deployment for each case. */
async function deployed(name: 'Guarded' | 'Fallen', seed: number): Promise<Deployed> {
  if (!deployments.has(name)) {
    deployments.set(name, (async (): Promise<Deployed> => {
      const artifact = artifacts[name]!;
      const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
      const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
      const fundingUtxo = { txid: outpointHash(seed), vout: 0, satoshis: 500_000n };
      await provider.addUtxo(funder.address, fundingUtxo);
      await fundShippedFacets(provider);
      const built = await deployStatefulContract(artifact, [], {
        provider, fundingUtxo, funder: funder.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        changeAddress: funder.address,
      });
      return { provider, artifact, categoryId: built.categoryId, snapshot: await provider.takeSnapshot() };
    })());
  }
  const world = await deployments.get(name)!;
  await world.snapshot.restore();
  return world;
}

let nonce = 0x60;
/** Enters one entry from a fresh coin of the user's and requires every participant to accept it. */
async function settle(world: Deployed, entry: string, args: readonly unknown[] = []): Promise<CallResult> {
  nonce += 1;
  const callerUtxo = { txid: outpointHash(nonce), vout: 0, satoshis: 200_000n };
  await world.provider.addUtxo(binToHex(encodeLockingBytecodeP2pkh(alicePkh)), callerUtxo);
  const result = await callFramedEntry({
    provider: world.provider, artifact: world.artifact, categoryId: world.categoryId, functionName: entry,
    args: args as never, callerUtxo, callerLockingBytecode: encodeLockingBytecodeP2pkh(alicePkh),
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(), vm: compositionMachine(),
  });
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.accepted).toBe(true);
  return result;
}

/** The deployment's `x`, read back from the chain with the shipped decoder. */
async function heldX(world: Deployed): Promise<unknown> {
  const layout = world.artifact.stateLayout!;
  const pools = await readFramedDeployment(world.provider, world.categoryId, layout);
  return parsePushdataCommitment(pools.records[0]!.token!.nft!.commitment, layout, 0).x;
}

/**
 * The master's verdicts on the spend as planned and on the same spend with its record restated to hold `x`: the
 * output's commitment and the witness block's declaration of it both change.
 */
function verdicts(world: Deployed, result: CallResult, x: bigint): { planned: boolean; restated: boolean } {
  const layout = world.artifact.stateLayout!;
  const master = result.verdicts.find((verdict) => verdict.id === 'master')!;
  const block = structuredClone(result.draft.blockOf('master')) as WitnessBlock;
  const records = block.segments.flat();
  const { out } = records[records.length - 1]!;
  const planned = parsePushdataCommitment(binToHex(records[records.length - 1]!.viewOut), layout, 0);
  const restated = hexToBin(buildPushdataCommitment(layout, { ...planned, x }, 0));
  for (const record of records) if (record.out === out) record.viewOut = restated;
  const { rest } = splitFirstPush(result.transaction.inputs[master.index]!.unlockingBytecode);
  const mutated = {
    ...result.transaction,
    inputs: result.transaction.inputs.map((input, at) => (at === master.index
      ? { ...input, unlockingBytecode: concatBytes([encodeDataPush(encodeWitnessBlock(block)), rest]) }
      : input)),
    outputs: result.transaction.outputs.map((output, at) => (at === out
      ? { ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: restated } } }
      : output)),
  };
  const vm = compositionMachine();
  const accepts = (transaction: CallResult['transaction']): boolean => vm.stateSuccess(
    vm.evaluate({ inputIndex: master.index, sourceOutputs: result.sourceOutputs, transaction }),
  ) === true;
  return { planned: accepts(result.transaction), restated: accepts(mutated) };
}

describe('a return the early-return nesting did not reach, on the plain call path', () => {
  it('nested ifs: the taken return skips the write and the untaken one makes it', async () => {
    const world = await deployed('Guarded', 0x30);
    const taken = await settle(world, 'f', [true, true]);
    expect(await heldX(world)).toBe(0n);
    expect(verdicts(world, taken, 1n)).toStrictEqual({ planned: true, restated: false });
    const untaken = await settle(world, 'f', [true, false]);
    expect(await heldX(world)).toBe(1n);
    expect(verdicts(world, untaken, 0n)).toStrictEqual({ planned: true, restated: false });
  }, 120_000);

  it('receive(): the taken return skips the write and the untaken one makes it', async () => {
    const world = await deployed('Guarded', 0x30);
    await settle(world, 'setY', [1n]);
    const taken = await settle(world, '__receive');
    expect(await heldX(world)).toBe(0n);
    expect(verdicts(world, taken, 10n)).toStrictEqual({ planned: true, restated: false });
    await settle(world, 'setY', [3n]);
    const untaken = await settle(world, '__receive');
    expect(await heldX(world)).toBe(10n);
    expect(verdicts(world, untaken, 0n)).toStrictEqual({ planned: true, restated: false });
  }, 120_000);

  it('fallback(): the taken return skips the write and the untaken one makes it', async () => {
    const world = await deployed('Fallen', 0x40);
    await settle(world, 'setY', [2n]);
    const taken = await settle(world, '__fallback');
    expect(await heldX(world)).toBe(0n);
    expect(verdicts(world, taken, 100n)).toStrictEqual({ planned: true, restated: false });
    await settle(world, 'setY', [3n]);
    const untaken = await settle(world, '__fallback');
    expect(await heldX(world)).toBe(100n);
    expect(verdicts(world, untaken, 0n)).toStrictEqual({ planned: true, restated: false });
  }, 120_000);
});
