import { describe, expect, it, vi } from 'vitest';

// The testing layer's matchers import the SDK by package name, which resolves to the built output; point both entries
// they use at the sources, so the matchers and the hop they await share one copy of the SDK.
vi.mock('@solidcash/solidcash', () => import('../../../src/index.js'));
vi.mock('@solidcash/solidcash/vitest', () => import('../../../src/test/TestExtensions.js'));

import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { bytesToHex, sha256, validatorAddress } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { expect as chaiExpect } from '../../../../testing/src/chai.js';
import { Contract, SignatureTemplate, Signer } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { Unlocker, Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { FramedFunctionCall } from '../../../src/framed/call/index.js';
import { FramedProxyDeployError, buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import type { FramedProxyExternal } from '../../../src/framed/proxy/external-calls.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A custom error raised inside a callee reached through its own proxy, with an address and a uint (ethers'
 * `revertedWithCustomError(...).withArgs(...)`).
 *
 * The root, behind a generated proxy, calls a vault behind another generated proxy, whose implementation runs as the
 * proxy's delegate frame and raises `OverLimit(holder, amount)` for an amount past its limit. The refusal names the
 * delegate frame's error, as the EVM bubbles a callee's revert data up through its proxy, and carries the values it
 * was raised with (`errorArgs`): the caller the root passed and the amount it asked. They are carried whichever way
 * the hop meets the refusal: the frame evaluated before its own write, its derivation stalled before a call of its
 * own, a plan stopped before a later call the planner refuses, and a plan stopped to learn the refusing call's
 * result. The testing layer's matcher compares them. An amount within the limit settles, and nothing is broadcast
 * for one past it.
 */

/** A 32-byte category or txid that is neither one repeated byte nor a palindrome, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`proxied callee error arguments ${label}`)));
}

const AUDIT_CATEGORY = idOf('audit');
const VAULT_IMPL = idOf('vault implementation');
const VAULT_PROXY = idOf('vault proxy');
const FRONT_IMPL = idOf('front implementation');
const FRONT_PROXY = idOf('front proxy');
const addressOf = (categoryId: string): Uint8Array => validatorAddress(hexToBin(categoryId), VALIDATOR_PROGRAM);
/** An address no contract of the deployment sits at. */
const GHOST = addressOf(idOf('ghost'));
const CALLER_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
/** The most the vault takes at once, and the most the audit records. */
const LIMIT = 100n;
const PAST_LIMIT = LIMIT + 50n;

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'error OverLimit(address holder, uint256 amount);',
  'interface IVault {',
  '  function deposit(address holder_, uint256 amount_) external;',
  '  function forward(address holder_, uint256 amount_) external;',
  '  function quote(address holder_, uint256 amount_) external returns (uint256);',
  '}',
  'interface IAudit { function record(uint256 amount_) external; }',
  'interface IGhost { function ping() external; }',
  'contract Audit {',
  '  uint256 public floor;',
  `  function record(uint256 amount_) public { require(amount_ >= floor && amount_ <= ${LIMIT}, "audit refuses"); }`,
  '}',
  'contract Vault {',
  '  address public implementation;',
  '  address public audit;',
  '  uint256 public limit;',
  '  mapping(address => uint256) public held;',
  '  function initialize(address audit_, uint256 limit_) public { audit = audit_; limit = limit_; }',
  '  function deposit(address holder_, uint256 amount_) public {',
  '    if (amount_ > limit) revert OverLimit(holder_, amount_);',
  '    held[holder_] += amount_;',
  '  }',
  '  function forward(address holder_, uint256 amount_) public {',
  '    if (amount_ > limit) revert OverLimit(holder_, amount_);',
  '    IAudit(audit).record(amount_);',
  '  }',
  '  function quote(address holder_, uint256 amount_) public returns (uint256) {',
  '    if (amount_ > limit) revert OverLimit(holder_, amount_);',
  '    return amount_;',
  '  }',
  '}',
  'contract Front {',
  '  address public implementation;',
  '  address public vault;',
  '  address public ghost;',
  '  function initialize(address vault_, address ghost_) public { vault = vault_; ghost = ghost_; }',
  '  function deposit(uint256 amount_) public { IVault(vault).deposit(msg.sender, amount_); }',
  '  function forward(uint256 amount_) public { IVault(vault).forward(msg.sender, amount_); }',
  '  function depositThenPing(uint256 amount_) public {',
  '    IVault(vault).deposit(msg.sender, amount_);',
  '    IGhost(ghost).ping();',
  '  }',
  '  function quoteThenDeposit(uint256 amount_) public {',
  '    uint256 quoted = IVault(vault).quote(msg.sender, amount_);',
  '    IVault(vault).deposit(msg.sender, quoted);',
  '  }',
  '}',
].join('\n');

const OPTIONS = {
  evmCompat: true,
  commitmentLimit: 128,
  maximumInputBytes: 10_000_000,
  messageBus: true,
  optimizeForCompilationSpeed: true,
  suppressWarnings: true,
  ecrecover: 'p2pkh',
  sortedMappingsAll: false,
  composition: 'framed',
} as const;

