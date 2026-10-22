import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { encodeEventCommitment, encodeIntegerValue, parsePushdataCommitment, sha256 } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from '../../../../solidc/src/compiler.js';
import { buildValidatorProgram } from '../../../../solidc/src/framed/validator/index.js';
import { compositionMachine, compositionProvider } from '../../../../solidc/test/framed/machine.js';
import { deriveFramedGenesis } from '../../../src/framed/deploy/genesis.js';
import { decodeEntryCommitment } from '../../../src/stateful/SortedList.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { MOCK_CONSENSUS_LIMITS, MockNetworkProvider } from '../../../src/network/mock/index.js';

// `total` is a bounded int so it shares data NFT 0 with both string length headers: a `bigint` takes a data NFT of its
// own, and that second data NFT grew the master's unlocking bytecode past the 10,000-byte cap (10,089 bytes).
const SOURCE = `pragma solidity ^0.8.20;
  contract ConstructorDynamicMint {
    int total;
    string label;
    string ticker;
    mapping(address => bigint) balances;
    event Issued(address holder, bigint amount);
    constructor(string memory nextLabel, string memory nextTicker) {
      label = nextLabel;
      ticker = nextTicker;
      mint(msg.sender, 100);
    }
    function mint(address holder, bigint amount) internal {
      total = amount;
      balances[holder] = balances[holder] + amount;
      emit Issued(holder, amount);
    }
    function check() public { require(true); }
  }
`;
const CATEGORY = sha256(new TextEncoder().encode('constructor dynamic mint'));
const SENDER = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x71));

describe('framed constructor dynamic values beside minted mapping state', () => {
  it.each([false, true])('settles both string chunk runs and the mapping/event declaration (tagged=%s)', (tagged) => {
    const artifact = compileString(SOURCE, { evmCompat: true, composition: 'framed', tagSingletonDataNfts: tagged });
    const genesis = deriveFramedGenesis({ artifact, category: CATEGORY,
      validatorProgram: buildValidatorProgram(), provider: compositionProvider(),
      constructorArgs: ['Alpha', 'ALP'], senderLockingBytecode: SENDER });
    expect(genesis.master.script.length).toBeLessThanOrEqual(10_000);
    // The real chain funds an input at 800 operation-cost units per byte of its unlocking bytecode. A
    // zero-call master carries no density padding, so prove its constructor body still pays for itself under the
    // chain's own byte cap rather than only under the relaxed composition profile.
    const masterInput = genesis.program!.sourceOutputs
      .findIndex((output) => output.token?.nft?.capability === 'minting');
    expect(masterInput).toBeGreaterThanOrEqual(0);
    const consensusVm = createVirtualMachineBch2026ForProvider(new MockNetworkProvider({
      consensusLimits: { ...MOCK_CONSENSUS_LIMITS, maximumInputBytes: 10_000 },
    }));
    const consensus = consensusVm.evaluate({ inputIndex: masterInput, ...genesis.program! }) as {
      readonly metrics?: { readonly operationCost?: number; readonly maximumOperationCost?: number };
    };
    expect(consensus.metrics?.operationCost, 'constructor operation cost')
      .toBeLessThanOrEqual(consensus.metrics?.maximumOperationCost ?? 0);
    expect(consensusVm.stateSuccess(consensus)).toBe(true);
    expect(compositionMachine().stateSuccess(compositionMachine().evaluate(genesis.program!))).toBe(true);
    expect(parsePushdataCommitment(genesis.commitments[0], artifact.stateLayout!, 0))
      .toMatchObject({ total: 100n, 'label$len': 5n, 'ticker$len': 3n });
    expect(genesis.chunks.map((chunk) => chunk.variable)).toEqual(['label', 'ticker']);
    expect(genesis.chunks.map((chunk) => chunk.commitment)).toEqual(['0005416c706861', '0003414c50']);
    expect(genesis.events).toHaveLength(1);
    expect(genesis.events[0].commitment).toEqual(encodeEventCommitment(artifact.events![0].parameters, [SENDER, 100n]));
    const entries = genesis.entries.filter((entry) => entry.collection === 'balances');
    expect(entries).toHaveLength(2);
    expect(decodeEntryCommitment(hexToBin(entries[1].commitment)).value).toEqual(encodeIntegerValue(100n));
    const hostile = structuredClone(genesis.program!);
    const chunkIndex = hostile.transaction.outputs.findIndex((output) => binToHex(output.lockingBytecode)
      === binToHex(genesis.chunks[0].lockingBytecode));
    expect(chunkIndex).toBeGreaterThan(0);
    hostile.transaction.outputs[chunkIndex].lockingBytecode = Uint8Array.of(0x51);
    expect(compositionMachine().stateSuccess(compositionMachine().evaluate(hostile))).not.toBe(true);
  });
});
