/**
 * B8.9: a loop of deployer `new`s lays out one genesis group per run from its slot, run i at slotBase + i × w_out(C),
 * so the creator's trailing outputs start after the last of them, (runs − 1) × w_out(C) past the block's trailing base.
 *
 * Each creation below makes several children in a loop and has outputs after the loop: a fixed event and transfer, and
 * a runtime effect span (payments, and an event that joins them). The SDK reads every value from the creator's run.
 * Each is checked with stock libauth's standard VM, honest and tampered.
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
import { decodeDeployBinding, encodeDeployBinding } from '../../src/stateful/deployer.js';
import { clearGenesisReservations } from '../../src/stateful/genesis-reservations.js';
import { solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { compileStringMulti } from '../direct-compile.js';
import { alicePkh, alicePriv, bobPkh } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';

const vm = createVirtualMachineBch2026(true);
const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
const bobLock = binToHex(encodeLockingBytecodeP2pkh(bobPkh));
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

/** The same creation with one child's contract argument replaced in its deployer input (A4.2's push layout). */
function withChildArgument(
  spend: Spend, input: number, deployer: NonNullable<Artifact['childDeployers']>[string], argument: number, value: unknown,
): Spend {
  const copy: Spend = structuredClone(spend);
  const instructions = decodeAuthenticationInstructions(copy.transaction.inputs[input].unlockingBytecode);
  const visible = deployer.abi.find((entry) => entry.name === 'create')!.inputs
    .filter((entry) => !entry.name.startsWith('__internal__'));
  const end = 2 + 2 + visible.length;
  const binding = decodeDeployBinding(encodeAuthenticationInstructions(instructions.slice(2, end)), deployer, 0);
  const contractArgs = [...binding.contractArgs];
  contractArgs[argument] = value as never;
  copy.transaction.inputs[input].unlockingBytecode = Uint8Array.from([
    ...encodeAuthenticationInstructions(instructions.slice(0, 2)),
    ...encodeDeployBinding({ ...binding, contractArgs }, deployer, 0),
    ...encodeAuthenticationInstructions(instructions.slice(end)),
  ]);
  return copy;
}

const CHILD = 'contract Child(int x) { int n; constructor() { n = x; } function bump() { this.n = this.n + 1; } }';

type DeployFromResult = Awaited<ReturnType<typeof StatefulContract.deployFrom>>;

