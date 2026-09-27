import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import {
  asmToScript, encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress, type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/per-call/master/placeholders.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { categorySlotValue, seededCategory } from './validator-input.js';

/**
 * What an imported definition costs a per-call master.
 *
 * A source file is rarely alone: a contract imports an interface it calls through, and that interface is a
 * declaration with no code of its own. A per-call master opens with its head, so anything the unit emits ahead of
 * the head would have to be proven harmless; a declaration-only import emits nothing, and this asserts exactly
 * that — the same contract compiles to the same program with and without the import — and then spends the compiled
 * master in the machine.
 *
 * The boundary is asserted beside it: an import that does contribute code (a library whose functions are emitted
 * as definitions) is refused by name, so the admission rule states what it refuses rather than admitting a unit
 * whose prefix nobody has proved.
 */

const CATEGORY = seededCategory('imported definitions');
const VALIDATOR_PROGRAM = new Uint8Array([0x51, 0x52]);
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
const OWNER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(9));

const CONTRACT = 'contract Frame(address owner, address expected) {'
  + '   function bump() {'
  + '     require(msg.sender == owner);'
  + '     require(address(this) == expected);'
  + '   }'
  + ' }';

const INTERFACE = {
  id: '/IFrame.sol',
  source: 'pragma solidity ^0.8.0;\ninterface IFrame { function bump() external; }',
};
const LIBRARY = {
  id: '/Math.sol',
  source: 'pragma solidity ^0.8.0;\nlibrary Math { function two() internal pure returns (uint256) { return 2; } }',
};

const resolver = (path: string): { source: string; id: string } | undefined => {
  if (path.includes('IFrame')) return INTERFACE;
  if (path.includes('Math')) return LIBRARY;
  return undefined;
};

const compiling = (source: string): ReturnType<typeof compileString> =>
  compileString(source, {
    composition: 'per-call',
    solidityImportCompat: true,
    importResolver: resolver,
    rootFileId: '/main.sol',
  } as never);

const WITH_INTERFACE = 'pragma solidity ^0.8.0;\nimport "./IFrame.sol";\n' + CONTRACT;
const WITHOUT_IMPORT = 'pragma solidity ^0.8.0;\n' + CONTRACT;

const scriptBytes = (artifact: ReturnType<typeof compileString>): Uint8Array =>
  scriptToBytecode(asmToScript(artifact.bytecode));

describe('an import that declares but emits nothing', () => {
  it('leaves the compiled master byte-identical to the same contract without it', () => {
    const imported = compiling(WITH_INTERFACE);
    const plain = compiling(WITHOUT_IMPORT);

    expect(imported.composition?.convention).toBe('per-call');
    expect(imported.composition!.placeholders).toBeTruthy();
    expect(scriptBytes(imported)).toStrictEqual(scriptBytes(plain));
    // The slots sit at the same offsets, so a deployment fills the same bytes either way.
    expect(imported.composition!.placeholders).toStrictEqual(plain.composition!.placeholders);
  });

  it('is spent by the machine like any other master', () => {
    const artifact = compiling(WITH_INTERFACE);
    const filled = fillPlaceholders(scriptBytes(artifact), artifact.composition!.placeholders, {
      category: categorySlotValue(CATEGORY), contractAddress: ADDRESS, templateHash: TEMPLATE_HASH,
    });
    const redeemScript = new Uint8Array([
      ...encodeDataPush(ADDRESS),
      ...encodeDataPush(OWNER_LOCK),
      ...filled,
    ]);
    const lock = encodeLockingBytecodeP2sh32(hash256(redeemScript));
    const block: WitnessBlock = {
      kind: 0,
      callerRef: 0,
      originRef: 0,
      validatorRef: 0xffff,
      sender: OWNER_LOCK,
      self: ADDRESS,
      value: 0n,
      retval: new Uint8Array(0),
      calls: [],
      segments: [[]],
      events: [],
      sends: [],
    };
    const masterSource = {
      lockingBytecode: lock,
      valueSatoshis: 20_000n,
      token: { category: CATEGORY, amount: 0n, nft: { capability: 'minting' as const, commitment: new Uint8Array(0) } },
    };
    // The caller is a P2PKH the master reads its sender from, so its own input and output carry that lock.
    const callerSource = { lockingBytecode: OWNER_LOCK, valueSatoshis: 100_000n };
    const callerOutput = { lockingBytecode: OWNER_LOCK, valueSatoshis: 100_000n };
    const vm = createVirtualMachineBch2026(false);
    const spend = (recordedSelf: Uint8Array): boolean => {
      const transaction = {
        version: 2,
        inputs: [
          { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(1), sequenceNumber: 0xffffffff, unlockingBytecode: callerUnlockingBytecode() },
          {
            outpointIndex: 0,
            outpointTransactionHash: new Uint8Array(32).fill(2),
            sequenceNumber: 0xffffffff,
            unlockingBytecode: new Uint8Array([
              ...encodeDataPush(encodeWitnessBlock({ ...block, self: recordedSelf })),
              ...encodeDataPush(redeemScript),
            ]),
          },
        ],
        outputs: [callerOutput, masterSource],
        locktime: 0,
      };
      const state = vm.evaluate({ inputIndex: 1, sourceOutputs: [callerSource, masterSource], transaction });
      return vm.stateSuccess(state) === true;
    };

    // The master is accepted on a spend that recreates it in place.
    expect(spend(ADDRESS)).toBe(true);
    // And refused when the frame records an address the contract was not deployed at.
    expect(spend(new Uint8Array(35))).toBe(false);
  });
});

describe('an import that contributes emitted code', () => {
  it('is refused by name rather than admitted with an unproven prefix', () => {
    const source = 'pragma solidity ^0.8.0;\nimport "./Math.sol";\n' + CONTRACT;
    expect(() => compiling(source)).toThrow(/free functions/);
  });
});
