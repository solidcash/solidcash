#!/usr/bin/env python3
"""Mechanical checks of the core rules of solidcash-new-through-deployer-coins.md (2026-11-12).

Each check models one rule exactly as the spec states it and tests the claim the proofs make about it:
exhaustively over small domains where that is feasible, otherwise on many random cases with fixed seeds.
Each check also runs a negative control, to show that the condition it tests is not vacuous.

  1. Lemma 4, the collection rows check of A4.4 (step 12): it accepts exactly the canonical sorted list of the
     journal's final contents, and an accepted list is well formed.
  2. "What a read sees" (A4.4): a look (scan first to last, keep the last record with the slot) returns the
     latest earlier write under an equal key, as a Solidity mapping does.
  3. The group condition of A4.1: a group that meets it has the same effect in every order of its statements
     (temporaries before their readers), and every read sees the state before the source statement.
  4. The satoshi balance rule of A4.1: a constructor that reads the balance and does not send, or sends and
     does not read it, gives the same reads and the same final balance in every order.
  5. The tail of the code (B6.4 steps 1 to 4, O4) and the marker reading of A4.3 step 8.3, with and without
     the birth trailer (B7.14).
  6. The binding at a `new` site (A6 step 4): with push-only, minimal unlockings, matching bytes from offset
     6 + 2s mean the stack items there are exactly Q's and A's.
  7. Lemma 3 and Theorems 1, 7, 8 and 9 on a bounded model of the transaction rules: consensus for new
     categories, `create`'s steps 4, 12 and 13, and `sweep`; checked on every transaction around honest
     creations (every single mutation, random double ones), for one creation and for two in one transaction.

Run: python3 solidcash-new-through-deployer-coins.checks.py     (no dependencies; about a minute)
"""
import hashlib
import itertools
import random
import sys

FAILURES = []


def check(cond, msg):
    if not cond:
        FAILURES.append(msg)
        if len(FAILURES) < 20:
            print("FAIL:", msg)


# ---------------------------------------------------------------------------------------------------------------
# 1. Lemma 4: the collection rows check (A4.4, "The collection rows", step 12)
# ---------------------------------------------------------------------------------------------------------------

def final_contents(journal):
    d = {}
    for slot, val in journal:
        d[slot] = val
    return d


def canonical(journal, s_c):
    d = final_contents(journal)
    slots = sorted(d)
    m = len(slots)
    if m > s_c:
        return None
    rows = [(sl, slots[i + 1] if i + 1 < m else 0, d[sl]) for i, sl in enumerate(slots)]
    return (slots[0] if m else 0), tuple(rows + [None] * (s_c - m))


def step12(journal, head_next, rows):
    """The check as A4.4 states it: links and order, then two scans of the journal."""
    m, seen_tokenless = 0, False
    for r in rows:                                   # the entries come first, then outputs with no token
        if r is None:
            seen_tokenless = True
        elif seen_tokenless:
            return False
        else:
            m += 1
    nodes = rows[:m]
    if head_next != (nodes[0][0] if m else 0):       # the HEAD's next
        return False
    for i, (sl, nxt, _) in enumerate(nodes):         # next_i = slot_(i+1), next_m = 0
        if nxt != (nodes[i + 1][0] if i + 1 < m else 0):
            return False
    prev = 0
    for sl, _, _ in nodes:                           # 0 < slot_1 < ... < slot_m
        if not sl > prev:
            return False
        prev = sl
    for sl, _, val in nodes:                         # scan 1: each row is the last record with its slot
        last = None
        for js, jv in journal:
            if js == sl:
                last = jv
        if last is None or last != val:
            return False
    row_slots = {sl for sl, _, _ in nodes}
    for js, _ in journal:                            # scan 2: every record's slot is among the rows
        if js not in row_slots:
            return False
    return True


def follow(head_next, rows):
    """Follow next from the HEAD; return the visited (slot, value) list, or None on a cycle or a dangling link."""
    by_slot = {r[0]: r for r in rows if r is not None}
    out, cur, steps = [], head_next, 0
    while cur != 0:
        if cur not in by_slot or steps > len(rows):
            return None
        sl, nxt, val = by_slot[cur]
        out.append((sl, val))
        cur, steps = nxt, steps + 1
    return out


def check_lemma4():
    total = accepted = 0
    for K, V, max_len, max_sc in ((2, 2, 3, 3), (3, 2, 2, 2)):
        slots_dom = range(1, K + 1)
        row_opts = [None] + [(sl, nx, v) for sl in range(0, K + 1) for nx in range(0, K + 1) for v in range(V)]
        for n in range(0, max_len + 1):
            for journal in itertools.product([(s, v) for s in slots_dom for v in range(V)], repeat=n):
                journal = list(journal)
                for s_c in range(n, max_sc + 1):
                    canon = canonical(journal, s_c)
                    for head in range(0, K + 1):
                        for rows in itertools.product(row_opts, repeat=s_c):
                            total += 1
                            ok = step12(journal, head, rows)
                            is_canon = canon is not None and (head, rows) == canon
                            check(ok == is_canon, f"lemma4: journal={journal} s_c={s_c} head={head} rows={rows} "
                                                  f"accepted={ok} canonical={is_canon}")
                            if ok:
                                accepted += 1
                                visited = follow(head, rows)
                                d = final_contents(journal)
                                check(visited == sorted(d.items()),
                                      f"lemma4: accepted list does not spell the final contents {journal} {rows}")
    # Negative control: a check without scan 2 accepts a list that drops a written key.
    weak_accepts = 0
    journal = [(1, 0), (2, 1)]
    for rows in [((1, 0, 0), None)]:
        if step12_without_scan2(journal, 1, rows):
            weak_accepts += 1
    check(weak_accepts == 1, "lemma4 control: dropping scan 2 should accept a list that loses a key")
    return f"{total} layouts checked over all journals up to the bounds, {accepted} accepted, all canonical"