async function create(source: string, args: unknown[]): Promise<{
  artifacts: Record<string, Artifact>; result: DeployFromResult; creation: Spend; slotOffset: number; stride: number;
}> {
  clearGenesisReservations();
  const provider = new MockNetworkProvider({ profile: 'production' });
  const captured = captureBroadcasts(provider);
  const change = lockingBytecodeToCashAddress({ bytecode: aliceLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const artifacts = compileStringMulti(source, { allowUnsafeOperations: true } as never);
  const funding: Utxo = { txid: 'b1'.repeat(32), vout: 0, satoshis: 200_000n };
  await provider.seedUtxo(binToHex(aliceLock), funding);
  const deployed = await StatefulContract.deploy(artifacts.Factory, [], {
    provider, fundingUtxo: funding, funder: alice.unlockP2PKH(), initialState: { made: 0n }, initialBalance: 50_000n,
    changeAddress: change.address, senderLockingBytecode: aliceLock,
  } as never);
  const prep: Utxo = { txid: 'b2'.repeat(32), vout: 0, satoshis: 400_000n };
  await provider.seedUtxo(binToHex(aliceLock), prep);
  const result = await StatefulContract.deployFrom({
    provider, factory: deployed.contract, deployFunctionName: 'make', deployFunctionArgs: args as never,
    childArtifact: artifacts.Child, fundingUtxo: prep, funder: alice.unlockP2PKH(), changeAddress: change.address,
  });
  const make = artifacts.Factory.abi.find((entry) => entry.name === 'make')!;
  const slot = make.blockLayout!.slots.find((candidate) => candidate.kind === 'deploy')!;
  return {
    artifacts, result, creation: captured[captured.length - 1]!,
    slotOffset: slot.offset, stride: artifacts.Factory.childDeployers!.Child!.genesisOutputs,
  };
}

/** The creation's outputs at `lock`, by index. */
const outputsAt = (spend: Spend, lock: string): number[] => spend.transaction.outputs
  .map((output: any, index: number) => (binToHex(output.lockingBytecode) === lock ? index : -1))
  .filter((index: number) => index >= 0);

/** The same creation with one satoshi moved from output `from` to output `to`. */
function moveOne(spend: Spend, from: number, to: number): Spend {
  const copy: Spend = structuredClone(spend);
  copy.transaction.outputs[from].valueSatoshis -= 1n;
  copy.transaction.outputs[to].valueSatoshis += 1n;
  return copy;
}

describe('B8.9: the outputs after a loop of deployer `new`s', () => {
  it('creates three children in a loop, then an event and a transfer', async () => {
    const { artifacts, result, creation } = await create(`${CHILD}
      contract Factory { int made; event Made(int k, int last);
        function make(int k, int a, bytes20 to) {
          for (int i = 0; i < k; i++) { new Child{args: (a + i * 10)}(); }
          emit Made(k, a + k);
          this.transfer(new LockingBytecodeP2PKH(to), 1500);
          this.made = this.made + k;
        }
      }`, [3n, 70n, bobPkh]);
    expect(result.children).toHaveLength(3);
    const states = await Promise.all(result.children!.map(async (child) => (await child.getState() as { n?: bigint }).n));
    expect(states).toEqual([70n, 80n, 90n]);
    expect(((await result.factory.getState()) as { made?: bigint }).made).toBe(3n);
    expect(verify(creation)).toBe(true);

    // The transfer pays `to`, a value the factory computes, which the SDK read from its run.
    const [payment] = outputsAt(creation, bobLock);
    expect(creation.transaction.outputs[payment!].valueSatoshis).toBe(1500n);
    const changeIndex = outputsAt(creation, binToHex(aliceLock)).at(-1)!;
    expect(verify(moveOne(creation, payment!, changeIndex))).not.toBe(true);
    // The event's commitment changed: the factory refuses it.
    const event = creation.transaction.outputs.findIndex((output: any) => output.token?.nft?.capability === 'none');
    expect(event).toBeGreaterThan(0);
    const forgedEvent: Spend = structuredClone(creation);
    forgedEvent.transaction.outputs[event].token.nft.commitment = Uint8Array.of(0x01, 0x02);
    expect(creatorPasses(forgedEvent)).toBe(false);
    // The third child's argument changed after derivation.
    const deployers = creation.sourceOutputs.map((output, index) => [binToHex(output.lockingBytecode), index] as const)
      .filter(([lock]) => lock === artifacts.Factory.childDeployers!.Child!.lockingBytecode).map(([, index]) => index);
    expect(deployers).toHaveLength(3);
    expect(creatorPasses(withChildArgument(creation, deployers[2]!, artifacts.Factory.childDeployers!.Child!, 0, 91n)))
      .toBe(false);
  }, 600_000);

  it('lays the payments of the loop of `new` and the event after it out after the last child', async () => {
    const { result, creation, slotOffset, stride } = await create(`${CHILD}
      contract Factory { int made; event Made(int k);
        function make(int k, int a, bytes20 to) {
          for (int i = 0; i < k; i++) {
            new Child{args: (a + i)}();
            this.transfer(new LockingBytecodeP2PKH(to), 1000 + i * 7);
          }
          emit Made(k);
          this.made = this.made + k;
        }
      }`, [3n, 40n, bobPkh]);
    expect(result.children).toHaveLength(3);
    expect(verify(creation)).toBe(true);
    // The span, in source order: the three payments, then the event, from the output after the third child's group.
    const spanBase = slotOffset + 3 * stride;
    const payments = outputsAt(creation, bobLock);
    expect(payments).toEqual([spanBase, spanBase + 1, spanBase + 2]);
    expect(payments.map((index) => creation.transaction.outputs[index].valueSatoshis)).toEqual([1000n, 1007n, 1014n]);
    const event = creation.transaction.outputs[spanBase + 3];
    expect(event.token?.nft?.capability).toBe('none');
    // Every child's group precedes it.
    for (let child = 0; child < 3; child += 1) {
      expect(creation.transaction.outputs[slotOffset + child * stride].token?.nft?.capability).toBe('minting');
    }

    const changeIndex = outputsAt(creation, binToHex(aliceLock)).at(-1)!;
    expect(verify(moveOne(creation, payments[1]!, changeIndex))).not.toBe(true);
    expect(verify(moveOne(creation, changeIndex, payments[2]!))).not.toBe(true);
    const forgedEvent: Spend = structuredClone(creation);
    forgedEvent.transaction.outputs[spanBase + 3].token.nft.commitment = Uint8Array.of(0x01);
    expect(creatorPasses(forgedEvent)).toBe(false);
  }, 600_000);

  it('lays a runtime loop\'s payments after a loop of `new` out after its last child', async () => {
    const { result, creation, slotOffset, stride } = await create(`${CHILD}
      contract Factory { int made;
        function make(int k, int a, bytes20 to) {
          for (int i = 0; i < k; i++) { new Child{args: (a + i)}(); }
          for (int j = 0; j < k; j++) { this.transfer(new LockingBytecodeP2PKH(to), 2000 + j); }
          this.made = this.made + k;
        }
      }`, [2n, 5n, bobPkh]);
    expect(result.children).toHaveLength(2);
    expect(verify(creation)).toBe(true);
    const payments = outputsAt(creation, bobLock);
    expect(payments).toEqual([slotOffset + 2 * stride, slotOffset + 2 * stride + 1]);
    // A payment moved onto the second child's group, where a static trailing base would read it: refused.
    const overlaid: Spend = structuredClone(creation);
    const [first] = overlaid.transaction.outputs.splice(payments[0]!, 1);
    overlaid.transaction.outputs.splice(slotOffset + stride, 0, first);
    expect(verify(overlaid)).not.toBe(true);
  }, 600_000);

  it('refuses a trailing read placed before the loop of `new`, which cannot know how many children precede it', () => {
    expect(() => compileStringMulti(`${CHILD}
      contract Factory { int made; bytes32 acc;
        function make(int k, int a, bytes32 seed, int rounds) {
          bytes32 h = seed;
          for (int j = 0; j < rounds; j++) { h = keccak256(h); }
          for (int i = 0; i < k; i++) { new Child{args: (a + i)}(); }
          this.acc = h; this.made = this.made + k;
        }
      }`, { allowUnsafeOperations: true } as never)).toThrow(/creator-shape.*before the end of the loop of `new`/);
    expect(() => compileStringMulti(`${CHILD}
      contract Factory { int made; bytes32 acc;
        function make(int k, int a, bytes32 seed, int rounds) {
          for (int i = 0; i < k; i++) { new Child{args: (a + i)}(); }
          bytes32 h = seed;
          for (int j = 0; j < rounds; j++) { h = keccak256(h); }
          this.acc = h; this.made = this.made + k;
        }
      }`, { allowUnsafeOperations: true } as never)).not.toThrow();
  });
});
