import { binToHex, decodeTransactionUnsafe, hexToBin } from '@bitauth/libauth';
import { type Artifact, type StateValue, type EventDefinitionAbi, type StateLayout } from '@solidcash/utils';
import { DebugResults } from '../debugging.js';
import { tryParseEventCommitment } from '../stateful/StateReader.js';
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
  return (contract as any).artifact ?? (contract as any).inner?.artifact ?? {};
}

interface Debuggable {
  debug(): DebugResults;
}

interface Buildable {
  build(): string | Promise<any>;
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
  toBeReverted(transaction: Debuggable) {
    try {
      transaction.debug();
      const message = (): string => 'Expected transaction to be reverted, but it succeeded.';
      return { message, pass: false };
    } catch (transactionError: any) {
      const receivedText = `Revert reason: ${this.utils.printReceived(transactionError?.message ?? '')}`;
      const message = (): string => `Expected transaction NOT to be reverted, but it reverted.\n${receivedText}`;
      return { message, pass: true };
    }
  },

  // await expect(contractA.action(params)).toBeRevertedWith(reason)
  toBeRevertedWith(transaction: Debuggable, match: RegExp | string) {
    try {
      transaction.debug();
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
  toRevert(transaction: Debuggable) {
    try {
      transaction.debug();
      const message = (): string => 'Expected transaction to revert, but it succeeded.';
      return { message, pass: false };
    } catch (transactionError: any) {
      const receivedText = `Revert reason: ${this.utils.printReceived(transactionError?.message ?? '')}`;
      const message = (): string => `Expected transaction NOT to revert, but it reverted.\n${receivedText}`;
      return { message, pass: true };
    }
  },

  toRevertWith(transaction: Debuggable, match: RegExp | string) {
    try {
      transaction.debug();
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

    // Find the event definition in the contract's artifact
    const art = getArtifact(contract);
    const eventDefs = art.events ?? [];
    const eventDef = eventDefs.find((e) => e.name === eventName);
    if (!eventDef) {
      const available = eventDefs.map((e) => e.name).join(', ') || 'none';
      const message = (): string => `${matcherHint}\n\nEvent '${eventName}' not found in contract. Available events: ${available}`;
      return { message, pass: false };
    }

    // Build the transaction to get raw hex.
    // Handle both sync (TransactionBuilder.build() -> string)
    // and async (StatefulFunctionCall.build() -> Promise<TransactionBuilder>) cases.
    let rawTxHex: string;
    try {
      const buildResult = transaction.build();
      if (typeof buildResult === 'string') {
        rawTxHex = buildResult;
      } else {
        // Async: StatefulFunctionCall.build() -> TransactionBuilder
        const innerBuilder = await buildResult;
        rawTxHex = (innerBuilder as any).build();
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

function valuesEqual(a: StateValue, b: StateValue): boolean {
  if (a instanceof Uint8Array && b instanceof Uint8Array) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null
    && !(a instanceof Uint8Array) && !(b instanceof Uint8Array)) {
    const aKeys = Object.keys(a as Record<string, StateValue>);
    const bKeys = Object.keys(b as Record<string, StateValue>);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k) => valuesEqual(
      (a as Record<string, StateValue>)[k],
      (b as Record<string, StateValue>)[k],
    ));
  }
  return a === b;
}

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
