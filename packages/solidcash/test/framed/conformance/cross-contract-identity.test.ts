import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { Interface } from 'ethers';
import { hash160, validatorAddress } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import { fundShippedFacets } from '../shapes/harness.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * S0's cross-contract rows (spec R3, plan D7): the reference contexts of
 * `docs/framed/probes/this-call-msg-sender/ref.sol` that cross a contract boundary, the EVM against the framed
 * path. Each row deploys the contracts it names in order, on the EVM from an EOA and framed through the shipped
 * deployment, then calls one entry; framed, rows whose leading contracts compile the same share those deployments,
 * each rewinding the chain to them before it deploys its last. An answer is compared by role: the user who entered,
 * or the name a contract was deployed as. A row the framed path does not serve yet is pinned with the refusal it
 * meets, by name, beside the EVM's answer. The framed side enters through the plain call path, which plans the
 * callee frames of a call between plain deployments as the proxy hop does; the hop's own shapes are probed for the
 * marketplace in `ahead/`.
 */

type Role = string | boolean | bigint;
type Answer = Role | readonly Role[];

const IA = 'interface IA { function k() external view returns (address);'
  + ' function whoExt() external view returns (address); }';
const B = 'contract B {'
  + ' address public lastReceiveSender; address public lastFallbackSender;'
  + ' function who() external view returns (address sender, address origin) { return (msg.sender, tx.origin); }'
  + ' function callback(IA a) external view returns (address) { return a.k(); }'
  + ' receive() external payable { lastReceiveSender = msg.sender; }'
  + ' fallback() external payable { lastFallbackSender = msg.sender; } }';
// `marker` makes `Impl` a stateful contract, which a framed deployment needs; `who()` does not read it.
const IMPL = 'contract Impl { uint256 public marker;'
  + ' function who() external view returns (address sender, address self_) { return (msg.sender, address(this)); } }';
const CHILD = 'contract Child { address public creator; address public origin0;'
  + ' constructor() { creator = msg.sender; origin0 = tx.origin; } }';
const PAIR = 'contract Pair { address public factory; bool public initialized;'
  + ' constructor() { factory = msg.sender; }'
  + ' function initialize() external { require(msg.sender == factory, "FORBIDDEN"); initialized = true; } }';
const FACTORY = 'contract Factory { function make() external returns (Pair p) { p = new Pair(); p.initialize(); } }';
const IMPL_P = 'contract ImplP {'
  + ' function f() external view returns (address sender, address self_) { return (msg.sender, address(this)); }'
  + ' function callB(B b) external view returns (address) { (address s, ) = b.who(); return s; } }';
const PROXY = 'contract Proxy { address immutable impl; constructor(address i) { impl = i; }'
  + ' fallback() external payable { address i = impl; assembly {'
  + ' calldatacopy(0, 0, calldatasize()) let ok := delegatecall(gas(), i, 0, calldatasize(), 0, 0)'
  + ' returndatacopy(0, 0, returndatasize())'
  + ' switch ok case 0 { revert(0, returndatasize()) } default { return(0, returndatasize()) } } } }';

interface Deployment {
  /** The contract's name in the row's source, which is also its role. */
  readonly name: string;
  /** Earlier deployments whose addresses are its constructor arguments. */
  readonly args?: readonly string[];
}

interface Row {
  readonly label: string;
  readonly source: string;
  readonly deployments: readonly Deployment[];
  /** The deployment entered, the contract whose ABI encodes the call (the target's own unless a proxy forwards). */
  readonly target: string;
  readonly abiOf?: string;
  readonly entry: string;
  /** Arguments naming deployments, passed as their addresses. */
  readonly args?: readonly string[];
  readonly value?: bigint;
  /** The EVM's answer by role, one value or one per returned field; `true` for a row that observes success. */
  readonly evm: Answer;
  readonly observesSuccess?: boolean;
  /** The refusal the framed path meets today, for a row it does not serve yet. */
  readonly refusal?: RegExp;
}

