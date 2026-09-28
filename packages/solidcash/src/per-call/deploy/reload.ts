/**
 * Reloading an SDK-side test fixture: the mock chain and the process-local state derived from it.
 *
 * A fixture that rewinds the mock chain expects the SDK to be back where it was with it. The provider's own snapshot
 * restores the chain, the signer nonces and any cache that registered a reset hook; this module pairs that with the
 * state the SDK keeps apart from the chain - the genesis-outpoint reservations a create look-ahead holds, and the
 * master and validator ledgers a caller keeps for a fixture's deployments. A caller takes one point before the work
 * it wants to be able to reload, and restores it as often as it likes.
 *
 * The reservations are restored to the set the point was taken over, because a coin reserved since then belongs to
 * work that is being undone; a rewind on its own clears them, since a reservation names a coin of the chain that was
 * rewound. The ledgers are reset, so the next composition starts from the deployments' own order again.
 */

import type MockNetworkProvider from '../../network/MockNetworkProvider.js';
import {
  restoreGenesisReservations,
  snapshotGenesisReservations,
} from '../../stateful/genesis-reservations.js';
import type { CompositionPools } from '../composer/index.js';

/** A mock network provider that can snapshot itself. */
type SnapshottingProvider = Pick<MockNetworkProvider, 'takeSnapshot'>;

/** What a caller asks a reload point for. */
export interface ReloadPointOptions {
  /** The provider whose chain the point covers. */
  readonly provider: SnapshottingProvider;
  /** The ledgers to return to their funded order when the point is restored. */
  readonly ledgers?: readonly CompositionPools[];
}

/** One reload point: the provider's own handle to the chain, plus what the SDK held beside it. */
export interface ReloadPoint {
  /** Rewinds the chain, puts the reservations back and resets the ledgers. Repeatable. */
  readonly restore: () => Promise<void>;
}

/** Takes a reload point over a provider and the SDK state a fixture derives from it. */
export async function takeReloadPoint(options: ReloadPointOptions): Promise<ReloadPoint> {
  const chain = await options.provider.takeSnapshot();
  const reservations = snapshotGenesisReservations();
  const ledgers = [...(options.ledgers ?? [])];
  return {
    restore: async (): Promise<void> => {
      // The rewind fires every reset hook, which drops the reservations as chain-derived state; the point's own set
      // is what the fixture was working from, so it goes back afterwards.
      await chain.restore();
      restoreGenesisReservations(reservations);
      for (const ledger of ledgers) ledger.reset();
    },
  };
}
