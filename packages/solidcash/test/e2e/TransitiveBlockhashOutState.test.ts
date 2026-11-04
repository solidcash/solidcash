import { describe, it, expect } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { selectPoolSlot } from '../../src/oracle/pool/index.js';
import type { MockNetworkProvider } from '../../src/network/mock/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
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

// B reads blockhash(n) from a ring slot of the oracle pool it binds, the provider's.
describe('transitive callee blockhash outState read', () => {
  it('settles and advances both contracts', async () => {
    const provider = createTestProvider() as MockNetworkProvider;
    const before = await provider.getBlockHeight();
    await provider.mine(1);
    const n = before + 1;
    const hash = hexToBin(await provider.getBlockHash(n));
    const calleeArtifact = compileString(CALLEE);
    const callerArtifact = compileString(CALLER);
    const calleeContract = new Contract(calleeArtifact, [], { provider });
    expect(calleeContract.oraclePool).toBe(provider.oraclePoolCategory);
    expect((await selectPoolSlot(provider, calleeContract.oraclePool!, BigInt(n)))?.exact).toBe(true);
    const { categoryId: calleeCategory } = await setupStatefulUtxos(
      provider, calleeContract, calleeArtifact.stateLayout!, { counter: 5n }, { saltContract: true },
    );
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
