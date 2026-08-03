#!/usr/bin/env python3
"""
X49: is the 100,000-byte ceiling POLICY or CONSENSUS, and which policy rules does this node actually apply?

F1 measured the Layer-3 envelope against real BCH-2026 constants and found that C3 sits inside every
consensus limit and outside exactly one relay limit. A refusal from `sendrawtransaction` cannot by itself
tell those apart: the mempool applies consensus and policy together. The distinction only becomes visible
when the SAME bytes are offered by the other path, inside a block.

This script is MUTATING - it spends wallet coins and submits blocks - which is why it is a harness rather
than a test. The non-mutating half of the same evidence is committed as
`test/journal-message-bus/e2e/Layer3NodeEnvelopeX49.test.ts` and runs under `TESTS_USE_REGTEST`.

Usage, from the repo root with the regtest stack up:
    python3 packages/solidcash/test/regtest/x49-policy-vs-consensus.py

Two experiments:

  PART 1  One fully valid wallet-signed transaction, just over the ceiling, offered to the mempool and then
          to consensus inside a hand-assembled block. `getblocktemplate` refuses to serve a node with no
          peers, so the block is built from chain state directly; regtest proof of work is a formality.

  PART 2  A rule-by-rule map of what this node enforces. Regtest normally leaves `fRequireStandard` false,
          which would skip `IsStandardTx` entirely, so "the mempool accepted it" must not be read as
          "mainnet would relay it" until the gating is known. Each probe is a valid transaction violating
          exactly one candidate rule.
"""
import base64
import hashlib
import json
import struct
import urllib.error
import urllib.request

RPC_URL = "http://localhost:18443/"
AUTH = base64.b64encode(b"user:password").decode()


def rpc(method, params=None):
    payload = json.dumps({"jsonrpc": "1.0", "id": "x49", "method": method, "params": params or []})
    request = urllib.request.Request(
        RPC_URL, data=payload.encode(),
        headers={"content-type": "text/plain;", "Authorization": "Basic " + AUTH},
    )
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        return json.load(error)


def call(method, params=None):
    reply = rpc(method, params)
    if reply.get("error"):
        raise RuntimeError(f"{method}: {reply['error']}")
    return reply["result"]


def varint(n):
    if n < 0xfd:
        return bytes([n])
    if n <= 0xffff:
        return b"\xfd" + n.to_bytes(2, "little")
    if n <= 0xffffffff:
        return b"\xfe" + n.to_bytes(4, "little")
    return b"\xff" + n.to_bytes(8, "little")


def dsha(data):
    return hashlib.sha256(hashlib.sha256(data).digest()).digest()


def script_num(n):
    """Minimal CScriptNum encoding, for the BIP34 height in the coinbase scriptSig."""
    if n == 0:
        return b""
    out = bytearray()
    while n:
        out.append(n & 0xff)
        n >>= 8
    if out[-1] & 0x80:
        out.append(0x00)
    return bytes(out)


def spendable_coins(count):
    """Wallet coins not already committed by something sitting in the mempool."""
    committed = set()
    for txid in call("getrawmempool"):
        for vin in call("getrawtransaction", [txid, True])["vin"]:
            committed.add((vin["txid"], vin["vout"]))
    coins = [u for u in sorted(call("listunspent", [1]), key=lambda u: -u["amount"])
             if (u["txid"], u["vout"]) not in committed]
    if len(coins) < count:
        raise RuntimeError(f"need {count} spendable coins, found {len(coins)}")
    return coins[:count]


def build(coin, outputs, fee=400_000):
    """One real input, the given outputs, and change back to the funding script."""
    value = int(round(coin["amount"] * 1e8))
    change = value - sum(sats for sats, _ in outputs) - fee
    assert change > 10_000, change
    change_script = bytes.fromhex(coin["scriptPubKey"])
    body = b"\x02\x00\x00\x00" + varint(1)
    body += bytes.fromhex(coin["txid"])[::-1] + coin["vout"].to_bytes(4, "little")
    body += varint(0) + b"\xff\xff\xff\xff"
    body += varint(len(outputs) + 1)
    for sats, script in outputs:
        body += sats.to_bytes(8, "little") + varint(len(script)) + script
    body += change.to_bytes(8, "little") + varint(len(change_script)) + change_script
    return body + b"\x00\x00\x00\x00"


def sign(unsigned):
    signed = call("signrawtransactionwithwallet", [unsigned.hex()])
    if not signed.get("complete"):
        raise RuntimeError(f"signing failed: {signed.get('errors')}")
    return signed["hex"]


def verdict(raw_hex):
    result = call("testmempoolaccept", [[raw_hex]])[0]
    return "ACCEPTED" if result.get("allowed") else str(result.get("reject-reason"))