def step12_without_scan2(journal, head_next, rows):
    m = sum(1 for r in rows if r is not None)
    nodes = rows[:m]
    if head_next != (nodes[0][0] if m else 0):
        return False
    for i, (sl, nxt, _) in enumerate(nodes):
        if nxt != (nodes[i + 1][0] if i + 1 < m else 0):
            return False
    for sl, _, val in nodes:
        last = None
        for js, jv in journal:
            if js == sl:
                last = jv
        if last != val:
            return False
    return True


# ---------------------------------------------------------------------------------------------------------------
# 2. What a read sees (A4.4)
# ---------------------------------------------------------------------------------------------------------------

def look(journal, slot, default):
    found = default
    for js, jv in journal:                           # first record to last, keep the last match
        if js == slot:
            found = jv
    return found


def check_reads():
    rng = random.Random(2)
    programs = 0
    for _ in range(200000):
        journal, reference = [], {}
        for _ in range(rng.randint(1, 8)):
            key = rng.randint(0, 3)                      # keys collide often: aliasing at run time
            if rng.random() < 0.5:
                if rng.random() < 0.8:                   # a write site that runs (a branch not taken appends nothing)
                    val = rng.randint(0, 9)
                    journal.append((key, val))
                    reference[key] = val
            else:
                check(look(journal, key, 0) == reference.get(key, 0), f"reads: {journal} key={key}")
        programs += 1
    return f"{programs} random programs with colliding keys and skipped writes: every look equals a mapping read"


# ---------------------------------------------------------------------------------------------------------------
# 3. The group condition (A4.1)
# ---------------------------------------------------------------------------------------------------------------
# A statement writes one place and computes its value from the places it reads. Places: locals a, b; state fields
# x, y; collection entries m[0], m[1] (literal keys) and m[k] (key from the local k, which may equal 0 or 1 at run
# time); fresh temporaries t0, t1 that the lowering marks. Reading or writing any entry of m reads or writes the
# collection m for the condition; two writes of m count as one place unless both keys are distinct literals.

PLACES_PLAIN = ["a", "b", "x", "y"]
ENTRY_LITERAL = ["m0", "m1"]


def resolve(place, k):
    return {"m0": ("m", 0), "m1": ("m", 1), "mk": ("m", k)}.get(place, place)


def run(group, order, state, k):
    st = dict(state)
    reads_seen = []
    for i in order:
        target, srcs, fn = group[i]
        vals = tuple(st.get(resolve(s, k), 0) for s in srcs)
        reads_seen.append((i, vals))
        st[resolve(target, k)] = fn(vals)
    return st, sorted(reads_seen)


def condition(group):
    def var(p):
        return "m" if p in ("m0", "m1", "mk") else p
    written_before = set()
    for target, srcs, _ in group:                     # (a) no read of a variable an earlier statement wrote
        for s in srcs:
            if not s.startswith("t") and var(s) in written_before:
                return False
        written_before.add(var(target))
    targets = [t for t, _, _ in group]                # (b) no two writes of one place
    for i, j in itertools.combinations(range(len(targets)), 2):
        ti, tj = targets[i], targets[j]
        if ti == tj:
            return False
        if var(ti) == "m" and var(tj) == "m" and not (ti in ENTRY_LITERAL and tj in ENTRY_LITERAL):
            return False
    return True


def valid_orders(group):
    n = len(group)
    temp_writer = {t: i for i, (t, _, _) in enumerate(group) if t.startswith("t")}
    for perm in itertools.permutations(range(n)):
        pos = {i: p for p, i in enumerate(perm)}
        ok = True
        for i, (_, srcs, _) in enumerate(group):
            for s in srcs:
                if s.startswith("t") and (s not in temp_writer or pos[temp_writer[s]] > pos[i]):
                    ok = False
        if ok:
            yield perm


def random_group(rng):
    n = rng.randint(1, 4)
    group, temps = [], []
    for _ in range(n):
        if rng.random() < 0.25 and len(temps) < 2:
            t = f"t{len(temps)}"
            temps.append(t)
            target = t
            srcs = rng.sample(PLACES_PLAIN + ENTRY_LITERAL + ["mk"], rng.randint(0, 2))
        else:
            target = rng.choice(PLACES_PLAIN + ENTRY_LITERAL + ["mk"])
            srcs = rng.sample(PLACES_PLAIN + ENTRY_LITERAL + ["mk"] + temps, rng.randint(0, 2))
        coeff = [rng.randint(1, 5) for _ in srcs]
        const = rng.randint(0, 7)
        group.append((target, srcs, (lambda c, d: (lambda vals: d + sum(ci * v for ci, v in zip(c, vals))))(coeff, const)))
    return group


