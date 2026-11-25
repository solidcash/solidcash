/**
 * A constructor's call that leaves its arguments to the callee (`last = t.take()` for `take(int v)`), through a
 * single-function interface, on the one creation path (A7). The call answers a genesis-tagged record, digest over
 * `ff ff || X || slot || selector || arguments`, X the outpoint only the creating input spends. Without the arguments
 * it leaves, the creator could not compute that digest, so the compiler built no deployer for such a constructor
 * (`ctor-call-unbound`) and the SDK fell back to the genesis that does not run the call. `create` now takes each left
 * argument as a witness the SDK fills from the callee's arguments, and digests it.
 *
 * Two creations cannot list one callee in two call slots (deployer.ts: one master answers one call), so the other
 * method's run is made in place: the honest creation, with the callee's run switched to `peek` (its selector push, its
 * unchanged state and its record over `peek`). Each input is evaluated alone: the switched callee input passes, so only
 * the creator's own check of the record can refuse it.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeAuthenticationInstructions, decodeTransactionUnsafe, encodeAuthenticationInstructions,
  encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import { sha256 } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { broadcastDeployerPreps, buildDeployerPrep } from '../../src/stateful/deployer.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { addressToLockScript, solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Artifact } from '@solidcash/utils';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const SOURCE = `pragma solidcash ^0.52.0;
  interface ITake { function take(int v) external returns (int); }
  contract T {
    int counter;
    function take(int v) external returns (int) { require(v > 0); int old = counter; counter = old + v; return old; }
    function peek(int v) external returns (int) { require(v > 0); return counter; }
  }
  contract C { int last; constructor(ITake t) { last = t.take(); } function read() { require(last >= 0); } }`;

const compileOptions = (primary: string): never => ({
  deployer: true, genesisCalls: true, primaryContractName: primary,
}) as never;

let serial = 0xa1e0;
const nextTxid = (): string => (serial++).toString(16).padStart(64, '0');

type Tx = ReturnType<typeof decodeTransactionUnsafe>;
type Captured = { transaction: Tx; sourceOutputs: any[] };

const ofCategory = (output: any, category: string): boolean => output?.token !== undefined
  && [category, binToHex(hexToBin(category).reverse())].includes(binToHex(output.token.category));

/** The VM's verdict on one input of `transaction`. */
function inputPasses(provider: MockNetworkProvider, transaction: Tx, sourceOutputs: any[], inputIndex: number): boolean {
  const vm = createVirtualMachineBch2026ForProvider(provider);
  return vm.stateSuccess(vm.evaluate({ transaction, sourceOutputs, inputIndex } as never) as never) === true;
}

/** The honest creation of C, its constructor calling `T.take(3)`, captured before broadcast. */
async function creation(): Promise<{
  provider: MockNetworkProvider; captured: Captured; tArtifact: Artifact; tCategory: string; cArtifact: Artifact;
}> {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
  const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
  const fund = async (): Promise<Utxo> => {
    const utxo: Utxo = { txid: nextTxid(), vout: 0, satoshis: 2_000_000n };
    await provider.seedUtxo(binToHex(authorLock), utxo);
    return utxo;
  };
  const tArtifact = compileString(SOURCE, compileOptions('T'));
  const t = await StatefulContract.deploy(tArtifact, [], {
    provider, fundingUtxo: await fund(), funder, changeAddress: change.address, senderLockingBytecode: authorLock,
  } as never);
  const cArtifact = compileString(SOURCE, compileOptions('C'));
  const fundingUtxo = await fund();
  const { prep } = await buildDeployerPrep({
    children: [{ deployer: cArtifact.deployer!, contractName: cArtifact.contractName }],
    fundingUtxos: [fundingUtxo], authorSigner: funder, authorLockingBytecode: authorLock,
    changeLockingBytecode: authorLock, provider,
  });
  await broadcastDeployerPreps([prep], provider);
  const original = provider.sendRawTransaction.bind(provider);
  let captured: Captured | undefined;
  (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
    const transaction = decodeTransactionUnsafe(hexToBin(hex));
    const sourceOutputs = await Promise.all(transaction.inputs.map(async (input) => {
      const spent = await provider.getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex);
      if (spent === undefined) throw new Error('an input of the transaction is not on the ledger');
      return solidCashOutputToLibauthOutput({
        to: spent.lockingBytecode, amount: spent.satoshis, ...(spent.token === undefined ? {} : { token: spent.token }),
      });
    }));
    if (!sourceOutputs.some((output) => binToHex(output.lockingBytecode) === cArtifact.deployer!.lockingBytecode)) {
      return original(hex);
    }
    captured = { transaction, sourceOutputs };
    throw new Error('creation captured');
  };
  try {
    await expect(StatefulContract.deploy(cArtifact, [], {
      provider, fundingUtxo, funder, changeAddress: change.address, senderLockingBytecode: authorLock,
      deployerPrep: prep, initArgs: [addressToLockScript(t.contract.address)],
      constructorCallees: [{ contract: t.contract, args: [3n] }],
    } as never)).rejects.toThrow('creation captured');
  } finally {
    (provider as any).sendRawTransaction = original;
  }
  return { provider, captured: captured!, tArtifact, tCategory: t.categoryId, cArtifact };
}

