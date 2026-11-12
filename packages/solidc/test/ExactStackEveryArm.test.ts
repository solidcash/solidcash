/**
 * B6.0 (O8): every arm of a direct master starts from exactly the items the compiler models.
 *
 * The structural case reads the emitted program: an arm opens with `OP_DEPTH <n> OP_NUMEQUALVERIFY`, where n is the
 * physical depth the arm's model predicts. The hostile case drives the SDK's honest transaction through the mock
 * chain, then re-sends it with one push added and with the argument push removed; only the honest one is accepted.
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

const SOURCE = `
contract C {
    int calls;
    event Called(int amount);
    function hit(int amount) {
        emit Called(amount);
        calls = calls + 1;
    }
}
`;

type Provider = ReturnType<typeof createTestProvider>;

/** Runs `build`, captures what it would broadcast, and refuses to broadcast it. */
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

/** Sends a raw transaction and returns whether the mock chain accepted it. */
async function accepted(provider: Provider, hex: string): Promise<boolean> {
  const send = provider.sendRawTransaction.bind(provider);
  try {
    await send(hex);
    return true;
  } catch {
    return false;
  }
}

describe('B6.0: an arm starts from an exact stack', () => {
  /** The body bytes of every OP_DEFINE in a compiled program. */
  const definedBodies = (asm: string): Uint8Array[] => {
    const instructions = decodeAuthenticationInstructions(scriptToBytecode(asmToScript(asm)));
    return instructions.flatMap((instruction, index) => (
      instruction.opcode === Op.OP_DEFINE && instructions[index - 2]?.data !== undefined
        ? [instructions[index - 2]!.data!] : []
    ));
  };

  it('emits OP_DEPTH n OP_NUMEQUALVERIFY at the start of an inlined sole entry', () => {
    const artifact = compileString(SOURCE, { messageBus: false });
    const opcodes = decodeAuthenticationInstructions(
      scriptToBytecode(asmToScript(artifact.bytecode)),
    ).map((i) => i.opcode);
    const checks = opcodes.flatMap((opcode, index) => (
      opcode === Op.OP_DEPTH && opcodes[index + 2] === Op.OP_NUMEQUALVERIFY ? [opcodes[index + 1]!] : []
    ));
    // One visible argument, the return-carrier witness, and the genesis call.
    expect(checks).toContain(0x53); // OP_3: the model's length at this entry
  });

  it('emits the check in each defined entry body', () => {
    const artifact = compileString(`pragma solidcash ^0.50.0;
contract C {
    int s;
    function a() { s = s + 1; }
    function b() { s = s + 2; }
}`, { messageBus: false });
    const checkHeads = definedBodies(artifact.bytecode).filter((body) => (
      body[0] === Op.OP_DEPTH && body[2] === Op.OP_NUMEQUALVERIFY
    ));
    expect(checkHeads.length).toBeGreaterThanOrEqual(2);
    // n is the model's length: a small OP_n for these two entries.
    expect(checkHeads.every((body) => body[1]! >= 0x51 && body[1]! <= 0x60)).toBe(true);
  });

  it('accepts the honest unlocking and refuses one surplus push or one missing push', async () => {
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const artifact = compileString(SOURCE, { messageBus: false });
    const funding = { txid: 'c1c0'.repeat(16), vout: 0, satoshis: 300000n };
    await provider.addUtxo(p2pkh.address, funding);
    const deployed = await StatefulContract.deploy(artifact, [], {
      provider,
      fundingUtxo: funding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { calls: 0n },
      changeAddress: p2pkh.address,
    });

    const honest = await capture(provider, () => deployed.contract.functions.hit(7n).then((b) => b.send()));
    const tx = decodeTransactionUnsafe(hexToBin(honest));
    const master = 0;
    const instructions = decodeAuthenticationInstructions(tx.inputs[master].unlockingBytecode);
    expect(instructions.length).toBeGreaterThan(2);

    // One surplus push right before the redeem script.
    const surplus = [
      ...instructions.slice(0, -1),
      { opcode: 0x00 } as never,
      instructions[instructions.length - 1]!,
    ];
    const surplusTx = decodeTransactionUnsafe(hexToBin(honest));
    surplusTx.inputs[master].unlockingBytecode = encodeAuthenticationInstructions(surplus);
    const missingTx = decodeTransactionUnsafe(hexToBin(honest));
    missingTx.inputs[master].unlockingBytecode = encodeAuthenticationInstructions([
      instructions[0]!, ...instructions.slice(2),
    ]);

    expect(await accepted(provider, binToHex(encodeTransaction(surplusTx))), 'one surplus push').toBe(false);
    expect(await accepted(provider, binToHex(encodeTransaction(missingTx))), 'one missing push').toBe(false);
    expect(await accepted(provider, honest), 'honest unlocking').toBe(true);
  });
});
