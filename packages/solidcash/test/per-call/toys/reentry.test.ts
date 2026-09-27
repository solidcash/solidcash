import { describe, expect, it } from 'vitest';
import { publishedRefusals } from '../../../../solidc/test/per-call/master/refused-entry.js';
import {
  compileAndDeploy, entryName, hexOf, seededAddress, type ArtifactMap,
} from '../shapes/harness.js';
import { createShippedDerivationHost } from '../../../src/per-call/composer/index.js';

/**
 * Re-entry: `Vault.release` writes its record, calls `Claimer.claim`, and emits what that call returns.
 *
 * `claim` reads the record back through the read-only `Vault.get`, requires it to be set, then re-enters `Vault`
 * through `markClaimed` and through `pay` twice; each `pay` reaches `Token.transfer`. One transaction therefore
 * re-enters one contract and reads back a record a call higher up wrote.
 *
 * The shipped path stops at the compiler, for two reasons the design's own text asks for. `Vault` both writes its
 * sorted mapping and makes external calls, and a per-call master derives a verified-mapping write from the entry's
 * own segment, which an external call splits into later segments, so neither `release` nor `markClaimed` is
 * emitted. And a frame's `retval` holds one value, so the `claim` entry cannot return the two amounts `release`
 * emits. Each half is otherwise served — `Token.transfer` writes a mapping in a contract that makes no call, and
 * `Vault.pay` makes a call in a body that writes no record — so the toy pins the exact refusals, the entries that
 * are served, and the error a builder meets when it asks the derivation host for the entry the shape is entered
 * through. No run can be built, so no transaction reaches the machine.
 */

const TOKEN_LABEL = 'reentry token';
const VAULT_LABEL = 'reentry vault';
const CLAIMER_LABEL = 'reentry claimer';
const VAULT = hexOf(seededAddress(VAULT_LABEL));
const CLAIMER = hexOf(seededAddress(CLAIMER_LABEL));
const TOKEN = hexOf(seededAddress(TOKEN_LABEL));
const USER = hexOf(new Uint8Array([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x22), 0x88, 0xac]));

/** The reason the compiler publishes for every record-writing entry of a contract that also makes a call. */
const RECORD_WRITE_REFUSAL = 'a verified-mapping write is derived from the segment the entry runs, but the master '
  + 'makes external calls, which split the execution into later segments';

/** The reason the compiler publishes for an entry whose frame would carry more than one return value. */
const MULTI_VALUE_REFUSAL = 'the entry point \'claim\' returns 2 values, but a frame\'s `retval` is compared with '
  + 'one value the entry computed, which a tuple of several values is not yet';

/** The shape's source. `claim` returns one amount, or the pair the design's "amounts" names. */
function source(returns: 'amount' | 'amounts'): string {
  const two = returns === 'amounts';
  const signature = two ? '(int, int)' : '(int)';
  const unpack = two ? '(int first, int second)' : 'int first';
  const event = two ? 'Released(int first, int second)' : 'Released(int first)';
  const emitted = two ? 'Released(first, second)' : 'Released(first)';
  const returned = two ? '(1, 2)' : '1';
  return 'pragma solidcash ^0.13.0;'
    + ' interface IToken { function transfer(address to, int amount); }'
    + ' interface IVault {'
    + '   function get(int id) view returns (int);'
    + '   function markClaimed(int id);'
    + '   function pay(address to, int amount);'
    + ' }'
    + ` interface IClaimer { function claim(int id) returns ${signature}; }`
    + ' contract Token {'
    + '   mapping(address => int) public balances;'
    + '   function transfer(address to, int amount) {'
    + '     this.balances[to] = this.balances[to] + amount;'
    + '     require(this.balances[to] >= amount);'
    + '   }'
    + ' }'
    + ' contract Vault {'
    + '   struct Rec { int state; bool claimed; }'
    + '   mapping(int => Rec) public recs;'
    + `   event ${event};`
    + '   function release(int id) {'
    + '     this.recs[id].state = 1;'
    + `     ${unpack} = IClaimer(0x${CLAIMER}).claim(id);`
    + `     emit ${emitted};`
    + '     require(true);'
    + '   }'
    + '   function markClaimed(int id) { this.recs[id].claimed = true; require(true); }'
    + `   function pay(address to, int amount) { IToken(0x${TOKEN}).transfer(to, amount); require(true); }`
    + '   function get(int id) view returns (int) { return this.recs[id].state; }'
    + ' }'
    + ' contract Claimer {'
    + `   function claim(int id) returns ${signature} {`
    + `     int s = IVault(0x${VAULT}).get(id);`
    + '     require(s == 1);'
    + `     IVault(0x${VAULT}).markClaimed(id);`
    + `     IVault(0x${VAULT}).pay(0x${USER}, 1);`
    + `     IVault(0x${VAULT}).pay(0x${USER}, 2);`
    + `     return ${returned};`
    + '   }'
    + ' }';
}

const LABELS = { Token: TOKEN_LABEL, Vault: VAULT_LABEL, Claimer: CLAIMER_LABEL };
const single = compileAndDeploy(source('amount'), LABELS);
const amounts = compileAndDeploy(source('amounts'), LABELS);

/** One entry as the artifact publishes it: its stop sites, and the calls its own code makes. */
interface PublishedEntry {
  readonly functionName: string;
  readonly calls: readonly { readonly callIndex: number; readonly functionName: string; readonly selector: string }[];
}

