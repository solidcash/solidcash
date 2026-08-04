import { describe, expect, it } from 'vitest';
import { compileString } from '../../../solidc/src/index.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

async function deploy(source: string) {
  const artifact = compileString(source, { forceStateful: true, solidityImportCompat: true });
  return getContractFactory(artifact, await fundedSigner()).deploy();
}

describe('Solidity corpus behavioral parity', () => {
  // test/libsolidity/semanticTests/statements/empty_for_loop.sol
  // test/libsolidity/semanticTests/functionSelector/function_selector_via_contract_name.sol
  // test/libsolidity/semanticTests/metaTypes/name_other_contract.sol
  // test/libsolidity/semanticTests/accessor/accessor_for_const_state_variable.sol
  // test/libsolidity/semanticTests/accessor/accessor_for_state_variable.sol
  // test/libsolidity/semanticTests/types/assign_calldata_value_type.sol
  // One deployment checks the independent language paths while keeping corpus runtime overhead low.
  it('executes consolidated control-flow, metadata, accessor, and calldata-value parity', async () => {
    const contract = await deploy(`interface A {
      function f() external;
      function g(uint256 value) external;
    }
    interface B {
      function f() external;
      function g(uint256 value) external;
    }
    interface I { function ping() external; }
    contract C {
      uint256 public constant constantTicketPrice = 555;
      uint256 public ticketPrice = 500;

      function verify() public {
        uint ret = 1;
        for (;;) { ret += 1; if (ret >= 10) break; }
        require(ret == 10);
        require(A.f.selector == B.f.selector && A.g.selector == B.g.selector);
        require(type(C).name == "C" && type(A).name == "A" && type(I).name == "I");
      }

      function copy(uint256 x) public {
        uint256 original = x;
        x = 42;
        require(x == 42 && original == 23);
      }
    }`);
    await expect(contract.verify()).resolves.toBeDefined();
    await expect(contract.copy(23n)).resolves.toBeDefined();
    await expect(contract.constantTicketPrice()).resolves.toBe(555n);
    await expect(contract.ticketPrice()).resolves.toBe(500n);
  });

  // test/libsolidity/semanticTests/arithmetics/checked_add_v2.sol
  // uint16 addition accepts 65534 + 0 and rejects 65535 + 1 with checked-arithmetic semantics.
  it('executes checked bounded addition and rejects overflow', async () => {
    const contract = await deploy(`contract C {
      function add(uint16 a, uint16 b) internal returns (uint16) { return a + b; }
      function verify() public { require(add(65534, 0) == 65534 && add(65535, 0) == 65535); }
      function overflow() public { uint16 value = add(65535, 1); require(value == 0); }
    }`);
    await expect(contract.verify()).resolves.toBeDefined();
    await expect(contract.overflow()).rejects.toThrow();
  });

  // test/libsolidity/semanticTests/arithmetics/addmod_mulmod.sol
  // addmod applies addition followed by the modulus; the adjacent wrong-result path must reject.
  it('executes addmod arithmetic', async () => {
    const contract = await deploy(`contract C {
      function verify(uint x, uint y, uint modulus) public { require(addmod(x, y, modulus) == 4); }
      function verifyWrong(uint x, uint y, uint modulus) public { require(addmod(x, y, modulus) == 5); }
    }`);
    await expect(contract.verify(9n, 9n, 7n)).resolves.toBeDefined();
    await expect(contract.verifyWrong(9n, 9n, 7n)).rejects.toThrow();
  });

  // test/libsolidity/semanticTests/exponentiation/signed_base.sol
  // A signed base with unsigned exponents preserves the sign rules: (-3)^2=9 and (-3)^3=-27.
  it('executes signed exponentiation', async () => {
    const contract = await deploy(`contract C {
      function verify() public {
        int32 x = -3; uint8 y1 = 2; uint8 y2 = 3;
        require(x ** y1 == 9 && x ** y2 == -27);
      }
      function verifyWrong() public { int32 x = -3; require(x ** 3 == 27); }
    }`);
    await expect(contract.verify()).resolves.toBeDefined();
    await expect(contract.verifyWrong()).rejects.toThrow();
  });

  // test/libsolidity/semanticTests/expressions/bytes_comparison.sol
  it('executes fixed-bytes lexicographic comparisons', async () => {
    const contract = await deploy(`contract C {
      function verify() public { bytes2 a = "a"; bytes2 x = "aa"; bytes2 b = "b"; require(a < x && x < b); }
      function verifyWrong() public { bytes2 a = "a"; bytes2 b = "b"; require(b < a); }
    }`);
    await expect(contract.verify()).resolves.toBeDefined();
    await expect(contract.verifyWrong()).rejects.toThrow();
  });

  // test/libsolidity/semanticTests/expressions/conditional_expression_functions.sol
  // A conditional internal function value dispatches x() for true and y() for false.
  it('executes conditional function-value dispatch', async () => {
    const contract = await deploy(`contract C {
      function x() internal returns (uint) { return 1; }
      function y() internal returns (uint) { return 2; }
      function choose(bool condition) internal returns (uint) {
        function() returns (uint) selected = condition ? x : y; return selected();
      }
      function verify() public { require(choose(true) == 1 && choose(false) == 2); }
      function verifyWrong() public { require(choose(false) == 1); }
    }`);
    await expect(contract.verify()).resolves.toBeDefined();
    await expect(contract.verifyWrong()).rejects.toThrow();
  });

  // test/libsolidity/semanticTests/conversions/calldata_bytes_to_memory.sol
  // Copying calldata "abcdefgh" to memory preserves its contents and length.
  it('executes a calldata-bytes to memory copy', async () => {
    const contract = await deploy(`contract C {
      function verify(bytes calldata data) public {
        bytes memory copied = bytes(data);
        require(copied == bytes("abcdefgh") && copied.length == 8);
      }
      function verifyWrong(bytes calldata data) public { require(bytes(data) == bytes("abcdefgi")); }
    }`);
    const input = new TextEncoder().encode('abcdefgh');
    await expect(contract.verify(input)).resolves.toBeDefined();
    await expect(contract.verifyWrong(input)).rejects.toThrow();
  });

  // test/libsolidity/semanticTests/using/calldata_memory_copy.sol
  // The attached memory function receives a copied calldata array and sums [1,2,8] to 11.
  it('executes calldata-to-memory copying through an attached free function', async () => {
    const contract = await deploy(`function sum(uint[] memory values) returns (uint result) {
      for (uint i = 0; i < values.length; i++) result += values[i];
    }
    using {sum} for uint[];
    contract C {
      function verify(uint[] calldata values) public { require(values.sum() == 11); }
      function verifyWrong(uint[] calldata values) public { require(values.sum() == 12); }
    }`);
    const input = [1n, 2n, 8n];
    await expect(contract.verify(input)).resolves.toBeDefined();
    await expect(contract.verifyWrong(input)).rejects.toThrow();
  });

  // test/libsolidity/semanticTests/reverts/invalid_enum_as_external_arg.sol
  // An out-of-range enum passed through an external ABI boundary must revert.
  it('rejects an invalid enum ordinal at a self-call ABI boundary', async () => {
    const contract = await deploy(`contract C {
      enum X { A, B }
      function tested(X value) public returns (uint) { return 1; }
      function invalid() public returns (uint) {
        X value; assembly { value := 5 } return this.tested(value);
      }
    }`);
    await expect(contract.invalid()).rejects.toThrow();
  });

  // test/libsolidity/semanticTests/getters/mapping.sol
  // The generated getter accepts every nested mapping key and returns the initialized leaf value.
  it('executes a generated nested-mapping getter through the SDK', async () => {
    const contract = await deploy(`contract C {
      mapping(uint => mapping(uint => uint)) public x;
      constructor() { x[1][2] = 3; }
    }`);
    await expect(contract.x(1n, 2n)).resolves.toBe(3n);
    await expect(contract.x(0n, 0n)).resolves.toBe(0n);
  });

  // test/libsolidity/semanticTests/getters/arrays.sol
  // The generated getter indexes both the fixed outer array and its dynamic inner array.
  it('executes a generated nested-array getter through the SDK', async () => {
    const contract = await deploy(`contract C {
      uint8[][2] public a;
      constructor() { a[1].push(3); a[1].push(4); }
    }`);
    await expect(contract.a(1n, 0n)).resolves.toBe(3n);
    await expect(contract.a(1n, 1n)).resolves.toBe(4n);
    await expect(contract.a(0n, 0n)).rejects.toThrow();
  });

  // test/libsolidity/semanticTests/fallback/fallback_argument.sol
  // A bytes-accepting fallback receives a self-call payload and persists its length.
  it('executes a stateful fallback with its calldata argument', async () => {
    const contract = await deploy(`contract C {
      uint public x;
      fallback(bytes calldata input) external returns (bytes memory) { x = input.length; return ""; }
      function f() public returns (bool, bytes memory) { return address(this).call("abc"); }
    }`);
    await expect(contract.f()).resolves.toBeDefined();
    await expect(contract.x()).resolves.toBe(3n);
  });

  // test/libsolidity/semanticTests/fallback/fallback_or_receive.sol
  // Empty receive dispatch and non-empty fallback dispatch update different state variables.
  it('distinguishes receive and fallback dispatch through the SDK', async () => {
    const contract = await deploy(`contract C {
      uint public x; uint public y;
      fallback() external payable { x += 1; }
      receive() external payable { y += 1; }
    }`);
    await expect(contract.__receive()).resolves.toBeDefined();
    await expect(contract.__fallback()).resolves.toBeDefined();
    await expect(contract.x()).resolves.toBe(1n);
    await expect(contract.y()).resolves.toBe(1n);
  });

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
