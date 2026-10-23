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
 * A kernel handler whose wide emit sits in a PRIVATE helper it calls at its top level. The helper is inlined before
 * admission, so the emit streams chunked exactly like an own top-level emit: the head sits at the event covenant and
 * the rest at its continuation covenant.
 */
const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;
const SOURCE = `pragma solidcash ^0.14.0;
contract StreamedHelperEvents() {
  int count;
  event Wide(bytes32 a, bytes32 b, bytes32 c, bytes32 d, bytes32 e);
  function doEmit(bytes32 a, bytes32 b) private {
    this.count = this.count + 1;
    emit Wide(a, b, a, b, a);
  }
  function fire(bytes32 a, bytes32 b) public {
    doEmit(a, b);
    require(true);
  }
}`;

type LibauthTransaction = ReturnType<TransactionBuilder['buildLibauthTransaction']>;

describe('kernel route wide event in a top-level-called helper on the runtime effect stream', () => {
  const artifact = compileString(SOURCE, KERNEL);
  const words = [new Uint8Array(32).fill(0x11), new Uint8Array(32).fill(0x22)];

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

  it('settles the helper emit as head and continuation records in order', async () => {
    const { provider, contract, salted, categoryId } = await deploy();
    const builder = await contract.batch([{ function: 'fire', args: words }]).build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(evaluates(provider, transaction, sourceOutputs, inputIndex), `input ${inputIndex}`).toBe(true);
    }

    const wide = artifact.events!.find((event) => event.name === 'Wide')!;
    const payload = binToHex(encodeEventCommitment(wide.parameters, [...words, words[0], words[1], words[0]]));
    const events = eventOutputs(transaction);
    expect(events.map((event) => event.lock)).toEqual([
      lockOf(getEventNftAddress(salted, categoryId, wide.signature)),
      lockOf(getEventNftContinuationAddress(salted, categoryId, wide.signature)),
    ]);
    expect(events.map((event) => event.index - events[0].index)).toEqual([0, 1]);
    expect(events[0].commitment.length / 2).toBe(128);
    expect(events.map((event) => event.commitment).join('')).toBe(payload);
    await expect(contract.batch([{ function: 'fire', args: words }]).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  }, 300_000);
});
