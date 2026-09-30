import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { Interface } from 'ethers';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callPerCallEntry } from '../../../src/per-call/call/index.js';
import { fundShippedFacets } from '../shapes/harness.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * S0, the conformance suite (spec R3, plan D7): the single-contract rows of the reference contexts in
 * `docs/per-call/probes/this-call-msg-sender/ref.sol`, the EVM against the per-call path.
 *
 * Each row is its own contract, so a row the per-call path refuses leaves the others running. The EVM side compiles
 * it with solc and runs it in `@ethereumjs/evm`, entered by an EOA; the per-call side compiles it for the per-call
 * convention with Solidity compatibility, deploys it and calls it through the shipped call path, entered by a user's
 * coin. Each answer is compared by role: the user who entered, or the contract itself (what its `self()` answers).
 * Every row's entry writes, so the per-call answer comes from a frame the user's coin enters. A row the per-call
 * path does not serve yet is pinned with the refusal it meets, beside the answer the EVM gives.
 */

type Role = 'EOA' | 'A' | boolean;

const IA = 'interface IA { function whoExt() external view returns (address); }';
const WHO = 'function whoExt() external view returns (address) { return msg.sender; }';
const SELF = 'function self() external returns (address) { marker += 1; return address(this); }';

interface Row {
  readonly label: string;
  readonly entry: string;
  readonly members: string;
  /** The EVM's answer, which the live EVM run is checked against first. */
  readonly evm: Role;
  /** The refusal the per-call path meets today, for a row it does not serve yet. */
  readonly refusal?: RegExp;
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
    label: 'this.g()', entry: 'viaThis', evm: 'A', refusal: /master: frame "master" of A\.viaThis\(\)/,
    members: `${WHO} function viaThis() external returns (address) { marker += 1; return this.whoExt(); }`,
  },
  {
    label: 'IA(address(this)).g()', entry: 'viaInterfaceSelf', evm: 'A',
    refusal: /makes 1 external call\(s\), whose callee frames this call path does not plan yet/,
    members: `${WHO} function viaInterfaceSelf() external returns (address) { marker += 1;`
      + ' return IA(address(this)).whoExt(); }',
  },
  {
    label: 'address(this).call(g)', entry: 'viaLowLevelSelf', evm: 'A',
    refusal: /master: frame "master" of A\.viaLowLevelSelf\(\)/,
    members: `${WHO} function viaLowLevelSelf() external returns (address) { marker += 1;`
      + ' (bool ok, bytes memory r) = address(this).call(abi.encodeCall(IA.whoExt, ())); require(ok);'
      + ' return abi.decode(r, (address)); }',
  },
  {
    label: 'address(this).delegatecall(g)', entry: 'viaDelegateSelf', evm: 'EOA',
    refusal: /a low-level call needs the witness `calls\[\]` checks, which are not emitted yet/,
    // A delegatecall body must not write its own state, so this row's entry does not bump the marker.
    members: `${WHO} function viaDelegateSelf() external returns (address) {`
      + ' (bool ok, bytes memory r) = address(this).delegatecall(abi.encodeCall(IA.whoExt, ())); require(ok);'
      + ' return abi.decode(r, (address)); }',
  },
  {
    label: 'try this.g()', entry: 'viaTryThis', evm: 'A', refusal: /master: frame "master" of A\.viaTryThis\(\)/,
    members: `${WHO} function viaTryThis() external returns (address) { marker += 1;`
      + ' try this.whoExt() returns (address s) { return s; } catch { return address(0); } }',
  },
  {
    label: 'msg.sender == tx.origin at top level', entry: 'senderIsOrigin', evm: true,
    members: 'function senderIsOrigin() external returns (bool) { marker += 1; return msg.sender == tx.origin; }',
  },
  {
    label: 'msg.sender == tx.origin inside this.g()', entry: 'senderIsOriginViaThis', evm: false,
    refusal: /tx\.origin is read outside the frame's slots while compiling 'senderIsOriginExt'/,
    members: 'function senderIsOriginExt() external view returns (bool) { return msg.sender == tx.origin; }'
      + ' function senderIsOriginViaThis() external returns (bool) { marker += 1; return this.senderIsOriginExt(); }',
  },
];

const sourceOf = (row: Row): string =>
  `pragma solidity ^0.8.0; ${IA} contract A { uint256 public marker; ${row.members} ${SELF} }`;

