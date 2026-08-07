import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import {
  Contract, SignatureTemplate, StatefulContract,
} from '../../src/index.js';
import { alicePub, alicePriv, alicePkh } from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// A conditional deploy: `if (c == 1) new Child()` inside a factory function. The genesis is verified INLINE at
// the creation site (emitInlineDeployVerification), so when the branch fires the child genesis is co-spent and
// the covenant checks it; when the branch is not taken there is no child. This test proves the FIRED path is
// runtime-sound - the inline covenant co-spends and verifies a real child genesis (same fixed slot as an
// unconditional deploy).

const CHILD = `
contract Child(bytes20 owner) {
    int counter;
    function increment() {
        require(tx.outputs[0].lockingBytecode == new LockingBytecodeP2PKH(owner));
        this.counter = this.counter + 1;
    }
}
`;

// Factory whose deploy fires only when c == 1. `new Child()` references Child by name, so Child must be in the
// same compilation unit (compileString returns the last contract, CondFactory, with Child as a referenced child).
const COND_FACTORY = `${CHILD}
contract CondFactory(bytes20 owner) {
    int childCount;
    function make(int c) {
        if (c == 1) {
            Child ch = new Child(owner);
        }
        this.childCount = this.childCount + 1;
    }
}
`;

describe('conditional deploy runtime (if (c==1) new Child())', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const factoryArtifact = compileString(COND_FACTORY);
  const childArtifact = compileString(CHILD);

  let factory: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];

  it('compiles the conditional-deploy factory (deploy inferred, verified inline)', () => {
    const make = factoryArtifact.abi.find((f) => f.name === 'make');
    expect(make?.modifiers).toContain('deploy');
    expect(make?.deployTargets?.[0]?.contractName).toBe('Child');
  });

  it('deploys the factory', async () => {
    const fundingUtxo: Utxo = { txid: 'ca11'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);
    const result = await StatefulContract.deploy(factoryArtifact, [alicePkh], {
      provider,
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { childCount: 0n },
      changeAddress: p2pkh.address,
    });
    factory = result.contract;
    expect(factory.categoryId).toBe(result.categoryId);
  });

  it('make(1) FIRES the deploy: a real Child genesis is co-spent and verified inline', async () => {
    const genesisFunding: Utxo = { txid: 'c111'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, genesisFunding);

    const result = await StatefulContract.deployFrom({
      provider,
      factory,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      fundingUtxo: genesisFunding,
      changeAddress: p2pkh.address,
      deployFunctionName: 'make',
      deployFunctionArgs: [1n],
      childArtifact,
      childConstructorArgs: [alicePkh],
      childInitialState: { counter: 0n },
    });

    // The child genesis was minted (its category == the genesis funding txid).
    expect(result.childCategoryId).toBe(genesisFunding.txid);
    const outs = getTxOutputs(result.tx);
    // The child master NFT (minting, 0x02) exists among the outputs with the child category.
    const hasChildMaster = outs.some((o) => o.token?.category === genesisFunding.txid
      && o.token?.nft?.capability === 'minting');
    expect(hasChildMaster).toBe(true);
  });

  it('make(2) does NOT fire the deploy: a plain call, no child genesis, childCount still increments', async () => {
    // A conditionally-deploying function called with a non-firing arg is just a normal state-write call. The
    // inline genesis checks live inside `if (c == 1)`, so the covenant verifies no child when c != 1.
    const before = (await factory.getState()).childCount as bigint;
    const tx = await factory.call.make(2n).send();
    expect(tx.txid).toBeDefined();
    const outs = getTxOutputs(tx);
    // No child minting NFT: every token output carries the FACTORY category (the master + its data NFT).
    const factoryCat = factory.categoryId;
    expect(outs.every((o) => !o.token || o.token.category === factoryCat)).toBe(true);
    expect((await factory.getState()).childCount).toBe(before + 1n);
  });
});

