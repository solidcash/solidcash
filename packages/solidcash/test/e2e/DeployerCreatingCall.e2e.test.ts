/**
 * B9.5: a creating call through Deploy<C>.
 *
 * The factory's `createChild` binds the child's deployer at its `deploy` slot. `deployFrom` builds and broadcasts
 * the prep, then spends the prep's deployer coin with the child's `create` unlocking and the author coin beside
 * it, so the child is born inside the factory's call.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransaction, encodeLockingBytecodeP2pkh, hash256, hexToBin, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { DeployerLocktimeConflictError } from '../../src/stateful/deployer.js';
import { compileStringMulti } from '../direct-compile.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';

const FACTORY = `
contract Child(bytes20 owner) {
    int counter;
    function increment() { require(owner != bytes20(0)); this.counter = this.counter + 1; }
}
contract Factory() {
    int childCount;
    function createChild(bytes20 owner, int fundingInputIndex) {
        new Child(owner);
        require(tx.inputs[fundingInputIndex].outpointTransactionHash != 0x0000000000000000000000000000000000000000000000000000000000000000);
        this.childCount = this.childCount + 1;
    }
}
`;

describe('B9.5: a creating call through Deploy<C>', () => {
  it('deploys a child inside the factory call under the production VM', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
    const artifacts = compileStringMulti(FACTORY, { allowUnsafeOperations: true, __deployerNew: true } as never);
    const factoryArtifact = artifacts.Factory;
    const childArtifact = artifacts.Child;
    expect(factoryArtifact.childDeployers?.Child).toBeDefined();

    const deploymentFunding: Utxo = { txid: 'd1'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), deploymentFunding);
    const deployed = await StatefulContract.deploy(factoryArtifact, [], {
      provider,
      fundingUtxo: deploymentFunding,
      funder,
      initialState: { childCount: 0n }, initialBalance: 5000n,
      changeAddress: change.address,
      senderLockingBytecode: authorLock,
    });

    const prepFunding: Utxo = { txid: 'd2'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), prepFunding);
    const createChild = factoryArtifact.abi.find((fn) => fn.name === 'createChild')!;
    const requiredNftCount = createChild.requiredNftIndices?.length ?? factoryArtifact.stateLayout!.dataNftCount;
    const fundingInputIndex = 1 + requiredNftCount;

    const result = await StatefulContract.deployFrom({
      provider,
      factory: deployed.contract,
      deployFunctionName: 'createChild',
      deployFunctionArgs: [alicePkh, BigInt(fundingInputIndex)],
      childArtifact,
      childConstructorArgs: [alicePkh],
      childInitialState: { counter: 0n },
      fundingUtxo: prepFunding,
      funder,
      changeAddress: change.address,
    });

    expect(result.prepTransactions).toHaveLength(1);
    expect(result.childCategoryId).not.toBe(prepFunding.txid);
    expect(result.child.categoryId).toBe(result.childCategoryId);
    const state = await result.child.getState();
    expect((state as { counter?: bigint }).counter).toBe(0n);
    const factoryState = await result.factory.getState();
    expect((factoryState as { childCount?: bigint }).childCount).toBe(1n);
  });

  it('creates two children from a loop', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
    const artifacts = compileStringMulti(`
      contract Child(bytes20 owner) { int counter; }
      contract LoopFactory { int childCount;
        function makeTwo(bytes20 owner) {
          for (int i = 0; i < 2; i = i + 1) { new Child(owner); }
          childCount = childCount + 2;
        }
      }`, { allowUnsafeOperations: true, __deployerNew: true } as never);
    const factoryArtifact = artifacts.LoopFactory;
    const childArtifact = artifacts.Child;
    expect(factoryArtifact.childDeployers?.Child).toBeDefined();

    const deploymentFunding: Utxo = { txid: 'e1'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), deploymentFunding);
    const deployed = await StatefulContract.deploy(factoryArtifact, [], {
      provider, fundingUtxo: deploymentFunding, funder,
      initialState: { childCount: 0n }, changeAddress: change.address, senderLockingBytecode: authorLock,
    });

    const prepOne: Utxo = { txid: 'e2'.repeat(32), vout: 0, satoshis: 100000n };
    const prepTwo: Utxo = { txid: 'e3'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), prepOne);
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), prepTwo);

    const result = await StatefulContract.deployFrom({
      provider, factory: deployed.contract, deployFunctionName: 'makeTwo',
      deployFunctionArgs: [alicePkh], childArtifact, childConstructorArgs: [alicePkh],
      fundingUtxos: [prepOne, prepTwo], deployments: 2,
      funder, changeAddress: change.address,
    });
    expect(result.prepTransactions).toHaveLength(2);
    expect(result.children).toHaveLength(2);
    expect(result.childCategoryIds).toEqual(result.children!.map((child) => child.categoryId));
    const state = await result.factory.getState();
    expect((state as { childCount?: bigint }).childCount).toBe(2n);
  });

  it('creates a child that is stateful only because it creates a stateful child (B10)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
    const artifacts = compileStringMulti(`
      contract G { int n; function bump() { n = n + 1; } }
      contract Mid { function mk() { G g = new G(); } }
      contract MidFactory { int childCount;
        function make() { Mid m = new Mid(); childCount = childCount + 1; }
      }`, { allowUnsafeOperations: true } as never);
    expect(artifacts.MidFactory.childDeployers?.Mid).toBeDefined();
    expect(artifacts.Mid.stateLayout?.dataNftCount).toBe(0);

    const deploymentFunding: Utxo = { txid: 'b1'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), deploymentFunding);
    const deployed = await StatefulContract.deploy(artifacts.MidFactory, [], {
      provider, fundingUtxo: deploymentFunding, funder,
      initialState: { childCount: 0n }, changeAddress: change.address, senderLockingBytecode: authorLock,
    });
    const prepFunding: Utxo = { txid: 'b2'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), prepFunding);
    const result = await StatefulContract.deployFrom({
      provider, factory: deployed.contract, deployFunctionName: 'make',
      deployFunctionArgs: [], childArtifact: artifacts.Mid, childConstructorArgs: [],
      fundingUtxo: prepFunding, funder, changeAddress: change.address,
    });
    // Mid's master exists on chain under its own category: something was created.
    const minted = await provider.getUtxosByTokenCategory(result.childCategoryId);
    expect(minted.some((utxo) => utxo.token?.nft?.capability === 'minting')).toBe(true);
    expect(((await result.factory.getState()) as { childCount?: bigint }).childCount).toBe(1n);
  });

  it('pins a child whose constructor writes state', async () => {
    // The child's `create` pins the record its own constructor writes (n = 7). A commitment derived from the
    // factory's probe alone would leave n at its zero default, and the child's genesis covenant refuses.
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
    const artifacts = compileStringMulti(`
      contract Child { int n; constructor() { n = 7; } }
      contract StateFactory { int childCount;
        function make() { new Child(); childCount = childCount + 1; }
      }`, { allowUnsafeOperations: true, __deployerNew: true } as never);
    const factoryArtifact = artifacts.StateFactory;
    const childArtifact = artifacts.Child;
    expect(factoryArtifact.childDeployers?.Child).toBeDefined();

    const deploymentFunding: Utxo = { txid: 'f1'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), deploymentFunding);
    const deployed = await StatefulContract.deploy(factoryArtifact, [], {
      provider, fundingUtxo: deploymentFunding, funder,
      initialState: { childCount: 0n }, changeAddress: change.address, senderLockingBytecode: authorLock,
    });

    const prepFunding: Utxo = { txid: 'f2'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), prepFunding);

    const result = await StatefulContract.deployFrom({
      provider, factory: deployed.contract, deployFunctionName: 'make',
      deployFunctionArgs: [], childArtifact, childConstructorArgs: [],
      fundingUtxo: prepFunding, funder, changeAddress: change.address,
    });

    expect(result.prepTransactions).toHaveLength(1);
    const state = await result.child.getState();
    expect((state as { n?: bigint }).n).toBe(7n);
    const factoryState = await result.factory.getState();
    expect((factoryState as { childCount?: bigint }).childCount).toBe(1n);
  });

  it('refuses a deployments count that disagrees with the funding coins', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
    const artifacts = compileStringMulti(`
      contract Child { int n; }
      contract CountFactory { int made;
        function make() { new Child(); made = made + 1; }
      }`, { allowUnsafeOperations: true } as never);
    const deploymentFunding: Utxo = { txid: 'd1'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), deploymentFunding);
    const deployed = await StatefulContract.deploy(artifacts.CountFactory, [], {
      provider, fundingUtxo: deploymentFunding, funder,
      initialState: { made: 0n }, changeAddress: change.address, senderLockingBytecode: authorLock,
    });
    const prepFunding: Utxo = { txid: 'd2'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), prepFunding);
    await expect(StatefulContract.deployFrom({
      provider, factory: deployed.contract, deployFunctionName: 'make',
      deployFunctionArgs: [], childArtifact: artifacts.Child, childConstructorArgs: [],
      fundingUtxo: prepFunding, funder, changeAddress: change.address, deployments: 2,
    })).rejects.toThrow(/creates 1 child, but deployments is 2/);
  });

  it('refuses a value for a deployer child the source creates with none', async () => {
    // The creator's `new Child()` binds a value of 0 in Q; a value the source does not send would only fail the
    // creator's own run, so the SDK refuses it before building (B8.8).
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
    const artifacts = compileStringMulti(`
      contract Child { int n; constructor() payable { n = 5; } }
      contract ValueFactory { int childCount;
        function make() { new Child(); childCount = childCount + 1; }
      }`, { allowUnsafeOperations: true, __deployerNew: true } as never);
    const deploymentFunding: Utxo = { txid: 'f7'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), deploymentFunding);
    const deployed = await StatefulContract.deploy(artifacts.ValueFactory, [], {
      provider, fundingUtxo: deploymentFunding, funder,
      initialState: { childCount: 0n }, changeAddress: change.address, senderLockingBytecode: authorLock,
    });
    const prepFunding: Utxo = { txid: 'f8'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), prepFunding);
    await expect(StatefulContract.deployFrom({
      provider, factory: deployed.contract, deployFunctionName: 'make',
      deployFunctionArgs: [], childArtifact: artifacts.Child, childConstructorArgs: [],
      fundingUtxo: prepFunding, funder, changeAddress: change.address, childValue: 1200n,
    })).rejects.toThrow(/'make' creates 'Child' with no value, but childValue is 1200/);
  });

  it('creates a payable child with no value, with a filler at its empty satoshi row (A14 item 11)', async () => {
    // A payable child's optional satoshi row holds at least the journal's final balance. With no value that is 0,
    // so no container is required there and the SDK puts the plain filler output at the row's index.
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
    const artifacts = compileStringMulti(`
      contract Child { int n; constructor() payable { n = 7; } }
      contract PayFactory { int childCount;
        function make() { new Child(); childCount = childCount + 1; }
      }`, { allowUnsafeOperations: true, __deployerNew: true } as never);
    const factoryArtifact = artifacts.PayFactory;
    const childArtifact = artifacts.Child;

    const deploymentFunding: Utxo = { txid: 'f3'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), deploymentFunding);
    const deployed = await StatefulContract.deploy(factoryArtifact, [], {
      provider, fundingUtxo: deploymentFunding, funder,
      initialState: { childCount: 0n }, changeAddress: change.address, senderLockingBytecode: authorLock,
    });
    const prepFunding: Utxo = { txid: 'f4'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), prepFunding);

    // An exact fee: the filler's satoshis come from the funding inputs, not from the fee.
    const before = await provider.takeSnapshot();
    const result = await StatefulContract.deployFrom({
      provider, factory: deployed.contract, deployFunctionName: 'make',
      deployFunctionArgs: [], childArtifact, childConstructorArgs: [],
      fundingUtxo: prepFunding, funder, changeAddress: change.address, fee: 20_000n,
    });
    expect(((await result.child.getState()) as { n?: bigint }).n).toBe(7n);
    expect(result.tx.outputs.some((output) => binToHex(output.lockingBytecode) === '51'
      && output.valueSatoshis === 1000n && output.token === undefined)).toBe(true);

    // The inputs' values: a prep output from its transaction, any other coin from the ledger before the call.
    const prepOutputs = new Map<string, bigint>();
    for (const hex of result.prepTransactions ?? []) {
      const prep = decodeTransaction(hexToBin(hex));
      if (typeof prep === 'string') throw new Error(prep);
      const txid = binToHex(hash256(hexToBin(hex)).slice().reverse());
      prep.outputs.forEach((output, vout) => prepOutputs.set(`${txid}:${vout}`, output.valueSatoshis));
    }
    await before.restore();
    let inputTotal = 0n;
    for (const input of result.tx.inputs) {
      const txid = binToHex(input.outpointTransactionHash);
      const key = `${txid}:${input.outpointIndex}`;
      const value = prepOutputs.get(key) ?? (await provider.getLedgerOutput(txid, input.outpointIndex))?.satoshis;
      if (value === undefined) throw new Error(`no source output for ${key}`);
      inputTotal += value;
    }
    const outputTotal = result.tx.outputs.reduce((sum, output) => sum + output.valueSatoshis, 0n);
    expect(inputTotal - outputTotal).toBe(20_000n);
  });


  it('creates one child from a branch', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
    const artifacts = compileStringMulti(`
      contract Child(bytes20 owner) { int counter; }
      contract BranchFactory { int childCount;
        function makeOne(bool take, bytes20 owner) {
          if (take) { new Child(owner); childCount = childCount + 1; }
        }
      }`, { allowUnsafeOperations: true, __deployerNew: true } as never);
    const factoryArtifact = artifacts.BranchFactory;
    const childArtifact = artifacts.Child;

    const deploymentFunding: Utxo = { txid: 'f5'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), deploymentFunding);
    const deployed = await StatefulContract.deploy(factoryArtifact, [], {
      provider, fundingUtxo: deploymentFunding, funder,
      initialState: { childCount: 0n }, changeAddress: change.address, senderLockingBytecode: authorLock,
    });
    const prepFunding: Utxo = { txid: 'f6'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), prepFunding);

    const result = await StatefulContract.deployFrom({
      provider, factory: deployed.contract, deployFunctionName: 'makeOne',
      deployFunctionArgs: [true, alicePkh], childArtifact, childConstructorArgs: [alicePkh],
      fundingUtxo: prepFunding, deployments: 1, funder, changeAddress: change.address,
    });
    expect(result.children).toHaveLength(1);
    expect((await result.factory.getState() as { childCount?: bigint }).childCount).toBe(1n);
  });


  it('creates a child that creates a child (F then C then G)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
    const artifacts = compileStringMulti(`
      contract G { int n; }
      contract C { int childCount;
        function make() { new G(); childCount = childCount + 1; }
      }
      contract F { int childCount;
        function makeC() { new C(); childCount = childCount + 1; }
      }`, { allowUnsafeOperations: true, __deployerNew: true } as never);

    const deploymentFunding: Utxo = { txid: 'a7'.repeat(32), vout: 0, satoshis: 200000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), deploymentFunding);
    const f = await StatefulContract.deploy(artifacts.F, [], {
      provider, fundingUtxo: deploymentFunding, funder,
      initialState: { childCount: 0n }, changeAddress: change.address, senderLockingBytecode: authorLock,
    });

    const cFunding: Utxo = { txid: 'a8'.repeat(32), vout: 0, satoshis: 200000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), cFunding);
    const c = await StatefulContract.deployFrom({
      provider, factory: f.contract, deployFunctionName: 'makeC',
      deployFunctionArgs: [], childArtifact: artifacts.C, childConstructorArgs: [],
      childInitialState: { childCount: 0n }, fundingUtxo: cFunding,
      funder, changeAddress: change.address,
    });
    expect(c.child.categoryId).toBe(c.childCategoryId);

    const gFunding: Utxo = { txid: 'a9'.repeat(32), vout: 0, satoshis: 200000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), gFunding);
    const g = await StatefulContract.deployFrom({
      provider, factory: c.child, deployFunctionName: 'make',
      deployFunctionArgs: [], childArtifact: artifacts.G, childConstructorArgs: [],
      childInitialState: { n: 0n }, fundingUtxo: gFunding,
      funder, changeAddress: change.address,
    });
    expect(g.child.categoryId).toBe(g.childCategoryId);
    expect((await c.child.getState() as { childCount?: bigint }).childCount).toBe(1n);
  });


  it('creates two children of different contracts from two new sites', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
    const artifacts = compileStringMulti(`
      contract A { int x; }
      contract B { int y; }
      contract F { int childCount;
        function makeBoth() { new A(); new B(); childCount = childCount + 2; }
      }`, { allowUnsafeOperations: true, __deployerNew: true } as never);
    const deploymentFunding: Utxo = { txid: 'aa'.repeat(32), vout: 0, satoshis: 200000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), deploymentFunding);
    const f = await StatefulContract.deploy(artifacts.F, [], {
      provider, fundingUtxo: deploymentFunding, funder,
      initialState: { childCount: 0n }, changeAddress: change.address, senderLockingBytecode: authorLock,
    });
    const fundingA: Utxo = { txid: 'ab'.repeat(32), vout: 0, satoshis: 200000n };
    const fundingB: Utxo = { txid: 'ac'.repeat(32), vout: 0, satoshis: 200000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingA);
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingB);
    const result = await StatefulContract.deployFrom({
      provider, factory: f.contract, deployFunctionName: 'makeBoth',
      deployFunctionArgs: [], childArtifact: artifacts.A,
      childArtifacts: { A: artifacts.A, B: artifacts.B },
      childConstructorArgs: [], fundingUtxos: [fundingA, fundingB], deployments: 2,
      funder, changeAddress: change.address,
    });
    expect(result.children).toHaveLength(2);
  });

  it('refuses a height tx.time beside a timestamp child (A5)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
    const artifacts = compileStringMulti(`
      contract Child { int born; constructor() { born = int(block.timestamp); } }
      contract Factory { int childCount;
        function make(int notBefore) {
          require(tx.time >= notBefore);
          new Child();
          childCount = childCount + 1;
        }
      }`, { allowUnsafeOperations: true, __deployerNew: true } as never);
    const deploymentFunding: Utxo = { txid: 'af'.repeat(32), vout: 0, satoshis: 200000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), deploymentFunding);
    const f = await StatefulContract.deploy(artifacts.Factory, [], {
      provider, fundingUtxo: deploymentFunding, funder,
      initialState: { childCount: 0n }, changeAddress: change.address, senderLockingBytecode: authorLock,
    });
    const prep: Utxo = { txid: 'b0'.repeat(32), vout: 0, satoshis: 200000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), prep);
    let caught: unknown;
    try {
      await StatefulContract.deployFrom({
        provider, factory: f.contract, deployFunctionName: 'make',
        deployFunctionArgs: [800_000n], childArtifact: artifacts.Child,
        childConstructorArgs: [], childInitialState: { born: 0n },
        childOraclePool: 'bb'.repeat(32),
        fundingUtxo: prep, funder, changeAddress: change.address,
      });
    } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(DeployerLocktimeConflictError);
  });








  it('meets a creator\'s tx.time check and a child\'s block.timestamp with one locktime (A5)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
    const artifacts = compileStringMulti(`
      contract Child { int born; constructor() { born = int(block.timestamp); } }
      contract Factory { int childCount;
        function make(int notBefore) { require(tx.time >= notBefore); new Child(); childCount = childCount + 1; } }`,
      { allowUnsafeOperations: true, __deployerNew: true } as never);
    const deploymentFunding: Utxo = { txid: 'ad'.repeat(32), vout: 0, satoshis: 200000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), deploymentFunding);
    const f = await StatefulContract.deploy(artifacts.Factory, [], {
      provider, fundingUtxo: deploymentFunding, funder, initialState: { childCount: 0n },
      changeAddress: change.address, senderLockingBytecode: authorLock,
    });
    const prep: Utxo = { txid: 'ae'.repeat(32), vout: 0, satoshis: 200000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), prep);
    const mtp = await provider.getMedianTimePast();
    const result = await StatefulContract.deployFrom({
      provider, factory: f.contract, deployFunctionName: 'make', deployFunctionArgs: [500_000_001n],
      childArtifact: artifacts.Child, childConstructorArgs: [], childInitialState: { born: 0n },
      childOraclePool: 'bb'.repeat(32), fundingUtxo: prep, funder, changeAddress: change.address,
    });
    const locktime = (result as unknown as { tx?: { locktime?: number } }).tx?.locktime;
    // A5, A14 item 7: the lowest value that satisfies every input, here the creator's bound (a time).
    expect(locktime).toBe(500_000_001);
    expect(mtp - 1).toBeGreaterThan(500_000_001);
    expect((await result.child.getState() as { born?: bigint }).born).toBe(BigInt(locktime!));
  });

});
