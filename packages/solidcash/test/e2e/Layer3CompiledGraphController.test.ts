import {
  bigIntToVmNumber, binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin, sha256, utf8ToBin,
} from '@bitauth/libauth';
import { buildInitialStateCommitments, scriptToBytecode } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  Contract, SignatureAlgorithm, SignatureTemplate, StatefulContract, TransactionBuilder,
  encodeFunctionArgument, layer3,
} from '../../src/index.js';
import type { FunctionArgument } from '../../src/Argument.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import {
  alicePkh, alicePriv, alicePub, bobPriv, bobPub, carolPub,
} from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import {
  createDataNftUnlocker, createEntryNftUnlocker, createSatoshiContainerUnlocker,
  createReadOnlyDynamicChunkUnlocker, getDataNftAddress, getDynamicChunkAddress,
  getEntryNftAddress, getEventNftAddress, getSatoshiContainerAddress,
} from '../../src/stateful/covenant-helpers.js';
import {
  bytesToSlotValue, decodeEntryCommitment, encodeEntryCommitment, keyToSlot, keyToSlotMulti,
} from '../../src/stateful/SortedList.js';

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
/**
 * X144. THE BYTE RULES ARE ASSERTED HERE OR NOWHERE.
 *
 * Every fixture in this file hands `raw()` straight to `provider.sendRawTransaction`, which is BELOW all eight
 * SDK broadcast sites, so no gate in the SDK can ever see these transactions. Two of them settled a 5- and a
 * 100-satoshi output to a one-byte `OP_1` script against a 474-satoshi dust floor (`3 * (10 + 148)`). The mock
 * accepted both because it runs `enforceDust: false` with `dustRelayFeePerKb: 0n`; a real node refuses the
 * whole transaction `64: dust` before it looks up an input, which is exactly what BCHN did to C1 (X60).
 *
 * A composition asserted to SETTLE has to be one a peer would forward, so the honest cases assert it. The
 * hostile variants deliberately do not: what they measure is a covenant refusal, and whether the attacked
 * shape would also have relayed is not part of that claim.
 */
const expectRelayable = (transaction: string): void => {
  layer3.assertFinalizedTransactionBytes(decodeTransactionUnsafe(hexToBin(transaction)));
};
// BCH consensus input-script limit, and the margin the caller-authorized ERC-20 settlement must keep under it.
const MAXIMUM_INPUT_BYTES = 10_000;
const INPUT_HEADROOM_BYTES = 1_000;
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const GRAPH_DERIVED_ROUTE_INPUTS = new Set([
  'batchBlob',
  '__internal__graphTranscript',
  '__internal__graphControllerIdx',
  '__internal__graphParticipantOffset',
  '__internal__graphBlockSize',
  '__internal__graphEmissions',
  '__internal__graphCallers',
  '__internal__graphSettlementBoundary',
  '__internal__graphCompletionPositions',
  '__internal__graphSettlementTable',
  '__internal__returnOutputIdx',
]);

/** Bind fixture-authored compiler witnesses by the published route ABI, never by a guessed argument offset. */
const graphRouteArgsWithInternalTail = (
  transcript: Parameters<typeof layer3.compiledGraphRouteArgs>[0],
  participant: number,
  controllerInput: number,
  values: readonly FunctionArgument[],
): FunctionArgument[] => {
  const execution = transcript.plan.participants[participant];
  if (!execution) throw new Error(`test fixture: graph participant ${participant} is absent`);
  const names = execution.routeInputs
    .filter((input) => input.name.startsWith('__internal__')
      && !GRAPH_DERIVED_ROUTE_INPUTS.has(input.name))
    .map((input) => input.name);
  if (names.length !== values.length) {
    throw new Error(`test fixture: ${execution.lockingBytecode} publishes ${names.length} internal witnesses, `
      + `but the physical layout supplied ${values.length}`);
  }
  return [...layer3.compiledGraphRouteArgs(
    transcript, participant, controllerInput, Object.fromEntries(names.map((name, index) => [name, values[index]])),
  )];
};

const replaceGraphRouteArg = (
  transcript: Parameters<typeof layer3.compiledGraphRouteArgs>[0],
  participant: number,
  args: FunctionArgument[],
  inputName: string,
  value: FunctionArgument,
): void => {
  const routeInputs = transcript.plan.participants[participant]?.routeInputs
    .filter((input) => input.name !== '__internal__returnOutputIdx') ?? [];
  const index = routeInputs.findIndex((input) => input.name === inputName);
  if (index < 0) throw new Error(`test fixture: route input '${inputName}' is absent`);
  args[index] = value;
};
const APP = (name: string) => `pragma solidcash >=0.8.0;
contract ${name}(int brand) {
  function ping(int n) public { require(n >= 0); }
  function authenticated(address expected) public { require(msg.sender == expected); }
  function inspectData(int n) public { require(msg.data == abi.encodeWithSelector(msg.sig, n)); }
  function viewPing() public pure { require(true); }
}`;
const CALLING_APP = `pragma solidcash >=0.8.0;
interface ICompiledGraphTarget {
  function ping(int n);
  function authenticated(address expected);
  function inspectData(int n);
  function viewPing();
}
contract CompiledGraphA(int brand, address target) {
  function start(int first, int second) public {
    require(first >= 0 && second >= 0);
    ICompiledGraphTarget(target).ping(first);
    ICompiledGraphTarget(target).ping(second);
    require(true);
  }
  function maybe(address next, int alwaysN, int n, bool take) public {
    ICompiledGraphTarget(next).ping(alwaysN);
    if (take) {
      ICompiledGraphTarget(next).ping(n);
    }
    require(n >= 0);
  }
  function repeat(address next, int n, int times) public {
    require(times <= 2);
    for (int i = 0; i < times; i = i + 1) {
      ICompiledGraphTarget(next).ping(n);
    }
    require(times >= 0);
  }
  function transform(address next, int n) public {
    ICompiledGraphTarget(next).ping(n + 1);
    require(n >= 0);
  }
  function authenticate(address next, address expected) public {
    ICompiledGraphTarget(next).authenticated(expected);
    require(true);
  }
  function forwardCalldata(address next, int n) public {
    ICompiledGraphTarget(next).inspectData(n);
    require(true);
  }
  function forwardStatic(address next) public {
    ICompiledGraphTarget(next).viewPing.staticcall();
    require(true);
  }
}`;
const RECURSIVE_TARGET = `pragma solidcash >=0.8.0;
interface IRecursiveTarget { function again(address self, bool take); }
contract RecursiveTarget(int brand) {
  function again(address self, bool take) public {
    if (take) { IRecursiveTarget(self).again(self, false); }
    require(self.length > 0);
  }
}`;
const RECURSIVE_ROOT = `pragma solidcash >=0.8.0;
interface IRecursiveTarget { function again(address self, bool take); }
contract RecursiveRoot(int brand, address target) {
  function start(address self) public {
    IRecursiveTarget(target).again(self, true);
    require(self.length > 0);
  }
}`;
const RETURNING_B = `pragma solidcash >=0.8.0;
contract CompiledReturningB(int brand) {
  function twice(int n) public pure returns (int, int) {
    require(n >= 0);
    return (n * 2, n + 10);
  }
}`;
const RETURNING_A = `pragma solidcash >=0.8.0;
interface IReturningB { function twice(int n) returns (int, int); }
contract CompiledReturningA(int brand, address target) {
  function plusOne(int n) public pure returns (int) {
    int child, int witness = IReturningB(target).twice(n);
    require(child >= 0 && witness == n + 10);
    return child + 1;
  }
}`;
const DYNAMIC_RETURNING_B = `pragma solidcash >=0.8.0;
contract CompiledDynamicReturningB(int brand) {
  function append(bytes value) public pure returns (bytes) {
    require(value.length > 0);
    return bytes.concat(value, hex"ff");
  }
}`;
const DYNAMIC_RETURNING_A = `pragma solidcash >=0.8.0;
interface IDynamicReturningB { function append(bytes value) returns (bytes); }
contract CompiledDynamicReturningA(int brand, address target) {
  function forward(bytes value) public pure returns (bytes) {
    bytes child = IDynamicReturningB(target).append(value);
    require(child.length == value.length + 1);
    return child;
  }
}`;
const STRING_RETURNING_B = `pragma solidcash >=0.8.0;
contract CompiledStringReturningB(int brand) {
  function append(string value) public pure returns (string) {
    require(value.length > 0);
    return string.concat(value, "!");
  }
}`;
const STRING_RETURNING_A = `pragma solidcash >=0.8.0;
interface IStringReturningB { function append(string value) returns (string); }
contract CompiledStringReturningA(int brand, address target) {
  function forward(string value) public pure returns (string) {
    string child = IStringReturningB(target).append(value);
    require(child.length == value.length + 1);
    return child;
  }
}`;
const STRUCT_RETURNING_B = `pragma solidcash >=0.8.0;
struct PairResult { int n; bool ok; }
contract CompiledStructReturningB(int brand) {
  function make(int value) public pure returns (PairResult) {
    require(value >= 0);
    return PairResult(value + 1, true);
  }
}`;
const STRUCT_RETURNING_A = `pragma solidcash >=0.8.0;
struct PairResult { int n; bool ok; }
interface IStructReturningB { function make(int value) returns (PairResult); }
contract CompiledStructReturningA(int brand, address target) {
  function forward(int value) public pure returns (PairResult) {
    PairResult child = IStructReturningB(target).make(value);
    require(child.n == value + 1 && child.ok);
    return child;
  }
}`;
const STATE_A = `pragma solidcash >=0.8.0;
interface IStateB {
  public int count;
  function step(address callback, int n);
}
contract CompiledStateA(int brand, address next, address middle) {
  int count;
  function start(address callback, int n) public {
    this.count = this.count + n;
    require(n >= 0);
    IStateB(next).step(callback, n);
    int settledB = IStateB(next).outState.count;
    require(settledB == n && next.length > 0);
  }
  function finish(address callback, int n) public {
    this.count = this.count + n;
    require(callback.length > 0 && n >= 0);
  }
}`;
const STATE_B = `pragma solidcash >=0.8.0;
interface IStateC { function relay(address callback, int n); }
contract CompiledStateB(int brand, address middle) {
  int count;
  function step(address callback, int n) public {
    this.count = this.count + n;
    require(n >= 0);
    IStateC(middle).relay(callback, n);
    require(true);
  }
}`;
const STATE_C = `pragma solidcash >=0.8.0;
interface IStateA { function finish(address callback, int n); }
contract CompiledStateC(int brand) {
  int count;
  function relay(address callback, int n) public {
    this.count = this.count + n;
    IStateA(callback).finish(callback, n);
    require(n >= 0);
  }
}`;
const POINTER_CALLER = `pragma solidcash >=0.8.0;
contract CompiledPointerCaller(int brand) {
  function fire(function(uint) external handler, uint value) public {
    handler(value);
    require(value >= 0);
  }
}`;
const POINTER_TARGET = `pragma solidcash >=0.8.0;
contract CompiledPointerTarget(int brand) {
  function inc(uint value) public pure { require(value > 0); }
  function dec(uint value) public pure { require(value > 0); }
}`;
const RETURNED_POINTER_CALLER = `pragma solidcash >=0.8.0;
interface IReturnedPointerTarget { function inc(uint value); function dec(uint value); }
contract CompiledReturnedPointerCaller(int brand) {
  function choose(address target) internal returns (function(uint) external) {
    return IReturnedPointerTarget(target).dec;
  }
  function fire(address target, uint value) public {
    function(uint) external handler = choose(target);
    handler(value);
    require(value >= 0);
  }
}`;
const VARYING_SELECTOR_TABLE = `pragma solidcash >=0.8.0;
interface IVaryingHandler { function inc(uint value); function dec(uint value); }
contract CompiledVaryingSelectorTable() {
  function(uint) external[] handlers;
  function registerInc(address target) public { this.handlers.push(IVaryingHandler(target).inc); require(true); }
  function registerDec(address target) public { this.handlers.push(IVaryingHandler(target).dec); require(true); }
  function fireAll(uint value) public {
    for (int i = 0; i < 2; i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }
}`;
const COMBINED_A = `pragma solidcash >=0.8.0;
interface ICombinedB { function step(address callback, bytes recipient, bigint amount); }
contract CombinedA() {
  bigint count;
  event Seen(bigint amount);
  function start(address peer, address callback, bytes recipient, bigint amount) public {
    this.count = this.count + amount;
    emit Seen(amount);
    this.transfer(recipient, amount);
    ICombinedB(peer).step(callback, recipient, amount);
    require(true);
  }
  function finish(address callback, bytes recipient, bigint amount) public {
    this.count = this.count + amount;
    emit Seen(amount);
    require(callback.length > 0 && recipient.length > 0);
  }
}`;
const COMBINED_B = `pragma solidcash >=0.8.0;
interface ICombinedA { function finish(address callback, bytes recipient, bigint amount); }
contract CombinedB() {
  bigint count;
  event Stepped(bigint amount);
  function step(address callback, bytes recipient, bigint amount) public {
    this.count = this.count + amount;
    emit Stepped(amount);
    ICombinedA(callback).finish(callback, recipient, amount);
    require(true);
  }
}`;
const INTROSPECTION_APP = `pragma solidcash >=0.8.0;
contract GraphIntrospection() {
  function inspect(bytes self, bytes32 category, bytes32 outpointHash, bytes feeLock) public {
    require(tx.version == 2 && tx.locktime == 0);
    require(tx.inputs.length == 4 && tx.outputs.length == 4);
    require(tx.inputs[0].value == 10000);
    require(tx.inputs[0].lockingBytecode == self);
    require(tx.inputs[0].unlockingBytecode.slice(0, 5) == hex"0453434231");
    require(tx.inputs[0].outpointTransactionHash == outpointHash);
    require(tx.inputs[0].outpointIndex == 0);
    require(tx.inputs[0].sequenceNumber == 4294967294);
    require(tx.inputs[0].tokenCategory.slice(0, 32) == category);
    require(tx.inputs[0].nftCommitment.length == 0 && tx.inputs[0].tokenAmount == 0);
    require(tx.inputs[3].lockingBytecode == feeLock);
    require(tx.outputs[0].value == 10000 && tx.outputs[0].lockingBytecode == self);
    require(tx.outputs[0].tokenCategory.slice(0, 32) == category);
    require(tx.outputs[0].nftCommitment.length == 0 && tx.outputs[0].tokenAmount == 0);
  }
}`;
const SIGNED_APP = `pragma solidcash >=0.8.0;
contract GraphSigned() {
  function signed(sig authorization, pubkey owner) public {
    require(checkSig(authorization, owner));
  }
}`;
const MULTISIG_APP = `pragma solidcash >=0.8.0;
contract GraphMultiSigned() {
  function signed2of3(
    sig first, sig second, pubkey one, pubkey two, pubkey three
  ) public {
    require(checkMultiSig([first, second], [one, two, three]));
  }
}`;
const SIGNATURE_ARRAY_APP = `pragma solidcash >=0.8.0;
contract GraphSignatureArray() {
  function signedMany(sig[] authorizations, pubkey[] owners) public {
    require(checkMultiSig(authorizations, owners));
  }
}`;
const FORWARDED_SIGNED_CALLER = `pragma solidcash >=0.8.0;
interface IGraphSigned {
  function signed(sig authorization, pubkey owner);
}
contract GraphSignedCaller() {
  function forward(address target, sig authorization, pubkey owner) public {
    IGraphSigned(target).signed(authorization, owner);
    require(true);
  }
}`;
const RAW_CALLER = `pragma solidcash >=0.8.0;
contract GraphRawCaller() {
  function run(address target, bytes payload) public {
    (bool ok, bytes result) = target.call(payload);
    require(ok && result == hex"53");
  }
}`;
const RAW_STATIC_CALLER = RAW_CALLER
  .replace('GraphRawCaller', 'GraphRawStaticCaller')
  .replace('.call(payload)', '.staticcall(payload)');
const RAW_TARGET = `pragma solidcash >=0.8.0;
contract GraphRawTarget() {
  function echo(int value) public returns (int) {
    require(value >= 0);
    return value;
  }
}`;
const GRAPH_DELEGATE_PROXY = `pragma solidcash >=0.8.0;
contract GraphDelegateProxy(address impl) {
  bigint counter;
  function run(bytes input) public {
    impl.delegatecall(input);
    require(input.length > 0);
  }
}`;
const GRAPH_DELEGATE_IMPL = `pragma solidcash >=0.8.0;
contract GraphDelegateImpl() {
  bigint counter;
  function ping() delegate {
    this.counter = this.counter + 1;
    require(true);
  }
  function pong() delegate {
    this.counter = this.counter + 2;
    require(true);
  }
}`;
const GRAPH_DELEGATE_CALLER = `pragma solidcash >=0.8.0;
interface IGraphDelegateProxy { function run(bytes input); }
contract GraphDelegateCaller(address target) {
  function start(bytes input) public {
    IGraphDelegateProxy(target).run(input);
    require(true);
  }
}`;

async function createGraphAuthority(provider: ReturnType<typeof createTestProvider>) {
  const projection = new Contract(compileString(layer3.generateGraphProjectionVerifier()), [], { provider });
  const controller = new Contract(
    compileString(layer3.generateGraphRootController(projection.lockingBytecode)), [alicePkh], { provider },
  );
  const genesis = await (provider as any).addTokenUtxosDynamic((_category: string) => [{
    address: controller.tokenAddress,
    satoshis: 3000n,
    token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } },
  }]);
  return {
    projection, controller, categoryId: genesis.categoryId as string, genesisUtxo: genesis.utxos[0],
  };
}

async function initializeGraphAuthority(
  provider: ReturnType<typeof createTestProvider>,
  controller: Contract,
  genesisUtxo: any,
  categoryId: string,
  root: string,
  p2pkh: Contract,
) {
  const fee = randomUtxo({ satoshis: 20_000n });
  await provider.addUtxo(p2pkh.address, fee);
  const tx = new TransactionBuilder({ provider });
  tx.addInput(genesisUtxo, controller.unlock.initialize(hexToBin(root), alicePub, signature()));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: controller.tokenAddress, amount: genesisUtxo.satoshis,
    token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: root } },
  });
  tx.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(tx));
  const rooted = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === root);
  if (!rooted) throw new Error('graph controller initialization did not create the rooted authority');
  return rooted;
}

