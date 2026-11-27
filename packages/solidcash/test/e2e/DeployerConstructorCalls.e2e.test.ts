/**
 * A7, A14 items 4 and 5: creations whose constructor calls other contracts, on the one creation path.
 *
 * A constructor that calls may also write collections, emit events, send satoshis and hash through a side-car. The
 * callee's block may spend and write its own mapping entries (an ERC20-shaped `transfer`), and a void callee answers
 * under `callRecords: 'all'`. A creating call lays its child's callee blocks after the creator's. The tamper cases run
 * a finished creation with one thing changed and expect the VM to refuse the covenant input that checks it.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress,
  vmNumberToBigInt,
} from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { keccakComputeLockingBytecode } from '@solidcash/utils';
import { compileString, compileStringMulti } from '../direct-compile.js';
import { Contract, SignatureTemplate, Signer } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { broadcastDeployerPreps, buildDeployerPrep } from '../../src/stateful/deployer.js';
import { getEntryNftAddress } from '../../src/stateful/covenant-helpers.js';
import { computeSideCarStandIn } from '../../src/stateful/stateful-abi-resolve.js';
import { bytesToSlotValue, keyToSlot, SortedList } from '../../src/stateful/SortedList.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { addressToLockScript, solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { alicePkh, alicePriv, bobPkh } from '../fixture/vars.js';
import type { Artifact } from '@solidcash/utils';
import type { Unlocker, Utxo } from '../../src/interfaces.js';
import type { DeployFromResult, DeployResult } from '../../src/stateful/stateful-lifecycle-types.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const P = 'pragma solidcash ^0.53.0;';
const compileOptions = (primary: string, extra: Record<string, unknown> = {}): never => ({
  deployer: true, genesisCalls: true, primaryContractName: primary, ...extra,
}) as never;

let serial = 0x100;
const nextTxid = (): string => (serial++).toString(16).padStart(64, '0');

interface Setup {
  provider: MockNetworkProvider;
  authorLock: Uint8Array;
  changeAddress: string;
  funder: Unlocker;
  /** A plain coin at the author's lock. */
  fund(satoshis?: bigint): Promise<Utxo>;
  /** A top-level deployment funded by a new coin. */
  deploy(artifact: Artifact, extra?: Record<string, unknown>): Promise<DeployResult<Artifact>>;
  /** The author's wallet as a Signer, with four coins for its calls. */
  signer(): Promise<Signer>;
}

type Captured = { transaction: ReturnType<typeof decodeTransactionUnsafe>; sourceOutputs: any[] };

function setup(): Setup {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
  const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
  const fund = async (satoshis = 2_000_000n): Promise<Utxo> => {
    const utxo: Utxo = { txid: nextTxid(), vout: 0, satoshis };
    await provider.seedUtxo(binToHex(authorLock), utxo);
    return utxo;
  };
  const deploy = async (artifact: Artifact, extra: Record<string, unknown> = {}): Promise<DeployResult<Artifact>> => (
    StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo: await fund(), funder, changeAddress: change.address, senderLockingBytecode: authorLock,
      ...extra,
    } as never));
  const signer = async (): Promise<Signer> => {
    const wallet = new Signer(alicePriv, provider);
    for (let index = 0; index < 4; index += 1) {
      await provider.seedUtxo(wallet.getAddress(), { txid: nextTxid(), vout: 0, satoshis: 200_000n });
    }
    return wallet;
  };
  return { provider, authorLock, changeAddress: change.address, funder, fund, deploy, signer };
}

/**
 * Run `send` with the creation, the transaction that spends a coin at `deployerLock`, captured instead of broadcast.
 * Every other transaction goes through. Returns the creation and the outputs its inputs spend.
 */
