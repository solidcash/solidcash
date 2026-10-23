import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

const SOURCE = `pragma solidcash ^0.14.0;
enum Status { Idle, Ready }
struct Detail { bytes2 tag; Status status; }
struct Rec { int value; Detail detail; bytes note; bytes4[2] marks; }
contract NativeTerminal() {
  function echo(Rec[] values) public pure returns (Rec[]) { return values; }
}`;

const record = (
  value: bigint, status: bigint, note: number[],
): {
  value: bigint;
  detail: { tag: Uint8Array; status: bigint };
  note: Uint8Array;
  marks: Uint8Array[];
} => ({
  value,
  detail: { tag: Uint8Array.of(Number(value), Number(value) + 1), status },
  note: Uint8Array.from(note),
  marks: [new Uint8Array(4).fill(Number(value) + 2), new Uint8Array(4).fill(Number(value) + 3)],
});

describe('kernel native terminal struct-array result composition', () => {
  it('executes and decodes nonempty, empty, and distinct native Rec[] rows in source order', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(SOURCE, KERNEL);
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'echo')).toMatchObject({
      eligible: true,
      outputs: [{ type: 'Rec[]' }],
    });

    const first = [record(7n, 1n, [0xaa, 0xbb, 0xcc]), record(9n, 0n, [0x01])];
    const empty: ReturnType<typeof record>[] = [];
    const last = [record(12n, 1n, [0xde, 0xad, 0xbe, 0xef])];
    const rows = [
      { function: 'echo', args: [first] },
      { function: 'echo', args: [empty] },
      { function: 'echo', args: [last] },
    ];
    const plan = messageBus.encodeMessageBatch(artifact, rows);

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const source = StatefulContract.withCategory(
      inner.withCategory(hexToBin(categoryId)), categoryId,
    );
    const consumerArtifact = compileString(`pragma solidcash ^0.14.0;
      enum Status { Idle, Ready }
      struct Detail { bytes2 tag; Status status; }
      struct Rec { int value; Detail detail; bytes note; bytes4[2] marks; }
      interface Echo { function echo(Rec[] values) external returns (Rec[]); }
      contract Consumer(address source) {
        function verify(Rec[] first, Rec[] empty, Rec[] last) public {
          Rec[] a = Echo(source).echo(first);
          Rec[] b = Echo(source).echo(empty);
          Rec[] c = Echo(source).echo(last);
          require(a.length == 2 && a[0].value == 7 && a[1].detail.status == Status.Idle
            && b.length == 0 && c.length == 1 && c[0].note == hex"deadbeef");
        }
      }`, KERNEL);
    const consumerBase = new Contract(consumerArtifact, [source.inner.lockingBytecode], { provider });
    const consumerSetup = await setupStatefulUtxos(
      provider, consumerBase, consumerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const consumer = StatefulContract.withCategory(
      consumerBase.withCategory(hexToBin(consumerSetup.categoryId)), consumerSetup.categoryId,
    );
    const callsiteIds = consumerArtifact.abi.find((entry) => entry.name === 'verify')!
      .externalCalls!.filter((call) => call.functionName === 'echo').map((call) => call.callsiteId!);
    expect(callsiteIds).toHaveLength(3);
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: consumer, functionName: 'verify', args: [first, empty, last] },
        ...rows.map((row, index) => ({
          contract: source,
          functionName: row.function,
          args: row.args,
          callsiteId: callsiteIds[index],
        })),
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }

    const routeInput = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === artifact.contractName
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    const returnOutput = transaction.outputs.findIndex((output) => output.token?.nft?.capability === 'none'
      && binToHex(output.token.category) === categoryId);
    expect(routeInput).toBeGreaterThanOrEqual(0);
    expect(returnOutput).toBeGreaterThanOrEqual(0);
    const commitment = transaction.outputs[returnOutput].token!.nft!.commitment;
    expect(messageBus.decodeMessageBusResults(artifact, plan, commitment)).toEqual([
      { row: 0, type: 'Rec[]', value: first },
      { row: 1, type: 'Rec[]', value: empty },
      { row: 2, type: 'Rec[]', value: last },
    ]);

    const tamperedCommitment = Uint8Array.from(commitment);
    tamperedCommitment[tamperedCommitment.length - 1] ^= 1;
    const tampered = {
      ...transaction,
      outputs: transaction.outputs.map((output, index) => index !== returnOutput ? output : ({
        ...output,
        token: { ...output.token!, nft: { ...output.token!.nft!, commitment: tamperedCommitment } },
      })),
    };
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: routeInput, sourceOutputs, transaction: tampered,
    }))).not.toBe(true);

    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);
});