def parallel(group, state, k):
    """The source statement's effect as the premise of A16.1 states it: every value computed over the state
    before the statement (a temporary over that state too), then every target written."""
    temps, writes = {}, []
    for target, srcs, fn in group:
        vals = tuple(temps[s] if s.startswith("t") else state.get(resolve(s, k), 0) for s in srcs)
        v = fn(vals)
        if target.startswith("t"):
            temps[target] = v
        else:
            writes.append((resolve(target, k), v))
    st = dict(state)
    st.update(temps)
    for place, v in writes:
        st[place] = v
    return st


def check_group_condition():
    """The claim of A4.1 and A16.1: in the order the lowering emits, a group that meets the condition reads only
    the state before its source statement (and the lowering's temporaries) and writes disjoint places, so its
    effect is the parallel assignment over that state. The order is the lowering's; nothing after the gate
    reorders a group's statements other than as compiler correctness allows."""
    rng = random.Random(3)
    met = differs_when_failing = 0
    for _ in range(40000):
        group = random_group(rng)
        if not any(perm == tuple(range(len(group))) for perm in valid_orders(group)):
            continue                                       # a lowering binds a temporary before its readers
        state = {"a": rng.randint(0, 9), "b": rng.randint(0, 9), "x": rng.randint(0, 9), "y": rng.randint(0, 9),
                 ("m", 0): rng.randint(0, 9), ("m", 1): rng.randint(0, 9)}
        for k in (0, 1):                                   # the key of m[k] equals 0 or 1 at run time
            st, reads = run(group, tuple(range(len(group))), state, k)
            expected = parallel(group, state, k)
            same = {str(a): b for a, b in st.items()} == {str(a): b for a, b in expected.items()}
            if condition(group):
                met += 1
                check(same, f"group: condition met but the effect is not the parallel assignment: "
                            f"{[g[:2] for g in group]} k={k}")
                for i, vals in reads:
                    _, srcs, _ = group[i]
                    for s, v in zip(srcs, vals):
                        if not s.startswith("t"):
                            check(v == state.get(resolve(s, k), 0),
                                  f"group: a read saw a write of its own group {group[i][:2]} k={k}")
            elif not same:
                differs_when_failing += 1
    check(differs_when_failing > 0, "group control: some groups that fail the condition should differ")
    return (f"{met} random groups (with both run-time values of a non-literal key) meet the condition: each reads "
            f"the state before it and has the parallel assignment's effect; {differs_when_failing} failing groups "
            f"did not (control)")


# ---------------------------------------------------------------------------------------------------------------
# 4. The satoshi balance rule (A4.1)
# ---------------------------------------------------------------------------------------------------------------

def check_balance_rule():
    rng = random.Random(4)
    allowed = control = 0
    for _ in range(20000):
        start_plus_value = rng.randint(1200, 5000)
        ops = [("read",) if rng.random() < 0.5 else ("send", rng.randint(1, 300)) for _ in range(rng.randint(1, 5))]
        has_read = any(o[0] == "read" for o in ops)
        has_send = any(o[0] == "send" for o in ops)
        results = set()
        for perm in set(itertools.permutations(range(len(ops)))):
            journal, reads = start_plus_value, []
            for i in perm:
                if ops[i][0] == "read":
                    reads.append((i, journal))
                else:
                    journal -= ops[i][1]
            results.add((tuple(sorted(reads)), journal))
        if not (has_read and has_send):
            allowed += 1
            check(len(results) == 1, f"balance: accepted constructor depends on order: {ops}")
        elif len(results) > 1:
            control += 1
    check(control > 0, "balance control: reads and sends together should depend on order")
    return f"{allowed} accepted constructors order-independent; {control} refused ones were order-dependent (control)"


# ---------------------------------------------------------------------------------------------------------------
# 5. The tail of the code (B6.4, O4) and the marker reading (A4.3 step 8.3)
# ---------------------------------------------------------------------------------------------------------------

MAGIC = hashlib.sha256(b"solidcash:code-marker:v1").digest()[:20]
assert MAGIC.hex() == "1744a65e30fda2209c561da7e1920101f44c313a", MAGIC.hex()


def is_marker(b):
    return len(b) == 23 and b[0] == 0x15 and b[1:21] == MAGIC and b[22] == 0x75


def is_trailer(b):
    return len(b) == 34 and b[0] == 0x20 and b[33] == 0x75


