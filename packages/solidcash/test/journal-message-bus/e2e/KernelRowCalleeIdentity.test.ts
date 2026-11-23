/**
 * A graph route checks each call row it owns against the authenticated graph transcript, whose row names the callee
 * by the lock of the input at the consumer participant's slot. The spender lays that input out: the caller's verifier
 * binds it to the call manifest's participant table, which takes any lock holding a minting token of any category.
 * Under evmCompat the route compares a row with the call's 20-byte target identity, and it took the row lock's
 * identity with compileAddressToEvmIdentity, so a P2SH20 lock carrying the HASH160 of the callee's P2SH32 lock stood
 * for the callee. Anyone can spend such a coin with the callee's public redeem bytecode, and it runs no route, so no
 * verifier checks the answer its row carries. Now a row lock stands for an identity only as a P2SH32 or a P2PKH lock.
 *
 * Each spend is evaluated on the BCH 2026 VM of the message-bus semantic test profile.
 */
import {
  binToHex, decodeAuthenticationInstructions, encodeAuthenticationInstructionMaybeMalformed, encodeDataPush,
  flattenBinArray, hexToBin,
} from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import type { Artifact } from '@solidcash/utils';
import { hash160, sha256 } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  evmCompat: true,
  suppressWarnings: true,
} as const;

// A graph verifier program's arguments, in ABI order (assertMessageBusVerifierProgram).
const VERIFIER_INPUTS = [
  'activeInputIndex', 'expectedLocalRows', 'localBatch', 'suppliedFixedSize', 'suppliedBlockSize',
  'suppliedEmissions', 'suppliedCallers', 'suppliedSettlementBoundary', 'suppliedCompletionPositions',
  'suppliedSettlementTable',
];

type Vm = ReturnType<typeof createVirtualMachineBch2026ForProvider>;
type Program = Parameters<Vm['evaluate']>[0];
type Spend = Program['transaction'];
type Coins = Program['sourceOutputs'];
type Instruction = ReturnType<typeof decodeAuthenticationInstructions>[number];

/** A push's bytes; OP_1NEGATE and OP_1 to OP_16 push their number. */
const pushed = (instruction: Instruction): Uint8Array => ('data' in instruction ? instruction.data
  : instruction.opcode === 0x4f ? Uint8Array.of(0x81) : Uint8Array.of(instruction.opcode - 0x50));

const vmNumber = (bytes: Uint8Array): number => {
  let value = 0;
  for (let index = bytes.length - 1; index >= 0; index -= 1) {
    value = value * 256 + (index === bytes.length - 1 ? bytes[index] & 0x7f : bytes[index]);
  }
  return bytes.length > 0 && (bytes[bytes.length - 1] & 0x80) !== 0 ? -value : value;
};

const uint16 = (value: number): Uint8Array => Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
const framed = (bytes: Uint8Array): Uint8Array => flattenBinArray([uint16(bytes.length), bytes]);

/** `bytes` with each occurrence of `from` replaced by `to`, and how many there were. */
const replaced = (bytes: Uint8Array, from: Uint8Array, to: Uint8Array): { bytes: Uint8Array; count: number } => {
  const parts: Uint8Array[] = [];
  let start = 0;
  let count = 0;
  let at = 0;
  while (at + from.length <= bytes.length) {
    const here = at;
    if (from.every((byte, offset) => bytes[here + offset] === byte)) {
      parts.push(bytes.slice(start, at), to);
      at += from.length;
      start = at;
      count += 1;
    } else {
      at += 1;
    }
  }
  parts.push(bytes.slice(start));
  return { bytes: flattenBinArray(parts), count };
};

