import { describe, expect, it } from 'vitest';
import { compileString } from '../../../solidc/src/index.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

async function deploy(source: string) {
  const artifact = compileString(source, { forceStateful: true, solidityImportCompat: true });
  return getContractFactory(artifact, await fundedSigner()).deploy();
}

describe('Solidity corpus behavioral parity', () => {
  // test/libsolidity/semanticTests/freeFunctions/easy.sol
  // The file-level add(7, 2) path returns 9 upstream.
  it('executes a file-level free function from a contract function', async () => {
    const contract = await deploy(`function add(uint a, uint b) pure returns (uint) { return a + b; }
    contract C {
      function verify(uint x) public { require(add(x, 2) == 9); }
      function verifyWrong(uint x) public { require(add(x, 2) == 10); }
    }`);
    await expect(contract.verify(7n)).resolves.toBeDefined();
    await expect(contract.verifyWrong(7n)).rejects.toThrow();
  });

  // test/libsolidity/semanticTests/using/free_function_multi.sol
  // Attached file-level functions preserve 10 through id() and map it to 0 through zero().
  it('executes multiple file-level functions attached with using-for', async () => {
    const contract = await deploy(`function id(uint x) pure returns (uint) { return x; }
    function zero(uint) pure returns (uint) { return 0; }
    contract C {
      using {id, zero} for uint;
      function verify(uint z) public { require(z.id() == z && z.zero() == 0); }
      function verifyWrong(uint z) public { require(z.zero() == z); }
    }`);
    await expect(contract.verify(10n)).resolves.toBeDefined();
    await expect(contract.verifyWrong(10n)).rejects.toThrow();
  });

  // test/libsolidity/semanticTests/conversions/string_to_bytes.sol
  // bytes("Hello") retains the five UTF-8 bytes unchanged.
  it('executes a string-to-bytes memory conversion', async () => {
    const contract = await deploy(`contract C {
      function verify(string memory s) public {
        bytes memory value = bytes(s);
        require(value == hex"48656c6c6f");
      }
      function verifyWrong(string memory s) public { require(bytes(s) == hex"48656c6c6e"); }
    }`);
    await expect(contract.verify('Hello')).resolves.toBeDefined();
    await expect(contract.verifyWrong('Hello')).rejects.toThrow();
  });

  // test/libsolidity/semanticTests/constants/constant_string.sol
  // The upstream getters return identical 0x030102 byte constants and the bytes of "hello".
  it('executes byte and string constants without changing their contents', async () => {
    const contract = await deploy(`contract C {
      bytes constant a = "\\x03\\x01\\x02";
      bytes constant b = hex"030102";
      string constant c = "hello";
      function verify() public { require(a == b && bytes(c) == hex"68656c6c6f"); }
      function verifyWrong() public { require(a == hex"030103"); }
    }`);
    await expect(contract.verify()).resolves.toBeDefined();
    await expect(contract.verifyWrong()).rejects.toThrow();
  });

  // test/libsolidity/semanticTests/operators/compound_assign.sol
  // The upstream spending path calls f repeatedly and observes 7, 0x23, then 0x746.
  it('executes compound assignments against persistent and local values', async () => {
    const contract = await deploy(`contract C {
      uint value1; uint value2;
      function f(uint x, uint y) internal returns (uint) {
        uint value3 = y;
        value1 += x;
        value3 *= x;
        value2 *= value3 + value1;
        return value2 += 7;
      }
      function verify() public {
        require(f(0, 6) == 7);
        require(f(1, 3) == 0x23);
        require(f(2, 25) == 0x746);
      }
      function verifyWrong() public { require(f(0, 6) == 8); }
    }`);
    await expect(contract.verify()).resolves.toBeDefined();
    const wrong = await deploy(`contract C {
      uint value1; uint value2;
      function f(uint x, uint y) internal returns (uint) { value1 += x; value2 *= y + value1; return value2 += 7; }
      function verifyWrong() public { require(f(0, 6) == 8); }
    }`);
    await expect(wrong.verifyWrong()).rejects.toThrow();
  });

  // test/libsolidity/semanticTests/inheritance/constructor_inheritance_init_order.sol
  // Solidity constructs A first and uses A.x == 42 for B.y's initializer.
  it('executes inherited constructor initialization in base-to-derived order', async () => {
    const contract = await deploy(`contract A {
      uint x;
      constructor() { x = 42; }
      function f() internal returns (uint) { return x; }
    }
    contract B is A {
      uint y = f();
      function verify() public { require(y == 42); }
      function verifyWrong() public { require(y == 41); }
    }`);
    await expect(contract.verify()).resolves.toBeDefined();
    await expect(contract.verifyWrong()).rejects.toThrow();
  });

  // test/libsolidity/semanticTests/modifiers/evaluation_order.sol
  // Solidity records constructor/modifier arguments in the order 4, 2, 6, 1, 3, 5, then the body value 7.
  it('executes base-constructor and modifier-argument evaluation in Solidity order', async () => {
    const contract = await deploy(`contract A { constructor(uint) {} }
    contract B { constructor(uint) {} }
    contract BaseC { constructor(uint) {} }
    contract D is A, B, BaseC {
      uint order;
      constructor() m2(record(1)) B(record(2)) m1(record(3)) BaseC(record(4)) m3(record(5)) A(record(6)) {
        record(7);
      }
      modifier m1(uint) { _; }
      modifier m2(uint) { _; }
      modifier m3(uint) { _; }
      // Reset on the first Solidity-ordered value so SDK constructor commitment derivation remains idempotent.
      function record(uint value) internal returns (uint) {
        order = value == 4 ? 4 : order * 10 + value;
        return 0;
      }
      function verify() public { require(order == 4261357); }
      function verifyWrong() public { require(order == 1234567); }
    }`);
    await expect(contract.verify()).resolves.toBeDefined();
    await expect(contract.verifyWrong()).rejects.toThrow();
  });

  // test/libsolidity/semanticTests/functionCall/call_attached_library_function_on_string.sol
  // Both the storage and memory receiver paths return 3 upstream.
  it('executes an attached library function on string receivers', async () => {
    const contract = await deploy(`library D {
      function length(string memory self) internal returns (uint) { return bytes(self).length; }
    }
    contract C {
      using D for string;
      string x;
      function verify() public {
        x = "abc";
        string memory s = "abc";
        require(x.length() == 3);
        require(s.length() == 3);
      }
      function verifyWrong() public { string memory s = "abc"; require(s.length() == 4); }
    }`);
    await expect(contract.verify()).resolves.toBeDefined();
    await expect(contract.verifyWrong()).rejects.toThrow();
  });

  // test/libsolidity/semanticTests/libraries/attached_internal_library_function_accepting_calldata.sol
  // Solidity calls both the calldata and memory overloads with "abcd" and obtains bytes1("a") from each.
  it('executes attached library functions across calldata and memory locations', async () => {
    const contract = await deploy(`library D {
      function f(bytes calldata x) internal pure returns (bytes1) { return x[0]; }
      function g(bytes memory x) internal pure returns (bytes1) { return x[0]; }
    }
    contract C {
      using D for bytes;
      function verify(bytes calldata x) public {
        require(x.f() == bytes1(0x61));
        require(x.g() == bytes1(0x61));
      }
      function verifyWrong(bytes calldata x) public { require(x.f() == bytes1(0x62)); }
    }`);
    const abcd = new TextEncoder().encode('abcd');
    await expect(contract.verify(abcd)).resolves.toBeDefined();
    await expect(contract.verifyWrong(abcd)).rejects.toThrow();
  });

  // test/libsolidity/semanticTests/structs/memory_struct_named_constructor.sol
  // The named constructor intentionally supplies fields out of declaration order and returns (8, true).
  it('executes a named memory-struct constructor with field reordering', async () => {
    const contract = await deploy(`contract C {
      struct S { uint a; bool x; }
      function verify() public {
        S memory s = S({x: true, a: 8});
        require(s.a == 8 && s.x);
      }
      function verifyWrong() public { S memory s = S({x: true, a: 8}); require(s.a == 9); }
    }`);
    await expect(contract.verify()).resolves.toBeDefined();
    await expect(contract.verifyWrong()).rejects.toThrow();
  });

  // test/libsolidity/semanticTests/abicoder/abi_decode_from_memory_struct_v2.sol
  // The upstream path round-trips S(8, [9, 10, 11]) through abi.encode/abi.decode.
  it('executes an ABI round-trip containing a struct and dynamic array', async () => {
    const contract = await deploy(`pragma abicoder v2;
    contract C {
      struct S { uint a; uint[] b; }
      function verify() public {
        S memory s;
        s.a = 8;
        s.b = new uint[](3);
        s.b[0] = 9; s.b[1] = 10; s.b[2] = 11;
        S memory decoded = abi.decode(abi.encode(s), (S));
        require(decoded.a == 8 && decoded.b.length == 3
          && decoded.b[0] == 9 && decoded.b[1] == 10 && decoded.b[2] == 11);
      }
      function verifyWrong() public { require(abi.decode(abi.encode(uint(8)), (uint)) == 9); }
    }`);
    await expect(contract.verify()).resolves.toBeDefined();
    await expect(contract.verifyWrong()).rejects.toThrow();
  });

  // test/libsolidity/semanticTests/events/emit_two_identical_events.sol
  // The upstream transaction emits two distinct Terminated logs from one call.
  it('executes and decodes two identical event emissions', async () => {
    const contract = await deploy(`contract C {
      event Terminated();
      function terminate() public { emit Terminated(); emit Terminated(); require(true); }
    }`);
    const receipt = await (await contract.call.terminate().send()).wait!();
    expect(receipt.events?.map((event) => event.event)).toEqual(['Terminated', 'Terminated']);
  });

  // test/libsolidity/semanticTests/errors/require_error_condition_evaluated_only_once.sol
  // g(false) must revert the spend without persisting its increment; g(true) increments exactly once.
  it('evaluates a custom-error require condition once and rolls failed state back', async () => {
    const source = `contract C {
      uint counter;
      error CustomError(uint value);
      function g(bool condition) internal returns (bool) { counter++; return condition; }
      function f(bool condition) public { require(g(condition), CustomError(counter)); }
    }`;
    const failing = await deploy(source);
    await expect(failing.f(false)).rejects.toThrow();
    expect((await failing.getState()).counter).toBe(0n);

    const succeeding = await deploy(source);
    await expect(succeeding.f(true)).resolves.toBeDefined();
    expect((await succeeding.getState()).counter).toBe(1n);
  });
});
