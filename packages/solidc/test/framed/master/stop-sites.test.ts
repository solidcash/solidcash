import { describe, expect, it } from 'vitest';
import {
  computeFunctionSelector,
  computeFunctionSignature,
  validateStopSiteMetadata,
  type Artifact,
  type StopSite,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import {
  entryStopSites,
  publishFramedStopSites,
  type PublishedFramedStopSites,
} from '../../../src/framed/master/stop-sites.js';

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

const callingSource = (): string => 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Caller {'
  + `   function callIt() { ICallee(0x${toHex(TARGET)}).ping.call(); require(true); }`
  + ' }';

const silentSource = (): string => 'pragma solidcash ^0.14.0;'
  + ' contract Solo { function ping() { require(true); } }';

/** An entry whose call runs inside a loop, so one execution reaches the site a number of times the source does not fix. */
const loopedCallSource = (): string => 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Caller {'
  + `   function go(int n) { for (int i = 0; i < n; i = i + 1) { ICallee(0x${toHex(TARGET)}).ping.call(); } `
  + 'require(true); } }';

/** An entry that calls the same method at the same target twice: the lowering coalesces the two into one batch. */
const repeatedCallSource = (): string => 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Caller {'
  + `   function callIt() { ICallee(0x${toHex(TARGET)}).ping.call(); ICallee(0x${toHex(TARGET)}).ping.call(); `
  + 'require(true); } }';

/** Two entries that make different calls, so the table must name each entry's own callee. */
const twoEntrySource = (): string => 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(); function pong(); }'
  + ' contract Caller {'
  + `   function a() { ICallee(0x${toHex(TARGET)}).ping.call(); require(true); }`
  + `   function b() { ICallee(0x${toHex(OTHER_TARGET)}).pong.call(); require(true); }`
  + ' }';

/** The composition publication, which carries the stop-site table beside the placeholder descriptor. */
const publicationOf = (artifact: Pick<Artifact, 'composition'>): PublishedFramedStopSites => {
  expect(artifact.composition?.stopSites).toBeDefined();
  return artifact.composition!.stopSites!;
};

describe('the stop-site table published from a real compile', () => {
  it('publishes one entry per entry point, each with a validated table', () => {
    const artifacts = compileStringMulti(callingSource(), { composition: 'framed' });
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
    const artifacts = compileStringMulti(callingSource(), { composition: 'framed' });
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
    const artifacts = compileStringMulti(silentSource(), { composition: 'framed' });
    const stopSites = publicationOf(artifacts.Solo!);
    expect(stopSites.entries).toStrictEqual([{
      functionName: 'Solo.ping()',
      calls: [],
      // A body that writes no record of its own publishes an empty write list, which tells a builder it rewrites
      // nothing rather than that its write's segment is unstated.
      writeSegments: [],
      sites: {
        version: 1,
        functionName: 'Solo.ping()',
        sites: [{ kind: 'segmentClose', site: 0, segmentIndex: 0 }],
      },
    }]);
  });

  it('publishes no read site, because the compiler does not hold the record a read resolves to', () => {
    const artifacts = compileStringMulti(callingSource(), { composition: 'framed' });
    const sites = publicationOf(artifacts.Caller!).entries.flatMap((entry) => entry.sites.sites) as StopSite[];
    expect(sites.some((site) => site.kind === 'read')).toBe(false);
  });

  it('publishes one entry for each entry point, each naming its own callee', () => {
    // Two entries make different calls; each entry's table has to name the callee its own site binds, so entry
    // `a` publishes `ping` at `TARGET` and entry `b` publishes `pong` at `OTHER_TARGET`.
    const artifacts = compileStringMulti(twoEntrySource(), { composition: 'framed' });
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
        writeSegments: [],
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
        writeSegments: [],
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

  it('marks the call site of a loop, whose repetition the source does not fix', () => {
    // The body reaches the site as often as the loop turns, so the table describes the source's call rather than
    // enumerating one execution's witnesses, and a driver reads the marker to know that.
    const artifacts = compileStringMulti(loopedCallSource(), { composition: 'framed' });
    const entry = publicationOf(artifacts.Caller!).entries.find(
      (candidate) => candidate.functionName === 'Caller.go()',
    )!;
    expect(entry.sites.sites).toStrictEqual([
      { kind: 'call', site: 0, callIndex: 0, descriptor: 0, repeated: true },
      { kind: 'segmentClose', site: 1, segmentIndex: 0 },
      { kind: 'segmentClose', site: 2, segmentIndex: 1 },
    ]);
    // The same call written without a loop carries no marker, which is the control beside it.
    const plain = publicationOf(
      compileStringMulti(callingSource(), { composition: 'framed' }).Caller!,
    ).entries[0]!;
    expect(plain.sites.sites[0]).toStrictEqual({ kind: 'call', site: 0, callIndex: 0, descriptor: 0 });
  });

  it('gives an entry that calls the same method at the same target twice one site per call', () => {
    // A framed master carries one call record per call and gives each call its own frame, so the two identical
    // calls are two sites rather than one coalesced batch: the head checks two records and each site binds its own
    // descriptor.
    const artifacts = compileStringMulti(repeatedCallSource(), { composition: 'framed' });
    const entry = publicationOf(artifacts.Caller!).entries[0]!;
    // Neither site carries the marker the loop case's single site does, which is what tells turns of one site from
    // two sites.
    expect(entry.sites.sites).toStrictEqual([
      { kind: 'call', site: 0, callIndex: 0, descriptor: 0 },
      { kind: 'call', site: 1, callIndex: 1, descriptor: 1 },
      { kind: 'segmentClose', site: 2, segmentIndex: 0 },
      { kind: 'segmentClose', site: 3, segmentIndex: 1 },
      { kind: 'segmentClose', site: 4, segmentIndex: 2 },
    ]);
    expect(entry.calls.map((call) => `${call.callIndex}:${call.functionName}`))
      .toStrictEqual(['0:ping', '1:ping']);
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
    expect(publishFramedStopSites('X', [{ entryName: 'f', calls: [] }]).entries[0]!.sites.sites).toHaveLength(1);
  });
});
