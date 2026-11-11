import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

// A token's `_transfer` helper shape: it emits and returns a value, and its early return is NOT the statement
// before the tail (`if (paused) return false; ...; emit Transfer(..); return true;`). Such a helper cannot run
// behind OP_INVOKE (the callee's block layout owns the event), so it must inline. The existing normalization
// only folded an early return that sat directly before the tail; the guarded form below leaves the helper with
// two returns and `eligibleShape` refuses it. Route synthesis then refuses the retained emitting helper, every
// message-bus rung fails, and the whole artifact silently falls back to direct-only. That is what the parity
// suite's fee-on-transfer test token hit: its route did not exist, so `transferFrom` and `balanceOf` could
// never compose.
const TOKEN = `
pragma solidcash >=0.8.0;
contract Token {
    mapping(address => int) balances;
    bool paused;

    event Transfer(address from, address to, int value);

    function transfer(address to, int value) public returns (bool) {
        return _transfer(msg.sender, to, value);
    }

    function transferFrom(address from, address to, int value) public returns (bool) {
        return _transfer(from, to, value);
    }

    function _transfer(address from, address to, int value) internal returns (bool) {
        if (paused) return false;
        balances[from] -= value;
        balances[to] += value;
        emit Transfer(from, to, value);
        return true;
    }
}
`;

describe('emitting returning helper with a non-adjacent early return', () => {
  it('inlines the helper so the token keeps its message-bus route', () => {
    const artifact = compileString(TOKEN, {
      messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
      allowUnsafeOperations: true, suppressWarnings: true,
    });
    // The route is synthesized rather than replaced by the direct-only fallback.
    expect(artifact.compiler.options.messageBus).toBe(true);
    expect(artifact.messageBus).toBeDefined();
    // Both callers reach the same inlined body, so each is an admitted route handler.
    expect(artifact.messageBus?.admittedHandlerIds).toContain('transfer');
    expect(artifact.messageBus?.admittedHandlerIds).toContain('transferFrom');
  });

  it('keeps the helper out of the compiled ABI (it was inlined, not left behind)', () => {
    const artifact = compileString(TOKEN, {
      messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
      allowUnsafeOperations: true, suppressWarnings: true,
    });
    expect(artifact.abi.find((entry) => entry.name === '_transfer')).toBeUndefined();
  });
});
