import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { validatorAddress } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import {
  FramedProxyDeployError, buildProxyArtifact, callFramedProxyEntry, deployFramedProxy,
  type FramedProxyCallResult,
} from '../../../src/framed/proxy/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A proxied root pulls a plain token whose entry reads a mapping key beside the balance batch it writes, through
 * the shipped hop, `callFramedProxyEntry`.
 *
 * The fixture's `publishJobPost` pulls through `SafeERC20.safeTransferFrom`, whose token reads
 * `allowances[from][msg.sender]` and rewrites `balances[from]` and `balances[to]`. The hop plans a callee's read
 * nodes first and declares them kept, ahead of its batch's groups, as the direct call path does (815535a89): the
 * batch planner (`proxy/entry-writes.ts`, `planHopMappingBatches`) takes a read at one of those nodes' slots as the
 * caller's (`declaredReadSlots`), and a batch it still cannot state is refused by name, naming the callee
 * (`proxy/external-calls.ts`, `calleeEntryWrites`). Before it, that refusal was dropped and the callee frame ran
 * with its read node and none of the batch's, splitting past the end of a 2-byte item at its first group read.
 *
 * A pull within the allowance settles, and one past it is refused by the token's own check; a read of one key of
 * the batch's own collection settles when the batch does not spend its node and is refused by name when it does,
 * since one transaction cannot spend that node twice; a pull that reads no mapping settles. The file runs only
 * under `FRAMED_AHEAD=1`.
 */

/** A 32-byte id with varied bytes, `seed` chosen so each name is distinct. */
function category(seed: string): string {
  const base = '7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2';
  return `${seed}${base}${base}`.slice(0, 64);
}

const COIN_CATEGORY = category('1c');
const ROOT_IMPL_CATEGORY = category('2d');
const ROOT_PROXY_CATEGORY = category('3e');

/** A framed contract's address, which its category fixes before anything is deployed. */
const addressOf = (id: string): Uint8Array => validatorAddress(hexToBin(id), VALIDATOR_PROGRAM);

const PAYER = encodeLockingBytecodeP2pkh(alicePkh);
/** A third holder of the token, whose balance node neither the payer's nor the root's is. */
const THIRD = hexToBin(`a914${'5d2e7f4a1b8c3d6e9f0a2b4c6d8e1f3a5b7c9d0e'}87`);

