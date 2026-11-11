import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { computeFunctionSelectorHex, type ExternalCallAbi } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract, MixedCompileModeCallError } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { assertCallSelectorScheme } from '../../src/stateful/call-record.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// A compile has one mode and sees its callee only through an interface, so no compile can tell it calls across modes.
// The SDK is the first place that holds both artifacts.
const CALLEE = `pragma solidcash >=0.8.0;
contract Callee() {
  bigint hits;
  function ping(int x) { this.hits = this.hits + x; }
}`;

const CALLER = `pragma solidcash >=0.8.0;
interface IPing { function ping(int x) external; }
contract Caller() {
  bigint bumps;
  function run(address target) { IPing(target).ping(7); this.bumps = this.bumps + 1; }
}`;

const NATIVE = {};
const COMPAT = { evmCompat: true };

async function buildCall(callerOptions: object, calleeOptions: object): Promise<unknown> {
  const provider = createTestProvider();
  const calleeArtifact = compileString(CALLEE, calleeOptions);
  const callee = new Contract(calleeArtifact, [], { provider });
  const { categoryId: calleeCategory } = await setupStatefulUtxos(
    provider, callee, calleeArtifact.stateLayout!, { hits: 0n }, { saltContract: true },
  );
  const callerArtifact = compileString(CALLER, callerOptions);
  const caller = new Contract(callerArtifact, [], { provider });
  const { categoryId: callerCategory } = await setupStatefulUtxos(
    provider, caller, callerArtifact.stateLayout!, { bumps: 0n }, { saltContract: true },
  );
  const target = hexToBin(callee.withCategory(hexToBin(calleeCategory)).lockingBytecode);
  return (StatefulContract.withCategory(caller, callerCategory) as any).run(target)
    .withExternalCall(StatefulContract.withCategory(callee, calleeCategory), 'ping', [7n]).build();
}

describe('a call across compile modes', () => {
  it('spells int as int256 in both modes, so only the hash differs', () => {
    const selector = (options: object): string | undefined => compileString(CALLEE, options).abi
      .find((entry) => entry.name === 'ping')?.selector;
    expect(selector(NATIVE)).toBe(computeFunctionSelectorHex('ping(int256)'));
    expect(selector(COMPAT)).toBe(computeFunctionSelectorHex('ping(int256)', true));
  });

  it('is refused by name in both directions', async () => {
    await expect(buildCall(COMPAT, NATIVE)).rejects.toThrow(MixedCompileModeCallError);
    await expect(buildCall(NATIVE, COMPAT)).rejects.toThrow(MixedCompileModeCallError);
  }, 300_000);

  it('builds in one mode', async () => {
    await expect(buildCall(NATIVE, NATIVE)).resolves.toBeDefined();
    await expect(buildCall(COMPAT, COMPAT)).resolves.toBeDefined();
  }, 300_000);

  it('binds a selector check as it binds a record, and no selector the caller did not compile', () => {
    const caller = compileString(CALLER, COMPAT);
    const callee = compileString(CALLEE, NATIVE);
    const slot = caller.abi.find((entry) => entry.name === 'run')!.externalCalls![0] as ExternalCallAbi;
    expect(slot.hasReturnValues).toBe(true);
    const unbound = { ...slot, hasReturnValues: false, needsSelectorVerification: false };
    const check = (call: ExternalCallAbi): void => assertCallSelectorScheme(call, caller, callee);

    expect(() => check(slot)).toThrow(MixedCompileModeCallError);
    expect(() => check({ ...unbound, needsSelectorVerification: true })).toThrow(MixedCompileModeCallError);
    expect(() => check(unbound)).not.toThrow();
    for (const runtime of [
      { fnPtrCall: true }, { selectorArrayVar: 'table' }, { opaqueReturn: true }, { interfaceName: '__raw__' },
      { callMode: 'staticcall' as const },
    ]) {
      expect(() => check({ ...slot, ...runtime })).not.toThrow();
    }
    expect(() => assertCallSelectorScheme(slot, caller, caller)).not.toThrow();
  });
});