/** A contract A holding B and Impl, with the row's members. */
const contractA = (members: string): string => 'contract A { B public b; Impl public impl; Child public lastChild;'
  + ' constructor(B b_, Impl impl_) { b = b_; impl = impl_; }'
  + ' function k() external view returns (address) { return msg.sender; }'
  + ` ${members} }`;
const WITH_A: readonly Deployment[] = [{ name: 'B' }, { name: 'Impl' }, { name: 'A', args: ['B', 'Impl'] }];
const aRow = (label: string, entry: string, members: string, evm: Answer, extra: Partial<Row> = {}): Row => ({
  label, entry, evm, target: 'A', deployments: WITH_A,
  source: `pragma solidity ^0.8.0; ${IA} ${B} ${IMPL} ${CHILD} ${contractA(members)}`,
  ...extra,
});

/** A frame of the root's own contract below a callee: the planner gives the root's contract one master. */
const REENTRY = new RegExp('entry "viaReentry" makes 1 external call\\(s\\): the call to "IA\\.k" reaches "A", which '
  + 'this hop already places; a contract that reaches itself below itself cannot be given a second block');
/** A raw call whose payload the compiler cannot name statically is refused by name in the body that makes it. */
const rawCall = (entry: string): RegExp => new RegExp(`A\\.${entry}\\(\\): the call to '__raw__' takes the direct path's`);
const NO_CREATE = /contract creation needs the witness `CREATE` checks, which are not emitted yet/;
const NO_LOW_LEVEL_CHECKS = /a low-level call needs the witness `calls\[\]` checks, which are not emitted yet/;
// The framed path serves the proxies it generates; a hand-written assembly one is refused at compile.
const ASSEMBLY_PROXY = /Final statement is expected to be a require\(\) statement/;

