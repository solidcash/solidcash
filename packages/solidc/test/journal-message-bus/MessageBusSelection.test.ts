import { describe, expect, it } from 'vitest';
import { decodeAuthenticationInstructions, hexToBin } from '@bitauth/libauth';
import { bytecodeToAsm, messageBusVerifierLockingBytecode } from '@solidcash/utils';
import { compileString, compileStringMulti } from '../../src/compiler.js';

describe('message-bus compilation selection', () => {
  const STATEFUL_LEAF = `
    contract Leaf {
      int value;
      function set(int next) public { value = next; require(next >= 0); }
    }
  `;

  it('defaults a graph-free stateful contract to direct-only compilation', () => {
    const artifact = compileString(STATEFUL_LEAF);
    expect(artifact.messageBus).toBeUndefined();
    expect(artifact.compiler.options?.messageBus).toBe(false);
  });

  it('keeps fast default compilation direct and lean for a graph-free stateful contract', () => {
    const options = { optimizeForCompilationSpeed: true };
    const automatic = compileString(STATEFUL_LEAF, options);
    const direct = compileString(STATEFUL_LEAF, { ...options, messageBus: false });
    const optedIn = compileString(STATEFUL_LEAF, { ...options, messageBus: true });

    expect(automatic.messageBus).toBeUndefined();
    expect(automatic.compiler.options?.messageBus).toBe(false);
    expect(automatic.bytecode).toBe(direct.bytecode);
    expect(automatic.bytecode.length).toBeLessThan(optedIn.bytecode.length);
    expect(optedIn.messageBus).toBeDefined();
  });

  it('keeps a local helper call on the direct route', () => {
    const artifact = compileString(`contract Local {
      int value;
      function next(int current) internal pure returns (int) { return current + 1; }
      function advance() public { value = next(value); require(value > 0); }
    }`, { optimizeForCompilationSpeed: true });
    expect(artifact.messageBus).toBeUndefined();
    expect(artifact.compiler.options?.messageBus).toBe(false);
  });

  it('treats explicit true as an opt-in that skips narrowing and builds a graph-free leaf participant', () => {
    const artifact = compileString(STATEFUL_LEAF, { messageBus: true });
    expect(artifact.messageBus).toBeDefined();
    expect(artifact.compiler.options?.messageBus).toBe(true);
    expect(artifact.messageBus?.route.inputs.some((input) => input.name === '__internal__graphCallers'))
      .toBe(false);
  });

  it('can bind a graph-free leaf participant to per-row logical callers', () => {
    const artifact = compileString(STATEFUL_LEAF, {
      messageBus: true,
      messageBusGraphContext: true,
    });
    expect(artifact.messageBus?.route.inputs.some((input) => input.name === '__internal__graphCallers'))
      .toBe(true);
    expect(artifact.messageBus?.verifierProgram?.inputs
      .some((input) => input.name === 'suppliedCallers')).toBe(true);
  });

  it('honors an explicit graph context for a graph-free participant in both compile modes', () => {
    for (const optimizeForCompilationSpeed of [false, true]) {
      const artifact = compileString(STATEFUL_LEAF, {
        messageBusGraphContext: true,
        optimizeForCompilationSpeed,
      });
      expect(artifact.messageBus?.route.inputs.some((input) => input.name === '__internal__graphCallers'))
        .toBe(true);
    }
  });

  it('binds a lazy delegate participant route to its own verifier', () => {
    const artifact = compileString(`contract DelegateLeaf {
      bigint counter;
      function set(bigint next) public { this.counter = next; require(next >= 0); }
    }`, { messageBus: true });
    const delegate = artifact.delegateArtifact;
    expect(delegate?.abi.find((fn) => fn.name === 'set')?.modifiers).toContain('delegate');
    expect(delegate?.messageBus?.verifierProgram).toBeDefined();
    expect(delegate?.messageBus?.route.inputs.map((input) => input.name))
      .toContain('__internal__activeVerifierIndex');
  });

  it('embeds the published verifier lock after specializing a signed graph delegate route', () => {
    const artifact = compileString(`interface ISink {
        function note(int value) external;
      }
      contract SignedGraphWriter(pubkey authority, address sink) {
        mapping(int => int) values;
        event Changed(int key, int value);
        function forward(int value) public delegate {
          ISink(sink).note(value);
          require(true);
        }
        function authorize(int key, int value, sig proof) public delegate {
          require(checkSig(proof, authority));
          this.values[key] = value;
          emit Changed(key, value);
          require(true);
        }
      }`, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      messageBusGraphContext: true,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: true,
      suppressWarnings: true,
    });
    expect(artifact.messageBus?.route.modifiers).toContain('delegate');
    expect(artifact.abi.find((fn) => fn.name === 'forward')?.externalCalls).toHaveLength(1);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'authorize'))
      .toMatchObject({
        eligible: true,
        usesTransactionSignature: true,
        transactionSignaturePolicy: { hashType: 'all', parameterIndices: [2] },
      });
    const verifierProgram = artifact.messageBus?.verifierProgram;
    expect(verifierProgram).toBeDefined();
    const expectedLock = messageBusVerifierLockingBytecode(verifierProgram!, 1_000_000);
    const verifierBody = Object.values(artifact.debug.invokeDebug ?? {})
      .find((entry) => entry.name === '__message_bus_verify_atomic');
    expect(verifierBody).toBeDefined();
    const embeddedVerifierLocks = decodeAuthenticationInstructions(hexToBin(verifierBody!.bytecode))
      .flatMap((instruction) => instruction.data?.length === expectedLock.length
        && instruction.data[0] === 0xaa
        && instruction.data[1] === 0x20
        && instruction.data[instruction.data.length - 1] === 0x87
        ? [instruction.data]
        : []);
    expect(embeddedVerifierLocks).toEqual([expectedLock]);
  });

  // Explicit message-bus selection keeps the capability observable even when no handler can participate. The
  // kernel publishes a closed refusal instead of silently changing the requested artifact to direct-only.
  it('publishes an unavailable kernel capability when no handler has an atomic participant route', () => {
    const artifact = compileString(`contract Stateless {
      function check(int value) public pure { require(value >= 0); }
    }`, { messageBus: true });
    expect(artifact.contractName).toBe('Stateless');
    expect(artifact.messageBus).toMatchObject({
      convention: 'kernel-row-loop',
      available: false,
      routeInBytecode: false,
      handlers: [expect.objectContaining({
        name: 'check', eligible: false, rejectionReason: 'KERNEL_LAYOUT',
      })],
    });
    expect(artifact.messageBus?.admittedHandlerIds).toBeUndefined();
  });

  it('keeps direct mapping keys visible beside dynamic-array reads in explicit graph mode', () => {
    const artifact = compileString(`contract Registry {
      struct Record { bool restricted; }
      Record[] records;
      mapping(uint => mapping(address => bool)) permissions;
      function consume(uint recordId) public {
        require(!records[recordId].restricted || permissions[recordId][msg.sender]);
        records[recordId].restricted = false;
        require(records[recordId].restricted == false);
      }
    }`, { messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'consume')).toEqual(
      expect.objectContaining({ eligible: true }),
    );
    const routeInputs = artifact.messageBus?.route.inputs.map((input) => input.name) ?? [];
    expect(routeInputs.some((name) => name.includes('_sender_'))).toBe(false);
    expect(routeInputs).toContain('__message_bus_key_permissions_1');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'consume')?.batchKeyWitnesses)
      .toContainEqual(expect.objectContaining({
        routeInput: '__message_bus_key_permissions_1',
        source: 'msgSender',
      }));
  });

  it('binds msg.sender for a fixed-state handler from the authenticated graph caller', () => {
    const artifact = compileString(`contract CallerBoundState {
      address controller;
      bool initialized;
      function configure(int nonce) public {
        require(!initialized);
        require(nonce >= 0);
        controller = msg.sender;
        initialized = true;
      }
    }`, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      messageBusGraphContext: true,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: true,
    });
    expect(artifact.messageBus).toMatchObject({ convention: 'kernel-row-loop', available: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'configure'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.route.inputs.map((input) => input.name))
      .not.toContain('__internal__msgSenderCategory');
  });

  it('journals pooled collection getters through the same canonical route entries as sibling writes', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract PooledReturns {
        struct Item { uint value; }
        mapping(uint => Item[]) items;
        mapping(uint => uint) values;
        function itemsLength(uint key) public view returns (uint) { return items[key].length; }
        function valueAt(uint key) public view returns (uint) { return values[key]; }
        function append(uint key, uint value) public { items[key].push(Item(value)); }
      }
    `, {
      forceStateful: true,
      solidityImportCompat: true,
      messageBus: true,
      messageBusKernel: true,
      messageBusGraphContext: true,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: true,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'itemsLength'))
      .toEqual(expect.objectContaining({ eligible: true, physicalEntrySlots: [0] }));
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'valueAt'))
      .toEqual(expect.objectContaining({ eligible: true, physicalEntrySlots: [1] }));
    expect(artifact.messageBus?.route.entryAccesses).toEqual([
      expect.objectContaining({ collection: 'items', keyParams: ['__message_bus_key_items_0'] }),
      expect.objectContaining({ collection: 'values', keyParams: ['__message_bus_key_values_0'] }),
    ]);
    expect(artifact.messageBus?.route.entryAccesses?.flatMap((access) => access.keyParams)
      .some((key) => key.includes('AbiDecodeAtNode'))).toBe(false);
  });

  it('copies route-owned sorted mapping keys by stable bottom ordinal', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract RouteKeys {
        struct Rating { uint32 average; uint count; }
        uint total;
        mapping(address => uint) fees;
        mapping(address => Rating) ratings;
        function fee(address who) public view returns (uint) { return fees[who]; }
        function update(address who, uint8 score) public {
          Rating storage rating = ratings[who];
          rating.average = uint32(score * 10000);
          rating.count++;
          total++;
          require(score > 0);
        }
        function clear(address who, bool shouldClear) public {
          if (shouldClear) { delete ratings[who]; }
          require(!shouldClear || ratings[who].count == 0);
        }
      }
    `, {
      forceStateful: true,
      solidityImportCompat: true,
      messageBus: true,
      messageBusKernel: true,
      messageBusGraphContext: true,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: true,
    });
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    const routeBody = artifact.functionBodies?.['53434231'];
    expect(routeBody).toBeDefined();
    const routeAsm = bytecodeToAsm(Uint8Array.from(Buffer.from(routeBody!, 'hex')));
    expect(routeAsm).toMatch(/OP_UNTIL|OP_BEGIN/);
    expect(artifact.messageBus?.route.inputs.some((input) => /_r\d+$/.test(input.name))).toBe(false);
  });

  it('co-locates ecrecover sidecars with ordinary participant state and entry slots', () => {
    const artifact = compileString(`contract RecoverWithState {
      int counter;
      mapping(uint => bool) allowed;
      function recover(uint id, bytes32 h, int v, bytes32 r, bytes32 s) public {
        require(allowed[id]);
        pubkey signer = ecrecoverPubKey(h, v, r, s);
        counter = counter + 1;
        require(signer.length == 33);
      }
    }`, { messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'recover');
    expect(handler).toEqual(expect.objectContaining({ eligible: true }));
    const layout = artifact.messageBus?.route.blockLayout;
    expect(layout?.slots.some((slot) => slot.kind === 'dataNft')).toBe(true);
    expect(layout?.slots.some((slot) => slot.kind === 'entry')).toBe(true);
    const recovery = layout?.slots.filter((slot) => slot.kind === 'ecrecoverSideCar') ?? [];
    // Reserve A/B pairs for the compiled recovery sites, not 255 speculative row copies.
    expect(recovery.map((slot) => slot.slotIndex)).toEqual([0, 1, 2, 3]);
    expect(recovery.length).toBeLessThan(2 * (artifact.messageBus?.maximumRows ?? 0));
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(new Set(layout?.slots.map((slot) => slot.offset)).size).toBe(layout?.slots.length);
    expect(layout?.blockSize).toBe(Math.max(...layout!.slots.map((slot) => slot.offset)) + 1);
  });

  it('publishes selected recovery presence and transitive projection vectors for message-bus handlers', () => {
    const artifact = compileString(`contract RecoverySelection {
      int counter;
      function recoverEvm(bytes32 h, int v, bytes32 r, bytes32 s) internal returns (bytes20) {
        return ecrecoverEvm(h, v, r, s);
      }
      function recoverNative(bytes32 h, int v, bytes32 r, bytes32 s) internal returns (bytes) {
        return ecrecoverP2pkh(h, v, r, s);
      }
      function verifyEvm(bytes32 h, int v, bytes32 r, bytes32 s, bytes20 expected) public {
        counter = counter + 1;
        require(recoverEvm(h, v, r, s) == expected);
      }
      function verifyNative(bytes32 h, int v, bytes32 r, bytes32 s, bytes expected) public {
        counter = counter + 1;
        require(recoverNative(h, v, r, s) == expected);
      }
      function plain() public { counter = counter + 1; require(counter > 0); }
    }`, {
      forceStateful: true,
      messageBus: true,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: true,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'verifyEvm'))
      .toEqual(expect.objectContaining({
        eligible: true, ecrecoverCompute: true, ecrecoverEvmFlags: [true],
      }));
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'verifyNative'))
      .toEqual(expect.objectContaining({
        eligible: true, ecrecoverCompute: true, ecrecoverEvmFlags: [false],
      }));
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'plain'))
      .toEqual(expect.objectContaining({ eligible: true, ecrecoverCompute: false }));
  });

  it('binds a state-derived collection key while preserving a bounded graph result', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      interface IToken { function balanceOf(address holder) external returns (uint); }
      contract Escrow(address token) {
        mapping(uint => uint) escrows;
        uint next;
        function readBalance(address currency) internal returns (uint) {
          return IToken(currency).balanceOf(address(this));
        }
        function pay(bool useToken) external returns (uint) {
          uint id = next;
          uint amount = 1;
          if (useToken) { amount = readBalance(token); }
          escrows[id] = amount;
          next = next + 1;
          return id;
        }
        // Keep an unrelated low-level return consumer in the expanded contract. It must not taint pay with a
        // contract-wide refusal once pay's own typed result graph has been proved finite.
        function raw(bytes payload) internal returns (bytes) {
          (bool success, bytes memory result) = address(token).call(payload);
          require(success);
          return result;
        }
      }
    `, {
      forceStateful: true,
      solidityImportCompat: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: true,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pay')).toEqual(
      expect.objectContaining({
        eligible: true,
        batchKeyWitnesses: [expect.objectContaining({
          source: 'expression',
          expressionLabel: 'state:next',
        })],
      }),
    );
  });

  it('does not taint a typed kernel getter with an unrelated low-level return consumer', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract Registry(address peer) {
        struct Record { uint value; bool active; }
        mapping(uint => Record) records;

        function get(uint id) external view returns (Record memory) {
          return records[id];
        }

        function consumeOpaque(bytes payload) public returns (bytes memory) {
          (bool success, bytes memory result) = peer.call(payload);
          require(success);
          return result;
        }
      }
    `, {
      forceStateful: true,
      solidityImportCompat: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: true,
    });

    const getter = artifact.messageBus?.handlers.find((handler) => handler.name === 'get');
    expect(getter).toEqual(expect.objectContaining({ eligible: true }));
    expect(getter).not.toHaveProperty('rejectionReason');
  });

  it('binds a state-derived key for a mapping struct-field write', () => {
    const artifact = compileString(`contract Registry {
      struct Record { uint value; }
      mapping(uint => Record) records;
      uint next;
      function create() public {
        uint id = next;
        records[id].value = 7;
        next = next + 1;
        require(records[id].value == 7);
      }
    }`, {
      solidityImportCompat: true,
      messageBus: true,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: true,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'create')).toEqual(
      expect.objectContaining({
        eligible: true,
        batchKeyWitnesses: [expect.objectContaining({
          source: 'expression',
          expressionLabel: 'state:next',
        })],
      }),
    );
  });

  it('preserves kernel admission after binding the verifier route', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      interface ITarget { function ping() external; }
      contract Controller(address target) {
        int[] values;
        function run() public {
          ITarget(target).ping();
          require(true);
        }
        function resize(int value) public returns (int) {
          values.push(value);
          return values.length;
        }
      }
    `, {
      forceStateful: true,
      messageBus: true,
      messageBusGraphContext: true,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: true,
    });
    expect(artifact.messageBus?.verifierProgram).toBeDefined();
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'resize'))
      .toMatchObject({ eligible: true });
  });

  it('keeps runtime collection loops in a returning graph handler on the authenticated trailing route', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      interface ISink { function ping(uint value) external; }
      contract RoutedRuntimeCollection {
        ISink sink;
        uint[] records;
        mapping(uint => mapping(address => bool)) public membership;

        function edge() internal { sink.ping(1); }
        function update(uint id, address[] included, address[] excluded) internal {
          for (uint i = 0; i < included.length; i++) {
            membership[id][included[i]] = true;
            edge();
          }
          for (uint i = 0; i < excluded.length; i++) {
            membership[id][excluded[i]] = false;
            edge();
          }
        }
        function setOne(uint id, address member) public {
          membership[id][member] = true;
          require(true);
        }
        function create(address[] members) public returns (uint) {
          edge();
          records.push(0);
          uint id = records.length - 1;
          update(id, members, new address[](0));
          return id;
        }
      }
    `, {
      forceStateful: true,
      solidityImportCompat: true,
      messageBus: true,
      messageBusGraphContext: true,
      maximumInputBytes: 10_000_000,
      optimizeForCompilationSpeed: true,
      suppressWarnings: true,
    });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'create');
    const abi = artifact.abi.find((candidate) => candidate.name === 'create');
    const analysis = artifact.invocationAnalysis?.functions.find((candidate) =>
      candidate.selector === abi?.selector);
    expect(handler).toMatchObject({ eligible: true });
    expect(handler?.batchKeyWitnesses).toBeUndefined();
    expect(handler?.physicalEntrySlots).toBeUndefined();
    expect(abi?.externalCalls?.find((call) => call.occurrence === 'loop')).toMatchObject({
      maximumOccurrences: 0xffff,
      occurrenceBoundSource: 'guard',
    });
    expect(analysis?.externalCalls).toEqual(abi?.externalCalls);
    expect(analysis).toMatchObject({
      bounded: true,
      maximumDirectInvocations: abi!.externalCalls!.reduce(
        (total, call) => total + (call.maximumOccurrences ?? 1), 0,
      ),
    });
    expect(abi?.sortedUpsertLoopInfo).toEqual([
      expect.objectContaining({
        collection: 'membership',
        fixedKeyParams: [],
        varyingArrayParam: 'members',
        valueConst: '1',
        op: 'set',
      }),
    ]);
    expect(artifact.messageBus?.route.blockLayout).toMatchObject({ trailingCapacity: 64 });
  });

  it('keeps a mapping field-write sibling eligible on the default kernel row loop', () => {
    const artifact = compileString(`contract SelectiveRoute {
      struct Record { int value; }
      mapping(int => Record) records;
      int current;
      // A mapping field write beside a scalar sibling. Legacy unroll admits both; kernel coalesces the
      // field write into a whole-entry assign and also admits it.
      function unsupported(int key) external {
        records[key].value = 1;
        require(records[key].value == 1);
      }
      function supported(int next) external {
        current = next;
        require(current == next);
      }
    }`, {
      messageBus: true,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: true,
    });
    // Kernel coalesces `records[key].value = 1` into a whole-entry assign and admits both siblings.
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'supported'))
      .toEqual(expect.objectContaining({ eligible: true }));
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'unsupported'))
      .toEqual(expect.objectContaining({ eligible: true }));
  });

  it('threads the logical caller into a no-argument delegate route handler', () => {
    const artifact = compileString(`contract Pausable {
      address _owner;
      bool paused;
      constructor() { _owner = msg.sender; }
      function pause() external {
        require(msg.sender == _owner);
        this.paused = true;
        require(this.paused);
      }
    }`, {
      forceStateful: true,
      messageBus: true,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: true,
    });
    expect(artifact.delegateArtifact?.messageBus?.handlers.find((handler) => handler.name === 'pause'))
      .toEqual(expect.objectContaining({ eligible: true }));
  });

  it('threads the logical caller through a modifier helper closure in a delegate journal handler', () => {
    const artifact = compileString(`contract Governed {
      address _owner;
      mapping(int => int) values;
      mapping(string => string) tags;
      event Changed(address nextOwner);
      function sender() internal view returns (address) { return msg.sender; }
      function checkOwner() internal view { require(sender() == _owner); }
      modifier onlyOwner() { checkOwner(); _; }
      function remove(int key) public onlyOwner { delete values[key]; }
      function update(string key, string value) public onlyOwner { tags[key] = value; }
      function renounce() public onlyOwner { this._owner = address(0); emit Changed(address(0)); }
    }`, {
      forceStateful: true,
      messageBus: true,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: true,
    });
    expect(artifact.delegateArtifact?.messageBus?.handlers.find((handler) => handler.name === 'remove'))
      .toEqual(expect.objectContaining({ eligible: true }));
    expect(artifact.delegateArtifact).toBeDefined();
  });

  it('uses local sender context for a delegate route event-frame handler', () => {
    const artifact = compileString(`contract EventGoverned {
      address _owner;
      event Changed(address nextOwner);
      function sender() internal view returns (address) { return msg.sender; }
      function checkOwner() internal view { require(sender() == _owner); }
      modifier onlyOwner() { checkOwner(); _; }
      function renounce() public onlyOwner { this._owner = address(0); emit Changed(address(0)); }
    }`, {
      forceStateful: true,
      messageBus: true,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: true,
    });
    expect(artifact.delegateArtifact?.messageBus?.handlers.find((handler) => handler.name === 'renounce'))
      .toEqual(expect.objectContaining({ eligible: true }));
  });

  it('allocates one route slot per wide event rather than phantom commitment chunks', () => {
    const artifact = compileString(`contract WideEvents {
      int last;
      event Wide(bytes32 a, bytes32 b, bytes32 c, bytes32 d, bytes32 e);
      event Narrow(int value);
      function emitWide(bytes32 a, bytes32 b, bytes32 c, bytes32 d, bytes32 e) public {
        last = 1;
        emit Wide(a, b, c, d, e);
        require(last == 1);
      }
      function emitNarrow(int value) public {
        last = value;
        emit Narrow(value);
        require(last == value);
      }
    }`, {
      forceStateful: true,
      messageBus: true,
      maximumInputBytes: 1_000_000,
      commitmentLimit: 1_000,
      optimizeForCompilationSpeed: true,
    });
    expect(artifact.messageBus?.handlers.filter((handler) =>
      handler.name === 'emitWide' || handler.name === 'emitNarrow'))
      .toEqual([
        expect.objectContaining({ name: 'emitWide', eligible: true }),
        expect.objectContaining({ name: 'emitNarrow', eligible: true }),
      ]);
    const eventSlots = artifact.messageBus?.route.blockLayout?.slots
      .filter((slot) => slot.kind === 'event') ?? [];
    expect(eventSlots).toHaveLength(artifact.messageBus!.maximumRows);
    expect(eventSlots.map((slot) => slot.slotIndex))
      .toEqual(Array.from({ length: artifact.messageBus!.maximumRows }, (_unused, index) => index));
    expect(artifact.messageBus?.route.graphEffectFrame).toMatchObject({
      sites: artifact.messageBus!.maximumRows,
      eventBase: 0,
      eventWidth: 1,
    });
  });

  it('automatically selects message-bus planning for an external call graph in both compile modes', () => {
    for (const optimizeForCompilationSpeed of [false, true]) {
      const artifact = compileString(`
      interface ISink { function set(int value) external; }
      contract Caller(address sink) {
        int calls;
        function run(int value) public {
          ISink(sink).set(value);
          calls = calls + 1;
          require(value >= 0);
        }
      }
      `, { optimizeForCompilationSpeed });
      expect(artifact.compiler.options?.messageBus).toBe(true);
      expect(artifact.messageBus).toBeDefined();
    }
  });

  it('selects independently for each primary contract in both multi-artifact compile modes', () => {
    for (const optimizeForCompilationSpeed of [false, true]) {
      const artifacts = compileStringMulti(`
      interface ISink { function set(int value) external; }
      contract Leaf { int value; function set(int next) public { value = next; require(next >= 0); } }
      contract Caller(address sink) {
        int calls;
        function run(int value) public {
          ISink(sink).set(value);
          calls = calls + 1;
          require(value >= 0);
        }
      }
      `, { optimizeForCompilationSpeed });
      expect(artifacts.Leaf.messageBus).toBeUndefined();
      expect(artifacts.Caller.messageBus).toBeDefined();
    }
  });

  it('binds every multi-artifact message-bus route to its participant verifier', () => {
    const artifacts = compileStringMulti(`
      contract First { int value; function set(int next) public { value = next; require(next >= 0); } }
      contract Second { int value; function set(int next) public { value = next; require(next >= 0); } }
    `, { messageBus: true });

    for (const artifact of [artifacts.First, artifacts.Second]) {
      expect(artifact.messageBus?.verifierProgram).toBeDefined();
      expect(artifact.messageBus?.route.inputs.map((input) => input.name))
        .toContain('__internal__activeVerifierIndex');
    }
  });
});
