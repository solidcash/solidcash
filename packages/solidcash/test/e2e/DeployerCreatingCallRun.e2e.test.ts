/**
 * A14 item 4: a creating call's children are the ones its creator's run makes.
 *
 * The SDK reads, at every deployer `new` site the creator's run reaches, Q ‖ A as the creator built it: the child's
 * value and constructor arguments, then its contract arguments, computed by the creator's own code. It derives which
 * children the call makes, of which contracts and in which order from the same run, and a runtime loop's payments from
 * the checks that pin them. None of these calls says how many children it makes, or passes their arguments.
 *
 * Each creation is checked with stock libauth's standard VM, honest and tampered: a child argument changed after
 * derivation, a payment moved, or a branch claimed without its child, is refused by the creator's own input.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, createVirtualMachineBch2026, decodeAuthenticationInstructions, decodeTransaction,
  encodeAuthenticationInstructions, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { getSatoshiContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { decodeDeployBinding, encodeDeployBinding, DeployerPrepError } from '../../src/stateful/deployer.js';
import { clearGenesisReservations } from '../../src/stateful/genesis-reservations.js';
import { solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { compileStringMulti } from '../direct-compile.js';
import { alicePkh, alicePriv, bobPkh } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';

const vm = createVirtualMachineBch2026(true);
const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
const alice = new SignatureTemplate(alicePriv);

type Spend = { transaction: any; sourceOutputs: any[] };

/** Records every broadcast with the coins it spends, read from the ledger while they are still live. */
function captureBroadcasts(provider: MockNetworkProvider): Spend[] {
  const captured: Spend[] = [];
  const inner = provider.sendRawTransaction.bind(provider);
  provider.sendRawTransaction = async (hex: string) => {
    const transaction = decodeTransaction(hexToBin(hex));
    if (typeof transaction === 'string') throw new Error(transaction);
    const sourceOutputs = await Promise.all(transaction.inputs.map(async (input) => {
      const spent = await provider.getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex);
      if (spent === undefined) throw new Error('a spent coin is not on the ledger');
      return solidCashOutputToLibauthOutput({
        to: spent.lockingBytecode, amount: spent.satoshis, ...(spent.token === undefined ? {} : { token: spent.token }),
      });
    }));
    const txid = await inner(hex);
    captured.push({ transaction, sourceOutputs });
    return txid;
  };
  return captured;
}

/** Signs the wallet's P2PKH inputs again, as a builder signs its own transaction, and asks the standard VM. */
function verify(spend: Spend): true | string {
  const copy: Spend = structuredClone(spend);
  copy.transaction.inputs.forEach((_input: unknown, inputIndex: number) => {
    if (binToHex(copy.sourceOutputs[inputIndex].lockingBytecode) !== binToHex(aliceLock)) return;
    copy.transaction.inputs[inputIndex].unlockingBytecode = alice.unlockP2PKH().generateUnlockingBytecode({
      transaction: copy.transaction, sourceOutputs: copy.sourceOutputs, inputIndex,
    });
  });
  return vm.verify(copy as never) as true | string;
}

/** True when the creator's input, input 0, passes on its own. */
function creatorPasses(spend: Spend): boolean {
  return vm.stateSuccess(vm.evaluate({ ...structuredClone(spend), inputIndex: 0 } as never)) === true;
}

/** The inputs a creation spends at a deployer, in input order. */
function deployerInputs(spend: Spend, factory: Artifact): number[] {
  const locks = new Set(Object.values(factory.childDeployers ?? {}).map((deployer) => deployer.lockingBytecode));
  return spend.sourceOutputs.map((output, index) => [binToHex(output.lockingBytecode), index] as const)
    .filter(([lock]) => locks.has(lock)).map(([, index]) => index);
}

/**
 * The same creation with one child's contract argument replaced in its deployer input. The unlocking is the selector
 * push, the callee list push, then Q ‖ A: one push for the sender category, one for the value, one per argument (A4.2).
 */
