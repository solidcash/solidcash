import { binToHex } from '@bitauth/libauth';
import type { AbiFunction, Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import {
  pushCreateBuilderDirectExternalCallGroup,
  type PushCreateBuilderDirectExternalCallGroupHost,
  type PushCreateBuilderDirectExternalCallGroupInput,
} from '../../src/stateful/sc-push-create-builder-direct-external-call-group.js';

describe('direct external bool return probe', () => {
  const probe = async (deriveReturnValue: () => Promise<unknown>): Promise<Uint8Array | undefined> => {
    const calleeAbi: AbiFunction = {
      name: 'read',
      inputs: [],
      outputs: [{ name: '', type: 'bool' }],
      resultEncoding: 'evm-abi-v1',
      writesState: false,
    };
    const artifact = {
      contractName: 'BoolCallee',
      abi: [calleeAbi],
      compiler: { options: { solidityImportCompat: true } },
    } as unknown as Artifact;
    const groups: PushCreateBuilderDirectExternalCallGroupInput['externalCallUtxoGroups'] = [];
    const host = {
      deriveReturnValue,
      resolveLoopArgs: () => undefined,
      callerCategoryId: 'caller',
      callerContract: {},
      valueChunkWriteStagingSession: {},
    } as unknown as PushCreateBuilderDirectExternalCallGroupHost;
    const input = {
      externalCallUtxoGroups: groups,
      bCompilerInternalArgs: {},
      bPlannedEntryInserts: [],
      bRelativeOutputInternalArgs: new Set(),
      bState: { masterUtxo: { txid: '00'.repeat(32), vout: 0 } },
      bStatelayout: { variables: [] },
      bDataNfts: [],
      bRequiredNftIndices: [],
      bReturnEventInBlock: true,
      bGraphBlockhashSelections: [],
      bKeccak: { recreates: [] },
      bDynamicChunkInputs: [],
      bDynamicChunkResources: [],
      bValueChunkOutputCount: 0,
      callInfo: {
        functionName: 'read',
        args: [],
        externalContract: { inner: { artifact } },
      },
      ec: { interfaceName: 'IBoolCallee', functionName: 'read', hasReturnValues: true },
      externalCategoryId: 'callee',
      publicSelfIdentity: { categoryId: 'caller', lockingBytecode: '51' },
      returnProbeOnly: true,
    } as unknown as PushCreateBuilderDirectExternalCallGroupInput;
    await pushCreateBuilderDirectExternalCallGroup(host, input);
    return groups[0].precomputedReturnCommitment;
  };

  it('retains a derived false result for a read-only callee', async () => {
    const commitment = await probe(async () => false);
    expect(binToHex(commitment!)).toBe(`${'00'.repeat(32)}`);
  });

  it('does not invent true when a read-only callee result is unresolved', async () => {
    const commitment = await probe(async () => undefined);
    expect(commitment).toBeUndefined();
  });
});
