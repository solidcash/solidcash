import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callPerCallEntry } from '../../../src/per-call/call/index.js';
import { fundShippedFacets } from '../shapes/harness.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * S0 conformance, spec section 23 row 6: a custom error raised in a callee and re-raised by SafeERC20 assembly.
 *
 * OpenZeppelin's SafeERC20 `_callOptionalReturn` makes the token call as a low-level `CALL` and, when it failed,
 * bubbles the callee's revert data verbatim through `assembly { revert(add(32, returndata), mload(returndata)) }`;
 * the callee raises a custom error such as `ERC20InsufficientAllowance`. The row is driven through the shipped
 * path: the shipped compiler under the per-call convention, the shipped deployment and the shipped
 * `callPerCallEntry`, whose refusal report is the shipped decoder for the error's name and arguments.
 *
 * On the plain call path a call to *another* contract still cannot be planned (its callee frames are the hop's
 * held item), so the SafeERC20 spelling that makes the call and carries the assembly re-raise is pinned by the
 * refusal it meets. The spelling whose target is the entry's own address is served: the custom error the callee
 * raised is reported with its name, its declared parameters and the values it was raised with, read back from the
 * artifact's error ABI through the shipped refusal decoder. (With the self-call inlined, the callee's `revert`
 * reaches the frame directly, so the served case pins the error decode; the assembly re-raise rides the
 * cross-contract spelling that is refused.)
 */

/** A deployment, and the chain as it stood when it was done. */
interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly categoryId: string;
  readonly callerLock: Uint8Array;
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
  readonly snapshot: SnapshotRestorer;
}

let nonce = 0;

function freshCoin(): { txid: string; vout: number; satoshis: bigint } {
  nonce += 1;
  return { txid: `${nonce.toString(16).padStart(2, '0')}`.repeat(32), vout: 0, satoshis: 300_000n };
}

async function deployedFor(artifact: Artifact): Promise<Deployed> {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const fundingUtxo = { ...freshCoin(), satoshis: 500_000n };
  await provider.addUtxo(funder.address, fundingUtxo);
  await fundShippedFacets(provider);
  const deployment = await deployStatefulContract(artifact, [], {
    provider, fundingUtxo, funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address,
  });
  return {
    provider, categoryId: deployment.categoryId, callerLock: encodeLockingBytecodeP2pkh(alicePkh),
    funder: signature.unlockP2PKH(), snapshot: await provider.takeSnapshot(),
  };
}

let selfRun: Promise<Deployed> | undefined;

/** The self-target ledger's one deployment, which both of its cases enter, each rewinding the chain to it first. */
async function selfDeployed(ledger: Artifact): Promise<Deployed> {
  selfRun ??= deployedFor(ledger);
  const deployed = await selfRun;
  await deployed.snapshot.restore();
  return deployed;
}

/** Enters an entry with a fresh caller coin and returns the shipped result, or the refusal text the path raised. */
async function enter(
  deployed: Deployed,
  artifact: Artifact,
  functionName: string,
  args: readonly unknown[],
): Promise<ReturnType<typeof callPerCallEntry>> {
  const coin = freshCoin();
  await deployed.provider.addUtxo(binToHex(deployed.callerLock), coin);
  return callPerCallEntry({
    provider: deployed.provider, artifact, categoryId: deployed.categoryId, functionName, args: args as never,
    callerUtxo: coin, callerLockingBytecode: deployed.callerLock, funder: deployed.funder, vm: compositionMachine(),
  });
}

const REVERT = '   function _revert(bytes memory ret) private pure {'
  + ' if (ret.length > 0) { assembly { let size := mload(ret) revert(add(32, ret), size) } }'
  + ' else { revert("operation did not succeed"); } }';

/** The low-level call targets the entry's own address, so the convention lowers it and the plain call path serves it. */
const SELF_SOURCE = 'pragma solidity ^0.8.0;'
  + ' error InsufficientAllowance(uint256 requested, uint256 available);'
  + ' interface IToken { function transferFrom(address from, address to, uint256 amount) external returns (bool); }'
  + ' contract Ledger {'
  + '   uint256 public calls;'
  + '   function transferFrom(address from, address to, uint256 amount) public returns (bool) {'
  + '     if (amount > 10) { revert InsufficientAllowance(amount, 10); }'
  + '     calls = calls + 1;'
  + '     return true;'
  + '   }'
  + '   function pull(address from, address to, uint256 amount) public returns (uint256) {'
  + '     (bool ok, bytes memory ret) ='
  + '       address(this).call{value: 0}(abi.encodeCall(IToken.transferFrom, (from, to, amount)));'
  + '     if (!ok) { _revert(ret); }'
  + '     require(abi.decode(ret, (bool)), "operation did not succeed");'
  + '     calls = calls + 1;'
  + '     return calls;'
  + '   }'
  + REVERT
  + '   function note() public { calls = calls + 1; }'
  + ' }';

