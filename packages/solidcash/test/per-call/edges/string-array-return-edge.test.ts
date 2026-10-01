import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { readPerCallEntry, type PerCallReadResult } from '../../../src/per-call/read/index.js';
import {
  callerFields, deployBeside, edgeDeployment, eventsOnChain, expectRefusedEdge, settleEdge, type EdgeRun,
} from './edge-harness.js';

/**
 * Spec section 22: a `string[]` crossing a return, bare and inside a struct, used by the caller that asked for it.
 *
 * `Front` sits behind its proxy and calls `Shelf`, deployed on its own, whose views build what they answer: `tagsOf`
 * a `string[]` ending with the tag its caller passed, and `listing` a struct holding the stored title, a `string[]`
 * and the stored amount (the catalog's view returning a job post with a `string[]`). `Front.tagsFor` and
 * `Front.inspect` read the answer's length and elements, store the counts and emit the strings through the shipped
 * proxy hop, and what each left is read back from the chain. A tag the callee's own check rejects is refused with
 * its reason, and nothing is broadcast. `Reader` is the catalog's views calling views: deployed on its own, it reads
 * `Shelf.catalog` and answers through the shipped read path, with nothing broadcast.
 *
 * Known wall: a callee view that reads a dynamic state field, answered through the shipped read path. `listing`
 * reads the stored title, which the artifact publishes in the entry's `dynamicReads`; the read path declares no
 * chunk run for a whole dynamic field (it does for mapping values and indexed array reads), so the callee's frame
 * fails where the body reads the title. The hop serves the same view in `inspect`. Owner: the SDK read path
 * (`per-call/read/read.ts`).
 */

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' struct Listing { string title; string[] tags; int amount; }'
  + ' interface IShelf {'
  + '   function tagsOf(string last) view returns (string[]);'
  + '   function listing() view returns (Listing);'
  + '   function catalog() view returns (Listing);'
  + '   function catalogTags() view returns (string[]);'
  + ' }'
  + ' contract Shelf {'
  + '   int public amount;'
  + '   string public title;'
  + '   constructor() { this.amount = 40; this.title = "garden work"; }'
  + '   function tagsOf(string last) view returns (string[]) {'
  + '     require(last != "", "empty tag");'
  + '     string[] tags; tags.push("AU"); tags.push("VID"); tags.push(last);'
  + '     return tags;'
  + '   }'
  + '   function listing() view returns (Listing) {'
  + '     string[] tags; tags.push("AU"); tags.push("VID"); tags.push("OTHER");'
  + '     return Listing(this.title, tags, this.amount);'
  + '   }'
  + '   function catalog() view returns (Listing) {'
  + '     string[] tags; tags.push("TX"); tags.push("SW");'
  + '     return Listing("catalog", tags, this.amount);'
  + '   }'
  + '   function catalogTags() view returns (string[]) { return this.catalog().tags; }'
  + ' }'
  + ' contract Front {'
  + '   address public implementation;'
  + '   address public shelf;'
  + '   int public tagCount;'
  + '   int public amount;'
  + '   event Tagged(string first, string last, int count);'
  + '   event Inspected(string title, string second, int count, int amount);'
  + '   function initialize(address s) { this.shelf = s; require(true); }'
  + '   function tagsFor(string last) {'
  + '     string[] tags = IShelf(this.shelf).tagsOf(last);'
  + '     this.tagCount = tags.length;'
  + '     emit Tagged(tags[0], tags[tags.length - 1], tags.length);'
  + '   }'
  + '   function inspect() {'
  + '     Listing l = IShelf(this.shelf).listing();'
  + '     this.tagCount = l.tags.length;'
  + '     this.amount = l.amount;'
  + '     emit Inspected(l.title, l.tags[1], l.tags.length, l.amount);'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
const deployed = edgeDeployment({
  scope: 'string array return edge', callee: artifacts.Shelf!, caller: artifacts.Front!, interfaceName: 'IShelf',
});

/**
 * The views-calling-views reader, deployed on its own beside the edge.
 *
 * The read path resolves a call's target from an address the caller's code carries, so the reader is compiled with
 * the shelf's address as a literal once the shelf is deployed.
 */
