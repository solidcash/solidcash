import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { Interface, id } from 'ethers';
import { computeFunctionSelectorHex, hash160, validatorAddress } from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import { fundShippedFacets } from '../shapes/harness.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * S0, the conformance suite (spec R3, plan D7): the single-contract rows of the reference contexts in
 * `docs/framed/probes/this-call-msg-sender/ref.sol`, the EVM against the framed path.
 *
 * Each row is its own contract, so a row the framed path refuses leaves the others running. The EVM side compiles
 * it with solc and runs it in `@ethereumjs/evm`, entered by an EOA; the framed side compiles it for the framed
 * convention with Solidity compatibility, deploys it and calls it through the shipped call path, entered by a user's
 * coin. Each answer is compared by role: the user who entered, or the contract itself (what its `self()` answers).
 * Every row's entry writes, so the framed answer comes from a frame the user's coin enters. A row the framed
 * path does not serve yet is pinned with the refusal it meets, beside the answer the EVM gives. A selector is
 * compared by the function it selects: the EVM hashes a signature with keccak256, and the framed dispatcher
 * follows its compile's mode (D27), which for this evmCompat fixture is the same keccak256 scheme.
 */

type Role = 'EOA' | 'A' | boolean | bigint | `${string}()`;

const IA = 'interface IA { function whoExt() external view returns (address); }';
const WHO = 'function whoExt() external view returns (address) { return msg.sender; }';
const SELF = 'function self() external returns (address) { marker += 1; return address(this); }';

interface Row {
  readonly label: string;
  readonly entry: string;
  readonly members: string;
  /** The EVM's answer, which the live EVM run is checked against first. */
  readonly evm: Role;
  /** The refusal the framed path meets today, for a row it does not serve yet. */
  readonly refusal?: RegExp;
  /** The value the user's call carries, in wei on the EVM and in satoshis framed. */
  readonly value?: bigint;
}

const ROWS: readonly Row[] = [
  {
    label: 'user calls A.whoExt()', entry: 'direct', evm: 'EOA',
    members: 'function direct() external returns (address) { marker += 1; return msg.sender; }',
  },
  {
    label: 'internal g()', entry: 'viaInternal', evm: 'EOA',
    members: 'function _who() internal view returns (address) { return msg.sender; }'
      + ' function viaInternal() external returns (address) { marker += 1; return _who(); }',
  },
  {
    label: 'this.g()', entry: 'viaThis', evm: 'A',
    members: `${WHO} function viaThis() external returns (address) { marker += 1; return this.whoExt(); }`,
  },
  {
    label: 'IA(address(this)).g()', entry: 'viaInterfaceSelf', evm: 'A',
    // A call to its own address needs a second master of the root's contract, which the planner does not give it.
    refusal: /the call to "IA\.whoExt" reaches "A", which this hop already places/,
    members: `${WHO} function viaInterfaceSelf() external returns (address) { marker += 1;`
      + ' return IA(address(this)).whoExt(); }',
  },
  {
    label: 'address(this).call(g)', entry: 'viaLowLevelSelf', evm: 'A',
    members: `${WHO} function viaLowLevelSelf() external returns (address) { marker += 1;`
      + ' (bool ok, bytes memory r) = address(this).call(abi.encodeCall(IA.whoExt, ())); require(ok);'
      + ' return abi.decode(r, (address)); }',
  },
  {
    label: 'address(this).delegatecall(g)', entry: 'viaDelegateSelf', evm: 'EOA',
    // A delegatecall body must not write its own state, so this row's entry does not bump the marker.
    members: `${WHO} function viaDelegateSelf() external returns (address) {`
      + ' (bool ok, bytes memory r) = address(this).delegatecall(abi.encodeCall(IA.whoExt, ())); require(ok);'
      + ' return abi.decode(r, (address)); }',
  },
  {
    label: 'try this.g()', entry: 'viaTryThis', evm: 'A',
    members: `${WHO} function viaTryThis() external returns (address) { marker += 1;`
      + ' try this.whoExt() returns (address s) { return s; } catch { return address(0); } }',
  },
  {
    label: 'msg.sender == tx.origin at top level', entry: 'senderIsOrigin', evm: true,
    members: 'function senderIsOrigin() external returns (bool) { marker += 1; return msg.sender == tx.origin; }',
  },
  {
    label: 'msg.sender == tx.origin inside this.g()', entry: 'senderIsOriginViaThis', evm: false,
    members: 'function senderIsOriginExt() external view returns (bool) { return msg.sender == tx.origin; }'
      + ' function senderIsOriginViaThis() external returns (bool) { marker += 1; return this.senderIsOriginExt(); }',
  },
];

