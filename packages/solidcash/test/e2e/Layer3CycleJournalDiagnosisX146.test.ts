import {
  bigIntToVmNumber, binToHex, disassembleBytecodeBCH, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate, StatefulContract, TransactionBuilder, layer3,
} from '../../src/index.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import {
  createDataNftUnlocker, createReadOnlyDynamicChunkUnlocker, getDataNftAddress, getDynamicChunkAddress,
} from '../../src/stateful/covenant-helpers.js';

/**
 * X146 DIAGNOSIS. Not evidence of a boundary - a measurement harness.
 *
 * The honest C2 cycle, built exactly as `Layer3HeterogeneousCycleC2.test.ts` builds it and then stepped on the
 * BCH-2026 VM so the failing instruction of input 0 can be named. Under the repaired `journalSlotsOf` (widened
 * emission clones keeping DYNAMIC slots) this input stops settling; this file reports where.
 */

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const packedResult = (value: bigint): Uint8Array => scriptToBytecode([bigIntToVmNumber(value)]);
const aggregateResult = (value: bigint): Uint8Array => scriptToBytecode([packedResult(value)]);

const CYCLE_HUB = `pragma solidcash >=0.8.0;
interface ICycleLeg {
  function credit(uint value);
  function debit(uint value);
  function debitAlt(uint value);
}
contract CycleHub() {
  function(uint) external[] legs;
  uint total;
  function registerCredit(address target) public { this.legs.push(ICycleLeg(target).credit); require(true); }
  function registerDebit(address target) public { this.legs.push(ICycleLeg(target).debit); require(true); }
  function fireAll(uint value) public {
    require(legs.length <= 2);
    for (int i = 0; i < legs.length; i = i + 1) { legs[i](value); }
    require(value >= 0);
  }
  function absorb(uint credited) public {
    this.total = this.total + credited;
    require(credited > 0);
  }
}`;

const CYCLE_LEG_B = `pragma solidcash >=0.8.0;
interface ICycleHub { function absorb(uint credited); }
contract CycleLegB(address hub) {
  uint seen;
  function credit(uint value) public {
    this.seen = this.seen + value;
    ICycleHub(hub).absorb(value);
    require(value > 0);
  }
}`;

const CYCLE_LEG_C = `pragma solidcash >=0.8.0;
interface ICycleAudit { function score(uint value) returns (uint); }
contract CycleLegC(address auditor) {
  uint burned;
  function debit(uint value) public {
    uint scored = ICycleAudit(auditor).score(value);
    this.burned = this.burned + scored;
    require(value > 0);
  }
  function debitAlt(uint value) public {
    uint scored = ICycleAudit(auditor).score(value);
    this.burned = this.burned + scored + 1;
    require(value > 0);
  }
}`;

const CYCLE_AUDIT_D = `pragma solidcash >=0.8.0;
contract CycleAuditD(int brand) {
  uint reviews;
  function score(uint value) public returns (uint) {
    this.reviews = this.reviews + 1;
    require(value > 0 && brand >= 0);
    return value + 1;
  }
}`;

const CALL_VALUE = 4n;

function uniqueUtxo(seen: Set<string>, defaults?: Parameters<typeof randomUtxo>[0]): ReturnType<typeof randomUtxo> {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const utxo = randomUtxo(defaults);
    const outpoint = `${utxo.txid}:${utxo.vout}`;
    if (seen.has(outpoint)) continue;
    seen.add(outpoint);
    return utxo;
  }
  throw new Error('could not draw a distinct funding outpoint');
}

interface BuiltProbe {
  builder: TransactionBuilder;
  hubArtifact: any;
  participantInputs: readonly number[];
  chunkAddresses: Record<string, string>;
}

