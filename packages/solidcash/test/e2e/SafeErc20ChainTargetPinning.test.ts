/* eslint-disable max-len */
import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';

// #2 (deferred): the OZ SafeERC20 low-level-call chain with a STORAGE-POINTER-field target. OZ forceApprove's
// `_callOptionalReturnBool` does `address(token).call(data)`; after the SafeERC20/Address chain is inlined the
// receiver is `address(__rh0_token)` where the inliner bound `token = IERC20(jobs[id].token)`. That inlined-local
// cast form used to fail "external call target address must be a constructor/function parameter".
// SynthesizeExternalAddressLocals now traces the receiver through casts + inliner-local aliases back to the
// self-pinned state chain and hoists it into an __extaddr_ local, so the covenant pins the co-spent callee to
// `config.token` (byte-identical target-pinning to the shipped interface-field form, StructFieldExternalCall).
// This file proves the pinning END TO END: the correct callee is accepted, a substituted callee is rejected.
const ECHO = `pragma solidcash >=0.8.0;
contract Echo() {
  bigint stored;
  function setAndReturn(bigint v, pubkey pk, sig s) returns (bigint) {
    require(checkSig(s, pk));
    this.stored = v;
    return v;
  }
}`;

// The SafeERC20 shape: an interface-typed helper param, `address(tok).call(data)` inside a value-returning helper
// that inlines into `pay`. `IEcho(config.token)` is the `IERC20(jobs[id].token)` analog (self-pinned state field).
const CALLER = `pragma solidcash >=0.8.0;
interface IEcho { function setAndReturn(bigint v, pubkey pk, sig s) returns (bigint); }
struct Config { address token; }
contract Caller() {
  Config config;
  bytes32 digest;
  function _callBool(IEcho tok, bytes data) internal returns (bool) {
    bool ok, bytes result = address(tok).call(data);
    return ok;
  }
  function pay(bytes payload, pubkey pk, sig s) {
    require(checkSig(s, pk));
    bool ok = _callBool(IEcho(config.token), payload);
    require(ok);
    this.digest = sha256(payload);
  }
}`;

describe('SafeERC20-chain low-level .call with a self-pinned state-chain target (#2)', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
  const echoArt = compileString(ECHO);
  const callerArt = compileString(CALLER);

  it('compiles the inlined SafeERC20-shape helper: the call target is sourced from the self-pinned state chain', () => {
    const fn = callerArt.abi.find((f) => f.name === 'pay')!;
    const ec = fn.externalCalls?.find((e) => e.opaqueReturn);
    expect(ec).toBeDefined();
    // The inlined `address(__rhN_tok).call` resolved to the state chain `config.token`, NOT left as a caller input.
    expect(ec!.addressParam).toBe('__extaddr_ll_config_token');
    expect(ec!.addressStateVar).toBe('ll_config_token');
    expect(callerArt.abi.some((f) => f.name === '_callBool')).toBe(false); // helper inlined, not a subroutine
  });

  async function genEcho(): Promise<{ sc: StatefulContract; addr: Uint8Array }> {
    const c = new Contract(echoArt, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, c, echoArt.stateLayout!, { stored: 0n }, { saltContract: true });
    return { sc: StatefulContract.withCategory(c, categoryId), addr: hexToBin(c.withCategory(hexToBin(categoryId)).lockingBytecode) };
  }
  async function genCaller(tokenAddr: Uint8Array): Promise<StatefulContract> {
    const c = new Contract(callerArt, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, c, callerArt.stateLayout!, { config: { token: tokenAddr }, digest: new Uint8Array(32) }, { saltContract: true },
    );
    return StatefulContract.withCategory(c, categoryId);
  }
  const payload = hexToBin(echoArt.abi.find((f) => f.name === 'setAndReturn')!.selector!);

  it('accepts the co-spent callee pinned in config.token (correct target)', async () => {
    const echo = await genEcho();
    const caller = await genCaller(echo.addr); // config.token = the echo callee's locking bytecode

    const tx = await caller.pay(payload, alicePub, sig())
      .withExternalCall(echo.sc, 'setAndReturn', [42n, alicePub, sig()])
      .send();
    expect(tx.txid).toBeDefined();
    expect((await echo.sc.getState()).stored).toBe(42n);
  });

  it('NEGATIVE: co-spending a DIFFERENT callee than config.token is rejected (target-pinning holds)', async () => {
    const echoA = await genEcho();
    const echoB = await genEcho(); // a different Echo instance the attacker tries to substitute
    const caller = await genCaller(echoA.addr); // config.token pins echoA

    await expect(
      caller.pay(payload, alicePub, sig())
        .withExternalCall(echoB.sc, 'setAndReturn', [42n, alicePub, sig()])
        .send(),
    ).rejects.toThrow('layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.');
  });
});