async function deployReader(run: EdgeRun): Promise<{ readonly read: (entry: string) => Promise<PerCallReadResult> }> {
  const shelf = `IShelf(0x${binToHex(run.calleeAddress)})`;
  const reader = compileStringMulti(SOURCE.replace(' contract Front {', ' contract Reader {'
    + '   int public reads;'
    + `   function summary() view returns (string, int) { Listing l = ${shelf}.catalog();`
    + '     return (l.tags[l.tags.length - 1], l.tags.length); }'
    + `   function lastTag() view returns (string) { string[] tags = ${shelf}.catalogTags(); return tags[1]; }`
    + `   function headline() view returns (string) { Listing l = ${shelf}.listing(); return l.title; }`
    + ' }'
    + ' contract Front {'), { composition: 'per-call' }).Reader!;
  const categoryId = await deployBeside(run, reader, 'reader');
  return {
    read: (entry) => readPerCallEntry({
      provider: run.network, artifact: reader, categoryId, functionName: entry, externals: run.externals,
      vm: compositionMachine(),
    }),
  };
}

describe('a string[] returned to the caller', () => {
  it('reaches the caller whole: it reads the length and both ends, stores one and emits the others', async () => {
    const run = await deployed();
    const result = await settleEdge(run, 'tagsFor', ['GDS']);
    expect(result.completed.map((frame) => frame.functionName))
      .toStrictEqual(['Shelf.tagsOf()', 'Front.tagsFor()', 'FrontProxy.__fallback()']);
    expect(await callerFields(run)).toMatchObject({ tagCount: 3n, amount: 0n });
    expect((await eventsOnChain(run, run.caller, run.proxyCategoryId, result.txid))
      .map(({ name, args }) => ({ name, args }))).toStrictEqual([
      { name: 'Tagged', args: { first: 'AU', last: 'GDS', count: 3n } },
    ]);
  });

  it('refuses a tag the callee\'s own check rejects, with its reason, and nothing is broadcast', async () => {
    const run = await deployed();
    await expectRefusedEdge(run, 'tagsFor', [''],
      /the call's callee "Shelf\.tagsOf\(\)" did not settle through the proxy: .*empty tag/);
    expect(await callerFields(run)).toMatchObject({ tagCount: 0n });
  });
});

describe('a struct carrying a string[] returned to the caller', () => {
  it('reaches the caller whole, the stored title and amount beside the array', async () => {
    const run = await deployed();
    const result = await settleEdge(run, 'inspect', []);
    expect(result.completed.map((frame) => frame.functionName))
      .toStrictEqual(['Shelf.listing()', 'Front.inspect()', 'FrontProxy.__fallback()']);
    expect(await callerFields(run)).toMatchObject({ tagCount: 3n, amount: 40n });
    expect((await eventsOnChain(run, run.caller, run.proxyCategoryId, result.txid))
      .map(({ name, args }) => ({ name, args }))).toStrictEqual([
      { name: 'Inspected', args: { title: 'garden work', second: 'VID', count: 3n, amount: 40n } },
    ]);
  });
});

describe('views calling views, through the shipped read path', () => {
  it('answers from a struct carrying a string[] and from a bare string[], with nothing broadcast', async () => {
    const run = await deployed();
    const reader = await deployReader(run);
    const tip = run.network.indexer.getTip()?.height;
    const summary = await reader.read('summary');
    expect(summary.accepted, summary.objection).toBe(true);
    expect(summary.values).toStrictEqual(['SW', 2n]);
    const lastTag = await reader.read('lastTag');
    expect(lastTag.accepted, lastTag.objection).toBe(true);
    expect(lastTag.values).toStrictEqual(['SW']);
    expect(run.network.indexer.getTip()?.height).toBe(tip);
  });

  it('known wall: a callee view that reads a dynamic state field is not answered', async () => {
    const run = await deployed();
    const reader = await deployReader(run);
    // Owner: the SDK read path (`per-call/read/read.ts`), which declares no chunk run for the field the entry
    // publishes in `dynamicReads`.
    expect(artifacts.Shelf!.abi.find((entry) => entry.name === 'listing')!.dynamicReads).toStrictEqual(['title']);
    const headline = await reader.read('headline');
    expect(headline.accepted).toBe(false);
    expect(headline.objection).toMatch(/frame "read-1" of Shelf\.listing\(\)/);
  });
});
