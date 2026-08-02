import { describe, expect, it } from 'vitest';
import {
  AbiFunction, describeProvenance, isAddressCommittedProvenance, lowLevelCallTargetProvenance,
  signatureGuardKeyProvenance,
} from '@solidcash/utils';
import { compileString } from '../src/index.js';

/**
 * X37. The artifact publishes WHERE a delegatecall target and a signature-guard key came from, not what type
 * they were spelled as.
 *
 * Review A13 defeated the two delegate-class fixes by re-spelling the caller's value: `address t =
 * address(target)` with `target` a `bytes` parameter publishes no `address` parameter, and `checkSig(s,
 * pubkey(k))` with `k` a `bytes` parameter publishes no `pubkey` parameter. Refusing `bytes` parameters is
 * not available - the calldata parameter every admitted class carries is `bytes` - so the type could never
 * have answered the question. These cases pin that the SEMANTIC answer survives every re-spelling.
 */

const guard = (source: string, fn = 'up'): AbiFunction => {
  const original = console.log;
  // The compiler prints a low-level-call notice on every one of these; keep the test output readable.
  // eslint-disable-next-line no-console
  console.log = (): void => {};
  try {
    return compileString(source).abi.find((entry) => entry.name === fn)!;
  } finally {
    // eslint-disable-next-line no-console
    console.log = original;
  }
};

const targetOf = (source: string, fn = 'up'): unknown => guard(source, fn).lowLevelCalls?.[0]?.target;

describe('X37: published delegatecall target provenance', () => {
  it('names a constructor argument, which the contract p2sh32 commits to', () => {
    expect(targetOf(`pragma solidcash >=0.8.0;
contract Pinned(address impl) {
    bigint counter;
    function up(bytes input) external {
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`)).toEqual({ kind: 'constructorArg', name: 'impl' });
  });

  it('names an `address` parameter the caller chooses', () => {
    expect(targetOf(`pragma solidcash >=0.8.0;
contract Trap(address pinned) {
    bigint counter;
    function up(bytes input, address impl) external {
        require(pinned.length == 35);
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`)).toEqual({ kind: 'parameter', name: 'impl' });
  });

  // A13's escape. The proxy publishes NO `address` parameter, so a gate reading the parameter TYPES admits it.
  it('THE POINT: a `bytes` parameter cast to address still resolves to `parameter`', () => {
    const source = `pragma solidcash >=0.8.0;
contract BytesTrap(address pinned) {
    bigint counter;
    function up(bytes input, bytes target) external {
        require(pinned.length == 35);
        address t = address(target);
        t.delegatecall(input);
        require(input.length > 0);
    }
}`;
    // The published TYPES are exactly those of the admitted bytecode-pinned class: two `bytes` parameters.
    expect(guard(source).inputs.filter((input) => !input.name.startsWith('__internal__'))
      .map((input) => input.type)).toEqual(['bytes', 'bytes']);
    expect(targetOf(source)).toEqual({ kind: 'parameter', name: 'target' });
  });

  it('and the same escape written inline, with no local to follow', () => {
    expect(targetOf(`pragma solidcash >=0.8.0;
contract InlineBytesTrap() {
    bigint counter;
    function up(bytes input, bytes target) external {
        address(target).delegatecall(input);
        require(input.length > 0);
    }
}`)).toEqual({ kind: 'parameter', name: 'target' });
  });

  it('follows an honest alias to the constructor argument behind it', () => {
    expect(targetOf(`pragma solidcash >=0.8.0;
contract AliasPinned(address impl) {
    bigint counter;
    function up(bytes input) external {
        address t = impl;
        t.delegatecall(input);
        require(input.length > 0);
    }
}`)).toEqual({ kind: 'constructorArg', name: 'impl' });
  });

  /**
   * Resolving only the DECLARATION would publish the constructor argument here while the call reaches the
   * caller's bytes - a false safe, and a worse outcome than publishing nothing. Every binding site is folded,
   * weakest first.
   */
  it('refuses a local that is declared honestly and then reassigned to the caller value', () => {
    expect(targetOf(`pragma solidcash >=0.8.0;
contract ReassignTrap(address impl) {
    bigint counter;
    function up(bytes input, bytes target) external {
        address t = impl;
        t = address(target);
        t.delegatecall(input);
        require(input.length > 0);
    }
}`)).toEqual({ kind: 'parameter', name: 'target' });
  });

  it('names a state variable, a compile-time literal, and an unresolvable expression', () => {
    expect(targetOf(`pragma solidcash >=0.8.0;
contract StateTarget() {
    bytes impl;
    bigint counter;
    function up(bytes input) external {
        address(this.impl).delegatecall(input);
        require(input.length > 0);
    }
}`)).toEqual({ kind: 'stateVar', name: 'impl' });

    expect(targetOf(`pragma solidcash >=0.8.0;
contract LiteralTarget() {
    bigint counter;
    function up(bytes input) external {
        address t = address(0x76a914000000000000000000000000000000000000000088ac);
        t.delegatecall(input);
        require(input.length > 0);
    }
}`)).toEqual({ kind: 'literal' });

    expect(targetOf(`pragma solidcash >=0.8.0;
contract ComputedTarget(address a) {
    bigint counter;
    function up(bytes input, bytes suffix) external {
        address t = address(bytes(a) + suffix);
        t.delegatecall(input);
        require(input.length > 0);
    }
}`)).toEqual({ kind: 'computed' });
  });

  it('answers per callsite, keyed by the same index the block layout uses', () => {
    expect(guard(`pragma solidcash >=0.8.0;
contract TwoCalls(address pinned) {
    bigint counter;
    function up(bytes input, address impl) external {
        pinned.call(input);
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`).lowLevelCalls).toEqual([
      { callMode: 'call', target: { kind: 'constructorArg', name: 'pinned' } },
      { callMode: 'delegatecall', target: { kind: 'parameter', name: 'impl' } },
    ]);
  });
});