async function captureCreation(
  provider: MockNetworkProvider, deployerLock: string, send: () => Promise<unknown>,
): Promise<Captured> {
  const original = provider.sendRawTransaction.bind(provider);
  let captured: Captured | undefined;
  (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
    const transaction = decodeTransactionUnsafe(hexToBin(hex));
    const sourceOutputs = await Promise.all(transaction.inputs.map(async (input) => {
      const spent = await provider.getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex);
      if (spent === undefined) throw new Error('an input of the transaction is not on the ledger');
      return solidCashOutputToLibauthOutput({
        to: spent.lockingBytecode, amount: spent.satoshis, ...(spent.token === undefined ? {} : { token: spent.token }),
      });
    }));
    if (!sourceOutputs.some((output) => binToHex(output.lockingBytecode) === deployerLock)) return original(hex);
    captured = { transaction, sourceOutputs };
    throw new Error('creation captured');
  };
  try {
    await expect(send()).rejects.toThrow('creation captured');
  } finally {
    (provider as any).sendRawTransaction = original;
  }
  return captured!;
}

/** The VM's verdict on one input of `transaction`. */
function inputPasses(provider: MockNetworkProvider, transaction: any, sourceOutputs: any[], inputIndex: number): boolean {
  const vm = createVirtualMachineBch2026ForProvider(provider);
  return vm.stateSuccess(vm.evaluate({ transaction, sourceOutputs, inputIndex } as never) as never) === true;
}

const CALLEE = `interface I { function f(int x) external returns (bool); }
  contract T { int total; function f(int x) external returns (bool) { total = total + x; return true; } }`;

