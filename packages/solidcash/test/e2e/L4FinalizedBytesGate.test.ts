import { describe, expect, it } from 'vitest';
import {
  binToHex, encodeTransaction, hexToBin,
  type Input, type Output, type Transaction,
} from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate, TransactionBuilder, layer3,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider, dustOutputs } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

/**
 * L4 - THE FINALIZED-BYTES GATE, AND THE DEMONSTRATION THAT EVERY RULE CAN FAIL.
 *
 * R1 measured that a plan-time envelope screen cannot be the gate: nothing in the corpus reaches its REFUSE
 * threshold (141,562 bytes against a largest prediction of 112,955), and a per-input VM evaluation is
 * STRUCTURALLY BLIND to transaction size, dust and output shape, because those are properties of the finalized
 * transaction rather than of any one input's script. `assertFinalizedTransactionBytes` is the gate that
 * conclusion asks for, and this file is its hostile evidence.
 *
 * TWO REAL MISSES ARE THE SUBJECT. C3 serialized to 100,354 bytes against a 100,000-byte relay ceiling and
 * every in-repo check passed it - a human noticed the number. C1 was refused `64: dust` on a real BCHN node for
 * a 10-satoshi placeholder against a 474-satoshi threshold, invisible to every harness because
 * `MockNetworkProvider` defaults `enforceDust` to false.
 *
 * WHAT IS AND IS NOT NEW HERE, stated so the dust rule is not oversold. `dustOutputs` in
 * `layer3-semantic-profile.ts` already computes BCHN's dust arithmetic from the serialized bytes, and the
 * capstones already assert it is empty - which is why they stay green under this gate. That is a check each
 * fixture author must remember to write. This is the same arithmetic moved onto the send path, where no author
 * can forget it, plus six further byte rules that had no check anywhere. This test asserts the two agree.
 *
 * WHAT THIS GATE IS NOT. Layer-3 derivation is an untrusted witness construction and every accepted shape is
 * justified by covenants and consensus, never by this gate. It refuses bytes no peer would forward; it makes
 * nothing newly buildable, and suppressing it cannot make an invalid transaction valid.
 *
 * THE STRUCTURE OF THE EVIDENCE. Part A decides the boundary of every rule to the byte on synthetic
 * transactions, because a boundary is the one thing a real composition cannot demonstrate: you need the shape
 * at exactly the limit and the same shape one byte over. Part B proves the WIRING on a real two-participant
 * Layer-3 composition that settles, using the one control that is decisive - the mock network ACCEPTS the
 * attacked bytes, so the covenants are satisfied and the gate is the only thing objecting. That is the C1
 * situation reproduced in-repo.
 */

/* ------------------------------------------------------------------------------------------------------ */
/* Part A: byte-exact discriminating pairs                                                                  */
/* ------------------------------------------------------------------------------------------------------ */

const OUTPOINT = new Uint8Array(32).fill(0x11);

const inputOf = (unlockingBytecode: Uint8Array): Input => ({
  outpointIndex: 0, outpointTransactionHash: OUTPOINT, sequenceNumber: 0xffffffff, unlockingBytecode,
});

const outputOf = (lockingBytecode: Uint8Array, valueSatoshis: bigint): Output =>
  ({ lockingBytecode, valueSatoshis });

const transactionOf = (inputs: Input[], outputs: Output[]): Transaction =>
  ({ version: 2, locktime: 0, inputs, outputs });

/** `n` repetitions of OP_1. Every byte is a push, so this pads a length without touching push-only. */
const pushOnlyPadding = (bytes: number): Uint8Array => new Uint8Array(bytes).fill(0x51);

/** A 25-byte P2PKH locking script: 34 serialized bytes, so a 546-satoshi dust floor. */
const p2pkhLock = (): Uint8Array =>
  Uint8Array.from([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x22), 0x88, 0xac]);

/** A bare `OP_1` locking script: 10 serialized bytes, so a 474-satoshi dust floor. C1's placeholder. */
const bareOneLock = (): Uint8Array => hexToBin('51');

/** An OP_RETURN locking script of exactly `bytes` total length. */
const opReturnLock = (bytes: number): Uint8Array => {
  const script = new Uint8Array(bytes);
  script[0] = 0x6a;
  return script;
};