/** Rows beyond the reference file: where `tx.origin` is read, which the framed path threads to a subroutine. */
const ORIGIN_ROWS: readonly Row[] = [
  {
    label: 'tx.origin read in an internal helper', entry: 'originViaHelper', evm: 'EOA',
    members: 'function _origin() internal view returns (address) { return tx.origin; }'
      + ' function originViaHelper() external returns (address) { marker += 1; return _origin(); }',
  },
  {
    label: 'tx.origin inside this.g()', entry: 'originViaThis', evm: 'EOA',
    members: 'function originExt() external view returns (address) { return tx.origin; }'
      + ' function originViaThis() external returns (address) { marker += 1; return this.originExt(); }',
  },
];

/** Rows beyond the reference file: where `msg.value` is read, which a self-call does not carry. */
const PAID = 5_000n;
const VALUE_ROWS: readonly Row[] = [
  {
    label: 'msg.value at the top', entry: 'valueDirect', evm: PAID, value: PAID,
    members: 'function valueDirect() external payable returns (uint256) { marker += 1; return msg.value; }',
  },
  {
    label: 'msg.value read in an internal helper', entry: 'valueViaHelper', evm: PAID, value: PAID,
    members: 'function _value() internal view returns (uint256) { return msg.value; }'
      + ' function valueViaHelper() external payable returns (uint256) { marker += 1; return _value(); }',
  },
  {
    label: 'msg.value inside this.g()', entry: 'valueViaThis', evm: 0n, value: PAID,
    members: 'function valueExt() external payable returns (uint256) { return msg.value; }'
      + ' function valueViaThis() external payable returns (uint256) { marker += 1; return this.valueExt(); }',
  },
];

/** Rows beyond the reference file: `msg.sig`, which an internal call keeps and a self-call replaces. */
const SIG_ROWS: readonly Row[] = [
  {
    label: 'msg.sig at the top', entry: 'sigDirect', evm: 'sigDirect()',
    members: 'function sigDirect() external returns (bytes4) { marker += 1; return msg.sig; }',
  },
  {
    label: 'msg.sig inside this.g()', entry: 'sigViaThis', evm: 'sigExt()',
    members: 'function sigExt() external pure returns (bytes4) { return msg.sig; }'
      + ' function sigViaThis() external returns (bytes4) { marker += 1; return this.sigExt(); }',
  },
  {
    label: 'msg.sig read in an internal helper', entry: 'sigViaHelper', evm: 'sigViaHelper()',
    members: 'function _sig() internal pure returns (bytes4) { return msg.sig; }'
      + ' function sigViaHelper() external returns (bytes4) { marker += 1; return _sig(); }',
  },
  {
    label: 'msg.sig inside a public function called internally', entry: 'sigViaPublic', evm: 'sigViaPublic()',
    members: 'function sigPub() public pure returns (bytes4) { return msg.sig; }'
      + ' function sigViaPublic() external returns (bytes4) { marker += 1; return sigPub(); }',
  },
  {
    label: 'msg.sig in the helper of a public function called internally', entry: 'sigViaPublicHelper',
    evm: 'sigViaPublicHelper()',
    members: 'function _sig() internal pure returns (bytes4) { return msg.sig; }'
      + ' function sigPub() public pure returns (bytes4) { return _sig(); }'
      + ' function sigViaPublicHelper() external returns (bytes4) { marker += 1; return sigPub(); }',
  },
  {
    label: 'msg.sig in the helper of this.g()', entry: 'sigViaThisHelper', evm: 'sigExt()',
    members: 'function _sig() internal pure returns (bytes4) { return msg.sig; }'
      + ' function sigExt() external pure returns (bytes4) { return _sig(); }'
      + ' function sigViaThisHelper() external returns (bytes4) { marker += 1; return this.sigExt(); }',
  },
  {
    label: 'msg.sig inside this.g() that writes state', entry: 'sigViaThisWriter', evm: 'sigWriter()',
    members: 'function sigWriter() external returns (bytes4) { marker += 1; return msg.sig; }'
      + ' function sigViaThisWriter() external returns (bytes4) { marker += 1; return this.sigWriter(); }',
  },
];

