import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { bytesToHex, parsePushdataCommitment, sha256, validatorAddress, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readPerCallDeployment } from '../../../src/per-call/deploy/index.js';
import {
  buildProxyArtifact, callPerCallProxyEntry, deployPerCallProxy, type PerCallProxyCallResult,
} from '../../../src/per-call/proxy/index.js';
import { deploymentStateValues } from '../../../src/per-call/proxy/external-calls.js';
import type { Utxo } from '../../../src/interfaces.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A contract whose later frame in a hop declares a data record its earlier frame did not.
 *
 * `Root.run` (behind a generated proxy) reaches `Vault.settle`, whose body reads only the record that holds the
 * vault's addresses and fee (data record 1), and then `Vault.claimOnce`, which checks its caller against an address in
 * that record and writes the guard and counter its other record holds (data record 0). A frame reads each data record
 * it names at the base its block declares plus the record's offset in its own layout, so the records it names have to
 * sit side by side in data-record order. The hop placed a contract's records in the order its frames first declared
 * them, record 1 for the earlier frame and record 0 behind it for the later one, so the later frame read its record 1
 * one input past record 0 and refused at its caller check. When that order leaves a frame's records apart, they are
 * now placed in data-record order ahead of the nodes; a block whose frames name records no order keeps side by side
 * (`Vault.audit` names records 0 and 2, `claimOnce` 0 and 1) is refused by name. `Vault.retune` names record 1 alone
 * and writes it: the hop looked its published write up by the frame's own position in its list rather than by data
 * record, so the write went undeclared and the frame refused at its own close.
 */

/** A 32-byte category or txid that is neither one repeated byte nor a palindrome, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`records a later frame adds ${label}`)));
}

const VAULT_CATEGORY = idOf('vault');
const ROOT_IMPL_CATEGORY = idOf('root implementation');
const ROOT_PROXY_CATEGORY = idOf('root proxy');
const CALLER = encodeLockingBytecodeP2pkh(alicePkh);
const FEE = 7n;
const MARK = 30n;

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IVault {',
  '  function settle(uint16 mark) external view returns (uint16);',
  '  function claimOnce() external;',
  '  function audit() external;',
  '  function retune(uint16 fee_) external;',
  '}',
  'contract Vault {',
  '  uint256 private status;',
  '  uint256 public rounds;',
  '  address public immutable judge;',
  '  address public immutable claimer;',
  '  address public immutable spare;',
  '  uint16 public fee;',
  '  address public immutable keeper;',
  '  address public immutable auditor;',
  '  uint16 public cap;',
  '  constructor(address judge_, address claimer_, address spare_, uint16 fee_, address keeper_, address auditor_) {',
  '    judge = judge_; claimer = claimer_; spare = spare_; fee = fee_; keeper = keeper_; auditor = auditor_;',
  '    status = 1; cap = 9;',
  '  }',
  '  function settle(uint16 mark) external view returns (uint16) {',
  '    require(msg.sender == claimer || msg.sender == spare, "not a settler");',
  '    return mark + fee;',
  '  }',
  '  function claimOnce() external {',
  '    require(msg.sender == claimer, "not the claimer");',
  '    require(status != 2, "entered");',
  '    status = 2;',
  '    rounds = rounds + 1;',
  '    status = 1;',
  '  }',
  '  function audit() external {',
  '    require(msg.sender == auditor, "not the auditor");',
  '    rounds = rounds + cap;',
  '  }',
  '  function retune(uint16 fee_) external {',
  '    require(msg.sender == claimer, "not the claimer");',
  '    fee = fee_;',
  '  }',
  '}',
  'contract Root {',
  '  address public implementation;',
  '  address public vault;',
  '  uint256 public seen;',
  '  function initialize(address vault_) public { vault = vault_; }',
  '  function run(uint16 mark) public {',
  '    seen = IVault(vault).settle(mark);',
  '    IVault(vault).claimOnce();',
  '  }',
  '  function runClaimFirst(uint16 mark) public {',
  '    IVault(vault).claimOnce();',
  '    seen = IVault(vault).settle(mark);',
  '  }',
  '  function runAndAudit(uint16 mark) public {',
  '    seen = IVault(vault).settle(mark);',
  '    IVault(vault).claimOnce();',
  '    IVault(vault).audit();',
  '  }',
  '  function runRetune(uint16 mark) public { IVault(vault).retune(mark); }',
  '}',
].join('\n');

/** Solidity-import compile options, as the fixture compiles its contracts. */
const FIXTURE_OPTIONS = {
  solidityImportCompat: true,
  commitmentLimit: 128,
  maximumInputBytes: 10_000_000,
  messageBus: true,
  optimizeForCompilationSpeed: true,
  suppressWarnings: true,
  ecrecover: 'p2pkh',
  sortedMappingsAll: false,
  composition: 'per-call',
} as const;

