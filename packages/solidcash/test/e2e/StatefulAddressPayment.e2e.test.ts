/**
 * B2 of the deployer-coins spec: a payment to a `new` result goes to the child's container (A8).
 *
 * Before this fix `this.transfer(child, v)` paid the child's master lock, whose pin requires the category on the
 * spending input: a coin paid there can never be spent. The first case checks the payment lands on the child's
 * satoshi container and that a later call of the child spends it. The second records where a `{value:}` call to
 * a stateful contract lands today; the plan does not change it, and the test states what it found.
 */
import { describe, expect, it } from 'vitest';
import { compileString, compileStringMulti } from '../direct-compile.js';
import { SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { alicePub, alicePriv, alicePkh } from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import { encodeLockingBytecodeP2pkh, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { getSatoshiContainerAddress } from '../../src/stateful/covenant-helpers.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { Contract } from '../../src/index.js';

const CHILD = `
contract Child {
    int x;
    constructor() { x = 1; }
    // A satoshi container slot: the child reads its own balance and can send from the container.
    function see(int minimum) { require(this.balance >= minimum); x = 2; }
}
`;

const FACTORY = `
contract Factory {
    int deployments;
    function make() {
        Child child = new Child();
        this.transfer(child, 5000);
        deployments = deployments + 1;
    }
}
`;

describe('a payment to a new result (B2.1)', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  it('the compiler routes a payment to a new result without an SDK build step (B2.2)', () => {
    // The SDK's deployFrom path for a routed payment is B9's work: the transaction that spends the deployer and
    // carries the transfer is rebuilt there. This asserts the compiler's half: the routed payment compiles and
    // the source's payment is no longer an error.
    const source = `${CHILD}\n${FACTORY}`;
    expect(() => compileStringMulti(source, { allowUnsafeOperations: true })).not.toThrow();
  });

  it('an SDK creation pays the child\'s satoshi container and the child spends it (B2.2)', async () => {
    const mock = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
    const source = `
contract Child {
    int x;
    constructor() { x = 1; }
    function spend(address to, int amount) { this.transfer(to, amount); x = 2; }
}
contract Factory {
    int deployments;
    function make() {
        Child child = new Child();
        this.transfer(child, 5000);
        deployments = deployments + 1;
    }
}`;
    const artifacts = compileStringMulti(source, { allowUnsafeOperations: true } as never);
    const factoryArtifact = artifacts.Factory;
    const childArtifact = artifacts.Child;
    expect(factoryArtifact.childDeployers?.Child).toBeDefined();

    const deploymentFunding: Utxo = { txid: 'a1'.repeat(32), vout: 0, satoshis: 200000n };
    await mock.seedUtxo(Buffer.from(authorLock).toString('hex'), deploymentFunding);
    const deployed = await StatefulContract.deploy(factoryArtifact, [], {
      provider: mock, fundingUtxo: deploymentFunding, funder,
      initialState: { deployments: 0n }, initialBalance: 10000n,
      changeAddress: change.address, senderLockingBytecode: authorLock,
    });

    const prepFunding: Utxo = { txid: 'a2'.repeat(32), vout: 0, satoshis: 200000n };
    await mock.seedUtxo(Buffer.from(authorLock).toString('hex'), prepFunding);
    const result = await StatefulContract.deployFrom({
      provider: mock, factory: deployed.contract, deployFunctionName: 'make',
      deployFunctionArgs: [], childArtifact, childConstructorArgs: [],
      fundingUtxo: prepFunding, funder, changeAddress: change.address,
    });

    // The routed payment is at the child's satoshi-container lock, not its master lock.
    const containerAddress = getSatoshiContainerAddress(
      (result.child as any).inner ?? (result.child as any), result.childCategoryId,
    );
    const paid = (await mock.getUtxos(containerAddress)).filter((u) => u.satoshis === 5000n);
    expect(paid).toHaveLength(1);

    // A later call of the child spends that coin: it is an input, and the send it authorizes is an output.
    const signer = await mock.getSigner(0);
    await mock.seedUtxo(signer.getAddress(), { txid: 'a3'.repeat(32), vout: 0, satoshis: 100000n });
    const child = new StatefulContract(result.childCategoryId, childArtifact, signer);
    const sent = await child.spend(alicePkh, 4000).send();
    expect(sent.inputs.some((input) => Buffer.from(input.outpointTransactionHash).toString('hex') === paid[0].txid
      && input.outpointIndex === paid[0].vout)).toBe(true);
    const recipientLock = encodeLockingBytecodeP2pkh(alicePkh);
    expect(sent.outputs.some((output) => output.valueSatoshis === 4000n
      && Buffer.from(output.lockingBytecode).equals(Buffer.from(recipientLock)))).toBe(true);
    expect(((await child.getState()) as { x?: bigint }).x).toBe(2n);
  });

  it('a routed payment funds a child with a selfdestruct entry and the destroy reclaims it (B2.2)', async () => {
    const mock = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
    const artifacts = compileStringMulti(`
contract Child {
    int x;
    constructor() { x = 1; }
    function bye() selfdestruct { }
}
contract Factory {
    int d;
    function make() { Child c = new Child(); this.transfer(c, 5000); d = 1; }
}`, { allowUnsafeOperations: true } as never);
    const deploymentFunding: Utxo = { txid: 'b1'.repeat(32), vout: 0, satoshis: 200000n };
    await mock.seedUtxo(Buffer.from(authorLock).toString('hex'), deploymentFunding);
    const deployed = await StatefulContract.deploy(artifacts.Factory, [], {
      provider: mock, fundingUtxo: deploymentFunding, funder,
      initialState: { d: 0n }, initialBalance: 10000n,
      changeAddress: change.address, senderLockingBytecode: authorLock,
    });
    const prepFunding: Utxo = { txid: 'b2'.repeat(32), vout: 0, satoshis: 200000n };
    await mock.seedUtxo(Buffer.from(authorLock).toString('hex'), prepFunding);
    const result = await StatefulContract.deployFrom({
      provider: mock, factory: deployed.contract, deployFunctionName: 'make',
      deployFunctionArgs: [], childArtifact: artifacts.Child, childConstructorArgs: [],
      fundingUtxo: prepFunding, funder, changeAddress: change.address,
    });
    const containerAddress = getSatoshiContainerAddress(
      (result.child as any).inner ?? (result.child as any), result.childCategoryId,
    );
    expect((await mock.getUtxos(containerAddress)).filter((u) => u.satoshis === 5000n)).toHaveLength(1);

    const signer = await mock.getSigner(0);
    await mock.seedUtxo(signer.getAddress(), { txid: 'b3'.repeat(32), vout: 0, satoshis: 100000n });
    const child = new StatefulContract(result.childCategoryId, artifacts.Child, signer);
    const destroyed = await StatefulContract.destroy({
      provider: mock, contract: child,
      destroyFunctionName: 'bye', destroyFunctionArgs: [],
      recipient: change.address, fee: 2000n,
    });
    // The routed 5,000 satoshis come back out of the container, and nothing is left at its lock.
    expect(destroyed.totalReclaimed).toBeGreaterThanOrEqual(5000n);
    expect(await mock.getUtxos(containerAddress)).toHaveLength(0);
  });

  it('a call with {value: v} pins its transfer at the address operand (B2.1, D1)', () => {
    // D1's finding stands for a value-carrying call: its transfer is pinned at the address as given, which for a
    // stateful callee is the master lock (stuck), never a container lock. The routed new-result payment above is
    // the contrasting case: that one derives the container lock, and this one publishes no routing recipe.
    const artifact = compileString(`
interface ICallee { function poke() external; }
contract Caller {
    int d;
    function sendTo(address target) { ICallee(target).poke{value: 1000}(); d = 1; }
}`, { allowUnsafeOperations: true, messageBus: false } as never);
    const fn = artifact.abi.find((entry) => entry.name === 'sendTo')!;
    // The value transfer and the call's own transfer carrier both occupy a transfer slot; the satoshi container is
    // the source, and neither transfer names a container destination.
    expect(fn.transferCount).toBe(2);
    expect(fn.blockLayout?.slots.filter((slot) => slot.kind === 'transfer')).toHaveLength(2);
    expect(fn.blockLayout?.slots.some((slot) => slot.kind === 'satoshiContainer')).toBe(true);
    expect(fn.transfers ?? []).toHaveLength(0);
  });

  it('a payment to a stateful contract value that is not a new result is refused (B2.3)', () => {
    const source = `
contract Child { int x; constructor() { x = 1; } function poke() { x = x + 1; } }
contract Parent() {
    int n;
    function pay(Child c) { this.transfer(c, 5000); n = n + 1; }
}
`;
    expect(() => compileString(source, { allowUnsafeOperations: true }))
      .toThrow(/master lock/);
  });
});
