import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { bytesToHex, sha256, validatorAddress, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callPerCallEntry, type PerCallCallResult } from '../../../src/per-call/call/index.js';
import {
  buildProxyArtifact, callPerCallProxyEntry, deployPerCallProxy, type PerCallProxyCallResult,
} from '../../../src/per-call/proxy/index.js';
import type { PerCallProxyExternal } from '../../../src/per-call/proxy/external-calls.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A callee frame whose verified-mapping write a branch guards.
 *
 * `Gateway.enroll` and `Gateway.retire` call `Registry.join` and `Registry.leave`, whose writes run only where the
 * member's node says so (`if (!members[who])`, `if (members[who])`). The hop decides each callee write from the
 * callee frame's own facts - the call's arguments and the nodes its deployment holds - as it decides the callee's
 * own calls, and declares the write only where it runs. The registry is reached plain and behind its own proxy, from a
 * gateway behind a proxy and from a plain one, and the members are read back. A token's `transferFrom`, reached from
 * a puller behind a proxy, spends an allowance only below the type's maximum, a guard on the two-key node it reads:
 * a limited allowance is spent and an unlimited one is left as it is.
 */

const SOURCE = (plainGateway: boolean): string => [
  'pragma solidity ^0.8.20;',
  'interface IRegistry {',
  '  function join(address who) external;',
  '  function leave(address who) external;',
  '}',
  'contract Registry {',
  '  address public implementation;',
  '  uint256 public joined;',
  '  mapping(address => bool) private members;',
  '  function initialize() public { joined = 0; }',
  '  function isMember(address who) public view returns (bool) { return members[who]; }',
  '  function join(address who) external { if (!members[who]) { members[who] = true; joined += 1; } }',
  '  function leave(address who) external { if (members[who]) { members[who] = false; joined -= 1; } }',
  '}',
  'contract Gateway {',
  ...(plainGateway ? [] : ['  address public implementation;']),
  '  address public registry;',
  '  uint256 public calls;',
  plainGateway
    ? '  constructor(address registry_) { registry = registry_; }'
    : '  function initialize(address registry_) public { registry = registry_; }',
  '  function enroll(address who) external { IRegistry(registry).join(who); calls += 1; }',
  '  function retire(address who) external { IRegistry(registry).leave(who); calls += 1; }',
  '}',
].join('\n');

const OPTIONS = { solidityImportCompat: true, composition: 'per-call' } as never;
const proxiedUnit = compileStringMulti(SOURCE(false), OPTIONS);
const plainUnit = compileStringMulti(SOURCE(true), OPTIONS);
const REGISTRY = proxiedUnit.Registry!;

const USER = encodeLockingBytecodeP2pkh(alicePkh);
const USER_FUNDER = new SignatureTemplate(alicePriv).unlockP2PKH();
const A = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x41));
const B = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x42));

/** A 32-byte category or txid with varied bytes, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`callee guarded mapping write ${label}`)));
}

type Entered = PerCallProxyCallResult | PerCallCallResult;

/** One gateway and the registry it reaches, and the chain as it stood once both were deployed. */
interface World {
  readonly network: MockNetworkProvider;
  /** The category the registry's records and nodes sit at: its proxy's, or its own. */
  readonly registryRecords: string;
  readonly enter: (functionName: string, args: readonly FunctionArgument[]) => Promise<Entered>;
  readonly snapshot: SnapshotRestorer;
}

let coins = 0;

async function coinAt(network: MockNetworkProvider, lock: string, label: string): Promise<Utxo> {
  coins += 1;
  const coin = { txid: idOf(`${label} ${coins}`), vout: 0, satoshis: 5_000_000n };
  await network.addUtxo(lock, coin);
  return coin;
}