/** The low-level call targets another contract, which the plain call path cannot yet plan. */
const CROSS_SOURCE = 'pragma solidity ^0.8.0;'
  + ' error InsufficientAllowance(uint256 requested, uint256 available);'
  + ' interface IToken { function transferFrom(address from, address to, uint256 amount) external returns (bool); }'
  + ' contract Token {'
  + '   uint256 public moved;'
  + '   function transferFrom(address from, address to, uint256 amount) external returns (bool) {'
  + '     if (amount > 10) { revert InsufficientAllowance(amount, 10); }'
  + '     moved = moved + amount; require(true); return true;'
  + '   }'
  + ' }'
  + ' contract Caller {'
  + '   uint256 public calls;'
  + '   function pull(address token, address from, address to, uint256 amount) public {'
  + '     (bool ok, bytes memory ret) ='
  + '       token.call{value: 0}(abi.encodeCall(IToken.transferFrom, (from, to, amount)));'
  + '     if (!ok) { _revert(ret); }'
  + '     require(abi.decode(ret, (bool)), "operation did not succeed");'
  + '     calls = calls + 1;'
  + '   }'
  + REVERT
  + '   function note() public { calls = calls + 1; }'
  + ' }';

const FROM = new Uint8Array(25).fill(0x22);
const TO = new Uint8Array(25).fill(0x33);

describe('spec section 23 row 6: custom errors raised in a callee and re-raised', () => {
  it('serves the custom error: its name and the values it was raised with come back through the decoder', async () => {
    const ledger = compileStringMulti(SELF_SOURCE, { composition: 'per-call', solidityImportCompat: true }).Ledger!;
    expect(ledger.composition?.refusedEntries).toBeUndefined();
    const deployed = await selfDeployed(ledger);
    const result = await enter(deployed, ledger, 'pull', [FROM, TO, 50n]);
    expect(result.accepted).toBe(false);
    const error = result.refusal?.innermost?.reason.error;
    // The error the artifact declares, and the arguments the reverted frame was raising it with.
    expect(error?.name).toBe('InsufficientAllowance');
    expect(error?.parameters).toStrictEqual([
      { name: 'requested', type: 'uint256' },
      { name: 'available', type: 'uint256' },
    ]);
    expect(result.refusal?.innermost?.reason.arguments).toStrictEqual([50n, 10n]);
    // The refusal is a bare verification failure on chain; the name and values are what the artifact publishes.
    expect(result.refusal?.innermost?.objection).toContain('OP_VERIFY');
  }, 120_000);

  it('serves the call the callee admits: the bool it returned is decoded and the entry runs through', async () => {
    const ledger = compileStringMulti(SELF_SOURCE, { composition: 'per-call', solidityImportCompat: true }).Ledger!;
    const deployed = await selfDeployed(ledger);
    const result = await enter(deployed, ledger, 'pull', [FROM, TO, 5n]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.value).toBe(2n);
  }, 120_000);

  it('refuses the cross-contract spelling by name: the call path plans no callee frames', async () => {
    const artifacts = compileStringMulti(CROSS_SOURCE, { composition: 'per-call', solidityImportCompat: true });
    // The body compiles and publishes the callee it lowered the low-level call to.
    const callSite = artifacts.Caller!.composition?.stopSites?.entries
      .find((entry) => entry.functionName === 'Caller.pull()')?.calls[0];
    expect(callSite).toMatchObject({ interfaceName: 'IToken', functionName: 'transferFrom' });
    const deployed = await deployedFor(artifacts.Caller!);
    await expect(enter(deployed, artifacts.Caller!, 'pull', [new Uint8Array(35).fill(0x11), FROM, TO, 50n]))
      .rejects.toThrow(
        /entry "pull" makes 1 external call\(s\), whose callee frames this call path does not plan yet/,
      );
  }, 120_000);
});
