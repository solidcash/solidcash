import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import {
  callerFields, edgeDeployment, eventsOnChain, expectRefusedEdge, readCallee, settleEdge, type EdgeRun,
} from './edge-harness.js';

/**
 * Spec section 22: a `string` crossing a call edge, in both kinds the catalog names.
 *
 * `Editor` sits behind its proxy and calls `Notebook`, deployed on its own. `submit` passes the text the user gave it
 * to `Notebook.review` (a `CALL`): the callee checks the score, stores the text under the id, emits it, and returns a
 * weighted score the editor stores (the catalog's review edge, whose callee reverts on a bad score). `labelAll` walks
 * the keys it was given and asks `Notebook.expand` about each (a `STATIC` call per turn, a `string` in and out), then
 * emits the answers it joined (the catalog's per-tag read, which can revert mid-loop).
 *
 * Every case runs the shipped proxy hop, and what it left is read back from the chain: the editor's record, the text
 * the notebook stores (through the shipped read path) and both contracts' events (from the live outputs at their
 * covenants). A score the callee's own check rejects, and an empty key on the second turn, are each refused with the
 * callee's reason, and nothing is broadcast.
 */

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface INotebook {'
  + '   function review(int id, string text, int score) returns (int);'
  + '   function expand(string key) view returns (string);'
  + ' }'
  + ' contract Notebook {'
  + '   int public weight;'
  + '   mapping(int => string) texts;'
  + '   event Reviewed(int id, string text, int score);'
  + '   constructor() { this.weight = 100; }'
  + '   function review(int id, string text, int score) returns (int) {'
  + '     require(score >= 1, "score below range");'
  + '     require(score <= 5, "score above range");'
  + '     this.texts[id] = text;'
  + '     emit Reviewed(id, text, score);'
  + '     return this.weight * score;'
  + '   }'
  + '   function expand(string key) view returns (string) { require(key != "", "empty key"); return key + "/full"; }'
  + '   function textOf(int id) view returns (string) { return this.texts[id]; }'
  + ' }'
  + ' contract Editor {'
  + '   address public implementation;'
  + '   address public notebook;'
  + '   int public reviews;'
  + '   int public lastWeighted;'
  + '   event Labeled(int count, string labels);'
  + '   function initialize(address n) { this.notebook = n; require(true); }'
  + '   function submit(int id, string text, int score) {'
  + '     int weighted = INotebook(this.notebook).review(id, text, score);'
  + '     this.lastWeighted = weighted;'
  + '     this.reviews = this.reviews + 1;'
  + '   }'
  + '   function labelAll(string[] keys) {'
  + '     string joined = "";'
  + '     for (int i = 0; i < keys.length; i = i + 1) {'
  + '       string label = INotebook(this.notebook).expand(keys[i]);'
  + '       joined = joined + label + ";";'
  + '     }'
  + '     emit Labeled(keys.length, joined);'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const deployed = edgeDeployment({
  scope: 'string argument edge', callee: artifacts.Notebook!, caller: artifacts.Editor!, interfaceName: 'INotebook',
});

/** The value chunks the notebook holds beside its nodes: the shipped reader files them apart from any collection. */
async function valueChunks(run: EdgeRun): Promise<number> {
  const pools = await readFramedDeployment(run.network, run.calleeCategoryId, run.callee.stateLayout!);
  return pools.collectionNodes.length - (pools.nodesByCollection.get('texts')?.length ?? 0);
}

const REVIEW_ID = 3n;
const TEXT = 'fair work, delivered on time';
/** Longer than a mapping node holds inline, so the stored text takes a run of chunk records. */
const LONG_TEXT = 'a review long enough that the notebook keeps it beside the node rather than in it, as chunks';

describe('a string argument the callee stores and emits', () => {
  it('reaches the callee whole, and the weighted score it returns reaches the caller', async () => {
    const run = await deployed();
    const result = await settleEdge(run, 'submit', [REVIEW_ID, TEXT, 4n]);
    expect(result.completed.map((frame) => frame.functionName))
      .toStrictEqual(['Notebook.review()', 'Editor.submit()', 'EditorProxy.__fallback()']);
    expect(await callerFields(run)).toMatchObject({ reviews: 1n, lastWeighted: 400n });
    expect(await readCallee(run, 'textOf', [REVIEW_ID])).toStrictEqual([TEXT]);
    expect(await valueChunks(run)).toBe(0);
    expect((await eventsOnChain(run, run.callee, run.calleeCategoryId, result.txid))
      .map(({ name, args }) => ({ name, args }))).toStrictEqual([
      { name: 'Reviewed', args: { id: REVIEW_ID, text: TEXT, score: 4n } },
    ]);
    // The editor emits nothing of its own on this entry.
    expect(await eventsOnChain(run, run.caller, run.proxyCategoryId, result.txid)).toStrictEqual([]);
  });

  it('carries a text longer than a node holds inline', async () => {
    const run = await deployed();
    const result = await settleEdge(run, 'submit', [REVIEW_ID, LONG_TEXT, 2n]);
    expect(await callerFields(run)).toMatchObject({ reviews: 1n, lastWeighted: 200n });
    expect(await readCallee(run, 'textOf', [REVIEW_ID])).toStrictEqual([LONG_TEXT]);
    expect(await valueChunks(run)).toBe(1);
    expect((await eventsOnChain(run, run.callee, run.calleeCategoryId, result.txid)).map(({ args }) => args))
      .toStrictEqual([{ id: REVIEW_ID, text: LONG_TEXT, score: 2n }]);
  });

  it('refuses a score the callee\'s own check rejects, with its reason, and nothing is broadcast', async () => {
    const run = await deployed();
    await expectRefusedEdge(run, 'submit', [REVIEW_ID, TEXT, 9n],
      /the call's callee "Notebook\.review\(\)" did not settle through the proxy: .*score above range/);
    expect(await callerFields(run)).toMatchObject({ reviews: 0n, lastWeighted: 0n });
  });
});

describe('a string in and out of a static call, once per key in a loop', () => {
  it('asks the callee once per key and emits the answers the caller joined', async () => {
    const run = await deployed();
    const result = await settleEdge(run, 'labelAll', [['AU', 'VID', 'TX']]);
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([
      'Notebook.expand()', 'Notebook.expand()', 'Notebook.expand()', 'Editor.labelAll()', 'EditorProxy.__fallback()',
    ]);
    expect((await eventsOnChain(run, run.caller, run.proxyCategoryId, result.txid))
      .map(({ name, args }) => ({ name, args }))).toStrictEqual([
      { name: 'Labeled', args: { count: 3n, labels: 'AU/full;VID/full;TX/full;' } },
    ]);
  });

  it('refuses an empty key on the second turn with the callee\'s reason, and nothing is broadcast', async () => {
    const run = await deployed();
    await expectRefusedEdge(run, 'labelAll', [['AU', '', 'TX']],
      /the call's callee "Notebook\.expand\(\)" did not settle through the proxy: frame "callee-master-2" .*empty key/);
  });
});
