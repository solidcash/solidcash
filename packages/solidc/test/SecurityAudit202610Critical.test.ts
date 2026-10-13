/**
 * One hostile transaction per October 2026 CRITICAL finding.
 *
 * Each case compiles through this worktree's compiler and is evaluated on the BCH 2026 VM. The authorized
 * spend of the same function is accepted. The attack the verifier file names is rejected. Direct cases keep
 * the message bus enabled (`messageBus: true`); a graph-free auto compile would narrow the bus off and hide
 * DX-6. Matchers `.reverted` and `.withArgs` are not the proof.
 */
import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2sh32, hash256, hexToBin,
} from '@bitauth/libauth';
import {
  asmToScript, buildDataNftCovenantScript, buildEntryNftCovenantScript,
  buildPushdataCommitment, buildSatoshiContainerCovenantScript, buildTokenContainerCovenantScript,
  computeCollectionHash, computeCollectionSignature, ecrecoverComputeLockingBytecode,
  encodeIntegerValue, scriptToBytecode, SHARED_LIBRARY_SALT, type AbiFunction, type Artifact,
} from '@solidcash/utils';
import { ethers } from 'ethers';
import { encodeEntryCommitment, keyToSlotMulti } from '../../solidcash/src/stateful/SortedList.js';
import { buildKeccakComputeSidecar } from '../../solidcash/src/keccak/keccakComputeSidecar.js';
import { buildEcrecoverComputeSidecars, probeEcrecoverSplit }
  from '../../solidcash/src/ecrecover/ecrecoverComputeSidecar.js';
import { computeEcrecoverWitness } from '../../solidcash/src/ecrecover/ecrecoverRecovery.js';
import { compileString } from '../src/index.js';
import { Contract } from '../../solidcash/src/Contract.js';
import { StatefulContract } from '../../solidcash/src/stateful/index.js';
import * as messageBus from '../../solidcash/src/message-bus/index.js';
import { generateLibauthSourceOutputs } from '../../solidcash/src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../solidcash/src/network/createVirtualMachine.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../solidcash/test/test-util.js';
import { createMessageBusCapstoneTestProvider }
  from '../../solidcash/test/journal-message-bus/e2e/message-bus-semantic-profile.js';
import type { TransactionBuilder } from '../../solidcash/src/TransactionBuilder.js';

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];
type SourceOutputs = NonNullable<VmProgram['sourceOutputs']>;

const P = 'pragma solidcash ^0.13.0;';
const BUS = { messageBus: true } as const;
const CATEGORY = Uint8Array.from({ length: 32 }, (_, i) => (0x29 + i * 17) & 0xff);
const FOREIGN = Uint8Array.from({ length: 32 }, (_, i) => (0x44 + i * 13) & 0xff);
const ZERO32 = new Uint8Array(32);
const EMPTY = new Uint8Array(0);
const VALUE = 20_000n;
const FUNDER_LOCK = Uint8Array.from([0x51]);
const vm = createVirtualMachineBch2026();

function distinct(length: number, seed: number): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => (seed + index * 37) & 0xff);
}

function p2sh32(redeem: Uint8Array): Uint8Array {
  return encodeLockingBytecodeP2sh32(hash256(redeem));
}

function tokenOf(capability: 'minting' | 'mutable' | 'none', commitment: Uint8Array, category = CATEGORY): VmOutput['token'] {
  return { category, amount: 0n, nft: { capability, commitment } };
}

function outpoint(index: number): Uint8Array {
  return distinct(32, 0x80 + index);
}

function input(index: number, unlockingBytecode: Uint8Array): VmTransaction['inputs'][number] {
  return {
    outpointIndex: 0, outpointTransactionHash: outpoint(index), sequenceNumber: 0xffffffff, unlockingBytecode,
  };
}

function pushesOf(values: readonly Uint8Array[]): Uint8Array {
  return new Uint8Array(values.flatMap((value) => [...encodeDataPush(value)]));
}

/** ABI order, reversed so the first parameter sits on top of the stack, then the redeem. */
function redeemUnlock(
  fn: AbiFunction, redeem: Uint8Array, values: Record<string, Uint8Array>, dispatch = false,
): Uint8Array {
  const args = fn.inputs.map((entry) => {
    const value = values[entry.name];
    if (value === undefined) {
      throw new Error(`no value for ${fn.name}.${entry.name}; inputs=${fn.inputs.map((item) => item.name).join(',')}`);
    }
    return value;
  }).reverse();
  // A message-bus build rolls the bottom item up and requires it to be the 4-byte selector.
  // With no other arguments the bottom and the top are the same item, which is why a parameterless
  // entry accepted the selector on top. A stateless body reads its arguments directly.
  if (dispatch && fn.selector) args.unshift(hexToBin(fn.selector));
  return new Uint8Array([...pushesOf(args), ...encodeDataPush(redeem)]);
}

function verdict(sourceOutputs: SourceOutputs, transaction: VmTransaction): true | string {
  return vm.verify({ sourceOutputs, transaction });
}

function bareLock(pushCount: number): Uint8Array {
  const ops: number[] = [];
  let left = pushCount;
  while (left >= 2) { ops.push(0x6d); left -= 2; }
  if (left === 1) ops.push(0x75);
  ops.push(0x51);
  return Uint8Array.from(ops);
}

function countPushes(unlocking: Uint8Array): number {
  let at = 0;
  let count = 0;
  while (at < unlocking.length) {
    const opcode = unlocking[at]!;
    if (opcode === 0x00 || opcode === 0x4f || (opcode >= 0x51 && opcode <= 0x60)) { at += 1; count += 1; continue; }
    if (opcode >= 0x01 && opcode <= 0x4b) { at += 1 + opcode; count += 1; continue; }
    if (opcode === 0x4c) { at += 2 + unlocking[at + 1]!; count += 1; continue; }
    if (opcode === 0x4d) { at += 3 + (unlocking[at + 1]! | (unlocking[at + 2]! << 8)); count += 1; continue; }
    throw new Error(`non-push opcode ${opcode} at ${at}`);
  }
  return count;
}

const num = (value: bigint): Uint8Array => encodeIntegerValue(value);

