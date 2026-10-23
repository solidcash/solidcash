import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { scriptToBytecode, sha256 } from '@solidcash/utils';
import { compileString as compileKernel } from '@solidcash/solidc';
import { compileString } from '../direct-compile.js';
import {
  Contract,
  TransactionBuilder,
} from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { encodeEvmInvocationResult } from '../../src/stateful/evm-abi-result.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createMessageBusSemanticTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../test-util.js';

const payload = Uint8Array.from({ length: 20 }, (_value, index) => index + 1);
const addressWord = Uint8Array.of(...new Uint8Array(12), ...payload);
const artifact = compileString(`pragma solidity ^0.8.0;
  struct Record { address owner; address[2] peers; string note; }
  contract Encoder {
    function scalar(address value, bytes memory expected) public pure {
      require(abi.encode(value) == expected);
    }
    function record(Record memory value, bytes memory expected) public pure {
      require(abi.encode(value) == expected);
    }
  }`, { evmCompat: true, suppressWarnings: true });

async function evaluate(name: string, ...args: Parameters<Contract['unlock'][string]>): Promise<true | string> {
  const provider = createMessageBusSemanticTestProvider();
  const contract = new Contract(artifact, [], { provider });
  const utxo = randomUtxo({ satoshis: 1_000_000n });
  await provider.addUtxo(contract.address, utxo);
  const builder = new TransactionBuilder({ provider })
    .addInput(utxo, contract.unlock[name](...args))
    .addOutput({ to: contract.address, amount: 1_000n });
  const vm = createVirtualMachineBch2026ForProvider(provider);
  return vm.stateSuccess(vm.evaluate({
    inputIndex: 0,
    sourceOutputs: generateLibauthSourceOutputs(builder.inputs),
    transaction: builder.buildLibauthTransaction(),
  }));
}

describe('compiler EVM address-word encoding', () => {
  it('matches SDK encoding for canonical address words in structs and fixed arrays', async () => {
    const value = { owner: addressWord, peers: [addressWord, new Uint8Array(32)], note: 'stored addresses' };
    const expected = encodeEvmInvocationResult([value], ['Record'], artifact.structs);
    expect(await evaluate('record', value, expected)).toBe(true);
  });

  it('preserves native BCH addresses, raw payloads, canonical words, and zero', async () => {
    const values = [
      new Uint8Array(), new Uint8Array(20), addressWord, payload,
      Uint8Array.of(0x76, 0xa9, 0x14, ...payload, 0x88, 0xac),
      Uint8Array.of(0xa9, 0x14, ...payload, 0x87),
      Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x24), 0x87),
    ];
    for (const value of values) {
      expect(await evaluate('scalar', value, encodeEvmInvocationResult([value], ['address']))).toBe(true);
    }
  });

  it('rejects dirty high padding even when the expected result matches the old truncation', async () => {
    for (let index = 0; index < 12; index += 1) {
      const malformed = addressWord.slice();
      malformed[index] = 1;
      const truncated = encodeEvmInvocationResult([malformed.slice(3, 23)], ['address']);
      expect(await evaluate('scalar', malformed, truncated)).not.toBe(true);
      expect(() => encodeEvmInvocationResult([malformed], ['address'])).toThrow();
    }
  });

  it('authenticates an updated stored struct through a schema-aware kernel return', async () => {
    const provider = createMessageBusSemanticTestProvider();
    const options = {
      forceStateful: true, messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
      evmCompat: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
    } as const;
    const storeArtifact = compileKernel(`pragma solidity ^0.8.0;
      struct Record { address owner; address[2] peers; string note; }
      contract Store {
        mapping(uint256 => Record) records;
        function put(uint256 key, address owner) public {
          records[key] = Record(owner, [owner, address(0)], "stored addresses");
        }
        function touch(uint256 key) public { records[key].note = "returned addresses"; }
        function read(uint256 key) public view returns (Record memory) {
          return records[key];
        }
      }`, options);
    const readerArtifact = compileKernel(`pragma solidity ^0.8.0;
      struct Record { address owner; address[2] peers; string note; }
      interface IStore {
        function touch(uint256 key) external;
        function read(uint256 key) external view returns (Record memory);
      }
      contract Reader {
        function check(address store, uint256 key) public {
          IStore(store).touch(key);
          IStore(store).read(key);
          require(true);
        }
      }`, options);
    const base = new Contract(storeArtifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, base, storeArtifact.stateLayout!, {}, { saltContract: true });
    const store = StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    await store.call.put(7n, payload).send();
    const readerBase = new Contract(readerArtifact, [], { provider });
    const readerSetup = await setupStatefulUtxos(
      provider, readerBase, readerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const reader = StatefulContract.withCategory(
      readerBase.withCategory(hexToBin(readerSetup.categoryId)), readerSetup.categoryId,
      { externals: { IStore: store } },
    );
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const builder = await messageBus.compose({
      calls: [reader.call.check(store.inner.lockingBytecode, 7n), store.call.touch(7n), store.call.read(7n)],
      funder, changeAddress: funder.unlocker.generateLockingBytecode(),
    }).build();
    const value = { owner: addressWord, peers: [addressWord, new Uint8Array(32)], note: 'returned addresses' };
    const result = encodeEvmInvocationResult([value], ['Record'], storeArtifact.structs);
    const expected = scriptToBytecode([result]);
    expect(expected.length).toBeGreaterThan(128);
    const transaction = builder.buildLibauthTransaction();
    const outputIndex = transaction.outputs.findIndex((output) => output.token?.nft
      && binToHex(output.token.nft.commitment) === binToHex(sha256(expected)));
    expect(outputIndex).toBeGreaterThanOrEqual(0);
    const inputIndex = builder.inputs.findIndex(({ unlocker }) => 'contract' in unlocker
      && unlocker.contract.name === storeArtifact.contractName
      && unlocker.abiFunction.name === storeArtifact.messageBus!.route.name);
    expect(inputIndex).toBeGreaterThanOrEqual(0);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction }))).toBe(true);
    const incorrectReturn = structuredClone(transaction);
    incorrectReturn.outputs[outputIndex].token!.nft!.commitment[0] ^= 1;
    expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction: incorrectReturn }))).not.toBe(true);
    await expect(builder.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/u) });
  }, 180_000);
});
