import { describe, it, expect } from 'vitest';
import {
  binToHex, decodeAuthenticationInstructions, hexToBin, OpcodesBCH, type AuthenticationProgramStateCommon,
} from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { getContractFactory } from '../../src/stateful/index.js';
import { findRedeemScriptStart } from '../../src/stateful/trace-commitment-helpers.js';
import { fundedSigner } from '../test-util.js';

// A state write checks the new data-NFT commitment with OP_OUTPUTTOKENCOMMITMENT then OP_EQUALVERIFY, and the pair
// can straddle an OP_INVOKE boundary. When the EQUALVERIFY opened an outlined helper, the SDK probe took that
// helper's ip-0 step for the redeem-script start and sliced the introspection away, so it kept the old commitment
// and the covenant's check failed (solc semanticTests functionCall/inheritance/base_base_overload.sol and
// modifiers/function_return_parameter_complex.sol). The data-NFT preservation after the EQUALVERIFY now opens with
// an OP_INVOKE (its master-lock-bound covenant check), so these sources split the pair the other way: the
// introspection closes an invoked helper. The probe's slice rule is pinned on a synthetic trace.
const options = { evmCompat: true, forceStateful: true };

// One-field writes through explicit base overloads re-encode the untouched field from the current commitment.
const OVERLOAD_SRC = `
contract Root {
  uint256 public x;
  uint256 public y;
  function put(uint256 a, uint256 b) public virtual { x = b; y = a; }
  function put(uint256 a) public virtual { x = a + 1; }
}
contract Mid is Root {
  function put(uint256 a, uint256 b) public override { x = a; y = b; }
  function put(uint256 a) public override { x = a; }
}
contract Leaf is Mid {
  function viaMid(uint256 c) public { Mid.put(c); }
  function viaMid(uint256 c, uint256 d) public { Mid.put(c, d); }
  function viaRoot(uint256 c) public { Root.put(c); }
  function viaRoot(uint256 c, uint256 d) public { Root.put(c, d); }
}
contract Probe is Leaf {
  function readX(uint256 e) public view { require(x == e); }
  function readY(uint256 e) public view { require(y == e); }
  function oneViaMid(uint256 c) public { viaMid(c); require(true); }
  function twoViaMid(uint256 c, uint256 d) public { viaMid(c, d); require(true); }
  function oneViaRoot(uint256 c) public { viaRoot(c); require(true); }
  function twoViaRoot(uint256 c, uint256 d) public { viaRoot(c, d); require(true); }
}`;

// A modifier increments state before its body; its arguments are return variables read at modifier entry.
const MODIFIER_SRC = `
contract Counter {
  uint256 public x = 0;
  modifier bumpThenZero(uint256 a, uint256 b) {
    x++;
    _;
    require(a == 0, "a is not zero");
    require(b == 0, "b is not zero");
  }
  function triple() public bumpThenZero(r1, r3) returns (uint256 r1, uint256 r2, uint256 r3) {
    r1 = 16;
    r2 = 32;
    r3 = 64;
  }
  function fails(uint256 i) public bumpThenZero(i, r + 20) returns (uint256 r) { r = 0; }
  function nested() bumpThenZero(r, r) bumpThenZero(r, r) bumpThenZero(r + r, r - r) bumpThenZero(r * r, r & r)
    public returns (uint256 r) { r = x; }
}
contract Probe is Counter {
  function callTriple(uint256 e0, uint256 e1, uint256 e2, bool cmp) public {
    (uint256 r0, uint256 r1, uint256 r2) = triple();
    require(!cmp || (r0 == e0 && r1 == e1 && r2 == e2));
  }
  function readX(uint256 e, bool cmp) public view {
    uint256 r0 = x;
    require(!cmp || (r0 == e));
  }
  function callFails(uint256 a, uint256 e, bool cmp) public {
    uint256 r0 = fails(a);
    require(!cmp || (r0 == e));
  }
  function callNested(uint256 e, bool cmp) public {
    uint256 r0 = nested();
    require(!cmp || (r0 == e));
  }
}`;

