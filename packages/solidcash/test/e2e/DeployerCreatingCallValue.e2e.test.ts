/**
 * B8.8: `new C{value: v}()` through a creating call.
 *
 * v leaves the creator's satoshi container with no transfer output of its own, and Deploy<C>'s `create` opens the
 * child's satoshi container with it, where the child's constructor reads it as `msg.value`. The creator counts v as
 * outgoing in its conservation, and `create` pins the child's row at v or more, so a builder can skim neither side:
 * each tampered copy below is refused by stock libauth's standard VM, and the honest one passes.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  binToHex, cashAddressToLockingBytecode, createVirtualMachineBch2026, decodeTransaction, encodeLockingBytecodeP2pkh,
  hexToBin, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { getSatoshiContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { clearGenesisReservations } from '../../src/stateful/genesis-reservations.js';
import { solidCashOutputToLibauthOutput } from '../../src/utils.js';
import type { Utxo } from '../../src/interfaces.js';
import { compileStringMulti } from '../direct-compile.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';

const SOURCE = `
pragma solidcash ^0.51.0;
contract Pay {
    int n;
    constructor() payable { this.n = msg.value; }
    function pay(address payable to) public { to.transfer(1000); }
}
contract Factory {
    int made;
    function make() public {
        new Pay{value: 5000}();
        this.made = this.made + 1;
    }
}
`;

const VALUE = 5000n;
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

/** The locking bytecode, in hex, of a cash address. */
function lockOf(address: string): string {
  const decoded = cashAddressToLockingBytecode(address);
  if (typeof decoded === 'string') throw new Error(decoded);
  return binToHex(decoded.bytecode);
}

/** The same transaction with one satoshi moved from output `from` to output `to`. */
function moveOne(spend: Spend, from: number, to: number): Spend {
  const copy: Spend = structuredClone(spend);
  copy.transaction.outputs[from].valueSatoshis -= 1n;
  copy.transaction.outputs[to].valueSatoshis += 1n;
  return copy;
}

