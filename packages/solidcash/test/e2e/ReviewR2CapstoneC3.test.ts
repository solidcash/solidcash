import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { buildInitialStateCommitments, scriptToBytecode } from '@solidcash/utils';
import { compileString } from 'solidc';
import {
  Contract, MockNetworkProvider, SignatureTemplate, StatefulContract, TransactionBuilder, layer3,
} from '../../src/index.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import {
  createDataNftUnlocker, createReadOnlyDynamicChunkUnlocker, createSatoshiContainerUnlocker,
  getDataNftAddress, getDynamicChunkAddress, getEventNftAddress, getSatoshiContainerAddress,
} from '../../src/stateful/covenant-helpers.js';

/**
 * ROUND-15 INDEPENDENT REVIEW of the C3 SEC-6 RESHAPE and of its ordinary-capacity claim. Reviewer implemented
 * none of it. Sources are byte-copies of the capstone's.
 *
 * Two things are asked that the capstone does not ask itself:
 *   1. The reshape moved an `emit` and a `transfer` onto the Sink, whose route reserves EIGHT slots of each
 *      kind for eight dispatch rows while exactly one row is reached. Are the seven unreached ones bound?
 *   2. The ordinary-capacity claim is re-measured run-to-completion from scratch, with a control that shows the
 *      budget knob actually bites - an aborted evaluation reads the budget back, not the cost.
 */

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const packedResult = (value: bigint): Uint8Array => scriptToBytecode([bigIntToVmNumber(value)]);
const aggregateResult = (value: bigint): Uint8Array => scriptToBytecode([packedResult(value)]);

const CALL_VALUE = 6n;
const SEED_WEIGHT = 7n;
const SCORE = CALL_VALUE + 1n;
const CONTAINER_SATS = 5_000n;
const RECIPIENT = Uint8Array.of(0x51);
const TRANSFER_SATS = 10n;
const ORDINARY_BUDGET_PER_BYTE = 800;

const ROUTER = `pragma solidcash >=0.8.0;
interface IC3Ledger { function record(bigint v); }
interface IC3Broker { function broker(bigint v); }
interface IC3Escrow { function hold(bigint v); }
contract C3Router(address ledger, address broker, address escrow) {
  bigint fired;
  function run(bigint v) public {
    IC3Ledger(ledger).record(v);
    IC3Broker(broker).broker(v);
    IC3Escrow(escrow).hold(v);
    this.fired = this.fired + v;
    require(v > 0);
  }
}`;

const LEDGER = `pragma solidcash >=0.8.0;
contract C3Ledger() {
  bigint seen;
  bigint[] weights;
  function seed(bigint w) public { this.weights.push(w); require(true); }
  function record(bigint v) public {
    require(this.weights.length > 0);
    this.seen = this.seen + v + this.weights[0];
    require(v > 0);
  }
}`;

const BROKER = `pragma solidcash >=0.8.0;
interface IC3Oracle { function score(bigint v) returns (bigint); }
contract C3Broker(address oracle) {
  bigint scored;
  function broker(bigint v) public {
    bigint s = IC3Oracle(oracle).score(v);
    this.scored = this.scored + s;
    require(s >= 0);
  }
}`;

const ESCROW = `pragma solidcash >=0.8.0;
interface IC3Settler { function settle(bigint v); }
contract C3Escrow(address settler) {
  bigint held;
  function hold(bigint v) public {
    IC3Settler(settler).settle(v);
    this.held = this.held + v;
    require(v > 0);
  }
}`;

const ORACLE = `pragma solidcash >=0.8.0;
contract C3Oracle(bigint brand) {
  bigint reviews;
  function score(bigint v) public returns (bigint) {
    this.reviews = this.reviews + 1;
    require(v > 0 && brand >= 0);
    return v + 1;
  }
}`;

