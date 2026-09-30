import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callPerCallEntry } from '../../../src/per-call/call/index.js';
import { fundShippedFacets } from '../shapes/harness.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * S0 conformance, spec section 23 row 11: a low-level call, `bool` return decoding and a revert re-raise.
 *
 * OpenZeppelin's SafeERC20 makes the token call as a low-level `CALL` whose calldata is `abi.encodeCall` of the
 * named method, decodes the returned `bool`, and re-raises the callee's revert when the call failed. The row is
 * driven through the shipped path: the shipped compiler under the per-call convention, the shipped deployment and
 * the shipped `callPerCallEntry`, with the shipped decoder for whatever the entry answers or writes.
 *
 * The per-call convention lowers a low-level call whose calldata names an interface method to the typed call it
 * denotes. On the plain call path a call to *another* contract still cannot be planned (its callee frames are the
 * hop's held item), so that spelling is pinned by the refusal it meets. The spelling whose target is the entry's own
 * address is served, and it exercises the same lowering and the same `bool` decode: a true answer runs the entry
 * through, a false answer reaches the caller's own revert.
 */

interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly categoryId: string;
  readonly callerLock: Uint8Array;
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
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
    funder: signature.unlockP2PKH(),
  };
}

/** Enters an entry with a fresh caller coin and returns either the answer or the refusal the path raised. */
async function enter(
  deployed: Deployed,
  artifact: Artifact,
  functionName: string,
  args: readonly unknown[],
): Promise<{ readonly answer?: readonly unknown[]; readonly refusal?: string }> {
  const coin = freshCoin();
  await deployed.provider.addUtxo(binToHex(deployed.callerLock), coin);
  try {
    const result = await callPerCallEntry({
      provider: deployed.provider, artifact, categoryId: deployed.categoryId, functionName, args: args as never,
      callerUtxo: coin, callerLockingBytecode: deployed.callerLock, funder: deployed.funder,
      vm: compositionMachine(),
    });
    if (!result.accepted) {
      return { refusal: result.verdicts.filter((verdict) => !verdict.accepted)
        .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ') };
    }
    return { answer: [...result.values] };
  } catch (error) {
    return { refusal: String((error as Error).message) };
  }
}

/** The low-level call targets the entry's own address, so the convention lowers it and the plain call path serves it. */
const SELF_SOURCE = 'pragma solidity ^0.8.0;'
  + ' interface IToken { function transfer(address to, uint256 amount) external returns (bool); }'
  + ' contract Ledger {'
  + '   uint256 public calls;'
  + '   function transfer(address to, uint256 amount) public returns (bool) {'
  + '     if (amount == 0) { return false; }'
  + '     require(amount <= 10, "over the cap");'
  + '     calls = calls + 1;'
  + '     return true;'
  + '   }'
  + '   function move(address to, uint256 amount) public returns (uint256) {'
  + '     (bool ok, bytes memory data) ='
  + '       address(this).call{value: 0}(abi.encodeCall(IToken.transfer, (to, amount)));'
  + '     require(ok, "low-level call failed");'
  + '     require(abi.decode(data, (bool)), "operation did not succeed");'
  + '     calls = calls + 1;'
  + '     return calls;'
  + '   }'
  + '   function note() public { calls = calls + 1; }'
  + ' }';

/** The low-level call targets another contract, which the plain call path cannot yet plan. */
const CROSS_SOURCE = 'pragma solidity ^0.8.0;'
  + ' interface IToken { function transfer(address to, uint256 amount) external returns (bool); }'
  + ' contract Token {'
  + '   uint256 public moved;'
  + '   function transfer(address to, uint256 amount) external returns (bool) {'
  + '     moved = moved + amount; require(true); return true; }'
  + ' }'
  + ' contract Caller {'
  + '   uint256 public calls;'
  + '   function move(address token, address to, uint256 amount) public {'
  + '     (bool ok, bytes memory data) = token.call{value: 0}(abi.encodeCall(IToken.transfer, (to, amount)));'
  + '     require(ok, "low-level call failed");'
  + '     require(abi.decode(data, (bool)), "operation did not succeed");'
  + '     calls = calls + 1;'
  + '   }'
  + '   function note() public { calls = calls + 1; }'
  + ' }';

const TO = new Uint8Array(25).fill(0x33);

describe('spec section 23 row 11: low-level call, bool return decoding, revert re-raise', () => {
  it('serves a true answer: the entry decodes the bool and runs through', async () => {
    const ledger = compileStringMulti(SELF_SOURCE, { composition: 'per-call', solidityImportCompat: true }).Ledger!;
    expect((ledger.composition as { refusedEntries?: unknown } | undefined)?.refusedEntries).toBeUndefined();
    const deployed = await deployedFor(ledger);
    const entered = await enter(deployed, ledger, 'move', [TO, 5n]);
    // The callee bumped `calls`, the caller decoded the true it returned and bumped it again.
    expect(entered.refusal).toBeUndefined();
    expect(entered.answer).toStrictEqual([2n]);
  }, 120_000);

  it('serves a false answer as the caller\'s own revert, the bool the low-level call decoded', async () => {
    const ledger = compileStringMulti(SELF_SOURCE, { composition: 'per-call', solidityImportCompat: true }).Ledger!;
    const deployed = await deployedFor(ledger);
    const entered = await enter(deployed, ledger, 'move', [TO, 0n]);
    // The callee returned false, so the caller's own `require(abi.decode(data, (bool)))` refuses.
    expect(entered.answer).toBeUndefined();
    expect(entered.refusal).toContain('operation did not succeed');
  }, 120_000);

  it('refuses the cross-contract spelling by name: the call path plans no callee frames', async () => {
    const artifacts = compileStringMulti(CROSS_SOURCE, { composition: 'per-call', solidityImportCompat: true });
    // The body compiles and publishes the callee it lowered the low-level call to.
    const callSite = (artifacts.Caller!.composition as {
      readonly stopSites?: { readonly entries: readonly { readonly functionName: string;
        readonly calls: readonly { readonly interfaceName: string; readonly functionName: string }[] }[] };
    } | undefined)?.stopSites?.entries.find((entry) => entry.functionName === 'Caller.move()')?.calls[0];
    expect(callSite).toMatchObject({ interfaceName: 'IToken', functionName: 'transfer' });
    const deployed = await deployedFor(artifacts.Caller!);
    const entered = await enter(deployed, artifacts.Caller!, 'move',
      [new Uint8Array(35).fill(0x11), TO, 5n]);
    expect(entered.refusal).toMatch(
      /entry "move" makes 1 external call\(s\), whose callee frames this call path does not plan yet/,
    );
  }, 120_000);
});
