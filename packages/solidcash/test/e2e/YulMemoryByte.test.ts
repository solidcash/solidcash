import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import {
  Contract,
  MOCK_CONSENSUS_LIMITS,
  MOCK_RELAXED_OPERATION_COST,
  MockNetworkProvider,
  TransactionBuilder,
  randomUtxo,
} from '../../src/index.js';

describe('Yul byte over memory-backed bytes', () => {
  it('reads byte(0, mload(add(data, 0x60))) as data[64]', async () => {
    const artifact = compileString(`
      contract YulByteMemory {
        function verify(bytes memory data) public {
          uint8 v;
          assembly { v := byte(0, mload(add(data, 0x60))) }
          require(v == 28);
        }
      }
    `);
    const provider = new MockNetworkProvider({
      consensusLimits: {
        ...MOCK_CONSENSUS_LIMITS,
        operationCostBudgetPerByte: MOCK_RELAXED_OPERATION_COST,
      },
    });
    const contract = new Contract(artifact, [], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100_000n }));

    const tx = await new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(), contract.unlock.verify('11'.repeat(64) + '1c'))
      .addOutput({ to: contract.address, amount: 90_000n })
      .send();

    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('preserves the selected byte through an internal library wrapper', async () => {
    const artifact = compileString(`
      library BytesReader {
        function lastV(bytes memory data) internal pure returns (uint8 v) {
          assembly { v := byte(0, mload(add(data, 0x60))) }
        }
      }
      contract YulByteMemory {
        function verify(bytes memory data) public {
          require(BytesReader.lastV(data) == 28);
        }
      }
    `);
    const provider = new MockNetworkProvider({
      consensusLimits: {
        ...MOCK_CONSENSUS_LIMITS,
        operationCostBudgetPerByte: MOCK_RELAXED_OPERATION_COST,
      },
    });
    const contract = new Contract(artifact, [], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100_000n }));

    const tx = await new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(), contract.unlock.verify('11'.repeat(64) + '1c'))
      .addOutput({ to: contract.address, amount: 90_000n })
      .send();

    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('preserves the selected byte through a forwarded multi-return overload', async () => {
    const artifact = compileString(`
      library BytesReader {
        enum Status { Ok, Bad }
        function read(bytes32 hash, bytes memory data) internal pure returns (uint8, Status, bytes32) {
          bytes32 r;
          bytes32 s;
          uint8 v;
          assembly {
            r := mload(add(data, 0x20))
            s := mload(add(data, 0x40))
            v := byte(0, mload(add(data, 0x60)))
          }
          return read(hash, v, r, s);
        }
        function read(bytes32 hash, uint8 v, bytes32 r, bytes32 s)
          internal pure returns (uint8, Status, bytes32)
        {
          return (v, Status.Ok, hash);
        }
      }
      contract YulByteMemory {
        function verify(bytes32 hash, bytes memory data) public {
          (uint8 v, BytesReader.Status status, bytes32 result) = BytesReader.read(hash, data);
          require(v == 28);
          require(status == BytesReader.Status.Ok);
          require(result == hash);
        }
      }
    `);
    const provider = new MockNetworkProvider({
      consensusLimits: {
        ...MOCK_CONSENSUS_LIMITS,
        operationCostBudgetPerByte: MOCK_RELAXED_OPERATION_COST,
      },
    });
    const contract = new Contract(artifact, [], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100_000n }));

    const tx = await new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(), contract.unlock.verify('22'.repeat(32), '11'.repeat(64) + '1c'))
      .addOutput({ to: contract.address, amount: 90_000n })
      .send();

    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

});