/** The honest C2 cycle, with no tamper mode and no hostile variation. */
async function buildHonestCycle(): Promise<BuiltProbe> {
  const provider = createLayer3SemanticTestProvider();
  const outpoints = new Set<string>();
  const projection = new Contract(compileString(layer3.generateGraphProjectionVerifier()), [], { provider });
  const controller = new Contract(
    compileString(layer3.generateGraphRootController(projection.lockingBytecode)), [alicePkh], { provider },
  );
  const genesis = await (provider as any).addTokenUtxosDynamic(() => [{
    address: controller.tokenAddress,
    satoshis: 3000n,
    token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } },
  }]);
  const controllerCategory = genesis.categoryId as string;
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  const hubArtifact = compileString(CYCLE_HUB, options);
  const legBArtifact = compileString(CYCLE_LEG_B, options);
  const legCArtifact = compileString(CYCLE_LEG_C, options);
  const auditArtifact = compileString(CYCLE_AUDIT_D, options);

  const hubBase = new Contract(hubArtifact, [], { provider });
  const hubSetup = await setupStatefulUtxos(
    provider, hubBase, hubArtifact.stateLayout!, { total: 0n, legs: [], __fnsel_legs: [] },
  );
  const hub = hubBase.withCategory(hexToBin(hubSetup.categoryId));
  const auditBase = new Contract(auditArtifact, [9n], { provider });
  const auditSetup = await setupStatefulUtxos(provider, auditBase, auditArtifact.stateLayout!, { reviews: 0n });
  const audit = auditBase.withCategory(hexToBin(auditSetup.categoryId));
  const legBBase = new Contract(legBArtifact, [hub.lockingBytecode], { provider });
  const legBSetup = await setupStatefulUtxos(provider, legBBase, legBArtifact.stateLayout!, { seen: 0n });
  const legB = legBBase.withCategory(hexToBin(legBSetup.categoryId));
  const legCBase = new Contract(legCArtifact, [audit.lockingBytecode], { provider });
  const legCSetup = await setupStatefulUtxos(provider, legCBase, legCArtifact.stateLayout!, { burned: 0n });
  const legC = legCBase.withCategory(hexToBin(legCSetup.categoryId));

  const hubStateful = StatefulContract.withCategory(hubBase, hubSetup.categoryId);
  await hubStateful.registerCredit(legB.lockingBytecode).send();
  await hubStateful.registerDebit(legC.lockingBytecode).send();
  const currentHub = await hubStateful.getFullState();

  const participants: layer3.CompiledGraphParticipant[] = [
    { artifact: hubArtifact, lockingBytecode: hub.lockingBytecode },
    { artifact: legBArtifact, lockingBytecode: legB.lockingBytecode },
    { artifact: legCArtifact, lockingBytecode: legC.lockingBytecode },
    { artifact: auditArtifact, lockingBytecode: audit.lockingBytecode },
  ];
  const honestScore = CALL_VALUE + 1n;
  const invocations: layer3.CompiledGraphInvocation[] = [
    { parent: null, callee: 0, function: 'fireAll', args: [CALL_VALUE] },
    { parent: 0, callee: 1, function: 'credit', args: [CALL_VALUE], callMode: 'call' },
    { parent: 1, callee: 0, function: 'absorb', args: [CALL_VALUE], callMode: 'call' },
    { parent: 0, callee: 2, function: 'debit', args: [CALL_VALUE], callMode: 'call' },
    { parent: 3, callee: 3, function: 'score', args: [CALL_VALUE], callMode: 'call' },
  ];
  const plan = layer3.planCompiledGraph(participants, invocations);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const resultVectors = plan.participants.map((participant) =>
    (participant.batch.results.length > 0 ? binToHex(packedResult(honestScore)) : ''));
  const invocationResults: Record<number, string> = {};
  plan.invocations.forEach((invocation) => {
    if (invocation.resultTypes.length > 0) {
      invocationResults[invocation.index] = binToHex(packedResult(honestScore));
    }
  });
  const transcript = layer3.finalizeCompiledGraph(
    plan, invocationResults, layout.participantInputs, layout.returnOutputs!, resultVectors,
    layout.projectionInputs,
  );

  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const seedFee = uniqueUtxo(outpoints, { satoshis: 20_000n });
  await provider.addUtxo(p2pkh.address, seedFee);
  const seedTx = new TransactionBuilder({ provider });
  seedTx.addInput(
    genesis.utxos[0], controller.unlock.initialize(hexToBin(transcript.root), alicePub, signature()),
  );
  seedTx.addInput(seedFee, p2pkh.unlock.spend(alicePub, signature()));
  seedTx.addOutput({
    to: controller.tokenAddress, amount: genesis.utxos[0].satoshis,
    token: {
      category: controllerCategory, amount: 0n,
      nft: { capability: 'mutable', commitment: transcript.root },
    },
  });
  seedTx.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(seedTx));
  const rootedController = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === transcript.root);

  const projections = plan.participants.map(() => uniqueUtxo(outpoints, { satoshis: 1000n }));
  for (const proof of projections) await provider.addUtxo(projection.address, proof);
  const fee = uniqueUtxo(outpoints, { satoshis: 300_000n });
  await provider.addUtxo(p2pkh.address, fee);

  const dynamicVariables = hubArtifact.stateLayout!.variables.filter((variable: any) => variable.dynamic);
  const chunks: { variable: any; utxo: any; address: string }[] = [];
  for (const variable of dynamicVariables) {
    const address = getDynamicChunkAddress(hub, hubSetup.categoryId, variable.name, variable.type);
    for (const utxo of await provider.getUtxos(address)) chunks.push({ variable, utxo, address });
  }
  const hubLayout = hubArtifact.hiddenBatch!.route.blockLayout!;
  const hubSlotKind = new Map<number, string>(hubLayout.slots.map((slot: any) => [slot.offset, slot.kind]));
  const fillers = Array.from(
    { length: hubLayout.blockSize - 2 - chunks.length }, () => uniqueUtxo(outpoints, { satoshis: 1000n }),
  );
  for (const funding of fillers) await provider.addUtxo(p2pkh.address, funding);
  const auditReturnFunding = uniqueUtxo(outpoints, { satoshis: 1000n });
  await provider.addUtxo(p2pkh.address, auditReturnFunding);

  const routeFor = (contract: Contract, artifact: any): any => contract.createCompilerRouteUnlocker(
    artifact.hiddenBatch.route, hexToBin(artifact.hiddenBatch.selector),
  );

  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  let chunkCursor = 0;
  let fillerCursor = 0;
  for (let offset = 0; offset < hubLayout.blockSize; offset += 1) {
    const kind = hubSlotKind.get(offset);
    if (kind === 'master') {
      tx.addInput(currentHub.masterUtxo!, routeFor(hub, hubArtifact)(
        ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any,
      ));
    } else if (kind === 'dataNft') {
      tx.addInput(
        currentHub.dataNftUtxos[0],
        createDataNftUnlocker(hub, layout.participantInputs[0], hubSetup.categoryId),
      );
    } else if (kind === 'trailing' && chunkCursor < chunks.length) {
      const { variable, utxo } = chunks[chunkCursor];
      chunkCursor += 1;
      tx.addInput(utxo, createReadOnlyDynamicChunkUnlocker(
        hub, layout.participantInputs[0], hubSetup.categoryId, variable.name, variable.type,
      ));
    } else {
      tx.addInput(fillers[fillerCursor], p2pkh.unlock.spend(alicePub, signature()));
      fillerCursor += 1;
    }
  }
  tx.addInput(legBSetup.masterUtxo, routeFor(legB, legBArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any,
  ));
  tx.addInput(
    legBSetup.dataNftUtxos[0],
    createDataNftUnlocker(legB, layout.participantInputs[1], legBSetup.categoryId),
  );
  tx.addInput(legCSetup.masterUtxo, routeFor(legC, legCArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 2, layout.controllerInput) as any,
  ));
  tx.addInput(
    legCSetup.dataNftUtxos[0],
    createDataNftUnlocker(legC, layout.participantInputs[2], legCSetup.categoryId),
  );
  tx.addInput(auditSetup.masterUtxo, routeFor(audit, auditArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 3, layout.controllerInput) as any,
    BigInt(layout.returnOutputs![3]!),
  ));
  tx.addInput(
    auditSetup.dataNftUtxos[0],
    createDataNftUnlocker(audit, layout.participantInputs[3], auditSetup.categoryId),
  );
  tx.addInput(auditReturnFunding, p2pkh.unlock.spend(alicePub, signature()));
  projections.forEach((proof, participant) => tx.addInput(
    proof, projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), BigInt(participant)),
  ));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  const currentHubCommitment: string = currentHub.dataNftUtxos[0].token.nft.commitment;
  const zeroFieldHex = binToHex(scriptToBytecode([bigIntToVmNumber(0n)]));
  const hubNext = binToHex(scriptToBytecode([bigIntToVmNumber(CALL_VALUE)]))
    + currentHubCommitment.slice(zeroFieldHex.length);
  const buildCommitment = (artifact: any, values: Record<string, bigint>): string => {
    const layoutFields = artifact.stateLayout!.variables;
    return layoutFields.map((field: any) => binToHex(scriptToBytecode([bigIntToVmNumber(values[field.name])])))
      .join('');
  };
  const legBNext = buildCommitment(legBArtifact, { seen: CALL_VALUE });
  const legCNext = buildCommitment(legCArtifact, { burned: honestScore });
  const auditNext = buildCommitment(auditArtifact, { reviews: 1n });

  let chunkOutCursor = 0;
  for (let offset = 0; offset < hubLayout.blockSize; offset += 1) {
    const kind = hubSlotKind.get(offset);
    if (kind === 'master') {
      tx.addOutput({
        to: hub.tokenAddress, amount: currentHub.masterUtxo!.satoshis,
        token: { category: hubSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });
    } else if (kind === 'dataNft') {
      tx.addOutput({
        to: getDataNftAddress(hub, hubSetup.categoryId), amount: currentHub.dataNftUtxos[0].satoshis,
        token: {
          category: hubSetup.categoryId, amount: 0n, nft: { capability: 'mutable', commitment: hubNext },
        },
      });
    } else if (kind === 'trailing' && chunkOutCursor < chunks.length) {
      const { address, utxo } = chunks[chunkOutCursor];
      chunkOutCursor += 1;
      tx.addOutput({ to: address, amount: utxo.satoshis, token: utxo.token });
    } else {
      tx.addOutput({ to: p2pkh.address, amount: 1000n });
    }
  }
  const settle = (contract: Contract, setup: any, commitment: string): void => {
    tx.addOutput({
      to: contract.tokenAddress, amount: setup.masterUtxo.satoshis,
      token: {
        category: setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' },
      },
    });
    tx.addOutput({
      to: getDataNftAddress(contract, setup.categoryId), amount: setup.dataNftUtxos[0].satoshis,
      token: {
        category: setup.categoryId, amount: 0n, nft: { capability: 'mutable', commitment },
      },
    });
  };
  settle(legB, legBSetup, legBNext);
  settle(legC, legCSetup, legCNext);
  settle(audit, auditSetup, auditNext);
  tx.addOutput({
    to: hexToBin('51'), amount: 1000n,
    token: {
      category: auditSetup.categoryId, amount: 0n,
      nft: { capability: 'none', commitment: binToHex(aggregateResult(honestScore)) },
    },
  });
  for (let slot = 0; slot < projections.length + 1; slot += 1) {
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
  }
  tx.addOutput({ to: p2pkh.address, amount: 30_000n });

  const chunkAddresses: Record<string, string> = {};
  for (const entry of chunks) chunkAddresses[entry.variable.name] = entry.address;
  return {
    builder: tx, hubArtifact, participantInputs: layout.participantInputs, chunkAddresses,
  };
}

