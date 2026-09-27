import { describe, expect, it } from 'vitest';
import {
  computeFunctionSelector,
  computeFunctionSignature,
  validateStopSiteMetadata,
  type StopSite,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import {
  entryStopSites,
  publishPerCallStopSites,
  type PublishedPerCallStopSites,
} from '../../../src/per-call/master/stop-sites.js';

/**
 * The published stop-site table, taken from real compiles.
 *
 * The compiler emits one master per contract and publishes, on `artifact.composition`, one entry per entry point:
 * the sites a driver resumes from and the call facts it names a callee through. These cases fix the table's shape
 * for a contract whose entry makes one external call and for one that makes none, and check every published table
 * against the frozen schema.
 */

const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');
const TARGET = new Uint8Array(35).fill(0x11);
const OTHER_TARGET = new Uint8Array(35).fill(0x22);
const SELECTOR = computeFunctionSelector(computeFunctionSignature('ping', []));
const PONG_SELECTOR = computeFunctionSelector(computeFunctionSignature('pong', []));

const callingSource = (): string => 'pragma solidcash ^0.13.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Caller {'
  + `   function callIt() { ICallee(0x${toHex(TARGET)}).ping.call(); require(true); }`
  + ' }';

const silentSource = (): string => 'pragma solidcash ^0.13.0;'
  + ' contract Solo { function ping() { require(true); } }';

/** An entry that calls the same method at the same target twice: the lowering coalesces the two into one batch. */
const repeatedCallSource = (): string => 'pragma solidcash ^0.13.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Caller {'
  + `   function callIt() { ICallee(0x${toHex(TARGET)}).ping.call(); ICallee(0x${toHex(TARGET)}).ping.call(); `
  + 'require(true); } }';

/** Two entries that make different calls, so the table must name each entry's own callee. */
const twoEntrySource = (): string => 'pragma solidcash ^0.13.0;'
  + ' interface ICallee { function ping(); function pong(); }'
  + ' contract Caller {'
  + `   function a() { ICallee(0x${toHex(TARGET)}).ping.call(); require(true); }`
  + `   function b() { ICallee(0x${toHex(OTHER_TARGET)}).pong.call(); require(true); }`
  + ' }';

/** The composition publication, which carries the stop-site table beside the placeholder descriptor. */
const publicationOf = (artifact: { composition?: unknown }): PublishedPerCallStopSites => {
  const composition = artifact.composition as { stopSites?: PublishedPerCallStopSites } | undefined;
  expect(composition?.stopSites).toBeDefined();
  return composition!.stopSites!;
};

describe('the stop-site table published from a real compile', () => {
  it('publishes one entry per entry point, each with a validated table', () => {
    const artifacts = compileStringMulti(callingSource(), { composition: 'per-call' });
    for (const name of ['Caller', 'Callee']) {
      const stopSites = publicationOf(artifacts[name]!);
      expect(stopSites.version).toBe(1);
      expect(stopSites.entries).toHaveLength(1);
      for (const entry of stopSites.entries) {
        expect(entry.functionName).toBe(`${name}.${name === 'Caller' ? 'callIt' : 'ping'}()`);
        expect(() => validateStopSiteMetadata(entry.sites)).not.toThrow();
      }
    }
  });

  it('shapes a caller with one external call as one call site then two segment closes', () => {
    const artifacts = compileStringMulti(callingSource(), { composition: 'per-call' });
    const stopSites = publicationOf(artifacts.Caller!);
    const entry = stopSites.entries[0]!;
    expect(entry.sites).toStrictEqual({
      version: 1,
      functionName: 'Caller.callIt()',
      sites: [
        { kind: 'call', site: 0, callIndex: 0, descriptor: 0 },
        { kind: 'segmentClose', site: 1, segmentIndex: 0 },
        { kind: 'segmentClose', site: 2, segmentIndex: 1 },
      ],
    });
    expect(entry.calls).toStrictEqual([{
      callIndex: 0,
      interfaceName: 'ICallee',
      functionName: 'ping',
      target: toHex(TARGET),
      selector: toHex(SELECTOR),
    }]);
  });

  it('shapes a caller with no external call as one segment close', () => {
    const artifacts = compileStringMulti(silentSource(), { composition: 'per-call' });
    const stopSites = publicationOf(artifacts.Solo!);
    expect(stopSites.entries).toStrictEqual([{
      functionName: 'Solo.ping()',
      calls: [],
      sites: {
        version: 1,
        functionName: 'Solo.ping()',
        sites: [{ kind: 'segmentClose', site: 0, segmentIndex: 0 }],
      },
    }]);
  });

  it('publishes no read site, because the compiler does not hold the record a read resolves to', () => {
    const artifacts = compileStringMulti(callingSource(), { composition: 'per-call' });
    const sites = publicationOf(artifacts.Caller!).entries.flatMap((entry) => entry.sites.sites) as StopSite[];
    expect(sites.some((site) => site.kind === 'read')).toBe(false);
  });

  it('publishes one entry for each entry point, each naming its own callee', () => {
    // Two entries make different calls; each entry's table has to name the callee its own site binds, so entry
    // `a` publishes `ping` at `TARGET` and entry `b` publishes `pong` at `OTHER_TARGET`.
    const artifacts = compileStringMulti(twoEntrySource(), { composition: 'per-call' });
    expect(publicationOf(artifacts.Caller!).entries).toStrictEqual([
      {
        functionName: 'Caller.a()',
        calls: [{
          callIndex: 0,
          interfaceName: 'ICallee',
          functionName: 'ping',
          target: toHex(TARGET),
          selector: toHex(SELECTOR),
        }],
        sites: {
          version: 1,
          functionName: 'Caller.a()',
          sites: [
            { kind: 'call', site: 0, callIndex: 0, descriptor: 0 },
            { kind: 'segmentClose', site: 1, segmentIndex: 0 },
            { kind: 'segmentClose', site: 2, segmentIndex: 1 },
          ],
        },
      },
      {
        functionName: 'Caller.b()',
        calls: [{
          callIndex: 0,
          interfaceName: 'ICallee',
          functionName: 'pong',
          target: toHex(OTHER_TARGET),
          selector: toHex(PONG_SELECTOR),
        }],
        sites: {
          version: 1,
          functionName: 'Caller.b()',
          sites: [
            { kind: 'call', site: 0, callIndex: 0, descriptor: 0 },
            { kind: 'segmentClose', site: 1, segmentIndex: 0 },
            { kind: 'segmentClose', site: 2, segmentIndex: 1 },
          ],
        },
      },
    ]);
  });

  it('refuses to compile an entry that calls the same method at the same target twice', () => {
    // The lowering coalesces the two identical calls into one batch, so the records are not a fixed set the head
    // can check. Pinning the refusal keeps the table's shape and the compiler's limit from being read as each
    // other.
    expect(() => compileStringMulti(repeatedCallSource(), { composition: 'per-call' }))
      .toThrow(/PER_CALL_CODEGEN_UNAVAILABLE/);
  });

  it('derives the sites from the calls alone, refusing a table the schema would reject', () => {
    // Two calls give two call sites and three closes; the ordinals are contiguous and every close follows the
    // call that ends its segment.
    const metadata = entryStopSites('X.f()', [
      { kind: 1, selector: SELECTOR, target: TARGET },
      { kind: 1, selector: SELECTOR, target: TARGET },
    ]);
    expect(metadata.sites.map((site) => site.kind)).toStrictEqual([
      'call', 'call', 'segmentClose', 'segmentClose', 'segmentClose',
    ]);
    expect(metadata.sites.map((site) => site.site)).toStrictEqual([0, 1, 2, 3, 4]);
    expect(() => validateStopSiteMetadata(metadata)).not.toThrow();
    expect(publishPerCallStopSites('X', [{ entryName: 'f', calls: [] }]).entries[0]!.sites.sites).toHaveLength(1);
  });
});
