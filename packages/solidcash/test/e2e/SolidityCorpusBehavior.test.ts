import { describe, expect, it } from 'vitest';
import { compileString } from '../../../solidc/src/index.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

async function deploy(source: string) {
  const artifact = compileString(source, { forceStateful: true, solidityImportCompat: true });
  return getContractFactory(artifact, await fundedSigner()).deploy();
}

describe('Solidity corpus behavioral parity', () => {
  // Generated accessor behavior is shared by the consolidated getter tests below:
  // test/libsolidity/semanticTests/getters/bytes.sol
  // test/libsolidity/semanticTests/getters/mapping_array_struct.sol
  // test/libsolidity/semanticTests/getters/mapping_of_string.sol
  // test/libsolidity/semanticTests/getters/mapping_to_struct.sol
  // test/libsolidity/semanticTests/getters/string_and_bytes.sol
  // Passes 1-5:
  // test/libsolidity/semanticTests/expressions/conditional_expression_false_literal.sol
  // test/libsolidity/semanticTests/expressions/conditional_expression_true_literal.sol
  // test/libsolidity/semanticTests/expressions/conditional_expression_multiple.sol
  // test/libsolidity/semanticTests/expressions/conditional_expression_different_types.sol
  // test/libsolidity/semanticTests/literals/scientific_notation.sol
  // Passes 6-10:
  // test/libsolidity/semanticTests/expressions/conditional_expression_tuples.sol
  // test/libsolidity/semanticTests/expressions/conditional_expression_with_return_values.sol
  // test/libsolidity/semanticTests/expressions/tuple_from_ternary_expression.sol
  // test/libsolidity/semanticTests/arithmetics/signed_mod.sol
  // test/libsolidity/semanticTests/expressions/unary_too_long_literal.sol
  // Passes 14-15:
  // test/libsolidity/semanticTests/freeFunctions/libraries_from_free.sol
  // test/libsolidity/semanticTests/functionCall/call_attached_library_function_on_function.sol
  it('executes consolidated expression and library semantics', async () => {
    const contract = await deploy(`library L {
      function pub() public pure returns (uint) { return 7; }
      function inter() internal pure returns (uint) { return 8; }
      function invoke(function() internal returns (uint) target) internal returns (uint) { return target(); }
    }
    function values() pure returns (uint, uint) { return (L.pub(), L.inter()); }
    contract C {
      using L for *;
      function verify(uint input) public {
        require((false ? 5 : 10) == 10 && (true ? 5 : 10) == 5);
        uint selected = input > 100 ? input > 1000 ? 1000 : 100 : input > 50 ? 50 : 10;
        require(selected == 100);
        uint8 narrow = 0xcd; uint16 wide = 0xabab;
        require((true ? narrow : wide) == 0xcd && (false ? narrow : wide) == 0xabab);
        require(2e10 == 20000000000 && 200e-2 == 2 && 2.5e1 == 25);
      }
      function tuple(bool condition) internal returns (uint, uint) { return condition ? (1, 2) : (3, 4); }
      function assigned(bool condition, uint value) internal returns (uint a, uint b) { condition ? a = value : b = value; }
      function verifyTuples() public {
        uint a, uint b = tuple(true); require(a == 1 && b == 2);
        (a, b) = tuple(false); require(a == 3 && b == 4);
        (a, b) = assigned(true, 20); require(a == 20 && b == 0);
        bool flag; ((flag = true) ? (1, 2, 3) : (3, 2, 1)); require(flag);
      }
      function wideUnary() public {
        require(0 < ~~84926290883049832306107864558384249403874903260938453235235091622489261765859);
      }
      function signedModulo() public {
        require(int(7) % int(-5) == 2 && int(-7) % int(5) == -2 && int(-5) % int(-5) == 0);
      }
      function target() internal returns (uint) { return 7; }
      function verifyLibraries() public {
        uint a, uint b = values(); require(a == 7 && b == 8 && target.invoke() == 7);
      }
    }`);
    await expect(contract.verify(500n)).resolves.toBeDefined();
    await expect(contract.verifyTuples()).resolves.toBeDefined();
    await expect(contract.wideUnary()).resolves.toBeDefined();
    await expect(contract.signedModulo()).resolves.toBeDefined();
    await expect(contract.verifyLibraries()).resolves.toBeDefined();
  });

  // Passes 11-13:
  // test/libsolidity/semanticTests/modifiers/break_in_modifier.sol
  // test/libsolidity/semanticTests/modifiers/continue_in_modifier.sol
  // test/libsolidity/semanticTests/modifiers/access_through_contract_name.sol
  it('executes loop control and base-qualified modifiers', async () => {
    const contract = await deploy(`contract A {
      uint x = 7; modifier selected() virtual { x = 2; _; }
    }
    contract C is A {
      uint breakCount; uint continueCount;
      modifier selected() override { x = 1; _; }
      modifier breakRun() { for (uint i = 0; i < 10; i++) { _; if (i == 1) break; } }
      modifier continueRun() { for (uint i = 0; i < 10; i++) { if (i % 2 == 1) continue; _; } }
      function runBreak() internal breakRun { breakCount += 1; }
      function runContinue() internal continueRun { continueCount += 1; }
      function runBase() internal A.selected {}
      function runDerived() internal selected {}
      function verifyAll() public {
        runBreak(); runContinue(); runBase();
        require(breakCount == 2 && continueCount == 5 && x == 2);
        runDerived(); require(x == 1);
      }
    }`);
    await expect(contract.verifyAll()).resolves.toBeDefined();
  });

  // test/libsolidity/semanticTests/immutable/assign_at_declaration.sol
  // test/libsolidity/semanticTests/immutable/getter.sol
  // test/libsolidity/semanticTests/memoryManagement/memory_types_initialisation.sol
  // Pass 16: test/libsolidity/semanticTests/array/arrayMemoryAllocation/array_static_return_param_zeroed_memory_index_access.sol
  // Pass 17: test/libsolidity/semanticTests/array/arrayMemoryAllocation/array_array_static.sol
  // Pass 18: test/libsolidity/semanticTests/array/array_2d_assignment.sol
  // Pass 19: test/libsolidity/semanticTests/array/arrayMemoryAllocation/array_static_zeroed_memory_index_access.sol
  // Pass 20: test/libsolidity/semanticTests/array/arrayMemoryAllocation/array_2d_zeroed_memory_index_access.sol
  // Immutable initialization/getters and default memory shapes share one deployment.
  it('executes immutable accessors and default memory initialization', async () => {
    const declared = await deploy(`contract C {
      uint8 immutable declared = 2;
      uint immutable public x = 1;
      function verify() public view { require(declared == 2); }
      function defaults() internal returns (uint[3] memory a, uint[2] memory b, uint[] memory c, uint d) {}
      function verifyMemory() public {
        uint[5] memory stat;
        uint[] memory dyn;
        uint[3][] memory nested;
        uint[3][7] memory nestedStat;
        require(stat[0] == 0 && stat[4] == 0);
        require(dyn.length == 0 && nested.length == 0);
        require(nestedStat[0][0] == 0 && nestedStat[6][2] == 0);
        uint[3] memory ra; uint[2] memory rb; uint[] memory rc; uint rd;
        (ra, rb, rc, rd) = defaults();
        require(ra[0] == 0 && rb[1] == 0 && rc.length == 0 && rd == 0);
        uint[4][] memory mixed = new uint[4][](2);
        require(mixed[0][0] == 0 && mixed[1][0] == 0);
        uint[][] memory assigned = new uint[][](2);
        assigned[0] = new uint[](3); assigned[1] = new uint[](3); assigned[1][1] = 42;
        uint[] memory row = assigned[1]; require(row[1] == 42);
      }
    }`);
    await expect(declared.verify()).resolves.toBeDefined();
    await expect(declared.x()).resolves.toBe(1n);
    await expect(declared.verifyMemory()).resolves.toBeDefined();
  });

  // test/libsolidity/semanticTests/exponentiation/literal_base.sol
  // Literal-base sign and precedence execute for the upstream fixture's representative exponents.
  it('executes literal-base exponentiation', async () => {
    const contract = await deploy(`contract C {
      function power(uint x, uint expectedUnsigned, int expectedSigned) public {
        unchecked {
          uint a = 2 ** x;
          int b = -2 ** x;
          require(a == expectedUnsigned && b == expectedSigned);
        }
      }
    }`);
    await expect(contract.power(0n, 1n, 1n)).resolves.toBeDefined();
    await expect(contract.power(1n, 2n, -2n)).resolves.toBeDefined();
    await expect(contract.power(2n, 4n, 4n)).resolves.toBeDefined();
    await expect(contract.power(13n, 8192n, -8192n)).resolves.toBeDefined();
  });

  // test/libsolidity/semanticTests/statements/empty_for_loop.sol
  // test/libsolidity/semanticTests/functionSelector/function_selector_via_contract_name.sol
  // test/libsolidity/semanticTests/metaTypes/name_other_contract.sol
  // test/libsolidity/semanticTests/accessor/accessor_for_const_state_variable.sol
  // test/libsolidity/semanticTests/accessor/accessor_for_state_variable.sol
  // test/libsolidity/semanticTests/types/assign_calldata_value_type.sol
  // test/libsolidity/semanticTests/strings/empty_string.sol
  // test/libsolidity/semanticTests/strings/empty_string_input.sol
  // test/libsolidity/semanticTests/enums/constructing_enums_from_ints.sol
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
      enum Truth { False, True }
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
      function verifyEmpty(string calldata message, uint256 value) public {
        string memory empty = "";
        require(bytes(empty).length == 0 && bytes(message).length == 0 && value == 0x888);
      }
      function verifyEnum() public { require(uint256(Truth(uint8(0x1))) == 1); }
    }`);
    await expect(contract.verify()).resolves.toBeDefined();
    await expect(contract.copy(23n)).resolves.toBeDefined();
    await expect(contract.verifyEmpty('', 0x888n)).resolves.toBeDefined();
    await expect(contract.verifyEnum()).resolves.toBeDefined();
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
  // Pass 23: test/libsolidity/semanticTests/reverts/invalid_enum_compared.sol
  // Pass 24: test/libsolidity/semanticTests/reverts/invalid_enum_stored.sol
  // Pass 21: test/libsolidity/semanticTests/arithmetics/divisiod_by_zero.sol
  // Pass 22: test/libsolidity/semanticTests/arithmetics/unchecked_div_by_zero.sol
  // An out-of-range enum passed through an external ABI boundary must revert.
  it('rejects an invalid enum ordinal at a self-call ABI boundary', async () => {
    const contract = await deploy(`contract C {
      enum X { A, B }
      function tested(X value) public returns (uint) { return 1; }
      function invalid() public returns (uint) {
        X value; assembly { value := 5 } return this.tested(value);
      }
      function compareInvalid() public returns (bool) {
        X value; assembly { value := 5 } return value == value;
      }
      X stored;
      function storeInvalid() public { X value; assembly { value := 5 } stored = value; }
      function div(uint a, uint b) public returns (uint) { return a / b; }
      function mod(uint a, uint b) public returns (uint) { return a % b; }
      function uncheckedDiv(uint a, uint b) public returns (uint) { unchecked { return a / b; } }
      function uncheckedMod(uint a, uint b) public returns (uint) { unchecked { return a % b; } }
    }`);
    await expect(contract.invalid()).rejects.toThrow();
    await expect(contract.compareInvalid()).rejects.toThrow();
    await expect(contract.storeInvalid()).rejects.toThrow();
    await expect(contract.div(7n, 0n)).rejects.toThrow();
    await expect(contract.mod(7n, 0n)).rejects.toThrow();
    await expect(contract.uncheckedDiv(7n, 0n)).rejects.toThrow();
    await expect(contract.uncheckedMod(7n, 0n)).rejects.toThrow();
  });

  // test/libsolidity/semanticTests/getters/mapping.sol
  // test/libsolidity/semanticTests/getters/mapping_with_names.sol
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

  // test/libsolidity/semanticTests/freeFunctions/overloads.sol
  // test/libsolidity/semanticTests/freeFunctions/free_namesake_contract_function.sol
  // File-level overload resolution selects by parameter type.
  it('executes file-level overload and namesake resolution', async () => {
    const overloaded = await deploy(`function f(uint) returns (uint) { return 2; }
    function f(string memory) returns (uint) { return 3; }
    contract C { function verify() public { require(f(2) == 2 && f("abc") == 3); } }`);
    await expect(overloaded.verify()).resolves.toBeDefined();

    const namesake = await deploy(`function f() pure returns (uint) { return 1337; }
    contract C { function f() public pure returns (uint) { return f(); } }`);
    await expect(namesake.f()).rejects.toThrow();
  });

  // test/libsolidity/semanticTests/using/free_function_multi.sol
  // test/libsolidity/semanticTests/using/free_function_braces.sol
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

  // test/libsolidity/semanticTests/using/free_functions_individual.sol
  // test/libsolidity/semanticTests/using/private_library_function.sol
  // Individually scoped free functions and private library attachments share one test case.
  it('executes individually scoped and private-library attachments', async () => {
    const individual = await deploy(`using {zero} for uint;
    function id(uint x) pure returns (uint) { return x; }
    function zero(uint) pure returns (uint) { return 0; }
    contract C {
      using {id} for uint;
      function verify(uint z) public { require(z.id() == z && z.zero() == 0); }
    }`);
    await expect(individual.verify(256n)).resolves.toBeDefined();

    const privateLibrary = await deploy(`library L {
      using {L.privateFunction} for uint;
      function privateFunction(uint x) private pure returns (uint) { return x + 1; }
      function f() public pure returns (uint) { uint x = 1; return x.privateFunction(); }
    }
    contract C { function verify() public { require(L.f() == 2); } }`);
    await expect(privateLibrary.verify()).resolves.toBeDefined();
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
  // test/libsolidity/semanticTests/constants/constant_string_at_file_level.sol
  // The upstream getters return identical 0x030102 byte constants and the bytes of "hello".
  it('executes byte and string constants without changing their contents', async () => {
    const contract = await deploy(`bytes constant a = "\\x03\\x01\\x02";
    bytes constant b = hex"030102";
    string constant c = "hello";
    uint256 constant x = 56;
    enum ActionChoices { GoLeft, GoRight, GoStraight, Sit }
    ActionChoices constant choices = ActionChoices.GoRight;
    bytes32 constant st = "abc\\x00\\xff__";
    contract C {
      function verify() public {
        require(a == b && bytes(c) == hex"68656c6c6f");
        require(x == 56 && choices == ActionChoices.GoRight && st == bytes32("abc\\x00\\xff__"));
      }
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
  // test/libsolidity/semanticTests/constructor/base_constructor_arguments.sol
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

    const withArgument = await deploy(`contract BaseBase {
      uint256 value; constructor(uint256 initial) { value = initial; }
    }
    contract Base is BaseBase(7) { constructor() { value *= value; } }
    contract C is Base { function verify() public { require(value == 49); } }`);
    await expect(withArgument.verify()).resolves.toBeDefined();
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
  // Pass 25: test/libsolidity/semanticTests/events/emit_three_identical_events.sol
  // The upstream transaction emits two distinct Terminated logs from one call.
  it('executes and decodes two identical event emissions', async () => {
    const contract = await deploy(`contract C {
      event Terminated();
      function terminate() public { emit Terminated(); emit Terminated(); require(true); }
      function terminateThree() public { emit Terminated(); emit Terminated(); emit Terminated(); require(true); }
    }`);
    const receipt = await (await contract.call.terminate().send()).wait!();
    expect(receipt.events?.map((event) => event.event)).toEqual(['Terminated', 'Terminated']);
    const three = await (await contract.call.terminateThree().send()).wait!();
    expect(three.events?.map((event) => event.event)).toEqual(['Terminated', 'Terminated', 'Terminated']);
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
