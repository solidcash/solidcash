import { bigIntToVmNumber, encodeDataPush, hexToBin } from '@bitauth/libauth';
import { type Artifact, scriptToAsm } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { DEFAULT_PROXY_SOURCE, defaultProxyArtifact } from '../../src/stateful/defaultProxyArtifact.js';
import { defaultProxyDelegateDistances } from '../../src/stateful/upgrades.js';
import type { ContractUnlocker } from '../../src/interfaces.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { addressToLockScript } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

const OWNER_SOURCE = `pragma solidcash ^0.14.0;
contract RoutedOwner() {
  bigint counter;
  function forward(bytes input, address implementation) external {
    implementation.delegatecall(input);
    require(input.length > 0);
  }
}`;

const IMPLEMENTATION_SOURCE = `pragma solidcash ^0.14.0;
contract RoutedImplementation() {
  bigint counter;
  function increment() public {
    this.counter = this.counter + 1;
  }
}`;

describe('delegate input coordinate refresh', () => {
  it('converts a participant-local materialized index to its aggregate absolute index', async () => {
    const provider = createTestProvider();
    const ownerArtifact = compileString(OWNER_SOURCE, {
      allowUnsafeOperations: true, suppressWarnings: true,
    });
    const implementationArtifact = compileString(IMPLEMENTATION_SOURCE).delegateArtifact!;
    const ownerInner = new Contract(ownerArtifact, [], { provider });
    const implementationInner = new Contract(implementationArtifact, [], { provider });
    const { categoryId: ownerCategory, masterUtxo: ownerMaster } = await setupStatefulUtxos(
      provider, ownerInner, ownerArtifact.stateLayout!, { counter: 4n }, { saltContract: true },
    );
    const { categoryId: implementationCategory } = await setupStatefulUtxos(
      provider, implementationInner, implementationArtifact.stateLayout!, { counter: 0n },
      { saltContract: true },
    );
    const owner = StatefulContract.withCategory(ownerInner, ownerCategory);
    const implementation = StatefulContract.withCategory(implementationInner, implementationCategory);
    const implementationSelector = hexToBin(
      implementationArtifact.abi.find((candidate) => candidate.name === 'increment')!.selector!,
    );
    const ownerFunction = ownerArtifact.abi.find((candidate) => candidate.name === 'forward')!;
    const routeFunction = { ...ownerFunction, name: '__route' };
    const blockBase = 37;

    const statefulBuilder = await owner._createBuilder(
      'forward',
      [implementationSelector, addressToLockScript(implementation.address)],
      {
        abiFunction: routeFunction,
        compilerRouteSelector: hexToBin(ownerFunction.selector!),
        blockBase,
        calls: [{
          type: 'stateful', contract: implementation, functionName: 'increment', args: [],
        }],
      },
    );
    const localDelegateIndex = statefulBuilder.getLowLevelCallMasterInputIndex(0);
    expect(localDelegateIndex).toBeGreaterThanOrEqual(0);

    const built = statefulBuilder.build();
    const ownerInput = built.inputs.find(
      (input) => input.txid === ownerMaster.txid && input.vout === ownerMaster.vout,
    )!;
    const unlocker = ownerInput.unlocker as ContractUnlocker;
    const witnessIndex = unlocker.abiFunction.inputs.findIndex(
      (input) => input.name === '__internal__delegateInputIndex',
    );

    expect(witnessIndex).toBeGreaterThanOrEqual(0);
    expect(unlocker.params[witnessIndex]).toBe(BigInt(blockBase + localDelegateIndex));
  });
});

/**
 * The delegate derives its state owner positionally (`proxyMasterIndex == OP_INPUTINDEX - 1 - dataNftCount`).
 * The identity and payload pins do not bind that position, so a delegate placed after a DIFFERENT master's block
 * would authorize that master while the forwarding proxy's own state covenant is skipped. A proxy publishes the
 * distance to its delegate as the constructor input `__proxyBlockSize`, which its own p2sh32 commits to.
 */
const POSITION_PIN = 'OP_INPUTINDEX OP_ADD OP_DEPTH OP_1SUB OP_PICK OP_NUMEQUALVERIFY';

