import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { validatorAddress, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A mapping node one frame of a contract creates and a later frame of the same contract reads before it writes it.
 *
 * `A.cycle` credits `Ledger` at `A`'s own key, which creates the node, then drains it: `Ledger.drain` reads the
 * balance, calls `Echo`, and zeroes the balance after the call, so its read sits in an earlier segment than its write.
 * No input holds a node an earlier frame created, so the draining frame names it at the output the crediting frame
 * left it at, in every segment that reads it and not only in the one its write lands in.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Echo { uint256 public unit = 1; function ping() external view returns (uint256) { return unit; } }'
  + ' contract Ledger { mapping(address => uint256) public balanceOf; Echo public echo;'
  + '   constructor(Echo e) { echo = e; }'
  + '   function credit(address to, uint256 amount) external { balanceOf[to] += amount; }'
  + '   function drain(address from) external returns (uint256 taken) {'
  + '     uint256 held = balanceOf[from]; uint256 one = echo.ping(); balanceOf[from] = 0; taken = held * one; }'
  + '   function move(address from, address to, uint256 amount) external {'
  + '     balanceOf[from] -= amount; balanceOf[to] += amount; } }'
  + ' contract A { Ledger public ledger;'
  + '   constructor(Ledger l) { ledger = l; }'
  + '   function cycle(uint256 amount) external returns (uint256) {'
  + '     ledger.credit(address(this), amount); return ledger.drain(address(this)); }'
  + '   function prime(address other) external { ledger.credit(address(this), 1); ledger.credit(other, 1); }'
  + '   function relay(address other, uint256 amount) external {'
  + '     ledger.credit(address(this), amount); ledger.move(address(this), other, amount); } }';

interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly artifacts: Readonly<Record<string, Artifact>>;
  readonly categories: ReadonlyMap<string, string>;
  readonly snapshot: SnapshotRestorer;
}

let run: Promise<Deployed> | undefined;

/** Echo, Ledger and A, each holding the one before it; each case rewinds the chain to them first. */
async function deployed(): Promise<Deployed> {
  run ??= (async (): Promise<Deployed> => {
    const compiled = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never);
    const artifacts = { Echo: compiled.Echo!, Ledger: compiled.Ledger!, A: compiled.A! };
    const { framedValidator } = await import('@solidcash/solidc');
    const validatorProgram = framedValidator.buildValidatorProgram();
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    await fundShippedFacets(provider);
    const categories = new Map<string, string>();
    const locks = new Map<string, Uint8Array>();
    for (const [index, [name, args]] of ([['Echo', []], ['Ledger', ['Echo']], ['A', ['Ledger']]] as const).entries()) {
      const fundingUtxo = { txid: `${'75'.repeat(31)}${(0xa0 + index).toString(16)}`, vout: 0, satoshis: 500_000n };
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

/** Enters one of A's entries with a fresh coin of the user's. */
async function enter(
  chain: Deployed, functionName: string, args: readonly (bigint | Uint8Array)[],
): Promise<FramedCallResult> {
  coins += 1;
  const user = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: `${'76'.repeat(31)}${coins.toString(16).padStart(2, '0')}`, vout: 0, satoshis: 300_000n };
  await chain.provider.addUtxo(binToHex(user), callerUtxo);
  const externals = Object.fromEntries([...chain.categories]
    .map(([name, categoryId]) => [name, { artifact: chain.artifacts[name]!, categoryId }]));
  return callFramedEntry({
    provider: chain.provider, artifact: chain.artifacts.A!, categoryId: chain.categories.get('A')!,
    functionName, args, callerUtxo, callerLockingBytecode: user,
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(), vm: compositionMachine(), externals,
  });
}

/** A ledger balance as the chain holds it. */
async function balanceOf(chain: Deployed, holder: Uint8Array): Promise<unknown> {
  const read = await readFramedEntry({
    provider: chain.provider, artifact: chain.artifacts.Ledger!, categoryId: chain.categories.get('Ledger')!,
    functionName: 'balanceOf', args: [holder], vm: compositionMachine(),
  });
  return read.value;
}

describe('a node one frame creates and a later frame of the contract reads before it writes', () => {
  it('reads the created balance before the call and zeroes it after', async () => {
    const chain = await deployed();
    const result = await enter(chain, 'cycle', [9n]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(result.values).toStrictEqual([9n]);
    expect(result.completed.map((frame) => frame.functionName))
      .toStrictEqual(['Ledger.credit()', 'Echo.ping()', 'Ledger.drain()', 'A.cycle()']);
  });

  it('moves a balance an earlier frame of the call credited, from a node both frames rewrite', async () => {
    const chain = await deployed();
    const other = encodeLockingBytecodeP2pkh(alicePkh);
    expect((await enter(chain, 'prime', [other])).accepted).toBe(true);
    const result = await enter(chain, 'relay', [other, 4n]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(await balanceOf(chain, other)).toBe(5n);
  });
});
