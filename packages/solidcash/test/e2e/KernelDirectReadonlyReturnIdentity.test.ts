import { binToHex } from '@bitauth/libauth';
import { DYNAMIC_CHUNK_SIZE } from '@solidcash/utils';
import { compileStringMulti } from 'solidc';
import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { Signer } from '../../src/index.js';
import { getContractFactory } from '../../src/stateful/index.js';
import { getDynamicChunkAddress } from '../../src/stateful/covenant-helpers.js';
import { encodeExternalReturnValues } from '../../src/stateful/external-return-encoding.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../src/utils.js';
import { createMessageBusSemanticTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { messageBusVmAccepts } from '../journal-message-bus/e2e/vm-accepts.js';

const OPTIONS = {
  forceStateful: true, evmCompat: true, messageBus: true, messageBusKernel: true,
  messageBusGraphContext: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;

describe('ordinary readonly return aliases beside logical identities', () => {
  it('keeps both getter results and the executing identity after a complete read-chunk band', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface ISource { function size() external view returns (uint256); }
      contract Source {
        bytes public records;
        constructor(bytes memory initial) { records = initial; }
        function size() public view returns (uint256) { return records.length; }
      }
      contract Reader {
        address source;
        constructor(address target) { source = target; }
        function measure() public view returns (uint256, uint256) {
          uint256 first = ISource(source).size();
          uint256 second = ISource(source).size();
          return (first, second);
        }
      }`, OPTIONS);
    const binding = { version: 1, selector: artifacts.Source.abi.find((entry) => entry.name === 'size')!.selector };
    expect(artifacts.Reader.abi.find((entry) => entry.name === 'measure')!.externalCalls
      ?.map((call) => call.readonlyReturnBinding)).toEqual([binding, binding]);
    const provider = createMessageBusSemanticTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6d), provider);
    for (let index = 0; index < 32; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (0xd00 + index).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const payload = new Uint8Array(DYNAMIC_CHUNK_SIZE * 3 + 1).fill(0x52);
    const source = await getContractFactory(artifacts.Source, signer).deploy(payload);
    const sourceAddress = await source.getAddress();
    const reader = await getContractFactory(artifacts.Reader, signer).deploy(sourceAddress);
    reader._registerResolvedExternal('ISource', source);
    expect((await source.getState()).records).toEqual(payload);
    const builder = await reader.call.measure().emitReturn().build();
    expect(messageBusVmAccepts(builder)).toBe(true);
    const transaction = builder.buildLibauthTransaction();
    const inputs = generateLibauthSourceOutputs(builder.inputs);
    const identityLock = addressToLockScript(sourceAddress);
    const identityIndex = inputs.findIndex((input) => input.token?.nft?.capability === 'none'
      && binToHex(input.token.category) === source.categoryId
      && binToHex(input.lockingBytecode) === binToHex(identityLock));
    expect(identityIndex).toBeGreaterThanOrEqual(0);
    expect(binToHex(inputs[identityIndex].token!.nft!.commitment)).toMatch(/^5343494401/u);
    expect(transaction.outputs[identityIndex].lockingBytecode).toEqual(identityLock);
    expect(transaction.outputs[identityIndex].token).toEqual(inputs[identityIndex].token);
    expect(transaction.outputs[identityIndex].value).toBe(inputs[identityIndex].value);
    const chunkLock = addressToLockScript(getDynamicChunkAddress(source.inner, source.categoryId, 'records', 'bytes'));
    const readChunks = inputs.filter((input) => binToHex(input.lockingBytecode) === binToHex(chunkLock));
    expect(readChunks).toHaveLength(4);
    const keptChunks = transaction.outputs.filter((output) => binToHex(output.lockingBytecode) === binToHex(chunkLock));
    expect(keptChunks.map((output) => binToHex(output.token!.nft!.commitment)).sort())
      .toEqual(readChunks.map((input) => binToHex(input.token!.nft!.commitment)).sort());
    const scalar = binToHex(encodeExternalReturnValues([BigInt(payload.length)], ['uint256'], artifacts.Source.structs, true));
    const pair = binToHex(encodeExternalReturnValues([BigInt(payload.length), BigInt(payload.length)],
      ['uint256', 'uint256'], artifacts.Reader.structs, true));
    expect(transaction.outputs.filter((output) => output.token?.nft
      && binToHex(output.token.category) === source.categoryId
      && binToHex(output.token.nft.commitment) === scalar)).toHaveLength(2);
    expect(transaction.outputs.some((output) => output.token?.nft
      && binToHex(output.token.category) === reader.categoryId
      && binToHex(output.token.nft.commitment) === pair)).toBe(true);
    // Change the free alias and the matching caller result together. The root's own return check then
    // succeeds, so rejection of the root input proves the shared-callee return binding itself.
    const forged = structuredClone(transaction);
    const aliasIndex = forged.outputs.findLastIndex((output) => output.token?.nft
      && binToHex(output.token.category) === source.categoryId
      && binToHex(output.token.nft.commitment) === scalar);
    const rootReturn = forged.outputs.find((output) => output.token?.nft
      && binToHex(output.token.category) === reader.categoryId
      && binToHex(output.token.nft.commitment) === pair)!;
    forged.outputs[aliasIndex].token!.nft!.commitment = encodeExternalReturnValues(
      [BigInt(payload.length + 1)], ['uint256'], artifacts.Source.structs, true,
    );
    rootReturn.token!.nft!.commitment = encodeExternalReturnValues(
      [BigInt(payload.length), BigInt(payload.length + 1)], ['uint256', 'uint256'], artifacts.Reader.structs, true,
    );
    const vm = createVirtualMachineBch2026ForProvider(provider);
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: 0, sourceOutputs: inputs, transaction: forged }))).not.toBe(true);
    await builder.send();
    expect((await source.getState()).records).toEqual(payload);
  }, 180_000);
});
