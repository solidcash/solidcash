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
 * What a file-level definition costs a per-call master.
 *
 * A source file is rarely alone: a contract imports an interface it calls through, and that interface is a
 * declaration with no code of its own. A per-call master opens with its head, and a file-level definition — an
 * imported library's function, or one the unit declares itself — is emitted ahead of it. This file measures both
 * sides of that: an import that emits nothing leaves the compiled program byte-identical, and one that emits
 * definitions does too while no body reaches them, because a definition no entry can reach is compiled for
 * diagnostics and left out of the emitted bytecode. A body that does reach one is resolved by the machine, which
 * is what the later cases ask: the entry's own call has to run the definition for its comparison to hold, and a
 * definition whose body cannot be outlined is inlined at its call sites rather than placed ahead of the head.
 */

const CATEGORY = seededCategory('imported definitions');
const VALIDATOR_PROGRAM = new Uint8Array([0x51, 0x52]);
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
const OWNER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(9));
const EMPTY = new Uint8Array(0);

const CONTRACT = 'contract Frame(address owner, address expected) {'
  + '   function bump() {'
  + '     require(msg.sender == owner);'
  + '     require(address(this) == expected);'
  + '   }'
  + ' }';

/** The same contract with the imported value compared in its own body, so a call to the library runs. */
const CALLING_CONTRACT = 'contract Calling(address owner) {'
  + '   function bump(uint x) {'
  + '     require(x == Math.two());'
  + '     require(msg.sender == owner);'
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
const WITH_UNUSED_LIBRARY = 'pragma solidity ^0.8.0;\nimport "./Math.sol";\n' + CONTRACT;
const WITH_CALLED_LIBRARY = 'pragma solidity ^0.8.0;\nimport "./Math.sol";\n' + CALLING_CONTRACT;

/** A contract that calls a function the unit declares itself, beside the definition that supplies it. */
const OWN_FUNCTION_CONTRACT = 'contract OwnCalling(address owner) {'
  + '   function bump(uint x) {'
  + '     require(twice(x) == 4);'
  + '     require(msg.sender == owner);'
  + '   }'
  + ' }';
const WITH_OWN_FUNCTION = 'pragma solidity ^0.8.0;\n'
  + 'function twice(uint x) pure returns (uint) { return x * 2; }\n' + OWN_FUNCTION_CONTRACT;

/** A definition that emits, reached from an entry: the head sizes its event region from the bodies it dispatches. */
const WITH_EMITTING_FUNCTION = 'pragma solidity ^0.8.0;\n'
  + 'event Ping(uint x);\n'
  + 'function pingIt(uint x) { emit Ping(x); }\n'
  + 'contract Emitter(address owner) {'
  + '   function go(uint x) { pingIt(x); require(msg.sender == owner); }'
  + ' }';

/** The same emit written out in the entry rather than behind a file-level function. */
const EMIT_IN_THE_ENTRY = 'pragma solidity ^0.8.0;\n'
  + 'event Ping(uint x);\n'
  + 'contract Emitter(address owner) {'
  + '   function go(uint x) { emit Ping(x); require(msg.sender == owner); }'
  + ' }';

const scriptBytes = (artifact: ReturnType<typeof compileString>): Uint8Array =>
  scriptToBytecode(asmToScript(artifact.bytecode));

/**
 * The deployed program and the redeem script it runs behind, with the constructor's arguments as the caller
 * passes them in declaration order: the deep frame's pushes are the last-declared parameter's first.
 */
function deploy(
  artifact: ReturnType<typeof compileString>,
  options: { readonly constructorArgs?: readonly Uint8Array[]; readonly argumentPushes?: readonly Uint8Array[] } = {},
): { redeemScript: Uint8Array; lock: Uint8Array; argumentPushes: readonly Uint8Array[] } {
  const filled = fillPlaceholders(scriptBytes(artifact), artifact.composition!.placeholders, {
    category: categorySlotValue(CATEGORY), contractAddress: ADDRESS, templateHash: TEMPLATE_HASH,
  });
  const redeemScript = new Uint8Array([
    ...[...(options.constructorArgs ?? [])].reverse().flatMap((value) => [...encodeDataPush(value)]),
    ...filled,
  ]);
  return {
    redeemScript, lock: encodeLockingBytecodeP2sh32(hash256(redeemScript)),
    argumentPushes: options.argumentPushes ?? [],
  };
}