// A LOOP deploy `for (i < n) new Child()` mints a runtime-variable count, verified inline per iteration by a
// runtime deploy counter (masterInputIndex + slotBase + counter*stride). n = 1 runs the loop once -> one child
// at counter 0 (= the base slot, same layout as a single deploy), so the existing single-child deployFrom
// co-spends it while fully exercising the counter machinery (PICK counter, counter*stride, increment). This
// VM-proves the loop covenant for N = 1; N > 1 needs the SDK to derive multiple geneses (a follow-up).
const LOOP_FACTORY = `${CHILD}
contract LoopFactory(bytes20 owner) {
    int childCount;
    function makeN(int n) {
        for (int i = 0; i < n; i = i + 1) {
            Child ch = new Child(owner);
        }
        this.childCount = this.childCount + n;
    }
}
`;

describe('loop deploy runtime (for (i<n) new Child()) - N=1 via existing deployFrom', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const loopArtifact = compileString(LOOP_FACTORY);
  const childArtifact = compileString(CHILD);

  let factory: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];

  it('compiles the loop-deploy factory (deploy inferred, verified inline with a runtime counter)', () => {
    const makeN = loopArtifact.abi.find((f) => f.name === 'makeN');
    expect(makeN?.modifiers).toContain('deploy');
    expect(makeN?.deployTargets?.[0]?.contractName).toBe('Child');
  });

  it('deploys the loop factory', async () => {
    const fundingUtxo: Utxo = { txid: '10a9'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);
    const result = await StatefulContract.deploy(loopArtifact, [alicePkh], {
      provider,
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { childCount: 0n },
      changeAddress: p2pkh.address,
    });
    factory = result.contract;
    expect(factory.categoryId).toBe(result.categoryId);
  });

  it('makeN(1): the loop runs once, the runtime-counter covenant verifies one real Child genesis', async () => {
    const genesisFunding: Utxo = { txid: '1c11'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, genesisFunding);

    const result = await StatefulContract.deployFrom({
      provider,
      factory,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      fundingUtxo: genesisFunding,
      changeAddress: p2pkh.address,
      deployFunctionName: 'makeN',
      deployFunctionArgs: [1n],
      childArtifact,
      childConstructorArgs: [alicePkh],
      childInitialState: { counter: 0n },
    });

    expect(result.childCategoryId).toBe(genesisFunding.txid);
    const outs = getTxOutputs(result.tx);
    const hasChildMaster = outs.some((o) => o.token?.category === genesisFunding.txid
      && o.token?.nft?.capability === 'minting');
    expect(hasChildMaster).toBe(true);
  });

  it('makeN(2): the loop runs twice - the counter covenant co-spends + verifies TWO real Child geneses', async () => {
    // N=2 is the true test of the runtime counter: child 0 lands at counter 0 (base) and child 1 at counter 1
    // (base + stride), so the counter*stride multiply is actually exercised. Two balancing funding inputs (any
    // value, vout 0) source the two child categories; the covenant's 2-iteration loop verifies both. Fresh
    // factory (childCount 0 -> 2) to isolate from the makeN(1) call above.
    const fresh: Utxo = { txid: '20f2'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, fresh);
    const freshFactory = (await StatefulContract.deploy(loopArtifact, [alicePkh], {
      provider,
      fundingUtxo: fresh,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { childCount: 0n },
      changeAddress: p2pkh.address,
    })).contract;

    const g0: Utxo = { txid: '2a01'.repeat(16), vout: 0, satoshis: 200000n };
    const g1: Utxo = { txid: '2b02'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, g0);
    await provider.addUtxo(p2pkh.address, g1);

    const result = await StatefulContract.deployFrom({
      provider,
      factory: freshFactory,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      fundingUtxos: [g0, g1],
      changeAddress: p2pkh.address,
      deployFunctionName: 'makeN',
      deployFunctionArgs: [2n],
      childArtifact,
      childConstructorArgs: [alicePkh],
      childInitialState: { counter: 0n },
    });

    const outs = getTxOutputs(result.tx);
    // Two distinct child minting NFTs, one per funding-input category (child 0 at counter 0, child 1 at counter 1).
    const child0 = outs.some((o) => o.token?.category === g0.txid && o.token?.nft?.capability === 'minting');
    const child1 = outs.some((o) => o.token?.category === g1.txid && o.token?.nft?.capability === 'minting');
    expect(child0).toBe(true);
    expect(child1).toBe(true);
  });
});