const ROWS: readonly Row[] = [
  aRow('A -> B.who(): msg.sender', 'viaCross',
    'function viaCross() external view returns (address) { (address s, ) = b.who(); return s; }', 'A'),
  aRow('A -> B.who(): tx.origin', 'originInCross',
    'function originInCross() external view returns (address) { (, address o) = b.who(); return o; }', 'EOA'),
  // A returned address is the 20-byte identity while `address(this)` and `tx.origin` are full locks (DECISIONS
  // D13): equality compares the one address both forms name, as an escrow checks a sender against its record.
  aRow('A -> B.who(): the returned sender equals address(this)', 'senderIsSelf',
    'function senderIsSelf() external view returns (bool) { (address s, ) = b.who(); return s == address(this); }',
    true),
  aRow('A -> B.who(): the returned origin equals tx.origin', 'originIsOrigin',
    'function originIsOrigin() external view returns (bool) { (, address o) = b.who(); return o == tx.origin; }',
    true),
  aRow('A -> staticcall B.who()', 'viaStaticcall',
    'function viaStaticcall() external view returns (address) {'
    + ' (bool ok, bytes memory r) = address(b).staticcall(abi.encodeCall(B.who, ())); require(ok);'
    + ' (address s, ) = abi.decode(r, (address, address)); return s; }', 'A'),
  aRow('A -> B -> A.k() re-entry', 'viaReentry',
    'function viaReentry() external view returns (address) { return b.callback(IA(address(this))); }', 'B',
    { refusal: REENTRY }),
  aRow('A delegatecall Impl.who(): (sender, this)', 'viaDelegateOther',
    'function viaDelegateOther() external returns (address sender, address self_) {'
    + ' (bool ok, bytes memory r) = address(impl).delegatecall(abi.encodeCall(Impl.who, ())); require(ok);'
    + ' return abi.decode(r, (address, address)); }', ['EOA', 'A'],
    { refusal: NO_LOW_LEVEL_CHECKS }),
  aRow('A new Child(): (creator, origin)', 'viaCreate',
    'function viaCreate() external returns (address creator, address origin0) {'
    + ' lastChild = new Child(); return (lastChild.creator(), lastChild.origin0()); }', ['A', 'EOA'],
    { refusal: NO_CREATE }),
  aRow('A sends value to B: receive() sender', 'viaSend',
    'function viaSend() external payable returns (address) {'
    + ' (bool ok, ) = payable(address(b)).call{value: msg.value}(""); require(ok);'
    + ' return b.lastReceiveSender(); }', 'A', { value: 5n }),
  aRow('A calls B unknown fn: fallback() sender', 'viaFallback',
    'function viaFallback() external returns (address) {'
    + ' (bool ok, ) = address(b).call(abi.encodeWithSignature("nonexistent()")); require(ok);'
    + ' return b.lastFallbackSender(); }', 'A'),
  aRow('A calls B unknown fn, signature built at run time', 'viaRuntimeSignature',
    'function viaRuntimeSignature() external returns (address) {'
    + ' string memory sig = string(abi.encodePacked("nonexist", "ent()"));'
    + ' (bool ok, ) = address(b).call(abi.encodeWithSignature(sig)); require(ok);'
    + ' return b.lastFallbackSender(); }', 'A', { refusal: rawCall('viaRuntimeSignature') }),
  {
    label: 'user -> Proxy -> ImplP.f(): (sender, this)', entry: 'f', evm: ['EOA', 'Proxy'],
    source: `pragma solidity ^0.8.0; ${IA} ${B} ${IMPL_P} ${PROXY}`,
    deployments: [{ name: 'ImplP' }, { name: 'Proxy', args: ['ImplP'] }], target: 'Proxy', abiOf: 'ImplP',
    refusal: ASSEMBLY_PROXY,
  },
  {
    label: 'user -> Proxy -> ImplP.callB(B): B sees', entry: 'callB', args: ['B'], evm: 'Proxy',
    source: `pragma solidity ^0.8.0; ${IA} ${B} ${IMPL_P} ${PROXY}`,
    deployments: [{ name: 'B' }, { name: 'ImplP' }, { name: 'Proxy', args: ['ImplP'] }], target: 'Proxy',
    abiOf: 'ImplP', refusal: ASSEMBLY_PROXY,
  },
  {
    label: 'Factory.make(): new Pair(); pair.initialize() from the factory', entry: 'make', evm: true,
    observesSuccess: true, source: `pragma solidity ^0.8.0; ${PAIR} ${FACTORY}`,
    deployments: [{ name: 'Factory' }], target: 'Factory', refusal: NO_CREATE,
  },
];

/** The row's answer on the EVM, by role. */
async function evmAnswer(row: Row): Promise<Answer> {
  const require = createRequire(import.meta.url);
  const solc = require('solc') as { compile(input: string): string };
  const { createEVM } = await import('@ethereumjs/evm');
  const { createAccount, createAddressFromString } = await import('@ethereumjs/util');
  const output = JSON.parse(solc.compile(JSON.stringify({
    language: 'Solidity', sources: { 'row.sol': { content: row.source } },
    settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
  }))) as { contracts: Record<string, Record<string, { abi: never; evm: { bytecode: { object: string } } }>> };
  const compiled = output.contracts['row.sol']!;
  const eoa = createAddressFromString(`0x${'e0'.repeat(19)}e1`);
  const evm = await createEVM();
  await evm.stateManager.putAccount(eoa, createAccount({ nonce: 0n, balance: 10n ** 20n }));
  const addresses = new Map<string, string>();
  for (const deployment of row.deployments) {
    const contract = compiled[deployment.name]!;
    const args = (deployment.args ?? []).map((name) => addresses.get(name)!);
    const encoded = args.length === 0 ? '' : new Interface(contract.abi).encodeDeploy(args).slice(2);
    const deployed = await evm.runCall({
      caller: eoa, origin: eoa, data: hexToBin(contract.evm.bytecode.object + encoded), gasLimit: 30_000_000n,
    });
    addresses.set(deployment.name, deployed.createdAddress!.toString());
  }
  const iface = new Interface(compiled[row.abiOf ?? row.target]!.abi);
  const called = await evm.runCall({
    to: createAddressFromString(addresses.get(row.target)!), caller: eoa, origin: eoa, gasLimit: 30_000_000n,
    value: row.value ?? 0n,
    data: hexToBin(iface.encodeFunctionData(row.entry, (row.args ?? []).map((name) => addresses.get(name)!)).slice(2)),
  });
  if (row.observesSuccess) return called.execResult.exceptionError === undefined;
  const roleOf = (value: unknown): Role => {
    if (typeof value === 'boolean' || typeof value === 'bigint') return value;
    const address = String(value).toLowerCase();
    if (address === eoa.toString()) return 'EOA';
    return [...addresses].find(([, deployed]) => deployed === address)?.[0] ?? address;
  };
  const roles = [...iface.decodeFunctionResult(row.entry, `0x${binToHex(called.execResult.returnValue)}`)].map(roleOf);
  return roles.length === 1 ? roles[0]! : roles;
}

