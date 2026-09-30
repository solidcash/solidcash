import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { validatorAddress } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callPerCallEntry } from '../../../src/per-call/call/index.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import {
  PerCallProxyDeployError, buildProxyArtifact, callPerCallProxyEntry, deployPerCallProxy,
  type PerCallProxyCallResult,
} from '../../../src/per-call/proxy/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * Walls ahead: a proxied root pulls a plain token whose entry reads a mapping key beside the balance batch it
 * writes, through the shipped hop, `callPerCallProxyEntry`.
 *
 * The fixture's `publishJobPost` pulls through `SafeERC20.safeTransferFrom`, whose token reads
 * `allowances[from][msg.sender]` and rewrites `balances[from]` and `balances[to]`. The hop plans a callee's read
 * nodes and its batch apart (`proxy/external-calls.ts`, `calleeReadNodes` and `calleeEntryWrites`): the batch
 * planner (`proxy/entry-writes.ts`, `planHopMappingBatches`) refuses a key read beside a batch and
 * `calleeEntryWrites` drops that refusal, so the callee frame runs with its read node and none of the batch's, and
 * splits past the end of a 2-byte item at its first group read. A read of one key of the batch's own collection
 * stops the same way; a pull that reads no mapping settles. The direct call path declares the read node kept, ahead
 * of the batch's groups (815535a89).
 *
 * Each case is pinned where it stands today; the patch `docs/per-call/patches/hop-callee-read-beside-batch.diff`
 * moves each to the outcome its comment names. The file runs only under `PER_CALL_AHEAD=1`.
 */

/** A 32-byte id with varied bytes, `seed` chosen so each name is distinct. */
function category(seed: string): string {
  const base = '7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2';
  return `${seed}${base}${base}`.slice(0, 64);
}

const COIN_CATEGORY = category('1c');
const ROOT_IMPL_CATEGORY = category('2d');
const ROOT_PROXY_CATEGORY = category('3e');

/** A per-call contract's address, which its category fixes before anything is deployed. */
const addressOf = (id: string): Uint8Array => validatorAddress(hexToBin(id), VALIDATOR_PROGRAM);

const PAYER = encodeLockingBytecodeP2pkh(alicePkh);
/** A third holder of the token, whose balance node neither the payer's nor the root's is. */
const THIRD = hexToBin(`a914${'5d2e7f4a1b8c3d6e9f0a2b4c6d8e1f3a5b7c9d0e'}87`);

const SOURCE = [
  'pragma solidcash ^0.13.0;',
  'interface ICoin {',
  '  function transferFrom(address from, address to, uint amount) returns (bool);',
  '  function transferVia(address from, address to, address witness, uint amount) returns (bool);',
  '  function transferPlain(address from, address to, uint amount) returns (bool);',
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
  '}',
].join('\n');

type ArtifactMap = ReturnType<typeof compileStringMulti>;
let compiledOnce: ArtifactMap | undefined;
/** The contracts, compiled once and only when a case runs. */
function compiled(): ArtifactMap {
  compiledOnce ??= compileStringMulti(SOURCE, { composition: 'per-call' });
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
  readonly result?: PerCallProxyCallResult;
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
  const approved = await callPerCallEntry({
    provider: network, artifact: Coin!, categoryId: COIN_CATEGORY, functionName: 'approve',
    args: [addressOf(ROOT_PROXY_CATEGORY), allowance], callerUtxo: await nextCoin(), callerLockingBytecode: PAYER,
    funder, changeAddress, vm: compositionMachine(),
  });
  expect(approved.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  const root = await deployPerCallProxy({
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
  let result: PerCallProxyCallResult | undefined;
  let error: Error | undefined;
  try {
    result = await callPerCallProxyEntry({
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
    const read = await readPerCallEntry({
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
  expect(outcome.error).toBeInstanceOf(PerCallProxyDeployError);
  expect(outcome.error!.message).toContain(message);
  expect(outcome.coinLive).toBe(true);
  expect(outcome.balances).toStrictEqual([900n, 100n]);
}

/** The callee frame's own refusal: it splits past the end of a 2-byte item at its first group read. */
function batchlessRefusal(entry: string): string {
  return `the call's callee "Coin.${entry}()" did not settle through the proxy: frame "callee-master-1" of `
    + `Coin.${entry}() at line ${lineOf(`function ${entry}(`, 'contract Coin')}: no source message (Program called `
    + 'an OP_SPLIT operation with an invalid index. stack item length: 2; requested split index: 4.)';
}

const COIN = addressOf(COIN_CATEGORY);

describe.runIf(process.env.PER_CALL_AHEAD === '1')('ahead: a hop callee reads a mapping key beside its batch', () => {
  it('a pull within the allowance stops at the callee frame, which has no node of its batch', async () => {
    // Patched: settles, and 40 moves.
    expectRefused(await pullOnce(50n, 'pull', [COIN, 40n]), batchlessRefusal('transferFrom'));
  }, 900_000);

  it('a pull past the allowance stops at the same frame', async () => {
    // Patched: refused by the token's own check, "short allowance", at the entry's require.
    expectRefused(await pullOnce(30n, 'pull', [COIN, 40n]), batchlessRefusal('transferFrom'));
  }, 900_000);

  it('a pull beside a read of a third holder\'s balance stops at the same frame', async () => {
    // One key of the batch's own collection, at a node the batch does not spend. Patched: settles, and 40 moves.
    expectRefused(await pullOnce(50n, 'pullVia', [COIN, THIRD, 40n]), batchlessRefusal('transferVia'));
  }, 900_000);

  it('a pull beside a read of the payer\'s own balance stops at the same frame', async () => {
    // The read's node is one the batch spends. Patched: refused by name, as the direct path refuses it, because one
    // transaction cannot spend that node twice.
    expectRefused(await pullOnce(50n, 'pullVia', [COIN, PAYER, 40n]), batchlessRefusal('transferVia'));
  }, 900_000);

  it('a pull that reads no mapping settles', async () => {
    expectMoved(await pullOnce(50n, 'pullPlain', [COIN, 40n]));
  }, 900_000);
});
