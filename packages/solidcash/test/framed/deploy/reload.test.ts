import { beforeEach, describe, expect, it } from 'vitest';
import { compileString } from '../../../../solidc/src/compiler.js';
import { COMPOSITION_LIMITS } from '../../../../solidc/test/framed/machine.js';
import { Signer } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { selectGenesisFundingUtxo } from '../../../src/stateful/ContractFactory.js';
import {
  clearGenesisReservations,
  genesisOutpointKey,
  isReservedGenesisOutpoint,
} from '../../../src/stateful/genesis-reservations.js';
import { CreateLookahead, takeReloadPoint } from '../../../src/framed/deploy/index.js';
import { CompositionPools } from '../../../src/framed/composer/index.js';

/**
 * Reloading a fixture: the mock chain and the SDK state derived from it.
 *
 * A fixture that reloads expects the SDK to be back where it was: the chain's own state, the signer's nonce and the
 * offers a look-ahead holds are all derived from the chain a point was taken over. The cases below take a point,
 * do work the reload is meant to undo, and assert what the SDK holds after restoring it - with the state the work
 * left beside it as the control that the restore is what moved it.
 */

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Child {'
  + '   int public total;'
  + '   constructor(int seed) { this.total = seed + 1; }'
  + '   function check(int v) { require(this.total == v); }'
  + ' }';
const artifact = compileString(SOURCE, { composition: 'framed' });

const keyOf = (utxo: { txid: string; vout: number }): string => genesisOutpointKey(utxo.txid, utxo.vout);

/** A signer over the relaxed mock, funded with `count` fresh vout-0 token-free UTXOs (each its own txid). */
async function fundedSigner(
  count: number, fill: number,
): Promise<{ signer: Signer; provider: MockNetworkProvider }> {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signer = new Signer(new Uint8Array(32).fill(fill), provider);
  for (let index = 0; index < count; index += 1) {
    const txid = `${fill.toString(16).padStart(2, '0')}${(index + 1).toString(16)}`.padEnd(64, '9');
    await provider.addUtxo(signer.getAddress(), { txid, vout: 0, satoshis: 1_000_000n });
  }
  return { signer, provider };
}

/** The ledger a fixture's deployments reserve masters and validators from. */
function ledger(): CompositionPools {
  return new CompositionPools({
    masters: { Child: ['child-1', 'child-2', 'child-3'] },
    validators: { Child: ['validator-1'] },
  });
}

// The registry is process-global, as the SDK's own is: a reservation made against one fixture's chain names a coin
// of that chain, so each case starts from none.
beforeEach(() => {
  clearGenesisReservations();
});

describe('a reload point over the mock chain and the look-ahead it funds', () => {
  it('puts the reservations and the ledger back, and the chain with them', async () => {
    const { signer, provider } = await fundedSigner(3, 0xb1);
    const lookahead = CreateLookahead.open({ signer, artifact });
    const pools = ledger();

    await lookahead.reserve(2);
    const held = lookahead.getReservedUtxos().map(keyOf);
    expect(held).toHaveLength(2);
    const point = await takeReloadPoint({ provider, ledgers: [pools] });

    // Everything the reload has to undo: a third coin reserved, a master and its validator taken, and a coin the
    // fixture's chain never had.
    await lookahead.reserve(3);
    const extra = lookahead.getReservedUtxos().map(keyOf).find((key) => !held.includes(key))!;
    expect(isReservedGenesisOutpoint(extra)).toBe(true);
    expect(pools.takeMaster('Child')).toBe('child-1');
    expect(pools.takeValidator('Child')).toBe('validator-1');
    await provider.addUtxo(signer.getAddress(), { txid: 'f'.repeat(63) + '0', vout: 0, satoshis: 1_000_000n });
    const beforeReload = await signer.getUtxos();

    // The control: with the work the reload will undo still in place, the only coin free to fund a genesis is the
    // one no reservation and no ledger holds.
    const free = (await signer.getUtxos()).filter((utxo) => !isReservedGenesisOutpoint(keyOf(utxo)));
    const selected = await selectGenesisFundingUtxo(signer, artifact);
    expect(free.map(keyOf)).toContain(keyOf(selected));

    await point.restore();

    // The reservations are the point's again: the coin the undone reservation held is free, the two it was taken
    // over are still held, and the ledger is back at its funded order.
    expect(isReservedGenesisOutpoint(extra)).toBe(false);
    for (const key of held) expect(isReservedGenesisOutpoint(key)).toBe(true);
    expect(pools.mastersTaken('Child')).toStrictEqual([]);
    expect(pools.takeMaster('Child')).toBe('child-1');
    expect(pools.takeValidator('Child')).toBe('validator-1');

    // The chain is the point's too: the coin the fixture never had is gone, and every UTXO the point was taken over
    // is back.
    const afterReload = await signer.getUtxos();
    expect(afterReload.map(keyOf).sort()).toStrictEqual(beforeReload
      .filter((utxo) => utxo.txid !== ('f'.repeat(63) + '0')).map(keyOf).sort());
  });

  it('restores the same point twice, so a fixture can reload it as often as it likes', async () => {
    const { signer, provider } = await fundedSigner(3, 0xb2);
    const lookahead = CreateLookahead.open({ signer, artifact });
    const pools = ledger();
    await lookahead.reserve(2);
    const held = lookahead.getReservedUtxos().map(keyOf);
    const point = await takeReloadPoint({ provider, ledgers: [pools] });

    for (let round = 0; round < 2; round += 1) {
      expect(pools.takeMaster('Child')).toBe('child-1');
      expect(pools.takeValidator('Child')).toBe('validator-1');
      await point.restore();
      for (const key of held) expect(isReservedGenesisOutpoint(key)).toBe(true);
      expect(pools.mastersTaken('Child')).toStrictEqual([]);
      expect(pools.hasValidator('Child')).toBe(true);
    }
  });

  it('drops the reservations on a bare rewind, so a fixture cannot keep a reordered chain\'s coins', async () => {
    const { signer, provider } = await fundedSigner(2, 0xb3);
    const lookahead = CreateLookahead.open({ signer, artifact });
    const chain = await provider.takeSnapshot();
    await lookahead.reserve(1);
    const held = lookahead.getReservedUtxos().map(keyOf);
    expect(held.filter((key) => isReservedGenesisOutpoint(key))).toStrictEqual(held);

    await chain.restore();
    // The rewind fired the reset hooks: a reservation names a coin of the chain it was made against, and the coin
    // this one names belongs to the work being undone.
    for (const key of held) expect(isReservedGenesisOutpoint(key)).toBe(false);
  });
});

