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
  address public lastCaller;
  // Reading a contract-caller msg.sender is what requires the caller-attested edge (F1); storing it avoids the
  // separate evmCompat address-representation question (F4/F14) that an == comparison would raise.
  function accept() public { this.lastCaller = msg.sender; this.hits = this.hits + 1; }
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

async function setup(): Promise<{ scCaller: any; scCallee: any; calleeAddr: Uint8Array }> {
  const provider = createTestProvider();
  const artCaller = compileString(CALLER, { evmCompat: true });
  const caller = new Contract(artCaller, [], { provider });
  const { categoryId: catCaller } = await setupStatefulUtxos(
    provider, caller, artCaller.stateLayout!, { bumps: 0n }, { saltContract: true },
  );

  const artCallee = compileString(CALLEE, { evmCompat: true });
  const callee = new Contract(artCallee, [], { provider });
  const { categoryId: catCallee } = await setupStatefulUtxos(
    provider, callee, artCallee.stateLayout!, { hits: 0n, lastCaller: new Uint8Array(20) }, { saltContract: true },
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
    // Verify the covenant + appended edge at the VM level (as the other audit tests do), independent of send()'s
    // multi-phase fee assembly: build() appends A's edge; a plain funder past every block covers the fee.
    const tx = run.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(run.inputs);
    tx.inputs.push({
      outpointTransactionHash: hexToBin('11'.repeat(32)), outpointIndex: 0,
      sequenceNumber: 0xffffffff, unlockingBytecode: Uint8Array.of(),
    });
    sourceOutputs.push({ lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 1_000_000n });
    const edge = tx.outputs.find((o: any) => o.lockingBytecode.length === 2
      && o.lockingBytecode[0] === 0x51 && o.lockingBytecode[1] === 0x61 && o.token?.nft !== undefined);
    expect(edge, 'edge output present in the honest build').toBeDefined();
    const hex = binToHex(encodeTransaction(tx));
    const lt = Number(tx.locktime);
    const chain = lt < 500000000
      ? { height: lt + 1, medianTimePast: 1700000000 } : { height: 133700, medianTimePast: lt + 1 };
    const result = verifier.verify(hex, sourceOutputs, chain);
    expect(result.debugMessage ?? result.error ?? 'ok').not.toContain('OP_VERIFY');
    expect(result.success).toBe(true);
  }, 300_000);

  it('refuses the forgery: A co-spent but its edge record does not attest the call', async () => {
    const { scCaller, scCallee, calleeAddr } = await setup();
    const run = await scCaller.run(calleeAddr).withExternalCall(scCallee, 'accept', []).build();
    // Build once; tamper + balance THAT object (buildLibauthTransaction would rebuild and drop the tamper).
    const tx = run.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(run.inputs);
    // A plain anyone-can-spend funder appended past every block covers the fee .build() leaves unfunded, so the VM
    // reaches the covenant rather than a value-balance stop (no block input index shifts).
    tx.inputs.push({
      outpointTransactionHash: hexToBin('11'.repeat(32)), outpointIndex: 0,
      sequenceNumber: 0xffffffff, unlockingBytecode: Uint8Array.of(),
    });
    sourceOutputs.push({ lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 1_000_000n });
    // Corrupt A's edge record (own-category immutable NFT under the OP_1 OP_NOP carrier), modelling a spend where
    // A's co-spent run did not attest this call to X. The callee's edge requirement must then refuse it.
    const edge = tx.outputs.find((o: any) => o.lockingBytecode.length === 2
      && o.lockingBytecode[0] === 0x51 && o.lockingBytecode[1] === 0x61 && o.token?.nft !== undefined);
    expect(edge, 'edge output present in the honest build').toBeDefined();
    edge!.token!.nft!.commitment = hexToBin('00'.repeat(32));
    const hex = binToHex(encodeTransaction(tx));
    const lt = Number(tx.locktime);
    const chain = lt < 500000000
      ? { height: lt + 1, medianTimePast: 1700000000 } : { height: 133700, medianTimePast: lt + 1 };
    const result = verifier.verify(hex, sourceOutputs, chain);
    expect(result.success).toBe(false);
    expect(result.debugMessage ?? result.error ?? '').toMatch(/OP_VERIFY|OP_EQUALVERIFY/i);
  }, 300_000);
});