/**
 * Rows beyond the reference file: `msg.data`, which an internal call keeps and a self-call replaces. Each compares
 * digests of two reads, since the EVM's calldata and a framed frame's call data encode a call apart.
 */
const DATA_ROWS: readonly Row[] = [
  {
    label: 'msg.data read in an internal helper', entry: 'dataViaHelper', evm: true,
    members: 'function _msgData() internal view virtual returns (bytes calldata) { return msg.data; }'
      + ' function dataViaHelper() external returns (bool) { marker += 1;'
      + ' return sha256(_msgData()) == sha256(msg.data); }',
  },
  {
    label: 'msg.data inside a public function called internally', entry: 'dataViaPublic', evm: true,
    members: 'function dataPub() public pure returns (bytes memory) { return msg.data; }'
      + ' function dataViaPublic() external returns (bool) { marker += 1;'
      + ' return sha256(dataPub()) == sha256(msg.data); }',
  },
  {
    label: 'msg.data inside this.g() against the caller\'s', entry: 'dataViaThis', evm: false,
    members: 'function dataExt() external pure returns (bytes memory) { return msg.data; }'
      + ' function dataViaThis() external returns (bool) { marker += 1;'
      + ' return sha256(this.dataExt()) == sha256(msg.data); }',
  },
  {
    label: 'msg.data inside this.g() against that call\'s encoding', entry: 'dataIsCall', evm: true,
    members: 'function dataExt() external pure returns (bytes memory) { return msg.data; }'
      + ' function dataIsCall() external returns (bool) { marker += 1;'
      + ' return sha256(this.dataExt()) == sha256(abi.encodeWithSelector(this.dataExt.selector)); }',
  },
  {
    label: 'msg.data read by the helper of this.g()', entry: 'dataViaThisHelper', evm: true,
    members: 'function _msgData() internal view virtual returns (bytes calldata) { return msg.data; }'
      + ' function dataExt() external view returns (bytes memory) { return _msgData(); }'
      + ' function dataViaThisHelper() external returns (bool) { marker += 1;'
      + ' return sha256(this.dataExt()) == sha256(abi.encodeWithSelector(this.dataExt.selector)); }',
  },
];

/** The row's function whose selector, in the given hash, is the 4-byte answer, or the answer itself. */
const selected = (row: Row, answer: string, selectorOf: (signature: string) => string): Role =>
  [...row.members.matchAll(/function (\w+)\(\)/g)].map((match) => `${match[1]!}()` as const)
    .find((signature) => selectorOf(signature) === answer) ?? answer as never;

const sourceOf = (row: Row): string =>
  `pragma solidity ^0.8.0; ${IA} contract A { uint256 public marker; ${row.members} ${SELF} }`;

const ALL_ROWS = [...ROWS, ...ORIGIN_ROWS, ...VALUE_ROWS, ...SIG_ROWS, ...DATA_ROWS];

interface EvmContract { readonly abi: never; readonly evm: { readonly bytecode: { readonly object: string } } }

/** Every row's contract, compiled by solc in one pass. */
let evmContracts: Map<Row, EvmContract> | undefined;
function evmContractOf(row: Row): EvmContract {
  if (evmContracts === undefined) {
    const require = createRequire(import.meta.url);
    const solc = require('solc') as { compile(input: string): string };
    const sources = Object.fromEntries(ALL_ROWS.map((each, index) => [`row${index}.sol`, { content: sourceOf(each) }]));
    const output = JSON.parse(solc.compile(JSON.stringify({
      language: 'Solidity', sources, settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
    }))) as { contracts: Record<string, Record<string, EvmContract>> };
    evmContracts = new Map(ALL_ROWS.map((each, index) => [each, output.contracts[`row${index}.sol`]!.A!]));
  }
  return evmContracts.get(row)!;
}

