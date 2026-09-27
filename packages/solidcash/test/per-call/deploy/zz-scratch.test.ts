import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { binToHex, createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256 } from '@bitauth/libauth';
import {
  asmToScript, buildPushdataCommitment, encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress,
  type RecordEntry, type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../../solidc/src/compiler.js';
import { fillPlaceholders } from '../../../../solidc/src/per-call/master/placeholders.js';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { callerUnlockingBytecode } from '../../../../solidc/test/per-call/master/caller-input.js';
import { categorySlotValue, seededCategory } from '../../../../solidc/test/per-call/master/validator-input.js';

const CATEGORY = seededCategory('scratch genesis');
const VALIDATOR_PROGRAM = new Uint8Array([0x51, 0x52]);
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
const OWNER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(9));
const VALUE = 20_000n;

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Vault {'
  + '   int public total;'
  + '   constructor(int seed) { this.total = seed + 1; }'
  + '   function check(int v) { require(this.total == v); }'
  + ' }';

const artifact = compileString(SOURCE, { composition: 'per-call' });
const stateLayout = artifact.stateLayout!;
const program = fillPlaceholders(
  scriptToBytecode(asmToScript(artifact.bytecode)),
  artifact.composition!.placeholders,
  { category: categorySlotValue(CATEGORY), contractAddress: ADDRESS, templateHash: TEMPLATE_HASH },
);
const lock = encodeLockingBytecodeP2sh32(hash256(program));

const selectorOf = (name: string): Uint8Array =>
  new Uint8Array(Buffer.from(artifact.abi.find((e) => e.name === name)!.selector!, 'hex'));
const CONSTRUCTOR_SELECTOR = selectorOf('__construct');

const commitment = (total: bigint): Uint8Array =>
  new Uint8Array(Buffer.from(buildPushdataCommitment(stateLayout, { total }, 0), 'hex'));

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmInput = NonNullable<VmProgram['transaction']>['inputs'][number];
type VmOutput = NonNullable<VmProgram['transaction']>['outputs'][number];

const token = (
  capability: 'minting' | 'mutable',
  c: Uint8Array = new Uint8Array(0),
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: Uint8Array } } =>
  ({ category: CATEGORY, amount: 0n, nft: { capability, commitment: c } });

const MASTER_INDEX = 1;
const CALLER_INDEX = 0;
const RECORD_INDEX = 2;
const SPARE_INDEX = 3;

function build(after: Uint8Array, before: Uint8Array, declaredOut?: Uint8Array): VmProgram {
  const declaration: RecordEntry = {
    in: RECORD_INDEX, out: RECORD_INDEX, viewIn: before, viewOut: declaredOut ?? after,
  };
  const block: WitnessBlock = {
    kind: 0, callerRef: CALLER_INDEX, originRef: CALLER_INDEX, validatorRef: 0xffff,
    sender: OWNER_LOCK, self: ADDRESS, value: 0n, retval: new Uint8Array(0),
    calls: [], segments: [[declaration]], events: [], sends: [],
  };
  const plainInput = (fillByte: number): VmInput => ({
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(fillByte), sequenceNumber: 0xffffffff,
    unlockingBytecode: encodeDataPush(new Uint8Array([1])),
  });
  const inputs: VmInput[] = [];
  const outputs: VmOutput[] = [];
  const sourceOutputs: VmProgram['sourceOutputs'] = [];
  inputs[CALLER_INDEX] = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(7), sequenceNumber: 0xffffffff,
    unlockingBytecode: callerUnlockingBytecode(),
  };
  outputs[CALLER_INDEX] = { lockingBytecode: OWNER_LOCK, valueSatoshis: 100_000n };
  sourceOutputs[CALLER_INDEX] = outputs[CALLER_INDEX];
  inputs[MASTER_INDEX] = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(2), sequenceNumber: 0xffffffff,
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(block)),
      ...encodeDataPush(CONSTRUCTOR_SELECTOR),
      ...encodeDataPush(new Uint8Array([5])),
      ...encodeDataPush(program),
    ]),
  };
  outputs[MASTER_INDEX] = { lockingBytecode: lock, valueSatoshis: VALUE, token: token('minting') };
  sourceOutputs[MASTER_INDEX] = outputs[MASTER_INDEX];
  inputs[SPARE_INDEX] = plainInput(SPARE_INDEX + 2);
  outputs[SPARE_INDEX] = { lockingBytecode: OWNER_LOCK, valueSatoshis: VALUE };
  sourceOutputs[SPARE_INDEX] = outputs[SPARE_INDEX];
  inputs[RECORD_INDEX] = plainInput(RECORD_INDEX + 2);
  outputs[RECORD_INDEX] = { lockingBytecode: OWNER_LOCK, valueSatoshis: VALUE, token: token('mutable', after) };
  sourceOutputs[RECORD_INDEX] = { lockingBytecode: OWNER_LOCK, valueSatoshis: VALUE, token: token('mutable', before) };
  return {
    inputIndex: MASTER_INDEX, sourceOutputs,
    transaction: { version: 2, inputs, outputs, locktime: 0 },
  };
}

describe('scratch', () => {
  it('observes the trace when the declared viewOut is wrong', () => {
    const empty = commitment(0n);
    console.log('commit0', binToHex(empty));
    console.log('commit6', binToHex(commitment(6n)));
    console.log('commit999', binToHex(commitment(999n)));
    const program1 = build(commitment(999n), empty);
    const vm = compositionMachine();
    const state = vm.evaluate(program1);
    console.log('accepted:', vm.stateSuccess(state));
    const debug = compositionMachine().debug(program1);
    const failed = [...debug].reverse().find((s: any) => s.error);
    console.log('failed ip:', (failed as any)?.ip, 'err:', (failed as any)?.error,
      'len:', (failed as any)?.instructions?.length);
    console.log('window:', ((failed as any)?.instructions ?? [])
      .slice(Math.max(0, ((failed as any)?.ip ?? 0) - 6), ((failed as any)?.ip ?? 0) + 4)
      .map((ins: any) => ins.opcode));
    const f = failed as any;
    const n = debug.length;
    const firstFailIndex = debug.findIndex((s: any) => s.error);
    const around = debug.slice(Math.max(0, firstFailIndex - 2), firstFailIndex + 2)
      .map((s: any) => ({ ip: s.ip, opcode: s.instructions[s.ip]?.opcode, err: s.error,
        stack: s.stack.map((x: Uint8Array) => binToHex(x)),
        instrLen: s.instructions.length }));
    const info = {
      firstFailIndex,
      around,
      failStack: f.stack.map((x: Uint8Array) => binToHex(x)),
      ip: f?.ip,
      opcodeAtIp: f?.instructions?.[f.ip]?.opcode,
      error: f?.error,
      window: f.instructions.slice(Math.max(0, f.ip - 6), f.ip + 4).map((ins: any) => ins.opcode),
      stack: f.stack.map((x: Uint8Array) => binToHex(x)),
      window_dump: debug.filter((s: any) => s.ip >= 148 && s.ip <= 160)
        .map((s: any) => ({ ip: s.ip, opcode: s.instructions[s.ip]?.opcode, err: s.error,
          stack: s.stack.map((x: Uint8Array) => binToHex(x)) })),
      total: n,
    };
    writeFileSync('/tmp/scratch-dump.json', JSON.stringify(info, null, 1));
    expect(true).toBe(true);
  });
});