describe('delegate position pin', () => {
  it('pins the delegate one published proxy block after the forwarding input', () => {
    const compiled = compileString(DEFAULT_PROXY_SOURCE, { forceStateful: true, suppressWarnings: true });
    const forward = compiled.abi.find((entry) => entry.name === '__forward')!;

    expect(compiled.constructorInputs.map((input) => input.name)).toEqual([
      'implementation', '__proxyBlockSize', '__proxyRouteBlockSize',
    ]);
    // Baking still names the implementation: the extra constructor input must not move targetBinding.input.
    expect(forward.delegateForwarding?.targetBinding).toMatchObject({ kind: 'constructorArg', input: 0 });
    expect(scriptToAsm(hexToBin(compiled.debug!.bytecode))).toContain(POSITION_PIN);
    // The shipped artifact is the same compile, so the SDK deploy path carries the pin.
    expect(defaultProxyArtifact.constructorInputs.map((input) => input.name)).toEqual([
      'implementation', '__proxyBlockSize', '__proxyRouteBlockSize',
    ]);
  });

  it('leaves a proxy that publishes no distance on the witness-only pin', () => {
    const unpublished = `pragma solidcash >=0.8.0;
      contract UnpublishedProxy(address implementation) {
        function __forward(bytes input) {
          implementation.delegatecall(input);
          require(input.length > 0);
        }
      }`;
    const compiled = compileString(unpublished, { forceStateful: true, suppressWarnings: true });
    expect(compiled.constructorInputs.map((input) => input.name)).toEqual(['implementation']);
    expect(scriptToAsm(hexToBin(compiled.debug!.bytecode))).not.toContain(POSITION_PIN);
  });
});

/**
 * A message-bus route derives its owner as `OP_INPUTINDEX - routeBlockSize`, and the SDK lays a route call's
 * implementation after the route's own block, so one distance cannot serve both call kinds. The proxy commits both
 * (`__proxyBlockSize`, `__proxyRouteBlockSize`) and the forwarded selector picks exactly one: SCB1, the route
 * selector, the route's; any other the direct one. The payload pin requires that selector to be the delegate's
 * first push, the item its dispatcher invokes, so a witness cannot pair one kind's distance with the other kind.
 */
const KIND_PIN = 'OP_4 OP_SPLIT OP_DROP 53434231 OP_EQUAL OP_IF OP_DROP';
const LEADING_PUSH_PIN = 'OP_INPUTBYTECODE OP_1 OP_SPLIT OP_SWAP OP_4 OP_EQUALVERIFY';
const ROUTE_SELECTOR = hexToBin('53434231');
const DIRECT_SELECTOR = hexToBin('0a0b0c0d');
const BLOCK = 1n;
const ROUTE_BLOCK = 3n;
const push4 = (selector: Uint8Array): Uint8Array => Uint8Array.of(0x04, ...selector);

/**
 * Evaluate the shipped forward at input 0, its implementation input at `delegateIndex` with `delegateUnlocking`.
 * Only input 0 runs, so the verdict is the proxy's own.
 */
function forwardAccepts(payload: Uint8Array, delegateIndex: number, delegateUnlocking: Uint8Array): boolean {
  const provider = createTestProvider();
  const implementation = hexToBin(`aa20${'11'.repeat(32)}87`);
  const proxy = new Contract(defaultProxyArtifact, [implementation, BLOCK, ROUTE_BLOCK] as never[], { provider });
  const proxyLock = hexToBin(proxy.lockingBytecode);
  const token = {
    amount: 0n,
    category: new Uint8Array(32).fill(0x22),
    nft: { capability: 'minting' as const, commitment: new Uint8Array() },
  };
  const proxyUnlocking = Uint8Array.from([
    ...encodeDataPush(bigIntToVmNumber(BigInt(delegateIndex))),
    ...encodeDataPush(payload),
    ...encodeDataPush(hexToBin(proxy.bytecode)),
  ]);
  const inputs = Array.from({ length: delegateIndex + 1 }, (_, index) => ({
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(index + 1),
    sequenceNumber: 0,
    unlockingBytecode: index === 0 ? proxyUnlocking : index === delegateIndex ? delegateUnlocking : Uint8Array.of(0x51),
  }));
  const sourceOutputs = inputs.map((_, index) => (index === 0
    ? { lockingBytecode: proxyLock, valueSatoshis: 1_000n, token }
    : { lockingBytecode: index === delegateIndex ? implementation : Uint8Array.of(0x51), valueSatoshis: 1_000n }));
  const transaction = {
    version: 2, locktime: 0, inputs, outputs: [{ lockingBytecode: proxyLock, valueSatoshis: 1_000n, token }],
  };
  const vm = createVirtualMachineBch2026ForProvider(provider);
  return vm.stateSuccess(vm.evaluate({ inputIndex: 0, sourceOutputs, transaction })) === true;
}

