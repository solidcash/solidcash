import {
  binToHex, decodeAuthenticationInstructions, decodeTransactionUnsafe, encodeAuthenticationInstructions,
  encodeTransaction, hash256, hexToBin,
} from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString, compileStringMulti } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * CALLER-EDGE-1 (docs/security/security-audit-2026-10-16.md). A callee reading a contract's msg.sender requires that
 * contract's edge record. The caller pins one only for a call it makes, and a run's record count takes in both carrier
 * locks and expects what the run pinned, so a spender cannot stand an edge beside a run that made no such call.
 */
const vaultSource = `
interface IVault { function pay(); function other(); }
contract Vault(address trusted) {
  bigint paid;
  function pay() { require(msg.sender == trusted); this.paid = this.paid + 1; }
  function other() { this.paid = this.paid + 2; }
}`;

const CALLER = `pragma solidcash >=0.8.0;${vaultSource}
contract Caller() {
  bigint calls;
  function go(address vault) { IVault(vault).pay(); this.calls = this.calls + 1; }
  function poke() { this.calls = this.calls + 1; }
}`;

const skipping = (declarations: string): string => `pragma solidcash >=0.8.0;${vaultSource}
contract Caller() {
  ${declarations}
  bigint calls;
  function go(address vault, bool skip) {
    this.calls = this.calls + 1;
    if (skip) { return; }
    IVault(vault).pay();
  }
}`;

const TWICE = `pragma solidcash >=0.8.0;${vaultSource}
contract Caller() {
  bigint calls;
  function go(address first, address second) {
    IVault(first).pay();
    IVault(second).pay();
    this.calls = this.calls + 1;
  }
}`;

const FALLBACK = `pragma solidcash >=0.8.0;${vaultSource}
contract Caller() {
  bigint calls;
  function go(address vault) { IVault(vault).pay(); }
  fallback() external { require(this.calls == 0); }
}`;

const COUNTER = `pragma solidcash >=0.8.0;
contract Counter() {
  bigint calls;
  function poke() { this.calls = this.calls + 1; }
  function next() returns (bigint) { this.calls = this.calls + 1; return this.calls; }
}`;

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;