/** Spends the master in the machine, with the frame's `self`, the constructor's arguments and the entry's. */
function spend(
  artifact: ReturnType<typeof compileString>,
  options: {
    readonly recordedSelf?: Uint8Array;
    readonly constructorArgs?: readonly Uint8Array[];
    readonly argumentPushes?: readonly Uint8Array[];
  } = {},
): boolean {
  const deployed = deploy(artifact, options);
  const block: WitnessBlock = {
    kind: 0,
    callerRef: 0,
    originRef: 0,
    validatorRef: 0xffff,
    sender: OWNER_LOCK,
    self: options.recordedSelf ?? ADDRESS,
    value: 0n,
    retval: EMPTY,
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
  };
  const masterSource = {
    lockingBytecode: deployed.lock,
    valueSatoshis: 20_000n,
    token: { category: CATEGORY, amount: 0n, nft: { capability: 'minting' as const, commitment: EMPTY } },
  };
  // The caller is a P2PKH the master reads its sender from, so its own input and output carry that lock.
  const callerSource = { lockingBytecode: OWNER_LOCK, valueSatoshis: 100_000n };
  const callerOutput = { lockingBytecode: OWNER_LOCK, valueSatoshis: 100_000n };
  const transaction = {
    version: 2,
    inputs: [
      {
        outpointIndex: 0,
        outpointTransactionHash: new Uint8Array(32).fill(1),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: callerUnlockingBytecode(),
      },
      {
        outpointIndex: 0,
        outpointTransactionHash: new Uint8Array(32).fill(2),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array([
          ...encodeDataPush(encodeWitnessBlock(block)),
          ...deployed.argumentPushes.flatMap((push) => [...push]),
          ...encodeDataPush(deployed.redeemScript),
        ]),
      },
    ],
    outputs: [callerOutput, masterSource],
    locktime: 0,
  };
  const vm = createVirtualMachineBch2026(false);
  const state = vm.evaluate({ inputIndex: 1, sourceOutputs: [callerSource, masterSource], transaction });
  return vm.stateSuccess(state) === true;
}

/** The arguments `Frame(address owner, address expected)` is constructed with, in declaration order. */
const FRAME_ARGS = [OWNER_LOCK, ADDRESS];

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
    // The master is accepted on a spend that recreates it in place.
    expect(spend(artifact, { constructorArgs: FRAME_ARGS })).toBe(true);
    // And refused when the frame records an address the contract was not deployed at.
    expect(spend(artifact, { constructorArgs: FRAME_ARGS, recordedSelf: new Uint8Array(35) })).toBe(false);
  });
});

describe('an import that contributes emitted definitions', () => {
  it('leaves the master byte-identical while no body reaches the definition', () => {
    // A library function no body calls is compiled for diagnostics and left out of the emitted bytecode, so the
    // program a caller deploys is the same one the contract without the import compiles to.
    const imported = compiling(WITH_UNUSED_LIBRARY);
    const plain = compiling(WITHOUT_IMPORT);

    expect(imported.composition?.convention).toBe('per-call');
    expect(scriptBytes(imported)).toStrictEqual(scriptBytes(plain));
    expect(imported.composition!.placeholders).toStrictEqual(plain.composition!.placeholders);
    // The head still refuses a frame the contract was not deployed at, so the prefix is not what admits it.
    expect(spend(imported, { constructorArgs: FRAME_ARGS })).toBe(true);
    expect(spend(imported, { constructorArgs: FRAME_ARGS, recordedSelf: new Uint8Array(35) })).toBe(false);
  });

  it('resolves a body\'s call to the imported definition in the machine', () => {
    // The entry compares its argument with what the imported function returns: an accept means the call ran the
    // definition the import contributed, and the refusal beside it is the argument that does not match.
    const artifact = compiling(WITH_CALLED_LIBRARY);
    expect(scriptBytes(artifact).length).toBeGreaterThan(scriptBytes(compiling(WITHOUT_IMPORT)).length);
    const calling = { constructorArgs: [OWNER_LOCK] };
    expect(spend(artifact, { ...calling, argumentPushes: [encodeDataPush(new Uint8Array([2]))] })).toBe(true);
    expect(spend(artifact, { ...calling, argumentPushes: [encodeDataPush(new Uint8Array([3]))] })).toBe(false);
  });
});

describe('a definition the unit declares itself', () => {
  it('runs behind the head so a call from a body returns what the definition computes', () => {
    const artifact = compiling(WITH_OWN_FUNCTION);
    const calling = { constructorArgs: [OWNER_LOCK] };
    // `twice(2) == 4` holds and `twice(3) == 4` does not, so the accept and the refusal are the definition's own
    // arithmetic reaching the entry: the head leaves the stack the definition needs to run on.
    expect(spend(artifact, { ...calling, argumentPushes: [encodeDataPush(new Uint8Array([2]))] })).toBe(true);
    expect(spend(artifact, { ...calling, argumentPushes: [encodeDataPush(new Uint8Array([3]))] })).toBe(false);
  });

  it('is inlined at its call sites when its body cannot be a definition, costing the prelude nothing', () => {
    // A definition the head can hold is outlined ahead of it; one whose body emits is instead inlined where it is
    // called, so the compiled program is the one the emit written directly in the entry compiles to.
    expect(scriptBytes(compiling(WITH_EMITTING_FUNCTION)))
      .toStrictEqual(scriptBytes(compiling(EMIT_IN_THE_ENTRY)));
  });
});