/**
 * A transaction of EXACTLY `targetBytes` serialized bytes, built so that nothing but the size rules is in
 * play: every input's unlocking bytecode is push-only and stays under the 10,000-byte per-input ceiling, and
 * the single output is a 1,000-satoshi P2PKH well clear of its 546-satoshi dust floor.
 *
 * The tail input's padding is held above 253 bytes so its script-length varint is a fixed 3 bytes; otherwise
 * the adjustment step would chase a varint that moves underneath it.
 */
const sizedTransaction = (targetBytes: number): Transaction => {
  const perInput = 9_000;
  const outputs = [outputOf(p2pkhLock(), 1_000n)];
  const make = (full: number, tail: number): Transaction => transactionOf(
    [
      ...Array.from({ length: full }, () => inputOf(pushOnlyPadding(perInput))),
      inputOf(pushOnlyPadding(tail)),
    ],
    outputs,
  );
  let full = 0;
  while (encodeTransaction(make(full, 300)).length < targetBytes) full += 1;
  full = Math.max(0, full - 1);
  let tail = 300;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const size = encodeTransaction(make(full, tail)).length;
    if (size === targetBytes) return make(full, tail);
    tail += targetBytes - size;
    if (tail < 254 || tail > 9_999) break;
  }
  throw new Error(`sizedTransaction could not reach exactly ${targetBytes} bytes`);
};

const refusedRules = (transaction: Transaction): string[] =>
  layer3.assessFinalizedTransactionBytes(transaction).refusals.map((row) => row.rule).sort();

/** Every rule id a Part A pair demonstrates refusing. Compared against the published rule set below. */
const DEMONSTRATED: Set<string> = new Set();

const expectRefuses = (transaction: Transaction, rule: string): layer3.FinalizedByteRefusal => {
  const verdict = layer3.assessFinalizedTransactionBytes(transaction);
  expect(verdict.admitted, `expected a refusal on ${rule}`).toBe(false);
  expect(verdict.refusals.map((row) => row.rule).sort()).toEqual([rule]);
  DEMONSTRATED.add(rule);
  return verdict.refusals[0];
};

const expectAdmits = (transaction: Transaction): void => {
  const verdict = layer3.assessFinalizedTransactionBytes(transaction);
  expect(verdict.refusals, layer3.formatFinalizedByteVerdict(verdict)).toEqual([]);
  expect(verdict.admitted).toBe(true);
};

