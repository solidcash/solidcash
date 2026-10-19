import { describe, it, expect } from 'vitest';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { randomUtxo } from '../../src/utils.js';
import {
  blockhashOracleLockingBytecode, buildBlockhashCommitment, keccakComputeLockingBytecode,
} from '@solidcash/utils';
import { alicePub, alicePriv } from '../fixture/vars.js';

const KECCAK_SIDECAR_CATEGORY = 'ee'.repeat(31) + '11';

const CALLEE = `
pragma solidcash >=0.8.0;
interface ICalleeK {
    public int counter;
    function bump(bytes preimage, bytes32 expected, int bn, bytes32 bh);
}
contract CalleeKB() is ICalleeK {
    int counter;
    function bump(bytes preimage, bytes32 expected, int bn, bytes32 bh) {
        require(blockhash(bn) == bh);
        require(keccak256(keccak256(preimage)) == expected);
        this.counter = this.counter + 1;
    }
}`;

const CALLER = `
pragma solidcash >=0.8.0;
interface ICalleeK {
    public int counter;
    function bump(bytes preimage, bytes32 expected, int bn, bytes32 bh);
}
contract CallerK(bytes calleeAddr) {
    int lastSeen;
    function readAfterBump(pubkey pk, sig s) {
        require(checkSig(s, pk));
        int newVal = ICalleeK(calleeAddr).outState.counter;
        this.lastSeen = newVal;
    }
}`;

describe('transitive callee complex keccak + blockhash front-region (fail-closed edge b)', () => {
  it('settles with the correct digest', async () => {
    const provider = createTestProvider();
    const { n, hash } = await allocHeight(provider);
    const calleeArtifact = compileString(CALLEE);
    const callerArtifact = compileString(CALLER);
    const calleeContract = new Contract(calleeArtifact, [], { provider });
    const { categoryId: calleeCategory } = await setupStatefulUtxos(
      provider, calleeContract, calleeArtifact.stateLayout!, { counter: 5n }, { saltContract: true },
    );
    // Callee's blockhash oracle (branded to the callee category) + shared compute side-car.
    await seedOracleNft(provider, BigInt(n), hash, { category: calleeCategory });
    const calleeSidecarLock = binToHex(keccakComputeLockingBytecode(new Uint8Array(32), true));
    await provider.addUtxo(calleeSidecarLock, {
      ...randomUtxo({ satoshis: 100_000n }),
      token: { category: KECCAK_SIDECAR_CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
    });

    const preimage = hexToBin('00'.repeat(32));
    const expected = keccak_256(keccak_256(preimage));

    const calleeAddr = calleeContract.withCategory(hexToBin(calleeCategory)).lockingBytecode;
    const callerContract = new Contract(callerArtifact, [calleeAddr], { provider });
    const { categoryId: callerCategory } = await setupStatefulUtxos(
      provider, callerContract, callerArtifact.stateLayout!, { lastSeen: 0n }, { saltContract: true },
    );
    const callerSc = StatefulContract.withCategory(callerContract, callerCategory);
    const calleeSc = StatefulContract.withCategory(calleeContract, calleeCategory);
    await callerSc.readAfterBump(alicePub, new SignatureTemplate(alicePriv))
      .withExternalCall(calleeSc, 'bump', [preimage, expected, BigInt(n), hash])
      .send();
    // B's require(blockhash) and require(keccak(keccak(preimage)) == expected) both passed, so B's counter
    // advanced and A read that outState value back into lastSeen.
    expect((await calleeSc.getState()).counter).toBe(6n);
    expect((await callerSc.getState()).lastSeen).toBe(6n);
  }, 300_000);
});

// Local copies of the BlockOracle e2e helpers (they are not exported).
async function allocHeight(provider: ReturnType<typeof createTestProvider>): Promise<{ n: number; hash: Uint8Array }> {
  const before = await provider.getBlockHeight();
  await provider.mine(1);
  return { n: before + 1, hash: hexToBin(await provider.getBlockHash(before + 1)) };
}
let nonce = 0;
async function seedOracleNft(
  provider: ReturnType<typeof createTestProvider>, n: bigint, hash: Uint8Array, opts: { category?: string } = {},
): Promise<void> {
  nonce += 1;
  const lock = blockhashOracleLockingBytecode(hexToBin(opts.category ?? 'cc'.repeat(31) + '33'));
  await provider.addUtxo(binToHex(lock), {
    txid: nonce.toString(16).padStart(64, '0'), vout: 0, satoshis: 1000n,
    token: { category: opts.category ?? 'cc'.repeat(31) + '33', amount: 0n,
      nft: { capability: 'none', commitment: binToHex(buildBlockhashCommitment(n, hash)) } },
  });
}