const SOURCE = [
  'pragma solidcash ^0.14.0;',
  'interface ICoin {',
  '  function transferFrom(address from, address to, uint amount) returns (bool);',
  '  function transferVia(address from, address to, address witness, uint amount) returns (bool);',
  '  function transferPlain(address from, address to, uint amount) returns (bool);',
  '  function approve(address spender, uint amount) returns (bool);',
  '  function transferSkewed(address from, address to, uint amount) returns (bool);',
  '  function transferCapped(address from, address to, uint amount) returns (bool);',
  '}',
  'contract Coin {',
  '  mapping(address => uint) balances;',
  '  mapping(address => mapping(address => uint)) allowances;',
  '  constructor(address holder, uint held, address pool, uint pooled, address third, uint thirds) {',
  '    this.balances[holder] = held;',
  '    this.balances[pool] = pooled;',
  '    this.balances[third] = thirds;',
  '  }',
  '  function approve(address spender, uint amount) returns (bool) {',
  '    this.allowances[msg.sender][spender] = amount;',
  '    return true;',
  '  }',
  '  function balanceOf(address who) view returns (uint) { return this.balances[who]; }',
  '  function transferFrom(address from, address to, uint amount) returns (bool) {',
  '    require(this.allowances[from][msg.sender] >= amount, "short allowance");',
  '    this.balances[from] = this.balances[from] - amount;',
  '    this.balances[to] = this.balances[to] + amount;',
  '    return true;',
  '  }',
  '  function transferVia(address from, address to, address witness, uint amount) returns (bool) {',
  '    require(this.balances[witness] > 0, "no witness");',
  '    this.balances[from] = this.balances[from] - amount;',
  '    this.balances[to] = this.balances[to] + amount;',
  '    return true;',
  '  }',
  '  function transferPlain(address from, address to, uint amount) returns (bool) {',
  '    this.balances[from] = this.balances[from] - amount;',
  '    this.balances[to] = this.balances[to] + amount;',
  '    return true;',
  '  }',
  // The allowance's access sits between the two balance accesses, so the artifact groups them into batches whose
  // flattened slot order is not the source order: balances[to] (slot 0), the allowance (slot 1), balances[from].
  '  function transferSkewed(address from, address to, uint amount) returns (bool) {',
  '    this.balances[to] = this.balances[to] + amount;',
  '    require(this.allowances[from][msg.sender] >= amount, "short allowance");',
  '    this.allowances[from][msg.sender] = this.allowances[from][msg.sender] - amount;',
  '    this.balances[from] = this.balances[from] - amount;',
  '    return true;',
  '  }',
  // A granted cap is read but not written: the body takes the arm that spends nothing, so the node the granting
  // frame created is only read by this one.
  '  function transferCapped(address from, address to, uint amount) returns (bool) {',
  '    this.balances[to] = this.balances[to] + amount;',
  '    if (this.allowances[from][msg.sender] != type(uint256).max) {',
  '      require(this.allowances[from][msg.sender] >= amount, "short allowance");',
  '      this.allowances[from][msg.sender] = this.allowances[from][msg.sender] - amount;',
  '    }',
  '    this.balances[from] = this.balances[from] - amount;',
  '    return true;',
  '  }',
  '}',
  'contract Root {',
  '  address public implementation;',
  '  int public pulls;',
  '  function initialize(int n) { this.pulls = n; require(true); }',
  '  function pull(address coin, uint amount) {',
  '    ICoin(coin).transferFrom(msg.sender, address(this), amount);',
  '    this.pulls = this.pulls + 1;',
  '  }',
  '  function pullVia(address coin, address witness, uint amount) {',
  '    ICoin(coin).transferVia(msg.sender, address(this), witness, amount);',
  '    this.pulls = this.pulls + 1;',
  '  }',
  '  function pullPlain(address coin, uint amount) {',
  '    ICoin(coin).transferPlain(msg.sender, address(this), amount);',
  '    this.pulls = this.pulls + 1;',
  '  }',
  '  function pullSelf(address coin, address to, uint amount) {',
  '    ICoin(coin).approve(address(this), amount);',
  '    ICoin(coin).transferFrom(address(this), to, amount);',
  '    this.pulls = this.pulls + 1;',
  '  }',
  '  function pullComputed(address coin, address to, uint amount) {',
  '    ICoin(coin).approve(address(this), amount + 1);',
  '    ICoin(coin).transferFrom(address(this), to, amount);',
  '    this.pulls = this.pulls + 1;',
  '  }',
  '  function pullSkewed(address coin, address to, uint amount) {',
  '    ICoin(coin).approve(address(this), amount);',
  '    ICoin(coin).transferSkewed(address(this), to, amount);',
  '    this.pulls = this.pulls + 1;',
  '  }',
  '  function pullCapped(address coin, address to, uint amount) {',
  '    ICoin(coin).approve(address(this), type(uint256).max);',
  '    ICoin(coin).transferCapped(address(this), to, amount);',
  '    this.pulls = this.pulls + 1;',
  '  }',
  '}',
].join('\n');

type ArtifactMap = ReturnType<typeof compileStringMulti>;
let compiledOnce: ArtifactMap | undefined;
/** The contracts, compiled once and only when a case runs. */
function compiled(): ArtifactMap {
  compiledOnce ??= compileStringMulti(SOURCE, { composition: 'framed' });
  return compiledOnce;
}

/** The 1-based line of the first source line containing `needle`, searching from the line containing `after`. */
function lineOf(needle: string, after: string): number {
  const lines = SOURCE.split('\n');
  const start = lines.findIndex((line) => line.includes(after));
  return lines.findIndex((line, index) => index >= start && line.includes(needle)) + 1;
}

