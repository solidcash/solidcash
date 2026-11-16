/**
 * O8 for an arm that can also run as a frame of the multi-call entry (`callBatch: true`).
 *
 * A frame holds the entry's other items below its own, so it cannot check its depth exactly; the entry does. A
 * standalone run of the same arm holds only its own items, so it checks its depth like every other arm: one
 * surplus push, which would shift every later read, is refused.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeAuthenticationInstructions, decodeTransactionUnsafe, encodeAuthenticationInstructions,
  encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { Op, asmToScript, scriptToBytecode } from '@solidcash/utils';
import { compileString } from '../src/index.js';
import { Contract, SignatureTemplate } from '../../solidcash/src/index.js';
import { StatefulContract } from '../../solidcash/src/stateful/index.js';
import { alicePub, alicePriv, alicePkh } from '../../solidcash/test/fixture/vars.js';
import { createTestProvider } from '../../solidcash/test/test-util.js';
import p2pkhArtifact from '../../solidcash/test/fixture/p2pkh.artifact.js';

const COUNTER = `pragma solidcash >=0.8.0;
contract Counter() {
  bigint count;
  function add(bigint value) public { this.count = this.count + value; }
  function get() public returns (bigint) { return this.count; }
}`;

type Provider = ReturnType<typeof createTestProvider>;

async function capture(provider: Provider, build: () => Promise<unknown>): Promise<string> {
  const send = provider.sendRawTransaction.bind(provider);
  let honest = '';
  (provider as unknown as { sendRawTransaction: (hex: string) => Promise<string> }).sendRawTransaction
    = async (hex: string): Promise<string> => {
      honest = hex;
      throw new Error('capture-only');
    };
  try {
    await expect(build()).rejects.toThrow('capture-only');
  } finally {
    (provider as unknown as { sendRawTransaction: typeof send }).sendRawTransaction = send;
  }
  return honest;
}

async function accepted(provider: Provider, hex: string): Promise<boolean> {
  try {
    await provider.sendRawTransaction(hex);
    return true;
  } catch {
    return false;
  }
}

describe('O8: a multi-call candidate checks its depth when it runs standalone', () => {
  it('emits the standalone depth check under the call context', () => {
    const artifact = compileString(COUNTER, { callBatch: true });
    const bytecode = scriptToBytecode(asmToScript(artifact.bytecode));
    const bodies = [bytecode, ...decodeAuthenticationInstructions(bytecode)
      .flatMap((instruction) => (instruction.data !== undefined && instruction.data.length > 8 ? [instruction.data] : []))];
    const pattern = [Op.OP_0, Op.OP_LESSTHAN, Op.OP_IF, Op.OP_DEPTH];
    const found = bodies.some((body) => {
      for (let i = 0; i + pattern.length + 3 <= body.length; i += 1) {
        if (pattern.every((opcode, k) => body[i + k] === opcode)
          && body[i + pattern.length + 1] === Op.OP_NUMEQUALVERIFY
          && body[i + pattern.length + 2] === Op.OP_ENDIF) return true;
      }
      return false;
    });
    expect(found).toBe(true);
  });

  it('opens each frame-capable entry with its call context and then the standalone check, before any other code', () => {
    const artifact = compileString(COUNTER, { callBatch: true });
    const frames = artifact.abi.filter((fn) => fn.callBatchRow === true);
    expect(frames.length).toBeGreaterThan(0);
    for (const fn of frames) {
      const body = hexToBin(artifact.functionBodies![fn.selector!]!);
      // Its arguments and the call context it took from the alternate stack.
      const n = fn.inputs.length + 1;
      expect([...body.slice(0, 9)], fn.name).toEqual([
        Op.OP_FROMALTSTACK, Op.OP_DUP, Op.OP_0, Op.OP_LESSTHAN, Op.OP_IF,
        Op.OP_DEPTH, Op.OP_1 + n - 1, Op.OP_NUMEQUALVERIFY, Op.OP_ENDIF,
      ]);
    }
  });

  it('refuses a surplus push in a standalone run and accepts the honest one', async () => {
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const artifact = compileString(COUNTER, { callBatch: true });
    const funding = { txid: 'c2c0'.repeat(16), vout: 0, satoshis: 300000n };
    await provider.addUtxo(p2pkh.address, funding);
    const deployed = await StatefulContract.deploy(artifact, [], {
      provider,
      fundingUtxo: funding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { count: 0n },
      changeAddress: p2pkh.address,
    });

    const honest = await capture(provider, () => deployed.contract.functions.add(7n).then((b) => b.send()));
    const tx = decodeTransactionUnsafe(hexToBin(honest));
    const instructions = decodeAuthenticationInstructions(tx.inputs[0].unlockingBytecode);
    const surplusTx = decodeTransactionUnsafe(hexToBin(honest));
    surplusTx.inputs[0].unlockingBytecode = encodeAuthenticationInstructions([
      ...instructions.slice(0, -1), { opcode: 0x00 } as never, instructions[instructions.length - 1]!,
    ]);
    expect(await accepted(provider, binToHex(encodeTransaction(surplusTx))), 'one surplus push').toBe(false);
    expect(await accepted(provider, honest), 'honest unlocking').toBe(true);
  });
});
