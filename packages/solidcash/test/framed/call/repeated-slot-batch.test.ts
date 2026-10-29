import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub, bobPkh } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A sorted batch whose two writes meet at one slot is laid out as the body reads it, so the body's own check is met.
 *
 * `Book.bind` refuses equal keys before it writes `link[a][b]` and `link[b][a]`, as a factory's `createPair` does:
 * for equal keys the two writes name one slot. The batch plans the later write as a rewrite of the node the earlier
 * one inserts, a group the body reads as an update, so the frame runs to its own `require` and is refused by it.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Book { mapping(address => mapping(address => uint256)) public link;'
  + '   function bind(address a, address b) external {'
  + '     require(a != b, "Book: SAME"); link[a][b] = 1; link[b][a] = 1; } }';

interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly artifact: Artifact;
  readonly categoryId: string;
  readonly snapshot: SnapshotRestorer;
}

let run: Promise<Deployed> | undefined;

/** The book; each case rewinds the chain to it first. */
async function deployed(): Promise<Deployed> {
  run ??= (async (): Promise<Deployed> => {
    const artifact = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never).Book!;
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    await fundShippedFacets(provider);
    const fundingUtxo = { txid: `${'70'.repeat(31)}a0`, vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funder.address, fundingUtxo);
    const deployment = await deployStatefulContract(artifact, [], {
      provider, fundingUtxo, changeAddress: funder.address,
      funder: funder.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
    });
    return { provider, artifact, categoryId: deployment.categoryId, snapshot: await provider.takeSnapshot() };
  })();
  const chain = await run;
  await chain.snapshot.restore();
  return chain;
}

let coins = 0;

/** Enters `Book.bind` with a fresh coin of the user's. */
async function bind(chain: Deployed, a: Uint8Array, b: Uint8Array): Promise<FramedCallResult> {
  coins += 1;
  const user = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: `${'6f'.repeat(31)}${coins.toString(16).padStart(2, '0')}`, vout: 0, satoshis: 300_000n };
  await chain.provider.addUtxo(binToHex(user), callerUtxo);
  return callFramedEntry({
    provider: chain.provider, artifact: chain.artifact, categoryId: chain.categoryId, functionName: 'bind',
    args: [a, b], callerUtxo, callerLockingBytecode: user, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
    vm: compositionMachine(),
  });
}

const ALICE = encodeLockingBytecodeP2pkh(alicePkh);
const BOB = encodeLockingBytecodeP2pkh(bobPkh);

describe('a sorted batch whose two writes meet at one slot', () => {
  it('lets the body meet its own check, which refuses the equal keys by its reason', async () => {
    const chain = await deployed();
    const result = await bind(chain, ALICE, ALICE);
    expect(result.broadcast).toBeUndefined();
    expect(result.refusal?.innermost?.reason.message).toBe('Book: SAME');
  });

  it('writes both links for distinct keys', async () => {
    const chain = await deployed();
    const result = await bind(chain, ALICE, BOB);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});