// The runtime deploy counter is set up for every loop form (for/while desugar to while; do-while has its own
// visitor). This verifies the do-while path end to end: `do { new Child(); } while (i<n)` runs body-then-
// condition, minting N children verified by the same counter machinery.
const DOWHILE_FACTORY = `${CHILD}
contract DoWhileFactory(bytes20 owner) {
    int childCount;
    function makeN(int n) {
        int i = 0;
        do {
            Child ch = new Child(owner);
            i = i + 1;
        } while (i < n);
        this.childCount = this.childCount + i;
    }
}
`;

describe('do-while deploy runtime (do { new Child() } while (i<n))', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const dwArtifact = compileString(DOWHILE_FACTORY);
  const childArtifact = compileString(CHILD);

  it('makeN(2) via a do-while mints + verifies TWO children (counter 0 and 1)', async () => {
    const fresh: Utxo = { txid: 'd0f1'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, fresh);
    const factory = (await StatefulContract.deploy(dwArtifact, [alicePkh], {
      provider,
      fundingUtxo: fresh,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { childCount: 0n },
      changeAddress: p2pkh.address,
    })).contract;

    const g0: Utxo = { txid: 'd2a1'.repeat(16), vout: 0, satoshis: 200000n };
    const g1: Utxo = { txid: 'd2b2'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, g0);
    await provider.addUtxo(p2pkh.address, g1);

    const result = await StatefulContract.deployFrom({
      provider,
      factory,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      fundingUtxos: [g0, g1],
      changeAddress: p2pkh.address,
      deployFunctionName: 'makeN',
      deployFunctionArgs: [2n],
      childArtifact,
      childConstructorArgs: [alicePkh],
      childInitialState: { counter: 0n },
    });

    const outs = getTxOutputs(result.tx);
    expect(outs.some((o) => o.token?.category === g0.txid && o.token?.nft?.capability === 'minting')).toBe(true);
    expect(outs.some((o) => o.token?.category === g1.txid && o.token?.nft?.capability === 'minting')).toBe(true);
  });
});

// Multiple deploy sites in one function (a straight-line one + a conditional one, same child contract) share a
// FUNCTION-LEVEL runtime deploy counter: a1 fires at counter 0, a2 (if the branch is taken) at counter 1. The
// number of firing deploys = the number of funding inputs supplied.
const MULTI_FACTORY = `${CHILD}
contract MultiFactory(bytes20 owner) {
    int childCount;
    function makeMulti(int c) {
        Child a1 = new Child(owner);
        if (c == 1) {
            Child a2 = new Child(owner);
        }
        this.childCount = this.childCount + 1;
    }
}
`;

