# Constructor external reads (deploy-resolved immutables)

A Solidity constructor can read a value from another contract and store it immutably:

```solidity
contract UniswapV3Flash {
    IUniswapV3Pool immutable pool;
    IERC20 immutable token0;
    IERC20 immutable token1;

    constructor(address _pool) {
        pool = IUniswapV3Pool(_pool);
        token0 = IERC20(pool.token0());   // reads token0 from the pool at deploy
        token1 = IERC20(pool.token1());
    }
    // ... token0.transfer(...), token1.transferFrom(...) as external-call targets ...
}
```

On Ethereum the constructor runs on-chain at deploy, so `pool.token0()` executes and its result is baked into
the contract. **Bitcoin Cash has no on-chain constructor** - a contract's immutables are computed off-chain and
baked into its initial state UTXO. So an on-chain `pool.token0()` inside the constructor has no BCH analogue.

## What SolidCash does

A **zero-arg external read on an interface-typed state variable, inside the constructor**, is hoisted to a
synthesized **deploy-input parameter**. The example above compiles as if it were written:

```solidity
constructor(address _pool, address __ctorread_pool_token0_0, address __ctorread_pool_token1_1) {
    pool = IUniswapV3Pool(_pool);
    token0 = IERC20(__ctorread_pool_token0_0);
    token1 = IERC20(__ctorread_pool_token1_1);
}
```

The extra parameters appear in the artifact's `stateLayout.constructorInputs`. The result is a pinnable baked
immutable, so the read-derived value can be used as an external-call target (`token0.transfer(...)`) like any
other constructor-provided immutable. The compiler emits a warning listing each hoisted read.

## Supplying the values at deploy

The deployer (or SDK) resolves each read **off-chain** and passes it as the corresponding constructor input -
e.g. query `pool.token0()` / `pool.token1()` from the target contract, then deploy with those addresses. This
matches Solidity's deploy-time-read intent; the read simply happens off-chain instead of on-chain.

## Soundness

The hoisted values are **deployer-provided**, like every other constructor argument. A deployer that supplies a
value other than the real `pool.token0()` bakes an incorrect immutable into its own contract (its own concern -
users of the deployed contract see, and can verify, the baked addresses). This is a slightly weaker guarantee
than Solidity's on-chain read, and is the necessary BCH adaptation. Only zero-arg reads are hoisted; a read with
arguments, or a read outside the constructor, is left as a real on-chain external call.