/** A coin a genesis or a hop is funded from; a genesis mints its txid as the category. */
function funding(txid: string): Utxo {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** What one pull left: its result or its error, and whether the payer's coin is still unspent. */
interface Outcome {
  readonly result?: FramedProxyCallResult;
  readonly error?: Error;
  readonly coinLive: boolean;
  /** The payer's and the root's token balances after the pull, read off chain. */
  readonly balances: readonly unknown[];
}

/**
 * Deploys the token plain with the payer's 900, the root's 100 and a third holder's 5, has the payer approve the
 * root for `allowance`, deploys the root behind a generated proxy, and runs one pull through the hop.
 */
async function pullOnce(allowance: bigint, entry: string, args: readonly FunctionArgument[]): Promise<Outcome> {
  const { Coin, Root } = compiled();
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const genesisFunder = wallet.unlock.spend(alicePub, signature);
  const funder = signature.unlockP2PKH();
  const changeAddress = wallet.address;
  let serial = 0x60;
  const nextCoin = async (): Promise<Utxo> => {
    serial += 1;
    const coin = funding(category(serial.toString(16)));
    await network.addUtxo(binToHex(PAYER), coin);
    return coin;
  };
  for (const id of [COIN_CATEGORY, ROOT_IMPL_CATEGORY, ROOT_PROXY_CATEGORY]) {
    await network.addUtxo(wallet.address, funding(id));
  }
  await fundShippedFacets(network);
  await deployStatefulContract(Coin!, [PAYER, 900n, addressOf(ROOT_PROXY_CATEGORY), 100n, THIRD, 5n], {
    fundingUtxo: funding(COIN_CATEGORY), funder: genesisFunder, changeAddress, provider: network,
  });
  const approved = await callFramedEntry({
    provider: network, artifact: Coin!, categoryId: COIN_CATEGORY, functionName: 'approve',
    args: [addressOf(ROOT_PROXY_CATEGORY), allowance], callerUtxo: await nextCoin(), callerLockingBytecode: PAYER,
    funder, changeAddress, vm: compositionMachine(),
  });
  expect(approved.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  const root = await deployFramedProxy({
    provider: network,
    implementationArtifact: Root!,
    proxyArtifact: buildProxyArtifact(Root!),
    implementationDeploy: { fundingUtxo: funding(ROOT_IMPL_CATEGORY), funder: genesisFunder, changeAddress },
    proxyDeploy: { fundingUtxo: funding(ROOT_PROXY_CATEGORY), funder: genesisFunder, changeAddress },
    initialize: { functionName: 'initialize', args: [0n] },
    callerLockingBytecode: PAYER,
    callerFunding: { utxo: await nextCoin(), funder, changeAddress },
    vm: compositionMachine(),
  });
  expect(root.initialize.broadcast).toBeDefined();

  const coin = await nextCoin();
  let result: FramedProxyCallResult | undefined;
  let error: Error | undefined;
  try {
    result = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: Root!,
      proxyArtifact: buildProxyArtifact(Root!),
      proxyCategoryId: root.proxy.categoryId,
      implementationCategoryId: root.implementation.categoryId,
      functionName: entry,
      args,
      externals: { ICoin: { artifact: Coin!, categoryId: COIN_CATEGORY } },
      callerUtxo: coin,
      callerLockingBytecode: PAYER,
      funder,
      changeAddress,
      vm: compositionMachine(),
    });
  } catch (caught) {
    error = caught as Error;
  }
  const live = await network.getUtxosForLockingBytecode(PAYER);
  const balances: unknown[] = [];
  for (const who of [PAYER, addressOf(ROOT_PROXY_CATEGORY)]) {
    const read = await readFramedEntry({
      provider: network, artifact: Coin!, categoryId: COIN_CATEGORY, functionName: 'balanceOf', args: [who],
      vm: compositionMachine(),
    });
    expect(read.accepted, read.objection).toBe(true);
    balances.push(read.value);
  }
  return {
    ...(result === undefined ? {} : { result }),
    ...(error === undefined ? {} : { error }),
    coinLive: live.some((utxo) => utxo.txid === coin.txid && utxo.vout === coin.vout),
    balances,
  };
}

/** The pull settled: every verdict accepted, the transaction broadcast, and 40 moved from the payer to the root. */
function expectMoved(outcome: Outcome): void {
  expect(outcome.error).toBeUndefined();
  expect(outcome.result!.verdicts.every((verdict) => verdict.accepted)).toBe(true);
  expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  expect(outcome.coinLive).toBe(false);
  expect(outcome.balances).toStrictEqual([860n, 140n]);
}

/** The pull was refused before anything was broadcast, with `message` in its words. */
function expectRefused(outcome: Outcome, message: string): void {
  expect(outcome.error).toBeInstanceOf(FramedProxyDeployError);
  expect(outcome.error!.message).toContain(message);
  expect(outcome.coinLive).toBe(true);
  expect(outcome.balances).toStrictEqual([900n, 100n]);
}

