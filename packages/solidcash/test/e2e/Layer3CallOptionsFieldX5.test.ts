import {
  bigIntToVmNumber, binToHex, encodeTransaction, hexToBin, sha256,
} from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate, TransactionBuilder, layer3,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import type { Utxo } from '../../src/interfaces.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

/**
 * X5 - the transcript row's call-options field.
 *
 * Byte 11 of every invocation row is the edge's call-options byte: bit 0 is the compiler-proven read-only
 * (`staticcall`) mode, bits 1-7 are source-level call options and none of them is an admitted graph edge. This
 * file pins the two halves of "the field is bound", each with an honest control differing in exactly that byte:
 *
 *   NON-ROOT  the caller's own compiled route rebuilds the byte from its slot and compares it inside the
 *             emission row, so a row that renames a `staticcall` edge as an ordinary `call` is rejected. That
 *             half already held; what was missing is a NAMED planning refusal, which is asserted separately.
 *   ROOT      the transaction-origin row has no caller, so nothing re-derived its byte and no covenant read it.
 *             The projection verifier now requires it to be 0.
 *
 * Two participants, seven slots: reader master 0, producer master 1 + its return event, funding 2, projection
 * proofs 3 and 4, controller 5, fee 6. Ordinary BCH-2026 capacity, no relaxed profile.
 */

const READER = `pragma solidcash >=0.8.0;
interface IX5Peek { function peek(int n) returns (int); }
contract X5Reader(int brand, address peer) {
  function look(address target, int n) public pure {
    int seen = IX5Peek(target).peek.staticcall(n);
    require(seen == n * 3);
  }
}`;
const PEEK = `pragma solidcash >=0.8.0;
contract X5Peek(int brand) {
  function peek(int n) public pure returns (int) {
    require(n >= 0);
    return n * 3;
  }
}`;

const SEED = 2n;
const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const packedScalar = (value: bigint): Uint8Array => scriptToBytecode([bigIntToVmNumber(value)]);
const packedBytes = (value: Uint8Array): Uint8Array => scriptToBytecode([value]);
const fixedUtxo = (slot: number, satoshis: bigint): Utxo => randomUtxo({
  satoshis, vout: 0, txid: slot.toString(16).padStart(2, '0').repeat(32),
});

/** Byte offset of every invocation row's call-options field, plus each participant's emission region. */
function locateCallOptions(bytes: Uint8Array): {
  rows: number[]; emissions: { start: number; length: number }[];
} {
  const u16 = (at: number): number => bytes[at] | (bytes[at + 1] << 8);
  const emissions: { start: number; length: number }[] = [];
  const participantCount = bytes[9];
  let cursor = 10;
  for (let participant = 0; participant < participantCount; participant += 1) {
    cursor += 4;
    cursor += 2 + u16(cursor);
    cursor += 2 + u16(cursor);
    const length = u16(cursor);
    emissions.push({ start: cursor + 2, length });
    cursor += 2 + length;
    cursor += 2 + u16(cursor);
    cursor += 2;
    cursor += 2 + u16(cursor);
    cursor += 2;
  }
  const invocationCount = u16(cursor);
  cursor += 2;
  const rows: number[] = [];
  for (let invocation = 0; invocation < invocationCount; invocation += 1) {
    rows.push(cursor + 11);
    const argsLength = u16(cursor + 12);
    cursor += 16 + argsLength + u16(cursor + 14 + argsLength);
  }
  if (cursor !== bytes.length) throw new Error('call-options locator did not consume every byte');
  return { rows, emissions };
}

export type CallOptionsTamper =
  | 'none'
  // The ROOT row claims a read-only mode the transaction origin cannot have.
  | 'root-call-options'
  // The EDGE row renames the compiler-authored `staticcall` as an ordinary call, in the row only.
  | 'edge-call-options-row'
  // The same rename, carried consistently into the caller's emission vector so the projection proof agrees.
  | 'edge-call-options-emission';

async function createGraphAuthority(provider: ReturnType<typeof createTestProvider>): Promise<{
  projection: Contract; controller: Contract; categoryId: string; genesisUtxo: Utxo;
}> {
  const projection = new Contract(
    compileString(layer3.generateGraphProjectionVerifier()), [], { provider },
  );
  const controller = new Contract(
    compileString(layer3.generateGraphRootController(projection.lockingBytecode)), [alicePkh], { provider },
  );
  const genesis = await (provider as any).addTokenUtxosDynamic((_category: string) => [{
    address: controller.tokenAddress,
    satoshis: 3000n,
    token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } },
  }]);
  return {
    projection, controller, categoryId: genesis.categoryId as string, genesisUtxo: genesis.utxos[0],
  };
}