async function build(
  tamperSecondBatch = false,
  omitController = false,
  malformedGraph = false,
  replaceProjection = false,
  aliasProjection = false,
  forgeControllerCategory = false,
  sourceChildArg = 1n,
  conditional?: { take: boolean; includeChild: boolean },
  loopCount?: number,
  senderAuth?: { forgeExpected: boolean },
  dataAuth = false,
  staticAuth = false,
  tamperBlockSize = false,
  transformedChildArg?: bigint,
  oversizedParticipantCount = false,
  mixedStatic = false,
  boundedRecursive: 'none' | 'honest' | 'forged-row' = 'none',
) {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  const artifactB = compileString(
    boundedRecursive === 'none' ? APP('CompiledGraphB') : RECURSIVE_TARGET, options,
  );
  const baseB = new Contract(artifactB, [2n], { provider });
  const setupB = await setupStatefulUtxos(provider, baseB, artifactB.stateLayout!, {});
  const b = baseB.withCategory(hexToBin(setupB.categoryId));
  const callerSource = boundedRecursive !== 'none' ? RECURSIVE_ROOT : mixedStatic
    ? CALLING_APP.replace('ICompiledGraphTarget(target).ping(first);',
      'ICompiledGraphTarget(target).viewPing.staticcall();')
    : CALLING_APP;
  const artifactA = compileString(callerSource, options);
  const baseA = new Contract(artifactA, [1n, b.lockingBytecode], { provider });
  const setupA = await setupStatefulUtxos(provider, baseA, artifactA.stateLayout!, {});
  const a = baseA.withCategory(hexToBin(setupA.categoryId));
  const graphInvocations = boundedRecursive !== 'none' ? [
    { parent: null, callee: 0, function: 'start', args: [b.lockingBytecode] },
    { parent: 0, callee: 1, function: 'again', args: [b.lockingBytecode, true] },
    { parent: 1, callee: 1, function: 'again', args: [b.lockingBytecode, false] },
  ] : transformedChildArg !== undefined ? [
    { parent: null, callee: 0, function: 'transform', args: [b.lockingBytecode, 6n] },
    { parent: 0, callee: 1, function: 'ping', args: [transformedChildArg] },
  ] : staticAuth ? [
    { parent: null, callee: 0, function: 'forwardStatic', args: [b.lockingBytecode] },
    { parent: 0, callee: 1, function: 'viewPing', args: [], callMode: 'staticcall' as const },
  ] : dataAuth ? [
    { parent: null, callee: 0, function: 'forwardCalldata', args: [b.lockingBytecode, 7n] },
    { parent: 0, callee: 1, function: 'inspectData', args: [7n] },
  ] : senderAuth ? [
    {
      parent: null, callee: 0, function: 'authenticate',
      args: [b.lockingBytecode, senderAuth.forgeExpected ? b.lockingBytecode : a.lockingBytecode],
    },
    {
      parent: 0, callee: 1, function: 'authenticated',
      args: [senderAuth.forgeExpected ? b.lockingBytecode : a.lockingBytecode],
    },
  ] : loopCount !== undefined ? [
    { parent: null, callee: 0, function: 'repeat', args: [b.lockingBytecode, 7n, BigInt(loopCount)] },
    ...Array.from({ length: loopCount }, () =>
      ({ parent: 0, callee: 1, function: 'ping', args: [7n] })),
  ] : conditional ? [
    {
      parent: null, callee: 0, function: 'maybe',
      args: [b.lockingBytecode, 0n, 3n, conditional.take],
    },
    { parent: 0, callee: 1, function: 'ping', args: [0n] },
    ...(conditional.includeChild
      ? [{ parent: 0, callee: 1, function: 'ping', args: [3n] }] : []),
  ] : [
    { parent: null, callee: 0, function: 'start', args: [1n, 2n] },
    { parent: 0, callee: 1, function: mixedStatic ? 'viewPing' : 'ping',
      args: mixedStatic ? [] : [sourceChildArg],
      ...(mixedStatic && { callMode: 'staticcall' as const }) },
    { parent: 0, callee: 1, function: 'ping', args: [2n],
      ...(mixedStatic && { callMode: 'call' as const }) },
  ];
  const participants = [
    { artifact: artifactA, lockingBytecode: a.lockingBytecode },
    { artifact: artifactB, lockingBytecode: b.lockingBytecode },
  ] as const;
  const plan = boundedRecursive !== 'none'
    ? layer3.deriveCompiledGraphPlan({
      root: participants[0], function: 'start', args: [b.lockingBytecode],
      targets: { IRecursiveTarget: participants[1] },
      target: () => participants[1],
      occurrence: ({ invocation }) => invocation === 1 ? 1 : 0,
    })
    : layer3.planCompiledGraph(participants, graphInvocations);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  let transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, ['', ''], layout.projectionInputs,
  );
  if (malformedGraph || aliasProjection || tamperBlockSize || oversizedParticipantCount
    || boundedRecursive === 'forged-row') {
    const bytes = transcript.bytes.slice();
    if (oversizedParticipantCount) bytes[9] = 9;
    if (tamperBlockSize) bytes[12] += 1;
    let cursor = 10;
    for (const participant of plan.participants) {
      cursor += 4; // participant input + compiler-bound block size
      const lbcLength = bytes[cursor] | (bytes[cursor + 1] << 8);
      cursor += 2 + lbcLength;
      const batchLength = bytes[cursor] | (bytes[cursor + 1] << 8);
      cursor += 2 + batchLength;
      const emissionsLength = bytes[cursor] | (bytes[cursor + 1] << 8);
      cursor += 2 + emissionsLength;
      const callersLength = bytes[cursor] | (bytes[cursor + 1] << 8);
      cursor += 2 + callersLength;
      cursor += 2; // settlement boundary
      const completionPositionsLength = bytes[cursor] | (bytes[cursor + 1] << 8);
      cursor += 2 + completionPositionsLength;
      cursor += 32; // graph-global settlement-table commitment
      cursor += 3; // execution kind + executor input
      const executorLbcLength = bytes[cursor] | (bytes[cursor + 1] << 8);
      cursor += 2 + executorLbcLength;
      cursor += 2; // return output
      const resultVectorLength = bytes[cursor] | (bytes[cursor + 1] << 8);
      cursor += 2 + resultVectorLength;
      if (aliasProjection && participant.participant === 1) {
        bytes[cursor] = layout.projectionInputs[0] & 0xff;
        bytes[cursor + 1] = layout.projectionInputs[0] >> 8;
      }
      cursor += 2; // projection input
    }
    const settlementTableLength = bytes[cursor] | (bytes[cursor + 1] << 8);
    cursor += 2 + settlementTableLength;
    if (malformedGraph) {
      cursor += 2; // invocation count
      bytes[cursor + 4] = 1; // root invocation depth must be zero
    }
    if (boundedRecursive === 'forged-row') {
      const u16 = (at: number) => bytes[at] | (bytes[at + 1] << 8);
      cursor += 2; // invocation count
      for (let row = 0; row < 2; row += 1) {
        cursor += 12;
        cursor += 2 + u16(cursor);
        cursor += 2 + u16(cursor);
      }
      bytes[cursor] = 0; // forge the recursive row's parent from invocation 1 to invocation 0
      bytes[cursor + 1] = 0;
    }
    transcript = {
      ...transcript,
      bytes,
      root: binToHex(sha256.hash(bytes)),
    };
  }
  const aUtxo = setupA.masterUtxo;
  const bUtxo = setupB.masterUtxo;
  const feeUtxo = randomUtxo({ satoshis: 50000n });
  const projectionA = randomUtxo({ satoshis: 1000n });
  const projectionB = randomUtxo({ satoshis: 1000n });
  const fakeProjection = randomUtxo({ satoshis: 1000n });
  const fakeControllerUtxo = randomUtxo({ satoshis: 3000n });
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const forgedController = forgeControllerCategory
    ? (await (provider as any).addTokenUtxosDynamic((_category: string) => [{
      address: controller.tokenAddress,
      satoshis: 3000n,
      token: { amount: 0n, nft: { capability: 'mutable', commitment: transcript.root } },
    }])).utxos[0]
    : undefined;
  await provider.addUtxo(p2pkh.address, feeUtxo);
  await provider.addUtxo(projection.address, projectionA);
  await provider.addUtxo(projection.address, projectionB);
  if (replaceProjection) await provider.addUtxo(p2pkh.address, fakeProjection);
  if (omitController) await provider.addUtxo(p2pkh.address, fakeControllerUtxo);

  const routeA = a.createCompilerRouteUnlocker(
    artifactA.hiddenBatch!.route, hexToBin(artifactA.hiddenBatch!.selector),
  );
  const routeB = b.createCompilerRouteUnlocker(
    artifactB.hiddenBatch!.route, hexToBin(artifactB.hiddenBatch!.selector),
  );
  const bBlob = tamperSecondBatch
    ? layer3.encodeHiddenBatch(artifactB, [{ function: 'ping', args: [3n] }]).blob
    : plan.participants[1].batch.blob;

  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  const argsA = layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput);
  const argsB = [...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput)];
  if (tamperSecondBatch) argsB[0] = bBlob;
  tx.addInput(aUtxo, routeA(...argsA as any));
  tx.addInput(bUtxo, routeB(...argsB as any));
  if (replaceProjection) {
    tx.addInput(fakeProjection, p2pkh.unlock.spend(alicePub, signature()));
  } else {
    tx.addInput(projectionA, projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 0n));
  }
  tx.addInput(
    projectionB,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 1n),
  );
  if (omitController) {
    tx.addInput(fakeControllerUtxo, p2pkh.unlock.spend(alicePub, signature()));
  } else {
    tx.addInput(
      forgedController ?? rootedController,
      controller.unlock.attest(transcript.bytes),
    );
  }
  tx.addInput(feeUtxo, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: a.tokenAddress, amount: aUtxo.satoshis,
    token: { category: setupA.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: b.tokenAddress, amount: bUtxo.satoshis,
    token: { category: setupB.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10000n });
  return { provider, transaction: raw(tx), builder: tx, transcript };
}

const buildBoundedRecursiveGraph = (mode: 'honest' | 'forged-row') => build(
  false, false, false, false, false, false, 1n, undefined, undefined, undefined,
  false, false, false, undefined, false, false, mode,
);

async function buildPointerGraph(
  tamper: 'none' | 'selector' | 'target' = 'none',
  returned = false,
) {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
    solidityImportCompat: true,
  };
  const artifactB = compileString(POINTER_TARGET, options);
  const baseB = new Contract(artifactB, [2n], { provider });
  const setupB = await setupStatefulUtxos(provider, baseB, artifactB.stateLayout!, {});
  const b = baseB.withCategory(hexToBin(setupB.categoryId));
  const artifactA = compileString(returned ? RETURNED_POINTER_CALLER : POINTER_CALLER, options);
  const baseA = new Contract(artifactA, [1n], { provider });
  const setupA = await setupStatefulUtxos(provider, baseA, artifactA.stateLayout!, {});
  const a = baseA.withCategory(hexToBin(setupA.categoryId));
  const decSelector = artifactB.abi.find((fn) => fn.name === 'dec')!.selector!;
  const incSelector = artifactB.abi.find((fn) => fn.name === 'inc')!.selector!;
  const pointerTarget = tamper === 'target' ? hexToBin(`aa20${'44'.repeat(32)}87`) : b.lockingBytecode;
  const pointerSelector = hexToBin(tamper === 'selector' ? incSelector : decSelector);
  const participantA = {
    artifact: artifactA, lockingBytecode: a.lockingBytecode, constructorArgs: [1n],
  };
  const participantB = {
    artifact: artifactB, lockingBytecode: b.lockingBytecode, constructorArgs: [2n],
  };
  const plan = returned
    ? (tamper !== 'none'
      ? layer3.planCompiledGraph([participantA, participantB], [
        { parent: null, callee: 0, function: 'fire', args: [pointerTarget, 4n] },
        { parent: 0, callee: 1, function: 'inc', args: [4n] },
      ])
      : layer3.deriveCompiledGraphPlan({
        root: participantA,
        function: 'fire',
        args: [pointerTarget, 4n],
        targets: { IReturnedPointerTarget: participantB },
      }))
    : layer3.deriveCompiledGraphPlan({
      root: participantA,
      function: 'fire',
      args: [pointerTarget, pointerSelector, 4n],
      targets: {},
      dynamicCall: () => ({ participant: participantB, function: 'dec' }),
    });
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, ['', ''], layout.projectionInputs,
  );
  const feeUtxo = randomUtxo({ satoshis: 50_000n });
  const projectionA = randomUtxo({ satoshis: 1000n });
  const projectionB = randomUtxo({ satoshis: 1000n });
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  await provider.addUtxo(p2pkh.address, feeUtxo);
  await provider.addUtxo(projection.address, projectionA);
  await provider.addUtxo(projection.address, projectionB);
  const routeA = a.createCompilerRouteUnlocker(
    artifactA.hiddenBatch!.route, hexToBin(artifactA.hiddenBatch!.selector),
  );
  const routeB = b.createCompilerRouteUnlocker(
    artifactB.hiddenBatch!.route, hexToBin(artifactB.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(setupA.masterUtxo, routeA(
    ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any,
  ));
  tx.addInput(setupB.masterUtxo, routeB(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any,
  ));
  tx.addInput(
    projectionA,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 0n),
  );
  tx.addInput(
    projectionB,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 1n),
  );
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(feeUtxo, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: a.tokenAddress, amount: setupA.masterUtxo.satoshis,
    token: { category: setupA.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: b.tokenAddress, amount: setupB.masterUtxo.satoshis,
    token: { category: setupB.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10_000n });
  return { provider, transaction: raw(tx) };
}

