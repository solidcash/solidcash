import { describe, expect, it } from 'vitest';
import { secp256k1 } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
import { createVirtualMachineBch2026 } from '@bitauth/libauth';
import {
  applyBlockOracleLock, asmToScript, blockOracleFieldBytes, blockOracleLockingBytecode,
  blockOracleReadUnlocking, blockOracleUpdateUnlocking,
  encodeBlockOracleCommitment, hash160, scriptToBytecode,
} from '@solidcash/utils';
import { compileString } from '../src/index.js';

const category = Uint8Array.from({ length: 32 }, (_v, i) => (i === 31 ? 0x8e : 0x71));
const ownerKey = Uint8Array.from({ length: 32 }, (_byte, index) => (index === 0 ? 0x02 : 0x11));
const ownerPub = secp256k1.derivePublicKeyCompressed(ownerKey) as Uint8Array;
const ownerPkh = hash160(ownerPub);
const coinbase = Uint8Array.from([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x22), 0x88, 0xac]);

const fields = {
  number: 1000n,
  timestamp: 1_700_000_000n,
  difficulty: 0x18026c88n,
  size: 9075n,
  totalFees: 31792n,
  coinbase,
};

describe('block oracle commitment', () => {
  it('keeps the owner hash and the block fields in one commitment', () => {
    const commitment = encodeBlockOracleCommitment(ownerPkh, fields);
    expect(commitment.slice(0, 20)).toEqual(ownerPkh);
    expect(blockOracleFieldBytes(commitment, 'timestamp')[4]).toBe(0);
    let timestamp = 0n;
    const raw = blockOracleFieldBytes(commitment, 'timestamp');
    for (let index = 0; index < 4; index += 1) timestamp |= BigInt(raw[index]!) << BigInt(8 * index);
    expect(timestamp).toBe(fields.timestamp);
  });

  it('accepts a read that recreates the commitment and rejects an owner change', () => {
    const lock = blockOracleLockingBytecode(category);
    const commitment = encodeBlockOracleCommitment(ownerPkh, fields);
    const source = {
      lockingBytecode: lock,
      valueSatoshis: 10_000n,
      token: {
        category,
        amount: 0n,
        nft: { capability: 'mutable' as const, commitment },
      },
    };
    const vm = createVirtualMachineBch2026();
    const read = vm.verify({
      sourceOutputs: [source],
      transaction: {
        version: 2,
        locktime: 1000,
        inputs: [{
          outpointIndex: 0,
          outpointTransactionHash: new Uint8Array(32).fill(0x61),
          sequenceNumber: 0xffffffff,
          unlockingBytecode: blockOracleReadUnlocking(category),
        }],
        outputs: [{
          lockingBytecode: lock,
          valueSatoshis: 10_000n,
          token: source.token,
        }],
      },
    });
    expect(read).toBe(true);
    const changedOwner = encodeBlockOracleCommitment(new Uint8Array(20).fill(0x03), fields);
    const rejected = vm.verify({
      sourceOutputs: [source],
      transaction: {
        version: 2,
        locktime: 1000,
        inputs: [{
          outpointIndex: 0,
          outpointTransactionHash: new Uint8Array(32).fill(0x61),
          sequenceNumber: 0xffffffff,
          unlockingBytecode: blockOracleUpdateUnlocking(
            category, ownerPub, new Uint8Array(65).fill(0x31), changedOwner,
          ),
        }],
        outputs: [{
          lockingBytecode: lock,
          valueSatoshis: 10_000n,
          token: { ...source.token, nft: { capability: 'mutable' as const, commitment: changedOwner } },
        }],
      },
    });
    // A failed script returns an error string, not false.
    expect(rejected).not.toBe(true);
  });

  it('does not put an update entry or block registers on a reader', () => {
    const artifact = compileString(
      'contract Reader() { function f(int expect) { require(block.timestamp == expect); } }',
      { messageBus: false },
    );
    expect(artifact.usesBlockOracle).toBe(true);
    expect(artifact.abi.map((fn) => fn.name)).not.toContain('__updateBlockOracle');
    expect(artifact.stateLayout?.variables.map((variable) => variable.name) ?? []).not.toContain('__block_timestamp');
    expect(artifact.blockOracleLockSlots?.length).toBeGreaterThan(0);
    const program = scriptToBytecode(asmToScript(artifact.bytecode));
    const patched = applyBlockOracleLock(program, blockOracleLockingBytecode(category), artifact.blockOracleLockSlots!);
    expect(patched).not.toEqual(program);
  });
});
