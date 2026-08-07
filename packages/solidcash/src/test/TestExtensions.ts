import { binToHex, decodeTransactionUnsafe, hexToBin } from '@bitauth/libauth';
import { type Artifact, type StateValue, type EventDefinitionAbi, type StateLayout } from '@solidcash/utils';
import { DebugResults } from '../debugging.js';
import { tryParseEventCommitment, valuesEqual } from '../stateful/StateReader.js';
import type { ExtractEventNames, EventMatcherArgs, EmittingContract } from '../types/event-inference.js';

// Untyped fallback for the runtime implementation
type UntypedExpectedArgs = Record<string, StateValue | ((value: StateValue) => boolean)>;

declare global {
  namespace jest {
    // eslint-disable-next-line
    interface Matchers<R> {
      toLog(value?: RegExp | string): Promise<void>;
      toFailRequireWith(value: RegExp | string): Promise<void>;
      toFailRequire(): Promise<void>;
      // Solidity-style aliases (Hardhat compatibility)
      toBeReverted(): Promise<void>;
      toBeRevertedWith(value: RegExp | string): Promise<void>;
      toRevert(): Promise<void>;
      toRevertWith(value: RegExp | string): Promise<void>;
      // Event emission matcher - type-safe when the contract carries a typed artifact.
      // Autocompletes event names and parameter fields for `as const` / generated artifacts.
      // Falls back to `string` / `Record<string, ...>` for untyped artifacts.
      toEmit<TArtifact extends Artifact>(
        contract: EmittingContract<TArtifact>,
        eventName: ExtractEventNames<TArtifact>,
        expectedArgs?: EventMatcherArgs<TArtifact, ExtractEventNames<TArtifact>>,
      ): Promise<void>;
    }
  }
}

// Internal artifact holder for runtime (no generics needed)
interface ArtifactHolder {
  events?: readonly EventDefinitionAbi[];
  stateLayout?: StateLayout;
}

function getArtifact(contract: EmittingContract): ArtifactHolder {
  return (contract as any).artifact ?? (contract as any).inner?.artifact
    ?? (contract as any).implementation?.inner?.artifact ?? {};
}

/**
 * Event definitions for `toEmit`. Prefer `artifact.events`; when empty (common for Solidity-compat
 * ERC20Mock where parent OZ events were not re-hosted), reconstruct from ABI `emits` annotations.
 * Standard ERC20 names are applied when the signature matches so `.withArgs(from, to, value)` works.
 */
function resolveEventDefinitions(art: ArtifactHolder & {
  abi?: readonly { emits?: readonly { eventName: string; eventSignature: string }[] }[];
}): EventDefinitionAbi[] {
  if (art.events && art.events.length > 0) return [...art.events];
  const bySig = new Map<string, EventDefinitionAbi>();
  const standardNames: Record<string, string[]> = {
    'Transfer(address,address,uint256)': ['from', 'to', 'value'],
    'Approval(address,address,uint256)': ['owner', 'spender', 'value'],
  };
  for (const fn of art.abi ?? []) {
    for (const emitted of fn.emits ?? []) {
      if (bySig.has(emitted.eventSignature)) continue;
      const match = emitted.eventSignature.match(/^(\w+)\((.*)\)$/);
      const types = (match?.[2] ?? '').split(',').map((t) => t.trim()).filter(Boolean);
      const names = standardNames[emitted.eventSignature]
        ?? types.map((_, i) => `arg${i}`);
      bySig.set(emitted.eventSignature, {
        name: emitted.eventName,
        signature: emitted.eventSignature,
        parameters: types.map((type, i) => ({
          name: names[i] ?? `arg${i}`,
          type,
          ...(type === 'address' && i < 2 ? { indexed: true } : {}),
        })),
      });
    }
  }
  return [...bySig.values()];
}

interface Debuggable {
  debug(): DebugResults;
}

interface Buildable {
  build(): string | Promise<any>;
}

async function debugTransaction(
  transaction: Debuggable | (Buildable & Partial<Debuggable>) | Promise<unknown>,
): Promise<void> {
  if (transaction && typeof (transaction as Debuggable).debug === 'function') {
    (transaction as Debuggable).debug();
    return;
  }
  if (transaction && typeof (transaction as Buildable).build === 'function') {
    const built = await (transaction as Buildable).build();
    if (built && typeof built.debug === 'function') { built.debug(); return; }
  }
  await transaction;
}

async function sendTransaction(transaction: unknown): Promise<void> {
  const resolved = await transaction as any;
  // A TransactionBuilder can be evaluated without mutating the provider. This
  // keeps matcher assertions repeatable when several expectations inspect the
  // same transaction or UTXO.
  if (resolved && typeof resolved.debug === 'function') { resolved.debug(); return; }
  if (resolved && typeof resolved.send === 'function') { await resolved.send(); return; }
  await resolved;
}

