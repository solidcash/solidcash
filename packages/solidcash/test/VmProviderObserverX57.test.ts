import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, decodeTransactionUnsafe, encodeTransactionBch, hexToBin,
} from '@bitauth/libauth';
import { OpcodesBch2026 as Op } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-opcodes.js';
import {
  BitcoinRpcNetworkProvider, ElectrumNetworkProvider, FullStackNetworkProvider, MockNetworkProvider,
  Network, RegtestNetworkProvider,
} from '../src/index.js';
import type NetworkProvider from '../src/network/NetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from '../src/network/createVirtualMachine.js';

/**
 * X57: `createVirtualMachineBch2026ForProvider` returned early when the provider published no
 * `consensusLimits`, silently discarding the caller's opcode observer. Every live provider is in that
 * category, so an observer requested on a live network never fired.
 */

type Program = Parameters<ReturnType<typeof createVirtualMachineBch2026ForProvider>['evaluate']>[0];

/** Build a single-input program: `unlocking` pushes, `locking` verifies. No P2SH, no signatures. */
function buildProgram(scripts: Array<{ unlocking: Uint8Array; locking: Uint8Array }>, inputIndex = 0): Program {
  const transaction = decodeTransactionUnsafe(encodeTransactionBch({
    version: 2,
    inputs: scripts.map((script, index) => ({
      outpointTransactionHash: hexToBin(String(index + 1).repeat(2).padStart(64, '0')),
      outpointIndex: index,
      sequenceNumber: 0xffffffff,
      unlockingBytecode: script.unlocking,
    })),
    outputs: [{ lockingBytecode: Uint8Array.of(Op.OP_1), valueSatoshis: 1_000n }],
    locktime: 0,
  }));
  const sourceOutputs = scripts.map((script) => ({
    lockingBytecode: script.locking,
    valueSatoshis: 10_000n,
  }));
  return { inputIndex, sourceOutputs, transaction } as unknown as Program;
}

/** OP_1 OP_1 | OP_EQUALVERIFY OP_1 - succeeds, and executes exactly one OP_EQUALVERIFY. */
const EQUALVERIFY_SCRIPT = {
  unlocking: Uint8Array.of(Op.OP_1, Op.OP_1),
  locking: Uint8Array.of(Op.OP_EQUALVERIFY, Op.OP_1),
};

/** Record every opcode the observer is invoked for. */
function recordingObserver(opcodes: number[]): {
  seen: number[];
  observer: { opcodes: ReadonlySet<number>; beforeOperation: (state: unknown) => void };
} {
  const seen: number[] = [];
  return {
    seen,
    observer: {
      opcodes: new Set(opcodes),
      beforeOperation: (unknownState) => {
        const state = unknownState as { ip: number; instructions: Array<{ opcode: number }> };
        seen.push(state.instructions[state.ip]?.opcode ?? -1);
      },
    },
  };
}

/** Every non-mock provider class. Network calls are never made here, so stub clients are sufficient. */
function liveProviders(): NetworkProvider[] {
  return [
    new ElectrumNetworkProvider(Network.CHIPNET),
    new RegtestNetworkProvider(),
    new FullStackNetworkProvider(Network.MAINNET, {} as never),
    new BitcoinRpcNetworkProvider(Network.REGTEST, 'http://localhost:18443', {
      rpcUser: 'user', rpcPassword: 'password',
    }),
  ];
}

