import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, encodeTransaction, hash256, hexToBin, sha256,
  utf8ToBin,
} from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh } from '../fixture/vars.js';

// A consumer forwards to a branded library facet with `L.f()`, and the facet emits an event under the consumer's
// category. The consumer pins the facet's identity and selector at its own block slot and defers that event family
// to the facet entry, whose census admits exactly the event output its layout declares. Two public functions make
// the library selector-dispatched, as a real facet is.
const LEDGER = `library Ledger {
  bigint total;
  event Bumped(bigint by);
  function bump(bigint by) public { this.total = this.total + by; emit Bumped(by); }
  function touch() public { this.total = this.total + 1; }
}`;
const BOOK = `import { Ledger } from "./ledger.scash";
contract Book() {
  bigint total;
  event Bumped(bigint by);
  function bump(bigint by) { Ledger.bump(by); }
  function touch() { Ledger.touch(); }
}`;

type Tx = ReturnType<typeof decodeTransactionUnsafe>;
type Captured = { hex: string; send: (hex: string) => Promise<string> };

// Builds and verifies the call without broadcasting it, so the transaction can be replayed with its outputs changed.
const capture = async (provider: any, call: () => Promise<unknown>): Promise<Captured> => {
  const send = provider.sendRawTransaction.bind(provider);
  let hex = '';
  provider.sendRawTransaction = async (raw: string): Promise<string> => {
    hex = raw;
    return binToHex(hash256(hexToBin(raw)).reverse());
  };
  try {
    await call();
  } finally {
    provider.sendRawTransaction = send;
  }
  expect(hex).not.toBe('');
  return { hex, send };
};

describe('a library facet event under its consumer\'s category', () => {
  // Mock-only: both categories are pre-chosen (categoryOverride seeds them with addUtxo), which breaks the link
  // cycle - the consumer embeds the facet address, and the facet is branded to the consumer's category.
  it.skipIf(process.env.TESTS_USE_REGTEST)('settles at its declared output and refuses every other event carrier',
    async () => {
      const provider = createTestProvider();
      const resolver = (p: string): { source: string; id: string } | undefined =>
        (p.includes('ledger') ? { source: LEDGER, id: 'ledger' } : undefined);
      const ledgerArt = compileString(LEDGER, { brandLibrary: true });
      const bookArt = compileString(BOOK, { importResolver: resolver });
      const bookCat = binToHex(sha256.hash(utf8ToBin('library facet events: book')));
      const ledgerCat = binToHex(sha256.hash(utf8ToBin('library facet events: ledger')));

      const ledger = StatefulContract.brandedLibrary(ledgerArt, bookCat, { provider });
      const ledgerAddr = hexToBin(ledger.withCategory(hexToBin(ledgerCat)).lockingBytecode);
      const book = new Contract(bookArt, [ledgerAddr], { provider });
      await setupStatefulUtxos(
        provider, ledger, ledgerArt.stateLayout!, { total: 0n }, { saltContract: true, categoryOverride: ledgerCat },
      );
      await setupStatefulUtxos(
        provider, book, bookArt.stateLayout!, { total: 0n }, { saltContract: true, categoryOverride: bookCat },
      );
      const bookSc = StatefulContract.withCategory(book, bookCat);
      bookSc.registerLibrary('Ledger', StatefulContract.withCategory(ledger, ledgerCat));

      // The consumer-category immutable outputs at a spendable lock: the event carriers a reader would accept.
      const category = [bookCat, binToHex(hexToBin(bookCat).reverse())];
      const carriers = (tx: Tx): number[] => tx.outputs.flatMap((output, index) => (
        output.token?.nft?.capability === 'none' && category.includes(binToHex(output.token.category))
        && binToHex(output.lockingBytecode) !== '51' ? [index] : []));
      const tamper = async ({ hex, send }: Captured, mutate: (tx: Tx) => Promise<void> | void): Promise<string> => {
        const tx = decodeTransactionUnsafe(hexToBin(hex));
        await mutate(tx);
        return send(binToHex(encodeTransaction(tx)));
      };
      // A further consumer-category immutable carrier at `lock`, paid for by a fresh anyone-can-spend coin added as
      // an input (with change back to it), so no honest output changes and only the census can refuse it.
      let coins = 0;
      const addCarrier = async (tx: Tx, template: Tx['outputs'][number], lock: Uint8Array): Promise<void> => {
        coins += 1;
        const coin = { txid: binToHex(sha256.hash(utf8ToBin(`carrier coin ${coins}`))), vout: 0, satoshis: 10_000n };
        await provider.addUtxo('51', coin);
        tx.inputs.push({
          outpointTransactionHash: hexToBin(coin.txid), outpointIndex: 0,
          sequenceNumber: tx.inputs[0].sequenceNumber, unlockingBytecode: new Uint8Array(),
        });
        const nft = template.token!.nft!;
        tx.outputs.push({
          lockingBytecode: lock.slice(),
          valueSatoshis: template.valueSatoshis,
          token: { ...template.token!, nft: { ...nft, commitment: nft.commitment.slice() } },
        });
        tx.outputs.push({ lockingBytecode: hexToBin('51'), valueSatoshis: coin.satoshis - template.valueSatoshis - 1_000n });
      };
      // The consumer's census defers to the facet entry at its derived slot (master, data NFTs, then the facet), so it
      // is the facet input that refuses each carrier.
      const facetInput = 1 + bookArt.stateLayout!.dataNftCount;
      const refused = new RegExp(`mandatory-script-verify-flag-failed.*input index ${facetInput}:`);

      // The event-emitting entry: one carrier, at the facet's declared event output.
      const bump = await capture(provider, () => bookSc.call.bump(5n).send());
      const honest = decodeTransactionUnsafe(hexToBin(bump.hex));
      expect(carriers(honest)).toHaveLength(1);
      const at = carriers(honest)[0];
      const event = honest.outputs[at];

      // A second copy of the event, past its declared output.
      await expect(tamper(bump, (tx) => addCarrier(tx, event, event.lockingBytecode))).rejects.toThrow(refused);
      // The event moved off its declared output.
      await expect(tamper(bump, (tx) => {
        const last = tx.outputs.length - 1;
        [tx.outputs[at], tx.outputs[last]] = [tx.outputs[last], tx.outputs[at]];
      })).rejects.toThrow(refused);
      // An extra carrier at a key's lock beside the genuine event.
      await expect(tamper(bump, (tx) => addCarrier(tx, event, encodeLockingBytecodeP2pkh(alicePkh))))
        .rejects.toThrow(refused);
      await expect(bump.send(bump.hex)).resolves.toBeTypeOf('string');
      expect((await bookSc.getState()).total).toBe(5n);

      // An entry that emits nothing admits no carrier at all: the event copied into it is refused.
      const touch = await capture(provider, () => bookSc.call.touch().send());
      expect(carriers(decodeTransactionUnsafe(hexToBin(touch.hex)))).toHaveLength(0);
      await expect(tamper(touch, (tx) => addCarrier(tx, event, event.lockingBytecode))).rejects.toThrow(refused);
      await expect(touch.send(touch.hex)).resolves.toBeTypeOf('string');
      expect((await bookSc.getState()).total).toBe(6n);
    });
});
