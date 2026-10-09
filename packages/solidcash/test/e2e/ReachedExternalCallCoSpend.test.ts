import { hexToBin } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { isContractUnlocker } from '../../src/interfaces.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * A reached direct external call must co-spend its callee. The epilogue skips a slot whose master index is < 0 so the
 * SDK can omit a conditional call that was NOT taken; nothing otherwise bound that -1 to reachedness, so a reached
 * call (VM-proven: an unconditional call, a taken conditional call, and a reached returning call) settled with the
 * callee dropped and, for a returning call, a spender-chosen return value. The call site now requires the slot's
 * master index >= 0 where control arrives only when the call runs.
 */
const SINK = `pragma solidcash >=0.8.0;
contract Sink() {
  bigint hits;
  function credit(int v) public { this.hits = this.hits + v; }
}`;

const UNCONDITIONAL = `pragma solidcash >=0.8.0;
interface ISink { function credit(int v); }
contract Caller(address sink) {
  bigint paid;
  function pay(int v) public {
    this.paid = this.paid + v;
    ISink(sink).credit(v);
  }
}`;

const CONDITIONAL = `pragma solidcash >=0.8.0;
interface ISink { function credit(int v); }
contract Caller(address sink) {
  bigint paid;
  function pay(int v, bool take) public {
    this.paid = this.paid + v;
    if (take) { ISink(sink).credit(v); }
  }
}`;

const RETURNING_SINK = `pragma solidcash >=0.8.0;
contract Sink() {
  bigint hits;
  function credit(int v) public returns (int) { this.hits = this.hits + v; return v + v; }
}`;

const RETURNING = `pragma solidcash >=0.8.0;
interface ISink { function credit(int v) returns (int); }
contract Caller(address sink) {
  bigint total;
  function pay(int v) public {
    this.total = this.total + ISink(sink).credit(v);
  }
}`;

interface Deployed {
  inner: Contract;
  sc: StatefulContract;
  locking: string;
  category: string;
}

async function deploy(
  provider: ReturnType<typeof createTestProvider>, artifact: Artifact, args: string[], state: Record<string, bigint>,
): Promise<Deployed> {
  const base = new Contract(artifact, args, { provider });
  const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, state, { saltContract: true });
  const inner = base.withCategory(hexToBin(setup.categoryId));
  return { inner, sc: StatefulContract.withCategory(inner, setup.categoryId), locking: inner.lockingBytecode,
    category: setup.categoryId };
}

// true when every input's covenant succeeds; stateSuccess returns true or an error string.
function settles(provider: ReturnType<typeof createTestProvider>, builder: any): boolean {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(provider);
  for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
    if (vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })) !== true) return false;
  }
  return true;
}

// Force every external-call master-index witness on the entry input to -1 (the omit sentinel).
function omitWitness(builder: any): void {
  for (const input of builder.inputs) {
    if (!isContractUnlocker(input.unlocker)) continue;
    let touched = false;
    input.unlocker.abiFunction.inputs.forEach((param: any, i: number) => {
      if (param.name === '__internal__externalCallInputBase' || /^__internal__extcallMasterIdx/.test(param.name)) {
        input.unlocker.params[i] = -1n;
        touched = true;
      }
    });
    if (touched) input.unlocker.syncEncodedArgsFromParams?.();
  }
}

function dropCategory(builder: any, category: string): void {
  builder.inputs = builder.inputs.filter((input: any) => input.token?.category !== category);
}

describe('a reached direct external call must co-spend its callee', () => {
  it('(c) rejects an unconditional call whose callee is dropped under the -1 omit sentinel', async () => {
    const provider = createTestProvider();
    const sink = await deploy(provider, compileString(SINK), [], { hits: 0n });
    const caller = await deploy(provider, compileString(UNCONDITIONAL), [sink.locking], { paid: 5n });

    const honest = await caller.sc.call.pay(3n).withExternalCall(sink.sc, 'credit', [3n]).build();
    expect(settles(provider, honest)).toBe(true);

    const forged = await caller.sc.call.pay(3n).withExternalCall(sink.sc, 'credit', [3n]).build();
    omitWitness(forged);
    dropCategory(forged, sink.category);
    expect(settles(provider, forged)).toBe(false);
  }, 180_000);

  it('(a) rejects a taken conditional call whose callee is dropped under the -1 omit sentinel', async () => {
    const provider = createTestProvider();
    const sink = await deploy(provider, compileString(SINK), [], { hits: 0n });
    const caller = await deploy(provider, compileString(CONDITIONAL), [sink.locking], { paid: 5n });

    const honest = await caller.sc.call.pay(3n, true).withExternalCall(sink.sc, 'credit', [3n]).build();
    expect(settles(provider, honest)).toBe(true);

    const forged = await caller.sc.call.pay(3n, true).withExternalCall(sink.sc, 'credit', [3n]).build();
    omitWitness(forged);
    dropCategory(forged, sink.category);
    expect(settles(provider, forged)).toBe(false);
  }, 180_000);

  it('(b) rejects a returning call that reads a spender-made output under the -1 omit sentinel', async () => {
    const provider = createTestProvider();
    const sink = await deploy(provider, compileString(RETURNING_SINK), [], { hits: 0n });
    const caller = await deploy(provider, compileString(RETURNING), [sink.locking], { total: 5n });

    const honest = await caller.sc.call.pay(3n).withExternalCall(sink.sc, 'credit', [3n]).build();
    expect(settles(provider, honest)).toBe(true); // real credit(3) returns 6; total 5 -> 11

    // Forge the return to 9 (OP_9): drop the sink, mint the return output under the caller category, set total to 14.
    const forged = await caller.sc.call.pay(3n).withExternalCall(sink.sc, 'credit', [3n]).build();
    omitWitness(forged);
    const outs = forged.outputs as any[];
    const returnOut = outs.find((o) => o.token && o.token.category === sink.category
      && o.token.nft && o.token.nft.capability === 'none');
    returnOut.token.category = caller.category;
    returnOut.token.nft.commitment = '59';
    const dataOut = outs.find((o) => o.token && o.token.category === caller.category
      && o.token.nft && o.token.nft.capability === 'mutable');
    dataOut.token.nft.commitment = '5e';
    dropCategory(forged, sink.category);
    expect(settles(provider, forged)).toBe(false);
  }, 180_000);
});
