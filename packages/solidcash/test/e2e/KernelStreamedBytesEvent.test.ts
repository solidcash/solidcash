import { binToHex, hexToBin } from '@bitauth/libauth';
import { encodeEventCommitment } from '@solidcash/utils';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, type TransactionBuilder } from '../../src/index.js';
import {
  StatefulContract, getEventNftAddress, getEventNftContinuationAddress,
} from '../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * A kernel handler whose emit has an UNBOUNDED `bytes` parameter now streams chunked (before this fix the compiler
 * counted an unbounded bytes/string parameter as 9 B and left the handler on a compact one-commitment record, so a
 * payload wider than 128 bytes failed). The runtime record stream splits the encoded payload over the head event
 * covenant and its continuation covenant, exactly like the dynamic-array case.
 */
const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;
const SOURCE = `pragma solidcash ^0.14.0;
contract StreamedBytesEvents() {
  int count;
  event Blob(bytes data);
  function blob(bytes data) public {
    this.count = this.count + 1;
    emit Blob(data);
    require(true);
  }
}`;

type LibauthTransaction = ReturnType<TransactionBuilder['buildLibauthTransaction']>;

describe('kernel route unbounded bytes event on the runtime effect stream', () => {
  const artifact = compileString(SOURCE, KERNEL);

  const deploy = async (): Promise<{
    provider: ReturnType<typeof createTestProvider>; contract: StatefulContract; salted: Contract;
    categoryId: string;
  }> => {
    const provider = createTestProvider();
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { count: 0n }, { saltContract: true },
    );
    return {
      provider, contract: StatefulContract.withCategory(inner, categoryId),
      salted: inner.withCategory(hexToBin(categoryId)), categoryId,
    };
  };
  const lockOf = (address: string): string => binToHex(addressToLockScript(address));
  const eventOutputs = (transaction: LibauthTransaction): Array<{
    index: number; lock: string; commitment: string;
  }> => transaction.outputs.flatMap((output, index) => (output.token?.nft?.capability === 'none'
    ? [{ index, lock: binToHex(output.lockingBytecode), commitment: binToHex(output.token.nft.commitment) }] : []));
  const evaluates = (
    provider: ReturnType<typeof createTestProvider>, transaction: LibauthTransaction,
    sourceOutputs: ReturnType<typeof generateLibauthSourceOutputs>, inputIndex: number,
  ): boolean => {
    const vm = createVirtualMachineBch2026ForProvider(provider);
    return vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })) === true;
  };

  it('admits the unbounded bytes emit on a chunked stream', () => {
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'blob');
    const signature = artifact.events!.find((event) => event.name === 'Blob')!.signature;
    expect(handler).toMatchObject({
      eligible: true, runtimeLoopEvents: [{ repeatCount: 1, eventSignatures: [signature], chunked: true }],
    });
    expect(handler?.emits).toBeUndefined();
  });

  it('settles a >128-byte bytes payload as head plus continuation records in order', async () => {
    const { provider, contract, salted, categoryId } = await deploy();
    const data = new Uint8Array(200).fill(0x5a);
    const builder = await contract.batch([{ function: 'blob', args: [data] }]).build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(evaluates(provider, transaction, sourceOutputs, inputIndex), `input ${inputIndex}`).toBe(true);
    }

    const blob = artifact.events!.find((event) => event.name === 'Blob')!;
    const payload = binToHex(encodeEventCommitment(blob.parameters, [data]));
    const events = eventOutputs(transaction);
    expect(events.length).toBeGreaterThan(1);
    expect(events[0].lock).toBe(lockOf(getEventNftAddress(salted, categoryId, blob.signature)));
    expect(events.slice(1).every((event) => event.lock
      === lockOf(getEventNftContinuationAddress(salted, categoryId, blob.signature)))).toBe(true);
    expect(events.map((event) => event.index - events[0].index)).toEqual(events.map((_event, index) => index));
    expect(events.slice(0, -1).every((event) => event.commitment.length / 2 === 128)).toBe(true);
    expect(events.map((event) => event.commitment).join('')).toBe(payload);
  }, 300_000);
});
