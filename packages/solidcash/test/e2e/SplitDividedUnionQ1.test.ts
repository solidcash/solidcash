import { describe, expect, it } from 'vitest';
import { compileStringSplit } from '@solidcash/solidc';
import { Signer } from '../../src/index.js';
import { SplitContractBundle } from '../../src/stateful/index.js';
import { alicePriv } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

/**
 * Q1 row B. A DIVIDED CALL-EDGE UNION MUST STILL EVALUATE.
 *
 * The packer can now dissolve a hard-closure union that does not fit, leaving the callee's BODY in the
 * caller's facet as a plain internal helper while the callee's ENTRY lives in a different facet. A smaller
 * script that stops working is worse than an oversized one that never deployed, so the division is settled on
 * the VM from both sides:
 *
 *   - the caller entry, whose facet reaches the demoted body only through the internal call;
 *   - the callee entry, in the other facet, through its own route.
 *
 * Both write the SAME state variable, so the two facets agreeing about that slot is what is actually proven.
 */
const SOURCE = `pragma solidity ^0.8.7;
contract Pair {
  uint total;
  uint touched;
  function publish(uint256 v) public {
    touched = v;
    updateTail(v * 2);
    require(v != 100000000000000000000000000000000000001);
    require(v != 100000000000000000000000000000000000002);
    require(v != 100000000000000000000000000000000000003);
    require(v >= 0, "n");
  }
  function updateTail(uint256 v) public {
    total = total + v;
    require(v != 200000000000000000000000000000000000001);
    require(v != 200000000000000000000000000000000000002);
    require(v != 200000000000000000000000000000000000003);
    require(v >= 0, "n");
  }
}`;

async function fundedSigner(): Promise<Signer> {
  const provider = createTestProvider();
  const signer = new Signer(alicePriv, provider);
  for (const byte of ['a1', 'b2', 'c3', 'd4', 'e5', 'f6']) {
    await provider.addUtxo(signer.getAddress(), { txid: byte.repeat(32), vout: 0, satoshis: 1_000_000n });
  }
  return signer;
}

describe('Q1 row B: a divided call-edge union settles on the VM', () => {
  it('settles both the caller and the separately-routed callee against one shared state', async () => {
    const options = { evmCompat: true, forceSplit: true };
    const union = compileStringSplit(SOURCE, options);
    const unionBytes = union.manifest.facets[0].estimatedRedeemBytes;
    expect([...union.manifest.facets[0].functions].sort()).toEqual(['publish', 'updateTail']);

    // The root gained mandatory state-output/cardinality pins; this source deliberately carries enough unique
    // entry logic that the root fits below the one-byte-too-small union cap while each divided facet still fits.
    const divided = compileStringSplit(SOURCE, { ...options, maxShardBytes: unionBytes - 1 });
    expect(divided.manifest.facets).toHaveLength(2);
    const publishRoute = divided.manifest.routes.find((route) => route.function === 'publish')!;
    const tailRoute = divided.manifest.routes.find((route) => route.function === 'updateTail')!;
    expect(publishRoute.target).not.toBe(tailRoute.target);
    console.log(`[Q1-B] union=${unionBytes}B divided=${divided.manifest.facets
      .map((f) => `${f.functions.join('|')}:${f.estimatedRedeemBytes}`).join(' ')}`);

    const signer = await fundedSigner();
    const deployed = await SplitContractBundle.from(divided, signer)
      .deploy([], { initialState: { total: 0n, touched: 0n } });

    // The caller's facet runs the DEMOTED body: publish(5) writes touched=5 and adds 10 to total.
    const publishTx = await deployed.call.publish(5n).send();
    expect(publishTx.txid).toBeDefined();
    let state = await deployed.root.getState();
    expect(state.touched).toBe(5n);
    expect(state.total).toBe(10n);

    // The callee's own entry, in the OTHER facet, adds to the same slot the demoted copy just wrote.
    const tailTx = await deployed.call.updateTail(7n).send();
    expect(tailTx.txid).toBeDefined();
    state = await deployed.root.getState();
    expect(state.total).toBe(17n);
    expect(state.touched).toBe(5n);
  });

  /**
   * The demoted copy loses its entry-point return channel, because an internal caller consumes the value on
   * the stack instead. The callee's OWN facet still publishes one. Both halves are settled here so that
   * asymmetry is proven rather than assumed.
   */
  it('settles a divided union whose demoted callee RETURNS a value', async () => {
    const source = `pragma solidity ^0.8.7;
      contract PairR {
        uint total;
        uint touched;
        function publish(uint256 v) public {
          touched = tail(v * 2);
          require(v >= 0, "n");
        }
        function tail(uint256 v) public returns (uint256) {
          total = total + v;
          require(v >= 0, "n");
          return v + 1;
        }
      }`;
    const options = { evmCompat: true, forceSplit: true };
    const union = compileStringSplit(source, options);
    const divided = compileStringSplit(source, {
      ...options, maxShardBytes: union.manifest.facets[0].estimatedRedeemBytes - 1,
    });
    expect(divided.manifest.facets).toHaveLength(2);
    console.log(`[Q1-B] returning union=${union.manifest.facets[0].estimatedRedeemBytes}B divided=${divided
      .manifest.facets.map((f) => `${f.functions.join('|')}:${f.estimatedRedeemBytes}`).join(' ')}`);

    const signer = await fundedSigner();
    const deployed = await SplitContractBundle.from(divided, signer)
      .deploy([], { initialState: { total: 0n, touched: 0n } });
    await deployed.call.publish(5n).send();
    let state = await deployed.root.getState();
    expect(state.total).toBe(10n);
    expect(state.touched).toBe(11n);
    await deployed.call.tail(3n).send();
    state = await deployed.root.getState();
    expect(state.total).toBe(13n);
    expect(state.touched).toBe(11n);
  });

  /**
   * GUARD NEGATIVE CONTROL. The same source at a limit that admits the union is NOT divided, settles the same
   * way, and reaches the same state - so the assertions above are about the division, not about the fixture.
   */
  it('CONTROL: the undivided union reaches the identical state', async () => {
    const union = compileStringSplit(SOURCE, { evmCompat: true, forceSplit: true });
    expect(union.manifest.facets).toHaveLength(1);
    const signer = await fundedSigner();
    const deployed = await SplitContractBundle.from(union, signer)
      .deploy([], { initialState: { total: 0n, touched: 0n } });
    await deployed.call.publish(5n).send();
    await deployed.call.updateTail(7n).send();
    const state = await deployed.root.getState();
    expect(state.total).toBe(17n);
    expect(state.touched).toBe(5n);
  });
});