const artifacts = compileStringMulti(SOURCE, OPTIONS as never);

/** The line of the `revert` in the vault's entry `entry`, 1-based. */
function revertLineOf(entry: string): number {
  const lines = SOURCE.split('\n');
  const after = (start: number, needle: string): number =>
    lines.findIndex((line, at) => at > start && line.includes(needle));
  return after(after(after(-1, 'contract Vault {'), `function ${entry}(`), 'revert OverLimit') + 1;
}

/**
 * The tail a refusal ends with when the vault's frame for `entry` raised `OverLimit`: the frame's own description,
 * its objection carrying no parentheses, and nothing after it.
 */
function overLimitTail(entry: string): RegExp {
  const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`frame "[^"]*" of ${escaped(`Vault.${entry}()`)} at line ${revertLineOf(entry)}: `
    + `${escaped('revert OverLimit(address, uint256)')} \\([^()]*\\)$`);
}

/** The values `OverLimit` is raised with when the caller asks for `amount`: the caller's lock, then the amount. */
const overLimitArgs = (amount: bigint): readonly unknown[] => [`0x${binToHex(CALLER_LOCK)}`, amount];

interface World {
  readonly network: MockNetworkProvider;
  readonly externals: Readonly<Record<string, FramedProxyExternal>>;
  readonly changeAddress: string;
  readonly funder: Unlocker;
  readonly nextCoin: () => Utxo;
  readonly snapshot: SnapshotRestorer;
}

/** The audit plain, then the vault and the front behind their generated proxies. */
async function deployWorld(): Promise<World> {
  const { Audit, Vault, Front } = artifacts;
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const genesisFunder = wallet.unlock.spend(alicePub, signature);
  const changeAddress = wallet.address;
  const funder = signature.unlockP2PKH();
  let serial = 0;
  const nextCoin = (): Utxo => {
    serial += 1;
    return { txid: idOf(`coin ${serial}`), vout: 0, satoshis: 5_000_000n };
  };
  const funding = (txid: string): Utxo => ({ txid, vout: 0, satoshis: 5_000_000n });
  for (const id of [AUDIT_CATEGORY, VAULT_IMPL, VAULT_PROXY, FRONT_IMPL, FRONT_PROXY]) {
    await network.addUtxo(wallet.address, funding(id));
  }
  await fundShippedFacets(network);
  await deployStatefulContract(Audit!, [], {
    fundingUtxo: funding(AUDIT_CATEGORY), funder: genesisFunder, changeAddress, provider: network,
  });
  const proxied = async (
    artifact: NonNullable<typeof Vault>, implementationCategory: string, proxyCategory: string,
    args: readonly FunctionArgument[],
  ): Promise<Awaited<ReturnType<typeof deployFramedProxy>>> => {
    const initCoin = nextCoin();
    await network.addUtxo(binToHex(CALLER_LOCK), initCoin);
    const deployment = await deployFramedProxy({
      provider: network,
      implementationArtifact: artifact,
      proxyArtifact: buildProxyArtifact(artifact),
      implementationDeploy: { fundingUtxo: funding(implementationCategory), funder: genesisFunder, changeAddress },
      proxyDeploy: { fundingUtxo: funding(proxyCategory), funder: genesisFunder, changeAddress },
      initialize: { functionName: 'initialize', args: [...args] },
      callerLockingBytecode: CALLER_LOCK,
      callerFunding: { utxo: initCoin, funder, changeAddress },
      vm: compositionMachine(),
    });
    expect(deployment.initialize.broadcast).toBeDefined();
    return deployment;
  };
  const vault = await proxied(Vault!, VAULT_IMPL, VAULT_PROXY, [addressOf(AUDIT_CATEGORY), LIMIT]);
  await proxied(Front!, FRONT_IMPL, FRONT_PROXY, [vault.proxy.address, GHOST]);
  return {
    network,
    externals: {
      IVault: {
        artifact: Vault!,
        categoryId: vault.proxy.categoryId,
        proxyArtifact: buildProxyArtifact(Vault!),
        implementationCategoryId: vault.implementation.categoryId,
      },
      IAudit: { artifact: Audit!, categoryId: AUDIT_CATEGORY },
    },
    changeAddress,
    funder,
    nextCoin,
    snapshot: await network.takeSnapshot(),
  };
}

let worldRun: Promise<World> | undefined;

/** One deployment serves every case, each rewinding the chain to it first. */
async function deployed(): Promise<World> {
  worldRun ??= deployWorld();
  const world = await worldRun;
  await world.snapshot.restore();
  return world;
}

type Refusal = Error & { readonly errorArgs?: readonly unknown[] };

