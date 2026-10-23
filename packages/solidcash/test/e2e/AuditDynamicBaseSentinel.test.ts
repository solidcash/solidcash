import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, decodeAuthenticationInstructions, decodeTransactionUnsafe,
  encodeAuthenticationInstructions, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileString as compileMessageBus } from 'solidc';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, expectScriptRejection, setupStatefulUtxos } from '../test-util.js';

/**
 * DYN-1 (docs/security/security-audit-2026-10-16.md): a direct (or route-clone) dynamic write used to skip every chunk
 * check when the caller-supplied `__internal__dynamicChunkInputBase` was below -1. The write then committed a new
 * A$len header while its chunk NFTs carried arbitrary bytes, and every later read reassembled them as state.
 *
 * The honest absent-base sentinel is exactly -1 (the SDK publishes `-1n`), so a write that executes can never
 * legitimately carry a lower value. The verifier now refuses it with `-1 GREATERTHANOREQUAL OP_VERIFY`.
 */
const SOURCE = `pragma solidcash ^0.14.0;
contract Dyn() {
  string public name;
  function setName(string n) { this.name = n; require(true); }
  function expectName(string v) { require(this.name == v); }
}`;

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;

async function capture(provider: Provider, run: () => Promise<unknown>): Promise<string> {
  let captured = '';
  const send = provider.sendRawTransaction.bind(provider);
  (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
    captured = hex;
    throw new Error('capture-only');
  };
  await expect(run()).rejects.toThrow('capture-only');
  (provider as any).sendRawTransaction = send;
  expect(captured).not.toBe('');
  return captured;
}

/** Set the named ABI argument on every input whose unlocking has exactly the function's argument frame. */
function patchArgument(tx: Tx, inputs: readonly string[], name: string, value: bigint): number {
  const position = inputs.indexOf(name);
  expect(position).toBeGreaterThanOrEqual(0);
  let patched = 0;
  tx.inputs.forEach((input) => {
    const instructions = decodeAuthenticationInstructions(input.unlockingBytecode);
    if (instructions.length !== inputs.length + 2) return;
    const at = instructions.length - 2 - position;
    instructions[at] = { opcode: 0x01, data: bigIntToVmNumber(value) } as any;
    input.unlockingBytecode = encodeAuthenticationInstructions(instructions);
    patched += 1;
  });
  return patched;
}

/** Rewrite the chunk carrying `from` to carry `to` (same length) without touching the header the body writes. */
function forgeChunk(tx: Tx, from: string, to: string): number {
  const encoder = new TextEncoder();
  const needle = binToHex(encoder.encode(from));
  let forged = 0;
  tx.outputs.forEach((output) => {
    const nft = output.token?.nft;
    if (nft === undefined || nft.capability !== 'mutable') return;
    const commitment = binToHex(nft.commitment);
    if (!commitment.endsWith(needle)) return;
    nft.commitment = Uint8Array.from([
      ...nft.commitment.slice(0, nft.commitment.length - encoder.encode(from).length),
      ...encoder.encode(to),
    ]);
    forged += 1;
  });
  return forged;
}

const outcomeOf = (provider: Provider, hex: string): Promise<string> => provider.sendRawTransaction(hex)
  .then(() => 'ACCEPTED').catch((error: Error) => error.message);

describe('DYN-1: a free dynamic-chunk base cannot disable the chunk verifier', () => {
  it('refuses a forged chunk when the base witness is below -1, and keeps the honest value readable', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE);
    const inputs = artifact.abi.find((fn) => fn.name === 'setName')!.inputs.map((input) => input.name);
    expect(inputs).toContain('__internal__dynamicChunkInputBase');
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { name: '' }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    await sc.setName('first').send();
    await sc.setName('second').send();
    await expect(sc.expectName('second').send()).resolves.toBeDefined();

    const hex = await capture(provider, () => sc.setName('third').send());
    const tx = decodeTransactionUnsafe(hexToBin(hex)) as Tx;
    const patched = patchArgument(tx, inputs, '__internal__dynamicChunkInputBase', -5n);
    expect(patched).toBeGreaterThanOrEqual(1);
    // cspell:disable-next-line -- forged chunk value
    expect(forgeChunk(tx, 'third', 'thirX')).toBe(1);

    const outcome = await outcomeOf(provider, binToHex(encodeTransaction(tx)));
    expect(outcome).toContain('mandatory-script-verify-flag-failed');
    expectScriptRejection(outcome, 0);

    // The forged write never landed: the honest transaction built on the same outpoint still settles, and the
    // value every later read reassembles is the honest one, not the forged chunk.
    await expect(provider.sendRawTransaction(hex)).resolves.toBeTypeOf('string');
    await expect(sc.expectName('third').send()).resolves.toBeDefined();
  }, 300_000);

  it('ships the refusal in the message-bus build\'s direct entry', () => {
    const artifact = compileMessageBus(SOURCE, { messageBus: true, suppressWarnings: true });
    expect(artifact.messageBus?.available).toBe(true);
    // The route ABI keeps its own base witness (and its honest sentinel lane is unchanged); the direct entry that
    // the same artifact still exposes refuses a value below -1.
    expect(artifact.messageBus!.route.inputs.map((input) => input.name))
      .toContain('__internal__dynamicChunkInputBase');
    const bodies = artifact.functionBodies as unknown as Record<string, { bytecode?: string } | string>;
    const hexOf = (body: { bytecode?: string } | string): string =>
      (typeof body === 'string' ? body : (body.bytecode ?? ''));
    const directKey = Object.keys(bodies).find((key) => key !== artifact.messageBus!.selector);
    expect(directKey).toBeDefined();
    // `4f a2 69` is `OP_1NEGATE OP_GREATERTHANOREQUAL OP_VERIFY`; the pre-fix guard continued with `OP_IF` (0x63).
    expect(hexOf(bodies[directKey!]!)).toContain('4fa269');
  });
});