/** The row's answer on the EVM, by role. */
async function evmAnswer(row: Row): Promise<Role> {
  const require = createRequire(import.meta.url);
  const solc = require('solc') as { compile(input: string): string };
  const { createEVM } = await import('@ethereumjs/evm');
  const { createAccount, createAddressFromString } = await import('@ethereumjs/util');
  const output = JSON.parse(solc.compile(JSON.stringify({
    language: 'Solidity', sources: { 'row.sol': { content: sourceOf(row) } },
    settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
  }))) as { contracts: Record<string, Record<string, { abi: never; evm: { bytecode: { object: string } } }>> };
  const compiled = output.contracts['row.sol']!.A!;
  const eoa = createAddressFromString(`0x${'e0'.repeat(20)}`);
  const evm = await createEVM();
  await evm.stateManager.putAccount(eoa, createAccount({ nonce: 0n, balance: 10n ** 20n }));
  const deployed = await evm.runCall({
    caller: eoa, origin: eoa, data: hexToBin(compiled.evm.bytecode.object), gasLimit: 30_000_000n,
  });
  const contract = deployed.createdAddress!;
  const iface = new Interface(compiled.abi);
  const called = await evm.runCall({
    to: contract, caller: eoa, origin: eoa, gasLimit: 30_000_000n,
    data: hexToBin(iface.encodeFunctionData(row.entry, []).slice(2)),
  });
  const [answer] = iface.decodeFunctionResult(row.entry, `0x${binToHex(called.execResult.returnValue)}`);
  if (typeof answer === 'boolean') return answer;
  const address = String(answer).toLowerCase();
  return address === eoa.toString() ? 'EOA' : address === contract.toString() ? 'A' : address as never;
}

/** The row's answer on the per-call path, by role, or the refusal it meets. */
async function perCallAnswer(row: Row): Promise<{ readonly role?: Role; readonly refusal?: string }> {
  let artifact;
  try {
    artifact = compileStringMulti(sourceOf(row), { composition: 'per-call', solidityImportCompat: true } as never).A!;
  } catch (error) {
    return { refusal: String((error as Error).message) };
  }
  const refused = artifact.composition?.refusedEntries?.find((entry) => entry.functionName.includes(row.entry));
  if (refused !== undefined) return { refusal: `${refused.functionName}: ${refused.reason}` };
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const fundingUtxo = { txid: '33'.repeat(32), vout: 0, satoshis: 500_000n };
  await provider.addUtxo(funder.address, fundingUtxo);
  await fundShippedFacets(provider);
  const deployment = await deployStatefulContract(artifact, [], {
    provider, fundingUtxo, funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address,
  });
  const user = encodeLockingBytecodeP2pkh(alicePkh);
  const call = async (entry: string, txid: string): ReturnType<typeof callPerCallEntry> => {
    const callerUtxo = { txid, vout: 0, satoshis: 300_000n };
    await provider.addUtxo(binToHex(user), callerUtxo);
    return callPerCallEntry({
      provider, artifact: artifact!, categoryId: deployment.categoryId, functionName: entry, args: [],
      callerUtxo, callerLockingBytecode: user, funder: signature.unlockP2PKH(), vm: compositionMachine(),
    });
  };
  const self = await call('self', '44'.repeat(32));
  let answered;
  try {
    answered = await call(row.entry, '45'.repeat(32));
  } catch (error) {
    return { refusal: String((error as Error).message) };
  }
  if (!answered.accepted) {
    return { refusal: answered.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ') };
  }
  const hexOf = (value: unknown): string => (value instanceof Uint8Array ? binToHex(value) : String(value));
  const [answer] = answered.values;
  if (typeof answer === 'boolean') return { role: answer };
  const address = hexOf(answer);
  return { role: address === binToHex(alicePkh) ? 'EOA' : address === hexOf(self.values[0]) ? 'A' : address as never };
}

describe('S0: the single-contract reference rows, the EVM against the per-call path', () => {
  for (const row of ROWS) {
    it(`${row.label}: the EVM answers ${String(row.evm)}${row.refusal === undefined ? ', and so does per-call' : ''}`,
      async () => {
        expect(await evmAnswer(row)).toBe(row.evm);
        const answer = await perCallAnswer(row);
        if (row.refusal === undefined) expect(answer).toStrictEqual({ role: row.evm });
        else expect(answer.refusal).toMatch(row.refusal);
      }, 120_000);
  }
});