/** The locking bytecode of each of the first eight inputs, so a chunk-offset landing can be read directly. */
function sourceOutputsPreview(built: BuiltProbe): string[] {
  return generateLibauthSourceOutputs(built.builder.inputs).slice(0, 8)
    .map((output, index) => `${index} ${binToHex(output.lockingBytecode)}`);
}

describe('X146 diagnosis - the honest C2 cycle at input 0', () => {
  it('reports the failing instruction of the hub route', async () => {
    const built = await buildHonestCycle();
    const sourceOutputs = generateLibauthSourceOutputs(built.builder.inputs);
    const transaction = built.builder.buildLibauthTransaction();
    const vm = createVirtualMachineBch2026ForProvider(built.builder.provider);
    const addressLookup: Record<string, string> = {};
    for (const [name, address] of Object.entries(built.chunkAddresses)) {
      const script = (built.builder.provider as any).addressToLockScript?.(address);
      addressLookup[script ? binToHex(script) : address] = name;
    }
    // eslint-disable-next-line no-console
    console.log('X146-CHUNKS', JSON.stringify({
      chunkAddresses: built.chunkAddresses,
      inputBytecodes: sourceOutputsPreview(built),
    }, null, 1));
    const trace = vm.debug({ inputIndex: 0, sourceOutputs, transaction }) as any[];
    const failure = trace.findIndex((state) => state.error !== undefined);
    const report: Record<string, unknown> = { failedStateIndex: failure };
    if (failure >= 0) {
      const state = trace[failure];
      const previous = trace[failure - 1];
      report.error = state.error;
      report.ip = previous?.ip;
      report.instruction = previous?.instructions?.[previous.ip]
        ? binToHex(new Uint8Array([previous.instructions[previous.ip].opcode]))
        : undefined;
      report.stackTop = (previous?.stack ?? []).slice(-10).map((item: Uint8Array) => binToHex(item));
      report.stackDepth = previous?.stack?.length;
      report.controlStackDepth = previous?.controlStack?.length;
      const toBytes = (instruction: any): Uint8Array => (instruction.data !== undefined
        ? new Uint8Array([instruction.opcode, ...instruction.data])
        : new Uint8Array([instruction.opcode]));
      const instructions = previous?.instructions ?? [];
      report.instructionCount = instructions.length;
      report.executingBytecode = binToHex(
        new Uint8Array(instructions.flatMap((instruction: any) => [...toBytes(instruction)])),
      );
      report.executingAsm = disassembleBytecodeBCH(hexToBin(report.executingBytecode as string));
    }
    // eslint-disable-next-line no-console
    console.log('X146-DIAG', JSON.stringify(report, null, 1));
    expect(failure).toBe(-1);
  }, 300_000);
});