async function buildVaryingSelectorGraph(
  tamper: 'none' | 'selector' | 'target' = 'none',
) {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  const handlerArtifact = compileString(POINTER_TARGET, options);
  const handlerSetups = await Promise.all([2n, 3n].map(async (brand) => {
    const base = new Contract(handlerArtifact, [brand], { provider });
    const setup = await setupStatefulUtxos(provider, base, handlerArtifact.stateLayout!, {});
    return { contract: base.withCategory(hexToBin(setup.categoryId)), setup, brand };
  }));
  const tableArtifact = compileString(VARYING_SELECTOR_TABLE, options);
  const tableBase = new Contract(tableArtifact, [], { provider });
  const tableSetup = await setupStatefulUtxos(
    provider, tableBase, tableArtifact.stateLayout!,
    { handlers: [], __fnsel_handlers: [] },
  );
  const table = tableBase.withCategory(hexToBin(tableSetup.categoryId));
  const tableStateful = StatefulContract.withCategory(tableBase, tableSetup.categoryId);
  await tableStateful.registerInc(handlerSetups[0].contract.lockingBytecode).send();
  await tableStateful.registerDec(
    tamper === 'target'
      ? hexToBin(`aa20${'44'.repeat(32)}87`)
      : handlerSetups[1].contract.lockingBytecode,
  ).send();
  const currentTable = await tableStateful.getFullState();
  if (!currentTable.masterUtxo || currentTable.dataNftUtxos.length !== 1) {
    throw new Error('varying-selector fixture did not materialize its current master/data state');
  }

  const participants = [
    { artifact: tableArtifact, lockingBytecode: table.lockingBytecode },
    ...handlerSetups.map(({ contract, brand }) => ({
      artifact: handlerArtifact, lockingBytecode: contract.lockingBytecode, constructorArgs: [brand],
    })),
  ];
  let dynamicCallIndex = 0;
  const plan = layer3.deriveCompiledGraphPlan({
    root: participants[0],
    function: 'fireAll',
    args: [4n],
    targets: {},
    occurrence: ({ kind }) => kind === 'loop' ? 2 : 0,
    dynamicCall: () => {
      const reached = dynamicCallIndex++;
      if (reached === 0) return { participant: participants[1], function: 'inc' };
      return {
        participant: participants[2],
        function: tamper === 'selector' ? 'inc' : 'dec',
      };
    },
  });
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, ['', '', ''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const projections = Array.from({ length: 3 }, () => randomUtxo({ satoshis: 1000n }));
  const fee = randomUtxo({ satoshis: 80_000n });
  for (const proof of projections) await provider.addUtxo(projection.address, proof);
  await provider.addUtxo(p2pkh.address, fee);

  const dynamicVariables = tableArtifact.stateLayout!.variables.filter((variable) => variable.dynamic);
  const chunks: { variable: typeof dynamicVariables[number]; utxo: any; address: string }[] = [];
  for (const variable of dynamicVariables) {
    const address = getDynamicChunkAddress(
      table, tableSetup.categoryId, variable.name, variable.type,
    );
    for (const utxo of await provider.getUtxos(address)) chunks.push({ variable, utxo, address });
  }
  expect(chunks.length).toBeGreaterThanOrEqual(2);
  const trailingCapacity = tableArtifact.hiddenBatch!.route.blockLayout!.trailingCapacity ?? 0;
  expect(chunks.length).toBeLessThanOrEqual(trailingCapacity);
  const trailingFunding = Array.from(
    { length: trailingCapacity - chunks.length },
    () => randomUtxo({ satoshis: 1000n }),
  );
  for (const funding of trailingFunding) await provider.addUtxo(p2pkh.address, funding);

  const tableRoute = table.createCompilerRouteUnlocker(
    tableArtifact.hiddenBatch!.route, hexToBin(tableArtifact.hiddenBatch!.selector),
  );
  const handlerRoutes = handlerSetups.map(({ contract }) => contract.createCompilerRouteUnlocker(
    handlerArtifact.hiddenBatch!.route, hexToBin(handlerArtifact.hiddenBatch!.selector),
  ));
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    currentTable.masterUtxo,
    tableRoute(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(
    currentTable.dataNftUtxos[0],
    createDataNftUnlocker(table, layout.participantInputs[0], tableSetup.categoryId),
  );
  for (const { variable, utxo } of chunks) {
    tx.addInput(
      utxo,
      createReadOnlyDynamicChunkUnlocker(
        table, layout.participantInputs[0], tableSetup.categoryId, variable.name, variable.type,
      ),
    );
  }
  for (const funding of trailingFunding) {
    tx.addInput(funding, p2pkh.unlock.spend(alicePub, signature()));
  }
  handlerSetups.forEach(({ setup }, index) => tx.addInput(
    setup.masterUtxo,
    handlerRoutes[index](
      ...layer3.compiledGraphRouteArgs(transcript, index + 1, layout.controllerInput) as any,
    ),
  ));
  projections.forEach((proof, participant) => tx.addInput(
    proof,
    projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
    ),
  ));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  tx.addOutput({
    to: table.tokenAddress, amount: currentTable.masterUtxo.satoshis,
    token: currentTable.masterUtxo.token,
  });
  tx.addOutput({
    to: getDataNftAddress(table, tableSetup.categoryId),
    amount: currentTable.dataNftUtxos[0].satoshis,
    token: currentTable.dataNftUtxos[0].token,
  });
  for (const { address, utxo } of chunks) {
    tx.addOutput({ to: address, amount: utxo.satoshis, token: utxo.token });
  }
  for (const funding of trailingFunding) {
    tx.addOutput({ to: p2pkh.address, amount: funding.satoshis });
  }
  handlerSetups.forEach(({ contract, setup }) => tx.addOutput({
    to: contract.tokenAddress, amount: setup.masterUtxo.satoshis, token: setup.masterUtxo.token,
  }));
  for (let index = 0; index < projections.length + 1; index++) {
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
  }
  tx.addOutput({ to: p2pkh.address, amount: 10_000n });
  return { provider, transaction: raw(tx) };
}

async function buildCombinedGraph(
  tamper: 'none' | 'state' | 'event' | 'value' = 'none',
  variant: 'all' | 'no-transfer' | 'no-events' | 'no-state' | 'value-only' | 'same-value'
    | 'conditional-untaken' = 'all',
  staticInvocation: 'none' | 'start' | 'step' | 'step-chain' | 'finish' = 'none',
) {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  let sourceA = variant === 'same-value' || variant === 'conditional-untaken' ? COMBINED_A
    .replace('    this.transfer(recipient, amount);\n', '')
    .replace('  event Seen(bigint amount);\n', '')
    .replaceAll('    emit Seen(amount);\n', '')
    .replaceAll('this.count = this.count + amount;', variant === 'same-value'
      ? 'this.count = amount - amount;'
      : 'if (callback.length == 0) { this.count = this.count + amount; }')
    : variant === 'no-transfer'
    ? COMBINED_A.replace('    this.transfer(recipient, amount);\n', '')
    : variant === 'no-events' ? COMBINED_A
      .replace('  event Seen(bigint amount);\n', '')
      .replaceAll('    emit Seen(amount);\n', '')
      : variant === 'no-state' || variant === 'value-only' ? COMBINED_A
        .replace('  bigint count;\n', '')
        .replaceAll('    this.count = this.count + amount;\n', '')
        .replace(variant === 'value-only' ? '  event Seen(bigint amount);\n' : '', '')
        .replaceAll(variant === 'value-only' ? '    emit Seen(amount);\n' : '', '') : COMBINED_A;
  let sourceB = variant === 'same-value' || variant === 'conditional-untaken' ? COMBINED_B
    .replace('  event Stepped(bigint amount);\n', '')
    .replace('    emit Stepped(amount);\n', '')
    .replace('this.count = this.count + amount;', variant === 'same-value'
      ? 'this.count = amount - amount;'
      : 'if (callback.length == 0) { this.count = this.count + amount; }')
    : variant === 'no-events' ? COMBINED_B
    .replace('  event Stepped(bigint amount);\n', '')
    .replace('    emit Stepped(amount);\n', '')
    : variant === 'no-state' || variant === 'value-only' ? COMBINED_B
      .replace('  bigint count;\n', '')
      .replace('    this.count = this.count + amount;\n', '')
      .replace(variant === 'value-only' ? '  event Stepped(bigint amount);\n' : '', '')
      .replace(variant === 'value-only' ? '    emit Stepped(amount);\n' : '', '') : COMBINED_B;
  if (staticInvocation === 'step' || staticInvocation === 'step-chain') {
    sourceA = sourceA.replace('.step(callback, recipient, amount)', '.step.staticcall(callback, recipient, amount)');
  }
  if (staticInvocation === 'step-chain') {
    sourceB = sourceB.replace('.finish(callback, recipient, amount)', '.finish.staticcall(callback, recipient, amount)');
  }
  if (staticInvocation === 'finish') {
    sourceB = sourceB.replace('.finish(callback, recipient, amount)', '.finish.staticcall(callback, recipient, amount)');
  }
  const artifactA = compileString(sourceA, options);
  const artifactB = compileString(sourceB, options);
  const baseA = new Contract(artifactA, [], { provider });
  const baseB = new Contract(artifactB, [], { provider });
  const setupA = await setupStatefulUtxos(provider, baseA, artifactA.stateLayout!, { count: 0n });
  const setupB = await setupStatefulUtxos(provider, baseB, artifactB.stateLayout!, { count: 0n });
  const a = baseA.withCategory(hexToBin(setupA.categoryId));
  const b = baseB.withCategory(hexToBin(setupB.categoryId));
  const recipient = Uint8Array.of(0x51);
  /*
   * X144. The transferred amount was 5 satoshis, which is 469 short of the 474-satoshi dust floor its own
   * one-byte output carries, so this "settlement" was unrelayable. 1,000 is the placeholder value X64 put on a
   * BCHN v29 node with an explicit `-acceptnonstdtxn=0`: accepted, mined, then spent from. The script is left
   * as the bare `OP_1` for the same reason - the node looked at that template and declined to refuse it, and
   * only the VALUE was ever wrong. The container change absorbs the difference (5,000 - 1,000).
   */
  const transferSats = 1_000n;
  const containerSats = 5_000n;
  const args = [b.lockingBytecode, a.lockingBytecode, recipient, transferSats] as const;
  const callbackArgs = [a.lockingBytecode, recipient, transferSats] as const;
  const plan = layer3.planCompiledGraph([
    { artifact: artifactA, lockingBytecode: a.lockingBytecode },
    { artifact: artifactB, lockingBytecode: b.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'start', args,
      ...(staticInvocation === 'start' && { callMode: 'staticcall' as const }) },
    { parent: 0, callee: 1, function: 'step', args: callbackArgs,
      ...((staticInvocation === 'step' || staticInvocation === 'step-chain')
        && { callMode: 'staticcall' as const }) },
    { parent: 1, callee: 0, function: 'finish', args: callbackArgs,
      ...((staticInvocation === 'finish' || staticInvocation === 'step-chain')
        && { callMode: 'staticcall' as const }) },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const blockA = plan.participants[0].blockLayout!;
  const blockB = plan.participants[1].blockLayout!;
  const hasContainerA = blockA.slots.some((slot) => slot.kind === 'satoshiContainer');
  const hasDataA = blockA.slots.some((slot) => slot.kind === 'dataNft');
  const hasDataB = blockB.slots.some((slot) => slot.kind === 'dataNft');
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, ['', ''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const fundingA = Array.from({
    length: blockA.blockSize - 1 - (hasDataA ? 1 : 0) - (hasContainerA ? 1 : 0),
  }, () => randomUtxo({ satoshis: 1000n }));
  const fundingB = Array.from({ length: blockB.blockSize - 1 - (hasDataB ? 1 : 0) }, () => randomUtxo({ satoshis: 1000n }));
  const container = randomUtxo({ satoshis: containerSats });
  const projectionA = randomUtxo({ satoshis: 1000n });
  const projectionB = randomUtxo({ satoshis: 1000n });
  const fee = randomUtxo({ satoshis: 50_000n });
  if (hasContainerA) await provider.addUtxo(getSatoshiContainerAddress(a, setupA.categoryId), container);
  for (const funding of [...fundingA, ...fundingB, fee]) {
    await provider.addUtxo(p2pkh.address, funding);
  }
  await provider.addUtxo(projection.address, projectionA);
  await provider.addUtxo(projection.address, projectionB);
  const routeA = a.createCompilerRouteUnlocker(
    artifactA.hiddenBatch!.route, hexToBin(artifactA.hiddenBatch!.selector),
  );
  const routeB = b.createCompilerRouteUnlocker(
    artifactB.hiddenBatch!.route, hexToBin(artifactB.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    setupA.masterUtxo,
    routeA(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  if (hasDataA) tx.addInput(
    setupA.dataNftUtxos[0], createDataNftUnlocker(a, layout.participantInputs[0], setupA.categoryId),
  );
  if (hasContainerA) {
    tx.addInput(container, createSatoshiContainerUnlocker(a, layout.participantInputs[0], setupA.categoryId));
  }
  fundingA.forEach((funding) => tx.addInput(funding, p2pkh.unlock.spend(alicePub, signature())));
  tx.addInput(
    setupB.masterUtxo,
    routeB(...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any),
  );
  if (hasDataB) tx.addInput(
    setupB.dataNftUtxos[0], createDataNftUnlocker(b, layout.participantInputs[1], setupB.categoryId),
  );
  fundingB.forEach((funding) => tx.addInput(funding, p2pkh.unlock.spend(alicePub, signature())));
  tx.addInput(
    projectionA,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 0n),
  );
  tx.addInput(
    projectionB,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 1n),
  );
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  // A accrues the amount twice (start + finish), B once. The forged-state attack is still an off-by-one.
  const nextA = hasDataA ? buildInitialStateCommitments(
    artifactA.stateLayout!, { count: variant === 'same-value' || variant === 'conditional-untaken' ? 0n
      : tamper === 'state' ? transferSats * 2n + 1n : transferSats * 2n },
  )[0] : '';
  const nextB = hasDataB
    ? buildInitialStateCommitments(artifactB.stateLayout!, {
      count: variant === 'same-value' || variant === 'conditional-untaken' ? 0n : transferSats,
    })[0] : '';
  tx.addOutput({
    to: a.tokenAddress, amount: setupA.masterUtxo.satoshis,
    token: { category: setupA.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  if (hasDataA) tx.addOutput({
    to: getDataNftAddress(a, setupA.categoryId), amount: setupA.dataNftUtxos[0].satoshis,
    token: {
      category: setupA.categoryId, amount: 0n,
      nft: { capability: 'mutable', commitment: nextA },
    },
  });
  if (hasContainerA) {
    tx.addOutput({ to: getSatoshiContainerAddress(a, setupA.categoryId), amount: containerSats - transferSats });
    tx.addOutput({ to: recipient, amount: tamper === 'value' ? transferSats + 1n : transferSats });
  }
  const aTransferSlots = blockA.slots.filter((slot) => slot.kind === 'transfer');
  const aEventSlots = blockA.slots.filter((slot) => slot.kind === 'event');
  const bEventSlots = blockB.slots.filter((slot) => slot.kind === 'event');
  for (const slot of aTransferSlots.slice(1)) {
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
  }
  const eventCommitment = binToHex(scriptToBytecode([bigIntToVmNumber(transferSats)]));
  const eventA = aEventSlots.length > 0
    ? getEventNftAddress(a, setupA.categoryId, artifactA.events![0].signature) : '';
  for (const [eventOrdinal] of aEventSlots.entries()) {
    const reached = eventOrdinal < 2;
    tx.addOutput(reached ? {
      to: tamper === 'event' && eventOrdinal === 1 ? a.tokenAddress : eventA,
      amount: 1000n,
      token: {
        category: setupA.categoryId, amount: 0n,
        nft: { capability: 'none', commitment: eventCommitment },
      },
    } : { to: p2pkh.address, amount: 1000n });
  }
  tx.addOutput({
    to: b.tokenAddress, amount: setupB.masterUtxo.satoshis,
    token: { category: setupB.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  if (hasDataB) tx.addOutput({
    to: getDataNftAddress(b, setupB.categoryId), amount: setupB.dataNftUtxos[0].satoshis,
    token: {
      category: setupB.categoryId, amount: 0n,
      nft: { capability: 'mutable', commitment: nextB },
    },
  });
  if (bEventSlots.length > 0) {
    const eventB = getEventNftAddress(b, setupB.categoryId, artifactB.events![0].signature);
    tx.addOutput({
      to: eventB, amount: 1000n,
      token: {
        category: setupB.categoryId, amount: 0n,
        nft: { capability: 'none', commitment: eventCommitment },
      },
    });
  }
  for (const _slot of bEventSlots.slice(1)) tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10_000n });
  return { provider, transaction: raw(tx), plan };
}

async function buildIntrospectionGraph(tamper = false) {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const artifact = compileString(INTROSPECTION_APP, {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  });
  const base = new Contract(artifact, [], { provider });
  const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {});
  const contract = base.withCategory(hexToBin(setup.categoryId));
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const outpointHash = hexToBin(setup.masterUtxo.txid).reverse();
  if (tamper) outpointHash[0] ^= 1;
  const plan = layer3.planCompiledGraph([
    { artifact, lockingBytecode: contract.lockingBytecode },
  ], [{
    parent: null,
    callee: 0,
    function: 'inspect',
    args: [
      contract.lockingBytecode, hexToBin(setup.categoryId).reverse(), outpointHash, p2pkh.lockingBytecode,
    ],
  }]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, [''], layout.projectionInputs,
  );
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const projectionUtxo = randomUtxo({ satoshis: 1000n });
  const fee = randomUtxo({ satoshis: 50_000n });
  await provider.addUtxo(projection.address, projectionUtxo);
  await provider.addUtxo(p2pkh.address, fee);
  const route = contract.createCompilerRouteUnlocker(
    artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    setup.masterUtxo,
    route(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(
    projectionUtxo,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 0n),
  );
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: contract.tokenAddress, amount: setup.masterUtxo.satoshis,
    token: { category: setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10_000n });
  return { provider, transaction: raw(tx) };
}

async function buildSignedGraph(tamper = false, multisig: boolean | 'array' = false) {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const artifact = compileString(multisig === 'array' ? SIGNATURE_ARRAY_APP
    : multisig ? MULTISIG_APP : SIGNED_APP, {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  });
  const base = new Contract(artifact, [], { provider });
  const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {});
  const contract = base.withCategory(hexToBin(setup.categoryId));
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const authorization = new SignatureTemplate(tamper ? bobPriv : alicePriv);
  const scalarArgs: FunctionArgument[] = [
    new SignatureTemplate(alicePriv, undefined, SignatureAlgorithm.ECDSA),
    new SignatureTemplate(
      tamper ? new Uint8Array(32).fill(7) : bobPriv,
      undefined,
      SignatureAlgorithm.ECDSA,
    ),
    alicePub, bobPub, carolPub,
  ];
  const args: FunctionArgument[] = multisig === 'array'
    ? [[
      new SignatureTemplate(alicePriv, undefined, SignatureAlgorithm.ECDSA),
      new SignatureTemplate(
        tamper ? new Uint8Array(32).fill(7) : bobPriv,
        undefined,
        SignatureAlgorithm.ECDSA,
      ),
    ], [alicePub, bobPub, carolPub]]
    : multisig ? scalarArgs : [authorization, alicePub];
  const plan = layer3.planCompiledGraph([
    { artifact, lockingBytecode: contract.lockingBytecode },
  ], [{
    parent: null,
    callee: 0,
    function: multisig === 'array' ? 'signedMany' : multisig ? 'signed2of3' : 'signed',
    args,
  }]);
  // The canonical row commits the public key but deliberately excludes the
  // transaction signature, which is finalized only after the root exists.
  expect(plan.participants[0].batch.rows[0].argsHex).toBe(binToHex(
    multisig === 'array'
      ? encodeFunctionArgument([alicePub, bobPub, carolPub], 'pubkey[]') as Uint8Array
      : scriptToBytecode(multisig ? [alicePub, bobPub, carolPub] : [alicePub]),
  ));
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, [''], layout.projectionInputs,
  );
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const projectionUtxo = randomUtxo({ satoshis: 1000n });
  const fee = randomUtxo({ satoshis: 50_000n });
  await provider.addUtxo(projection.address, projectionUtxo);
  await provider.addUtxo(p2pkh.address, fee);
  const route = contract.createCompilerRouteUnlocker(
    artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    setup.masterUtxo,
    route(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(
    projectionUtxo,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 0n),
  );
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: contract.tokenAddress, amount: setup.masterUtxo.satoshis,
    token: { category: setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10_000n });
  return { provider, transaction: raw(tx) };
}

async function buildForwardedSignedGraph(tamper = false) {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  const artifactB = compileString(SIGNED_APP, options);
  const baseB = new Contract(artifactB, [], { provider });
  const setupB = await setupStatefulUtxos(provider, baseB, artifactB.stateLayout!, {});
  const b = baseB.withCategory(hexToBin(setupB.categoryId));
  const artifactA = compileString(FORWARDED_SIGNED_CALLER, options);
  const baseA = new Contract(artifactA, [], { provider });
  const setupA = await setupStatefulUtxos(provider, baseA, artifactA.stateLayout!, {});
  const a = baseA.withCategory(hexToBin(setupA.categoryId));
  const bLockingBytecode = b.lockingBytecode;
  const ownerPub = new SignatureTemplate(alicePriv).getPublicKey();
  const expectedRootArgs = binToHex(scriptToBytecode([hexToBin(bLockingBytecode), ownerPub]));
  const authorization = new SignatureTemplate(tamper ? bobPriv : alicePriv);
  const plan = layer3.deriveCompiledGraphPlan({
    root: { artifact: artifactA, lockingBytecode: a.lockingBytecode },
    function: 'forward',
    args: [hexToBin(bLockingBytecode), authorization, ownerPub],
    targets: {
      IGraphSigned: { artifact: artifactB, lockingBytecode: bLockingBytecode },
    },
  });
  expect(plan.participants.map((participant) =>
    participant.batch.rows[0].argsHex)).toEqual([
    expectedRootArgs,
    binToHex(scriptToBytecode([ownerPub])),
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, ['', ''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const projections = [randomUtxo({ satoshis: 1000n }), randomUtxo({ satoshis: 1000n })];
  const fee = randomUtxo({ satoshis: 50_000n });
  for (const proof of projections) await provider.addUtxo(projection.address, proof);
  await provider.addUtxo(p2pkh.address, fee);
  const routeA = a.createCompilerRouteUnlocker(
    artifactA.hiddenBatch!.route, hexToBin(artifactA.hiddenBatch!.selector),
  );
  const routeB = b.createCompilerRouteUnlocker(
    artifactB.hiddenBatch!.route, hexToBin(artifactB.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    setupA.masterUtxo,
    routeA(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(
    setupB.masterUtxo,
    routeB(...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any),
  );
  projections.forEach((proof, participant) => tx.addInput(
    proof,
    projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
    ),
  ));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  for (const [contract, setup] of [[a, setupA], [b, setupB]] as const) {
    tx.addOutput({
      to: contract.tokenAddress, amount: setup.masterUtxo.satoshis,
      token: { category: setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
  }
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10_000n });
  return { provider, transaction: raw(tx) };
}

async function buildRawCallGraph(tamperResult = false, staticCall = false) {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  const artifactB = compileString(RAW_TARGET, options);
  const baseB = new Contract(artifactB, [], { provider });
  const setupB = await setupStatefulUtxos(provider, baseB, artifactB.stateLayout!, {});
  const b = baseB.withCategory(hexToBin(setupB.categoryId));
  const artifactA = compileString(staticCall ? RAW_STATIC_CALLER : RAW_CALLER, options);
  const baseA = new Contract(artifactA, [], { provider });
  const setupA = await setupStatefulUtxos(provider, baseA, artifactA.stateLayout!, {});
  const a = baseA.withCategory(hexToBin(setupA.categoryId));
  const selector = artifactB.abi.find((fn) => fn.name === 'echo')!.selector!;
  const payload = Uint8Array.from([...hexToBin(selector), ...packedResult(3n)]);
  const plan = layer3.deriveCompiledGraphPlan({
    root: { artifact: artifactA, lockingBytecode: a.lockingBytecode },
    function: 'run',
    args: [b.lockingBytecode, payload],
    targets: {},
    dynamicCall: ({ kind }) => {
      expect(kind).toBe('low-level');
      return {
        participant: { artifact: artifactB, lockingBytecode: b.lockingBytecode },
        function: 'echo',
        args: [3n],
      };
    },
  });
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const result = packedResult(3n);
  const transcript = layer3.finalizeCompiledGraph(
    plan, { 1: binToHex(result) },
    layout.participantInputs, layout.returnOutputs,
    ['', binToHex(result)], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const returnFunding = randomUtxo({ satoshis: 1000n });
  const projections = [randomUtxo({ satoshis: 1000n }), randomUtxo({ satoshis: 1000n })];
  const fee = randomUtxo({ satoshis: 50_000n });
  await provider.addUtxo(p2pkh.address, returnFunding);
  for (const proof of projections) await provider.addUtxo(projection.address, proof);
  await provider.addUtxo(p2pkh.address, fee);
  const routeA = a.createCompilerRouteUnlocker(
    artifactA.hiddenBatch!.route, hexToBin(artifactA.hiddenBatch!.selector),
  );
  const routeB = b.createCompilerRouteUnlocker(
    artifactB.hiddenBatch!.route, hexToBin(artifactB.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    setupA.masterUtxo,
    routeA(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(
    setupB.masterUtxo,
    routeB(
      ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any,
      BigInt(layout.returnOutputs[1]!),
    ),
  );
  tx.addInput(returnFunding, p2pkh.unlock.spend(alicePub, signature()));
  projections.forEach((proof, participant) => tx.addInput(
    proof,
    projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
    ),
  ));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: a.tokenAddress, amount: setupA.masterUtxo.satoshis,
    token: { category: setupA.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: b.tokenAddress, amount: setupB.masterUtxo.satoshis,
    token: { category: setupB.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: hexToBin('51'), amount: 1000n,
    token: {
      category: setupB.categoryId, amount: 0n,
      nft: { capability: 'none', commitment: binToHex(aggregateResult(tamperResult ? 4n : 3n)) },
    },
  });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10_000n });
  return { provider, transaction: raw(tx) };
}

async function buildDelegateGraph(wrongSelector = false, tamperState = false) {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  const implementationArtifact = compileString(GRAPH_DELEGATE_IMPL, options);
  const implementationBase = new Contract(implementationArtifact, [], { provider });
  const implementationSetup = await setupStatefulUtxos(
    provider, implementationBase, implementationArtifact.stateLayout!, { counter: 0n },
  );
  const implementation = implementationBase.withCategory(hexToBin(implementationSetup.categoryId));
  const proxyArtifact = compileString(GRAPH_DELEGATE_PROXY, options);
  const proxyBase = new Contract(proxyArtifact, [implementation.lockingBytecode], { provider });
  const proxySetup = await setupStatefulUtxos(
    provider, proxyBase, proxyArtifact.stateLayout!, { counter: 0n },
  );
  const proxy = proxyBase.withCategory(hexToBin(proxySetup.categoryId));
  const selectedFunction = wrongSelector ? 'pong' : 'ping';
  const committedSelector = implementationArtifact.abi.find((fn) => fn.name === 'ping')!.selector!;
  const payload = hexToBin(committedSelector);
  const plan = layer3.deriveCompiledGraphPlan({
    root: { artifact: proxyArtifact, lockingBytecode: proxy.lockingBytecode },
    function: 'run',
    args: [payload],
    targets: {},
  });
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, [''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const proof = randomUtxo({ satoshis: 1000n });
  const fee = randomUtxo({ satoshis: 50_000n });
  await provider.addUtxo(projection.address, proof);
  await provider.addUtxo(p2pkh.address, fee);
  const route = proxy.createCompilerRouteUnlocker(
    proxyArtifact.hiddenBatch!.route, hexToBin(proxyArtifact.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    proxySetup.masterUtxo,
    route(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(
    proxySetup.dataNftUtxos[0],
    createDataNftUnlocker(proxy, layout.participantInputs[0], proxySetup.categoryId),
  );
  tx.addInput(
    implementationSetup.masterUtxo,
    (implementation.unlock as any)[selectedFunction](0n),
  );
  tx.addInput(
    proof,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 0n),
  );
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: proxy.tokenAddress, amount: proxySetup.masterUtxo.satoshis,
    token: {
      category: proxySetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' },
    },
  });
  tx.addOutput({
    to: getDataNftAddress(proxy, proxySetup.categoryId),
    amount: proxySetup.dataNftUtxos[0].satoshis,
    token: {
      category: proxySetup.categoryId,
      amount: 0n,
      nft: {
        capability: 'mutable',
        commitment: buildInitialStateCommitments(
          proxyArtifact.stateLayout!, { counter: tamperState ? 2n : 1n },
        )[0],
      },
    },
  });
  tx.addOutput({
    to: implementation.tokenAddress, amount: implementationSetup.masterUtxo.satoshis,
    token: {
      category: implementationSetup.categoryId,
      amount: 0n,
      nft: { capability: 'minting', commitment: '' },
    },
  });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10_000n });
  return { provider, transaction: raw(tx), proxyArtifact };
}

async function buildRelocatedDelegateGraph(wrongProxyIndex = false) {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  const implementationArtifact = compileString(GRAPH_DELEGATE_IMPL, options);
  const implementationBase = new Contract(implementationArtifact, [], { provider });
  const implementationSetup = await setupStatefulUtxos(
    provider, implementationBase, implementationArtifact.stateLayout!, { counter: 0n },
  );
  const implementation = implementationBase.withCategory(hexToBin(implementationSetup.categoryId));
  const proxyArtifact = compileString(GRAPH_DELEGATE_PROXY, options);
  const proxyBase = new Contract(proxyArtifact, [implementation.lockingBytecode], { provider });
  const proxySetup = await setupStatefulUtxos(
    provider, proxyBase, proxyArtifact.stateLayout!, { counter: 0n },
  );
  const proxy = proxyBase.withCategory(hexToBin(proxySetup.categoryId));
  const callerArtifact = compileString(GRAPH_DELEGATE_CALLER, options);
  const callerBase = new Contract(callerArtifact, [proxy.lockingBytecode], { provider });
  const callerSetup = await setupStatefulUtxos(
    provider, callerBase, callerArtifact.stateLayout!, {},
  );
  const caller = callerBase.withCategory(hexToBin(callerSetup.categoryId));
  const payload = hexToBin(implementationArtifact.abi.find((fn) => fn.name === 'ping')!.selector!);
  const plan = layer3.deriveCompiledGraphPlan({
    root: { artifact: callerArtifact, lockingBytecode: caller.lockingBytecode },
    function: 'start',
    args: [payload],
    targets: {
      IGraphDelegateProxy: { artifact: proxyArtifact, lockingBytecode: proxy.lockingBytecode },
    },
    target: ({ interfaceName }) => interfaceName === 'IGraphDelegateProxy'
      ? { artifact: proxyArtifact, lockingBytecode: proxy.lockingBytecode }
      : undefined,
  });
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, ['', ''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const proofs = [randomUtxo({ satoshis: 1000n }), randomUtxo({ satoshis: 1000n })];
  const fee = randomUtxo({ satoshis: 50_000n });
  for (const proof of proofs) await provider.addUtxo(projection.address, proof);
  await provider.addUtxo(p2pkh.address, fee);
  const callerRoute = caller.createCompilerRouteUnlocker(
    callerArtifact.hiddenBatch!.route, hexToBin(callerArtifact.hiddenBatch!.selector),
  );
  const proxyRoute = proxy.createCompilerRouteUnlocker(
    proxyArtifact.hiddenBatch!.route, hexToBin(proxyArtifact.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    callerSetup.masterUtxo,
    callerRoute(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(
    proxySetup.masterUtxo,
    proxyRoute(...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any),
  );
  tx.addInput(
    proxySetup.dataNftUtxos[0],
    createDataNftUnlocker(proxy, layout.participantInputs[1], proxySetup.categoryId),
  );
  tx.addInput(
    implementationSetup.masterUtxo,
    implementation.unlock.ping(wrongProxyIndex ? 0n : 1n),
  );
  proofs.forEach((proof, participant) => tx.addInput(
    proof,
    projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
    ),
  ));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: caller.tokenAddress, amount: callerSetup.masterUtxo.satoshis,
    token: {
      category: callerSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' },
    },
  });
  tx.addOutput({
    to: proxy.tokenAddress, amount: proxySetup.masterUtxo.satoshis,
    token: {
      category: proxySetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' },
    },
  });
  tx.addOutput({
    to: getDataNftAddress(proxy, proxySetup.categoryId),
    amount: proxySetup.dataNftUtxos[0].satoshis,
    token: {
      category: proxySetup.categoryId,
      amount: 0n,
      nft: {
        capability: 'mutable',
        commitment: buildInitialStateCommitments(proxyArtifact.stateLayout!, { counter: 1n })[0],
      },
    },
  });
  tx.addOutput({
    to: implementation.tokenAddress, amount: implementationSetup.masterUtxo.satoshis,
    token: {
      category: implementationSetup.categoryId,
      amount: 0n,
      nft: { capability: 'minting', commitment: '' },
    },
  });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10_000n });
  return { provider, transaction: raw(tx), layout };
}

const packedResult = (value: bigint): Uint8Array =>
  scriptToBytecode([bigIntToVmNumber(value)]);
const packedPairResult = (value: bigint, witness: bigint): Uint8Array =>
  scriptToBytecode([bigIntToVmNumber(value), bigIntToVmNumber(witness)]);
const aggregateResult = (value: bigint): Uint8Array => scriptToBytecode([packedResult(value)]);
const aggregatePairResult = (value: bigint, witness: bigint): Uint8Array =>
  scriptToBytecode([packedPairResult(value, witness)]);

async function buildReturning(
  tamperResult = false, tamperTupleField = false,
  resultKind: 'tuple' | 'bytes' | 'string' | 'struct' = 'tuple',
) {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  const artifactB = compileString(
    resultKind === 'bytes' ? DYNAMIC_RETURNING_B : resultKind === 'string' ? STRING_RETURNING_B
      : resultKind === 'struct' ? STRUCT_RETURNING_B : RETURNING_B,
    options,
  );
  const baseB = new Contract(artifactB, [2n], { provider });
  const setupB = await setupStatefulUtxos(provider, baseB, artifactB.stateLayout!, {});
  const b = baseB.withCategory(hexToBin(setupB.categoryId));
  const artifactA = compileString(
    resultKind === 'bytes' ? DYNAMIC_RETURNING_A : resultKind === 'string' ? STRING_RETURNING_A
      : resultKind === 'struct' ? STRUCT_RETURNING_A : RETURNING_A,
    options,
  );
  const baseA = new Contract(artifactA, [1n, b.lockingBytecode], { provider });
  const setupA = await setupStatefulUtxos(provider, baseA, artifactA.stateLayout!, {});
  const a = baseA.withCategory(hexToBin(setupA.categoryId));
  const dynamicArgument = hexToBin('aabb');
  const plan = layer3.planCompiledGraph([
    { artifact: artifactA, lockingBytecode: a.lockingBytecode },
    { artifact: artifactB, lockingBytecode: b.lockingBytecode },
  ], [
    {
      parent: null, callee: 0, function: resultKind === 'tuple' ? 'plusOne' : 'forward',
      args: resultKind === 'bytes' ? [dynamicArgument] : resultKind === 'string' ? ['hello'] : [2n],
    },
    {
      parent: 0, callee: 1,
      function: resultKind === 'bytes' || resultKind === 'string'
        ? 'append' : resultKind === 'struct' ? 'make' : 'twice',
      args: resultKind === 'bytes' ? [dynamicArgument] : resultKind === 'string' ? ['hello'] : [2n],
    },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const dynamicValue = hexToBin(tamperResult ? 'aabbee' : 'aabbff');
  const structValue = resultKind === 'struct' ? encodeFunctionArgument(
    { n: tamperResult ? 4n : 3n, ok: !tamperTupleField },
    'PairResult', artifactB.structs,
  ) as Uint8Array : new Uint8Array();
  const correctStructValue = resultKind === 'struct' ? encodeFunctionArgument(
    { n: 3n, ok: true }, 'PairResult', artifactB.structs,
  ) as Uint8Array : new Uint8Array();
  const stringValue = utf8ToBin(tamperResult ? 'hello?' : 'hello!');
  const correctStringValue = utf8ToBin('hello!');
  const invocationResultA = resultKind === 'bytes'
    ? scriptToBytecode([hexToBin('aabbff')])
    : resultKind === 'string' ? scriptToBytecode([correctStringValue])
    : resultKind === 'struct' ? correctStructValue : packedResult(5n);
  const invocationResultB = resultKind === 'bytes'
    ? scriptToBytecode([dynamicValue])
    : resultKind === 'string' ? scriptToBytecode([stringValue])
    : resultKind === 'struct' ? structValue : packedPairResult(4n, 12n);
  const correctInvocationResultB = resultKind === 'bytes'
    ? scriptToBytecode([hexToBin('aabbff')])
    : resultKind === 'string' ? scriptToBytecode([correctStringValue])
    : resultKind === 'struct' ? correctStructValue : packedPairResult(4n, 12n);
  const transcript = layer3.finalizeCompiledGraph(plan, {
    0: binToHex(invocationResultA),
    1: binToHex(correctInvocationResultB),
  }, layout.participantInputs, layout.returnOutputs,
  [binToHex(invocationResultA), binToHex(correctInvocationResultB)], layout.projectionInputs);
  const resultA = resultKind === 'tuple' ? aggregateResult(5n) : scriptToBytecode([invocationResultA]);
  const resultB = resultKind === 'tuple'
    ? aggregatePairResult(tamperResult ? 5n : 4n, tamperTupleField ? 13n : 12n)
    : scriptToBytecode([invocationResultB]);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const returnFundingA = randomUtxo({ satoshis: 1000n });
  const returnFundingB = randomUtxo({ satoshis: 1000n });
  const fee = randomUtxo({ satoshis: 50000n });
  const projectionA = randomUtxo({ satoshis: 1000n });
  const projectionB = randomUtxo({ satoshis: 1000n });
  await provider.addUtxo(p2pkh.address, returnFundingA);
  await provider.addUtxo(p2pkh.address, returnFundingB);
  await provider.addUtxo(p2pkh.address, fee);
  await provider.addUtxo(projection.address, projectionA);
  await provider.addUtxo(projection.address, projectionB);
  const routeA = a.createCompilerRouteUnlocker(
    artifactA.hiddenBatch!.route, hexToBin(artifactA.hiddenBatch!.selector),
  );
  const routeB = b.createCompilerRouteUnlocker(
    artifactB.hiddenBatch!.route, hexToBin(artifactB.hiddenBatch!.selector),
  );

  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(setupA.masterUtxo, routeA(
    ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any,
    BigInt(layout.returnOutputs![0]!),
  ));
  tx.addInput(returnFundingA, p2pkh.unlock.spend(alicePub, signature()));
  tx.addInput(setupB.masterUtxo, routeB(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any,
    BigInt(layout.returnOutputs![1]!),
  ));
  tx.addInput(returnFundingB, p2pkh.unlock.spend(alicePub, signature()));
  tx.addInput(
    projectionA,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 0n),
  );
  tx.addInput(
    projectionB,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 1n),
  );
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: a.tokenAddress, amount: setupA.masterUtxo.satoshis,
    token: { category: setupA.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: hexToBin('51'), amount: 1000n,
    token: {
      category: setupA.categoryId, amount: 0n,
      nft: { capability: 'none', commitment: binToHex(resultA) },
    },
  });
  tx.addOutput({
    to: b.tokenAddress, amount: setupB.masterUtxo.satoshis,
    token: { category: setupB.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: hexToBin('51'), amount: 1000n,
    token: {
      category: setupB.categoryId, amount: 0n,
      nft: { capability: 'none', commitment: binToHex(resultB) },
    },
  });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10000n });
  return {
    provider, transaction: raw(tx), artifactA, artifactB, plan, resultA, resultB,
  };
}

async function buildStateCycle(
  tamperState = false, tamperCallbackTarget = false, tamperOutState = false,
) {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  const artifactA = compileString(STATE_A, options);
  const artifactB = compileString(STATE_B, options);
  const artifactC = compileString(STATE_C, options);
  const baseC = new Contract(artifactC, [3n], { provider });
  const setupC = await setupStatefulUtxos(
    provider, baseC, artifactC.stateLayout!, { count: 0n },
  );
  const c = baseC.withCategory(hexToBin(setupC.categoryId));
  const baseB = new Contract(artifactB, [2n, hexToBin(c.lockingBytecode)], { provider });
  const setupB = await setupStatefulUtxos(
    provider, baseB, artifactB.stateLayout!, { count: 0n },
  );
  const b = baseB.withCategory(hexToBin(setupB.categoryId));
  const baseA = new Contract(artifactA, [
    1n, hexToBin(b.lockingBytecode), hexToBin(c.lockingBytecode),
  ], { provider });
  const setupA = await setupStatefulUtxos(
    provider, baseA, artifactA.stateLayout!, { count: 0n },
  );
  const a = baseA.withCategory(hexToBin(setupA.categoryId));
  const commonArgs = [hexToBin(tamperCallbackTarget ? c.lockingBytecode : a.lockingBytecode), 1n] as const;
  const participantA = {
    artifact: artifactA, lockingBytecode: a.lockingBytecode,
    constructorArgs: [1n, hexToBin(b.lockingBytecode), hexToBin(c.lockingBytecode)],
  };
  const participantB = {
    artifact: artifactB, lockingBytecode: b.lockingBytecode,
    constructorArgs: [2n, hexToBin(c.lockingBytecode)],
  };
  const participantC = {
    artifact: artifactC, lockingBytecode: c.lockingBytecode, constructorArgs: [3n],
  };
  // This is deliberately derived from compiler-authored callsites rather than restating transcript rows.
  // The worklist interns A by locking bytecode when B calls it back, producing three logical invocations but
  // only two physical owner blocks.
  const plan = layer3.deriveCompiledGraphPlan({
    root: participantA,
    function: 'start',
    args: commonArgs,
    targets: {},
    target: ({ interfaceName, occurrence }) => {
      expect(occurrence).toBe(0);
      if (interfaceName === 'IStateB') return participantB;
      if (interfaceName === 'IStateC') return participantC;
      if (interfaceName === 'IStateA') return participantA;
      return undefined;
    },
  });
  expect(plan.invocations.map(({ parent, callee, function: name }) => ({ parent, callee, name }))).toEqual([
    { parent: null, callee: 0, name: 'start' },
    { parent: 0, callee: 1, name: 'step' },
    { parent: 1, callee: 2, name: 'relay' },
    { parent: 2, callee: 0, name: 'finish' },
  ]);
  expect(plan.participants.map(({ invocations }) => invocations)).toEqual([[0, 3], [1], [2]]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, ['', '', ''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const fee = randomUtxo({ satoshis: 50000n });
  const projectionA = randomUtxo({ satoshis: 1000n });
  const projectionB = randomUtxo({ satoshis: 1000n });
  const projectionC = randomUtxo({ satoshis: 1000n });
  await provider.addUtxo(p2pkh.address, fee);
  await provider.addUtxo(projection.address, projectionA);
  await provider.addUtxo(projection.address, projectionB);
  await provider.addUtxo(projection.address, projectionC);
  const routeA = a.createCompilerRouteUnlocker(
    artifactA.hiddenBatch!.route, hexToBin(artifactA.hiddenBatch!.selector),
  );
  const routeB = b.createCompilerRouteUnlocker(
    artifactB.hiddenBatch!.route, hexToBin(artifactB.hiddenBatch!.selector),
  );
  const routeC = c.createCompilerRouteUnlocker(
    artifactC.hiddenBatch!.route, hexToBin(artifactC.hiddenBatch!.selector),
  );
  const nextA = buildInitialStateCommitments(
    artifactA.stateLayout!, { count: tamperState ? 3n : 2n },
  )[0];
  const nextB = buildInitialStateCommitments(
    artifactB.stateLayout!, { count: tamperOutState ? 2n : 1n },
  )[0];
  const nextC = buildInitialStateCommitments(artifactC.stateLayout!, { count: 1n })[0];
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    setupA.masterUtxo,
    routeA(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(
    setupA.dataNftUtxos[0],
    createDataNftUnlocker(a, layout.participantInputs[0], setupA.categoryId),
  );
  tx.addInput(
    setupB.masterUtxo,
    routeB(...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any),
  );
  tx.addInput(
    setupB.dataNftUtxos[0],
    createDataNftUnlocker(b, layout.participantInputs[1], setupB.categoryId),
  );
  tx.addInput(
    setupC.masterUtxo,
    routeC(...layer3.compiledGraphRouteArgs(transcript, 2, layout.controllerInput) as any),
  );
  tx.addInput(
    setupC.dataNftUtxos[0],
    createDataNftUnlocker(c, layout.participantInputs[2], setupC.categoryId),
  );
  tx.addInput(
    projectionA,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 0n),
  );
  tx.addInput(
    projectionB,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 1n),
  );
  tx.addInput(
    projectionC,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 2n),
  );
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: a.tokenAddress, amount: setupA.masterUtxo.satoshis,
    token: { category: setupA.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: getDataNftAddress(a, setupA.categoryId), amount: setupA.dataNftUtxos[0].satoshis,
    token: {
      category: setupA.categoryId, amount: 0n,
      nft: { capability: 'mutable', commitment: nextA },
    },
  });
  tx.addOutput({
    to: b.tokenAddress, amount: setupB.masterUtxo.satoshis,
    token: { category: setupB.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: getDataNftAddress(b, setupB.categoryId), amount: setupB.dataNftUtxos[0].satoshis,
    token: {
      category: setupB.categoryId, amount: 0n,
      nft: { capability: 'mutable', commitment: nextB },
    },
  });
  tx.addOutput({
    to: c.tokenAddress, amount: setupC.masterUtxo.satoshis,
    token: { category: setupC.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: getDataNftAddress(c, setupC.categoryId), amount: setupC.dataNftUtxos[0].satoshis,
    token: {
      category: setupC.categoryId, amount: 0n,
      nft: { capability: 'mutable', commitment: nextC },
    },
  });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10000n });
  return { provider, transaction: raw(tx) };
}

async function buildEventGraph(tamperEvent = false) {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const artifact = compileString(`pragma solidcash >=0.8.0;
    contract CompiledGraphEvent() {
      event Noted(bigint n);
      function note(bigint n) public {
        emit Noted(n);
        require(n >= 0);
      }
    }`, {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  });
  const base = new Contract(artifact, [], { provider });
  const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {});
  const contract = base.withCategory(hexToBin(setup.categoryId));
  const plan = layer3.planCompiledGraph([
    { artifact, lockingBytecode: contract.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'note', args: [7n] },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, [''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const eventFunding = Array.from({ length: 8 }, () => randomUtxo({ satoshis: 1000n }));
  const projectionUtxo = randomUtxo({ satoshis: 1000n });
  const fee = randomUtxo({ satoshis: 50000n });
  for (const funding of eventFunding) await provider.addUtxo(p2pkh.address, funding);
  await provider.addUtxo(projection.address, projectionUtxo);
  await provider.addUtxo(p2pkh.address, fee);
  const route = contract.createCompilerRouteUnlocker(
    artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    setup.masterUtxo,
    route(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  eventFunding.forEach((funding) =>
    tx.addInput(funding, p2pkh.unlock.spend(alicePub, signature())));
  tx.addInput(
    projectionUtxo,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 0n),
  );
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: contract.tokenAddress, amount: setup.masterUtxo.satoshis,
    token: { category: setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  const eventSignature = artifact.events![0].signature;
  tx.addOutput({
    to: tamperEvent
      ? contract.tokenAddress
      : getEventNftAddress(contract, setup.categoryId, eventSignature),
    amount: 1000n,
    token: {
      category: setup.categoryId,
      amount: 0n,
      nft: { capability: 'none', commitment: binToHex(scriptToBytecode([bigIntToVmNumber(7n)])) },
    },
  });
  for (let slot = 2; slot < 9; slot += 1) {
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
  }
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10000n });
  return { provider, transaction: raw(tx), layout };
}

async function buildValueEffectGraph(tamperAmount = false) {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const artifact = compileString(`pragma solidcash >=0.8.0;
    contract CompiledGraphValue() {
      function pay(bytes recipient, bigint amount) public {
        this.transfer(recipient, amount);
        require(msg.value == -amount && amount >= 0);
      }
    }`, {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  });
  const base = new Contract(artifact, [], { provider });
  const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {});
  const contract = base.withCategory(hexToBin(setup.categoryId));
  const recipient = Uint8Array.of(0x51);
  // X144. Was 100 satoshis against the 474-satoshi dust floor of its own one-byte output, so the "settlement"
  // was refused `64: dust` by a node. See `expectRelayable` and X64 for why 1,000 to a bare `OP_1` is the
  // node-measured placeholder. The container change absorbs it (5,000 - 1,000).
  const effectSats = 1_000n;
  const containerSats = 5_000n;
  const plan = layer3.planCompiledGraph([
    { artifact, lockingBytecode: contract.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'pay', args: [recipient, effectSats] },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, [''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const container = randomUtxo({ satoshis: containerSats });
  const effectFunding = Array.from(
    { length: plan.participants[0].blockLayout!.blockSize - 2 },
    () => randomUtxo({ satoshis: 1000n }),
  );
  const projectionUtxo = randomUtxo({ satoshis: 1000n });
  const fee = randomUtxo({ satoshis: 50000n });
  await provider.addUtxo(getSatoshiContainerAddress(contract, setup.categoryId), container);
  for (const funding of effectFunding) await provider.addUtxo(p2pkh.address, funding);
  await provider.addUtxo(projection.address, projectionUtxo);
  await provider.addUtxo(p2pkh.address, fee);
  const route = contract.createCompilerRouteUnlocker(
    artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    setup.masterUtxo,
    route(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(container, createSatoshiContainerUnlocker(contract, 0, setup.categoryId));
  effectFunding.forEach((funding) =>
    tx.addInput(funding, p2pkh.unlock.spend(alicePub, signature())));
  tx.addInput(
    projectionUtxo,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 0n),
  );
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: contract.tokenAddress, amount: setup.masterUtxo.satoshis,
    token: { category: setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: getSatoshiContainerAddress(contract, setup.categoryId),
    amount: containerSats - effectSats,
  });
  tx.addOutput({ to: recipient, amount: tamperAmount ? effectSats + 1n : effectSats });
  for (let slot = 3; slot < plan.participants[0].blockLayout!.blockSize; slot += 1) {
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
  }
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10000n });
  return { provider, transaction: raw(tx), layout };
}

async function buildMappingGraph(tamperValue = false) {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const artifact = compileString(`pragma solidcash >=0.8.0;
    contract CompiledGraphMapping() {
      mapping(bigint => bigint) values;
      function add(bigint key, bigint amount) public {
        this.values[key] = this.values[key] + amount;
        require(amount >= 0);
      }
    }`, {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  });
  const base = new Contract(artifact, [], { provider });
  const initialSlot = keyToSlot(bigIntToVmNumber(1n));
  const initialCommitment = encodeEntryCommitment(
    initialSlot,
    new Uint8Array(initialSlot.length),
    bigIntToVmNumber(10n),
  );
  const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, {
    extraOutputs: (categoryId) => [{
      address: getEntryNftAddress(base, categoryId, 'values'),
      satoshis: 10000n,
      token: {
        amount: 0n,
        nft: { capability: 'mutable', commitment: binToHex(initialCommitment) },
      },
    }],
  });
  const contract = base.withCategory(hexToBin(setup.categoryId));
  const master = setup.masterUtxo;
  const entryAddress = getEntryNftAddress(contract, setup.categoryId, 'values');
  const entry = setup.extraUtxos?.[0];
  if (!master || !entry?.token?.nft?.commitment) {
    throw new Error('mapping fixture did not create its authenticated entry');
  }
  const decoded = decodeEntryCommitment(hexToBin(entry.token.nft.commitment));
  const nextCommitment = encodeEntryCommitment(
    decoded.slot,
    decoded.nextKey,
    bigIntToVmNumber(tamperValue ? 16n : 15n),
  );
  const plan = layer3.planCompiledGraph([
    { artifact, lockingBytecode: contract.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'add', args: [1n, 5n] },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, [''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const projectionUtxo = randomUtxo({ satoshis: 1000n });
  const fee = randomUtxo({ satoshis: 50000n });
  await provider.addUtxo(projection.address, projectionUtxo);
  await provider.addUtxo(p2pkh.address, fee);
  const route = contract.createCompilerRouteUnlocker(
    artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    master,
    route(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(entry, createEntryNftUnlocker(contract, 0, setup.categoryId, 'values'));
  tx.addInput(
    projectionUtxo,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 0n),
  );
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: contract.tokenAddress, amount: master.satoshis,
    token: { category: setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: entryAddress, amount: entry.satoshis,
    token: {
      category: setup.categoryId,
      amount: 0n,
      nft: { capability: 'mutable', commitment: binToHex(nextCommitment) },
    },
  });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10000n });
  return { provider, transaction: raw(tx), layout };
}

async function buildCallerAuthorizedTransferGraph(
  forgeCallerWitness = false,
  aliasMode?: 'shared-first' | 'repeated-recipient',
  forgeAliasWitness?: 'omit-sentinel' | 'false-sentinel',
) {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  const tokenArtifact = compileString(`pragma solidcash >=0.8.0;
    contract GraphAllowanceToken() {
      mapping(bytes20 => bigint) balances;
      mapping(bytes20 => mapping(address => bigint)) allowance;
      function transferFrom(bytes20 from, bytes20 to, bigint amount) public {
        require(this.allowance[from][msg.sender] >= amount);
        require(this.balances[from] >= amount);
        this.allowance[from][msg.sender] = this.allowance[from][msg.sender] - amount;
        this.balances[from] = this.balances[from] - amount;
        this.balances[to] = this.balances[to] + amount;
      }
    }`, options);
  const tokenBase = new Contract(tokenArtifact, [], { provider });
  const tokenSetup = await setupStatefulUtxos(
    provider, tokenBase, tokenArtifact.stateLayout!, {},
  );
  const token = tokenBase.withCategory(hexToBin(tokenSetup.categoryId));
  const callerSource = `pragma solidcash >=0.8.0;
    interface IGraphAllowanceToken {
      function transferFrom(bytes20 from, bytes20 to, bigint amount);
    }
    contract GraphAllowanceRouter(int brand, address token) {
      function route(
        bytes20 from, bytes20 first, bytes20 second, bigint firstAmount, bigint secondAmount
      ) public {
        IGraphAllowanceToken(token).transferFrom(from, first, firstAmount);
        IGraphAllowanceToken(token).transferFrom(from, second, secondAmount);
        require(true);
      }
    }`;
  const callerArtifact = compileString(callerSource, options);
  const callerBase = new Contract(callerArtifact, [1n, token.lockingBytecode], { provider });
  const callerSetup = await setupStatefulUtxos(provider, callerBase, callerArtifact.stateLayout!, {});
  const caller = callerBase.withCategory(hexToBin(callerSetup.categoryId));
  const from = hexToBin('31'.repeat(20));
  const first = aliasMode === 'shared-first' ? from : hexToBin('32'.repeat(20));
  const second = aliasMode === 'repeated-recipient' ? first : hexToBin('33'.repeat(20));
  const balanceRows = [...new Map([from, first, second].map((key) => [
    binToHex(keyToSlot(key)), { slot: keyToSlot(key), value: binToHex(key) === binToHex(from) ? 100n : 0n },
    // The covenant orders slots with OP_BIN2NUM + OP_LESSTHAN, i.e. as little-endian VM numbers. Sorting the
    // bytes lexicographically would build a linked list the sorted-list invariant rejects.
  ] as const)).values()]
    .sort((left, right) => Number(bytesToSlotValue(left.slot) - bytesToSlotValue(right.slot)));
  const balanceCommitments = new Map(balanceRows.map((row, index) => [
    binToHex(row.slot),
    encodeEntryCommitment(
      row.slot,
      balanceRows[index + 1]?.slot ?? new Uint8Array(32),
      bigIntToVmNumber(row.value),
    ),
  ]));
  // `Contract.lockingBytecode` is hex; the covenant hashes the raw script bytes, so the spender key must be
  // decoded before it reaches the slot derivation.
  const allowanceSlot = keyToSlotMulti([from, hexToBin(caller.lockingBytecode)]);
  const allowanceCommitment = encodeEntryCommitment(
    allowanceSlot, new Uint8Array(32), bigIntToVmNumber(50n),
  );
  const balanceEntryByKey = new Map([from, first, second].map((key) => [binToHex(key), randomUtxo({
    satoshis: 10000n,
    token: {
      category: tokenSetup.categoryId,
      amount: 0n,
      nft: {
        capability: 'mutable' as const,
        commitment: binToHex(balanceCommitments.get(binToHex(keyToSlot(key)))!),
      },
    },
  })]));
  const allowanceEntry = randomUtxo({
        satoshis: 10000n,
        token: {
          category: tokenSetup.categoryId,
          amount: 0n,
          nft: { capability: 'mutable', commitment: binToHex(allowanceCommitment) },
        },
      });
  // Logical journal order remains [from-balance, allowance, row0-recipient, row1-recipient]. Duplicate logical
  // identities occupy balanced funding slots; only their first occurrence co-spends the physical entry NFT.
  const logicalKeys = [from, undefined, first, second] as const;
  const firstLogicalSlot = new Map<string, number>();
  const entries = logicalKeys.map((key, slot) => {
    if (key === undefined) return allowanceEntry;
    const hex = binToHex(key);
    if (!firstLogicalSlot.has(hex)) {
      firstLogicalSlot.set(hex, slot);
      return balanceEntryByKey.get(hex)!;
    }
    return randomUtxo({ satoshis: 1000n });
  });
  await provider.addUtxo(
    getEntryNftAddress(token, tokenSetup.categoryId, 'balances'), balanceEntryByKey.get(binToHex(from))!,
  );
  await provider.addUtxo(
    getEntryNftAddress(token, tokenSetup.categoryId, 'allowance'), allowanceEntry,
  );
  for (const [key, entry] of balanceEntryByKey) {
    if (key === binToHex(from)) continue;
    await provider.addUtxo(getEntryNftAddress(token, tokenSetup.categoryId, 'balances'), entry);
  }
  const plan = layer3.planCompiledGraph([
    { artifact: callerArtifact, lockingBytecode: caller.lockingBytecode },
    { artifact: tokenArtifact, lockingBytecode: token.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'route', args: [from, first, second, 10n, 20n] },
    { parent: 0, callee: 1, function: 'transferFrom', args: [from, first, 10n] },
    { parent: 0, callee: 1, function: 'transferFrom', args: [from, second, 20n] },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, ['', ''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const projectionUtxos = [randomUtxo({ satoshis: 1000n }), randomUtxo({ satoshis: 1000n })];
  const fee = randomUtxo({ satoshis: 50000n });
  for (const proof of projectionUtxos) await provider.addUtxo(projection.address, proof);
  for (const entry of entries) if (!entry.token) await provider.addUtxo(p2pkh.address, entry);
  await provider.addUtxo(p2pkh.address, fee);
  const callerRoute = caller.createCompilerRouteUnlocker(
    callerArtifact.hiddenBatch!.route, hexToBin(callerArtifact.hiddenBatch!.selector),
  );
  const tokenRoute = token.createCompilerRouteUnlocker(
    tokenArtifact.hiddenBatch!.route, hexToBin(tokenArtifact.hiddenBatch!.selector),
  );
  const tokenInternalWitnesses: FunctionArgument[] = [];
  // C2 batch groups follow the wrapper's journal order: allowance[from][spender], balances[from], then
  // balances[to] once per row. `entries` is laid out [from-balance, allowance, first, second]. Entry inputs are
  // addressed by an explicit per-group offset, but the write-backs are positional (activeInputIndex + 1 + group),
  // so the settled outputs have to be emitted in this same order.
  const journalOrder = [1, 0, 2, 3];
  for (const routeSlot of journalOrder) {
    const entry = entries[routeSlot];
    if (!entry.token) {
      const key = logicalKeys[routeSlot]!;
      const ownerSlot = firstLogicalSlot.get(binToHex(key))!;
      tokenInternalWitnesses.push(
        keyToSlot(key), BigInt(journalOrder.indexOf(ownerSlot) + 1), new Uint8Array(32),
        forgeAliasWitness === 'omit-sentinel' ? -1n : -2n,
      );
      continue;
    }
    const decoded = decodeEntryCommitment(hexToBin(entry.token!.nft!.commitment));
    tokenInternalWitnesses.push(
      decoded.slot, BigInt(journalOrder.indexOf(routeSlot) + 1), decoded.nextKey,
      forgeAliasWitness === 'false-sentinel' && routeSlot === 2 ? -2n : -1n,
    );
  }
  tokenInternalWitnesses.push(0n);
  const tokenRouteArgs = graphRouteArgsWithInternalTail(
    transcript, 1, layout.controllerInput, tokenInternalWitnesses,
  );
  if (forgeCallerWitness) replaceGraphRouteArg(
    transcript, 1, tokenRouteArgs, '__scb_key_allowance_sender_1', hexToBin(token.lockingBytecode),
  );
  const logicalBalances = new Map([[binToHex(from), 100n]]);
  for (const [recipient, amount] of [[first, 10n], [second, 20n]] as const) {
    const fromKey = binToHex(from);
    const recipientKey = binToHex(recipient);
    logicalBalances.set(fromKey, logicalBalances.get(fromKey)! - amount);
    logicalBalances.set(recipientKey, (logicalBalances.get(recipientKey) ?? 0n) + amount);
  }
  const nextBalances = new Map([...logicalBalances].map(([key, value]) => [
    binToHex(keyToSlot(hexToBin(key))), bigIntToVmNumber(value),
  ]));
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    callerSetup.masterUtxo,
    callerRoute(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(
    tokenSetup.masterUtxo,
    tokenRoute(...tokenRouteArgs as any),
  );
  // Every entry is authorized by co-spending the token master, which this graph places at input 1.
  journalOrder.forEach((slotIndex) => {
    const entry = entries[slotIndex];
    if (!entry.token) tx.addInput(entry, p2pkh.unlock.spend(alicePub, signature()));
    else tx.addInput(entry, createEntryNftUnlocker(
      token, 1, tokenSetup.categoryId, slotIndex === 1 ? 'allowance' : 'balances',
    ));
  });
  projectionUtxos.forEach((proof, participant) =>
    tx.addInput(proof, projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
    )));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: caller.tokenAddress, amount: callerSetup.masterUtxo.satoshis,
    token: {
      category: callerSetup.categoryId, amount: 0n,
      nft: { capability: 'minting', commitment: '' },
    },
  });
  tx.addOutput({
    to: token.tokenAddress, amount: tokenSetup.masterUtxo.satoshis,
    token: {
      category: tokenSetup.categoryId, amount: 0n,
      nft: { capability: 'minting', commitment: '' },
    },
  });
  for (const slotIndex of journalOrder) {
    const entry = entries[slotIndex];
    if (!entry.token) {
      tx.addOutput({ to: p2pkh.address, amount: entry.satoshis });
      continue;
    }
    const decoded = decodeEntryCommitment(hexToBin(entry.token!.nft!.commitment));
    const value = slotIndex === 1
      ? bigIntToVmNumber(20n)
      : nextBalances.get(binToHex(decoded.slot))!;
    tx.addOutput({
      to: getEntryNftAddress(token, tokenSetup.categoryId, slotIndex === 1 ? 'allowance' : 'balances'),
      amount: entry.satoshis,
      token: {
        category: tokenSetup.categoryId, amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: binToHex(encodeEntryCommitment(decoded.slot, decoded.nextKey, value)),
        },
      },
    });
  }
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10000n });
  const tokenInputBytes = tx.buildLibauthTransaction().inputs[1].unlockingBytecode.length;
  return {
    provider, transaction: raw(tx), layout, tokenInputBytes, builder: tx,
  };
}

async function buildCallerKeyedTransferGraph(forgeCallerWitness = false, staticFirst = false) {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  // Standard ERC-20 `transfer`: the debited balance is keyed by the caller itself, with no spender parameter
  // anywhere in the signature. The shared key alternative is caller-keyed and the recipient is row-local.
  const tokenArtifact = compileString(`pragma solidcash >=0.8.0;
    contract GraphTransferToken() {
      mapping(address => bigint) balances;
      function transfer(address to, bigint amount) public {
        require(this.balances[msg.sender] >= amount);
        this.balances[msg.sender] = this.balances[msg.sender] - amount;
        this.balances[to] = this.balances[to] + amount;
      }
    }`, options);
  const tokenBase = new Contract(tokenArtifact, [], { provider });
  const tokenSetup = await setupStatefulUtxos(provider, tokenBase, tokenArtifact.stateLayout!, {});
  const token = tokenBase.withCategory(hexToBin(tokenSetup.categoryId));
  let callerSource = `pragma solidcash >=0.8.0;
    interface IGraphTransferToken {
      function transfer(address to, bigint amount);
    }
    contract GraphTransferRouter(int brand, address token) {
      function route(address first, address second, bigint firstAmount, bigint secondAmount) public {
        IGraphTransferToken(token).transfer(first, firstAmount);
        IGraphTransferToken(token).transfer(second, secondAmount);
        require(true);
      }
    }`;
  if (staticFirst) callerSource = callerSource.replace(
    'IGraphTransferToken(token).transfer(first, firstAmount);',
    'IGraphTransferToken(token).transfer.staticcall(first, firstAmount);',
  );
  const callerArtifact = compileString(callerSource, options);
  const callerBase = new Contract(callerArtifact, [1n, token.lockingBytecode], { provider });
  const callerSetup = await setupStatefulUtxos(provider, callerBase, callerArtifact.stateLayout!, {});
  const caller = callerBase.withCategory(hexToBin(callerSetup.categoryId));
  // The debited holder is the router itself - that is what caller-authorized means here.
  const holder = hexToBin(caller.lockingBytecode);
  const first = hexToBin(`aa20${'32'.repeat(32)}87`);
  const second = hexToBin(`aa20${'33'.repeat(32)}87`);
  const balanceRows = [
    { key: holder, value: 100n },
    { key: first, value: 0n },
    { key: second, value: 0n },
  ].map((row) => ({ ...row, slot: keyToSlot(row.key) }))
    .sort((left, right) => Number(bytesToSlotValue(left.slot) - bytesToSlotValue(right.slot)));
  const commitments = new Map(balanceRows.map((row, index) => [
    binToHex(row.slot),
    encodeEntryCommitment(
      row.slot, balanceRows[index + 1]?.slot ?? new Uint8Array(32), bigIntToVmNumber(row.value),
    ),
  ]));
  // Journal order: balances[msg.sender] is read first, then balances[to] once per row.
  const entryKeys = [holder, first, second];
  const entries = entryKeys.map((key) => randomUtxo({
    satoshis: 10000n,
    token: {
      category: tokenSetup.categoryId,
      amount: 0n,
      nft: { capability: 'mutable' as const, commitment: binToHex(commitments.get(binToHex(keyToSlot(key)))!) },
    },
  }));
  for (const entry of entries) {
    await provider.addUtxo(getEntryNftAddress(token, tokenSetup.categoryId, 'balances'), entry);
  }
  const plan = layer3.planCompiledGraph([
    { artifact: callerArtifact, lockingBytecode: caller.lockingBytecode },
    { artifact: tokenArtifact, lockingBytecode: token.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'route', args: [first, second, 10n, 20n] },
    { parent: 0, callee: 1, function: 'transfer', args: [first, 10n],
      ...(staticFirst && { callMode: 'staticcall' as const }) },
    { parent: 0, callee: 1, function: 'transfer', args: [second, 20n],
      ...(staticFirst && { callMode: 'call' as const }) },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, ['', ''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const projectionUtxos = [randomUtxo({ satoshis: 1000n }), randomUtxo({ satoshis: 1000n })];
  const fee = randomUtxo({ satoshis: 50000n });
  for (const proof of projectionUtxos) await provider.addUtxo(projection.address, proof);
  await provider.addUtxo(p2pkh.address, fee);
  const callerRoute = caller.createCompilerRouteUnlocker(
    callerArtifact.hiddenBatch!.route, hexToBin(callerArtifact.hiddenBatch!.selector),
  );
  const tokenRoute = token.createCompilerRouteUnlocker(
    tokenArtifact.hiddenBatch!.route, hexToBin(tokenArtifact.hiddenBatch!.selector),
  );
  const tokenInternalWitnesses: FunctionArgument[] = [];
  entries.forEach((entry, slotIndex) => {
    const decoded = decodeEntryCommitment(hexToBin(entry.token!.nft!.commitment));
    tokenInternalWitnesses.push(decoded.slot, BigInt(slotIndex + 1), decoded.nextKey, -1n);
  });
  tokenInternalWitnesses.push(0n);
  const tokenRouteArgs = graphRouteArgsWithInternalTail(
    transcript, 1, layout.controllerInput, tokenInternalWitnesses,
  );
  if (forgeCallerWitness) replaceGraphRouteArg(
    transcript, 1, tokenRouteArgs, '__scb_key_balances_sender_0', hexToBin(token.lockingBytecode),
  );
  const nextValues = new Map([
    [binToHex(keyToSlot(holder)), 70n], [binToHex(keyToSlot(first)), 10n], [binToHex(keyToSlot(second)), 20n],
  ]);
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    callerSetup.masterUtxo,
    callerRoute(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(tokenSetup.masterUtxo, tokenRoute(...tokenRouteArgs as any));
  entries.forEach((entry) =>
    tx.addInput(entry, createEntryNftUnlocker(token, 1, tokenSetup.categoryId, 'balances')));
  projectionUtxos.forEach((proof, participant) =>
    tx.addInput(proof, projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
    )));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: caller.tokenAddress,
    amount: callerSetup.masterUtxo.satoshis,
    token: { category: callerSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: token.tokenAddress,
    amount: tokenSetup.masterUtxo.satoshis,
    token: { category: tokenSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  for (const entry of entries) {
    const decoded = decodeEntryCommitment(hexToBin(entry.token!.nft!.commitment));
    tx.addOutput({
      to: getEntryNftAddress(token, tokenSetup.categoryId, 'balances'),
      amount: entry.satoshis,
      token: {
        category: tokenSetup.categoryId,
        amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: binToHex(encodeEntryCommitment(
            decoded.slot, decoded.nextKey, bigIntToVmNumber(nextValues.get(binToHex(decoded.slot))!),
          )),
        },
      },
    });
  }
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10000n });
  const tokenInputBytes = tx.buildLibauthTransaction().inputs[1].unlockingBytecode.length;
  return { provider, transaction: raw(tx), layout, tokenInputBytes };
}

async function buildCallerKeyedApproveGraph(forgeCallerWitness = false) {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  // Standard ERC-20 `approve`: a write-only nested collection keyed by the caller. This shape used to fail code
  // generation outright, because the dynamic row parser cannot resolve a composite key against a runtime row.
  const tokenArtifact = compileString(`pragma solidcash >=0.8.0;
    contract GraphApproveToken() {
      mapping(address => mapping(address => bigint)) allowance;
      function approve(address spender, bigint amount) public {
        this.allowance[msg.sender][spender] = amount;
        require(amount >= 0);
      }
    }`, options);
  const tokenBase = new Contract(tokenArtifact, [], { provider });
  const tokenSetup = await setupStatefulUtxos(provider, tokenBase, tokenArtifact.stateLayout!, {});
  const token = tokenBase.withCategory(hexToBin(tokenSetup.categoryId));
  const callerArtifact = compileString(`pragma solidcash >=0.8.0;
    interface IGraphApproveToken { function approve(address spender, bigint amount); }
    contract GraphApproveRouter(int brand, address token) {
      function route(address spender, bigint amount) public {
        IGraphApproveToken(token).approve(spender, amount);
        require(true);
      }
    }`, options);
  const callerBase = new Contract(callerArtifact, [1n, token.lockingBytecode], { provider });
  const callerSetup = await setupStatefulUtxos(provider, callerBase, callerArtifact.stateLayout!, {});
  const caller = callerBase.withCategory(hexToBin(callerSetup.categoryId));
  const spender = hexToBin(`aa20${'44'.repeat(32)}87`);
  // The router is both the graph caller and the allowance owner, so the entry slot is only derivable once its
  // branded locking bytecode exists - hence the entry is seeded after both contracts are branded.
  const slot = keyToSlotMulti([hexToBin(caller.lockingBytecode), spender]);
  const entryAddress = getEntryNftAddress(token, tokenSetup.categoryId, 'allowance');
  const entry = randomUtxo({
    satoshis: 10000n,
    token: {
      category: tokenSetup.categoryId,
      amount: 0n,
      nft: {
        capability: 'mutable' as const,
        commitment: binToHex(encodeEntryCommitment(slot, new Uint8Array(32), bigIntToVmNumber(0n))),
      },
    },
  });
  await provider.addUtxo(entryAddress, entry);
  const decoded = decodeEntryCommitment(hexToBin(entry.token!.nft!.commitment));
  const plan = layer3.planCompiledGraph([
    { artifact: callerArtifact, lockingBytecode: caller.lockingBytecode },
    { artifact: tokenArtifact, lockingBytecode: token.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'route', args: [spender, 25n] },
    { parent: 0, callee: 1, function: 'approve', args: [spender, 25n] },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, ['', ''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const projectionUtxos = [randomUtxo({ satoshis: 1000n }), randomUtxo({ satoshis: 1000n })];
  const fee = randomUtxo({ satoshis: 50000n });
  for (const proof of projectionUtxos) await provider.addUtxo(projection.address, proof);
  await provider.addUtxo(p2pkh.address, fee);
  const callerRoute = caller.createCompilerRouteUnlocker(
    callerArtifact.hiddenBatch!.route, hexToBin(callerArtifact.hiddenBatch!.selector),
  );
  const tokenRoute = token.createCompilerRouteUnlocker(
    tokenArtifact.hiddenBatch!.route, hexToBin(tokenArtifact.hiddenBatch!.selector),
  );
  const tokenRouteArgs = [
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput),
  ] as FunctionArgument[];
  // Route inputs 7 and 8 are `__scb_key_allowance_1` (the spender argument) and
  // `__scb_key_allowance_sender_0` (the owner key the route ties to the authenticated caller).
  if (forgeCallerWitness) tokenRouteArgs[8] = hexToBin(token.lockingBytecode);
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    callerSetup.masterUtxo,
    callerRoute(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(tokenSetup.masterUtxo, tokenRoute(...tokenRouteArgs as any));
  tx.addInput(entry, createEntryNftUnlocker(token, 1, tokenSetup.categoryId, 'allowance'));
  projectionUtxos.forEach((proof, participant) =>
    tx.addInput(proof, projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
    )));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: caller.tokenAddress,
    amount: callerSetup.masterUtxo.satoshis,
    token: { category: callerSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: token.tokenAddress,
    amount: tokenSetup.masterUtxo.satoshis,
    token: { category: tokenSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: entryAddress,
    amount: entry.satoshis,
    token: {
      category: tokenSetup.categoryId,
      amount: 0n,
      nft: {
        capability: 'mutable',
        commitment: binToHex(encodeEntryCommitment(decoded.slot, decoded.nextKey, bigIntToVmNumber(25n))),
      },
    },
  });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10000n });
  return { provider, transaction: raw(tx), layout };
}

async function buildMultiArgEventGraph(mode: 'honest' | 'swapped' | 'foreign-topic' = 'honest') {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const artifact = compileString(`pragma solidcash >=0.8.0;
    contract MultiArgEvent() {
      bigint total;
      event Moved(bigint from, bigint to, bigint amount);
      // A second declared event of identical arity: publishing under its topic keeps the payload and the NFT
      // shape valid, so only the covenant's topic binding can reject it.
      event Shadowed(bigint from, bigint to, bigint amount);
      function go(bigint from, bigint to, bigint amount) public {
        this.total = this.total + amount;
        emit Moved(from, to, amount);
        require(amount >= 0);
      }
    }`, {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  });
  const base = new Contract(artifact, [], { provider });
  const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, { total: 0n });
  const contract = base.withCategory(hexToBin(setup.categoryId));
  const args = [3n, 4n, 5n];
  const plan = layer3.planCompiledGraph([
    { artifact, lockingBytecode: contract.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'go', args },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, [''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const eventFunding = Array.from({ length: 8 }, () => randomUtxo({ satoshis: 1000n }));
  const projectionUtxo = randomUtxo({ satoshis: 1000n });
  const fee = randomUtxo({ satoshis: 50000n });
  for (const funding of eventFunding) await provider.addUtxo(p2pkh.address, funding);
  await provider.addUtxo(projection.address, projectionUtxo);
  await provider.addUtxo(p2pkh.address, fee);
  const route = contract.createCompilerRouteUnlocker(
    artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    setup.masterUtxo,
    route(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(
    setup.dataNftUtxos[0],
    createDataNftUnlocker(contract, layout.participantInputs[0], setup.categoryId),
  );
  eventFunding.forEach((funding) => tx.addInput(funding, p2pkh.unlock.spend(alicePub, signature())));
  tx.addInput(
    projectionUtxo,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 0n),
  );
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: contract.tokenAddress,
    amount: setup.masterUtxo.satoshis,
    token: { category: setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: getDataNftAddress(contract, setup.categoryId),
    amount: setup.dataNftUtxos[0].satoshis,
    token: {
      category: setup.categoryId,
      amount: 0n,
      nft: {
        capability: 'mutable',
        commitment: buildInitialStateCommitments(artifact.stateLayout!, { total: 5n })[0],
      },
    },
  });
  // The three arguments are one ordered data payload; swapping two of them keeps the length and the topic
  // identical, so only exact per-argument binding can reject it.
  const payload = mode === 'swapped' ? [4n, 3n, 5n] : args;
  const eventSignature = artifact.events![0].signature;
  tx.addOutput({
    to: mode === 'foreign-topic'
      ? getEventNftAddress(contract, setup.categoryId, artifact.events![1].signature)
      : getEventNftAddress(contract, setup.categoryId, eventSignature),
    amount: 1000n,
    token: {
      category: setup.categoryId,
      amount: 0n,
      nft: {
        capability: 'none',
        commitment: binToHex(scriptToBytecode(payload.map((value) => bigIntToVmNumber(value)))),
      },
    },
  });
  for (let slot = 3; slot < 10; slot += 1) tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10000n });
  return { provider, transaction: raw(tx), layout };
}

async function buildMixedHandlerBatchGraph(mode: 'honest' | 'forge-second-row' = 'honest') {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  // Two DIFFERENT handlers over one collection in one owner batch: the ordered mix Release B admits. `move` is
  // resource-shaped (shared `from`, row-local `to`); `bump` keys only the shared entry. Both must resolve onto
  // the same three physical entries.
  const tokenArtifact = compileString(`pragma solidcash >=0.8.0;
    contract MixedBatchToken() {
      mapping(address => bigint) balances;
      function move(address from, address to, bigint amount) public {
        this.balances[from] = this.balances[from] - amount;
        this.balances[to] = this.balances[to] + amount;
        require(amount >= 0);
      }
      function bump(address who, bigint amount) public {
        this.balances[who] = this.balances[who] + amount;
        require(amount >= 0);
      }
    }`, options);
  const tokenBase = new Contract(tokenArtifact, [], { provider });
  const tokenSetup = await setupStatefulUtxos(provider, tokenBase, tokenArtifact.stateLayout!, {});
  const token = tokenBase.withCategory(hexToBin(tokenSetup.categoryId));
  const callerArtifact = compileString(`pragma solidcash >=0.8.0;
    interface IMixedBatchToken {
      function move(address from, address to, bigint amount);
      function bump(address who, bigint amount);
    }
    contract MixedBatchRouter(int brand, address token) {
      function route(address shared, address recipient, bigint moved, bigint bumped) public {
        IMixedBatchToken(token).move(shared, recipient, moved);
        IMixedBatchToken(token).bump(shared, bumped);
        require(true);
      }
    }`, options);
  const callerBase = new Contract(callerArtifact, [1n, token.lockingBytecode], { provider });
  const callerSetup = await setupStatefulUtxos(provider, callerBase, callerArtifact.stateLayout!, {});
  const caller = callerBase.withCategory(hexToBin(callerSetup.categoryId));

  const shared = hexToBin(`aa20${'81'.repeat(32)}87`);
  const recipient = hexToBin(`aa20${'82'.repeat(32)}87`);
  const spare = hexToBin(`aa20${'83'.repeat(32)}87`);
  const rows = [
    { key: shared, value: 100n },
    { key: recipient, value: 0n },
    { key: spare, value: 7n },
  ].map((row) => ({ ...row, slot: keyToSlot(row.key) }))
    .sort((left, right) => Number(bytesToSlotValue(left.slot) - bytesToSlotValue(right.slot)));
  const commitments = new Map(rows.map((row, index) => [
    binToHex(row.slot),
    encodeEntryCommitment(
      row.slot, rows[index + 1]?.slot ?? new Uint8Array(32), bigIntToVmNumber(row.value),
    ),
  ]));
  // Journal order: the shared entry, then the row-local entry per row. Row 1 is `bump`, which has no row-local
  // key, so the third slot is an entry no row touches and must settle unchanged.
  const entryKeys = [shared, recipient, spare];
  const entries = entryKeys.map((key) => randomUtxo({
    satoshis: 10000n,
    token: {
      category: tokenSetup.categoryId,
      amount: 0n,
      nft: {
        capability: 'mutable' as const,
        commitment: binToHex(commitments.get(binToHex(keyToSlot(key)))!),
      },
    },
  }));
  for (const entry of entries) {
    await provider.addUtxo(getEntryNftAddress(token, tokenSetup.categoryId, 'balances'), entry);
  }
  const plan = layer3.planCompiledGraph([
    { artifact: callerArtifact, lockingBytecode: caller.lockingBytecode },
    {
      artifact: tokenArtifact,
      lockingBytecode: token.lockingBytecode,
      // Row 1 is `bump`, which binds only the shared entry, so the row-local slot for that row names an entry
      // no row touches. It still has to address a real entry and settle unchanged.
      unboundRouteWitnesses: { __scb_key_balances_0_row_r1: spare },
    },
  ], [
    { parent: null, callee: 0, function: 'route', args: [shared, recipient, 10n, 5n] },
    { parent: 0, callee: 1, function: 'move', args: [shared, recipient, 10n] },
    { parent: 0, callee: 1, function: 'bump', args: [shared, 5n] },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, ['', ''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const projectionUtxos = [randomUtxo({ satoshis: 1000n }), randomUtxo({ satoshis: 1000n })];
  const fee = randomUtxo({ satoshis: 50000n });
  for (const proof of projectionUtxos) await provider.addUtxo(projection.address, proof);
  await provider.addUtxo(p2pkh.address, fee);
  const callerRoute = caller.createCompilerRouteUnlocker(
    callerArtifact.hiddenBatch!.route, hexToBin(callerArtifact.hiddenBatch!.selector),
  );
  const tokenRoute = token.createCompilerRouteUnlocker(
    tokenArtifact.hiddenBatch!.route, hexToBin(tokenArtifact.hiddenBatch!.selector),
  );
  const tokenInternalWitnesses: FunctionArgument[] = [];
  entries.forEach((entry, slotIndex) => {
    const decoded = decodeEntryCommitment(hexToBin(entry.token!.nft!.commitment));
    tokenInternalWitnesses.push(decoded.slot, BigInt(slotIndex + 1), decoded.nextKey, -1n);
  });
  tokenInternalWitnesses.push(0n);
  const tokenRouteArgs = graphRouteArgsWithInternalTail(
    transcript, 1, layout.controllerInput, tokenInternalWitnesses,
  );
  // shared: 100 - 10 (move) + 5 (bump) = 95; recipient: 0 + 10 = 10; spare untouched.
  const settled = new Map([
    [binToHex(keyToSlot(shared)), mode === 'forge-second-row' ? 100n - 10n : 95n],
    [binToHex(keyToSlot(recipient)), 10n],
    [binToHex(keyToSlot(spare)), 7n],
  ]);
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    callerSetup.masterUtxo,
    callerRoute(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(tokenSetup.masterUtxo, tokenRoute(...tokenRouteArgs as any));
  entries.forEach((entry) =>
    tx.addInput(entry, createEntryNftUnlocker(token, 1, tokenSetup.categoryId, 'balances')));
  projectionUtxos.forEach((proof, participant) =>
    tx.addInput(proof, projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
    )));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: caller.tokenAddress,
    amount: callerSetup.masterUtxo.satoshis,
    token: { category: callerSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: token.tokenAddress,
    amount: tokenSetup.masterUtxo.satoshis,
    token: { category: tokenSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  for (const entry of entries) {
    const decoded = decodeEntryCommitment(hexToBin(entry.token!.nft!.commitment));
    tx.addOutput({
      to: getEntryNftAddress(token, tokenSetup.categoryId, 'balances'),
      amount: entry.satoshis,
      token: {
        category: tokenSetup.categoryId,
        amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: binToHex(encodeEntryCommitment(
            decoded.slot, decoded.nextKey, bigIntToVmNumber(settled.get(binToHex(decoded.slot))!),
          )),
        },
      },
    });
  }
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10000n });
  return { provider, transaction: raw(tx), layout };
}

async function buildScalarPlusEntryBatchGraph(
  mode: 'honest' | 'forge-scalar' | 'forge-entry' = 'honest',
) {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  // A resource-shaped handler that ALSO writes scalar state, so one batch drives both the scalar journal and
  // the collection journal. This is the shape `scalar-write-with-collection-delete-not-enabled` was suspected
  // of really covering; if it settles, that boundary is delete-specific rather than a general two-journal fault.
  const tokenArtifact = compileString(`pragma solidcash >=0.8.0;
    contract ScalarPlusEntryToken() {
      bigint moves;
      mapping(address => bigint) balances;
      function move(address from, address to, bigint amount) public {
        this.moves = this.moves + 1;
        this.balances[from] = this.balances[from] - amount;
        this.balances[to] = this.balances[to] + amount;
        require(amount >= 0);
      }
    }`, options);
  const tokenBase = new Contract(tokenArtifact, [], { provider });
  const tokenSetup = await setupStatefulUtxos(provider, tokenBase, tokenArtifact.stateLayout!, { moves: 0n });
  const token = tokenBase.withCategory(hexToBin(tokenSetup.categoryId));
  const callerArtifact = compileString(`pragma solidcash >=0.8.0;
    interface IScalarPlusEntryToken { function move(address from, address to, bigint amount); }
    contract ScalarPlusEntryRouter(int brand, address token) {
      function route(address shared, address first, address second, bigint a, bigint b) public {
        IScalarPlusEntryToken(token).move(shared, first, a);
        IScalarPlusEntryToken(token).move(shared, second, b);
        require(true);
      }
    }`, options);
  const callerBase = new Contract(callerArtifact, [1n, token.lockingBytecode], { provider });
  const callerSetup = await setupStatefulUtxos(provider, callerBase, callerArtifact.stateLayout!, {});
  const caller = callerBase.withCategory(hexToBin(callerSetup.categoryId));

  const shared = hexToBin(`aa20${'91'.repeat(32)}87`);
  const first = hexToBin(`aa20${'92'.repeat(32)}87`);
  const second = hexToBin(`aa20${'93'.repeat(32)}87`);
  const rows = [
    { key: shared, value: 100n }, { key: first, value: 0n }, { key: second, value: 0n },
  ].map((row) => ({ ...row, slot: keyToSlot(row.key) }))
    .sort((left, right) => Number(bytesToSlotValue(left.slot) - bytesToSlotValue(right.slot)));
  const commitments = new Map(rows.map((row, index) => [
    binToHex(row.slot),
    encodeEntryCommitment(row.slot, rows[index + 1]?.slot ?? new Uint8Array(32), bigIntToVmNumber(row.value)),
  ]));
  const entryKeys = [shared, first, second];
  const entries = entryKeys.map((key) => randomUtxo({
    satoshis: 10000n,
    token: {
      category: tokenSetup.categoryId,
      amount: 0n,
      nft: {
        capability: 'mutable' as const,
        commitment: binToHex(commitments.get(binToHex(keyToSlot(key)))!),
      },
    },
  }));
  for (const entry of entries) {
    await provider.addUtxo(getEntryNftAddress(token, tokenSetup.categoryId, 'balances'), entry);
  }
  const plan = layer3.planCompiledGraph([
    { artifact: callerArtifact, lockingBytecode: caller.lockingBytecode },
    { artifact: tokenArtifact, lockingBytecode: token.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'route', args: [shared, first, second, 10n, 5n] },
    { parent: 0, callee: 1, function: 'move', args: [shared, first, 10n] },
    { parent: 0, callee: 1, function: 'move', args: [shared, second, 5n] },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, ['', ''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const projectionUtxos = [randomUtxo({ satoshis: 1000n }), randomUtxo({ satoshis: 1000n })];
  const fee = randomUtxo({ satoshis: 50000n });
  for (const proof of projectionUtxos) await provider.addUtxo(projection.address, proof);
  await provider.addUtxo(p2pkh.address, fee);
  const callerRoute = caller.createCompilerRouteUnlocker(
    callerArtifact.hiddenBatch!.route, hexToBin(callerArtifact.hiddenBatch!.selector),
  );
  const tokenRoute = token.createCompilerRouteUnlocker(
    tokenArtifact.hiddenBatch!.route, hexToBin(tokenArtifact.hiddenBatch!.selector),
  );
  const tokenInternalWitnesses: FunctionArgument[] = [];
  entries.forEach((entry, slotIndex) => {
    const decoded = decodeEntryCommitment(hexToBin(entry.token!.nft!.commitment));
    tokenInternalWitnesses.push(decoded.slot, BigInt(slotIndex + 2), decoded.nextKey, -1n);
  });
  tokenInternalWitnesses.push(0n);
  const tokenRouteArgs = graphRouteArgsWithInternalTail(
    transcript, 1, layout.controllerInput, tokenInternalWitnesses,
  );
  const settled = new Map([
    [binToHex(keyToSlot(shared)), 85n], [binToHex(keyToSlot(first)), 10n], [binToHex(keyToSlot(second)), 5n],
  ]);
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    callerSetup.masterUtxo,
    callerRoute(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(tokenSetup.masterUtxo, tokenRoute(...tokenRouteArgs as any));
  tx.addInput(
    tokenSetup.dataNftUtxos[0],
    createDataNftUnlocker(token, layout.participantInputs[1], tokenSetup.categoryId),
  );
  entries.forEach((entry) =>
    tx.addInput(entry, createEntryNftUnlocker(token, 1, tokenSetup.categoryId, 'balances')));
  projectionUtxos.forEach((proof, participant) =>
    tx.addInput(proof, projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
    )));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: caller.tokenAddress,
    amount: callerSetup.masterUtxo.satoshis,
    token: { category: callerSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: token.tokenAddress,
    amount: tokenSetup.masterUtxo.satoshis,
    token: { category: tokenSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: getDataNftAddress(token, tokenSetup.categoryId),
    amount: tokenSetup.dataNftUtxos[0].satoshis,
    token: {
      category: tokenSetup.categoryId,
      amount: 0n,
      nft: {
        capability: 'mutable',
        commitment: buildInitialStateCommitments(
          tokenArtifact.stateLayout!, { moves: mode === 'forge-scalar' ? 1n : 2n },
        )[0],
      },
    },
  });
  for (const entry of entries) {
    const decoded = decodeEntryCommitment(hexToBin(entry.token!.nft!.commitment));
    tx.addOutput({
      to: getEntryNftAddress(token, tokenSetup.categoryId, 'balances'),
      amount: entry.satoshis,
      token: {
        category: tokenSetup.categoryId,
        amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: binToHex(encodeEntryCommitment(
            decoded.slot,
            decoded.nextKey,
            bigIntToVmNumber(
              mode === 'forge-entry' && binToHex(decoded.slot) === binToHex(keyToSlot(first))
                ? 9n
                : settled.get(binToHex(decoded.slot))!,
            ),
          )),
        },
      },
    });
  }
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10000n });
  return { provider, transaction: raw(tx), layout };
}

describe('Layer-3 compiled graph controller', () => {
  const scriptRefusalAt = (input: number): RegExp => new RegExp(
    `mandatory-script-verify-flag-failed .*error in evaluating input index ${input}:`,
  );

  it('executes a compiler-authenticated received function pointer', async () => {
    const { provider, transaction } = await buildPointerGraph();
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it.each(['selector', 'target'] as const)(
    'rejects a function-pointer %s choice which disagrees with the canonical child row',
    async (tamper) => {
      const { provider, transaction } = await buildPointerGraph(tamper);
      await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(0));
    },
  );

  it('executes a compiler-authenticated pointer returned through an internal helper', async () => {
    const { provider, transaction } = await buildPointerGraph('none', true);
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it.each(['selector', 'target'] as const)(
    'rejects a returned-pointer %s disagreement with the compiler-reduced child row',
    async (tamper) => {
      const { provider, transaction } = await buildPointerGraph(tamper, true);
      await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(0));
    },
  );

  it('executes state-backed function pointers with a different selector in each row', async () => {
    const { provider, transaction } = await buildVaryingSelectorGraph();
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it.each(['selector', 'target'] as const)(
    'rejects a state-backed varying-selector pointer %s disagreement',
    async (tamper) => {
      const { provider, transaction } = await buildVaryingSelectorGraph(tamper);
      await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(0));
    },
  );

  it('composes a heterogeneous callback cycle with state, value, and event effects', async () => {
    const { provider, transaction, plan } = await buildCombinedGraph();
    expect(plan.participants.map((participant) => participant.invocations)).toEqual([[0, 2], [1]]);
    expectRelayable(transaction);
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('composes a callback cycle with state and event effects but no value transfer', async () => {
    const { provider, transaction } = await buildCombinedGraph('none', 'no-transfer');
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('composes a callback cycle with state and value effects but no events', async () => {
    const { provider, transaction } = await buildCombinedGraph('none', 'no-events');
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('composes a callback cycle with event and value effects but no state', async () => {
    const { provider, transaction } = await buildCombinedGraph('none', 'no-state');
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('composes a callback cycle with only a value-transfer effect', async () => {
    const { provider, transaction } = await buildCombinedGraph('none', 'value-only');
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it.each([
    ['state and event', 'no-transfer', 'finish', 'controller'],
    ['event', 'no-state', 'step-chain', 1],
    ['value transfer', 'value-only', 'finish', 'controller'],
    ['same-value state write', 'same-value', 'finish', 0],
  ] as const)('runtime staticcall rejects a reached %s mutation', async (
    _label, variant, invocation, enforcingParticipant,
  ) => {
    const { provider, transaction, plan } = await buildCombinedGraph('none', variant, invocation);
    const layout = layer3.compiledGraphPhysicalLayout(plan);
    const enforcingInput = enforcingParticipant === 'controller'
      ? layout.controllerInput : layout.participantInputs[enforcingParticipant];
    await expect(provider.sendRawTransaction(transaction))
      .rejects.toThrow(scriptRefusalAt(enforcingInput));
  });

  it('runtime staticcall permits an untaken conditional mutation branch', async () => {
    const { provider, transaction } = await buildCombinedGraph(
      'none', 'conditional-untaken', 'finish',
    );
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it.each(['state', 'event', 'value'] as const)(
    'rejects a combined callback graph with a forged %s effect',
    async (tamper) => {
      const { provider, transaction } = await buildCombinedGraph(tamper);
      await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(0));
    },
  );

  it.each([-1, 1] as const)(
    'rejects a callback graph whose PUSHDATA1 batch length is displaced by %s',
    async (delta) => {
      const { provider, transaction } = await buildCombinedGraph();
      const decoded = decodeTransactionUnsafe(hexToBin(transaction));
      const unlocking = decoded.inputs[0].unlockingBytecode;
      expect(unlocking[5]).toBe(76);
      unlocking[6] += delta;
      await expect(provider.sendRawTransaction(binToHex(encodeTransaction(decoded))))
        .rejects.toThrow(scriptRefusalAt(0));
    },
  );

  it('preserves the complete transaction input/output table in transcript mode', async () => {
    const { provider, transaction } = await buildIntrospectionGraph();
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects a transcript row whose expected outpoint differs from the finalized transaction', async () => {
    const { provider, transaction } = await buildIntrospectionGraph(true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(0));
  });

  it('verifies a root-excluded transaction-signature witness on the final graph transaction', async () => {
    const { provider, transaction } = await buildSignedGraph();
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects a transaction-signature witness from a key other than the transcript-bound owner', async () => {
    const { provider, transaction } = await buildSignedGraph(true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(0));
  });

  it('verifies two root-excluded ECDSA witnesses in checkMultiSig', async () => {
    const { provider, transaction } = await buildSignedGraph(false, true);
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects a multisig route witness whose key is absent from the rooted key set', async () => {
    const { provider, transaction } = await buildSignedGraph(true, true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(0));
  });

  it('verifies a canonical root-excluded sig[] witness against rooted owners', async () => {
    const { provider, transaction } = await buildSignedGraph(false, 'array');
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects a sig[] signer absent from the rooted owner vector', async () => {
    const { provider, transaction } = await buildSignedGraph(true, 'array');
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(0));
  });

  it('forwards a root-excluded transaction signature across an authenticated graph edge', async () => {
    const { provider, transaction } = await buildForwardedSignedGraph();
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects a forwarded graph signature from a key other than the child-row owner', async () => {
    const { provider, transaction } = await buildForwardedSignedGraph(true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(1));
  });

  it('executes canonical low-level calldata as an authenticated typed graph edge', async () => {
    const { provider, transaction } = await buildRawCallGraph();
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects substituting the typed result of a low-level graph edge', async () => {
    const { provider, transaction } = await buildRawCallGraph(true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(1));
  });

  it('executes canonical low-level staticcall calldata as an authenticated read-only edge', async () => {
    const { provider, transaction } = await buildRawCallGraph(false, true);
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects substituting the authenticated result of a low-level staticcall edge', async () => {
    const { provider, transaction } = await buildRawCallGraph(true, true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(1));
  });

  it('executes a pinned delegate covenant in the proxy balanced block', async () => {
    const { provider, transaction, proxyArtifact } = await buildDelegateGraph();
    expect(proxyArtifact.hiddenBatch!.route.blockLayout!.slots)
      .toContainEqual({ kind: 'lowLevelCall', offset: 2, slotIndex: 0 });
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects a delegate input selecting calldata other than the transcript-bound payload', async () => {
    const { provider, transaction } = await buildDelegateGraph(true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(0));
  });

  it('rejects a forged proxy post-state computed outside the delegate covenant', async () => {
    const { provider, transaction } = await buildDelegateGraph(false, true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(2));
  });

  it('relocates a delegate proxy behind an independently compiled caller block', async () => {
    const { provider, transaction, layout } = await buildRelocatedDelegateGraph();
    expect(layout.participantInputs).toEqual([0, 1]);
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects a delegate witness pointing outside its adjacent proxy block', async () => {
    const { provider, transaction } = await buildRelocatedDelegateGraph(true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(3));
  });

  it('joins independently compiled application SCB1 routes under one canonical graph', async () => {
    const { provider, transaction } = await build();
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects an application input executing a different locally-valid batch', async () => {
    const { provider, transaction } = await build(true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(1));
  });

  it('rejects a canonical graph whose child arguments differ from the source-executed call', async () => {
    const { provider, transaction } = await build(false, false, false, false, false, false, 2n);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(0));
  });

  it('binds conditional call reachability to the runtime emission cursor', async () => {
    const taken = await build(false, false, false, false, false, false, 1n,
      { take: true, includeChild: true });
    await expect(taken.provider.sendRawTransaction(taken.transaction)).resolves.toBeTypeOf('string');

    const skipped = await build(false, false, false, false, false, false, 1n,
      { take: false, includeChild: false });
    await expect(skipped.provider.sendRawTransaction(skipped.transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects omitted and injected conditional child rows', async () => {
    const omitted = await build(false, false, false, false, false, false, 1n,
      { take: true, includeChild: false });
    await expect(omitted.provider.sendRawTransaction(omitted.transaction)).rejects.toThrow(scriptRefusalAt(0));

    const injected = await build(false, false, false, false, false, false, 1n,
      { take: false, includeChild: true });
    await expect(injected.provider.sendRawTransaction(injected.transaction)).rejects.toThrow(scriptRefusalAt(0));
  });

  it('settles a bounded same-handler recursive closure', async () => {
    const { provider, transaction } = await buildBoundedRecursiveGraph('honest');
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects a forged parent on a bounded recursive row', async () => {
    const { provider, transaction, transcript } = await buildBoundedRecursiveGraph('forged-row');
    const layout = layer3.compiledGraphPhysicalLayout(transcript.plan);
    await expect(provider.sendRawTransaction(transaction))
      .rejects.toThrow(scriptRefusalAt(layout.controllerInput));
  });

  it('consumes one authenticated child row per reached loop iteration', async () => {
    const repeated = await build(false, false, false, false, false, false, 1n, undefined, 2);
    await expect(repeated.provider.sendRawTransaction(repeated.transaction)).resolves.toBeTypeOf('string');
  });

  it('binds a compiler-evaluated call expression to the canonical child row', async () => {
    const exact = await build(
      false, false, false, false, false, false, 1n, undefined, undefined,
      undefined, false, false, false, 7n,
    );
    await expect(exact.provider.sendRawTransaction(exact.transaction)).resolves.toBeTypeOf('string');

    const substituted = await build(
      false, false, false, false, false, false, 1n, undefined, undefined,
      undefined, false, false, false, 8n,
    );
    await expect(substituted.provider.sendRawTransaction(substituted.transaction))
      .rejects.toThrow(scriptRefusalAt(0));
  });

  it('rejects omitting the graph controller even when every local batch remains valid', async () => {
    const { provider, transaction } = await build(false, true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(0));
  });

  it('rejects a root-committed but structurally invalid invocation tree', async () => {
    const { provider, transaction } = await build(false, false, true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(2));
  });

  it('rejects a root-committed participant table above the deployed parser bound', async () => {
    const { provider, transaction } = await build(
      false, false, false, false, false, false, 1n,
      undefined, undefined, undefined, false, false, false, undefined, true,
    );
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(/mandatory-script-verify/);
  });

  it('rejects replacing a participant projection proof with an ordinary funding input', async () => {
    const { provider, transaction } = await build(false, false, false, true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(4));
  });

  it('rejects aliasing two participant projections to one physical proof input', async () => {
    const { provider, transaction } = await build(false, false, false, false, true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(2));
  });

  it('rejects a valid controller covenant carrying a forged token category', async () => {
    const { provider, transaction } = await build(false, false, false, false, false, true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(0));
  });

  it('supplies graph msg.sender from the authenticated parent participant', async () => {
    const { provider, transaction } = await build(
      false, false, false, false, false, false, 1n, undefined, undefined,
      { forgeExpected: false },
    );
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects using a different participant as graph msg.sender', async () => {
    const { provider, transaction } = await build(
      false, false, false, false, false, false, 1n, undefined, undefined,
      { forgeExpected: true },
    );
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(1));
  });

  it('constructs graph msg.data from the authenticated selector and row arguments', async () => {
    const { provider, transaction } = await build(
      false, false, false, false, false, false, 1n, undefined, undefined, undefined, true,
    );
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('commits compiler-derived staticcall mode for a read-only callee', async () => {
    const { provider, transaction } = await build(
      false, false, false, false, false, false, 1n,
      undefined, undefined, undefined, false, true,
    );
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('executes static then ordinary SCB2 rows against one physical participant', async () => {
    const { provider, transaction, transcript } = await build(
      false, false, false, false, false, false, 1n,
      undefined, undefined, undefined, false, false, false, undefined, false, true,
    );
    expect(transcript.plan.invocations.slice(1).map((row) => row.callMode))
      .toEqual(['staticcall', 'call']);
    expect(transcript.plan.participants[1].batch.blob[4]).toBe(2);
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects a transcript block size that differs from the compiler-owned route', async () => {
    const { provider, transaction } = await build(
      false, false, false, false, false, false, 1n,
      undefined, undefined, undefined, false, false, true,
    );
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(0));
  });

  it('authenticates compiler-produced return blobs in balanced owner slots', async () => {
    const {
      provider, transaction, artifactA, artifactB, plan, resultA, resultB,
    } = await buildReturning();
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
    expect(plan.invocations.map((invocation) => invocation.resultDependencies)).toEqual([[1], []]);
    expect(layer3.decodeHiddenBatchResults(artifactA, plan.participants[0].batch, resultA))
      .toEqual([{ row: 0, type: 'int256', value: 5n }]);
    expect(layer3.decodeHiddenBatchResults(artifactB, plan.participants[1].batch, resultB))
      .toEqual([
        { row: 0, type: '(int256,int256)', value: [4n, 12n] },
      ]);
  });

  it('rejects a forged return commitment even when the result NFT is otherwise well formed', async () => {
    const { provider, transaction } = await buildReturning(true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(2));
  });

  it('rejects substitution of a non-leading tuple result field', async () => {
    const { provider, transaction } = await buildReturning(false, true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(2));
  });

  it('authenticates a dynamic bytes result consumed by its parent', async () => {
    const {
      provider, transaction, artifactA, artifactB, plan, resultA, resultB,
    } = await buildReturning(false, false, 'bytes');
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
    expect(plan.invocations.map((invocation) => invocation.resultDependencies)).toEqual([[1], []]);
    expect(layer3.decodeHiddenBatchResults(artifactA, plan.participants[0].batch, resultA))
      .toEqual([{ row: 0, type: 'bytes', value: hexToBin('aabbff') }]);
    expect(layer3.decodeHiddenBatchResults(artifactB, plan.participants[1].batch, resultB))
      .toEqual([{ row: 0, type: 'bytes', value: hexToBin('aabbff') }]);
  });

  it('rejects substitution of a dynamic bytes producer result', async () => {
    const { provider, transaction } = await buildReturning(true, false, 'bytes');
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(2));
  });

  it('authenticates a dynamic string result consumed by its parent', async () => {
    const {
      provider, transaction, artifactA, artifactB, plan, resultA, resultB,
    } = await buildReturning(false, false, 'string');
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
    expect(layer3.decodeHiddenBatchResults(artifactA, plan.participants[0].batch, resultA))
      .toEqual([{ row: 0, type: 'string', value: 'hello!' }]);
    expect(layer3.decodeHiddenBatchResults(artifactB, plan.participants[1].batch, resultB))
      .toEqual([{ row: 0, type: 'string', value: 'hello!' }]);
  });

  it('rejects substitution of a dynamic string producer result', async () => {
    const { provider, transaction } = await buildReturning(true, false, 'string');
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(2));
  });

  it('authenticates a struct result consumed by its parent', async () => {
    const {
      provider, transaction, artifactA, artifactB, plan, resultA, resultB,
    } = await buildReturning(false, false, 'struct');
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
    expect(layer3.decodeHiddenBatchResults(artifactA, plan.participants[0].batch, resultA))
      .toEqual([{ row: 0, type: 'PairResult', value: { n: 3n, ok: true } }]);
    expect(layer3.decodeHiddenBatchResults(artifactB, plan.participants[1].batch, resultB))
      .toEqual([{ row: 0, type: 'PairResult', value: { n: 3n, ok: true } }]);
  });

  it('rejects substitution of either struct result field', async () => {
    const numeric = await buildReturning(true, false, 'struct');
    await expect(numeric.provider.sendRawTransaction(numeric.transaction)).rejects.toThrow(scriptRefusalAt(2));
    const boolean = await buildReturning(false, true, 'struct');
    await expect(boolean.provider.sendRawTransaction(boolean.transaction)).rejects.toThrow(scriptRefusalAt(2));
  });

  it('executes A -> B -> C -> A once per owner and reads B outState after its settlement boundary', async () => {
    const { provider, transaction } = await buildStateCycle();
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects a multi-hop callback whose owner-A post-state differs from sequential execution', async () => {
    const { provider, transaction } = await buildStateCycle(true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(0));
  });

  it('rejects a one-field B outState forgery at the resumed reader input 0', async () => {
    const { provider, transaction } = await buildStateCycle(false, false, true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(0));
  });

  it('rejects a one-field multi-hop callback target substitution before publication', async () => {
    await expect(buildStateCycle(false, true))
      .rejects.toThrow(/callsite 0 target proof disagrees with registered owner/);
  });

  it('composes an ordinary event NFT inside the compiler-derived balanced block', async () => {
    const { provider, transaction, layout } = await buildEventGraph();
    expect(layout.participantInputs).toEqual([0]);
    expect(layout.controllerInput).toBe(10);
    expect(layout.totalSlots).toBe(12);
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects substituting the event-NFT covenant in a balanced graph slot', async () => {
    const { provider, transaction } = await buildEventGraph(true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(0));
  });

  it('settles a compiler-authenticated satoshi effect inside a balanced graph block', async () => {
    const { provider, transaction, layout } = await buildValueEffectGraph();
    expect(layout.controllerInput).toBe(11);
    expect(layout.totalSlots).toBe(13);
    expectRelayable(transaction);
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects changing a compiler-authenticated graph effect amount', async () => {
    const { provider, transaction } = await buildValueEffectGraph(true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(0));
  });

  it('journals an authenticated mapping entry inside a balanced graph block', async () => {
    const { provider, transaction, layout } = await buildMappingGraph();
    expect(layout.participantInputs).toEqual([0]);
    expect(layout.controllerInput).toBe(3);
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects a forged mapping-entry post-state in graph settlement', async () => {
    const { provider, transaction } = await buildMappingGraph(true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(0));
  });

  it('settles two msg.sender-authorized ERC-20 transfers in one balanced graph', async () => {
    const {
      provider, transaction, layout, tokenInputBytes,
    } = await buildCallerAuthorizedTransferGraph();
    expect(layout.participantInputs).toEqual([0, 1]);
    expect(layout.controllerInput).toBe(8);
    expect(layout.totalSlots).toBe(10);
    // Deployability is part of the claim, not a side effect: the honest token input has to clear BCH's
    // 10,000-byte input-script limit with room to spare, so a later codegen change cannot creep past it.
    expect(tokenInputBytes).toBeLessThanOrEqual(MAXIMUM_INPUT_BYTES - INPUT_HEADROOM_BYTES);
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects substituting the allowance spender witness for the authenticated caller', async () => {
    const { provider, transaction } = await buildCallerAuthorizedTransferGraph(true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(1));
  });

  it('canonicalizes a row-local recipient which aliases the shared debit entry', async () => {
    const { provider, transaction } = await buildCallerAuthorizedTransferGraph(false, 'shared-first');
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('canonicalizes the same row-local recipient across repeated invocations', async () => {
    const { provider, transaction } = await buildCallerAuthorizedTransferGraph(false, 'repeated-recipient');
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects an aliased recipient without the authenticated alias sentinel', async () => {
    const { provider, transaction } = await buildCallerAuthorizedTransferGraph(
      false, 'shared-first', 'omit-sentinel',
    );
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(/mandatory-script-verify/);
  });

  it('rejects an alias sentinel for two distinct recipient identities', async () => {
    const { provider, transaction } = await buildCallerAuthorizedTransferGraph(
      false, undefined, 'false-sentinel',
    );
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(/mandatory-script-verify/);
  });

  it('preflights every input of the final compiled graph transaction', async () => {
    const { builder } = await buildCallerAuthorizedTransferGraph(false, 'shared-first');
    layer3.preflightLayer3Transaction(builder);
    expect(builder.inputs.length).toBeGreaterThan(1);
    expect(builder.outputs).toHaveLength(builder.inputs.length);
    expect(builder.buildLibauthTransaction().inputs.every((input) => input.unlockingBytecode.length > 0)).toBe(true);
  });

  it('reports the exact failing input from the final graph preflight gate', async () => {
    const { builder } = await buildCallerAuthorizedTransferGraph(false, undefined, 'false-sentinel');
    expect(() => layer3.preflightLayer3Transaction(builder))
      .toThrow(/preflight failed at input 1/);
  });

  it('broadcasts exactly the all-input-preflighted graph transaction', async () => {
    const { builder } = await buildCallerAuthorizedTransferGraph(false, 'shared-first');
    await expect(layer3.sendPreflightedLayer3Transaction(builder)).resolves.toMatch(/^[0-9a-f]{64}$/);
  });

  it('settles two caller-keyed ERC-20 transfers with no spender parameter', async () => {
    const { provider, transaction, tokenInputBytes } = await buildCallerKeyedTransferGraph();
    expect(tokenInputBytes).toBeLessThanOrEqual(MAXIMUM_INPUT_BYTES - INPUT_HEADROOM_BYTES);
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('runtime staticcall rejects a reached caller-keyed token transfer', async () => {
    const { provider, transaction, layout } = await buildCallerKeyedTransferGraph(false, true);
    await expect(provider.sendRawTransaction(transaction))
      .rejects.toThrow(scriptRefusalAt(layout.controllerInput));
  });

  it('rejects substituting the holder key for the authenticated caller in a transfer', async () => {
    const { provider, transaction } = await buildCallerKeyedTransferGraph(true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(1));
  });

  it('settles a caller-keyed ERC-20 approve into a nested collection entry', async () => {
    const { provider, transaction } = await buildCallerKeyedApproveGraph();
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects substituting the allowance owner key for the authenticated caller', async () => {
    const { provider, transaction } = await buildCallerKeyedApproveGraph(true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(scriptRefusalAt(1));
  });

  it('authenticates every argument of a multi-argument event', async () => {
    const { provider, transaction } = await buildMultiArgEventGraph();
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects a multi-argument event whose arguments are reordered', async () => {
    const { provider, transaction } = await buildMultiArgEventGraph('swapped');
    await expect(provider.sendRawTransaction(transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  });

  it('rejects a multi-argument event published under a different topic', async () => {
    const { provider, transaction } = await buildMultiArgEventGraph('foreign-topic');
    await expect(provider.sendRawTransaction(transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  });

  it('settles two different handlers over one collection in one owner batch', async () => {
    const { provider, transaction } = await buildMixedHandlerBatchGraph();
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects a mixed batch that omits the second handler\'s effect', async () => {
    // Identical shape and identical rows; the shared entry settles as if only `move` had run, so the
    // rejection can only come from `bump`'s journal write being authenticated too.
    const { provider, transaction } = await buildMixedHandlerBatchGraph('forge-second-row');
    await expect(provider.sendRawTransaction(transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  });

  it('settles a cloned handler that writes both scalar state and a collection', async () => {
    const { provider, transaction } = await buildScalarPlusEntryBatchGraph();
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects a forged scalar post-state from a scalar-plus-collection handler', async () => {
    const { provider, transaction } = await buildScalarPlusEntryBatchGraph('forge-scalar');
    await expect(provider.sendRawTransaction(transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  });

  it('rejects a forged entry post-state from a scalar-plus-collection handler', async () => {
    const { provider, transaction } = await buildScalarPlusEntryBatchGraph('forge-entry');
    await expect(provider.sendRawTransaction(transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  });

});