describe('L4 finalized-bytes gate: every rule, at its boundary, in both directions', () => {
  it('relay-transaction-size (POLICY) admits exactly 100,000 bytes and refuses 100,001', () => {
    const atLimit = sizedTransaction(100_000);
    const overBy1 = sizedTransaction(100_001);
    // The pair differs in ONE byte of one input's push-only padding and in nothing else.
    expect(encodeTransaction(atLimit).length).toBe(100_000);
    expect(encodeTransaction(overBy1).length).toBe(100_001);
    expect(atLimit.inputs.length).toBe(overBy1.inputs.length);
    expect(overBy1.inputs[overBy1.inputs.length - 1].unlockingBytecode.length)
      .toBe(atLimit.inputs[atLimit.inputs.length - 1].unlockingBytecode.length + 1);

    expectAdmits(atLimit);
    const refusal = expectRefuses(overBy1, 'relay-transaction-size');
    expect(refusal.regime).toBe('policy');
    expect(refusal.measured).toBe(100_001);
    expect(refusal.allowed).toBe(100_000);
    expect(refusal.overBy).toBe(1);
    // The arithmetic is quoted, and the message says it is policy rather than invalidity.
    expect(() => layer3.assertFinalizedTransactionBytes(overBy1)).toThrow(
      /100001 serialized bytes is 1 over the 100000-byte standard relay ceiling/,
    );
    expect(() => layer3.assertFinalizedTransactionBytes(overBy1)).toThrow(/a miner may still include them/);
    // POLICY, so an explicit caller opt-out admits it. This is the mineable-but-unrelayable case.
    expect(layer3.assertFinalizedTransactionBytes(overBy1, { allowNonRelayable: true }).serializedBytes)
      .toBe(100_001);
  });

  it('consensus-transaction-size (CONSENSUS) admits exactly 1,000,000 bytes and refuses 1,000,001', () => {
    const atLimit = sizedTransaction(1_000_000);
    const overBy1 = sizedTransaction(1_000_001);
    expect(encodeTransaction(atLimit).length).toBe(1_000_000);
    expect(encodeTransaction(overBy1).length).toBe(1_000_001);

    // Both break the relay ceiling; only the second breaks consensus. The difference is exactly one rule.
    expect(refusedRules(atLimit)).toEqual(['relay-transaction-size']);
    expect(refusedRules(overBy1)).toEqual(['consensus-transaction-size', 'relay-transaction-size']);
    DEMONSTRATED.add('consensus-transaction-size');
    const consensus = layer3.assessFinalizedTransactionBytes(overBy1).refusals
      .find((row) => row.rule === 'consensus-transaction-size')!;
    expect(consensus.regime).toBe('consensus');
    expect(consensus.overBy).toBe(1);
    expect(() => layer3.assertFinalizedTransactionBytes(overBy1)).toThrow(
      /1000001 serialized bytes is 1 over the 1000000-byte consensus ceiling/,
    );
    expect(() => layer3.assertFinalizedTransactionBytes(overBy1)).toThrow(/invalid however they are transported/);

    // THE SEVERITY SPLIT, on a pair one byte apart: the opt-out admits the policy-only side and cannot touch
    // the consensus side. A gate that collapsed the two regimes could not produce these two answers.
    expect(layer3.assertFinalizedTransactionBytes(atLimit, { allowNonRelayable: true }).serializedBytes)
      .toBe(1_000_000);
    expect(() => layer3.assertFinalizedTransactionBytes(overBy1, { allowNonRelayable: true }))
      .toThrow(/refused by 1 byte rule\(s\)[\s\S]*\[consensus\] consensus-transaction-size/);
    // The suppressed policy refusal is still reported rather than silently dropped.
    expect(() => layer3.assertFinalizedTransactionBytes(overBy1, { allowNonRelayable: true }))
      .toThrow(/policy refusal\(s\) suppressed by allowNonRelayable: relay-transaction-size/);
  });

  it('output-dust (POLICY) admits 546 satoshis on a P2PKH output and refuses 545', () => {
    const admitted = transactionOf([inputOf(pushOnlyPadding(4))], [outputOf(p2pkhLock(), 546n)]);
    const refused = transactionOf([inputOf(pushOnlyPadding(4))], [outputOf(p2pkhLock(), 545n)]);
    expectAdmits(admitted);
    const refusal = expectRefuses(refused, 'output-dust');
    expect(refusal.regime).toBe('policy');
    // 34 serialized bytes: 8 value + 1 length varint + 25 script. 3 * (34 + 148) = 546.
    expect(refusal.measured).toBe(546);
    expect(refusal.allowed).toBe(545);
    expect(() => layer3.assertFinalizedTransactionBytes(refused)).toThrow(
      /545 satoshis is 1 short of the 546-satoshi dust threshold for a 34-byte output \(3 \* \(34 \+ 148\)\)/,
    );
    expect(() => layer3.assertFinalizedTransactionBytes(refused)).toThrow(/64: dust/);
  });

  it('output-dust refuses C1\'s exact measured case: 10 satoshis against a 474-satoshi threshold', () => {
    const refused = transactionOf([inputOf(pushOnlyPadding(4))], [outputOf(bareOneLock(), 10n)]);
    const admitted = transactionOf([inputOf(pushOnlyPadding(4))], [outputOf(bareOneLock(), 474n)]);
    const boundary = transactionOf([inputOf(pushOnlyPadding(4))], [outputOf(bareOneLock(), 473n)]);
    expectAdmits(admitted);
    const refusal = expectRefuses(refused, 'output-dust');
    expect(refusal.measured).toBe(474);
    expect(refusal.overBy).toBe(464);
    expect(refusedRules(boundary)).toEqual(['output-dust']);
    // The SDK's own dust helper, and the standing `dustOutputs` check the capstones assert, agree to the
    // satoshi. Three independent spellings of BCHN's rule, one number.
    expect(layer3.finalizedOutputDustThreshold(refused.outputs[0])).toBe(474);
    expect(dustOutputs(refused).map((row) => Number(row.threshold))).toEqual([474]);
    expect(dustOutputs(admitted)).toEqual([]);
  });

  it('output-dust exempts OP_RETURN, and the exemption turns on exactly one byte', () => {
    // Same 10 serialized bytes, same zero value; only the first script byte differs.
    const nullData = transactionOf([inputOf(pushOnlyPadding(4))], [outputOf(hexToBin('6a'), 0n)]);
    const notNullData = transactionOf([inputOf(pushOnlyPadding(4))], [outputOf(hexToBin('51'), 0n)]);
    expectAdmits(nullData);
    const refusal = expectRefuses(notNullData, 'output-dust');
    expect(refusal.measured).toBe(474);
    expect(refusal.allowed).toBe(0);
  });

  it('relay-locking-bytes (POLICY) admits a 201-byte locking script and refuses 202', () => {
    // Funded at 2,000 satoshis, above both sides' dust floors (1,074 and 1,077), so dust is not the difference.
    const admitted = transactionOf([inputOf(pushOnlyPadding(4))], [outputOf(pushOnlyPadding(201), 2_000n)]);
    const refused = transactionOf([inputOf(pushOnlyPadding(4))], [outputOf(pushOnlyPadding(202), 2_000n)]);
    expectAdmits(admitted);
    const refusal = expectRefuses(refused, 'relay-locking-bytes');
    expect(refusal.regime).toBe('policy');
    expect(refusal.measured).toBe(202);
    expect(refusal.allowed).toBe(201);
    expect(() => layer3.assertFinalizedTransactionBytes(refused)).toThrow(
      /202 locking bytecode bytes is 1 over the 201-byte standard allowance/,
    );
  });

  it('relay-data-carrier (POLICY) admits 223 bytes of OP_RETURN and refuses 224', () => {
    const admitted = transactionOf([inputOf(pushOnlyPadding(4))], [outputOf(opReturnLock(223), 0n)]);
    const refused = transactionOf([inputOf(pushOnlyPadding(4))], [outputOf(opReturnLock(224), 0n)]);
    expectAdmits(admitted);
    const refusal = expectRefuses(refused, 'relay-data-carrier');
    expect(refusal.regime).toBe('policy');
    expect(refusal.measured).toBe(224);
    expect(refusal.allowed).toBe(223);
    expect(() => layer3.assertFinalizedTransactionBytes(refused)).toThrow(
      /224 bytes of OP_RETURN locking bytecode is 1 over the 223-byte data carrier allowance/,
    );
    expect(() => layer3.assertFinalizedTransactionBytes(refused)).toThrow(/64: oversize-op-return/);
    // The 224-byte script is exempt from BOTH the dust floor and the 201-byte locking ceiling, so the
    // data-carrier rule is demonstrably the only one that can see an oversized OP_RETURN.
    expect(refusedRules(refused)).toEqual(['relay-data-carrier']);
  });

  it('scriptsig-push-only (POLICY) admits OP_1 OP_1 and refuses OP_1 OP_ADD', () => {
    const admitted = transactionOf([inputOf(hexToBin('5151'))], [outputOf(p2pkhLock(), 1_000n)]);
    const refused = transactionOf([inputOf(hexToBin('5193'))], [outputOf(p2pkhLock(), 1_000n)]);
    expectAdmits(admitted);
    const refusal = expectRefuses(refused, 'scriptsig-push-only');
    expect(refusal.regime).toBe('policy');
    expect(refusal.where).toBe('input 0');
    expect(() => layer3.assertFinalizedTransactionBytes(refused)).toThrow(/64: scriptsig-not-pushonly/);
  });

  it('consensus-unlocking-bytes (CONSENSUS) admits exactly 10,000 bytes and refuses 10,001', () => {
    const admitted = transactionOf([inputOf(pushOnlyPadding(10_000))], [outputOf(p2pkhLock(), 1_000n)]);
    const refused = transactionOf([inputOf(pushOnlyPadding(10_001))], [outputOf(p2pkhLock(), 1_000n)]);
    expectAdmits(admitted);
    const refusal = expectRefuses(refused, 'consensus-unlocking-bytes');
    expect(refusal.regime).toBe('consensus');
    expect(refusal.overBy).toBe(1);
    expect(() => layer3.assertFinalizedTransactionBytes(refused)).toThrow(
      /10001 unlocking bytecode bytes is 1 over the 10000-byte per-input script limit/,
    );
    // Consensus, so the opt-out cannot reach it.
    expect(() => layer3.assertFinalizedTransactionBytes(refused, { allowNonRelayable: true }))
      .toThrow(/\[consensus\] consensus-unlocking-bytes/);
  });

  it('EVERY published rule has a demonstrated refusal, so no rule can be added without one', () => {
    // This is the anti-vacuity assertion. Five guards on this effort were found unable to fire; a rule that
    // reaches the published set without a Part A pair fails here rather than passing silently.
    expect([...DEMONSTRATED].sort()).toEqual([...layer3.FINALIZED_BYTE_RULES.map((rule) => rule.id)].sort());
    // Both regimes are populated: a "severity split" with an empty side would be decoration.
    expect(layer3.FINALIZED_BYTE_RULES.filter((rule) => rule.regime === 'consensus').length)
      .toBeGreaterThan(0);
    expect(layer3.FINALIZED_BYTE_RULES.filter((rule) => rule.regime === 'policy').length).toBeGreaterThan(0);
    // Each refusal id resolves to its rule, so a diagnostic can always be traced to a threshold and a source.
    for (const rule of layer3.FINALIZED_BYTE_RULES) {
      expect(layer3.finalizedByteRule(rule.id)?.source.length ?? 0).toBeGreaterThan(40);
    }
    expect(layer3.FINALIZED_BYTE_GATE_BLIND_SPOTS.length).toBeGreaterThan(4);
  });

  it('push-only accepts every legal push form and rejects a truncated one', () => {
    expect(layer3.isPushOnlyBytecode(hexToBin(''))).toBe(true);
    expect(layer3.isPushOnlyBytecode(hexToBin('0201aa'))).toBe(false); // 2-byte push with 1 byte present
    expect(layer3.isPushOnlyBytecode(hexToBin('02aabb'))).toBe(true);
    expect(layer3.isPushOnlyBytecode(hexToBin('4c02aabb'))).toBe(true); // PUSHDATA1
    expect(layer3.isPushOnlyBytecode(hexToBin('4c05aa'))).toBe(false); // PUSHDATA1, truncated
    expect(layer3.isPushOnlyBytecode(hexToBin('4d0200aabb'))).toBe(true); // PUSHDATA2
    expect(layer3.isPushOnlyBytecode(hexToBin('4effffffffaa'))).toBe(false); // PUSHDATA4, absurd length
    expect(layer3.isPushOnlyBytecode(hexToBin('4f'))).toBe(true); // OP_1NEGATE
    expect(layer3.isPushOnlyBytecode(hexToBin('60'))).toBe(true); // OP_16
    expect(layer3.isPushOnlyBytecode(hexToBin('61'))).toBe(false); // OP_NOP
    expect(layer3.isPushOnlyBytecode(hexToBin('50'))).toBe(false); // OP_RESERVED
  });

  it('reports every violated rule at once, not just the first', () => {
    const many = transactionOf(
      [inputOf(hexToBin('5193')), inputOf(pushOnlyPadding(10_001))],
      [outputOf(pushOnlyPadding(202), 10n), outputOf(opReturnLock(300), 0n)],
    );
    expect(refusedRules(many)).toEqual([
      'consensus-unlocking-bytes', 'output-dust', 'relay-data-carrier', 'relay-locking-bytes',
      'scriptsig-push-only',
    ]);
    expect(() => layer3.assertFinalizedTransactionBytes(many)).toThrow(/refused by 5 byte rule\(s\)/);
  });
});

