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
  it('authenticates a straight-line struct read-modify-write on a counter-keyed entry', () => {
    const artifact = compileString(`contract C() {
      struct Pair { int left; int right; }
      mapping(int => Pair) pairs;
      function update(int n) public {
        for (int i=0; i<n; i=i+1) { Pair pair=pairs[i]; pair.left=pair.left+1; pairs[i]=pair; }
        require(true);
      }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
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
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'signed')?.eligible).toBe(true);
    expect(artifact.messageBus?.route.inputs).toContainEqual(expect.objectContaining({
      name: '__message_bus_sig_0_0_rows', type: 'sig[]',
    }));
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

  it('does not reorder an effectful helper used as a counter-loop mapping value', () => {
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
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
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
      bytes20 worker;
      function refund(int id) public {
        bytes20[] xs = new bytes20[](1);
        xs[0] = this.worker;
        for (int i = 0; i < xs.length; i = i + 1) {
          this.seen[id][xs[i]] = 0;
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'refund')).toMatchObject({
      eligible: true,
    });
  });

  it('admits an expression-keyed parameter-array mapping loop', () => {
    const artifact = compileString(`contract C() {
      mapping(int => mapping(bytes20 => int)) seen;
      int[] jobs;
      function create(bytes20[] workers) public {
        this.jobs.push(0);
        int id = this.jobs.length - 1;
        for (int i = 0; i < int(workers.length); i = i + 1) {
          this.seen[id][workers[i]] = 1;
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

  it('refuses a native low-level call as KERNEL_OPAQUE_EFFECT', () => {
    expect(denied(`contract C(address target) {
      function denied(bytes data) public {
        target.call(data);
        require(true);
      }
      function control() public { require(true); }
    }`, 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_OPAQUE_EFFECT',
    });
  });

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

  it('keeps a captured reassigned parameter out of a local key recipe', () => {
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
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
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
    ['a mutated public bound', `n = n - 1;
      for (int i = 0; i < n; i = i + 1) { this.m[i] = i; }`],
    ['a reassigned local bound', `int limit = n; limit = n - 1;
      for (int i = 0; i < limit; i = i + 1) { this.m[i] = i; }`],
    ['a sibling read of the mutated mapping', `for (int i = 0; i < n; i = i + 1) {
      int before = this.m[0]; this.m[i] = before + 1;
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

  it('refuses a canonical counter loop with a counter-dependent read from another mapping', () => {
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
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
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

  it('refuses a computed loop key whose parameter dependency is reassigned', () => {
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
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
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

  it('refuses a non-replayable loop-carried local guard', () => {
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
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
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

  it('captures a Rec[] result through the recursive ABI encoder', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Rec { uint x; }
      contract C {
        Rec[] jobs;
        function denied() public view returns (Rec[] memory) { return jobs; }
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

  it('refuses an effectful helper used to compute a repeated event argument', () => {
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
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
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
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
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

  it('refuses a loop predicate after a non-dominating scalar-state assignment', () => {
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
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
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

  it('refuses a repeated BCH transfer inside a counter-keyed mapping loop', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function denied(int n, bytes to) public {
        for (int i = 0; i < n; i = i + 1) { this.m[i] = 1; this.transfer(to, 1); }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('refuses a repeated token transfer inside a counter-keyed mapping loop', () => {
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
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
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