def mine_containing(raw_hex, coinbase_value=1000):
    """Assemble a block holding just the coinbase and this transaction, and submit it."""
    tip = call("getblockchaininfo")["bestblockhash"]
    header_info = call("getblockheader", [tip])
    height = header_info["height"] + 1
    h160 = bytes.fromhex(call("getaddressinfo", [call("getnewaddress")])["scriptPubKey"])[3:23]

    height_push = script_num(height)
    script_sig = bytes([len(height_push)]) + height_push + b"\x00"
    cb = b"\x01\x00\x00\x00" + varint(1) + b"\x00" * 32 + b"\xff\xff\xff\xff"
    cb += varint(len(script_sig)) + script_sig + b"\xff\xff\xff\xff"
    out_script = b"\x76\xa9\x14" + h160 + b"\x88\xac"
    cb += varint(1) + coinbase_value.to_bytes(8, "little")
    cb += varint(len(out_script)) + out_script + b"\x00\x00\x00\x00"

    tx = bytes.fromhex(raw_hex)
    merkle = dsha(dsha(cb) + dsha(tx))
    prev = bytes.fromhex(tip)[::-1]
    bits_le = bytes.fromhex(header_info["bits"])[::-1]
    stamp = max(header_info["mediantime"] + 1, header_info["time"] + 1)
    target = 0x7FFFFF * (1 << (8 * (0x20 - 3)))     # nBits 0x207fffff: regtest, essentially free

    for nonce in range(1 << 24):
        header = (struct.pack("<I", 0x20000000) + prev + merkle
                  + struct.pack("<I", stamp) + bits_le + struct.pack("<I", nonce))
        if int.from_bytes(dsha(header)[::-1], "big") <= target:
            break
    else:
        raise RuntimeError("no nonce found")

    result = call("submitblock", [(header + varint(2) + cb + tx).hex()])
    return result, height


def part1():
    print("PART 1: the same oversized bytes, offered to the mempool and then to consensus")
    print("-" * 92)
    coin = spendable_coins(1)[0]
    h160 = hashlib.sha256(b"x49").digest()[:20]
    p2pkh = b"\x76\xa9\x14" + h160 + b"\x88\xac"
    outputs = [(600, b"\x76\xa9\x14" + hashlib.sha256(b"x49" + i.to_bytes(4, "little")).digest()[:20]
                + b"\x88\xac") for i in range(2980)]
    raw = sign(build(coin, outputs))
    size = len(raw) // 2
    txid = dsha(bytes.fromhex(raw))[::-1].hex()
    assert p2pkh  # keep the helper honest about its own shape
    print(f"  transaction        : {size} bytes, ceiling 100,000, txid {txid[:32]}...")
    print(f"  MEMPOOL path       : {verdict(raw)}")
    send = rpc("sendrawtransaction", [raw])
    print(f"  sendrawtransaction : {send.get('result') or send['error']['message']}")
    result, height = mine_containing(raw)
    print(f"  BLOCK path         : submitblock -> {result if result is not None else 'ACCEPTED'} "
          f"at height {height}")
    confirmed = call("getrawtransaction", [txid, True])
    print(f"  on chain           : confirmations={confirmed.get('confirmations')} "
          f"size={confirmed.get('size')}")
    print("  => the ceiling is POLICY: consensus accepted the bytes the mempool refused.\n")


def part2():
    print("PART 2: which standard-policy rules this node actually applies")
    print("-" * 92)
    coins = spendable_coins(6)
    h160 = hashlib.sha256(b"probe").digest()[:20]
    p2pkh = b"\x76\xa9\x14" + h160 + b"\x88\xac"
    probes = [
        ("CONTROL: ordinary P2PKH output", [(100_000, p2pkh)]),
        ("bare non-standard scriptPubKey (OP_1 x12)", [(100_000, b"\x51" * 12)]),
        ("dust: P2PKH output of 100 sat", [(100, p2pkh)]),
        ("dust: bare OP_1 output of 10 sat", [(10, b"\x51")]),
        ("datacarrier: OP_RETURN of 500 bytes",
         [(0, b"\x6a\x4c" + bytes([255]) + b"\x00" * 255 + b"\x4c" + bytes([242]) + b"\x00" * 242)]),
        ("two OP_RETURN outputs", [(0, b"\x6a\x0a" + b"\x00" * 10), (0, b"\x6a\x0a" + b"\x00" * 10)]),
    ]
    print(f"  {'rule probed':<44} {'size':>7}  verdict")
    for (label, outputs), coin in zip(probes, coins):
        raw = sign(build(coin, outputs, fee=5000))
        print(f"  {label:<44} {len(raw)//2:>7}B  {verdict(raw)}")
    print("  => acceptance here is NOT proof of mainnet relay unless the rule was shown to be applied.\n")


if __name__ == "__main__":
    info = call("getblockchaininfo")
    print(f"node height={info['blocks']} chain={info['chain']} "
          f"may2026={info['upgrade_status']['mempool_activated']}\n")
    part1()
    part2()