describe('a constructor that calls, on the one creation path (A7, A14 item 5)', () => {
  const MIXED = `${P} ${CALLEE}
    contract C { bool ok; mapping(int => int) m; event Made(int v);
      constructor(I i, address payee) payable { ok = i.f(5); m[1] = 2; emit Made(7); payable(payee).transfer(1500); }
      function read(int k, int v) { require(ok); require(m[k] == v); } }`;

  it('calls, writes a mapping, emits an event and sends satoshis in one creation', async () => {
    const { deploy, signer } = setup();
    const t = await deploy(compileString(MIXED, compileOptions('T')));
    const cArtifact = compileString(MIXED, compileOptions('C'));
    expect(cArtifact.deployer?.callSlots).toBe(1);
    const payee = encodeLockingBytecodeP2pkh(bobPkh);
    const tLock = addressToLockScript(t.contract.address);
    const c = await deploy(cArtifact, {
      initArgs: [tLock, payee], initialBalance: 3000n,
      constructorCallees: [{ contract: t.contract, args: [5n] }],
    });

    expect(((await t.contract.getState()) as { total?: bigint }).total).toBe(5n);
    expect(((await c.contract.getState()) as { ok?: boolean }).ok).toBe(true);
    expect(c.tx.outputs.some((output) => binToHex(output.lockingBytecode) === binToHex(payee)
      && output.valueSatoshis === 1500n)).toBe(true);
    expect((c.tx as any).events?.map((event: any) => [event.event, event.args.v])).toEqual([['Made', 7n]]);

    // The layout: the callee's master at output 2, beside its input; its carrier after it; then C's master.
    const outputs = c.tx.outputs;
    const tMasterOut = outputs.findIndex((output) => binToHex(output.lockingBytecode) === binToHex(tLock));
    const carrier = outputs.findIndex((output) => output.token !== undefined
      && binToHex(output.token.category) === t.categoryId && output.token.nft?.capability === 'none');
    const cMaster = outputs.findIndex((output) => output.token?.nft?.capability === 'minting'
      && binToHex(output.token.category) === c.categoryId);
    expect(tMasterOut).toBe(2);
    expect(carrier).toBeGreaterThan(tMasterOut);
    expect(cMaster).toBeGreaterThan(carrier);

    const wallet = await signer();
    await (c.contract.connect(wallet) as any).call.read(1n, 2n).send();
  });

  it('refuses a creation whose record carrier moved or whose callee list names another input', async () => {
    const { provider, authorLock, changeAddress, funder, fund, deploy } = setup();
    const t = await deploy(compileString(MIXED, compileOptions('T')));
    const cArtifact = compileString(MIXED, compileOptions('C'));
    const fundingUtxo = await fund();
    const { prep } = await buildDeployerPrep({
      children: [{ deployer: cArtifact.deployer!, contractName: cArtifact.contractName }],
      fundingUtxos: [fundingUtxo], authorSigner: funder, authorLockingBytecode: authorLock,
      changeLockingBytecode: authorLock, provider,
    });
    await broadcastDeployerPreps([prep], provider);
    const tLock = addressToLockScript(t.contract.address);
    const { transaction, sourceOutputs } = await captureCreation(provider, cArtifact.deployer!.lockingBytecode,
      () => StatefulContract.deploy(cArtifact, [], {
        provider, fundingUtxo, funder, changeAddress, senderLockingBytecode: authorLock,
        deployerPrep: prep, initArgs: [tLock, encodeLockingBytecodeP2pkh(bobPkh)], initialBalance: 3000n,
        constructorCallees: [{ contract: t.contract, args: [5n] }],
      } as never));
    const calleeMaster = sourceOutputs.findIndex((output) => binToHex(output.lockingBytecode) === binToHex(tLock));
    expect(calleeMaster).toBeGreaterThan(0);
    expect(createVirtualMachineBch2026ForProvider(provider).verify({ transaction, sourceOutputs } as never)).toBe(true);

    // The carrier swapped with the change at output 1: create reads the record where the change now is.
    const carrier = transaction.outputs.findIndex((output) => output.token !== undefined
      && binToHex(output.token.category) === t.categoryId && output.token.nft?.capability === 'none');
    const moved = { ...transaction, outputs: [...transaction.outputs] };
    [moved.outputs[1], moved.outputs[carrier]] = [moved.outputs[carrier], moved.outputs[1]];
    expect(inputPasses(provider, moved, sourceOutputs, 0)).toBe(false);
    expect(inputPasses(provider, moved, sourceOutputs, calleeMaster)).toBe(false);

    // The callee list's entry for slot 0 (bytes 6 and 7 of create's unlocking) names the next input.
    const unlocking = Uint8Array.from(transaction.inputs[0].unlockingBytecode);
    expect(unlocking[6] | (unlocking[7] << 8)).toBe(calleeMaster);
    unlocking[6] += 1;
    const relisted = {
      ...transaction,
      inputs: transaction.inputs.map((input, index) => (index === 0 ? { ...input, unlockingBytecode: unlocking } : input)),
    };
    expect(inputPasses(provider, relisted, sourceOutputs, 0)).toBe(false);
  });

  it('co-spends a keccak side-car beside a call (A4.4)', async () => {
    const { provider, deploy } = setup();
    const source = `${P} ${CALLEE}
      contract C { bool ok; bytes32 h; constructor(I i, bytes b) { ok = i.f(5); h = keccak256(b); }
        function read() { require(ok); } }`;
    const sharedLock = keccakComputeLockingBytecode(new Uint8Array(32), true);
    await provider.seedUtxo(binToHex(sharedLock), computeSideCarStandIn('keccak-deployer-call', sharedLock, 0));
    const t = await deploy(compileString(source, compileOptions('T')));
    const cArtifact = compileString(source, compileOptions('C'));
    expect(cArtifact.deployer?.sidecars.keccak).toBe(1);
    const preimage = Uint8Array.from([1, 2, 3]);
    const tLock = addressToLockScript(t.contract.address);
    const c = await deploy(cArtifact, {
      initArgs: [tLock, preimage], constructorCallees: [{ contract: t.contract, args: [5n] }],
    });
    const state = (await c.contract.getState()) as { ok?: boolean; h?: Uint8Array };
    expect(state.ok).toBe(true);
    expect(binToHex(state.h!)).toBe(binToHex(keccak_256(preimage)));
    expect(((await t.contract.getState()) as { total?: bigint }).total).toBe(5n);
    // The side-car is the first paired group: its input and its recreation share index 2; the callee follows it.
    const sidecarIndex = c.tx.outputs.findIndex((output) => binToHex(output.lockingBytecode) === binToHex(sharedLock));
    expect(sidecarIndex).toBe(2);
    expect(binToHex(c.tx.outputs[3].lockingBytecode)).toBe(binToHex(tLock));
  });
});

