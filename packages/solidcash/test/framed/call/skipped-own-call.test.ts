import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { parsePushdataCommitment, validatorAddress, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * An entry whose own argument guards one of its calls away, on the plain call path.
 *
 * `A.run` calls `B.peek` in an arm its `flag` decides and once after it, writing its record after each call. Its
 * block holds one record per call the execution makes, in the order it makes them: the plan states no call for the
 * arm a false `flag` skips, and the body binds the call after the arm to the first record. The record written in
 * every segment the execution has is what lands on chain.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract B { uint256 public marker;'
  + '   function peek(uint256 x) external view returns (uint256) { return x + 1; } }'
  + ' contract A { B public b; uint256 public last; constructor(B b_) { b = b_; }'
  + '   function run(uint256 x, bool flag) external {'
  + '     if (flag) { last = b.peek(x); }'
  + '     last = last + b.peek(x + 2);'
  + '   } }';

describe('an entry whose own argument guards a call away, on the plain call path', () => {
  it('settles the calls each argument makes, one record per call the execution made', async () => {
    const compiled = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never);
    const artifacts: Readonly<Record<string, Artifact>> = { A: compiled.A!, B: compiled.B! };
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
    const externals = Object.fromEntries([...categories]
      .map(([name, categoryId]) => [name, { artifact: artifacts[name]!, categoryId }]));
    const user = encodeLockingBytecodeP2pkh(alicePkh);
    const enter = async (flag: boolean, coin: number): Promise<Awaited<ReturnType<typeof callFramedEntry>>> => {
      const callerUtxo = { txid: `${'74'.repeat(31)}${coin.toString(16).padStart(2, '0')}`, vout: 0, satoshis: 300_000n };
      await provider.addUtxo(binToHex(user), callerUtxo);
      return callFramedEntry({
        provider, artifact: artifacts.A!, categoryId: categories.get('A')!, functionName: 'run', args: [5n, flag],
        callerUtxo, callerLockingBytecode: user, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
        vm: compositionMachine(), externals,
      });
    };
    const last = async (): Promise<unknown> => {
      const layout = artifacts.A!.stateLayout!;
      const set = await readFramedDeployment(provider, categories.get('A')!, layout);
      return parsePushdataCommitment(set.records[0]!.token!.nft!.commitment, layout, 0).last;
    };

    const skipped = await enter(false, 1);
    expect(skipped.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(skipped.draft.blockOf('master').calls).toHaveLength(1);
    expect(await last()).toBe(8n);
    const taken = await enter(true, 2);
    expect(taken.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(taken.draft.blockOf('master').calls).toHaveLength(2);
    expect(await last()).toBe(14n);
  }, 120_000);
});
