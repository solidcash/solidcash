import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import {
  bytesToHex, decodeIntegerValue, parsePushdataCommitment, sha256, validatorAddress, type Artifact, type RecordEntry,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { readPerCallDeployment } from '../../../src/per-call/deploy/index.js';
import { callPerCallEntry } from '../../../src/per-call/call/index.js';
import {
  buildProxyArtifact, callPerCallProxyEntry, deployPerCallProxy, type PerCallProxyCallResult,
} from '../../../src/per-call/proxy/index.js';
import { deploymentStateValues } from '../../../src/per-call/proxy/external-calls.js';
import { participant } from '../../../src/per-call/composer/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A proxied root whose reentrancy guard is set before its call and cleared after it.
 *
 * The vault stacks the guards an upgradeable vault puts on a token pull: an owner, a pause flag and a status written
 * before the call and restored after it (`nonReentrant`), around a pull whose target is a stored token address and a
 * credit to the depositor's mapping entry. The status is a field of the root's own data record, so the record changes
 * in both segments the call splits the frame into and ends where it started (1 -> 2 -> 1). The hop takes the records
 * the frame writes from the write landings the artifact publishes, as it does for a callee frame, not from whether
 * the record ends where it started: the record is declared changed in both segments, the derivation learns the view
 * the first leaves, and the settle states the one the second ends at. Each guarded entry settles, and the pull, the
 * credit and the restored guard are read back from the chain.
 *
 * A token that calls back into the guarded entry re-enters the root's own contract below its callee, which the hop
 * places no second frame for: it is refused by name before anything is broadcast. The transaction-level guarantee,
 * that no declaration can show the guard clear while the call runs and that a re-entered frame meets the guard's own
 * reason, is pinned in `hostile/guard-view-across-call`.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IToken { function transferFrom(address from, address to, uint256 amount) external; }',
  'interface IVault { function pullGuarded(uint256 amount) external; }',
  'contract Token {',
  '  uint256 public supply;',
  '  mapping(address => uint256) internal balances;',
  '  function mint(address to, uint256 amount) external { supply += amount; balances[to] += amount; }',
  '  function transferFrom(address from, address to, uint256 amount) external {',
  '    require(balances[from] >= amount, "short");',
  '    balances[from] -= amount;',
  '    balances[to] += amount;',
  '  }',
  '}',
  'contract CallbackToken {',
  '  uint256 public supply;',
  '  function transferFrom(address from, address to, uint256 amount) external {',
  '    IVault(to).pullGuarded(amount);',
  '  }',
  '}',
  'contract Vault {',
  '  address public implementation;',
  '  address public owner;',
  '  bool public paused;',
  '  uint256 private status;',
  '  IToken public token;',
  '  mapping(address => uint256) public deposits;',
  '  modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }',
  '  modifier whenNotPaused() { require(!paused, "paused"); _; }',
  '  modifier nonReentrant() { require(status != 2, "reentrant"); status = 2; _; status = 1; }',
  '  function initialize(address owner_, IToken token_) public { owner = owner_; token = token_; status = 1; }',
  '  function setPaused(bool paused_) external onlyOwner { paused = paused_; }',
  '  function depositPlain(uint256 amount) external {',
  '    token.transferFrom(msg.sender, address(this), amount);',
  '    deposits[msg.sender] += amount;',
  '  }',
  '  function depositPaused(uint256 amount) external whenNotPaused {',
  '    token.transferFrom(msg.sender, address(this), amount);',
  '    deposits[msg.sender] += amount;',
  '  }',
  '  function pullGuarded(uint256 amount) external nonReentrant {',
  '    token.transferFrom(msg.sender, address(this), amount);',
  '  }',
  '  function deposit(uint256 amount) external nonReentrant whenNotPaused {',
  '    token.transferFrom(msg.sender, address(this), amount);',
  '    deposits[msg.sender] += amount;',
  '  }',
  '}',
].join('\n');

const artifacts = compileStringMulti(SOURCE, { solidityImportCompat: true, composition: 'per-call' } as never);
const tokenArtifact = artifacts.Token!;
const callbackArtifact = artifacts.CallbackToken!;
const vaultArtifact = artifacts.Vault!;
const vaultProxy = buildProxyArtifact(vaultArtifact);

const USER_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
const AMOUNT = 10n;
const MINTED = 100n;
const REENTRY = 'the call to "IVault.pullGuarded" reaches "Vault", which this hop already places; a contract that '
  + 'reaches itself below itself cannot be given a second block in the hop';

/** A 32-byte id, used both as a coin's txid and as the category its genesis mints. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`root guard across call ${label}`)));
}

function coin(label: string): Utxo {
  return { txid: idOf(label), vout: 0, satoshis: 5_000_000n };
}

/** A per-call contract's address, which its category fixes. */
const addressOf = (categoryId: string): Uint8Array => validatorAddress(hexToBin(categoryId), VALIDATOR_PROGRAM);