async function deployWorld(gatewayBehindProxy: boolean, registryBehindProxy: boolean): Promise<World> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv));
  const changeAddress = wallet.address;
  await fundShippedFacets(network);
  const proxied = async (artifact: Artifact, args: readonly FunctionArgument[]): Promise<{
    readonly proxy: string; readonly implementation: string; readonly address: Uint8Array;
  }> => {
    const deployment = await deployPerCallProxy({
      provider: network,
      implementationArtifact: artifact,
      proxyArtifact: buildProxyArtifact(artifact),
      implementationDeploy: {
        fundingUtxo: await coinAt(network, wallet.address, `${artifact.contractName} implementation`), funder,
        changeAddress,
      },
      proxyDeploy: {
        fundingUtxo: await coinAt(network, wallet.address, `${artifact.contractName} proxy`), funder, changeAddress,
      },
      initialize: { functionName: 'initialize', args: [...args] },
      callerLockingBytecode: USER,
      callerFunding: {
        utxo: await coinAt(network, binToHex(USER), `${artifact.contractName} initialize`), funder: USER_FUNDER,
        changeAddress,
      },
      vm: compositionMachine(),
    });
    expect(deployment.initialize.broadcast).toBeDefined();
    return {
      proxy: deployment.proxy.categoryId, implementation: deployment.implementation.categoryId,
      address: deployment.proxy.address,
    };
  };

  let registry: PerCallProxyExternal;
  let registryAddress: Uint8Array;
  if (registryBehindProxy) {
    const deployment = await proxied(REGISTRY, []);
    registry = {
      artifact: REGISTRY, categoryId: deployment.proxy, proxyArtifact: buildProxyArtifact(REGISTRY),
      implementationCategoryId: deployment.implementation,
    };
    registryAddress = deployment.address;
  } else {
    const deployment = await deployStatefulContract(REGISTRY, [], {
      provider: network, fundingUtxo: await coinAt(network, wallet.address, 'registry'), funder, changeAddress,
    });
    registry = { artifact: REGISTRY, categoryId: deployment.categoryId };
    registryAddress = validatorAddress(hexToBin(deployment.categoryId), VALIDATOR_PROGRAM);
  }
  const externals = { IRegistry: registry };

  let enter: World['enter'];
  if (gatewayBehindProxy) {
    const gateway = proxiedUnit.Gateway!;
    const deployment = await proxied(gateway, [registryAddress]);
    enter = async (functionName, args) => callPerCallProxyEntry({
      provider: network,
      implementationArtifact: gateway,
      proxyArtifact: buildProxyArtifact(gateway),
      proxyCategoryId: deployment.proxy,
      implementationCategoryId: deployment.implementation,
      functionName,
      args: [...args],
      externals,
      callerUtxo: await coinAt(network, binToHex(USER), functionName),
      callerLockingBytecode: USER,
      funder: USER_FUNDER,
      changeAddress,
      vm: compositionMachine(),
    });
  } else {
    const gateway = plainUnit.Gateway!;
    const deployment = await deployStatefulContract(gateway, [registryAddress], {
      provider: network, fundingUtxo: await coinAt(network, wallet.address, 'gateway'), funder, changeAddress,
    });
    enter = async (functionName, args) => callPerCallEntry({
      provider: network,
      artifact: gateway,
      categoryId: deployment.categoryId,
      functionName,
      args: [...args],
      externals,
      callerUtxo: await coinAt(network, binToHex(USER), functionName),
      callerLockingBytecode: USER,
      funder: USER_FUNDER,
      vm: compositionMachine(),
    });
  }
  return { network, registryRecords: registry.categoryId, enter, snapshot: await network.takeSnapshot() };
}

/** Enters a call and requires it to settle: every participant accepted and the transaction broadcast. */
async function settle(shared: World, functionName: string, args: readonly FunctionArgument[]): Promise<void> {
  const result = await shared.enter(functionName, args);
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
}

/** A registry view, read from its records through the read path. */
async function view(shared: World, functionName: string, args: readonly FunctionArgument[] = []): Promise<unknown> {
  const read = await readPerCallEntry({
    provider: shared.network, artifact: REGISTRY, categoryId: shared.registryRecords, functionName, args,
  });
  expect(read.accepted).toBe(true);
  return read.value;
}

/** How many UTXOs the registry's category holds: a write that creates no node leaves the count as it found it. */
async function heldCount(shared: World): Promise<number> {
  return (await shared.network.getUtxosByTokenCategory(shared.registryRecords)).length;
}

/**
 * A token whose `transferFrom` leaves an unlimited allowance as it is, in the shape of an EVM token library's
 * allowance spend: the write runs only where the allowance the callee frame reads is below the type's maximum.
 */
const TOKEN_SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IToken { function transferFrom(address from, address to, uint256 value) external returns (bool); }',
  'contract Token {',
  '  mapping(address => uint256) private balances;',
  '  mapping(address => mapping(address => uint256)) private allowances;',
  '  constructor(address holder, uint256 supply) { balances[holder] = supply; }',
  '  function balanceOf(address who) external view returns (uint256) { return balances[who]; }',
  '  function allowance(address owner, address spender) public view returns (uint256) {',
  '    return allowances[owner][spender];',
  '  }',
  '  function approve(address spender, uint256 value) external returns (bool) {',
  '    allowances[msg.sender][spender] = value;',
  '    return true;',
  '  }',
  '  function transferFrom(address from, address to, uint256 value) external returns (bool) {',
  '    uint256 current = allowances[from][msg.sender];',
  '    if (current != type(uint256).max) {',
  '      require(current >= value, "allowance");',
  '      allowances[from][msg.sender] = current - value;',
  '    }',
  '    balances[from] -= value;',
  '    balances[to] += value;',
  '    return true;',
  '  }',
  '}',
  'contract Puller {',
  '  address public implementation;',
  '  address public token;',
  '  uint256 public pulls;',
  '  function initialize(address token_) public { token = token_; }',
  '  function pull(address from, uint256 value) external {',
  '    IToken(token).transferFrom(from, address(this), value);',
  '    pulls += 1;',
  '  }',
  '}',
].join('\n');

