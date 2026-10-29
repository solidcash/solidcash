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
import { alicePkh, alicePriv, alicePub, bobPkh, carolPkh } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A loop that hashes on a branch, through a function it invokes, takes a side-car on the turns the branch is taken.
 *
 * `Hasher.go` hashes each element with the next through `L.h` on every turn but the last, which takes the element as
 * it is: an arm of a ternary, which the body invokes `L.h` from rather than inlines. Its frame states one side-car for
 * each turn whose predicate holds, so a path of three elements takes one and a path of four takes two.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' library L { function h(address a, address b) internal pure returns (address) {'
  + '   return address(uint160(uint256(keccak256(abi.encodePacked(a, b))))); } }'
  + ' contract Hasher { address public last;'
  + '   function go(address[] memory xs) external {'
  + '     for (uint i; i < xs.length - 1; i++) {'
  + '       address to = i < xs.length - 2 ? L.h(xs[i], xs[i + 1]) : xs[i]; last = to; } } }';

interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly artifact: Artifact;
  readonly categoryId: string;
  readonly snapshot: SnapshotRestorer;
}

let run: Promise<Deployed> | undefined;

/** The hasher; each case rewinds the chain to it first. */
async function deployed(): Promise<Deployed> {
  run ??= (async (): Promise<Deployed> => {
    const artifact = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never).Hasher!;
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    await fundShippedFacets(provider);
    const fundingUtxo = { txid: `${'74'.repeat(31)}a0`, vout: 0, satoshis: 500_000n };
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

/** Enters `Hasher.go` with a fresh coin of the user's. */
async function go(chain: Deployed, xs: readonly Uint8Array[]): Promise<FramedCallResult> {
  coins += 1;
  const user = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: `${'73'.repeat(31)}${coins.toString(16).padStart(2, '0')}`, vout: 0, satoshis: 300_000n };
  await chain.provider.addUtxo(binToHex(user), callerUtxo);
  return callFramedEntry({
    provider: chain.provider, artifact: chain.artifact, categoryId: chain.categoryId, functionName: 'go',
    args: [[...xs]], callerUtxo, callerLockingBytecode: user, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
    vm: compositionMachine(),
  });
}

const [ALICE, BOB, CAROL] = [alicePkh, bobPkh, carolPkh].map((pkh) => encodeLockingBytecodeP2pkh(pkh));

describe('a loop that hashes on a branch through a function it invokes', () => {
  it('takes a side-car on each turn the branch is taken, and none on the others', async () => {
    for (const xs of [[ALICE!, BOB!, CAROL!], [ALICE!, BOB!, CAROL!, ALICE!]]) {
      const chain = await deployed();
      const result = await go(chain, xs);
      expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
      expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
