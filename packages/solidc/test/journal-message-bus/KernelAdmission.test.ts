import { describe, expect, it } from 'vitest';
import { bytecodeToAsm } from '@solidcash/utils';
import { compileString } from '../../src/compiler.js';

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

  it('authenticates a straight-line struct read-modify-write on a counter-keyed entry', () => {
    const artifact = compileString(`contract C() {
      struct Pair { int left; int right; }
      mapping(int => Pair) pairs;
      function update(int n) public {
        for (int i=0; i<n; i=i+1) { Pair pair=pairs[i]; pair.left=pair.left+1; pairs[i]=pair; }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'update'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'update')?.sortedUpsertLoopInfo).toEqual([
      expect.objectContaining({
        collection: 'pairs', valueRuntimeLocal: 'pair',
        oldValuesWitnessParam: expect.stringMatching(/^__internal__vmapCounterOld_/),
      }),
    ]);
    expect(artifact.abi.find((handler) => handler.name === 'update')?.inputs).toContainEqual(
      expect.objectContaining({ name: expect.stringMatching(/^__internal__vmapCounterOld_/), type: 'Pair[]' }),
    );
    expect(artifact.messageBus?.route.inputs).toContainEqual(expect.objectContaining({
      name: expect.stringMatching(/^__internal__vmapCounterOld_/), type: 'Pair[][]',
    }));
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
  it('admits field-shaped struct getters and dynamic struct-array results', () => {
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
      .toMatchObject({ eligible: true });
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

  it('lowers a scalar-state mutual recursion fold whose continuation precedes descent', () => {
    const artifact = compileString(`contract C() {
      int calls;
      mapping(int => int) values;
      function left(int n, int key) public returns (int) {
        this.calls = this.calls + 1;
        if (n == 0) return this.values[key];
        return n + right(n - 1, key);
      }
      function right(int n, int key) internal returns (int) {
        this.calls = this.calls + 1;
        if (n == 0) return this.values[key];
        return n + left(n - 1, key);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'left'))
      .toMatchObject({ eligible: true });
  });

  it.each([
    ['a persistent effect',
      'this.calls = this.calls + 1;',
      'return left(n - 1, key) + this.values[key];'],
    ['different continuation operators',
      '',
      'return left(n - 1, key) - this.values[key];'],
  ])('keeps a mutual recursion fold with %s behind KERNEL_LAYOUT', (_label, effect, rightReturn) => {
    const artifact = compileString(`contract C() {
      int calls;
      mapping(int => int) values;
      function left(int n, int key) public returns (int) {
        ${effect}
        if (n == 0) return this.values[key];
        return right(n - 1, key) + this.values[key];
      }
      function right(int n, int key) internal returns (int) {
        ${effect}
        if (n == 0) return this.values[key];
        ${rightReturn}
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'left'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('keeps a dynamic-state recursion fold behind KERNEL_LAYOUT', () => {
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
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
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
    expect(artifact.abi.find((entry) => entry.name === 'left')?.recursiveStateHandler).toBe(true);
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

  it('admits a transaction signature check with a code-local signature', () => {
    const artifact = compileString(`contract C(pubkey owner) {
      function denied() public { require(checkSig(sig(hex"00"), owner)); }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('admits a counter-keyed mapping loop via a hidden permutation witness', () => {
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
    expect(denied(`contract C(address impl) {
      function denied(bytes input) public {
        impl.delegatecall(input);
        require(true);
      }
      function control() public { require(true); }
    }`, 'denied')).toMatchObject({
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
    ['literal-depth local pick', 'OP_7 OP_0 OP_PICK OP_NUMEQUALVERIFY'],
    ['pushed-depth local pick', '07 00 OP_PICK OP_NUMEQUALVERIFY'],
    ['balanced local alt-stack use', 'OP_1 OP_TOALTSTACK OP_FROMALTSTACK OP_DROP'],
    ['pure data hashing', 'OP_1 OP_SHA256 OP_DROP'],
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
    ['transaction signature check', 'OP_0 OP_0 OP_CHECKSIG OP_DROP'],
    ['active-bytecode signature context', 'OP_ACTIVEBYTECODE OP_DROP'],
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
        assembly { OP_ACTIVEBYTECODE OP_DROP }
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

  it('refuses a deploy-in-handler as KERNEL_LAYOUT', () => {
    expect(denied(`contract Child() { }
      contract C() {
        function denied() public { Child child = new Child(); require(true); }
        function control() public { require(true); }
      }`, 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LAYOUT',
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
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'writeValueCopy'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'deniedMemoryAlias'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('replays distinct memory aliases with source-ordered cross-array reads', () => {
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
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'leftSlots' }),
        expect.objectContaining({ collection: 'rightSlots' }),
      ]));
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'aliased'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'crossRead'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'direct'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'lengthRead'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'transitive'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'transitive')?.sortedUpsertLoopInfo)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'leftSlots' }),
        expect.objectContaining({ collection: 'rightSlots' }),
      ]));
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'transitiveCopy'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'capturedReturn'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'nestedCapturedReturn'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'conditionalReturn'))
      .toMatchObject({ eligible: true });
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

  it('replays a runtime-selected break in a literal-bounded pure helper loop', () => {
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
      .toMatchObject({ eligible: true });
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

  it('replays one straight-line constructed-array push per canonical loop iteration', () => {
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
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo)
      .toEqual([expect.objectContaining({
        collection: 'slots',
        varyingKeyExpressions: [expect.objectContaining({ kind: 'ternary' })],
      })]);
  });

  it('replays a fixed number of straight-line constructed-array pushes per canonical iteration', () => {
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
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo)
      .toHaveLength(2);
  });

  it('replays fixed and invariant variable-width conditional resizes per canonical iteration', () => {
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
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'choose'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'trim'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'trimVariableWidth'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pushVariableWidth'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pushVariableSwitch'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pushLoopLocals'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pushJoinedLocals'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pushSwitchLocals'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pushOptional'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'trimOptional'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'trimVariableSwitch'))
      .toMatchObject({ eligible: true });
  });

  it('replays an initial constructed-array prefix before the current iteration pushes', () => {
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
      .toMatchObject({ eligible: true });
  });

  it('replays a fixed number of straight-line constructed-array pops per canonical iteration', () => {
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
      .toMatchObject({ eligible: true });
  });

  it.each([
    ['pops into its pre-existing prefix before pushing', 'xs.pop(); xs.push(i + 1); this.slots[xs[i]] = i;'],
    ['conditionally pops inside the loop', 'if (i > 0) xs.pop(); this.slots[xs[i]] = i;'],
  ])('refuses a constructed array which %s', (_label, body) => {
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
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('replays a path-balanced transient push/pop schedule independently per iteration', () => {
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
      .toMatchObject({ eligible: true });
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

  it('derives a switch-initialized same-iteration local array key', () => {
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
      .toMatchObject({ eligible: true });
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
        function denied() public { assembly { OP_ACTIVEBYTECODE OP_DROP } require(true); }
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
      .toMatchObject({ eligible: true });
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
  ])('admits a replayable runtime %s counter step', (_label, start, comparison, operator, stride, kind) => {
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

  it('authenticates a canonical counter loop read from another mapping', () => {
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
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'denied')?.sortedUpsertLoopInfo)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'b', op: 'read' }),
        expect.objectContaining({ collection: 'a', op: 'set' }),
      ]));
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it.each(['bool', 'fixed128x18', 'bytes20', 'address', 'pubkey', 'datasig'])(
    'authenticates a canonical counter loop read of %s values', (type) => {
      const artifact = compileString(`contract C() {
        mapping(int => ${type}) source;
        mapping(int => ${type}) destination;
        function copy(int n) public {
          for (int i = 0; i < n; i = i + 1) { this.destination[i] = this.source[i]; }
          require(true);
        }
      }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'copy'))
        .toMatchObject({ eligible: true });
      const read = artifact.abi.find((handler) => handler.name === 'copy')?.sortedUpsertLoopInfo
        ?.find((info) => info.collection === 'source');
      expect(read).toMatchObject({ op: 'read' });
      expect(artifact.abi.find((handler) => handler.name === 'copy')?.inputs)
        .toContainEqual(expect.objectContaining({ name: read!.oldValuesWitnessParam, type: `${type}[]` }));
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
      .toMatchObject({ eligible: true });
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
      .toMatchObject({ eligible: true });
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
      .toMatchObject({ eligible: true });
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

  it('lowers a serializable compound counter key and its repeated effect onto the runtime streams', () => {
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
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'denied')?.sortedUpsertLoopInfo)
      .toEqual([expect.objectContaining({
        collection: 'keyed',
        varyingKeyExpressions: [expect.objectContaining({ kind: 'binary', operator: '+' })],
      })]);
    expect(artifact.abi.find((handler) => handler.name === 'denied')?.runtimeLoopTransfers)
      .toEqual([expect.objectContaining({ siteKinds: ['token'], tokenContainerSlots: [0] })]);
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

  it('publishes independent permutations across collections with different invariant key prefixes', () => {
    const artifact = compileString(`contract C() {
      mapping(int => mapping(int => int)) a;
      mapping(int => mapping(int => int)) b;
      function write(int n, int left, int right) public {
        for (int i = 0; i < n; i = i + 1) { this.a[left][i] = 1; this.b[right][i] = 2; }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
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
    ): { handlerWitness?: string; routeWitness?: string; ordinals?: number[] } => ({
      handlerWitness: artifact.abi.find((candidate) => candidate.name === operation)?.inputs
        .find((input) => input.name === '__internal__kernelJournalAccessStreams')?.type,
      routeWitness: artifact.messageBus?.route.inputs
        .find((input) => input.name === '__internal__kernelJournalAccessStreams')?.type,
      ordinals: artifact.abi.find((candidate) => candidate.name === operation)?.sortedUpsertLoopInfo
        ?.map((info) => info.journalAccessStreamIndex),
    });
    const ledger = compileRenamed('Ledger', 'credits', 'debits', 'reconcile');
    const registry = compileRenamed('Registry', 'primary', 'secondary', 'apply');

    expect(streamShape(ledger, 'reconcile')).toEqual({
      handlerWitness: 'bytes[]', routeWitness: 'bytes[][]', ordinals: [0, 1],
    });
    expect(streamShape(registry, 'apply')).toEqual(streamShape(ledger, 'reconcile'));
  });

  it('publishes independent permutations for different selected subsets across collections', () => {
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
      .toMatchObject({ eligible: true });
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

  it('publishes a counter-derived local assigned before its guarded write', () => {
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
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo?.[0]
      .iterationCondition).toMatchObject({ kind: 'binary', operator: '==' });
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
    expect(info?.iterationCondition).toMatchObject({ kind: 'ternary' });
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

  it('publishes site-specific loop-carried values observed on both sides of an assignment', () => {
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
      .toMatchObject({ eligible: true });
    const conditions = artifact.abi.find((handler) => handler.name === 'denied')?.sortedUpsertLoopInfo
      ?.map((info) => info.iterationCondition);
    expect(conditions).toHaveLength(2);
    expect(conditions?.[0]).not.toEqual(conditions?.[1]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')
      ?.eligible).toBe(true);
  });

  it('replays site-specific mapping values observed on both sides of an assignment', () => {
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

  it('replays site-specific event predicates observed on both sides of an assignment', () => {
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
      .toMatchObject({ eligible: true });
    const conditions = artifact.messageBus?.handlers.find((handler) => handler.name === 'write')
      ?.runtimeLoopEvents?.[0].conditions;
    expect(conditions).toHaveLength(2);
    expect(conditions?.[0]).not.toEqual(conditions?.[1]);
  });

  it('replays site-specific transfer predicates observed on both sides of an assignment', () => {
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
      .toMatchObject({ eligible: true });
    const conditions = artifact.messageBus?.handlers.find((handler) => handler.name === 'write')
      ?.runtimeLoopTransfers?.[0].conditions;
    expect(conditions).toHaveLength(2);
    expect(conditions?.[0]).not.toEqual(conditions?.[1]);
  });

  it('replays a write whose fallthrough combines differently phased break predicates', () => {
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
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'write')?.sortedUpsertLoopInfo?.[0])
      .toMatchObject({
        iterationCondition: { kind: 'binary', operator: '&&' },
        iterationBreakCondition: { kind: 'binary', operator: '||' },
      });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write')
      ?.runtimeLoopEvents?.[0].conditions?.[0]).toMatchObject({ kind: 'binary', operator: '&&' });
  });

  it('replays a transfer after differently phased break predicates', () => {
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
    expect(handler).toMatchObject({ eligible: true });
    expect(handler?.runtimeLoopTransfers?.[0].conditions?.[0])
      .toMatchObject({ kind: 'binary', operator: '&&' });
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

  it('keeps a transaction-signature result off the kernel route', () => {
    const artifact = compileString(`contract C() {
      function echo(sig value) public pure returns (sig) { return value; }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'echo'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
  });

  it('captures a Rec[] result through the recursive ABI encoder', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Rec { uint x; }
      contract C {
        Rec[] records;
        function denied() public view returns (Rec[] memory) { return records; }
        function control() public { require(true); }
      }`, { ...KERNEL, solidityImportCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
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

  it('admits Solidity address.transfer as a satoshi-transfer effect', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract C {
        function denied(address payable to) public { to.transfer(1); require(true); }
        function control() public { require(true); }
      }`, { ...KERNEL, solidityImportCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('admits Solidity address.send as a satoshi-transfer effect', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract C {
        function denied(address payable to) public { require(to.send(1)); }
        function control() public { require(true); }
      }`, { ...KERNEL, solidityImportCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
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
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('admits address.transfer inside an internal helper', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract C {
        function _pay(address payable to) internal { to.transfer(1); }
        function denied(address payable to) public { _pay(to); require(true); }
        function control() public { require(true); }
      }`, { ...KERNEL, solidityImportCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
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
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
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

  it('admits a counter-keyed loop that writes two mappings', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) a;
      mapping(int => int) b;
      function denied(int n) public {
        for (int i = 0; i < n; i = i + 1) { this.a[i] = 1; this.b[i] = 2; }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.messageBus?.route.inputs.some((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))).toBe(true);
    const streams = artifact.abi.find((handler) => handler.name === 'denied')?.sortedUpsertLoopInfo ?? [];
    expect(streams).toHaveLength(2);
    expect(new Set(streams.map((stream) => stream.journalExecutionGroup)).size).toBe(1);
  });

  it('admits independently sorted key shapes in one physical collection', () => {
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
      .toMatchObject({ eligible: true });
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
      .toMatchObject({ eligible: true });
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
      .toMatchObject({ eligible: true });
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
    expect(deniedHandler?.emits).toBeUndefined();
    expect(deniedHandler?.runtimeLoopEvents).toEqual([
      { repeatCount: 1, eventSignatures: ['Before(int256)'] },
      {
        permutationParam: expect.stringMatching(/^__internal__vmapCounterPerm_n_/),
        eventSignatures: ['Hit(int256)'],
      },
      { repeatCount: 1, eventSignatures: ['After(int256)'] },
    ]);
    expect(artifact.messageBus?.route.blockLayout?.trailingCapacity).toBe(130);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('keeps an inlined effectful helper result adjacent to a repeated event', () => {
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
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.runtimeLoopEvents)
      .toEqual([expect.objectContaining({
        permutationParam: expect.stringMatching(/^__internal__vmapCounterPerm_n_/),
        eventSignatures: ['Hit(int256)'],
      })]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('sizes sequential loops and multiple event sites from their construct widths', () => {
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
    expect(handler).toMatchObject({ eligible: true });
    expect(handler?.runtimeLoopEvents).toEqual([
      {
        permutationParam: expect.stringMatching(/^__internal__vmapCounterPerm_left_/),
        eventSignatures: ['A(int256)', 'B(int256)'],
      },
      { repeatCount: 1, eventSignatures: ['A(int256)'] },
      {
        permutationParam: expect.stringMatching(/^__internal__vmapCounterPerm_right_/),
        eventSignatures: ['B(int256)'],
      },
    ]);
    // (one mapping + two events) + (one mapping + one event), each independently bounded to 64 iterations,
    // plus the exact one-record segment between them.
    expect(artifact.messageBus?.route.blockLayout?.trailingCapacity).toBe(5 * 64 + 1);
  });

  it('keeps loop events on direct calls while the legacy bus refuses the runtime row shape', () => {
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
    expect(kernel.messageBus?.handlers.find((candidate) => candidate.name === 'write')?.eligible).toBe(true);
  });

  it('publishes a runtime predicate for a conditionally repeated event', () => {
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
      eligible: true,
      runtimeLoopEvents: [{
        permutationParam: expect.stringMatching(/^__internal__vmapCounterPerm_n_/),
        eventSignatures: ['Hit(int256)'],
        conditions: [{ kind: 'source', source: { kind: 'forward', paramIndex: 1 } }],
      }],
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('publishes path metadata for a conditional event outside the loop', () => {
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
      eligible: true,
      runtimeLoopEvents: [
        {
          repeatCount: 1,
          eventSignatures: ['Hit(int256)'],
          conditions: [{ kind: 'source', source: { kind: 'forward', paramIndex: 1 } }],
        },
        {
          permutationParam: expect.stringMatching(/^__internal__vmapCounterPerm_n_/),
          eventSignatures: ['Hit(int256)'],
        },
      ],
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('publishes a stable pre-state event predicate without contract-specific shape knowledge', () => {
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
      eligible: true,
      runtimeLoopEvents: [{
        conditions: [{ kind: 'state', name: 'enabled' }],
      }],
    });
  });

  it('serializes array length and element access in a counter event predicate', () => {
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
    const condition = artifact.messageBus?.handlers.find((handler) => handler.name === 'write')
      ?.runtimeLoopEvents?.[0].conditions?.[0];
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write')?.eligible).toBe(true);
    expect(condition).toMatchObject({
      kind: 'binary',
      operator: '&&',
      left: {
        kind: 'binary',
        operator: '<',
        right: { kind: 'unary', operator: '.length' },
      },
      right: { kind: 'arrayAccess' },
    });
  });

  it('publishes an event predicate from a dominating scalar-state assignment', () => {
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
    expect(handler).toMatchObject({ eligible: true });
    expect(handler?.runtimeLoopEvents?.[0].conditions).toEqual([{
      kind: 'source', source: { kind: 'forward', paramIndex: 1 },
    }]);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'control')?.eligible).toBe(true);
  });

  it('orders an inlined internal-helper event with the runtime event stream', () => {
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
    expect(handler?.emits).toBeUndefined();
    expect(handler?.runtimeLoopEvents).toEqual([
      { repeatCount: 1, eventSignatures: ['Hit(int256)'] },
      {
        permutationParam: expect.stringMatching(/^__internal__vmapCounterPerm_n_/),
        eventSignatures: ['Hit(int256)'],
      },
    ]);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'control')?.eligible).toBe(true);
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

  it('admits a repeated BCH transfer inside a counter-keyed mapping loop', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function denied(int n, bytes to) public {
        for (int i = 0; i < n; i = i + 1) { this.m[i] = 1; this.transfer(to, 1); }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'denied')?.runtimeLoopTransfers)
      .toEqual([expect.objectContaining({ siteCount: 1 })]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('admits a repeated fungible-token transfer inside a counter-keyed mapping loop', () => {
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
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'denied')?.runtimeLoopTransfers)
      .toEqual([expect.objectContaining({
        siteCount: 1, siteKinds: ['token'], tokenContainerSlots: [0],
      })]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('admits a repeated NFT transfer inside a counter-keyed mapping loop', () => {
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
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((handler) => handler.name === 'denied')?.runtimeLoopTransfers)
      .toEqual([expect.objectContaining({
        siteCount: 1, siteKinds: ['nft'], tokenContainerSlots: [0],
      })]);
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
      function denied() public { assembly { OP_ACTIVEBYTECODE OP_DROP } require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.available).toBe(false);
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.every((handler) => handler.eligible === false)).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.rejectionReason)
      .toBe('KERNEL_OPAQUE_EFFECT');
  });
});
