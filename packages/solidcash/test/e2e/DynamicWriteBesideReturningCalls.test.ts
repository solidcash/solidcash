import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeTransaction, hash256, hexToBin,
} from '@bitauth/libauth';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { compileString } from '../direct-compile.js';

// A helper that rewrites one element of a dynamic struct array beside two returning external calls. The array's
// old chunk is spent ahead of the callee blocks and its replacement follows their return events; the output at the
// old chunk's own index is padding, never a second copy of the chunk.
const TOKEN = `pragma solidity ^0.8.0;
contract Token {
    uint256 public total;
    uint256 public reads;
    function balanceOf(address owner) external returns (uint256) {
        require(owner != address(0));
        reads = reads + 1;
        return total;
    }
}`;

const SINK = `pragma solidity ^0.8.0;
contract Sink {
    uint256 public bumps;
    function bump(uint256 v) external returns (uint256) {
        bumps = bumps + v;
        return v;
    }
}`;

const POOLS = `pragma solidity ^0.8.0;
interface ISink {
    function bump(uint256 v) external returns (uint256);
}
interface IToken {
    function balanceOf(address owner) external returns (uint256);
}
contract Pools {
    struct Pool {
        IToken token;
        uint256 seen;
        uint256 refreshes;
    }
    Pool[] public pools;
    ISink public sink;
    function add(IToken token) public {
        pools.push(Pool(token, 0, 0));
    }
    // Skipped once the pool has been refreshed \`limit\` times; the array is written back either way.
    function refresh(uint256 _pid, uint256 limit) public {
        Pool storage pool = pools[_pid];
        if (pool.refreshes >= limit) {
            return;
        }
        pool.seen = pool.token.balanceOf(address(this));
        pool.refreshes = pool.refreshes + sink.bump(1);
    }
}`;

const options = { evmCompat: true, forceStateful: true } as const;

type Captured = { hex: string; send: (hex: string) => Promise<string> };

// Builds and verifies the call without broadcasting it, so the transaction can be replayed with its outputs changed.
const capture = async (provider: any, call: () => Promise<unknown>): Promise<Captured> => {
  const send = provider.sendRawTransaction.bind(provider);
  let hex = '';
  provider.sendRawTransaction = async (raw: string): Promise<string> => {
    hex = raw;
    return binToHex(hash256(hexToBin(raw)).reverse());
  };
  try {
    await call();
  } finally {
    provider.sendRawTransaction = send;
  }
  expect(hex).not.toBe('');
  return { hex, send };
};

