import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import type { Artifact } from '@solidcash/utils';

// E4 - the complete context/outState admission matrix and its rejection policy.
//
// A route handler executes inside a compiler-generated SCB1 route rather than at its own entry point, so
// every value that describes "who called me, with what, where" has to be re-established. The compiler
// classifies each such value up front (`compiler.ts`, the `routeSensitive` walk) and refuses the handler
// outright when the batch value would silently differ from the direct one. This file pins the classification
// of EVERY context value the language exposes, in both admission modes, and the exact diagnostic used to
// refuse. Semantics of the admitted values are proven on the VM in `e2e/Layer3ContextE4.test.ts`.
//
// The three classes, and what each one means:
//
//   EQUIVALENT   the batch value is the same primitive read as the direct one. Nothing is re-established;
//                the value follows the real transaction/block/input exactly as it would directly.
//   LOGICAL      the batch value is deliberately redefined against a transcript-authenticated quantity,
//                because the direct definition has no meaning inside a route. Documented per row below.
//   REJECTED     the batch value cannot be reconciled, so the handler is refused at compile time with
//                `direct-versus-batch-introspection-divergence` and never reaches a route.
//
// | context value           | direct route (hidden batch) | graph route (message bus) | class      |
// |-------------------------|-----------------------------|---------------------------|------------|
// | this.activeInputIndex   | admitted                    | admitted                  | EQUIVALENT |
// | this.categoryId         | admitted                    | admitted                  | EQUIVALENT |
// | tx.inputs.length        | admitted                    | admitted                  | EQUIVALENT |
// | tx.outputs.length       | admitted                    | admitted                  | EQUIVALENT |
// | tx.version              | admitted                    | admitted                  | EQUIVALENT |
// | tx.locktime             | admitted                    | admitted                  | EQUIVALENT |
// | block.* (all 10)        | admitted                    | admitted                  | EQUIVALENT |
// | tx.gasprice             | admitted                    | admitted                  | EQUIVALENT |
// | msg.sig                 | REJECTED                    | admitted at leaf          | LOGICAL    |
// | msg.data                | REJECTED                    | admitted at leaf          | LOGICAL    |
// | msg.value               | admitted (alone only)       | admitted                  | LOGICAL    |
// | msg.sender              | REJECTED                    | admitted at leaf          | LOGICAL    |
// | tx.origin               | REJECTED                    | REJECTED                  | REJECTED   |
// | this.activeBytecode     | REJECTED                    | REJECTED                  | REJECTED   |
// | IFoo(a).outState.f      | admitted                    | admitted                  | EQUIVALENT |
//
// Why the two REJECTED rows are rejected, and why they stay rejected:
//
//   tx.origin scans the transaction for the first spendable non-token P2PKH input. In a graph transaction
//   that input is a funding slot chosen by whoever assembled the block layout, so the same handler would
//   read a different principal depending on assembly rather than on the call. The graph does have an
//   authenticated origin - the projection verifier pins the ROOT invocation's logical caller to `tx.origin`
//   - but that is the root's caller, not an ambient value every nested handler may read. Admitting the bare
//   ambient form would hand nested handlers a value no transcript field binds. `msg.sender` is the admitted
//   replacement and it is authenticated per invocation.
//
//   this.activeBytecode is OP_ACTIVEBYTECODE, which inside a route evaluates to the ROUTE's script, not the
//   handler's. There is no reading under which the two agree, so there is nothing to redefine it to.
//
// Several EVM-compatibility block values (block.gaslimit, block.basefee, block.blobbasefee, tx.gasprice)
// lower to fixed shims with no BCH analogue, which the compiler warns about. They are EQUIVALENT for the
// trivial reason that a constant does not vary with the route.
//
// Both are fail-closed at compile time: the handler is marked ineligible and no route is generated for it,
// so no SDK path and no covenant can reach the divergent value.
const DIVERGENCE = 'direct-versus-batch-introspection-divergence';

const graphOptions = {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
};
const directOptions = { forceStateful: true, experimentalHiddenBatch: true };

