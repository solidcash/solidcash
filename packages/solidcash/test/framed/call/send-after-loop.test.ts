import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { parsePushdataCommitment, validatorAddress, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readFramedDeployment, readSatoshiContainers } from '../../../src/framed/deploy/index.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A send to a contract made after a loop of calls takes its place after every call the loop makes.
 *
 * `Payer.drain` calls `Sink.add` once per element, then sends the value it carries to `Vault`, whose `receive()` books
 * it. How many calls precede the send is the loop's, which the source leaves open, but none follows it: the send's
 * call into the vault is the entry's last, after all of the sink's.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' interface ISink { function add(uint256 v) external; }'
  + ' contract Sink { uint256 public total;'
  + '   function add(uint256 v) external { total = total + v; } }'
  + ' contract Vault { uint256 public received;'
  + '   receive() external payable { received = received + msg.value; } }'
  + ' contract Payer { uint256 public unit = 1;'
  + '   function drain(ISink sink, uint256[] memory xs, address payable to) external payable {'
  + '     for (uint256 i = 0; i < xs.length; i++) { sink.add(xs[i]); }'
  + '     (bool ok,) = to.call{value: msg.value}(""); require(ok, "Payer: send"); } }';

interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly artifacts: Readonly<Record<string, Artifact>>;
  readonly categories: ReadonlyMap<string, string>;
  readonly locks: ReadonlyMap<string, Uint8Array>;
  readonly snapshot: SnapshotRestorer;
}

let run: Promise<Deployed> | undefined;

/** The sink, the vault and the payer; each case rewinds the chain to them first. */
async function deployed(): Promise<Deployed> {
  run ??= (async (): Promise<Deployed> => {
    const compiled = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never);
    const artifacts = { Sink: compiled.Sink!, Vault: compiled.Vault!, Payer: compiled.Payer! };
    const { framedValidator } = await import('@solidcash/solidc');
    const validatorProgram = framedValidator.buildValidatorProgram();
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    await fundShippedFacets(provider);
    const categories = new Map<string, string>();
    const locks = new Map<string, Uint8Array>();
    for (const [index, name] of (['Sink', 'Vault', 'Payer'] as const).entries()) {
      const fundingUtxo = { txid: `${'76'.repeat(31)}${(0xa0 + index).toString(16)}`, vout: 0, satoshis: 500_000n };
      await provider.addUtxo(funder.address, fundingUtxo);
      const deployment = await deployStatefulContract(artifacts[name], [], {
        provider, fundingUtxo, changeAddress: funder.address,
        funder: funder.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      });
      categories.set(name, deployment.categoryId);
      locks.set(name, validatorAddress(hexToBin(deployment.categoryId), validatorProgram));
    }
    return { provider, artifacts, categories, locks, snapshot: await provider.takeSnapshot() };
  })();
  const chain = await run;
  await chain.snapshot.restore();
  return chain;
}

/** Enters `Payer.drain` with the value it sends and a fresh coin of the user's. */
async function drain(chain: Deployed, xs: readonly bigint[], value: bigint): Promise<FramedCallResult> {
  const user = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: '75'.repeat(32), vout: 0, satoshis: 300_000n };
  await chain.provider.addUtxo(binToHex(user), callerUtxo);
  const externals = Object.fromEntries([...chain.categories]
    .map(([name, categoryId]) => [name, { artifact: chain.artifacts[name]!, categoryId }]));
  return callFramedEntry({
    provider: chain.provider, artifact: chain.artifacts.Payer!, categoryId: chain.categories.get('Payer')!,
    functionName: 'drain', args: [chain.locks.get('Sink')!, [...xs], chain.locks.get('Vault')!], callerUtxo,
    callerLockingBytecode: user, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), vm: compositionMachine(),
    externals, value,
  });
}

/** One of a contract's fields, as its own layout decodes it, read back from the chain. */
async function field(chain: Deployed, name: string, key: string): Promise<unknown> {
  const layout = chain.artifacts[name]!.stateLayout!;
  const set = await readFramedDeployment(chain.provider, chain.categories.get(name)!, layout);
  const record = Object.assign({}, ...set.records.slice(0, layout.dataNftCount)
    .map((entry, nftIndex) => parsePushdataCommitment(entry.token!.nft!.commitment, layout, nftIndex)));
  return (record as Record<string, unknown>)[key];
}

describe('a send to a contract after a loop of calls', () => {
  it('runs the vault\'s receive() after every call the loop makes', async () => {
    const chain = await deployed();
    const result = await drain(chain, [3n, 4n, 5n], 9_000n);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // The payer's body reads its call records in the order it makes the calls, so it accepts only with the vault's
    // call after the sink's three; the completed frames are listed in input order.
    expect(result.completed.map((frame) => frame.functionName).sort())
      .toStrictEqual(['Payer.drain()', 'Sink.add()', 'Sink.add()', 'Sink.add()', 'Vault.__receive()']);
    expect(await field(chain, 'Sink', 'total')).toBe(12n);
    expect(await field(chain, 'Vault', 'received')).toBe(9_000n);
    const containers = await readSatoshiContainers(chain.provider, chain.categories.get('Vault')!);
    expect(containers.reduce((sum, utxo) => sum + utxo.satoshis, 0n)).toBe(9_000n);
  });
});
