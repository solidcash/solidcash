import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';

/**
 * X207/X227. There are four msg.value populations, but only the final dispatch population decides SCB1's
 * physical row format.
 *
 * `pay` reaches the first-pass msg.value set and is then demoted by route uniformity because its return value
 * makes the route result-shaped while its event is a physical effect. `get` survives. This is the X207 shape
 * that was previously only inferred. The compiler must publish the demotion
 * while keeping the surviving route narrow (`eligible && usesMsgValue` is empty).
 *
 * `orphan` establishes X227's fourth population: the code generator's contract-wide collector sees msg.value
 * in a private function outside every surviving handler closure. That population is frame plumbing, not a
 * format decision. Both the OP_DEFINE frame and its caller use the same contract-wide predicate, and every
 * parsed row declares `__scb_graph_msg_value` even in narrow mode (where the parser returns zero). It therefore
 * adds balanced dead context but cannot make a narrow blob wide or shift only one side of a call.
 *
 * EnglishAuction's `highestBid`, `endAt`, and `started` settlement proofs in
 * Layer3ValueModePopulationX199.test.ts exercise the same X227 runtime shape: refused `bid` makes the contract
 * collector true, the three surviving readers use no msg.value, and all three settle with the narrow format.
 */

const SOURCE = `
event Paid(int value);
contract FourPopulations {
    int public x;

    function get() public view returns (int) {
        return this.x;
    }

    function pay() public payable returns (int) {
        emit Paid(msg.value);
        return msg.value;
    }

    function orphan() private pure returns (int) {
        return msg.value;
    }
}`;

const OPTIONS = {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `a914${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
};

describe('X207/X227: msg.value populations', () => {
  const artifact = compileString(SOURCE, OPTIONS);
  const handlers = artifact.hiddenBatch!.handlers;

  it('reaches X207: uniformity demotes the first-pass payable handler', () => {
    expect(handlers.find((handler) => handler.name === 'pay')).toMatchObject({
      usesMsgValue: true,
      eligible: false,
      rejectionReason: 'result-route-requires-effect-free-handlers',
    });
    expect(handlers.filter((handler) => handler.eligible).map((handler) => handler.name).sort())
      .toEqual(['get']);
  });

  it('keeps the physical format on the final dispatch population', () => {
    const dispatchUsesValue = handlers.some((handler) =>
      handler.eligible === true && handler.usesMsgValue === true);
    expect(dispatchUsesValue).toBe(false);
    expect(artifact.hiddenBatch!.route).toBeDefined();
  });

  it('reaches X227 without publishing the private orphan as a handler', () => {
    expect(SOURCE).toContain('return msg.value;');
    expect(handlers.some((handler) => handler.name === 'orphan')).toBe(false);
    expect(handlers.filter((handler) => handler.usesMsgValue).map((handler) => handler.name))
      .toEqual(['pay']);
  });
});
