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
import { alicePkh, alicePriv, alicePub, bobPkh } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A low-level call whose callee refuses is reported by the caller's own check over the call's success.
 *
 * The EVM's low-level call returns a callee's revert to its caller as `false`, and `Helper`'s `require` over it then
 * refuses with its own message. The token's `transfer` and the refuser's `receive()` each refuse by a reason of their
 * own, which the execution never reports: the call path names the helper's check, as the EVM does. So does a call to
 * a contract with no body for it, `Bare` having no `approve`, which fails where the helper makes it.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' interface IApprove { function approve(address to, uint256 v) external returns (bool); }'
  + ' contract Token { uint256 public unit = 1;'
  + '   function transfer(address to, uint256 v) external returns (bool) {'
  + '     require(unit == 0, "Token: REVERTED"); unit = v; to; return true; } }'
  + ' contract Refuser { uint256 public unit = 1;'
  + '   receive() external payable { require(unit == 0, "Refuser: NO"); } }'
  + ' contract Bare { uint256 public unit = 1; }'
  + ' contract Helper { uint256 public unit = 1;'
  + '   function pay(address token, address to, uint256 v) external {'
  + '     (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, v));'
  + '     require(success && (data.length == 0 || abi.decode(data, (bool))), "Helper: TRANSFER_FAILED"); }'
  + '   function approve(address token, address to, uint256 v) external {'
  + '     (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x095ea7b3, to, v));'
  + '     require(success && (data.length == 0 || abi.decode(data, (bool))), "Helper: APPROVE_FAILED"); }'
  + '   function payEth(address to, uint256 v) external payable {'
  + '     (bool success,) = to.call{value: v}(new bytes(0));'
  + '     require(success, "Helper: ETH_TRANSFER_FAILED"); } }';

interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly artifacts: Readonly<Record<string, Artifact>>;
  readonly categories: ReadonlyMap<string, string>;
  readonly locks: ReadonlyMap<string, Uint8Array>;
  readonly snapshot: SnapshotRestorer;
}

let run: Promise<Deployed> | undefined;

/** The token, the refuser, the bare contract and the helper; each case rewinds the chain to them first. */
async function deployed(): Promise<Deployed> {
  run ??= (async (): Promise<Deployed> => {
    const compiled = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never);
    const artifacts = {
      Token: compiled.Token!, Refuser: compiled.Refuser!, Bare: compiled.Bare!, Helper: compiled.Helper!,
    };
    const { framedValidator } = await import('@solidcash/solidc');
    const validatorProgram = framedValidator.buildValidatorProgram();
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    await fundShippedFacets(provider);
    const categories = new Map<string, string>();
    const locks = new Map<string, Uint8Array>();
    for (const [index, name] of (['Token', 'Refuser', 'Bare', 'Helper'] as const).entries()) {
      const fundingUtxo = { txid: `${'78'.repeat(31)}${(0xa0 + index).toString(16)}`, vout: 0, satoshis: 500_000n };
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

let coins = 0;

/** Enters one of the helper's entries with a fresh coin of the user's. */
async function enter(
  chain: Deployed, functionName: string, args: readonly (bigint | Uint8Array)[], value = 0n,
): Promise<FramedCallResult> {
  coins += 1;
  const user = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: `${'77'.repeat(31)}${coins.toString(16).padStart(2, '0')}`, vout: 0, satoshis: 300_000n };
  await chain.provider.addUtxo(binToHex(user), callerUtxo);
  const externals = Object.fromEntries([...chain.categories]
    .map(([name, categoryId]) => [name, { artifact: chain.artifacts[name]!, categoryId }]));
  return callFramedEntry({
    provider: chain.provider, artifact: chain.artifacts.Helper!, categoryId: chain.categories.get('Helper')!,
    functionName, args, callerUtxo, callerLockingBytecode: user,
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(), vm: compositionMachine(), externals,
    ...(value === 0n ? {} : { value }),
  });
}

describe('a low-level call whose callee refuses', () => {
  it('is reported by the caller\'s check over the call\'s success, for a call with a payload', async () => {
    const chain = await deployed();
    const result = await enter(chain, 'pay', [chain.locks.get('Token')!, encodeLockingBytecodeP2pkh(bobPkh), 5n]);
    expect(result.broadcast).toBeUndefined();
    expect(result.refusal?.innermost?.reason.message).toBe('Helper: TRANSFER_FAILED');
    expect(result.refusal?.innermost?.contract).toContain('Helper');
  });

  it('is reported by the caller\'s check where it calls a contract with no body for the call', async () => {
    const chain = await deployed();
    const result = await enter(chain, 'approve', [chain.locks.get('Bare')!, encodeLockingBytecodeP2pkh(bobPkh), 5n]);
    expect(result.broadcast).toBeUndefined();
    expect(result.refusal?.innermost?.reason.message).toBe('Helper: APPROVE_FAILED');
  });

  it('is reported by the caller\'s check over the send\'s success, for a value call', async () => {
    const chain = await deployed();
    const result = await enter(chain, 'payEth', [chain.locks.get('Refuser')!, 1_000n], 1_000n);
    expect(result.broadcast).toBeUndefined();
    expect(result.refusal?.innermost?.reason.message).toBe('Helper: ETH_TRANSFER_FAILED');
  });
});