describe('X37: published signature-guard key provenance', () => {
  it('names the constructor argument the caller-authorized class relies on', () => {
    expect(guard(`pragma solidcash >=0.8.0;
contract Authorized(pubkey owner) {
    bigint counter;
    function up(bytes input, address impl, sig s) external {
        require(checkSig(s, owner));
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`).signatureGuard).toEqual({ key: { kind: 'constructorArg', name: 'owner' } });
  });

  it('names a `pubkey` parameter the caller supplies, which authorizes nothing', () => {
    expect(guard(`pragma solidcash >=0.8.0;
contract SelfAuth() {
    bigint counter;
    function up(bytes input, address impl, pubkey pk, sig s) external {
        require(checkSig(s, pk));
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`).signatureGuard).toEqual({ key: { kind: 'parameter', name: 'pk' } });
  });

  // A13's second escape. The proxy publishes NO `pubkey` parameter, so the parameter-TYPE gate admits it.
  it('THE POINT: `checkSig(s, pubkey(k))` over a `bytes` parameter still resolves to `parameter`', () => {
    const source = `pragma solidcash >=0.8.0;
contract BytesKey() {
    bigint counter;
    function up(bytes input, address impl, bytes k, sig s) external {
        require(checkSig(s, pubkey(k)));
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`;
    expect(guard(source).inputs.some((input) => input.type === 'pubkey')).toBe(false);
    expect(guard(source).signatureGuard).toEqual({ key: { kind: 'parameter', name: 'k' } });
  });

  it('and the same escape behind a local `pubkey` alias', () => {
    expect(guard(`pragma solidcash >=0.8.0;
contract BytesKeyAlias() {
    bigint counter;
    function up(bytes input, address impl, bytes k, sig s) external {
        pubkey p = pubkey(k);
        require(checkSig(s, p));
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`).signatureGuard).toEqual({ key: { kind: 'parameter', name: 'k' } });
  });

  it('publishes the WEAKEST key when a body checks several', () => {
    // Both guards must pass here, so the real authority is `owner`. Publishing the weaker `pk` understates it,
    // which refuses a safe contract rather than admitting an unsafe one.
    expect(guard(`pragma solidcash >=0.8.0;
contract TwoGuards(pubkey owner) {
    bigint counter;
    function up(bytes input, address impl, pubkey pk, sig s, sig s2) external {
        require(checkSig(s, owner));
        require(checkSig(s2, pk));
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`).signatureGuard).toEqual({ key: { kind: 'parameter', name: 'pk' } });
  });

  it('reads a multisig key SET as its weakest member', () => {
    expect(guard(`pragma solidcash >=0.8.0;
contract MixedMultiSig(pubkey a) {
    bigint counter;
    function up(bytes input, address impl, pubkey b, sig s1, sig s2) external {
        require(checkMultiSig([s1, s2], [a, b]));
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`).signatureGuard).toEqual({ key: { kind: 'parameter', name: 'b' } });

    expect(guard(`pragma solidcash >=0.8.0;
contract CommittedMultiSig(pubkey a, pubkey b) {
    bigint counter;
    function up(bytes input, address impl, sig s1, sig s2) external {
        require(checkMultiSig([s1, s2], [a, b]));
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`).signatureGuard!.key.kind).toBe('constructorArg');
  });

  it('reads the key argument of checkDataSig, not its message', () => {
    expect(guard(`pragma solidcash >=0.8.0;
contract DataSig(pubkey owner) {
    bigint counter;
    function up(bytes input, address impl, bytes payload, datasig ds) external {
        require(checkDataSig(ds, payload, owner));
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`).signatureGuard).toEqual({ key: { kind: 'constructorArg', name: 'owner' } });
  });

  it('publishes nothing when the body has no signature check at all', () => {
    expect(guard(`pragma solidcash >=0.8.0;
contract NoGuard(address impl) {
    bigint counter;
    function up(bytes input) external {
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`).signatureGuard).toBeUndefined();
  });
});

