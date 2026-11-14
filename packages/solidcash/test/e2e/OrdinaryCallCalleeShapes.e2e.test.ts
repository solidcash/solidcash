/**
 * Ordinary calls of the shapes a constructor's callee takes its block from (A14 item 5): a low-level call whose result
 * the function reads, an entry that iterates a collection, a keccak256 loop on side-cars of the shared pool (salt 0, as
 * a callee off input 0 needs), and a sized entry msg.sender keys, each with its call record published, as a
 * constructor's call always publishes it. Each sent transaction is checked by the VM; each tamper case changes one part
 * of it and expects the covenant that binds that part to refuse.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { SignatureTemplate, Signer } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { getDataNftAddress, getEntryNftAddress } from '../../src/stateful/covenant-helpers.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { addressToLockScript, solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Artifact } from '@solidcash/utils';
import type { Utxo } from '../../src/interfaces.js';
import type { DeployResult } from '../../src/stateful/stateful-lifecycle-types.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const P = 'pragma solidcash ^0.50.0;';
const compileOptions = (primary: string): never => ({
  deployer: true, genesisCalls: true, messageBus: false, primaryContractName: primary,
}) as never;

let serial = 0xf00;
const nextTxid = (): string => (serial++).toString(16).padStart(64, '0');

type Sent = { transaction: ReturnType<typeof decodeTransactionUnsafe>; sourceOutputs: any[] };

interface Setup {
  provider: MockNetworkProvider;
  deploy(artifact: Artifact): Promise<DeployResult<Artifact>>;
  wallet(): Promise<Signer>;
  /** Every transaction sent so far, with the outputs its inputs spend. */
  sent: Sent[];
}

function setup(): Setup {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
  const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
  const sent: Sent[] = [];
  const original = provider.sendRawTransaction.bind(provider);
  (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
    const transaction = decodeTransactionUnsafe(hexToBin(hex));
    const sourceOutputs = await Promise.all(transaction.inputs.map(async (input) => {
      const spent = await provider.getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex);
      if (spent === undefined) throw new Error('an input of the transaction is not on the ledger');
      return solidCashOutputToLibauthOutput({
        to: spent.lockingBytecode, amount: spent.satoshis, ...(spent.token === undefined ? {} : { token: spent.token }),
      });
    }));
    sent.push({ transaction, sourceOutputs });
    return original(hex);
  };
  const deploy = async (artifact: Artifact): Promise<DeployResult<Artifact>> => {
    const fundingUtxo: Utxo = { txid: nextTxid(), vout: 0, satoshis: 2_000_000n };
    await provider.seedUtxo(binToHex(authorLock), fundingUtxo);
    return StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder, changeAddress: change.address, senderLockingBytecode: authorLock,
    } as never);
  };
  const wallet = async (): Promise<Signer> => {
    const signer = new Signer(alicePriv, provider);
    for (let index = 0; index < 4; index += 1) {
      await provider.seedUtxo(signer.getAddress(), { txid: nextTxid(), vout: 0, satoshis: 200_000n });
    }
    return signer;
  };
  return { provider, deploy, wallet, sent };
}

const same = (left: Uint8Array, right: Uint8Array): boolean => binToHex(left) === binToHex(right);
const inputAt = (sent: Sent, lock: Uint8Array): number => sent.sourceOutputs
  .findIndex((output) => same(output.lockingBytecode, lock));

/** The VM's verdict on one input of `sent`. */
function inputPasses(provider: MockNetworkProvider, sent: Sent, inputIndex: number): boolean {
  const vm = createVirtualMachineBch2026ForProvider(provider);
  return vm.stateSuccess(vm.evaluate({ ...sent, inputIndex } as never) as never) === true;
}

/** `sent` with output `index` replaced. */
const withOutput = (sent: Sent, index: number, change: (output: any) => any): Sent => ({
  sourceOutputs: sent.sourceOutputs,
  transaction: {
    ...sent.transaction,
    outputs: sent.transaction.outputs.map((output, at) => (at === index ? change(output) : output)),
  },
});

const bumpCommitment = (output: any): any => {
  const commitment = Uint8Array.from(output.token.nft.commitment);
  commitment[commitment.length - 1] ^= 1;
  return { ...output, token: { ...output.token, nft: { ...output.token.nft, commitment } } };
};

