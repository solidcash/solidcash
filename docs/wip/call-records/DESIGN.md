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

A direct return carrier becomes a call record (as built):

    commitment = callDigest || form || field
    callDigest = sha256(ordinal u16le || selector || for each argument: size u16le || bytes)[0:31]
    form       = 0x01: field is the encoded result, at most 96 bytes
                 0x02: field is sha256(result); the caller's `__internal__externalReturnPreimage<N>` holds the bytes

- Numbers (`bool`, `bigint`, `int`/`uint`, fixed, enums, value types over them) enter the digest minimally encoded, so
  the caller's and the callee's encodings of one value digest alike. `sig` arguments and compiler inputs are left out.
- A 31-byte digest keeps a three-word EVM result (96 bytes) inline; its collision resistance is 2^124. The framed
  `canonicalPushScript` encoding was not reused: it costs about 80 bytes inline per argument.
- `ordinal` is 0: a callee spent once runs one call, and identical reads share its record.
- The carrier keeps today's form: the callee's category, no capability, no fungible amount, `OP_TRUE`, at most 1,200
  satoshis.

## 3. The callee

- Every externally callable function that returns values computes `callDigest` over the call it is executing (its own
  selector, its own arguments, its ordinal) and pins the record at its witness output index, as
  `emitReturnEventCheck` pins the blob now.
- Completeness: every `OP_TRUE` output of the callee's category must be a record it pinned in this run. This replaces
  the caller-side count (H2) and the held commit's "every carrier holds my one commitment", which refused honest
  double calls.
- As built, the count is exact: one record for a run that pinned one, none otherwise, and a void entry of a contract
  with returning entries counts none. Entries that settle records publish `callRecord: true` in the ABI, which the SDK
  keys on.
- One spend, several calls: not built in the direct convention. Auto mode puts a caller with repeated or looped calls
  on the message bus, whose composer runs each call as a row and binds it under the verifier manifest; the direct
  builder already refused a fixed callee repeated in a loop. A second distinct call to a callee spent once fails the
  count (fail closed).

## 4. The caller

- Each call site computes `callDigest` from its own operands and ordinal, reads its record at its witness index, and
  requires its category to be the target's and its digest to be its own. Then it decodes the result.
- Target identity: a static target uses its fingerprint as today. For a dynamic target (an `address` value, a
  function pointer, an array element), the caller locates the co-spent input whose locking bytecode equals the target
  through a witness index, and requires the record's category to be that input's.
- Loops (as built): a loop over computed or array targets co-spends one callee per iteration; iteration i digests its
  own arguments and reads that callee's record. The SDK resolves each iteration's arguments (it used to give every
  callee iteration 0's). An opaque loop read takes the record's inline result without a digest check.
- Conditional calls: an untaken call reads nothing. A taken one is bound like any other.
- Identical readonly reads share the one run and its one record; the SDK lays one carrier for both.
- Arguments are digested from copies of the call's argument expressions, so no final use is consumed.

## 5. Delegatecall, proxies and split facets

- As built, the implementation's delegated entry digests the call it runs from its own operands, pins the record in
  the proxy's category (its master index resolves to the proxy master) and counts that category. The proxy's
  forwarding entry pins nothing. The SDK digests a builder's own call from the delegated implementation's call when
  the entry forwards. D11 is superseded.
- A split root serving two calls in one transaction runs them as batch rows forwarded to their facets. This is a later
  phase; until then, the second call is refused at compile time, as it is today.

## 6. Framed and the bus

- Framed: unchanged. It already binds `argsHash` and `result`.
- Bus: unchanged. A route keeps its aggregate result carrier and pins no record; graph handlers read rows as before.
  Repeated returning calls go through the composer, which binds them per row.
- With `messageBus: false` stated explicitly, a repeated callee stays refused (`MESSAGE_BUS_REQUIRED`), because only
  the batch can spend one master for several calls. The automatic mode turns the bus on for such a function.

## 7. SDK

- As built: `src/stateful/call-record.ts` computes the digest from the ABI function and arguments (only for an entry
  with `callRecord: true`); `StatefulTransactionBuilder.callRecordDigestFor` names it per carrier identity, and every
  materializer lays `returnEventNftCommitment(raw, digest)`.
- Probes still yield the pinned commitment; `rawOfReturnRecord` unwraps it to the raw result, a hashed one by finding
  its preimage on the probe's recorded stacks (the sparse trace keeps no SHA256 step).
- Readonly aliases resolve to the record of the physical call they share (`returnRecordGroupIndex`).

## 8. Cost and compatibility

- Breaking: every returning callee and every caller of one changes bytecode and record format, so no old artifact
  interoperates. This is pre-release, as with D49.
- Bytes: a digest and a compare per call site, the digest per callee run, and the completeness walk (a shared helper).
  The marketplace ladder is the size gate; contracts near the 10,000-byte limit, such as UniswapV2Factory, are the
  risk.
- A result over 96 bytes takes the hashed form (it used to past 128).

## 9. Phases

1. Direct single calls, aliases and hashed results: `8e6d14f44`.
2. Loops over computed targets, the 31-byte digest, copy-safe argument digests: `141bd8ef2`. Returning batch rows were
   not built (section 3).
3. Delegatecall, proxies and split facets: `56271e705`; the result behind a record read before the derivation checks it
   (`3115d9d9c`), and each record digested from its own call (`a6222d08d`).
4. Docs: D50, the security ledger, `cross-contract-calls.md`, the public agent reference.
5. One ladder run for the goal. The default lane compiles framed, where records do not apply (byte-identical
   artifacts); the proxy x kernel cell ran once on mocknet: 65 of 66, `job posting > post two jobs` failing (handled
   elsewhere).

Test: `packages/solidcash/test/e2e/CallRecords.test.ts`.

## 10. Open points (resolved)

- `ordinal` stays in the digest, always 0 today; it costs two bytes and leaves room for rows.
- The callee hashes its own operands, not its input bytecode.
- Limits: a loop iteration's result must fit inline (no per-iteration preimage); an opaque read checks no digest;
  R11 view witnesses stay caller-permissive; a returning call into another proxy stays unsupported.