type ArtifactMap = ReturnType<typeof compileStringMulti>;

/** A chain a row's contracts are deployed on: each deployed contract's address and category, by name. */
interface Chain {
  readonly provider: MockNetworkProvider;
  readonly funder: Contract;
  readonly addresses: Map<string, Uint8Array>;
  readonly categories: Map<string, string>;
}

/** Deploys one of a row's contracts from the funding coin its position names, or answers the refusal it met. */
async function deployAt(
  chain: Chain, artifacts: ArtifactMap, deployment: Deployment, index: number, validatorProgram: Uint8Array,
): Promise<string | undefined> {
  const fundingUtxo = { txid: `${'33'.repeat(31)}${(0xc0 + index).toString(16)}`, vout: 0, satoshis: 500_000n };
  await chain.provider.addUtxo(chain.funder.address, fundingUtxo);
  try {
    const deployed = await deployStatefulContract(artifacts[deployment.name]!,
      (deployment.args ?? []).map((name) => chain.addresses.get(name)!), {
        provider: chain.provider, fundingUtxo, changeAddress: chain.funder.address,
        funder: chain.funder.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      });
    chain.addresses.set(deployment.name, validatorAddress(hexToBin(deployed.categoryId), validatorProgram));
    chain.categories.set(deployment.name, deployed.categoryId);
    return undefined;
  } catch (error) {
    return `deploy ${deployment.name}: ${(error as Error).message}`;
  }
}

/** An artifact as a key, less the unit's source text and compile time it records, which are not what deploys. */
const deployedAs = (artifact: ArtifactMap[string]): string =>
  JSON.stringify({ ...artifact, source: undefined, updatedAt: undefined },
    (_key, value: unknown) => (typeof value === 'bigint' ? value.toString() : value));

type Leading = (Chain & { readonly snapshot: SnapshotRestorer }) | { readonly refusal: string };
const leadingRuns = new Map<string, Promise<Leading>>();

/**
 * The chain with every deployment before the row's last done. Rows whose leading contracts compile the same share
 * it, and each rewinds it before deploying its own last contract, so none reads another's broadcast.
 */
async function leadingChain(row: Row, artifacts: ArtifactMap, validatorProgram: Uint8Array): Promise<Leading> {
  const leading = row.deployments.slice(0, -1);
  const key = JSON.stringify(leading.map((deployment) =>
    [deployment.name, deployment.args ?? [], deployedAs(artifacts[deployment.name]!)]));
  let run = leadingRuns.get(key);
  if (run === undefined) {
    run = (async (): Promise<Leading> => {
      const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
      const chain: Chain = {
        provider, funder: new Contract(p2pkhArtifact, [alicePkh], { provider }),
        addresses: new Map(), categories: new Map(),
      };
      await fundShippedFacets(provider);
      for (const [index, deployment] of leading.entries()) {
        const refusal = await deployAt(chain, artifacts, deployment, index, validatorProgram);
        if (refusal !== undefined) return { refusal };
      }
      return { ...chain, snapshot: await provider.takeSnapshot() };
    })();
    leadingRuns.set(key, run);
  }
  const shared = await run;
  if ('refusal' in shared) return shared;
  await shared.snapshot.restore();
  return shared;
}