describe('X57 opcode observer survives providers without consensusLimits', () => {
  // Pins the premise: exactly one provider publishes consensusLimits, and it is the mock. If a live provider
  // ever gains limits this test says so, because the X57 masking analysis depends on this split.
  it('only MockNetworkProvider publishes consensusLimits', () => {
    for (const provider of liveProviders()) expect(provider.consensusLimits).toBeUndefined();
    expect(new MockNetworkProvider().consensusLimits).toBeDefined();
  });

  // POSITIVE CONTROL on a non-mock provider. This is the case X57 breaks: fails before the fix (0 calls).
  it('fires the observer on a live provider that publishes no limits', () => {
    const provider = new RegtestNetworkProvider();
    expect(provider.consensusLimits).toBeUndefined();
    const { seen, observer } = recordingObserver([Op.OP_EQUALVERIFY]);
    const vm = createVirtualMachineBch2026ForProvider(provider, observer);
    const result = vm.evaluate(buildProgram([EQUALVERIFY_SCRIPT])) as { error?: string };

    expect(result.error).toBeUndefined();
    expect(seen).toEqual([Op.OP_EQUALVERIFY]);
  });

  it('fires the observer for every live provider class', () => {
    for (const provider of liveProviders()) {
      const { seen, observer } = recordingObserver([Op.OP_EQUALVERIFY]);
      createVirtualMachineBch2026ForProvider(provider, observer)
        .evaluate(buildProgram([EQUALVERIFY_SCRIPT]));
      expect(seen, `${provider.constructor.name} observer`).toEqual([Op.OP_EQUALVERIFY]);
    }
  });

  it('fires the observer when no provider is supplied at all', () => {
    const { seen, observer } = recordingObserver([Op.OP_EQUALVERIFY]);
    createVirtualMachineBch2026ForProvider(undefined, observer).evaluate(buildProgram([EQUALVERIFY_SCRIPT]));
    expect(seen).toEqual([Op.OP_EQUALVERIFY]);
  });

  // HOSTILE, pinned to input index 1: the observer must report the evaluated input's opcodes only. A fix that
  // installed the observer globally, or that evaluated the wrong input, is caught here.
  it('observes only the evaluated input index', () => {
    const provider = new RegtestNetworkProvider();
    // input 0 subtracts, input 1 adds; both leave 1 on the stack.
    const scripts = [
      { unlocking: Uint8Array.of(Op.OP_2, Op.OP_1), locking: Uint8Array.of(Op.OP_SUB) },
      { unlocking: Uint8Array.of(Op.OP_1, Op.OP_1), locking: Uint8Array.of(Op.OP_ADD, Op.OP_1, Op.OP_EQUALVERIFY, Op.OP_1) },
    ];
    const watched = [Op.OP_SUB, Op.OP_ADD];

    const first = recordingObserver(watched);
    const firstResult = createVirtualMachineBch2026ForProvider(provider, first.observer)
      .evaluate(buildProgram(scripts, 0)) as { error?: string };
    expect(firstResult.error).toBeUndefined();
    expect(first.seen).toEqual([Op.OP_SUB]);

    const second = recordingObserver(watched);
    const secondResult = createVirtualMachineBch2026ForProvider(provider, second.observer)
      .evaluate(buildProgram(scripts, 1)) as { error?: string };
    // input 1 computes 1+1=2, which != 1, so OP_EQUALVERIFY fails - the observer still must have seen OP_ADD.
    expect(secondResult.error).toBeDefined();
    expect(second.seen).toEqual([Op.OP_ADD]);
  });

  // GUARD (negative control): the mock path already worked, so a green result here credits nothing to the fix.
  // Asserted explicitly so the packet cannot mistake it for evidence, and so the fix is shown not to regress it.
  it('mock provider observer keeps working (passes with and without the fix)', () => {
    const provider = new MockNetworkProvider();
    const { seen, observer } = recordingObserver([Op.OP_EQUALVERIFY]);
    createVirtualMachineBch2026ForProvider(provider, observer).evaluate(buildProgram([EQUALVERIFY_SCRIPT]));
    expect(seen).toEqual([Op.OP_EQUALVERIFY]);
  });

  // GUARD: the two paths must stay distinct. A limits-less provider must keep REAL consensus limits, and a
  // relaxed mock must keep its relaxed ones - even now that both build the VM the same way.
  it('keeps real consensus limits for limits-less providers and relaxed limits for the mock', () => {
    // A 12,000-byte push exceeds the real 10,000-byte stack-item / bytecode limits but not the mock's 1MB.
    const payload = new Uint8Array(12_000);
    const unlocking = new Uint8Array(3 + payload.length);
    unlocking[0] = 0x4d; // OP_PUSHDATA2
    new DataView(unlocking.buffer).setUint16(1, payload.length, true);
    unlocking.set(payload, 3);
    const scripts = [{ unlocking, locking: Uint8Array.of(Op.OP_DROP, Op.OP_1) }];

    const observed = recordingObserver([Op.OP_DROP]);
    const live = createVirtualMachineBch2026ForProvider(new RegtestNetworkProvider(), observed.observer)
      .evaluate(buildProgram(scripts)) as { error?: string };
    expect(live.error).toBeDefined();

    const relaxed = createVirtualMachineBch2026ForProvider(new MockNetworkProvider(), observed.observer)
      .evaluate(buildProgram(scripts)) as { error?: string };
    expect(relaxed.error).toBeUndefined();
  });

  // EQUIVALENCE control: for a limits-less provider the VM must behave exactly like libauth's stock factory,
  // in both regimes, for both a passing and a failing program. This is what makes the fix safe for the ~15
  // live-network call sites that pass no observer.
  it.each([true, false])('matches createVirtualMachineBch2026(%s) when no limits are published', (standard) => {
    const cases: Array<{ unlocking: Uint8Array; locking: Uint8Array }> = [
      EQUALVERIFY_SCRIPT,
      { unlocking: Uint8Array.of(Op.OP_1, Op.OP_2), locking: Uint8Array.of(Op.OP_EQUALVERIFY, Op.OP_1) },
      { unlocking: Uint8Array.of(Op.OP_1), locking: Uint8Array.of(Op.OP_0) },
      { unlocking: Uint8Array.of(Op.OP_16, Op.OP_16), locking: Uint8Array.of(Op.OP_MUL, Op.OP_1) },
    ];
    const stock = createVirtualMachineBch2026(standard);
    for (const script of cases) {
      const program = buildProgram([script]);
      const { observer } = recordingObserver([Op.OP_EQUALVERIFY]);
      const patched = createVirtualMachineBch2026ForProvider(undefined, observer, { standard });
      const expected = stock.evaluate(program) as { error?: string; stack: Uint8Array[] };
      const actual = patched.evaluate(program) as { error?: string; stack: Uint8Array[] };
      expect(actual.error).toEqual(expected.error);
      expect(actual.stack).toEqual(expected.stack);
    }
  });

  // Second defect in the same install loop: 47 of 256 opcodes have no `operations` entry, so wrapping them
  // called `undefined(state)`. The covenant failure tracer observes all 256 opcodes and swallows exceptions,
  // so an unknown opcode silently destroyed the diagnostic it was there to produce.
  it.each([
    ['limits-less provider', () => new RegtestNetworkProvider() as NetworkProvider],
    ['relaxed mock provider', () => new MockNetworkProvider() as NetworkProvider],
  ])('preserves the unknown-opcode VM error when observing all 256 opcodes (%s)', (_label, makeProvider) => {
    const UNKNOWN_OPCODE = 0xbd;
    const program = buildProgram([{
      unlocking: Uint8Array.of(Op.OP_1),
      locking: Uint8Array.of(UNKNOWN_OPCODE, Op.OP_1),
    }]);
    const stock = createVirtualMachineBch2026(true).evaluate(program) as { error?: string };
    expect(stock.error).toBe('Called an unknown opcode.');

    const all = recordingObserver(Array.from({ length: 256 }, (_unused, opcode) => opcode));
    const vm = createVirtualMachineBch2026ForProvider(makeProvider(), all.observer);
    const result = vm.evaluate(program) as { error?: string };

    expect(result.error).toBe(stock.error);
    // The caller asked to observe every opcode, so the unknown one must still be reported, exactly once.
    expect(all.seen).toContain(UNKNOWN_OPCODE);
    expect(all.seen.filter((opcode) => opcode === UNKNOWN_OPCODE)).toHaveLength(1);
  });

  // GUARD: observing only real opcodes must leave the undefined-opcode handler completely alone.
  it('does not touch the unknown-opcode handler when only real opcodes are observed', () => {
    const program = buildProgram([{
      unlocking: Uint8Array.of(Op.OP_1),
      locking: Uint8Array.of(0xbd, Op.OP_1),
    }]);
    const { seen, observer } = recordingObserver([Op.OP_EQUALVERIFY, Op.OP_ADD]);
    const result = createVirtualMachineBch2026ForProvider(new RegtestNetworkProvider(), observer)
      .evaluate(program) as { error?: string };
    expect(result.error).toBe('Called an unknown opcode.');
    expect(seen).toEqual([]);
  });

  it('leaves the stock factory untouched when neither limits nor observer are given', () => {
    const program = buildProgram([EQUALVERIFY_SCRIPT]);
    const stock = createVirtualMachineBch2026(true).evaluate(program) as { error?: string; stack: Uint8Array[] };
    const built = createVirtualMachineBch2026ForProvider().evaluate(program) as { error?: string; stack: Uint8Array[] };
    expect(built.error).toEqual(stock.error);
    expect(built.stack).toEqual(stock.stack);
  });
});
