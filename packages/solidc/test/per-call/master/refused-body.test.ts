import { describe, expect, it } from 'vitest';
import {
  encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import { asmToScript, encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress, type WitnessBlock } from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/per-call/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory } from './validator-input.js';
import { publishedRefusals, refusalOf } from './refused-entry.js';

/**
 * A body the master cannot serve fails on its own rather than failing the contract.
 *
 * The master is one program, but one unsupported function used to refuse the whole unit: every other function of the
 * contract stopped compiling, including the ones a transaction can reach. A refused body is emitted as a body that
 * fails whenever the dispatcher reaches it, its reason is published beside the artifact, and the entries that reach
 * it are refused with it — so what a builder reports is which function is unsupported, and the functions that are
 * supported keep their programs.
 *
 * The machine settles it: the same master is spent with the selector of each entry, and the accepted spend beside
 * the refused ones is what shows the refusal is a property of the body rather than of the program.
 */

const CATEGORY = seededCategory('refused body');
const ADDRESS = validatorAddress(CATEGORY, REAL_VALIDATOR_PROGRAM);
const TEMPLATE_HASH = sha256(REAL_VALIDATOR_PROGRAM);
const OWNER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(9));

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Choice {'
  + '   function good() { require(true); }'
  + '   function bad() returns (function(int) external returns (int)) { revert("no"); }'
  + '   function callsBad() { bad(); require(true); }'
  + ' }';

/** A contract whose only body is refused, so the master serves nothing and must still compile. */
const ALL_REFUSED_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Only {'
  + '   function bad() returns (function(int) external returns (int)) { revert("no"); }'
  + ' }';

const artifact = compileStringMulti(SOURCE, { composition: 'per-call' }).Choice!;
const program = fillPlaceholders(
  scriptToBytecode(asmToScript(artifact.bytecode)),
  artifact.composition!.placeholders,
  { category: categorySlotValue(CATEGORY), contractAddress: ADDRESS, templateHash: TEMPLATE_HASH },
);

/** The selector the ABI publishes for an entry, which is what the dispatcher reads. */
const selectorOf = (name: string): Uint8Array =>
  new Uint8Array(Buffer.from(artifact.abi.find((entry) => entry.name === name)!.selector!, 'hex'));

/** Spends the master's own input with one entry's selector, and reports whether the machine accepted it. */
function spend(entry: string): boolean {
  return spendSelector(program, selectorOf(entry));
}

/** Spends a master program's own input with `selector` under the shared standalone frame, and reports the verdict. */
function spendSelector(programBytes: Uint8Array, selector: Uint8Array): boolean {
  const lock = encodeLockingBytecodeP2sh32(hash256(programBytes));
  const block: WitnessBlock = {
    kind: 0,
    callerRef: 0,
    originRef: 0,
    validatorRef: 0xffff,
    sender: OWNER_LOCK,
    self: ADDRESS,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
  };
  const masterSource = {
    lockingBytecode: lock,
    valueSatoshis: 20_000n,
    token: { category: CATEGORY, amount: 0n, nft: { capability: 'minting' as const, commitment: new Uint8Array(0) } },
  };
  const masterOutput = {
    lockingBytecode: lock,
    valueSatoshis: 20_000n,
    token: { category: CATEGORY, amount: 0n, nft: { capability: 'minting' as const, commitment: new Uint8Array(0) } },
  };
  const transaction = {
    version: 2,
    inputs: [
      { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(7), sequenceNumber: 0xffffffff,
        unlockingBytecode: callerUnlockingBytecode() },
      { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(2), sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array([
          ...encodeDataPush(encodeWitnessBlock(block)),
          ...encodeDataPush(selector),
          ...encodeDataPush(programBytes),
        ]) },
    ],
    outputs: [{ lockingBytecode: OWNER_LOCK, valueSatoshis: 100_000n }, masterOutput],
    locktime: 0,
  };
  const sourceOutputs = [{ lockingBytecode: OWNER_LOCK, valueSatoshis: 100_000n }, masterSource];
  const vm = compositionMachine();
  return vm.stateSuccess(vm.evaluate({ inputIndex: 1, sourceOutputs, transaction })) === true;
}

describe('a body the master cannot serve', () => {
  it('is refused by name while the entries the master can serve keep compiling', () => {
    const reasons = publishedRefusals(compileStringMulti(SOURCE, { composition: 'per-call' }) as
      Record<string, { composition?: unknown }>);
    expect(reasons.map((refused) => refused.functionName).sort()).toStrictEqual([
      'Choice.bad()', 'Choice.callsBad()',
    ]);
    expect(reasons.find((refused) => refused.functionName === 'Choice.bad()')!.reason)
      .toContain('returns a function pointer');
    // The entry that calls it is refused with it, and the reason names the body it runs.
    expect(reasons.find((refused) => refused.functionName === 'Choice.callsBad()')!.reason)
      .toContain("it runs 'bad'");
  });

  it('fails whenever the dispatcher reaches it, beside a served entry that settles', () => {
    // The accepted spend is the control: the same program, the same frame, one selector apart.
    expect(spend('good')).toBe(true);
    expect(spend('bad')).toBe(false);
    expect(spend('callsBad')).toBe(false);
  });

  it('refuses a contract whose every body is unsupported, rather than refusing the unit', () => {
    // Nothing is served, so the master is a dispatcher over refusals; a builder reads which function is missing
    // from the published reasons instead of from a compile that fails.
    const artifacts = compileStringMulti(ALL_REFUSED_SOURCE, { composition: 'per-call' });
    expect(artifacts.Only?.composition?.convention).toBe('per-call');
    expect(refusalOf(ALL_REFUSED_SOURCE, 'Only').message).toContain('returns a function pointer');
  });
});

/**
 * A refused entry that makes external calls must not size the head's call count.
 *
 * A master whose only call-making entries are refused can still stand alone, because a refused body is a stub that
 * makes no call. The head's count is therefore the served bodies' bound, which keeps the standalone frame a user
 * enters admissible. Taking the count from every entry the call-site pass measured instead holds a call no served
 * body makes, and the head refuses the frame before any body runs.
 */
const REFUSED_CALL_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface IOracle { function get(int id) view returns (int); }'
  + ' contract Feed {'
  + '   address public oracle;'
  + '   mapping(int => int) public log;'
  + '   constructor(address o) { this.oracle = o; }'
  + '   function readBack(int id) {'
  + '     int x = IOracle(this.oracle).get(id);'
  + '     this.log[id] = x + 1;'
  + '     require(true);'
  + '   }'
  + '   function ping() { require(true); }'
  + ' }';

const refusedCallArtifact = compileStringMulti(REFUSED_CALL_SOURCE, { composition: 'per-call' }).Feed!;
const refusedCallProgram = fillPlaceholders(
  scriptToBytecode(asmToScript(refusedCallArtifact.bytecode)),
  refusedCallArtifact.composition!.placeholders,
  { category: categorySlotValue(CATEGORY), contractAddress: ADDRESS, templateHash: TEMPLATE_HASH },
);
const refusedCallSelector = (name: string): Uint8Array =>
  new Uint8Array(Buffer.from(refusedCallArtifact.abi.find((entry) => entry.name === name)!.selector!, 'hex'));

describe('a refused call-making entry', () => {
  it('is refused by name and publishes no call site', () => {
    const refusals = publishedRefusals(compileStringMulti(REFUSED_CALL_SOURCE, { composition: 'per-call' }) as
      Record<string, { composition?: unknown }>);
    expect(refusals.map((refused) => refused.functionName)).toStrictEqual(['Feed.readBack()']);
    const stopSites = refusedCallArtifact.composition?.stopSites as { entries: { calls: unknown[] }[] };
    expect(stopSites.entries.flatMap((entry) => entry.calls)).toStrictEqual([]);
  });

  it('admits the standalone frame the served entry is entered by', () => {
    // The served entry is one no call is left in the head for, so the user's root frame is admitted; the refused
    // entry's own stub still fails when the dispatcher reaches it.
    expect(spendSelector(refusedCallProgram, refusedCallSelector('ping'))).toBe(true);
    expect(spendSelector(refusedCallProgram, refusedCallSelector('readBack'))).toBe(false);
  });
});
