import { describe, expect, it } from 'vitest';
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

  it('refuses a transaction signature row as KERNEL_TX_SIGNATURE', () => {
    expect(denied(`contract C() {
      function denied(sig s) public { require(true); }
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

  it('refuses a public enum getter as KERNEL_LAYOUT and keeps siblings', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      enum Status { A, B }
      contract C {
        Status public last;
        function denied() public { last = Status.B; require(true); }
        function control() public { require(true); }
      }`, { ...KERNEL, solidityImportCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'last')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LAYOUT',
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('refuses a Rec[] result as KERNEL_LAYOUT and keeps siblings', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Rec { uint x; }
      contract C {
        Rec[] jobs;
        function denied() public view returns (Rec[] memory) { return jobs; }
        function control() public { require(true); }
      }`, { ...KERNEL, solidityImportCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LAYOUT',
    });
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

  it('refuses a counter-keyed mapping loop that also makes a typed call as KERNEL_UNBOUNDED_KEY', () => {
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
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
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

  it('admits a do-while counter-keyed mapping-only loop', () => {
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
      input.name.startsWith('__internal__vmapCounterPerm_'))).toBe(true);
  });

  it('refuses a do-while counter-keyed mapping loop that also makes a typed call as KERNEL_UNBOUNDED_KEY',
    () => {
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
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_UNBOUNDED_KEY',
      });
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

  it('leaves legacy reasons on non-kernel compiles', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract C() {
        function opaque() public { assembly { OP_1 OP_DROP } require(true); }
        function control() public { require(true); }
      }`, { forceStateful: true, messageBus: true });
    expect(artifact.messageBus!.handlers.find((handler) => handler.name === 'opaque')).toMatchObject({
      eligible: false,
      rejectionReason: 'opaque-assembly-effects-callManifest-ineligible',
    });
  });
});
