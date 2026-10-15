import { binToHex, hexToBin } from '@bitauth/libauth';
import { buildChunkCommitment, computeCollectionHash, encodeInt, Op, scriptToBytecode, hash256, type Script } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import type NetworkProvider from '../../src/network/NetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { convergeMessageBusComputedDynamicChunkOutputs } from '../../src/message-bus/computed-dynamic-chunks.js';
import { getMaterializationMode, setMaterializationMode } from '../../src/message-bus/materialization-mode.js';
import { discoverMessageBusComputedValueChunkValues } from '../../src/message-bus/computed-value-chunks.js';
import { computedValueChunkOutputPin } from '../../src/stateful/computed-value-chunk-pin.js';
import { evaluateFaithfulProbeTrace } from '../../src/stateful/faithful-probe-trace.js';
import { followsProbeEquality, matchesProbeOpcodeSequence, probeInstructionsSince } from '../../src/stateful/probe-instruction-sequence.js';
import { messageBusEventCommitmentsFromTransaction } from '../../src/stateful/sc-derive-return-blob.js';
import { repairComputedChunkOutput, type RepairComputedChunkOutputHost } from '../../src/stateful/stb-repair-computed-chunk-output.js';
import { persistValueChunkLock, type ValueChunkWriteDescriptor } from '../../src/stateful/value-chunk-persist.js';
import { generateLibauthSourceOutputs, scriptToLockingBytecode, solidCashOutputToLibauthOutput } from '../../src/utils.js';

const provider = {} as NetworkProvider;
const category = '11'.repeat(32);
const expected = Uint8Array.of(0, 0, 0x61);
const pin = (suffix: Script, inactive = false): Script => [
  scriptToBytecode(suffix), Op.OP_1, Op.OP_DEFINE,
  scriptToBytecode([Op.OP_1, Op.OP_INVOKE]), Op.OP_2, Op.OP_DEFINE,
  ...(inactive ? [Op.OP_0, Op.OP_IF] : []),
  expected, Op.OP_0, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_2, Op.OP_INVOKE,
  ...(inactive ? [Op.OP_ENDIF] : []), Op.OP_1,
];
const fixture = (script: Script): { builder: TransactionBuilder;
  program: Parameters<typeof evaluateFaithfulProbeTrace>[1]; sourceLock: Uint8Array } => {
  const sourceLock = scriptToBytecode(script);
  const outputs = [{ to: sourceLock, amount: 1000n,
    token: { category, amount: 0n, nft: { capability: 'mutable' as const, commitment: '000162' } } }];
  const inputs = [{ txid: '22'.repeat(32), vout: 0, satoshis: 1000n,
    token: outputs[0].token, unlocker: { generateLockingBytecode: () => sourceLock } }];
  const buildLibauthTransaction = (): ReturnType<TransactionBuilder['buildLibauthTransaction']> => ({ version: 2, locktime: 0,
    inputs: inputs.map((input) => ({ outpointTransactionHash: new Uint8Array(32).fill(0x22),
      outpointIndex: input.vout, sequenceNumber: 0xffffffff, unlockingBytecode: new Uint8Array() })),
    outputs: outputs.map(solidCashOutputToLibauthOutput),
  });
  const builder = { inputs, outputs, buildLibauthTransaction } as unknown as TransactionBuilder;
  const program = { inputIndex: 0, transaction: buildLibauthTransaction(),
    sourceOutputs: generateLibauthSourceOutputs(builder.inputs) };
  return { builder, program, sourceLock };
};