describe('B8.8: a value through a creating call', () => {
  let creation: Spend;
  let factoryContainer: string;
  let childContainer: string;
  let factoryBefore: bigint;
  let factoryAfter: bigint;
  let childHolds: bigint;
  let childState: Record<string, unknown>;

  beforeAll(async () => {
    clearGenesisReservations();
    const provider = new MockNetworkProvider({ profile: 'production' });
    const captured = captureBroadcasts(provider);
    const change = lockingBytecodeToCashAddress({ bytecode: aliceLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = alice.unlockP2PKH();
    const artifacts = compileStringMulti(SOURCE, { allowUnsafeOperations: true } as never);
    expect(artifacts.Factory.childDeployers?.Pay?.satoshiContainer).toBe('optional');

    const deploymentFunding: Utxo = { txid: 'e1'.repeat(32), vout: 0, satoshis: 100_000n };
    await provider.seedUtxo(binToHex(aliceLock), deploymentFunding);
    const deployed = await StatefulContract.deploy(artifacts.Factory, [], {
      provider, fundingUtxo: deploymentFunding, funder, initialState: { made: 0n }, initialBalance: 20_000n,
      changeAddress: change.address, senderLockingBytecode: aliceLock,
    });
    factoryContainer = getSatoshiContainerAddress(deployed.contract.inner, deployed.contract.categoryId);
    const sum = async (address: string): Promise<bigint> => (await provider.getUtxos(address))
      .reduce((total, utxo) => total + utxo.satoshis, 0n);
    factoryBefore = await sum(factoryContainer);

    const prepFunding: Utxo = { txid: 'e2'.repeat(32), vout: 0, satoshis: 100_000n };
    await provider.seedUtxo(binToHex(aliceLock), prepFunding);
    const result = await StatefulContract.deployFrom({
      provider,
      factory: deployed.contract,
      deployFunctionName: 'make',
      deployFunctionArgs: [],
      childArtifact: artifacts.Pay,
      childInitialState: { n: VALUE },
      childValue: VALUE,
      fundingUtxo: prepFunding,
      funder,
      changeAddress: change.address,
    } as never);
    creation = captured[captured.length - 1];
    childContainer = getSatoshiContainerAddress(result.child.inner, result.childCategoryId);
    factoryAfter = await sum(factoryContainer);
    childHolds = await sum(childContainer);
    childState = await result.child.getState() as Record<string, unknown>;
  });

  it('moves v from the creator\'s container to the child\'s, where the constructor reads it as msg.value', () => {
    expect(factoryBefore - factoryAfter).toBe(VALUE);
    expect(childHolds).toBe(VALUE);
    expect(childState.n).toBe(VALUE);
    expect(verify(creation)).toBe(true);
  });

  /** The index of the creation's output at `address`, and of its change output. */
  const outputsAt = (address: string): { at: number; change: number } => {
    const outputs = creation.transaction.outputs as { lockingBytecode: Uint8Array }[];
    const at = outputs.findIndex((output) => binToHex(output.lockingBytecode) === lockOf(address));
    const change = outputs.findIndex((output) => binToHex(output.lockingBytecode) === binToHex(aliceLock));
    expect(at).toBeGreaterThanOrEqual(0);
    expect(change).toBeGreaterThanOrEqual(0);
    return { at, change };
  };

  it('refuses a creator\'s container that loses one satoshi more than v', () => {
    const { at, change } = outputsAt(factoryContainer);
    expect(creation.transaction.outputs[at].valueSatoshis).toBe(factoryAfter);
    expect(verify(moveOne(creation, at, change))).not.toBe(true);
  });

  it('refuses a child\'s container that receives one satoshi less than v', () => {
    const { at, change } = outputsAt(childContainer);
    expect(creation.transaction.outputs[at].valueSatoshis).toBe(VALUE);
    expect(verify(moveOne(creation, at, change))).not.toBe(true);
  });

  it('passes the same moves the other way, so each refusal is the rule\'s', () => {
    const creator = outputsAt(factoryContainer);
    const child = outputsAt(childContainer);
    expect(verify(moveOne(creation, creator.change, creator.at))).toBe(true);
    expect(verify(moveOne(creation, child.change, child.at))).toBe(true);
  });
});

describe('B8.8: a value for each child of a loop', () => {
  it('opens each child\'s container with v and takes v times the children from the creator\'s', async () => {
    clearGenesisReservations();
    const provider = new MockNetworkProvider({ profile: 'production' });
    const captured = captureBroadcasts(provider);
    const change = lockingBytecodeToCashAddress({ bytecode: aliceLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = alice.unlockP2PKH();
    const artifacts = compileStringMulti(`
      pragma solidcash ^0.51.0;
      contract Pay { int n; constructor() payable { this.n = msg.value; } function pay(address payable to) public { to.transfer(1000); } }
      contract LoopFactory { int made;
        function makeTwo() public {
          for (int i = 0; i < 2; i = i + 1) { new Pay{value: 5000}(); }
          this.made = this.made + 2;
        }
      }`, { allowUnsafeOperations: true } as never);
    const deploymentFunding: Utxo = { txid: 'e3'.repeat(32), vout: 0, satoshis: 100_000n };
    await provider.seedUtxo(binToHex(aliceLock), deploymentFunding);
    const deployed = await StatefulContract.deploy(artifacts.LoopFactory, [], {
      provider, fundingUtxo: deploymentFunding, funder, initialState: { made: 0n }, initialBalance: 30_000n,
      changeAddress: change.address, senderLockingBytecode: aliceLock,
    });
    const factoryContainer = getSatoshiContainerAddress(deployed.contract.inner, deployed.contract.categoryId);
    const sum = async (address: string): Promise<bigint> => (await provider.getUtxos(address))
      .reduce((total, utxo) => total + utxo.satoshis, 0n);
    const before = await sum(factoryContainer);
    const prepOne: Utxo = { txid: 'e4'.repeat(32), vout: 0, satoshis: 100_000n };
    const prepTwo: Utxo = { txid: 'e5'.repeat(32), vout: 0, satoshis: 100_000n };
    await provider.seedUtxo(binToHex(aliceLock), prepOne);
    await provider.seedUtxo(binToHex(aliceLock), prepTwo);

    const result = await StatefulContract.deployFrom({
      provider, factory: deployed.contract, deployFunctionName: 'makeTwo', deployFunctionArgs: [],
      childArtifact: artifacts.Pay, childInitialState: { n: VALUE }, childValue: VALUE,
      fundingUtxos: [prepOne, prepTwo], deployments: 2, funder, changeAddress: change.address,
    } as never);

    expect(result.children).toHaveLength(2);
    expect(before - await sum(factoryContainer)).toBe(2n * VALUE);
    for (const child of result.children!) {
      expect(await sum(getSatoshiContainerAddress(child.inner, child.categoryId))).toBe(VALUE);
      expect((await child.getState() as { n?: bigint }).n).toBe(VALUE);
    }
    // The creator counts v once per child: its container cannot lose one satoshi more.
    const creation = captured[captured.length - 1];
    const outputs = creation.transaction.outputs as { lockingBytecode: Uint8Array }[];
    const at = outputs.findIndex((output) => binToHex(output.lockingBytecode) === lockOf(factoryContainer));
    const changeOutput = outputs.findIndex((output) => binToHex(output.lockingBytecode) === binToHex(aliceLock));
    expect(verify(creation)).toBe(true);
    expect(verify(moveOne(creation, at, changeOutput))).not.toBe(true);
  }, 600_000);
});

describe('B8.8: a value the creating function takes as an argument', () => {
  it('sends the argument, and refuses a childValue that differs from it', async () => {
    clearGenesisReservations();
    const provider = new MockNetworkProvider({ profile: 'production' });
    const change = lockingBytecodeToCashAddress({ bytecode: aliceLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = alice.unlockP2PKH();
    const artifacts = compileStringMulti(`
      pragma solidcash ^0.51.0;
      contract Pay { int n; constructor() payable { this.n = msg.value; } function pay(address payable to) public { to.transfer(1000); } }
      contract ArgFactory { int made;
        function make(int v) public { new Pay{value: v}(); this.made = this.made + 1; }
      }`, { allowUnsafeOperations: true } as never);
    const deploymentFunding: Utxo = { txid: 'e6'.repeat(32), vout: 0, satoshis: 100_000n };
    await provider.seedUtxo(binToHex(aliceLock), deploymentFunding);
    const deployed = await StatefulContract.deploy(artifacts.ArgFactory, [], {
      provider, fundingUtxo: deploymentFunding, funder, initialState: { made: 0n }, initialBalance: 20_000n,
      changeAddress: change.address, senderLockingBytecode: aliceLock,
    });
    const prepFunding: Utxo = { txid: 'e7'.repeat(32), vout: 0, satoshis: 100_000n };
    await provider.seedUtxo(binToHex(aliceLock), prepFunding);
    const call = (extra: Record<string, unknown>) => StatefulContract.deployFrom({
      provider, factory: deployed.contract, deployFunctionName: 'make', deployFunctionArgs: [7000n],
      childArtifact: artifacts.Pay, childInitialState: { n: 7000n }, fundingUtxo: prepFunding, funder,
      changeAddress: change.address, ...extra,
    } as never);

    await expect(call({ childValue: 6000n })).rejects.toThrow(/childValue is 6000, but 'make' sends 'v', which is 7000/);
    const result = await call({});
    expect(await (async () => (await provider.getUtxos(getSatoshiContainerAddress(result.child.inner, result.childCategoryId)))
      .reduce((total, utxo) => total + utxo.satoshis, 0n))()).toBe(7000n);
    expect((await result.child.getState() as { n?: bigint }).n).toBe(7000n);
  }, 600_000);

  // The site evaluates `value` before the arguments; a variable both read must survive to the arguments.
  it('sends a value computed from a variable the arguments also read', async () => {
    clearGenesisReservations();
    const provider = new MockNetworkProvider({ profile: 'production' });
    const change = lockingBytecodeToCashAddress({ bytecode: aliceLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = alice.unlockP2PKH();
    const artifacts = compileStringMulti(`
      pragma solidcash ^0.51.0;
      contract Pay2(int a) { int n; int m;
        constructor(int b) payable { this.n = msg.value; this.m = a + b; }
        function pay(address payable to) public { to.transfer(1000); } }
      contract ExprFactory { int made;
        function make(int a) public { new Pay2{args: (a), value: a * 50}(a + 1); this.made = this.made + 1; }
      }`, { allowUnsafeOperations: true } as never);
    const deploymentFunding: Utxo = { txid: 'e8'.repeat(32), vout: 0, satoshis: 100_000n };
    await provider.seedUtxo(binToHex(aliceLock), deploymentFunding);
    const deployed = await StatefulContract.deploy(artifacts.ExprFactory, [], {
      provider, fundingUtxo: deploymentFunding, funder, initialState: { made: 0n }, initialBalance: 20_000n,
      changeAddress: change.address, senderLockingBytecode: aliceLock,
    });
    const prepFunding: Utxo = { txid: 'e9'.repeat(32), vout: 0, satoshis: 100_000n };
    await provider.seedUtxo(binToHex(aliceLock), prepFunding);
    const result = await StatefulContract.deployFrom({
      provider, factory: deployed.contract, deployFunctionName: 'make', deployFunctionArgs: [100n],
      childArtifact: artifacts.Pay2, fundingUtxo: prepFunding, funder, changeAddress: change.address,
    } as never);
    expect((await provider.getUtxos(getSatoshiContainerAddress(result.child.inner, result.childCategoryId)))
      .reduce((total, utxo) => total + utxo.satoshis, 0n)).toBe(5000n);
    expect(await result.child.getState()).toMatchObject({ n: 5000n, m: 201n });
  }, 600_000);
});
