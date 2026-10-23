import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { callerFields, edgeDeployment, settleEdge } from './edge-harness.js';

/**
 * Spec section 22: an entry whose record is written by a reentrancy guard on entry and on exit, beside a run-time
 * loop that makes calls.
 *
 * `Vault` sits behind its proxy and reads `Ledger`, deployed on its own. `plain` opens by reading `Ledger.get`,
 * whose return is a struct holding a dynamic member, into a memory local and stores a fixed member of it: the call
 * shape alone. `claimLoop` brackets the same read with a guard (the guard the catalog's claim entry carries) and
 * then runs a loop that reads the callee once per turn, accumulating into a local and storing it after the loop:
 * the guard's two record writes land in the first and the last segment, and the calls between them are a run-time
 * count the source does not fix. `claimFixed` is the control: the same guard and calls, without the loop.
 */

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' struct Escrow { int amount; string reference; }'
  + ' interface ILedger {'
  + '   function get(int id) view returns (Escrow);'
  + '   function tick(int i) view returns (int);'
  + ' }'
  + ' abstract contract Guard {'
  + '   uint256 private constant _NOT_ENTERED = 1;'
  + '   uint256 private constant _ENTERED = 2;'
  + '   uint256 private _status;'
  + '   constructor() { _status = _NOT_ENTERED; }'
  + '   modifier nonReentrant() { _nonReentrantBefore(); _; _nonReentrantAfter(); }'
  + '   function _nonReentrantBefore() private {'
  + '     require(_status != _ENTERED, "ReentrancyGuard: reentrant call");'
  + '     _status = _ENTERED;'
  + '   }'
  + '   function _nonReentrantAfter() private { _status = _NOT_ENTERED; }'
  + ' }'
  + ' contract Ledger {'
  + '   int public amount;'
  + '   function get(int id) view returns (Escrow) { return Escrow(41, "hello world"); }'
  + '   function tick(int i) view returns (int) { return i; }'
  + ' }'
  + ' contract Vault is Guard {'
  + '   address public implementation;'
  + '   address public ledger;'
  + '   int public last;'
  + '   function initialize(address l) { this.ledger = l; require(true); }'
  + '   function plain(int id) {'
  + '     Escrow memory e = ILedger(this.ledger).get(id);'
  + '     this.last = e.amount;'
  + '     require(true);'
  + '   }'
  + '   function claimFixed(int id) nonReentrant {'
  + '     Escrow memory e = ILedger(this.ledger).get(id);'
  + '     this.last = e.amount + ILedger(this.ledger).tick(1);'
  + '     require(true);'
  + '   }'
  + '   function claimLoop(int id) nonReentrant {'
  + '     Escrow memory e = ILedger(this.ledger).get(id);'
  + '     int total = e.amount;'
  + '     for (int i = 0; i < 3; i = i + 1) {'
  + '       total = total + ILedger(this.ledger).tick(i);'
  + '     }'
  + '     this.last = total;'
  + '     require(true);'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const deployed = edgeDeployment({
  scope: 'dynamic struct return edge', callee: artifacts.Ledger!, caller: artifacts.Vault!,
  interfaceName: 'ILedger',
});

describe('an entry guarded on both sides of a call-making loop', () => {
  it('settles a plain entry that stores a fixed member of a returned dynamic struct', async () => {
    const run = await deployed();
    const result = await settleEdge(run, 'plain', [1n]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(await callerFields(run)).toMatchObject({ last: 41n });
  });

  it('settles a guarded entry whose calls are fixed', async () => {
    const run = await deployed();
    const result = await settleEdge(run, 'claimFixed', [1n]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(await callerFields(run)).toMatchObject({ last: 42n });
  });

  it('settles a guarded entry whose record changes on both sides of a call-making loop', async () => {
    const run = await deployed();
    const result = await settleEdge(run, 'claimLoop', [1n]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(await callerFields(run)).toMatchObject({ last: 44n });
  });
});
