import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileFile } from '../../src/compileFile.js';

// Upstream Solidity fixture (test/libsolidity/semanticTests/fallback/call_forward_bytes.sol): a `fallback`
// stores `msg.data` into a state `bytes`, and a public function forwards that stored blob through a low-level
// `address(...).call(...)`. The atomic route therefore decodes a stored calldata blob for a returning handler
// whose effect graph is a runtime emission handler. That handler returns its exhausted emission cursor above
// the returned scalar-journal context, and the route's row decoder declares a `__message_bus_value_*` local
// directly after the invocation; if the returned cursor is not modelled as one bank member, the exhausted-cursor
// check consumes a returned-context marker, the replacement loop eats the caller's declaration, and indexing that
// declaration later fails with `StackVariableUnavailableError`.
const FIXTURE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures/calldata-forward/CallForwardBytes.sol',
);

describe('calldata-forward route value local', () => {
  it('compiles the stored-calldata forward route under the conformance sweep options', () => {
    // Exactly the options the solc-corpus conformance sweep passes for unmodified upstream sources.
    const artifact = compileFile(FIXTURE, { evmCompat: true, enforceFinalRequire: false });

    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.map((handler) => handler.name)).toContain('__fallback');
    expect(artifact.bytecode.replace(/\s+/g, '')).toContain('OP_INVOKE');
  });
});
