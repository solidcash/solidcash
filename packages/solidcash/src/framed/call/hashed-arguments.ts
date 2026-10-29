/**
 * Reading back the arguments a body computed for one of its calls, from the run that hashed them.
 *
 * A site whose arguments the body computes binds its record to the digest of what it computed,
 * `SHA256(selector || argument pushes)` (`argsHash`), hashed where the body makes the call. An argument the planner
 * cannot evaluate from the caller's own facts, such as an amount a loop accumulates over earlier calls' results, is
 * still one the body computes, so a run that reaches the site hashes it: the input to that `OP_SHA256` is the
 * selector followed by exactly the pushes the record has to carry. The site's own check binds the record to that
 * digest, so a value read here that the body did not compute is refused by the body, never stated.
 */

import { OpcodesBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-opcodes.js';
import { bytesEqual, decodeCallDataArguments } from '@solidcash/utils';
import type NetworkProvider from '../../network/NetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from '../../network/createVirtualMachine.js';
import type { ShippedVmProgram } from '../composer/shipped-host.js';

/**
 * The arguments of every call to `selector` that `program` hashed, each in parameter order, in the order the run
 * hashed them.
 *
 * An input is read only when it is the selector followed by exactly `arity` minimal pushes, so nothing else the
 * program hashes is taken for a call's arguments. The machine is the provider's, at its limits, with `OP_SHA256`
 * observed and otherwise unchanged.
 */
export function hashedCallArguments(
  provider: NetworkProvider, program: ShippedVmProgram, selector: Uint8Array, arity: number,
): Uint8Array[][] {
  const hashed: Uint8Array[][] = [];
  const machine = createVirtualMachineBch2026ForProvider(provider, {
    opcodes: new Set([OpcodesBch2026.OP_SHA256]),
    beforeOperation: (unknownState) => {
      const state = unknownState as {
        readonly stack: readonly Uint8Array[];
        readonly controlStack: readonly unknown[];
      };
      // A skipped branch's instructions are no part of the run.
      if (state.controlStack.some((entry) => entry === false)) return;
      const input = state.stack[state.stack.length - 1];
      if (input === undefined || input.length < selector.length
        || !bytesEqual(input.subarray(0, selector.length), selector)) return;
      const values = decodeCallDataArguments(input.subarray(selector.length));
      if (values !== undefined && values.length === arity) hashed.push(values);
    },
  });
  machine.evaluate(program);
  return hashed;
}