type Instruction = { opcode: number; data?: Uint8Array };
const decode = (bytecode: Uint8Array): Instruction[] => decodeAuthenticationInstructions(bytecode);
const pushKey = (instruction?: Instruction): string =>
  `${instruction?.opcode}:${binToHex(instruction?.data ?? new Uint8Array())}`;

// The shape under test: an OP_DEFINE'd body ends with OP_OUTPUTTOKENCOMMITMENT, and OP_EQUALVERIFY follows its
// OP_INVOKE.
const hasCommitmentClosingHelper = (bytecodeHex: string): boolean => {
  const top = decode(hexToBin(bytecodeHex));
  const defined = top.flatMap((instruction, index) => (instruction.opcode === OpcodesBCH.OP_DEFINE
    ? [{ id: pushKey(top[index - 1]), body: decode(top[index - 2]?.data ?? new Uint8Array()) }]
    : []));
  const closing = new Set(defined
    .filter(({ body }) => body.at(-1)?.opcode === OpcodesBCH.OP_OUTPUTTOKENCOMMITMENT)
    .map(({ id }) => id));
  return [top, ...defined.map(({ body }) => body)].some((body) => body.some((instruction, index) =>
    instruction.opcode === OpcodesBCH.OP_INVOKE && closing.has(pushKey(body[index - 1]))
    && body[index + 1]?.opcode === OpcodesBCH.OP_EQUALVERIFY));
};

type Handle = Record<string, (...args: Array<bigint | boolean>) => { send: () => Promise<unknown> }>;

const deploy = async (source: string): Promise<Handle> => {
  const artifact = compileString(source, options);
  expect(hasCommitmentClosingHelper(artifact.debug?.bytecode ?? '')).toBe(true);
  const contract = await getContractFactory(artifact, await fundedSigner(8)).deploy();
  return contract as unknown as Handle;
};

describe('state commitment verified in an outlined helper (VM-verified, stateful)', () => {
  it('one-field writes through explicit base overloads keep the other field', async () => {
    const sc = await deploy(OVERLOAD_SRC);
    await sc.oneViaMid(2n).send();
    await sc.readX(2n).send();
    await sc.readY(0n).send();
    await sc.twoViaMid(3n, 3n).send();
    await sc.oneViaRoot(4n).send();
    await sc.readX(5n).send();
    await sc.readY(3n).send();
    await sc.twoViaRoot(9n, 10n).send();
    await sc.readX(10n).send();
    await sc.readY(9n).send();
    await expect(sc.readX(11n).send()).rejects.toThrow();
  });

  it('a modifier increment around bodies returning one or several values', async () => {
    const sc = await deploy(MODIFIER_SRC);
    await sc.callTriple(16n, 32n, 64n, true).send();
    await sc.readX(1n, true).send();
    await expect(sc.callFails(1n, 0n, false).send()).rejects.toThrow();
    await expect(sc.callFails(0n, 0n, false).send()).rejects.toThrow();
    await sc.readX(1n, true).send();
    await sc.callNested(5n, true).send();
    await sc.readX(5n, true).send();
  });

  it('an invoked body\'s ip-0 step never anchors the redeem-script slice', () => {
    const redeem = [OpcodesBCH.OP_1, OpcodesBCH.OP_OUTPUTTOKENCOMMITMENT].map((opcode) => ({ opcode }));
    const helper = [OpcodesBCH.OP_EQUALVERIFY, OpcodesBCH.OP_1, OpcodesBCH.OP_DROP].map((opcode) => ({ opcode }));
    const step = (instructions: Instruction[], ip: number, functionCount: number): AuthenticationProgramStateCommon =>
      ({ instructions, ip, functionCount }) as unknown as AuthenticationProgramStateCommon;
    // Sparse: the redeem's ip-0 step is not observed, only its introspection and a helper opening with EQUALVERIFY.
    expect(findRedeemScriptStart([step(redeem, 1, 2), step(helper, 0, 2)])).toBe(-1);
    // Full: a longer helper body entered at ip 0 after the OP_DEFINEs is not the redeem script.
    expect(findRedeemScriptStart([step(redeem, 0, 0), step(redeem, 1, 2), step(helper, 0, 2)])).toBe(0);
  });
});