const ERC20 = `${P} interface IT { function transfer(address to, uint256 amount) external returns (bool); }
  contract Token { mapping(address => uint256) balances; event Transfer(address from, address to, uint256 value);
    function mint(address to, uint256 amount) public { balances[to] += amount; }
    function transfer(address to, uint256 amount) external returns (bool) {
      balances[msg.sender] -= amount; balances[to] += amount; emit Transfer(msg.sender, to, amount); return true; } }
  contract Holder { bool ok; constructor(IT token, address owner, uint256 supply) { ok = token.transfer(owner, supply); }
    function read() { require(ok); } }`;

// USDT's `transfer` returns nothing (TetherToken.sol): it answers a constructor only under `callRecords: 'all'`.
const USDT = `${P} interface IUsdt { function transfer(address to, uint256 value) external; }
  contract Tether { mapping(address => uint256) balances; uint256 basisPointsRate;
    event Transfer(address from, address to, uint256 value);
    function issue(address to, uint256 amount) public { balances[to] += amount; }
    function transfer(address to, uint256 value) external {
      uint256 fee = (value * basisPointsRate) / 10000;
      balances[msg.sender] -= value; balances[to] += value - fee; emit Transfer(msg.sender, to, value - fee); } }
  contract Holder { bool ok;
    constructor(IUsdt token, address owner, uint256 supply) { token.transfer(owner, supply); ok = true; }
    function read() { require(ok); } }`;

/**
 * A token's `transfer` called by a constructor: the child is credited before it exists (at the master lock its prep
 * fixes), and its constructor moves the units to `owner`. `owner` is chosen by where its key sorts against the child's:
 * above it, the insert's predecessor is the child's own entry, which the update spends; below it, the predecessor is
 * the list's HEAD, relinked after the paired region; `existing` makes both writes updates.
 */
async function tokenTransferCase(options: {
  source: string; token: string; credit: 'mint' | 'issue'; tokenOptions?: Record<string, unknown>;
  owner: 'above' | 'below' | 'existing';
}): Promise<void> {
  const { provider, authorLock, changeAddress, funder, fund, deploy, signer } = setup();
  const token = await deploy(compileString(options.source, compileOptions(options.token, options.tokenOptions)));
  const holderArtifact = compileString(options.source, compileOptions('Holder'));
  const fundingUtxo = await fund();
  const { prep } = await buildDeployerPrep({
    children: [{ deployer: holderArtifact.deployer!, contractName: 'Holder' }],
    fundingUtxos: [fundingUtxo], authorSigner: funder, authorLockingBytecode: authorLock,
    changeLockingBytecode: authorLock, provider,
  });
  const holderLock = hexToBin(new Contract(holderArtifact, [], { provider, category: hexToBin(prep.category) })
    .lockingBytecode);
  const slotOf = (lock: Uint8Array): bigint => bytesToSlotValue(keyToSlot(lock));
  const candidates = Array.from({ length: 64 }, (_, index) => encodeLockingBytecodeP2pkh(
    new Uint8Array(20).fill(index + 1),
  ));
  const owner = options.owner === 'existing' ? encodeLockingBytecodeP2pkh(bobPkh)
    : candidates.find((lock) => (options.owner === 'above') === (slotOf(lock) > slotOf(holderLock)))!;
  const wallet = await signer();
  const connected = token.contract.connect(wallet) as any;
  await connected.call[options.credit](holderLock, 1000n).send();
  if (options.owner === 'existing') await connected.call[options.credit](owner, 5n).send();

  const tokenLock = addressToLockScript(token.contract.address);
  const entryAddress = getEntryNftAddress(token.contract.inner as never, token.categoryId, 'balances');
  const entriesBefore = new Set((await provider.getUtxos(entryAddress)).map((utxo) => `${utxo.txid}:${utxo.vout}`));
  const holder = await StatefulContract.deploy(holderArtifact, [], {
    provider, fundingUtxo, funder, changeAddress, senderLockingBytecode: authorLock, deployerPrep: prep,
    initArgs: [tokenLock, owner, 1000n], constructorCallees: [{ contract: token.contract }],
  } as never);
  const balance = async (lock: Uint8Array): Promise<bigint | undefined> => {
    const entry = SortedList.fromUtxos(await provider.getUtxos(entryAddress)).find(keyToSlot(lock));
    return entry === undefined ? undefined : vmNumberToBigInt(entry.value, { requireMinimalEncoding: false }) as bigint;
  };
  expect(binToHex(hexToBin(holder.contract.inner.lockingBytecode))).toBe(binToHex(holderLock));
  // The token's block: its master, its records, the two entry slots, its event. The owner's slot spends an entry
  // unless that entry is the child's own, which the first slot spends; only an insert after HEAD relinks a node after
  // the paired region.
  const master = holder.tx.outputs.findIndex((output) => binToHex(output.lockingBytecode) === binToHex(tokenLock));
  const records = token.contract.inner.artifact.stateLayout?.dataNftCount ?? 0;
  const spends = (index: number): string => {
    const input = holder.tx.inputs[index];
    return `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`;
  };
  expect(entriesBefore.has(spends(master + 1 + records))).toBe(true);
  expect(entriesBefore.has(spends(master + 2 + records))).toBe(options.owner !== 'above');
  const relinked = holder.tx.outputs.filter((output, index) => index > master + 3 + records
    && output.token !== undefined && binToHex(output.token.category) === token.categoryId
    && output.token.nft?.capability === 'mutable');
  expect(relinked).toHaveLength(options.owner === 'below' ? 1 : 0);
  expect(await balance(holderLock)).toBe(0n);
  expect(await balance(owner)).toBe(options.owner === 'existing' ? 1005n : 1000n);
  expect(((await holder.contract.getState()) as { ok?: boolean }).ok).toBe(true);
  // The token's own Transfer event, minted by its run inside the creation.
  const { getEventNftAddress } = await import('../../src/stateful/covenant-helpers.js');
  const eventLock = addressToLockScript(getEventNftAddress(
    token.contract.inner as never, token.categoryId, 'Transfer(address,address,uint256)',
  ));
  expect(holder.tx.outputs.filter((output) => binToHex(output.lockingBytecode) === binToHex(eventLock))).toHaveLength(1);
  await (holder.contract.connect(wallet) as any).call.read().send();
}

