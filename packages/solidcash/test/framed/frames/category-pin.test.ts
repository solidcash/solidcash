import { describe, expect, it } from 'vitest';
import { encodeDataPush, hash256, encodeLockingBytecodeP2sh32, Opcodes } from '@bitauth/libauth';
import { TokenCapability, categoryPin, categoryPinScript } from '@solidcash/utils';
import { seededCategory } from '../../../../solidc/test/framed/master/validator-input.js';
import { MockNetworkProvider } from '../../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';

/**
 * The category pin, evaluated in the VM.
 *
 * A pin proves which token category a spent input carried, by comparing bytes a script pushes against what the
 * machine reports for that input. The capability is the subtlety: introspection omits the capability byte when the
 * token has no capability, so a pin that always appends one never matches an immutable token. These cases put the pin
 * in front of the machine, where the truth is not an opinion.
 */

const RELAXED_LIMITS = {
  maximumInputBytes: 100_000,
  maximumStackItemBytes: 10_000,
  maximumTransactionBytes: 1_000_000,
  maximumNftCommitmentBytes: 128,
  operationCostBudgetPerByte: 800,
  hashDigestIterationsPerByte: 3,
};

const CATEGORY = seededCategory('category pin');
const COMMITMENT = new Uint8Array(32).fill(0x7e);

interface PinOptions {
  /** The capability of the token the spent input carries. */
  readonly capability: 'none' | 'mutable' | 'minting';
  /** Whether the spent input carries a token at all. */
  readonly hasToken?: boolean;
  /** Replaces the pin fragment, to exercise a differently built one. */
  readonly pinScript?: Uint8Array;
}

/** Evaluates `pinScript + OP_1` against an input carrying a token of the given capability. */
function evaluatePin(options: PinOptions): { accepted: boolean; objection?: string } {
  const pin = options.pinScript ?? categoryPinScript(CATEGORY, TokenCapability[options.capability.toUpperCase() as
    'NONE' | 'MUTABLE' | 'MINTING']);
  const redeemScript = new Uint8Array([...pin, Opcodes.OP_1]);
  const lock = encodeLockingBytecodeP2sh32(hash256(redeemScript));

  const token = {
    category: CATEGORY,
    amount: 0n,
    nft: { capability: options.capability, commitment: COMMITMENT },
  };
  const sourceOutput = {
    lockingBytecode: lock,
    valueSatoshis: 20_000n,
    ...(options.hasToken === false ? {} : { token }),
  };
  const transaction = {
    version: 2,
    inputs: [{
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32),
      sequenceNumber: 0xffffffff,
      unlockingBytecode: encodeDataPush(redeemScript),
    }],
    outputs: [{ lockingBytecode: lock, valueSatoshis: 20_000n, ...(options.hasToken === false ? {} : { token }) }],
    locktime: 0,
  };

  const provider = new MockNetworkProvider({ consensusLimits: RELAXED_LIMITS, policy: { enforceDust: false } });
  const vm = createVirtualMachineBch2026ForProvider(provider);
  const state = vm.evaluate({ inputIndex: 0, sourceOutputs: [sourceOutput], transaction });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

describe('the category pin', () => {
  it('matches a token that carries the capability it pins', () => {
    expect(evaluatePin({ capability: 'mutable' }).accepted).toBe(true);
    expect(evaluatePin({ capability: 'minting' }).accepted).toBe(true);
  });

  it('matches an immutable token, whose category introspection reports without a capability byte', () => {
    // The case a pin built as `category || 0x00` can never match, because the machine reports the category alone.
    expect(evaluatePin({ capability: 'none' })).toStrictEqual({ accepted: true });
  });

  it('proves the capability it pins, so another one fails', () => {
    // The mutable pin against an immutable token, and the immutable pin against a mutable token.
    const withPin = (capability: number): Uint8Array => categoryPinScript(CATEGORY, capability);
    expect(evaluatePin({ capability: 'none', pinScript: withPin(TokenCapability.MUTABLE) }).accepted).toBe(false);
    expect(evaluatePin({ capability: 'mutable', pinScript: withPin(TokenCapability.NONE) }).accepted).toBe(false);
    expect(evaluatePin({ capability: 'minting', pinScript: withPin(TokenCapability.MUTABLE) }).accepted).toBe(false);
  });

  it('refuses an input that carries no token at all', () => {
    expect(evaluatePin({ capability: 'mutable', hasToken: false }).accepted).toBe(false);
    expect(evaluatePin({ capability: 'none', hasToken: false }).accepted).toBe(false);
  });

  it('refuses a pin that names another category', () => {
    const other = seededCategory('category pin other');
    expect(evaluatePin({ capability: 'mutable', pinScript: categoryPinScript(other, TokenCapability.MUTABLE) })
      .accepted).toBe(false);
  });

  it('builds the bare category for a token with no capability and the pair otherwise', () => {
    // The two forms the machine reports, stated as lengths rather than as an opinion about them.
    expect(categoryPin(CATEGORY, TokenCapability.NONE).length).toBe(32);
    expect(categoryPin(CATEGORY, TokenCapability.MUTABLE).length).toBe(33);
    expect(categoryPin(CATEGORY, TokenCapability.MINTING).length).toBe(33);
    // And the pin script pushes exactly those bytes.
    const immutablePin = categoryPinScript(CATEGORY, TokenCapability.NONE);
    expect(immutablePin[0]).toBe(32);
    expect(immutablePin.length).toBe(32 + 4);
  });
});
