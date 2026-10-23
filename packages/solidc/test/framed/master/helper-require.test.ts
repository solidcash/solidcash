import { describe, expect, it } from 'vitest';
import {
  encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import {
  asmToScript, chainCategory, encodeArgumentList, encodeWitnessBlock, scriptToBytecode, sha256,
  validatorAddress, type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { buildValidatorProgram } from '../../../src/framed/validator/index.js';
import { frameRevertReason } from '../../../../solidcash/src/framed/composer/refusal.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';

/**
 * A `require` inside a helper the entry invokes is published at the pointer it fails at.
 *
 * An entry's own body is emitted whole into the master and its `require`s are published on the artifact; a helper
 * the pipeline inlines is emitted as its own OP_INVOKE body, so its `require` pointers are relative to that body
 * and were published only under `invokeDebug`. A refusal report reads the pointer the machine reports — relative
 * to the refusing body — against the artifact's own `requires`, so the helper's failure named no message. The
 * helper's pointers are republished on the artifact at the same relative positions, and the frame now reports the
 * helper's own message and line.
 *
 * The machine settles it: the same frame is spent with a key the helper accepts and one it refuses, so the refusal
 * is the helper's own guard rather than the frame's shape.
 */

const CATEGORY = sha256(new TextEncoder().encode('helper require'));
const VALIDATOR_PROGRAM = buildValidatorProgram();
const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const OWNER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(9));

/** The helper's `require` sits on its own line, so the report's line is the helper's rather than the entry's. */
const SOURCE = 'pragma solidcash ^0.14.0;'
  + '\n contract Vault {'
  + '\n   function guard(bytes key) private pure { require(bytes(key).length == 33, "key must be 33 bytes"); }'
  + '\n   function seal(bytes key) { guard(key); require(true); }'
  + '\n   function ping() { require(true); }'
  + '\n }';

const HELPER_LINE = 3;
const HELPER_MESSAGE = 'key must be 33 bytes';

const artifact = compileStringMulti(SOURCE, { composition: 'framed' }).Vault!;
const program = fillPlaceholders(
  scriptToBytecode(asmToScript(artifact.bytecode)),
  artifact.composition!.placeholders,
  { category: chainCategory(CATEGORY), contractAddress: ADDRESS, templateHash: TEMPLATE_HASH },
);

/** The selector the ABI publishes for an entry, which the dispatcher reads. */
const selectorOf = (name: string): Uint8Array =>
  new Uint8Array(Buffer.from(artifact.abi.find((entry) => entry.name === name)!.selector!, 'hex'));

/** The machine's verdict on `seal`, entered with a key of `keyLength` bytes. */
function spendSeal(keyLength: number): { state: ReturnType<ReturnType<typeof compositionMachine>['evaluate']> } {
  const key = new Uint8Array(keyLength).fill(7);
  const lock = encodeLockingBytecodeP2sh32(hash256(program));
  const block: WitnessBlock = {
    kind: 0, callerRef: 0, originRef: 0, validatorRef: 0xffff, sender: OWNER_LOCK, self: ADDRESS,
    value: 0n, retval: new Uint8Array(0), calls: [], segments: [[]], events: [], sends: [],
  };
  const masterSource = {
    lockingBytecode: lock, valueSatoshis: 20_000n,
    token: { category: CATEGORY, amount: 0n, nft: { capability: 'minting' as const, commitment: new Uint8Array(0) } },
  };
  const transaction = {
    version: 2,
    inputs: [
      { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(7), sequenceNumber: 0xffffffff,
        unlockingBytecode: callerUnlockingBytecode() },
      { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(2), sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array([
          ...encodeDataPush(encodeWitnessBlock(block)),
          ...encodeArgumentList([selectorOf('seal'), key]),
          ...encodeDataPush(program),
        ]) },
    ],
    outputs: [{ lockingBytecode: OWNER_LOCK, valueSatoshis: 100_000n }, masterSource],
    locktime: 0,
  };
  const sourceOutputs = [{ lockingBytecode: OWNER_LOCK, valueSatoshis: 100_000n }, masterSource];
  return { state: compositionMachine().evaluate({ inputIndex: 1, sourceOutputs, transaction }) };
}

describe('a require inside an internal helper', () => {
  it('publishes the helper\'s own message and line at the pointer the machine reports', () => {
    const { state } = spendSeal(5);
    const vm = compositionMachine();
    expect(vm.stateSuccess(state)).not.toBe(true);
    const ip = (state as { ip?: number }).ip;
    expect(ip).toBeDefined();
    const requirement = (artifact.debug?.requires ?? [])
      .find((entry) => entry.message === HELPER_MESSAGE);
    expect(requirement).toMatchObject({ line: HELPER_LINE, message: HELPER_MESSAGE });
    // The pointer is the helper body's own, and the reader accepts the failing pointer or its predecessor.
    expect([ip, (ip as number) - 1]).toContain(requirement!.ip);
  });

  it('reports the helper\'s reason when the frame refuses through it', () => {
    const { state } = spendSeal(5);
    const ip = (state as { ip?: number }).ip;
    expect(frameRevertReason(artifact, program, ip, 'Vault.seal()'))
      .toStrictEqual({ line: HELPER_LINE, message: HELPER_MESSAGE });
  });

  it('settles the same frame when the helper\'s guard holds', () => {
    // The control: the only difference is the key length the helper requires, so the refusal above is the guard's.
    expect(compositionMachine().stateSuccess(spendSeal(33).state)).toBe(true);
  });
});
