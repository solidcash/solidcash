import { describe, expect, it } from 'vitest';
import { compileString, compileStringMulti } from '../../src/compiler.js';

/**
 * A pair-shaped participant: a stateful caller with a returning helper chain. `_mintFee` returns its `feeOn`
 * flag and emits through the VOID `_mint`, so the returning-helper inliner must follow the void callee to move
 * the emit into the entry point. If it does not, the route is refused with `EmittingStateHelperEventError` and
 * the artifact falls back to a direct-only compile. The paired state/collection/event shape of `mint` is also
 * exactly what the kernel route journal refuses (a conditional scalar update beside mapping rows).
 */
const PAIR = `pragma solidity ^0.8.20;
interface IFactory { function feeToAndMigrator() external view returns (address, address); }
contract Pairish {
  uint112 reserve0;
  uint112 reserve1;
  uint32 blockTimestampLast;
  uint totalSupply;
  uint kLast;
  mapping(address => uint) balanceOf;
  address factory;
  event Transfer(address indexed from, address indexed to, uint value);
  event Sync(uint112 reserve0, uint112 reserve1);
  function getReserves() external view returns (uint112, uint112, uint32) {
    return (reserve0, reserve1, blockTimestampLast);
  }
  function _mint(address to, uint value) private {
    totalSupply = totalSupply + value;
    balanceOf[to] = balanceOf[to] + value;
    emit Transfer(address(0), to, value);
  }
  function _mintFee(uint112 r0, uint112 r1, address feeTo) private returns (bool feeOn) {
    feeOn = feeTo != address(0);
    uint last = kLast;
    if (feeOn) {
      if (last != 0) {
        uint rootK = uint(r0);
        uint rootKLast = last;
        if (rootK > rootKLast) {
          uint liquidity = rootK - rootKLast;
          if (liquidity > 0) _mint(feeTo, liquidity);
        }
      }
    } else if (last != 0) {
      kLast = 0;
    }
  }
  function mint(address to) external returns (uint liquidity) {
    address feeTo = address(0);
    (feeTo,) = IFactory(factory).feeToAndMigrator();
    bool feeOn = _mintFee(reserve0, reserve1, feeTo);
    liquidity = uint(reserve0) + 1;
    require(liquidity > 0, 'UniswapV2: INSUFFICIENT_LIQUIDITY_MINTED');
    _mint(to, liquidity);
    reserve0 = uint112(reserve0 + 1);
    if (feeOn) kLast = uint(reserve0) * uint(reserve1);
    emit Sync(reserve0, reserve1);
  }
}`;

const compile = (handlers: string[]): ReturnType<typeof compileString> => compileString(PAIR, {
  evmCompat: true,
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  messageBusHandlersByContract: { Pairish: handlers },
} as never);

describe('pair-shaped participant route admission', () => {
  it('publishes a getReserves route through an emitting returning helper chain', { timeout: 30_000 }, () => {
    const artifact = compile(['getReserves']);
    // Without the implicit-return inliner fix the whole route is refused (X118) and this field is absent.
    expect(artifact.messageBus).toBeDefined();
    const getReserves = artifact.messageBus!.handlers.find((handler) => handler.name === 'getReserves');
    expect(getReserves?.eligible).toBe(true);
    expect(artifact.messageBus!.handlers.find((handler) => handler.name === 'mint')?.eligible).toBe(false);
    // The per-contract selection is the route's whole entry set: no collection getter joins it implicitly.
    expect(artifact.messageBus!.admittedHandlerIds).toEqual(['getReserves']);
  });

  it('keeps the stateful mint out of the kernel route with a named reason', { timeout: 30_000 }, () => {
    const artifact = compile(['getReserves', 'mint']);
    expect(artifact.messageBus).toBeDefined();
    const getReserves = artifact.messageBus!.handlers.find((handler) => handler.name === 'getReserves');
    const mint = artifact.messageBus!.handlers.find((handler) => handler.name === 'mint');
    expect(getReserves?.eligible).toBe(true);
    // `mint` writes a conditional scalar beside mapping rows and an event: the kernel journal has no row-local
    // settlement for that shape, so admission refuses it by name instead of publishing a route the VM rejects.
    expect(mint?.eligible).toBe(false);
    expect(mint?.rejectionReason).toMatch(/^KERNEL_/);
  });
});

describe('per-contract message-bus opt-out', () => {
  const SIBLINGS = `pragma solidity ^0.8.20;
contract DirectOnly {
  uint value;
  mapping(address => uint) balances;
  event Set(address indexed who, uint value);
  function set(uint next) external {
    value = next;
    balances[msg.sender] = next;
    emit Set(msg.sender, next);
  }
}
contract Routed {
  uint value;
  mapping(address => uint) balances;
  event Set(address indexed who, uint value);
  function set(uint next) external {
    value = next;
    balances[msg.sender] = next;
    emit Set(msg.sender, next);
  }
}`;

  it('leaves the opted-out contract byte-identical to a direct build and routes its sibling', { timeout: 30_000 }, () => {
    const options = { evmCompat: true, forceStateful: true, messageBusKernel: true } as const;
    const direct = compileStringMulti(SIBLINGS, { ...options, messageBus: false } as never);
    const mixed = compileStringMulti(SIBLINGS, {
      ...options, messageBus: true, messageBusByContract: { DirectOnly: false },
    } as never);
    // The opted-out contract keeps the exact lowering a project without the bus would compile.
    expect(mixed.DirectOnly.bytecode).toBe(direct.DirectOnly.bytecode);
    expect(mixed.DirectOnly.messageBus).toBeUndefined();
    // The sibling still publishes its route, so the opt-out is per contract.
    expect(mixed.Routed.messageBus).toBeDefined();
  });
});