describe('delegate distance by call kind', () => {
  it('selects the published distance by the forwarded selector, read as the delegate\'s first push', () => {
    const compiled = compileString(DEFAULT_PROXY_SOURCE, { forceStateful: true, suppressWarnings: true });
    const asm = scriptToAsm(hexToBin(compiled.debug!.bytecode));
    expect(asm).toContain(`${KIND_PIN} OP_DEPTH OP_3 OP_SUB OP_PICK OP_ENDIF ${POSITION_PIN}`);
    expect(asm).toContain(LEADING_PUSH_PIN);

    // A forwarder that publishes only the direct distance keeps one distance and the unchanged payload pin.
    const single = compileString(`pragma solidcash >=0.8.0;
      contract SingleDistanceProxy(address implementation, bigint __proxyBlockSize) {
        function __forward(bytes input) {
          implementation.delegatecall(input);
          require(input.length > 0);
        }
      }`, { forceStateful: true, suppressWarnings: true });
    const singleAsm = scriptToAsm(hexToBin(single.debug!.bytecode));
    expect(singleAsm).toContain(POSITION_PIN);
    expect(singleAsm).not.toContain('53434231');
    expect(singleAsm).toContain('OP_INPUTBYTECODE OP_1 OP_SPLIT OP_NIP');
  });

  it('accepts each kind at its own distance only', () => {
    expect(forwardAccepts(ROUTE_SELECTOR, Number(ROUTE_BLOCK), push4(ROUTE_SELECTOR))).toBe(true);
    // A route payload carrying more than the selector (the proxy-forward envelope) is still the route kind.
    const extended = Uint8Array.of(...ROUTE_SELECTOR, 0x51);
    expect(forwardAccepts(extended, Number(ROUTE_BLOCK), Uint8Array.of(...push4(ROUTE_SELECTOR), 0x51))).toBe(true);
    expect(forwardAccepts(DIRECT_SELECTOR, Number(BLOCK), push4(DIRECT_SELECTOR))).toBe(true);

    expect(forwardAccepts(ROUTE_SELECTOR, Number(BLOCK), push4(ROUTE_SELECTOR))).toBe(false);
    expect(forwardAccepts(DIRECT_SELECTOR, Number(ROUTE_BLOCK), push4(DIRECT_SELECTOR))).toBe(false);
  });

  it('refuses a route payload the delegate does not dispatch, and a payload shorter than a selector', () => {
    // The payload matches the bytes after the delegate's first opcode, but that push is five bytes, not SCB1.
    const fivePush = Uint8Array.of(0x05, ...ROUTE_SELECTOR, 0x00);
    expect(forwardAccepts(ROUTE_SELECTOR, Number(ROUTE_BLOCK), fivePush)).toBe(false);
    const short = ROUTE_SELECTOR.slice(0, 3);
    expect(forwardAccepts(short, Number(BLOCK), push4(ROUTE_SELECTOR))).toBe(false);
    expect(forwardAccepts(short, Number(ROUTE_BLOCK), push4(ROUTE_SELECTOR))).toBe(false);
  });

  it('derives both distances from the implementation at deploy', () => {
    const stateLayout = { dataNftCount: 2 };
    const route = { blockLayout: { blockSize: 9 } };
    const distances = (messageBus?: object): readonly [bigint, bigint] => defaultProxyDelegateDistances(
      { stateLayout, ...(messageBus && { messageBus }) } as unknown as Artifact,
    );
    expect(distances()).toEqual([3n, 3n]);
    expect(distances({ available: true, routeInBytecode: true, route })).toEqual([3n, 9n]);
    // No route in the implementation's bytecode: an SCB1 selector cannot reach a route, so it takes the direct one.
    expect(distances({ available: false, routeInBytecode: false, route })).toEqual([3n, 3n]);
  });
});
