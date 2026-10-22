# Call result binding in every composition mode (design)

Kind: design, 2026-10-22. Replaces the held callee-side binding `ce51b6f18` (branch
`worktree-agent-ae6a0ed55c350b8f7`). User: "should be solved in the best possible manner in all composition modes.
I do not want either/or, I want the proper solution enabling most cases in a general way."

## 1. What each mode binds today

| Mode | What the caller's read is bound to | Unbound or refused |
| --- | --- | --- |
| Framed | a call record: `argsHash = sha256(selector \|\| argument pushes)` from the caller's own operands, checked against the callee's call data, and `result == retval` (V5, V6) | nothing; two calls to one callee use two pool masters |
| Message bus, kernel | a row: owner, consumer, ordinal, selector, arguments and result, under the verifier's `sha256(callManifest)` | at most 8 participants, 24 rows, a 10,000-byte result vector |
| Direct | the carrier's category (the co-spent master's), and the selector only for a multi-function callee | arguments; a counted loop (D6); a repeated returning call shares one callee run, so its other carriers are free; a target with no static identity; the caller-side carrier count (H2) is skipped or miscounts in several shapes |
| Direct delegatecall, proxy | the selector after the delegate-index push | arguments; an extra proxy-category carrier (D11) |
| Direct split facet | as direct | as direct; one root call per transaction |

Two facts set the design. A direct carrier can tie a read to one callee run, and a callee spent once runs one function
body. Binding each call's own result therefore needs a record per call that names the call it answers, and a callee
that can run several calls in one spend.

## 2. The record

A direct return carrier becomes a call record:

    commitment = callDigest || resultField
    callDigest  = sha256(ordinal || selector || argument pushes)      32 bytes
    resultField = the encoded return blob when 32 + its size <= 128, else sha256(blob) (the blob rides in the
                  caller's witness, as an oversized result does today)

- The argument pushes are the framed convention's encoding (`callerArgumentDigest`), so one helper serves both modes.
- `ordinal` is the call's position among the invocations of that callee in this transaction (0 for a single call):
  two identical view calls with a write between them read different records.
- The carrier keeps today's form: the callee's category, no capability, no fungible amount, `OP_TRUE`, at most 1,200
  satoshis.

## 3. The callee

- Every externally callable function that returns values computes `callDigest` over the call it is executing (its own
  selector, its own arguments, its ordinal) and pins the record at its witness output index, as
  `emitReturnEventCheck` pins the blob now.
- Completeness: every `OP_TRUE` output of the callee's category must be a record it pinned in this run. This replaces
  the caller-side count (H2) and the held commit's "every carrier holds my one commitment", which refused honest
  double calls.
- One spend, several calls: the Release-5 batch entry (`SCB1`) that already runs repeated void calls as rows also runs
  returning rows. Each row executes its function body in order, with state chaining through the rows as it does for
  void rows, and pins its own record at its own index with its own ordinal.

## 4. The caller

- Each call site computes `callDigest` from its own operands and ordinal, reads its record at its witness index, and
  requires its category to be the target's and its digest to be its own. Then it decodes the result.
- Target identity: a static target uses its fingerprint as today. For a dynamic target (an `address` value, a
  function pointer, an array element), the caller locates the co-spent input whose locking bytecode equals the target
  through a witness index, and requires the record's category to be that input's.
- Loops: iteration i computes its own digest with ordinal base+i and reads its own record. This binds the counted loops
  that D6 left unbound.
- Conditional calls: an untaken call reads nothing. A taken one is bound like any other. The SDK publishes no alias
  carrier.
- Identical calls with nothing between them may share one record. The compiler lets two sites share an ordinal only
  when no write to that callee can run between them.

## 5. Delegatecall, proxies and split facets

- The implementation, or the facet, computes the digest over the forwarded call data, which the proxy already requires
  to start with the forwarded `input`. It pins the record in the proxy's category, and the completeness rule covers
  that category. D11 is superseded: an honest double call now has a record per call, which was the exemption's only
  reason.
- A split root serving two calls in one transaction runs them as batch rows forwarded to their facets. This is a later
  phase; until then, the second call is refused at compile time, as it is today.

## 6. Framed and the bus

- Framed: unchanged. It already binds `argsHash` and `result`, and the digest helper is shared.
- Bus: unchanged where a route serves the calls. A repeated returning call now takes a batch row, so it no longer falls
  back to a shared physical callee with free carriers.
- With `messageBus: false` stated explicitly, a repeated callee stays refused (`MESSAGE_BUS_REQUIRED`), because only
  the batch can spend one master for several calls. The automatic mode turns the bus on for such a function.

## 7. SDK

- The SDK computes each record's digest from the call's selector, arguments and ordinal, and lays the records out.
  Probes and `loopReturnCommitments` produce the blobs.
- The materializer (`stb-materialize-return-event-outputs.ts`) and the witness rebinding
  (`sc-rebind-create-builder-assembled-witnesses.ts`) take the record form. Alias carriers go away.

## 8. Cost and compatibility

- Breaking: every returning callee and every caller of one changes bytecode and record format, so no old artifact
  interoperates. This is pre-release, as with D49.
- Bytes: a sha256 and a compare per call site, the digest per callee run, and the completeness walk. These are to be
  measured in phase 1 against the 10,000-byte limit; contracts near it, such as UniswapV2Factory at 9,265 B, are the
  risk.
- A result over 96 bytes moves to the hashed form 32 bytes sooner than it does today.

## 9. Phases

1. Direct single calls: the record, the callee pin and completeness, the caller digest check and dynamic targets.
   Callee-only test shapes from `ce51b6f18` are adapted.
2. Returning batch rows: repeated returning calls, and loops with per-iteration ordinals.
3. Delegatecall, proxies and split facets: forwarded-call digest, proxy-category completeness, and D11 superseded.
4. SDK cleanup (alias carriers, H2 remnants) and docs: the security ledger, the decision row, and the website pages on
   calls.
5. One ladder run for the goal; marketplace bytecode changes, so it is the gate.

## 10. Open points

- Whether `ordinal` stays in the digest, or the record's output index alone carries the order. Keeping it in the
  digest needs no extra rule.
- The exact unlocking layout the callee hashes (selector and argument pushes, without internal witnesses): from its
  own operands, or from its input bytecode the way the framed site reads the callee's.
