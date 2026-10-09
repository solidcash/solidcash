import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { bytesToHex, parsePushdataCommitment, sha256, validatorAddress, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import { deploymentStateValues } from '../../../src/framed/proxy/external-calls.js';
import type { Utxo } from '../../../src/interfaces.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A plain root whose later call into one contract enters a frame that names a data record its earlier frame did not.
 *
 * `Root.run` (a plain deployment) calls `Vault.settle`, whose body reads only the record that holds the vault's
 * addresses and fee (data record 1), and then `Vault.claimOnce`, which checks its caller against an address in that
 * record and writes the guard and counter its other record holds (data record 0). A frame reads each data record it
 * names at its record base plus the record's offset in its own layout, so the records it names have to sit side by
 * side. The plain call path placed a contract's records in the order its frames first declared them, record 1 for
 * the earlier frame and record 0 behind it for the later one, so the later frame read its record 1 one input past
 * record 0 and refused at its caller check. The block now keeps that order only when it serves every frame, and
 * otherwise places the records in data-record order ahead of the nodes, as the hop does
 * (`call/records-a-later-frame-adds`); a block whose frames name records no order keeps side by side (`Vault.audit`
 * names records 0 and 2, `claimOnce` 0 and 1) is refused by name. A paid body on a callee's block reads its records
 * the same way: `Root.payThenSettle` pays the vault, whose `receive()` names records 0 and 1, beside `settle`, and
 * its records used to follow the callee's record 1; `payThenAudit` pays it beside `audited`, which names records 0
 * and 2, and is refused by name.
 */

/** A 32-byte category or txid that is neither one repeated byte nor a palindrome, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`plain records a later frame adds ${label}`)));
}

const VAULT_CATEGORY = idOf('vault');
const ROOT_CATEGORY = idOf('root');
const CALLER = encodeLockingBytecodeP2pkh(alicePkh);
const FEE = 7n;
const MARK = 30n;
/** The value `payThenSettle` forwards to the vault, and the ABI name its `receive()` is published under. */
const PAID = 5_000n;
const PAID_BODY = '__receive';

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IVault {',
  '  function settle(uint16 mark) external view returns (uint16);',
  '  function claimOnce() external;',
  '  function audit() external;',
  '  function audited() external view returns (uint256);',
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
  '  function audited() external view returns (uint256) {',
  '    require(msg.sender == auditor, "not the auditor");',
  '    return rounds + cap;',
  '  }',
  '  receive() external payable {',
  '    require(msg.sender == claimer, "not the claimer");',
  '    rounds = rounds + 1;',
  '  }',
  '}',
  'contract Root {',
  '  address public vault;',
  '  uint256 public seen;',
  '  constructor(address vault_) { vault = vault_; }',
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
  '  function payThenSettle(uint16 mark) public payable {',
  '    (bool ok, ) = payable(vault).call{value: msg.value}("");',
  '    require(ok);',
  '    seen = IVault(vault).settle(mark);',
  '  }',
  '  function payThenAudit(uint16 mark) public payable {',
  '    (bool ok, ) = payable(vault).call{value: msg.value}("");',
  '    require(ok);',
  '    seen = IVault(vault).audited() + mark;',
  '  }',
  '}',
].join('\n');

/** Solidity-import compile options, as the hop's replica compiles the same vault. */
const FIXTURE_OPTIONS = {
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

const compiled = compileStringMulti(SOURCE, FIXTURE_OPTIONS as never);
const vault = compiled.Vault!;
const root = compiled.Root!;

/** A framed contract's address, which its category fixes before anything is deployed. */
const addressOf = (id: string): Uint8Array => validatorAddress(hexToBin(id), VALIDATOR_PROGRAM);

/** A coin a genesis or a call is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): Utxo {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** The data records one entry of `artifact` names, by data-record index, in its own layout's order. */
function namedRecords(artifact: Artifact, entry: string): readonly number[] {
  const slots = artifact.abi.find((candidate) => candidate.name === entry)?.blockLayout?.slots ?? [];
  return slots.filter((slot) => slot.kind === 'dataNft').sort((left, right) => left.offset - right.offset)
    .map((slot) => slot.nftIndex!);
}

/** The deployments the cases share, and the chain as it stood when they were done. */
interface Chain {
  readonly network: MockNetworkProvider;
  readonly callCoin: Utxo;
  readonly snapshot: SnapshotRestorer;
}

let chainRun: Promise<Chain> | undefined;

/** The vault and the plain root that calls it, deployed once; each case rewinds the chain to them first. */
async function deployed(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
    const funder = wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv));
    const changeAddress = wallet.address;
    const rootAddress = addressOf(ROOT_CATEGORY);
    for (const id of [VAULT_CATEGORY, ROOT_CATEGORY]) await network.addUtxo(wallet.address, funding(id));
    await deployStatefulContract(vault, [CALLER, rootAddress, CALLER, FEE, CALLER, rootAddress] as never, {
      fundingUtxo: funding(VAULT_CATEGORY), funder, changeAddress, provider: network, threadCount: 4,
    });
    await deployStatefulContract(root, [addressOf(VAULT_CATEGORY)] as never, {
      fundingUtxo: funding(ROOT_CATEGORY), funder, changeAddress, provider: network, threadCount: 4,
    });
    const callCoin = funding(idOf('call coin'));
    await network.addUtxo(binToHex(CALLER), callCoin);
    await fundShippedFacets(network);
    return { network, callCoin, snapshot: await network.takeSnapshot() };
  })();
  const chain = await chainRun;
  await chain.snapshot.restore();
  return chain;
}

