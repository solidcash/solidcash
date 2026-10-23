import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, decodeAuthenticationInstructions, decodeTransactionUnsafe,
  encodeAuthenticationInstructions, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileStringMulti } from '@solidcash/solidc';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, expectScriptRejection, setupStatefulUtxos } from '../test-util.js';

/**
 * DX-4: the callee's `_returnOutputIdx` witness is free. Set to -1 the callee pins no return carrier, so the
 * spender could mint its own carrier of the callee's category (the co-spent minting master authorizes it) and
 * hand the caller a forged return value. A standalone callee now refuses any own-category return carrier.
 */

const SOURCE = `
interface IQuote { function quote() external returns (int); }
contract Quoter { int q; function setQ(int v) public { this.q = v; } function quote() public returns (int) {
  return this.q; } }
contract Reader { int seen; function sync(address src) public { this.seen = IQuote(src).quote(); } }`;

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;

interface Deployed {
  provider: Provider; quoter: StatefulContract<any>; reader: StatefulContract<any>;
  quoterAddr: Uint8Array; quoteInputs: string[];
}

async function deploy(quote = 5n): Promise<Deployed> {
  const provider = createTestProvider();
  const arts = compileStringMulti(SOURCE, {});
  const q = new Contract(arts.Quoter, [], { provider });
  const { categoryId: quoterCat } = await setupStatefulUtxos(
    provider, q, arts.Quoter.stateLayout!, { q: 0n }, { saltContract: true },
  );
  const quoterAddr = hexToBin(q.withCategory(hexToBin(quoterCat)).lockingBytecode);
  const r = new Contract(arts.Reader, [], { provider });
  const { categoryId: readerCat } = await setupStatefulUtxos(
    provider, r, arts.Reader.stateLayout!, { seen: 0n }, { saltContract: true },
  );
  const quoter = StatefulContract.withCategory(q, quoterCat);
  const reader = StatefulContract.withCategory(r, readerCat);
  await quoter.setQ(quote).send();
  const quoteInputs = arts.Quoter.abi.find((fn) => fn.name === 'quote')!.inputs.map((input) => input.name);
  return { provider, quoter, reader, quoterAddr, quoteInputs };
}

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

const outcomeOf = (provider: Provider, hex: string): Promise<string> => provider.sendRawTransaction(hex)
  .then(() => 'ACCEPTED').catch((e: Error) => e.message);

/**
 * The honest call at quote 5 with the callee's `_returnOutputIdx` set to -1, and the carrier and the caller's state
 * outputs taken from an honest call at quote 9: the caller settles 9 while the callee's state still says 5.
 */
function forgeStandaloneReturn(
  { quoteInputs }: Deployed, hex: string, forgedHex: string,
): { hex: string; input: number } {
  const tx = decodeTransactionUnsafe(hexToBin(hex));
  const source = decodeTransactionUnsafe(hexToBin(forgedHex));
  expect(source.outputs.length).toBe(tx.outputs.length);
  const isCarrier = (o: Tx['outputs'][number]): boolean => binToHex(o.lockingBytecode) === '51'
    && o.token?.nft?.capability === 'none';
  expect(tx.outputs.filter(isCarrier)).toHaveLength(1);
  const carrier = tx.outputs.findIndex(isCarrier);
  const quoterCat = binToHex(tx.outputs[carrier].token!.category);
  tx.outputs.forEach((output, index) => {
    const from = source.outputs[index].token?.nft;
    if (output.token?.nft === undefined || from === undefined) return;
    if (index !== carrier && binToHex(output.token.category) === quoterCat) return;
    output.token.nft.commitment = from.commitment.slice();
  });
  expect(binToHex(tx.outputs[carrier].token!.nft!.commitment))
    .toBe(binToHex(source.outputs[carrier].token!.nft!.commitment));

  // ABI input i is the (i+1)-th push before the redeem.
  const position = quoteInputs.indexOf('__internal__returnOutputIdx');
  expect(position).toBeGreaterThanOrEqual(0);
  let input = -1;
  tx.inputs.forEach((candidate, index) => {
    const instructions = decodeAuthenticationInstructions(candidate.unlockingBytecode);
    const at = instructions.length - 2 - position;
    const witness = instructions[at] as { opcode: number; data?: Uint8Array } | undefined;
    if (at < 0 || witness === undefined || instructions.length !== quoteInputs.length + 2) return;
    const value = witness.data !== undefined ? binToHex(witness.data)
      : witness.opcode >= 0x51 && witness.opcode <= 0x60 ? binToHex(bigIntToVmNumber(BigInt(witness.opcode - 0x50)))
        : '';
    if (value !== binToHex(bigIntToVmNumber(BigInt(carrier)))) return;
    instructions[at] = { opcode: 0x4f } as any;
    candidate.unlockingBytecode = encodeAuthenticationInstructions(instructions);
    input = index;
  });
  expect(input).toBeGreaterThanOrEqual(0);
  return { hex: binToHex(encodeTransaction(tx as Tx)), input };
}

describe('DX-4: an external call return value is always authenticated by the callee', () => {
  it('settles an honest call that uses the callee return value', async () => {
    const { quoter, reader, quoterAddr } = await deploy();
    await reader.sync(quoterAddr).withExternalCall(quoter, 'quote', []).send();
    expect((await reader.getState()).seen).toBe(5n);
    await expect(quoter.setQ(7n).send()).resolves.toBeDefined();
  }, 300_000);

  // The forged carrier is crafted on the mock; a live node would refuse it for the same script failure.
  it.skipIf(Boolean(process.env.TESTS_USE_REGTEST))(
    'refuses a standalone callee beside a self-minted return carrier', async () => {
      const deployed = await deploy();
      const { provider, quoter, reader, quoterAddr } = deployed;
      const hex = await capture(provider, () => reader.sync(quoterAddr).withExternalCall(quoter, 'quote', []).send());
      const other = await deploy(9n);
      const forgedHex = await capture(other.provider,
        () => other.reader.sync(other.quoterAddr).withExternalCall(other.quoter, 'quote', []).send());
      const forged = forgeStandaloneReturn(deployed, hex, forgedHex);
      const outcome = await outcomeOf(provider, forged.hex);
      const seen = outcome === 'ACCEPTED' ? (await reader.getState()).seen : undefined;
      expect(seen).toBeUndefined();
      expectScriptRejection(outcome, forged.input);

      await expect(provider.sendRawTransaction(hex)).resolves.toBeTypeOf('string');
      expect((await reader.getState()).seen).toBe(5n);
    }, 300_000,
  );
});
