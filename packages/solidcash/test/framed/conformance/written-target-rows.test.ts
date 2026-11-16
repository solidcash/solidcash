import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { Interface } from 'ethers';
import { hash160, validatorAddress } from '@solidcash/utils';
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
 * A call through a stored target its function writes before the call, the EVM against the framed path.
 *
 * The address-local pass reads a call's stored target into a compiler local at the top of the body
 * (`__extaddr_oracle`, `__extaddr_feed_IOracle`), and a framed call site binds its record to the target its own code
 * holds where it calls: the value from before the write. On the EVM the call after `oracle = o` goes to `o`; the
 * framed path ran it on the stored contract and was accepted. Such a function is now refused by name at compile time.
 * A call through the written value itself, and a call made before the write, answer as the EVM's do. Each row deploys
 * the oracles and the reader, then calls one entry naming the hostile oracle as the new target.
 */

type Role = string | bigint;

interface Deployment {
  readonly name: string;
  readonly args?: readonly string[];
}

interface Row {
  readonly label: string;
  readonly entry: string;
  readonly evm: Role;
}

const ORACLES = 'interface IOracle { function price() external view returns (uint256); }'
  + ' contract Oracle { uint256 public marker; function price() external view returns (uint256) { return 7; } }'
  + ' contract Hostile { uint256 public marker; function price() external view returns (uint256) { return 1000000; } }';
/** A reader with `members`, holding an oracle as an interface-typed field and as a plain address. */
const reader = (members: string): string => 'contract Reader { IOracle public oracle; address public feed;'
  + ' uint256 public last; constructor(IOracle o) { oracle = o; feed = address(o); }'
  + ` ${members} }`;
const SOURCE = `pragma solidity ^0.8.0; ${ORACLES} ${reader(
  'function retargetThroughParameter(IOracle o) external returns (uint256) {'
  + ' oracle = o; last = o.price(); return last; }'
  + ' function readThenRetarget(IOracle o) external returns (uint256) {'
  + ' last = oracle.price(); oracle = o; return last; }',
)}`;
const DEPLOYMENTS: readonly Deployment[] = [
  { name: 'Oracle' }, { name: 'Hostile' }, { name: 'Reader', args: ['Oracle'] },
];

const ROWS: readonly Row[] = [
  { label: 'a call through the written value', entry: 'retargetThroughParameter', evm: 1_000_000n },
  { label: 'a call before a write of its stored target', entry: 'readThenRetarget', evm: 7n },
];

/** Readers whose call goes through a stored target the function writes first, with the call they make. */
const WRITTEN_FIRST: ReadonlyArray<readonly [string, string, string]> = [
  ['an interface-typed field', 'retargetThenRead',
    'function retargetThenRead(IOracle o) external returns (uint256) {'
    + ' oracle = o; last = oracle.price(); return last; }'],
  ['an address cast at the call', 'refeedThenRead',
    'function refeedThenRead(IOracle o) external returns (uint256) {'
    + ' feed = address(o); last = IOracle(feed).price(); return last; }'],
];

/** The row's answer on the EVM. */
async function evmAnswer(row: Row): Promise<Role> {
  const require = createRequire(import.meta.url);
  const solc = require('solc') as { compile(input: string): string };
  const { createEVM } = await import('@ethereumjs/evm');
  const { createAccount, createAddressFromString } = await import('@ethereumjs/util');
  const output = JSON.parse(solc.compile(JSON.stringify({
    language: 'Solidity', sources: { 'row.sol': { content: SOURCE } },
    settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
  }))) as { contracts: Record<string, Record<string, { abi: never; evm: { bytecode: { object: string } } }>> };
  const compiled = output.contracts['row.sol']!;
  const eoa = createAddressFromString(`0x${'e0'.repeat(19)}e1`);
  const evm = await createEVM();
  await evm.stateManager.putAccount(eoa, createAccount({ nonce: 0n, balance: 10n ** 20n }));
  const addresses = new Map<string, string>();
  for (const deployment of DEPLOYMENTS) {
    const contract = compiled[deployment.name]!;
    const args = (deployment.args ?? []).map((name) => addresses.get(name)!);
    const encoded = args.length === 0 ? '' : new Interface(contract.abi).encodeDeploy(args).slice(2);
    const deployed = await evm.runCall({
      caller: eoa, origin: eoa, data: hexToBin(contract.evm.bytecode.object + encoded), gasLimit: 30_000_000n,
    });
    addresses.set(deployment.name, deployed.createdAddress!.toString());
  }
  const iface = new Interface(compiled.Reader!.abi);
  const called = await evm.runCall({
    to: createAddressFromString(addresses.get('Reader')!), caller: eoa, origin: eoa, gasLimit: 30_000_000n,
    data: hexToBin(iface.encodeFunctionData(row.entry, [addresses.get('Hostile')!]).slice(2)),
  });
  return [...iface.decodeFunctionResult(row.entry, `0x${binToHex(called.execResult.returnValue)}`)][0] as bigint;
}