type TestFramework = typeof vi;
const testFramework: TestFramework = (globalThis as any).vi ?? (globalThis as any).jest;

// Extend Vitest with the custom matchers, this file needs to be imported in the vitest.setup.ts file or the test file
expect.extend({
  toLog(
    transaction: Debuggable,
    match?: RegExp | string,
  ) {
    const loggerSpy = testFramework.spyOn(console, 'log');

    // Clear any previous calls (if spy reused accidentally)
    loggerSpy.mockClear();

    // silence actual stdout output
    loggerSpy.mockImplementation(() => { });

    // Run debug, ignoring any errors because we only care about the logs, even if the transaction fails
    try {
      transaction.debug();
    } catch (error) { }

    // We concatenate all the logs into a single string - if no logs are present, we set received to undefined
    const receivedBase = loggerSpy.mock.calls.reduce((acc, [log]) => `${acc}\n${log}`, '').trim();
    const received = receivedBase === '' ? undefined : receivedBase;

    const matcherHint = this.utils.matcherHint('toLog', 'received', 'expected', { isNot: this.isNot });
    const expectedText = `Expected: ${this.isNot ? 'not ' : ''}${this.utils.printExpected(match)}`;
    const receivedText = `Received: ${this.utils.printReceived(received)}`;
    const message = (): string => `${matcherHint}\n\n${expectedText}\n${receivedText}`;

    try {
      // We first check if the expected string is present in any of the individual console.log calls
      expect(loggerSpy).toHaveBeenCalledWith(match ? expect.stringMatching(match) : expect.anything());
    } catch {
      try {
        // We add this extra check to allow expect().toLog() to check multiple console.log calls in a single test
        // (e.g. for log ordering), which would fail the first check because that compares the individual console.log calls
        expect(receivedBase).toMatch(match ? match : expect.anything());
      } catch {
        return { message, pass: false };
      }
    } finally {
      // Restore the original console.log implementation
      loggerSpy.mockRestore();
    }

    return { message, pass: true };
  },
  toFailRequire(
    transaction: Debuggable,
  ) {
    try {
      transaction.debug();
      const message = (): string => 'Contract function did not fail a require statement.';
      return { message, pass: false };
    } catch (transactionError: any) {
      const receivedText = `Received string: ${this.utils.printReceived(transactionError?.message ?? '')}`;
      const message = (): string => `Contract function failed a require statement.\n${receivedText}`;
      return { message, pass: true };
    }
  },
  toFailRequireWith(
    transaction: Debuggable,
    match: RegExp | string,
  ) {
    try {
      transaction.debug();
      const matcherHint = this.utils.matcherHint('.toFailRequireWith', undefined, match.toString(), { isNot: this.isNot });
      const message = (): string => `${matcherHint}\n\nContract function did not fail a require statement.`;
      return { message, pass: false };
    } catch (transactionError: any) {
      const matcherHint = this.utils.matcherHint('toFailRequireWith', 'received', 'expected', { isNot: this.isNot });
      const expectedText = `Expected pattern: ${this.isNot ? 'not ' : ''}${this.utils.printExpected(match)}`;
      const receivedText = `Received string: ${this.utils.printReceived(transactionError?.message ?? '')}`;
      const message = (): string => `${matcherHint}\n\n${expectedText}\n${receivedText}`;

      try {
        expect(transactionError?.message ?? '').toMatch(match);
        return { message, pass: true };
      } catch {
        return { message, pass: false };
      }
    }
  },

  // Solidity-style aliases (Hardhat/ethers compatibility)
  // await expect(contractA.action(params)).toBeReverted()
  async toBeReverted(transaction: Debuggable | Promise<Debuggable>) {
    try {
      // A generic revert assertion only needs execution success/failure, never a source-level reason. Sending is
      // bounded on relaxed mock networks; full debug traces for multi-hundred-kilobyte artifacts are not.
      await sendTransaction(transaction);
      const message = (): string => 'Expected transaction to be reverted, but it succeeded.';
      return { message, pass: false };
    } catch (transactionError: any) {
      const receivedText = `Revert reason: ${this.utils.printReceived(transactionError?.message ?? '')}`;
      const message = (): string => `Expected transaction NOT to be reverted, but it reverted.\n${receivedText}`;
      return { message, pass: true };
    }
  },

  // await expect(contractA.action(params)).toBeRevertedWith(reason)
  async toBeRevertedWith(transaction: Debuggable | Promise<Debuggable>, match: RegExp | string) {
    try {
      await debugTransaction(transaction);
      const matcherHint = this.utils.matcherHint('toBeRevertedWith', 'transaction', match.toString(), { isNot: this.isNot });
      const message = (): string => `${matcherHint}\n\nExpected transaction to be reverted, but it succeeded.`;
      return { message, pass: false };
    } catch (transactionError: any) {
      const matcherHint = this.utils.matcherHint('toBeRevertedWith', 'received', 'expected', { isNot: this.isNot });
      const expectedText = `Expected reason: ${this.isNot ? 'not ' : ''}${this.utils.printExpected(match)}`;
      const receivedText = `Received reason: ${this.utils.printReceived(transactionError?.message ?? '')}`;
      const message = (): string => `${matcherHint}\n\n${expectedText}\n${receivedText}`;

      try {
        expect(transactionError?.message ?? '').toMatch(match);
        return { message, pass: true };
      } catch {
        return { message, pass: false };
      }
    }
  },

  // Short aliases: await expect(...).toRevert() / .toRevertWith(reason)
  async toRevert(transaction: Debuggable | Promise<Debuggable>) {
    try {
      await debugTransaction(transaction);
      const message = (): string => 'Expected transaction to revert, but it succeeded.';
      return { message, pass: false };
    } catch (transactionError: any) {
      const receivedText = `Revert reason: ${this.utils.printReceived(transactionError?.message ?? '')}`;
      const message = (): string => `Expected transaction NOT to revert, but it reverted.\n${receivedText}`;
      return { message, pass: true };
    }
  },

  async toRevertWith(transaction: Debuggable | Promise<Debuggable>, match: RegExp | string) {
    try {
      await debugTransaction(transaction);
      const matcherHint = this.utils.matcherHint('toRevertWith', 'transaction', match.toString(), { isNot: this.isNot });
      const message = (): string => `${matcherHint}\n\nExpected transaction to revert, but it succeeded.`;
      return { message, pass: false };
    } catch (transactionError: any) {
      const matcherHint = this.utils.matcherHint('toRevertWith', 'received', 'expected', { isNot: this.isNot });
      const expectedText = `Expected reason: ${this.isNot ? 'not ' : ''}${this.utils.printExpected(match)}`;
      const receivedText = `Received reason: ${this.utils.printReceived(transactionError?.message ?? '')}`;
      const message = (): string => `${matcherHint}\n\n${expectedText}\n${receivedText}`;

      try {
        expect(transactionError?.message ?? '').toMatch(match);
        return { message, pass: true };
      } catch {
        return { message, pass: false };
      }
    }
  },

  // Event emission matcher: expect(tx).toEmit(contract, 'EventName', { arg: value })
  // Works with TransactionBuilder (sync .build()) or StatefulFunctionCall (async .build()).
  // Decodes event NFT outputs from the built transaction and matches against
  // the contract's event definitions.
  //
  // expectedArgs can contain:
  //   - Literal values: { amount: 100n, recipient: hexToBin('...') }
  //   - Predicate functions: { amount: (v) => v > 0n }
  async toEmit(
    transaction: Buildable,
    contract: EmittingContract,
    eventName: string,
    expectedArgs?: UntypedExpectedArgs,
  ) {
    const matcherHint = this.utils.matcherHint('toEmit', 'transaction', `contract, '${eventName}'`, { isNot: this.isNot });

    // Find the event definition in the contract's artifact. Some Solidity-compat artifacts (e.g. OZ ERC20Mock)
    // emit Transfer/Approval via ABI `emits` but leave `artifact.events` empty when parent event definitions
    // were not re-hosted onto the child. Reconstruct a minimal definition from emit signatures so MistSwap's
    // `expect(...).to.emit(token, "Transfer")` still works.
    const art = getArtifact(contract);
    const eventDefs = resolveEventDefinitions(art);
    const eventDef = eventDefs.find((e) => e.name === eventName);
    if (!eventDef) {
      const available = eventDefs.map((e) => e.name).join(', ') || 'none';
      const message = (): string => `${matcherHint}\n\nEvent '${eventName}' not found in contract. Available events: ${available}`;
      return { message, pass: false };
    }

    // Build/send the transaction to get raw hex. StatefulFunctionCall is lazy and its final send phase can
    // derive delegate event commitments that are not present in an earlier inspection build, so inspect the
    // submitted transaction exactly once when a send method is available.
    // Handle both sync (TransactionBuilder.build() -> string)
    // and async (StatefulFunctionCall.build() -> Promise<TransactionBuilder>) cases.
    let rawTxHex: string;
    try {
      // A prebuilt TransactionBuilder is already fully materialized and may be intentionally reused across
      // several matcher assertions. Inspect its bytes without broadcasting it (broadcasting here both consumes
      // its inputs and makes the second assertion observe a double-spend). A lazy StatefulFunctionCall still
      // needs send(), because its final phase derives delegate/event commitments.
      if (typeof (transaction as any).buildLibauthTransaction === 'function') {
        rawTxHex = (transaction as any).build();
      } else if (typeof (transaction as any).send === 'function') {
        const sent = await (transaction as any).send();
        rawTxHex = sent.hex;
      } else {
        const buildResult = transaction.build();
        if (typeof buildResult === 'string') {
          rawTxHex = buildResult;
        } else {
          // Async: StatefulFunctionCall.build() -> TransactionBuilder
          const innerBuilder = await buildResult;
          rawTxHex = (innerBuilder as any).build();
        }
      }
    } catch (buildError: any) {
      const message = (): string => `${matcherHint}\n\nFailed to build transaction: ${buildError?.message ?? buildError}`;
      return { message, pass: false };
    }

    // Decode the raw transaction to inspect outputs
    const decodedTx = decodeTransactionUnsafe(hexToBin(rawTxHex));
    type DecodedOutput = {
      token?: { category: Uint8Array; nft?: { capability: string; commitment: Uint8Array } };
      valueSatoshis: bigint;
    };
    const outputs = (decodedTx as { outputs: DecodedOutput[] }).outputs;
    const structs = art.stateLayout?.structs;

    // Scan outputs for event NFTs (capability='none') and try to decode
    const matchingEvents: Array<Record<string, StateValue>> = [];

    for (const output of outputs) {
      if (!output.token?.nft) continue;
      if (output.token.nft.capability !== 'none') continue;

      const commitmentHex = binToHex(output.token.nft.commitment);
      if (commitmentHex.length === 0) continue;

      // Try to parse as this event type
      const parsed = tryParseEventCommitment(commitmentHex, eventDef, structs);
      if (parsed) {
        matchingEvents.push(parsed);
      }
    }

    // Compatibility shims may expose an inherited/internal Solidity event as receipt metadata when adding a
    // physical output would change a precompiled delegate covenant's positional transaction layout.
    const detached = (transaction as any).getDetachedEvents?.() as readonly {
      name: string; args: readonly StateValue[]; definition?: { name: string; parameters: readonly { name: string }[] };
    }[] | undefined;
    for (const item of detached ?? []) {
      const definition = item.definition;
      if (definition?.name !== eventName) continue;
      const named: Record<string, StateValue> = {};
      definition.parameters.forEach((parameter, index) => { named[parameter.name] = item.args[index]; });
      matchingEvents.push(named);
    }

    // Check if any matching events were found
    if (matchingEvents.length === 0) {
      const message = (): string => `${matcherHint}\n\nExpected transaction to emit '${eventName}', but no matching event NFT was found in outputs.`;
      return { message, pass: this.isNot ? true : false };
    }

    // If no args expected, just check event presence
    if (!expectedArgs) {
      const message = (): string => {
        const values = matchingEvents.map((e) => JSON.stringify(e, replacer)).join(', ');
        return `${matcherHint}\n\nEvent '${eventName}' was emitted with values: ${values}`;
      };
      return { message, pass: this.isNot ? false : true };
    }

    // Check if any matching event satisfies the expected args
    const argErrors: string[] = [];
    const matched = matchingEvents.some((eventValues) => {
      for (const [key, expected] of Object.entries(expectedArgs)) {
        const actual = eventValues[key];
        if (actual === undefined) {
          argErrors.push(`Field '${key}' not found in event. Available: ${Object.keys(eventValues).join(', ')}`);
          return false;
        }
        if (typeof expected === 'function') {
          if (!expected(actual)) {
            argErrors.push(`Field '${key}': predicate returned false for value ${formatValue(actual)}`);
            return false;
          }
        } else {
          if (!valuesEqual(actual, expected)) {
            argErrors.push(`Field '${key}': expected ${formatValue(expected)}, got ${formatValue(actual)}`);
            return false;
          }
        }
      }
      return true;
    });

    const message = (): string => {
      if (matched) {
        return `${matcherHint}\n\nEvent '${eventName}' was emitted with matching args.`;
      }
      const received = matchingEvents.map((e) => JSON.stringify(e, replacer)).join('\n  ');
      return `${matcherHint}\n\nEvent '${eventName}' was emitted but args did not match.\n` +
        `  Errors: ${argErrors.join('; ')}\n` +
        `  Received events: ${received}`;
    };

    return { message, pass: matched };
  },
});

// valuesEqual is imported from StateReader (address CashAddress vs locking-bytecode coercion).

function formatValue(v: StateValue): string {
  if (v instanceof Uint8Array) return `0x${binToHex(v)}`;
  if (typeof v === 'bigint') return `${v}n`;
  return String(v);
}

function replacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return `${value}n`;
  if (value instanceof Uint8Array) return `0x${binToHex(value)}`;
  return value;
}

export { };