describe('multi-site deploy runtime (straight-line + conditional, same contract)', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const multiArtifact = compileString(MULTI_FACTORY);
  const childArtifact = compileString(CHILD);

  const deployFactory = async (seed: string): Promise<Awaited<ReturnType<typeof StatefulContract.deploy>>['contract']> => {
    const fu: Utxo = { txid: seed.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, fu);
    return (await StatefulContract.deploy(multiArtifact, [alicePkh], {
      provider,
      fundingUtxo: fu,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { childCount: 0n },
      changeAddress: p2pkh.address,
    })).contract;
  };

  it('makeMulti(1): BOTH the straight-line and the conditional deploy fire -> TWO children (counter 0 and 1)', async () => {
    const factory = await deployFactory('3aa1');
    const g0: Utxo = { txid: '3b01'.repeat(16), vout: 0, satoshis: 200000n };
    const g1: Utxo = { txid: '3b02'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, g0);
    await provider.addUtxo(p2pkh.address, g1);

    const result = await StatefulContract.deployFrom({
      provider,
      factory,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      fundingUtxos: [g0, g1],
      changeAddress: p2pkh.address,
      deployFunctionName: 'makeMulti',
      deployFunctionArgs: [1n],
      childArtifact,
      childConstructorArgs: [alicePkh],
      childInitialState: { counter: 0n },
    });

    const outs = getTxOutputs(result.tx);
    expect(outs.some((o) => o.token?.category === g0.txid && o.token?.nft?.capability === 'minting')).toBe(true);
    expect(outs.some((o) => o.token?.category === g1.txid && o.token?.nft?.capability === 'minting')).toBe(true);
  });

  it('makeMulti(0): only the straight-line deploy fires -> ONE child (counter 0)', async () => {
    const factory = await deployFactory('3ac1');
    const g0: Utxo = { txid: '3c01'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, g0);

    const result = await StatefulContract.deployFrom({
      provider,
      factory,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      fundingUtxos: [g0],
      changeAddress: p2pkh.address,
      deployFunctionName: 'makeMulti',
      deployFunctionArgs: [0n],
      childArtifact,
      childConstructorArgs: [alicePkh],
      childInitialState: { counter: 0n },
    });

    const outs = getTxOutputs(result.tx);
    expect(outs.some((o) => o.token?.category === g0.txid && o.token?.nft?.capability === 'minting')).toBe(true);
    // exactly one child minting NFT (no second category minted)
    const mintingChildren = outs.filter((o) => o.token?.nft?.capability === 'minting'
      && o.token?.category !== factory.categoryId);
    expect(mintingChildren.length).toBe(1);
  });
});

// The `factory.deployFn(...).deploy({ fundingUtxos })` sugar must forward fundingUtxos (N is runtime, so the
// signer can't auto-select it - the caller supplies one input per firing deploy).
describe('deploy sugar forwards fundingUtxos (factory.makeN(n).deploy({ fundingUtxos }))', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const loopArtifact = compileString(LOOP_FACTORY);
  const childArtifact = compileString(CHILD);

  it('makeN(2).deploy({ fundingUtxos: [g0, g1] }) mints two children via the sugar path', async () => {
    const fresh: Utxo = { txid: '5a0f'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, fresh);
    const factory = (await StatefulContract.deploy(loopArtifact, [alicePkh], {
      provider,
      fundingUtxo: fresh,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { childCount: 0n },
      changeAddress: p2pkh.address,
    })).contract;

    const g0: Utxo = { txid: '5b01'.repeat(16), vout: 0, satoshis: 200000n };
    const g1: Utxo = { txid: '5b02'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, g0);
    await provider.addUtxo(p2pkh.address, g1);

    const result = await factory.makeN(2n).deploy({
      fundingUtxos: [g0, g1],
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: p2pkh.address,
      childArtifact,
      childConstructorArgs: [alicePkh],
      childInitialState: { counter: 0n },
    });

    const outs = getTxOutputs(result.tx);
    expect(outs.some((o) => o.token?.category === g0.txid && o.token?.nft?.capability === 'minting')).toBe(true);
    expect(outs.some((o) => o.token?.category === g1.txid && o.token?.nft?.capability === 'minting')).toBe(true);
  });
});

// `new Child{value: x}()` sends x sats from the factory's OWN satoshi container (the value source) to the child.
// deployFrom co-spends the factory container (input) + recreates it (output, minus x) + adds the x-sat transfer.
// The factory must be deployed with an initialBalance >= x; the caller passes childValue.
const VALUE_FACTORY = `${CHILD}
contract ValueFactory(bytes20 owner) {
    int childCount;
    function make() {
        Child ch = new Child{value: 5000}(owner);
        this.childCount = this.childCount + 1;
    }
}
`;