/** The row's answer on the framed path, or the refusal it meets. */
async function framedAnswer(row: Row): Promise<{ readonly value?: Role; readonly refusal?: string }> {
  const artifacts = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never);
  const refused = artifacts.Reader!.composition?.refusedEntries
    ?.find((entry) => entry.functionName.includes(row.entry));
  if (refused !== undefined) return { refusal: `${refused.functionName}: ${refused.reason}` };
  const { framedValidator } = await import('@solidcash/solidc');
  const validatorProgram = framedValidator.buildValidatorProgram();
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
  await fundShippedFacets(provider);
  const addresses = new Map<string, Uint8Array>();
  const categories = new Map<string, string>();
  for (const [index, deployment] of DEPLOYMENTS.entries()) {
    const fundingUtxo = { txid: `${'34'.repeat(31)}${(0xc0 + index).toString(16)}`, vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funder.address, fundingUtxo);
    const deployed = await deployStatefulContract(artifacts[deployment.name]!,
      (deployment.args ?? []).map((name) => addresses.get(name)!), {
        provider, fundingUtxo, changeAddress: funder.address,
        funder: funder.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      });
    addresses.set(deployment.name, validatorAddress(hexToBin(deployed.categoryId), validatorProgram));
    categories.set(deployment.name, deployed.categoryId);
  }
  const externals = Object.fromEntries([...categories]
    .map(([name, categoryId]) => [name, { artifact: artifacts[name]!, categoryId }]));
  const user = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: `${'46'.repeat(31)}ba`, vout: 0, satoshis: 300_000n };
  await provider.addUtxo(binToHex(user), callerUtxo);
  let answered;
  try {
    answered = await callFramedEntry({
      provider, artifact: artifacts.Reader!, categoryId: categories.get('Reader')!, functionName: row.entry,
      args: [addresses.get('Hostile')!], callerUtxo, callerLockingBytecode: user,
      funder: new SignatureTemplate(alicePriv).unlockP2PKH(), vm: compositionMachine(), externals,
    });
  } catch (error) {
    return { refusal: `call: ${(error as Error).message}` };
  }
  if (!answered.accepted) {
    return { refusal: `call: ${answered.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ')}` };
  }
  const value = answered.values[0];
  // An address answer is the hash160 of a deployment's lock; the rows answer numbers.
  if (value instanceof Uint8Array) {
    const named = [...addresses].find(([, address]) => binToHex(hash160(address)) === binToHex(value));
    return { value: named?.[0] ?? binToHex(value) };
  }
  return { value: value as Role };
}

describe('a framed call through a stored target written before the call, against the EVM', () => {
  for (const row of ROWS) {
    it(`${row.label}: the EVM answers ${row.evm}, and so does framed`, async () => {
      expect(await evmAnswer(row)).toBe(row.evm);
      expect(await framedAnswer(row)).toStrictEqual({ value: row.evm });
    }, 180_000);
  }

  it.each(WRITTEN_FIRST)('refuses by name a call through %s the function writes first', (_form, entry, member) => {
    const compile = (): unknown => compileStringMulti(`pragma solidity ^0.8.0; ${ORACLES} ${reader(member)}`, {
      composition: 'framed', evmCompat: true,
    } as never);
    expect(compile).toThrow(/FRAMED_TARGET_WRITTEN_BEFORE_CALL/);
    expect(compile).toThrow(new RegExp(`'${entry}' writes the target of its call to IOracle\\.price before the call`));
  });
});
