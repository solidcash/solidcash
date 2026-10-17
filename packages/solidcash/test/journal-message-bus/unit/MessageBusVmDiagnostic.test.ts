/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, expect, it } from 'vitest';
import { binToHex, decodeAuthenticationInstructions, hexToBin } from '@bitauth/libauth';
import { BLOCK_ORACLE_LOCK_SENTINEL, applyBlockOracleLock, findBlockOracleLockSlots, type Artifact } from '@solidcash/utils';
import { bindBlockOracleLock } from '../../../src/oracle/block-oracle-lock.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { artifactTestRequires } from '../../fixture/debugging/debugging_contracts.js';

const push = (payload: number[]): number[] => [payload.length, ...payload];
const routeUnlock = (payload: number[]): Uint8Array => Uint8Array.from([
  ...push([0x53, 0x43, 0x42, 0x31]),
  ...push(payload),
]);
const routeBuilder = {
  inputs: [{ unlocker: { abiFunction: { selector: '53434231' } } }],
} as never;
const transaction = (payload: number[]) => ({
  inputs: [{ unlockingBytecode: routeUnlock(payload) }],
}) as never;
const raw = 'Program failed an OP_VERIFY operation.';

describe('message-bus batch VM refusal attribution', () => {
  it('maps the real preflight VM refusal at the failing route input', () => {
    const envelope = [0x53, 0x43, 0x42, 0x31, 3, 0, 1, ...Array(12).fill(0)];
    const builder = {
      inputs: [{
        txid: '00'.repeat(32), vout: 0, satoshis: 1000n,
        unlocker: {
          abiFunction: { selector: '53434231' },
          generateLockingBytecode: () => Uint8Array.of(0x00),
        },
      }],
    } as never;
    const tx = {
      version: 2,
      locktime: 0,
      inputs: [{
        outpointTransactionHash: new Uint8Array(32),
        outpointIndex: 0,
        sequenceNumber: 0xffff_ffff,
        unlockingBytecode: routeUnlock(envelope),
      }],
      outputs: [{ valueSatoshis: 900n, lockingBytecode: Uint8Array.of(0x51) }],
    } as never;
    expect(() => messageBus.assertFinalizedTransactionCovenants(builder, tx)).toThrow(
      expect.objectContaining({
        code: 'L3_MESSAGE_BUS_VERSION_UNSUPPORTED',
        context: expect.objectContaining({ inputIndex: 0, actual: 3, expected: [1, 2] }),
      }),
    );
  });

  it('maps an unknown envelope version to its exact input while preserving the VM reason', () => {
    const error = messageBus.mapMessageBusVmFailure(
      routeBuilder, transaction([0x53, 0x43, 0x42, 0x31, 3, 0, 1, ...Array(12).fill(0)]), 0, raw,
    );
    expect(error).toMatchObject({
      code: 'L3_MESSAGE_BUS_VERSION_UNSUPPORTED',
      context: {
        inputIndex: 0,
        rawVmReason: raw,
        metadataField: 'message-bus batch.version',
        actual: 3,
        expected: [1, 2],
      },
    });
    expect(error.message).toContain(raw);
  });

  it.each([
    ['bad magic', [0, 0, 0, 0, 1, 0, 1, ...Array(12).fill(0)]],
    ['truncated row', [0x53, 0x43, 0x42, 0x31, 1, 0, 1]],
    ['invalid flags', [0x53, 0x43, 0x42, 0x31, 1, 2, 1, ...Array(12).fill(0)]],
  ])('maps %s to a malformed-envelope refusal', (_label, payload) => {
    const error = messageBus.mapMessageBusVmFailure(routeBuilder, transaction(payload), 0, raw);
    expect(error).toMatchObject({
      code: 'L3_MESSAGE_BUS_ENVELOPE_MALFORMED',
      context: {
        inputIndex: 0,
        rawVmReason: raw,
        metadataField: 'message-bus batch.envelope',
      },
    });
    expect(error.message).toContain(raw);
  });

  it('leaves valid message-bus batch and non-route covenant objections byte-compatible', () => {
    const validEnvelopes = [
      [0x53, 0x43, 0x42, 0x31, 1, 0, 1, ...Array(12).fill(0)],
      [0x53, 0x43, 0x42, 0x31, 2, 0, 1, ...Array(13).fill(0)],
      [0x53, 0x43, 0x42, 0x31, 1, 1, 1, ...Array(21).fill(0)],
    ];
    for (const envelope of validEnvelopes) {
      const valid = transaction(envelope);
      expect(messageBus.mapMessageBusVmFailure(routeBuilder, valid, 0, raw).message)
        .toBe(`messageBus: BCH-2026 preflight failed at input 0: ${raw}`);
      expect(messageBus.mapMessageBusVmFailure({ inputs: [{}] } as never, valid, 0, raw).message)
        .toBe(`messageBus: BCH-2026 preflight failed at input 0: ${raw}`);
    }
  });

  it('recovers an exact compiler require reason from the active preflight body', () => {
    const selected = Object.entries(artifactTestRequires.debug!.functionDebug!)
      .find(([, debug]) => debug.requires.some((entry) => entry.message === '1 should equal 2'));
    expect(selected).toBeDefined();
    const [selector, debug] = selected!;
    const requireStatement = debug.requires.find((entry) => entry.message === '1 should equal 2')!;
    const instructions = decodeAuthenticationInstructions(hexToBin(artifactTestRequires.functionBodies![selector]));
    const builder = {
      inputs: [{
        unlocker: {
          contract: { artifact: artifactTestRequires },
          abiFunction: { selector },
        },
      }],
    } as never;

    const error = messageBus.mapMessageBusVmFailure(
      builder,
      transaction([0]),
      0,
      raw,
      { instructions, ip: requireStatement.ip + 1 } as never,
    );
    expect(error.message).toContain('1 should equal 2');
    expect(error).toMatchObject({ requireStatement, inputIndex: 0 });
  });

  it('resolves an exact active body owned by another transaction participant', () => {
    const selected = Object.entries(artifactTestRequires.debug!.functionDebug!)
      .find(([, debug]) => debug.requires.some((entry) => entry.message === '1 should equal 2'))!;
    const [selector, debug] = selected;
    const requireStatement = debug.requires.find((entry) => entry.message === '1 should equal 2')!;
    const instructions = decodeAuthenticationInstructions(hexToBin(artifactTestRequires.functionBodies![selector]));
    const builder = {
      inputs: [
        { unlocker: { abiFunction: { selector: 'ffffffff' } } },
        { unlocker: { contract: { artifact: artifactTestRequires } } },
      ],
    } as never;

    const error = messageBus.mapMessageBusVmFailure(
      builder,
      transaction([0]),
      0,
      raw,
      { instructions, ip: requireStatement.ip + 1 } as never,
    );
    expect(error.message).toContain('1 should equal 2');
  });

  it('attributes a source require inside an active OP_INVOKE body', () => {
    const body = '0069'; // OP_0 OP_VERIFY
    const requireStatement = { ip: 1, line: 7, message: 'invoked guard failed' };
    const artifact = {
      contractName: 'Invoked',
      functionBodies: {},
      debug: { invokeDebug: { 7: { bytecode: body, requires: [requireStatement] } } },
    };
    const builder = {
      inputs: [{ unlocker: { contract: { artifact }, abiFunction: { selector: '53434231' } } }],
    } as never;
    const valid = transaction([0x53, 0x43, 0x42, 0x31, 1, 0, 1, ...Array(12).fill(0)]);
    const instructions = decodeAuthenticationInstructions(hexToBin(body));
    const error = messageBus.mapMessageBusVmFailure(
      builder, valid, 0, raw, { instructions, ip: 2 } as never,
    );
    expect(error.message).toContain('invoked guard failed');
    expect(error).toMatchObject({ requireStatement, inputIndex: 0 });
  });

  it('attributes a require using the exact body with its bound oracle lock', () => {
    const published = Uint8Array.from([0x00, 0x69, BLOCK_ORACLE_LOCK_SENTINEL.length,
      ...BLOCK_ORACLE_LOCK_SENTINEL, 0x75]);
    const lock = new Uint8Array(BLOCK_ORACLE_LOCK_SENTINEL.length).fill(0x42);
    const statement = { ip: 1, line: 12, message: 'amount must be positive' };
    const artifact = {
      contractName: 'OracleGuard', functionBodies: {},
      debug: { invokeDebug: { 3: { bytecode: binToHex(published), requires: [statement] } } },
    } as unknown as Artifact;
    bindBlockOracleLock(artifact, lock);
    const builder = { inputs: [{ unlocker: { contract: { artifact }, abiFunction: { selector: '53434231' } } }] } as never;
    const valid = transaction([0x53, 0x43, 0x42, 0x31, 1, 0, 1, ...Array(12).fill(0)]);
    const bound = applyBlockOracleLock(published, lock, findBlockOracleLockSlots(published));
    const failure = (body: Uint8Array) => ({ instructions: decodeAuthenticationInstructions(body), ip: 2 }) as never;
    const attributed = messageBus.mapMessageBusVmFailure(builder, valid, 0, raw, failure(bound));
    expect(attributed).toMatchObject({ requireStatement: statement, inputIndex: 0 });
    expect(attributed.message).toContain(statement.message);
    const wrongLock = applyBlockOracleLock(published, lock.map(() => 0x43), findBlockOracleLockSlots(published));
    for (const changed of [published, wrongLock, Uint8Array.from([0x51, ...bound.slice(1)])]) {
      expect(messageBus.mapMessageBusVmFailure(builder, valid, 0, raw, failure(changed)))
        .not.toHaveProperty('requireStatement');
    }
  });

  it('maps a VM-priced resource refusal without discarding its raw reason', () => {
    const reason = 'Operation cost limit exceeded: 12000 exceeds maximum 10000.';
    const valid = transaction([0x53, 0x43, 0x42, 0x31, 1, 0, 1, ...Array(12).fill(0)]);
    expect(messageBus.mapMessageBusVmFailure(routeBuilder, valid, 0, reason)).toMatchObject({
      code: 'L3_VM_RESOURCE_LIMIT',
      context: expect.objectContaining({
        inputIndex: 0, resourceIdentity: 'input:0', measured: 12000, limit: 10000, rawVmReason: reason,
      }),
    });
  });
});