describe('X37: the answer does not depend on the route', () => {
  const BUS = {
    forceStateful: true,
    hiddenBatch: true,
    messageBusController: `aa20${'11'.repeat(32)}87`,
    messageBusControllerCategory: '22'.repeat(32),
  };

  const PROXY = (params: string, body: string): string => `pragma solidcash >=0.8.0;
contract RouteProxy(address pinned) {
    bigint counter;
    function up(bytes input${params}) external {
        require(pinned.length == 35);
        ${body}
        require(input.length > 0);
    }
}`;

  const both = (source: string): unknown[] => {
    const original = console.log;
    // eslint-disable-next-line no-console
    console.log = (): void => {};
    try {
      return [compileString(source, BUS), compileString(source, { forceStateful: true })]
        .map((artifact) => artifact.abi.find((entry) => entry.name === 'up')!.lowLevelCalls);
    } finally {
      // eslint-disable-next-line no-console
      console.log = original;
    }
  };

  it('publishes the same target on the message-bus graph route and the direct route', () => {
    const honest = both(PROXY('', 'pinned.delegatecall(input);'));
    expect(honest[0]).toEqual([{ callMode: 'delegatecall', target: { kind: 'constructorArg', name: 'pinned' } }]);
    expect(honest[1]).toEqual(honest[0]);

    const escape = both(PROXY(', bytes target', 'address t = address(target); t.delegatecall(input);'));
    expect(escape[0]).toEqual([{ callMode: 'delegatecall', target: { kind: 'parameter', name: 'target' } }]);
    expect(escape[1]).toEqual(escape[0]);
  });
});

/**
 * The two fields are ADDITIVE and OPTIONAL, exactly as X4's were, and this is the compatibility contract a
 * consumer has to honour:
 *
 * 1. An absent field is the WEAKEST fact, never a proof of safety. `target` absent means the target's source
 *    is unknown; `signatureGuard` absent means no authority is proven. Neither may be read as "unconstrained"
 *    or "fine".
 * 2. Read both through the `@solidcash/utils` readers, which spell the missing case `unknown` - a kind the
 *    compiler never emits - so "the artifact said nothing" can never be confused with one of its five answers.
 * 3. Admit on an explicit allow-list of kinds. `isAddressCommittedProvenance` refuses everything not on it, so
 *    a kind a later compiler adds falls closed rather than being admitted by omission.
 * 4. A new compiler ALWAYS writes `target` on every low-level call row, `computed` included. A row without one
 *    therefore identifies an artifact compiled before the field existed. `signatureGuard` carries no such
 *    marker, and does not need one: both of its absent readings mean "unguarded".
 */
describe('X37: old artifacts read back unchanged', () => {
  const OLD_CALL = { callMode: 'delegatecall' as const };
  const OLD_FN = { name: '__fallback', inputs: [] } as AbiFunction;

  it('a low-level call row with no target reads as `unknown`, and is not committed', () => {
    const provenance = lowLevelCallTargetProvenance(OLD_CALL);
    expect(provenance).toEqual({ kind: 'unknown' });
    expect(isAddressCommittedProvenance(provenance)).toBe(false);
    expect(describeProvenance(provenance)).toBe('a source this artifact does not name');
    // Reading the row itself is untouched: no field appeared, and callMode still answers what it always did.
    expect(OLD_CALL).toEqual({ callMode: 'delegatecall' });
  });

  it('a function with no signatureGuard reads as `unknown`, exactly like an unguarded new one', () => {
    expect(signatureGuardKeyProvenance(OLD_FN)).toEqual({ kind: 'unknown' });
    expect(isAddressCommittedProvenance(signatureGuardKeyProvenance(OLD_FN))).toBe(false);
  });

  it('and a NEW artifact answers the same questions through the same readers', () => {
    const fn = guard(`pragma solidcash >=0.8.0;
contract Pinned(address impl) {
    bigint counter;
    function up(bytes input) external {
        impl.delegatecall(input);
        require(input.length > 0);
    }
}`);
    const provenance = lowLevelCallTargetProvenance(fn.lowLevelCalls![0]);
    expect(isAddressCommittedProvenance(provenance)).toBe(true);
    expect(describeProvenance(provenance)).toBe("constructor argument 'impl'");
    // A caller-chosen target is refused by the same allow-list, with a diagnostic that names the parameter.
    const trap = lowLevelCallTargetProvenance(guard(`pragma solidcash >=0.8.0;
contract BytesTrap() {
    bigint counter;
    function up(bytes input, bytes target) external {
        address(target).delegatecall(input);
        require(input.length > 0);
    }
}`).lowLevelCalls![0]);
    expect(isAddressCommittedProvenance(trap)).toBe(false);
    expect(describeProvenance(trap)).toBe("caller-supplied parameter 'target'");
  });
});
