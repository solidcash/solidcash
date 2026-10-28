import { describe, expect, it } from 'vitest';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { createTxVerifier } from '@mem-cash/validation';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';

/**
 * F1 (security-audit-2026-10-16): a contract caller was identified by PRESENCE (a co-spent minting master of the
 * builder-named category), not by a call. A spender who co-spends A's master but runs an A function that makes no
 * call to X could satisfy `require(msg.sender == A)` in X while A never called it.
 *
 * Fix (caller-attested call edges): a direct caller pins an own-category edge record committing to the call's
 * digest; a callee resolving a contract msg.sender requires a co-spent caller-category edge matching its own run
 * digest. The honest call settles (the SDK wires X's sender to A and pins A's edge); a forged spend whose edge is
 * absent or does not match (A made no such call) is refused at the callee's edge OP_VERIFY. mem-cash BCH_2026_05.
 */
const CALLEE = `pragma solidity ^0.8.0;
contract Callee {
  uint256 public hits;
  address public market;
  function accept() public { require(msg.sender == this.market); this.hits = this.hits + 1; }
}`;
const CALLER = `pragma solidity ^0.8.0;
interface ISingle { function accept() external; }
contract Caller {
  uint256 public bumps;
  function run(address a) public { ISingle(a).accept(); this.bumps = this.bumps + 1; }
}`;

const verifier = createTxVerifier({ vmVersion: 'BCH_2026_05', standard: true, skipFeePolicy: true });

function hexToBinSafe(hex: string): Uint8Array {
  return Uint8Array.from((hex.match(/.{2}/g) ?? []).map((b) => parseInt(b, 16)));
}

function runVm(call: any): { success: boolean; error?: string } {
  const tx = call.buildLibauthTransaction();
  const hex = binToHex(encodeTransaction(tx));
  const sourceOutputs = generateLibauthSourceOutputs(call.inputs);
  const lt = Number(tx.locktime);
  const chain = lt < 500000000
    ? { height: lt + 1, medianTimePast: 1700000000 } : { height: 133700, medianTimePast: lt + 1 };
  const result = verifier.verify(hex, sourceOutputs, chain);
  return { success: result.success, error: result.success ? undefined : (result.debugMessage ?? result.error) };
}

async function setup(): Promise<{ scCaller: any; scCallee: any; calleeAddr: Uint8Array }> {
  const provider = createTestProvider();
  const artCaller = compileString(CALLER, { evmCompat: true });
  const caller = new Contract(artCaller, [], { provider });
  const { categoryId: catCaller } = await setupStatefulUtxos(
    provider, caller, artCaller.stateLayout!, { bumps: 0n }, { saltContract: true },
  );
  const callerAddr = caller.withCategory(hexToBinSafe(catCaller)).lockingBytecode;

  const artCallee = compileString(CALLEE, { evmCompat: true });
  const callee = new Contract(artCallee, [], { provider });
  const { categoryId: catCallee } = await setupStatefulUtxos(
    provider, callee, artCallee.stateLayout!, { hits: 0n, market: callerAddr }, { saltContract: true },
  );
  return {
    scCaller: StatefulContract.withCategory(caller, catCaller),
    scCallee: StatefulContract.withCategory(callee, catCallee),
    calleeAddr: callee.withCategory(hexToBinSafe(catCallee)).lockingBytecode,
  };
}

describe('F1 caller-attested call edge binds a contract caller to its call (VM)', () => {
  it('settles the honest A->X call (X sees msg.sender == A and the edge is present)', async () => {
    const { scCaller, scCallee, calleeAddr } = await setup();
    const run = await scCaller.run(calleeAddr).withExternalCall(scCallee, 'accept', []).build();
    const r = runVm(run);
    expect(r.error ?? 'ok').not.toContain('OP_VERIFY');
    expect(r.success).toBe(true);
  }, 300_000);

  it('refuses the forgery: A co-spent but its edge record does not attest the call', async () => {
    const { scCaller, scCallee, calleeAddr } = await setup();
    const run = await scCaller.run(calleeAddr).withExternalCall(scCallee, 'accept', []).build();
    const tx = run.buildLibauthTransaction();
    // Find A's edge output (own-category immutable NFT under the OP_1 OP_NOP carrier lock) and corrupt its
    // commitment, modelling a spend where A's co-spent run did not attest this call to X.
    const edge = tx.outputs.find((o: any) => o.lockingBytecode.length === 2
      && o.lockingBytecode[0] === 0x51 && o.lockingBytecode[1] === 0x61 && o.token?.nft !== undefined);
    expect(edge, 'edge output present in the honest build').toBeDefined();
    edge!.token.nft.commitment = hexToBin('00'.repeat(32));
    const r = runVm(run);
    expect(r.success).toBe(false);
    expect(r.error ?? '').toMatch(/OP_VERIFY|OP_EQUALVERIFY|failed/i);
  }, 300_000);
});