async function initializeGraphAuthority(
  provider: ReturnType<typeof createTestProvider>, controller: Contract, genesisUtxo: any,
  categoryId: string, root: string, p2pkh: Contract,
): Promise<Utxo> {
  const fee = fixedUtxo(0xe1, 20_000n);
  await provider.addUtxo(p2pkh.address, fee);
  const tx = new TransactionBuilder({ provider });
  tx.addInput(genesisUtxo, controller.unlock.initialize(hexToBin(root), alicePub, signature()));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: controller.tokenAddress, amount: genesisUtxo.satoshis,
    token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: root } },
  });
  tx.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(tx));
  const rooted = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === root);
  if (!rooted) throw new Error('graph controller initialization did not create the rooted authority');
  return rooted;
}

interface StaticEdgeFixture {
  provider: ReturnType<typeof createTestProvider>;
  builder: TransactionBuilder;
  transaction: string;
  plan: ReturnType<typeof layer3.planCompiledGraph>;
  transcript: ReturnType<typeof layer3.finalizeCompiledGraph>;
  honestBytes: Uint8Array;
}

async function buildStaticEdgeGraph(tamper: CallOptionsTamper = 'none'): Promise<StaticEdgeFixture> {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };

  const artifactB = compileString(PEEK, options);
  const baseB = new Contract(artifactB, [7n], { provider });
  const setupB = await setupStatefulUtxos(provider, baseB, artifactB.stateLayout!, {});
  const b = baseB.withCategory(hexToBin(setupB.categoryId));

  const artifactA = compileString(READER, options);
  const baseA = new Contract(artifactA, [6n, b.lockingBytecode], { provider });
  const setupA = await setupStatefulUtxos(provider, baseA, artifactA.stateLayout!, {});
  const a = baseA.withCategory(hexToBin(setupA.categoryId));

  const plan = layer3.planCompiledGraph([
    { artifact: artifactA, lockingBytecode: a.lockingBytecode },
    { artifact: artifactB, lockingBytecode: b.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'look', args: [b.lockingBytecode, SEED] },
    { parent: 0, callee: 1, function: 'peek', args: [SEED] },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const result = packedScalar(SEED * 3n);
  const honest = layer3.finalizeCompiledGraph(
    plan, { 1: binToHex(result) },
    layout.participantInputs, layout.returnOutputs, ['', binToHex(result)], layout.projectionInputs,
  );

  // Every tamper moves exactly one call-options byte and re-roots; no frame length changes.
  let transcript = honest;
  if (tamper !== 'none') {
    const bytes = Uint8Array.from(honest.bytes);
    const located = locateCallOptions(bytes);
    const emissionsHex = [...honest.participantEmissionsHex];
    if (tamper === 'root-call-options') {
      bytes[located.rows[0]] = 1;
    } else {
      bytes[located.rows[1]] = 0;
      if (tamper === 'edge-call-options-emission') {
        const caller = located.emissions[0];
        const modeAt = caller.start + 2 + (bytes[caller.start] | (bytes[caller.start + 1] << 8));
        bytes[modeAt] = 0;
        emissionsHex[0] = binToHex(bytes.slice(caller.start, caller.start + caller.length));
      }
    }
    transcript = {
      ...honest,
      bytes,
      root: binToHex(sha256.hash(bytes)),
      participantEmissionsHex: Object.freeze(emissionsHex),
    } as typeof honest;
  }

  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const returnFunding = fixedUtxo(0xf0, 1000n);
  await provider.addUtxo(p2pkh.address, returnFunding);
  const projectionUtxos = [fixedUtxo(0xa0, 1000n), fixedUtxo(0xa1, 1000n)];
  for (const proof of projectionUtxos) await provider.addUtxo(projection.address, proof);
  const fee = fixedUtxo(0xe2, 120_000n);
  await provider.addUtxo(p2pkh.address, fee);

  const routeA = a.createCompilerRouteUnlocker(
    artifactA.hiddenBatch!.route, hexToBin(artifactA.hiddenBatch!.selector),
  );
  const routeB = b.createCompilerRouteUnlocker(
    artifactB.hiddenBatch!.route, hexToBin(artifactB.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(setupA.masterUtxo, routeA(
    ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any,
  ));
  tx.addInput(setupB.masterUtxo, routeB(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any,
    BigInt(layout.returnOutputs![1]!),
  ));
  tx.addInput(returnFunding, p2pkh.unlock.spend(alicePub, signature()));
  projectionUtxos.forEach((proof, participant) => tx.addInput(
    proof,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), BigInt(participant)),
  ));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  tx.addOutput({
    to: a.tokenAddress, amount: setupA.masterUtxo.satoshis,
    token: { category: setupA.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: b.tokenAddress, amount: setupB.masterUtxo.satoshis,
    token: { category: setupB.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: hexToBin('51'), amount: 1000n,
    token: {
      category: setupB.categoryId, amount: 0n,
      nft: { capability: 'none', commitment: binToHex(packedBytes(result)) },
    },
  });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 100_000n });

  return {
    provider, builder: tx, transaction: raw(tx), plan, transcript, honestBytes: honest.bytes,
  };
}

/** Report the first input whose BCH-2026 evaluation fails, so a hostile case names one exact covenant. */
function failingInput(builder: TransactionBuilder): number | null {
  try {
    layer3.preflightLayer3Transaction(builder);
    return null;
  } catch (error) {
    const match = /failed at input (\d+)/.exec((error as Error).message);
    if (!match) throw error;
    return Number(match[1]);
  }
}

const INPUT = {
  masterReader: 0, masterProducer: 1, projectionReader: 3, projectionProducer: 4, controller: 5,
} as const;
const providerOpVerify = (input: number): RegExp => new RegExp('^mandatory-script-verify-flag-failed '
  + `\\(Unable to verify transaction: error in evaluating input index ${input}: `
  + 'Program failed an OP_VERIFY operation\\.\\)$');
const PROJECTION_OP_VERIFY = providerOpVerify(INPUT.projectionReader);
const MASTER_OP_VERIFY = providerOpVerify(INPUT.masterReader);

describe('Layer-3 committed call-options field (X5)', () => {
  it('settles a compiler-authored staticcall edge and commits its call-options byte', async () => {
    const built = await buildStaticEdgeGraph();
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
    // The mode is the compiler's, not the caller's: nothing supplied one.
    expect(built.plan.invocations.map((invocation) => invocation.callMode))
      .toEqual(['call', 'staticcall']);
    // Bit 0 carries that mode; no option bit is set, which is the only admitted shape.
    expect(built.plan.invocations.map((invocation) => invocation.callOptions)).toEqual([0, 1]);
    const located = locateCallOptions(built.transcript.bytes);
    expect(located.rows.map((at) => built.transcript.bytes[at])).toEqual([0, 1]);
  }, 120_000);

  it('rejects a root row claiming a read-only mode, at the first projection proof', async () => {
    const built = await buildStaticEdgeGraph('root-call-options');
    // Exactly one byte separates this transcript from the honest one.
    expect([...built.transcript.bytes].filter((byte, at) => byte !== built.honestBytes[at]))
      .toHaveLength(1);
    expect(failingInput(built.builder)).toBe(INPUT.projectionReader);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(PROJECTION_OP_VERIFY);
  }, 120_000);

  // The transcript row renames the edge; the caller's emission vector still carries the honest byte, so the
  // projection proof that rebuilds the expected emission row from the row is the covenant that disagrees.
  it('rejects an edge row renaming a staticcall as an ordinary call, at the caller projection', async () => {
    const built = await buildStaticEdgeGraph('edge-call-options-row');
    expect([...built.transcript.bytes].filter((byte, at) => byte !== built.honestBytes[at]))
      .toHaveLength(1);
    expect(failingInput(built.builder)).toBe(INPUT.projectionReader);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(PROJECTION_OP_VERIFY);
  }, 120_000);

  // The same rename carried into the caller's emission vector, so the projection proof agrees with the row.
  // The caller's OWN compiled route rebuilds the byte from its compiler-authored slot, and that is what fails.
  it('rejects the same rename carried into the emission vector, at the caller master input', async () => {
    const built = await buildStaticEdgeGraph('edge-call-options-emission');
    expect([...built.transcript.bytes].filter((byte, at) => byte !== built.honestBytes[at]))
      .toHaveLength(2);
    expect(failingInput(built.builder)).toBe(INPUT.masterReader);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(MASTER_OP_VERIFY);
  }, 120_000);
});
