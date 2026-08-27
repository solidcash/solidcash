import { describe, expect, it } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  decodeAuthenticationInstructions, hexToBin, OpcodesBCH, vmNumberToBigInt,
} from '@bitauth/libauth';
import { compileFile, compileFileMulti } from '../src/compileFile.js';
import { applyUpsertFixedKeyRecovery } from '../src/generation/upsertKeySources.js';
import type { FunctionDefinitionNode } from '../src/ast/AST.js';

const marketplaceV1 = path.resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../examples/effectiveacceleration/contracts/MarketplaceV1.sol',
);

const JOBS_LENGTH_MINUS_ONE = 'binop:-(unop:.length(state:jobs),lit:1)';

function expectPublishJobPostKeys(art: { abi: readonly { name: string; sortedUpsertLoopInfo?: Array<{
  collection?: string; fixedKeySources?: Array<{ kind?: string; expressionLabel?: string }>;
}> }[] }): void {
  const infos = art.abi.filter((fn) => fn.name === 'publishJobPost')
    .flatMap((fn) => fn.sortedUpsertLoopInfo ?? []);
  expect(infos.length).toBeGreaterThan(0);
  expect(infos.some((info) => info.collection === 'whitelistWorkers'
    && info.fixedKeySources?.some((source) =>
      source.kind === 'expression'
      && source.expressionLabel === JOBS_LENGTH_MINUS_ONE))).toBe(true);
}

const eaOpts = {
  solidityImportCompat: true,
  messageBus: true,
  messageBusGraphContext: true,
  optimizeForCompilationSpeed: true,
  suppressWarnings: true,
  commitmentLimit: 128,
  maximumInputBytes: 10_000_000,
  ecrecover: 'p2pkh' as const,
};

describe('MarketplaceV1 publishJobPost upsert keys', () => {
  it('publishes jobs.length-1 as fixedKeySources on publishJobPost', () => {
    expectPublishJobPostKeys(compileFile(marketplaceV1, {
      solidityImportCompat: true,
      optimizeForCompilationSpeed: true,
    }));
  });

  it('keeps jobs.length-1 on compileFileMulti and the delegate-capable artifact', () => {
    const art = compileFileMulti(marketplaceV1, eaOpts).MarketplaceV1;
    expect(art).toBeDefined();
    expectPublishJobPostKeys(art!);
    // Initializer inference can make the primary artifact itself the delegate implementation. Only standalone
    // implementations receive a second, lazy delegateArtifact; both representations must preserve the key ABI.
    expectPublishJobPostKeys(art!.delegateArtifact ?? art!);
  });

  it('classifies empty-commitment immutables from output j, not the zeroAmount boolean', () => {
    const art = compileFileMulti(marketplaceV1, eaOpts).MarketplaceV1;
    const hex = (art?.delegateArtifact ?? art)?.functionBodies?.['9f3e4a91'];
    expect(typeof hex).toBe('string');
    const ops: number[] = [];
    const raw = Buffer.from((hex as string).replace(/\s+/g, ''), 'hex');
    for (let i = 0; i < raw.length;) {
      const op = raw[i++];
      ops.push(op);
      if (op > 0 && op <= 75) i += op;
      else if (op === 76) i += 1 + raw[i];
      else if (op === 77) { const n = raw[i] | (raw[i + 1] << 8); i += 2 + n; }
      else if (op === 78) {
        const n = raw[i] | (raw[i + 1] << 8) | (raw[i + 2] << 16) | (raw[i + 3] << 24);
        i += 4 + n;
      }
    }
    // OP_NUMEQUAL 156, OP_DUP 118, OP_OVER 120, OP_OUTPUTTOKENCOMMITMENT 210
    let over = 0;
    let dup = 0;
    for (let i = 0; i < ops.length - 2; i++) {
      if (ops[i] !== 156 || ops[i + 2] !== 210) continue;
      if (ops[i + 1] === 120) over += 1;
      if (ops[i + 1] === 118) dup += 1;
    }
    expect(over).toBeGreaterThan(0);
    expect(dup).toBe(0);
  });

  it('adds ceil(jobsLen/120) before the whitelist upsert predecessor check', () => {
    const art = compileFile(marketplaceV1, eaOpts);
    const target = art.delegateArtifact ?? art;
    const hex = target.functionBodies?.['4b7f34e3'];
    expect(typeof hex).toBe('string');
    const body = hex as string;
    const whitelistHash = '09e7d00ab6cd5795b2a4fa3db718efbdb374cbaf';
    const hashHelpers = Object.entries(target.debug.invokeDebug ?? {})
      .filter(([, debug]) => debug.bytecode.includes(whitelistHash))
      .map(([id]) => BigInt(id));
    expect(hashHelpers.length).toBeGreaterThan(0);
    const instructions = decodeAuthenticationInstructions(hexToBin(body));
    const readNumber = (instruction: { opcode: number; data?: Uint8Array }): bigint | undefined => {
      if (instruction.opcode === OpcodesBCH.OP_0) return 0n;
      if (instruction.opcode >= OpcodesBCH.OP_1 && instruction.opcode <= OpcodesBCH.OP_16) {
        return BigInt(instruction.opcode - OpcodesBCH.OP_1 + 1);
      }
      if (!instruction.data) return undefined;
      const value = vmNumberToBigInt(instruction.data, { requireMinimalEncoding: false });
      return typeof value === 'bigint' ? value : undefined;
    };
    // Address construction can be outlined independently of its caller. Prove the publishJobPost body invokes
    // the helper which owns the whitelist collection hash, and retains the predecessor displacement
    // ceil(jobsLen/120): encodeInt(119) ADD encodeInt(120) DIV.
    expect(instructions.some((instruction, index) => instruction.opcode === OpcodesBCH.OP_INVOKE
      && hashHelpers.includes(readNumber(instructions[index - 1]) ?? 0xffff_ffffn))).toBe(true);
    expect(body).toContain('017793017896');
  });

  it('recovers jobs.length-1 from dynamicWrites when the body no longer has the assign', () => {
    const fn = {
      parameters: [],
      dynamicWrites: ['jobs'],
      sortedUpsertLoopInfo: [{
        collection: 'whitelistWorkers',
        fixedKeyParams: [],
        varyingArrayParam: 'allowedWorkers_',
        op: 'set' as const,
      }],
    } as unknown as FunctionDefinitionNode;
    applyUpsertFixedKeyRecovery(fn, new Set(['jobs']));
    expect(fn.sortedUpsertLoopInfo?.[0].fixedKeySources).toEqual([
      { kind: 'expression', canonical: JOBS_LENGTH_MINUS_ONE },
    ]);
  });
});
