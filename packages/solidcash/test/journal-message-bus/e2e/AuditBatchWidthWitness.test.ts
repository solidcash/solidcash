import {
  bigIntToVmNumber, binToHex, decodeAuthenticationInstructions, encodeAuthenticationInstruction, encodeDataPush,
  flattenBinArray, vmNumberToBigInt,
} from '@bitauth/libauth';
import { asmToScript, encodeEventCommitment, scriptToBytecode } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract, type TransactionBuilder } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

/**
 * The trailing batch width of a kernel route is a hidden ABI input that offsets the runtime effect stream. Each
 * hostile spend takes the honest transaction and changes only that push of the route input (one also drops the
 * stream record the shifted stream no longer reads); nothing is re-signed.
 */
const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
  maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;

// `note` keeps an event window in the route block; `mark` inserts a key (one rewritten predecessor lane) and
// streams the same record on its runtime effect stream.
const SOURCE = `pragma solidcash ^0.14.0;
contract WidthLedger() {
  mapping(int => int) marks;
  event Logged(int value);
  function note(int value) public {
    if (value > 0) emit Logged(value);
    require(true);
  }
  function mark(int key, int value) public {
    this.marks[key] = value;
    emit Logged(value);
    require(true);
  }
}`;
const WIDTH = '__internal__vmapBatchTrailingCount';

type LibauthTransaction = ReturnType<TransactionBuilder['buildLibauthTransaction']>;
type Instruction = ReturnType<typeof decodeAuthenticationInstructions>[number];

const pushedValue = (instruction: Instruction): bigint => {
  if ('data' in instruction) return vmNumberToBigInt(instruction.data, { requireMinimalEncoding: false }) as bigint;
  if (instruction.opcode === 0x4f) return -1n;
  if (instruction.opcode >= 0x51 && instruction.opcode <= 0x60) return BigInt(instruction.opcode - 0x50);
  throw new Error(`unlocking push ${instruction.opcode} is not a number`);
};

describe('kernel trailing batch width witness', () => {
  it('refuses a deflated or inflated width on an honest route spend', async () => {
    const artifact = compileString(SOURCE, KERNEL);
    const route = artifact.messageBus!.route;
    const widthAt = route.inputs.findIndex((input) => input.name === WIDTH);
    expect(widthAt).toBeGreaterThanOrEqual(0);
    const provider = createMessageBusCapstoneTestProvider();
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const builder = await contract.batch([
      { function: 'note', args: [5n] }, { function: 'mark', args: [7n, 5n] },
    ]).build();
    const honest = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const master = sourceOutputs.findIndex((output) => output.token?.nft?.capability === 'minting');
    // A P2PKH input signs the outputs; a hostile spender re-signs its own funding, so only covenants are judged.
    const covenants = [master, ...honest.inputs.flatMap((_input, index) => {
      const lock = sourceOutputs[index]!.lockingBytecode;
      return index === master || (lock.length === 25 && lock[0] === 0x76 && lock[1] === 0xa9) ? [] : [index];
    })];
    const accepts = (transaction: LibauthTransaction, inputs: readonly number[]): boolean => inputs.every(
      (inputIndex) => vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })) === true,
    );
    expect(accepts(honest, honest.inputs.map((_input, index) => index))).toBe(true);

    const instructions = decodeAuthenticationInstructions(honest.inputs[master]!.unlockingBytecode) as Instruction[];
    // [selector, positional pushes] [input n-1 .. input 0] [redeem]
    const leadingPushes = instructions.length - 1 - route.inputs.length;
    const inputAt = (index: number): number => leadingPushes + route.inputs.length - 1 - index;
    const position = inputAt(widthAt);
    const honestWidth = pushedValue(instructions[position]!);
    const predOuts = route.inputs.flatMap((input, index) => (/^__internal__vmapBatchPredOut_\d+$/.test(input.name)
      ? [`${input.name}=${pushedValue(instructions[inputAt(index)]!)}`] : []));
    // `erase` keeps the output but strips its record; `drop` removes it, shifting the outputs after it.
    const withWidth = (
      width: bigint, edit?: { output: number; mode: 'drop' | 'erase' },
    ): LibauthTransaction => {
      const unlockingBytecode = flattenBinArray(instructions.map((instruction, index) => (index === position
        ? encodeDataPush(bigIntToVmNumber(width)) : encodeAuthenticationInstruction(instruction))));
      const outputs = honest.outputs.flatMap((output, index) => {
        if (index !== edit?.output) return [output];
        return edit.mode === 'drop' ? [] : [{ lockingBytecode: Uint8Array.of(0x51), valueSatoshis: output.valueSatoshis }];
      });
      return {
        ...honest,
        inputs: honest.inputs.map((input, index) => (index === master ? { ...input, unlockingBytecode } : input)),
        outputs,
      };
    };
    expect(binToHex(withWidth(honestWidth).inputs[master]!.unlockingBytecode))
      .toBe(binToHex(honest.inputs[master]!.unlockingBytecode));

    // The window and the stream carry one identical record; the stream's is the later output.
    const logged = artifact.events!.find((event) => event.name === 'Logged')!;
    const record = binToHex(encodeEventCommitment(logged.parameters, [5n]));
    const records = honest.outputs.flatMap((output, index) => (output.token?.nft?.capability === 'none'
      && binToHex(output.token.nft.commitment) === record ? [index] : []));
    const diagnostics = {
      routeBytes: scriptToBytecode(asmToScript(artifact.bytecode)).length,
      master, leadingPushes, honestWidth: honestWidth.toString(), predOuts, records,
      trailingBase: route.blockLayout?.trailingBase, blockSize: route.blockLayout?.blockSize,
      outputs: honest.outputs.length, covenants,
    };
    console.log('batch-width-diagnostics', JSON.stringify(diagnostics));
    expect(leadingPushes).toBeGreaterThanOrEqual(0);
    expect(honestWidth).toBe(1n);
    expect(records).toHaveLength(2);
    const streamRecord = records[records.length - 1]!;
    const modes = ['drop', 'erase'] as const;
    // Control: at the honest width the stream's record cannot be removed.
    for (const mode of modes) {
      expect(accepts(withWidth(honestWidth, { output: streamRecord, mode }), covenants), mode).toBe(false);
    }

    const accepted: string[] = [];
    // (a) a deflated or negative width slides the stream back over the block, onto the window's identical record,
    // so the stream's own record can go: one log disappears.
    for (let width = -BigInt(honest.outputs.length); width < honestWidth; width += 1n) {
      if (accepts(withWidth(width), covenants)) accepted.push(`a:${width}`);
      for (const mode of modes) {
        if (accepts(withWidth(width, { output: streamRecord, mode }), covenants)) accepted.push(`a-${mode}:${width}`);
      }
    }
    // (b) an inflated width moves the stream past its records.
    for (let width = honestWidth + 1n; width <= honestWidth + 3n; width += 1n) {
      if (accepts(withWidth(width), covenants)) accepted.push(`b:${width}`);
    }
    expect(accepted).toEqual([]);
    await expect(contract.batch([
      { function: 'note', args: [5n] }, { function: 'mark', args: [7n, 5n] },
    ]).send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/u) });
  }, 180_000);
});