const COIN = addressOf(COIN_CATEGORY);

describe.runIf(process.env.FRAMED_AHEAD === '1')('ahead: a hop callee reads a mapping key beside its batch', () => {
  it('a pull within the allowance settles, and 40 moves', async () => {
    expectMoved(await pullOnce(50n, 'pull', [COIN, 40n]));
  }, 900_000);

  it('a pull past the allowance is refused by the token\'s own "short allowance"', async () => {
    // The callee frame runs with its batch and reaches the entry's require.
    expectRefused(await pullOnce(30n, 'pull', [COIN, 40n]), 'the call\'s callee "Coin.transferFrom()" did not settle '
      + 'through the proxy: frame "callee-master-1" of Coin.transferFrom() at line '
      + `${lineOf('"short allowance"', 'contract Coin')}: short allowance (Program failed an OP_VERIFY operation.)`);
  }, 900_000);

  it('a pull beside a read of a third holder\'s balance settles, and 40 moves', async () => {
    // One key of the batch's own collection, at a node the batch does not spend.
    expectMoved(await pullOnce(50n, 'pullVia', [COIN, THIRD, 40n]));
  }, 900_000);

  it('a pull beside a read of the payer\'s own balance is refused by name', async () => {
    // The read's node is one the batch spends, which one transaction cannot spend twice; the direct path refuses it
    // the same way (`call/entry-records.ts`). Owner: the SDK hop (`proxy/external-calls.ts`, `calleeEntryWrites`).
    expectRefused(await pullOnce(50n, 'pullVia', [COIN, PAYER, 40n]), 'the callee "Coin.transferVia()" reads mapping '
      + '"balances" at a node its batch also spends, which one transaction cannot spend twice');
  }, 900_000);

  it('a pull that reads no mapping settles', async () => {
    expectMoved(await pullOnce(50n, 'pullPlain', [COIN, 40n]));
  }, 900_000);

  it('a pull that grants its own allowance and then spends it settles', async () => {
    // The entry approves the allowance its own next call spends, so one reach of the hop creates the key's node and
    // the reach after it reads and rewrites that node: the allowance the body reads is the one the earlier frame
    // left, and the node carries no input for the reader to resolve it from.
    const outcome = await pullOnce(0n, 'pullSelf', [COIN, THIRD, 40n]);
    expect(outcome.error).toBeUndefined();
    expect(outcome.result!.verdicts.every((verdict) => verdict.accepted)).toBe(true);
    expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  }, 900_000);

  it('a pull whose allowance was granted at a value the plan cannot state settles', async () => {
    // The granted value is computed in the granting frame, so the plan states a placeholder for the node that frame
    // creates, and the frame after it reads a node whose value only the settle learns.
    const outcome = await pullOnce(0n, 'pullComputed', [COIN, THIRD, 40n]);
    expect(outcome.error).toBeUndefined();
    expect(outcome.result!.verdicts.every((verdict) => verdict.accepted)).toBe(true);
    expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  }, 900_000);

  it('a pull whose allowance read sits between two balance accesses settles', async () => {
    // The artifact groups the three accesses into two batches, so the derivation reads them in the batches' order
    // rather than the source order, and one of the groups is a node the granting frame created.
    const outcome = await pullOnce(0n, 'pullSkewed', [COIN, THIRD, 40n]);
    expect(outcome.error).toBeUndefined();
    expect(outcome.result!.verdicts.every((verdict) => verdict.accepted)).toBe(true);
    expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  }, 900_000);

  it('a pull that reads a granted cap the granting frame created settles', async () => {
    // The granting frame creates the node at a value the plan cannot state, and this frame only reads it: the
    // continuation changes nothing, so the chain of declarations for the node has to end at the commitment the
    // output carries, and the frame states no end view of its own for it. The hop is planned once more with that
    // reading once the settle has accepted, which is what tells this frame from one that rewrote the node - the
    // sibling `call/shared-node-across-reaches.test.ts` states the end view of the node its second grant rewrites.
    const outcome = await pullOnce(0n, 'pullCapped', [COIN, THIRD, 40n]);
    expect(outcome.error).toBeUndefined();
    expect(outcome.result!.verdicts.every((verdict) => verdict.accepted)).toBe(true);
    expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  }, 900_000);
});