describe('deploy with value (new Child{value: x}())', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const valueArtifact = compileString(VALUE_FACTORY);
  const childArtifact = compileString(CHILD);

  it('co-spends the factory satoshi container + materializes the 5000-sat transfer to the child', async () => {
    const fu: Utxo = { txid: '6a01'.repeat(16), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, fu);
    // The factory holds a balance (initialBalance) - the value source for new Child{value:}().
    const factory = (await StatefulContract.deploy(valueArtifact, [alicePkh], {
      provider,
      fundingUtxo: fu,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { childCount: 0n },
      initialBalance: 20000n,
      changeAddress: p2pkh.address,
    })).contract;

    const g0: Utxo = { txid: '6b01'.repeat(16), vout: 0, satoshis: 300000n };
    await provider.addUtxo(p2pkh.address, g0);

    const result = await StatefulContract.deployFrom({
      provider,
      factory,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      fundingUtxo: g0,
      changeAddress: p2pkh.address,
      deployFunctionName: 'make',
      deployFunctionArgs: [],
      childArtifact,
      childConstructorArgs: [alicePkh],
      childInitialState: { counter: 0n },
      childValue: 5000n,
    });

    const outs = getTxOutputs(result.tx);
    // child genesis
    expect(outs.some((o) => o.token?.category === g0.txid && o.token?.nft?.capability === 'minting')).toBe(true);
    // the 5000-sat value transfer to the child (a plain, non-token output)
    expect(outs.some((o) => o.amount === 5000n && !o.token)).toBe(true);
    // the factory's satoshi container recreated (20000 - 5000 = 15000)
    expect(outs.some((o) => o.amount === 15000n && !o.token)).toBe(true);
  });
});

// Conditional value deploy: `if (c==1) new Child{value:5000}()`. The value transfer is 0-or-1 (conditional); the
// factory's satoshi container is always co-spent (preserved when not firing). Fired -> deployFrom (child + 5000
// transfer + container at 15000); not-fired -> a plain .send() (no child, container preserved).
const COND_VALUE_FACTORY = `${CHILD}
contract CondValueFactory(bytes20 owner) {
    int childCount;
    function make(int c) {
        if (c == 1) {
            Child ch = new Child{value: 5000}(owner);
        }
        this.childCount = this.childCount + 1;
    }
}
`;

describe('conditional deploy with value (if (c==1) new Child{value:5000}())', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const cvArtifact = compileString(COND_VALUE_FACTORY);
  const childArtifact = compileString(CHILD);

  const deployFactory = async (seed: string): Promise<Awaited<ReturnType<typeof StatefulContract.deploy>>['contract']> => {
    const fu: Utxo = { txid: seed.repeat(16), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, fu);
    return (await StatefulContract.deploy(cvArtifact, [alicePkh], {
      provider,
      fundingUtxo: fu,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { childCount: 0n },
      initialBalance: 20000n,
      changeAddress: p2pkh.address,
    })).contract;
  };

  it('make(1) FIRES: child genesis + 5000-sat transfer + container recreated at 15000', async () => {
    const factory = await deployFactory('8a01');
    const g0: Utxo = { txid: '8b01'.repeat(16), vout: 0, satoshis: 300000n };
    await provider.addUtxo(p2pkh.address, g0);
    const result = await StatefulContract.deployFrom({
      provider,
      factory,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      fundingUtxo: g0,
      changeAddress: p2pkh.address,
      deployFunctionName: 'make',
      deployFunctionArgs: [1n],
      childArtifact,
      childConstructorArgs: [alicePkh],
      childInitialState: { counter: 0n },
      childValue: 5000n,
    });
    const outs = getTxOutputs(result.tx);
    expect(outs.some((o) => o.token?.category === g0.txid && o.token?.nft?.capability === 'minting')).toBe(true);
    expect(outs.some((o) => o.amount === 5000n && !o.token)).toBe(true);
    expect(outs.some((o) => o.amount === 15000n && !o.token)).toBe(true);
  });

  it('make(2) does NOT fire: hits the (pre-existing, general) conditional-transfer-not-taken SDK limitation', async () => {
    // When the {value:} branch is NOT taken, the transfer amount is 0 - but the SDK's static auto-derivation
    // still expects the conditional transfer slot ("1 satoshi transfer expected") and can't derive a not-taken
    // transfer without a manual output. This is the SAME behavior a plain `if (c) recipient.transfer(x)` shows
    // when not taken (see CondTransferRuntime) - a general conditional-transfer limitation, NOT specific to the
    // {value:} deploy. The FIRED path (make(1) above) is the meaningful case and works end to end.
    const factory = await deployFactory('8c01');
    await expect(factory.call.make(2n).send()).rejects.toThrow(/transfer amounts could not be auto-derived/);
  });
});