const repairHost = (builder: TransactionBuilder, sourceLock: Uint8Array): RepairComputedChunkOutputHost => {
  return { authenticatedEventOutputs: new Map(), authenticatedOutputLockingBytecodes: new Map(),
    allInputs: builder.inputs, builderOptions: { provider }, categoryId: category, dataNftUtxos: [],
    readOnlyDataNftUtxos: [], dynamicChunkVars: [{ name: 'payload', lockingBytecode: sourceLock }],
    explicitStateOverrideNftIndices: new Set(), externalCallUtxoGroups: [], externalOutStateUtxoGroups: [],
    lowLevelCallUtxoGroups: [], pendingReturnEventOutputs: [], rootStateNftIndexAt: () => undefined,
    setRootStateRawCommitmentAt: () => false, setExternalCallStateRawCommitmentAt: () => false,
    setDerivedChunkOutput: () => true, setExternalCallEntryOutputAt: () => false,
  } as unknown as RepairComputedChunkOutputHost;
};
describe('SDK observers of outlined equality checks', () => {
  it.each([[Op.OP_EQUALVERIFY], [Op.OP_EQUAL, Op.OP_VERIFY]])(
    'reads exactly the executed event output through nested checks (%s)', (...suffix) => {
      const { builder, program } = fixture(pin(suffix as Script));
      const host = { inner: { provider, artifact: { structs: [], enums: [] } } } as never;
      expect(messageBusEventCommitmentsFromTransaction(host, builder, [0, 1], 0, program))
        .toEqual(new Map([[0, { commitment: binToHex(expected) }]]));
      expect(messageBusEventCommitmentsFromTransaction(host, builder, [1], 0, program)).toEqual(new Map());
    },
  );

  it.each([false, true])('does not turn SIZE or inactive introspections into event pins (inactive=%s)', (inactive) => {
    const suffix: Script = inactive ? [Op.OP_EQUALVERIFY] : [Op.OP_SIZE, Op.OP_DROP, Op.OP_DROP, Op.OP_DROP];
    const { builder, program } = fixture(pin(suffix, inactive));
    const host = { inner: { provider, artifact: { structs: [], enums: [] } } } as never;
    expect(messageBusEventCommitmentsFromTransaction(host, builder, [0], 0, program)).toEqual(new Map());
  });

  it('recognizes a continuation pin with SWAP and equality in separate invoked bodies', () => {
    const lock = Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32), 0x87]);
    const source: Script = [
      scriptToBytecode([Op.OP_SWAP]), Op.OP_1, Op.OP_DEFINE,
      scriptToBytecode([Op.OP_OUTPUTBYTECODE]), Op.OP_2, Op.OP_DEFINE,
      scriptToBytecode([Op.OP_EQUALVERIFY]), Op.OP_3, Op.OP_DEFINE,
      expected, lock, Op.OP_0, Op.OP_SWAP,
      Op.OP_1, Op.OP_INVOKE, Op.OP_2, Op.OP_INVOKE, Op.OP_3, Op.OP_INVOKE,
    ];
    // The compiler frame additionally retains a duplicate coordinate below the expected lock.
    source.splice(source.indexOf(expected) + 1, 0, Op.OP_0);
    const { program } = fixture(source);
    const state = evaluateFaithfulProbeTrace(provider, program)
      .find((step) => step.instructions[step.ip]?.opcode === Op.OP_OUTPUTBYTECODE)!;
    expect(matchesProbeOpcodeSequence(state, -1, [Op.OP_SWAP])).toBe(true);
    expect(followsProbeEquality(state)).toBe(true);
    expect(computedValueChunkOutputPin(state, 0)).toMatchObject({ outputIndex: 0, commitment: expected });
    expect(computedValueChunkOutputPin(state, 1)).toBeUndefined();
  });

  it('discovers a computed value from a failing outlined count check', () => {
    const redeem = scriptToBytecode([
      scriptToBytecode([Op.OP_EQUALVERIFY]), Op.OP_1, Op.OP_DEFINE,
      Op.OP_DROP, Op.OP_1, Op.OP_INVOKE, Op.OP_2DROP, Op.OP_1,
    ]);
    const masterLock = scriptToLockingBytecode(redeem, 'p2sh32');
    const signature = 'records:mapping(uint256 => bytes)';
    const write: ValueChunkWriteDescriptor = { categoryId: category, collection: 'records',
      collectionSignature: signature, collectionHash: binToHex(computeCollectionHash(signature)),
      keySlot: '33'.repeat(32), entryAccessSlot: 0, routeSlot: 0, operation: 'insert',
      outputBase: 0, outputCount: 2 };
    const value = new Uint8Array(197).fill(0x31);
    const lock = persistValueChunkLock(category, value, write, masterLock)!;
    const unlockingBytecode = scriptToBytecode([value, lock, encodeInt(2n), Op.OP_0, Op.OP_0, redeem]);
    const builder = { inputs: [{ satoshis: 1000n, unlocker: { generateLockingBytecode: () => masterLock } }],
      buildLibauthTransaction: () => ({ version: 2, locktime: 0,
        inputs: [{ outpointTransactionHash: new Uint8Array(32), outpointIndex: 0,
          sequenceNumber: 0xffffffff, unlockingBytecode }], outputs: [],
      }) } as unknown as TransactionBuilder;
    expect(discoverMessageBusComputedValueChunkValues(builder, [{ inputIndex: 0, write }]))
      .toMatchObject([{ inputIndex: 0, value, lockingBytecode: lock, chunkCount: 2, requiresMaterialization: true }]);
    expect(discoverMessageBusComputedValueChunkValues(builder, [{ inputIndex: 0,
      write: { ...write, keySlot: '44'.repeat(32) } }])).toEqual([]);
  });

  it('repairs an owned mutable chunk commitment from the same nested equality', () => {
    const { builder, sourceLock } = fixture(pin([Op.OP_EQUALVERIFY]));
    const host = repairHost(builder, sourceLock);
    expect(repairComputedChunkOutput(host, builder, 0)).toMatchObject({ changed: true, repairedOutputs: [0] });
    expect(builder.outputs[0].token?.nft?.commitment).toBe(binToHex(expected));
  });

  it.each([false, true])('does not repair an inactive or SIZE-only commitment (inactive=%s)', (inactive) => {
    const suffix: Script = inactive ? [Op.OP_EQUALVERIFY] : [Op.OP_SIZE, Op.OP_DROP, Op.OP_DROP, Op.OP_DROP];
    const { builder, sourceLock } = fixture(pin(suffix, inactive));
    repairComputedChunkOutput(repairHost(builder, sourceLock), builder, 0);
    expect(builder.outputs[0].token?.nft?.commitment).toBe('000162');
  });

  it('retains an output lock reconstruction when equality runs in another helper frame', () => {
    const preimage = Uint8Array.of(0x71);
    const expectedLock = Uint8Array.from([0xaa, 0x20, ...hash256(preimage), 0x87]);
    const { builder, program, sourceLock } = fixture([
      scriptToBytecode([Op.OP_EQUALVERIFY]), Op.OP_1, Op.OP_DEFINE,
      preimage, Op.OP_0, Op.OP_OUTPUTBYTECODE, Op.OP_SWAP, Op.OP_HASH256,
      Uint8Array.of(0xaa, 0x20), Op.OP_SWAP, Op.OP_CAT, Uint8Array.of(0x87), Op.OP_CAT,
      Op.OP_1, Op.OP_INVOKE, Op.OP_1,
    ]);
    const trace = evaluateFaithfulProbeTrace(provider, program);
    const introspection = trace.find((step) => step.instructions[step.ip]?.opcode === Op.OP_OUTPUTBYTECODE)!;
    const equality = trace.find((step) => step.instructions[step.ip]?.opcode === Op.OP_EQUALVERIFY)!;
    expect(probeInstructionsSince(equality, introspection)?.map((instruction) => instruction.opcode))
      .toContain(Op.OP_HASH256);
    const result = repairComputedChunkOutput(repairHost(builder, sourceLock), builder, 0);
    expect(result.changed).toBe(true);
    expect(builder.outputs[0].to).toEqual(expectedLock);
  });


  it.each([false, true])('converges the same owned dynamic chunk with inline and outlined checks (outlined=%s)', (outlined) => {
    const commitment = hexToBin(buildChunkCommitment(0, Uint8Array.of(0x61)));
    const script: Script = outlined ? [
      scriptToBytecode([Op.OP_EQUALVERIFY]), Op.OP_1, Op.OP_DEFINE,
      commitment, Op.OP_1, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_1, Op.OP_INVOKE, Op.OP_1,
    ] : [commitment, Op.OP_1, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_EQUALVERIFY, Op.OP_1];
    const { builder } = fixture(script);
    const layout = { blockSize: 2, trailingBase: 1, trailingCapacity: 1,
      slots: [{ kind: 'master', offset: 0 }, { kind: 'trailing', offset: 1 }] };
    Object.assign(builder.inputs[0].unlocker, { abiFunction: { blockLayout: layout },
      contract: { artifact: { compiler: { options: { messageBusDirectParticipant: true } } } } });
    const lock = Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32), 0x87]);
    for (let index = 1; index <= 2; index += 1) {
      builder.inputs.push({ txid: '22'.repeat(32), vout: index, satoshis: 1000n,
        ...(index === 1 && { token: { category, amount: 0n,
          nft: { capability: 'mutable' as const, commitment: '00' } } }),
        unlocker: { generateLockingBytecode: () => Uint8Array.of(Op.OP_1) } } as never);
      builder.outputs.push({ to: index === 1 ? lock : Uint8Array.of(Op.OP_1), amount: 1000n,
        ...(index === 1 && { token: { category, amount: 0n,
          nft: { capability: 'mutable' as const, commitment: '00' } } }) });
    }
    Object.assign(builder, { provider, buildLibauthProgram: () => ({
      transaction: builder.buildLibauthTransaction(), sourceOutputs: generateLibauthSourceOutputs(builder.inputs),
    }) });
    const priorMode = getMaterializationMode();
    setMaterializationMode('devOracle');
    try {
      expect(convergeMessageBusComputedDynamicChunkOutputs(builder))
        .toMatchObject({ repairs: 1, ownedOutputs: [1], authenticatedOutputs: [1], outputs: [1] });
      expect(builder.outputs[1].token?.nft?.commitment).toBe(binToHex(commitment));
      const program = builder.buildLibauthProgram();
      const vm = createVirtualMachineBch2026ForProvider(provider);
      for (let inputIndex = 0; inputIndex < builder.inputs.length; inputIndex += 1) {
        expect(vm.stateSuccess(vm.evaluate({ ...program, inputIndex }))).toBe(true);
      }
      builder.outputs[1].token!.nft!.commitment = '000162';
      expect(vm.stateSuccess(vm.evaluate({ ...builder.buildLibauthProgram(), inputIndex: 0 }))).not.toBe(true);
    } finally { setMaterializationMode(priorMode); }
  });

});
