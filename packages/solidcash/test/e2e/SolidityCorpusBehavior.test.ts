import { describe, expect, it } from 'vitest';
import { compileString } from '../../../solidc/src/index.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

async function deploy(source: string) {
  const artifact = compileString(source, { forceStateful: true, solidityImportCompat: true });
  return getContractFactory(artifact, await fundedSigner()).deploy();
}

describe('Solidity corpus behavioral parity', () => {
  // Exact runtime adaptations of scalar/tuple expectations:
  // test/libsolidity/semanticTests/types/nested_tuples.sol
  // test/libsolidity/semanticTests/constants/simple_constant_variables_test.sol
  // test/libsolidity/semanticTests/constantEvaluator/negative_fractional_mod.sol
  // test/libsolidity/semanticTests/constantEvaluator/rounding.sol
  // test/libsolidity/semanticTests/literals/denominations.sol
  // test/libsolidity/semanticTests/literals/fractional_denominations.sol
  // test/libsolidity/semanticTests/strings/string_escapes.sol
  // test/libsolidity/semanticTests/strings/unicode_escapes.sol
  // test/libsolidity/semanticTests/strings/unicode_string.sol
  it('executes exact scalar, tuple, constant, and denomination results', async () => {
    const contract = await deploy(`contract C {
      uint256 constant x = 56; int constant c = 7 / 3; int constant d = (-7) / 3;
      function tuples() public {
        int a; bool b; ((a, b)) = (2, true); require(a == 2 && b);
        (((a, ), )) = ((1, 2), 3); require(a == 1);
        (((, a),)) = ((1, 2), 3); require(a == 2);
        a = 3; ((, ), ) = ((7, 8), 9); require(a == 3);
        (a, ) = (4, (8, 16, 32)); require(a == 4);
      }
      function constants() public { require(x == 56); }
      function fractions() public {
        int value = int((-(-5.2 % 3)) * 5); int t = 5;
        require(value == 11 && (-(-t % 3)) * 5 == 10);
        uint[c] memory p; uint[-d] memory q;
        require(p.length == 2 && c == 2 && q.length == 2 && -d == 2);
      }
      function denominations() public {
        require(1 ether + 1 gwei + 1 wei == 1000000001000000001);
        require(1.5 gwei == 1500000000 && 1.5 ether == 1500000000000000000);
        require(1.5 minutes == 90 && 1.5 hours == 5400);
        require(1.5 days == 129600 && 1.5 weeks == 907200);
      }
      function strings() public {
        bytes32 escaped = "\\t\\n\\r\\'\\\"\\\\";
        require(escaped == hex"090a0d27225c0000000000000000000000000000000000000000000000000000");
        require("aaa\\u0024aaa" == "aaa$aaa");
        require("aaa\\u00A2aaa" == hex"616161c2a2616161");
        require("aaa\\u20ACaaa" == hex"616161e282ac616161");
        require("\\u0024\\u00A2\\u20AC" == hex"24c2a2e282ac");
        require(unicode"😃, 😭, and 😈" == hex"f09f98832c20f09f98ad2c20616e6420f09f9888");
      }
    }`);
    await expect(contract.tuples()).resolves.toBeDefined();
    await expect(contract.constants()).resolves.toBeDefined();
    await expect(contract.fractions()).resolves.toBeDefined();
    await expect(contract.denominations()).resolves.toBeDefined();
    await expect(contract.strings()).resolves.toBeDefined();
  });

  // Exact runtime adaptations of memory-array allocation expectations:
  // test/libsolidity/semanticTests/array/create_dynamic_array_with_zero_length.sol
  // test/libsolidity/semanticTests/array/create_memory_byte_array.sol
  it('executes zero and large-byte array allocations', async () => {
    const contract = await deploy(`contract C {
      function zeroLength() public {
        uint256[][] memory a = new uint256[][](0); require(a.length == 0 && 7 == 7);
      }
    }`);
    await expect(contract.zeroLength()).resolves.toBeDefined();
    const bytesContract = await deploy(`contract B {
      function byteArray() public {
        bytes memory x = new bytes(35); require(x.length == 35);
        x[34] = "A"; require(x[34] == "A");
      }
    }`);
    await expect(bytesContract.byteArray()).resolves.toBeDefined();
  });

  // Exact runtime adaptations of array indexing/reference expectations:
  // test/libsolidity/semanticTests/array/indexAccess/bytes_index_access_memory.sol
  // test/libsolidity/semanticTests/array/indexAccess/bytes_memory_index_access.sol
  // test/libsolidity/semanticTests/array/indexAccess/index_access.sol
  // test/libsolidity/semanticTests/array/array_memory_as_parameter.sol
  it('executes byte indexing, endian copying, and memory-reference mutation', async () => {
    const contract = await deploy(`contract C {
      function indirect(bytes memory value) internal returns (bytes memory) { return value; }
      function bytesAt(bytes memory value) public {
        require(value[3] == "d" && value[4] == "e" && indirect(value)[5] == "f");
        require(value.length == 8 && value[3] == "d");
      }
      function littleEndian(uint64 value) public {
        bytes memory ret = new bytes(8); bytes8 word = bytes8(value);
        ret[0] = word[7]; ret[1] = word[6]; ret[2] = word[5]; ret[3] = word[4];
        ret[4] = word[3]; ret[5] = word[2]; ret[6] = word[1]; ret[7] = word[0];
        require(ret == hex"0807060504030201");
      }
      function receiver(uint[] memory values, uint idx) internal returns (uint) {
        for (uint i = 0; i < values.length; i++) values[i] = i + 1;
        return values[idx];
      }
      function memoryParameter(uint len, uint idx, uint expected) public {
        uint[] memory values = new uint[](len); uint result = receiver(values, idx);
        for (uint i = 0; i < values.length; i++) require(values[i] == i + 1);
        require(result == expected);
      }
    }`);
    await expect(contract.bytesAt(new TextEncoder().encode('abcdefgh'))).resolves.toBeDefined();
    await expect(contract.littleEndian(0x0102030405060708n)).resolves.toBeDefined();
    await expect(contract.memoryParameter(1n, 0n, 1n)).resolves.toBeDefined();
    await expect(contract.memoryParameter(10n, 5n, 6n)).resolves.toBeDefined();
    await expect(contract.memoryParameter(0n, 0n, 0n)).rejects.toThrow();
    await expect(contract.memoryParameter(10n, 50n, 0n)).rejects.toThrow();
  });

  // Exact runtime adaptations of:
  // test/libsolidity/semanticTests/array/array_3d_new.sol
  // test/libsolidity/semanticTests/array/array_3d_assignment.sol
  it('executes three-dimensional allocation and aliasing', async () => {
    const direct = await deploy(`contract C {
      function verify(uint n) public {
        uint[][][] memory a = new uint[][][](2);
        for (uint i = 0; i < 2; ++i) {
          a[i] = new uint[][](3);
          for (uint j = 0; j < 3; ++j) a[i][j] = new uint[](4);
        }
        a[1][1][1] = n; require(a[1][1][1] == n);
      }
    }`);
    const alias = await deploy(`contract A {
      function verify(uint n) public {
        uint[][][] memory a = new uint[][][](2);
        for (uint i = 0; i < 2; ++i) {
          a[i] = new uint[][](3);
          for (uint j = 0; j < 3; ++j) a[i][j] = new uint[](4);
        }
        a[1][1][1] = n; uint[][] memory b = a[1]; uint[] memory c = b[1]; require(c[1] == n);
      }
    }`);
    await expect(direct.verify(42n)).resolves.toBeDefined();
    await expect(alias.verify(42n)).resolves.toBeDefined();
  });

  // Exact runtime adaptations of complete struct expectations:
  // test/libsolidity/semanticTests/structs/simple_struct_allocation.sol
  // test/libsolidity/semanticTests/structs/nested_struct_allocation.sol
  // test/libsolidity/semanticTests/structs/memory_structs_nested.sol
  // test/libsolidity/semanticTests/structs/memory_structs_as_function_args.sol
  it('executes struct allocation and nested memory arguments', async () => {
    const contract = await deploy(`contract C {
      struct One { uint a; }
      struct Inner { uint b; uint c; }
      struct Outer { Inner a; }
      struct Triple { uint8 x; uint16 y; uint256 z; }
      struct Nested { uint8 x; Triple s; }
      function combine(uint8 x, uint16 y, uint256 z) internal returns (Triple memory value) {
        value.x = x; value.y = y; value.z = z;
      }
      function extract(Triple memory value, uint which) internal returns (uint) {
        if (which == 0) return value.x; if (which == 1) return value.y; return value.z;
      }
      function nestedCombine() internal returns (Nested memory value) {
        value.x = 1; value.s = combine(2, 3, 4);
      }
      function verifyMemory() public {
        One memory one = One(1); require(one.a == 1);
        Outer memory outer = Outer(Inner(1, 2)); require(outer.a.b == 1);
        Triple memory triple = combine(1, 2, 3);
        require(extract(triple, 0) == 1 && extract(triple, 1) == 2 && extract(triple, 2) == 3);
        Nested memory n = nestedCombine();
        require(n.x == 1 && n.s.x == 2 && n.s.y == 3 && n.s.z == 4);
      }
    }`);
    await expect(contract.verifyMemory()).resolves.toBeDefined();
  });

  // Exact runtime adaptations of calldata-to-memory struct copies:
  // test/libsolidity/semanticTests/structs/global.sol
  // test/libsolidity/semanticTests/structs/struct_copy_calldata_to_memory_v2.sol
  // test/libsolidity/semanticTests/structs/struct_copy_calldata_to_memory_nested_bytes_v2.sol
  // test/libsolidity/semanticTests/structs/struct_copy_calldata_to_memory_nested_static_array_v2.sol
  it('executes external struct decoding and independent memory copies', async () => {
    const contract = await deploy(`
      struct GlobalPair { uint256 a; uint256 b; }
      contract C {
        struct Flat { uint256 a; uint256 b; bytes2 c; }
        struct WithBytes { uint256 a; bytes b; uint256 c; }
        struct WithArray { uint256 a; uint256[2] b; uint256 c; }
        function globalPair(GlobalPair calldata value) external {
          require(value.a == 42 && value.b == 23);
        }
        function flat(Flat calldata value) external {
          Flat memory copy = value;
          require(copy.a == 42 && copy.b == 23 && copy.c[1] == "b");
        }
        function withBytes(WithBytes calldata value) external {
          WithBytes memory copy = value;
          require(copy.a == 42 && copy.b[0] == "a" && copy.b[1] == "b" && copy.c == 23);
        }
        function withArray(WithArray calldata value) external {
          WithArray memory copy = value;
          require(copy.a == 42 && copy.b[0] == 1 && copy.b[1] == 2 && copy.c == 23);
        }
      }`);
    await expect(contract.globalPair({ a: 42n, b: 23n })).resolves.toBeDefined();
    await expect(contract.flat({ a: 42n, b: 23n, c: new TextEncoder().encode('ab') })).resolves.toBeDefined();
    await expect(contract.withBytes({ a: 42n, b: new TextEncoder().encode('ab'), c: 23n })).resolves.toBeDefined();
    await expect(contract.withArray({ a: 42n, b: [1n, 2n], c: 23n })).resolves.toBeDefined();
  });

  // Exact runtime adaptations of nested dynamic-array struct copy and tuple assignment:
  // test/libsolidity/semanticTests/structs/struct_copy_calldata_to_memory_nested_dynamic_array_v2.sol
  // test/libsolidity/semanticTests/structs/struct_copy_calldata_to_memory_tuple.sol
  it('executes nested calldata struct copies without aliasing their source', async () => {
    const copyContract = await deploy(`contract C {
      struct S { uint128 p1; uint256[][2] a; uint32 p2; }
      function verifyCopy(uint32 p1, S calldata value) external {
        S memory copy = value;
        require(copy.a[0][0] == value.a[0][0] && copy.a[1][1] == value.a[1][1]);
        copy.p1++; copy.a[0][1]++;
        require(p1 == 55 && copy.p1 == 78 && copy.a[0][0] == 1 && copy.a[1][1] == 2 && copy.p2 == 88);
        require(value.p1 == 77 && value.a[0][1] == 2);
      }
    }`);
    const tupleContract = await deploy(`contract T {
      struct S { uint128 p1; uint256[][2] a; uint32 p2; }
      function verifyTuple(uint32 p1, S calldata value) external {
        S memory copy; uint32 p2; (p2, copy) = (p1, value);
        copy.p1++; copy.a[0][1]++;
        require(p2 == 55 && copy.p1 == 78 && copy.a[0][0] == 1 && copy.a[1][1] == 2 && copy.p2 == 88);
      }
    }`);
    const value = { p1: 77n, a: [[1n, 2n], [1n, 2n]], p2: 88n };
    await expect(copyContract.verifyCopy(55n, value)).resolves.toBeDefined();
    await expect(tupleContract.verifyTuple(55n, value)).resolves.toBeDefined();
  });

  // Exact standalone adaptations; separate deployments keep constructor/state invariants independently observable:
  // test/libsolidity/semanticTests/structs/lone_struct_array_type.sol
  // test/libsolidity/semanticTests/structs/struct_named_constructor.sol
  // test/libsolidity/semanticTests/structs/struct_constructor_nested.sol
  // test/libsolidity/semanticTests/structs/struct_copy_via_local.sol
  it('executes inert struct types, named constructors, nested constructor state, and local copies', async () => {
    const inert = await deploy(`contract I {
      struct S { uint a; uint b; }
      function verify() public { S[7][]; require(3 == 3); }
    }`);
    await expect(inert.verify()).resolves.toBeDefined();

    const named = await deploy(`contract N {
      struct S { uint256 a; bool x; } S s;
      constructor() { s = S({x: true, a: 1}); }
      function verify() public { require(s.a == 1 && s.x); }
    }`);
    await expect(named.verify()).resolves.toBeDefined();

    const nested = await deploy(`contract D {
      struct X { uint256 x1; uint256 x2; }
      struct S { uint256 s1; uint256[3] s2; X s3; } S s;
      constructor() { uint256[3] memory values; values[1] = 9; s = S(1, values, X(4, 5)); }
      function verify() public {
        require(s.s1 == 1 && s.s2[0] == 0 && s.s2[1] == 9 && s.s2[2] == 0);
        require(s.s3.x1 == 4 && s.s3.x2 == 5);
      }
    }`);
    await expect(nested.verify()).resolves.toBeDefined();

    const copied = await deploy(`contract P {
      struct S { uint256 a; uint256 b; } S data1; S data2;
      constructor() { data1 = S(0, 0); data2 = S(0, 0); }
      function verify() public {
        data1.a = 1; data1.b = 2; S memory value = data1; data2 = value;
        require(data2.a == data1.a && data2.b == data1.b);
      }
    }`);
    await expect(copied.verify()).resolves.toBeDefined();
  });

  // Exact success and failure adaptations of checked-context boundaries:
  // test/libsolidity/semanticTests/arithmetics/addmod_mulmod_zero.sol
  // test/libsolidity/semanticTests/arithmetics/checked_called_by_unchecked.sol
  // test/libsolidity/semanticTests/arithmetics/checked_modifier_called_by_unchecked.sol
  // test/libsolidity/semanticTests/arithmetics/unchecked_called_by_checked.sol
  // test/libsolidity/semanticTests/arithmetics/unchecked_div_by_zero.sol
  it('preserves arithmetic checks across unchecked blocks, calls, modifiers, and zero divisors', async () => {
    const modular = await deploy(`contract M {
      function addZero(uint d) public { addmod(1, 2, d); require(true); }
      function mulZero(uint d) public { mulmod(1, 2, d); require(true); }
      function zeros() public {
        require(mulmod(0, 1, 2) == 0 && mulmod(1, 0, 2) == 0);
        require(addmod(0, 1, 2) == 1 && addmod(1, 0, 2) == 1);
      }
      function divUnchecked(uint a, uint b, uint expected) public {
        unchecked { require(a / b == expected && a % b == a % b); }
      }
    }`);
    await expect(modular.zeros()).resolves.toBeDefined();
    await expect(modular.addZero(0n)).rejects.toThrow();
    await expect(modular.mulZero(0n)).rejects.toThrow();
    await expect(modular.divUnchecked(7n, 2n, 3n)).resolves.toBeDefined();
    await expect(modular.divUnchecked(7n, 0n, 0n)).rejects.toThrow();

    const callBoundary = await deploy(`contract C {
      function add(uint16 a, uint16 b) internal returns (uint16) { return a + b; }
      function verify(uint16 a, uint16 b, uint16 c, uint16 expected) public {
        unchecked { uint16 result = add(a, b) + c; require(result == expected); }
      }
    }`);
    await expect(callBoundary.verify(0xe000n, 0x1000n, 0x1000n, 0n)).resolves.toBeDefined();
    await expect(callBoundary.verify(0xe000n, 0xe500n, 2n, 0n)).rejects.toThrow();

    const modifierBoundary = await deploy(`contract D {
      modifier add(uint16 a, uint16 b) { unchecked { a + b; } _; }
      function verify(uint16 a, uint16 b, uint16 c, uint16 expected) public add(a, b) {
        require(b + c == expected);
      }
    }`);
    await expect(modifierBoundary.verify(0xe000n, 0xe500n, 2n, 0xe502n)).resolves.toBeDefined();
    await expect(modifierBoundary.verify(0x1000n, 0xe500n, 0xe000n, 0n)).rejects.toThrow();

    const uncheckedCallee = await deploy(`contract U {
      function add(uint16 a, uint16 b) internal returns (uint16) { unchecked { return a + b; } }
      function verify(uint16 a, uint16 expected) public { require(add(a, 0x100) + 0x100 == expected); }
    }`);
    await expect(uncheckedCallee.verify(7n, 0x207n)).resolves.toBeDefined();
    await expect(uncheckedCallee.verify(0xffffn, 511n)).resolves.toBeDefined();
    await expect(uncheckedCallee.verify(0xfeffn, 0n)).rejects.toThrow();
  });

  // Exact runtime adaptations of modifier repetition, early-return, cleanup, and constructor behavior:
  // test/libsolidity/semanticTests/modifiers/function_modifier_local_variables.sol
  // test/libsolidity/semanticTests/modifiers/function_modifier_loop.sol
  // test/libsolidity/semanticTests/modifiers/function_modifier_multiple_times.sol
  // test/libsolidity/semanticTests/modifiers/function_modifier_multiple_times_local_vars.sol
  it('executes modifier entry, repetition, nesting, and cleanup', async () => {
    const modifiers = await deploy(`contract M {
      uint repeated; uint a; uint observed;
      constructor() { repeated = 0; a = 0; observed = 0; }
      modifier locals1 { uint8 x = 1; uint8 y = 2; require(x + y == 3); _; }
      modifier locals2(bool stop) { if (stop) return; else _; }
      function localResult(bool stop) internal locals1 locals2(stop) returns (uint r) { return 3; }
      modifier repeat(uint count) { for (uint i = 0; i < count; ++i) _; }
      function runRepeat() internal repeat(10) { repeated += 1; }
      modifier add(uint x) { a += x; _; }
      function runAdds(uint x) internal add(2) add(5) add(x) { observed = a; }
      modifier addAndRemove(uint x) { uint local = x; a += local; _; a -= local; require(local == x); }
      function runCleanup(uint x) internal addAndRemove(2) addAndRemove(5) addAndRemove(x) { observed = a; }
      function verify() public {
        require(localResult(true) == 0 && localResult(false) == 3);
        runRepeat(); require(repeated == 10);
        runAdds(3); require(a == 10 && observed == 10);
        a = 0; observed = 0; runCleanup(3); require(a == 0 && observed == 10);
      }
    }`);
    await expect(modifiers.verify()).resolves.toBeDefined();
  });

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

  // Exact runtime adaptations with decoded names, signatures, and arguments:
  // test/libsolidity/semanticTests/events/event_no_arguments.sol
  // test/libsolidity/semanticTests/events/event_string.sol
  // test/libsolidity/semanticTests/events/event_indexed_mixed.sol
  // test/libsolidity/semanticTests/events/event_anonymous.sol
  // test/libsolidity/semanticTests/events/simple.sol
  it('emits and decodes empty, string, indexed, anonymous, and base-qualified events', async () => {
    const contract = await deploy(`contract Base { event E(); }
    contract C is Base {
      event Empty(); event Text(string r); event Mixed(uint a, uint indexed r, uint b, bytes c);
      event Anonymous() anonymous; event E(uint256 a, uint256 b);
      function emitEmpty() public { emit Empty(); require(true); }
      function emitText() public { emit Text("HELLO WORLD"); require(true); }
      function emitMixed() public { emit Mixed(1, 2, 3, "def"); require(true); }
      function emitAnonymous() public { emit Anonymous(); require(true); }
      function emitInherited() public { emit Base.E(); emit E(1, 2); require(true); }
    }`);
    const empty = await (await contract.call.emitEmpty().send()).wait!();
    expect(empty.events).toHaveLength(1);
    expect(empty.events?.[0].eventSignature).toBe('Empty()');

    const text = await (await contract.call.emitText().send()).wait!();
    expect(text.events?.[0].args.r).toBe('HELLO WORLD');

    const mixed = await (await contract.call.emitMixed().send()).wait!();
    expect(mixed.events?.[0].args).toMatchObject({ a: 1n, r: 2n, b: 3n });
    expect(Array.from(mixed.events?.[0].args.c as Uint8Array)).toEqual(Array.from(new TextEncoder().encode('def')));

    const anonymous = await (await contract.call.emitAnonymous().send()).wait!();
    expect(anonymous.events?.map((event) => event.event)).toEqual(['Anonymous']);

    const inherited = await (await contract.call.emitInherited().send()).wait!();
    expect(inherited.events?.map((event) => event.eventSignature)).toEqual(['E()', 'E(uint256,uint256)']);
    expect(inherited.events?.[1].args).toMatchObject({ a: 1n, b: 2n });
  });

  // Exact runtime adaptations of selector identity and evaluation side effects:
  // test/libsolidity/semanticTests/functionTypes/selector_assignment_expression.sol
  // test/libsolidity/semanticTests/functionTypes/selector_expression_side_effect.sol
  // test/libsolidity/semanticTests/functionTypes/same_function_in_construction_and_runtime.sol
  it('executes selector-expression side effects and constructor/runtime calls', async () => {
    const evaluated = await deploy(`contract E {
      bool z; uint x; uint initial;
      constructor() { z = false; x = 0; initial = double(2); }
      function f() public { require(true); } function g() public { require(true); }
      function double(uint value) internal returns (uint) { return value * 2; }
      function sideEffect() internal returns (E) { x = 42; return this; }
      function verify() public {
        ((z = true) ? this.f : this.f).selector; require(z);
        sideEffect().f.selector; require(x == 42);
        require(initial == 4 && double(3) == 6);
      }
    }`);
    await expect(evaluated.verify()).resolves.toBeDefined();
  });

  // Exact runtime adaptations of scalar state initialization, mutation isolation, and signed packed values:
  // test/libsolidity/semanticTests/storage/simple_accessor.sol
  // test/libsolidity/semanticTests/storage/state_smoke_test.sol
  // test/libsolidity/semanticTests/storage/packed_storage_signed.sol
  it('executes independent state slots and signed bounded storage updates', async () => {
    const accessor = await deploy(`contract A {
      uint256 data; constructor() { data = 8; }
      function verify() public { require(data == 8); }
    }`);
    await expect(accessor.verify()).resolves.toBeDefined();

    const slots = await deploy(`contract S {
      uint256 value1; uint256 value2; constructor() { value1 = 0; value2 = 0; }
      function set(uint8 which, uint256 value) public {
        if (which == 0) value1 = value; else value2 = value;
        require((which == 0 ? value1 : value2) == value);
      }
    }`);
    expect(await slots.getState()).toMatchObject({ value1: 0n, value2: 0n });
    await slots.set(0n, 0x1234n); await slots.set(1n, 0x8765n);
    expect(await slots.getState()).toMatchObject({ value1: 0x1234n, value2: 0x8765n });
    await slots.set(0n, 3n);
    expect(await slots.getState()).toMatchObject({ value1: 3n, value2: 0x8765n });

    const packed = await deploy(`contract P {
      int8 a; uint8 b; int8 c; uint8 d;
      constructor() { a = 0; b = 0; c = 0; d = 0; }
      function verify() public {
        a = -2;
        unchecked { b = (0 - uint8(a)) * 2; c = a * int8(120) * int8(121); }
        require(a == -2 && b == 4 && c == -112 && d == 0);
      }
    }`);
    await expect(packed.verify()).resolves.toBeDefined();
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