describe('ERC20- and USDT-shaped callees of a constructor (A7, Part C)', () => {
  it('transfers from the child to a new owner whose key sorts above the child', async () => {
    await tokenTransferCase({ source: ERC20, token: 'Token', credit: 'mint', owner: 'above' });
  });

  it('transfers from the child to a new owner whose key sorts below the child', async () => {
    await tokenTransferCase({ source: ERC20, token: 'Token', credit: 'mint', owner: 'below' });
  });

  it('transfers from the child to an owner that holds units already', async () => {
    await tokenTransferCase({ source: ERC20, token: 'Token', credit: 'mint', owner: 'existing' });
  });

  it("calls a USDT-shaped token's void transfer compiled with callRecords all", async () => {
    await tokenTransferCase({
      source: USDT, token: 'Tether', credit: 'issue', tokenOptions: { callRecords: 'all' }, owner: 'below',
    });
  });

  it('approves a spender from the child: the nested key is the child and the spender', async () => {
    const { provider, deploy } = setup();
    const source = `${P} interface IA { function approve(address spender, uint256 amount) external returns (bool); }
      contract Token { mapping(address => mapping(address => uint256)) allowance;
        function approve(address spender, uint256 amount) external returns (bool) {
          allowance[msg.sender][spender] = amount; return true; } }
      contract Holder { bool ok; constructor(IA token, address spender) { ok = token.approve(spender, 77); }
        function read() { require(ok); } }`;
    const token = await deploy(compileString(source, compileOptions('Token')));
    const spender = encodeLockingBytecodeP2pkh(bobPkh);
    const holder = await deploy(compileString(source, compileOptions('Holder')), {
      initArgs: [addressToLockScript(token.contract.address), spender], constructorCallees: [{ contract: token.contract }],
    });
    const { keyToSlotMulti } = await import('../../src/stateful/SortedList.js');
    const collection = token.contract.inner.artifact.stateLayout!.collections!.find((entry) => entry.name === 'allowance');
    const entries = await provider.getUtxos(getEntryNftAddress(token.contract.inner as never, token.categoryId, 'allowance'));
    const entry = SortedList.fromUtxos(entries)
      .find(keyToSlotMulti([addressToLockScript(holder.contract.address), spender], collection));
    expect(entry).toBeDefined();
    expect(vmNumberToBigInt(entry!.value, { requireMinimalEncoding: false })).toBe(77n);
    expect(((await holder.contract.getState()) as { ok?: boolean }).ok).toBe(true);
  });

  it('refuses a void USDT-shaped transfer compiled without callRecords all, before building', async () => {
    const { deploy } = setup();
    const token = await deploy(compileString(USDT, compileOptions('Tether')));
    const holderArtifact = compileString(USDT, compileOptions('Holder'));
    await expect(deploy(holderArtifact, {
      initArgs: [addressToLockScript(token.contract.address), encodeLockingBytecodeP2pkh(bobPkh), 1000n],
      constructorCallees: [{ contract: token.contract }],
    })).rejects.toThrow(/callRecords: 'all'/);
  });

  it('refuses an ERC20 creation whose callee input or record is changed', async () => {
    const { provider, authorLock, changeAddress, funder, fund, deploy, signer } = setup();
    const token = await deploy(compileString(ERC20, compileOptions('Token')));
    const holderArtifact = compileString(ERC20, compileOptions('Holder'));
    const fundingUtxo = await fund();
    const { prep } = await buildDeployerPrep({
      children: [{ deployer: holderArtifact.deployer!, contractName: 'Holder' }],
      fundingUtxos: [fundingUtxo], authorSigner: funder, authorLockingBytecode: authorLock,
      changeLockingBytecode: authorLock, provider,
    });
    await broadcastDeployerPreps([prep], provider);
    const holderLock = hexToBin(new Contract(holderArtifact, [], { provider, category: hexToBin(prep.category) })
      .lockingBytecode);
    const wallet = await signer();
    await (token.contract.connect(wallet) as any).call.mint(holderLock, 1000n).send();
    const tokenLock = addressToLockScript(token.contract.address);
    const { transaction, sourceOutputs } = await captureCreation(provider, holderArtifact.deployer!.lockingBytecode,
      () => StatefulContract.deploy(holderArtifact, [], {
        provider, fundingUtxo, funder, changeAddress, senderLockingBytecode: authorLock, deployerPrep: prep,
        initArgs: [tokenLock, encodeLockingBytecodeP2pkh(bobPkh), 1000n], constructorCallees: [{ contract: token.contract }],
      } as never));
    expect(createVirtualMachineBch2026ForProvider(provider).verify({ transaction, sourceOutputs } as never)).toBe(true);
    const calleeMaster = sourceOutputs.findIndex((output) => binToHex(output.lockingBytecode) === binToHex(tokenLock));

    // The token's record says it moved one unit fewer: create's digest still matches, its result does not.
    const carrier = transaction.outputs.findIndex((output) => output.token !== undefined
      && binToHex(output.token.category) === token.categoryId && output.token.nft?.capability === 'none'
      && binToHex(output.lockingBytecode) === '51');
    const record = Uint8Array.from(transaction.outputs[carrier].token!.nft!.commitment);
    record[record.length - 1] ^= 1;
    const forged = {
      ...transaction,
      outputs: transaction.outputs.map((output, index) => (index !== carrier ? output : {
        ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: record } },
      })),
    };
    expect(inputPasses(provider, forged, sourceOutputs, 0)).toBe(false);
    expect(inputPasses(provider, forged, sourceOutputs, calleeMaster)).toBe(false);

    // The callee's genesis call names another slot: its record no longer answers slot 0, and its sender check fails.
    const frame = Uint8Array.from(transaction.inputs[calleeMaster].unlockingBytecode);
    const x = hexToBin(prep.category).reverse();
    const tag = frame.findIndex((_, at) => x.every((byte, offset) => frame[at + offset] === byte));
    expect(tag).toBeGreaterThan(0);
    frame[tag + 32] = 1;
    const reslotted = {
      ...transaction,
      inputs: transaction.inputs.map((input, index) => (
        index === calleeMaster ? { ...input, unlockingBytecode: frame } : input)),
    };
    expect(inputPasses(provider, reslotted, sourceOutputs, calleeMaster)).toBe(false);
  });
});

