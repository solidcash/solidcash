import { describe, expect, it } from 'vitest';
import { SignatureTemplate } from '../../../src/index.js';
import { callPerCallEntry } from '../../../src/per-call/call/index.js';
import { PerCallProxyDeployError, callPerCallProxyEntry } from '../../../src/per-call/proxy/index.js';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { alicePriv } from '../../fixture/vars.js';
import {
  USER_LOCK, compilePerCall, deployPlain, deployProxied, newWorld, refusedVerdicts, type World,
} from './composition-world.js';

/**
 * Walls ahead: a typed call carrying value, `IWrapper(w).deposit{value: v}()`, beside the caller's own write. A DEX
 * router or a wrapper deposits native value into another contract this way.
 *
 * The compiler serves it: the call's record carries the value, the caller's site holds the record's `value` to the
 * amount its code computes, the validator holds the callee's frame value to the record (V5), and the value rule charges
 * the caller's containers and credits the callee's (V7, or the head of a frame that settles alone). What stands is the
 * builders' plan: both call paths plan a typed callee with no value (`call/callees.ts`), so the caller's own frame
 * refuses at the call site, where the record does not carry the amount its code computed.
 *
 * The case pins what is met today; its title says what should settle once served. The file runs only under
 * `PER_CALL_AHEAD=1`.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IWrapper { function deposit() external payable; }',
  'contract Wrapper {',
  '  mapping(address => uint256) public balanceOf;',
  '  function deposit() external payable { balanceOf[msg.sender] += msg.value; }',
  '}',
  'contract Router {',
  '  address public implementation;',
  '  uint256 public routed;',
  '  function initialize(uint256 start) public { routed = start; }',
  '  function depositVia(address w, uint256 v) external payable {',
  '    routed += v;',
  '    IWrapper(w).deposit{value: v}();',
  '  }',
  '}',
].join('\n');

/** The caller's frame refusing at the typed call (source line 13), where its record carries no value. */
const AT_CALL_SITE = 'of Router.depositVia() at line 13: no source message (Program failed an OP_VERIFY operation.)';

const FUNDER = new SignatureTemplate(alicePriv).unlockP2PKH();
const VALUE = 5_000n;

async function spent(world: World, txid: string, vout: number): Promise<boolean> {
  const live = await world.network.getUtxosForLockingBytecode(USER_LOCK);
  return !live.some((utxo) => utxo.txid === txid && utxo.vout === vout);
}

describe.runIf(process.env.PER_CALL_AHEAD === '1')('ahead: a typed call carrying value', () => {
  it('serves the caller\'s entry, whose frame the call paths still plan with no value at the call (should settle '
    + 'once the builders plan the value a typed call carries)', async () => {
    const units = compilePerCall(SOURCE);
    expect(units.Router!.composition?.refusedEntries ?? []).toStrictEqual([]);
    const world = await newWorld(0x5c);
    const wrapper = await deployPlain(world, units.Wrapper!);
    const externals = { Wrapper: { artifact: units.Wrapper!, categoryId: wrapper.categoryId } };

    // Through the generated proxy, the implementation's frame refuses at the call.
    const proxied = await deployProxied(world, units.Router!, [0n]);
    const hopCoin = await world.userCoin();
    const hop = await callPerCallProxyEntry({
      provider: world.network, implementationArtifact: proxied.artifact,
      proxyArtifact: proxied.external.proxyArtifact!, proxyCategoryId: proxied.proxyCategoryId,
      implementationCategoryId: proxied.implementationCategoryId, functionName: 'depositVia',
      args: [wrapper.address, VALUE], value: VALUE, externals: externals as never, callerUtxo: hopCoin,
      callerLockingBytecode: USER_LOCK, funder: FUNDER, changeAddress: world.changeAddress, vm: compositionMachine(),
    }).then(() => undefined, (error: unknown) => error as Error);
    expect(hop).toBeInstanceOf(PerCallProxyDeployError);
    expect(hop!.message).toBe('the implementation\'s "depositVia" entry did not settle through the proxy: frame '
      + `"implementation-master" ${AT_CALL_SITE}`);
    expect(await spent(world, hopCoin.txid, hopCoin.vout)).toBe(false);

    // Deployed plain, the call path plans the same frame, which its master refuses at the call.
    const plainRouter = await deployPlain(world, units.Router!);
    const plainCoin = await world.userCoin();
    const plain = await callPerCallEntry({
      provider: world.network, artifact: plainRouter.artifact, categoryId: plainRouter.categoryId,
      functionName: 'depositVia', args: [wrapper.address, VALUE], value: VALUE, externals, callerUtxo: plainCoin,
      callerLockingBytecode: USER_LOCK, funder: FUNDER, changeAddress: world.changeAddress, vm: compositionMachine(),
    });
    expect(plain.broadcast).toBeUndefined();
    expect(refusedVerdicts(plain)).toBe(`master: frame "master" ${AT_CALL_SITE}`);
    expect(await spent(world, plainCoin.txid, plainCoin.vout)).toBe(false);
  }, 600_000);
});