const compiled = compileStringMulti(SOURCE, FIXTURE_OPTIONS as never);
const vault = compiled.Vault!;
const root = compiled.Root!;

/** A per-call contract's address, which its category fixes before anything is deployed. */
const addressOf = (id: string): Uint8Array => validatorAddress(hexToBin(id), VALIDATOR_PROGRAM);

/** A coin a genesis or a hop is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): Utxo {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** The data records one entry of `artifact` names, by data-record index, in its own layout's order. */
function namedRecords(artifact: Artifact, entry: string): readonly number[] {
  const slots = artifact.abi.find((candidate) => candidate.name === entry)?.blockLayout?.slots ?? [];
  return slots.filter((slot) => slot.kind === 'dataNft').sort((left, right) => left.offset - right.offset)
    .map((slot) => slot.nftIndex!);
}

/** The vault plain, the root behind its proxy, and an entry of the root to call. */
async function deployed(): Promise<{
  readonly network: MockNetworkProvider;
  readonly enter: (functionName: string) => Promise<PerCallProxyCallResult>;
}> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv));
  const changeAddress = wallet.address;
  const callerFunder = new SignatureTemplate(alicePriv).unlockP2PKH();
  const rootAddress = addressOf(ROOT_PROXY_CATEGORY);
  await network.addUtxo(wallet.address, funding(VAULT_CATEGORY));
  await deployStatefulContract(vault, [CALLER, rootAddress, CALLER, FEE, CALLER, rootAddress] as never, {
    fundingUtxo: funding(VAULT_CATEGORY), funder, changeAddress, provider: network, threadCount: 4,
  });
  for (const id of [ROOT_IMPL_CATEGORY, ROOT_PROXY_CATEGORY]) await network.addUtxo(wallet.address, funding(id));
  const [initCoin, callCoin] = ['initialize', 'call'].map((label) => funding(idOf(`${label} coin`)));
  for (const coin of [initCoin!, callCoin!]) await network.addUtxo(binToHex(CALLER), coin);
  await fundShippedFacets(network);
  const proxy = await deployPerCallProxy({
    provider: network,
    implementationArtifact: root,
    proxyArtifact: buildProxyArtifact(root),
    implementationDeploy: { fundingUtxo: funding(ROOT_IMPL_CATEGORY), funder, changeAddress },
    proxyDeploy: { fundingUtxo: funding(ROOT_PROXY_CATEGORY), funder, changeAddress },
    initialize: { functionName: 'initialize', args: [addressOf(VAULT_CATEGORY)] },
    callerLockingBytecode: CALLER,
    callerFunding: { utxo: initCoin!, funder: callerFunder, changeAddress },
    vm: compositionMachine(),
  });
  expect(proxy.initialize.broadcast).toBeDefined();
  expect(binToHex(proxy.proxy.address)).toBe(binToHex(rootAddress));
  const enter = (functionName: string): Promise<PerCallProxyCallResult> => callPerCallProxyEntry({
    provider: network,
    implementationArtifact: root,
    proxyArtifact: buildProxyArtifact(root),
    proxyCategoryId: proxy.proxy.categoryId,
    implementationCategoryId: proxy.implementation.categoryId,
    functionName,
    args: [MARK] as never,
    externals: { IVault: { artifact: vault, categoryId: VAULT_CATEGORY } },
    callerUtxo: callCoin!,
    callerLockingBytecode: CALLER,
    funder: callerFunder,
    changeAddress,
    vm: compositionMachine(),
  });
  return { network, enter };
}