def tail(body, flags, oracle_slots):
    """B6.4 steps 1 to 3. oracle_slots: (start, length) of slots the SDK fills per instance."""
    code = bytearray(body)
    while len(code) < 57 or any(st + ln > len(code) - 57 for st, ln in oracle_slots):
        code.append(0x61)
    marker_at = None
    if flags:
        marker_at = len(code)
        code += bytes([0x15]) + MAGIC + bytes([flags, 0x75])
    rounds = 0
    while True:
        c = bytes(code)
        bad = (len(c) >= 34 and is_trailer(c[-34:])) or (len(c) >= 57 and is_marker(c[-57:-34])) \
            or (marker_at is None and len(c) >= 23 and is_marker(c[-23:]))
        if not bad:
            break
        rounds += 1
        if marker_at is not None:
            code.insert(marker_at, 0x61)
            marker_at += 1
        else:
            code.append(0x61)
        if rounds > 200:
            break
    return bytes(code), rounds


def read_marker(code):
    """A4.3 step 8.3 on the tail of an unlocking, which is the tail of the redeem script and so of the code."""
    if is_marker(code[-23:]):
        return code[-2]
    if len(code) >= 57 and is_marker(code[-57:-34]):
        return code[-36]
    return None


def adversarial_body(rng):
    body = bytearray(rng.randbytes(rng.randint(0, 120)))
    for _ in range(rng.randint(0, 3)):
        choice = rng.randint(0, 5)
        if choice == 0:
            body += bytes([0x15]) + MAGIC + bytes([rng.randint(0, 3), 0x75])          # spells a marker
        elif choice == 1:
            body += bytes([0x20]) + rng.randbytes(32) + bytes([0x75])                  # spells a trailer
        elif choice == 2:
            body += bytes([0x20] * rng.randint(1, 40))                                 # runs of 20
        elif choice == 3:
            body += bytes([0x75] * rng.randint(1, 5))
        elif choice == 4:
            body += bytes([0x15]) + MAGIC + bytes([rng.randint(0, 3), 0x75]) + bytes([0x20]) + rng.randbytes(32) + bytes([0x75])
        else:
            body += rng.randbytes(rng.randint(0, 40))
    return bytes(body)


def check_tail_and_marker():
    rng = random.Random(5)
    max_rounds = 0
    cases = 0
    for _ in range(300000):
        body = adversarial_body(rng)
        flags = rng.choice([0, 0, 1, 2, 3])
        slots = []
        if rng.random() < 0.3 and len(body) > 33:
            st = rng.randint(0, len(body) - 33)
            slots = [(st, 33)]
        code, rounds = tail(body, flags, slots)
        max_rounds = max(max_rounds, rounds)
        cases += 1
        # step 4, the O4 check on the body
        check(len(code) >= 57, "tail: body shorter than 57")
        check(all(st + ln <= len(code) - 57 for st, ln in slots), "tail: an instance slot in the last 57 bytes")
        check(is_marker(code[-23:]) == bool(flags), f"tail: marker presence wrong for flags={flags}")
        if flags:
            check(code[-2] == flags, "tail: wrong flags in the marker")
        check(not is_marker(code[-57:-34]), "tail: marker form at the 23 bytes before the last 34")
        check(not is_trailer(code[-34:]), "tail: the body ends like a trailer")
        check(code.startswith(body), "tail: the body's own code was changed")
        # B7.14: a trailer for a constructor that calls out, then the reading of step 8.3
        for with_trailer in (False, True):
            full = code + (bytes([0x20]) + rng.randbytes(32) + bytes([0x75]) if with_trailer else b"")
            got = read_marker(full)
            check(got == (flags if flags else None), f"marker reading: flags={flags} trailer={with_trailer} got={got}")
            check(is_trailer(full[-34:]) == with_trailer, "trailer reading wrong")
            if got is not None and not (flags & 1):
                check(not (got & 1), "marker reading: creator flag where none was placed")
    check(max_rounds <= 12, f"tail: loop took {max_rounds} rounds, more than the twelve the text states")
    return f"{cases} adversarial bodies: O4 holds after the tail rule, the reader returns the placed flags " \
           f"with and without a trailer; the loop took at most {max_rounds} rounds"


# ---------------------------------------------------------------------------------------------------------------
# 6. The binding at a `new` site (A6 step 4)
# ---------------------------------------------------------------------------------------------------------------

def push(data):
    """Minimal push encoding (BCH consensus since 2019)."""
    n = len(data)
    if n == 0:
        return bytes([0x00])
    if n == 1 and 1 <= data[0] <= 16:
        return bytes([0x50 + data[0]])
    if n == 1 and data[0] == 0x81:
        return bytes([0x4f])
    if n <= 75:
        return bytes([n]) + data
    if n <= 255:
        return bytes([0x4c, n]) + data
    if n <= 65535:
        return bytes([0x4d]) + n.to_bytes(2, "little") + data
    return bytes([0x4e]) + n.to_bytes(4, "little") + data


def decode(script):
    items, i = [], 0
    while i < len(script):
        op = script[i]
        i += 1
        if op == 0x00:
            items.append(b"")
        elif 1 <= op <= 75:
            items.append(script[i:i + op])
            i += op
        elif op == 0x4c:
            n = script[i]
            items.append(script[i + 1:i + 1 + n])
            i += 1 + n
        elif op == 0x4d:
            n = int.from_bytes(script[i:i + 2], "little")
            items.append(script[i + 2:i + 2 + n])
            i += 2 + n
        elif op == 0x4e:
            n = int.from_bytes(script[i:i + 4], "little")
            items.append(script[i + 4:i + 4 + n])
            i += 4 + n
        elif op == 0x4f:
            items.append(b"\x81")
        elif 0x51 <= op <= 0x60:
            items.append(bytes([op - 0x50]))
        else:
            return None                                 # not push-only: consensus refuses such an unlocking
    return items


