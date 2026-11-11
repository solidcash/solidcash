import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { validatorAddress, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A callee frame's call the plan cannot state is met only where the frame makes it.
 *
 * `Root.go` calls `Middle.pass`, which pays `Sink.add` an amount below zero for a small `x`: no `uint256` holds it, so
 * the plan states no call there. `Middle.pass` checks `x` first when asked to, and that check is what the call meets;
 * a body that makes the call unchecked meets the plan's own refusal of it instead.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Sink { uint256 public total;'
  + '   function add(uint256 amount) external { total = total + amount; } }'
  + ' contract Middle { Sink public sink;'
  + '   constructor(Sink s) { sink = s; }'
  + '   function pass(uint256 x, bool checked) external {'
  + '     if (checked) require(x >= 10, "Middle: SMALL");'
  + '     unchecked { sink.add(x - 10); } } }'
  + ' contract Root { Middle public m;'
  + '   constructor(Middle x) { m = x; }'
  + '   function go(uint256 x, bool checked) external { m.pass(x, checked); } }';

interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly artifacts: Readonly<Record<string, Artifact>>;
  readonly categories: ReadonlyMap<string, string>;
  readonly snapshot: SnapshotRestorer;
}

let run: Promise<Deployed> | undefined;

/** Sink, Middle and Root, each holding the one before; each case rewinds the chain to them first. */
async function deployed(): Promise<Deployed> {
  run ??= (async (): Promise<Deployed> => {
    const compiled = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never);
    const artifacts = { Sink: compiled.Sink!, Middle: compiled.Middle!, Root: compiled.Root! };
    const { framedValidator } = await import('@solidcash/solidc');
    const validatorProgram = framedValidator.buildValidatorProgram();
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    await fundShippedFacets(provider);
    const categories = new Map<string, string>();
    const locks = new Map<string, Uint8Array>();
    const order = [['Sink', []], ['Middle', ['Sink']], ['Root', ['Middle']]] as const;
    for (const [index, [name, args]] of order.entries()) {
      const fundingUtxo = { txid: `${'7a'.repeat(31)}${(0xa0 + index).toString(16)}`, vout: 0, satoshis: 500_000n };
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

let coins = 0;

/** Enters `Root.go` with a fresh coin of the user's. */
async function go(chain: Deployed, x: bigint, checked: boolean): Promise<FramedCallResult> {
  coins += 1;
  const user = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: `${'79'.repeat(31)}${coins.toString(16).padStart(2, '0')}`, vout: 0, satoshis: 300_000n };
  await chain.provider.addUtxo(binToHex(user), callerUtxo);
  const externals = Object.fromEntries([...chain.categories]
    .map(([name, categoryId]) => [name, { artifact: chain.artifacts[name]!, categoryId }]));
  return callFramedEntry({
    provider: chain.provider, artifact: chain.artifacts.Root!, categoryId: chain.categories.get('Root')!,
    functionName: 'go', args: [x, checked], callerUtxo, callerLockingBytecode: user,
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(), vm: compositionMachine(), externals,
  });
}

describe('a callee frame\'s call the plan cannot state', () => {
  it('is never met by a frame whose own check stops it first, which names its own reason', async () => {
    const chain = await deployed();
    const result = await go(chain, 3n, true);
    expect(result.broadcast).toBeUndefined();
    expect(result.refusal?.innermost?.reason.message).toBe('Middle: SMALL');
  });

  it('is refused by name where the frame makes it', async () => {
    const chain = await deployed();
    await expect(go(chain, 3n, false)).rejects.toThrow(
      /entry "go": the call to "Sink\.add" passes -7 as argument 0, which its type uint256 cannot hold/,
    );
  });

  it('is stated, and made, for an amount its type holds', async () => {
    const chain = await deployed();
    const result = await go(chain, 12n, true);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});
