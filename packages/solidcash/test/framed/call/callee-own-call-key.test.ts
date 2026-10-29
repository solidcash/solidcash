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
 * A callee frame whose mapping write is keyed by what one of its own calls returned.
 *
 * `A.pay` calls `Ledger.credit`, which asks `Registry` for the account its fee goes to and credits that account and
 * the payee. The fee account is no fact of the caller's: the plan keys the write under a placeholder until the
 * registry's frame has answered, and the call is planned again from what it returned. A second payment rewrites the
 * nodes the first created.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Registry { uint256 public unit = 1;'
  + '   function target() external view returns (address) { return address(this); } }'
  + ' contract Ledger { mapping(address => uint256) public balanceOf; Registry public registry;'
  + '   constructor(Registry r) { registry = r; }'
  + '   function credit(address to, uint256 amount) external {'
  + '     address fee = registry.target(); balanceOf[fee] += 1; balanceOf[to] += amount; } }'
  + ' contract A { Ledger public ledger;'
  + '   constructor(Ledger l) { ledger = l; }'
  + '   function pay(address to, uint256 amount) external { ledger.credit(to, amount); } }';

interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly artifacts: Readonly<Record<string, Artifact>>;
  readonly categories: ReadonlyMap<string, string>;
  readonly locks: ReadonlyMap<string, Uint8Array>;
  readonly snapshot: SnapshotRestorer;
}

let run: Promise<Deployed> | undefined;

/** Registry, Ledger and A, each holding the one before it; each case rewinds the chain to them first. */
async function deployed(): Promise<Deployed> {
  run ??= (async (): Promise<Deployed> => {
    const compiled = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never);
    const artifacts = { Registry: compiled.Registry!, Ledger: compiled.Ledger!, A: compiled.A! };
    const { framedValidator } = await import('@solidcash/solidc');
    const validatorProgram = framedValidator.buildValidatorProgram();
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    await fundShippedFacets(provider);
    const categories = new Map<string, string>();
    const locks = new Map<string, Uint8Array>();
    for (const [index, [name, args]] of ([['Registry', []], ['Ledger', ['Registry']], ['A', ['Ledger']]] as const)
      .entries()) {
      const fundingUtxo = { txid: `${'79'.repeat(31)}${(0xa0 + index).toString(16)}`, vout: 0, satoshis: 500_000n };
      await provider.addUtxo(funder.address, fundingUtxo);
      const deployment = await deployStatefulContract(artifacts[name]!, args.map((arg) => locks.get(arg)!), {
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

let coins = 0;

/** Enters `A.pay` with a fresh coin of the user's. */
async function pay(chain: Deployed, to: Uint8Array, amount: bigint): Promise<FramedCallResult> {
  coins += 1;
  const user = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: `${'7a'.repeat(31)}${coins.toString(16).padStart(2, '0')}`, vout: 0, satoshis: 300_000n };
  await chain.provider.addUtxo(binToHex(user), callerUtxo);
  const externals = Object.fromEntries([...chain.categories]
    .map(([name, categoryId]) => [name, { artifact: chain.artifacts[name]!, categoryId }]));
  return callFramedEntry({
    provider: chain.provider, artifact: chain.artifacts.A!, categoryId: chain.categories.get('A')!,
    functionName: 'pay', args: [to, amount], callerUtxo, callerLockingBytecode: user,
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

describe('a callee write keyed by what its own call returned', () => {
  it('credits the account the callee\'s call names, creating its node and then rewriting it', async () => {
    const chain = await deployed();
    const payee = encodeLockingBytecodeP2pkh(alicePkh);
    for (const amount of [4n, 6n]) {
      const result = await pay(chain, payee, amount);
      expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
      expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(await balanceOf(chain, chain.locks.get('Registry')!)).toBe(2n);
    expect(await balanceOf(chain, payee)).toBe(10n);
  });
});