SELECTOR_CREATE = bytes.fromhex("af341413")


def check_binding():
    rng = random.Random(6)
    cases = 0
    for _ in range(100000):
        s = rng.randint(0, 20)
        callees = rng.randbytes(2 * s)
        q_items = [rng.randbytes(rng.choice([0, 1, 1, 2, 8, 32, 33, 80])) for _ in range(rng.randint(2, 5))]
        a_items = [rng.randbytes(rng.choice([0, 1, 4, 20, 35])) for _ in range(rng.randint(0, 4))]
        expected = b"".join(push(x) for x in q_items + a_items)
        prefix = push(SELECTOR_CREATE) + push(callees)
        assert prefix[:6] == bytes([0x04]) + SELECTOR_CREATE + (bytes([2 * s]) if s else b"\x00")[:1]
        rest = b"".join(push(rng.randbytes(rng.randint(0, 90))) for _ in range(rng.randint(0, 4)))
        u = prefix + expected + rest
        # the site's checks: the first 6 bytes, then the bytes from 6 + 2s
        ok = u[:6] == bytes([0x04]) + SELECTOR_CREATE + bytes([2 * s]) and u[6 + 2 * s:6 + 2 * s + len(expected)] == expected
        if s == 0:
            ok = u[:6] == bytes([0x04]) + SELECTOR_CREATE + b"\x00" and u[6:6 + len(expected)] == expected
        check(ok, "binding: an honest unlocking fails the site's checks")
        items = decode(u)
        check(items is not None and items[0] == SELECTOR_CREATE and items[1] == callees
              and items[2:2 + len(q_items) + len(a_items)] == q_items + a_items,
              "binding: matching bytes did not give exactly Q's and A's items")
        # any push-only unlocking with the same bytes up to the end of Q || A decodes to the same first items
        tail_alt = b"".join(push(rng.randbytes(rng.randint(0, 90))) for _ in range(rng.randint(0, 4)))
        items_alt = decode(prefix + expected + tail_alt)
        check(items_alt[:2 + len(q_items) + len(a_items)] == items[:2 + len(q_items) + len(a_items)],
              "binding: the items depend on what follows Q || A")
        cases += 1
    return f"{cases} random unlockings: the bytes the site checks fix the selector, the callee list and every item of Q and A"


# ---------------------------------------------------------------------------------------------------------------
# 7. Lemma 3 and Theorems 1, 7, 8, 9 on a bounded model of the transaction rules
# ---------------------------------------------------------------------------------------------------------------
# An output is (lock, category, capability, amount, value). Categories X1 = 1 and X2 = 2 are new (the txids of two
# preps); T = 10 is an existing fungible category that a wallet input holds 5 units of. A capability is 'min',
# 'mut', 'imm' or None (fungible only). A token's category as the VM reads it is 33 bytes for 'min' and 'mut'
# and 32 bytes otherwise. Consensus, as far as the theorems use it (N1, N2): an output may carry a new category X
# only when the transaction spends (X, 0); units of T out are at most units of T in; every outpoint is spent at
# most once. `create` is modelled by its steps 4, 12 and 13 (A4.3, A4.4, A4.5), `sweep` by A4.6.

R7 = 1200
X1, X2, T = 1, 2, 10


class Shape:
    def __init__(self, N=0, E=0, oracle=0, sat="none", trows=(), s_c=0, e_s=0, f=0):
        self.N, self.E, self.oracle, self.sat, self.trows, self.s_c, self.e_s, self.f = N, E, oracle, sat, tuple(trows), s_c, e_s, f

    def kinds(self):
        k = ["master"] + ["data"] * self.N + (["oracle"] if self.oracle else []) + ["head"] * self.E
        if self.sat != "none":
            k.append("sat")
        k += [("trow", t) for t in self.trows] + ["entry"] * self.s_c + ["event"] * self.e_s
        return k


def honest_outputs(X, shape, b, run, prefix_len=None):
    ce, evs = run
    outs = []
    kinds = shape.kinds()
    e_i = v_i = 0
    for kind in kinds:
        if kind == "master":
            outs.append((("M", X), X, "min", 0, R7))
        elif kind in ("data", "oracle", "head"):
            outs.append(((kind, X), X, "mut", 0, R7))
        elif kind == "sat":
            outs.append((("KS", X), None, None, 0, R7))
        elif isinstance(kind, tuple):
            outs.append((("KT", X, kind[1]), kind[1], None, 1, R7))
        elif kind == "entry":
            outs.append(((("head", X) if False else ("entry", X)), X, "mut", 0, R7) if e_i < ce else (("Z",), None, None, 0, 546))
            e_i += 1
        elif kind == "event":
            outs.append((("EV", X), X, "imm", 0, 800) if evs[v_i] else (("Z",), None, None, 0, 546))
            v_i += 1
    return outs


