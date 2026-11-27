/**
 * B6.0 (O8): every arm of a direct master starts from exactly the items the compiler models.
 *
 * The structural case reads the emitted program: an arm opens with `OP_DEPTH <n> OP_NUMEQUALVERIFY`, where n is the
 * physical depth the arm's model predicts. The hostile case drives the SDK's honest transaction through the mock
 * chain, then re-sends it with one push added and with the argument push removed; only the honest one is accepted.
 *
 * Arm kinds and the unlockings the SDK builds for them here: an entry (its arguments and selector), `receive` (no
 * push), `fallback` (its own selector, which the dispatcher takes as the call data it drops). A multi-call candidate's
 * standalone run is in ExactStackCallBatch.test.ts, and Deploy<C>'s `create` in DeployerPrologue.test.ts.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeAuthenticationInstructions, decodeTransactionUnsafe, encodeAuthenticationInstructions,
  encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { Op, asmToScript, scriptToBytecode, type Artifact } from '@solidcash/utils';
import { compileString } from '../src/index.js';
import { Contract, SignatureTemplate } from '../../solidcash/src/index.js';
import { StatefulContract } from '../../solidcash/src/stateful/index.js';
import { alicePub, alicePriv, alicePkh } from '../../solidcash/test/fixture/vars.js';
import {
  createFeeFunder, createTestProvider, expectScriptRejection, setupStatefulUtxos,
} from '../../solidcash/test/test-util.js';
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
    const artifact = compileString(SOURCE, { genesisCalls: true });
    const opcodes = decodeAuthenticationInstructions(
      scriptToBytecode(asmToScript(artifact.bytecode)),
    ).map((i) => i.opcode);
    const checks = opcodes.flatMap((opcode, index) => (
      opcode === Op.OP_DEPTH && opcodes[index + 2] === Op.OP_NUMEQUALVERIFY ? [opcodes[index + 1]!] : []
    ));
    // One visible argument, the return-carrier witness, the reader its record names, and the genesis call.
    expect(checks).toContain(0x54); // OP_4: the model's length at this entry
  });

  it('emits the check in each defined entry body', () => {
    const artifact = compileString(`pragma solidcash ^0.53.0;
contract C {
    int s;
    function a() { s = s + 1; }
    function b() { s = s + 2; }
}`);
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
    const artifact = compileString(SOURCE, { genesisCalls: true });
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

type Instruction = { opcode: number; data?: Uint8Array };

/** The instructions of a script, each push with its data. */
const instructionsOf = (bytecode: Uint8Array): Instruction[] => decodeAuthenticationInstructions(bytecode) as Instruction[];

/** The body a selector defines in a compiled program. */
const definedBody = (artifact: Artifact, selector: string): Uint8Array => {
  const instructions = instructionsOf(scriptToBytecode(asmToScript(artifact.bytecode)));
  const at = instructions.findIndex((instruction, index) => instruction.opcode === Op.OP_DEFINE
    && binToHex(instructions[index - 1]?.data ?? new Uint8Array()) === selector);
  expect(at, `a body defined under ${selector}`).toBeGreaterThan(1);
  return instructions[at - 2]!.data!;
};

/** `OP_DEPTH n OP_NUMEQUALVERIFY` in bytes, n a small number. */
const depthCheck = (n: number): number[] => [Op.OP_DEPTH, n === 0 ? Op.OP_0 : Op.OP_1 + n - 1, Op.OP_NUMEQUALVERIFY];

/** The master's input in a stateful spend: its block puts the minting record at the same index in and out. */
const masterIndex = (tx: ReturnType<typeof decodeTransactionUnsafe>): number => tx.outputs
  .findIndex((output) => output.token?.nft?.capability === 'minting');

/** The transaction with one empty push added to the input's unlocking, right before its redeem script. */
function withSurplusPush(hex: string, input: number): string {
  const tx = decodeTransactionUnsafe(hexToBin(hex));
  const instructions = decodeAuthenticationInstructions(tx.inputs[input]!.unlockingBytecode);
  tx.inputs[input]!.unlockingBytecode = encodeAuthenticationInstructions([
    ...instructions.slice(0, -1), { opcode: Op.OP_0 } as never, instructions[instructions.length - 1]!,
  ]);
  return binToHex(encodeTransaction(tx));
}

/** Sends a raw transaction and returns the mock chain's verdict. */
async function outcome(provider: Provider, hex: string): Promise<string> {
  try {
    await provider.sendRawTransaction(hex);
    return 'ACCEPTED';
  } catch (error) {
    return (error as Error).message;
  }
}

/** A stateful contract set up at a fresh genesis, and the honest raw spend of `entry` the SDK builds for it. */
async function honestSpend(
  artifact: Artifact, entry: string, initialState: Record<string, unknown>,
): Promise<{ provider: Provider; hex: string }> {
  const provider = createTestProvider();
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, initialState, { saltContract: true },
  );
  const builder = await (StatefulContract.withCategory(contract, categoryId) as any)[entry]().build();
  const { utxo, unlocker } = await createFeeFunder(provider, 20_000n);
  builder.addInput(utxo, unlocker);
  return { provider, hex: binToHex(encodeTransaction(builder.buildLibauthTransaction())) };
}

describe('B6.0: receive and fallback start from an exact stack', () => {
  const RECEIVER = `pragma solidity ^0.8.0;
contract Receiver {
  uint256 public x;
  function f() public { x = 1; }
  receive() external payable { x = 777; }
}`;
  // A fallback that takes its call data, which it rebuilds from its own input after the check.
  const FORWARDER = `pragma solidcash ^0.53.0;
contract Forwarder {
    int n;
    function bump() public { n = n + 1; }
    fallback(bytes input) external { require(input.length > 0); }
}`;

  it('opens the fallback with its check, before the call data it rebuilds from its input', () => {
    const artifact = compileString(FORWARDER);
    const fallback = artifact.abi.find((fn) => fn.name === '__fallback')!;
    const body = definedBody(artifact, fallback.selector!);
    // Its model holds the redeem length the program computes for msg.data, and not the call data it rebuilds after.
    expect([...body.slice(0, 3)]).toEqual(depthCheck(1));
  });

  it('receive: accepts the honest spend and refuses one surplus push', async () => {
    const artifact = compileString(RECEIVER, { evmCompat: true });
    const { provider, hex } = await honestSpend(artifact, '__receive', { x: 0n });
    const master = masterIndex(decodeTransactionUnsafe(hexToBin(hex)));
    expect(master).toBeGreaterThanOrEqual(0);
    // The SDK pushes no item for receive: the redeem script is the whole unlocking.
    expect(decodeAuthenticationInstructions(decodeTransactionUnsafe(hexToBin(hex)).inputs[master]!.unlockingBytecode))
      .toHaveLength(1);
    expectScriptRejection(await outcome(provider, withSurplusPush(hex, master)), master);
    expect(await outcome(provider, hex)).toBe('ACCEPTED');
  }, 120_000);

  it('fallback: accepts the honest spend and refuses one surplus push', async () => {
    const artifact = compileString(FORWARDER);
    const { provider, hex } = await honestSpend(artifact, '__fallback', { n: 0n });
    const master = masterIndex(decodeTransactionUnsafe(hexToBin(hex)));
    expect(master).toBeGreaterThanOrEqual(0);
    expectScriptRejection(await outcome(provider, withSurplusPush(hex, master)), master);
    expect(await outcome(provider, hex)).toBe('ACCEPTED');
  }, 120_000);
});