const SETTLER = `pragma solidcash >=0.8.0;
interface IC3Reporter { function report(bigint v); }
contract C3Settler(address reporter) {
  bigint settled;
  function settle(bigint v) public {
    IC3Reporter(reporter).report(v);
    this.settled = this.settled + v;
    require(v > 0);
  }
}`;

const REPORTER = `pragma solidcash >=0.8.0;
interface IC3Sink { function absorb(bigint v); }
contract C3Reporter(address sink) {
  bigint reports;
  function report(bigint v) public {
    IC3Sink(sink).absorb(v);
    this.reports = this.reports + 1;
    require(v > 0);
  }
}`;

const SINK = `pragma solidcash >=0.8.0;
contract C3Sink(bigint brand, bytes payee) {
  bigint total;
  event Absorbed(bigint amount);
  function absorb(bigint v) public {
    this.total = this.total + v;
    emit Absorbed(v);
    this.transfer(payee, ${TRANSFER_SATS});
    require(v > 0 && brand >= 0);
  }
}`;

const createOrdinaryCapacityProvider = (): MockNetworkProvider => new MockNetworkProvider({
  consensusLimits: {
    maximumInputBytes: 10_000,
    maximumStackItemBytes: 10_000,
    maximumTransactionBytes: 1_000_000,
    maximumNftCommitmentBytes: 128,
    operationCostBudgetPerByte: ORDINARY_BUDGET_PER_BYTE,
    hashDigestIterationsPerByte: 3,
  },
  policy: { enforceDust: false },
});

const RELAXED_BUDGET_LIMITS = {
  maximumInputBytes: 10_000,
  maximumStackItemBytes: 10_000,
  maximumTransactionBytes: 1_000_000,
  maximumNftCommitmentBytes: 128,
  operationCostBudgetPerByte: 800_000,
  hashDigestIterationsPerByte: 3_000,
};

type Provider = ReturnType<typeof createLayer3SemanticTestProvider>;
const DEFAULT_ORDER = [
  'router', 'ledger', 'broker', 'escrow', 'oracle', 'settler', 'reporter', 'sink',
] as const;
type Label = (typeof DEFAULT_ORDER)[number];

function uniqueUtxo(
  seen: Set<string>, defaults?: Parameters<typeof randomUtxo>[0],
): ReturnType<typeof randomUtxo> {
  for (let attempt = 0; attempt < 5000; attempt += 1) {
    const utxo = randomUtxo(defaults);
    const outpoint = `${utxo.txid}:${utxo.vout}`;
    if (seen.has(outpoint)) continue;
    seen.add(outpoint);
    return utxo;
  }
  throw new Error('could not draw a distinct funding outpoint');
}

interface BuiltC3 {
  provider: Provider;
  builder: TransactionBuilder;
  transaction: string;
  transcript: layer3.FinalizedCompiledGraph;
  plan: layer3.CompiledGraphPlan;
  layout: layer3.CompiledGraphPhysicalLayout;
  blockSizes: readonly number[];
  sinkCategory: string;
  sinkEventAddress: string;
  sink: Contract;
  sinkArtifact: any;
  assembly: { eventOutput: number; transferOutput: number; containerOutput: number };
}