/** The row's answer on the EVM, by role. */
async function evmAnswer(row: Row): Promise<Role> {
  const { createEVM } = await import('@ethereumjs/evm');
  const { createAccount, createAddressFromString } = await import('@ethereumjs/util');
  const compiled = evmContractOf(row);
  const eoa = createAddressFromString(`0x${'e0'.repeat(20)}`);
  const evm = await createEVM();
  await evm.stateManager.putAccount(eoa, createAccount({ nonce: 0n, balance: 10n ** 20n }));
  const deployed = await evm.runCall({
    caller: eoa, origin: eoa, data: hexToBin(compiled.evm.bytecode.object), gasLimit: 30_000_000n,
  });
  const contract = deployed.createdAddress!;
  const iface = new Interface(compiled.abi);
  const called = await evm.runCall({
    to: contract, caller: eoa, origin: eoa, gasLimit: 30_000_000n, value: row.value ?? 0n,
    data: hexToBin(iface.encodeFunctionData(row.entry, []).slice(2)),
  });
  const [answer] = iface.decodeFunctionResult(row.entry, `0x${binToHex(called.execResult.returnValue)}`);
  if (typeof answer === 'boolean' || typeof answer === 'bigint') return answer;
  if (String(answer).length === 10) {
    return selected(row, String(answer).slice(2).toLowerCase(), (signature) => id(signature).slice(2, 10));
  }
  const address = String(answer).toLowerCase();
  return address === eoa.toString() ? 'EOA' : address === contract.toString() ? 'A' : address as never;
}

/** The row's answer on the framed path, by role, or the refusal it meets. */
async function framedAnswer(row: Row): Promise<{ readonly role?: Role; readonly refusal?: string }> {
  let artifact;
  try {
    artifact = compileStringMulti(sourceOf(row), { composition: 'framed', evmCompat: true } as never).A!;
  } catch (error) {
    return { refusal: String((error as Error).message) };
  }
  const refused = artifact.composition?.refusedEntries?.find((entry) => entry.functionName.includes(row.entry));
  if (refused !== undefined) return { refusal: `${refused.functionName}: ${refused.reason}` };
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const fundingUtxo = { txid: '33'.repeat(31) + 'cc', vout: 0, satoshis: 500_000n };
  await provider.addUtxo(funder.address, fundingUtxo);
  await fundShippedFacets(provider);
  const deployment = await deployStatefulContract(artifact, [], {
    provider, fundingUtxo, funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address,
  });
  const user = encodeLockingBytecodeP2pkh(alicePkh);
  const call = async (entry: string, txid: string, value?: bigint): ReturnType<typeof callFramedEntry> => {
    const callerUtxo = { txid, vout: 0, satoshis: 300_000n };
    await provider.addUtxo(binToHex(user), callerUtxo);
    return callFramedEntry({
      provider, artifact: artifact!, categoryId: deployment.categoryId, functionName: entry, args: [],
      callerUtxo, callerLockingBytecode: user, funder: signature.unlockP2PKH(), vm: compositionMachine(),
      ...(value === undefined ? {} : { value }),
    });
  };
  // What `self()` answers: a Solidity `address` is the hash160 of the lock the contract's category derives.
  const lock = validatorAddress(hexToBin(deployment.categoryId), framedValidator.buildValidatorProgram());
  const self = binToHex(hash160(lock));
  let answered;
  try {
    answered = await call(row.entry, '45'.repeat(31) + 'ba', row.value);
  } catch (error) {
    return { refusal: String((error as Error).message) };
  }
  if (!answered.accepted) {
    return { refusal: answered.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ') };
  }
  const hexOf = (value: unknown): string => (value instanceof Uint8Array ? binToHex(value) : String(value));
  const [answer] = answered.values;
  if (typeof answer === 'boolean' || typeof answer === 'bigint') return { role: answer };
  const bare = hexOf(answer).replace(/^0x/, '');
  if (bare.length === 8) {
    return { role: selected(row, bare, (sig) => computeFunctionSelectorHex(sig, true)) };
  }
  const address = hexOf(answer);
  return { role: address === binToHex(alicePkh) ? 'EOA' : address === self ? 'A' : address as never };
}

describe('S0: the single-contract reference rows, the EVM against the framed path', () => {
  for (const row of ALL_ROWS) {
    it(`${row.label}: the EVM answers ${String(row.evm)}${row.refusal === undefined ? ', and so does framed' : ''}`,
      async () => {
        expect(await evmAnswer(row)).toBe(row.evm);
        const answer = await framedAnswer(row);
        if (row.refusal === undefined) expect(answer).toStrictEqual({ role: row.evm });
        else expect(answer.refusal).toMatch(row.refusal);
      }, 120_000);
  }
});