/* ------------------------------------------------------------------------------------------------------ */
/* Part B: the wiring, on a real Layer-3 composition                                                        */
/* ------------------------------------------------------------------------------------------------------ */

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const packed = (...values: bigint[]): Uint8Array =>
  scriptToBytecode(values.map((value) => {
    const bytes: number[] = [];
    let magnitude = value < 0n ? -value : value;
    while (magnitude > 0n) { bytes.push(Number(magnitude & 0xffn)); magnitude >>= 8n; }
    if (bytes.length === 0) return new Uint8Array();
    if (bytes[bytes.length - 1] & 0x80) bytes.push(value < 0n ? 0x80 : 0x00);
    else if (value < 0n) bytes[bytes.length - 1] |= 0x80;
    return Uint8Array.from(bytes);
  }));
const aggregate = (...values: bigint[]): Uint8Array => scriptToBytecode([packed(...values)]);

const RETURNING_B = `pragma solidcash >=0.8.0;
contract L4ReturningB(int brand) {
  function twice(int n) public pure returns (int, int) {
    require(n >= 0);
    return (n * 2, n + 10);
  }
}`;
const RETURNING_A = `pragma solidcash >=0.8.0;
interface IL4ReturningB { function twice(int n) returns (int, int); }
contract L4ReturningA(int brand, address target) {
  function plusOne(int n) public pure returns (int) {
    int child, int witness = IL4ReturningB(target).twice(n);
    require(child >= 0 && witness == n + 10);
    return child + 1;
  }
}`;