/** The vault's input index for each of its data records in the composed transaction, by data-record index. */
function vaultRecordInputs(result: PerCallProxyCallResult): readonly number[] {
  return [0, 1].map((nftIndex) => result.draft.layout.participants
    .find((placed) => placed.id === `Vault-record-${nftIndex}`)!.index);
}

/** The vault's record values after the call, and the value the root kept from the read. */
async function settledValues(network: MockNetworkProvider, result: PerCallProxyCallResult): Promise<{
  readonly rounds: unknown; readonly status: unknown; readonly seen: unknown;
}> {
  const layout = vault.stateLayout!;
  const state = deploymentStateValues(layout, VAULT_CATEGORY, await readPerCallDeployment(network, VAULT_CATEGORY, layout));
  const rootLayout = buildProxyArtifact(root).stateLayout!;
  const field = rootLayout.variables.find((variable) => variable.name === 'seen')!;
  const seen = parsePushdataCommitment(binToHex(result.writtenCommitments[field.nftIndex]!), rootLayout, field.nftIndex)
    .seen;
  return { rounds: state.rounds, status: state.status, seen };
}

describe('a contract whose later frame in a hop declares a record its earlier frame did not', () => {
  it('compiles the read to name record 1 alone, the guarded write records 0 and 1, the audit records 0 and 2', () => {
    expect(namedRecords(vault, 'settle')).toStrictEqual([1]);
    expect(namedRecords(vault, 'claimOnce')).toStrictEqual([0, 1]);
    expect(namedRecords(vault, 'audit')).toStrictEqual([0, 2]);
    expect(namedRecords(vault, 'retune')).toStrictEqual([1]);
  });

  it('settles the read of record 1 and then the guarded write that names both records', async () => {
    const { network, enter } = await deployed();
    const result = await enter('run');
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // The records sit side by side in data-record order, whichever frame named one first.
    const [first, second] = vaultRecordInputs(result);
    expect(second).toBe(first! + 1);
    expect(await settledValues(network, result)).toStrictEqual({ rounds: 1n, status: 1n, seen: MARK + FEE });
  }, 300_000);

  it('settles the guarded write first and the read of record 1 after it', async () => {
    const { network, enter } = await deployed();
    const result = await enter('runClaimFirst');
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(await settledValues(network, result)).toStrictEqual({ rounds: 1n, status: 1n, seen: MARK + FEE });
  }, 300_000);

  it('settles a frame that names record 1 alone and writes it', async () => {
    const { network, enter } = await deployed();
    const result = await enter('runRetune');
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    const layout = vault.stateLayout!;
    const deployment = await readPerCallDeployment(network, VAULT_CATEGORY, layout);
    expect(deploymentStateValues(layout, VAULT_CATEGORY, deployment).fee).toBe(MARK);
  }, 300_000);

  it('refuses by name a hop whose frames name records no order keeps side by side', async () => {
    const { network, enter } = await deployed();
    // `claimOnce` needs record 1 right after record 0 and `audit` needs record 2 there.
    await expect(enter('runAndAudit')).rejects.toThrow(/reads its data records of "Vault" side by side/);
    const layout = vault.stateLayout!;
    const deployment = await readPerCallDeployment(network, VAULT_CATEGORY, layout);
    expect(deploymentStateValues(layout, VAULT_CATEGORY, deployment).rounds).toBe(0n);
  }, 300_000);
});