describe('a graph call row\'s callee under evmCompat, against a row lock of another kind with its identity', () => {
  it('settles the honest row, and the caller refuses a P2SH20 stand-in and a 20-byte row lock that its verifier '
    + 'authenticates', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const connect = async (artifact: Artifact, args: unknown[] = []): Promise<StatefulContract> => {
      const base = new Contract(artifact, args as never[], { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const leafArtifact = compileString(`pragma solidity ^0.8.0;
      contract Leaf {
        function read(uint256 value) public pure returns (uint256) { return value + 7; }
      }`, KERNEL);
    const rootArtifact = compileString(`pragma solidity ^0.8.0;
      interface ILeaf { function read(uint256 value) external view returns (uint256); }
      contract Root(address leaf) {
        function check(uint256 value) public view returns (uint256) {
          return ILeaf(leaf).read(value);
        }
      }`, KERNEL);
    expect(rootArtifact.messageBus?.verifierProgram?.inputs.map((input) => input.name)).toEqual(VERIFIER_INPUTS);
    const leaf = await connect(leafArtifact);
    const root = await connect(rootArtifact, [leaf.inner.lockingBytecode]);
    const callsiteId = rootArtifact.abi.find((entry) => entry.name === 'check')!
      .externalCalls!.find((call) => call.functionName === 'read')!.callsiteId!;
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const honest = await messageBus.compose({
      preparedCalls: [
        { contract: root, functionName: 'check', args: [3n] },
        { contract: leaf, functionName: 'read', args: [3n], callsiteId },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    }).build();
    const transaction: Spend = honest.buildLibauthTransaction();
    const sourceOutputs: Coins = generateLibauthSourceOutputs(honest.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const accepts = (spend: Spend, coins: Coins, inputIndex: number): true | string =>
      vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs: coins, transaction: spend }));
    expect(transaction.inputs.map((_input, index) => accepts(transaction, sourceOutputs, index)))
      .toEqual(transaction.inputs.map(() => true));

    const leafLock = hexToBin(leaf.inner.lockingBytecode);
    const masterOf = (lock: Uint8Array): number => sourceOutputs.findIndex((coin) =>
      binToHex(coin.lockingBytecode) === binToHex(lock) && coin.token?.nft?.capability === 'minting');
    const rootInput = masterOf(hexToBin(root.inner.lockingBytecode));
    const leafInput = masterOf(leafLock);
    const rootCategory = binToHex(sourceOutputs[rootInput]!.token!.category);
    const leafCategory = binToHex(sourceOutputs[leafInput]!.token!.category);
    const verifierInput = sourceOutputs.findIndex((coin) => coin.token !== undefined
      && binToHex(coin.token.category) === rootCategory && coin.token.nft?.capability === 'mutable'
      && binToHex(coin.token.nft.commitment).startsWith('4c335631'));
    const leafOutput = transaction.outputs.reduce((last, output, index) => (
      binToHex(output.lockingBytecode) === binToHex(leafLock) && output.token !== undefined
        && binToHex(output.token.category) === leafCategory && output.token.nft?.capability === 'minting'
        ? index : last), -1);
    expect([rootInput, leafInput, verifierInput, leafOutput].every((index) => index >= 0)).toBe(true);

    // The caller's verifier unlocking: <envelope> <arguments in reverse ABI order> <density reserve> <covenant>.
    const verifierPushes = decodeAuthenticationInstructions(transaction.inputs[verifierInput]!.unlockingBytecode);
    expect(verifierPushes.length).toBe(VERIFIER_INPUTS.length + 3);
    const envelope = pushed(verifierPushes[0]!);
    expect(binToHex(envelope.slice(0, 4))).toBe('4c334331');
    const argument = (name: string): Uint8Array =>
      pushed(verifierPushes[VERIFIER_INPUTS.length - VERIFIER_INPUTS.indexOf(name)]!);
    const emissions = argument('suppliedEmissions');
    const table = argument('suppliedSettlementTable');
    const bindingDigest = (manifest: Uint8Array, rows: Uint8Array, settlementTable: Uint8Array): Uint8Array =>
      sha256(flattenBinArray([
        sha256(manifest), uint16(vmNumber(argument('activeInputIndex'))),
        uint16(vmNumber(argument('expectedLocalRows'))), sha256(argument('localBatch')),
        uint16(vmNumber(argument('suppliedFixedSize'))), uint16(vmNumber(argument('suppliedBlockSize'))),
        sha256(rows), sha256(argument('suppliedCallers')),
        uint16(vmNumber(argument('suppliedSettlementBoundary'))), sha256(argument('suppliedCompletionPositions')),
        sha256(settlementTable),
      ]));
    const commitment = transaction.outputs[verifierInput]!.token!.nft!.commitment;
    expect(binToHex(bindingDigest(envelope.slice(8), emissions, table))).toBe(binToHex(commitment.slice(6, 38)));
    expect(binToHex(messageBus.encodeAtomicMessageEnvelope(messageBus.decodeAtomicMessageEnvelope(envelope))))
      .toBe(binToHex(envelope));

    /**
     * The spend with the callee's master moved to `lock` under a category of the spender's making, the manifest,
     * the rows and the settlement table naming it, and the caller's verifier recommitted to that transcript.
     */
    const spenderCategory = new Uint8Array(32).fill(0x7a);
    const forge = (lock: Uint8Array, unlocking?: Uint8Array): { spend: Spend; coins: Coins } => {
      const manifest = messageBus.decodeAtomicMessageEnvelope(envelope);
      const forgedEnvelope = messageBus.encodeAtomicMessageEnvelope({
        ...manifest,
        participants: manifest.participants.map((participant) => (participant.lockingBytecode === binToHex(leafLock)
          ? {
            ...participant, lockingBytecode: binToHex(lock), stateCategory: binToHex(spenderCategory),
            ...(participant.outputLockingBytecode !== undefined && { outputLockingBytecode: binToHex(lock) }),
          } : participant)),
      });
      const rows = replaced(emissions, framed(leafLock), framed(lock));
      const settlementTable = replaced(table, framed(leafLock), framed(lock));
      expect([rows.count, settlementTable.count]).toEqual([1, 1]);
      const replacements = new Map([
        [binToHex(envelope), forgedEnvelope], [binToHex(emissions), rows.bytes], [binToHex(table), settlementTable.bytes],
      ]);
      const rewrite = (bytecode: Uint8Array): Uint8Array => flattenBinArray(
        decodeAuthenticationInstructions(bytecode).map((instruction) => {
          const next = 'data' in instruction ? replacements.get(binToHex(instruction.data)) : undefined;
          return next === undefined ? encodeAuthenticationInstructionMaybeMalformed(instruction) : encodeDataPush(next);
        }),
      );
      const recategorized = <T extends { token?: { category: Uint8Array } }>(value: T): T => (
        value.token !== undefined && binToHex(value.token.category) === leafCategory
          ? { ...value, token: { ...value.token, category: spenderCategory } } : value);
      const digest = bindingDigest(forgedEnvelope.slice(8), rows.bytes, settlementTable.bytes);
      return {
        coins: sourceOutputs.map((coin, index) => recategorized(index === leafInput
          ? { ...coin, lockingBytecode: lock } : coin)),
        spend: {
          ...transaction,
          inputs: transaction.inputs.map((input, index) => ({
            ...input,
            unlockingBytecode: index === leafInput && unlocking !== undefined
              ? unlocking : rewrite(input.unlockingBytecode),
          })),
          outputs: transaction.outputs.map((output, index) => {
            const next = recategorized(index === leafOutput ? { ...output, lockingBytecode: lock } : output);
            return index !== verifierInput ? next : {
              ...next,
              token: {
                ...next.token!,
                nft: {
                  ...next.token!.nft!,
                  commitment: flattenBinArray([commitment.slice(0, 6), digest, commitment.slice(38)]),
                },
              },
            };
          }),
        },
      };
    };

    // Control: with the callee's own lock (its covenant, not evaluated here, refuses the category), the rewritten
    // transcript passes both of the caller's inputs.
    const control = forge(leafLock);
    expect(accepts(control.spend, control.coins, rootInput)).toBe(true);
    expect(accepts(control.spend, control.coins, verifierInput)).toBe(true);

    const leafPushes = decodeAuthenticationInstructions(transaction.inputs[leafInput]!.unlockingBytecode);
    const leafRedeem = pushed(leafPushes[leafPushes.length - 1]!);
    const standIn = flattenBinArray([Uint8Array.of(0xa9, 0x14), hash160(leafLock), Uint8Array.of(0x87)]);
    const forged = forge(standIn, flattenBinArray([encodeDataPush(leafRedeem), encodeDataPush(leafLock)]));
    expect(accepts(forged.spend, forged.coins, leafInput)).toBe(true);
    expect(accepts(forged.spend, forged.coins, verifierInput)).toBe(true);
    expect(accepts(forged.spend, forged.coins, rootInput)).not.toBe(true);

    const raw = forge(hash160(leafLock));
    expect(accepts(raw.spend, raw.coins, verifierInput)).toBe(true);
    expect(accepts(raw.spend, raw.coins, rootInput)).not.toBe(true);
  }, 300_000);
});
