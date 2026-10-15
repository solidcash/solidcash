import { describe, it, expect } from 'vitest';
import { hexToBin, binToHex } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { blockhashOracleLockingBytecode, buildBlockhashCommitment } from '@solidcash/utils';
import { alicePub, alicePriv } from '../fixture/vars.js';

const CALLEE = `
pragma solidcash >=0.8.0;
interface ICalleeK {
    public int counter;
    function bump(int bn, bytes32 bh);
}
contract CalleeKB() is ICalleeK {
    int counter;
    function bump(int bn, bytes32 bh) {
        require(blockhash(bn) == bh);
        this.counter = this.counter + 1;
    }
}`;

const CALLER = `
pragma solidcash >=0.8.0;
interface ICalleeK {
    public int counter;
    function bump(int bn, bytes32 bh);
}
contract CallerK(bytes calleeAddr) {
    int lastSeen;
    function readAfterBump(pubkey pk, sig s) {
        require(checkSig(s, pk));
        int newVal = ICalleeK(calleeAddr).outState.counter;
        this.lastSeen = newVal;
    }
}`;

describe('transitive callee blockhash outState read', () => {
  it('settles and advances both contracts', async () => {
    const provider = createTestProvider();
    const before = await provider.getBlockHeight();
    await provider.mine(1);
    const n = before + 1;
    const hash = hexToBin(await provider.getBlockHash(n));
    const calleeArtifact = compileString(CALLEE);
    const callerArtifact = compileString(CALLER);
    const calleeContract = new Contract(calleeArtifact, [], { provider });
    const { categoryId: calleeCategory } = await setupStatefulUtxos(
      provider, calleeContract, calleeArtifact.stateLayout!, { counter: 5n }, { saltContract: true },
    );
    const lock = blockhashOracleLockingBytecode(hexToBin(calleeCategory));
    await provider.addUtxo(binToHex(lock), {
      txid: 'ab'.repeat(32), vout: 0, satoshis: 1000n,
      token: { category: calleeCategory, amount: 0n,
        nft: { capability: 'none', commitment: binToHex(buildBlockhashCommitment(BigInt(n), hash)) } },
    });
    const calleeAddr = calleeContract.withCategory(hexToBin(calleeCategory)).lockingBytecode;
    const callerContract = new Contract(callerArtifact, [calleeAddr], { provider });
    const { categoryId: callerCategory } = await setupStatefulUtxos(
      provider, callerContract, callerArtifact.stateLayout!, { lastSeen: 0n }, { saltContract: true },
    );
    const callerSc = StatefulContract.withCategory(callerContract, callerCategory);
    const calleeSc = StatefulContract.withCategory(calleeContract, calleeCategory);
    await callerSc.readAfterBump(alicePub, new SignatureTemplate(alicePriv))
      .withExternalCall(calleeSc, 'bump', [BigInt(n), hash])
      .send();
    // B's require(blockhash(n) == bh) passed, so B advanced and A read the outState counter back.
    expect((await calleeSc.getState()).counter).toBe(6n);
    expect((await callerSc.getState()).lastSeen).toBe(6n);
  }, 300_000);
});