async function buildC3(
  createProvider: () => Provider = createLayer3SemanticTestProvider,
): Promise<BuiltC3> {
  const provider = createProvider();
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

  const sinkArtifact = compileString(SINK, options);
  const sinkBase = new Contract(sinkArtifact, [1n, RECIPIENT], { provider });
  const sinkSetup = await setupStatefulUtxos(provider, sinkBase, sinkArtifact.stateLayout!, { total: 0n });
  const sink = sinkBase.withCategory(hexToBin(sinkSetup.categoryId));

  const reporterArtifact = compileString(REPORTER, options);
  const reporterBase = new Contract(reporterArtifact, [sink.lockingBytecode], { provider });
  const reporterSetup = await setupStatefulUtxos(
    provider, reporterBase, reporterArtifact.stateLayout!, { reports: 0n },
  );
  const reporter = reporterBase.withCategory(hexToBin(reporterSetup.categoryId));

  const settlerArtifact = compileString(SETTLER, options);
  const settlerBase = new Contract(settlerArtifact, [reporter.lockingBytecode], { provider });
  const settlerSetup = await setupStatefulUtxos(
    provider, settlerBase, settlerArtifact.stateLayout!, { settled: 0n },
  );
  const settler = settlerBase.withCategory(hexToBin(settlerSetup.categoryId));

  const escrowArtifact = compileString(ESCROW, options);
  const escrowBase = new Contract(escrowArtifact, [settler.lockingBytecode], { provider });
  const escrowSetup = await setupStatefulUtxos(provider, escrowBase, escrowArtifact.stateLayout!, { held: 0n });
  const escrow = escrowBase.withCategory(hexToBin(escrowSetup.categoryId));

  const oracleArtifact = compileString(ORACLE, options);
  const oracleBase = new Contract(oracleArtifact, [9n], { provider });
  const oracleSetup = await setupStatefulUtxos(
    provider, oracleBase, oracleArtifact.stateLayout!, { reviews: 0n },
  );
  const oracle = oracleBase.withCategory(hexToBin(oracleSetup.categoryId));

  const brokerArtifact = compileString(BROKER, options);
  const brokerBase = new Contract(brokerArtifact, [oracle.lockingBytecode], { provider });
  const brokerSetup = await setupStatefulUtxos(
    provider, brokerBase, brokerArtifact.stateLayout!, { scored: 0n },
  );
  const broker = brokerBase.withCategory(hexToBin(brokerSetup.categoryId));

  const ledgerArtifact = compileString(LEDGER, options);
  const ledgerBase = new Contract(ledgerArtifact, [], { provider });
  const ledgerSetup = await setupStatefulUtxos(
    provider, ledgerBase, ledgerArtifact.stateLayout!, { seen: 0n, weights: [] },
  );
  const ledger = ledgerBase.withCategory(hexToBin(ledgerSetup.categoryId));

  const routerArtifact = compileString(ROUTER, options);
  const routerBase = new Contract(
    routerArtifact, [ledger.lockingBytecode, broker.lockingBytecode, escrow.lockingBytecode], { provider },
  );
  const routerSetup = await setupStatefulUtxos(
    provider, routerBase, routerArtifact.stateLayout!, { fired: 0n },
  );
  const router = routerBase.withCategory(hexToBin(routerSetup.categoryId));

  const ledgerStateful = StatefulContract.withCategory(ledgerBase, ledgerSetup.categoryId);
  await (ledgerStateful as any).seed(SEED_WEIGHT).send();
  const currentLedger = await (ledgerStateful as any).getFullState();

  const rows: Record<Label, { artifact: any; contract: Contract; setup: any; master: any; data: any }> = {
    router: {
      artifact: routerArtifact, contract: router, setup: routerSetup,
      master: routerSetup.masterUtxo, data: routerSetup.dataNftUtxos[0],
    },
    ledger: {
      artifact: ledgerArtifact, contract: ledger, setup: ledgerSetup,
      master: currentLedger.masterUtxo, data: currentLedger.dataNftUtxos[0],
    },
    broker: {
      artifact: brokerArtifact, contract: broker, setup: brokerSetup,
      master: brokerSetup.masterUtxo, data: brokerSetup.dataNftUtxos[0],
    },
    escrow: {
      artifact: escrowArtifact, contract: escrow, setup: escrowSetup,
      master: escrowSetup.masterUtxo, data: escrowSetup.dataNftUtxos[0],
    },
    oracle: {
      artifact: oracleArtifact, contract: oracle, setup: oracleSetup,
      master: oracleSetup.masterUtxo, data: oracleSetup.dataNftUtxos[0],
    },
    settler: {
      artifact: settlerArtifact, contract: settler, setup: settlerSetup,
      master: settlerSetup.masterUtxo, data: settlerSetup.dataNftUtxos[0],
    },
    reporter: {
      artifact: reporterArtifact, contract: reporter, setup: reporterSetup,
      master: reporterSetup.masterUtxo, data: reporterSetup.dataNftUtxos[0],
    },
    sink: {
      artifact: sinkArtifact, contract: sink, setup: sinkSetup,
      master: sinkSetup.masterUtxo, data: sinkSetup.dataNftUtxos[0],
    },
  };
  const order = DEFAULT_ORDER;
  const at = new Map<Label, number>(order.map((label, index) => [label, index]));

  const edges: { parent: number | null; callee: Label; function: string; args: any[] }[] = [
    { parent: null, callee: 'router', function: 'run', args: [CALL_VALUE] },
    { parent: 0, callee: 'ledger', function: 'record', args: [CALL_VALUE] },
    { parent: 0, callee: 'broker', function: 'broker', args: [CALL_VALUE] },
    { parent: 2, callee: 'oracle', function: 'score', args: [CALL_VALUE] },
    { parent: 0, callee: 'escrow', function: 'hold', args: [CALL_VALUE] },
    { parent: 4, callee: 'settler', function: 'settle', args: [CALL_VALUE] },
    { parent: 5, callee: 'reporter', function: 'report', args: [CALL_VALUE] },
    { parent: 6, callee: 'sink', function: 'absorb', args: [CALL_VALUE] },
  ];
  const plan = layer3.planCompiledGraph(
    order.map((label) => ({
      artifact: rows[label].artifact, lockingBytecode: rows[label].contract.lockingBytecode,
    })),
    edges.map((edge) => ({
      parent: edge.parent, callee: at.get(edge.callee)!, function: edge.function, args: edge.args,
    })),
  );
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const blockSizes = plan.participants.map((participant) => participant.blockLayout!.blockSize);
  const base = (label: Label): number => layout.participantInputs[at.get(label)!];

  const transcript = layer3.finalizeCompiledGraph(
    plan,
    { 3: binToHex(packedResult(SCORE)) },
    layout.participantInputs,
    layout.returnOutputs,
    plan.participants.map((participant) =>
      (participant.batch.results.length > 0 ? binToHex(packedResult(SCORE)) : '')),
    layout.projectionInputs,
  );

  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootingFee = uniqueUtxo(outpoints, { satoshis: 20_000n });
  await provider.addUtxo(p2pkh.address, rootingFee);
  const rootingTx = new TransactionBuilder({ provider });
  rootingTx.addInput(
    genesis.utxos[0], controller.unlock.initialize(hexToBin(transcript.root), alicePub, signature()),
  );
  rootingTx.addInput(rootingFee, p2pkh.unlock.spend(alicePub, signature()));
  rootingTx.addOutput({
    to: controller.tokenAddress,
    amount: genesis.utxos[0].satoshis,
    token: {
      category: controllerCategory, amount: 0n,
      nft: { capability: 'mutable', commitment: transcript.root },
    },
  });
  rootingTx.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(rootingTx));
  const rootedController = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === transcript.root);
  if (!rootedController) throw new Error('C3 review harness did not root its graph controller');

  const ledgerLayout = ledgerArtifact.hiddenBatch!.route.blockLayout!;
  const chunks: { variable: any; utxo: any; address: string }[] = [];
  for (const variable of ledgerArtifact.stateLayout!.variables.filter((entry: any) => entry.dynamic)) {
    const address = getDynamicChunkAddress(ledger, ledgerSetup.categoryId, variable.name, variable.type);
    for (const utxo of await provider.getUtxos(address)) chunks.push({ variable, utxo, address });
  }

  const container = uniqueUtxo(outpoints, { satoshis: CONTAINER_SATS });
  await provider.addUtxo(getSatoshiContainerAddress(sink, sinkSetup.categoryId), container);
  const sinkBlockSize = sinkArtifact.hiddenBatch!.route.blockLayout!.blockSize as number;
  const sinkFunding = Array.from({ length: sinkBlockSize - 3 }, () => uniqueUtxo(outpoints, { satoshis: 1000n }));
  const ledgerFunding = Array.from(
    { length: ledgerLayout.blockSize - 2 - chunks.length }, () => uniqueUtxo(outpoints, { satoshis: 1000n }),
  );
  const returnFunding = uniqueUtxo(outpoints, { satoshis: 1000n });
  const projectionUtxos = Array.from({ length: 8 }, () => uniqueUtxo(outpoints, { satoshis: 1000n }));
  const fee = uniqueUtxo(outpoints, { satoshis: 3_000_000n });
  for (const utxo of [...sinkFunding, ...ledgerFunding, returnFunding, fee]) {
    await provider.addUtxo(p2pkh.address, utxo);
  }
  for (const proof of projectionUtxos) await provider.addUtxo(projection.address, proof);

  const routeFor = (contract: Contract, artifact: any): any => contract.createCompilerRouteUnlocker(
    artifact.hiddenBatch.route, hexToBin(artifact.hiddenBatch.selector),
  );
  const routeArgs = (participant: number): any[] =>
    [...layer3.compiledGraphRouteArgs(transcript, participant, layout.controllerInput)] as any[];

  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  const funding = (utxo: any): void => { tx.addInput(utxo, p2pkh.unlock.spend(alicePub, signature())); };
  const openBlock = (label: Label): void => {
    const row = rows[label];
    const index = at.get(label)!;
    tx.addInput(row.master, routeFor(row.contract, row.artifact)(
      ...routeArgs(index),
      ...(layout.returnOutputs![index] === null ? [] : [BigInt(layout.returnOutputs![index]!)]),
    ));
    tx.addInput(row.data, createDataNftUnlocker(row.contract, base(label), row.setup.categoryId));
  };
  const inputBlock: Record<Label, () => void> = {
    router: () => openBlock('router'),
    ledger: () => {
      openBlock('ledger');
      chunks.forEach(({ variable, utxo }) => {
        tx.addInput(utxo, createReadOnlyDynamicChunkUnlocker(
          ledger, base('ledger'), ledgerSetup.categoryId, variable.name, variable.type,
        ));
      });
      ledgerFunding.forEach(funding);
    },
    broker: () => openBlock('broker'),
    escrow: () => openBlock('escrow'),
    oracle: () => { openBlock('oracle'); funding(returnFunding); },
    settler: () => openBlock('settler'),
    reporter: () => openBlock('reporter'),
    sink: () => {
      openBlock('sink');
      tx.addInput(container, createSatoshiContainerUnlocker(sink, base('sink'), sinkSetup.categoryId));
      sinkFunding.forEach(funding);
    },
  };
  for (const label of order) inputBlock[label]();
  projectionUtxos.forEach((proof, participant) => tx.addInput(proof, projection.unlock.verify(
    transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
  )));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  funding(fee);

  const eventCommitment = binToHex(scriptToBytecode([bigIntToVmNumber(CALL_VALUE)]));
  const returnCommitment = binToHex(aggregateResult(SCORE));
  let eventOutput = -1;
  let containerOutput = -1;
  let transferOutput = -1;
  const settleBlock = (label: Label, field: string, value: bigint, override?: string): void => {
    const row = rows[label];
    const commitment = override
      ?? buildInitialStateCommitments(row.artifact.stateLayout!, { [field]: value })[0];
    tx.addOutput({
      to: row.contract.tokenAddress,
      amount: row.master.satoshis,
      token: { category: row.setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
    tx.addOutput({
      to: getDataNftAddress(row.contract, row.setup.categoryId),
      amount: row.data.satoshis,
      token: { category: row.setup.categoryId, amount: 0n, nft: { capability: 'mutable', commitment } },
    });
  };
  const currentLedgerCommitment: string = currentLedger.dataNftUtxos[0].token.nft.commitment;
  const zeroField = binToHex(scriptToBytecode([bigIntToVmNumber(0n)]));
  const ledgerNext = binToHex(scriptToBytecode([bigIntToVmNumber(CALL_VALUE + SEED_WEIGHT)]))
    + currentLedgerCommitment.slice(zeroField.length);
  const outputBlock: Record<Label, () => void> = {
    router: () => settleBlock('router', 'fired', CALL_VALUE),
    ledger: () => {
      settleBlock('ledger', 'seen', CALL_VALUE + SEED_WEIGHT, ledgerNext);
      for (const chunk of chunks) {
        tx.addOutput({ to: chunk.address, amount: chunk.utxo.satoshis, token: chunk.utxo.token });
      }
      ledgerFunding.forEach(() => tx.addOutput({ to: p2pkh.address, amount: 1000n }));
    },
    broker: () => settleBlock('broker', 'scored', SCORE),
    escrow: () => settleBlock('escrow', 'held', CALL_VALUE),
    oracle: () => {
      settleBlock('oracle', 'reviews', 1n);
      tx.addOutput({
        to: hexToBin('51'),
        amount: 1000n,
        token: {
          category: oracleSetup.categoryId, amount: 0n,
          nft: { capability: 'none', commitment: returnCommitment },
        },
      });
    },
    settler: () => settleBlock('settler', 'settled', CALL_VALUE),
    reporter: () => settleBlock('reporter', 'reports', 1n),
    sink: () => {
      settleBlock('sink', 'total', CALL_VALUE);
      containerOutput = tx.outputs.length;
      tx.addOutput({
        to: getSatoshiContainerAddress(sink, sinkSetup.categoryId),
        amount: CONTAINER_SATS - TRANSFER_SATS,
      });
      transferOutput = tx.outputs.length;
      tx.addOutput({ to: RECIPIENT, amount: TRANSFER_SATS });
      for (let slot = 1; slot < 8; slot += 1) tx.addOutput({ to: p2pkh.address, amount: 1000n });
      eventOutput = tx.outputs.length;
      tx.addOutput({
        to: getEventNftAddress(sink, sinkSetup.categoryId, sinkArtifact.events![0].signature),
        amount: 1000n,
        token: {
          category: sinkSetup.categoryId, amount: 0n,
          nft: { capability: 'none', commitment: eventCommitment },
        },
      });
      for (let slot = 1; slot < 8; slot += 1) tx.addOutput({ to: p2pkh.address, amount: 1000n });
    },
  };
  for (const label of order) outputBlock[label]();
  projectionUtxos.forEach(() => tx.addOutput({ to: p2pkh.address, amount: 1000n }));
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });

  return {
    provider,
    builder: tx,
    transaction: raw(tx),
    transcript,
    plan,
    layout,
    blockSizes,
    sinkCategory: sinkSetup.categoryId,
    sinkEventAddress: getEventNftAddress(sink, sinkSetup.categoryId, sinkArtifact.events![0].signature),
    sink,
    sinkArtifact,
    assembly: { eventOutput, transferOutput, containerOutput },
  };
}