interface Vault {
  readonly proxyCategoryId: string;
  readonly implementationCategoryId: string;
  readonly address: Uint8Array;
}

interface Chain {
  readonly network: MockNetworkProvider;
  readonly changeAddress: string;
  readonly tokenCategoryId: string;
  readonly callbackCategoryId: string;
  /** The vault whose stored token is the honest one. */
  readonly vault: Vault;
  /** The same vault deployed again with the token that calls back into it. */
  readonly calledBack: Vault;
}

const callerFunder = new SignatureTemplate(alicePriv).unlockP2PKH();
let calls = 0;

let chainRun: Promise<Chain> | undefined;
/** The tokens plain, both vaults behind their proxies, and the user's tokens minted. */
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
    const funder = wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv));
    const changeAddress = wallet.address;
    await fundShippedFacets(network);
    const plain = async (artifact: Artifact, label: string): Promise<string> => {
      const fundingUtxo = coin(label);
      await network.addUtxo(wallet.address, fundingUtxo);
      return (await deployStatefulContract(artifact, [], {
        provider: network, fundingUtxo, changeAddress, funder,
      })).categoryId;
    };
    const proxied = async (label: string, tokenCategoryId: string): Promise<Vault> => {
      const [implementation, proxy, init] = ['implementation', 'proxy', 'initialize']
        .map((part) => coin(`${label} ${part}`));
      for (const utxo of [implementation!, proxy!]) await network.addUtxo(wallet.address, utxo);
      await network.addUtxo(binToHex(USER_LOCK), init!);
      const deployment = await deployPerCallProxy({
        provider: network,
        implementationArtifact: vaultArtifact,
        proxyArtifact: vaultProxy,
        implementationDeploy: { fundingUtxo: implementation!, funder, changeAddress },
        proxyDeploy: { fundingUtxo: proxy!, funder, changeAddress },
        initialize: { functionName: 'initialize', args: [USER_LOCK, addressOf(tokenCategoryId)] },
        callerLockingBytecode: USER_LOCK,
        callerFunding: { utxo: init!, funder: callerFunder, changeAddress },
        vm: compositionMachine(),
      });
      expect(deployment.initialize.broadcast).toBeDefined();
      return {
        proxyCategoryId: deployment.proxy.categoryId,
        implementationCategoryId: deployment.implementation.categoryId,
        address: deployment.proxy.address,
      };
    };
    const tokenCategoryId = await plain(tokenArtifact, 'token');
    const callbackCategoryId = await plain(callbackArtifact, 'callback token');
    const vault = await proxied('vault', tokenCategoryId);
    const calledBack = await proxied('called back vault', callbackCategoryId);
    const mintCoin = coin('mint');
    await network.addUtxo(binToHex(USER_LOCK), mintCoin);
    const minted = await callPerCallEntry({
      provider: network, artifact: tokenArtifact, categoryId: tokenCategoryId, functionName: 'mint',
      args: [USER_LOCK, MINTED], callerUtxo: mintCoin, callerLockingBytecode: USER_LOCK, funder: callerFunder,
      changeAddress, vm: compositionMachine(),
    });
    expect(minted.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    return { network, changeAddress, tokenCategoryId, callbackCategoryId, vault, calledBack };
  })();
  return chainRun;
}

/** What one entered call left: its result or its error, and whether the caller's coin is still unspent. */
interface Outcome {
  readonly result?: PerCallProxyCallResult;
  readonly error?: Error;
  readonly coinLive: boolean;
}

/** Enters one vault entry through the hop, with a coin of the user's. */
async function enter(run: Chain, vault: Vault, functionName: string): Promise<Outcome> {
  calls += 1;
  const callerUtxo = coin(`call ${calls}`);
  await run.network.addUtxo(binToHex(USER_LOCK), callerUtxo);
  let result: PerCallProxyCallResult | undefined;
  let error: Error | undefined;
  try {
    result = await callPerCallProxyEntry({
      provider: run.network,
      implementationArtifact: vaultArtifact,
      proxyArtifact: vaultProxy,
      proxyCategoryId: vault.proxyCategoryId,
      implementationCategoryId: vault.implementationCategoryId,
      functionName,
      args: [AMOUNT],
      externals: {
        Token: { artifact: tokenArtifact, categoryId: run.tokenCategoryId },
        CallbackToken: { artifact: callbackArtifact, categoryId: run.callbackCategoryId },
      },
      callerUtxo,
      callerLockingBytecode: USER_LOCK,
      funder: callerFunder,
      changeAddress: run.changeAddress,
      vm: compositionMachine(),
    });
  } catch (caught) {
    error = caught as Error;
  }
  const live = await run.network.getUtxosForLockingBytecode(USER_LOCK);
  return { result, error, coinLive: live.some((utxo) => utxo.txid === callerUtxo.txid) };
}