/** Each probe consumes its context value inside a `require`, so no pass can eliminate it. */
const PROBES: Readonly<Record<string, string>> = {
  'this.activeInputIndex': 'require(this.activeInputIndex >= 0 && seed > 0);',
  'this.categoryId': 'require(this.categoryId.length >= 0 && seed > 0);',
  'tx.inputs.length': 'require(tx.inputs.length > 0 && seed > 0);',
  'tx.outputs.length': 'require(tx.outputs.length > 0 && seed > 0);',
  'tx.version': 'require(tx.version >= 0 && seed > 0);',
  'tx.locktime': 'require(tx.locktime >= 0 && seed > 0);',
  'block.number': 'require(block.number >= 0 && seed > 0);',
  'block.timestamp': 'require(block.timestamp >= 0 && seed > 0);',
  'block.chainid': 'require(block.chainid >= 0 && seed > 0);',
  'block.coinbase': 'require(block.coinbase.length >= 0 && seed > 0);',
  'block.basefee': 'require(block.basefee >= 0 && seed > 0);',
  'block.difficulty': 'require(block.difficulty >= 0 && seed > 0);',
  'block.gaslimit': 'require(block.gaslimit >= 0 && seed > 0);',
  'block.prevrandao': 'require(block.prevrandao >= 0 && seed > 0);',
  'block.size': 'require(block.size >= 0 && seed > 0);',
  'block.totalFees': 'require(block.totalFees >= 0 && seed > 0);',
  'block.blobbasefee': 'require(block.blobbasefee >= 0 && seed > 0);',
  'tx.gasprice': 'require(tx.gasprice >= 0 && seed > 0);',
  'msg.sig': 'require(msg.sig.length == 4 && seed > 0);',
  'msg.data': 'require(msg.data.length >= 4 && seed > 0);',
  'msg.value': 'require(msg.value >= 0 && seed > 0);',
  'msg.sender': 'require(msg.sender.length >= 0 && seed > 0);',
  'tx.origin': 'require(tx.origin.length >= 0 && seed > 0);',
  'this.activeBytecode': 'require(this.activeBytecode.length > 0 && seed > 0);',
  '(no context value)': 'require(seed > 0);',
};

/** `graph` and `direct` are `true` when the probe handler is admitted into that route mode. */
const EXPECTED: Readonly<Record<string, { graph: boolean; direct: boolean }>> = {
  'this.activeInputIndex': { graph: true, direct: true },
  'this.categoryId': { graph: true, direct: true },
  'tx.inputs.length': { graph: true, direct: true },
  'tx.outputs.length': { graph: true, direct: true },
  'tx.version': { graph: true, direct: true },
  'tx.locktime': { graph: true, direct: true },
  'block.number': { graph: true, direct: true },
  'block.timestamp': { graph: true, direct: true },
  'block.chainid': { graph: true, direct: true },
  'block.coinbase': { graph: true, direct: true },
  'block.basefee': { graph: true, direct: true },
  'block.difficulty': { graph: true, direct: true },
  'block.gaslimit': { graph: true, direct: true },
  'block.prevrandao': { graph: true, direct: true },
  'block.size': { graph: true, direct: true },
  'block.totalFees': { graph: true, direct: true },
  'block.blobbasefee': { graph: true, direct: true },
  'tx.gasprice': { graph: true, direct: true },
  'msg.sig': { graph: true, direct: false },
  'msg.data': { graph: true, direct: false },
  'msg.value': { graph: true, direct: true },
  'msg.sender': { graph: true, direct: false },
  'tx.origin': { graph: false, direct: false },
  'this.activeBytecode': { graph: false, direct: false },
  '(no context value)': { graph: true, direct: true },
};

// `keepRoute` is context-free and always admitted, so the route survives even when `probe` is refused and
// the refusal can be read as a per-handler reason instead of a missing route.
const source = (body: string): string => `pragma solidcash >=0.8.0;
contract CtxProbe(int brand) {
  int total;
  function keepRoute(int seed) public {
    this.total = this.total + seed;
    require(true);
  }
  function probe(int seed) public {
    ${body}
    this.total = this.total + seed;
    require(true);
  }
}`;

const admission = (artifact: Artifact, name = 'probe'): { eligible: boolean; reason?: string } => {
  const handler = artifact.hiddenBatch?.handlers.find((entry) => entry.name === name);
  if (!handler) throw new Error(`no route handler '${name}'`);
  return { eligible: handler.eligible, reason: handler.rejectionReason };
};