const selectorOf = (artifact: Artifact, name: string): Uint8Array => hexToBin(
  artifact.abi.find((entry) => entry.name === name)!.selector!,
);

/** A genesis-tagged record's digest: `ff ff || X || slot || selector || arguments`, X in either byte order. */
const taggedDigests = (x: Uint8Array, selector: Uint8Array, argument: Uint8Array): Uint8Array[] => [x, x.slice()
  .reverse()].map((tag) => sha256(Uint8Array.of(0xff, 0xff, ...tag, 0, 0, ...selector, argument.length, 0,
  ...argument)).slice(0, 31));

/** The honest creation with the callee's run switched from `take(3)` to `peek(3)`: selector, state and record. */
function switchedToPeek(c: Awaited<ReturnType<typeof creation>>): Captured {
  const { transaction, sourceOutputs } = c.captured;
  const master = sourceOutputs.findIndex((output) => ofCategory(output, c.tCategory)
    && output.token.nft?.capability === 'minting');
  const data = sourceOutputs.findIndex((output) => ofCategory(output, c.tCategory)
    && output.token.nft?.capability === 'mutable');
  const stateOut = transaction.outputs.findIndex((output) => ofCategory(output, c.tCategory)
    && output.token?.nft?.capability === 'mutable');
  const carrier = transaction.outputs.findIndex((output) => ofCategory(output, c.tCategory)
    && output.token?.nft?.capability === 'none' && binToHex(output.lockingBytecode) === '51');
  expect([master, data, stateOut, carrier].every((index) => index >= 0)).toBe(true);
  const record = transaction.outputs[carrier].token!.nft!.commitment;
  // The honest record is `take`'s under the creating input's outpoint: that fixes X's byte order.
  const x = transaction.inputs[0].outpointTransactionHash;
  const honest = taggedDigests(x, selectorOf(c.tArtifact, 'take'), Uint8Array.of(3))
    .findIndex((digest) => binToHex(digest) === binToHex(record.slice(0, 31)));
  expect(honest).toBeGreaterThanOrEqual(0);
  const peek = taggedDigests(x, selectorOf(c.tArtifact, 'peek'), Uint8Array.of(3))[honest]!;
  const instructions = decodeAuthenticationInstructions(transaction.inputs[master].unlockingBytecode) as any[];
  expect(binToHex(instructions[0].data)).toBe(binToHex(selectorOf(c.tArtifact, 'take')));
  instructions[0] = { ...instructions[0], data: selectorOf(c.tArtifact, 'peek') };
  const inputs = transaction.inputs.map((input, index) => (index === master
    ? { ...input, unlockingBytecode: encodeAuthenticationInstructions(instructions) } : input));
  const outputs = transaction.outputs.map((output, index) => {
    if (index === stateOut) {
      return { ...output, token: { ...output.token!, nft: { ...output.token!.nft!,
        commitment: sourceOutputs[data].token.nft.commitment } } };
    }
    if (index === carrier) {
      return { ...output, token: { ...output.token!, nft: { ...output.token!.nft!,
        commitment: Uint8Array.of(...peek, ...record.slice(31)) } } };
    }
    return output;
  });
  return { transaction: { ...transaction, inputs, outputs }, sourceOutputs };
}

describe('a constructor call that leaves its arguments to the callee binds the method it names (VM)', () => {
  it('settles the honest creation, its creator taking the argument it leaves as a witness', async () => {
    const c = await creation();
    expect(c.cArtifact.deployer!.abi.find((entry) => entry.name === 'create')!.inputs
      .some((input) => /^__internal__callArgument0_0$/.test(input.name))).toBe(true);
    expect(createVirtualMachineBch2026ForProvider(c.provider)
      .verify({ transaction: c.captured.transaction, sourceOutputs: c.captured.sourceOutputs } as never)).toBe(true);
  }, 300_000);

  it('refuses at the creating input a callee that ran peek for the take its constructor names', async () => {
    const c = await creation();
    const switched = switchedToPeek(c);
    const master = switched.sourceOutputs.findIndex((output) => ofCategory(output, c.tCategory)
      && output.token.nft?.capability === 'minting');
    // The callee's switched run is valid on its own: its selector, its state and its record agree.
    expect(inputPasses(c.provider, switched.transaction, switched.sourceOutputs, master)).toBe(true);
    expect(inputPasses(c.provider, switched.transaction, switched.sourceOutputs, 0)).toBe(false);
  }, 300_000);
});