/** Enters one of the root's entries, naming the vault as its calls and its payment reach it. */
function enter(chain: Chain, functionName: string, value?: bigint): Promise<FramedCallResult> {
  return callFramedEntry({
    provider: chain.network,
    artifact: root,
    categoryId: ROOT_CATEGORY,
    functionName,
    args: [MARK] as never,
    externals: { IVault: { artifact: vault, categoryId: VAULT_CATEGORY } },
    callerUtxo: chain.callCoin,
    callerLockingBytecode: CALLER,
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
    vm: compositionMachine(),
    ...(value === undefined ? {} : { value }),
  });
}

/** The vault's input index for each of its data records in the composed transaction, by data-record index. */
function vaultRecordInputs(result: FramedCallResult): readonly number[] {
  return [0, 1].map((nftIndex) => result.draft.layout.participants
    .find((placed) => placed.id === `Vault-record-${nftIndex}`)!.index);
}

/** The vault's record values after the call, and the value the root kept from the read. */
async function settledValues(chain: Chain, result: FramedCallResult): Promise<{
  readonly rounds: unknown; readonly status: unknown; readonly seen: unknown;
}> {
  const layout = vault.stateLayout!;
  const state = deploymentStateValues(
    layout, VAULT_CATEGORY, await readFramedDeployment(chain.network, VAULT_CATEGORY, layout),
  );
  const rootLayout = root.stateLayout!;
  const field = rootLayout.variables.find((variable) => variable.name === 'seen')!;
  const seen = parsePushdataCommitment(binToHex(result.writtenCommitments[field.nftIndex]!), rootLayout, field.nftIndex)
    .seen;
  return { rounds: state.rounds, status: state.status, seen };
}

describe('a plain root whose later call into one contract names a record its earlier call did not', () => {
  it('compiles the read to name record 1 alone, the guarded writes records 0 and 1, the audits records 0 and 2', () => {
    expect(namedRecords(vault, 'settle')).toStrictEqual([1]);
    expect(namedRecords(vault, 'claimOnce')).toStrictEqual([0, 1]);
    expect(namedRecords(vault, 'audit')).toStrictEqual([0, 2]);
    expect(namedRecords(vault, 'audited')).toStrictEqual([0, 2]);
    expect(namedRecords(vault, PAID_BODY)).toStrictEqual([0, 1]);
  });

  it('settles the read of record 1 and then the guarded write that names both records', async () => {
    const chain = await deployed();
    const result = await enter(chain, 'run');
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // The records sit side by side in data-record order, though the earlier frame named record 1 first.
    const [first, second] = vaultRecordInputs(result);
    expect(second).toBe(first! + 1);
    expect(await settledValues(chain, result)).toStrictEqual({ rounds: 1n, status: 1n, seen: MARK + FEE });
  }, 300_000);

  it('settles the guarded write first and the read of record 1 after it', async () => {
    const chain = await deployed();
    const result = await enter(chain, 'runClaimFirst');
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(await settledValues(chain, result)).toStrictEqual({ rounds: 1n, status: 1n, seen: MARK + FEE });
  }, 300_000);

  it('settles a paid body that names records 0 and 1 beside a callee that names record 1 alone', async () => {
    const chain = await deployed();
    const result = await enter(chain, 'payThenSettle', PAID);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(result.completed.map((frame) => frame.functionName)).toContain(`Vault.${PAID_BODY}()`);
    // The paid body's records sit side by side, though the callee's block named record 1 first.
    const [first, second] = vaultRecordInputs(result);
    expect(second).toBe(first! + 1);
    expect(await settledValues(chain, result)).toStrictEqual({ rounds: 1n, status: 1n, seen: MARK + FEE });
  }, 300_000);

  it('refuses by name a root whose frames name records no order keeps side by side', async () => {
    const chain = await deployed();
    // `claimOnce` needs record 1 right after record 0 and `audit` needs record 2 there.
    await expect(enter(chain, 'runAndAudit')).rejects
      .toThrow(/the callee "Vault\.audit\(\)" reads its data records of "Vault" side by side/);
    const layout = vault.stateLayout!;
    const deployment = await readFramedDeployment(chain.network, VAULT_CATEGORY, layout);
    expect(deploymentStateValues(layout, VAULT_CATEGORY, deployment).rounds).toBe(0n);
  }, 300_000);

  it('refuses by name a paid body and a callee whose records no order keeps side by side', async () => {
    const chain = await deployed();
    // The paid body needs record 1 right after record 0 and `audited` needs record 2 there.
    await expect(enter(chain, 'payThenAudit', PAID)).rejects
      .toThrow(/pays "Vault", which its calls also reach, and the frame "Vault\.audited\(\)" reads its data records/);
    const layout = vault.stateLayout!;
    const deployment = await readFramedDeployment(chain.network, VAULT_CATEGORY, layout);
    expect(deploymentStateValues(layout, VAULT_CATEGORY, deployment).rounds).toBe(0n);
  }, 300_000);
});