/** The value one collection's node holds for an address key, or zero while the list holds none. */
async function heldAt(
  run: Chain, artifact: Artifact, categoryId: string, collection: string, key: Uint8Array,
): Promise<bigint> {
  const pools = await readPerCallDeployment(run.network, categoryId, artifact.stateLayout!);
  const slot = bytesToHex(keyToSlotMulti([key]));
  const node = (pools.nodesByCollection.get(collection) ?? [])
    .map((utxo) => decodeEntryCommitment(hexToBin(utxo.token!.nft!.commitment)))
    .find((entry) => bytesToHex(entry.slot) === slot);
  return node === undefined ? 0n : decodeIntegerValue(node.value);
}

/** The token balances of the user and the vault, the user's credit at the vault, and the vault's guard. */
async function ledger(run: Chain, vault: Vault): Promise<readonly [bigint, bigint, bigint, unknown]> {
  const layout = vaultProxy.stateLayout!;
  const state = deploymentStateValues(layout, vault.proxyCategoryId,
    await readPerCallDeployment(run.network, vault.proxyCategoryId, layout));
  return [
    await heldAt(run, tokenArtifact, run.tokenCategoryId, 'balances', USER_LOCK),
    await heldAt(run, tokenArtifact, run.tokenCategoryId, 'balances', vault.address),
    await heldAt(run, vaultArtifact, vault.proxyCategoryId, 'deposits', USER_LOCK),
    state.status,
  ];
}

/** The guard's value at both ends of each segment a frame declares the guard's record in. */
function guardViews(result: PerCallProxyCallResult, master: string): readonly (readonly unknown[])[] {
  const layout = vaultProxy.stateLayout!;
  const field = layout.variables.find((variable) => variable.name === 'status')!;
  const index = participant(result.draft.layout, `proxy-record-${field.nftIndex}`).index;
  const status = (view: Uint8Array): unknown =>
    parsePushdataCommitment(binToHex(view), layout, field.nftIndex).status;
  return result.draft.blockOf(master).segments.map((segment) => {
    const entry = segment.find((candidate: RecordEntry) => candidate.in === index)!;
    return [status(entry.viewIn), status(entry.viewOut)];
  });
}

function expectSettled(outcome: Outcome): PerCallProxyCallResult {
  expect(outcome.error).toBeUndefined();
  expect(outcome.result!.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  expect(outcome.coinLive).toBe(false);
  return outcome.result!;
}

describe('a proxied root whose reentrancy guard is set before its call and cleared after it', () => {
  it('settles the pull and the credit with no guard, and behind the pause check', async () => {
    const run = await chain();
    for (const entry of ['depositPlain', 'depositPaused']) {
      const [user, held, credit] = await ledger(run, run.vault);
      expectSettled(await enter(run, run.vault, entry));
      expect(await ledger(run, run.vault)).toStrictEqual([user - AMOUNT, held + AMOUNT, credit + AMOUNT, 1n]);
    }
  });

  it('settles a pull behind the guard alone, its record changed in both segments and restored', async () => {
    const run = await chain();
    const [user, held, credit] = await ledger(run, run.vault);
    const result = expectSettled(await enter(run, run.vault, 'pullGuarded'));
    // The implementation frame sets the guard before the call and clears it after; the proxy's own frame holds the
    // record on either side of the delegate call, which leaves it where it started.
    expect(guardViews(result, 'implementation-master')).toStrictEqual([[1n, 2n], [2n, 1n]]);
    expect(guardViews(result, 'proxy-master')).toStrictEqual([[1n, 1n], [1n, 1n]]);
    expect(await ledger(run, run.vault)).toStrictEqual([user - AMOUNT, held + AMOUNT, credit, 1n]);
  });

  it('settles the guarded deposit behind the pause check: the pull, the credit and the guard restored', async () => {
    const run = await chain();
    const [user, held, credit] = await ledger(run, run.vault);
    const result = expectSettled(await enter(run, run.vault, 'deposit'));
    expect(guardViews(result, 'implementation-master')).toStrictEqual([[1n, 2n], [2n, 1n]]);
    expect(await ledger(run, run.vault)).toStrictEqual([user - AMOUNT, held + AMOUNT, credit + AMOUNT, 1n]);
  });

  it('refuses a token that calls back into the guarded entry by name, and nothing is broadcast', async () => {
    const run = await chain();
    const before = await ledger(run, run.calledBack);
    const outcome = await enter(run, run.calledBack, 'pullGuarded');
    expect(outcome.error?.message).toBe(REENTRY);
    expect(outcome.coinLive).toBe(true);
    expect(await ledger(run, run.calledBack)).toStrictEqual(before);
  });
});
