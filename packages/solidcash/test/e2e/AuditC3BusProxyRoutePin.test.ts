/**
 * C3 on a proxy's block (docs/security/SECURITY-AUDIT.md C3). A compiler-owned message-bus route of a proxied
 * contract (its delegate route) runs on the proxy's records, and every record covenant self-authorizes on the
 * co-spent proxy master. The route verifier counts records only inside the participant block, a route can also run
 * standalone (`__internal__activeVerifierIndex` -1), and the certified default proxy drops its record count, so the
 * delegate route now runs the route record pin (emitRouteOutsideBlockRecordPin): every proxy-category mutable input
 * outside `[proxy master, proxy master + size)`, other than the route's verifier, comes back at its own index.
 * The route takes no claim flags, so `size` is `__internal__participantBlockSize` once its verifier ran and the
 * compile-time block otherwise.
 *
 * Compile level: the delegate route of a proxied two-mapping ledger carries that pin, with the window picked from the
 * verifier index, beside the claim-flag pin of the same contract's non-proxy route. Honest: with a long `side` value
 * among the proxy's records, a compose that reaches the ledger through its delegate route settles.
 */
import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, disassembleBytecodeBch, encodeDataPush, hexToBin,
} from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { Contract, Signer, type TransactionBuilder } from '../../src/index.js';
import {
  StatefulContract, getContractFactory, upgrades,
} from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { isContractUnlocker } from '../../src/interfaces.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

const LEDGER = `contract ProxiedLedger() {
  int public count;
  mapping(int => bytes) side;
  mapping(int => int) public other;
  function tick() public { this.count = this.count + 1; require(true); }
  function put(int key, bytes value) public { this.side[key] = value; require(true); }
  function putOther(int key, int value) public { this.other[key] = value; require(true); }
}`;

const DRIVER = `pragma solidcash >=0.8.0;
interface IProxiedLedger { function tick() external; }
contract LedgerDriver() {
  function poke(address ledger) public { IProxiedLedger(ledger).tick(); require(true); }
}`;

const KEY = 5n;
// > 60 bytes: the proxy keeps the value in value chunks.
const VALUE = new Uint8Array(96).fill(0xab);
// The route pin's second pass: pop each parked index until the -1 sentinel.
const PIN_PASS = /OP_BEGIN OP_FROMALTSTACK OP_DUP OP_1ADD OP_IF .* OP_1ADD OP_NOT OP_UNTIL/;
const VERIFIER_COMMITMENT_DOMAIN = '4c335631';

type Artifact = ReturnType<typeof compileString>;

/** The disassembled body of the artifact's message-bus route. */
function routeBody(artifact: Artifact): string {
  const route = artifact.messageBus!.route;
  return disassembleBytecodeBch(hexToBin(artifact.functionBodies![route.selector!]!));
}

/** `size 0 <` picks the compile-time block for a standalone run, then the window test. */
function windowChoice(blockSize: number): string {
  const push = disassembleBytecodeBch(encodeDataPush(bigIntToVmNumber(BigInt(blockSize))));
  return `OP_0 OP_LESSTHAN OP_IF OP_DROP ${push} OP_ENDIF OP_ADD OP_WITHIN`;
}

const vmRefusals = (builder: TransactionBuilder): number[] => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.flatMap((_input, inputIndex) => (vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) === true ? [] : [inputIndex]));
};

