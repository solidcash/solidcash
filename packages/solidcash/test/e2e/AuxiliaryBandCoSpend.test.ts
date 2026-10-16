import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import {
  StatefulContract,
  getDataNftLockingBytecode,
} from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import {
  blockhashOracleLockingBytecode, buildBlockhashCommitment,
} from '@solidcash/utils';

// One stateful function combining every front-region auxiliary co-spend family the unified band allocates:
// a blockhash oracle, a keccak256 compute side-car, a read-only external state read, and an external call.
// The block layout must order them in one band (master -> dataNft -> readOnlyDataNft -> blockhashOracle ->
// keccakSideCar) and the SDK must co-spend them at exactly those slots, or the transaction cannot settle.

const READABLE = `
pragma solidcash >=0.8.0;
interface IReadable { public int counter; }
contract Readable() is IReadable {
    int counter;
}
`;

const COUNTER = `
pragma solidcash >=0.8.0;
interface ICounter { public int counter; function bump(); }
contract Counter() is ICounter {
    int counter;
    function bump() {
        this.counter = this.counter + 1;
    }
}
`;

const CALLER = `
pragma solidcash >=0.8.0;
interface IReadable { public int counter; }
interface ICounter { public int counter; function bump(); }
contract AuxBandCaller(bytes readableAddr, bytes counterAddr) {
    int lastSeen;
    function run(bytes32 x, int bn, bytes32 expect) {
        require(blockhash(bn) == expect);
        bytes32 digest = keccak256(x);
        int before = IReadable(readableAddr).counter;
        ICounter(counterAddr).bump();
        this.lastSeen = before;
        require(digest != bytes32(0));
    }
}
`;

describe('unified auxiliary co-spend band (oracle + keccak + external read + external call)', () => {
  it('builds and settles a call mixing all four auxiliary families', async () => {
    const provider = createTestProvider();
    const before = await provider.getBlockHeight();
    await provider.mine(1);
    const n = before + 1;
    const hash = hexToBin(await provider.getBlockHash(n));

    const readableArtifact = compileString(READABLE);
    const counterArtifact = compileString(COUNTER);
    const callerArtifact = compileString(CALLER);

    const readableContract = new Contract(readableArtifact, [], { provider });
    const counterContract = new Contract(counterArtifact, [], { provider });

    const { categoryId: readableCategory } = await setupStatefulUtxos(
      provider, readableContract, readableArtifact.stateLayout!, { counter: 7n }, { saltContract: true },
    );
    const { categoryId: counterCategory } = await setupStatefulUtxos(
      provider, counterContract, counterArtifact.stateLayout!, { counter: 5n }, { saltContract: true },
    );

    // The plain external read pins the callee's category-salted data-NFT lock; the external call pins its master.
    const readableDataLock = getDataNftLockingBytecode(
      readableCategory, hexToBin(readableContract.withCategory(hexToBin(readableCategory)).lockingBytecode),
    );
    const counterMasterLock = counterContract.withCategory(hexToBin(counterCategory)).lockingBytecode;

    const callerContract = new Contract(
      callerArtifact, [readableDataLock, counterMasterLock], { provider },
    );
    const { categoryId: callerCategory } = await setupStatefulUtxos(
      provider, callerContract, callerArtifact.stateLayout!, { lastSeen: 0n }, { saltContract: true },
    );

    // Seed the caller-branded (n -> hash) oracle the covenant reads.
    const oracleLock = blockhashOracleLockingBytecode(hexToBin(callerCategory));
    await provider.addUtxo(binToHex(oracleLock), {
      txid: 'a7'.repeat(32), vout: 0, satoshis: 1000n,
      token: {
        category: callerCategory, amount: 0n,
        nft: { capability: 'none', commitment: binToHex(buildBlockhashCommitment(BigInt(n), hash)) },
      },
    });

    const readableSc = StatefulContract.withCategory(readableContract, readableCategory);
    const counterSc = StatefulContract.withCategory(counterContract, counterCategory);
    const callerSc = StatefulContract.withCategory(callerContract, callerCategory, {
      externals: { IReadable: readableSc },
    });

    const x = hexToBin('00'.repeat(32));
    const digest = keccak_256(x);
    expect(BigInt(`0x${binToHex(digest)}`)).toBeGreaterThan(0n);

    await callerSc.run(x, BigInt(n), hash)
      .withExternalCall(counterSc, 'bump', [])
      .send();

    // blockhash(n) == expect passed, keccak256(x) read from its side-car, the read-only read saw 7, and the
    // external call advanced the counter from 5 to 6.
    expect((await counterSc.getState()).counter).toBe(6n);
    expect((await callerSc.getState()).lastSeen).toBe(7n);
    expect((await readableSc.getState()).counter).toBe(7n);
  }, 300_000);
});