def create_ok(outs, inputs, X, shape, b, run, census=True, unused_no_token=True):
    if ("coin", X, 1) not in inputs:                                         # step 4: the author coin
        return False
    ce, evs = run
    kinds = shape.kinds()
    if b < 0 or b + len(kinds) > len(outs):
        return False
    e_i = v_i = 0
    for off, kind in enumerate(kinds):                                       # step 12: the genesis range
        lock, cat, cap, amt, val = outs[b + off]
        if kind == "master":
            ok = lock == ("M", X) and cat == X and cap == "min" and amt == 0 and val >= R7
        elif kind in ("data", "oracle", "head"):
            ok = lock == (kind, X) and cat == X and cap == "mut" and amt == 0 and val >= R7
        elif kind == "sat":
            ok = cat is None and (lock == ("KS", X) and val >= R7 if shape.sat == "required" else True)
        elif isinstance(kind, tuple):
            ok = lock == ("KT", X, kind[1]) and cat == kind[1] and cap in (None, "imm") and amt >= 1 and val >= R7
        elif kind == "entry":
            ok = (lock == ("entry", X) and cat == X and cap == "mut" and amt == 0) if e_i < ce else \
                (cat is None or not unused_no_token)
            e_i += 1
        else:
            ok = (lock == ("EV", X) and cat == X and cap == "imm" and amt == 0) if evs[v_i] else \
                (cat is None or not unused_no_token)
            v_i += 1
        if not ok:
            return False
    if shape.f:                                                              # the identity output at output 0
        lock, cat, cap, amt, _ = outs[0]
        if not (lock == ("A", X) and cat == X and cap == "mut" and amt == 0):
            return False
    if shape.sat == "required" and sum(1 for o in outs if o[0] == ("KS", X)) != 1:
        return False                                                         # single means exactly one
    for t in shape.trows:
        if sum(1 for o in outs if o[0] == ("KT", X, t)) != 1:
            return False
    if len(set(shape.trows)) != len(shape.trows):
        return False
    if not census:
        return True
    mint = sum(1 for o in outs if o[1] == X and o[2] == "min")              # step 13: the census
    mut = sum(1 for o in outs if o[1] == X and o[2] == "mut")
    total = sum(1 for o in outs if o[1] == X)
    if mint != 1 or mut != shape.N + shape.E + ce + shape.oracle + shape.f:
        return False
    if total != 1 + shape.N + shape.E + ce + shape.oracle + shape.f + sum(evs):
        return False
    if any(o[1] == X and o[3] != 0 for o in outs):
        return False
    return True


def sweep_ok(outs):
    return len(outs) == 1 and outs[0][1] is None


def consensus_ok(outs, inputs):
    for X in (X1, X2):
        if any(o[1] == X for o in outs) and ("coin", X, 0) not in inputs:
            return False
    t_in = 5 if ("wallet",) in inputs else 0
    if sum(o[3] for o in outs if o[1] == T) > t_in:
        return False
    for o in outs:
        if o[1] is not None and o[2] is None and o[3] < 1:                  # a token output needs an NFT or units
            return False
        if o[1] == T and o[2] is not None:                                   # T has no NFTs to spend
            return False
    return True


def expected_x_outputs(X, shape, b, run):
    ce, evs = run
    idx = set()
    kinds = shape.kinds()
    e_i = v_i = 0
    for off, kind in enumerate(kinds):
        if kind in ("master", "data", "oracle", "head"):
            idx.add(b + off)
        elif kind == "entry":
            if e_i < ce:
                idx.add(b + off)
            e_i += 1
        elif kind == "event":
            if evs[v_i]:
                idx.add(b + off)
            v_i += 1
    if shape.f:
        idx.add(0)
    return idx


def theorems_hold(outs, inputs, creations, sweeps):
    """creations: list of (X, shape, b, run) whose create passed; sweeps: categories whose (X, 0) was swept."""
    # Theorem 1 (1) and (3): a token of X only through a create on (X, 0); a sweep makes none
    for X in (X1, X2):
        if any(o[1] == X for o in outs):
            if not any(c[0] == X for c in creations):
                return "T1: a token of a new category without its create"
    if sweeps and any(o[1] is not None for o in outs):
        return "T1(3): a sweep with a token output"
    ranges = []
    for X, shape, b, run in creations:
        if ("coin", X, 1) not in inputs:
            return "T8: create without its author coin"
        got = {i for i, o in enumerate(outs) if o[1] == X}
        if got != expected_x_outputs(X, shape, b, run):                    # Lemma 3
            return f"L3: outputs of X={X} are {sorted(got)}, expected {sorted(expected_x_outputs(X, shape, b, run))}"
        if any(outs[i][3] != 0 for i in got):
            return "L3: an output of X with units"
        if shape.sat == "required":                                          # Theorem 7
            at = [o for o in outs if o[0] == ("KS", X)]
            if len(at) != 1 or at[0][4] < R7 or at[0][1] is not None:
                return "T7: satoshi container"
        for t in shape.trows:
            at = [o for o in outs if o[0] == ("KT", X, t)]
            if len(at) != 1 or at[0][1] != t or at[0][2] in ("min", "mut") or at[0][3] < 1 or at[0][4] < R7:
                return "T7: token container"
        ranges.append(set(range(b, b + len(shape.kinds()))))
    if len(ranges) == 2 and ranges[0] & ranges[1]:                         # Theorem 9
        return "T9: two genesis ranges share an index"
    return None