describe('a dynamic array written beside returning external calls', () => {
  it('settles with one chunk run whether the calls run or are skipped, and refuses a duplicated or moved chunk',
    async () => {
      const provider = createTestProvider();
      const deploy = async (source: string, state: Record<string, unknown>): Promise<any> => {
        const artifact = compileString(source, options);
        const contract = new Contract(artifact, [], { provider });
        const { categoryId } = await setupStatefulUtxos(
          provider, contract, artifact.stateLayout!, state, { saltContract: true },
        );
        return {
          categoryId,
          sc: StatefulContract.withCategory(contract, categoryId),
          addr: hexToBin(contract.withCategory(hexToBin(categoryId)).lockingBytecode),
        };
      };
      const first = await deploy(TOKEN, { total: 7n, reads: 0n });
      const second = await deploy(TOKEN, { total: 11n, reads: 0n });
      const sink = await deploy(SINK, { bumps: 0n });
      const pools = await deploy(POOLS, { pools: [], sink: sink.addr });
      await pools.sc.add(first.addr).send();
      await pools.sc.add(second.addr).send();

      // The caller's mutable outputs other than its data NFT at output 1 are the array's chunks.
      const chunkOutputs = (hex: string): number[] => {
        const tx = decodeTransactionUnsafe(hexToBin(hex));
        const category = [pools.categoryId, binToHex(hexToBin(pools.categoryId).reverse())];
        const dataLock = binToHex(tx.outputs[1].lockingBytecode);
        return tx.outputs.flatMap((output, index) => (output.token?.nft?.capability === 'mutable'
          && category.includes(binToHex(output.token.category))
          && binToHex(output.lockingBytecode) !== dataLock ? [index] : []));
      };
      const lastReturnEvent = (hex: string): number => {
        const outputs = decodeTransactionUnsafe(hexToBin(hex)).outputs;
        return outputs.reduce((last, output, index) => (binToHex(output.lockingBytecode) === '51'
          && output.token?.nft?.capability === 'none' ? index : last), -1);
      };
      // The change output ends each transaction: swapping it with the chunk moves only the chunk.
      const refusesMovedChunk = async ({ hex, send }: Captured, chunk: number): Promise<void> => {
        const moved = decodeTransactionUnsafe(hexToBin(hex));
        const last = moved.outputs.length - 1;
        expect(moved.outputs[last].token).toBeUndefined();
        [moved.outputs[chunk], moved.outputs[last]] = [moved.outputs[last], moved.outputs[chunk]];
        await expect(send(binToHex(encodeTransaction(moved)))).rejects.toThrow(/input index 0/);
      };
      // A second copy of the chunk, paid for (with its bytes) out of the change output.
      const refusesDuplicatedChunk = async ({ hex, send }: Captured, chunk: number): Promise<void> => {
        const duplicated = decodeTransactionUnsafe(hexToBin(hex));
        const copy = duplicated.outputs[chunk];
        duplicated.outputs[duplicated.outputs.length - 1].valueSatoshis -= copy.valueSatoshis + 1000n;
        duplicated.outputs.splice(chunk + 1, 0, {
          ...copy,
          lockingBytecode: copy.lockingBytecode.slice(),
          token: { ...copy.token!, nft: { ...copy.token!.nft!, commitment: copy.token!.nft!.commitment.slice() } },
        });
        await expect(send(binToHex(encodeTransaction(duplicated)))).rejects.toThrow(/input index 0/);
      };

      // Both calls run: the old chunk is spent ahead of the callees, and the one chunk follows the return events.
      const ran = await capture(provider, () => pools.sc.refresh(1n, 5n)
        .withExternalCall(second.sc).withExternalCall(sink.sc).send());
      const ranChunks = chunkOutputs(ran.hex);
      expect(ranChunks).toEqual([lastReturnEvent(ran.hex) + 1]);
      await refusesDuplicatedChunk(ran, ranChunks[0]);
      await refusesMovedChunk(ran, ranChunks[0]);
      await expect(ran.send(ran.hex)).resolves.toBeTypeOf('string');
      expect((await second.sc.getState()).reads).toBe(1n);
      expect((await first.sc.getState()).reads).toBe(0n);
      expect((await sink.sc.getState()).bumps).toBe(1n);

      // Skipped (one refresh made, the limit is 1): no callee, and the written-back chunk follows the caller's block.
      // Its change output is too small to pay for a second chunk, so only the moved chunk is tried here.
      const skipped = await capture(provider, () => pools.sc.refresh(1n, 1n).send());
      const skippedChunks = chunkOutputs(skipped.hex);
      expect(skippedChunks).toEqual([2]);
      await refusesMovedChunk(skipped, skippedChunks[0]);
      await expect(skipped.send(skipped.hex)).resolves.toBeTypeOf('string');
      expect((await second.sc.getState()).reads).toBe(1n);
      expect((await sink.sc.getState()).bumps).toBe(1n);

      // A second run sees the first run's write: one refresh made, so a limit of 2 runs the calls again.
      await pools.sc.refresh(1n, 2n).withExternalCall(second.sc).withExternalCall(sink.sc).send();
      expect((await second.sc.getState()).reads).toBe(2n);
      expect((await sink.sc.getState()).bumps).toBe(2n);
    });
});