const preflightOutcome = (built: BuiltC3): string => {
  try {
    layer3.preflightLayer3Transaction(built.builder);
    return 'ACCEPTED';
  } catch (error) {
    return (error as Error).message;
  }
};

describe('R2 review: C3 reshape and ordinary-capacity claim', () => {
  /**
   * The reshape's own new surface, exactly as for C1's Notifier: the Sink's route reserves eight event slots
   * for eight dispatch rows and one is reached. Mutating ONE output of ONE honest build.
   */
  it('R2-C3-A: a forged event NFT at the Sink\'s UNREACHED reserved event slots', async () => {
    const built = await buildC3();
    expect(built.layout.totalSlots).toBe(108);
    expect(built.blockSizes).toEqual([2, 66, 2, 2, 3, 2, 2, 19]);
    expect(preflightOutcome(built)).toBe('ACCEPTED');
    const snapshot = built.builder.outputs.map((output) => ({ ...output }));
    const results: Record<number, string> = {};
    for (const slot of [1, 4, 7]) {
      const output = built.assembly.eventOutput + slot;
      expect(built.builder.outputs[output].token).toBeUndefined();
      built.builder.outputs[output] = {
        to: built.sinkEventAddress,
        amount: 1000n,
        token: {
          category: built.sinkCategory,
          amount: 0n,
          nft: { capability: 'none', commitment: binToHex(scriptToBytecode([bigIntToVmNumber(999n)])) },
        },
      } as never;
      results[output] = preflightOutcome(built).slice(0, 120);
      snapshot.forEach((out, index) => { built.builder.outputs[index] = { ...out } as never; });
    }
    console.log('R2-C3-A forged event NFT at unreached sink slots:', JSON.stringify(results, null, 1));
    // The restored build is the control again.
    expect(preflightOutcome(built)).toBe('ACCEPTED');
    for (const [output, outcome] of Object.entries(results)) {
      expect(outcome, `forged event NFT at output ${output}`).not.toBe('ACCEPTED');
    }
  }, 900_000);

  /**
   * The other effect the reshape moved onto the Sink. Seven reserved transfer slots are unreached; this asks
   * whether the Sink's satoshi container can be drained through one of them. Satoshi-neutral, so only the
   * container's own value covenant can object.
   */
  it('R2-C3-A2: draining the Sink\'s satoshi container through an unreached transfer slot', async () => {
    const built = await buildC3();
    expect(preflightOutcome(built)).toBe('ACCEPTED');
    const snapshot = built.builder.outputs.map((output) => ({ ...output }));
    const spare = built.assembly.transferOutput + 1;
    expect(built.builder.outputs[built.assembly.containerOutput].amount)
      .toBe(CONTAINER_SATS - TRANSFER_SATS);
    built.builder.outputs[built.assembly.containerOutput] = {
      ...built.builder.outputs[built.assembly.containerOutput],
      amount: CONTAINER_SATS - TRANSFER_SATS - 1000n,
    } as never;
    built.builder.outputs[spare] = { to: RECIPIENT, amount: 2000n } as never;
    const outcome = preflightOutcome(built);
    console.log(`R2-C3-A2 container drain via slot ${spare}: ${outcome.slice(0, 160)}`);
    expect(outcome, 'the Sink satoshi container is drained through an unreached transfer slot')
      .not.toBe('ACCEPTED');

    // Same build, second question: the Sink's MINTING master is co-spent, so any spender can mint
    // own-category NFTs. A forged own-category MUTABLE NFT parked at the data-NFT address in an unreached
    // reserved slot would be readable as this contract's state.
    snapshot.forEach((out, index) => { built.builder.outputs[index] = { ...out } as never; });
    expect(preflightOutcome(built)).toBe('ACCEPTED');
    const forgedAt = built.assembly.eventOutput + 3;
    built.builder.outputs[forgedAt] = {
      to: getDataNftAddress(built.sink, built.sinkCategory),
      amount: 1000n,
      token: {
        category: built.sinkCategory,
        amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: buildInitialStateCommitments(built.sinkArtifact.stateLayout!, { total: 999_999n })[0],
        },
      },
    } as never;
    const forgedOutcome = preflightOutcome(built);
    console.log(`R2-C3-A3 forged mutable data NFT at unreached slot ${forgedAt}: ${forgedOutcome.slice(0, 160)}`);
    expect(forgedOutcome, `a forged mutable data NFT settles at output ${forgedAt}`).not.toBe('ACCEPTED');
  }, 900_000);

  /**
   * INDEPENDENT capacity verification, from a build this file made. Two gates, then every one of the 108
   * inputs measured RUN TO COMPLETION on a relaxed density ceiling with every other consensus knob ordinary.
   */
  it('R2-C3-B: the ordinary-capacity claim, re-measured run-to-completion', async () => {
    const built = await buildC3(createOrdinaryCapacityProvider);
    expect(preflightOutcome(built)).toBe('ACCEPTED');
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');

    const transaction = built.builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(built.builder.inputs as never);
    const relaxed = createVirtualMachineBch2026ForProvider(
      { consensusLimits: RELAXED_BUDGET_LIMITS } as never,
    );
    const costs = transaction.inputs.map((_input, input) => {
      const state = relaxed.evaluate({ inputIndex: input, sourceOutputs, transaction }) as any;
      if (state.error !== undefined) {
        throw new Error(`relaxed-budget evaluation still failed at input ${input}: ${state.error}`);
      }
      return {
        input,
        bytes: state.metrics.densityControlLength,
        cost: state.metrics.operationCost,
        ratio: state.metrics.operationCost / (state.metrics.densityControlLength * ORDINARY_BUDGET_PER_BYTE),
        instructions: state.metrics.evaluatedInstructionCount,
      };
    });
    const interesting = [
      ...built.layout.participantInputs, ...built.layout.projectionInputs, built.layout.controllerInput,
    ];
    console.log('R2-C3-B measured ratios:', JSON.stringify(
      costs.filter((row) => interesting.includes(row.input))
        .map((row) => `${row.input}:${row.bytes}b:${row.cost}:${row.ratio.toFixed(4)}`),
    ));
    const worst = costs.reduce((left, right) => (right.ratio > left.ratio ? right : left));
    console.log(`R2-C3-B worst input ${worst.input} at ${worst.ratio.toFixed(4)}x`);
    // SCOPE of "ordinary capacity", measured rather than asserted: this is a CONSENSUS-knob result. The
    // serialized size is recorded here because the standard relay ceiling is 100,000 bytes and this profile
    // deliberately sets `maximumTransactionBytes` to the 1,000,000 consensus figure.
    console.log(`R2-C3-B serialized transaction size: ${built.transaction.length / 2} bytes`);
    expect(costs.filter((row) => row.ratio > 1).map((row) => row.input)).toEqual([]);
    expect(worst.input).toBe(built.layout.controllerInput);

    // THE KNOB CONTROL. "ACCEPTED under ordinary capacity" is only evidence if the budget knob can refuse.
    // Same bytes, same source outputs, budget divided by four: the controller must now fail.
    const tightened = createVirtualMachineBch2026ForProvider({
      consensusLimits: { ...RELAXED_BUDGET_LIMITS, operationCostBudgetPerByte: 200 },
    } as never);
    const tightState = tightened.evaluate({
      inputIndex: built.layout.controllerInput, sourceOutputs, transaction,
    }) as any;
    expect(tightState.error, 'the operation-cost knob does not bite at 200/byte').toBeDefined();
    expect(String(tightState.error)).toMatch(/density|operation cost/i);
  }, 900_000);

  /**
   * SCOPE. C3 saturates the PARTICIPANT bound only. This restates what it exercises and measures which of the
   * three deployed ceilings each covenant text actually carries, since C3's own test asserts the participant
   * and invocation strings but never the depth one.
   */
  it('R2-C3-C: C3 exercises the participant ceiling only, and all three are written in both covenants', () => {
    const controller = layer3.generateGraphRootController('51');
    const projection = layer3.generateGraphProjectionVerifier();
    for (const source of [controller, projection]) {
      expect(source).toContain('participantCount <= 8');
      expect(source).toContain('invocationCount <= 24');
      expect(source).toMatch(/depth <= 7/);
    }
  });
});