SHAPES7 = [Shape(), Shape(N=1), Shape(N=1, E=1, s_c=1, e_s=1), Shape(oracle=1, sat="required", trows=(T,)),
           Shape(N=1, sat="optional", e_s=1, f=1), Shape(E=1, s_c=2, f=1, trows=(T,)), Shape(N=2, e_s=2)]


def runs_of(shape):
    for ce in range(0, shape.s_c + 1):
        for evs in itertools.product((False, True), repeat=shape.e_s):
            yield (ce, evs)


def alphabet7():
    alpha = []
    for X in (X1, X2):
        for lock in (("M", X), ("data", X), ("oracle", X), ("head", X), ("entry", X), ("EV", X), ("A", X), ("Z",)):
            for cap in ("min", "mut", "imm"):
                alpha.append((lock, X, cap, 0, R7))
        alpha.append((("Z",), X, None, 3, R7))                               # fungible units of X
        alpha.append((("KS", X), None, None, 0, R7))
        alpha.append((("KT", X, T), T, None, 1, R7))
        alpha.append((("KT", X, T), X, "imm", 0, R7))
    alpha += [(("Z",), None, None, 0, 546), (("P",), None, None, 0, 1000), (("Z",), T, None, 1, 546),
              (("M", X1), X1, "min", 0, 0)]
    return alpha


def neighbourhood(outs, alpha, rng, n_random):
    """Every single mutation of outs (replace, insert, delete, swap), then random double mutations."""
    singles = []
    for i in range(len(outs)):
        for a in alpha:
            singles.append(outs[:i] + [a] + outs[i + 1:])
        singles.append(outs[:i] + outs[i + 1:])
    for i in range(len(outs) + 1):
        for a in alpha:
            singles.append(outs[:i] + [a] + outs[i:])
    for i, j in itertools.combinations(range(len(outs)), 2):
        t = list(outs)
        t[i], t[j] = t[j], t[i]
        singles.append(t)
    yield from singles
    for _ in range(n_random):
        a = rng.choice(singles)
        i = rng.randrange(len(a) + 1)
        op = rng.randint(0, 2)
        if op == 0 and a:
            j = rng.randrange(len(a))
            yield a[:j] + [rng.choice(alpha)] + a[j + 1:]
        elif op == 1:
            yield a[:i] + [rng.choice(alpha)] + a[i:]
        elif a:
            j = rng.randrange(len(a))
            yield a[:j] + a[j + 1:]


def evaluate(outs, inputs, plans, **weaken):
    """plans: list of (X, shape, b) for the create inputs. Returns the creations that pass, or None if the
    transaction is invalid (a script or consensus fails)."""
    if not consensus_ok(outs, inputs):
        return None
    passed = []
    for X, shape, b in plans:
        ok_runs = [r for r in runs_of(shape) if create_ok(outs, inputs, X, shape, b, r, **weaken)]
        if not ok_runs:
            return None
        passed.append((X, shape, b, ok_runs))
    return passed