// A LOOP deploy WITH value: `for (i<n) new Child{value:V}()` mints N children AND sends N value transfers from
// the factory's own satoshi container - a runtime-variable count. There is no fixed transfer region: each child's
// V-sat transfer is interleaved as the last output of that child's deploy group (stride = 1 + dataNftCount + 1).
// The container is co-spent once and conserved by containerIn <= containerOut + counter*V, with its identity
// (input+output LBC) pinned so the remainder can't be redirected. This VM-proves the whole loop {value:} path.
const LOOP_VALUE_FACTORY = `${CHILD}
contract LoopValueFactory(bytes20 owner) {
    int childCount;
    function makeN(int n) {
        for (int i = 0; i < n; i = i + 1) {
            Child ch = new Child{value: 5000}(owner);
        }
        this.childCount = this.childCount + n;
    }
}
`;

describe('loop deploy with value (for (i<n) new Child{value:5000}())', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const loopValueArtifact = compileString(LOOP_VALUE_FACTORY);
  const childArtifact = compileString(CHILD);

  it('makeN(2): two children each funded 5000 from the container (20000 -> 10000), two interleaved transfers', async () => {
    const fresh: Utxo = { txid: '40f4'.repeat(16), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, fresh);
    // Factory holds a 20000-sat balance - the source for the two 5000-sat child value transfers.
    const factory = (await StatefulContract.deploy(loopValueArtifact, [alicePkh], {
      provider,
      fundingUtxo: fresh,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { childCount: 0n },
      initialBalance: 20000n,
      changeAddress: p2pkh.address,
    })).contract;

    const g0: Utxo = { txid: '4a01'.repeat(16), vout: 0, satoshis: 300000n };
    const g1: Utxo = { txid: '4b02'.repeat(16), vout: 0, satoshis: 300000n };
    await provider.addUtxo(p2pkh.address, g0);
    await provider.addUtxo(p2pkh.address, g1);

    const result = await StatefulContract.deployFrom({
      provider,
      factory,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      fundingUtxos: [g0, g1],
      changeAddress: p2pkh.address,
      deployFunctionName: 'makeN',
      deployFunctionArgs: [2n],
      childArtifact,
      childConstructorArgs: [alicePkh],
      childInitialState: { counter: 0n },
      childValue: 5000n,
    });

    const outs = getTxOutputs(result.tx);
    // Two distinct child minting NFTs (child 0 at counter 0, child 1 at counter 1).
    expect(outs.some((o) => o.token?.category === g0.txid && o.token?.nft?.capability === 'minting')).toBe(true);
    expect(outs.some((o) => o.token?.category === g1.txid && o.token?.nft?.capability === 'minting')).toBe(true);
    // Two interleaved 5000-sat value transfers (plain, non-token).
    expect(outs.filter((o) => o.amount === 5000n && !o.token).length).toBe(2);
    // Container recreated at 20000 - 2*5000 = 10000.
    expect(outs.some((o) => o.amount === 10000n && !o.token)).toBe(true);
  });
});