describe('an ordinary call whose low-level call result is read', () => {
  const SOURCE = `${P} interface IU { function g(int x) external returns (int); }
    contract U { int calls; function g(int x) external returns (int) { calls = calls + 1; return x * 2; } }
    contract T { int n; function f(address u, int x) external returns (bool) {
      (bool ok, bytes memory data) = u.call(abi.encodeWithSelector(IU.g.selector, x));
      require(ok && data.length > 0); n = n + 1; return ok; } }`;

  it('co-spends the function the payload names, with its record, and refuses the callee run on another argument',
    async () => {
      const s = setup();
      const u = await s.deploy(compileString(SOURCE, compileOptions('U')));
      const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
      const wallet = await s.wallet();
      const uLock = addressToLockScript(u.contract.address);
      // The callee is named without its function: the call's payload names `g` and its argument.
      await (t.contract.connect(wallet) as any).call.f(uLock, 21n).withExternalCall(u.contract).emitReturn().send();
      const sent = s.sent[s.sent.length - 1]!;
      expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
      expect(((await t.contract.getState()) as { n?: bigint }).n).toBe(1n);
      expect(((await u.contract.getState()) as { calls?: bigint }).calls).toBe(1n);

      // The payload encodes `x` as one push (a native compile), which T binds to U's argument push.
      const master = inputAt(sent, addressToLockScript(t.contract.address));
      const callee = inputAt(sent, uLock);
      const unlocking = Uint8Array.from(sent.transaction.inputs[callee]!.unlockingBytecode);
      const argument = unlocking.findIndex((byte, index) => byte === 0x01 && unlocking[index + 1] === 21);
      expect(argument).toBeGreaterThanOrEqual(0);
      unlocking[argument + 1] = 22;
      const reargued: Sent = {
        sourceOutputs: sent.sourceOutputs,
        transaction: {
          ...sent.transaction,
          inputs: sent.transaction.inputs.map((input, index) => (
            index === callee ? { ...input, unlockingBytecode: unlocking } : input)),
        },
      };
      expect(inputPasses(s.provider, reargued, master)).toBe(false);
    });

  it('refuses to name the callee of an opaque payload, which decodes to no function', async () => {
    const source = `${P} contract U { int calls; function g(int x) external returns (int) { calls = calls + 1; return x; } }
      contract T { int n; function f(address u, bytes payload) external returns (bool) {
        (bool ok, bytes memory data) = u.call(payload); require(ok); n = n + 1; return ok; } }`;
    const s = setup();
    const u = await s.deploy(compileString(source, compileOptions('U')));
    const t = await s.deploy(compileString(source, compileOptions('T')));
    const connected = t.contract.connect(await s.wallet()) as any;
    const call = connected.call.f(addressToLockScript(u.contract.address), hexToBin('00'));
    expect(() => call.withExternalCall(u.contract))
      .toThrow(/the low-level call at slot 0: its payload names no decoded function/);
  });
});

describe('an ordinary call that iterates a collection with its call record', () => {
  const SOURCE = `${P} contract T { int total; enumerable mapping(bytes20 => int) bal;
      function put(bytes20 k, int v) public { bal[k] = v; }
      function f() external returns (int) { int sum = 0; for (int value of this.bal) { sum = sum + value; } total = sum; return sum; } }`;

  for (const emitReturn of [false, true]) {
    it(`walks the entries after the ${emitReturn ? 'whole block, record slot included' : 'compact block'}`, async () => {
      const s = setup();
      const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
      const wallet = await s.wallet();
      await (t.contract.connect(wallet) as any).call.put(new Uint8Array(20).fill(1), 5n).send();
      await (t.contract.connect(wallet) as any).call.put(new Uint8Array(20).fill(2), 7n).send();
      const call = (t.contract.connect(wallet) as any).call.f();
      await (emitReturn ? call.emitReturn() : call).send();
      const sent = s.sent[s.sent.length - 1]!;
      expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
      expect(((await t.contract.getState()) as { total?: bigint }).total).toBe(12n);

      const master = inputAt(sent, addressToLockScript(t.contract.address));
      const entryLock = addressToLockScript(getEntryNftAddress(t.contract.inner as never, t.categoryId, 'bal'));
      const walked = sent.sourceOutputs.map((output, index) => (same(output.lockingBytecode, entryLock) ? index : -1))
        .filter((index) => index >= 0);
      // The block is master, record and the record slot; a plain call compacts the slot away.
      const base = master + (emitReturn ? 3 : 2);
      expect(walked).toEqual([base, base + 1, base + 2]);
      if (emitReturn) {
        expect(sent.transaction.outputs[master + 2]!.token?.nft?.capability).toBe('none');
      }
      const dataLock = addressToLockScript(getDataNftAddress(t.contract.inner as never, t.categoryId));
      const record = sent.transaction.outputs.findIndex((output) => same(output.lockingBytecode, dataLock));
      expect(inputPasses(s.provider, withOutput(sent, record, bumpCommitment), master)).toBe(false);
    });
  }
});