/**
 * What is varied on the terminal CHANGE output, and nothing else is varied anywhere.
 *
 * The change output is the right place to attack, and that is a measured property of the shape rather than a
 * convenience: L2 established that this slot sits outside every relocatable participant block and that the
 * emitting covenants pin neither its value nor its script - it absorbs the remainder. So a perturbation here
 * leaves every covenant satisfied, which is exactly what makes the control below decisive.
 */
type Perturbation =
  | 'none'
  /** 10 satoshis to a 34-byte P2PKH output against its 546-satoshi floor: C1's refusal class. */
  | 'dust-change'
  /** A 202-byte raw locking script, one byte over the standard allowance. */
  | 'oversized-change-script';

interface Built {
  provider: ReturnType<typeof createLayer3SemanticTestProvider>;
  builder: TransactionBuilder;
  transaction: string;
}

async function build(perturbation: Perturbation = 'none'): Promise<Built> {
  const provider = createLayer3SemanticTestProvider();
  const projection = new Contract(
    compileString(layer3.generateGraphProjectionVerifier()), [], { provider },
  );
  const controller = new Contract(
    compileString(layer3.generateGraphRootController(projection.lockingBytecode)), [alicePkh], { provider },
  );
  const genesis = await (provider as any).addTokenUtxosDynamic(() => [{
    address: controller.tokenAddress,
    satoshis: 3000n,
    token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } },
  }]);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: genesis.categoryId as string,
  };
  const artifactB = compileString(RETURNING_B, options);
  const baseB = new Contract(artifactB, [2n], { provider });
  const setupB = await setupStatefulUtxos(provider, baseB, artifactB.stateLayout!, {});
  const b = baseB.withCategory(hexToBin(setupB.categoryId));
  const artifactA = compileString(RETURNING_A, options);
  const baseA = new Contract(artifactA, [1n, b.lockingBytecode], { provider });
  const setupA = await setupStatefulUtxos(provider, baseA, artifactA.stateLayout!, {});
  const a = baseA.withCategory(hexToBin(setupA.categoryId));

  const plan = layer3.planCompiledGraph([
    { artifact: artifactA, lockingBytecode: a.lockingBytecode },
    { artifact: artifactB, lockingBytecode: b.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'plusOne', args: [2n] },
    { parent: 0, callee: 1, function: 'twice', args: [2n] },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const resultA = packed(5n);
  const resultB = packed(4n, 12n);
  const transcript = layer3.finalizeCompiledGraph(
    plan,
    { 0: binToHex(resultA), 1: binToHex(resultB) },
    layout.participantInputs, layout.returnOutputs,
    [binToHex(resultA), binToHex(resultB)], layout.projectionInputs,
  );

  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootFee = randomUtxo({ satoshis: 20_000n });
  await provider.addUtxo(p2pkh.address, rootFee);
  const rootTx = new TransactionBuilder({ provider });
  rootTx.addInput(genesis.utxos[0], controller.unlock.initialize(
    hexToBin(transcript.root), alicePub, signature(),
  ));
  rootTx.addInput(rootFee, p2pkh.unlock.spend(alicePub, signature()));
  rootTx.addOutput({
    to: controller.tokenAddress, amount: genesis.utxos[0].satoshis,
    token: {
      category: genesis.categoryId, amount: 0n,
      nft: { capability: 'mutable', commitment: transcript.root },
    },
  });
  rootTx.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(rootTx));
  const rooted = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === transcript.root);

  const slotFunderA = randomUtxo({ satoshis: 1000n });
  const slotFunderB = randomUtxo({ satoshis: 1000n });
  const projectionA = randomUtxo({ satoshis: 1000n });
  const projectionB = randomUtxo({ satoshis: 1000n });
  const feeFunder = randomUtxo({ satoshis: 50_000n });
  for (const utxo of [slotFunderA, slotFunderB, feeFunder]) await provider.addUtxo(p2pkh.address, utxo);
  for (const utxo of [projectionA, projectionB]) await provider.addUtxo(projection.address, utxo);

  const routeA = a.createCompilerRouteUnlocker(
    artifactA.hiddenBatch!.route, hexToBin(artifactA.hiddenBatch!.selector),
  );
  const routeB = b.createCompilerRouteUnlocker(
    artifactB.hiddenBatch!.route, hexToBin(artifactB.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(setupA.masterUtxo, routeA(
    ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any,
    BigInt(layout.returnOutputs[0]!),
  ));
  tx.addInput(slotFunderA, p2pkh.unlock.spend(alicePub, signature()));
  tx.addInput(setupB.masterUtxo, routeB(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any,
    BigInt(layout.returnOutputs[1]!),
  ));
  tx.addInput(slotFunderB, p2pkh.unlock.spend(alicePub, signature()));
  tx.addInput(projectionA, projection.unlock.verify(
    transcript.bytes, BigInt(layout.controllerInput), 0n,
  ));
  tx.addInput(projectionB, projection.unlock.verify(
    transcript.bytes, BigInt(layout.controllerInput), 1n,
  ));
  tx.addInput(rooted, controller.unlock.attest(transcript.bytes));
  tx.addInput(feeFunder, p2pkh.unlock.spend(alicePub, signature()));

  tx.addOutput({
    to: a.tokenAddress, amount: setupA.masterUtxo.satoshis,
    token: { category: setupA.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: hexToBin('51'), amount: 1000n,
    token: {
      category: setupA.categoryId, amount: 0n,
      nft: { capability: 'none' as const, commitment: binToHex(aggregate(5n)) },
    },
  });
  tx.addOutput({
    to: b.tokenAddress, amount: setupB.masterUtxo.satoshis,
    token: { category: setupB.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: hexToBin('51'), amount: 1000n,
    token: {
      category: setupB.categoryId, amount: 0n,
      nft: { capability: 'none' as const, commitment: binToHex(aggregate(4n, 12n)) },
    },
  });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  // The terminal change output, and the ONLY thing any perturbation touches.
  if (perturbation === 'dust-change') tx.addOutput({ to: p2pkh.address, amount: 10n });
  else if (perturbation === 'oversized-change-script') {
    tx.addOutput({ to: pushOnlyPadding(202), amount: 2000n });
  } else tx.addOutput({ to: p2pkh.address, amount: 10_000n });

  return { provider, builder: tx, transaction: raw(tx) };
}

describe('L4 the gate is on the Layer-3 send path, on a composition that really settles', () => {
  it('SEMANTIC: the honest composition settles and the byte gate admits it', async () => {
    const built = await build();
    // The gate runs inside the production entry point, with no caller opt-in and no declared envelope.
    const transaction = layer3.preflightLayer3Transaction(built.builder);
    const verdict = layer3.assessFinalizedTransactionBytes(transaction);
    console.log(`L4 honest subject: ${layer3.formatFinalizedByteVerdict(verdict)}`);
    expect(verdict.admitted).toBe(true);
    expect(verdict.refusals).toEqual([]);
    expect(dustOutputs(transaction)).toEqual([]);
    // MEASURED, not judged: the fee rate this shape carries. No rule refuses on it - see the gate's own
    // blind-spot list - and this line exists so the figure is on the record rather than assumed.
    const inputSatoshis = built.builder.inputs.reduce((total, input) => total + input.satoshis, 0n);
    const feeRate = Number(inputSatoshis - verdict.outputSatoshis) / verdict.serializedBytes;
    console.log(`L4 honest subject fee rate: ${feeRate.toFixed(3)} sat/byte over `
      + `${verdict.serializedBytes} bytes`);
    await expect(layer3.sendPreflightedLayer3Transaction(built.builder)).resolves.toMatch(/^[0-9a-f]{64}$/);
  }, 180_000);

  it('FAIL_CLOSED: a dust change output is refused on the send path that the mock network ACCEPTS', async () => {
    // THE DECISIVE CONTROL. These exact bytes are accepted by the mock stack, so every covenant is satisfied
    // and nothing but relay policy has an objection - the mock defaults `enforceDust` to false, which is
    // precisely why C1's 10-satoshi output survived the whole effort and was then refused `64: dust` by BCHN.
    const accepted = await build('dust-change');
    await expect(accepted.provider.sendRawTransaction(accepted.transaction))
      .resolves.toBeTypeOf('string');

    const built = await build('dust-change');
    expect(() => layer3.preflightLayer3Transaction(built.builder)).toThrow(
      /10 satoshis is 536 short of the 546-satoshi dust threshold for a 34-byte output \(3 \* \(34 \+ 148\)\)/,
    );
    await expect(layer3.sendPreflightedLayer3Transaction(built.builder))
      .rejects.toThrow(/\[policy\] output-dust at output 7/);
    // POLICY: the explicit opt-out admits it, and the same call on the same builder then returns.
    expect(layer3.preflightLayer3Transaction(built.builder, { allowNonRelayable: true }).outputs.length)
      .toBe(8);
  }, 180_000);

  it('FAIL_CLOSED: a 202-byte change script is refused, and 201 through the same path is not', async () => {
    const built = await build('oversized-change-script');
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
    expect(() => layer3.preflightLayer3Transaction(built.builder)).toThrow(
      /202 locking bytecode bytes is 1 over the 201-byte standard allowance/,
    );
  }, 180_000);

  it('GUARD NEGATIVE CONTROL: the same composition with the change output restored is silent', async () => {
    // The pair differs in one output field. If this rejected, the refusals above would be about the shape
    // rather than about the attacked property.
    const built = await build('none');
    expect(built.builder.outputs[7].amount).toBe(10_000n);
    const transaction = layer3.preflightLayer3Transaction(built.builder);
    expect(layer3.assessFinalizedTransactionBytes(transaction).refusals).toEqual([]);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 180_000);

  it('the gate does not read the provider, whose published limits are 100x the real ones', async () => {
    // `evaluateEveryInput` builds its VM from `provider.consensusLimits`. If the byte gate did the same, every
    // Layer-3 test would pass it vacuously: this profile publishes a 10,000,000-byte transaction ceiling
    // against the real 100,000, and a 1,000,000-byte per-input ceiling against the real 10,000.
    const provider = createLayer3SemanticTestProvider();
    expect(provider.consensusLimits!.maximumTransactionBytes).toBe(10_000_000);
    expect(provider.consensusLimits!.maximumInputBytes).toBe(1_000_000);
    // A transaction inside the PROVIDER's ceiling and outside the real one is refused all the same. The gate
    // takes a transaction and an options object; there is no argument that could carry these limits in.
    expect(() => layer3.assertFinalizedTransactionBytes(sizedTransaction(100_001)))
      .toThrow(/over the 100000-byte standard relay ceiling/);
    expect(() => layer3.assertFinalizedTransactionBytes(
      transactionOf([inputOf(pushOnlyPadding(10_001))], [outputOf(p2pkhLock(), 1_000n)]),
    )).toThrow(/over the 10000-byte per-input script limit/);
  });
});
