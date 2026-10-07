# Beta blockers: the evaluation's items and where each stands

From the 2026-10-07 evaluation of the landed gate. Each entry is what the repo now shows, not a plan.

## 1. Real-node evidence: partly done

The regtest stack runs and `yarn test:application-regtest` passes 9/9 while BCHN's chain advances 200 -> 222, so
an ERC-20-like ledger and an escrow/timelock contract execute at stock rules. The marketplace lane cannot follow:
7 of its 19 compiled artifacts exceed the 10,000-byte script limit (`MarketplaceV1` is 144,485 bytes) and a
composed call's largest unlocking script is 24,937 bytes. Numbers and repro in `REGTEST_AT_HEAD.md`.

## 2. Default convention and `msg.sender`: documented, policy call open

The README now states that `direct` is the default and its `msg.sender` is not authenticated (F1, F10), that
`framed` binds the sender on chain, and that the release is a mocknet beta at marketplace scale. Making `framed`
the default, or adding a `composition.senderBinding` field to the artifact, is a product decision not yet taken.

## 3. Framed view padding: open, and it must be decided before a beta

`emitPadView` zero-pads every view to 128 bytes before comparison while the reference model compares exact bytes,
so `X` and `X||00` are the same on-chain state. Closing it moves every framed address. Recorded in
`NEXT_BRANCH.md`; no change is in the branch.

## 4a. D22: open

Live on the branch (`cee831dc2`) and asked about; the answer was declined, so the row stays unconfirmed and the
landing is one `git reset --hard 9fd8cd52b` away.

## 4b. F2 discrepancy: settled, and the doc was wrong

The sighash-ALL fence covers the direct *upgrade* authorization, a message-bus route handler that reaches
`checkSig`, and the framed master root caller - not the direct convention's ordinary entry or its `msg.sender`
path. `TRIAGE_SECURITY.md` now says partially fixed and cites the right commit (`85636dfde`).

## 5. Unit tests for the flag-gated fixes: added where a revert-pin exists

- `packages/solidc/test/framed/master/literal-decided-arm-composition.test.ts` fails when `31bfe3cb7` is reverted.
- `packages/solidcash/test/unit/SelectedSatoshiContainer.test.ts`'s new case fails when `40b437c60`'s hunk is
  reverted.
- `packages/solidcash/test/unit/StatefulSendChargedFee.test.ts` guards the ordinary-send fee. It passes at HEAD
  and with `328e02615` reverted, because the reassert is inert for a send with no predecessor output; it catches a
  funder-inflation regression instead, shown by a simulated `+10000` funder.
- No robust assertion exists for `e01ea5f4d`'s upgrade census: the artifact publishes no field naming the census
  variant, so only an incidental byte string would pin it, and none was added. Revisiting that census relaxation
  is still open.

## 6. Release label: mocknet beta

Stated in the README with the limit numbers, for anything at marketplace scale.

## Untouched from the evaluation

The 61 registered `SOLIDC_*` knobs that ship in `dist` (18 of which shape output or caching), the 26 agent
working notes at the repo root, and `yarn spellcheck`'s 902 issues. `RELEASE_HYGIENE.md` and `TRIAGE_HYGIENE.md`
carry the measurements; each is a decision, not a defect.
