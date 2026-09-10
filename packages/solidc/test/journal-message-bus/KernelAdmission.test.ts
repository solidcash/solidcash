import { describe, expect, it, vi } from 'vitest';
import { asmToBytecode, bytecodeToAsm, StructType } from '@solidcash/utils';
import { compileString, compileStringMulti } from '../../src/compiler.js';
import { FunctionCallNode, IdentifierNode } from '../../src/ast/AST.js';
import { childDeploymentValueRecipe } from '../../src/deploymentRecipes.js';

const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;

const denied = (source: string, name: string): NonNullable<
ReturnType<typeof compileString>['messageBus']
>['handlers'][number] => {
  const artifact = compileString(source, KERNEL);
  const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === name);
  expect(handler, `missing handler ${name}`).toBeDefined();
  return handler!;
};

describe('required kernel admission', () => {
  it('does not advertise dormant internal read-carrier support from kernel convention alone', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function read(int key) public view returns (int) { return this.values[key]; }
    }`, KERNEL);
    expect(artifact.messageBus).toMatchObject({
      convention: 'kernel-row-loop', available: true, routeInBytecode: true,
    });
    // The route has compiler-side marker code, but SDK ownership/materialization has not been activated. Its
    // capability must remain absent until both halves are released together.
    expect(artifact.messageBus?.kernelEntryJournal).toBeUndefined();
  });

  it('keeps an internal clean-carrier-to-dirty handoff unpublished', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) source;
      mapping(int => int) destination;
      function copyThenMutate(int count) public {
        for (int i = 0; i < count; i = i + 1) this.destination[i] = this.source[i];
        for (int j = 0; j < count; j = j + 1) this.source[j] = 7;
        require(true);
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'copyThenMutate');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    // A later compiler row may turn the authenticated source `0x11` record into dirty `0x03`, but that
    // transition is not independently materializable by the SDK yet. Do not let the compiler-side state machine
    // become an advertised route capability before its physical ownership/final-settlement half exists.
    expect(artifact.messageBus?.kernelEntryJournal).toBeUndefined();
  });

  it('retries a multi-declaration speed compile from source-only AST state', () => {
    const source = `pragma solidity ^0.8.7;
      interface Remote {
        function read(uint key) external returns (uint);
        function write(uint value) external;
      }
      contract Neutral {
        Remote public immutable remote;
        address public sink;
        uint public count;
        constructor(address target) { remote = Remote(target); }
        function setSink(address value) external { sink = value; }
        function batch(uint[] calldata keys) external {
          for (uint cursor = 0; cursor < keys.length; ++cursor) {
            uint value = remote.read(keys[cursor]);
            remote.write(value);
            count = value;
          }
        }
        function clock() public view returns (uint) { return block.timestamp; }
      }`;
    const options = {
      ...KERNEL,
      solidityImportCompat: true,
      messageBusGraphContext: true,
      suppressWarnings: true,
      maximumInputBytes: 10_000_000,
      commitmentLimit: 10_000_000,
      compileDeclarations: ['Neutral'],
      __artifactCache: false,
      __attemptFailureBox: {
        failures: [] as Array<{
          stage: string; errorName: string; message: string; internalCodegen: boolean;
        }>,
      },
      __strictNoInternalRecovery: true,
    } as const;
    const previousProfile = process.env.SOLIDC_PROFILE;
    process.env.SOLIDC_PROFILE = '1';
    const profile = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const fast = compileStringMulti(source, { ...options, optimizeForCompilationSpeed: true }).Neutral;
      const normal = compileStringMulti(source, options).Neutral;
      const eligible = (artifact: typeof fast): string[] => artifact.messageBus?.handlers
        .filter((handler) => handler.eligible).map((handler) => handler.name) ?? [];
      expect(eligible(fast)).toEqual(eligible(normal));
      expect(eligible(fast)).toContain('batch');
      expect(profile.mock.calls.flat().join(' ')).not.toContain('MESSAGE_BUS_RESERVED_SELECTOR_COLLISION');
      // A reference-typed handler argument must not make LowerMemoryModel flatten the compiler-owned graph
      // handler into the row loop. That OP_INVOKE boundary owns the outgoing-call/result frame; losing it made
      // the route compile `remote.read(..)` with zero external-return slots and rely on admission retry.
      expect(options.__attemptFailureBox.failures).toEqual([]);
    } finally {
      profile.mockRestore();
      if (previousProfile === undefined) delete process.env.SOLIDC_PROFILE;
      else process.env.SOLIDC_PROFILE = previousProfile;
    }
  });

  it('keeps a returning runtime graph loop eligible without internal-recovery failures', () => {
    const attemptFailureBox = {
      failures: [] as Array<{
        stage: string; errorName: string; message: string; internalCodegen: boolean;
      }>,
    };
    const artifact = compileString(`pragma solidity ^0.8.7;
      interface Remote {
        function read(uint key) external returns (uint);
        function write(uint value) external;
      }
      contract Neutral {
        Remote immutable remote;
        constructor(address target) { remote = Remote(target); }
        function batch(uint[] calldata keys) external {
          for (uint cursor = 0; cursor < keys.length; ++cursor) {
            uint value = remote.read(keys[cursor]);
            remote.write(value);
          }
        }
      }`, {
      ...KERNEL,
      solidityImportCompat: true,
      messageBusGraphContext: true,
      optimizeForCompilationSpeed: true,
      suppressWarnings: true,
      maximumInputBytes: 10_000_000,
      commitmentLimit: 10_000_000,
      __artifactCache: false,
      __attemptFailureBox: attemptFailureBox,
      __strictNoInternalRecovery: true,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'batch')).toMatchObject({
      eligible: true,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'remote')).toMatchObject({
      eligible: true,
    });
    expect(attemptFailureBox.failures).toEqual([]);
  });

  it('admits a pre-call outState projection from the graph-authenticated final settlement', () => {
    const artifact = compileString(`
      interface IRegister {
        public int value;
        function store(int next);
      }
      contract Coordinator() {
        function compareThenStore(address target, int next) public {
          int projected = IRegister(target).outState.value;
          require(projected == next);
          IRegister(target).store(next);
          require(true);
        }
        function control() public { require(true); }
      }
    `, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'compareThenStore'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((entry) => entry.name === 'compareThenStore')?.externalOutStateReads)
      .toEqual([expect.objectContaining({ interfaceName: 'IRegister', addressParam: 'target' })]);

    const legacy = compileString(`
      interface IRegister { public int value; function store(int next); }
      contract Coordinator() {
        function compareThenStore(address target, int next) public {
          int projected = IRegister(target).outState.value;
          require(projected == next);
          IRegister(target).store(next);
          require(true);
        }
        function control() public { require(true); }
      }
    `, { forceStateful: true, messageBus: true, messageBusKernel: false });
    expect(legacy.messageBus?.handlers.find((handler) => handler.name === 'compareThenStore'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'foreign-outstate-read-precedes-shared-call-settlement',
      });
  });

  it('keeps source ABI selectors stable after injecting sorted-map witnesses', () => {
    const artifact = compileString(`contract C() {
      mapping(bigint => bigint) values;
      function set(bigint key, bigint value) public {
        this.values[key] = value;
        require(value >= 0);
      }
    }`, KERNEL);
    // sha256("set(bigint,bigint)")[0..4]. Internal vmap witnesses are physical operands, not selector inputs.
    expect(artifact.abi.find((fn) => fn.name === 'set')?.selector).toBe('f7bda9dc');
    expect(artifact.messageBus?.handlers.find((fn) => fn.name === 'set')?.selector).toBe('f7bda9dc');
    expect(artifact.abi.find((fn) => fn.name === 'set')?.inputs.some(
      (input) => input.name.startsWith('__internal__vmapBatch'),
    )).toBe(true);
  });

  it('does not classify the kernel row dispatcher as a source keccak loop', () => {
    const artifact = compileString(`interface I { function accept(bytes32 value); }
    contract C() {
      function digest(address target, bytes value) public {
        require(value.length > 0);
        I(target).accept(keccak256(value));
      }
    }`, KERNEL);
    const route = artifact.messageBus!.route;
    expect(route.keccakLoopReads).not.toBe(true);
    expect(route.blockLayout?.slots.filter((slot) => slot.kind === 'keccakSideCar')).toHaveLength(1);
  });

  it('fences a row-local struct read-modify-write without a physical output identity', () => {
    const artifact = compileString(`contract C() {
      struct Pair { int left; int right; }
      mapping(int => Pair) pairs;
      function update(int n) public {
        for (int i=0; i<n; i=i+1) { Pair pair=pairs[i]; pair.left=pair.left+1; pairs[i]=pair; }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'update'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.abi.find((handler) => handler.name === 'update')?.sortedUpsertLoopInfo).toEqual([
      expect.objectContaining({
        collection: 'pairs', valueRuntimeLocal: 'pair',
        oldValuesWitnessParam: expect.stringMatching(/^__internal__vmapCounterOld_/),
      }),
    ]);
    expect(artifact.abi.find((handler) => handler.name === 'update')?.inputs).toContainEqual(
      expect.objectContaining({ name: expect.stringMatching(/^__internal__vmapCounterOld_/), type: 'Pair[]' }),
    );
  });

  it('fences a local old-value RMW whose value contains a nested aggregate', () => {
    const artifact = compileString(`contract C() {
      struct Inner { int value; }
      struct Outer { Inner inner; int sibling; }
      mapping(int => Outer) records;
      function update(int count) public {
        for (int i = 0; i < count; i = i + 1) {
          Outer prior = this.records[i];
          prior.inner.value = prior.inner.value + 1;
          this.records[i] = prior;
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.abi.find((handler) => handler.name === 'update')?.sortedUpsertLoopInfo)
      .toEqual([expect.objectContaining({ collection: 'records', valueRuntimeLocal: 'prior' })]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'update'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('fences nested fixed-prefix cross-collection mutations while retaining flat and sequential groups', () => {
    const artifact = compileString(`contract C() {
      mapping(int => mapping(int => int)) left;
      mapping(int => mapping(int => int)) right;
      mapping(int => int) flatLeft;
      mapping(int => int) flatRight;
      function sameRow(int group, int count) public {
        for (int i = 0; i < count; i = i + 1) {
          this.left[group][i] = i;
          this.right[group][i] = i + 1;
        }
        require(true);
      }
      function flat(int count) public {
        for (int i = 0; i < count; i = i + 1) {
          this.flatLeft[i] = i;
          this.flatRight[i] = i + 1;
        }
        require(true);
      }
      function sequential(int group, int count) public {
        for (int i = 0; i < count; i = i + 1) { this.left[group][i] = i; }
        for (int j = 0; j < count; j = j + 1) { this.right[group][j] = j; }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'sameRow'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'flat'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'sequential'))
      .toMatchObject({ eligible: true });
  });

  it('classifies one shared-permutation fixed-width read-to-set transfer but fences its unpublished carrier', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) source;
      mapping(int => int) destination;
      function runtimeCopy(int count) public {
        for (int i = 0; i < count; i = i + 1) this.destination[i] = this.source[i];
        require(true);
      }
      function fixedCopy(int count) public {
        for (int i = 0; i < count; i = i + 1) this.destination[i] = this.source[0];
        require(true);
      }
    }`, KERNEL);
    const runtimeCopy = artifact.abi.find((handler) => handler.name === 'runtimeCopy')!;
    expect(runtimeCopy.sortedUpsertLoopInfo).toEqual(expect.arrayContaining([
      expect.objectContaining({ collection: 'source', op: 'read' }),
      expect.objectContaining({ collection: 'destination', op: 'set' }),
    ]));
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'runtimeCopy'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    // The late compiler readiness result is intentionally private until its paired SDK materializer and GTT
    // final-settlement cursor are released. An admitted, fully typed carrier handoff must not accidentally
    // become a public input-ownership capability merely because it was recognized.
    expect(artifact.messageBus?.kernelEntryJournal).toBeUndefined();
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'fixedCopy'))
      .toMatchObject({ eligible: true });
  });

  it('classifies a fixed-width read carrier fan-out but fences its unpublished carrier', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) source;
      mapping(int => int) left;
      mapping(int => int) right;
      function fanout(int count) public {
        for (int i = 0; i < count; i = i + 1) {
          this.left[i] = this.source[i]; this.right[i] = this.source[i];
        }
        require(true);
      }
      function shifted(int count) public {
        for (int i = 0; i < count; i = i + 1) {
          this.left[i] = this.source[i]; this.right[i] = this.source[i + 1];
        }
        require(true);
      }
    }`, KERNEL);
    const fanout = artifact.abi.find((handler) => handler.name === 'fanout')!;
    const streams = fanout.sortedUpsertLoopInfo!;
    const read = streams.find((stream) => stream.op === 'read')!;
    expect(streams).toHaveLength(3);
    expect(streams.filter((stream) => stream.op === 'set')).toEqual(expect.arrayContaining([
      expect.objectContaining({ collection: 'left', valueArrayParam: read.oldValuesWitnessParam }),
      expect.objectContaining({ collection: 'right', valueArrayParam: read.oldValuesWitnessParam }),
    ]));
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'fanout'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'shifted'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('shares a literal fixed-key entry between a row writer and a counter-loop reader', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) source;
      mapping(int => int) target;
      function seed(int value) public { this.source[0] = value; require(true); }
      function fill(int count) public {
        for (int i = 0; i < count; i = i + 1) this.target[i] = this.source[0];
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'seed'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'fill'))
      .toMatchObject({ eligible: true, physicalEntrySlots: [0] });
    expect(artifact.messageBus?.route.entryAccesses?.find((entry) => entry.collection === 'source'))
      .toMatchObject({ slotIndex: 0, operations: expect.arrayContaining(['read', 'write']) });
  });
  it('admits field-shaped and authenticated dynamic-struct state getters', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract C() {
      struct Rec { int value; }
      Rec public current;
      Rec[] records;
      function all() public view returns (Rec[]) { return this.records; }
    }`, { ...KERNEL, solidityImportCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'current'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'all'))
      .toMatchObject({ eligible: true, outputs: [{ type: 'Rec[]' }] });
    expect(artifact.abi.find((handler) => handler.name === 'all')?.dynamicReads).toEqual(['records']);
    expect(artifact.messageBus?.route.dynamicReads).toEqual(['records']);
  });

  it('admits a whole flattened state struct with dynamic value leaves', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract C() {
        struct Detail { string note; uint256[] marks; }
        struct Rec { uint256 value; Detail detail; }
        Rec record;
        function mutate(uint256 field, uint256 value, string memory note, uint256 mark) public {
          if (field == 0) record.value = value;
          else if (field == 1) record.detail.note = note;
          else record.detail.marks.push(mark);
          require(true);
        }
        function read() public view returns (Rec memory) { return record; }
      }
    `, { ...KERNEL, solidityImportCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'mutate'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'read'))
      .toMatchObject({ eligible: true, outputs: [{ type: 'Rec' }] });
  });

  it('admits one helper which directly combines dynamic state and a collection entry', () => {
    const artifact = compileString(`contract C() {
      string note;
      mapping(bytes20 => bigint) balances;
      function apply(bytes20 key, bigint delta, string value) public {
        update(key, delta, value);
        require(true);
      }
      function update(bytes20 key, bigint delta, string value) internal {
        this.note = value;
        this.balances[key] = this.balances[key] + delta;
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
  });

  it('refuses lifecycle handlers as KERNEL_LIFECYCLE', () => {
    expect(denied(`contract C() {
      int value;
      function denied() selfdestruct { require(true); }
      function control() public { require(true); }
    }`, 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LIFECYCLE',
    });
  });

  it('classifies a selfdestruct statement as lifecycle even without a lifecycle modifier', () => {
    const artifact = compileString(`contract C() {
      address beneficiary;
      function retire() public { selfdestruct(this.beneficiary); }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'retire'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LIFECYCLE' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('admits topology-preserving unsafe tier 2 while keeping narrower tiers fenced', () => {
    const artifact = compileString(`contract C() {
      int stored;
      function validate(int expected) unsafe(2) { require(this.stored == expected); }
      function uncheckedMaster() unsafe(1) { require(true); }
      function uncheckedAll() unsafe { require(true); }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'validate'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'uncheckedMaster'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LIFECYCLE' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'uncheckedAll'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LIFECYCLE' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('admits append-only in-place upgrades with compiler-authored lifecycle authority', () => {
    const artifact = compileString(`contract C() {
      int count;
      function migrate() upgrade { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const upgrade = artifact.messageBus?.handlers.find((handler) =>
      handler.name === 'migrate');
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(upgrade).toMatchObject({
      eligible: true, lifecycle: { kind: 'upgrade', layout: 'in-place-append-v1' },
    });
    expect(artifact.messageBus?.route.inputs).toContainEqual({
      name: '__internal__upgradeBytecode', type: 'bytes',
    });
    expect(artifact.messageBus?.route.inputs).toContainEqual({
      name: '__internal__upgradeStateSuffix', type: 'bytes',
    });
    expect(artifact.messageBus?.atomicMessageBus?.protocolVersions).toEqual([1, 2, 4]);
  });

  it('admits an overloaded upgrade by exact selector without granting lifecycle authority to its sibling', () => {
    const artifact = compileString(`contract C() {
      function migrate() upgrade { require(true); }
      function migrate(int ignored) public { require(ignored == ignored); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handlers = artifact.messageBus?.handlers.filter((handler) => handler.name === 'migrate') ?? [];
    expect(handlers).toHaveLength(2);
    expect(handlers.find((handler) => handler.lifecycle?.kind === 'upgrade')).toMatchObject({
      eligible: true,
      lifecycle: { kind: 'upgrade', layout: 'in-place-append-v1' },
    });
    const ordinary = handlers.find((handler) => handler.lifecycle === undefined);
    expect(ordinary).toMatchObject({ eligible: true });
    expect(new Set(handlers.map((handler) => handler.selector)).size).toBe(2);
    expect(ordinary).not.toHaveProperty('lifecycle');
  });

  it('refuses upgrades on a delegate-owned route until proxy replacement semantics are explicit', () => {
    expect(denied(`contract C() {
      int count;
      function update(int next) public delegate { this.count = next; require(true); }
      function replace() upgrade { require(true); }
    }`, 'replace')).toMatchObject({
      eligible: false, rejectionReason: 'KERNEL_FOREIGN_DELEGATE',
      lifecycle: { kind: 'upgrade', layout: 'in-place-append-v1' },
    });
  });

  it('refuses upgrades reaching a transaction-signature check through an internal bytes cast', () => {
    expect(denied(`contract C(pubkey admin) {
      function authorize(bytes proof) internal { require(checkSig(sig(proof), admin)); }
      function migrate(bytes proof) upgrade { authorize(proof); require(true); }
      function control() public { require(true); }
    }`, 'migrate')).toMatchObject({
      eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE',
      lifecycle: { kind: 'upgrade', layout: 'in-place-append-v1' },
    });
  });

  it('admits a direct scalar SIGHASH_ALL-constrained upgrade authorization', () => {
    const artifact = compileString(`contract C(pubkey admin) {
      function migrate(sig proof) public upgrade { require(checkSig(proof, admin)); }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'migrate')).toMatchObject({
      eligible: true, usesTransactionSignature: true,
      lifecycle: { kind: 'upgrade', layout: 'in-place-append-v1' },
      transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0] },
    });
    expect(artifact.messageBus?.route.inputs).toContainEqual(expect.objectContaining({
      name: '__message_bus_sig_0_0_rows', type: 'sig[]',
    }));
  });

  it.each([
    ['a reassigned parameter', 'proof = sig(hex"00"); require(checkSig(proof, admin));'],
  ])('keeps an upgrade signature reached through %s fenced', (_label, body, parameters = 'sig proof') => {
    expect(denied(`contract C(pubkey admin) {
      function migrate(${parameters}) public upgrade { ${body} }
      function control() public { require(true); }
    }`, 'migrate')).toMatchObject({
      eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE',
      lifecycle: { kind: 'upgrade', layout: 'in-place-append-v1' },
    });
  });

  it('ignores an exactly selected non-signature overload beside a signature helper', () => {
    const artifact = compileString(`contract C(pubkey admin) {
      function inspect(sig proof) internal { require(checkSig(proof, admin)); }
      function inspect(int value) internal pure returns (int) { return value + 1; }
      function migrate(sig proof) public upgrade {
        int ignored = inspect(1);
        sig selected = proof;
        require(ignored == 2 && checkSig(selected, admin));
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'migrate')).toMatchObject({
      eligible: true,
      transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0] },
    });
  });

  it('proves an exactly typed signature overload without inheriting a same-name sibling body', () => {
    const artifact = compileString(`contract C(pubkey admin) {
      function authorize(sig proof, pubkey key) internal { require(checkSig(proof, key)); }
      function authorize(int value) internal pure returns (int) { return value + 1; }
      function migrate(sig proof) public upgrade { authorize(proof, admin); require(true); }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'migrate')).toMatchObject({
      eligible: true,
      transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0] },
    });
  });

  it('does not guess a signature overload when the pre-semantic argument type is unresolved', () => {
    const artifact = compileString(`contract C(pubkey admin) {
      function authorize(sig proof, pubkey key) internal { require(checkSig(proof, key)); }
      function authorize(int value, pubkey key) internal pure returns (int) { return value + bytes(key).length; }
      function migrate(sig proof, bool choose) public upgrade {
        authorize(choose ? proof : proof, admin);
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'migrate'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
  });

  it('does not select an overload from partial argument type evidence', () => {
    const artifact = compileString(`contract C(pubkey admin) {
      function inspect(sig proof, int marker) internal { require(true); }
      function inspect(bytes proof, bool marker) internal {
        require(checkSig(sig(proof), admin));
      }
      function migrate(sig proof, bool choose) public upgrade {
        inspect(proof, choose ? true : false);
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'migrate'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
  });

  it('resolves named overload arguments in each declaration order', () => {
    const artifact = compileString(`contract C(pubkey admin) {
      function inspect(sig proof, bool flag) internal { require(true); }
      function inspect(bytes flag, bool proof) internal {
        require(checkSig(sig(flag), admin));
      }
      function migrate(sig witness, bool choose) public upgrade {
        inspect({ flag: witness, proof: choose });
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, solidityImportCompat: true, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'migrate'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
  });

  it('honors a contract helper shadowing the same free-function signature', () => {
    const artifact = compileString(`
      function inspect(sig proof, pubkey key) { require(checkSig(proof, key)); }
      contract C(pubkey admin) {
        function inspect(sig proof, pubkey key) internal { require(true); }
        function migrate(sig proof) public upgrade {
          inspect(proof, admin);
          require(true);
        }
        function control() public { require(true); }
      }
    `, { ...KERNEL, solidityImportCompat: true, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'migrate'))
      .toMatchObject({ eligible: true });
  });

  it('proves an inherited signature helper while keeping a recursive helper fenced', () => {
    const inherited = compileString(`contract Base(pubkey admin) {
      function authorize(sig proof, pubkey key) internal { require(checkSig(proof, key)); }
    }
    contract C(pubkey admin) is Base(admin) {
      function migrate(sig proof) public upgrade { authorize(proof, admin); require(true); }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(inherited.messageBus?.handlers.find((handler) => handler.name === 'migrate')).toMatchObject({
      eligible: true,
      transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0] },
    });

    expect(denied(`contract C(pubkey admin) {
      function authorize(sig proof, pubkey key, int depth) internal {
        if (depth > 0) { authorize(proof, key, depth - 1); }
        require(checkSig(proof, key));
      }
      function migrate(sig proof) public upgrade { authorize(proof, admin, 1); require(true); }
      function control() public { require(true); }
    }`, 'migrate')).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
  });

  it('finds a transaction-signature check reachable through a mutual recursion cycle', () => {
    expect(denied(`contract C(pubkey admin) {
      function left(sig proof, pubkey key, int depth) internal {
        if (depth > 0) right(proof, key, depth - 1);
        require(true);
      }
      function right(sig proof, pubkey key, int depth) internal {
        if (depth > 0) left(proof, key, depth - 1);
        require(checkSig(proof, key));
      }
      function migrate(sig proof) public upgrade { left(proof, admin, 1); require(true); }
      function control() public { require(true); }
    }`, 'migrate')).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
  });

  it('proves an immutable root signature through a scalar alias chain', () => {
    const artifact = compileString(`contract C(pubkey admin) {
      function migrate(sig proof) public upgrade {
        sig selected = proof;
        sig forwarded = selected;
        require(checkSig(forwarded, admin));
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const selected = artifact.messageBus?.handlers.find((handler) => handler.name === 'migrate');
    expect(selected).toMatchObject({
      eligible: true, usesTransactionSignature: true,
      lifecycle: { kind: 'upgrade', layout: 'in-place-append-v1' },
      transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0] },
    });
  });

  it('proves a root signature through an exact pure identity return', () => {
    const artifact = compileString(`contract C(pubkey admin) {
      function identity(sig value) internal pure returns (sig) { return value; }
      function migrate(sig proof) public upgrade {
        require(checkSig(identity(proof), admin)); require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'migrate')).toMatchObject({
      eligible: true, usesTransactionSignature: true,
      transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0] },
    });
  });

  it.each([
    ['an internal helper', 'internal'],
    ['a private helper', 'private'],
  ])('publishes the exact covered body for %s', (_label, visibility) => {
    const artifact = compileString(`contract C(pubkey admin) {
      function authorize(sig selected, pubkey key) ${visibility} { require(checkSig(selected, key)); }
      function migrate(sig proof) public upgrade { authorize(proof, admin); require(true); }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const selected = artifact.messageBus?.handlers.find((handler) => handler.name === 'migrate');
    expect(selected).toMatchObject({
      eligible: true,
      transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0] },
    });
    const covered = selected?.transactionSignaturePolicy?.coveredBytecodes;
    expect(covered).toHaveLength(1);
    expect(covered?.[0]).toMatchObject({ parameterIndex: 0 });
    expect(covered?.[0].bytecode).not.toBe(selected?.signatureBytecode);
  });

  it.each([
    ['directly', 'require(checkSig(auth.authorization.proof, auth.authorization.key));'],
    ['through an internal helper', 'authorize(auth); require(true);', `
      function authorize(Auth selected) internal {
        require(checkSig(selected.authorization.proof, selected.authorization.key));
      }`],
    ['through an expanded modifier', 'require(true);', `
      modifier authorized(Auth selected) {
        require(checkSig(selected.authorization.proof, selected.authorization.key)); _;
      }`, 'authorized(auth)'],
  ])('proves a detached scalar signature in a nested finite struct %s',
    (_label, body, support = '', customModifier = '') => {
      const artifact = compileString(`contract C() {
        struct Authorization { sig proof; pubkey key; }
        struct Auth { Authorization authorization; int nonce; }
        int marker;
        ${support}
        function migrate(Auth auth, int next) public upgrade ${customModifier} {
          ${body} this.marker = next; require(true);
        }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'migrate')).toMatchObject({
        eligible: true, usesTransactionSignature: true,
        transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0] },
      });
      expect(artifact.messageBus?.route.inputs).toContainEqual(expect.objectContaining({
        name: '__message_bus_sig_0_0_rows', type: 'sig[]',
      }));
    });

  it('proves one immutable nested sig[] leaf through its exact CHECKMULTISIG helper body', () => {
    const artifact = compileString(`contract C() {
      struct Auth { sig[] proofs; pubkey[] authorities; int nonce; }
      int marker;
      function authorize(Auth selected) internal {
        require(checkMultiSig(selected.proofs, selected.authorities));
      }
      function migrate(Auth auth, int next) public upgrade {
        authorize(auth); this.marker = next; require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const selected = artifact.messageBus?.handlers.find((handler) => handler.name === 'migrate');
    expect(selected).toMatchObject({
      eligible: true, usesTransactionSignature: true,
      transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0] },
    });
    expect(selected?.transactionSignaturePolicy?.coveredBytecodes).toEqual([
      expect.objectContaining({ parameterIndex: 0 }),
    ]);
    expect(artifact.messageBus?.route.inputs).toContainEqual(expect.objectContaining({
      name: '__message_bus_sig_0_0_rows', type: 'sig[][]',
    }));
  });

  it('binds each finite aggregate signature leaf to its exact helper OP_INVOKE body', () => {
    const artifact = compileString(`contract C() {
      struct Auth { sig left; sig right; pubkey leftKey; pubkey rightKey; }
      function checkLeft(Auth selected) internal { require(checkSig(selected.left, selected.leftKey)); }
      function checkRight(Auth selected) internal { require(checkSig(selected.right, selected.rightKey)); }
      function run(Auth auth) public { checkLeft(auth); checkRight(auth); require(true); }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'run');
    expect(handler).toMatchObject({ eligible: true, usesTransactionSignature: true,
      transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0] } });
    expect(handler?.transactionSignaturePolicy?.coveredBytecodes).toEqual([
      expect.objectContaining({ parameterIndex: 0, leafIndex: 0 }),
      expect.objectContaining({ parameterIndex: 0, leafIndex: 1 }),
    ]);
    expect(handler?.transactionSignaturePolicy?.coveredBytecodes?.[0].bytecode)
      .not.toBe(handler?.transactionSignaturePolicy?.coveredBytecodes?.[1].bytecode);
  });

  it.each([
    ['a reassigned aggregate', `
      auth = auth;
      require(checkMultiSig(auth.proofs, auth.authorities));`],
    ['an unchecked sibling sig[] leaf',
      'require(checkMultiSig(auth.first, auth.authorities));',
      'struct Auth { sig[] first; sig[] second; pubkey[] authorities; }'],
    ['a constructed signature array rather than one leaf',
      'require(checkMultiSig([auth.first, auth.second], auth.authorities));',
      'struct Auth { sig first; sig second; pubkey[] authorities; }'],
  ])('keeps nested CHECKMULTISIG provenance fenced for %s', (_label, body, declaration =
    'struct Auth { sig[] proofs; pubkey[] authorities; int nonce; }') => {
    expect(denied(`contract C() {
      ${declaration}
      function migrate(Auth auth) public upgrade { ${body} }
      function control() public { require(true); }
    }`, 'migrate')).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
  });

  it.each([
    ['a reassigned aggregate', `
      auth = Auth(Authorization(sig(hex"00"), auth.authorization.key), auth.nonce);
      require(checkSig(auth.authorization.proof, auth.authorization.key));`],
    ['more than one detached signature leaf',
      'require(checkSig(auth.first, auth.key));', 'struct Auth { sig first; sig second; pubkey key; }'],
    ['a runtime-selected aggregate element',
      'require(checkSig(auth[which].proof, auth[which].key));',
      'struct Auth { sig proof; pubkey key; }', 'Auth[2] auth, int which'],
  ])('keeps finite-aggregate signature provenance fenced for %s',
    (_label, body, declaration = `
      struct Authorization { sig proof; pubkey key; }
      struct Auth { Authorization authorization; int nonce; }`, parameters = 'Auth auth') => {
      expect(denied(`contract C() {
        ${declaration}
        function migrate(${parameters}) public upgrade { ${body} }
        function control() public { require(true); }
      }`, 'migrate')).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
    });

  it('keeps a helper-captured constructor value fenced from the detached call frame', () => {
    const artifact = compileString(`contract C(pubkey admin) {
      function authorize(sig selected) internal { require(checkSig(selected, admin)); }
      function migrate(sig proof) public upgrade { authorize(proof); require(true); }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'migrate'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
  });

  it('fences a constructor-captured helper graph effect before hidden graph slots are injected', () => {
    const attemptFailureBox = { failures: [] as Array<{ stage: string; errorName: string; message: string }> };
    const artifact = compileString(`interface IReceiver { function set(uint value) external; }
      contract C(address receiver) {
        function forward(uint value) internal { IReceiver(receiver).set(value); }
        function run(uint value) public { forward(value); require(true); }
      }`, {
      ...KERNEL, __artifactCache: false, __strictNoInternalRecovery: true, __attemptFailureBox: attemptFailureBox,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'run'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(attemptFailureBox.failures).toEqual([]);
    const direct = compileString(`interface IReceiver { function set(uint value) external; }
      contract Direct(address receiver) {
        function run(uint value) public { IReceiver(receiver).set(value); require(true); }
      }`, KERNEL);
    expect(direct.messageBus?.handlers.find((handler) => handler.name === 'run'))
      .toMatchObject({ eligible: true });
    const immutableHelper = compileString(`interface IReceiver { function set(uint value) external; }
      contract Stored {
        IReceiver immutable receiver;
        constructor(address receiver_) { receiver = IReceiver(receiver_); }
        function forward(uint value) internal { receiver.set(value); }
        function run(uint value) public { forward(value); require(true); }
      }`, KERNEL);
    expect(immutableHelper.messageBus?.handlers.find((handler) => handler.name === 'run'))
      .toMatchObject({ eligible: true });
  });

  it('keeps a mutated alias outside the exact detached-body proof', () => {
    expect(denied(`contract C(pubkey admin) {
      function migrate(sig proof) public upgrade {
        sig selected = proof;
        selected = proof;
        require(checkSig(selected, admin));
      }
      function control() public { require(true); }
    }`, 'migrate')).toMatchObject({
      eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE',
    });
  });

  it('keeps multiple transaction-signature covered bodies outside the handler-wide policy', () => {
    expect(denied(`contract C(pubkey admin) {
      function first(sig proof) internal { require(checkSig(proof, admin)); }
      function second(sig proof) private { require(checkSig(proof, admin)); }
      function migrate(sig proof) public upgrade { first(proof); second(proof); require(true); }
      function control() public { require(true); }
    }`, 'migrate')).toMatchObject({
      eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE',
    });
  });

  it('keeps reachable transaction-signature checks fenced without a detached signing policy', () => {
    const artifact = compileString(`contract C() {
      function execute(bytes proof, pubkey key) public { require(checkSig(sig(proof), key)); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'execute')).toMatchObject({
      eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE',
    });

    const legacy = compileString(`contract C() {
      function execute(bytes proof, pubkey key) public { require(checkSig(sig(proof), key)); }
    }`, { forceStateful: true, messageBus: true, messageBusKernel: false, maximumInputBytes: 1_000_000 });
    expect(legacy.messageBus?.atomicMessageBus?.protocolVersions).toEqual([1]);
    expect(legacy.bytecode).not.toContain('4c33425553320000');

    const free = compileString(`
      function authenticate(bytes proof, pubkey key) { require(checkSig(sig(proof), key)); }
      contract C() {
        function execute(bytes proof, pubkey key) public { authenticate(proof, key); require(true); }
      }
    `, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(free.messageBus?.handlers.find((handler) => handler.name === 'execute'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });

    const library = compileString(`
      library Auth {
        function authenticate(bytes proof, pubkey key) internal { require(checkSig(sig(proof), key)); }
      }
      contract C() {
        function execute(bytes proof, pubkey key) public { Auth.authenticate(proof, key); require(true); }
      }
    `, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(library.messageBus?.handlers.find((handler) => handler.name === 'execute'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
  });

  it('binds a scalar transaction signature as a row-aligned route witness', () => {
    const artifact = compileString(`contract C(pubkey owner) {
      function signed(sig s) public { require(checkSig(s, owner)); }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'signed')?.eligible).toBe(true);
    expect(artifact.messageBus?.route.inputs).toContainEqual(expect.objectContaining({
      name: '__message_bus_sig_0_0_rows', type: 'sig[]',
    }));
  });

  it('publishes the SIGHASH_ALL policy for an ordinary direct scalar signature check', () => {
    const artifact = compileString(`contract C(pubkey authority) {
      function signed(sig proof) public { require(checkSig(proof, authority)); }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'signed')).toMatchObject({
      eligible: true, usesTransactionSignature: true,
      transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0] },
    });
  });

  it('keeps a reassigned transaction-signature parameter fenced without an all-output policy', () => {
    const artifact = compileString(`contract C(pubkey authority) {
      function signed(sig proof) public {
        proof = sig(hex"00"); require(checkSig(proof, authority));
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'signed');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
    expect(handler).not.toHaveProperty('transactionSignaturePolicy');
  });

  it('binds a signed typed external-call row to its final graph dispatcher', () => {
    const artifact = compileString(`interface ITarget { function run(int value); }
      contract C(pubkey authority) {
        function execute(sig proof, address target, int value) public {
          require(checkSig(proof, authority));
          ITarget(target).run(value);
          require(true);
        }
        function control() public { require(true); }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'execute');
    expect(handler).toMatchObject({
      eligible: true, usesTransactionSignature: true,
      transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0] },
    });
    const covered = handler?.transactionSignaturePolicy?.coveredBytecodes?.[0]?.bytecode;
    expect(covered).toBeDefined();
    const coveredInvoke = Object.values(artifact.debug.invokeDebug ?? {})
      .find((entry) => entry.bytecode === covered);
    expect(coveredInvoke?.name).toBe('__message_bus_handler_execute');
  });

  it('retains the exact helper signing body for a helper-authenticated typed external-call row', () => {
    const artifact = compileString(`interface ITarget { function run(int value); }
      contract C(pubkey authority) {
        function authorize(sig selected, pubkey key) internal { require(checkSig(selected, key)); }
        function execute(sig proof, address target, int value) public {
          authorize(proof, authority);
          ITarget(target).run(value);
          require(true);
        }
        function control() public { require(true); }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'execute');
    expect(handler).toMatchObject({
      eligible: true,
      transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0] },
    });
    const covered = handler?.transactionSignaturePolicy?.coveredBytecodes?.[0]?.bytecode;
    expect(covered).toBeDefined();
    expect(covered).not.toBe(handler?.signatureBytecode);
    expect(Object.values(artifact.debug.invokeDebug ?? {}).some((entry) => entry.bytecode === covered)).toBe(true);
  });

  it('inlines a signed typed external-call helper into the authenticated root frame', () => {
    const artifact = compileString(`interface ITarget { function run(int value); }
      contract C(pubkey authority) {
        function forward(address target, int value) internal { ITarget(target).run(value); }
        function execute(sig proof, address target, int value) public {
          require(checkSig(proof, authority));
          forward(target, value);
          require(true);
        }
        function control() public { require(true); }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'execute');
    expect(handler).toMatchObject({
      eligible: true,
      transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0] },
    });
    expect(Object.values(artifact.debug.invokeDebug ?? {})
      .some((entry) => entry.name === 'forward')).toBe(false);
  });

  it('fences a signed row whose raw external call is hidden behind an internal helper frame', () => {
    const artifact = compileString(`contract C(pubkey authority) {
      function forward(address target, bytes payload) internal { address(target).call(payload); }
      function execute(sig proof, address target, bytes payload) public {
        require(checkSig(proof, authority));
        forward(target, payload);
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'execute');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
    expect(handler).not.toHaveProperty('transactionSignaturePolicy');
  });

  it.each([
    ['an argument', 'ITarget(target).run(bytes(proof));'],
    ['a control predicate', `if (bytes(proof).length > 0) { ITarget(target).run(hex"01"); }
      else { ITarget(target).run(hex"02"); }`],
    ['a mutable alias joined from a branch', `bytes payload = hex"01";
      if (target == target) { payload = bytes(proof); }
      ITarget(target).run(payload);`],
    ['a ternary-derived alias', `bytes payload = bytes(proof).length > 0 ? hex"01" : hex"02";
      ITarget(target).run(payload);`],
  ])('keeps a typed external call with a signature-derived %s fenced', (_label, call) => {
    const artifact = compileString(`interface ITarget { function run(bytes value); }
      contract C(pubkey authority) {
        function execute(sig proof, address target) public {
          require(checkSig(proof, authority));
          ${call}
          require(true);
        }
        function control() public { require(true); }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'execute');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
    expect(handler).not.toHaveProperty('transactionSignaturePolicy');
  });

  it.each([
    ['scalar state', 'int marker;', 'this.marker = int(bytes(proof));'],
    ['mapping state', 'mapping(int => bytes) payloads;', 'this.payloads[0] = bytes(proof);'],
    ['dynamic-array state', 'bytes[] payloads;', 'this.payloads.push(bytes(proof));'],
  ])('keeps a typed external call fenced after a signature-derived %s write', (
    _label, state, write,
  ) => {
    const artifact = compileString(`interface ITarget { function run(bytes value); }
      contract C(pubkey authority) {
        ${state}
        function execute(sig proof, address target) public {
          require(checkSig(proof, authority));
          ${write}
          ITarget(target).run(hex"01");
          require(true);
        }
        function control() public { require(true); }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'execute');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
    expect(handler).not.toHaveProperty('transactionSignaturePolicy');
  });

  it.each([
    ['a dynamic-array element alias', `bytes[] memory values = new bytes[](1);
      values[0] = bytes(proof); ITarget(target).run(values);`, 'bytes[]'],
    ['a fixed-array element alias', `bytes[1] memory values;
      values[0] = bytes(proof); ITarget(target).run(values);`, 'bytes[1]'],
  ])('keeps a typed external call with %s fenced', (_label, call, argumentType) => {
    const artifact = compileString(`interface ITarget { function run(${argumentType} value); }
      contract C(pubkey authority) {
        function execute(sig proof, address target) public {
          require(checkSig(proof, authority));
          ${call}
          require(true);
        }
        function control() public { require(true); }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'execute');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
    expect(handler).not.toHaveProperty('transactionSignaturePolicy');
  });

  it.each([
    ['value', 'value: int(bytes(proof))'],
    ['gas', 'gas: int(bytes(proof))'],
    ['salt', 'salt: bytes32(bytes(proof))'],
  ])('keeps a typed external call with a signature-derived %s option fenced', (_label, option) => {
    const artifact = compileString(`interface ITarget { function run(); }
      contract C(pubkey authority) {
        function execute(sig proof, address target) public {
          require(checkSig(proof, authority));
          ITarget(target).run{${option}}();
          require(true);
        }
        function control() public { require(true); }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'execute');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
    expect(handler).not.toHaveProperty('transactionSignaturePolicy');
  });

  it.each([
    ['event argument', 'event Observed(bytes value);', 'emit Observed(bytes(proof));'],
    ['event predicate', 'event Observed(bytes value);',
      'if (bytes(proof).length > 0) emit Observed(hex"01");'],
    ['token transfer amount', '',
      'this.tokens[category].transfer(recipient, int(bytes(proof)));'],
  ])('keeps signature-derived %s out of graph material', (_label, declaration, effect) => {
    const artifact = compileString(`${declaration}
      contract C(pubkey authority) {
        function execute(sig proof, bytes32 category, bytes recipient) public {
          require(checkSig(proof, authority));
          ${effect}
          require(true);
        }
        function control() public { require(true); }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'execute');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
    expect(handler).not.toHaveProperty('transactionSignaturePolicy');
  });

  it('retains SIGHASH_ALL admission for signature-independent event and token effects', () => {
    const artifact = compileString(`event Observed(bytes value);
      contract C(pubkey authority) {
        function execute(sig proof, bytes32 category, bytes recipient, int amount) public {
          require(checkSig(proof, authority));
          emit Observed(hex"01");
          this.tokens[category].transfer(recipient, amount);
          require(true);
        }
        function control() public { require(true); }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'execute')).toMatchObject({
      eligible: true,
      transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0] },
    });
  });

  it('does not treat a signature-derived local aggregate as persisted graph material', () => {
    const artifact = compileString(`contract C(pubkey authority) {
      function execute(sig proof) public {
        bytes[] memory values = new bytes[](1);
        values[0] = bytes(proof);
        require(checkSig(proof, authority));
        require(values.length == 1);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'execute')).toMatchObject({
      eligible: true,
      transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0] },
    });
  });

  it('keeps an effectful helper invocation under a signature-derived predicate fenced', () => {
    const artifact = compileString(`event Observed(bytes value);
      contract C(pubkey authority) {
        function record() internal { emit Observed(hex"01"); }
        function execute(sig proof) public {
          require(checkSig(proof, authority));
          if (bytes(proof).length > 0) record();
          require(true);
        }
        function control() public { require(true); }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'execute');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
    expect(handler).not.toHaveProperty('transactionSignaturePolicy');
  });

  it.each([
    ['a direct state write', 'int marker;', '', 'this.marker = 1;'],
    ['a collection-writing helper', 'mapping(int => int) records;',
      'function record() internal { this.records[0] = 1; }', 'record();'],
  ])('keeps %s under a signature-derived predicate fenced', (_label, state, helper, effect) => {
    const artifact = compileString(`contract C(pubkey authority) {
      ${state}
      ${helper}
      function execute(sig proof) public {
        require(checkSig(proof, authority));
        if (bytes(proof).length > 0) { ${effect} }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'execute');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
    expect(handler).not.toHaveProperty('transactionSignaturePolicy');
  });

  it('keeps a short-circuit-gated typed external call signature-fenced', () => {
    const artifact = compileString(`interface ITarget { function accept(bytes value) returns (bool); }
      contract C(pubkey authority) {
        function execute(sig proof, address target) public {
          require(checkSig(proof, authority));
          require(bytes(proof).length == 0 || ITarget(target).accept(hex"01"));
        }
        function control() public { require(true); }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'execute');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
    expect(handler).not.toHaveProperty('transactionSignaturePolicy');
  });

  it.each([
    ['raw', 'address(target).call(payload)[0]', 'KERNEL_OPAQUE_EFFECT'],
    ['delegate', 'address(target).delegatecall(payload)[0]', 'KERNEL_FOREIGN_DELEGATE'],
  ])('keeps a signed %s call in a branch condition fenced', (_label, condition, rejectionReason) => {
    const artifact = compileString(`contract C(pubkey authority) {
      function execute(sig proof, address target, bytes payload) public {
        require(checkSig(proof, authority));
        if (${condition}) { require(true); }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'execute');
    expect(handler).toMatchObject({ eligible: false, rejectionReason });
    expect(handler).not.toHaveProperty('transactionSignaturePolicy');
  });

  it('keeps a signature-derived typed call in a branch condition fenced', () => {
    const artifact = compileString(`interface ITarget { function accept(bytes value) returns (bool); }
      contract C(pubkey authority) {
        function execute(sig proof, address target) public {
          require(checkSig(proof, authority));
          if (ITarget(target).accept(bytes(proof))) { require(true); }
          require(true);
        }
        function control() public { require(true); }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'execute');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
    expect(handler).not.toHaveProperty('transactionSignaturePolicy');
  });

  it('keeps an unresolved external function-pointer call in a branch condition fenced', () => {
    const artifact = compileString(`contract C(pubkey authority) {
      function execute(sig proof, function() external returns (bool) callback) public {
        require(checkSig(proof, authority));
        if (callback()) { require(true); }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'execute');
    expect(handler?.eligible).not.toBe(true);
    expect(handler?.transactionSignaturePolicy).toBeUndefined();
  });

  it('keeps a signed raw statement call behind the transaction-signature fence', () => {
    const artifact = compileString(`contract C(pubkey authority) {
      function execute(sig proof, address target, bytes payload) public {
        require(checkSig(proof, authority));
        address(target).call(payload);
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'execute');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
    expect(handler).not.toHaveProperty('transactionSignaturePolicy');
  });

  it('publishes an all-output policy for an ordinary immutable signature alias', () => {
    const artifact = compileString(`contract C(pubkey authority) {
      function signed(sig proof) public {
        sig selected = proof;
        require(checkSig(selected, authority));
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'signed')).toMatchObject({
      eligible: true, usesTransactionSignature: true,
      transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0] },
    });
  });

  it('admits a synthesized block-oracle updater at the entry-point synthesis boundary', () => {
    const artifact = compileString(`contract C(pubkey owner) {
      mapping(int => int) values;
      function set(int key) public {
        this.values[key] = int(block.number);
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const updater = artifact.messageBus?.handlers.find((handler) =>
      handler.name === '__updateBlockOracle');
    expect(updater).toMatchObject({ eligible: true });
    expect(updater?.rejectionReason).toBeUndefined();
    expect(artifact.messageBus?.route.inputs).toContainEqual(expect.objectContaining({
      name: expect.stringMatching(/^__message_bus_sig_\d+_0_rows$/),
      type: 'sig[]',
    }));
    expect(artifact.abi.find((entry) => entry.name === '__updateBlockOracle')?.modifiers ?? [])
      .not.toContain('delegate');
    expect(Object.values(artifact.debug.invokeDebug ?? {}))
      .toContainEqual(expect.objectContaining({ name: '__updateBlockOracle' }));
  });

  it('inherits delegate execution for a synthesized block-oracle updater', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract C {
        bool initialized;
        uint value;
        modifier initializer() { require(!initialized); initialized = true; _; }
        function initialize() public initializer { value = block.number; }
        function current() public view returns (uint) { return block.number; }
      }
    `, {
      ...KERNEL, solidityImportCompat: true, maximumInputBytes: 1_000_000,
    });
    const updater = artifact.messageBus?.handlers.find((handler) =>
      handler.name === '__updateBlockOracle');
    expect(updater).toMatchObject({
      eligible: true,
      usesTransactionSignature: true,
      transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0] },
    });
    expect(artifact.abi.find((entry) => entry.name === '__updateBlockOracle')?.modifiers)
      .toContain('delegate');
    const signingBody = Object.values(artifact.debug.invokeDebug ?? {})
      .find((entry) => entry.name === '__message_bus_handler___updateBlockOracle');
    expect(signingBody).toBeDefined();
    expect(updater?.transactionSignaturePolicy?.coveredBytecodes).toEqual([{
      parameterIndex: 0, leafIndex: 0, bytecode: signingBody!.bytecode,
    }]);
    expect(updater?.signatureBytecode).toBeUndefined();
    expect(artifact.invocationAnalysis?.functions.find((fn) => fn.name === '__message_bus1')?.writes)
      .toContain('state:__block_number');
  });

  it('does not infer oracle ownership from one delegate member on a mixed execution surface', () => {
    const artifact = compileString(`contract C() {
      int stored;
      function delegated(int next) public delegate { this.stored = next; require(true); }
      function height() public view returns (uint) { return block.number; }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.abi.find((entry) => entry.name === '__updateBlockOracle')?.modifiers ?? [])
      .not.toContain('delegate');
  });

  it('assigns a mixed contract oracle updater to its only delegate consumer', () => {
    const artifact = compileString(`contract C() {
      int stored;
      function delegated() public delegate { this.stored = block.number; require(true); }
      function inspect() public view returns (int) { return this.stored; }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.abi.find((entry) => entry.name === '__updateBlockOracle')?.modifiers)
      .toContain('delegate');
  });

  it('counts a fallback oracle read as a direct consumer on a mixed surface', () => {
    const artifact = compileString(`contract C() {
      int stored;
      fallback(bytes input) external {
        this.stored = block.number + input.length;
        require(true);
      }
      function delegated(int next) public delegate { this.stored = next; require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.abi.find((entry) => entry.name === '__updateBlockOracle')?.modifiers ?? [])
      .not.toContain('delegate');
  });

  it('refuses one oracle register reached through both direct and delegate roots via a shared helper', () => {
    expect(() => compileString(`contract C() {
      int stored;
      function height() internal view returns (uint) { return block.number; }
      function delegated() public delegate { this.stored = height(); require(true); }
      function direct() public view returns (uint) { return height(); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 })).toThrow(
      /block-oracle state from both direct and delegate execution surfaces/,
    );
  });

  it('treats a constructor oracle read as direct ownership beside a delegate consumer', () => {
    expect(() => compileString(`contract C() {
      uint stored;
      function height() internal view returns (uint) { return block.number; }
      constructor() { this.stored = height(); }
      function delegated() public delegate { this.stored = block.number; require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 })).toThrow(
      /block-oracle state from both direct and delegate execution surfaces/,
    );
  });

  it.each([
    ['a mapping write', 'mapping(int => int) values;',
      'this.values[key] = next;', ''],
    ['a mapping write authenticated by a helper',
      `mapping(int => int) values;
       function authenticate(sig proof, pubkey key) internal { require(checkSig(proof, key)); }`,
      'this.values[key] = next;', 'authenticate(proof, authority);'],
  ])('binds the final specialized delegate dispatcher for %s', (
    _label, declarations, effect, authentication,
  ) => {
    const artifact = compileString(`contract C(pubkey authority) {
      ${declarations}
      function write(int key, int next, sig proof) public delegate {
        ${authentication || 'require(checkSig(proof, authority));'}
        ${effect}
        require(true);
      }
      function control() public delegate { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const selected = artifact.messageBus?.handlers.find((handler) => handler.name === 'write');
    expect(selected).toMatchObject({
      eligible: true,
      transactionSignaturePolicy: { hashType: 'all', parameterIndices: [2] },
    });
    const covered = selected?.transactionSignaturePolicy?.coveredBytecodes?.[0]?.bytecode;
    expect(covered).toBeDefined();
    expect(Object.values(artifact.debug.invokeDebug ?? {}).some((entry) =>
      entry.bytecode === covered)).toBe(true);
  });

  it('keeps a signed delegate fixed mapping write plus event on one row', () => {
    const artifact = compileString(`contract C(pubkey authority) {
      mapping(int => int) values;
      event Changed(int key, int value);
      function write(int key, int next, sig proof) public delegate {
        require(checkSig(proof, authority));
        this.values[key] = next;
        emit Changed(key, next);
        require(true);
      }
      function control() public delegate { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write')).toMatchObject({
      eligible: true,
    });
  });

  it('normalizes a conservative tail-recursive entry before kernel closure admission', () => {
    const artifact = compileString(`contract C() {
      function countDown(int value) public returns (int result) {
        if (value == 0) { result = value; }
        else { result = countDown(value - 1); }
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'countDown'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('normalizes a void tail-recursive helper before kernel closure admission', () => {
    const artifact = compileString(`contract C() {
      int calls;
      function countDown(int value) internal {
        this.calls = this.calls + 1;
        if (value > 0) { countDown(value - 1); }
      }
      function run(int value) public { countDown(value); require(true); }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'run'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('normalizes a homogeneous mutual tail-recursion cycle before kernel closure admission', () => {
    const artifact = compileString(`contract C() {
      function evenStep(int remaining, int total) public returns (int) {
        if (remaining == 0) return total;
        return oddStep(remaining - 1, total + 1);
      }
      function oddStep(int remaining, int total) public returns (int) {
        if (remaining == 0) return total;
        return evenStep(remaining - 1, total + 1);
      }
      function run(int remaining) public returns (int) {
        return evenStep(remaining, 0);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'run'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'evenStep'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'oddStep'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('normalizes mutual tail recursion with tuple results and a three-function void cycle', () => {
    const artifact = compileString(`contract C() {
      int calls;
      function left(int remaining) internal returns (int, bool) {
        if (remaining == 0) return (7, true);
        return right(remaining - 1);
      }
      function right(int remaining) internal returns (int, bool) {
        if (remaining == 0) return (8, false);
        return left(remaining - 1);
      }
      function first(int remaining) internal {
        this.calls = this.calls + 1;
        if (remaining > 0) second(remaining - 1);
      }
      function second(int remaining) internal {
        this.calls = this.calls + 1;
        if (remaining > 0) third(remaining - 1);
      }
      function third(int remaining) internal {
        this.calls = this.calls + 1;
        if (remaining > 0) first(remaining - 1);
      }
      function pair(int remaining) public returns (int, bool) { return left(remaining); }
      function run(int remaining) public { first(remaining); require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pair'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'run'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'pair')?.outputs)
      .toEqual([{ type: 'int256' }, { type: 'bool' }]);
  });

  it('keeps resource-free non-tail recursion on the kernel route', () => {
    const artifact = compileString(`contract C() {
      function sum(int remaining) internal pure returns (int) {
        if (remaining == 0) return 0;
        return remaining + sum(remaining - 1);
      }
      function total(int remaining) public pure returns (int) { return sum(remaining); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'total'))
      .toMatchObject({ eligible: true });
  });

  it('lowers a read-only journal-bearing mutual recursion fold before kernel admission', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function left(int n, int key) public returns (int) {
        if (n == 0) return this.values[key];
        return right(n - 1, key) + this.values[key];
      }
      function right(int n, int key) internal returns (int) {
        if (n == 0) return this.values[key];
        return left(n - 1, key) + this.values[key];
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'left'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('lowers a read-only journal-bearing self-recursion fold before kernel admission', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function sum(int n, int key) public returns (int) {
        if (n == 0) return this.values[key];
        return sum(n - 1, key) + n;
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'sum'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((entry) => entry.name === 'sum')?.recursiveStateHandler).toBeUndefined();
  });

  it('lowers scalar assignments and deletes whose continuation precedes descent', () => {
    const artifact = compileString(`contract C() {
      int calls;
      int cleared;
      mapping(int => int) values;
      function left(int n, int key) public returns (int) {
        this.calls = this.calls + 1;
        delete this.cleared;
        if (n == 0) return this.values[key];
        return n + right(n - 1, key);
      }
      function right(int n, int key) internal returns (int) {
        this.calls = this.calls + 1;
        delete this.cleared;
        if (n == 0) return this.values[key];
        return n + left(n - 1, key);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'left'))
      .toMatchObject({ eligible: true });
  });

  it('lowers a recursive-first scalar fold with a stable continuation operand', () => {
    const artifact = compileString(`contract C() {
      int calls;
      mapping(int => int) values;
      function left(int n, int key) public returns (int) {
        this.calls = this.calls + 1;
        if (n == 0) return this.values[key];
        return right(n - 1, key) + this.values[key];
      }
      function right(int n, int key) internal returns (int) {
        this.calls = this.calls + 1;
        if (n == 0) return this.values[key];
        return left(n - 1, key) + this.values[key];
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'left'))
      .toMatchObject({ eligible: true });
  });

  it('lowers an overlapping scalar-state continuation by reevaluating it during unwind', () => {
    const artifact = compileString(`contract C() {
      int calls;
      mapping(int => int) values;
      function left(int n, int key) public returns (int) {
        this.calls = this.calls + 1;
        if (n == 0) return this.values[key];
        return right(n - 1, key) + this.calls;
      }
      function right(int n, int key) internal returns (int) {
        this.calls = this.calls + 1;
        if (n == 0) return this.values[key];
        return left(n - 1, key) + this.calls;
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'left'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((entry) => entry.name === 'left')?.recursiveStateHandler).toBeUndefined();
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('lowers a nested unary/binary continuation spine with distinct operators', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function left(int n, int key) public returns (int) {
        if (n == 0) return this.values[key];
        return -((right(n - 1, key) * 2) + n);
      }
      function right(int n, int key) internal returns (int) {
        if (n == 0) return this.values[key];
        return -((left(n - 1, key) - n) * 3);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'left'))
      .toMatchObject({ eligible: true });
  });

  it('lowers logical negation around a recursive boolean result', () => {
    const artifact = compileString(`contract C() {
      mapping(int => bool) values;
      function toggle(int n, int key) public returns (bool) {
        if (n == 0) return this.values[key];
        return !toggle(n - 1, key);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'toggle'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((entry) => entry.name === 'toggle')?.recursiveStateHandler).toBeUndefined();
  });

  it('lowers dynamic scalar-state assignments and deletes in a recursion fold', () => {
    const artifact = compileString(`contract C() {
      string note;
      bytes scratch;
      function sum(int n) public returns (int) {
        this.note = "frame";
        delete this.scratch;
        if (n == 0) return 0;
        return n + sum(n - 1);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'sum'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((entry) => entry.name === 'sum')?.recursiveStateHandler).toBeUndefined();
  });

  it('lowers whole-struct state assignments in a recursion fold', () => {
    const artifact = compileString(`contract C() {
      struct Record { int value; bool active; }
      Record record;
      function sum(int n) public returns (int) {
        this.record = Record(n, n > 0);
        if (n == 0) return this.record.value;
        return n + sum(n - 1);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'sum'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((entry) => entry.name === 'sum')?.recursiveStateHandler).toBeUndefined();
  });

  it('lowers a deferred struct-state projection by reevaluating it during unwind', () => {
    const artifact = compileString(`contract C() {
      struct Record { int value; bool active; }
      Record record;
      function sum(int n) public returns (int) {
        this.record = Record(n, n > 0);
        if (n == 0) return 5;
        return sum(n - 1) + this.record.value;
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'sum'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((entry) => entry.name === 'sum')?.recursiveStateHandler).toBeUndefined();
  });

  it('lowers an invariant-key mapping assignment in a recursion fold', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function sum(int n, int key) public returns (int) {
        this.values[key] = n;
        if (n == 0) return 0;
        return n + sum(n - 1, key);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'sum'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((entry) => entry.name === 'sum')?.recursiveStateHandler).toBeUndefined();
  });

  it('lowers an invariant-key mapping delete in a recursion fold', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function sum(int n, int key) public returns (int) {
        delete this.values[key];
        if (n == 0) return 0;
        return n + sum(n - 1, key);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'sum'))
      .toMatchObject({ eligible: true });
    const sum = artifact.abi.find((entry) => entry.name === 'sum');
    expect(sum?.recursiveStateHandler).toBeUndefined();
    expect(sum?.entryAccesses).toContainEqual(expect.objectContaining({
      collection: 'values', operations: ['read', 'write'],
    }));
    expect(sum?.entryAccesses?.find((entry) => entry.collection === 'values')?.inLoop).not.toBe(true);
    expect(sum?.sortedUpsertLoopInfo).toBeUndefined();
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('lowers an invariant nested-mapping delete in a recursion fold', () => {
    const artifact = compileString(`contract C() {
      mapping(int => mapping(int => int)) values;
      function sum(int n, int group, int key) public returns (int) {
        delete this.values[group][key];
        if (n == 0) return this.values[group][key];
        return n + sum(n - 1, group, key);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'sum'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((entry) => entry.name === 'sum')?.entryAccesses)
      .toContainEqual(expect.objectContaining({
        collection: 'values', operations: ['read', 'write'],
      }));
  });

  it('lowers an affine varying-key mapping delete to an authenticated rank stream', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function sum(int n) public returns (int) {
        delete this.values[n];
        if (n == 0) return 0;
        return sum(n - 1);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'sum'))
      .toMatchObject({ eligible: true });
    const sum = artifact.abi.find((entry) => entry.name === 'sum');
    expect(sum?.recursiveStateHandler).toBeUndefined();
    expect(sum).toMatchObject({
      sortedUpsertLoopInfo: [expect.objectContaining({ collection: 'values', op: 'delete' })],
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('lowers an invariant mapping read/write transition in a recursion fold', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function sum(int n, int key) public returns (int) {
        this.values[key] = n;
        if (n == 0) return this.values[key];
        return n + sum(n - 1, key);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'sum'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((entry) => entry.name === 'sum')?.recursiveStateHandler).toBeUndefined();
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('lowers an invariant mapping-field update in a recursion fold', () => {
    const artifact = compileString(`contract C() {
      struct Record { int value; bool active; }
      mapping(int => Record) values;
      function sum(int n, int key) public returns (int) {
        this.values[key].value = n;
        if (n == 0) return 0;
        return n + sum(n - 1, key);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'sum'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((entry) => entry.name === 'sum')?.recursiveStateHandler).toBeUndefined();
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('propagates an invariant mapping recursion fold through an internal caller', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      int result;
      function sum(int n, int key) internal returns (int) {
        this.values[key] = this.values[key] + 1;
        if (n == 0) return this.values[key];
        return n + sum(n - 1, key);
      }
      function run(int n, int key) public {
        this.result = sum(n, key);
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'run'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((entry) => entry.name === 'run')?.recursiveStateHandler).toBeUndefined();
  });

  it('lowers an affine varying-key mapping write to an authenticated rank stream', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function sum(int n) public returns (int) {
        this.values[n] = n;
        if (n == 0) return 0;
        return sum(n - 1);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'sum'))
      .toMatchObject({ eligible: true });
    const sum = artifact.abi.find((entry) => entry.name === 'sum');
    expect(sum?.recursiveStateHandler).toBeUndefined();
    expect(sum).toMatchObject({
      sortedUpsertLoopInfo: [expect.objectContaining({ collection: 'values', op: 'set' })],
    });
    const requireMessages = [
      ...(artifact.debug?.requires ?? []),
      ...Object.values(artifact.debug?.functionDebug ?? {}).flatMap((debug) => debug.requires),
      ...Object.values(artifact.debug?.invokeDebug ?? {}).flatMap((debug) => debug.requires),
    ].map((entry) => entry.message);
    expect(requireMessages).toContain('recursive affine frame count must be exact and between 0 and 64');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('replays pure local aliases in an affine recursive mapping value', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function fill(int remaining) public returns (int) {
        int value = remaining + 10;
        this.values[remaining] = value;
        if (remaining == 0) return 0;
        return fill(remaining - 1);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'fill'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((entry) => entry.name === 'fill')?.sortedUpsertLoopInfo)
      .toEqual([expect.objectContaining({ collection: 'values', op: 'set' })]);
  });

  it('recognizes an unconditional affine recursive write inside a transparent block', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function fill(int remaining) public returns (int) {
        { this.values[remaining] = remaining + 10; }
        if (remaining == 0) return 0;
        return fill(remaining - 1);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'fill'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((entry) => entry.name === 'fill')?.sortedUpsertLoopInfo)
      .toEqual([expect.objectContaining({ collection: 'values', op: 'set' })]);
  });

  it.each([
    ['a wrong-direction recursive step', 'this.values[n] = n;', 'return sum(n + 1);'],
    ['a recursive result continuation', 'this.values[n] = n;', 'return n + sum(n - 1);'],
    ['a state-dependent conditional recursive write',
      'if (this.values[n] > 1) { this.values[n] = n; }', 'return sum(n - 1);'],
  ])('keeps %s outside affine recursive mapping streams', (_label, write, recursiveReturn) => {
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function sum(int n) public returns (int) {
        ${write}
        if (n == 0) return 0;
        ${recursiveReturn}
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'sum'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.abi.find((entry) => entry.name === 'sum')?.recursiveStateHandler).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('lowers a deferred dynamic-state projection by reevaluating it during unwind', () => {
    const artifact = compileString(`contract C() {
      string note;
      function sum(int n) public returns (string) {
        this.note = n == 0 ? "z" : "x";
        if (n == 0) return "";
        return sum(n - 1) + this.note;
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'sum'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((entry) => entry.name === 'sum')?.recursiveStateHandler).toBeUndefined();
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('keeps a deferred state expression with a frame-local dependency on the recursive-state path', () => {
    const artifact = compileString(`contract C() {
      struct Record { int value; bool active; }
      Record record;
      function sum(int n) public returns (int) {
        this.record = Record(n, n > 0);
        if (n == 0) return 5;
        return sum(n - 1) + (this.record.value + n);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'sum'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((entry) => entry.name === 'sum')?.recursiveStateHandler).toBe(true);
  });

  it('keeps a transaction projection indexed by mutable state on the recursive-state path', () => {
    const artifact = compileString(`contract C() {
      int cursor;
      function sum(int n) public returns (int) {
        this.cursor = n;
        if (n == 0) return 0;
        return sum(n - 1) + tx.inputs[this.cursor].value;
      }
    }`, KERNEL);
    expect(artifact.abi.find((entry) => entry.name === 'sum')?.recursiveStateHandler).toBe(true);
  });

  it('assigns distinct continuation tags to deferred state expressions across a mutual cycle', () => {
    const artifact = compileString(`contract C() {
      int leftValue;
      int rightValue;
      function left(int n) public returns (int) {
        this.leftValue = n;
        if (n == 0) return 1;
        return right(n - 1) + this.leftValue;
      }
      function right(int n) internal returns (int) {
        this.rightValue = n * 10;
        if (n == 0) return 1;
        return left(n - 1) + this.rightValue;
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'left'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((entry) => entry.name === 'left')?.recursiveStateHandler).toBeUndefined();
  });

  it('lowers a dynamic-state recursion fold with a read-only mapping base', () => {
    const artifact = compileString(`contract C() {
      string note;
      mapping(int => int) values;
      function left(int n, int key) public returns (int) {
        this.note = "left";
        if (n == 0) return this.values[key];
        return n + right(n - 1, key);
      }
      function right(int n, int key) internal returns (int) {
        this.note = "right";
        if (n == 0) return this.values[key];
        return n + left(n - 1, key);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'left'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((entry) => entry.name === 'left')?.recursiveStateHandler).toBeUndefined();
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('does not turn a short-circuited recursive operand into an unconditional loop step', () => {
    const artifact = compileString(`contract C() {
      function left(int n) public pure returns (bool) {
        if (n == 0) return true;
        return false && right(n - 1);
      }
      function right(int n) internal pure returns (bool) {
        if (n == 0) return true;
        return false && left(n - 1);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'left'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((entry) => entry.name === 'left')?.recursiveStateHandler).toBeUndefined();
  });

  it('lowers a true OR guard without executing its recursive right operand', () => {
    const artifact = compileString(`contract C() {
      function left(int n) public pure returns (bool) {
        if (n == 0) return false;
        return true || right(n - 1);
      }
      function right(int n) internal pure returns (bool) {
        if (n == 0) return false;
        return true || left(n - 1);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'left'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((entry) => entry.name === 'left')?.recursiveStateHandler).toBeUndefined();
  });

  it('lowers a nested right-recursive short-circuit spine', () => {
    const artifact = compileString(`contract C() {
      function left(int n) public pure returns (bool) {
        if (n == 0) return false;
        return n > 1 && (n == 2 || right(n - 1));
      }
      function right(int n) internal pure returns (bool) {
        if (n == 0) return false;
        return n > 1 && (n == 2 || left(n - 1));
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'left'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((entry) => entry.name === 'left')?.recursiveStateHandler).toBeUndefined();
  });

  it('keeps a recursive-left short-circuit continuation on the recursive-state path', () => {
    const artifact = compileString(`contract C() {
      function left(int n) public pure returns (bool) {
        if (n == 0) return true;
        return right(n - 1) && false;
      }
      function right(int n) internal pure returns (bool) {
        if (n == 0) return true;
        return left(n - 1) && false;
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'left'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((entry) => entry.name === 'left')?.recursiveStateHandler).toBe(true);
  });

  it('publishes an exact event domain for a guarded void tail call followed by inert requirements', () => {
    const artifact = compileString(`contract C() {
      event Hit(int value);
      function repeat(int n) public {
        emit Hit(n);
        if (n > 0) repeat(n - 1);
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'repeat'))
      .toMatchObject({
        eligible: true,
        runtimeLoopEvents: [{
          iterationDomain: {
            counterName: 'n',
            initialValue: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
            stepValue: { kind: 'unary', operator: '-', expression: {
              kind: 'literal', type: 'bigint', value: '1',
            } },
            maximumIterations: 64,
          },
          eventSignatures: ['Hit(int256)'],
          arguments: [[{ kind: 'identifier', name: 'n' }]],
        }],
      });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it.each([
    ['a nonliteral trailing requirement', 'require(n >= 0);'],
    ['a trailing helper call', 'finish();'],
  ])('keeps a guarded recursive event outside affine replay with %s', (_label, suffix) => {
    const artifact = compileString(`contract C() {
      event Hit(int value);
      function finish() internal pure { require(true); }
      function repeat(int n) public {
        emit Hit(n);
        if (n > 0) repeat(n - 1);
        ${suffix}
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'repeat'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('keeps a guarded recursive event with an else arm outside affine replay', () => {
    const artifact = compileString(`contract C() {
      event Hit(int value);
      function repeat(int n) public {
        emit Hit(n);
        if (n > 0) repeat(n - 1); else emit Hit(0);
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'repeat'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('publishes an exact affine domain for replayable pre-recursion events', () => {
    const artifact = compileString(`contract C() {
      event Seen(int value);
      event Even(int value);
      function descend(int cursor, int offset) public returns (int) {
        emit Seen(cursor + offset);
        if (cursor % 2 == 0) emit Even(cursor);
        if (cursor == 0) return offset;
        return descend(cursor - 1, offset);
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'descend');
    expect(handler).toMatchObject({ eligible: true });
    expect(artifact.messageBus?.route.blockLayout?.trailingCapacity).toBe(128);
    expect(handler?.runtimeLoopEvents).toEqual([{
      iterationDomain: {
        counterName: 'cursor',
        initialValue: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
        stepValue: { kind: 'unary', operator: '-', expression: {
          kind: 'literal', type: 'bigint', value: '1',
        } },
        continueCondition: { kind: 'unary', operator: '!', expression: {
          kind: 'binary', operator: '==', left: { kind: 'identifier', name: 'cursor' },
          right: { kind: 'literal', type: 'bigint', value: '0' },
        } },
        maximumIterations: 64,
      },
      eventSignatures: ['Seen(int256)', 'Even(int256)'],
      arguments: [[{
        kind: 'binary', operator: '+', left: { kind: 'identifier', name: 'cursor' },
        right: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
      }], [{ kind: 'identifier', name: 'cursor' }]],
      conditions: [null, {
        kind: 'binary', operator: '==',
        left: {
          kind: 'binary', operator: '%', left: { kind: 'identifier', name: 'cursor' },
          right: { kind: 'literal', type: 'bigint', value: '2' },
        },
        right: { kind: 'literal', type: 'bigint', value: '0' },
      }],
      effectOrder: [0, 1],
    }]);
  });

  it('publishes the same affine pre-recursion event domain for a canonical void self-call', () => {
    const artifact = compileString(`contract C() {
      event Seen(int value);
      function descend(int cursor, int stride) public {
        emit Seen(cursor);
        if (cursor == 0) return;
        descend(cursor - stride, stride);
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'descend');
    expect(handler).toMatchObject({
      eligible: true,
      runtimeLoopEvents: [{
        iterationDomain: {
          counterName: 'cursor',
          initialValue: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
          stepValue: { kind: 'unary', operator: '-', expression: {
            kind: 'source', source: { kind: 'forward', paramIndex: 1 },
          } },
          maximumIterations: 64,
        },
        eventSignatures: ['Seen(int256)'],
        arguments: [[{ kind: 'identifier', name: 'cursor' }]],
      }],
    });
    expect(artifact.messageBus?.route.blockLayout?.trailingCapacity).toBe(64);
  });

  it.each([
    ['multiple varying parameters', 'descend(cursor - 1, other - 1);', true],
    ['a non-affine step', 'descend(cursor / 2, other);', false],
  ])('classifies void recursive event metadata for %s', (_label, recursiveCall, eligible) => {
    const artifact = compileString(`contract C() {
      event Seen(int value);
      function descend(int cursor, int other) public {
        emit Seen(cursor);
        if (cursor == 0) return;
        ${recursiveCall}
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'descend'))
      .toMatchObject(eligible ? { eligible: true } : { eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('keeps recursive event-domain admission invariant under source renaming', () => {
    const compile = (
      contractName: string, functionName: string, counterName: string, eventName: string,
    ): ReturnType<typeof compileString> =>
      compileString(`contract ${contractName}() {
        event ${eventName}(int value);
        function ${functionName}(int ${counterName}) public returns (int) {
          emit ${eventName}(${counterName});
          if (${counterName} == 0) return 0;
          return ${functionName}(${counterName} - 1);
        }
      }`, KERNEL);
    const first = compile('First', 'descend', 'cursor', 'Seen');
    const second = compile('Second', 'advance', 'index', 'Observed');
    const firstHandler = first.messageBus?.handlers.find((candidate) => candidate.name === 'descend');
    const secondHandler = second.messageBus?.handlers.find((candidate) => candidate.name === 'advance');
    expect(firstHandler?.eligible).toBe(true);
    expect(secondHandler?.eligible).toBe(true);
    expect(firstHandler?.runtimeLoopEvents?.[0].iterationDomain).toMatchObject({ maximumIterations: 64 });
    expect(secondHandler?.runtimeLoopEvents?.[0].iterationDomain).toMatchObject({ maximumIterations: 64 });
  });

  it.each([
    ['multiple varying parameters', 'return descend(cursor - 1, other - 1);', true],
    ['a non-affine step', 'return descend(cursor / 2, other);', false],
  ])('classifies recursive event metadata for %s', (_label, recursiveReturn, eligible) => {
    const artifact = compileString(`contract C() {
      event Seen(int value);
      function descend(int cursor, int other) public returns (int) {
        emit Seen(cursor);
        if (cursor == 0) return other;
        ${recursiveReturn}
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'descend'))
      .toMatchObject(eligible ? { eligible: true } : { eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('refuses an event-bearing recursive closure without an exact occurrence plan', () => {
    const artifact = compileString(`contract C() {
      event Hit(int value);
      function repeat(int n) public {
        if (n > 0) repeat(n - 1);
        emit Hit(n);
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'repeat'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('publishes runtime occurrence metadata for a canonical mutable-parameter event loop', () => {
    const artifact = compileString(`contract C() {
      event Hit(int value);
      function repeat(int n) public {
        while (n > 0) {
          emit Hit(n);
          n = n - 1;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'repeat'))
      .toMatchObject({
        eligible: true,
        runtimeLoopEvents: [{
          permutationParam: expect.stringMatching(/^__internal__vmapCounterPerm_/),
          iterationBound: expect.any(Object),
          eventSignatures: ['Hit(int256)'],
        }],
      });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('normalizes explicit value and void base-case returns in tail recursion', () => {
    const artifact = compileString(`contract C() {
      int calls;
      function value(int remaining) internal returns (int result) {
        if (remaining == 0) return 7;
        return value(remaining - 1);
      }
      function count(int remaining) internal {
        if (remaining == 0) return;
        this.calls = this.calls + 1;
        count(remaining - 1);
      }
      function run(int remaining) public returns (int result) {
        count(remaining);
        result = value(remaining);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'run'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('normalizes an unnamed tail-recursive result without naming its public ABI output', () => {
    const artifact = compileString(`contract C() {
      function value(int remaining) public returns (int) {
        if (remaining == 0) return 7;
        return value(remaining - 1);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'value'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'value')?.outputs)
      .toEqual([{ type: 'int256' }]);
  });

  it('normalizes unnamed tail-recursive result tuples', () => {
    const artifact = compileString(`contract C() {
      function pair(int remaining) public returns (int, bool) {
        if (remaining == 0) return (7, true);
        return pair(remaining - 1);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pair'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'pair')?.outputs)
      .toEqual([{ type: 'int256' }, { type: 'bool' }]);
  });

  it('normalizes named tail-recursive result tuples', () => {
    const artifact = compileString(`contract C() {
      function pair(int remaining) public returns (int left, bool complete) {
        if (remaining == 0) return (7, true);
        return pair(remaining - 1);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pair'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'pair')?.outputs)
      .toEqual([{ type: 'int256' }, { type: 'bool' }]);
  });

  it('normalizes tail-recursive base returns nested in a source loop', () => {
    const artifact = compileString(`contract C() {
      int calls;
      function find(int remaining) public returns (int result) {
        this.calls = this.calls + 1;
        for (int i = 0; i < 2; i = i + 1) {
          if (i == remaining) { result = this.calls * 10 + i; return; }
        }
        if (remaining == 0) return 99;
        return find(remaining - 1);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'find'))
      .toMatchObject({ eligible: true });
  });

  it('binds a transaction signature-array as a row-aligned nested route witness', () => {
    const artifact = compileString(`contract C() {
      function signed(sig[] signatures) public { require(true); }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'signed')).toMatchObject({
      eligible: true,
    });
    expect(artifact.messageBus?.route.inputs).toContainEqual(expect.objectContaining({
      name: '__message_bus_sig_0_0_rows', type: 'sig[][]',
    }));
  });

  it('binds a nested transaction signature-array with one additional row dimension', () => {
    const artifact = compileString(`contract C() {
      function signed(sig[][] signatures) public { require(true); }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'signed')).toMatchObject({
      eligible: true,
    });
    expect(artifact.messageBus?.route.inputs).toContainEqual(expect.objectContaining({
      name: '__message_bus_sig_0_0_rows', type: 'sig[][][]',
    }));
  });

  it.each([
    ['a struct', 'Auth auth', 'sig[]'],
    ['an array of structs', 'Auth[] auth', 'sig[][]'],
  ])('binds a transaction signature nested inside %s to a detached route witness', (_label, input, witnessType) => {
    const artifact = compileString(`contract C() {
      struct Auth { sig signature; pubkey key; }
      function signed(${input}) public { require(true); }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'signed')).toMatchObject({
      eligible: true,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.route.inputs).toContainEqual(expect.objectContaining({
      name: '__message_bus_sig_0_0_rows', type: witnessType,
    }));
  });

  it('publishes one detached witness per nested signature field', () => {
    const artifact = compileString(`contract C() {
      struct Auth { sig first; sig second; pubkey key; }
      function signed(Auth auth) public { require(true); }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'signed'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.route.inputs).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: '__message_bus_sig_0_0_0_rows', type: 'sig[]' }),
      expect.objectContaining({ name: '__message_bus_sig_0_0_1_rows', type: 'sig[]' }),
    ]));
  });

  it('preserves fixed array dimensions in a nested signature witness', () => {
    const artifact = compileString(`contract C() {
      struct Auth { sig signature; pubkey key; }
      function signed(Auth[2] auth) public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'signed'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.route.inputs).toContainEqual(expect.objectContaining({
      name: '__message_bus_sig_0_0_rows', type: 'sig[2][]',
    }));
  });

  it('keeps a code-local transaction signature fenced without a detached signing policy', () => {
    const artifact = compileString(`contract C(pubkey owner) {
      function denied() public { require(checkSig(sig(hex"00"), owner)); }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('reserves a predecessor beside all 64 counter-keyed mapping operations', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function fill(int n) public {
        for (int i = 0; i < n; i = i + 1) { slots[i] = 1; }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'fill')).toMatchObject({
      eligible: true,
    });
    const handler = artifact.abi.find((candidate) => candidate.name === 'fill')!;
    const permutation = handler.inputs.find((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))!;
    expect(permutation.type).toBe('int256[]');
    expect(artifact.messageBus?.route.inputs).toContainEqual(expect.objectContaining({
      name: permutation.name,
      type: 'int256[][]',
    }));
    expect(artifact.messageBus?.route.blockLayout?.trailingCapacity).toBe(65);
  });

  it.each([
    ['two collections in one loop', `
      mapping(int => int) left;
      mapping(int => int) right;
      function fill(int count) public {
        for (int i = 0; i < count; i = i + 1) { left[i] = i; right[i] = i; }
        require(true);
      }`, true],
    ['two loops over one collection', `
      mapping(int => int) values;
      function fill(int first, int second) public {
        for (int i = 0; i < first; i = i + 1) { values[i] = i; }
        for (int j = 0; j < second; j = j + 1) { values[j + 100] = j; }
        require(true);
      }`, true],
  ])('classifies two independent mapping-only streams for %s', (_label, body, eligible) => {
    const artifact = compileString(`contract C() { ${body} }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'fill'))
      .toMatchObject(eligible ? { eligible: true } : { eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    if (eligible) expect(artifact.messageBus?.route.blockLayout?.trailingCapacity).toBe(2 * 65);
  });

  it('permutes counter uses inside pure helper and builtin mapping values', () => {
    for (const value of ['twice(i)', 'max(i, 10)']) {
      const artifact = compileString(`contract C() {
        mapping(int => int) slots;
        function twice(int value) internal pure returns (int) { return value * 2; }
        function fill(int n) public {
          for (int i = 0; i < n; i = i + 1) { slots[i] = ${value}; }
          require(true);
        }
      }`, KERNEL);
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'fill')?.eligible).toBe(true);
      expect(artifact.messageBus?.route.inputs.some((input) =>
        input.name.startsWith('__internal__vmapCounterPerm_'))).toBe(true);
    }
  });

  it('journals a general same-entry expression without reinterpreting it as addition', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function transform(int n) public {
        for (int i = 0; i < n; i = i + 1) { slots[i] = max(slots[i] * 2, slots[i] + i); }
        require(true);
      }
      function credit(int n, int amount) public {
        for (int i = 0; i < n; i = i + 1) { slots[i] = slots[i] + amount; }
        require(true);
      }
      function debit(int n, int amount) public {
        for (int i = 0; i < n; i = i + 1) { slots[i] = slots[i] - amount; }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'transform')?.eligible).toBe(true);
    expect(artifact.abi.find((handler) => handler.name === 'transform')?.sortedUpsertLoopInfo).toEqual([
      expect.objectContaining({
        op: 'set',
        valueRuntimeExpression: true,
        oldValuesWitnessParam: expect.stringMatching(/^__internal__vmapCounterOld_/),
      }),
    ]);
    expect(artifact.messageBus?.route.inputs).toContainEqual(expect.objectContaining({
      name: expect.stringMatching(/^__internal__vmapCounterOld_/),
      type: 'int256[][]',
    }));
    expect(artifact.abi.find((handler) => handler.name === 'transform')?.inputs).toContainEqual({
      name: '__internal__kernelJournalAccessStreams', type: 'bytes[]',
    });
    expect(artifact.messageBus?.route.inputs).toContainEqual({
      name: '__internal__kernelJournalAccessStreams', type: 'bytes[][]',
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'credit')?.eligible).toBe(true);
    expect(artifact.abi.find((handler) => handler.name === 'credit')?.sortedUpsertLoopInfo).toEqual([
      expect.objectContaining({ op: '+', valueScalarParam: 'amount' }),
    ]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'credit')?.batchKeyWitnesses)
      .toBeUndefined();
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'debit')?.eligible).toBe(true);
    expect(artifact.abi.find((handler) => handler.name === 'debit')?.sortedUpsertLoopInfo).toEqual([
      expect.objectContaining({ op: '-', valueScalarParam: 'amount' }),
    ]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'debit')?.batchKeyWitnesses)
      .toBeUndefined();
    expect(artifact.messageBus?.route.inputs.some((input) => input.name.startsWith('__message_bus_key_slots_')))
      .toBe(false);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'control')?.eligible).toBe(true);
  });

  it('journals a general boolean same-entry expression', () => {
    const artifact = compileString(`contract C() {
      mapping(int => bool) flags;
      function flip(int n) public {
        for (int i = 0; i < n; i = i + 1) { this.flags[i] = !this.flags[i]; }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'flip');
    expect(handler).toMatchObject({ eligible: true });
    expect(artifact.abi.find((candidate) => candidate.name === 'flip')?.inputs).toContainEqual(
      expect.objectContaining({ name: expect.stringMatching(/^__internal__vmapCounterOld_/), type: 'bool[]' }),
    );
  });

  it.each(['fixed128x18', 'ufixed128x18'])(
    'journals a general %s same-entry expression', (type) => {
      const artifact = compileString(`contract C() {
        mapping(int => ${type}) values;
        function raise(int n, ${type} floor) public {
          for (int i = 0; i < n; i = i + 1) {
            this.values[i] = this.values[i] > floor ? this.values[i] : floor;
          }
          require(true);
        }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
      const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'raise');
      expect(handler).toMatchObject({ eligible: true });
      expect(artifact.abi.find((candidate) => candidate.name === 'raise')?.inputs).toContainEqual(
        expect.objectContaining({
          name: expect.stringMatching(/^__internal__vmapCounterOld_/), type: `${type}[]`,
        }),
      );
    },
  );

  it.each(['bytes20', 'address', 'pubkey', 'datasig'])(
    'journals a general %s same-entry expression', (type) => {
      const artifact = compileString(`contract C() {
        mapping(int => ${type}) values;
        function replace(int n, ${type} expected, ${type} replacement) public {
          for (int i = 0; i < n; i = i + 1) {
            this.values[i] = this.values[i] == expected ? replacement : this.values[i];
          }
          require(true);
        }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
      const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'replace');
      expect(handler).toMatchObject({ eligible: true });
      expect(artifact.abi.find((candidate) => candidate.name === 'replace')?.inputs).toContainEqual(
        expect.objectContaining({
          name: expect.stringMatching(/^__internal__vmapCounterOld_/), type: `${type}[]`,
        }),
      );
    },
  );

  it('journals a direct structural same-entry expression', () => {
    const artifact = compileString(`contract C() {
      struct Pair { int left; int right; }
      mapping(int => Pair) pairs;
      function update(int n) public {
        for (int i = 0; i < n; i = i + 1) {
          this.pairs[i] = Pair(this.pairs[i].left + 1, this.pairs[i].right + 2);
        }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'update');
    expect(handler).toMatchObject({ eligible: true });
    expect(artifact.abi.find((candidate) => candidate.name === 'update')?.inputs).toContainEqual(
      expect.objectContaining({ name: expect.stringMatching(/^__internal__vmapCounterOld_/), type: 'Pair[]' }),
    );
    expect(artifact.abi.find((candidate) => candidate.name === 'update')?.sortedUpsertLoopInfo).toContainEqual(
      expect.objectContaining({ collection: 'pairs', valueRuntimeExpression: true }),
    );
  });

  it.each([
    ['bytes', 'bytes suffix', 'bytes.concat(this.values[i], suffix)', 'bytes[]'],
    ['string', 'string suffix', 'string.concat(this.values[i], suffix)', 'string[]'],
  ])('journals a direct dynamic %s same-entry expression', (_label, parameter, expression, witnessType) => {
    const artifact = compileString(`contract C() {
      mapping(int => ${_label}) values;
      function append(int n, ${parameter}) public {
        for (int i = 0; i < n; i = i + 1) {
          this.values[i] = ${expression};
        }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'append');
    expect(handler).toMatchObject({ eligible: true });
    expect(artifact.abi.find((candidate) => candidate.name === 'append')?.inputs).toContainEqual(
      expect.objectContaining({ name: expect.stringMatching(/^__internal__vmapCounterOld_/), type: witnessType }),
    );
    expect(artifact.abi.find((candidate) => candidate.name === 'append')?.sortedUpsertLoopInfo).toContainEqual(
      expect.objectContaining({ collection: 'values', valueRuntimeExpression: true, op: 'set' }),
    );
  });

  it('keeps an effectful helper in source order while permuting its replayable result', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      int calls;
      function next(int value) internal returns (int) {
        this.calls = this.calls + 1;
        return value;
      }
      function denied(int n) public {
        for (int i = 0; i < n; i = i + 1) { slots[i] = next(i); }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'control')?.eligible).toBe(true);
  });

  it('admits an expression-keyed mapping write', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      int next;
      function push(int n) public {
        this.slots[this.next] = n;
        this.next = this.next + 1;
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'push')).toMatchObject({
      eligible: true,
    });
  });

  it('admits a literal local key array that unrolls to an expression-keyed write', () => {
    const artifact = compileString(`contract C() {
      mapping(int => mapping(bytes20 => int)) seen;
      bytes20 member;
      function clear(int id) public {
        bytes20[] xs = new bytes20[](1);
        xs[0] = this.member;
        for (int i = 0; i < xs.length; i = i + 1) {
          this.seen[id][xs[i]] = 0;
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'clear')).toMatchObject({
      eligible: true,
    });
  });

  it('admits an expression-keyed parameter-array mapping loop', () => {
    const artifact = compileString(`contract C() {
      mapping(int => mapping(bytes20 => int)) seen;
      int[] records;
      function create(bytes20[] keys) public {
        this.records.push(0);
        int id = this.records.length - 1;
        for (int i = 0; i < int(keys.length); i = i + 1) {
          this.seen[id][keys[i]] = 1;
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'create')).toMatchObject({
      eligible: true,
    });
  });

  it('refuses foreign delegatecall as KERNEL_FOREIGN_DELEGATE', () => {
    const artifact = compileString(`contract C(address impl) {
      function denied(bytes input) public {
        impl.delegatecall(input);
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.abi.find((fn) => fn.name === 'denied')).toMatchObject({
      delegateForwarding: {
        version: 1,
        callIndex: 0,
        payloadInput: 0,
        target: { kind: 'constructorArg', name: 'impl' },
        targetBinding: { kind: 'constructorArg', input: 0, name: 'impl' },
        frame: {
          stateOwner: 'participant', executor: 'target-input', calldata: 'payload-input',
          outputOwner: 'participant',
        },
        terminalRequire: true,
      },
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      delegateForwarding: artifact.abi.find((fn) => fn.name === 'denied')?.delegateForwarding,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_FOREIGN_DELEGATE',
    });
  });

  it('publishes an exact literal delegate target binding without admitting the frame', () => {
    const artifact = compileString(`contract C() {
      function denied(bytes input) public {
        address(hex"51").delegatecall(input);
        require(true);
      }
    }`, KERNEL);
    expect(artifact.abi.find((fn) => fn.name === 'denied')?.delegateForwarding).toMatchObject({
      version: 1,
      target: { kind: 'literal' },
      targetBinding: { kind: 'literal', lockingBytecode: '51' },
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_FOREIGN_DELEGATE',
    });
  });

  it.each([
    ['state-resolved target', 'address stored; function denied(bytes input) public { address(this.stored).delegatecall(input); require(true); }'],
    ['computed payload', 'function denied(bytes input) public { impl.delegatecall(bytes.concat(input, hex"00")); require(true); }'],
    ['proxy-side statement', 'function denied(bytes input) public { require(input.length > 0); impl.delegatecall(input); require(true); }'],
    ['conditional frame', 'function denied(bytes input, bool active) public { if (active) { impl.delegatecall(input); } require(true); }'],
  ])('does not publish a collapsible delegate frame for %s', (_label, body) => {
    const artifact = compileString(`contract C(address impl) {
      ${body}
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.abi.find((fn) => fn.name === 'denied')).not.toHaveProperty('delegateForwarding');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_FOREIGN_DELEGATE',
    });
  });

  it('admits isolated stack-neutral native assembly', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract C() {
        function denied() public { assembly { OP_1 OP_DROP } require(true); }
        function control() public { require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: true,
    });
  });

  it.each([
    ['local duplication', 'OP_1 OP_DUP OP_DROP OP_DROP'],
    ['truthy literal conditional duplication', 'OP_7 OP_IFDUP OP_7 OP_NUMEQUALVERIFY OP_7 OP_NUMEQUALVERIFY'],
    ['false literal conditional duplication', 'OP_0 OP_IFDUP OP_0 OP_NUMEQUALVERIFY'],
    ['false pushed negative-zero conditional duplication', '80 OP_IFDUP OP_DROP'],
    ['literal-depth local pick', 'OP_7 OP_0 OP_PICK OP_NUMEQUALVERIFY'],
    ['pushed-depth local pick', '07 00 OP_PICK OP_NUMEQUALVERIFY'],
    ['literal-depth local roll', 'OP_7 OP_8 OP_1 OP_ROLL OP_7 OP_NUMEQUALVERIFY OP_8 OP_NUMEQUALVERIFY'],
    ['pushed-depth local roll', '07 08 01 OP_ROLL 07 OP_NUMEQUALVERIFY 08 OP_NUMEQUALVERIFY'],
    ['balanced local alt-stack use', 'OP_1 OP_TOALTSTACK OP_FROMALTSTACK OP_DROP'],
    ['pure data hashing', 'OP_1 OP_SHA256 OP_DROP'],
    ['closed data-signature predicate', 'OP_0 OP_0 OP_0 OP_CHECKDATASIG OP_DROP'],
    ['closed data-signature verifier', 'OP_0 OP_0 OP_0 OP_CHECKDATASIGVERIFY'],
    ['pure byte inversion', '0xa50f OP_INVERT 0x5af0 OP_EQUALVERIFY'],
    ['numeric left shift', 'OP_3 OP_2 OP_LSHIFTNUM OP_12 OP_NUMEQUALVERIFY'],
    ['numeric right shift', 'OP_16 OP_2 OP_RSHIFTNUM OP_4 OP_NUMEQUALVERIFY'],
    ['fixed-width binary left shift', '0x1234 OP_4 OP_LSHIFTBIN 0x2340 OP_EQUALVERIFY'],
    ['fixed-width binary right shift', '0x1234 OP_4 OP_RSHIFTBIN 0x0123 OP_EQUALVERIFY'],
    ['legacy-named fixed-width binary left shift', '0x1234 OP_4 OP_LSHIFT 0x2340 OP_EQUALVERIFY'],
    ['legacy-named fixed-width binary right shift', '0x1234 OP_4 OP_RSHIFT 0x0123 OP_EQUALVERIFY'],
    ['balanced conditional', 'OP_1 OP_IF OP_2 OP_DROP OP_ELSE OP_3 OP_DROP OP_ENDIF'],
    ['balanced nested conditionals', `OP_1 OP_IF
      OP_0 OP_NOTIF OP_4 OP_DROP OP_ELSE OP_5 OP_DROP OP_ENDIF
      OP_ELSE OP_6 OP_DROP OP_ENDIF`],
    ['balanced countdown loop', `OP_3 OP_BEGIN
      OP_1SUB OP_DUP OP_0 OP_NUMEQUAL OP_UNTIL OP_DROP`],
    ['balanced loop with a conditional', `OP_2 OP_BEGIN
      OP_1SUB OP_DUP OP_IF OP_7 OP_DROP OP_ELSE OP_8 OP_DROP OP_ENDIF
      OP_DUP OP_0 OP_NUMEQUAL OP_UNTIL OP_DROP`],
    ['balanced nested loops', `OP_2 OP_BEGIN
      OP_2 OP_BEGIN OP_1SUB OP_DUP OP_0 OP_NUMEQUAL OP_UNTIL OP_DROP
      OP_1SUB OP_DUP OP_0 OP_NUMEQUAL OP_UNTIL OP_DROP`],
  ])('admits isolated native assembly with %s', (_description, asm) => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract C() {
        function denied() public { assembly { ${asm} } require(true); }
        function control() public { require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: true,
    });
  });

  it.each([
    ['active input index', 'OP_INPUTINDEX OP_DROP'],
    ['transaction header', 'OP_TXVERSION OP_DROP OP_TXINPUTCOUNT OP_DROP OP_TXOUTPUTCOUNT OP_DROP'],
    ['indexed output inspection', 'OP_0 OP_OUTPUTVALUE OP_DROP'],
    ['indexed token inspection', 'OP_0 OP_UTXOTOKENCATEGORY OP_DROP'],
    ['absolute locktime constraint', 'OP_1 OP_CHECKLOCKTIMEVERIFY OP_DROP'],
    ['relative locktime constraint', 'OP_1 OP_CHECKSEQUENCEVERIFY OP_DROP'],
    ['immediately discarded ambient depth', 'OP_DEPTH OP_DROP'],
    ['immediately discarded active bytecode', 'OP_ACTIVEBYTECODE OP_DROP'],
  ])('admits isolated native assembly with read-only %s', (_description, asm) => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract C() {
        function denied() public { assembly { ${asm} } require(true); }
        function control() public { require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: true,
    });
  });

  it.each([
    ['main-stack underflow', 'OP_DROP'],
    ['alt-stack underflow', 'OP_FROMALTSTACK OP_DROP'],
    ['unbalanced main stack', 'OP_1'],
    ['unbalanced alt stack', 'OP_1 OP_TOALTSTACK'],
    ['dynamic stack reach', 'OP_1 OP_PICK OP_DROP'],
    ['runtime-selected stack reach', 'OP_7 OP_TXVERSION OP_PICK OP_2DROP'],
    ['local roll reaching the compiler stack', 'OP_1 OP_ROLL'],
    ['runtime-selected local roll', 'OP_7 OP_TXVERSION OP_ROLL OP_DROP'],
    ['ambient compiler stack depth used by arithmetic', 'OP_DEPTH OP_1ADD OP_DROP'],
    ['ambient compiler stack depth used by verification', 'OP_DEPTH OP_VERIFY'],
    ['byte inversion borrowed from compiler stack', 'OP_INVERT OP_DROP'],
    ['numeric left-shift value borrowed from compiler stack', 'OP_1 OP_LSHIFTNUM OP_DROP'],
    ['numeric right-shift value borrowed from compiler stack', 'OP_1 OP_RSHIFTNUM OP_DROP'],
    ['binary left-shift value borrowed from compiler stack', 'OP_1 OP_LSHIFTBIN OP_DROP'],
    ['binary right-shift value borrowed from compiler stack', 'OP_1 OP_RSHIFTBIN OP_DROP'],
    ['legacy binary left-shift value borrowed from compiler stack', 'OP_1 OP_LSHIFT OP_DROP'],
    ['legacy binary right-shift value borrowed from compiler stack', 'OP_1 OP_RSHIFT OP_DROP'],
    ['data-signature predicate borrowing one compiler value', 'OP_0 OP_0 OP_CHECKDATASIG OP_DROP'],
    ['data-signature predicate borrowing two compiler values', 'OP_0 OP_CHECKDATASIG OP_DROP'],
    ['data-signature predicate borrowing three compiler values', 'OP_CHECKDATASIG OP_DROP'],
    ['data-signature verifier borrowing one compiler value', 'OP_0 OP_0 OP_CHECKDATASIGVERIFY'],
    ['transaction signature check', 'OP_0 OP_0 OP_CHECKSIG OP_DROP'],
    ['hashed active-bytecode context', 'OP_ACTIVEBYTECODE OP_SHA256 OP_DROP'],
    ['copied active-bytecode context', 'OP_ACTIVEBYTECODE OP_DUP OP_2DROP'],
    ['inspection index borrowed from compiler stack', 'OP_OUTPUTVALUE OP_DROP'],
    ['locktime threshold borrowed from compiler stack', 'OP_CHECKLOCKTIMEVERIFY'],
    ['sequence threshold borrowed from compiler stack', 'OP_CHECKSEQUENCEVERIFY'],
    ['conditional borrowed from compiler stack', 'OP_IF OP_ENDIF'],
    ['loop condition borrowed from compiler stack', 'OP_BEGIN OP_DUP OP_UNTIL OP_DROP'],
  ])('refuses native assembly with %s', (_description, asm) => {
    expect(denied(`pragma solidcash >=0.8.0;
      contract C() {
        function denied() public { assembly { ${asm} } require(true); }
        function control() public { require(true); }
      }`, 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_OPAQUE_EFFECT',
    });
  });

  it.each([
    ['compiler-stack value', 'OP_IFDUP'],
    ['runtime transaction value', 'OP_TXVERSION OP_IFDUP OP_2DROP'],
  ])('rejects OP_IFDUP with runtime-dependent truthiness from a %s', (_description, asm) => {
    expect(() => compileString(`contract C() {
      function denied() public { assembly { ${asm} } require(true); }
    }`, KERNEL)).toThrow(/OP_IFDUP|statically trackable/);
  });

  it.each([
    ['main stack', 'OP_1 OP_IF OP_2 OP_ENDIF'],
    ['alt stack', 'OP_1 OP_IF OP_2 OP_TOALTSTACK OP_ENDIF'],
  ])('rejects a native conditional with divergent %s height', (_description, asm) => {
    expect(() => compileString(`contract C() {
      function denied() public { assembly { ${asm} } require(true); }
    }`, KERNEL)).toThrow(/assembly conditional stack-height mismatch/);
  });

  it.each([
    ['main stack', 'OP_BEGIN OP_1 OP_1 OP_UNTIL'],
    ['alt stack', 'OP_BEGIN OP_1 OP_TOALTSTACK OP_1 OP_UNTIL'],
  ])('rejects a native loop with divergent %s height', (_description, asm) => {
    expect(() => compileString(`contract C() {
      function denied() public { assembly { ${asm} } require(true); }
    }`, KERNEL)).toThrow(/assembly loop stack-height mismatch/);
  });

  it.each([
    ['unmatched else', 'OP_ELSE', /OP_ELSE has no matching/],
    ['unmatched endif', 'OP_ENDIF', /OP_ENDIF has no matching/],
    ['missing endif', 'OP_1 OP_IF', /missing OP_ENDIF/],
    ['second else', 'OP_1 OP_IF OP_ELSE OP_ELSE OP_ENDIF', /only one OP_ELSE/],
    ['unmatched until', 'OP_1 OP_UNTIL', /OP_UNTIL has no matching/],
    ['missing until', 'OP_BEGIN OP_1', /loop is missing OP_UNTIL/],
    ['crossed loop and conditional', 'OP_BEGIN OP_1 OP_IF OP_UNTIL OP_ENDIF', /OP_UNTIL has no matching/],
  ])('rejects native assembly with %s', (_description, asm, diagnostic) => {
    expect(() => compileString(`contract C() {
      function denied() public { assembly { ${asm} } require(true); }
    }`, KERNEL)).toThrow(diagnostic);
  });

  it('preserves a caller stack value which has the same identity after both native conditional arms', () => {
    expect(() => compileString(`contract C() {
      function direct(int value) public {
        assembly {
          OP_DUP OP_IF OP_2 OP_DROP OP_ELSE OP_3 OP_DROP OP_ENDIF
        }
        require(value == value);
      }
    }`)).not.toThrow();
  });

  it('preserves an untouched caller stack value across a native loop', () => {
    expect(() => compileString(`contract C() {
      function direct(int value) public {
        assembly { OP_BEGIN OP_1 OP_UNTIL }
        require(value == value);
      }
    }`)).not.toThrow();
  });

  it('does not preserve compiler stack identities across a non-isolated native roll', () => {
    expect(() => compileString(`contract C() {
      function direct(int value) public {
        assembly { OP_1 OP_ROLL }
        require(value == value);
      }
    }`)).toThrow(/variable 'value' does not exist on the stack/);
  });

  it('admits lowerable Yul after translating it to ordinary kernel state operations', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract C {
        uint256 value;
        function set(uint256 next) public {
          assembly { sstore(value.slot, add(next, 1)) }
          require(true);
        }
        function control() public { require(true); }
      }`, { ...KERNEL, solidityImportCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'set')).toMatchObject({
      eligible: true,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('admits lowerable Yul memory and log operations as an ordinary event effect', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract C {
        function fire() public {
          assembly { mstore(0, 7) log0(0, 32) }
          require(true);
        }
        function control() public { require(true); }
      }`, { ...KERNEL, solidityImportCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'fire')).toMatchObject({
      eligible: true,
    });
    expect(artifact.abi.find((handler) => handler.name === 'fire')?.emits).toContainEqual(expect.objectContaining({
      eventName: '__YulLog',
    }));
  });

  it('keeps a mixed lowerable/opaque assembly handler transactional at admission', () => {
    const artifact = compileString(`contract C() {
      struct S { int x; }
      int value;
      function denied(S calldata arg, int next) public {
        assembly { sstore(value.slot, next) }
        assembly { OP_ACTIVEBYTECODE OP_SHA256 OP_DROP }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_OPAQUE_EFFECT',
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('admits safe native assembly mixed with lowerable Yul', () => {
    const artifact = compileString(`contract C() {
      int value;
      function set(int next) public {
        assembly { sstore(value.slot, next) }
        assembly { OP_1 OP_DROP }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'set')).toMatchObject({
      eligible: true,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it.each(['call', 'staticcall'] as const)(
    'admits a straight-line native low-level %s with a discarded result', (method) => {
      const artifact = compileString(`contract C(address target) {
        function denied(bytes data) public {
          target.${method}(data);
          require(true);
        }
        function control() public { require(true); }
      }`, KERNEL);
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
        .toMatchObject({ eligible: true });
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
        .toMatchObject({ eligible: true });
    },
  );

  it('refuses a runtime-count stateful deployment loop as KERNEL_LAYOUT', () => {
    expect(denied(`contract Child() { int marker; }
      contract C() {
        function denied(int count) public {
          for (int i = 0; i < count; i = i + 1) { Child child = new Child(); }
          require(true);
        }
        function control() public { require(true); }
      }`, 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LAYOUT',
    });
  });

  it('admits one straight-line stateful child deployment with name-neutral genesis geometry', () => {
    const artifact = compileString(`contract Spawn(bytes32 seed) {
        bytes32 first;
        bytes32 second;
        bytes32 third;
        bytes32 fourth;
        bytes32 fifth;
      }
      contract Coordinator() {
        int marker;
        function materialize(bytes32 seed, bytes32 salt) public {
          Spawn child = new Spawn{salt: salt}(seed);
          require(true);
        }
        function control(int next) public { this.marker = next; require(true); }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize');
    expect(handler).toMatchObject({
      eligible: true,
      childDeployments: [{
        siteIndex: 0,
        contractName: 'Spawn',
        occurrence: 'once',
        genesisInputCount: 1,
        masterOutputCount: 1,
        categorySource: 'genesis-input-outpoint-txhash',
        constructorArgs: [{ kind: 'handlerInput', inputIndex: 0 }],
        salt: { kind: 'handlerInput', inputIndex: 1 },
      }],
    });
    const [site] = handler?.childDeployments ?? [];
    expect(site.dataNftOutputCount).toBeGreaterThan(0);
    expect(site.totalOutputCount).toBe(1 + site.dataNftOutputCount);
    expect(site.creationBytecode).toMatch(/^[0-9a-f]+$/);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'control'))
      .not.toHaveProperty('childDeployments');
  });

  it('treats zero-state child construction as a row-local address expression', () => {
    const artifact = compileString(`contract Blueprint(int seed) {
        function check(int value) public pure { require(value == seed); }
      }
      contract Factory() {
        address latest;
        function make(int seed) public {
          Blueprint child = new Blueprint(seed);
          this.latest = address(child);
          require(true);
        }
        function salted(int seed, bytes32 salt) public {
          Blueprint child = new Blueprint{salt: salt}(seed);
          this.latest = address(child);
          require(true);
        }
        function funded(int seed, int amount) public {
          Blueprint child = new Blueprint{value: amount}(seed);
          this.latest = address(child);
          require(true);
        }
        function fundedSalted(int seed, int amount, bytes32 salt) public {
          Blueprint child = new Blueprint{value: amount, salt: salt}(seed);
          this.latest = address(child);
          require(true);
        }
        function zeroValue(int seed) public {
          Blueprint child = new Blueprint{value: 0}(seed);
          this.latest = address(child);
          require(true);
        }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    for (const name of ['make', 'salted']) {
      const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === name);
      expect(handler).toMatchObject({ eligible: true });
      expect(handler).not.toHaveProperty('childDeployments');
      expect(artifact.abi.find((candidate) => candidate.name === name)).not.toHaveProperty('deployTargets');
    }
    // A value option remains a BCH effect, but a zero-state child needs no genesis/category frame: its recipient
    // is independently reconstructed from compiler-pinned body bytes, constructor arguments, and optional salt.
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'funded')).toMatchObject({
      eligible: true,
      transfers: [{
        transferIndex: 0,
        amountRecipe: { kind: 'handlerInput', inputIndex: 1 },
        derivedRecipient: {
          contractName: 'Blueprint',
          constructorInputs: [{ name: 'seed', type: 'int256' }],
          constructorArgs: [{ kind: 'handlerInput', inputIndex: 0 }],
        },
      }],
    });
    // `callOption` is the external-call manifest mode consumed by graph dispatch, not provenance for every BCH
    // transfer. A local `new C{value: ...}` publishes its value as a fixed transfer without changing the mode of
    // a following typed call in the same handler.
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'funded')?.transfers?.[0])
      .not.toHaveProperty('callOption');
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'fundedSalted')).toMatchObject({
      eligible: true,
      transfers: [{
        transferIndex: 0,
        amountRecipe: { kind: 'handlerInput', inputIndex: 1 },
        derivedRecipient: {
          contractName: 'Blueprint',
          constructorInputs: [{ name: 'seed', type: 'int256' }],
          constructorArgs: [{ kind: 'handlerInput', inputIndex: 0 }],
          salt: { kind: 'handlerInput', inputIndex: 2 },
        },
      }],
    });
    const zeroValue = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'zeroValue');
    expect(zeroValue).toMatchObject({ eligible: true });
    expect(zeroValue).not.toHaveProperty('transfers');
  });

  it('admits one straight-line value-bearing child with a typed amount recipe', () => {
    const artifact = compileString(`contract Unit() { int marker; }
      contract Factory() {
        int created;
        function create(int base) public {
          Unit child = new Unit{value: base + 1000}();
          this.created = this.created + 1;
          require(true);
        }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'create');
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(handler).toMatchObject({
      eligible: true,
      childDeployments: [{
        siteIndex: 0,
        occurrence: 'once',
        value: {
          transferIndex: 0,
          amount: {
            kind: 'binary', operator: '+', resultType: 'int',
            left: { kind: 'handlerInput', inputIndex: 0, resultType: 'int256' },
            right: { kind: 'intLiteral', value: '1000', resultType: 'int' },
          },
        },
      }],
    });
    expect(handler?.transfers ?? []).toHaveLength(0);
    const direct = artifact.abi.find((candidate) => candidate.name === 'create');
    expect(direct?.transferCount).toBe(1);
    expect(direct?.blockLayout?.slots.filter((slot) => slot.kind === 'transfer')).toEqual([
      expect.objectContaining({ slotIndex: 0 }),
    ]);
  });

  it.each([
    [
      'multiple deployment effects',
      'Unit first = new Unit{value: amount}(); Unit second = new Unit{value: amount}();',
      [
        { siteIndex: 0, occurrence: 'once', spanOffset: 0, spanWidth: 2, transferIndex: 0 },
        { siteIndex: 1, occurrence: 'once', spanOffset: 2, spanWidth: 2, transferIndex: 1 },
      ],
      [],
    ],
    [
      'a deployment effect and an ordinary transfer effect',
      'Unit child = new Unit{value: amount}(); this.transfer(hex"51", 1);',
      [{ siteIndex: 0, occurrence: 'once', spanOffset: 0, spanWidth: 2, transferIndex: 0 }],
      [1],
    ],
  ])('admits independently described value-bearing effects: %s', (_label, body, deployments, transfers) => {
    const artifact = compileString(`contract Unit() { int marker; }
      contract Factory() {
        int created;
        function create(int amount) public { ${body} this.created = 1; require(true); }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'create');
    expect(handler).toMatchObject({ eligible: true });
    expect(handler?.childDeployments?.map((site) => ({
      siteIndex: site.siteIndex,
      occurrence: site.occurrence,
      spanOffset: site.spanOffset,
      spanWidth: site.spanWidth,
      transferIndex: site.value?.transferIndex,
    }))).toEqual(deployments);
    expect(handler?.transfers?.map((transfer) => transfer.transferIndex) ?? []).toEqual(transfers);
  });

  it('admits one value-bearing child deployment behind a materializable pure predicate', () => {
    const artifact = compileString(`contract Child() { int marker; }
      contract Parent() {
        int created;
        function create(bool take, int amount) public {
          if (take && amount > 0) { Child child = new Child{value: amount + 1000}(); }
          this.created = 1;
          require(true);
        }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'create');
    expect(handler).toMatchObject({
      eligible: true,
      childDeployments: [{
        occurrence: 'conditional', siteIndex: 0, spanOffset: 0, spanWidth: 2,
        activation: {
          kind: 'binary', operator: '&&', resultType: 'bool',
          left: { kind: 'handlerInput', inputIndex: 0, resultType: 'bool' },
          right: {
            kind: 'binary', operator: '>', resultType: 'bool',
            left: { kind: 'handlerInput', inputIndex: 1, resultType: 'int256' },
            right: { kind: 'intLiteral', value: '0', resultType: 'int' },
          },
        },
        value: {
          transferIndex: 0,
          amount: {
            kind: 'binary', operator: '+', resultType: 'int',
            left: { kind: 'handlerInput', inputIndex: 1, resultType: 'int256' },
            right: { kind: 'intLiteral', value: '1000', resultType: 'int' },
          },
        },
      }],
    });
    expect(handler?.transfers ?? []).toHaveLength(0);
    const direct = artifact.abi.find((candidate) => candidate.name === 'create');
    expect(direct?.transferCount).toBe(1);
    expect(direct?.blockLayout?.slots.filter((slot) => slot.kind === 'transfer')).toEqual([
      expect.objectContaining({ slotIndex: 0, conditional: true }),
    ]);
  });

  it('admits a conditional value-bearing deployment alongside an ordinary transfer', () => {
    const artifact = compileString(`contract Child() { int marker; }
      contract Parent() {
        int created;
        function create(bool take, int amount) public {
          if (take) { Child child = new Child{value: amount}(); }
          this.transfer(hex"51", 1);
          this.created = 1;
          require(true);
        }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'create');
    expect(handler).toMatchObject({ eligible: true });
    expect(handler?.childDeployments?.map((site) => ({
      siteIndex: site.siteIndex,
      occurrence: site.occurrence,
      spanOffset: site.spanOffset,
      spanWidth: site.spanWidth,
      activation: site.activation,
      transferIndex: site.value?.transferIndex,
    }))).toEqual([{
      siteIndex: 0,
      occurrence: 'conditional',
      spanOffset: 0,
      spanWidth: 2,
      activation: { kind: 'handlerInput', inputIndex: 0, resultType: 'bool' },
      transferIndex: 0,
    }]);
    expect(handler?.transfers?.map((transfer) => ({
      transferIndex: transfer.transferIndex,
      condition: transfer.condition,
    }))).toEqual([{ transferIndex: 1, condition: undefined }]);
  });

  it.each([
    ['a loop occurrence', `
      while (take) { Child child = new Child{value: amount}(); break; }`, false],
    ['a sha256-derived predicate', `
      if (sha256(seed) == hex"0000000000000000000000000000000000000000000000000000000000000000") {
        Child child = new Child{value: amount}();
      }`, true],
  ])('classifies conditional value-bearing deployment for %s', (_label, body, eligible) => {
    const handler = denied(`contract Child() { int marker; }
      contract Parent() {
        int created;
        function create(bool take, int amount, bytes seed) public {
          ${body}
          this.created = 1;
          require(true);
        }
      }`, 'create');
    expect(handler).toMatchObject(eligible
      ? { eligible: true }
      : { eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('publishes and admits a complete fixed constructor genesis recipe', () => {
    const artifact = compileString(`contract Unit(int seed) {
        int marker;
        constructor() { this.marker = seed; }
      }
      contract Coordinator() {
        function materialize(int seed) public { Unit child = new Unit(seed); require(true); }
        function control() public { require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize'))
      .toMatchObject({
        eligible: true,
        childDeployments: [{
          childLayoutDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
          genesisState: {
            kind: 'constructor',
            fields: [{
              name: 'marker', type: 'int256', nftIndex: 0, fieldIndex: 0,
              value: { kind: 'handlerInput', inputIndex: 0 },
            }],
          },
        }],
      });
    expect(artifact.abi.find((candidate) => candidate.name === 'materialize')?.deployTargets?.[0])
      .toMatchObject({
        childLayoutDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
        genesisState: { fields: [{ name: 'marker', value: { kind: 'handlerInput', inputIndex: 0 } }] },
      });
  });

  it('binds the finalized multi-data-NFT child layout in the kernel verifier', () => {
    const artifact = compileString(`contract WideChild() {
        bytes32 a; bytes32 b; bytes32 c; bytes32 d; bytes32 e;
        function keep() public { require(true); }
      }
      contract Factory() {
        function create() public { WideChild child = new WideChild(); require(true); }
      }`, KERNEL);
    const site = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'create')
      ?.childDeployments?.[0];
    expect(site).toMatchObject({ dataNftOutputCount: 2, totalOutputCount: 3 });
    expect(site?.childLayoutDigest).toMatch(/^[0-9a-f]{64}$/);
    const verifier = artifact.messageBus?.verifierProgram?.functions.find(
      (candidate) => candidate.name === '__message_bus_verify_atomic',
    );
    expect(verifier?.bytecode).toContain(site!.childLayoutDigest);
  });

  it('publishes a Solidity-style constructor-parameter genesis recipe', () => {
    const artifact = compileString(`contract Unit() {
        int marker;
        constructor(int seed) { this.marker = seed; }
      }
      contract Coordinator() {
        function materialize(int seed) public { Unit child = new Unit(seed); require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize'))
      .toMatchObject({
        eligible: true,
        childDeployments: [{
          constructorArgs: [{ kind: 'handlerInput', inputIndex: 0 }],
          genesisState: { fields: [{ name: 'marker', value: { kind: 'handlerInput', inputIndex: 0 } }] },
        }],
      });
  });

  it('admits explicit deploy with the same typed child topology as inferred deploy', () => {
    const compile = (modifier: string) => compileString(`contract Unit() {
        int marker;
        constructor(int seed) { this.marker = seed; }
      }
      contract Coordinator() {
        function materialize(int seed) ${modifier} {
          Unit child = new Unit(seed);
          require(true);
        }
      }`, KERNEL);
    const inferred = compile('');
    const explicit = compile('deploy');
    const handler = (artifact: ReturnType<typeof compileString>) => artifact.messageBus?.handlers.find(
      (candidate) => candidate.name === 'materialize',
    );
    expect(handler(explicit)).toMatchObject({ eligible: true });
    expect(handler(explicit)?.childDeployments).toEqual(handler(inferred)?.childDeployments);
    expect(explicit.messageBus?.route.blockLayout).toEqual(inferred.messageBus?.route.blockLayout);
  });

  it('keeps explicit deploy without a materializable typed child site fenced', () => {
    const artifact = compileString(`contract Coordinator() {
      int marker;
      function lifecycleOnly() deploy { require(true); }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'lifecycleOnly'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LIFECYCLE' });
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it.each([
    'constructor(int seed) { this.marker = helper(seed); } function helper(int x) internal returns (int) { return x; }',
    'constructor() { this.owner = msg.sender; }',
    'constructor(int seed) { require(this.marker == seed); this.marker = seed; }',
    'constructor(int seed) { require(tx.locktime > seed); this.marker = seed; }',
    'constructor(int seed) { require(msg.value == seed); this.marker = seed; }',
    'constructor(int seed) { require(helper(seed) > 0); this.marker = seed; } '
      + 'function helper(int x) internal returns (int) { this.marker = x; return x; }',
    'constructor(int seed) { if (seed > 0) { require(seed < 65); } this.marker = seed; }',
  ])('keeps resource-dependent or non-straight-line constructor logic fenced: %s', (constructor) => {
    const state = constructor.includes('owner') ? 'address owner;' : 'int marker;';
    const args = constructor.includes('constructor()') ? '' : 'seed';
    const artifact = compileString(`contract Unit() { ${state} ${constructor} }
      contract Coordinator() {
        function materialize(int seed) public { Unit child = new Unit(${args}); require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('keeps signature-dependent constructor predicates fenced', () => {
    const artifact = compileString(`contract Unit() {
        int marker;
        constructor(sig proof, pubkey key) { require(checkSig(proof, key)); this.marker = 1; }
      }
      contract Coordinator() {
        function materialize(sig proof, pubkey key) public {
          Unit child = new Unit(proof, key);
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize')?.eligible)
      .toBe(false);
  });

  it('authenticates a replayable helper-produced constructor predicate', () => {
    const artifact = compileString(`contract Unit() {
        int marker;
        constructor(int seed) { require(acceptable(seed)); this.marker = seed; }
        function acceptable(int value) private pure returns (bool) {
          int adjusted = value + 1;
          return adjusted > 1 && adjusted < 65;
        }
      }
      contract Coordinator() {
        function materialize(int seed) public { Unit child = new Unit(seed); require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize'))
      .toMatchObject({ eligible: true, childDeployments: [{ genesisState: { kind: 'constructor' } }] });
  });

  it('admits a bytes-to-address constructor genesis cast', () => {
    const artifact = compileString(`contract Unit() {
        address owner;
        constructor(bytes raw) { this.owner = address(raw); }
      }
      contract Coordinator() {
        function materialize(bytes raw) public { Unit child = new Unit(raw); require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize'))
      .toMatchObject({
        eligible: true,
        childDeployments: [{
          genesisState: { fields: [{
            name: 'owner', type: 'address',
            value: {
              kind: 'cast', resultType: 'address',
              operand: { kind: 'handlerInput', inputIndex: 0, resultType: 'bytes' },
            },
          }] },
        }],
      });
  });

  it('publishes enum-valued constructor state using its physical integer representation', () => {
    const child = compileString(`enum Status { Idle, Ready, Complete }
      contract Unit() { Status public status; constructor(int seed) { this.status = Status(seed + 1); }
        function touch() public { this.status = Status.Ready; }
      }`, KERNEL);
    expect(child.stateLayout?.variables.find((variable) => variable.name === 'status')?.type).toBe('bigint');
    const artifact = compileString(`enum Status { Idle, Ready, Complete }
      contract Unit() { Status status; constructor(int seed) { this.status = Status(seed + 1); } }
      contract Coordinator() {
        function materialize(int seed) public { Unit unit = new Unit(seed); require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize'))
      .toMatchObject({
        eligible: true,
        childDeployments: [{ genesisState: { fields: [{
          name: 'status', type: 'bigint',
          value: { kind: 'cast', resultType: 'bigint', operand: { kind: 'binary', operator: '+' } },
        }] } }],
      });
  });

  it('publishes a fixed-layout struct constructor state recipe', () => {
    const artifact = compileString(`struct Pair { int left; int right; }
      contract Unit() { Pair pair; constructor() { this.pair.left = 1; } }
      contract Coordinator() {
        function materialize() public { Unit unit = new Unit(); require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize'))
      .toMatchObject({
        eligible: true,
        childDeployments: [{ genesisState: { fields: [{
          name: 'pair', type: 'Pair', value: {
            kind: 'aggregate', resultType: 'Pair',
            elements: [
              { kind: 'cast', resultType: 'int256', operand: { kind: 'intLiteral', value: '1' } },
              { kind: 'cast', resultType: 'int256', operand: { kind: 'intLiteral', value: '0' } },
            ],
          },
        }] } }],
      });
  });

  it('publishes a whole fixed-layout struct constructor state recipe from handler inputs', () => {
    const artifact = compileString(`struct Pair { int left; bool enabled; }
      contract Unit() { Pair pair; constructor(int left, bool enabled) { this.pair = Pair(left, enabled); } }
      contract Coordinator() {
        function materialize(int left, bool enabled) public {
          Unit unit = new Unit(left, enabled);
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize'))
      .toMatchObject({
        eligible: true,
        childDeployments: [{ genesisState: { fields: [{
          name: 'pair', type: 'Pair', value: {
            kind: 'aggregate', resultType: 'Pair',
            elements: [
              { kind: 'handlerInput', inputIndex: 0, resultType: 'int256' },
              { kind: 'handlerInput', inputIndex: 1 },
            ],
          },
        }] } }],
      });
  });

  it('does not reinterpret an ordinary struct-returning helper as a struct constructor', () => {
    const artifact = compileString(`struct Pair { int left; int right; }
      contract Unit() {
        Pair pair;
        constructor(int seed) { this.pair = makePair(seed); }
        function makePair(int seed) internal returns (Pair) { return Pair(seed, 0); }
      }
      contract Coordinator() {
        function materialize(int seed) public { Unit unit = new Unit(seed); require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('publishes recursively nested fixed-layout struct recipes with enum and fixed-point leaves', () => {
    const artifact = compileString(`enum Phase { Initial, Active, Complete }
      struct Metrics { Phase phase; fixed128x2 weight; }
      struct Snapshot { Metrics metrics; uint8 tag; }
      contract Unit() {
        Snapshot snapshot;
        constructor(int seed) {
          this.snapshot = Snapshot(Metrics(Phase(seed), fixed128x2(seed + 10)), uint8(seed + 1));
        }
      }
      contract Coordinator() {
        function materialize(int seed) public { Unit unit = new Unit(seed); require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize'))
      .toMatchObject({
        eligible: true,
        childDeployments: [{ genesisState: { fields: [{
          name: 'snapshot', type: 'Snapshot', value: {
            kind: 'aggregate', resultType: 'Snapshot', elements: [{
              kind: 'aggregate', resultType: 'Metrics', elements: [
                { kind: 'cast', resultType: 'bigint' },
                { kind: 'cast', resultType: 'fixed128x2' },
              ],
            }, { kind: 'cast', resultType: 'uint8' }],
          },
        }] } }],
      });
  });

  it('rejects a cyclic aggregate recipe graph without recursing indefinitely', () => {
    const recursive = new StructType('Node', []);
    recursive.fields.push({ name: 'next', type: recursive });
    const inner = new FunctionCallNode(new IdentifierNode('Node'), []);
    inner.type = recursive;
    const outer = new FunctionCallNode(new IdentifierNode('Node'), [inner]);
    outer.type = recursive;
    expect(childDeploymentValueRecipe(outer, new Map())).toBeUndefined();
  });

  it('publishes fixed arrays of nested structs, enums, and fixed-point leaves as bounded aggregates', () => {
    const artifact = compileString(`enum Phase { Initial, Active, Complete }
      struct Metrics { Phase phase; fixed128x2 weight; }
      struct Batch { Metrics[2] snapshots; }
      contract Unit() {
        Batch batch;
        constructor(int seed) {
          this.batch = Batch([
            Metrics(Phase(seed), fixed128x2(seed + 10)),
            Metrics(Phase(seed + 1), fixed128x2(seed + 20))
          ]);
        }
      }
      contract Coordinator() {
        function materialize(int seed) public { Unit unit = new Unit(seed); require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize'))
      .toMatchObject({
        eligible: true,
        childDeployments: [{ genesisState: { fields: [{
          name: 'batch', type: 'Batch', value: {
            kind: 'aggregate', resultType: 'Batch', elements: [{
              kind: 'aggregate', resultType: 'Metrics[2]', elements: [
                { kind: 'aggregate', resultType: 'Metrics' },
                { kind: 'aggregate', resultType: 'Metrics' },
              ],
            }],
          },
        }] } }],
      });
  });

  it('publishes a typed conditional recipe selecting between fixed aggregate constructor values', () => {
    const artifact = compileString(`struct Pair { int first; int second; }
      contract Unit() {
        Pair pair;
        constructor(bool choose, int seed) {
          this.pair = choose ? Pair(seed, seed + 1) : Pair(seed, seed + 2);
        }
      }
      contract Coordinator() {
        function materialize(bool choose, int seed) public {
          Unit unit = new Unit(choose, seed);
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize'))
      .toMatchObject({
        eligible: true,
        childDeployments: [{ genesisState: { fields: [{
          name: 'pair', value: {
            kind: 'conditional', resultType: 'Pair',
            condition: { kind: 'handlerInput', inputIndex: 0, resultType: 'bool' },
            ifTrue: { kind: 'aggregate', resultType: 'Pair' },
            ifFalse: { kind: 'aggregate', resultType: 'Pair' },
          },
        }] } }],
      });
  });

  it('folds finite declaration-identified pure constructor helpers into nested aggregate genesis recipes', () => {
    const artifact = compileString(`enum Phase { Initial, Active, Complete }
      struct Metrics { Phase phase; fixed128x2 weight; }
      struct Batch { Metrics[2] items; }
      contract Unit() {
        Batch batch;
        constructor(int seed) { this.batch = makeBatch(seed); }
        function makeMetrics(int seed, int offset) internal pure returns (Metrics) {
          fixed128x2 weight = fixed128x2(seed + offset);
          return Metrics(Phase(seed), weight);
        }
        function makeBatch(int seed) private pure returns (Batch) {
          return Batch([makeMetrics(seed, 10), makeMetrics(seed, 20)]);
        }
      }
      contract Coordinator() {
        function materialize(int seed) public { Unit unit = new Unit(seed); require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize'))
      .toMatchObject({
        eligible: true,
        childDeployments: [{ genesisState: { fields: [{
          name: 'batch', value: {
            kind: 'aggregate', resultType: 'Batch', elements: [{
              kind: 'aggregate', resultType: 'Metrics[2]', elements: [
                { kind: 'aggregate', resultType: 'Metrics' },
                { kind: 'aggregate', resultType: 'Metrics' },
              ],
            }],
          },
        }] } }],
      });
  });

  it.each([
    ['effectful', 'function helper(int x) internal returns (int) { this.marker = x; return x; }'],
    ['view/state-dependent', 'function helper(int x) internal view returns (int) { return this.marker + x; }'],
    ['view/transaction-dependent', 'function helper(int x) internal view returns (int) { return tx.locktime + x; }'],
    ['view/message-dependent', 'function helper(int x) internal view returns (int) { return msg.value + x; }'],
    ['guarded', 'function helper(int x) internal pure returns (int) { require(x > 0); return x; }'],
    ['recursive', 'function helper(int x) internal pure returns (int) { return helper(x); }'],
    ['mutually recursive', 'function helper(int x) internal pure returns (int) { return other(x); } '
      + 'function other(int x) internal pure returns (int) { return helper(x); }'],
    ['same-arity overloaded', 'function helper(int x) internal pure returns (int) { return x; } '
      + 'function helper(bool x) internal pure returns (int) { return x ? 1 : 0; }'],
  ])('keeps %s constructor helpers outside genesis replay', (_label, helper) => {
    const artifact = compileString(`contract Unit() {
        int marker;
        constructor(int seed) { this.marker = helper(seed); }
        ${helper}
      }
      contract Coordinator() {
        function materialize(int seed) public { Unit unit = new Unit(seed); require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it.each([
    'struct Payload { bytes data; int count; } contract Unit() { Payload payload; '
      + 'constructor(bytes raw) { this.payload = Payload(raw, 1); } }',
    'struct Payload { int count; bytes data; } struct Envelope { Payload payload; int tag; } '
      + 'contract Unit() { Envelope envelope; constructor(bytes raw) { '
      + 'this.envelope = Envelope(Payload(1, raw), 2); } }',
  ])('keeps dynamic struct constructor state fenced: %s', (child) => {
    const args = child.includes('constructor(bytes') ? '0x01' : '';
    const artifact = compileString(`${child}
      contract Coordinator() {
        function materialize() public { Unit unit = new Unit(${args}); require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('normalizes a folded UDVT constructor expression to its materializable ABI primitive', () => {
    const artifact = compileString(`type Id is uint32;
      contract Unit() { Id id; constructor(uint32 seed) { this.id = Id.wrap(seed + 1); } }
      contract Coordinator() {
        function materialize(uint32 seed) public { Unit unit = new Unit(seed); require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize'))
      .toMatchObject({
        eligible: true,
        childDeployments: [{ genesisState: { fields: [{ type: 'uint32' }] } }],
      });
  });

  it('resolves straight-line constructor and salt aliases by lexical definition identity', () => {
    const artifact = compileString(`contract Unit(int marker) { int stored; constructor() { this.stored = marker; } }
      contract Coordinator() {
        function materialize(int seed) public {
          int adjusted = seed + 1;
          int forwarded = adjusted;
          bytes32 derivedSalt = bytes32(adjusted);
          Unit unit = new Unit{salt: derivedSalt}(forwarded);
          require(true);
        }
      }`, KERNEL);
    const site = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize')
      ?.childDeployments?.[0];
    expect(site).toMatchObject({
      constructorArgs: [{ kind: 'cast', operand: { kind: 'binary', operator: '+' } }],
      salt: { kind: 'cast', resultType: 'bytes32', operand: { kind: 'cast', operand: { kind: 'binary' } } },
      genesisState: { fields: [{ name: 'stored', value: { kind: 'cast', operand: { kind: 'binary' } } }] },
    });
  });

  it('snapshots reassigned aliases independently at each deployment site', () => {
    const artifact = compileString(`contract Unit(int marker) { int stored; constructor() { this.stored = marker; } }
      contract Coordinator() {
        function materialize(int seed) public {
          int adjusted = seed + 1;
          Unit first = new Unit(adjusted);
          adjusted = seed + 2;
          Unit second = new Unit(adjusted);
          require(true);
        }
      }`, KERNEL);
    const sites = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize')
      ?.childDeployments ?? [];
    expect(sites).toHaveLength(2);
    expect(sites.map((site) => (site.constructorArgs[0] as any).operand?.right?.value)).toEqual(['1', '2']);
    expect(sites.map((site) => (site.genesisState?.fields[0].value as any).operand?.right?.value))
      .toEqual(['1', '2']);
  });

  it('keeps same-named aliases in disjoint lexical scopes distinct', () => {
    const artifact = compileString(`contract Unit(int marker) { int stored; constructor() { this.stored = marker; } }
      contract Coordinator() {
        function materialize(int seed) public {
          { int adjusted = seed + 1; Unit first = new Unit(adjusted); }
          { int adjusted = seed + 2; Unit second = new Unit(adjusted); }
          require(true);
        }
      }`, KERNEL);
    const sites = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize')
      ?.childDeployments ?? [];
    expect(sites.map((site) => (site.constructorArgs[0] as any).operand?.right?.value)).toEqual(['1', '2']);
  });

  it('does not reinterpret an unsupported local shadow as the same-named handler input', () => {
    const artifact = compileString(`contract Unit(int marker) { int stored; constructor() { this.stored = marker; } }
      contract Coordinator() {
        function materialize(int seed) public {
          { int seed; Unit unit = new Unit(seed); }
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize'))
      .toMatchObject({ eligible: false });
  });

  it.each([
    'int adjusted; Unit unit = new Unit(adjusted);',
    'int adjusted = tx.locktime; Unit unit = new Unit(adjusted);',
    'unchecked { int adjusted = seed + 1; Unit unit = new Unit(adjusted); }',
    'int[] values = new int[](1); Unit unit = new Unit(values[0]);',
    'int adjusted = seed + 1; delete adjusted; Unit unit = new Unit(adjusted);',
    // Tuple writes are conservatively invalidated until per-slot recipes are modeled.
    'int adjusted = seed + 1; int other = seed; (adjusted, other) = (seed + 2, seed); '
      + 'Unit unit = new Unit(adjusted);',
  ])('keeps non-SSA deployment aliases fenced: %s', (body) => {
    const artifact = compileString(`contract Unit(int marker) { int stored; constructor() { this.stored = marker; } }
      contract Coordinator() {
        function materialize(int seed) public { ${body} require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize'))
      .toMatchObject({ eligible: false });
  });

  it('keeps deployment recipes fenced across the later early-return lowering boundary', () => {
    const artifact = compileString(`contract Unit(int marker) { int stored; constructor() { this.stored = marker; } }
      contract Coordinator() {
        function materialize(bool skip, int seed) public {
          if (skip) { require(true); return; }
          int adjusted = seed + 1;
          Unit unit = new Unit(adjusted);
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize'))
      .toMatchObject({ eligible: false });
  });

  it.each([
    'require(true); return;',
    'if (stop) { require(true); return; } require(true);',
  ])('keeps an earlier unconditional deployment eligible before a terminal return: %s', (tail) => {
    const artifact = compileString(`contract Unit(int marker) {
        int stored;
        constructor() { this.stored = marker; }
      }
      contract Coordinator() {
        function materialize(bool stop, int seed) public {
          int adjusted = seed + 1;
          Unit unit = new Unit(adjusted);
          ${tail}
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize'))
      .toMatchObject({ eligible: true });
  });

  it('publishes byte concatenation aliases as constructor recipes', () => {
    const artifact = compileString(`contract Unit(bytes4 marker) { bytes4 stored; constructor() {
        this.stored = marker;
      } }
      contract Coordinator() {
        function materialize(bytes2 left, bytes2 right) public {
          bytes4 joined = left + right;
          Unit unit = new Unit(joined);
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize'))
      .toMatchObject({
        eligible: true,
        childDeployments: [{ constructorArgs: [{ kind: 'concat', resultType: 'bytes4' }] }],
      });
  });

  it('publishes scaled fixed-point constructor arithmetic', () => {
    const artifact = compileString(`contract Unit() {
        fixed128x18 marker;
        constructor(fixed128x18 seed) { this.marker = seed; }
      }
      contract Coordinator() {
        function materialize(fixed128x18 seed, fixed128x18 factor) public {
          Unit unit = new Unit(seed * factor);
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize'))
      .toMatchObject({
        eligible: true,
        childDeployments: [{
          genesisState: { fields: [{
            name: 'marker', type: 'fixed128x18',
            value: {
              kind: 'binary', operator: '*', resultType: 'fixed128x18',
              left: { kind: 'handlerInput', inputIndex: 0, resultType: 'fixed128x18' },
              right: { kind: 'handlerInput', inputIndex: 1, resultType: 'fixed128x18' },
            },
          }] },
        }],
      });
  });

  it('publishes fixed arithmetic nested in a value recipe', () => {
    const artifact = compileString(`contract Unit() { int marker; }
      contract Coordinator() {
        int created;
        function materialize(fixed128x2 rate, fixed128x2 factor) public {
          Unit unit = new Unit{value: int(rate * factor)}();
          this.created = this.created + 1;
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize'))
      .toMatchObject({
        eligible: true,
        childDeployments: [{ value: { amount: {
          kind: 'cast', resultType: 'int256', operand: {
            kind: 'binary', operator: '*', resultType: 'fixed128x2',
            left: { kind: 'handlerInput', inputIndex: 0, resultType: 'fixed128x2' },
            right: { kind: 'handlerInput', inputIndex: 1, resultType: 'fixed128x2' },
          },
        } } }],
      });
  });

  it('publishes an explicit fixed constructor cross-scale cast', () => {
    const artifact = compileString(`contract Unit(fixed128x2 marker) { fixed128x2 stored;
        constructor() { this.stored = marker; }
      }
      contract Coordinator() {
        function materialize(fixed128x2 left, fixed128x3 right) public {
          Unit unit = new Unit(left + fixed128x2(right));
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize'))
      .toMatchObject({ eligible: true });
    const recipe = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize')
      ?.childDeployments?.[0].constructorArgs[0];
    expect(recipe).toMatchObject({
      kind: 'binary', resultType: 'fixed128x2',
      right: { kind: 'cast', resultType: 'fixed128x2' },
    });
  });

  it('publishes every unconditional child site in source order with heterogeneous row geometry', () => {
    const artifact = compileString(`struct Pair { bool left; bool right; }
      contract Compact() { bool marker; }
      contract Wide() { int first; int second; int third; }
      contract Mixed() { bool lead; Pair tail; }
      contract Coordinator() {
        function materialize() public {
          Compact compact = new Compact();
          Wide wide = new Wide();
          Mixed mixed = new Mixed();
          require(true);
        }
      }`, { ...KERNEL, commitmentLimit: 16 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize');
    expect(handler).toMatchObject({ eligible: true });
    expect(handler?.childDeployments).toHaveLength(3);
    expect(handler?.childDeployments?.map((site) => ({
      siteIndex: site.siteIndex, contractName: site.contractName, occurrence: site.occurrence,
    }))).toEqual([
      { siteIndex: 0, contractName: 'Compact', occurrence: 'once' },
      { siteIndex: 1, contractName: 'Wide', occurrence: 'once' },
      { siteIndex: 2, contractName: 'Mixed', occurrence: 'once' },
    ]);
    expect(handler!.childDeployments![1].totalOutputCount)
      .toBeGreaterThan(handler!.childDeployments![0].totalOutputCount);
    const firstRowDeploymentWidth = artifact.messageBus?.route?.blockLayout?.slots.filter((slot) =>
      slot.slotIndex === 0 && (slot.kind === 'deploy' || slot.kind === 'deployDataNft')).length;
    expect(firstRowDeploymentWidth).toBe(handler!.childDeployments!.reduce(
      (width, site) => width + site.totalOutputCount, 0,
    ));
  });

  it('plans deployment frames by resolved overload identity', () => {
    const artifact = compileString(`contract Unit() { int marker; }
      contract Coordinator() {
        int marker;
        function make(int next) public {
          Unit child = new Unit();
          this.marker = next;
          require(true);
        }
        function make(bool enabled) public {
          if (enabled) { this.marker = 1; }
          require(true);
        }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const overloads = artifact.messageBus?.handlers.filter((candidate) => candidate.name === 'make') ?? [];
    expect(overloads).toHaveLength(2);
    expect(overloads.every((candidate) => candidate.eligible)).toBe(true);
    expect(overloads.filter((candidate) => (candidate.childDeployments?.length ?? 0) > 0))
      .toHaveLength(1);
  });

  it('gives two deployment-bearing overloads distinct compiler handler identities', () => {
    const artifact = compileString(`contract Unit() { int marker; }
      contract Coordinator() {
        int marker;
        function make(int next) public {
          Unit child = new Unit();
          this.marker = next;
          require(true);
        }
        function make(bool enabled) public {
          Unit child = new Unit();
          if (enabled) { this.marker = 1; }
          require(true);
        }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const overloads = artifact.messageBus?.handlers.filter((candidate) => candidate.name === 'make') ?? [];
    expect(overloads).toHaveLength(2);
    expect(overloads.every((candidate) => candidate.eligible)).toBe(true);
    expect(overloads.every((candidate) => candidate.childDeployments?.length === 1)).toBe(true);
  });

  it('admits typed row-local constructor, CREATE2, and straight-line post-new recipes', () => {
    const computed = compileString(`contract Unit(bytes32 seed) { int marker; function configure(int next) public {
        this.marker = next; require(true);
      } }
      contract Coordinator() {
        function folded(bytes32 seed, int next) public {
          Unit child = new Unit(seed); child.configure(next); require(true);
        }
        function computed(bytes32 seed, bytes32 salt) public {
          Unit child = new Unit{salt: bytes32(int(salt) + 1)}(bytes32(int(seed) + 1)); require(true);
        }
        function computedSalt(bytes32 seed, bytes32 salt) public {
          Unit child = new Unit{salt: bytes32(int(salt) + 1)}(seed); require(true);
        }
      }`, KERNEL);
    expect(computed.messageBus?.handlers.find((candidate) => candidate.name === 'folded'))
      .toMatchObject({
        eligible: true,
        childDeployments: [{
          hasFoldedChildCall: true,
          genesisState: {
            fields: [{ name: 'marker', value: { kind: 'handlerInput', inputIndex: 1 } }],
          },
        }],
      });
    expect(computed.messageBus?.handlers.find((candidate) => candidate.name === 'computed'))
      .toMatchObject({
        eligible: true,
        childDeployments: [{ constructorArgs: [{ kind: 'cast', resultType: 'bytes32' }] }],
      });
    expect(computed.messageBus?.handlers.find((candidate) => candidate.name === 'computedSalt'))
      .toMatchObject({
        eligible: true,
        childDeployments: [{
          constructorArgs: [{ kind: 'handlerInput', inputIndex: 0 }],
          salt: {
            kind: 'cast',
            resultType: 'bytes32',
            operand: {
              kind: 'binary',
              operator: '+',
              left: {
                kind: 'cast', resultType: 'int256',
                operand: { kind: 'handlerInput', inputIndex: 1 },
              },
              right: { kind: 'intLiteral', value: '1', resultType: 'int' },
            },
          },
        }],
      });
  });

  it('admits several fixed-array genesis entries and collapses duplicate writes', () => {
    const artifact = compileString(`contract OneEntry(int32 seed) {
        int32[1] values;
        constructor() { this.values[0] = seed; this.values[0] = seed + 1; }
      }
      contract TwoEntries(int32 seed) {
        int32[2] values;
        constructor() { this.values[0] = seed; this.values[1] = seed + 1; }
      }
      contract Coordinator() {
        function one(int32 seed) public { OneEntry child = new OneEntry(seed); require(true); }
        function two(int32 seed) public { TwoEntries child = new TwoEntries(seed); require(true); }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'one')).toMatchObject({
      eligible: true,
      childDeployments: [{
        entryNftOutputCount: 1,
        totalOutputCount: 2,
        genesisEntries: [{
          collection: 'values',
          key: { kind: 'intLiteral', value: '0' },
          value: { kind: 'binary', operator: '+', right: { kind: 'intLiteral', value: '1' } },
        }],
      }],
    });
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'two')).toMatchObject({
      eligible: true,
      childDeployments: [{
        entryNftOutputCount: 2,
        totalOutputCount: 3,
        genesisEntries: [
          { collection: 'values', key: { kind: 'intLiteral', value: '0' } },
          { collection: 'values', key: { kind: 'intLiteral', value: '1' } },
        ],
      }],
    });
    const routeBytes = asmToBytecode(artifact.bytecode).length;
    expect(routeBytes, 'two-entry kernel route exceeds the consensus limit').toBeLessThanOrEqual(10_000);
    expect(artifact.abi.find((candidate) => candidate.name === 'one')?.deployTargets?.[0]).toMatchObject({
      entryNftCount: 1,
      genesisEntries: [{
        collection: 'values',
        key: { kind: 'intLiteral', value: '0' },
        value: { kind: 'binary', operator: '+', right: { kind: 'intLiteral', value: '1' } },
      }],
    });
  });

  it('publishes scalar mapping genesis recipes and rejects ambiguous or dynamic-key layouts', () => {
    const supported = compileString(`contract RuntimeEntry(bytes20 owner, int32 seed) {
        mapping(bytes20 => int32) values;
        constructor() { this.values[owner] = seed; }
      }
      contract LiteralEntries(int32 seed) {
        mapping(int => int32) values;
        constructor() {
          this.values[7] = seed;
          this.values[7] = seed + 1;
          this.values[9] = seed + 2;
        }
      }
      contract Coordinator() {
        function runtime(bytes20 owner, int32 seed) public {
          RuntimeEntry child = new RuntimeEntry(owner, seed); require(true);
        }
        function literals(int32 seed) public { LiteralEntries child = new LiteralEntries(seed); require(true); }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(supported.messageBus?.handlers.find((candidate) => candidate.name === 'runtime')).toMatchObject({
      eligible: true,
      childDeployments: [{ genesisEntries: [{
        collection: 'values', keyType: 'bytes20', valueType: 'int32',
        key: { kind: 'handlerInput', inputIndex: 0, resultType: 'bytes20' },
        value: { kind: 'handlerInput', inputIndex: 1, resultType: 'int32' },
      }] }],
    });
    expect(supported.messageBus?.handlers.find((candidate) => candidate.name === 'literals')).toMatchObject({
      eligible: true,
      childDeployments: [{ entryNftOutputCount: 2, genesisEntries: [
        { key: { kind: 'intLiteral', value: '7' }, value: { kind: 'binary', operator: '+' } },
        { key: { kind: 'intLiteral', value: '9' }, value: { kind: 'binary', operator: '+' } },
      ] }],
    });
    expect(asmToBytecode(supported.bytecode).length).toBeLessThanOrEqual(10_000);

    const refused = compileString(`contract Ambiguous(int first, int second, int value) {
        mapping(int => int) values;
        constructor() { this.values[first] = value; this.values[second] = value + 1; }
      }
      contract Dynamic(bytes key, int value) {
        mapping(bytes => int) values;
        constructor() { this.values[key] = value; }
      }
      contract CrossLiteral(int value) {
        mapping(int => int) values;
        constructor() { this.values[1] = value; this.values[hex"01"] = value + 1; }
      }
      contract RuntimeThenLiteral(int key, int value) {
        mapping(int => int) values;
        constructor() { this.values[key] = value; this.values[7] = value + 1; }
      }
      contract LiteralThenRuntime(int key, int value) {
        mapping(int => int) values;
        constructor() { this.values[7] = value; this.values[key] = value + 1; }
      }
      contract Coordinator() {
        function ambiguous(int first, int second, int value) public {
          Ambiguous child = new Ambiguous(first, second, value); require(true);
        }
        function dynamic(bytes key, int value) public { Dynamic child = new Dynamic(key, value); require(true); }
        function crossLiteral(int value) public { CrossLiteral child = new CrossLiteral(value); require(true); }
        function runtimeThenLiteral(int key, int value) public {
          RuntimeThenLiteral child = new RuntimeThenLiteral(key, value); require(true);
        }
        function literalThenRuntime(int key, int value) public {
          LiteralThenRuntime child = new LiteralThenRuntime(key, value); require(true);
        }
      }`, KERNEL);
    for (const name of [
      'ambiguous', 'dynamic', 'crossLiteral', 'runtimeThenLiteral', 'literalThenRuntime',
    ]) {
      expect(refused.messageBus?.handlers.find((candidate) => candidate.name === name))
        .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    }
  });

  it('publishes fixed-layout struct entry recipes and fences dynamic aggregate layouts', () => {
    const artifact = compileString(`struct Cell { int32 amount; bool enabled; }
      contract RecordStore(int32 seed) {
        Cell[2] rows;
        mapping(int32 => Cell) keyed;
        constructor() {
          this.rows[0] = Cell(seed, true);
          this.rows[1] = Cell(seed + 1, false);
          this.keyed[seed] = Cell(seed + 2, true);
          this.keyed[seed] = Cell(seed + 3, false);
        }
      }
      contract GenesisCoordinator() {
        function create(int32 seed) public { RecordStore child = new RecordStore(seed); require(true); }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'create')).toMatchObject({
      eligible: true,
      childDeployments: [{
        entryNftOutputCount: 3,
        genesisEntries: [
          { collection: 'rows', valueType: 'Cell', value: { kind: 'aggregate', resultType: 'Cell' } },
          { collection: 'rows', valueType: 'Cell', value: { kind: 'aggregate', resultType: 'Cell' } },
          {
            collection: 'keyed', valueType: 'Cell',
            value: { kind: 'aggregate', resultType: 'Cell', elements: [
              { kind: 'cast', resultType: 'int32' },
              { kind: 'boolLiteral', value: false },
            ] },
          },
        ],
      }],
    });
    expect(asmToBytecode(artifact.bytecode).length).toBeLessThanOrEqual(10_000);

    const dynamic = compileString(`struct DynamicCell { string label; int32 amount; }
      contract DynamicStore() {
        DynamicCell[1] rows;
        constructor() { this.rows[0] = DynamicCell("x", 1); }
      }
      contract NestedCollectionStore() {
        mapping(int => int32[2]) groups;
        constructor() { this.groups[1] = [1, 2]; }
      }
      contract DynamicCoordinator() {
        function dynamic() public { DynamicStore child = new DynamicStore(); require(true); }
        function nested() public {
          NestedCollectionStore child = new NestedCollectionStore(); require(true);
        }
      }
      `, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(dynamic.messageBus?.handlers.find((candidate) => candidate.name === 'dynamic')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LAYOUT',
    });
    expect(dynamic.messageBus?.handlers.find((candidate) => candidate.name === 'nested')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LAYOUT',
    });
  });

  it('does not publish or reserve an entry whose folded value has no materializable recipe', () => {
    const artifact = compileString(`contract StringEntry() {
        string[1] values;
        constructor() { this.values[0] = "seed"; }
      }
      contract Coordinator() {
        function make() public { StringEntry child = new StringEntry(); require(true); }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'make'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    const make = artifact.abi.find((candidate) => candidate.name === 'make')!;
    expect(make.deployTargets?.[0]).not.toHaveProperty('entryNftCount');
    expect(make.deployTargets?.[0]).not.toHaveProperty('genesisEntries');
    expect(make.blockLayout?.slots.filter((slot) => slot.kind === 'deployDataNft')).toHaveLength(0);
  });

  it('publishes arithmetic and hash child recipes per resolved overload', () => {
    const artifact = compileString(`contract Unit(bytes32 seed) { int marker; }
      contract Coordinator() {
        function make(bytes32 seed) public {
          Unit child = new Unit(bytes32(int(seed) + 7)); require(true);
        }
        function make(bytes seed) public {
          Unit child = new Unit(sha256(seed)); require(true);
        }
      }`, KERNEL);
    const overloads = artifact.messageBus?.handlers.filter((candidate) => candidate.name === 'make') ?? [];
    expect(overloads).toHaveLength(2);
    const byInput = new Map(overloads.map((handler) => [handler.inputs[0].type, handler]));
    expect(byInput.get('bytes32')).toMatchObject({
      eligible: true,
      childDeployments: [{ constructorArgs: [{ kind: 'cast', resultType: 'bytes32' }] }],
    });
    expect(byInput.get('bytes')).toMatchObject({
      eligible: true,
      childDeployments: [{ constructorArgs: [{ kind: 'hash', algorithm: 'sha256' }] }],
    });
  });

  it('inlines a straight-line helper deployment and admits one pure conditional deployment', () => {
    const artifact = compileString(`contract Unit() { int marker; }
      contract Coordinator() {
        function helper() internal { Unit child = new Unit(); }
        function throughHelper() public { helper(); require(true); }
        function conditional(bool take) public { if (take) { Unit child = new Unit(); } require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'throughHelper'))
      .toMatchObject({ eligible: true, childDeployments: [{ occurrence: 'once', siteIndex: 0 }] });
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'conditional'))
      .toMatchObject({
        eligible: true,
        childDeployments: [{
          occurrence: 'conditional', siteIndex: 0, spanOffset: 0, spanWidth: 2,
          activation: { kind: 'handlerInput', inputIndex: 0, resultType: 'bool' },
        }],
      });
  });

  it('admits mixed straight-line and conditional child sites with independent exact spans', () => {
    const artifact = compileString(`contract Compact() { int marker; }
      contract Wide() { int first; int second; int third; }
      contract Coordinator() {
        function materialize(bool take) public {
          Compact first = new Compact();
          if (take) { Wide second = new Wide(); }
          require(true);
        }
      }`, { ...KERNEL, commitmentLimit: 16, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize');
    expect(handler).toMatchObject({
      eligible: true,
      childDeployments: [
        { siteIndex: 0, occurrence: 'once', spanOffset: 0, spanWidth: 2 },
        {
          siteIndex: 1, occurrence: 'conditional', spanOffset: 2, spanWidth: 4,
          activation: { kind: 'handlerInput', inputIndex: 0, resultType: 'bool' },
        },
      ],
    });
    expect(handler?.childDeployments?.[0]).not.toHaveProperty('activation');
  });

  it('admits if/else-if child sites with mutually exclusive source activation recipes', () => {
    const artifact = compileString(`contract Left() { int marker; }
      contract Middle() { int first; int second; }
      contract Right() { int first; int second; int third; }
      contract Coordinator() {
        function materialize(int choice) public {
          if (choice == 0) { Left child = new Left(); }
          else if (choice == 1) { Middle child = new Middle(); }
          else { Right child = new Right(); }
          require(true);
        }
      }`, { ...KERNEL, commitmentLimit: 16, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize');
    expect(handler).toMatchObject({ eligible: true });
    expect(handler?.childDeployments?.map((site) => ({
      siteIndex: site.siteIndex,
      occurrence: site.occurrence,
      spanOffset: site.spanOffset,
      spanWidth: site.spanWidth,
      activation: site.activation,
    }))).toEqual([
      expect.objectContaining({ siteIndex: 0, occurrence: 'conditional', spanOffset: 0, spanWidth: 2 }),
      expect.objectContaining({ siteIndex: 1, occurrence: 'conditional', spanOffset: 2, spanWidth: 3 }),
      expect.objectContaining({ siteIndex: 2, occurrence: 'conditional', spanOffset: 5, spanWidth: 4 }),
    ]);
    const activations = handler!.childDeployments!.map((site) => JSON.stringify(site.activation));
    expect(new Set(activations).size).toBe(3);
    expect(activations[1]).toContain('&&');
    expect(activations[2]).toContain('!');
  });

  it('keeps straight-line, conditional, and loop child sites as separate topology occurrences', () => {
    const artifact = compileString(`contract Unit() { int marker; }
      contract Coordinator() {
        function materialize(int n) public {
          Unit first = new Unit();
          if (n > 0) { Unit second = new Unit(); }
          for (int i = 0; i < n; i = i + 1) { Unit repeated = new Unit(); }
          require(true);
        }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_LAYOUT',
        childDeployments: [
          { siteIndex: 0, occurrence: 'once', totalOutputCount: 2 },
          { siteIndex: 1, occurrence: 'conditional', totalOutputCount: 2 },
          { siteIndex: 2, occurrence: 'loop', totalOutputCount: 2 },
        ],
      });
  });

  it('admits a LockingBytecode constructor which is not a child deploy', () => {
    const artifact = compileString(`contract C() {
      function ping(bytes20 pkh) public {
        bytes lb = new LockingBytecodeP2PKH(pkh);
        require(lb.length == 25);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'ping')).toMatchObject({
      eligible: true,
    });
  });

  it('journals an immutable runtime-constructed default key array as one fixed entry', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function denied(int n) public {
        int[] xs = new int[](n);
        for (int i = 0; i < n; i = i + 1) { this.slots[xs[i]] = 1; }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: true,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')).toMatchObject({
      eligible: true,
    });
  });

  it('lowers dominating writes to a runtime-constructed key array', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function denied(int n) public {
        int[] xs = new int[](n);
        xs[0] = 1;
        for (int i = 0; i < n; i = i + 1) { this.slots[xs[i]] = 1; }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'denied')?.sortedUpsertLoopInfo)
      .toEqual([expect.objectContaining({
        collection: 'slots',
        varyingKeyExpressions: [expect.objectContaining({ kind: 'ternary' })],
      })]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')).toMatchObject({
      eligible: true,
    });
  });

  it('replays straight-line push and pop mutations of a runtime-constructed key array', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function write(int n, int first, int second) public {
        int[] xs = new int[](n);
        n = n + 2;
        xs.push(first);
        xs.push(999);
        xs.pop();
        xs.push(second);
        for (int i = 0; i < n; i = i + 1) { this.slots[xs[i]] = i + 1; }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo?.[0]
      .varyingKeyExpressions).toEqual([expect.objectContaining({ kind: 'ternary' })]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('replays finite branch and switch joins of constructed-array pushes', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function branch(int n, bool take, int left, int right) public {
        int[] xs = new int[](0);
        if (take) { xs.push(left); } else { xs.push(right); }
        for (int i = 0; i < n; i = i + 1) { this.slots[xs[i]] = 1; }
        require(true);
      }
      function choose(int n, int mode, int left, int right) public {
        int[] xs = new int[](0);
        switch (mode) {
          case 0: xs.push(left); break;
          default: xs.push(right);
        }
        for (int i = 0; i < n; i = i + 1) { this.slots[xs[i]] = 2; }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.filter((handler) => ['branch', 'choose'].includes(handler.name)))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'branch', eligible: true }),
        expect.objectContaining({ name: 'choose', eligible: true }),
      ]));
  });

  it('retains a constructed-key plan across value-only and read-only helper calls', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function inspect(int[] xs) internal pure returns (int) { return xs.length; }
      function inspectScalar(int value) internal pure returns (int) { return value; }
      function write(int n, int first) public {
        int[] xs = new int[](n);
        xs[0] = first;
        int observedLength = inspect(xs);
        int observedFirst = inspectScalar(xs[0]);
        for (int i = 0; i < n; i = i + 1) {
          this.slots[xs[i]] = observedLength + observedFirst;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo)
      .toEqual([expect.objectContaining({
        collection: 'slots',
        varyingKeyExpressions: [expect.objectContaining({ kind: 'ternary' })],
      })]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('replays straight-line constructed-key mutations through a pure helper alias', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function mutate(int[] memory xs, int next, bool high, int mode) internal pure {
        int index = 0;
        if (high) {
          if (mode == 9) { xs[index] = next + 20; } else { xs[index] = next; }
        } else { xs[index] = next + 10; }
        switch (mode) {
          case 0: xs[index + 1] = next + 1; break;
          default: xs[index + 1] = next + 2;
        }
      }
      function mutateValue(int[] xs, int next) internal pure { xs[0] = next; }
      function mutateOpaqueMemory(int[] memory xs, int next) internal pure {
        while (next > 0) { xs[0] = next; next = next - 1; }
      }
      function write(int n, int first, int second, bool high, int mode) public {
        int[] memory xs = new int[](n);
        xs[0] = first;
        mutate(xs, second, high, mode);
        for (int i = 0; i < n; i = i + 1) { this.slots[xs[i]] = 1; }
        require(true);
      }
      function writeValueCopy(int n, int next) public {
        int[] xs = new int[](n);
        mutateValue(xs, next);
        for (int i = 0; i < n; i = i + 1) { this.slots[xs[i]] = 1; }
        require(true);
      }
      function deniedMemoryAlias(int n, int next) public {
        int[] memory xs = new int[](n);
        mutateOpaqueMemory(xs, next);
        for (int i = 0; i < n; i = i + 1) { this.slots[xs[i]] = 1; }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo)
      .toContainEqual(expect.objectContaining({ multiArmConstructedKeyReplay: true }));
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'writeValueCopy'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'deniedMemoryAlias'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('fences mutable helper histories across distinct arrays while retaining one physical alias', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) leftSlots;
      mapping(int => int) rightSlots;
      function mutate(int[] memory left, int[] memory right, int a, int b) internal pure {
        right[0] = b;
        left[0] = right[0] + a;
      }
      function copyKey(int[] memory left, int[] memory right) internal pure {
        right[0] = 9;
        left[0] = right[0];
      }
      function copyLength(int[] memory left, int[] memory right) internal pure {
        right.push(7);
        left[0] = right.length;
      }
      function inner(int[] memory left, int[] memory right, int next) internal pure {
        right[0] = next;
        left[0] = right[0] + 1;
      }
      function outer(int[] memory first, int[] memory second, int next) internal pure {
        inner(first, second, next);
        second.push(next + 2);
        first[1] = second.length;
      }
      function mutateCopy(int[] copied, int[] memory target, int next) internal pure {
        copied[0] = next;
        target[0] = copied[0] + 1;
      }
      function outerCopy(int[] memory values, int next) internal pure {
        mutateCopy(values, values, next);
      }
      function mutateReturning(int[] memory values, int next) internal pure returns (int) {
        values[0] = next;
        return next + 1;
      }
      function outerCaptured(int[] memory values, int next) internal pure {
        int observed = mutateReturning(values, next);
        values[1] = observed;
      }
      function choose(int[] memory values, int next, bool high) internal pure returns (int) {
        if (high) { values[0] = next; return next + 1; }
        else { values[0] = next + 10; return next + 11; }
      }
      function outerConditional(int[] memory values, int next, bool high) internal pure {
        int observed = choose(values, next, high);
        values[1] = observed;
      }
      function write(int n, int a, int b) public {
        int[] memory left = new int[](n);
        int[] memory right = new int[](n);
        mutate(left, right, a, b);
        for (int i = 0; i < n; i = i + 1) {
          this.leftSlots[left[i]] = i;
          this.rightSlots[right[i]] = i;
        }
        require(true);
      }
      function aliased(int n, int a, int b) public {
        int[] memory keys = new int[](n);
        mutate(keys, keys, a, b);
        for (int i = 0; i < n; i = i + 1) { this.leftSlots[keys[i]] = i; }
        require(true);
      }
      function crossRead(int n) public {
        int[] memory xs = new int[](n);
        int[] memory ys = new int[](n);
        copyKey(xs, ys);
        for (int i = 0; i < n; i = i + 1) { this.leftSlots[xs[i]] = i; }
        require(true);
      }
      function direct(int n, int a, int b) public {
        int[] memory left = new int[](n);
        int[] memory right = new int[](n);
        right[0] = b;
        left[0] = right[0] + a;
        for (int i = 0; i < n; i = i + 1) {
          this.leftSlots[left[i]] = i;
          this.rightSlots[right[i]] = i;
        }
        require(true);
      }
      function lengthRead(int n) public {
        int[] memory left = new int[](n);
        int[] memory right = new int[](n);
        copyLength(left, right);
        for (int i = 0; i < n; i = i + 1) { this.leftSlots[left[i]] = i; }
        require(true);
      }
      function transitive(int n, int next) public {
        int[] memory left = new int[](n);
        int[] memory right = new int[](n);
        outer(left, right, next);
        for (int i = 0; i < n; i = i + 1) {
          this.leftSlots[left[i]] = i;
          this.rightSlots[right[i]] = i;
        }
        require(true);
      }
      function transitiveCopy(int n, int next) public {
        int[] memory values = new int[](n);
        outerCopy(values, next);
        for (int i = 0; i < n; i = i + 1) { this.leftSlots[values[i]] = i; }
        require(true);
      }
      function capturedReturn(int n, int next) public {
        int[] memory values = new int[](n);
        int observed = mutateReturning(values, next);
        for (int i = 0; i < n; i = i + 1) { this.leftSlots[values[i]] = i; }
        require(observed == next + 1);
      }
      function nestedCapturedReturn(int n, int next) public {
        int[] memory values = new int[](n);
        outerCaptured(values, next);
        for (int i = 0; i < n; i = i + 1) { this.leftSlots[values[i]] = i; }
        require(true);
      }
      function conditionalReturn(int n, int next, bool high) public {
        int[] memory values = new int[](n);
        outerConditional(values, next, high);
        for (int i = 0; i < n; i = i + 1) { this.leftSlots[values[i]] = i; }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'leftSlots', crossArrayKeyReplay: true }),
        expect.objectContaining({ collection: 'rightSlots' }),
      ]));
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'aliased'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'crossRead'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'direct'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.abi.find((handler) => handler.name === 'direct')?.sortedUpsertLoopInfo)
      .toContainEqual(expect.objectContaining({ crossArrayKeyReplay: true }));
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'lengthRead'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'transitive'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.abi.find((handler) => handler.name === 'transitive')?.sortedUpsertLoopInfo)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'leftSlots', crossArrayKeyReplay: true }),
        expect.objectContaining({ collection: 'rightSlots' }),
      ]));
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'transitiveCopy'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'capturedReturn'))
      .toMatchObject({ eligible: true });
    for (const name of ['nestedCapturedReturn', 'conditionalReturn']) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === name))
        .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
      expect(artifact.abi.find((handler) => handler.name === name)?.sortedUpsertLoopInfo)
        .toContainEqual(expect.objectContaining({ nestedHelperReturnReplay: true }));
    }
  });

  it('replays a literal-bounded pure helper loop without changing runtime loop semantics', () => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function fillFixed(int[] memory values, int base) internal pure {
        for (int cursor = 0; cursor < 2; cursor = cursor + 1) {
          values[cursor] = base + cursor;
        }
      }
      function apply(int count, int base) public {
        int[] memory values = new int[](count);
        fillFixed(values, base);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[values[cursor]] = cursor;
        }
        require(true);
      }
      function seed(int key) public { this.records[key] = 1; require(true); }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it.each([
    ['a descending for loop', `for (int cursor = 2; cursor >= 0; cursor = cursor - 1) {
      values[cursor] = base + cursor;
    }`],
    ['a reversed comparison and commuted step', `for (int cursor = 0; 3 > cursor; cursor = 1 + cursor) {
      values[cursor] = base + cursor;
    }`],
    ['a post-test loop', `int cursor = 0; do {
      values[cursor] = base + cursor;
      cursor = cursor + 1;
    } while (cursor < 3);`],
    ['a source while loop', `int cursor = 0; while (cursor < 3) {
      values[cursor] = base + cursor;
      cursor = cursor + 1;
    }`],
    ['an exact endpoint', `for (int cursor = 0; cursor != 4; cursor = cursor + 2) {
      values[cursor / 2] = base + cursor;
    }`],
  ])('replays keys constructed by %s in a pure helper', (_label, helperLoop) => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function fillFixed(int[] memory values, int base) internal pure { ${helperLoop} }
      function apply(int count, int base) public {
        int[] memory values = new int[](count);
        fillFixed(values, base);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[values[cursor]] = cursor;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('replays a counter-selected continue in a literal-bounded pure helper loop', () => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function fillFixed(int[] memory values, int base) internal pure {
        for (int cursor = 0; cursor < 2; cursor = cursor + 1) {
          if (cursor == 0) { continue; }
          values[cursor] = base + cursor;
        }
      }
      function apply(int count, int base) public {
        int[] memory values = new int[](count);
        fillFixed(values, base);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[values[cursor]] = cursor;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('replays a runtime-selected continue in a literal-bounded pure helper loop', () => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function fillFixed(int[] memory values, int base, bool skip) internal pure {
        for (int cursor = 0; cursor < 2; cursor = cursor + 1) {
          if (skip) { continue; }
          values[cursor] = base + cursor;
        }
      }
      function apply(int count, int base, bool skip) public {
        int[] memory values = new int[](count);
        fillFixed(values, base, skip);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[values[cursor]] = cursor;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('replays a counter-selected switch continue in a literal-bounded pure helper loop', () => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function fillFixed(int[] memory values, int base) internal pure {
        for (int cursor = 0; cursor < 2; cursor = cursor + 1) {
          switch (cursor) {
            case 0: continue;
            default: values[cursor] = base + cursor;
          }
        }
      }
      function apply(int count, int base) public {
        int[] memory values = new int[](count);
        fillFixed(values, base);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[values[cursor]] = cursor;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('replays a runtime-selected switch continue in a literal-bounded pure helper loop', () => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function fillFixed(int[] memory values, int base, int mode) internal pure {
        for (int cursor = 0; cursor < 2; cursor = cursor + 1) {
          switch (mode) {
            case 0: continue;
            default: values[cursor] = base + cursor;
          }
        }
      }
      function apply(int count, int base, int mode) public {
        int[] memory values = new int[](count);
        fillFixed(values, base, mode);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[values[cursor]] = cursor;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('replays a counter-selected break in a literal-bounded pure helper loop', () => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function fillFixed(int[] memory values, int base) internal pure {
        for (int cursor = 0; cursor < 3; cursor = cursor + 1) {
          if (cursor == 2) { break; }
          values[cursor] = base + cursor;
        }
      }
      function apply(int count, int base) public {
        int[] memory values = new int[](count);
        fillFixed(values, base);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[values[cursor]] = cursor;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('fences a runtime-selected helper break with a multi-arm constructed-key replay', () => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function fillFixed(int[] memory values, int base, bool stop) internal pure {
        for (int cursor = 0; cursor < 3; cursor = cursor + 1) {
          if (stop) { break; }
          values[cursor] = base + cursor;
        }
      }
      function apply(int count, int base, bool stop) public {
        int[] memory values = new int[](count);
        fillFixed(values, base, stop);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[values[cursor]] = cursor;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.abi.find((handler) => handler.name === 'apply')?.sortedUpsertLoopInfo)
      .toContainEqual(expect.objectContaining({ multiArmConstructedKeyReplay: true }));
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('replays a counter-selected return from a literal-bounded pure helper loop', () => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function fillFixed(int[] memory values, int base) internal pure returns (int) {
        for (int cursor = 0; cursor < 3; cursor = cursor + 1) {
          values[cursor] = base + cursor;
          if (cursor == 1) { return cursor; }
        }
        return 3;
      }
      function apply(int count, int base) public {
        int[] memory values = new int[](count);
        int stoppedAt = fillFixed(values, base);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[values[cursor]] = stoppedAt + cursor;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('replays a counter-selected switch return from a literal-bounded pure helper loop', () => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function fillFixed(int[] memory values, int base) internal pure returns (int) {
        for (int cursor = 0; cursor < 3; cursor = cursor + 1) {
          values[cursor] = base + cursor;
          switch (cursor) {
            case 1: return cursor;
            default: break;
          }
        }
        return 3;
      }
      function apply(int count, int base) public {
        int[] memory values = new int[](count);
        int stoppedAt = fillFixed(values, base);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[values[cursor]] = stoppedAt + cursor;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('replays a runtime-selected return from a literal-bounded pure helper loop', () => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function fillFixed(int[] memory values, int base, bool stop) internal pure returns (int) {
        for (int cursor = 0; cursor < 3; cursor = cursor + 1) {
          values[cursor] = base + cursor;
          if (stop) { return cursor; }
        }
        return 3;
      }
      function apply(int count, int base, bool stop) public {
        int[] memory values = new int[](count);
        int stoppedAt = fillFixed(values, base, stop);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[values[cursor]] = stoppedAt + cursor;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('refuses a pure helper loop with an exhausted symbolic replay budget', () => {
    const helperLoop = `for (int cursor = 0; cursor < 257; cursor = cursor + 1) {
      values[cursor] = base + cursor;
    }`;
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function fillFixed(int[] memory values, int base) internal pure { ${helperLoop} }
      function apply(int count, int base) public {
        int[] memory values = new int[](count);
        fillFixed(values, base);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[values[cursor]] = cursor;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('replays helper-side constructed-key resizing through the shared memory alias', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function resize(int[] memory xs, int key) internal pure {
        xs.push(key); xs.push(key + 1); xs.pop();
      }
      function write(int n, int key) public {
        int[] memory xs = new int[](0);
        resize(xs, key);
        for (int i = 0; i < n; i = i + 1) { this.slots[xs[i]] = 1; }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo)
      .toEqual([expect.objectContaining({
        collection: 'slots',
        varyingKeyExpressions: [expect.objectContaining({ kind: 'ternary' })],
      })]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('normalizes memory-helper returns inside a finite switch', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) records;
      function choose(int[] memory values, int mode) internal pure returns (int) {
        switch (mode) {
          case 0: values[0] = 10; return 11;
          default: values[0] = 20; return 21;
        }
      }
      function apply(int count, int mode) public {
        int[] memory values = new int[](count);
        int observed = choose(values, mode);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[values[cursor]] = observed;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('fences one unauthenticated constructed-array push recurrence', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function write(int n) public {
        int[] xs = new int[](0);
        for (int i = 1; i < n; i = i + 2) {
          xs.push(i + 10);
          this.slots[xs[(i - 1) / 2]] = i;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo)
      .toEqual([expect.objectContaining({
        collection: 'slots', constructedKeyReplay: true,
        varyingKeyExpressions: [expect.objectContaining({ kind: 'ternary' })],
      })]);
  });

  it('fences multiple unauthenticated constructed-array push recurrences', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function write(int n) public {
        int[] xs = new int[](0);
        for (int i = 1; i < n; i = i + 2) {
          xs.push(i + 10);
          this.slots[xs[((i - 1) / 2) * 2]] = i;
          xs.push(i + 20);
          this.slots[xs[((i - 1) / 2) * 2 + 1]] = i + 100;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo)
      .toEqual([
        expect.objectContaining({ constructedKeyReplay: true }),
        expect.objectContaining({ constructedKeyReplay: true }),
      ]);
  });

  it('fences unauthenticated fixed and invariant variable-width resize recurrences', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function write(int n) public {
        int[] xs = new int[](0);
        for (int i = 0; i < n; i = i + 1) {
          if (i % 2 == 0) xs.push(i + 10);
          else xs.push(i + 20);
          this.slots[xs[i]] = i;
        }
        require(true);
      }
      function choose(int n) public {
        int[] xs = new int[](0);
        for (int i = 0; i < n; i = i + 1) {
          switch (i % 2) {
            case 0: xs.push(i + 30); break;
            default: xs.push(i + 40);
          }
          this.slots[xs[i]] = i;
        }
        require(true);
      }
      function trim(int n) public {
        int[] xs = new int[](6);
        for (int i = 0; i < n; i = i + 1) {
          if (i % 2 == 0) xs.pop();
          else xs.pop();
          this.slots[xs[4 - i]] = i;
        }
        require(true);
      }
      function trimVariableWidth(int n, bool twice) public {
        int[] xs = new int[](8);
        xs[0] = 11; xs[1] = 12; xs[2] = 13; xs[3] = 14;
        xs[4] = 15; xs[5] = 16; xs[6] = 17; xs[7] = 18;
        for (int i = 0; i < n; i = i + 1) {
          if (twice) { xs.pop(); xs.pop(); }
          else xs.pop();
          this.slots[xs[twice ? 5 - i * 2 : 6 - i]] = i;
        }
        require(true);
      }
      function pushVariableWidth(int n, bool twice) public {
        int[] xs = new int[](0);
        for (int i = 0; i < n; i = i + 1) {
          if (twice) { xs.push(i + 40); xs.push(i + 50); }
          else xs.push(i + 60);
          this.slots[xs[twice ? i * 2 + 1 : i]] = i;
        }
        require(true);
      }
      function pushVariableSwitch(int n, int mode) public {
        int[] xs = new int[](0);
        for (int i = 0; i < n; i = i + 1) {
          switch (mode) {
            case 0: xs.push(i + 70); break;
            case 1: xs.push(i + 80); xs.push(i + 90); break;
            default: xs.push(i + 100); xs.push(i + 110); xs.push(i + 120);
          }
          this.slots[xs[mode == 0 ? i : mode == 1 ? i * 2 + 1 : i * 3 + 2]] = i;
        }
        require(true);
      }
      function pushLoopLocals(int n) public {
        int[] xs = new int[](0);
        int key = 0;
        for (int i = 0; i < n; i = i + 1) {
          key = i + 200;
          bool high = i % 2 == 0;
          if (high) xs.push(key + 10); else xs.push(key + 20);
          this.slots[xs[i]] = i;
        }
        require(true);
      }
      function pushJoinedLocals(int n) public {
        int[] xs = new int[](0);
        int key = 0;
        for (int i = 0; i < n; i = i + 1) {
          if (i % 2 == 0) key = i + 300; else key = i + 400;
          xs.push(key);
          this.slots[xs[i]] = i;
        }
        require(true);
      }
      function pushSwitchLocals(int n) public {
        int[] xs = new int[](0);
        int key = 0;
        for (int i = 0; i < n; i = i + 1) {
          switch (i % 3) {
            case 0: key = i + 500; break;
            case 1: key = i + 600; break;
            default: key = i + 700;
          }
          xs.push(key);
          this.slots[xs[i]] = i;
        }
        require(true);
      }
      function pushOptional(int n, bool grow) public {
        int[] xs = new int[](0);
        for (int i = 0; i < n; i = i + 1) {
          if (grow) {
            xs.push(i + 800);
            this.slots[xs[i]] = i;
          }
        }
        require(true);
      }
      function trimOptional(int n, bool shrink) public {
        int[] xs = new int[](8);
        xs[0] = 21; xs[1] = 22; xs[2] = 23; xs[3] = 24;
        xs[4] = 25; xs[5] = 26; xs[6] = 27; xs[7] = 28;
        for (int i = 0; i < n; i = i + 1) {
          if (shrink) xs.pop();
          this.slots[xs[shrink ? 6 - i : i]] = i;
        }
        require(true);
      }
      function trimVariableSwitch(int n, int mode) public {
        int[] xs = new int[](10);
        xs[0] = 30; xs[1] = 31; xs[2] = 32; xs[3] = 33; xs[4] = 34;
        xs[5] = 35; xs[6] = 36; xs[7] = 37; xs[8] = 38; xs[9] = 39;
        for (int i = 0; i < n; i = i + 1) {
          switch (mode) {
            case 0: xs.pop(); break;
            case 1: xs.pop(); xs.pop(); break;
            default: break;
          }
          this.slots[xs[mode == 0 ? 8 - i : mode == 1 ? 7 - i * 2 : i]] = i;
        }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    for (const name of [
      'write', 'choose', 'trimVariableWidth', 'pushVariableWidth', 'pushVariableSwitch',
      'pushLoopLocals', 'pushJoinedLocals', 'pushSwitchLocals', 'pushOptional', 'trimOptional',
      'trimVariableSwitch',
    ]) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === name))
        .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
      expect(artifact.abi.find((handler) => handler.name === name)?.sortedUpsertLoopInfo)
        .toEqual(expect.arrayContaining([expect.objectContaining({ constructedKeyReplay: true })]));
    }
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'trim'))
      .toMatchObject({ eligible: true });
  });

  it('fences an unauthenticated resize recurrence after an initial constructed-array prefix', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function write(int n) public {
        int[] xs = new int[](3);
        xs[0] = 31; xs[1] = 32; xs[2] = 33;
        for (int i = 0; i < n; i = i + 1) {
          this.slots[xs[i]] = i;
          xs.push(i + 1);
        }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo)
      .toEqual([expect.objectContaining({ constructedKeyReplay: true })]);
  });

  it('fences a fixed unauthenticated constructed-array pop recurrence', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function write(int n) public {
        int[] xs = new int[](4);
        xs[0] = 11; xs[1] = 12; xs[2] = 13; xs[3] = 14;
        for (int i = 0; i < n; i = i + 1) {
          xs.pop();
          this.slots[xs[2 - i]] = i;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo)
      .toEqual([expect.objectContaining({ constructedKeyReplay: true })]);
  });

  it.each([
    ['pops into its pre-existing prefix before pushing',
      'xs.pop(); xs.push(i + 1); this.slots[xs[i]] = i;', true],
    ['uses a runtime pop threshold', 'if (i > n - 2) xs.pop(); this.slots[xs[0]] = i;', false],
    ['has a counter-selected unequal pop width',
      'if (i > 0) { xs.pop(); xs.pop(); } else xs.pop(); this.slots[xs[0]] = i;', false],
  ])('classifies a constructed array which %s', (_label, body, eligible) => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function denied(int n) public {
        int[] xs = new int[](n);
        for (int i = 0; i < n; i = i + 1) { ${body} }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject(eligible
        ? { eligible: true }
        : { eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('replays monotone literal-threshold pop prefix sums over affine counters', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function write(int n) public {
        int[] xs = new int[](n);
        xs[0] = 10; xs[1] = 11; xs[2] = 12; xs[3] = 13;
        for (int i = 0; i < n; i = i + 1) {
          if (i > 0) xs.pop();
          this.slots[xs[n - i - 1]] = i;
        }
        require(true);
      }
      function writeDescending(int n) public {
        int[] xs = new int[](4);
        xs[0] = 10; xs[1] = 11; xs[2] = 12; xs[3] = 13;
        for (int i = 3; i >= n; i = i - 1) {
          if (i < 3) xs.pop();
          this.slots[xs[i]] = i;
        }
        require(true);
      }
      function writeNonUnit(int n) public {
        int[] xs = new int[](8);
        for (int i = 1; i < n; i = i + 2) {
          if (i >= 5) xs.pop();
          this.slots[xs[0]] = i;
        }
        require(true);
      }
      function writeReversed(int n) public {
        int[] xs = new int[](8);
        for (int i = 1; i < n; i = i + 2) {
          if (5 <= i) xs.pop();
          this.slots[xs[0]] = i;
        }
        require(true);
      }
      function writeDescendingNonUnit(int n) public {
        int[] xs = new int[](8);
        for (int i = 9; i >= n; i = i - 2) {
          if (i <= 5) xs.pop();
          this.slots[xs[0]] = i;
        }
        require(true);
      }
      function writeImmediate(int n) public {
        int[] xs = new int[](8);
        for (int i = 2; i < n; i = i + 2) {
          if (i >= 0) xs.pop();
          this.slots[xs[0]] = i;
        }
        require(true);
      }
      function writeBeyondDomain(int n) public {
        int[] xs = new int[](8);
        for (int i = 2; i < n; i = i + 2) {
          if (i > 100) xs.pop();
          this.slots[xs[0]] = i;
        }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    for (const name of [
      'write', 'writeDescending', 'writeNonUnit', 'writeReversed', 'writeDescendingNonUnit',
      'writeImmediate', 'writeBeyondDomain',
    ]) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === name))
        .toMatchObject({ eligible: true });
    }
  });

  it('authenticates runtime-threshold conditional-pop prefix counts over a constant-step domain', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function write(int n, int threshold) public {
        int[] xs = new int[](8);
        xs[0] = 10; xs[1] = 11; xs[2] = 12; xs[3] = 13;
        xs[4] = 14; xs[5] = 15; xs[6] = 16; xs[7] = 17;
        for (int i = 1; i < n; i = i + 2) {
          if (i >= threshold) xs.pop();
          this.slots[xs[7 - (i - 1) / 2]] = i;
        }
        require(true);
      }
      function mutated(int n, int threshold) public {
        int[] xs = new int[](8);
        for (int i = 1; i < n; i = i + 2) {
          if (i >= threshold) xs.pop();
          this.slots[xs[0]] = i;
          threshold = threshold + 1;
        }
        require(true);
      }
      function runtimeStep(int n, int threshold, int stride) public {
        int[] xs = new int[](8);
        for (int i = 1; i < n; i = i + stride) {
          if (i >= threshold) xs.pop();
          this.slots[xs[0]] = i;
        }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    const info = artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo?.[0];
    expect(info).toMatchObject({
      prefixCountWitnessParam: expect.stringMatching(/^__internal__vmapCounterPrefixCount_/),
      prefixCountCondition: expect.objectContaining({ kind: 'binary', operator: '>=' }),
    });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.inputs)
      .toContainEqual(expect.objectContaining({ name: info?.prefixCountWitnessParam, type: 'int256[]' }));
    for (const name of ['mutated', 'runtimeStep']) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === name)).toMatchObject({
        eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY',
      });
    }
  });

  it('keeps prefix-count traces fenced from selected write domains and rolls back a mixed-loop candidate', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function guarded(int n, int threshold) public {
        int[] xs = new int[](8);
        for (int i = 1; i < n; i = i + 2) {
          if (i >= threshold) xs.pop();
          if (i % 2 == 1) this.slots[xs[7 - (i - 1) / 2]] = i;
        }
        require(true);
      }
      function mixed(int n, int threshold, int stride) public {
        int[] first = new int[](8);
        for (int i = 1; i < n; i = i + 2) {
          if (i >= threshold) first.pop();
          this.slots[first[7 - (i - 1) / 2]] = i;
        }
        int[] second = new int[](8);
        for (int j = 1; j < n; j = j + stride) {
          this.slots[second[0]] = j;
        }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    for (const name of ['guarded', 'mixed']) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === name)).toMatchObject({
        eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY',
      });
      expect(artifact.abi.find((handler) => handler.name === name)?.inputs
        .some((input) => input.name.startsWith('__internal__vmapCounterPrefixCount_'))).toBe(false);
    }
  });

  it('fences a path-balanced transient schedule with multiple mutation streams', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function write(int n, bool high) public {
        int[] xs = new int[](n);
        for (int i = 0; i < n; i = i + 1) {
          if (high) {
            xs.push(i + 100); this.slots[xs[n]] = i + 10; xs.pop();
          } else {
            xs.push(i + 200); this.slots[xs[n]] = i + 20; xs.pop();
          }
        }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it.each([
    ['a conditional append', 'count', 'if (cursor > 0) buffer.push(cursor + 1);'],
    ['a counter-dependent append width', 'count', `if (cursor > 0) {
      buffer.push(cursor + 1); buffer.push(cursor + 2);
    } else buffer.push(cursor + 3);`],
    ['a larger affine allocation prefix', 'count + 2', 'if (cursor > 0) buffer.push(cursor + 1);'],
  ])(
    'keeps reads in the stable allocation prefix replayable across %s',
    (_label, allocation, resize) => {
      const artifact = compileString(`contract Registry() {
        mapping(int => int) records;
        function apply(int count) public {
          int[] buffer = new int[](${allocation});
          for (int cursor = 0; cursor < count; cursor = cursor + 1) {
            ${resize}
            this.records[buffer[cursor]] = cursor;
          }
          require(true);
        }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
        .toMatchObject({ eligible: true });
    },
  );

  it('refuses an opaque append suffix read without an invertible resize recurrence', () => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function apply(int count) public {
        int[] buffer = new int[](count);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          if (cursor > 0) buffer.push(cursor + 1);
          this.records[buffer[count]] = cursor;
        }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it('derives a straight-line same-iteration local array key', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function denied(int n) public {
        int[] xs = new int[](n);
        for (int i = 0; i < n; i = i + 1) {
          xs[i] = i + 1;
          this.slots[xs[i]] = 1;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'denied')?.sortedUpsertLoopInfo)
      .toEqual([expect.objectContaining({
        collection: 'slots',
        varyingKeyExpressions: [expect.objectContaining({ kind: 'ternary' })],
      })]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('derives a conditionally initialized same-iteration local array key', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function denied(int n, bool take) public {
        int[] xs = new int[](n);
        for (int i = 0; i < n; i = i + 1) {
          if (take) { xs[i] = i + 1; }
          else { xs[i] = n + i; }
          this.slots[xs[i]] = 1;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'denied')?.sortedUpsertLoopInfo)
      .toEqual([expect.objectContaining({
        collection: 'slots',
        varyingKeyExpressions: [expect.objectContaining({ kind: 'ternary' })],
      })]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('fences a multi-arm switch-initialized local array key', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function write(int n, int mode, bool take) public {
        int[] xs = new int[](n);
        for (int i = 0; i < n; i = i + 1) {
          switch (mode) {
            case 0: if (take) { xs[i] = 10 + i; } else { xs[i] = 20 + i; } break;
            case 1: xs[i] = 30 + i; break;
            default: xs[i] = 40 + i;
          }
          this.slots[xs[i]] = i + 1;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo)
      .toContainEqual(expect.objectContaining({ multiArmConstructedKeyReplay: true }));
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo?.[0]
      .varyingKeyExpressions).toEqual([expect.objectContaining({ kind: 'ternary' })]);
  });

  it('keeps a local key-array snapshot stable across a later parameter reassignment', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function denied(int n, int key) public {
        int[] xs = new int[](n);
        xs[0] = key;
        key = key + 1;
        for (int i = 0; i < n; i = i + 1) { this.slots[xs[i]] = 1; }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('replays a local key-array write after a finite conditional parameter reassignment', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function denied(int n, int key, bool take) public {
        int[] xs = new int[](n);
        if (take) { key = key + 1; }
        xs[0] = key;
        for (int i = 0; i < n; i = i + 1) { this.slots[xs[i]] = 1; }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'denied')?.sortedUpsertLoopInfo?.[0]
      .varyingKeyExpressions).toEqual([expect.objectContaining({ kind: 'ternary' })]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('publishes KERNEL_* handlers when every entry point is refused', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract C() {
        function denied() public { assembly { OP_ACTIVEBYTECODE OP_SHA256 OP_DROP } require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_OPAQUE_EFFECT',
    });
  });

  it('admits a continue-selected counter-keyed mapping loop', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function write(int n) public {
        for (int i = 0; i < n; i = i + 1) {
          if (i % 2 == 0) { continue; }
          this.m[i] = i;
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo?.[0]
      .iterationCondition).toBeDefined();
  });

  it('derives the exact selected domain across switch-local continue and break', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function write(int n, bool keepCaseOne) public {
        for (int i = 0; i < n; i = i + 1) {
          switch (i % 3) {
            case 0: { continue; }
            case 1: { if (!keepCaseOne) { continue; } break; }
            default: { break; }
          }
          this.m[i] = i;
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo?.[0]
      .iterationCondition).toEqual(expect.objectContaining({ kind: 'binary', operator: '||' }));
  });

  it('admits a break-controlled counter-keyed mapping loop with an exact terminated domain', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function denied(int n) public {
        for (int i = 0; i < n; i = i + 1) {
          if (i == 3) { break; }
          this.m[i] = i;
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'denied')?.sortedUpsertLoopInfo?.[0])
      .toMatchObject({
        iterationCondition: { kind: 'unary', operator: '!' },
        iterationBreakCondition: { kind: 'binary', operator: '==' },
      });
  });

  it.each([
    ['a zero counter step', 'for (int i = 0; i < n; i = i + 0) { this.m[i] = i; }'],
    ['an extra post-test counter mutation', `int i = 0; do {
      this.m[i] = i; i = n; i = i + 1;
    } while (i < n);`],
    ['a bound assigned inside its loop', `for (int i = 0; i < n; i = i + 1) {
      n = n - 1; this.m[i] = i;
    }`],
  ])('refuses %s as KERNEL_UNBOUNDED_KEY and preserves an eligible sibling', (_label, loop) => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function denied(int n) public { ${loop} require(true); }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('admits a stable disjoint read from the same mapping as a runtime write stream', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function write(int n, int source) public {
        int base = this.m[source];
        for (int i = 0; i < n; i = i + 1) { this.m[i] = base + i; }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('authenticates a counter-derived sibling read from the same mapping as an independent stream', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function copy(int n, int offset) public {
        for (int i = 0; i < n; i = i + 1) { this.m[i] = this.m[i + offset] + 1; }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'copy'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    const streams = artifact.abi.find((handler) => handler.name === 'copy')?.sortedUpsertLoopInfo ?? [];
    expect(streams.filter((stream) => stream.collection === 'm')).toEqual(expect.arrayContaining([
      expect.objectContaining({ op: 'read', varyingKeyExpressions: expect.any(Array) }),
      expect.objectContaining({ op: 'set' }),
    ]));
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('journals a counter-keyed mapping-array push through an authenticated old-value vector', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int[]) values;
      function denied(int n, int value) public {
        for (int i = 0; i < n; i = i + 1) { this.values[i].push(value); }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'denied')?.sortedUpsertLoopInfo?.[0])
      .toMatchObject({
        collection: 'values',
        mutation: 'push',
        mutationValueScalarParam: 'value',
        valueRuntimeExpression: true,
        oldValuesWitnessParam: expect.stringMatching(/^__internal__vmapCounterOld_/),
      });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('keeps counter-indexed mapping-array mutation operands in logical source order', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int[]) values;
      function pushEach(int n, int[] additions) public {
        for (int i = 0; i < n; i = i + 1) { this.values[i].push(additions[i]); }
        require(true);
      }
      function setEach(int n, int[] indices, int[] replacements) public {
        for (int i = 0; i < n; i = i + 1) { this.values[i][indices[i]] = replacements[i]; }
        require(true);
      }
      function pushExpression(int n, int base) public {
        for (int i = 0; i < n; i = i + 1) { this.values[i].push(base + i * 2); }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.abi.find((handler) => handler.name === 'pushEach')?.sortedUpsertLoopInfo?.[0])
      .toMatchObject({
        mutation: 'push',
        mutationValueArrayParam: 'additions',
        mutationValueArrayIndexParam: expect.stringMatching(/^__internal__vmapCounterPerm_/),
      });
    expect(artifact.abi.find((handler) => handler.name === 'setEach')?.sortedUpsertLoopInfo?.[0])
      .toMatchObject({
        mutation: 'setAt',
        mutationValueArrayParam: 'replacements',
        mutationValueArrayIndexParam: expect.stringMatching(/^__internal__vmapCounterPerm_/),
        mutationIndexArrayParam: 'indices',
        mutationIndexArrayIndexParam: expect.stringMatching(/^__internal__vmapCounterPerm_/),
      });
    expect(artifact.abi.find((handler) => handler.name === 'pushExpression')?.sortedUpsertLoopInfo?.[0])
      .toMatchObject({ mutation: 'push', mutationValueExpression: { kind: 'binary', operator: '+' } });
  });

  it('replays a finite conditional public bound before deriving the counter permutation', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function write(int n, bool trim) public {
        if (trim) { n = n - 1; }
        for (int i = 0; i < n; i = i + 1) { this.m[i] = i; }
        require(true);
      }
      function writeLocal(int n, bool trim) public {
        int limit = n;
        if (trim) { limit = limit - 2; } else { limit = limit - 1; }
        for (int i = 0; i < limit; i = i + 1) { this.m[i] = i; }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo?.[0]
      .iterationBound).toMatchObject({ kind: 'ternary' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'writeLocal'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'writeLocal')?.sortedUpsertLoopInfo?.[0]
      .iterationBound).toMatchObject({ kind: 'ternary' });
  });

  it.each([
    ['a reassigned public bound', `n = n - 1;
      for (int i = 0; i < n; i = i + 1) { this.m[i] = i; }`],
    ['a reassigned local bound', `int limit = n; limit = n - 1;
      for (int i = 0; i < limit; i = i + 1) { this.m[i] = i; }`],
  ])('replays %s before deriving the counter permutation', (_label, loop) => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function write(int n) public { ${loop} require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.inputs.some((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))).toBe(true);
  });

  it('publishes a deterministic non-affine counter bound for SDK replay', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function fill(int n, int scale) public {
        int limit = n * scale;
        for (int i = 0; i < limit; i = i + 1) { this.m[i] = i + 10; }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'fill'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'fill')?.sortedUpsertLoopInfo?.[0].iterationBound)
      .toMatchObject({ kind: 'binary', operator: '*' });
  });

  it('admits an exact counter-selected mapping-write domain', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function write(int n, int ceiling) public {
        for (int i = 0; i < n; i = i + 1) {
          if (i < ceiling) this.m[i] = i + 10;
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write')?.eligible).toBe(true);
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo?.[0]
      .iterationCondition).toEqual({
      kind: 'binary', operator: '<',
      left: {
        kind: 'source',
        source: { kind: 'loopIndex', initialValue: '0', stepValue: '1' },
      },
      right: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
    });
  });

  it('admits an immutable local alias chain of the public counter-loop bound', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function fill(int n, int value) public {
        int requested = n;
        int limit = requested;
        for (int i = 0; i < limit; i = i + 1) { this.m[i] = value; }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'fill')?.eligible).toBe(true);
    expect(artifact.abi.find((handler) => handler.name === 'fill')?.inputs).toContainEqual(
      expect.objectContaining({ name: expect.stringMatching(/^__internal__vmapCounterPerm_n_/), type: 'int256[]' }),
    );
  });

  it('admits an immutable affine local bound derived from a public argument', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function fill(int n) public {
        int requested = n;
        int intermediate = requested - 2;
        int limit = 1 + intermediate;
        for (int i = 0; i < limit; i = i + 1) { this.m[i] = i + 10; }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'fill')?.eligible).toBe(true);
    expect(artifact.abi.find((handler) => handler.name === 'fill')?.inputs).toContainEqual(
      expect.objectContaining({
        name: expect.stringMatching(/^__internal__vmapCounterPerm_n_\d+_bound_n1$/),
        type: 'int256[]',
      }),
    );
  });

  it.each([
    ['positive', '3', 'p3'],
    ['negative', '-3', 'n3'],
  ])('admits a %s constant counter start and positive step over a public bound', (_label, start, encodedStart) => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function fill(int n) public {
        for (int i = ${start}; i < n; i = i + 2) { this.m[i] = i; }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'fill')?.eligible).toBe(true);
    expect(artifact.abi.find((handler) => handler.name === 'fill')?.inputs).toContainEqual(
      expect.objectContaining({
        name: expect.stringMatching(new RegExp(`^__internal__vmapCounterPerm_n_\\d+_from_${encodedStart}_step_p2$`)),
        type: 'int256[]',
      }),
    );
  });

  it.each([
    ['postfix increment', 'int i = 0', 'i < n', 'i++'],
    ['prefix increment', 'int i = 0', 'i < n', '++i'],
    ['postfix decrement', 'int i = 5', 'i >= n', 'i--'],
    ['prefix decrement', 'int i = 5', 'i >= n', '--i'],
  ])('admits a canonical for loop written with %s', (_label, init, condition, update) => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function write(int n) public {
        for (${init}; ${condition}; ${update}) { this.m[i] = i; }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo)
      .toHaveLength(1);
  });

  it.each([
    ['ascending', '1', '<', '+', 'stride', 'source'],
    ['descending', '9', '>', '-', 'stride + 1', 'binary'],
  ])('publishes a replayable runtime %s step with one unconditional event stream', (
    _label, start, comparison, operator, stride, kind,
  ) => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      event Hit(int value);
      function write(int n, int stride) public {
        for (int i = ${start}; i ${comparison} n; i = i ${operator} (${stride})) {
          this.m[i] = i;
          emit Hit(i);
        }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    const info = artifact.abi.find((candidate) => candidate.name === 'write')?.sortedUpsertLoopInfo?.[0];
    expect(info?.varyingArrayParam).toMatch(/_step_runtime_[pn]$/);
    expect(info?.iterationStep).toMatchObject({ kind });
  });

  it('publishes the runtime counter step for a typed-call argument', () => {
    const artifact = compileString(`
      interface I { function hit(int value); }
      contract C(bytes32 dest) {
        mapping(int => int) m;
        function write(int n, int stride) public {
          stride = stride + 1;
          for (int i = 1; i < n; i = i + stride) {
            this.m[i] = i;
            I(dest).hit(i);
          }
          require(true);
        }
      }
    `, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((candidate) => candidate.name === 'write')?.externalCalls?.[0]
      .argSources?.[0]).toMatchObject({
      kind: 'loopIndex',
      initialValue: '1',
      stepExpression: { kind: 'binary', operator: '+' },
    });
  });

  it('replays an immutable local runtime-step expression', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function write(int n, int stride) public {
        int delta = stride + 1;
        for (int i = 0; i < n; i = i + delta) { this.m[i] = i; }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((candidate) => candidate.name === 'write')?.sortedUpsertLoopInfo?.[0]
      .iterationStep).toMatchObject({ kind: 'binary', operator: '+' });
  });

  it('refuses runtime steps mutated inside their loop and snapshots a dominating reassignment', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function denied(int n, int stride) public {
        for (int i = 0; i < n; i = i + stride) {
          this.m[i] = i;
          stride = stride + 1;
        }
        require(true);
      }
      function deniedLocal(int n, int stride) public {
        int delta = stride;
        for (int i = 0; i < n; i = i + delta) {
          this.m[i] = i;
          delta = delta + 1;
        }
        require(true);
      }
      function deniedReassigned(int n, int stride) public {
        stride = stride + 1;
        for (int i = 0; i < n; i = i + stride) { this.m[i] = i; }
        require(true);
      }
      function admittedConditional(int n, int stride, bool wide) public {
        if (wide) { stride = stride + 1; } else { stride = stride + 2; }
        for (int i = 0; i < n; i = i + stride) { this.m[i] = i; }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'deniedLocal')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'deniedReassigned'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'deniedReassigned')?.sortedUpsertLoopInfo?.[0]
      .iterationStep).toMatchObject({ kind: 'binary', operator: '+' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'admittedConditional'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'admittedConditional')?.sortedUpsertLoopInfo?.[0]
      .iterationStep).toMatchObject({ kind: 'ternary' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('admits a descending constant-step counter domain over a public bound', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function fill(int n) public {
        for (int i = 5; i > n; i = i - 2) { this.m[i] = i + 10; }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'fill')?.eligible).toBe(true);
    expect(artifact.abi.find((candidate) => candidate.name === 'fill')?.inputs).toContainEqual(
      expect.objectContaining({
        name: expect.stringMatching(/^__internal__vmapCounterPerm_n_\d+_from_p5_step_n2$/),
        type: 'int256[]',
      }),
    );
  });

  it('preserves an unsigned counter type in the permutation and proof', () => {
    const artifact = compileString(`contract C() {
      mapping(uint => uint) m;
      function fill(uint n) public {
        for (uint i = 0; i < n; i = i + 1) { this.m[i] = i + 10; }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'fill'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'fill')?.inputs).toContainEqual(
      expect.objectContaining({ name: expect.stringMatching(/^__internal__vmapCounterPerm_/), type: 'uint256[]' }),
    );
  });

  it('admits a value-returning early exit as an exact terminated counter-loop domain', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function denied(int n) public returns (int) {
        for (int i = 0; i < n; i = i + 1) {
          if (i == 2) return i;
          this.m[i] = i;
        }
        require(true);
        return n;
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'denied')?.sortedUpsertLoopInfo?.[0]
      .iterationBreakCondition).toMatchObject({ kind: 'binary', operator: '==' });
  });

  it('admits a void early return as an exact terminated counter-loop domain', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function write(int n, int stop) public {
        for (int i = 0; i < n; i = i + 1) {
          this.m[i] = i;
          if (i == stop) return;
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo?.[0]
      .iterationBreakCondition).toMatchObject({ kind: 'binary', operator: '==' });
  });

  it('admits an immutable loop-local value alias by expanding it onto the logical permutation', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) a;
      function fill(int n) public {
        for (int i = 0; i < n; i = i + 1) { int value = i + 10; this.a[i] = value; }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'fill')?.eligible).toBe(true);
    expect(artifact.abi.find((handler) => handler.name === 'fill')?.inputs.some((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))).toBe(true);
  });

  it('keeps a fixed read from another mapping on its ordinary authenticated witness', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) a;
      mapping(int => int) b;
      function fill(int n) public {
        for (int i = 0; i < n; i = i + 1) { this.a[i] = this.b[0]; }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'fill');
    expect(handler).toMatchObject({ eligible: true });
    expect(artifact.abi.find((candidate) => candidate.name === 'fill')?.inputs.some((input) =>
      input.name.startsWith('__internal__vmapCounterOld_'))).toBe(false);
  });

  it('admits an affine loop-carried scalar state mapping value', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) a;
      int total;
      function write(int n) public {
        for (int i = 0; i < n; i = i + 1) {
          this.total = this.total + 1;
          this.a[i] = this.total;
        }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
  });

  it('admits an immutable parameter as an affine scalar-state delta', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) a; int total;
      function write(int n, int amount) public {
        for (int i = 0; i < n; i = i + 1) {
          this.total = this.total + amount;
          this.a[i] = this.total;
        }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
  });

  it('publishes canonical counter-loop read metadata but fences its unpublished carrier', () => {
    const statement = 'this.a[i] = this.b[i];';
    const artifact = compileString(`contract C() {
      mapping(int => int) a;
      mapping(int => int) b;
      int total;
      function denied(int n) public {
        int running = 0;
        for (int i = 0; i < n; i = i + 1) { ${statement} }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    const streams = artifact.abi.find((handler) => handler.name === 'denied')?.sortedUpsertLoopInfo ?? [];
    expect(streams)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'b', op: 'read' }),
        expect.objectContaining({ collection: 'a', op: 'set' }),
      ]));
    expect(streams.find((stream) => stream.op === 'read')?.settlementIdentity).toEqual({
      accessStreamIndex: streams.find((stream) => stream.op === 'read')?.journalAccessStreamIndex,
      accessOrdinalSource: 'access-program-order',
      recordOrdinalScope: 'global-journal',
      recordOrdinalSources: ['target-record-ordinal', 'predecessor-record-ordinal'],
      settlementRole: 'carrier-only',
      settlementOwnership: 'none',
      recordDispositionSource: 'authenticated-carrier',
    });
    expect(streams.find((stream) => stream.op !== 'read')?.settlementIdentity).toEqual({
      accessStreamIndex: streams.find((stream) => stream.op !== 'read')?.journalAccessStreamIndex,
      accessOrdinalSource: 'access-program-order',
      recordOrdinalScope: 'global-journal',
      recordOrdinalSources: ['target-record-ordinal', 'predecessor-record-ordinal'],
      settlementRole: 'mutation-settlement',
      settlementOwnership: 'last-mutating-access',
      recordDispositionSource: 'mutation-settlement',
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it.each(['bool', 'fixed128x18', 'bytes20', 'pubkey'])(
    'publishes canonical counter-loop read metadata for %s but fences its unpublished carrier', (type) => {
      const artifact = compileString(`contract C() {
        mapping(int => ${type}) source;
        mapping(int => ${type}) destination;
        function copy(int n) public {
          for (int i = 0; i < n; i = i + 1) { this.destination[i] = this.source[i]; }
          require(true);
        }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'copy'))
        .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
      const read = artifact.abi.find((handler) => handler.name === 'copy')?.sortedUpsertLoopInfo
        ?.find((info) => info.collection === 'source');
      expect(read).toMatchObject({ op: 'read' });
      expect(artifact.abi.find((handler) => handler.name === 'copy')?.inputs)
        .toContainEqual(expect.objectContaining({ name: read!.oldValuesWitnessParam, type: `${type}[]` }));
    },
  );

  it.each(['address', 'datasig'])(
    'keeps unsupported fixed-width carrier value type %s fenced', (type) => {
      const artifact = compileString(`contract C() {
        mapping(int => ${type}) source;
        mapping(int => ${type}) destination;
        function copy(int n) public {
          for (int i = 0; i < n; i = i + 1) { this.destination[i] = this.source[i]; }
          require(true);
        }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'copy'))
        .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    },
  );

  it('authenticates several same-key foreign reads and nested invariant key prefixes', () => {
    const artifact = compileString(`contract C() {
      mapping(int => mapping(int => int)) left;
      mapping(int => mapping(int => int)) right;
      mapping(int => mapping(int => int)) destination;
      function combine(int account, int n) public {
        for (int i = 0; i < n; i = i + 1) {
          this.destination[account][i] = this.left[account][i] + this.right[account][i];
        }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'combine'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.abi.find((handler) => handler.name === 'combine')?.sortedUpsertLoopInfo)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'left', op: 'read', fixedKeyParams: ['account'] }),
        expect.objectContaining({ collection: 'right', op: 'read', fixedKeyParams: ['account'] }),
        expect.objectContaining({ collection: 'destination', op: 'set', fixedKeyParams: ['account'] }),
      ]));
  });

  it('authenticates a foreign counter read with an independent key domain', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) source;
      mapping(int => int) destination;
      function shifted(int n) public {
        for (int i = 0; i < n; i = i + 1) { this.destination[i] = this.source[i + 1]; }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'shifted'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    const streams = artifact.abi.find((handler) => handler.name === 'shifted')?.sortedUpsertLoopInfo ?? [];
    const source = streams.find((stream) => stream.collection === 'source');
    const destination = streams.find((stream) => stream.collection === 'destination');
    expect(source).toMatchObject({ op: 'read', varyingKeyExpressions: expect.any(Array) });
    expect(destination).toMatchObject({ op: 'set' });
    expect(source?.varyingArrayParam).not.toBe(destination?.varyingArrayParam);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it.each([
    ['dynamic bytes', 'bytes', ''],
    ['string', 'string', ''],
    ['struct', 'Rec', 'struct Rec { int left; bytes payload; }'],
    ['dynamic array', 'int[]', ''],
  ])('authenticates a shifted cross-mapping read of %s values', (_label, valueType, declaration) => {
    const artifact = compileString(`contract C() {
      ${declaration}
      mapping(int => ${valueType}) source;
      mapping(int => ${valueType}) destination;
      function shifted(int n) public {
        for (int i = 0; i < n; i = i + 1) {
          this.destination[i] = this.source[i + 1];
        }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'shifted'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    const streams = artifact.abi.find((handler) => handler.name === 'shifted')?.sortedUpsertLoopInfo ?? [];
    expect(streams.find((stream) => stream.collection === 'source')).toMatchObject({ op: 'read' });
    expect(streams.find((stream) => stream.collection === 'destination')).toMatchObject({ op: 'set' });
  });

  it('admits an affine loop-carried local mapping value', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) a;
      function write(int n) public {
        int running = 0;
        for (int i = 0; i < n; i = i + 1) { running = running + 1; this.a[i] = running; }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
  });

  it('admits an immutable parameter as an affine local delta', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) a;
      function write(int n, int amount) public {
        int running = 0;
        for (int i = 0; i < n; i = i + 1) {
          running = running + amount;
          this.a[i] = running;
        }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
  });

  it('admits a straight-line affine local recurrence with several constant updates', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) a;
      function write(int n) public {
        int running = 4;
        for (int i = 0; i < n; i = i + 1) {
          running = running + 3;
          running = running - 1;
          this.a[i] = running;
        }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
  });

  it('admits sequential counter loops over one collection and defers physical overlap to planning', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) a;
      function writeBoth(int left, int right) public {
        for (int i = 0; i < left; i = i + 1) { this.a[i] = 1; }
        for (int j = 10; j < right; j = j + 1) { this.a[j] = 2; }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'writeBoth')?.eligible).toBe(true);
    const inputs = artifact.abi.find((handler) => handler.name === 'writeBoth')!.inputs;
    expect(inputs.filter((input) => input.name.startsWith('__internal__vmapCounterPerm_'))).toHaveLength(2);
    expect(inputs.filter((input) => input.name === '__internal__vmapRuntimeInputCount_a')).toHaveLength(1);
    expect(inputs.filter((input) => input.name === '__internal__vmapRuntimeOutputCount_a')).toHaveLength(1);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('admits sequential counter loops over disjoint collections', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) a;
      mapping(int => int) b;
      function writeBoth(int left, int right) public {
        for (int i = 0; i < left; i = i + 1) { this.a[i] = i + 10; }
        for (int j = 2; j < right; j = j + 2) { this.b[j] = j + 20; }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeBoth');
    expect(handler?.eligible).toBe(true);
    expect(artifact.abi.find((candidate) => candidate.name === 'writeBoth')?.inputs.filter((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))).toHaveLength(2);
    expect(artifact.abi.find((candidate) => candidate.name === 'writeBoth')?.sortedUpsertLoopInfo?.map(
      (info) => info.collection,
    )).toEqual(['a', 'b']);
  });

  it('keeps an invariant mapping journal beside a counter-keyed physical loop', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) keyed;
      mapping(int => int) invariant;
      function denied(int n, int owner) public {
        for (int i = 0; i < n; i = i + 1) { this.keyed[i] = i; this.invariant[owner] = i; }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'denied')?.inputs.some((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))).toBe(true);
  });

  it('keeps a literal-key mapping journal beside a counter-keyed physical loop', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) keyed;
      mapping(int => int) totals;
      function write(int n) public {
        for (int i = 0; i < n; i = i + 1) { this.keyed[i] = i; this.totals[7] = i; }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
  });

  it('journals a computed invariant loop key beside a counter-keyed physical loop', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) keyed;
      mapping(bytes32 => int) totals;
      function write(int n, bytes owner) public {
        for (int i = 0; i < n; i = i + 1) { this.keyed[i] = i; this.totals[sha256(owner)] = i; }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.inputs.some((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('snapshots a computed loop key after a replayable parameter reassignment', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) keyed;
      mapping(bytes32 => int) totals;
      function denied(int n, bytes owner) public {
        owner = hex"01";
        for (int i = 0; i < n; i = i + 1) { this.keyed[i] = i; this.totals[sha256(owner)] = i; }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'denied')?.inputs.some((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('composes a self-dependent reassignment into an invariant loop key snapshot', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) keyed;
      mapping(int => int) totals;
      function write(int n, int owner) public {
        owner = owner + 5;
        for (int i = 0; i < n; i = i + 1) {
          this.keyed[i] = i;
          this.totals[owner] = i;
          this.totals[owner] = i + 100;
        }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.entryAccesses
      ?.filter((entry) => entry.collection === 'totals')).toHaveLength(1);
  });

  it('snapshots an invariant loop key after a finite conditional reassignment', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) keyed;
      mapping(int => int) totals;
      function write(int n, int owner, bool take) public {
        if (take) { owner = owner + 5; } else { owner = owner - 2; }
        for (int i = 0; i < n; i = i + 1) {
          this.keyed[i] = i;
          this.totals[owner] = i;
        }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.entryAccesses
      ?.filter((entry) => entry.collection === 'totals')).toHaveLength(1);
  });

  it('replays a local key-array write after a straight-line parameter reassignment', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function write(int n, int key) public {
        int[] xs = new int[](n);
        key = key + 1;
        xs[0] = key;
        for (int i = 0; i < n; i = i + 1) { this.slots[xs[i]] = 1; }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
  });

  it('freezes a serializable compound counter key combined with a repeated effect', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) keyed;
      function denied(int base, int n, bytes32 category, bytes recipient) public {
        for (int i = 0; i < n; i = i + 1) {
          this.keyed[base + i] = i;
          this.tokens[category].transfer(recipient, i + 1);
        }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('journals a nested invariant entry beside a counter-keyed physical loop', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) keyed;
      mapping(int => mapping(bytes32 => int)) totals;
      function write(int n, int group, bytes owner) public {
        for (int i = 0; i < n; i = i + 1) {
          this.keyed[i] = i;
          this.totals[group][sha256(owner)] = i;
        }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.entryAccesses)
      .toContainEqual(expect.objectContaining({
        collection: 'totals', operations: ['read', 'write'],
      }));
  });

  it('freezes independent permutations across collections with different invariant key prefixes', () => {
    const artifact = compileString(`contract C() {
      mapping(int => mapping(int => int)) a;
      mapping(int => mapping(int => int)) b;
      function write(int n, int left, int right) public {
        for (int i = 0; i < n; i = i + 1) { this.a[left][i] = 1; this.b[right][i] = 2; }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.inputs.filter((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))).toHaveLength(2);
    expect(new Set(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo
      ?.map((info) => info.varyingArrayParam)).size).toBe(2);
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo
      ?.map((info) => info.journalAccessStreamIndex)).toEqual([0, 1]);
  });

  it('publishes journal streams independently of contract, collection, and function names', () => {
    const compileRenamed = (
      contract: string, first: string, second: string, operation: string,
    ): ReturnType<typeof compileString> => compileString(`
      contract ${contract}() {
        mapping(int => mapping(int => int)) ${first};
        mapping(int => mapping(int => int)) ${second};
        function ${operation}(int n, int left, int right) public {
          for (int cursor = 0; cursor < n; cursor = cursor + 1) {
            this.${first}[left][cursor] = 1;
            this.${second}[right][cursor] = 2;
          }
          require(true);
        }
      }
    `, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const streamShape = (
      artifact: ReturnType<typeof compileString>, operation: string,
    ): { handlerWitness?: string; routeWitness?: string; ordinals?: number[]; identities?: unknown[] } => ({
      handlerWitness: artifact.abi.find((candidate) => candidate.name === operation)?.inputs
        .find((input) => input.name === '__internal__kernelJournalAccessStreams')?.type,
      routeWitness: artifact.messageBus?.route.inputs
        .find((input) => input.name === '__internal__kernelJournalAccessStreams')?.type,
      ordinals: artifact.abi.find((candidate) => candidate.name === operation)?.sortedUpsertLoopInfo
        ?.map((info) => info.journalAccessStreamIndex),
      identities: artifact.abi.find((candidate) => candidate.name === operation)?.sortedUpsertLoopInfo
        ?.map((info) => info.settlementIdentity),
    });
    const ledger = compileRenamed('Ledger', 'credits', 'debits', 'reconcile');
    const registry = compileRenamed('Registry', 'primary', 'secondary', 'apply');

    expect(ledger.messageBus?.handlers.find((handler) => handler.name === 'reconcile'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(registry.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(streamShape(ledger, 'reconcile')).toEqual({
      handlerWitness: 'bytes[]', routeWitness: undefined, ordinals: [0, 1],
      identities: [0, 1].map((accessStreamIndex) => ({
        accessStreamIndex,
        accessOrdinalSource: 'access-program-order',
        recordOrdinalScope: 'global-journal',
        recordOrdinalSources: ['target-record-ordinal', 'predecessor-record-ordinal'],
        settlementRole: 'mutation-settlement',
        settlementOwnership: 'last-mutating-access',
        recordDispositionSource: 'mutation-settlement',
      })),
    });
    expect(streamShape(registry, 'apply')).toEqual(streamShape(ledger, 'reconcile'));
  });

  it('freezes independent nested-prefix permutations for selected subsets across collections', () => {
    const artifact = compileString(`contract C() {
      mapping(int => mapping(int => int)) a;
      mapping(int => mapping(int => int)) b;
      function denied(int n, int left, int right) public {
        for (int i = 0; i < n; i = i + 1) {
          if (i % 2 == 0) this.a[left][i] = 1;
          if (i % 2 != 0) this.b[right][i] = 2;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    const write = artifact.abi.find((handler) => handler.name === 'denied');
    expect(write?.inputs.filter((input) => input.name.startsWith('__internal__vmapCounterPerm_'))).toHaveLength(2);
    expect(new Set(write?.sortedUpsertLoopInfo?.map((info) => info.varyingArrayParam)).size).toBe(2);
    const conditions = write?.sortedUpsertLoopInfo?.map((info) => info.iterationCondition);
    expect(conditions).toHaveLength(2);
    expect(conditions?.[0]).not.toEqual(conditions?.[1]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('uses one authenticated logical value in every direct counter-key component', () => {
    const artifact = compileString(`contract C() {
      mapping(int => mapping(int => mapping(int => int))) nested;
      function write(int scope, int n) public {
        for (int i = 0; i < n; i = i + 1) { this.nested[i][scope][i] = i + 10; }
        require(true);
      }
      function transform(int scope, int n) public {
        for (int i = 0; i < n; i = i + 1) {
          this.nested[i][scope][i] = max(
            this.nested[i][scope][i] * 2,
            this.nested[i][scope][i] + i + 5
          );
        }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const write = artifact.abi.find((handler) => handler.name === 'write');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(write?.inputs.filter((input) => input.name.startsWith('__internal__vmapCounterPerm_'))).toHaveLength(1);
    expect(write?.sortedUpsertLoopInfo).toEqual([
      expect.objectContaining({ varyingKeyIndices: [0, 2] }),
    ]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'transform'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'transform')?.sortedUpsertLoopInfo).toEqual([
      expect.objectContaining({ varyingKeyIndices: [0, 2], valueRuntimeExpression: true }),
    ]);
  });

  it('publishes complete key recipes for counter-derived composite components', () => {
    const artifact = compileString(`contract C() {
      mapping(int => mapping(int => int)) nested;
      function write(int n) public {
        for (int i = 0; i < n; i = i + 1) { this.nested[i + 1][i] = i + 10; }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo).toEqual([
      expect.objectContaining({
        varyingKeyExpressions: [
          expect.objectContaining({ kind: 'binary', operator: '+' }),
          expect.objectContaining({ kind: 'source', source: expect.objectContaining({ kind: 'loopIndex' }) }),
        ],
      }),
    ]);
  });

  it('publishes a closed predicate for a toggled loop-carried local guard', () => {
    const body = `bool take = true;
      for (int i = 0; i < n; i = i + 1) {
        if (take) this.m[i] = i;
        take = !take;
      }`;
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      mapping(int => mapping(int => int)) nested;
      function write(int n) public { ${body} require(true); }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo?.[0]
      .iterationCondition).toMatchObject({ kind: 'ternary' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('publishes a counter-derived loop-carried local guard', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function denied(int n) public {
        bool take = true;
        for (int i = 0; i < n; i = i + 1) {
          if (take) this.m[i] = i;
          take = i % 3 == 0;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'denied')?.sortedUpsertLoopInfo?.[0]
      .iterationCondition).toMatchObject({ kind: 'ternary' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('fences a counter-derived selection local assigned before its guarded write', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function write(int n) public {
        bool take = false;
        for (int i = 0; i < n; i = i + 1) {
          take = i % 3 == 0;
          if (take) this.m[i] = i;
          take = false;
        }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo?.[0])
      .toMatchObject({
        iterationCondition: { kind: 'binary', operator: '==' },
        sameIterationMutableSelectionReplay: true,
      });
  });

  it('replays an exhaustive conditional local assignment as a mapping value and guard', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function write(int n, int base) public {
        int next = 0;
        bool take = false;
        for (int i = 0; i < n; i = i + 1) {
          if (i % 2 == 0) { next = base + i; take = true; }
          else { next = base + 10 + i; take = false; }
          if (take) this.m[i] = next;
        }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    const info = artifact.abi.find((candidate) => candidate.name === 'write')?.sortedUpsertLoopInfo?.[0];
    expect(info?.iterationCondition).toMatchObject({ kind: 'ternary' });
    expect(info?.valueRuntimeExpression).toBe(true);
  });

  it('recursively replays exhaustive nested conditional local assignments', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function write(int n, int base) public {
        int next = 0;
        bool take = false;
        for (int i = 0; i < n; i = i + 1) {
          if (i % 2 == 0) {
            if (i % 4 == 0) { next = base + i; take = true; }
            else { next = base + 20 + i; take = false; }
          } else { next = base + 10 + i; take = true; }
          if (take) this.m[i] = next;
        }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    const info = artifact.abi.find((candidate) => candidate.name === 'write')?.sortedUpsertLoopInfo?.[0];
    expect(info?.iterationCondition).toMatchObject({ kind: 'ternary' });
    expect(info?.valueRuntimeExpression).toBe(true);
  });

  it('replays exhaustive switch local assignments as mapping values and guards', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function write(int n, int base) public {
        int next = 0;
        bool take = false;
        for (int i = 0; i < n; i = i + 1) {
          switch (i % 3) {
            case 0: next = base + i; take = true; break;
            case 1: next = base + 10 + i; take = false; break;
            default: next = base + 20 + i; take = true; break;
          }
          if (take) this.m[i] = next;
        }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    const info = artifact.abi.find((candidate) => candidate.name === 'write')?.sortedUpsertLoopInfo?.[0];
    expect(info?.iterationCondition).toMatchObject({
      kind: 'binary', operator: '&&', right: { kind: 'ternary' },
    });
    expect(info?.valueRuntimeExpression).toBe(true);
  });

  it.each([
    ['an incomplete conditional local assignment', `
      if (i % 2 == 0) { next = base + i; }
    `],
    ['a self-dependent conditional local assignment', `
      if (i % 2 == 0) { next = next + 1; }
      else { next = base + i; }
    `],
  ])('authenticates %s through a source-order value trace', (_label, update) => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function denied(int n, int base) public {
        int next = 0;
        for (int i = 0; i < n; i = i + 1) {
          ${update}
          this.m[i] = next;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'denied')?.sortedUpsertLoopInfo?.[0])
      .toMatchObject({
        valueTraceWitnessParam: expect.stringMatching(/^__internal__vmapCounterValue_/),
        valueTraceLocal: 'next',
        valueTraceInitial: { kind: 'literal', type: 'bigint', value: '0' },
        valueTraceUpdates: expect.any(Array),
      });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('authenticates a loop-carried value at a conditionally selected mapping write', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function write(int n) public {
        int next = 1;
        for (int i = 0; i < n; i = i + 1) {
          if (i % 2 == 0) { next = next + 2; }
          if (i % 3 != 0) { this.m[i] = next; }
        }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo?.[0])
      .toMatchObject({
        iterationCondition: expect.anything(),
        valueTraceWitnessParam: expect.stringMatching(/^__internal__vmapCounterValue_/),
        valueTraceLocal: 'next',
      });
  });

  it('freezes a mutable selection observed on both sides of its same-iteration assignment', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) left;
      mapping(int => int) right;
      function denied(int n) public {
        bool take = true;
        for (int i = 0; i < n; i = i + 1) {
          if (take) this.left[i] = i;
          take = i % 3 == 0;
          if (take) this.right[i] = i;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    const conditions = artifact.abi.find((handler) => handler.name === 'denied')?.sortedUpsertLoopInfo
      ?.map((info) => info.iterationCondition);
    expect(conditions).toHaveLength(2);
    expect(conditions?.[0]).not.toEqual(conditions?.[1]);
    expect(artifact.abi.find((handler) => handler.name === 'denied')?.sortedUpsertLoopInfo)
      .toContainEqual(expect.objectContaining({ sameIterationMutableSelectionReplay: true }));
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')
      ?.eligible).toBe(true);
  });

  it('admits source-replayed scalar values split across two mutation streams', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) beforeValues;
      mapping(int => int) afterValues;
      function write(int n) public {
        int next = 5;
        for (int i = 0; i < n; i = i + 1) {
          this.beforeValues[i] = next;
          next = i + 60;
          this.afterValues[i] = next;
        }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo)
      .toHaveLength(2);
  });

  it('freezes site-specific event predicates beside runtime collection mutations', () => {
    const artifact = compileString(`event Phase(int value);
      contract C() {
        mapping(int => int) beforeValues;
        mapping(int => int) afterValues;
        function write(int n) public {
          bool take = true;
          for (int i = 0; i < n; i = i + 1) {
            if (take) { this.beforeValues[i] = i; emit Phase(i); }
            take = i % 3 == 0;
            if (take) { this.afterValues[i] = i; emit Phase(i + 100); }
          }
          require(true);
        }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('fences chunked parameter-value event settlement while retaining scalar values', () => {
    const artifact = compileString(`event Applied(int key);
      contract C() {
        mapping(int => bytes) chunked;
        mapping(int => int) scalar;
        function writeChunked(int[] keys, bytes[] values) public {
          for (int i = 0; i < keys.length; i = i + 1) {
            this.chunked[keys[i]] = values[i]; emit Applied(keys[i]);
          }
          require(true);
        }
        function writeScalar(int[] keys, int[] values) public {
          for (int i = 0; i < keys.length; i = i + 1) {
            this.scalar[keys[i]] = values[i]; emit Applied(keys[i]);
          }
          require(true);
        }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.abi.find((handler) => handler.name === 'writeChunked')?.sortedUpsertLoopInfo)
      .toContainEqual(expect.objectContaining({
        collection: 'chunked', valueArrayParam: 'values', valueArrayIndexParam: expect.any(String),
      }));
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'writeChunked'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'writeScalar'))
      .toMatchObject({ eligible: true });
  });

  it('freezes site-specific transfer predicates beside runtime collection mutations', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) beforeValues;
      mapping(int => int) afterValues;
      function write(int n, bytes to) public {
        bool take = true;
        for (int i = 0; i < n; i = i + 1) {
          if (take) { this.beforeValues[i] = i; this.transfer(to, 1); }
          take = i % 3 == 0;
          if (take) { this.afterValues[i] = i; this.transfer(to, 1); }
        }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('freezes a write and row effect whose fallthrough combines differently phased break predicates', () => {
    const artifact = compileString(`event Reached(int value);
      contract C() {
      mapping(int => int) values;
      function write(int n) public {
        bool stop = false;
        for (int i = 0; i < n; i = i + 1) {
          if (stop) break;
          stop = i == 2;
          if (stop) break;
          this.values[i] = i;
          emit Reached(i);
        }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('freezes a transfer and collection write after differently phased break predicates', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function write(int n, bytes to) public {
        bool stop = false;
        for (int i = 0; i < n; i = i + 1) {
          if (stop) break;
          stop = i == 2;
          if (stop) break;
          this.values[i] = i;
          this.transfer(to, 1);
        }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'write');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('admits a public enum getter encoded as int', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      enum Status { A, B }
      contract C {
        Status public last;
        function denied() public { last = Status.B; require(true); }
        function control() public { require(true); }
      }`, { ...KERNEL, solidityImportCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'last')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it.each(['fixed128x18', 'ufixed128x18'])(
    'captures a %s result through the recursive ABI encoder', (type) => {
      const artifact = compileString(`pragma solidity ^0.8.0;
        contract C {
          function echo(${type} value) public pure returns (${type}) { return value; }
          function control() public { require(true); }
        }`, { ...KERNEL, solidityImportCompat: true });
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'echo'))
        .toMatchObject({ eligible: true });
    },
  );

  it('captures fixed-point arrays and struct fields through the recursive ABI encoder', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract C {
        struct Quote { fixed128x18 bid; ufixed128x18 ask; }
        function echoArray(fixed128x18[] calldata values)
          public pure returns (fixed128x18[] memory) { return values; }
        function echoQuote(Quote calldata value) public pure returns (Quote memory) { return value; }
        function control() public { require(true); }
      }`, { ...KERNEL, solidityImportCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'echoArray'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'echoQuote'))
      .toMatchObject({ eligible: true });
  });

  it.each(['pubkey', 'datasig'])(
    'captures a native %s result through compact ABI framing', (type) => {
      const artifact = compileString(`contract C() {
        function echo(${type} value) public pure returns (${type}) { return value; }
        function control() public { require(true); }
      }`, KERNEL);
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'echo'))
        .toMatchObject({ eligible: true });
    },
  );

  it('captures a data-only transaction-signature result through compact ABI framing', () => {
    const artifact = compileString(`contract C() {
      function echo(bytes value) public pure returns (sig) { return sig(value); }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'echo'))
      .toMatchObject({ eligible: true, outputs: [{ type: 'sig' }] });
  });

  it('separates an authenticated data-only sig result from an unrelated transaction-signature witness', () => {
    const artifact = compileString(`contract C() {
      function data(sig witness, bytes value) public pure returns (sig) { return sig(value); }
      function dataSig(sig witness, bytes value) public pure returns (datasig) { return datasig(value); }
      function circular(sig witness) public pure returns (sig) { return witness; }
      function aliased(sig witness, bytes value) public pure returns (sig) {
        sig result = sig(value);
        return result;
      }
      function checked(sig witness, bytes value, pubkey key) public pure returns (sig) {
        require(checkSig(witness, key));
        return sig(value);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'data'))
      .toMatchObject({ eligible: true, outputs: [{ type: 'sig' }] });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'dataSig'))
      .toMatchObject({ eligible: true, outputs: [{ type: 'datasig' }] });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'aliased'))
      .toMatchObject({ eligible: true, outputs: [{ type: 'sig' }] });
    for (const name of ['circular', 'checked']) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === name)).toMatchObject({
        eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE',
      });
    }
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('admits a directly authenticated unbounded Rec[] state result without demoting control', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Rec { uint x; }
      contract C {
        Rec[] records;
        function denied() public view returns (Rec[] memory) { return records; }
        function control() public { require(true); }
      }`, { ...KERNEL, solidityImportCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: true, outputs: [{ type: 'Rec[]' }] });
    expect(artifact.abi.find((handler) => handler.name === 'denied')?.dynamicReads).toEqual(['records']);
    expect(artifact.messageBus?.route.dynamicReads).toEqual(['records']);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('captures an enum[] result through unsigned ABI words', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      enum Status { A, B }
      contract C {
        function denied() public pure returns (Status[] memory) {
          Status[] memory values = new Status[](2);
          values[0] = Status.A;
          values[1] = Status.B;
          return values;
        }
        function control() public { require(true); }
      }`, { ...KERNEL, solidityImportCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('admits Solidity address.transfer through a typed fixed-effect descriptor', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract C {
        function denied(address payable to) public { to.transfer(1); require(true); }
        function control() public { require(true); }
      }`, { ...KERNEL, solidityImportCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: true,
      transfers: [{
        transferIndex: 0,
        recipientRecipe: { kind: 'handlerInput', inputIndex: 0 },
        amountRecipe: { kind: 'intLiteral', value: '1' },
      }],
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('admits Solidity address.send through a typed fixed-effect descriptor', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract C {
        function denied(address payable to) public { require(to.send(1)); }
        function control() public { require(true); }
      }`, { ...KERNEL, solidityImportCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: true,
      transfers: [{
        transferIndex: 0,
        recipientRecipe: { kind: 'handlerInput', inputIndex: 0 },
        amountRecipe: { kind: 'intLiteral', value: '1' },
      }],
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('admits if/else this.transfer', () => {
    const artifact = compileString(`contract C() {
      function denied(bool p, bytes a, bytes b) public {
        if (p) this.transfer(a, 1); else this.transfer(b, 1);
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.transfers).toEqual([
      expect.objectContaining({
        transferIndex: 0,
        recipient: { kind: 'forward', paramIndex: 1 },
        condition: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
      }),
      expect.objectContaining({
        transferIndex: 0,
        recipient: { kind: 'forward', paramIndex: 2 },
        condition: {
          kind: 'unary', operator: '!',
          expression: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
        },
      }),
    ]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('publishes name-neutral fixed recipes for Solidity address transfer forms', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract C {
        function pay(bool useSend, address payable to, uint amount) public {
          if (useSend) require(to.send(amount)); else to.transfer(amount);
          require(true);
        }
      }`, { ...KERNEL, solidityImportCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pay')?.eligible).toBe(true);
    expect(artifact.abi.find((handler) => handler.name === 'pay')?.transfers).toEqual([
      expect.objectContaining({
        transferIndex: 0, recipient: { kind: 'forward', paramIndex: 1 },
        recipientRecipe: { kind: 'handlerInput', inputIndex: 1 },
        amountRecipe: { kind: 'handlerInput', inputIndex: 2 },
      }),
      expect.objectContaining({
        transferIndex: 0, recipient: { kind: 'forward', paramIndex: 1 },
        recipientRecipe: { kind: 'handlerInput', inputIndex: 1 },
        amountRecipe: { kind: 'handlerInput', inputIndex: 2 },
      }),
    ]);
  });

  it('reserves a conditional graph BCH transfer as a balanced false-path slot', () => {
    const artifact = compileString(`contract C() {
      int calls;
      function pay(bool take, bytes recipient, int amount) public {
        if (take) { this.transfer(recipient, amount); }
        this.calls = this.calls + 1;
        require(true);
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay');
    expect(handler).toMatchObject({
      eligible: true,
      transfers: [{
        transferIndex: 0,
        recipient: { kind: 'forward', paramIndex: 1 },
        amount: { kind: 'forward', paramIndex: 2 },
      }],
    });
    const direct = artifact.abi.find((candidate) => candidate.name === 'pay');
    expect(direct?.blockLayout?.slots.filter((slot) => slot.kind === 'transfer')).toEqual([
      expect.objectContaining({ slotIndex: 0, conditional: true }),
    ]);
  });

  it('replays a fixed transfer predicate from an exact dominating scalar state write', () => {
    const artifact = compileString(`contract C() {
      bool enabled;
      function pay(bytes recipient, int amount) public {
        this.enabled = true;
        if (this.enabled) this.transfer(recipient, amount);
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay')).toMatchObject({
      eligible: true,
      transfers: [{ condition: { kind: 'literal', value: true } }],
    });
    expect(artifact.abi.find((candidate) => candidate.name === 'pay')?.transfers).toEqual([
      expect.objectContaining({ transferIndex: 0, condition: expect.anything() }),
    ]);
  });

  it('invalidates a fixed transfer state recipe across an outlined scalar-state helper', () => {
    const artifact = compileString(`contract C() {
      bool enabled;
      function disable() internal { this.enabled = false; }
      function pay(bool take, bytes recipient, int amount) public {
        this.enabled = take;
        disable();
        if (this.enabled) this.transfer(recipient, amount);
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay')).toMatchObject({
      eligible: false, rejectionReason: 'KERNEL_LAYOUT',
    });
    expect(artifact.abi.find((candidate) => candidate.name === 'pay')?.transfers?.[0])
      .toMatchObject({ condition: null });
  });

  it('normalizes enum handler inputs in scalar-state fixed transfer recipes', () => {
    const artifact = compileString(`contract C() {
      enum Choice { A, B }
      int quantity;
      function pay(Choice choice, bytes recipient) public {
        this.quantity = int(choice);
        this.transfer(recipient, this.quantity);
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay')).toMatchObject({
      eligible: true,
      transfers: [{
        amountRecipe: {
          kind: 'cast', resultType: 'int256',
          operand: { kind: 'handlerInput', inputIndex: 0, resultType: 'bigint' },
        },
      }],
    });
  });

  it('replays fixed transfer operands assigned to scalar state in every finite branch arm', () => {
    const artifact = compileString(`contract C() {
      address destination;
      int quantity;
      function pay(bool alternate, address first, address second, int base) public {
        if (alternate) { this.destination = second; this.quantity = base + 1; }
        else { this.destination = first; this.quantity = base; }
        this.transfer(this.destination, this.quantity);
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay')).toMatchObject({
      eligible: true,
      transfers: [{
        recipientRecipe: { kind: 'conditional', resultType: 'address' },
        amountRecipe: { kind: 'conditional', resultType: 'int256' },
      }],
    });
  });

  it('replays scalar-state transfer operands assigned by an exhaustive finite switch', () => {
    const artifact = compileString(`contract C() {
      address destination;
      int quantity;
      function pay(int choice, address first, address second, int base) public {
        switch (choice) {
          case 1: this.destination = second; this.quantity = base + 1; break;
          default: this.destination = first; this.quantity = base; break;
        }
        this.transfer(this.destination, this.quantity);
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay')).toMatchObject({
      eligible: true,
      transfers: [{
        recipientRecipe: { kind: 'conditional', resultType: 'address' },
        amountRecipe: { kind: 'conditional', resultType: 'int256' },
      }],
    });
  });

  it.each([
    ['a loop-carried state write', 'while (repeat) { this.quantity = amount; }', 'this.quantity'],
  ])('keeps fixed transfer operands with %s fenced', (_label, setup, amountExpression) => {
    const artifact = compileString(`contract C() {
      int quantity;
      function pay(bool repeat, bytes recipient, int amount) public {
        ${setup}
        this.transfer(recipient, ${amountExpression});
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay')).toMatchObject({
      eligible: false, rejectionReason: 'KERNEL_LAYOUT',
    });
  });

  it('replays direct authenticated pre-state transfer operands before any source-ordered write', () => {
    const artifact = compileString(`contract C() {
      address destination;
      int quantity;
      function pay() public {
        this.transfer(this.destination, this.quantity);
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay')).toMatchObject({
      eligible: true,
      transfers: [{
        recipientRecipe: { kind: 'state', name: 'destination', resultType: 'address' },
        amountRecipe: { kind: 'state', name: 'quantity', resultType: 'int256' },
      }],
    });
  });

  it('selects a fixed transfer recipe helper by its exact overload signature', () => {
    const artifact = compileString(`contract C() {
      int marker;
      function quote(bytes20 digest) internal pure returns (int) { return 2000; }
      function quote(bytes32 digest) internal pure returns (int) { return 4000; }
      function pay(bytes seed) public {
        this.transfer(bytes(sha256(seed)), uint(quote(hash160(seed))));
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay')).toMatchObject({
      eligible: true,
    });
  });

  it.each([
    ['transaction-signature hash',
      'function quote(bytes20 digest) internal pure returns (int) { return int(digest) % 1000 + 2000; }',
      'this.transfer(recipient, quote(hash160(bytes(secret))));', 'sig secret'],
    ['transaction-derived resolved overload',
      'function quote(bytes20 digest) internal returns (int) { return tx.locktime + int(digest); } '
        + 'function quote(bytes32 digest) internal pure returns (int) { return 3000; }',
      'this.transfer(recipient, quote(hash160(secret)));', 'bytes secret'],
  ])('keeps %s outside fixed transfer recipes', (_label, helpers, effect, parameter) => {
    const artifact = compileString(`contract C() {
      int marker;
      ${helpers}
      function pay(bytes recipient, ${parameter}) public {
        ${effect}
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay')).toMatchObject({
      eligible: false, rejectionReason: 'KERNEL_LAYOUT',
    });
  });

  it('does not reuse authenticated pre-state after an unreplayable source-ordered write', () => {
    const artifact = compileString(`contract C() {
      int quantity;
      function pay(bytes recipient) public {
        this.quantity = tx.locktime;
        this.transfer(recipient, this.quantity);
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay')).toMatchObject({
      eligible: false, rejectionReason: 'KERNEL_LAYOUT',
    });
    expect(artifact.abi.find((candidate) => candidate.name === 'pay')?.transfers?.[0])
      .not.toHaveProperty('amountRecipe');
  });

  it('replays a fixed transfer predicate through dominating mutable local aliases', () => {
    const artifact = compileString(`contract C() {
      function pay(bool take, bytes recipient, int amount) public {
        bool selected = take;
        selected = !selected;
        if (selected) this.transfer(recipient, amount);
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay')).toMatchObject({
      eligible: true,
      transfers: [{ condition: {
        kind: 'unary', operator: '!', expression: {
          kind: 'source', source: { kind: 'forward', paramIndex: 0 },
        },
      } }],
    });
    expect(artifact.abi.find((candidate) => candidate.name === 'pay')?.transfers).toEqual([
      expect.objectContaining({ transferIndex: 0, condition: expect.anything() }),
    ]);
  });

  it('replays a fixed transfer predicate through a state-independent partial branch join', () => {
    const artifact = compileString(`contract C() {
      function pay(bool take, bool change, bytes recipient, int amount) public {
        bool selected = take;
        if (change) { selected = !selected; }
        if (selected) this.transfer(recipient, amount);
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay')).toMatchObject({
      eligible: true,
      transfers: [{ condition: {
        kind: 'ternary',
        condition: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
      } }],
    });
    expect(artifact.abi.find((candidate) => candidate.name === 'pay')?.transfers).toEqual([
      expect.objectContaining({ transferIndex: 0, condition: expect.anything() }),
    ]);
  });

  it('publishes typed conditional recipes for fixed transfer recipient and amount joins', () => {
    const artifact = compileString(`contract C() {
      function pay(bool alternate, bytes first, bytes second, int base) public {
        bytes recipient = first;
        int amount = base;
        if (alternate) { recipient = second; amount = base + 7; }
        this.transfer(recipient, amount);
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay')).toMatchObject({
      eligible: true,
      transfers: [{
        recipientRecipe: {
          kind: 'conditional', resultType: 'bytes',
          condition: { kind: 'handlerInput', inputIndex: 0 },
          ifTrue: { kind: 'handlerInput', inputIndex: 2 },
          ifFalse: { kind: 'handlerInput', inputIndex: 1 },
        },
        amountRecipe: {
          kind: 'conditional', resultType: 'int256',
          condition: { kind: 'handlerInput', inputIndex: 0 },
          ifTrue: { kind: 'cast', operand: { kind: 'binary', operator: '+' } },
          ifFalse: { kind: 'handlerInput', inputIndex: 3 },
        },
      }],
    });
  });

  it('keeps only the reachable branch environment and predicate after return or revert', () => {
    const artifact = compileString(`contract C() {
      function afterReturn(bool stop, bytes first, bytes second, int amount) public returns (int) {
        bytes recipient = first;
        if (stop) { recipient = bytes.concat(first, second); return 7; }
        this.transfer(recipient, amount);
        return 9;
      }
      function afterRevert(bool stop, bytes first, bytes second, int amount) public {
        bytes recipient = first;
        if (stop) { recipient = bytes.concat(first, second); revert("stopped"); }
        this.transfer(recipient, amount);
        require(true);
      }
    }`, KERNEL);
    for (const name of ['afterReturn', 'afterRevert']) {
      expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === name)).toMatchObject({
        eligible: true,
        transfers: [{
          recipientRecipe: { kind: 'handlerInput', inputIndex: 1 },
          amountRecipe: { kind: 'handlerInput', inputIndex: 3 },
          condition: {
            kind: 'unary', operator: '!',
            expression: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
          },
        }],
      });
    }
  });

  it('joins only fallthrough switch arms after a terminating case', () => {
    const artifact = compileString(`contract C() {
      function pay(int choice, bytes first, bytes second, int amount) public {
        bytes recipient = first;
        switch (choice) {
          case 1: recipient = bytes.concat(first, second); revert("stopped");
          case 2: recipient = second; break;
          default: break;
        }
        this.transfer(recipient, amount);
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay')).toMatchObject({
      eligible: true,
      transfers: [{
        recipientRecipe: { kind: 'conditional', resultType: 'bytes' },
        amountRecipe: { kind: 'handlerInput', inputIndex: 3 },
        condition: { kind: 'binary', operator: '||' },
      }],
    });
  });

  it('authenticates reachability through a pre-state terminating guard', () => {
    const artifact = compileString(`contract C() {
      bool stopped;
      function pay(bytes recipient, int amount) public returns (int) {
        if (this.stopped) return 7;
        this.transfer(recipient, amount);
        return 9;
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay')).toMatchObject({
      eligible: true,
      transfers: [{
        condition: {
          kind: 'unary', operator: '!', expression: { kind: 'state', name: 'stopped' },
        },
      }],
    });
    expect(artifact.abi.find((candidate) => candidate.name === 'pay')?.transfers?.[0])
      .toMatchObject({
        condition: {
          kind: 'unary', operator: '!', expression: { kind: 'state', name: 'stopped' },
        },
      });
  });

  it('does not claim reachability through a transaction-derived terminating guard', () => {
    const artifact = compileString(`contract C() {
      function pay(bytes recipient, int amount) public returns (int) {
        if (tx.locktime > 0) return 7;
        this.transfer(recipient, amount);
        return 9;
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay')).toMatchObject({
      eligible: false, rejectionReason: 'KERNEL_LAYOUT',
    });
    expect(artifact.abi.find((candidate) => candidate.name === 'pay')?.transfers?.[0])
      .toMatchObject({ condition: null });
  });

  it('refines a later fixed transfer by a replayable successful require path', () => {
    const artifact = compileString(`contract C() {
      function pay(bool enabled, bool alternate, bytes first, bytes second, int amount) public {
        bytes recipient = first;
        if (alternate) recipient = second;
        require(enabled);
        this.transfer(recipient, amount);
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay')).toMatchObject({
      eligible: true,
      transfers: [{
        recipientRecipe: { kind: 'conditional', resultType: 'bytes' },
        amountRecipe: { kind: 'handlerInput', inputIndex: 4 },
        condition: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
      }],
    });
  });

  it('replays a direct authenticated pre-state predicate through a require path', () => {
    const artifact = compileString(`contract C() {
      bool enabled;
      function pay(bytes recipient, int amount) public {
        require(this.enabled);
        this.transfer(recipient, amount);
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay')).toMatchObject({
      eligible: true, transfers: [{ condition: { kind: 'state', name: 'enabled' } }],
    });
    expect(artifact.abi.find((candidate) => candidate.name === 'pay')?.transfers?.[0])
      .toMatchObject({ condition: { kind: 'state', name: 'enabled' } });
  });

  it.each([
    ['a state-derived arm', 'recipient = this.destination;', 'bytes destination;'],
    ['a concat arm', 'recipient = bytes.concat(first, second);', ''],
  ])('classifies fixed transfer joins with %s', (_label, arm, state) => {
    const artifact = compileString(`contract C() {
      ${state}
      function pay(bool alternate, bytes first, bytes second, int amount) public {
        bytes recipient = first;
        if (alternate) { ${arm} }
        this.transfer(recipient, amount);
        require(true);
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay');
    if (_label === 'a concat arm') {
      expect(handler).toMatchObject({
        eligible: true,
        transfers: [{ recipientRecipe: { kind: 'conditional', ifTrue: { kind: 'concat' } } }],
      });
    } else {
      expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
      expect(artifact.abi.find((candidate) => candidate.name === 'pay')?.transfers?.[0])
        .not.toHaveProperty('recipientRecipe');
    }
  });

  it('publishes typed conditional recipes for finite switch joins', () => {
    const artifact = compileString(`contract C() {
      function pay(int choice, bool take, bytes first, bytes second, bytes third, int base) public {
        bool enabled = take;
        bytes recipient = first;
        int amount = base;
        switch (choice) {
          case 1: recipient = second; amount = base + 1; enabled = !take; break;
          case 2: recipient = third; amount = base + 2; enabled = true; break;
          default: break;
        }
        if (enabled) this.transfer(recipient, amount);
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay')).toMatchObject({
      eligible: true,
      transfers: [{
        recipientRecipe: { kind: 'conditional', ifFalse: { kind: 'conditional' } },
        amountRecipe: { kind: 'conditional', ifFalse: { kind: 'conditional' } },
        condition: { kind: 'ternary', ifFalse: { kind: 'ternary' } },
      }],
    });
  });

  it.each([
    ['a concat arm', 'case 1: recipient = bytes.concat(first, second); break;'],
    ['an ambiguous nested break', 'case 1: if (take) break; recipient = second; break;'],
  ])('classifies a fixed transfer switch join with %s', (_label, arm) => {
    const artifact = compileString(`contract C() {
      function pay(int choice, bool take, bytes first, bytes second, int amount) public {
        bytes recipient = first;
        switch (choice) { ${arm} default: break; }
        this.transfer(recipient, amount);
        require(true);
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay');
    if (_label === 'a concat arm') {
      expect(handler).toMatchObject({
        eligible: true,
        transfers: [{ recipientRecipe: { kind: 'conditional', ifTrue: { kind: 'concat' } } }],
      });
    } else expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('replays a fixed transfer predicate after an exact self-terminating local loop', () => {
    const source = `contract C() {
      function pay(bool take, bool change, bytes recipient, int amount) public {
        bool selected = take;
        while (change) { selected = !selected; change = false; }
        if (selected) this.transfer(recipient, amount);
        require(true);
      }
    }`;
    const artifact = compileString(source, { ...KERNEL, messageBusGraphContext: true });
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay')).toMatchObject({
      eligible: true,
      transfers: [{ condition: { kind: 'ternary' } }],
    });
    expect(artifact.abi.find((candidate) => candidate.name === 'pay')?.transfers).toEqual([
      expect.objectContaining({ transferIndex: 0, condition: expect.anything() }),
    ]);
    expect(compileStringMulti(source, KERNEL).C.messageBus?.handlers
      .find((candidate) => candidate.name === 'pay')).toMatchObject({ eligible: true });
  });

  it('keeps a conditionally self-clearing local loop outside fixed-effect replay', () => {
    const artifact = compileString(`contract C() {
      function pay(bool take, bool change, bool clear, bytes recipient, int amount) public {
        bool selected = take;
        while (change) { selected = !selected; if (clear) { change = false; } }
        if (selected) this.transfer(recipient, amount);
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay')).toMatchObject({
      eligible: false, rejectionReason: 'KERNEL_LAYOUT',
    });
  });

  it('replays fixed transfer operands after an exact self-terminating local loop', () => {
    const artifact = compileString(`contract C() {
      function pay(bool change, bytes first, bytes second, int base) public {
        bytes recipient = first;
        int amount = base;
        while (change) { recipient = second; amount = base + 7; change = false; }
        this.transfer(recipient, amount);
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'pay')).toMatchObject({
      eligible: true,
      transfers: [{
        recipientRecipe: { kind: 'conditional', resultType: 'bytes' },
        amountRecipe: { kind: 'conditional', resultType: 'int256' },
      }],
    });
  });

  it('admits heterogeneous graph BCH widths with a narrower conditional handler', () => {
    const artifact = compileString(`contract C() {
      int calls;
      function narrow(bool take, bytes recipient, int amount) public {
        if (take) { this.transfer(recipient, amount); }
        this.calls = this.calls + 1;
        require(true);
      }
      function wide(bytes first, bytes second, int amount) public {
        this.transfer(first, amount);
        this.transfer(second, amount);
        this.calls = this.calls + 1;
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'narrow'))
      .toMatchObject({ eligible: true, transfers: [{ transferIndex: 0 }] });
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'wide'))
      .toMatchObject({ eligible: true, transfers: [{ transferIndex: 0 }, { transferIndex: 1 }] });
  });

  it('admits address.transfer reached through an internal helper after typed inlining', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract C {
        function _pay(address payable sink) internal { sink.transfer(1); }
        function denied(address payable beneficiary) public { _pay(beneficiary); require(true); }
        function control() public { require(true); }
      }`, { ...KERNEL, solidityImportCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: true,
      transfers: [{
        recipientRecipe: { kind: 'handlerInput', inputIndex: 0 },
        amountRecipe: { kind: 'intLiteral', value: '1' },
      }],
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('admits a UDVT wrap as an expression-keyed mapping write', () => {
    const artifact = compileString(`type TokenId is bytes32;
      contract C() {
        mapping(TokenId => int) m;
        function denied(bytes32 raw) public {
          TokenId id = TokenId.wrap(raw);
          this.m[id] = 1;
          require(true);
        }
        function control() public { require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
  });

  it('admits a typed call with a struct-array argument', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Rec { uint x; address y; }
      interface I { function r(Rec[] memory xs) external; }
      contract C {
        address dest;
        function denied(Rec[] memory xs) public { I(dest).r(xs); require(true); }
        function control() public { require(true); }
      }`, { ...KERNEL, solidityImportCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
  });

  it('admits a library-wrapped IERC20 transfer', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      interface IERC20 { function transfer(address to, uint amt) external returns (bool); }
      library SafeTransfer {
        function send(IERC20 token, address to, uint amt) internal { require(token.transfer(to, amt)); }
      }
      contract C {
        using SafeTransfer for IERC20;
        address token;
        function denied(address to, uint amt) public { IERC20(token).send(to, amt); require(true); }
        function control() public { require(true); }
      }`, { ...KERNEL, solidityImportCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
  });

  it('admits a counter-keyed mapping loop that also makes a typed call', () => {
    const artifact = compileString(`interface I { function r(int i); }
      contract C() {
        mapping(int => int) m;
        address dest;
        function denied(int n) public {
          for (int i = 0; i < n; i = i + 1) { this.m[i] = 1; I(this.dest).r(i); }
          require(true);
        }
        function control() public { require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.messageBus?.route.inputs.some((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('admits using-for Address.sendValue on address payable', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      library Address {
        function sendValue(address payable to, uint amt) internal { to.transfer(amt); }
      }
      contract C {
        using Address for address payable;
        function denied(address payable to) public { to.sendValue(uint(1)); require(true); }
        function control() public { require(true); }
      }`, { ...KERNEL, solidityImportCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: true,
      transfers: [{
        recipientRecipe: { kind: 'handlerInput', inputIndex: 0 },
        amountRecipe: { kind: 'cast', resultType: 'uint256', operand: { kind: 'intLiteral', value: '1' } },
      }],
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('admits a library Address.sendValue satoshi transfer', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      library Address {
        function sendValue(address payable to, uint amt) internal { to.transfer(amt); }
      }
      contract C {
        function denied(address payable to, uint amt) public { Address.sendValue(to, amt); require(true); }
        function control() public { require(true); }
      }`, { ...KERNEL, solidityImportCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('admits a returning UDVT', () => {
    const artifact = compileString(`type TokenId is bytes32;
      contract C() {
        TokenId last;
        function denied() public returns (TokenId) { return this.last; }
        function control() public { require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('admits a counter-keyed mapping delete loop', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function denied(int n) public {
        for (int i = 0; i < n; i = i + 1) { delete this.m[i]; }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.messageBus?.route.inputs.some((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))).toBe(true);
  });

  it('admits two fixed-width scalar mutation streams with one shared key schedule', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) a;
      mapping(int => int) b;
      function denied(int n) public {
        for (int i = 0; i < n; i = i + 1) { this.a[i] = 1; this.b[i] = 2; }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.route.inputs.some((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))).toBe(true);
    const streams = artifact.abi.find((handler) => handler.name === 'denied')?.sortedUpsertLoopInfo ?? [];
    expect(streams).toHaveLength(2);
    expect(new Set(streams.map((stream) => stream.journalExecutionGroup)).size).toBe(1);
    expect(streams.map((stream) => stream.settlementIdentity)).toEqual(streams.map((stream) => ({
      accessStreamIndex: stream.journalAccessStreamIndex,
      accessOrdinalSource: 'access-program-order',
      recordOrdinalScope: 'global-journal',
      recordOrdinalSources: ['target-record-ordinal', 'predecessor-record-ordinal'],
      settlementRole: 'mutation-settlement',
      settlementOwnership: 'last-mutating-access',
      recordDispositionSource: 'mutation-settlement',
    })));
  });

  it('admits shared multi-mutation geometry independently of source names', () => {
    const compileRenamed = (contract: string, left: string, right: string, operation: string) => compileString(`
      contract ${contract}() {
        mapping(int => int) ${left};
        mapping(int => int) ${right};
        function ${operation}(int count) public {
          for (int cursor = 0; cursor < count; cursor = cursor + 1) {
            this.${left}[cursor] = 10;
            this.${right}[cursor] = 20;
          }
          require(true);
        }
      }
    `, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const ledger = compileRenamed('Ledger', 'credits', 'debits', 'reconcile');
    const registry = compileRenamed('Registry', 'primary', 'secondary', 'apply');
    for (const [artifact, operation] of [[ledger, 'reconcile'], [registry, 'apply']] as const) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === operation))
        .toMatchObject({ eligible: true });
      const streams = artifact.abi.find((handler) => handler.name === operation)?.sortedUpsertLoopInfo ?? [];
      expect(streams).toHaveLength(2);
      expect(new Set(streams.map((stream) => stream.collectionHash)).size).toBe(2);
      expect(new Set(streams.map((stream) => stream.varyingArrayParam)).size).toBe(1);
      expect(streams.every((stream) =>
        stream.settlementIdentity?.recordOrdinalScope === 'global-journal')).toBe(true);
    }
  });

  it('freezes independently sorted key shapes in one physical collection', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function write(int n) public {
        for (int i = 0; i < n; i = i + 1) {
          this.m[i * 2] = i + 10;
          this.m[i * 2 + 1] = i + 20;
        }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    const handler = artifact.abi.find((candidate) => candidate.name === 'write')!;
    expect(handler.sortedUpsertLoopInfo).toHaveLength(2);
    expect(handler.sortedUpsertLoopInfo?.map((info) => info.collection)).toEqual(['m', 'm']);
    expect(new Set(handler.sortedUpsertLoopInfo?.map((info) => info.varyingArrayParam))).toHaveLength(2);
    expect(handler.sortedUpsertLoopInfo).toEqual(expect.arrayContaining([
      expect.objectContaining({
        inputCountParam: expect.stringMatching(/^__internal__vmapCounterInputCount_/),
        outputCountParam: expect.stringMatching(/^__internal__vmapCounterOutputCount_/),
      }),
    ]));
    expect(handler.inputs.filter((input) => input.name.startsWith('__internal__vmapCounterInputCount_')))
      .toHaveLength(2);
    expect(handler.inputs.filter((input) => input.name.startsWith('__internal__vmapCounterOutputCount_')))
      .toHaveLength(2);
  });

  it('keeps multi-stream array-value mutation outside the fixed-width scalar family', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int[]) left;
      mapping(int => int[]) right;
      function write(int n) public {
        for (int i = 0; i < n; i = i + 1) {
          this.left[i].push(1);
          this.right[i].push(2);
        }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ mutation: 'push' }),
        expect.objectContaining({ mutation: 'push' }),
      ]));
  });

  it('keeps distinct key projections outside the shared multi-stream schedule', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) direct;
      mapping(bytes32 => int) projected;
      function write(int n) public {
        for (int i = 0; i < n; i = i + 1) {
          this.direct[i] = i + 1;
          this.projected[bytes32(i)] = i + 2;
        }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('admits a do-while counter-keyed mapping loop with a max(n, 1) permutation', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function denied(int n) public {
        int i = 0;
        do { this.m[i] = 1; i = i + 1; } while (i < n);
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.messageBus?.route.inputs.some((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_') && input.name.endsWith('_post'))).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it.each([
    ['ascending', '3', 'i + 2', '<', 'p3', 'p2'],
    ['descending', '5', 'i - 2', '>', 'p5', 'n2'],
  ])('admits a canonical %s ranged do-while mapping loop', (_label, start, update, comparison, encStart, encStep) => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function write(int bound) public {
        int i = ${start};
        do { this.m[i] = i + 10; i = ${update}; } while (i ${comparison} bound);
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write')?.eligible).toBe(true);
    expect(artifact.abi.find((handler) => handler.name === 'write')?.inputs).toContainEqual(
      expect.objectContaining({
        name: expect.stringMatching(new RegExp(`_from_${encStart}_step_${encStep}_post$`)),
      }),
    );
  });

  it.each([
    ['ascending for', 'for (int i = 1; i <= bound; i = i + 2) { this.m[i] = i; }', 'bound_p1'],
    ['descending for', 'for (int i = 5; i >= bound; i = i - 2) { this.m[i] = i; }', 'bound_n1'],
    ['ascending do-while', `int i = 1;
      do { this.m[i] = i; i = i + 2; } while (i <= bound);`, 'bound_p1'],
    ['descending do-while', `int i = 5;
      do { this.m[i] = i; i = i - 2; } while (i >= bound);`, 'bound_n1'],
    ['reversed ascending for', 'for (int i = 1; bound >= i; i = i + 2) { this.m[i] = i; }', 'bound_p1'],
    ['reversed descending for', 'for (int i = 5; bound <= i; i = i - 2) { this.m[i] = i; }', 'bound_n1'],
    ['reversed ascending do-while', `int i = 1;
      do { this.m[i] = i; i = i + 2; } while (bound > i);`, 'step_p2_post'],
    ['reversed descending do-while', `int i = 5;
      do { this.m[i] = i; i = i - 2; } while (bound < i);`, 'step_n2_post'],
    ['commuted additive update for', 'for (int i = 1; i < bound; i = 2 + i) { this.m[i] = i; }', 'step_p2'],
  ])('admits a %s counter domain', (_label, loop, encodedBound) => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function write(int bound) public { ${loop} require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.inputs).toContainEqual(
      expect.objectContaining({ name: expect.stringContaining(encodedBound) }),
    );
  });

  it.each([
    ['ascending for', 'for (int i = 1; i != bound; i = i + 2) { this.m[i] = i; }', 'step_p2'],
    ['reversed ascending for', 'for (int i = 1; bound != i; i = 2 + i) { this.m[i] = i; }', 'step_p2'],
    ['descending source while', `int i = 5;
      while (i != bound) { this.m[i] = i; i = i - 2; }`, 'step_n2'],
    ['ascending do-while', `int i = 1;
      do { this.m[i] = i; i = i + 2; } while (i != bound);`, 'step_p2_post'],
  ])('admits an exact-termination %s counter domain', (_label, loop, encodedDomain) => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function write(int bound) public { ${loop} require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.inputs).toContainEqual(
      expect.objectContaining({ name: expect.stringContaining(encodedDomain) }),
    );
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo?.[0])
      .toMatchObject({ iterationExactBound: true });
  });

  it('publishes a replayable runtime step for an exact-termination domain', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function write(int bound, int stride) public {
        for (int i = 1; i != bound; i = i + stride) { this.m[i] = i; }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo?.[0])
      .toMatchObject({
        iterationExactBound: true,
        iterationStep: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
      });
  });

  it('admits a do-while counter-keyed mapping loop beside a typed call', () => {
    const artifact = compileString(`interface I { function r(int i); }
      contract C() {
        mapping(int => int) m;
        address dest;
        function denied(int n) public {
          int i = 0;
          do { this.m[i] = 1; I(this.dest).r(i); i = i + 1; } while (i < n);
          require(true);
        }
        function control() public { require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.messageBus?.route.inputs.some((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_') && input.name.endsWith('_post'))).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('publishes a runtime do-while step for mapping and typed-call replay', () => {
    const artifact = compileString(`interface I { function r(int i); }
      contract C(address dest) {
        mapping(int => int) m;
        function write(int n, int stride) public {
          int i = 1;
          do { this.m[i] = i; I(dest).r(i); i = stride + i; } while (i < n);
          require(true);
        }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    const handler = artifact.abi.find((candidate) => candidate.name === 'write')!;
    expect(handler.sortedUpsertLoopInfo?.[0]).toMatchObject({
      varyingArrayParam: expect.stringMatching(/_from_p1_step_runtime_p_post$/),
      iterationStep: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
    });
    expect(handler.externalCalls?.[0].argSources?.[0]).toMatchObject({
      kind: 'loopIndex',
      initialValue: '1',
      stepExpression: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
    });
  });

  it('admits a canonical source while loop with mapping and typed-call replay', () => {
    const artifact = compileString(`interface I { function r(int i); }
      contract C(address dest) {
        mapping(int => int) m;
        function write(int n, int stride) public {
          int i = 1;
          while (n > i) { this.m[i] = i; I(dest).r(i); i = stride + i; }
          require(true);
        }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    const handler = artifact.abi.find((candidate) => candidate.name === 'write')!;
    expect(handler.sortedUpsertLoopInfo?.[0]).toMatchObject({
      varyingArrayParam: expect.stringMatching(/_from_p1_step_runtime_p$/),
      iterationStep: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
    });
    expect(handler.externalCalls?.[0].argSources?.[0]).toMatchObject({
      kind: 'loopIndex', initialValue: '1', stepExpression: { kind: 'source' },
    });
  });

  it.each([
    ['source while postfix increment', 'int i = 0;', 'while (i < n) { this.m[i] = i; i++; }'],
    ['source while prefix decrement', 'int i = 5;', 'while (i > n) { this.m[i] = i; --i; }'],
    ['source do-while prefix increment', 'int i = 0;', 'do { this.m[i] = i; ++i; } while (i < n);'],
    ['source do-while postfix decrement', 'int i = 5;', 'do { this.m[i] = i; i--; } while (i > n);'],
  ])('normalizes a %s tail', (_label, initializer, loop) => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function write(int n) public {
        ${initializer}
        ${loop}
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo)
      .toHaveLength(1);
  });

  it.each([
    ['postfix source while', 'i++', 'i = 1 + i'],
    ['prefix source while', '++i', 'i = i + 1'],
    ['commuted runtime source while', 'i = i + stride', 'i = stride + i'],
  ])('normalizes a %s update before continue', (_label, continueUpdate, tailUpdate) => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function write(int n, int stride) public {
        int i = 0;
        while (i < n) {
          if (i % 2 == 0) { ${continueUpdate}; continue; }
          this.m[i] = i;
          ${tailUpdate};
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo?.[0]
      .iterationCondition).toBeDefined();
  });

  it('normalizes a source while continue which performs its canonical step', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function write(int n) public {
        int i = 0;
        while (i < n) {
          if (i % 2 != 0) { i = i + 1; continue; }
          this.m[i] = i;
          i = i + 1;
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo?.[0]
      .iterationCondition).toBeDefined();
  });

  it.each([
    ['ascending runtime', 'int i = 1;', 'i < n', 'i = stride + i'],
    ['descending runtime', 'int i = 9;', 'i > n', 'i = i - stride'],
    ['exact runtime', 'int i = 1;', 'i != n', 'i = i + stride'],
  ])('normalizes a %s source while continue', (_label, initializer, condition, update) => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function write(int n, int stride) public {
        ${initializer}
        while (${condition}) {
          if (i % 2 == 0) { ${update}; continue; }
          this.m[i] = i;
          ${update};
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
  });

  it('refuses a source while continue which skips the canonical tail update', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function denied(int n) public {
        int i = 0;
        while (i < n) { if (i == 1) { continue; } this.m[i] = i; i = i + 1; }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('refuses a source do-while continue which skips the canonical tail update', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function denied(int n) public {
        int i = 0;
        do { if (i == 1) { continue; } this.m[i] = i; i = i + 1; } while (i < n);
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('normalizes a source do-while continue after a selected keyed write', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      mapping(int => int) rest;
      function write(int n) public {
        int i = 0;
        do {
          if (i % 2 == 0) { this.m[i] = i; i = i + 1; continue; }
          this.rest[i] = i;
          i = i + 1;
        } while (i < n);
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo)
      .toEqual([
        expect.objectContaining({ collection: 'm', iterationCondition: expect.anything() }),
        expect.objectContaining({ collection: 'rest', iterationCondition: expect.anything() }),
      ]);
  });

  it('normalizes a source while continue after a selected keyed write', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      mapping(int => int) rest;
      function write(int n) public {
        int i = 0;
        while (i < n) {
          if (i % 2 == 0) { this.m[i] = i; i = i + 1; continue; }
          this.rest[i] = i;
          i = i + 1;
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo)
      .toEqual([
        expect.objectContaining({ collection: 'm', iterationCondition: expect.anything() }),
        expect.objectContaining({ collection: 'rest', iterationCondition: expect.anything() }),
      ]);
  });

  it('admits fallback that wraps a UDVT mapping key', () => {
    const artifact = compileString(`type TokenId is bytes32;
      contract C() {
        mapping(TokenId => int) hits;
        fallback(bytes input) external {
          this.hits[TokenId.wrap(bytes32(input))] = 1;
          require(true);
        }
        function control() public { require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === '__fallback')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('admits fallback that writes a mapping and makes a typed call', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      interface I { function r() external; }
      contract C {
        address dest;
        mapping(bytes4 => uint) hits;
        fallback() external { hits[msg.sig] = 1; I(dest).r(); require(true); }
        function control() public { require(true); }
      }`, { ...KERNEL, solidityImportCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === '__fallback')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('admits a fixed-point mapping value write', () => {
    const artifact = compileString(`contract C() {
      mapping(int => fixed128x18) m;
      function denied(int k, fixed128x18 v) public { this.m[k] = v; require(true); }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
  });

  it('admits a ufixed mapping value write', () => {
    const artifact = compileString(`contract C() {
      mapping(int => ufixed128x18) m;
      function denied(int k, ufixed128x18 v) public { this.m[k] = v; require(true); }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
  });

  it('admits a pubkey mapping value write', () => {
    const artifact = compileString(`contract C() {
      mapping(bytes20 => pubkey) m;
      function denied(bytes20 k, pubkey pk) public { this.m[k] = pk; require(true); }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('admits an invariant-key mapping write inside a while-true break loop', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function denied(int k) public {
        int i = 0;
        while (true) { this.m[k] = i; break; }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('admits a nested counter-keyed mapping write m[k][i]', () => {
    const artifact = compileString(`contract C() {
      mapping(int => mapping(int => int)) m;
      function denied(int k, int n) public {
        for (int i = 0; i < n; i = i + 1) { this.m[k][i] = 1; }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.messageBus?.route.inputs.some((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))).toBe(true);
  });

  it('admits a counter-keyed mapping write inside if/else', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function denied(int n, bool yes) public {
        for (int i = 0; i < n; i = i + 1) {
          if (yes) this.m[i] = 1; else this.m[i] = 2;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
  });

  it('admits one source-ordered event stream around a counter-keyed mapping loop', () => {
    const artifact = compileString(`event Before(int i); event Hit(int i); event After(int i);
      contract C() {
        mapping(int => int) m;
        function denied(int n) public {
          emit Before(n);
          for (int i = 0; i < n; i = i + 1) { this.m[i] = 1; emit Hit(i); }
          emit After(n);
          require(true);
        }
        function control() public { require(true); }
    }`, KERNEL);
    const deniedHandler = artifact.messageBus?.handlers.find((handler) => handler.name === 'denied');
    expect(deniedHandler).toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('admits bounded canonical event-only for, while, and do-while loops', () => {
    const artifact = compileString(`event Tick(int value);
      contract C() {
        function fromFor(int n) public {
          for (int i = 0; i < n; i = i + 1) { emit Tick(i); }
          require(true);
        }
        function fromWhile(int n) public {
          int i = 0;
          while (i < n) { emit Tick(i); i = i + 1; }
          require(true);
        }
        function fromDoWhile(int n) public {
          int i = 0;
          do { emit Tick(i); i = i + 1; } while (i < n);
          require(true);
        }
      }`, KERNEL);
    for (const [name, permutation] of [
      ['fromFor', /^__internal__vmapCounterPerm_n_\d+$/],
      ['fromWhile', /^__internal__vmapCounterPerm_n_\d+$/],
      ['fromDoWhile', /^__internal__vmapCounterPerm_n_\d+_post$/],
    ] as const) {
      const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === name);
      expect(handler).toMatchObject({ eligible: true });
      expect(handler?.emits).toBeUndefined();
      expect(handler?.runtimeLoopEvents).toEqual([{
        permutationParam: expect.stringMatching(permutation),
        eventSignatures: ['Tick(int256)'],
        arguments: [[{
          kind: 'source',
          source: { kind: 'loopIndex', initialValue: '0', stepValue: '1' },
        }]],
      }]);
    }
  });

  it('normalizes canonical mutable-parameter event loops across source names and pre/post forms', () => {
    const compileVariant = (counter: string, boundary: string): ReturnType<typeof compileString> => compileString(`event Pulse(int value);
      contract C() {
        function descending(int ${counter}) public {
          while (${counter} > 0) { emit Pulse(${counter}); ${counter} = ${counter} - 1; }
          require(true);
        }
        function ascending(int ${counter}, int ${boundary}) public {
          while (${counter} < ${boundary}) { emit Pulse(${counter}); ${counter} = ${counter} + 1; }
          require(true);
        }
        function postTest(int ${counter}) public {
          do { emit Pulse(${counter}); ${counter} = ${counter} - 1; } while (${counter} > 0);
          require(true);
        }
        function postAscending(int ${counter}, int ${boundary}) public {
          do { emit Pulse(${counter}); ${counter} = ${counter} + 1; } while (${counter} < ${boundary});
          require(true);
        }
        function control() public { require(true); }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const artifacts = [compileVariant('remaining', 'ceiling'), compileVariant('cursor', 'limit')];
    for (const artifact of artifacts) for (const name of [
      'descending', 'ascending', 'postTest', 'postAscending',
    ]) {
      const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === name);
      expect(handler).toMatchObject({
        eligible: true,
        runtimeLoopEvents: [{
          permutationParam: expect.stringMatching(/^__internal__vmapCounterPerm_/),
          iterationBound: { kind: 'ternary' },
          eventSignatures: ['Pulse(int256)'],
          arguments: [[{ kind: 'binary', operator: '+' }]],
        }],
      });
    }
    const projection = (artifact: ReturnType<typeof compileVariant>): unknown => artifact.messageBus?.handlers
      .map((handler) => ({
        name: handler.name,
        eligible: handler.eligible,
        loops: handler.runtimeLoopEvents?.map((loop) => ({
          signatures: loop.eventSignatures,
          arguments: loop.arguments,
          post: loop.permutationParam.endsWith('_post'),
        })),
      }));
    expect(projection(artifacts[0])).toEqual(projection(artifacts[1]));
  });

  it('fences mutable-parameter event loops with an ambiguous or skippable source step', () => {
    const artifact = compileString(`event Pulse(int value);
      contract C() {
        function twice(int remaining) public {
          while (remaining > 0) {
            emit Pulse(remaining);
            remaining = remaining - 1;
            remaining = remaining - 1;
          }
          require(true);
        }
        function skipped(int remaining, bool skip) public {
          while (remaining > 0) {
            emit Pulse(remaining);
            if (skip) continue;
            remaining = remaining - 1;
          }
          require(true);
        }
        function changedBound(int cursor, int limit) public {
          while (cursor < limit) {
            emit Pulse(cursor);
            limit = limit + 1;
            cursor = cursor + 1;
          }
          require(true);
        }
        function tupleChangedBound(int cursor, int limit) public {
          int spare = 0;
          while (cursor < limit) {
            emit Pulse(cursor);
            (limit, spare) = (limit + 1, spare);
            cursor = cursor + 1;
          }
          require(true);
        }
        function tupleChangedCounter(int cursor, int limit) public {
          int spare = 0;
          while (cursor < limit) {
            emit Pulse(cursor);
            (cursor, spare) = (cursor, spare);
            cursor = cursor + 1;
          }
          require(true);
        }
        function control() public { require(true); }
      }`, KERNEL);
    for (const name of [
      'twice', 'skipped', 'changedBound', 'tupleChangedBound', 'tupleChangedCounter',
    ]) {
      expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === name))
        .toMatchObject({ eligible: false });
    }
  });

  it('publishes exact break and site-reachability predicates for event-only counter loops', () => {
    const artifact = compileString(`event Tick(int value);
      contract C() {
        function beforeBreak(int n, int stop) public {
          for (int i = 0; i < n; i = i + 1) {
            emit Tick(i);
            if (i == stop) break;
          }
          require(true);
        }
        function afterBreak(int n, int stop) public {
          for (int i = 0; i < n; i = i + 1) {
            if (i == stop) break;
            emit Tick(i);
          }
          require(true);
        }
      }`, KERNEL);
    const before = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'beforeBreak');
    const after = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'afterBreak');
    for (const handler of [before, after]) {
      expect(handler).toMatchObject({ eligible: true });
      expect(handler?.runtimeLoopEvents?.[0]).toMatchObject({
        permutationParam: expect.stringMatching(/^__internal__vmapCounterPerm_n_\d+$/),
        iterationBreakCondition: {
          kind: 'binary', operator: '==',
          left: {
            kind: 'source',
            source: { kind: 'loopIndex', initialValue: '0', stepValue: '1' },
          },
          right: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
        },
      });
    }
    expect(before?.runtimeLoopEvents?.[0].conditions).toBeUndefined();
    expect(after?.runtimeLoopEvents?.[0].conditions).toMatchObject([{
      kind: 'unary', operator: '!', expression: { kind: 'binary', operator: '==' },
    }]);
  });

  it('publishes source-reachability predicates for event-only canonical continues', () => {
    const artifact = compileString(`contract C() {
      event Before(int value);
      event After(int value);
      function fromFor(int n) public {
        for (int i = 0; i < n; i = i + 1) {
          emit Before(i);
          if (i % 2 == 0) continue;
          emit After(i);
        }
        require(true);
      }
      function fromWhile(int n) public {
        int i = 0;
        while (i < n) {
          emit Before(i);
          if (i % 2 == 0) { i = i + 1; continue; }
          emit After(i);
          i = i + 1;
        }
        require(true);
      }
      function fromDoWhile(int n) public {
        int i = 0;
        do {
          emit Before(i);
          if (i % 2 == 0) { i = i + 1; continue; }
          emit After(i);
          i = i + 1;
        } while (i < n);
        require(true);
      }
    }`, KERNEL);
    for (const name of ['fromFor', 'fromWhile', 'fromDoWhile']) {
      const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === name);
      expect(handler).toMatchObject({ eligible: true });
      expect(handler?.runtimeLoopEvents?.[0]).toMatchObject({
        eventSignatures: ['Before(int256)', 'After(int256)'],
        conditions: [null, {
          kind: 'unary', operator: '!', expression: { kind: 'binary', operator: '==' },
        }],
      });
    }
  });

  it('replays event-only arguments from closed loop-carried local and scalar-state assignments', () => {
    const artifact = compileString(`event Tick(int value);
      contract C() {
        int total;
        function fromLocal(int n) public {
          int next = 0;
          for (int i = 0; i < n; i = i + 1) { next = i + 2; emit Tick(next); }
          require(true);
        }
        function fromState(int n) public {
          for (int i = 0; i < n; i = i + 1) { this.total = this.total + 1; emit Tick(this.total); }
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'fromLocal'))
      .toMatchObject({
        eligible: true,
        runtimeLoopEvents: [{
          eventSignatures: ['Tick(int256)'],
          arguments: [[{ kind: 'binary', operator: '+' }]],
        }],
      });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'fromState'))
      .toMatchObject({
        eligible: true,
        runtimeLoopEvents: [{
          eventSignatures: ['Tick(int256)'],
          arguments: [[{ kind: 'ternary' }]],
        }],
      });
  });

  it('anchors a scalar-state event recurrence to its exact dominating assignment', () => {
    const artifact = compileString(`event Tick(int value);
      contract C() {
        int total;
        function observe(int n, int seed) public {
          this.total = seed;
          for (int i = 0; i < n; i = i + 1) {
            emit Tick(this.total);
            this.total = this.total + 1;
          }
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'observe'))
      .toMatchObject({
        eligible: true,
        runtimeLoopEvents: [{
          eventSignatures: ['Tick(int256)'],
          arguments: [[{ kind: 'ternary' }]],
        }],
      });
    expect(JSON.stringify(artifact.messageBus?.handlers.find((handler) => handler.name === 'observe')
      ?.runtimeLoopEvents)).toContain('"paramIndex":1');
  });

  it('replays a dominating reassignment and fences path-dependent event recurrences', () => {
    const artifact = compileString(`event Tick(int value);
      contract C() {
        int total;
        function reassignedInitializer(int n, int seed) public {
          int next = 0;
          next = seed;
          for (int i = 0; i < n; i = i + 1) { emit Tick(next); next = i + 10; }
          require(true);
        }
        function localContinue(int n, bool skip) public {
          int next = 0;
          for (int i = 0; i < n; i = i + 1) {
            emit Tick(next);
            next = i;
            if (skip) { continue; }
            next = i + 100;
          }
          require(true);
        }
        function stateContinue(int n, bool skip) public {
          for (int i = 0; i < n; i = i + 1) {
            emit Tick(this.total);
            this.total = this.total + 1;
            if (skip) { continue; }
            this.total = this.total + 10;
          }
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'reassignedInitializer'))
      .toMatchObject({ eligible: true });
    for (const name of ['localContinue', 'stateContinue']) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === name))
        .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    }
  });

  it('keeps self-dependent and resource-dependent event recurrences fenced', () => {
    const artifact = compileString(`event Tick(int value);
      contract C() {
        mapping(int => int) source;
        function selfDependent(int n) public {
          int next = 0;
          for (int i = 0; i < n; i = i + 1) { next = next + i; emit Tick(next); }
          require(true);
        }
        function resourceDependent(int n) public {
          int next = 0;
          for (int i = 0; i < n; i = i + 1) { next = this.source[i]; emit Tick(next); }
          require(true);
        }
      }`, KERNEL);
    for (const name of ['selfDependent', 'resourceDependent']) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === name))
        .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    }
  });

  it('keeps resource recurrence sources fenced and exactly replays truncating and local deltas', () => {
    const artifact = compileString(`event Tick(int value);
      contract C() {
        int total;
        mapping(int => int) source;
        function geometric(int n) public {
          for (int i = 0; i < n; i = i + 1) {
            this.total = this.total * 2;
            emit Tick(this.total);
          }
          require(true);
        }
        function resourceDependent(int n) public {
          for (int i = 0; i < n; i = i + 1) {
            this.total = this.total + this.source[i];
            emit Tick(this.total);
          }
          require(true);
        }
        function truncatedCounter(int n) public {
          for (int i = 0; i < n; i = i + 1) {
            this.total = this.total + i / 2;
            emit Tick(this.total);
          }
          require(true);
        }
        function counterLocalAlias(int n) public {
          for (int i = 0; i < n; i = i + 1) {
            int current = i + 1;
            this.total = this.total + current;
            emit Tick(this.total);
          }
          require(true);
        }
        function localDelta(int n) public {
          int delta = 1;
          for (int i = 0; i < n; i = i + 1) {
            this.total = this.total + delta;
            delta = delta + 1;
            emit Tick(this.total);
          }
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'geometric'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'counterLocalAlias'))
      .toMatchObject({ eligible: true });
    for (const name of ['truncatedCounter', 'localDelta']) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === name))
        .toMatchObject({ eligible: true });
    }
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'resourceDependent'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('publishes quadratic-counter event prefixes across affine loop domains and source phases', () => {
    const artifact = compileString(`event Phase(int value);
      contract C() {
        int total;
        function accumulate(int n) public {
          for (int i = 1; i < n; i = i + 2) {
            emit Phase(this.total);
            this.total = this.total + (i + 1) * (i - 1);
            emit Phase(this.total);
          }
          require(true);
        }
      }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'accumulate');
    expect(handler).toMatchObject({
      eligible: true,
      runtimeLoopEvents: [{ eventSignatures: ['Phase(int256)', 'Phase(int256)'] }],
    });
    expect(handler?.runtimeLoopEvents?.[0].arguments).toHaveLength(2);
    expect(handler?.runtimeLoopEvents?.[0].arguments?.[0])
      .not.toEqual(handler?.runtimeLoopEvents?.[0].arguments?.[1]);
  });

  it('keeps coupled scalar-state event recurrences fenced', () => {
    const artifact = compileString(`event Tick(int value);
      contract C() {
        int left;
        int right;
        function coupled(int n) public {
          for (int i = 0; i < n; i = i + 1) {
            this.left = this.left + this.right;
            this.right = this.right + 1;
            emit Tick(this.left);
          }
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'coupled'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('publishes scalar-state event recipes at their exact source phase', () => {
    const artifact = compileString(`event Phase(int value);
      contract C() {
        int total;
        function observe(int n, int delta) public {
          for (int i = 0; i < n; i = i + 1) {
            emit Phase(this.total);
            this.total = this.total + delta;
            emit Phase(this.total);
          }
          require(true);
        }
      }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'observe');
    expect(handler).toMatchObject({ eligible: true });
    expect(handler?.runtimeLoopEvents?.[0].arguments).toHaveLength(2);
    expect(handler?.runtimeLoopEvents?.[0].arguments?.[0])
      .not.toEqual(handler?.runtimeLoopEvents?.[0].arguments?.[1]);
  });

  it('publishes exact affine-counter prefix sums across canonical loop domains', () => {
    const artifact = compileString(`event Phase(int value);
      contract C() {
        int total;
        function ascending(int n, int factor) public {
          for (int i = 1; i < n; i = i + 2) {
            emit Phase(this.total);
            this.total = this.total + (factor * i + 3);
            emit Phase(this.total);
          }
          require(true);
        }
        function descending(int limit) public {
          for (int i = 6; i > limit; i = i - 2) {
            this.total = this.total - (i - 1);
            emit Phase(this.total);
          }
          require(true);
        }
      }`, KERNEL);
    for (const name of ['ascending', 'descending']) {
      const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === name);
      expect(handler?.rejectionReason).toBeUndefined();
      expect(handler).toMatchObject({
        eligible: true,
        runtimeLoopEvents: [{
          eventSignatures: name === 'ascending'
            ? ['Phase(int256)', 'Phase(int256)'] : ['Phase(int256)'],
        }],
      });
      expect(handler?.runtimeLoopEvents?.[0].arguments).toBeDefined();
    }
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'ascending')
      ?.runtimeLoopEvents?.[0].arguments).toHaveLength(2);
  });

  it('keeps affine-counter recurrence admission invariant under source renaming', () => {
    const compileRenamed = (
      contract: string, operation: string, state: string, counter: string,
      bound: string, coefficient: string, event: string,
    ): ReturnType<typeof compileString> => compileString(`event ${event}(int value);
      contract ${contract}() {
        int ${state};
        function ${operation}(int ${bound}, int ${coefficient}) public {
          for (int ${counter} = 1; ${counter} < ${bound}; ${counter} = ${counter} + 2) {
            this.${state} = this.${state} + (${coefficient} * ${counter} + 3);
            emit ${event}(this.${state});
          }
          require(true);
        }
      }`, KERNEL);
    const eventShape = (artifact: ReturnType<typeof compileString>, operation: string): unknown => {
      const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === operation);
      expect(handler?.eligible).toBe(true);
      return JSON.parse(JSON.stringify(handler?.runtimeLoopEvents, (key, value: unknown) => {
        if (key === 'name' || key === 'counterName' || key === 'permutationParam') return '<name>';
        if (typeof value === 'string' && /^[A-Za-z_$][A-Za-z0-9_$]*\(/u.test(value)) return '<event>';
        return value;
      }));
    };
    const first = compileRenamed('Accumulator', 'advance', 'total', 'cursor', 'limit', 'factor', 'Phase');
    const second = compileRenamed('Register', 'apply', 'stored', 'position', 'end', 'scale', 'Observed');
    expect(eventShape(second, 'apply')).toEqual(eventShape(first, 'advance'));
  });

  it('freezes a runtime collection mutation combined with a repeated row effect', () => {
    const artifact = compileString(`event Tick(int localValue, int stateValue);
      contract C() {
        int total;
        mapping(int => int) values;
        function write(int n, int offset, int delta) public {
          int next = 0;
          for (int i = 0; i < n; i = i + 1) {
            next = offset + i;
            this.total = this.total + delta;
            this.values[i] = i;
            emit Tick(next, this.total);
          }
          require(true);
        }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'write');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('freezes an inlined effectful helper result adjacent to a repeated event and collection mutation', () => {
    const artifact = compileString(`event Hit(int i);
      contract C() {
        mapping(int => int) m;
        int calls;
        function next(int value) internal returns (int) {
          this.calls = this.calls + 1;
          return value;
        }
        function denied(int n) public {
          for (int i = 0; i < n; i = i + 1) { this.m[i] = 1; emit Hit(next(i)); }
          require(true);
        }
        function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('freezes sequential collection loops combined with multiple event sites', () => {
    const artifact = compileString(`event A(int i); event B(int i);
      contract C() {
        mapping(int => int) a;
        mapping(int => int) b;
        function writeBoth(int left, int right) public {
          for (int i = 0; i < left; i = i + 1) {
            this.a[i] = i;
            emit A(i);
            emit B(i);
          }
          emit A(99);
          for (int j = 0; j < right; j = j + 1) {
            this.b[j] = j;
            emit B(j);
          }
          require(true);
        }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'writeBoth');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('keeps loop events on direct calls and admits the kernel one-stream geometry', () => {
    const source = `event Hit(int i);
      contract C() {
        mapping(int => int) m;
        function write(int n) public {
          for (int i = 0; i < n; i = i + 1) { this.m[i] = i; emit Hit(i); }
          require(true);
        }
        function control() public { require(true); }
      }`;
    const legacy = compileString(source, {
      forceStateful: true, messageBus: true, messageBusKernel: false, maximumInputBytes: 1_000_000,
    });
    expect(legacy.messageBus?.convention).toBe('legacy-unroll');
    expect(legacy.messageBus?.handlers.find((candidate) => candidate.name === 'write')).toMatchObject({
      eligible: false,
      rejectionReason: 'handler-route-generation-unsupported',
    });
    expect(legacy.abi.find((candidate) => candidate.name === 'write')?.runtimeLoopEvents).toEqual([
      expect.objectContaining({ eventSignatures: ['Hit(int256)'] }),
    ]);

    const kernel = compileString(source, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(kernel.messageBus?.convention).toBe('kernel-row-loop');
    expect(kernel.messageBus?.handlers.find((candidate) => candidate.name === 'write')).toMatchObject({
      eligible: true,
    });
  });

  it('publishes a runtime predicate while freezing its collection-plus-event row geometry', () => {
    const artifact = compileString(`event Hit(int i);
      contract C() {
        mapping(int => int) m;
        function denied(int n, bool enabled) public {
          for (int i = 0; i < n; i = i + 1) {
            this.m[i] = 1;
            if (enabled) emit Hit(i);
          }
          require(true);
        }
        function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LAYOUT',
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('publishes path metadata while freezing the mixed collection/effect geometry', () => {
    const artifact = compileString(`event Hit(int i);
      contract C() {
        mapping(int => int) m;
        function denied(int n, bool enabled) public {
          if (enabled) emit Hit(-1);
          for (int i = 0; i < n; i = i + 1) { this.m[i] = 1; emit Hit(i); }
          require(true);
        }
        function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LAYOUT',
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('publishes a stable pre-state predicate while freezing mixed collection/effect geometry', () => {
    const artifact = compileString(`event Hit(int i);
      contract C() {
        bool enabled;
        mapping(int => int) m;
        function write(int n) public {
          for (int i = 0; i < n; i = i + 1) {
            this.m[i] = i;
            if (this.enabled) emit Hit(i);
          }
          require(true);
        }
        function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LAYOUT',
    });
  });

  it('serializes an array predicate while freezing mixed collection/effect geometry', () => {
    const artifact = compileString(`event Hit(int i);
      contract C() {
        mapping(int => int) m;
        function write(int n, bool[] enabled) public {
          for (int i = 0; i < n; i = i + 1) {
            this.m[i] = i;
            if (i < enabled.length && enabled[i]) emit Hit(i);
          }
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LAYOUT',
    });
  });

  it('publishes a dominating scalar predicate while freezing mixed collection/effect geometry', () => {
    const artifact = compileString(`event Hit(int i);
      contract C() {
        bool enabled;
        mapping(int => int) m;
        function denied(int n, bool next) public {
          this.enabled = next;
          for (int i = 0; i < n; i = i + 1) {
            this.m[i] = i;
            if (this.enabled) emit Hit(i);
          }
          require(true);
        }
        function control() public { require(true); }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'denied');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'control')?.eligible).toBe(true);
  });

  it('orders helper event metadata beside one mutation stream', () => {
    const artifact = compileString(`event Hit(int i);
      contract C() {
        mapping(int => int) m;
        function announce(int value) internal { emit Hit(value); }
        function denied(int n) public {
          announce(-1);
          for (int i = 0; i < n; i = i + 1) { this.m[i] = 1; emit Hit(i); }
          require(true);
        }
        function control() public { require(true); }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'denied');
    expect(handler).toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'control')?.eligible).toBe(true);
  });

  it('orders internal-helper event metadata while freezing mixed collection/effect geometry', () => {
    const artifact = compileString(`event Observed(int value);
      contract C() {
        mapping(int => int) values;
        function record(int value) internal returns (int) {
          emit Observed(value);
          return value + 1;
        }
        function transform(int value, bool enabled) internal returns (int) {
          if (enabled) emit Observed(value * 2);
          int next = record(value + 1);
          emit Observed(next);
          return next + 1;
        }
        function apply(int count) public {
          for (int cursor = 0; cursor < count; cursor = cursor + 1) {
            emit Observed(cursor);
            this.values[cursor] = transform(cursor, cursor != 1);
            emit Observed(cursor + 10);
          }
          require(true);
        }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply');
    expect(handler).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LAYOUT',
    });
  });

  it('preserves lazy event metadata while freezing its collection mutation composition', () => {
    const artifact = compileString(`event Observed(int value);
      contract C() {
        mapping(int => int) values;
        bool reached;
        function record(int value) internal returns (int) {
          emit Observed(value);
          return value;
        }
        function apply(int count, bool enabled) public {
          for (int cursor = 0; cursor < count; cursor = cursor + 1) {
            bool selected = false;
            selected = enabled && record(cursor) >= 0;
            if (enabled || record(cursor + 10) < 0) { selected = true; }
            require(enabled || record(cursor + 15) >= 0);
            int branch = enabled ? record(cursor + 20) : record(cursor + 30);
            this.values[cursor] = branch;
          }
          require(true);
        }
        function mark(bool enabled) public {
          this.reached = enabled && record(40) >= 0;
          require(true);
        }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply');
    expect(handler).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LAYOUT',
    });
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'mark'))
      .toMatchObject({ eligible: true });
  });

  it('preserves lazy event metadata while freezing stable-key mapping-value composition', () => {
    const artifact = compileString(`event Observed(int value);
      contract C() {
        mapping(int => int) values;
        function record(int value) internal returns (int) {
          emit Observed(value);
          return value;
        }
        function apply(int count, bool enabled) public {
          for (int cursor = 0; cursor < count; cursor = cursor + 1) {
            this.values[cursor] = enabled ? record(cursor) : 0;
          }
          require(true);
        }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply');
    expect(handler).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LAYOUT',
    });
  });

  it.each([
    ['a scalar-state read', 'return value + this.marker;'],
    ['a scalar-state write', 'this.marker = value; return value;'],
  ])('keeps lazy event-helper return replay fenced across %s', (_label, helperTail) => {
    const artifact = compileString(`event Observed(int value);
      contract C() {
        mapping(int => int) values;
        int marker;
        function record(int value) internal returns (int) {
          emit Observed(value);
          ${helperTail}
        }
        function apply(int count, bool enabled) public {
          for (int cursor = 0; cursor < count; cursor = cursor + 1) {
            this.values[cursor] = enabled ? record(cursor) : 0;
          }
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply'))
      .toMatchObject({ eligible: false });
  });

  it.each([
    ['an effectful key', '', 'enabled ? record(cursor) : cursor', 'cursor'],
    ['a state-derived key', 'int next;', 'this.next', 'enabled ? record(cursor) : 0'],
  ])('keeps lazy event helpers with %s fail closed', (_label, state, key, value) => {
    expect(() => compileString(`event Observed(int value);
      contract C() {
        mapping(int => int) values;
        ${state}
        function record(int value) internal returns (int) {
          emit Observed(value);
          return value;
        }
        function apply(int count, bool enabled) public {
          for (int cursor = 0; cursor < count; cursor = cursor + 1) {
            this.values[${key}] = ${value};
          }
          require(true);
        }
      }`, KERNEL)).toThrow(/Helper 'record' emits an event/);
  });

  it('publishes path metadata for a conditionally reached counter loop', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function denied(int n, bool enabled) public {
        if (enabled) {
          for (int i = 0; i < n; i = i + 1) { this.m[i] = 1; }
        }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: true,
    });
    expect(artifact.abi.find((handler) => handler.name === 'denied')?.sortedUpsertLoopInfo).toEqual([
      expect.objectContaining({
        varyingArrayParam: expect.stringMatching(/^__internal__vmapCounterPerm_n_/),
        condition: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
      }),
    ]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('expands an immutable local path alias for a conditionally reached counter loop', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function write(int n, bool enabled) public {
        bool active = enabled;
        if (active) {
          for (int i = 0; i < n; i = i + 1) { this.m[i] = i; }
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write')?.eligible).toBe(true);
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo?.[0].condition)
      .toEqual({ kind: 'source', source: { kind: 'forward', paramIndex: 1 } });
  });

  it('publishes complementary predicates for counter loops in if/else arms', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) a;
      mapping(int => int) b;
      function write(int n, bool left) public {
        if (left) {
          for (int i = 0; i < n; i = i + 1) { this.a[i] = i; }
        } else {
          for (int j = 0; j < n; j = j + 1) { this.b[j] = j; }
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write')?.eligible).toBe(true);
    const conditions = artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo
      ?.map((info) => info.condition);
    expect(conditions).toEqual([
      { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
      {
        kind: 'unary', operator: '!',
        expression: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
      },
    ]);
  });

  it('publishes a loop predicate from a dominating scalar-state assignment', () => {
    const artifact = compileString(`contract C() {
      bool enabled;
      mapping(int => int) m;
      function denied(int n, bool next) public {
        this.enabled = next;
        if (this.enabled) {
          for (int i = 0; i < n; i = i + 1) { this.m[i] = i; }
        }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'denied')?.sortedUpsertLoopInfo?.[0].condition)
      .toEqual({ kind: 'source', source: { kind: 'forward', paramIndex: 1 } });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('merges a conditional scalar-state assignment into a loop predicate', () => {
    const artifact = compileString(`contract C() {
      bool enabled;
      mapping(int => int) m;
      function denied(int n, bool next, bool take) public {
        if (take) { this.enabled = next; }
        if (this.enabled) {
          for (int i = 0; i < n; i = i + 1) { this.m[i] = i; }
        }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'denied')?.sortedUpsertLoopInfo?.[0].condition)
      .toEqual({
        kind: 'ternary',
        condition: { kind: 'source', source: { kind: 'forward', paramIndex: 2 } },
        ifTrue: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
        ifFalse: { kind: 'state', name: 'enabled' },
      });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('merges exhaustive scalar-state assignments used by a later loop predicate', () => {
    const artifact = compileString(`contract C() {
      bool enabled;
      bool armed;
      mapping(int => int) m;
      function write(int n, bool next, bool take) public {
        if (take) { this.enabled = next; this.armed = this.enabled; }
        else { this.enabled = !next; this.armed = this.enabled; }
        if (this.armed) {
          for (int i = 0; i < n; i = i + 1) { this.m[i] = i; }
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo?.[0].condition)
      .toEqual({
        kind: 'ternary',
        condition: { kind: 'source', source: { kind: 'forward', paramIndex: 2 } },
        ifTrue: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
        ifFalse: {
          kind: 'unary', operator: '!',
          expression: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
        },
      });
  });

  it('merges a finite switch scalar-state assignment into a loop predicate', () => {
    const artifact = compileString(`contract C() {
      bool enabled;
      mapping(int => int) m;
      function write(int n, int choice, bool next) public {
        switch (choice) {
          case 1: this.enabled = next; break;
          case 2: this.enabled = !next; break;
          default: break;
        }
        if (this.enabled) {
          for (int i = 0; i < n; i = i + 1) { this.m[i] = i; }
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo?.[0].condition)
      .toMatchObject({ kind: 'ternary' });
  });

  it('composes sequential dominating scalar-state assignments in a loop predicate', () => {
    const artifact = compileString(`contract C() {
      bool enabled;
      mapping(int => int) m;
      function write(int n, bool next) public {
        this.enabled = next;
        this.enabled = !this.enabled;
        if (this.enabled) {
          for (int i = 0; i < n; i = i + 1) { this.m[i] = i; }
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo?.[0].condition)
      .toEqual({
        kind: 'unary', operator: '!',
        expression: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
      });
  });

  it('publishes exact path metadata for a counter loop beneath switch', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function denied(int n, int choice) public {
        switch (choice) {
          case 1: for (int i = 0; i < n; i = i + 1) { this.m[i] = i; } break;
          default: break;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'denied')?.sortedUpsertLoopInfo?.[0].condition)
      .toMatchObject({ kind: 'binary', operator: '==' });
  });

  it('publishes mutually exclusive write paths for switch inside a counter loop', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function write(int n, int choice) public {
        for (int i = 0; i < n; i = i + 1) {
          switch (choice) {
            case 1: this.m[i] = i; break;
            default: this.m[i] = i + 10; break;
          }
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo?.[0]
      .iterationCondition).toMatchObject({ kind: 'binary', operator: '||' });
  });

  it('routes the reachable try body around and inside counter loops', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      interface I { function ping(int value) external; }
      contract C {
        address peer;
        mapping(int => int) m;
        function around(int n) public {
          try I(peer).ping(0) {
            for (int i = 0; i < n; i = i + 1) { m[i] = i + 10; }
          } catch { m[999] = 1; }
          require(true);
        }
        function inside(int n) public {
          for (int i = 0; i < n; i = i + 1) {
            try I(peer).ping(i) { m[i] = i + 20; } catch { m[999] = 2; }
          }
          require(true);
        }
      }`, { ...KERNEL, solidityImportCompat: true, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'around'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'inside'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'around')?.sortedUpsertLoopInfo).toHaveLength(1);
    expect(artifact.abi.find((handler) => handler.name === 'inside')?.sortedUpsertLoopInfo).toHaveLength(1);
  });

  it('freezes a repeated BCH transfer inside a counter-keyed mapping loop', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function denied(int n, bytes to) public {
        for (int i = 0; i < n; i = i + 1) { this.m[i] = 1; this.transfer(to, 1); }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('freezes a repeated fungible-token transfer inside a counter-keyed mapping loop', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function denied(int n, bytes32 category, bytes to) public {
        for (int i = 0; i < n; i = i + 1) {
          this.m[i] = 1;
          this.tokens[category].transfer(to, 1);
        }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('freezes a repeated NFT transfer inside a counter-keyed mapping loop', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function denied(int n, bytes32 category, bytes to, bytes commitment, int capability) public {
        for (int i = 0; i < n; i = i + 1) {
          this.m[i] = 1;
          this.tokens[category].transferNft(to, commitment, capability);
        }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('publishes the exact predicate and physical site for a fixed conditional NFT transfer', () => {
    const artifact = compileString(`contract C() {
      function send(
        bytes32 category, bytes32 other, bytes to, bytes commitment, int capability, bool take
      ) public {
        require(this.tokens[category].tokenAmount >= 0);
        require(this.tokens[other].tokenAmount >= 0);
        if (take) this.tokens[category].transferNft(to, commitment, capability);
        else this.tokens[other].transferNft(to, commitment, capability);
        require(capability >= 0);
      }
    }`, KERNEL);
    const expected = [
      {
        transferIndex: 0,
        tokenContainerSlot: 0,
        kind: 'nft',
        condition: { kind: 'source', source: { kind: 'forward', paramIndex: 5 } },
      },
      {
        transferIndex: 1,
        tokenContainerSlot: 1,
        kind: 'nft',
        condition: {
          kind: 'unary', operator: '!',
          expression: { kind: 'source', source: { kind: 'forward', paramIndex: 5 } },
        },
      },
    ];
    expect(artifact.abi.find((handler) => handler.name === 'send')?.tokenContainerTransferSites)
      .toEqual(expected);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'send'))
      .toMatchObject({ eligible: true, tokenContainerTransferSites: expected });
    expect(artifact.abi.find((handler) => handler.name === 'send')?.blockLayout?.slots
      .filter((slot) => slot.kind === 'tcTransfer')).toHaveLength(2);
  });

  it('admits a returning enum encoded as int', () => {
    const artifact = compileString(`enum Status { A, B }
      contract C() {
        Status st;
        function denied() public returns (Status) { return this.st; }
        function control() public { require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('leaves legacy reasons on non-kernel compiles', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract C() {
        function opaque() public { assembly { OP_1 OP_DROP } require(true); }
        function control() public { require(true); }
      }`, { forceStateful: true, messageBus: true, messageBusKernel: false });
    expect(artifact.messageBus!.handlers.find((handler) => handler.name === 'opaque')).toMatchObject({
      eligible: false,
      rejectionReason: 'opaque-assembly-effects-callManifest-ineligible',
    });
    expect(artifact.messageBus?.convention).toBe('legacy-unroll');
    expect(artifact.compiler.options?.messageBusKernel).toBe(false);
  });

  const RETURNING = `contract Acc() {
    int x;
    function add(int n) public {
      this.x = this.x + n;
      require(true);
    }
    function get() public returns (int) {
      return this.x;
    }
  }`;

  const selectorPushCount = (artifact: ReturnType<typeof compileString>, selectorHex: string): number => {
    const body = artifact.functionBodies?.['53434231'];
    expect(body).toBeDefined();
    const haystack = bytecodeToAsm(Uint8Array.from(Buffer.from(body!, 'hex'))).replace(/\s+/g, '').toLowerCase();
    const needle = selectorHex.toLowerCase();
    let count = 0;
    let from = 0;
    while (from < haystack.length) {
      const at = haystack.indexOf(needle, from);
      if (at < 0) break;
      count += 1;
      from = at + needle.length;
    }
    return count;
  };

  it('dispatches returning handlers from the row loop when the kernel flag is omitted', () => {
    const artifact = compileString(RETURNING, { forceStateful: true, messageBus: true });
    const get = artifact.messageBus?.handlers.find((handler) => handler.name === 'get');
    expect(get?.eligible).toBe(true);
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.available).toBe(true);
    expect(artifact.compiler.options?.messageBusKernel).toBe(true);
    expect(selectorPushCount(artifact, get!.selector)).toBe(1);
  });

  it('keeps returning handlers on the legacy unroll when the kernel flag is false', () => {
    const artifact = compileString(RETURNING, {
      forceStateful: true, messageBus: true, messageBusKernel: false,
    });
    const get = artifact.messageBus?.handlers.find((handler) => handler.name === 'get');
    expect(get?.eligible).toBe(true);
    expect(artifact.messageBus?.convention).toBe('legacy-unroll');
    expect(artifact.compiler.options?.messageBusKernel).toBe(false);
    expect(selectorPushCount(artifact, get!.selector)).toBe(0);
  });

  it('dispatches returning handlers from one row loop when the kernel flag is explicitly true', () => {
    const artifact = compileString(RETURNING, KERNEL);
    const get = artifact.messageBus?.handlers.find((handler) => handler.name === 'get');
    expect(get?.eligible).toBe(true);
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.available).toBe(true);
    expect(artifact.compiler.options?.messageBusKernel).toBe(true);
    expect(selectorPushCount(artifact, get!.selector)).toBe(1);
  });

  it('rejects this.activeBytecode on the legacy path and admits it on the kernel path', () => {
    const source = `contract C() {
      function bound(bytes expected) public { require(this.activeBytecode == expected); }
      function control() public { require(true); }
    }`;
    const legacy = compileString(source, {
      forceStateful: true, messageBus: true, messageBusKernel: false,
    });
    expect(legacy.messageBus!.handlers.find((handler) => handler.name === 'bound')).toMatchObject({
      eligible: false,
      rejectionReason: 'direct-versus-batch-introspection-divergence',
    });
    const kernel = compileString(source, KERNEL);
    expect(kernel.messageBus!.handlers.find((handler) => handler.name === 'bound')).toMatchObject({
      eligible: true,
    });
  });

  it('keeps distinct parameter keys on one mapping as distinct physical slots', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function setBoth(int a, int b) public { this.m[a] = 1; this.m[b] = 2; require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    const setBoth = artifact.messageBus?.handlers.find((handler) => handler.name === 'setBoth');
    expect(setBoth?.eligible).toBe(true);
    expect(setBoth?.physicalEntrySlots).toEqual([0, 1]);
  });

  it('publishes available:false when every kernel handler is refused', () => {
    const artifact = compileString(`contract C() {
      function denied() public { assembly { OP_ACTIVEBYTECODE OP_SHA256 OP_DROP } require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.available).toBe(false);
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.every((handler) => handler.eligible === false)).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.rejectionReason)
      .toBe('KERNEL_OPAQUE_EFFECT');
  });

  it('publishes a value-bearing stateless child as a derived fixed BCH effect', () => {
    const artifact = compileString(`contract Capsule(int seed) {
      function open(int candidate) public pure { require(candidate == seed); }
    }
    contract Router() {
      function place(int seed, int amount) public {
        Capsule child = new Capsule{value: amount}(seed);
        require(address(child) != address(0));
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'place'))
      .toMatchObject({
        eligible: true,
        transfers: [{
          derivedRecipient: {
            contractName: 'Capsule',
            constructorInputs: [{ name: 'seed', type: 'int256' }],
          },
          amountRecipe: { kind: 'handlerInput', inputIndex: 1 },
        }],
      });
  });

  it.each([
    ['write before read', 'this.shared[i] = 1; require(this.shared[i] == 1);'],
    ['read before write', 'require(this.shared[i] >= 0); this.shared[i] = 1;'],
    ['an offset read overlapping the next iteration', 'this.shared[i] = 1; require(this.shared[i + 1] >= 0);'],
  ])('rejects a source counter-loop requirement sharing its write collection: %s', (_label, body) => {
    const source = `contract Ledger() {
      mapping(int => int) shared;
      function affected(int count) public {
        for (int i = 0; i < count; i = i + 1) { ${body} }
        require(true);
      }
    }`;
    expect(() => compileString(source, KERNEL))
      .toThrow(/Counter-loop requirement cannot read collection 'shared'.*unsupported/);
  });

  it('rejects the same unsequenced source-loop shape for a mapping-backed array value', () => {
    expect(() => compileString(`contract Ledger() {
      mapping(int => int[]) shared;
      function affected(int count) public {
        for (int i = 0; i < count; i = i + 1) {
          this.shared[i][0] = 1;
          require(this.shared[i][0] == 1);
        }
        require(true);
      }
    }`, KERNEL)).toThrow(/Counter-loop requirement cannot read collection 'shared'.*unsupported/);
  });

  it('retains source counter-loop requirements reading an independent collection', () => {
    const artifact = compileString(`contract Ledger() {
      mapping(int => int) written;
      mapping(int => int) observed;
      function apply(int count) public {
        for (int i = 0; i < count; i = i + 1) {
          this.written[i] = 1;
          require(this.observed[i] >= 0);
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.abi.find((handler) => handler.name === 'apply')?.sortedUpsertLoopInfo)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'observed', op: 'read' }),
        expect.objectContaining({ collection: 'written', op: 'set' }),
      ]));
  });

  it('fences bounded constructed-key replay without rejecting direct derived keys', () => {
    const artifact = compileString(`contract Ledger() {
      mapping(int => int) values;
      function constructed(int count) public {
        int[] keys = new int[](0);
        for (int i = 0; i < count; i = i + 1) {
          keys.push(i + 10);
          this.values[keys[i]] = i;
        }
        require(true);
      }
      function derived(int count) public {
        for (int i = 0; i < count; i = i + 1) { this.values[i * 2 + 1] = i; }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.abi.find((handler) => handler.name === 'constructed')?.sortedUpsertLoopInfo)
      .toEqual([expect.objectContaining({ constructedKeyReplay: true })]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'constructed'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.abi.find((handler) => handler.name === 'derived')?.sortedUpsertLoopInfo)
      .toEqual([expect.not.objectContaining({ constructedKeyReplay: true })]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'derived'))
      .toMatchObject({ eligible: true });
  });

  it('fences multi-arm constructed-key joins while retaining a binary join', () => {
    const artifact = compileString(`contract Ledger() {
      mapping(int => int) values;
      function multi(int count, int mode, bool take) public {
        int[] keys = new int[](count);
        for (int i = 0; i < count; i = i + 1) {
          switch (mode) {
            case 0: if (take) keys[i] = i + 10; else keys[i] = i + 20; break;
            case 1: keys[i] = i + 30; break;
            default: keys[i] = i + 40;
          }
          this.values[keys[i]] = i;
        }
        require(true);
      }
      function binary(int count, bool take) public {
        int[] keys = new int[](count);
        for (int i = 0; i < count; i = i + 1) {
          if (take) keys[i] = i + 50; else keys[i] = i + 60;
          this.values[keys[i]] = i;
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.abi.find((handler) => handler.name === 'multi')?.sortedUpsertLoopInfo)
      .toEqual([expect.objectContaining({ multiArmConstructedKeyReplay: true })]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'multi'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.abi.find((handler) => handler.name === 'binary')?.sortedUpsertLoopInfo)
      .toEqual([expect.not.objectContaining({ multiArmConstructedKeyReplay: true })]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'binary'))
      .toMatchObject({ eligible: true });
  });

  it('fences a selection local assigned earlier in the same iteration but preserves a later update', () => {
    const artifact = compileString(`contract Ledger() {
      mapping(int => int) values;
      function current(int count) public {
        bool take = false;
        for (int i = 0; i < count; i = i + 1) {
          take = i % 3 == 0;
          if (take) this.values[i] = i;
          take = false;
        }
        require(true);
      }
      function later(int count) public {
        bool take = true;
        for (int i = 0; i < count; i = i + 1) {
          if (take) this.values[100 + i] = i;
          take = i % 3 == 0;
        }
        require(true);
      }
      function joined(int count) public {
        bool take = false;
        for (int i = 0; i < count; i = i + 1) {
          if (i % 2 == 0) take = true;
          else take = false;
          if (take) this.values[200 + i] = i;
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.abi.find((handler) => handler.name === 'current')?.sortedUpsertLoopInfo)
      .toEqual([expect.objectContaining({ sameIterationMutableSelectionReplay: true })]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'current'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.abi.find((handler) => handler.name === 'later')?.sortedUpsertLoopInfo)
      .toEqual([expect.not.objectContaining({ sameIterationMutableSelectionReplay: true })]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'later'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'joined')?.sortedUpsertLoopInfo)
      .toEqual([expect.not.objectContaining({ sameIterationMutableSelectionReplay: true })]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'joined'))
      .toMatchObject({ eligible: true });
  });

  it('fails closed when a stateless child recipient cannot be replayed from the row', () => {
    const artifact = compileString(`contract Capsule(int seed) {
      function open(int candidate) public pure { require(candidate == seed); }
    }
    contract Router() {
      int cursor;
      function place(int amount) public {
        Capsule child = new Capsule{value: amount}(this.cursor);
        require(address(child) != address(0));
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'place')?.eligible).not.toBe(true);
  });
});