function withChildArgument(
  spend: Spend, input: number, deployer: NonNullable<Artifact['childDeployers']>[string], constructorCount: number,
  argument: number, value: unknown,
): Spend {
  const copy: Spend = structuredClone(spend);
  const instructions = decodeAuthenticationInstructions(copy.transaction.inputs[input].unlockingBytecode);
  const visible = deployer.abi.find((entry) => entry.name === 'create')!.inputs
    .filter((entry) => !entry.name.startsWith('__internal__'));
  const end = 2 + 2 + visible.length;
  const binding = decodeDeployBinding(
    encodeAuthenticationInstructions(instructions.slice(2, end)), deployer, constructorCount,
  );
  const contractArgs = [...binding.contractArgs];
  contractArgs[argument] = value as never;
  copy.transaction.inputs[input].unlockingBytecode = Uint8Array.from([
    ...encodeAuthenticationInstructions(instructions.slice(0, 2)),
    ...encodeDeployBinding({ ...binding, contractArgs }, deployer, constructorCount),
    ...encodeAuthenticationInstructions(instructions.slice(end)),
  ]);
  return copy;
}

async function setup(source: string, factoryName: string, options: { initialBalance?: bigint; preps?: number } = {}) {
  clearGenesisReservations();
  const provider = new MockNetworkProvider({ profile: 'production' });
  const captured = captureBroadcasts(provider);
  const change = lockingBytecodeToCashAddress({ bytecode: aliceLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const funder = alice.unlockP2PKH();
  const artifacts = compileStringMulti(source, { allowUnsafeOperations: true } as never);
  const deploymentFunding: Utxo = { txid: 'c1'.repeat(32), vout: 0, satoshis: 200_000n };
  await provider.seedUtxo(binToHex(aliceLock), deploymentFunding);
  const deployed = await StatefulContract.deploy(artifacts[factoryName], [], {
    provider, fundingUtxo: deploymentFunding, funder, initialState: { made: 0n },
    ...(options.initialBalance === undefined ? {} : { initialBalance: options.initialBalance }),
    changeAddress: change.address, senderLockingBytecode: aliceLock,
  } as never);
  const prepFunding: Utxo = { txid: 'c2'.repeat(32), vout: 0, satoshis: 300_000n };
  await provider.seedUtxo(binToHex(aliceLock), prepFunding);
  return { provider, captured, funder, change: change.address, artifacts, deployed, prepFunding };
}

const CHILD = `
contract Child(int x) {
    int n;
    constructor(int y) { n = x + y; }
    function bump() { this.n = this.n + 1; }
}`;

describe('A14 item 4: a creating call reads its children from the creator\'s run', () => {
  it('derives computed child arguments, and refuses a childConstructorArgs that differs from them', async () => {
    const { provider, captured, funder, change, artifacts, deployed, prepFunding } = await setup(`${CHILD}
      contract Factory { int made;
        function make(int a, int b) { new Child{args: (a * 200)}(b + 300); this.made = this.made + 1; }
      }`, 'Factory');
    const call = (extra: Record<string, unknown>) => StatefulContract.deployFrom({
      provider, factory: deployed.contract, deployFunctionName: 'make', deployFunctionArgs: [3n, 4n],
      childArtifact: artifacts.Child, fundingUtxo: prepFunding, funder, changeAddress: change, ...extra,
    } as never);

    // An override must be what the run binds: y is 304, not 5. Nothing is broadcast.
    const before = captured.length;
    await expect(call({ childConstructorArgs: [5n] })).rejects.toThrow(DeployerPrepError);
    await expect(call({ childConstructorArgs: [5n] })).rejects.toThrow(/childConstructorArgs differs/);
    expect(captured.length).toBe(before);

    const result = await call({});
    expect(result.children).toHaveLength(1);
    // x = 3 * 200 and y = 4 + 300, both computed by the factory: n = x + y.
    expect((await result.child.getState() as { n?: bigint }).n).toBe(904n);
    expect(((await result.factory.getState()) as { made?: bigint }).made).toBe(1n);

    const creation = captured[captured.length - 1];
    expect(verify(creation)).toBe(true);
    const [input] = deployerInputs(creation, artifacts.Factory);
    const deployer = artifacts.Factory.childDeployers!.Child;
    // The child's contract argument changed after derivation: the factory's own input refuses it.
    const forged = withChildArgument(creation, input!, deployer, 1, 0, 601n);
    expect(creatorPasses(creation)).toBe(true);
    expect(creatorPasses(forged)).toBe(false);
    expect(verify(forged)).not.toBe(true);

    // The override that agrees with the run is accepted.
    const prepAgain: Utxo = { txid: 'c3'.repeat(32), vout: 0, satoshis: 300_000n };
    await provider.seedUtxo(binToHex(aliceLock), prepAgain);
    const agreeing = await call({ childConstructorArgs: [304n], fundingUtxo: prepAgain });
    expect((await agreeing.child.getState() as { n?: bigint }).n).toBe(904n);
  }, 600_000);

  it('creates the child of a branch that runs, and none for one that does not', async () => {
    const { provider, captured, funder, change, artifacts, deployed, prepFunding } = await setup(`${CHILD}
      contract Factory { int made;
        function make(bool take, int a) {
          if (take) { new Child{args: (a + 1000)}(a); }
          this.made = this.made + 1;
        }
      }`, 'Factory');
    const call = (take: boolean, fundingUtxo: Utxo) => StatefulContract.deployFrom({
      provider, factory: deployed.contract, deployFunctionName: 'make', deployFunctionArgs: [take, 7n],
      childArtifact: artifacts.Child, fundingUtxo, funder, changeAddress: change,
    });

    const taken = await call(true, prepFunding);
    expect(taken.children).toHaveLength(1);
    expect((await taken.child.getState() as { n?: bigint }).n).toBe(1014n);
    const takenCreation = captured[captured.length - 1];
    expect(verify(takenCreation)).toBe(true);
    const [input] = deployerInputs(takenCreation, artifacts.Factory);
    const forged = withChildArgument(takenCreation, input!, artifacts.Factory.childDeployers!.Child, 1, 0, 1008n);
    expect(creatorPasses(forged)).toBe(false);

    const prepAgain: Utxo = { txid: 'c4'.repeat(32), vout: 0, satoshis: 300_000n };
    await provider.seedUtxo(binToHex(aliceLock), prepAgain);
    const sent = captured.length;
    const skipped = await call(false, prepAgain);
    expect(skipped.children).toHaveLength(0);
    expect(skipped.childCategoryIds).toEqual([]);
    expect(skipped.prepTransactions).toEqual([]);
    expect(((await skipped.factory.getState()) as { made?: bigint }).made).toBe(2n);
    // One transaction, the creation: no prep, no deployer coin, no minting NFT but the factory's.
    expect(captured.length).toBe(sent + 1);
    const skippedCreation = captured[captured.length - 1];
    expect(verify(skippedCreation)).toBe(true);
    expect(deployerInputs(skippedCreation, artifacts.Factory)).toEqual([]);
    expect(skippedCreation.transaction.outputs.filter((output: any) => output.token?.nft?.capability === 'minting'))
      .toHaveLength(1);
    // The same creation whose factory input claims the branch ran: the site finds no deployer coin and refuses.
    const claimed: Spend = structuredClone(skippedCreation);
    const unlocker = (deployed.contract as any).inner.unlock.make(true, 7n);
    claimed.transaction.inputs[0].unlockingBytecode = unlocker.generateUnlockingBytecode({
      transaction: claimed.transaction, sourceOutputs: claimed.sourceOutputs, inputIndex: 0,
    });
    expect(creatorPasses(skippedCreation)).toBe(true);
    expect(creatorPasses(claimed)).toBe(false);
  }, 600_000);

  it('creates two children of two contracts in run order', async () => {
    const { provider, captured, funder, change, artifacts, deployed, prepFunding } = await setup(`
      contract Counter(int x) { int n; constructor() { n = x; } function bump() { this.n = this.n + 1; } }
      contract Holder(bytes20 o) {
        bytes20 owner; int since;
        constructor(int t) { owner = o; since = t; }
        function touch() { this.since = this.since + 1; }
      }
      contract Factory { int made;
        function make(int a, bytes20 o) {
          new Counter{args: (a * 3)}();
          new Holder{args: (o)}(a + 5);
          this.made = this.made + 2;
        }
      }`, 'Factory');
    const deployers = artifacts.Factory.childDeployers!;
    expect(deployers.Counter!.lockingBytecode).not.toBe(deployers.Holder!.lockingBytecode);
    const result = await StatefulContract.deployFrom({
      provider, factory: deployed.contract, deployFunctionName: 'make', deployFunctionArgs: [11n, bobPkh],
      childArtifacts: { Counter: artifacts.Counter, Holder: artifacts.Holder },
      fundingUtxo: prepFunding, funder, changeAddress: change,
    } as never);
    expect(result.children).toHaveLength(2);
    expect(result.children!.map((child) => child.inner.artifact.contractName)).toEqual(['Counter', 'Holder']);
    expect(result.prepTransactions).toHaveLength(2);
    expect((await result.children![0]!.getState() as { n?: bigint }).n).toBe(33n);
    const holder = await result.children![1]!.getState() as { owner?: Uint8Array | string; since?: bigint };
    expect(typeof holder.owner === 'string' ? holder.owner : binToHex(holder.owner!)).toBe(binToHex(bobPkh));
    expect(holder.since).toBe(16n);

    const creation = captured[captured.length - 1];
    expect(verify(creation)).toBe(true);
    const inputs = deployerInputs(creation, artifacts.Factory);
    expect(inputs).toHaveLength(2);
    expect(binToHex(creation.sourceOutputs[inputs[0]!].lockingBytecode)).toBe(deployers.Counter!.lockingBytecode);
    expect(binToHex(creation.sourceOutputs[inputs[1]!].lockingBytecode)).toBe(deployers.Holder!.lockingBytecode);
    // Either child's argument changed after derivation: the factory's own input refuses it.
    expect(creatorPasses(withChildArgument(creation, inputs[0]!, deployers.Counter!, 0, 0, 34n))).toBe(false);
    expect(creatorPasses(withChildArgument(creation, inputs[1]!, deployers.Holder!, 1, 0, alicePkh))).toBe(false);
  }, 600_000);

  it('creates the second site\'s child at its own slot when the first site\'s branch does not run', async () => {
    const { provider, captured, funder, change, artifacts, deployed, prepFunding } = await setup(`
      contract Counter(int x) { int n; constructor() { n = x; } function bump() { this.n = this.n + 1; } }
      contract Factory { int made;
        function make(bool first, int a) {
          if (first) { new Counter{args: (a * 3)}(); }
          new Counter{args: (a + 5)}();
          this.made = this.made + 1;
        }
      }`, 'Factory');
    const result = await StatefulContract.deployFrom({
      provider, factory: deployed.contract, deployFunctionName: 'make', deployFunctionArgs: [false, 11n],
      childArtifact: artifacts.Counter, fundingUtxo: prepFunding, funder, changeAddress: change,
    });
    expect(result.children).toHaveLength(1);
    expect((await result.child.getState() as { n?: bigint }).n).toBe(16n);

    const creation = captured[captured.length - 1];
    expect(verify(creation)).toBe(true);
    // The second site binds the second deploy slot's input and output; a wallet coin and fillers hold the first's.
    const sites = artifacts.Factory.abi.find((entry) => entry.name === 'make')!.blockLayout!.slots
      .filter((slot) => slot.kind === 'deploy');
    expect(sites).toHaveLength(2);
    const [input] = deployerInputs(creation, artifacts.Factory);
    expect(binToHex(creation.sourceOutputs[input! - 1].lockingBytecode)).toBe(binToHex(aliceLock));
    const master = creation.transaction.outputs[sites[1]!.offset];
    expect(master.token?.nft?.capability).toBe('minting');
    expect(binToHex(master.token.category)).toBe(result.childCategoryId);
    expect(creation.transaction.outputs.slice(sites[0]!.offset, sites[1]!.offset)
      .map((output: any) => binToHex(output.lockingBytecode))).toEqual(['51', '51']);
    const forged = withChildArgument(creation, input!, artifacts.Factory.childDeployers!.Counter!, 0, 0, 17n);
    expect(creatorPasses(forged)).toBe(false);
  }, 600_000);

  it('creates a loop\'s children with arguments computed per iteration, without being told how many', async () => {
    const { provider, captured, funder, change, artifacts, deployed, prepFunding } = await setup(`
      contract Child(int x) { int n; constructor() { n = x; } function bump() { this.n = this.n + 1; } }
      contract Factory { int made;
        function make(int k, int a) {
          for (int i = 0; i < k; i = i + 1) { new Child{args: (a + i * 100)}(); }
          this.made = this.made + k;
        }
      }`, 'Factory');
    const result = await StatefulContract.deployFrom({
      provider, factory: deployed.contract, deployFunctionName: 'make', deployFunctionArgs: [2n, 1000n],
      childArtifact: artifacts.Child, fundingUtxo: prepFunding, funder, changeAddress: change,
    });
    expect(result.children).toHaveLength(2);
    const states = await Promise.all(result.children!.map(async (child) => (await child.getState() as { n?: bigint }).n));
    expect(states).toEqual([1000n, 1100n]);
    expect(((await result.factory.getState()) as { made?: bigint }).made).toBe(2n);

    const creation = captured[captured.length - 1];
    expect(verify(creation)).toBe(true);
    const inputs = deployerInputs(creation, artifacts.Factory);
    expect(inputs).toHaveLength(2);
    const deployer = artifacts.Factory.childDeployers!.Child!;
    for (const [iteration, input] of inputs.entries()) {
      expect(creatorPasses(withChildArgument(creation, input, deployer, 0, 0, 1001n + BigInt(iteration) * 100n)))
        .toBe(false);
    }
  }, 600_000);

  it('builds a runtime loop\'s payments beside a new with a computed value, from the creator\'s run', async () => {
    const { provider, captured, funder, change, artifacts, deployed, prepFunding } = await setup(`
      contract Paid(int x) {
        int n;
        constructor(int y) payable { n = x + y + msg.value; }
        function bump() { this.n = this.n + 1; }
      }
      contract Factory { int made;
        function make(int k, int a, bytes20 to) {
          int v = a * 50;
          new Paid{args: (a), value: v}(a + 1);
          for (int i = 0; i < k; i++) { this.transfer(new LockingBytecodeP2PKH(to), 2000 + i * 7); }
          this.made = this.made + 1;
        }
      }`, 'Factory', { initialBalance: 50_000n });
    expect(artifacts.Factory.abi.find((entry) => entry.name === 'make')?.runtimeLoopTransfers).toHaveLength(1);
    const containerOf = (contract: any, category: string) => getSatoshiContainerAddress(contract.inner, category);
    const held = async (address: string): Promise<bigint> => (await provider.getUtxos(address))
      .reduce((total, utxo) => total + utxo.satoshis, 0n);
    const factoryContainer = containerOf(deployed.contract, deployed.contract.categoryId);
    const before = await held(factoryContainer);
    const result = await StatefulContract.deployFrom({
      provider, factory: deployed.contract, deployFunctionName: 'make', deployFunctionArgs: [2n, 40n, bobPkh],
      childArtifact: artifacts.Paid, fundingUtxo: prepFunding, funder, changeAddress: change,
    });
    // v = 40 * 50 reaches the child's container, where its constructor reads it as msg.value.
    expect((await result.child.getState() as { n?: bigint }).n).toBe(40n + 41n + 2000n);
    expect(await held(containerOf(result.child, result.childCategoryId))).toBe(2000n);
    // The factory's container pays v and both payments.
    expect(before - await held(factoryContainer)).toBe(2000n + 2000n + 2007n);

    const creation = captured[captured.length - 1];
    expect(verify(creation)).toBe(true);
    const bobLock = binToHex(encodeLockingBytecodeP2pkh(bobPkh));
    const payments = creation.transaction.outputs
      .map((output: any, index: number) => ({ index, lock: binToHex(output.lockingBytecode), value: output.valueSatoshis }))
      .filter((output: { lock: string }) => output.lock === bobLock);
    expect(payments.map((payment: { value: bigint }) => payment.value)).toEqual([2000n, 2007n]);
    // A payment one satoshi short, the satoshi moved to the change: the factory's input refuses it.
    const changeIndex = creation.transaction.outputs
      .findIndex((output: any) => binToHex(output.lockingBytecode) === binToHex(aliceLock));
    const moved: Spend = structuredClone(creation);
    moved.transaction.outputs[payments[1]!.index].valueSatoshis -= 1n;
    moved.transaction.outputs[changeIndex].valueSatoshis += 1n;
    expect(verify(moved)).not.toBe(true);
    const back: Spend = structuredClone(creation);
    back.transaction.outputs[changeIndex].valueSatoshis -= 1n;
    back.transaction.outputs[payments[1]!.index].valueSatoshis += 1n;
    expect(verify(back)).not.toBe(true);
  }, 600_000);
});