async function deploy(
  provider: Provider, artifact: Parameters<typeof Contract>[0] extends never ? never : any, args: unknown[],
  state: Record<string, bigint>,
): Promise<{ contract: any; sc: any; lock: Uint8Array }> {
  const contract = new Contract(artifact, args as never, { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, state, { saltContract: true },
  );
  return {
    contract: contract.withCategory(hexToBin(categoryId)),
    sc: StatefulContract.withCategory(contract, categoryId),
    lock: hexToBin(contract.withCategory(hexToBin(categoryId)).lockingBytecode),
  };
}

/** The transaction `spend` builds and verifies, unbroadcast, and the provider's own broadcast. */
async function captured(provider: Provider, spend: () => Promise<unknown>): Promise<{
  tx: Tx; broadcast: (tx: Tx) => Promise<string>;
}> {
  const send = provider.sendRawTransaction.bind(provider);
  let hex = '';
  provider.sendRawTransaction = async (raw: string): Promise<string> => {
    hex = raw;
    return binToHex(hash256(hexToBin(raw)).reverse());
  };
  await spend();
  provider.sendRawTransaction = send;
  return { tx: decodeTransactionUnsafe(hexToBin(hex)), broadcast: (tx) => send(binToHex(encodeTransaction(tx))) };
}

const edgeOutput = (tx: Tx): number => tx.outputs.findIndex((output) => binToHex(output.lockingBytecode) === '5161');

/** Sets a run's boolean argument, the push before its last argument and the redeem script. */
function withArgumentTrue(unlocking: Uint8Array): Uint8Array {
  const instructions = decodeAuthenticationInstructions(unlocking);
  expect(instructions[instructions.length - 3].opcode).toBe(0);
  instructions[instructions.length - 3] = { opcode: 0x51 };
  return encodeAuthenticationInstructions(instructions);
}

async function callerAndVault(source: string): Promise<{
  provider: Provider; caller: Awaited<ReturnType<typeof deploy>>; vault: Awaited<ReturnType<typeof deploy>>;
}> {
  const provider = createTestProvider();
  const artifacts = compileStringMulti(source, {});
  const caller = await deploy(provider, artifacts.Caller, [], { calls: 0n });
  const vault = await deploy(provider, artifacts.Vault, [caller.lock], { paid: 0n });
  return { provider, caller, vault };
}

describe('an output no carrier lock names', () => {
  // A contract may pay a caller's `to`, and `address(0)` is the empty lock: the count reads past it.
  it.each([
    ['the compact count', {}, 'poke'],
    ['the message-bus count', { messageBus: true }, 'next'],
  ])('settles at the empty lock beside %s', async (_, options, entry) => {
    const provider = createTestProvider();
    const counter = await deploy(provider, compileString(COUNTER, options), [], { calls: 0n });
    const { tx, broadcast } = await captured(provider, () => counter.sc[entry]().send());
    tx.outputs.push({ lockingBytecode: new Uint8Array(), valueSatoshis: 0n });

    await expect(broadcast(tx)).resolves.toBeTypeOf('string');
    expect((await counter.sc.getState()).calls).toBe(1n);
  }, 120_000);
});

describe('a caller edge a run did not pin', () => {
  it('is refused beside an entry that makes no call, so a spender cannot act as the contract', async () => {
    const { provider, caller, vault } = await callerAndVault(CALLER);
    const { tx, broadcast } = await captured(provider, () => caller.sc.go(vault.lock)
      .withExternalCall(vault.sc, 'pay', []).send());
    tx.inputs[0].unlockingBytecode = (await caller.sc.poke().build()).buildLibauthTransaction().inputs[0].unlockingBytecode;

    await expect(broadcast(tx)).rejects.toThrow(/input index 0/);
    expect((await vault.sc.getState()).paid).toBe(0n);
  }, 120_000);

  it('is no edge at all under another lock: the callee refuses it', async () => {
    const { provider, caller, vault } = await callerAndVault(CALLER);
    const { tx, broadcast } = await captured(provider, () => caller.sc.go(vault.lock)
      .withExternalCall(vault.sc, 'pay', []).send());
    tx.inputs[0].unlockingBytecode = (await caller.sc.poke().build()).buildLibauthTransaction().inputs[0].unlockingBytecode;
    tx.outputs[edgeOutput(tx)].lockingBytecode = hexToBin(`76a914${'11'.repeat(20)}88ac`);

    await expect(broadcast(tx)).rejects.toThrow(/input index [1-9]/);
    expect((await vault.sc.getState()).paid).toBe(0n);
  }, 120_000);

  // The edge's witness names the output, and the census admits a witnessed index, whether or not the call ran.
  it.each([
    ['a contract with events', skipping('event Ping(int n); function log() { emit Ping(1); }')],
    ['a contract without events', skipping('')],
  ])('is refused when an early return skips the call, in %s', async (_, source) => {
    const { provider, caller, vault } = await callerAndVault(source);
    const { tx, broadcast } = await captured(provider, () => caller.sc.go(vault.lock, false)
      .withExternalCall(vault.sc, 'pay', []).send());
    tx.inputs[0].unlockingBytecode = withArgumentTrue(tx.inputs[0].unlockingBytecode);

    await expect(broadcast(tx)).rejects.toThrow(/input index 0/);
    expect((await vault.sc.getState()).paid).toBe(0n);
  }, 120_000);

  it('is refused when two calls with one digest name one output, which would free the other for a forgery', async () => {
    const provider = createTestProvider();
    const artifacts = compileStringMulti(TWICE, {});
    const caller = await deploy(provider, artifacts.Caller, [], { calls: 0n });
    const first = await deploy(provider, artifacts.Vault, [caller.lock], { paid: 0n });
    const second = await deploy(provider, artifacts.Vault, [caller.lock], { paid: 0n });
    const { tx, broadcast } = await captured(provider, () => caller.sc.go(first.lock, second.lock)
      .withExternalCall(first.sc, 'pay', []).withExternalCall(second.sc, 'pay', []).send());

    // The last parameter's push leads, after the selector: the two edge witnesses.
    const instructions = decodeAuthenticationInstructions(tx.inputs[0].unlockingBytecode);
    instructions[1] = instructions[2];
    const shared = structuredClone(tx);
    shared.inputs[0].unlockingBytecode = encodeAuthenticationInstructions(instructions);

    await expect(broadcast(shared)).rejects.toThrow(/input index 0/);
    await broadcast(tx);
    expect((await first.sc.getState()).paid).toBe(1n);
    expect((await second.sc.getState()).paid).toBe(1n);
  }, 120_000);

  it('is refused beside a fallback run, which settles no record', async () => {
    const { provider, caller, vault } = await callerAndVault(FALLBACK);
    const { tx, broadcast } = await captured(provider, () => caller.sc.go(vault.lock)
      .withExternalCall(vault.sc, 'pay', []).send());
    const sourceOutputs = [{ lockingBytecode: caller.lock, valueSatoshis: 1000n }];
    tx.inputs[0].unlockingBytecode = caller.contract.unlock.fallback()
      .generateUnlockingBytecode({ transaction: tx, sourceOutputs, inputIndex: 0 });

    await expect(broadcast(tx)).rejects.toThrow(/input index 0/);
    expect((await vault.sc.getState()).paid).toBe(0n);
  }, 120_000);
});

const IMPL = `pragma solidcash >=0.8.0;
contract Impl() {
  bigint counter;
  function increment() public { this.counter = this.counter + 1; }
}`;

const PROXY = `pragma solidcash >=0.8.0;
contract Proxy(address impl) {
  bigint counter;
  function maybe(bytes input, bool take) {
    if (take) { impl.delegatecall(input); }
    require(input.length > 0);
  }
}`;

/** Whether `inputIndex` still settles with an own-category immutable NFT of `template`'s category under the edge lock. */
function edgeBesideSettles(
  provider: Provider, builder: any, inputIndex: number, category: NonNullable<Tx['outputs'][number]['token']>['category'],
): { honest: boolean; forged: boolean } {
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const original = builder.buildLibauthTransaction();
  const vm = createVirtualMachineBch2026ForProvider(provider);
  const settles = (transaction: typeof original): boolean => vm.stateSuccess(vm.evaluate({
    inputIndex, sourceOutputs, transaction,
  })) === true;
  const forged = structuredClone(original);
  forged.outputs.push({
    lockingBytecode: hexToBin('5161'),
    valueSatoshis: 800n,
    token: { amount: 0n, category, nft: { capability: 'none', commitment: new Uint8Array(32).fill(3) } },
  });
  return { honest: settles(original), forged: settles(forged) };
}

describe('a caller edge beside a proxy and its implementation', () => {
  async function proxied(): Promise<{
    provider: Provider; impl: Awaited<ReturnType<typeof deploy>>; proxy: Awaited<ReturnType<typeof deploy>>;
    input: Uint8Array;
  }> {
    const provider = createTestProvider();
    const implArtifact = compileString(IMPL).delegateArtifact!;
    const impl = await deploy(provider, implArtifact, [], { counter: 0n });
    const proxy = await deploy(provider, compileString(PROXY), [impl.lock], { counter: 5n });
    const input = hexToBin(implArtifact.abi.find((entry) => entry.name === 'increment')!.selector!);
    return { provider, impl, proxy, input };
  }

  it('is refused on a path that reached no delegate', async () => {
    const { provider, proxy, input } = await proxied();
    const builder = await proxy.sc.call.maybe(input, false).build();
    await builder.build();
    const category = builder.buildLibauthTransaction().outputs[0].token.category;
    expect(edgeBesideSettles(provider, builder, 0, category)).toEqual({ honest: true, forged: false });
  }, 120_000);

  it('of the proxy is refused by the delegate, and of the implementation too', async () => {
    const { provider, impl, proxy, input } = await proxied();
    const builder = await proxy.sc.call.maybe(input, true).withDelegatecall(impl.sc, 'increment', []).build();
    await builder.build();
    const original = builder.buildLibauthTransaction();
    const implInput = generateLibauthSourceOutputs(builder.inputs)
      .findIndex((output) => binToHex(output.lockingBytecode) === binToHex(impl.lock));
    expect(implInput).toBeGreaterThan(0);
    const implOutput = original.outputs.findIndex(
      (output: Tx['outputs'][number]) => binToHex(output.lockingBytecode) === binToHex(impl.lock),
    );
    expect(edgeBesideSettles(provider, builder, implInput, original.outputs[0].token.category))
      .toEqual({ honest: true, forged: false });
    expect(edgeBesideSettles(provider, builder, implInput, original.outputs[implOutput].token.category))
      .toEqual({ honest: true, forged: false });
  }, 120_000);
});
