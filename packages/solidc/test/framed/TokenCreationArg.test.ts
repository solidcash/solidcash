import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../src/compiler.js';

/**
 * A contract creation parameter of type `bytes32` is a valid token-container key and transfer key.
 * It is baked into the redeem program: it is not a state NFT field and does not need a state slot.
 * `this.tokens[cat_].transfer(address, amount)` must lower the same way.
 *
 * This is the framed syntax the Tornado token pool needs:
 *   contract TornadoTokenPool(int denom, bytes32 cat_)
 */
const SOURCE = 'pragma solidcash ^0.52.0;'
  + ' contract TornadoTokenPool(int denom, bytes32 cat_) {'
  + '   uint32 constant LEVELS = 20;'
  + '   bytes32 root; uint32 nextIndex; bytes32 nullifierState;'
  + '   constructor() { }'
  + '   function deposit(bytes32 commitment, bytes32[LEVELS] appendSiblings) public payable {'
  + '     int before = this.tokens[cat_].tokenAmount;'
  + '     int after = this.outState.tokens[cat_].tokenAmount;'
  + '     require(after == before + denom, "value");'
  + '     this.root = commitment; this.nextIndex = this.nextIndex + 1;'
  + '   }'
  + '   function pay(address recipient) public {'
  + '     require(this.tokens[cat_].tokenAmount >= denom, "pool-short");'
  + '     this.tokens[cat_].transfer(recipient, denom);'
  + '   }'
  + ' }';

describe('token container key from a contract creation argument', () => {
  it('compiles without a state slot and keeps the creation args on the artifact', () => {
    const artifact = compileStringMulti(SOURCE, { composition: 'framed' }).TornadoTokenPool!;
    expect(artifact.constructorInputs.map((input) => `${input.name}:${input.type}`))
      .toEqual(['denom:int256', 'cat_:bytes32']);
    expect(artifact.stateLayout?.variables.map((variable) => variable.name))
      .toEqual(['root', 'nextIndex', 'nullifierState']);
    expect(artifact.stateLayout?.variables.some((variable) => variable.name === 'denom')).toBe(false);
    expect(artifact.stateLayout?.variables.some((variable) => variable.name === 'cat_')).toBe(false);
    expect(artifact.abi.find((entry) => entry.name === '__construct')?.inputs).toEqual([]);
    expect(artifact.abi.some((entry) => entry.name === 'pay')).toBe(true);
  });

  it('accepts the same creation key in the direct composition', () => {
    const artifact = compileStringMulti(SOURCE, {}).TornadoTokenPool!;
    expect(artifact.constructorInputs.map((input) => `${input.name}:${input.type}`))
      .toEqual(['denom:int256', 'cat_:bytes32']);
    expect(artifact.stateLayout?.variables.map((variable) => variable.name))
      .toEqual(['root', 'nextIndex', 'nullifierState']);
    const accesses = artifact.abi.flatMap((entry) => entry.tokenContainerAccesses ?? []);
    expect(accesses.length).toBe(2);
    expect(accesses.every((access) => access.keyParam === 'cat_')).toBe(true);
    expect(accesses.every((access) => access.keySource !== 'state')).toBe(true);
  });
});