describe('callees that take the child as msg.sender (A7, Part C)', () => {
  it('reaches a msg.sender reader through a helper function: the callee stores the child', async () => {
    const { deploy } = setup();
    const source = `${P} interface I { function reg() external returns (bool); }
      contract T { address last; function reg() external returns (bool) { last = msg.sender; return true; } }
      contract C { bool ok; constructor(I i) { ok = enroll(i); }
        function enroll(I i) internal returns (bool) { return i.reg(); }
        function read() { require(ok); } }`;
    const t = await deploy(compileString(source, compileOptions('T')));
    const cArtifact = compileString(source, compileOptions('C'));
    expect(cArtifact.deployer?.callSlots).toBe(1);
    const c = await deploy(cArtifact, {
      initArgs: [addressToLockScript(t.contract.address)], constructorCallees: [{ contract: t.contract, args: [] }],
    });
    const last = ((await t.contract.getState()) as { last?: Uint8Array }).last;
    expect(binToHex(last!)).toBe(binToHex(addressToLockScript(c.contract.address)));
  });

  it('calls a void register compiled with callRecords all: the registry keys x by the child', async () => {
    const { provider, deploy } = setup();
    const source = `${P} interface IR { function register(int x) external; }
      contract Registry { mapping(address => int) registered;
        function register(int x) external { registered[msg.sender] = x; } }
      contract C { bool ok; constructor(IR r) { r.register(9); ok = true; } function read() { require(ok); } }`;
    const registry = await deploy(compileString(source, compileOptions('Registry', { callRecords: 'all' })));
    const c = await deploy(compileString(source, compileOptions('C')), {
      initArgs: [addressToLockScript(registry.contract.address)], constructorCallees: [{ contract: registry.contract }],
    });
    const entries = await provider.getUtxos(
      getEntryNftAddress(registry.contract.inner as never, registry.categoryId, 'registered'),
    );
    const entry = SortedList.fromUtxos(entries).find(keyToSlot(addressToLockScript(c.contract.address)));
    expect(entry).toBeDefined();
    expect(vmNumberToBigInt(entry!.value, { requireMinimalEncoding: false })).toBe(9n);
  });
});