/** The row's answer on the framed path, by role, or the refusal it meets. */
async function framedAnswer(row: Row): Promise<{ readonly role?: Answer; readonly refusal?: string }> {
  let artifacts;
  try {
    artifacts = compileStringMulti(row.source, { composition: 'framed', evmCompat: true } as never);
  } catch (error) {
    return { refusal: `compile: ${(error as Error).message}` };
  }
  const target = artifacts[row.target]!;
  const refused = target.composition?.refusedEntries?.find((entry) => entry.functionName.includes(row.entry));
  if (refused !== undefined) return { refusal: `${refused.functionName}: ${refused.reason}` };
  const { framedValidator } = await import('@solidcash/solidc');
  const validatorProgram = framedValidator.buildValidatorProgram();
  const leading = await leadingChain(row, artifacts, validatorProgram);
  if ('refusal' in leading) return leading;
  const chain: Chain = { ...leading, addresses: new Map(leading.addresses), categories: new Map(leading.categories) };
  const last = row.deployments.length - 1;
  const refusal = await deployAt(chain, artifacts, row.deployments[last]!, last, validatorProgram);
  if (refusal !== undefined) return { refusal };
  const { provider, addresses } = chain;
  // Each deployed contract as the call path takes it: this row's own artifact, at the category it was deployed at.
  const externals = Object.fromEntries([...chain.categories]
    .map(([name, categoryId]) => [name, { artifact: artifacts[name]!, categoryId }]));
  const user = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: `${'45'.repeat(31)}ba`, vout: 0, satoshis: 300_000n };
  await provider.addUtxo(binToHex(user), callerUtxo);
  let answered;
  try {
    answered = await callFramedEntry({
      provider, artifact: target, categoryId: externals[row.target]!.categoryId, functionName: row.entry,
      args: (row.args ?? []).map((name) => addresses.get(name)!), callerUtxo, callerLockingBytecode: user,
      funder: new SignatureTemplate(alicePriv).unlockP2PKH(), vm: compositionMachine(), externals,
      ...(row.value === undefined ? {} : { value: row.value }),
    });
  } catch (error) {
    return { refusal: `call: ${(error as Error).message}` };
  }
  if (!answered.accepted) {
    return { refusal: `call: ${answered.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ')}` };
  }
  if (row.observesSuccess) return { role: true };
  const roleOf = (value: unknown): Role => {
    if (typeof value === 'boolean' || typeof value === 'bigint') return value;
    const address = value instanceof Uint8Array ? binToHex(value) : String(value);
    if (address === binToHex(alicePkh)) return 'EOA';
    // A Solidity `address` is the hash160 of the lock the contract's category derives.
    return [...addresses].find(([, deployed]) => binToHex(hash160(deployed)) === address)?.[0] ?? address;
  };
  const roles = answered.values.map(roleOf);
  return { role: roles.length === 1 ? roles[0]! : roles };
}

describe('S0: the cross-contract reference rows, the EVM against the framed path', () => {
  for (const row of ROWS) {
    it(`${row.label}: the EVM answers ${String(row.evm)}${row.refusal === undefined ? ', and so does framed' : ''}`,
      async () => {
        expect(await evmAnswer(row)).toStrictEqual(row.evm);
        const answer = await framedAnswer(row);
        if (row.refusal === undefined) expect(answer).toStrictEqual({ role: row.evm });
        else expect(answer.refusal).toMatch(row.refusal);
      }, 180_000);
  }
});