/** The entries a contract publishes, in the order the artifact lists them. */
function entriesOf(artifacts: ArtifactMap, contract: string): readonly PublishedEntry[] {
  const composition = artifacts[contract]!.composition as { stopSites?: { entries: PublishedEntry[] } };
  return composition.stopSites?.entries ?? [];
}

/** The refusal a compile publishes for one entry, or a failure when the compile served it. */
function publishedRefusalFor(artifacts: ArtifactMap, entry: string): string {
  const refusal = publishedRefusals(artifacts as Record<string, { composition?: unknown }>)
    .find((candidate) => candidate.functionName === entry);
  if (refusal === undefined) throw new Error(`the shipped compiler served ${entry}, so there is no refusal`);
  return refusal.reason;
}

/** The error a shipped call raised, or a failure when it returned normally. */
function refusalOf(run: () => unknown): { readonly name?: string; readonly message: string } {
  try {
    run();
  } catch (error) {
    const refusal = error as { name?: string; message: string };
    return { name: refusal.name, message: refusal.message };
  }
  throw new Error('the shipped per-call path accepted the call, so there is no refusal to record');
}

/** The error the derivation host raises when it is asked for an entry's stop sites. */
function hostRefusal(artifacts: ArtifactMap, entry: string): { readonly name?: string; readonly message: string } {
  const host = createShippedDerivationHost({
    artifacts: [artifacts.Vault!, artifacts.Claimer!, artifacts.Token!],
    runs: [],
  });
  return refusalOf(() => host.sitesFor(entry));
}

describe('a vault whose release writes its record and calls a claimer that reads it back', () => {
  const { artifacts, contracts } = single;

  it('publishes a per-call descriptor, the sorted record and the event for every contract', () => {
    for (const name of ['Token', 'Vault', 'Claimer']) {
      expect(artifacts[name]?.composition?.convention).toBe('per-call');
    }
    expect(artifacts.Vault?.stateLayout?.mappings?.map((mapping) => mapping.name)).toStrictEqual(['recs']);
    expect(artifacts.Vault?.stateLayout?.mappings?.[0]?.sorted).toBe(true);
    expect(artifacts.Vault?.events?.map((event) => event.signature)).toStrictEqual(['Released(int256)']);
    expect(contracts.Vault!.program.length).toBeGreaterThan(0);
  });

  it('compiles the claimer\'s graph: the read-back, the re-entered claim and the two pays', () => {
    // `claim` reads the vault, requires the record, re-enters the vault and pays twice; the read-only read and the
    // two calls to the same entry are each published as their own site.
    const claim = entriesOf(artifacts, 'Claimer').find((entry) => entry.functionName === entryName('Claimer', 'claim'))!;
    expect(claim.calls.map((call) => call.functionName)).toStrictEqual(['get', 'markClaimed', 'pay', 'pay']);
    expect(claim.calls[2]!.selector).toBe(claim.calls[3]!.selector);
  });

  it('serves each half alone, so the refusal is the conjunction rather than the shape', () => {
    // `Token.transfer` writes its own sorted mapping in a contract that makes no call; `Vault.pay` makes a call in a
    // body that writes no record; `Vault.get` reads the record without writing it. Each is served.
    const served = (contract: string): string[] => entriesOf(artifacts, contract).map((entry) => entry.functionName);
    expect(served('Token')).toStrictEqual([entryName('Token', 'transfer')]);
    expect(served('Vault')).toStrictEqual([entryName('Vault', 'pay'), entryName('Vault', 'get')]);
    expect(artifacts.Token?.stateLayout?.mappings?.map((mapping) => mapping.name)).toStrictEqual(['balances']);
  });

  it('is refused by the compiler: a master that makes external calls cannot serve a record write', () => {
    // `Vault` makes external calls (release reaches the claimer, pay reaches the token), so neither entry that
    // writes `recs` is emitted, and the compiler publishes the reason for each by name.
    expect(publishedRefusalFor(artifacts, entryName('Vault', 'release'))).toBe(RECORD_WRITE_REFUSAL);
    expect(publishedRefusalFor(artifacts, entryName('Vault', 'markClaimed'))).toBe(RECORD_WRITE_REFUSAL);
  });

  it('is refused by the derivation host: the entry the shape is entered through cannot be run', () => {
    // A plan's root would be `Vault.release`, whose stop sites the host cannot publish, so no run can be built and
    // no transaction reaches the machine.
    expect(hostRefusal(artifacts, entryName('Vault', 'release'))).toStrictEqual({
      name: 'ShippedHostError',
      message: `PER_CALL_HOST_ENTRY_REFUSED: ${entryName('Vault', 'release')} is refused by the compiler: `
        + RECORD_WRITE_REFUSAL,
    });
  });
});

describe('the amounts a claim returns beside the record write', () => {
  it('is refused by the compiler: a frame\'s retval holds one value, not a tuple', () => {
    // The design emits the amounts `claim` returns; taken as a pair, the returned tuple has no frame field to land
    // in, so the entry is refused as well and the shape cannot be emitted either way.
    expect(publishedRefusalFor(amounts.artifacts, entryName('Claimer', 'claim'))).toBe(MULTI_VALUE_REFUSAL);
    expect(hostRefusal(amounts.artifacts, entryName('Claimer', 'claim'))).toStrictEqual({
      name: 'ShippedHostError',
      message: `PER_CALL_HOST_ENTRY_REFUSED: ${entryName('Claimer', 'claim')} is refused by the compiler: `
        + MULTI_VALUE_REFUSAL,
    });
  });
});