describe('a creating call whose child calls a contract (A14 item 4)', () => {
  const FACTORY = `${CALLEE}
    contract Child { bool ok; constructor(I t) { ok = t.f(5); } function read() { require(ok); } }
    contract Factory { int made; function make(I t) { new Child(t); made = made + 1; } }`;

  it('runs the child constructor\'s call inside the factory call, and refuses a changed callee list', async () => {
    const { provider, authorLock, changeAddress, funder, fund, signer } = setup();
    const artifacts = compileStringMulti(FACTORY, {
      allowUnsafeOperations: true, __deployerNew: true, genesisCalls: true,
    } as never);
    const childDeployer = artifacts.Factory.childDeployers?.Child;
    expect(childDeployer?.callSlots).toBe(1);
    const t = await StatefulContract.deploy(artifacts.T, [], {
      provider, fundingUtxo: await fund(), funder, initialState: { total: 0n }, changeAddress,
      senderLockingBytecode: authorLock,
    });
    const factory = await StatefulContract.deploy(artifacts.Factory, [], {
      provider, fundingUtxo: await fund(), funder, initialState: { made: 0n }, changeAddress,
      senderLockingBytecode: authorLock,
    });
    const tLock = addressToLockScript(t.contract.address);
    const make = (fundingUtxo: Utxo): Promise<DeployFromResult<Artifact>> => StatefulContract.deployFrom({
      provider, factory: factory.contract, deployFunctionName: 'make', deployFunctionArgs: [tLock],
      childArtifact: artifacts.Child, childConstructorArgs: [tLock], fundingUtxo, funder, changeAddress,
      childConstructorCallees: [{ contract: t.contract }],
    });
    const result = await make(await fund());
    expect(((await result.child.getState()) as { ok?: boolean }).ok).toBe(true);
    expect(((await t.contract.getState()) as { total?: bigint }).total).toBe(5n);
    expect(((await result.factory.getState()) as { made?: bigint }).made).toBe(1n);
    // The callee's block follows the creator's layout: its master pairs with its output, after the child's group.
    const childMaster = result.tx.outputs.findIndex((output) => output.token?.nft?.capability === 'minting'
      && binToHex(output.token.category) === result.childCategoryId);
    const tMaster = result.tx.outputs.findIndex((output) => binToHex(output.lockingBytecode) === binToHex(tLock));
    expect(tMaster).toBeGreaterThan(childMaster);
    const wallet = await signer();
    await (result.child.connect(wallet) as any).call.read().send();

    // A second child under capture: its callee list names the input after the callee's master.
    const { transaction, sourceOutputs } = await captureCreation(provider, childDeployer!.lockingBytecode,
      async () => make(await fund()));
    expect(createVirtualMachineBch2026ForProvider(provider).verify({ transaction, sourceOutputs } as never)).toBe(true);
    const dIn = sourceOutputs.findIndex((output) => binToHex(output.lockingBytecode) === childDeployer!.lockingBytecode);
    const unlocking = Uint8Array.from(transaction.inputs[dIn].unlockingBytecode);
    unlocking[6] += 1;
    const relisted = {
      ...transaction,
      inputs: transaction.inputs.map((input, index) => (index === dIn ? { ...input, unlockingBytecode: unlocking } : input)),
    };
    expect(inputPasses(provider, relisted, sourceOutputs, dIn)).toBe(false);
  });

  /** A factory of `factory`'s source and a callee T, deployed, and a creating call of `make` with `args`. */
  async function creatingCall(factorySource: string): Promise<{
    provider: MockNetworkProvider; t: DeployResult<Artifact>; tLock: Uint8Array;
    make: (args: unknown[]) => Promise<DeployFromResult<Artifact>>;
  }> {
    const { provider, authorLock, changeAddress, funder, fund } = setup();
    const artifacts = compileStringMulti(`${CALLEE}
      contract Child { bool ok; constructor(I t) { ok = t.f(5); } function read() { require(ok); } }
      ${factorySource}`, { allowUnsafeOperations: true, __deployerNew: true, genesisCalls: true } as never);
    const t = await StatefulContract.deploy(artifacts.T, [], {
      provider, fundingUtxo: await fund(), funder, initialState: { total: 0n }, changeAddress,
      senderLockingBytecode: authorLock,
    });
    const factory = await StatefulContract.deploy(artifacts.Factory, [], {
      provider, fundingUtxo: await fund(), funder, initialState: { made: 0n }, changeAddress,
      senderLockingBytecode: authorLock,
    });
    const make = async (args: unknown[]): Promise<DeployFromResult<Artifact>> => StatefulContract.deployFrom({
      provider, factory: factory.contract, deployFunctionName: 'make', deployFunctionArgs: args as never,
      childArtifact: artifacts.Child, fundingUtxo: await fund(), funder, changeAddress,
      childConstructorCallees: [{ contract: t.contract }],
    });
    return { provider, t, tLock: addressToLockScript(t.contract.address), make };
  }

  it('binds the callee the creator\'s run passes, given no constructor arguments', async () => {
    const { t, tLock, make } = await creatingCall(`contract Factory { int made;
      function make(I t, int z) { I u = t; if (z > 0) { new Child(u); } made = made + 1; } }`);
    const result = await make([tLock, 1n]);
    expect(((await result.child.getState()) as { ok?: boolean }).ok).toBe(true);
    expect(((await t.contract.getState()) as { total?: bigint }).total).toBe(5n);
  });

  it('refuses a loop whose two children call one contract, before broadcasting', async () => {
    const { provider, t, tLock, make } = await creatingCall(`contract Factory { int made;
      function make(I t, int k) { for (int i = 0; i < k; i++) { new Child(t); } made = made + k; } }`);
    const sent: string[] = [];
    const original = provider.sendRawTransaction.bind(provider);
    (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
      sent.push(hex);
      return original(hex);
    };
    await expect(make([tLock, 2n])).rejects.toThrow(new RegExp('deployment 1 \\(\'Child\'\\) calls it, and its master is '
      + 'already an input of call slot 0 of deployment 0 .* one master runs one arm'));
    expect(sent).toHaveLength(0);
    expect(((await t.contract.getState()) as { total?: bigint }).total).toBe(0n);
  });
});
