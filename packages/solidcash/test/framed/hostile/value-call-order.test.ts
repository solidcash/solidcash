import { beforeAll, describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import {
  computeFunctionSelector, computeFunctionSignature, concatBytes, decodeWitnessBlock, encodeWitnessBlock, hash160,
  sha256, splitFirstPush, validatorAddress, type WitnessBlock,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { satoshiContainerLockingBytecode } from '../../../src/framed/deploy/index.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A value call into a contract, made where the payer sends (spec 4b), before the calls that read what the paid body
 * wrote. The payer's own site binds the record at its position to the recipient it computed and the amount it
 * sent, and the recipient's `receive()` runs before the reads, so they answer the payer and the amount. The accepted
 * spend is derived through the shipped deployment, composer and machine; each change below is one a builder could
 * make, and the machine refuses it.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Vault { address public lastSender; uint256 public total;'
  + '   receive() external payable { lastSender = msg.sender; total += msg.value; } }'
  + ' contract Payer { Vault public vault; constructor(Vault v) { vault = v; }'
  + '   function pay() external payable returns (address, uint256) {'
  + '     (bool ok, ) = payable(address(vault)).call{value: msg.value}(""); require(ok);'
  + '     return (vault.lastSender(), vault.total()); } }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never);
const AMOUNT = 5_000n;
// The fixture compiles evmCompat, so a value send's call data carries the keccak256 selector of receive() (D27).
const RECEIVE_SELECTOR = computeFunctionSelector(computeFunctionSignature('__receive', []), true);

type VmProgram = Parameters<ReturnType<typeof compositionMachine>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;

interface Payment {
  readonly result: FramedCallResult;
  readonly payerAddress: Uint8Array;
  readonly payerContainer: Uint8Array;
  readonly vaultAddress: Uint8Array;
  readonly vaultContainer: Uint8Array;
}

let payment: Payment | undefined;

beforeAll(async () => {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const { framedValidator } = await import('@solidcash/solidc');
  const validatorProgram = framedValidator.buildValidatorProgram();
  const deploy = async (name: string, args: readonly Uint8Array[]): Promise<string> => {
    const fundingUtxo = { txid: binToHex(sha256(utf8ToBin(`${name} funding`))), vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funder.address, fundingUtxo);
    const deployed = await deployStatefulContract(artifacts[name]!, [...args], {
      provider, fundingUtxo, changeAddress: funder.address,
      funder: funder.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
    });
    return deployed.categoryId;
  };
  await fundShippedFacets(provider);
  const vaultCategory = await deploy('Vault', []);
  const vaultAddress = validatorAddress(hexToBin(vaultCategory), validatorProgram);
  const payerCategory = await deploy('Payer', [vaultAddress]);
  const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: binToHex(sha256(utf8ToBin('caller coin'))), vout: 0, satoshis: 300_000n };
  await provider.addUtxo(binToHex(callerLock), callerUtxo);
  const result = await callFramedEntry({
    provider, artifact: artifacts.Payer!, categoryId: payerCategory, functionName: 'pay', callerUtxo,
    callerLockingBytecode: callerLock, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), vm: compositionMachine(),
    externals: { Vault: { artifact: artifacts.Vault!, categoryId: vaultCategory } }, value: AMOUNT,
  });
  payment = {
    result, vaultAddress, payerAddress: validatorAddress(hexToBin(payerCategory), validatorProgram),
    payerContainer: satoshiContainerLockingBytecode(payerCategory),
    vaultContainer: satoshiContainerLockingBytecode(vaultCategory),
  };
});

function paid(): Payment {
  if (payment === undefined) throw new Error('the payment was not composed');
  return payment;
}

const PAYER = 'master';
const RECEIVE = 'receive-0';
const VALIDATOR = 'validator';

function indexOf(id: string): number {
  const placed = paid().result.verdicts.find((verdict) => verdict.id === id);
  if (placed === undefined) throw new Error(`no participant "${id}"`);
  return placed.index;
}

/** The output paying `lock`, which the spend holds exactly once. */
function outputPaying(transaction: VmTransaction, lock: Uint8Array): number {
  const matches = transaction.outputs.flatMap((output, index) =>
    (binToHex(output.lockingBytecode) === binToHex(lock) ? [index] : []));
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

/** The spend with a master's witness block edited in place. */
function withBlock(transaction: VmTransaction, id: string, edit: (block: WitnessBlock) => void): void {
  const index = indexOf(id);
  const { payload, rest } = splitFirstPush(transaction.inputs[index]!.unlockingBytecode);
  const block = decodeWitnessBlock(payload);
  edit(block);
  transaction.inputs[index] = {
    ...transaction.inputs[index]!, unlockingBytecode: concatBytes([encodeDataPush(encodeWitnessBlock(block)), rest]),
  };
}

/** The participants that refuse a spend, by id; the validator's facet answers for the validator. */
function refusing(transaction: VmTransaction): readonly string[] {
  const vm = compositionMachine();
  const { sourceOutputs } = paid().result;
  return [...new Set(paid().result.verdicts.filter((verdict) => vm.stateSuccess(vm.evaluate({
    inputIndex: verdict.index, sourceOutputs: [...sourceOutputs], transaction,
  })) !== true).map((verdict) => verdict.id.replace(/\/\d+$/, '')))].sort();
}

/** A fresh copy of the accepted spend to change. */
function spend(): VmTransaction {
  return structuredClone(paid().result.transaction) as VmTransaction;
}

describe('a value call made where the payer sends, before the calls that read the paid contract', () => {
  it('is accepted at every input, the reads answering the payer and the amount receive() recorded', () => {
    const { result, payerAddress, vaultAddress, vaultContainer } = paid();
    expect(result.accepted).toBe(true);
    expect(refusing(spend())).toStrictEqual([]);
    // The reads ran after receive(): they answer the payer's own address and the amount it paid, as the EVM does.
    expect(binToHex(result.values[0] as Uint8Array)).toBe(binToHex(hash160(payerAddress)));
    expect(result.values[1]).toBe(AMOUNT);
    // The payer's first record is the value call, at the source's position, the reads its next two.
    const block = result.draft.blockOf(PAYER);
    expect(block.calls.map((call) => [binToHex(call.target), call.value])).toStrictEqual([
      [binToHex(vaultAddress), AMOUNT], [binToHex(vaultAddress), 0n], [binToHex(vaultAddress), 0n],
    ]);
    expect(block.calls[0]!.calleeRef).toBe(indexOf(RECEIVE));
    expect(binToHex(block.calls[0]!.argsHash)).toBe(binToHex(sha256(RECEIVE_SELECTOR)));
    expect(block.segments).toHaveLength(4);
    expect(result.transaction.outputs[outputPaying(result.transaction, vaultContainer)]!.valueSatoshis).toBe(AMOUNT);
  });

  it('is refused when the value call\'s amount, its recipient\'s container or its place among the calls changes', () => {
    const { vaultContainer } = paid();
    // The amount: the record, the recipient's frame and its container all carry less, and the payer keeps the rest
    // in a container of its own, so every contract's value balances. The payer's own site, which binds the record
    // to the amount it sent, refuses, and so does the recipient, whose record no longer holds what its body adds.
    const lighter = spend();
    withBlock(lighter, PAYER, (block) => { block.calls[0] = { ...block.calls[0]!, value: AMOUNT - 1_000n }; });
    withBlock(lighter, RECEIVE, (block) => { block.value = AMOUNT - 1_000n; });
    const container = outputPaying(lighter, vaultContainer);
    lighter.outputs[container] = { ...lighter.outputs[container]!, valueSatoshis: AMOUNT - 1_000n };
    const change = lighter.outputs[lighter.outputs.length - 1]!;
    lighter.outputs[lighter.outputs.length - 1] = { ...change, valueSatoshis: change.valueSatoshis - 1_000n };
    lighter.outputs.push({ lockingBytecode: paid().payerContainer, valueSatoshis: 1_000n });
    expect(refusing(lighter)).toStrictEqual([PAYER, RECEIVE]);
    // The container: the value paid to the caller's own lock instead, so the recipient's containers never receive
    // it. The recipient runs two frames here, so the validator weighs its containers against what it received (V7).
    const elsewhere = spend();
    const moved = outputPaying(elsewhere, vaultContainer);
    elsewhere.outputs[moved] = { ...elsewhere.outputs[moved]!, lockingBytecode: encodeLockingBytecodeP2pkh(alicePkh) };
    expect(refusing(elsewhere)).toStrictEqual([VALIDATOR]);
    // The order: a read recorded before the value call, as a payment made after the body's own code would be.
    const reordered = spend();
    withBlock(reordered, PAYER, (block) => {
      block.calls = [block.calls[1]!, block.calls[0]!, ...block.calls.slice(2)];
    });
    expect(refusing(reordered)).toStrictEqual([PAYER, VALIDATOR]);
  });
});