function compileBus(members: string, options: Record<string, unknown> = {}): Artifact {
  return compileString(`${P} contract C { ${members} }`, { ...BUS, ...options });
}

function fnOf(artifact: Artifact, name: string): AbiFunction {
  const fn = artifact.abi.find((entry) => entry.name === name);
  if (!fn) throw new Error(`no function ${name}; have ${artifact.abi.map((entry) => entry.name).join(',')}`);
  return fn;
}

function redeemOf(artifact: Artifact): Uint8Array {
  return scriptToBytecode(asmToScript(artifact.bytecode));
}

describe('October 2026 critical holes', () => {
  it('KB-2 a crafted lock does not compare equal to another address, and a real identity does', () => {
    const victim = Uint8Array.from({ length: 20 }, () => 0x11);
    const artifact = compileBus(
      `function f(address a) { require(a == address(hex"${Buffer.from(victim).toString('hex')}")); }`,
      { evmCompat: true },
    );
    const fn = fnOf(artifact, 'f');
    const redeem = redeemOf(artifact);
    const lock = p2sh32(redeem);
    const crafted = new Uint8Array(71);
    crafted[0] = 0x51;
    crafted[1] = 0x21;
    crafted[2] = 0x02;
    crafted.set(victim, 3);
    crafted[35] = 0x21;
    crafted[36] = 0x03;
    crafted[69] = 0x52;
    crafted[70] = 0xae;
    const unprefixed = new Uint8Array(32);
    unprefixed.fill(0xff, 0, 12);
    unprefixed.set(victim, 12);
    const prefixed = new Uint8Array(32);
    prefixed.set(victim, 12);
    const spend = (address: Uint8Array): true | string => {
      const transaction: VmTransaction = {
        version: 2, locktime: 0,
        inputs: [input(0, redeemUnlock(fn, redeem, { a: address }))],
        outputs: [{ lockingBytecode: FUNDER_LOCK, valueSatoshis: 1_000n }],
      };
      const sourceOutputs: SourceOutputs = [{ lockingBytecode: lock, valueSatoshis: 10_000n }];
      return verdict(sourceOutputs, transaction);
    };
    expect(spend(victim), 'KB-2 authorized 20-byte identity').toBe(true);
    expect(spend(prefixed), 'KB-2 authorized zero-prefixed word').toBe(true);
    expect(spend(crafted), 'KB-2 crafted 71-byte lock').not.toBe(true);
    expect(spend(unprefixed), 'KB-2 32-byte word without a zero prefix').not.toBe(true);
  });

  it('CRYPTO-1 a bare-lock keccak side-car cannot choose the digest, and the real side-car can', () => {
    const preimage = Uint8Array.from([1, 2, 3, 4]);
    const artifact = compileBus('function f(bytes a, bytes32 h) { require(keccak256(a) == h); }');
    const fn = fnOf(artifact, 'f');
    const redeem = redeemOf(artifact);
    const contractLock = p2sh32(redeem);
    const salt = new Uint8Array(32);
    const sidecarUtxo = {
      txid: '11'.repeat(32), vout: 0, satoshis: VALUE,
      token: { category: Buffer.from(FOREIGN).toString('hex'), amount: 0n, nft: { capability: 'mutable' as const, commitment: '00'.repeat(32) } },
    };
    const built = buildKeccakComputeSidecar(preimage, salt, sidecarUtxo as never, false);
    const realLock = built.unlocker.generateLockingBytecode();
    const unlocking = built.unlocker.generateUnlockingBytecode();
    const forged = new Uint8Array(32).fill(0x22);
    const spend = (sideLock: Uint8Array, digest: Uint8Array): true | string => {
      const sideToken = tokenOf('mutable', digest, FOREIGN);
      const transaction: VmTransaction = {
        version: 2, locktime: 0,
        inputs: [
          input(0, redeemUnlock(fn, redeem, { a: preimage, h: digest })),
          input(1, unlocking),
        ],
        outputs: [
          { lockingBytecode: contractLock, valueSatoshis: VALUE },
          { lockingBytecode: sideLock, valueSatoshis: VALUE, token: sideToken },
        ],
      };
      const sourceOutputs: SourceOutputs = [
        { lockingBytecode: contractLock, valueSatoshis: VALUE + 10_000n },
        { lockingBytecode: sideLock, valueSatoshis: VALUE, token: tokenOf('mutable', built.commitment, FOREIGN) },
      ];
      return verdict(sourceOutputs, transaction);
    };
    expect(spend(realLock, built.commitment), 'CRYPTO-1 authorized').toBe(true);
    expect(spend(bareLock(countPushes(unlocking)), forged), 'CRYPTO-1 bare-lock digest').not.toBe(true);
  });

  it('CRYPTO-1 a bare-lock keccak side-car in a loop cannot choose the digest, and the real lock can', () => {
    // The loop path byte-compared the covenant taken from the unlocking and never read the lock.
    // One iteration, so the single side-car sits at input 1 (block size 1, counter 0).
    const preimage = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
    const artifact = compileString(
      `${P} contract C { function f(bytes32 x, int n, bytes32 t) public pure { bytes32 h = x;`
      + ' for (int i = 0; i < n; i = i + 1) { h = keccak256(h); } require(h == t); } }',
    );
    const fn = fnOf(artifact, 'f');
    expect(fn.keccakLoopReads, 'loop reads a trailing side-car').toBe(true);
    const redeem = redeemOf(artifact);
    const contractLock = p2sh32(redeem);
    const salt = new Uint8Array(32);
    const sidecarUtxo = {
      txid: '11'.repeat(32), vout: 0, satoshis: VALUE,
      token: { category: Buffer.from(FOREIGN).toString('hex'), amount: 0n, nft: { capability: 'mutable' as const, commitment: '00'.repeat(32) } },
    };
    const built = buildKeccakComputeSidecar(preimage, salt, sidecarUtxo as never, true);
    const realLock = built.unlocker.generateLockingBytecode();
    const unlocking = built.unlocker.generateUnlockingBytecode();
    const forged = new Uint8Array(32).fill(0x44);
    const spend = (sideLock: Uint8Array, digest: Uint8Array): true | string => {
      const transaction: VmTransaction = {
        version: 2, locktime: 0,
        inputs: [
          input(0, redeemUnlock(fn, redeem, { x: preimage, n: num(1n), t: digest })),
          input(1, unlocking),
        ],
        outputs: [
          { lockingBytecode: contractLock, valueSatoshis: VALUE },
          { lockingBytecode: sideLock, valueSatoshis: VALUE, token: tokenOf('mutable', digest, FOREIGN) },
        ],
      };
      const sourceOutputs: SourceOutputs = [
        { lockingBytecode: contractLock, valueSatoshis: VALUE + 10_000n },
        { lockingBytecode: sideLock, valueSatoshis: VALUE, token: tokenOf('mutable', built.commitment, FOREIGN) },
      ];
      return verdict(sourceOutputs, transaction);
    };
    expect(spend(realLock, built.commitment), 'CRYPTO-1 loop authorized').toBe(true);
    expect(spend(bareLock(countPushes(unlocking)), forged), 'CRYPTO-1 loop bare-lock digest').not.toBe(true);
  });

  it('CRYPTO-2 a bare-lock ecrecover pair cannot choose the signer, and the real locks can', async () => {
    const wallet = new ethers.Wallet(ethers.sha256(ethers.toUtf8Bytes('framed ecrecover key 1')));
    const message = 'framed ecrecover 0';
    const signature = await wallet.signMessage(message);
    const digest = ethers.hashMessage(message);
    const parsed = ethers.Signature.from(signature);
    const leWord = (hex: string): Uint8Array => hexToBin(hex.replace(/^0x/, '')).slice().reverse();
    const h = leWord(digest);
    const r = leWord(parsed.r);
    const s = leWord(parsed.s);
    const v = num(BigInt(parsed.v));
    const witness = computeEcrecoverWitness(h, parsed.v, r, s);
    const sideUtxo = (odd: boolean): never => ({
      txid: (odd ? 'bb' : 'aa').repeat(32), vout: 0, satoshis: VALUE,
      token: { category: Buffer.from(FOREIGN).toString('hex'), amount: 0n, nft: { capability: 'mutable' as const, commitment: '' } },
    }) as never;
    const chunkA = probeEcrecoverSplit(witness, SHARED_LIBRARY_SALT, sideUtxo(false), sideUtxo(true));
    const built = buildEcrecoverComputeSidecars(
      witness, chunkA, SHARED_LIBRARY_SALT, sideUtxo(false), sideUtxo(true),
    );
    const pubkey = hexToBin(wallet.signingKey.compressedPublicKey.slice(2));
    const artifact = compileBus(
      'function f(bytes32 h, int v, bytes32 r, bytes32 s, pubkey expect) {'
      + ' require(ecrecoverPubKey(h, v, r, s) == expect); }',
    );
    const fn = fnOf(artifact, 'f');
    const redeem = redeemOf(artifact);
    const contractLock = p2sh32(redeem);
    const lockA = ecrecoverComputeLockingBytecode(SHARED_LIBRARY_SALT, 'A');
    const lockB = ecrecoverComputeLockingBytecode(SHARED_LIBRARY_SALT, 'B');
    const unlockA = built.unlockerA.generateUnlockingBytecode({} as never);
    const unlockB = built.unlockerB.generateUnlockingBytecode({} as never);
    const commitA = hexToBin(built.recreateA.token!.nft!.commitment);
    const commitB = hexToBin(built.recreateB.token!.nft!.commitment);
    const spend = (
      aLock: Uint8Array, bLock: Uint8Array, bCommit: Uint8Array, expectKey: Uint8Array,
    ): true | string => {
      const transaction: VmTransaction = {
        version: 2, locktime: 0,
        inputs: [
          input(0, redeemUnlock(fn, redeem, { h, v, r, s, expect: expectKey })),
          input(1, unlockA),
          input(2, unlockB),
        ],
        outputs: [
          { lockingBytecode: contractLock, valueSatoshis: VALUE },
          { lockingBytecode: aLock, valueSatoshis: VALUE, token: tokenOf('mutable', commitA, FOREIGN) },
          { lockingBytecode: bLock, valueSatoshis: VALUE, token: tokenOf('mutable', bCommit, FOREIGN) },
        ],
      };
      const sourceOutputs: SourceOutputs = [
        { lockingBytecode: contractLock, valueSatoshis: VALUE + 10_000n },
        { lockingBytecode: aLock, valueSatoshis: VALUE, token: tokenOf('mutable', new Uint8Array(32), FOREIGN) },
        { lockingBytecode: bLock, valueSatoshis: VALUE, token: tokenOf('mutable', new Uint8Array(32), FOREIGN) },
      ];
      return verdict(sourceOutputs, transaction);
    };
    expect(spend(lockA, lockB, commitB, pubkey), 'CRYPTO-2 authorized').toBe(true);
    // Commitment the contract reads as a pubkey: parity || 33-byte little-endian Qx. The first 32
    // of that Qx are reversed into the compressed key. The bare locks replay the real unlocking.
    const forged = new Uint8Array(34);
    forged[0] = 0x02;
    forged.fill(0x11, 1, 33);
    const chosen = new Uint8Array(33);
    chosen[0] = 0x02;
    chosen.fill(0x11, 1);
    expect(
      spend(bareLock(countPushes(unlockA)), bareLock(countPushes(unlockB)), forged, chosen),
      'CRYPTO-2 bare-lock signer',
    ).not.toBe(true);
  });

  it('DX-1 a public call cannot drain the satoshi container, and the same call without it succeeds', () => {
    const artifact = compileBus('int n; function touch() { this.n = this.n + 1; require(true); }');
    const honest = scalarSpend(artifact, 'touch', { n: 1n }, { n: 2n });
    expect(verdict(honest.sourceOutputs, honest.transaction), 'DX-1 authorized').toBe(true);
    const drained = withSatoshiDrain(artifact, honest);
    expect(verdict(drained.sourceOutputs, drained.transaction), 'DX-1 drained container').not.toBe(true);
  });

  it('DX-1 a transferring call cannot drain the satoshi container, and the transfer itself succeeds', () => {
    const artifact = compileBus(
      'int n; function pay(bytes to) { this.transfer(to, 1000); this.n = this.n + 1; require(true); }',
    );
    const recipient = Uint8Array.of(0x76, 0xa9, 0x14, 0x22, 0x88, 0xac);
    const honest = paySpend(artifact, recipient);
    const slots = (fnOf(artifact, 'pay').blockLayout?.slots ?? [])
      .map((slot) => `${slot.kind}@${slot.offset}`).join(',');
    expect(verdict(honest.sourceOutputs, honest.transaction), `DX-1 transfer authorized ${slots}`).toBe(true);
    const drained = withSatoshiDrain(artifact, honest);
    expect(verdict(drained.sourceOutputs, drained.transaction), 'DX-1 transfer drain').not.toBe(true);
  });

  it('DX-2 a public call cannot drain a token container, and the same call without it succeeds', () => {
    const artifact = compileBus('int n; function touch() { this.n = this.n + 1; require(true); }');
    const honest = scalarSpend(artifact, 'touch', { n: 1n }, { n: 2n });
    expect(verdict(honest.sourceOutputs, honest.transaction), 'DX-2 authorized').toBe(true);
    const drained = withTokenDrain(artifact, honest);
    expect(verdict(drained.sourceOutputs, drained.transaction), 'DX-2 drained container').not.toBe(true);
  });

  it('DX-2 a public call cannot drain an NFT token container, and keeping it succeeds', () => {
    const artifact = compileBus('int n; function touch() { this.n = this.n + 1; require(true); }');
    const honest = scalarSpend(artifact, 'touch', { n: 1n }, { n: 2n });
    const kept = withNftTokenDrain(artifact, honest, false);
    expect(verdict(kept.sourceOutputs, kept.transaction), 'DX-2 nft container kept').toBe(true);
    const nftDrained = withNftTokenDrain(artifact, honest, true);
    expect(verdict(nftDrained.sourceOutputs, nftDrained.transaction), 'DX-2 nft container drain').not.toBe(true);
  });

  it('DS-2 a forged data record at another lock is not the data record, and the real lock is', () => {
    const owner = distinct(20, 0x11);
    const artifact = compileBus(
      `bytes20 owner; function go() { require(this.owner == hex"${Buffer.from(owner).toString('hex')}"); require(true); }`,
    );
    const honest = scalarSpend(artifact, 'go', { owner }, { owner }, false);
    expect(verdict(honest.sourceOutputs, honest.transaction), 'DS-2 authorized').toBe(true);
    const forged = forgeDataLock(honest);
    expect(verdict(forged.sourceOutputs, forged.transaction), 'DS-2 forged data lock').not.toBe(true);
  });

  it('DS-1 predOut -2 cannot replace a mapping write, and a real update can', () => {
    // A parameter value stays on the stack when predOut=-2 skips the upsert, and the transition then
    // reads the wrong witness. A literal write leaves nothing behind, which is the approve shape.
    const artifact = compileBus(
      'mapping(uint => uint) m; function set(uint k) { this.m[k] = 1000; require(true); }',
    );
    const honest = mappingUpdate(artifact, -1n, num(1000n));
    expect(verdict(honest.sourceOutputs, honest.transaction), 'DS-1 authorized').toBe(true);
    const forged = skippedMappingWrite(artifact);
    expect(verdict(forged.sourceOutputs, forged.transaction), 'DS-1 predOut -2').not.toBe(true);
  });

  it('DS-4 a non-minimal integer key is rejected, and the minimal encoding of that key is accepted', () => {
    const artifact = compileBus(
      'mapping(uint => bool) claimed; function claim(uint k) { require(this.claimed[k] == false);'
      + ' this.claimed[k] = true; require(true); }',
    );
    const honest = mappingInsert(artifact, num(5n));
    expect(verdict(honest.sourceOutputs, honest.transaction), 'DS-4 authorized').toBe(true);
    const padded = mappingInsert(artifact, Uint8Array.from([0x05, 0x00]));
    expect(verdict(padded.sourceOutputs, padded.transaction), 'DS-4 padded key').not.toBe(true);
  });

  it('DX-6 and DS-3 a public call cannot rewrite an unaccessed data record or destroy an unaccessed chunk', () => {
    const artifact = compileBus(
      'int x; string name; mapping(int => int) m;'
      + ' function set(int k, int v) { this.m[k] = v; require(true); }',
    );
    const honest = mappingUpdate(artifact, -1n, num(2n), 'set');
    expect(verdict(honest.sourceOutputs, honest.transaction), 'DX-6 authorized').toBe(true);
    const rewritten = withForgedData(artifact, honest);
    expect(verdict(rewritten.sourceOutputs, rewritten.transaction), 'DX-6 forged data record').not.toBe(true);
    const destroyed = withDestroyedChunk(artifact, honest);
    expect(verdict(destroyed.sourceOutputs, destroyed.transaction), 'DS-3 destroyed name chunk').not.toBe(true);
  });

  it('DS-3 a rewritten unaccessed chunk is not that chunk, and the real update is', () => {
    const artifact = compileBus(
      'int x; string name; mapping(int => int) m;'
      + ' function set(int k, int v) { this.m[k] = v; require(true); }',
    );
    const honest = mappingUpdate(artifact, -1n, num(2n), 'set');
    expect(verdict(honest.sourceOutputs, honest.transaction), 'DS-3 rewrite authorized').toBe(true);
    const rewrittenChunk = withRewrittenChunk(artifact, honest);
    expect(verdict(rewrittenChunk.sourceOutputs, rewrittenChunk.transaction), 'DS-3 rewritten name chunk').not.toBe(true);
  });

  it('DS-3 a mutable output at a P2PKH is not a record, and the real update is', () => {
    const artifact = compileBus(
      'int x; string name; mapping(int => int) m;'
      + ' function set(int k, int v) { this.m[k] = v; require(true); }',
    );
    const honest = mappingUpdate(artifact, -1n, num(2n), 'set');
    expect(verdict(honest.sourceOutputs, honest.transaction), 'DS-3 p2pkh authorized').toBe(true);
    const minted = withForgedMutableOutput(honest);
    expect(verdict(minted.sourceOutputs, minted.transaction), 'DS-3 mutable output at a P2PKH').not.toBe(true);
  });

  it('DS-5 an unsorted array cannot be claimed twice by omitting its entry, and one real claim succeeds', () => {
    const artifact = compileBus(
      'int[4] claimed; function claim(int i) { require(this.claimed[i] == 0); this.claimed[i] = 1; require(true); }',
    );
    const honest = arrayClaim(artifact, false);
    expect(verdict(honest.sourceOutputs, honest.transaction), 'DS-5 authorized').toBe(true);
    const omitted = arrayClaim(artifact, true);
    expect(verdict(omitted.sourceOutputs, omitted.transaction), 'DS-5 omitted entry').not.toBe(true);
  });

  it('KB-1 an extra output with the verifier lock is not the route binding, and the honest route is', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const calleeArtifact = compileString(`contract Kb1Callee {
      function settle(int next) public pure returns (int) { return next + 1; }
    }`, { forceStateful: true, messageBus: true });
    const calleeBase = new Contract(calleeArtifact, [], { provider });
    const calleeSetup = await setupStatefulUtxos(
      provider, calleeBase, calleeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const calleeInner = calleeBase.withCategory(hexToBin(calleeSetup.categoryId));
    const callee = StatefulContract.withCategory(calleeInner, calleeSetup.categoryId);
    const callerArtifact = compileString(`
      interface IKb1Callee { function settle(int next) returns (int); }
      contract Kb1Caller(address callee) {
        function prepare(int next) public {
          int result = IKb1Callee(callee).settle(next);
          require(result >= 0);
        }
      }
    `, { forceStateful: true, messageBus: true });
    const callerBase = new Contract(callerArtifact, [calleeInner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = await messageBus.compose({
      calls: [caller.call.prepare(0x11223344n), callee.call.settle(0x11223344n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const evaluated = async (builder: TransactionBuilder): Promise<Array<true | string>> => {
      const transaction = builder.buildLibauthTransaction(true);
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      const machine = createVirtualMachineBch2026ForProvider(builder.provider);
      return transaction.inputs.map((_input, inputIndex) => {
        const result = machine.evaluate({ inputIndex, sourceOutputs, transaction });
        return result.error === undefined ? true : result.error;
      });
    };
    const honest = await composition.build();
    expect((await evaluated(honest)).every((result) => result === true), 'KB-1 authorized').toBe(true);

    const hostile = await composition.build();
    const verifierIndex = hostile.inputs.findIndex((input) =>
      input.token?.nft?.commitment.startsWith('4c335631'));
    expect(verifierIndex).toBeGreaterThanOrEqual(0);
    const verifierOutput = hostile.outputs[verifierIndex]!;
    const honestCommitment = verifierOutput.token!.nft!.commitment;
    // The envelope sits at inputs.length - 2, so the fee has to stay last. Insert a second spend of the
    // verifier covenant immediately after it, with the real binding on that new output, and a different
    // commitment at the verifier's own index. The unfixed scan keeps the later output.
    const verifierInput = hostile.inputs[verifierIndex]!;
    hostile.inputs.splice(verifierIndex + 1, 0, { ...verifierInput, txid: '44'.repeat(32), vout: 1 });
    hostile.outputs.splice(verifierIndex + 1, 0, {
      to: verifierOutput.to,
      amount: verifierOutput.amount,
      token: {
        amount: verifierOutput.token!.amount,
        category: verifierOutput.token!.category,
        nft: { capability: 'mutable', commitment: honestCommitment },
      },
    });
    hostile.outputs[verifierIndex] = {
      ...verifierOutput,
      token: {
        amount: verifierOutput.token!.amount,
        category: verifierOutput.token!.category,
        nft: { capability: 'mutable', commitment: '11'.repeat(19) },
      },
    };
    expect((await evaluated(hostile))[0] === true, 'KB-1 cloned verifier output').toBe(false);
  }, 120_000);
});

interface Spend {
  readonly sourceOutputs: SourceOutputs;
  readonly transaction: VmTransaction;
}

function dataRedeem(masterLock?: Uint8Array): Uint8Array {
  return scriptToBytecode(buildDataNftCovenantScript(CATEGORY, masterLock));
}

function commitment(artifact: Artifact, values: Record<string, Uint8Array | bigint>): Uint8Array {
  return hexToBin(buildPushdataCommitment(artifact.stateLayout!, values, 0));
}

/** Master at 0, its one data record at 1, a funder at 2. `writing` selects the data covenant's flag. */
function scalarSpend(
  artifact: Artifact, name: string, before: Record<string, Uint8Array | bigint>,
  after: Record<string, Uint8Array | bigint>, writing = true,
  overrides: Record<string, Uint8Array> = {},
): Spend {
  const fn = fnOf(artifact, name);
  const redeem = redeemOf(artifact);
  const lock = p2sh32(redeem);
  const recordRedeem = dataRedeem(lock);
  const recordLock = p2sh32(recordRedeem);
  const flag = writing ? num(1n) : num(0n);
  const beforeCommitment = commitment(artifact, before);
  const afterCommitment = commitment(artifact, after);
  const values: Record<string, Uint8Array> = { ...overrides };
  for (const entry of fn.inputs) {
    if (values[entry.name] === undefined) values[entry.name] = internalDefault(entry.name);
  }
  const transaction: VmTransaction = {
    version: 2, locktime: 0,
    inputs: [
      input(0, redeemUnlock(fn, redeem, values, true)),
      input(1, pushesOf([num(0n), flag, recordRedeem])),
      input(2, EMPTY),
    ],
    outputs: [
      { lockingBytecode: lock, valueSatoshis: VALUE, token: tokenOf('minting', EMPTY) },
      { lockingBytecode: recordLock, valueSatoshis: VALUE, token: tokenOf('mutable', afterCommitment) },
      { lockingBytecode: FUNDER_LOCK, valueSatoshis: 40_000n },
    ],
  };
  const sourceOutputs: SourceOutputs = [
    { lockingBytecode: lock, valueSatoshis: VALUE, token: tokenOf('minting', EMPTY) },
    { lockingBytecode: recordLock, valueSatoshis: VALUE, token: tokenOf('mutable', beforeCommitment) },
    { lockingBytecode: FUNDER_LOCK, valueSatoshis: 100_000n },
  ];
  return { sourceOutputs, transaction };
}

function internalDefault(name: string): Uint8Array {
  if (name.includes('vmapBatchSlot')) return ZERO32;
  if (name.includes('vmapBatchProof')) return num(1n);
  if (name.includes('vmapBatchNext')) return ZERO32;
  if (name.includes('vmapBatchPredOut')) return num(-1n);
  if (name.includes('TrailingCount')) return num(0n);
  if (name.startsWith('__internal__')) return EMPTY;
  throw new Error(`scalar witness has no value for ${name}`);
}

/**
 * Master, data record, satoshi container, funder. The container pays the one transfer output and keeps the rest.
 */
function paySpend(artifact: Artifact, recipient: Uint8Array): Spend {
  const base = scalarSpend(artifact, 'pay', { n: 1n }, { n: 2n }, true, { to: recipient });
  const containerRedeem = scriptToBytecode(buildSatoshiContainerCovenantScript(
    CATEGORY, p2sh32(redeemOf(artifact)),
  ));
  const containerLock = p2sh32(containerRedeem);
  const containerIn = 50_000n;
  const paid = 1_000n;
  const inputs = [
    base.transaction.inputs[0]!,
    base.transaction.inputs[1]!,
    input(3, pushesOf([num(0n), num(1n), containerRedeem])),
    { ...base.transaction.inputs[2]!, outpointTransactionHash: outpoint(4) },
  ];
  const outputs = [
    base.transaction.outputs[0]!,
    base.transaction.outputs[1]!,
    { lockingBytecode: containerLock, valueSatoshis: containerIn - paid },
    { lockingBytecode: recipient, valueSatoshis: paid },
    base.transaction.outputs[2]!,
  ];
  const sourceOutputs: SourceOutputs = [
    base.sourceOutputs[0]!,
    base.sourceOutputs[1]!,
    { lockingBytecode: containerLock, valueSatoshis: containerIn },
    base.sourceOutputs[2]!,
  ];
  return { sourceOutputs, transaction: { ...base.transaction, inputs, outputs } };
}

function withSatoshiDrain(artifact: Artifact, honest: Spend): Spend {
  const redeem = scriptToBytecode(buildSatoshiContainerCovenantScript(
    CATEGORY, p2sh32(redeemOf(artifact)),
  ));
  const lock = p2sh32(redeem);
  return appendInput(honest, {
    lockingBytecode: lock, valueSatoshis: 50_000n,
  }, pushesOf([num(0n), num(1n), redeem]), { lockingBytecode: FUNDER_LOCK, valueSatoshis: 50_000n });
}

function withTokenDrain(artifact: Artifact, honest: Spend): Spend {
  const redeem = scriptToBytecode(buildTokenContainerCovenantScript(
    CATEGORY, FOREIGN, p2sh32(redeemOf(artifact)),
  ));
  const lock = p2sh32(redeem);
  const held = { category: FOREIGN, amount: 1_000n };
  return appendInput(honest, {
    lockingBytecode: lock, valueSatoshis: VALUE, token: held,
  }, pushesOf([num(0n), num(1n), redeem]), {
    lockingBytecode: FUNDER_LOCK, valueSatoshis: VALUE, token: held,
  });
}

/** A 33-byte category: the same container plus an NFT capability and a fungible amount. */
function withNftTokenDrain(artifact: Artifact, honest: Spend, drain: boolean): Spend {
  const redeem = scriptToBytecode(buildTokenContainerCovenantScript(
    CATEGORY, FOREIGN, p2sh32(redeemOf(artifact)),
  ));
  const lock = p2sh32(redeem);
  const token = { ...tokenOf('mutable', Uint8Array.of(1, 2, 3), FOREIGN), amount: 7n };
  return appendInput(honest, {
    lockingBytecode: lock, valueSatoshis: VALUE, token,
  }, pushesOf([num(0n), num(1n), redeem]), {
    lockingBytecode: drain ? FUNDER_LOCK : lock, valueSatoshis: VALUE, token,
  });
}

function forgeDataLock(honest: Spend): Spend {
  const sourceOutputs = honest.sourceOutputs.map((output, index) => (
    index === 1 ? { ...output, lockingBytecode: FUNDER_LOCK } : output
  ));
  const outputs = honest.transaction.outputs.map((output, index) => (
    index === 1 ? { ...output, lockingBytecode: FUNDER_LOCK } : output
  ));
  const inputs = honest.transaction.inputs.map((entry, index) => (
    index === 1 ? { ...entry, unlockingBytecode: EMPTY } : entry
  ));
  return { sourceOutputs, transaction: { ...honest.transaction, inputs, outputs } };
}

function appendInput(
  honest: Spend, source: SourceOutputs[number], unlocking: Uint8Array, created: VmOutput,
): Spend {
  const at = honest.transaction.inputs.length;
  return {
    sourceOutputs: [...honest.sourceOutputs, source],
    transaction: {
      ...honest.transaction,
      inputs: [...honest.transaction.inputs, input(at, unlocking)],
      outputs: [...honest.transaction.outputs, created],
    },
  };
}

function mappingWitness(name: string, slot: Uint8Array, predOut: bigint, key: Uint8Array): Uint8Array | undefined {
  if (name === 'k') return key;
  if (name === 'v' || name === 'i') return num(name === 'i' ? 1n : 2n);
  if (/^__internal__vmapBatchSlot_\d+$/.test(name)) return slot;
  if (/^__internal__vmapBatchProof_\d+$/.test(name)) return num(1n);
  if (/^__internal__vmapBatchNext_\d+$/.test(name)) return ZERO32;
  if (/^__internal__vmapBatchPredOut_\d+$/.test(name)) return predOut === -2n ? Uint8Array.of(0x82) : num(predOut);
  if (name === '__internal__vmapBatchTrailingCount') return num(0n);
  if (name.startsWith('__internal__')) return EMPTY;
  return undefined;
}

/**
 * Approve with PredOut=-2 and Proof=0. The skipped transition does not pin the one collection output,
 * so the spender mints a node for a key the function did not write. No collection input is spent.
 */
function skippedMappingWrite(artifact: Artifact): Spend {
  const base = mappingUpdate(artifact, -2n, num(9n));
  const fn = fnOf(artifact, 'set');
  const collection = artifact.stateLayout!.collections!.find((entry) => entry.name === 'm')!;
  const entryRedeem = scriptToBytecode(buildEntryNftCovenantScript(CATEGORY, computeCollectionHash(collection.signature), p2sh32(redeemOf(artifact))));
  const entryLock = p2sh32(entryRedeem);
  const key = num(7n);
  const slot = keyToSlotMulti([key]);
  const values: Record<string, Uint8Array> = {};
  for (const entry of fn.inputs) {
    const value = mappingWitness(entry.name, slot, -2n, key);
    if (value === undefined) throw new Error(`no mapping witness for ${entry.name}`);
    values[entry.name] = entry.name.includes('vmapBatchProof') ? num(0n) : value;
  }
  const redeem = redeemOf(artifact);
  const forged = tokenOf('mutable', encodeEntryCommitment(keyToSlotMulti([num(99n)]), ZERO32, num(9n)));
  return {
    sourceOutputs: [
      base.sourceOutputs[0]!,
      { lockingBytecode: FUNDER_LOCK, valueSatoshis: VALUE },
      base.sourceOutputs[2]!,
    ],
    transaction: {
      ...base.transaction,
      inputs: [
        input(0, redeemUnlock(fn, redeem, values, artifact.messageBus?.routeInBytecode === true)),
        input(1, EMPTY),
        input(2, EMPTY),
      ],
      outputs: [
        base.transaction.outputs[0]!,
        { lockingBytecode: entryLock, valueSatoshis: VALUE, token: forged },
        base.transaction.outputs[2]!,
      ],
    },
  };
}

function mappingUpdate(artifact: Artifact, predOut: bigint, tail: Uint8Array, name = 'set'): Spend {
  const fn = fnOf(artifact, name);
  const redeem = redeemOf(artifact);
  const lock = p2sh32(redeem);
  const collection = artifact.stateLayout!.collections!.find((entry) => entry.name === 'm')!;
  const entryRedeem = scriptToBytecode(buildEntryNftCovenantScript(CATEGORY, computeCollectionHash(collection.signature), p2sh32(redeemOf(artifact))));
  const entryLock = p2sh32(entryRedeem);
  const key = num(7n);
  const slot = keyToSlotMulti([key]);
  const values: Record<string, Uint8Array> = {};
  for (const entry of fn.inputs) {
    const value = mappingWitness(entry.name, slot, predOut, key);
    if (value === undefined) throw new Error(`no mapping witness for ${entry.name}`);
    values[entry.name] = value;
  }
  const before = encodeEntryCommitment(slot, ZERO32, num(1n));
  const after = encodeEntryCommitment(slot, ZERO32, tail);
  const transaction: VmTransaction = {
    version: 2, locktime: 0,
    inputs: [
      input(0, redeemUnlock(fn, redeem, values, artifact.messageBus?.routeInBytecode === true)),
      input(1, pushesOf([num(0n), num(1n), entryRedeem])),
      input(2, EMPTY),
    ],
    outputs: [
      { lockingBytecode: lock, valueSatoshis: VALUE, token: tokenOf('minting', EMPTY) },
      { lockingBytecode: entryLock, valueSatoshis: VALUE, token: tokenOf('mutable', after) },
      { lockingBytecode: FUNDER_LOCK, valueSatoshis: 40_000n },
    ],
  };
  const sourceOutputs: SourceOutputs = [
    { lockingBytecode: lock, valueSatoshis: VALUE, token: tokenOf('minting', EMPTY) },
    { lockingBytecode: entryLock, valueSatoshis: VALUE, token: tokenOf('mutable', before) },
    { lockingBytecode: FUNDER_LOCK, valueSatoshis: 100_000n },
  ];
  return { sourceOutputs, transaction };
}

/** An insert of `key` after the empty list's head. `key` may be a non-minimal encoding of the same integer. */
function mappingInsert(artifact: Artifact, key: Uint8Array): Spend {
  const fn = fnOf(artifact, 'claim');
  const redeem = redeemOf(artifact);
  const lock = p2sh32(redeem);
  const collection = artifact.stateLayout!.collections!.find((entry) => entry.name === 'claimed')!;
  const entryRedeem = scriptToBytecode(buildEntryNftCovenantScript(CATEGORY, computeCollectionHash(collection.signature), p2sh32(redeemOf(artifact))));
  const entryLock = p2sh32(entryRedeem);
  const slot = keyToSlotMulti([key]);
  const values: Record<string, Uint8Array> = {};
  for (const entry of fn.inputs) {
    const value = entry.name === 'k' ? key : mappingWitness(entry.name, slot, 1n, key);
    if (value === undefined) throw new Error(`no insert witness for ${entry.name}`);
    if (entry.name.includes('vmapBatchPredOut')) values[entry.name] = num(2n);
    else if (entry.name.includes('TrailingCount')) values[entry.name] = num(1n);
    else values[entry.name] = value;
  }
  const head = encodeEntryCommitment(ZERO32, ZERO32, new Uint8Array(0));
  const created = encodeEntryCommitment(slot, ZERO32, num(1n));
  const rewritten = encodeEntryCommitment(ZERO32, slot, new Uint8Array(0));
  const dispatch = artifact.messageBus?.routeInBytecode === true;
  const transaction: VmTransaction = {
    version: 2, locktime: 0,
    inputs: [
      input(0, redeemUnlock(fn, redeem, values, dispatch)),
      input(1, pushesOf([num(0n), num(1n), entryRedeem])),
      input(2, EMPTY),
    ],
    outputs: [
      { lockingBytecode: lock, valueSatoshis: VALUE, token: tokenOf('minting', EMPTY) },
      { lockingBytecode: entryLock, valueSatoshis: VALUE, token: tokenOf('mutable', created) },
      { lockingBytecode: entryLock, valueSatoshis: VALUE, token: tokenOf('mutable', rewritten) },
      { lockingBytecode: FUNDER_LOCK, valueSatoshis: 40_000n },
    ],
  };
  const sourceOutputs: SourceOutputs = [
    { lockingBytecode: lock, valueSatoshis: VALUE, token: tokenOf('minting', EMPTY) },
    { lockingBytecode: entryLock, valueSatoshis: VALUE, token: tokenOf('mutable', head) },
    { lockingBytecode: FUNDER_LOCK, valueSatoshis: 100_000n },
  ];
  return { sourceOutputs, transaction };
}

function withForgedData(artifact: Artifact, honest: Spend): Spend {
  const recordRedeem = dataRedeem(p2sh32(redeemOf(artifact)));
  const recordLock = p2sh32(recordRedeem);
  const forged = commitment(artifact, { x: 9n, name$len: 0n });
  return appendInput(honest, {
    lockingBytecode: recordLock, valueSatoshis: VALUE, token: tokenOf('mutable', commitment(artifact, { x: 1n, name$len: 0n })),
  }, pushesOf([num(0n), num(1n), recordRedeem]), {
    lockingBytecode: recordLock, valueSatoshis: VALUE, token: tokenOf('mutable', forged),
  });
}

function chunkLock(artifact: Artifact): { lock: Uint8Array; redeem: Uint8Array } {
  const variable = artifact.stateLayout!.variables.find((entry) => entry.name === 'name');
  const signature = computeCollectionSignature(variable?.name ?? 'name', variable?.type ?? 'string');
  const redeem = scriptToBytecode(buildEntryNftCovenantScript(CATEGORY, computeCollectionHash(signature), p2sh32(redeemOf(artifact))));
  return { lock: p2sh32(redeem), redeem };
}

function withDestroyedChunk(artifact: Artifact, honest: Spend): Spend {
  const { lock, redeem } = chunkLock(artifact);
  const chunk = tokenOf('mutable', Uint8Array.from([0, 0, 0, 1, 0x61]));
  // Spent with the write flag and not recreated: its satoshis leave at the funder's lock.
  return appendInput(honest, {
    lockingBytecode: lock, valueSatoshis: VALUE, token: chunk,
  }, pushesOf([num(0n), num(1n), redeem]), { lockingBytecode: FUNDER_LOCK, valueSatoshis: VALUE });
}

/** Same lock and count, different commitment. flag=1 accepts it; a later read would too. */
function withRewrittenChunk(artifact: Artifact, honest: Spend): Spend {
  const { lock, redeem } = chunkLock(artifact);
  const before = tokenOf('mutable', Uint8Array.from([0, 0, 0, 1, 0x61]));
  const after = tokenOf('mutable', Uint8Array.from([0, 0, 0, 1, 0x62]));
  return appendInput(honest, {
    lockingBytecode: lock, valueSatoshis: VALUE, token: before,
  }, pushesOf([num(0n), num(1n), redeem]), {
    lockingBytecode: lock, valueSatoshis: VALUE, token: after,
  });
}

/** A contract-category mutable NFT minted to a P2PKH no input holds. */
function withForgedMutableOutput(honest: Spend): Spend {
  const p2pkh = Uint8Array.of(
    0x76, 0xa9, 0x14,
    ...distinct(20, 0x44),
    0x88, 0xac,
  );
  return {
    sourceOutputs: honest.sourceOutputs,
    transaction: {
      ...honest.transaction,
      outputs: [...honest.transaction.outputs, {
        lockingBytecode: p2pkh,
        valueSatoshis: 1_000n,
        token: tokenOf('mutable', Uint8Array.of(9)),
      }],
    },
  };
}

/**
 * A claim of index 1. The omission puts a tokenless coin at the entry slot so the legacy read sees the default
 * and the write mints a second entry. Once the array uses the sorted backend, that coin is not a proof.
 */
function arrayClaim(artifact: Artifact, omit: boolean): Spend {
  const fn = fnOf(artifact, 'claim');
  const sorted = fn.inputs.some((entry) => entry.name.includes('vmapBatch'));
  if (sorted) {
    const spend = mappingInsert(artifact, num(1n));
    if (!omit) return spend;
    // A tokenless coin where the proof node must be. The sorted backend has to refuse it.
    const sourceOutputs = spend.sourceOutputs.map((output, index) => (
      index === 1 ? { lockingBytecode: FUNDER_LOCK, valueSatoshis: VALUE } : output
    ));
    const inputs = spend.transaction.inputs.map((entry, index) => (
      index === 1 ? { ...entry, unlockingBytecode: EMPTY } : entry
    ));
    return { sourceOutputs, transaction: { ...spend.transaction, inputs } };
  }
  const redeem = redeemOf(artifact);
  const lock = p2sh32(redeem);
  const collection = artifact.stateLayout!.collections!.find((entry) => entry.name === 'claimed')!;
  const entryRedeem = scriptToBytecode(buildEntryNftCovenantScript(CATEGORY, computeCollectionHash(collection.signature), p2sh32(redeemOf(artifact))));
  const entryLock = p2sh32(entryRedeem);
  const values: Record<string, Uint8Array> = {};
  for (const entry of fn.inputs) values[entry.name] = entry.name === 'i' ? num(1n) : internalDefault(entry.name);
  // Legacy entry wire: pushdata(key) || pushdata(value). 1 is the byte 0x51 and 0 is the byte 0x00.
  const legacy = (value: number): Uint8Array => Uint8Array.of(0x51, value === 0 ? 0x00 : 0x51);
  const minted = legacy(1);
  const transaction: VmTransaction = {
    version: 2, locktime: 0,
    inputs: [
      input(0, redeemUnlock(fn, redeem, values, true)),
      input(1, omit ? EMPTY : pushesOf([num(0n), num(1n), entryRedeem])),
      input(2, EMPTY),
    ],
    outputs: [
      { lockingBytecode: lock, valueSatoshis: VALUE, token: tokenOf('minting', EMPTY) },
      { lockingBytecode: entryLock, valueSatoshis: VALUE, token: tokenOf('mutable', minted) },
      { lockingBytecode: FUNDER_LOCK, valueSatoshis: 40_000n },
    ],
  };
  const sourceOutputs: SourceOutputs = [
    { lockingBytecode: lock, valueSatoshis: VALUE, token: tokenOf('minting', EMPTY) },
    omit
      ? { lockingBytecode: FUNDER_LOCK, valueSatoshis: VALUE }
      : { lockingBytecode: entryLock, valueSatoshis: VALUE, token: tokenOf('mutable', legacy(0)) },
    { lockingBytecode: FUNDER_LOCK, valueSatoshis: 100_000n },
  ];
  return { sourceOutputs, transaction };
}


