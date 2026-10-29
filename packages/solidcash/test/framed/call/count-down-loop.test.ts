import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { parsePushdataCommitment, validatorAddress, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A loop whose counter starts where the source computes it and counts down, calling once per turn.
 *
 * `A.back` pays `Sink.add` the element each turn's counter names, from the last element down to the second. The
 * counter's start is no literal, so each turn's argument is planned from the loop's own start and step: the sink
 * adds exactly the elements the body reached, each once.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Sink { uint256 public total;'
  + '   function add(uint256 amount) external { total = total + amount; } }'
  + ' contract A { Sink public sink;'
  + '   constructor(Sink s) { sink = s; }'
  + '   function back(uint256[] memory xs) external {'
  + '     for (uint256 i = xs.length - 1; i > 0; i--) { sink.add(xs[i]); } } }';

interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly artifacts: Readonly<Record<string, Artifact>>;
  readonly categories: ReadonlyMap<string, string>;
  readonly snapshot: SnapshotRestorer;
}

let run: Promise<Deployed> | undefined;

/** Sink and A, A holding Sink; each case rewinds the chain to them first. */
async function deployed(): Promise<Deployed> {
  run ??= (async (): Promise<Deployed> => {
    const compiled = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never);
    const artifacts = { Sink: compiled.Sink!, A: compiled.A! };
    const { framedValidator } = await import('@solidcash/solidc');
    const validatorProgram = framedValidator.buildValidatorProgram();
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    await fundShippedFacets(provider);
    const categories = new Map<string, string>();
    const locks = new Map<string, Uint8Array>();
    for (const [index, [name, args]] of ([['Sink', []], ['A', ['Sink']]] as const).entries()) {
      const fundingUtxo = { txid: `${'7b'.repeat(31)}${(0xa0 + index).toString(16)}`, vout: 0, satoshis: 500_000n };
      await provider.addUtxo(funder.address, fundingUtxo);
      const deployment = await deployStatefulContract(artifacts[name]!, args.map((arg) => locks.get(arg)!), {
        provider, fundingUtxo, changeAddress: funder.address,
        funder: funder.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      });
      categories.set(name, deployment.categoryId);
      locks.set(name, validatorAddress(hexToBin(deployment.categoryId), validatorProgram));
    }
    return { provider, artifacts, categories, snapshot: await provider.takeSnapshot() };
  })();
  const chain = await run;
  await chain.snapshot.restore();
  return chain;
}

/** Enters `A.back` with a fresh coin of the user's. */
async function back(chain: Deployed, xs: readonly bigint[]): Promise<FramedCallResult> {
  const user = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: '7c'.repeat(32), vout: 0, satoshis: 300_000n };
  await chain.provider.addUtxo(binToHex(user), callerUtxo);
  const externals = Object.fromEntries([...chain.categories]
    .map(([name, categoryId]) => [name, { artifact: chain.artifacts[name]!, categoryId }]));
  return callFramedEntry({
    provider: chain.provider, artifact: chain.artifacts.A!, categoryId: chain.categories.get('A')!,
    functionName: 'back', args: [[...xs]], callerUtxo, callerLockingBytecode: user,
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(), vm: compositionMachine(), externals,
  });
}

/** The sink's total as its own layout decodes it, read back from the chain. */
async function sinkTotal(chain: Deployed): Promise<unknown> {
  const layout = chain.artifacts.Sink!.stateLayout!;
  const set = await readFramedDeployment(chain.provider, chain.categories.get('Sink')!, layout);
  const record = Object.assign({}, ...set.records.slice(0, layout.dataNftCount)
    .map((entry, nftIndex) => parsePushdataCommitment(entry.token!.nft!.commitment, layout, nftIndex)));
  return (record as { total?: unknown }).total;
}

describe('a loop that counts down from a computed start', () => {
  it('pays each element its turn reaches, from the last down to the second', async () => {
    const chain = await deployed();
    const result = await back(chain, [100n, 2n, 30n, 400n]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(result.completed.map((frame) => frame.functionName))
      .toStrictEqual(['Sink.add()', 'Sink.add()', 'Sink.add()', 'A.back()']);
    expect(await sinkTotal(chain)).toBe(432n);
  });
});