describe('C3: a message-bus route on a proxy\'s block pins the proxy records outside its window', () => {
  it('carries the record pin on the delegate route, its window picked from the verifier index', () => {
    const plain = compileString(LEDGER, KERNEL);
    const delegate = plain.delegateArtifact;
    expect(delegate, 'the ledger has a delegate variant').toBeDefined();
    const names = delegate!.messageBus!.route.inputs.map((input) => input.name);
    // A bound route on the proxy's block that is not a graph route: it takes its physical size and no claim flags.
    expect(names).toEqual(expect.arrayContaining([
      '__internal__participantBlockSize', '__internal__activeVerifierIndex', '__internal__proxyMasterIndex',
    ]));
    expect(names.some((name) => name.startsWith('__internal__graph')), 'not a graph route').toBe(false);
    const blockSize = delegate!.messageBus!.route.blockLayout!.blockSize;
    const proxied = routeBody(delegate!);
    const own = routeBody(plain);
    console.log('proxy route pin bytes', JSON.stringify({
      blockSize,
      plain: plain.debug!.bytecode.length / 2,
      delegate: delegate!.debug!.bytecode.length / 2,
      plainRoute: plain.functionBodies![plain.messageBus!.route.selector!]!.length / 2,
      delegateRoute: delegate!.functionBodies![delegate!.messageBus!.route.selector!]!.length / 2,
    }));
    // The non-proxy route pins through its claim flags; the delegate route now runs the same park-and-pin passes,
    // its window `__internal__participantBlockSize` once the verifier ran, else the compile-time block.
    expect(own, 'the non-proxy route carries the record pin').toMatch(PIN_PASS);
    expect(proxied, 'the delegate route carries the record pin').toMatch(PIN_PASS);
    expect(proxied, 'the delegate route picks its window from the verifier index').toContain(windowChoice(blockSize));
    expect(own, 'the non-proxy route claims instead').not.toContain(windowChoice(blockSize));
  }, 300_000);

  it('settles a compose through the delegate route beside a long value the proxy keeps in value chunks', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6c), provider);
    for (let index = 0; index < 40; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
      });
    }
    const ledgerArtifact = compileString(LEDGER, KERNEL);
    expect(ledgerArtifact.delegateArtifact?.messageBus?.handlers.find((handler) => handler.name === 'tick'))
      .toMatchObject({ eligible: true });
    const deployed = await upgrades.deployProxy(
      getContractFactory(ledgerArtifact, signer), { count: 0n }, { initializer: false },
    );
    // The direct delegate path writes the long value: an entry and its value chunks at the proxy's lock.
    await deployed.forward('put', [KEY, VALUE]).send();
    const [seeded] = await deployed.proxy.getEntries('side');
    expect(binToHex(seeded?.value as Uint8Array)).toBe(binToHex(VALUE));

    const driverArtifact = compileString(DRIVER, KERNEL);
    const driverBase = new Contract(driverArtifact, [], { provider });
    const driverSetup = await setupStatefulUtxos(
      provider, driverBase, driverArtifact.stateLayout!, {}, { saltContract: true },
    );
    const driver = StatefulContract.withCategory(
      driverBase.withCategory(hexToBin(driverSetup.categoryId)), driverSetup.categoryId,
    );
    driver._registerResolvedExternal('IProxiedLedger', deployed.proxy);
    const callsite = driverArtifact.abi.find((entry) => entry.name === 'poke')
      ?.externalCalls?.find((call) => call.functionName === 'tick');
    expect(callsite?.callsiteId).toBeDefined();

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: driver,
        functionName: 'poke',
        args: [deployed.proxy.inner.lockingBytecode],
      }, {
        contract: deployed.proxy,
        functionName: 'tick',
        args: [],
        callsiteId: callsite!.callsiteId,
        executionArtifact: deployed.implementation.inner.artifact,
        executor: deployed.implementation,
      }],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();

    // The implementation runs the delegate route against the proxy master's block, with the proxy's verifier.
    const executor = builder.inputs.findIndex((input) => isContractUnlocker(input.unlocker)
      && input.unlocker.contract.address === deployed.implementation.inner.address);
    const executorUnlocker = builder.inputs[executor]?.unlocker;
    expect(executorUnlocker && isContractUnlocker(executorUnlocker) && executorUnlocker.abiFunction.name)
      .toBe('__message_bus1');
    const master = builder.inputs.findIndex((input) => isContractUnlocker(input.unlocker)
      && input.unlocker.contract.address === deployed.proxy.inner.address
      && input.unlocker.abiFunction.name === '__forward');
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const proxyCategory = binToHex(sourceOutputs[master]!.token!.category);
    const proxyMutables = sourceOutputs.flatMap((output, index) => (output.token?.nft?.capability === 'mutable'
      && binToHex(output.token.category) === proxyCategory ? [index] : []));
    const verifier = proxyMutables.find((index) => binToHex(sourceOutputs[index]!.token!.nft!.commitment)
      .startsWith(VERIFIER_COMMITMENT_DOMAIN));
    console.log('proxy route compose geometry', JSON.stringify({
      master, executor, verifier, proxyMutables, inputs: builder.inputs.length,
      blockSize: deployed.implementation.inner.artifact.messageBus!.route.blockLayout!.blockSize,
    }));
    // The binder ran (index >= 0): it requires this verifier, so the route skips it by index and takes its window
    // from `__internal__participantBlockSize`.
    expect(verifier, 'the proxy\'s route verifier is co-spent').toBeDefined();
    expect(vmRefusals(builder), 'every input accepts the honest compose').toEqual([]);

    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect((await deployed.proxy.getState()).count).toBe(1n);
    const [kept] = await deployed.proxy.getEntries('side');
    expect(binToHex(kept?.value as Uint8Array), 'the long value is untouched').toBe(binToHex(VALUE));
  }, 600_000);
});
