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

  it('refuses a transaction signature-array row as KERNEL_TX_SIGNATURE', () => {
    expect(denied(`contract C() {
      function denied(sig[] signatures) public { require(true); }
      function control() public { require(true); }
    }`, 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_TX_SIGNATURE',
    });
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
    expect(artifact.messageBus?.route.inputs.some((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))).toBe(true);
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

  it('refuses opaque assembly effects as KERNEL_OPAQUE_EFFECT', () => {
    expect(denied(`pragma solidcash >=0.8.0;
      contract C() {
        function denied() public { assembly { OP_1 OP_DROP } require(true); }
        function control() public { require(true); }
      }`, 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_OPAQUE_EFFECT',
    });
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

  it('names KERNEL_UNBOUNDED_KEY for a runtime-constructed key array and still compiles siblings', () => {
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
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')).toMatchObject({
      eligible: true,
    });
  });

  it('publishes KERNEL_* handlers when every entry point is refused', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract C() {
        function denied() public { assembly { OP_1 OP_DROP } require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_OPAQUE_EFFECT',
    });
  });

  it('refuses a continue/break counter-keyed mapping loop as KERNEL_UNBOUNDED_KEY', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      function denied(int n) public {
        for (int i = 0; i < n; i = i + 1) {
          if (i == 0) { continue; }
          if (i == 3) { break; }
          this.m[i] = i;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')).toMatchObject({
      eligible: true,
    });
  });

  it.each([
    ['a nonzero counter start', 'for (int i = 1; i < n; i = i + 1) { this.m[i] = i; }'],
    ['a non-unit counter step', 'for (int i = 0; i < n; i = i + 2) { this.m[i] = i; }'],
    ['an extra post-test counter mutation', `int i = 0; do {
      this.m[i] = i; i = n; i = i + 1;
    } while (i < n);`],
    ['a mutated public bound', `n = n - 1;
      for (int i = 0; i < n; i = i + 1) { this.m[i] = i; }`],
    ['a local rather than public bound', 'int limit = n; for (int i = 0; i < limit; i = i + 1) { this.m[i] = i; }'],
    ['a counter-dependent write guard', `for (int i = 0; i < n; i = i + 1) {
      if (i < 2) this.m[i] = 1; else this.m[i] = 2;
    }`],
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

  it('refuses an early return from a counter-keyed mapping loop', () => {
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
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it.each([
    ['a loop-local value alias', 'int value = i + 10; this.a[i] = value;'],
    ['a loop-carried local value', 'running = running + 1; this.a[i] = running;'],
    ['loop-carried scalar state', 'this.total = this.total + 1; this.a[i] = this.total;'],
    ['a counter-dependent read from another mapping', 'this.a[i] = this.b[i];'],
  ])('refuses a canonical counter loop with %s', (_label, statement) => {
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

  it('refuses two independently settled counter loops in one handler', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) a;
      function denied(int n) public {
        for (int i = 0; i < n; i = i + 1) { this.a[i] = 1; }
        for (int j = 0; j < n; j = j + 1) { this.a[j] = 2; }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
    expect(artifact.abi.find((handler) => handler.name === 'denied')?.inputs.filter((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))).toHaveLength(0);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('refuses an invariant mapping write beside a counter-keyed write in the physical loop', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) keyed;
      mapping(int => int) invariant;
      function denied(int n, int owner) public {
        for (int i = 0; i < n; i = i + 1) { this.keyed[i] = i; this.invariant[owner] = i; }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
    expect(artifact.abi.find((handler) => handler.name === 'denied')?.inputs.some((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))).toBe(false);
  });

  it('refuses one permutation for mapping writes with different composite key tuples', () => {
    const artifact = compileString(`contract C() {
      mapping(int => mapping(int => int)) a;
      mapping(int => mapping(int => int)) b;
      function denied(int n, int left, int right) public {
        for (int i = 0; i < n; i = i + 1) { this.a[left][i] = 1; this.b[right][i] = 2; }
        require(true);
      }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
    expect(artifact.abi.find((handler) => handler.name === 'denied')?.inputs.some((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))).toBe(false);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it.each([
    ['a loop-carried local guard', `bool take = true;
      for (int i = 0; i < n; i = i + 1) {
        if (take) this.m[i] = i;
        take = !take;
      }`],
    ['a loop-defined alias guard', `for (int i = 0; i < n; i = i + 1) {
        bool take = i < 2;
        if (take) this.m[i] = i;
      }`],
    ['the counter in two composite-key positions', `for (int i = 0; i < n; i = i + 1) {
        this.nested[i][i] = 1;
      }`],
    ['the counter in an additional composite-key expression', `for (int i = 0; i < n; i = i + 1) {
        this.nested[i + 1][i] = 1;
      }`],
  ])('refuses one physical permutation with %s', (_label, body) => {
    const artifact = compileString(`contract C() {
      mapping(int => int) m;
      mapping(int => mapping(int => int)) nested;
      function denied(int n) public { ${body} require(true); }
      function control() public { require(true); }
    }`, { ...KERNEL, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
    expect(artifact.abi.find((handler) => handler.name === 'denied')?.inputs.some((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))).toBe(false);
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

  it('refuses a repeated event inside a counter-keyed mapping loop', () => {
    const artifact = compileString(`event Hit(int i);
      contract C() {
        mapping(int => int) m;
        function denied(int n) public {
          for (int i = 0; i < n; i = i + 1) { this.m[i] = 1; emit Hit(i); }
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
      function denied() public { assembly { OP_1 OP_DROP } require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.available).toBe(false);
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.every((handler) => handler.eligible === false)).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.rejectionReason)
      .toBe('KERNEL_OPAQUE_EFFECT');
  });
});