/** One call of a front entry through its proxy; a refusal is returned with the coin it left unspent. */
async function enter(
  world: World, functionName: string, amount: bigint,
): Promise<{ result?: FramedProxyCallResult; error?: Refusal; coinLive: boolean }> {
  const coin = world.nextCoin();
  await world.network.addUtxo(binToHex(CALLER_LOCK), coin);
  let outcome: { result?: FramedProxyCallResult; error?: Refusal };
  try {
    outcome = {
      result: await callFramedProxyEntry({
        provider: world.network,
        implementationArtifact: artifacts.Front!,
        proxyArtifact: buildProxyArtifact(artifacts.Front!),
        proxyCategoryId: FRONT_PROXY,
        implementationCategoryId: FRONT_IMPL,
        functionName,
        args: [amount],
        externals: world.externals,
        callerUtxo: coin,
        callerLockingBytecode: CALLER_LOCK,
        funder: world.funder,
        changeAddress: world.changeAddress,
        vm: compositionMachine(),
      }),
    };
  } catch (error) {
    outcome = { error: error as Refusal };
  }
  const coinLive = (await world.network.getUtxosForLockingBytecode(CALLER_LOCK))
    .some((utxo) => utxo.txid === coin.txid && utxo.vout === coin.vout);
  return { ...outcome, coinLive };
}

/** Checks a refusal names the vault's `OverLimit` in its frame for `entry` and carries the values it was raised with. */
function expectOverLimit(
  refused: { result?: FramedProxyCallResult; error?: Refusal; coinLive: boolean }, entry: string, amount: bigint,
): void {
  expect(refused.result).toBeUndefined();
  expect(refused.error).toBeInstanceOf(FramedProxyDeployError);
  expect(refused.error!.message.startsWith(`the call's callee "Vault.${entry}()" did not settle through the proxy: `))
    .toBe(true);
  expect(refused.error!.message).toMatch(overLimitTail(entry));
  expect(refused.error!.errorArgs).toStrictEqual(overLimitArgs(amount));
  expect(refused.coinLive).toBe(true);
}

describe('a custom error a callee behind its own proxy raises, with its arguments', () => {
  it('carries them when the vault refuses before its own write, and settles an amount within the limit', async () => {
    const world = await deployed();
    const admitted = await enter(world, 'deposit', LIMIT);
    expect(admitted.error?.message).toBeUndefined();
    expect(admitted.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

    expectOverLimit(await enter(world, 'deposit', PAST_LIMIT), 'deposit', PAST_LIMIT);
  }, 600_000);

  it('carries them when the vault refuses before a call of its own', async () => {
    // The vault's frame is void and writes nothing, so its own derivation stalls at its call to the audit: the stall
    // is not the refusal, the frame's own `revert` is. The audit would refuse the amount too, but is never called.
    const world = await deployed();
    const admitted = await enter(world, 'forward', LIMIT);
    expect(admitted.error?.message).toBeUndefined();
    expect(admitted.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

    expectOverLimit(await enter(world, 'forward', PAST_LIMIT), 'forward', PAST_LIMIT);
  }, 600_000);

  it('carries them before a later call the planner refuses, and the planner\'s refusal carries none', async () => {
    // The ghost call is refused while the hop plans it, but the execution meets the vault's refusal first.
    const world = await deployed();
    expectOverLimit(await enter(world, 'depositThenPing', PAST_LIMIT), 'deposit', PAST_LIMIT);

    const planned = await enter(world, 'depositThenPing', LIMIT);
    expect(planned.error!.message).toBe(`the call to "IGhost.ping" targets ${binToHex(GHOST)}, and none of the `
      + 'deployment\'s contracts sits at that address');
    expect(planned.error!.errorArgs).toBeUndefined();
    expect(planned.coinLive).toBe(true);
  }, 600_000);

  it('carries them when the plan stops to learn the result of the call that refuses', async () => {
    // The deposit's amount is the quote's result, so the plan stops to settle the quote first, which refuses.
    const world = await deployed();
    expectOverLimit(await enter(world, 'quoteThenDeposit', PAST_LIMIT), 'quote', PAST_LIMIT);
  }, 600_000);

  it('hands them to the testing layer\'s custom-error matcher, which compares each one', async () => {
    // The call a handle's namespace hands back, entered by the caller's own coin: the matcher awaits the hop it runs.
    const world = await deployed();
    await world.network.addUtxo(binToHex(CALLER_LOCK), world.nextCoin());
    const signer = new Signer(alicePriv, world.network);
    const front = artifacts.Front!;
    const deposit = (amount: bigint): FramedFunctionCall => new FramedFunctionCall({
      artifact: front,
      abiEntry: front.abi.find((entry) => entry.name === 'deposit')!,
      categoryId: FRONT_PROXY,
      provider: world.network,
      signer,
      proxyImplementationCategoryId: FRONT_IMPL,
    }, 'deposit', [amount]);

    const [holder] = overLimitArgs(PAST_LIMIT);
    await chaiExpect(deposit(PAST_LIMIT)).to.be.revertedWithCustomError({}, 'OverLimit').withArgs(holder, PAST_LIMIT);
    await expect(chaiExpect(deposit(PAST_LIMIT)).to.be.revertedWithCustomError({}, 'OverLimit').withArgs(holder, LIMIT))
      .rejects.toThrow(`Custom error OverLimit argument 1: expected ${LIMIT}, got ${PAST_LIMIT}`);
  }, 600_000);
});