def check_transaction_theorems():
    rng = random.Random(7)
    alpha = alphabet7()
    valid = honest = checked = 0
    for shape in SHAPES7:
        for b in (0, 1, 2):
            if shape.f and b == 0:
                continue
            for run in runs_of(shape):
                base = [(("P",), None, None, 0, 1000)] * b if not shape.f else [(("A", X1), X1, "mut", 0, 800)] + [(("P",), None, None, 0, 1000)] * (b - 1)
                outs = base + honest_outputs(X1, shape, b, run) + [(("Z",), None, None, 0, 546)]
                inputs = {("coin", X1, 0), ("coin", X1, 1), ("wallet",)}
                res = evaluate(outs, inputs, [(X1, shape, b)])
                check(res is not None, f"t7: an honest creation fails: shape={vars(shape)} b={b} run={run}")
                honest += 1
                for cand in neighbourhood(outs, alpha, rng, 400):
                    for inp in (inputs, inputs - {("coin", X1, 1)}):
                        checked += 1
                        res = evaluate(cand, inp, [(X1, shape, b)])
                        if res is None:
                            continue
                        valid += 1
                        for X, sh, bb, ok_runs in res:
                            for r in ok_runs:
                                err = theorems_hold(cand, inp, [(X, sh, bb, r)], [])
                                check(err is None, f"t7: {err} shape={vars(sh)} b={bb} run={r} outs={cand}")
    # two creations in one transaction, with honest and with overlapping bases
    two = 0
    pairs = [(Shape(N=1), Shape()), (Shape(N=1, s_c=1, e_s=1), Shape(trows=(T,), sat="required")),
             (Shape(E=1, e_s=1), Shape(N=1, e_s=1))]
    for sh1, sh2 in pairs:
        w1, w2 = len(sh1.kinds()), len(sh2.kinds())
        for b1 in (0, 1):
            for b2 in range(0, b1 + w1 + 2):
                for r1 in runs_of(sh1):
                    for r2 in runs_of(sh2):
                        o1 = honest_outputs(X1, sh1, b1, r1)
                        o2 = honest_outputs(X2, sh2, b2, r2)
                        n = max(b1 + w1, b2 + w2) + 1
                        outs = [(("Z",), None, None, 0, 546)] * n
                        for i, o in enumerate(o1):
                            outs[b1 + i] = o
                        for i, o in enumerate(o2):
                            outs[b2 + i] = o
                        inputs = {("coin", X1, 0), ("coin", X1, 1), ("coin", X2, 0), ("coin", X2, 1), ("wallet",)}
                        plans = [(X1, sh1, b1), (X2, sh2, b2)]
                        for cand in itertools.chain([outs], neighbourhood(outs, alpha, rng, 100)):
                            checked += 1
                            res = evaluate(cand, inputs, plans)
                            if res is None:
                                continue
                            valid += 1
                            two += 1
                            for c1 in res[0][3]:
                                for c2 in res[1][3]:
                                    err = theorems_hold(cand, inputs, [(X1, sh1, b1, c1), (X2, sh2, b2, c2)], [])
                                    check(err is None, f"t7 two: {err} b1={b1} b2={b2} outs={cand}")
    # sweep: a transaction that sweeps (X, 0) carries no token at all
    sweeps = 0
    for _ in range(50000):
        outs = [rng.choice(alpha) for _ in range(rng.randint(1, 3))]
        inputs = {("coin", X1, 0), ("wallet",)}
        if consensus_ok(outs, inputs) and sweep_ok(outs):
            sweeps += 1
            err = theorems_hold(outs, inputs, [], [X1])
            check(err is None, f"t7 sweep: {err} {outs}")
    # random transactions with no create: no token of a new category can appear
    for _ in range(100000):
        outs = [rng.choice(alpha) for _ in range(rng.randint(1, 5))]
        inputs = {("wallet",)}
        if consensus_ok(outs, inputs):
            check(not any(o[1] in (X1, X2) for o in outs), "t7: a new category without its genesis input")
    check(valid > 0 and honest > 0, "t7 control: honest creations must pass")
    # Negative controls: with the census removed, or with unused slots allowed a token, the same search must find
    # a valid transaction that breaks a theorem; so the checks above are not vacuous.
    controls = {}
    for name, weaken in (("no census", {"census": False}), ("unused slots may hold a token", {"unused_no_token": False})):
        found = 0
        for sh1, sh2 in [(Shape(N=1, s_c=1, e_s=1), Shape())]:
            w1 = len(sh1.kinds())
            for b1 in (0, 1):
                for b2 in range(0, b1 + w1 + 2):
                    for r1 in runs_of(sh1):
                        o1 = honest_outputs(X1, sh1, b1, r1)
                        o2 = honest_outputs(X2, sh2, b2, (0, ()))
                        n = max(b1 + w1, b2 + len(sh2.kinds())) + 1
                        outs = [(("Z",), None, None, 0, 546)] * n
                        for i, o in enumerate(o1):
                            outs[b1 + i] = o
                        for i, o in enumerate(o2):
                            outs[b2 + i] = o
                        inputs = {("coin", X1, 0), ("coin", X1, 1), ("coin", X2, 0), ("coin", X2, 1), ("wallet",)}
                        for cand in itertools.chain([outs], neighbourhood(outs, alpha, rng, 50)):
                            res = evaluate(cand, inputs, [(X1, sh1, b1), (X2, sh2, b2)], **weaken)
                            if res is None:
                                continue
                            for c1 in res[0][3]:
                                if theorems_hold(cand, inputs, [(X1, sh1, b1, c1), (X2, sh2, b2, res[1][3][0])], []):
                                    found += 1
        controls[name] = found
        check(found > 0, f"t7 control: weakening '{name}' should break a theorem")
    return (f"{checked} transactions around {honest} honest creations (every single mutation, random double ones, "
            f"with and without the author coin; two creations with every base, overlapping included): "
            f"{valid} valid, {two} with two creations; Lemma 3 and Theorems 1, 7, 8, 9 hold in every valid one; "
            f"{sweeps} sweeps carry no token; controls: weakening the rules breaks a theorem in "
            f"{controls['no census']} and {controls['unused slots may hold a token']} transactions")


def main():
    results = []
    for name, fn in [("1 Lemma 4, collection rows", check_lemma4), ("2 reads", check_reads),
                     ("3 group condition", check_group_condition), ("4 balance rule", check_balance_rule),
                     ("5 tail and marker", check_tail_and_marker), ("6 binding at a new site", check_binding),
                     ("7 Lemma 3, Theorems 1, 7, 8, 9 on a transaction model", check_transaction_theorems)]:
        before = len(FAILURES)
        summary = fn()
        status = "PASS" if len(FAILURES) == before else f"FAIL ({len(FAILURES) - before})"
        results.append((name, status, summary))
        print(f"[{status}] {name}: {summary}", flush=True)
    print()
    print("ALL PASS" if not FAILURES else f"{len(FAILURES)} FAILURES")
    return 0 if not FAILURES else 1


if __name__ == "__main__":
    sys.exit(main())