describe('an ordinary call whose keccak256 loop takes its side-cars from the shared pool', () => {
  const SOURCE = `${P} contract T { bytes32 h; function f(bytes b, int k) external returns (bool) {
      bytes32 x = 0x; for (int i = 0; i < k; i++) { x = keccak256(b); } h = x; return true; } }`;

  it('runs the loop on salt-0 side-cars, as a callee off input 0 must, and refuses another digest', async () => {
    const { keccakComputeLockingBytecode } = await import('@solidcash/utils');
    const { computeSideCarStandIn } = await import('../../src/stateful/stateful-abi-resolve.js');
    const { StatefulFunctionCall } = await import('../../src/stateful/StatefulContract.js');
    const { keccak_256: keccak } = await import('@noble/hashes/sha3.js');
    const s = setup();
    const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
    const sharedLock = keccakComputeLockingBytecode(new Uint8Array(32), true);
    for (const index of [0, 1]) {
      await s.provider.seedUtxo(binToHex(sharedLock), computeSideCarStandIn('keccak-loop-ordinary', sharedLock, index));
    }
    // The pool as a creation lists it: no coin is minted on demand.
    const pool = new Proxy(s.provider, {
      get: (target, property, receiver): unknown => (property === 'addUtxo'
        ? undefined : Reflect.get(target, property, receiver)),
    });
    const connected = t.contract.connect(await s.wallet()) as any;
    const b = Uint8Array.of(4, 5, 6);
    const route = { abiFunction: t.contract.inner.artifact.abi.find((entry) => entry.name === 'f')!, emitReturn: true };
    await new StatefulFunctionCall(
      () => connected._createBuilder('f', [b, 2n], { ...route, sharedSidecarPool: pool }), connected, 'f', [b, 2n], route,
    ).send();
    const sent = s.sent[s.sent.length - 1]!;
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
    expect(binToHex(((await t.contract.getState()) as { h?: Uint8Array }).h!)).toBe(binToHex(keccak(b)));
    // One side-car per iteration after the block of master, record and record slot, each recreated at its index.
    const master = inputAt(sent, addressToLockScript(t.contract.address));
    const sidecars = sent.transaction.outputs.map((output, index) => (same(output.lockingBytecode, sharedLock) ? index : -1))
      .filter((index) => index >= 0);
    expect(sidecars).toEqual([master + 3, master + 4]);
    expect(inputPasses(s.provider, withOutput(sent, sidecars[1]!, bumpCommitment), master)).toBe(false);
  });
});

describe('an ordinary call of a sized function that msg.sender keys', () => {
  const SOURCE = `${P} contract T { int[] a; mapping(address => int) owner;
      function f(int x) external returns (bool) { a.push(x); owner[msg.sender] = x; return true; } }`;

  it('keys the entry by its sender and lays out the array\'s chunk, with its record', async () => {
    const s = setup();
    const t = await s.deploy(compileString(SOURCE, compileOptions('T')));
    const wallet = await s.wallet();
    await (t.contract.connect(wallet) as any).call.f(9n).emitReturn().send();
    const sent = s.sent[s.sent.length - 1]!;
    expect(createVirtualMachineBch2026ForProvider(s.provider).verify(sent as never)).toBe(true);
    expect(await (t.contract as any).owner(addressToLockScript(wallet.getAddress()))).toBe(9n);
  });
});