describe('a callee frame whose verified-mapping write a branch guards', () => {
  for (const [gatewayBehindProxy, registryBehindProxy] of [[true, false], [true, true], [false, false]] as const) {
    const label = `${gatewayBehindProxy ? 'a proxied' : 'a plain'} gateway reaching `
      + `${registryBehindProxy ? 'a proxied' : 'a plain'} registry`;

    it(`settles the callee's write taken and skipped, from ${label}`, async () => {
      const shared = await deployWorld(gatewayBehindProxy, registryBehindProxy);
      await settle(shared, 'enroll', [A]);
      expect([await view(shared, 'isMember', [A]), await view(shared, 'joined')]).toStrictEqual([true, 1n]);
      const held = await heldCount(shared);
      // Enrolled again: the guard reads the node the first enroll wrote, and the callee skips its write.
      await settle(shared, 'enroll', [A]);
      // Retiring a member the list does not hold skips the write and creates no node.
      await settle(shared, 'retire', [B]);
      expect(await heldCount(shared)).toBe(held);
      expect([await view(shared, 'isMember', [B]), await view(shared, 'joined')]).toStrictEqual([false, 1n]);
      await settle(shared, 'retire', [A]);
      expect([await view(shared, 'isMember', [A]), await view(shared, 'joined')]).toStrictEqual([false, 0n]);
    }, 600_000);
  }

  it('spends a limited allowance and leaves an unlimited one, a guard on a two-key node the callee reads', async () => {
    const unit = compileStringMulti(TOKEN_SOURCE, OPTIONS);
    const token = unit.Token!;
    const puller = unit.Puller!;
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
    const funder = wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv));
    const changeAddress = wallet.address;
    await fundShippedFacets(network);
    const tokenDeployment = await deployStatefulContract(token, [USER, 1000n], {
      provider: network, fundingUtxo: await coinAt(network, wallet.address, 'token'), funder, changeAddress,
    });
    const tokenAddress = validatorAddress(hexToBin(tokenDeployment.categoryId), VALIDATOR_PROGRAM);
    const pullerDeployment = await deployPerCallProxy({
      provider: network,
      implementationArtifact: puller,
      proxyArtifact: buildProxyArtifact(puller),
      implementationDeploy: {
        fundingUtxo: await coinAt(network, wallet.address, 'puller implementation'), funder, changeAddress,
      },
      proxyDeploy: { fundingUtxo: await coinAt(network, wallet.address, 'puller proxy'), funder, changeAddress },
      initialize: { functionName: 'initialize', args: [tokenAddress] },
      callerLockingBytecode: USER,
      callerFunding: {
        utxo: await coinAt(network, binToHex(USER), 'puller initialize'), funder: USER_FUNDER, changeAddress,
      },
      vm: compositionMachine(),
    });
    expect(pullerDeployment.initialize.broadcast).toBeDefined();
    const pullerAddress = pullerDeployment.proxy.address;
    const settled = (result: Entered): void => {
      expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
      expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    };
    const approve = async (value: bigint): Promise<void> => settled(await callPerCallEntry({
      provider: network, artifact: token, categoryId: tokenDeployment.categoryId, functionName: 'approve',
      args: [pullerAddress, value], callerUtxo: await coinAt(network, binToHex(USER), 'approve'),
      callerLockingBytecode: USER, funder: USER_FUNDER, vm: compositionMachine(),
    }));
    const pull = async (value: bigint): Promise<void> => settled(await callPerCallProxyEntry({
      provider: network,
      implementationArtifact: puller,
      proxyArtifact: buildProxyArtifact(puller),
      proxyCategoryId: pullerDeployment.proxy.categoryId,
      implementationCategoryId: pullerDeployment.implementation.categoryId,
      functionName: 'pull',
      args: [USER, value],
      externals: { IToken: { artifact: token, categoryId: tokenDeployment.categoryId } },
      callerUtxo: await coinAt(network, binToHex(USER), 'pull'),
      callerLockingBytecode: USER,
      funder: USER_FUNDER,
      changeAddress,
      vm: compositionMachine(),
    }));
    const read = async (functionName: string, args: readonly FunctionArgument[]): Promise<unknown> => {
      const answered = await readPerCallEntry({
        provider: network, artifact: token, categoryId: tokenDeployment.categoryId, functionName, args,
      });
      expect(answered.accepted).toBe(true);
      return answered.value;
    };
    const maximum = (1n << 256n) - 1n;

    await approve(300n);
    await pull(100n);
    expect([await read('allowance', [USER, pullerAddress]), await read('balanceOf', [pullerAddress])])
      .toStrictEqual([200n, 100n]);
    await approve(maximum);
    await pull(50n);
    expect([await read('allowance', [USER, pullerAddress]), await read('balanceOf', [pullerAddress]),
      await read('balanceOf', [USER])]).toStrictEqual([maximum, 150n, 850n]);
  }, 600_000);
});