describe('E4: context admission matrix', () => {
  it('classifies every exposed context value identically to the published matrix', () => {
    const measured: Record<string, { graph: boolean; direct: boolean }> = {};
    const reasons = new Set<string>();
    for (const [name, body] of Object.entries(PROBES)) {
      const graph = admission(compileString(source(body), graphOptions));
      const direct = admission(compileString(source(body), directOptions));
      measured[name] = { graph: graph.eligible, direct: direct.eligible };
      if (!graph.eligible) reasons.add(graph.reason!);
      if (!direct.eligible) reasons.add(direct.reason!);
    }
    expect(measured).toEqual(EXPECTED);
    // One diagnostic covers every refusal, in both modes. A new divergent value cannot slip in under a
    // different, unclassified reason without failing here.
    expect([...reasons]).toEqual([DIVERGENCE]);
  }, 900_000);

  it('fails tx.origin and this.activeBytecode closed in graph mode with no route to reach them', () => {
    for (const name of ['tx.origin', 'this.activeBytecode']) {
      const artifact = compileString(source(PROBES[name]), graphOptions);
      expect(admission(artifact)).toEqual({ eligible: false, reason: DIVERGENCE });
      // Fail-closed, not best-effort: the refused handler has no selector in the route's dispatch, so no
      // batch blob can name it and no covenant path exists that could supply a substitute value.
      expect(artifact.hiddenBatch!.handlers.filter((entry) => entry.eligible).map((entry) => entry.name))
        .toEqual(['keepRoute']);
      expect(artifact.hiddenBatch!.route.inputs.some((input) =>
        input.name.includes('graphTranscript'))).toBe(true);
    }
  }, 300_000);

  it('admits msg.value alone but refuses it beside another logical context value', () => {
    // The direct-mode carve-out is narrow and deliberate: outside graph mode `msg.value` is admitted only
    // when no other logical context value is present, because the pair cannot both be re-established from a
    // batch row. In graph mode the transcript supplies both, so the combination is admitted.
    const combined = 'require(msg.value >= 0 && msg.sender.length >= 0 && seed > 0);';
    expect(admission(compileString(source(combined), directOptions)))
      .toEqual({ eligible: false, reason: DIVERGENCE });
    expect(admission(compileString(source(combined), graphOptions)).eligible).toBe(true);
  }, 300_000);

  it('fails logical context closed when the same handler also emits an outgoing edge', () => {
    const emission = (predicate: string): string => `pragma solidcash >=0.8.0;
interface ICtxPeer { function next(int seed); }
contract CtxEmission(int brand, address peer) {
  function keepRoute(int seed) public { require(seed > 0); }
  function probe(int seed) public {
    ${predicate}
    ICtxPeer(peer).next(seed);
    require(true);
  }
}`;
    for (const name of ['msg.sender', 'msg.sig', 'msg.data']) {
      expect(admission(compileString(emission(PROBES[name]), graphOptions))).toEqual({
        eligible: false,
        reason: 'emission-handler-logical-context-reconstruction-unsupported',
      });
    }
    // The parsed per-row msg.value lowering is independent of the caller/selector/data operand and remains
    // admitted at this position; its multi-row execution is pinned by HiddenBatchRelease4.
    expect(admission(compileString(emission(PROBES['msg.value']), graphOptions)).eligible).toBe(true);
  }, 300_000);

  it('admits an outState read of a co-spent participant in both modes', () => {
    // `outState` is a read of the callee's authenticated post-state, not an ambient context value: it is
    // bound to a physical co-spent output either way, so it needs no re-establishment.
    const outStateSource = `pragma solidcash >=0.8.0;
interface ICtxPeer {
  public int count;
  function bump(int n);
}
contract CtxOutState(int brand, address peer) {
  int seen;
  function keepRoute(int n) public {
    this.seen = this.seen + n;
    require(true);
  }
  function observe(int n) public {
    ICtxPeer(peer).bump(n);
    int settled = ICtxPeer(peer).outState.count;
    require(settled >= 0);
    this.seen = settled + n;
    require(n >= 0);
  }
}`;
    const graph = compileString(outStateSource, graphOptions);
    expect(admission(graph, 'observe').eligible).toBe(true);
    // Without a controller the same handler is refused for a different, already-classified reason: a
    // stateful forward call has no graph edge to carry it. That is not a context divergence.
    const direct = admission(compileString(outStateSource, directOptions), 'observe');
    expect(direct).toEqual({ eligible: false, reason: 'batched-handler-forward-call-not-enabled' });
  }, 300_000);

  it('refuses a shared foreign outState read that source-orders before its settling call', () => {
    const source = `pragma solidcash >=0.8.0;
interface ICtxPeer {
  public int count;
  function bump(int n);
}
contract CtxEarlyOutState(int brand, address peer) {
  int seen;
  function keepRoute(int n) public {
    this.seen = this.seen + n;
    require(n >= 0);
  }
  function observe(int n) public {
    int unsettled = ICtxPeer(peer).outState.count;
    ICtxPeer(peer).bump(n);
    this.seen = unsettled;
    require(n >= 0);
  }
}`;
    expect(admission(compileString(source, graphOptions), 'observe')).toEqual({
      eligible: false,
      reason: 'foreign-outstate-read-precedes-shared-call-settlement',
    });
  }, 300_000);
});
