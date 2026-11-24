/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const SATOSHI = 'pragma satoshicontainer single;\n';
const TOKEN = 'pragma tokencontainer single;\n';
const contract = (body: string, pragmas = SATOSHI + TOKEN): string => `pragma solidcash ^0.52.0;
${pragmas}contract C() {
  uint32 n;
  constructor() { this.n = 0; }
  ${body}
}`;
const layout = (source: string, name: string, options = {}) => compileString(source, options).abi
  .find((fn) => fn.name === name)?.blockLayout;
const PAYABLE = 'function deposit() public payable { this.n = this.n + 1; }';

describe('pragma satoshicontainer single and pragma tokencontainer single', () => {
  it('gives a payable function the satoshi container under the satoshi pragma', () => {
    const deposit = layout(contract(PAYABLE, SATOSHI), 'deposit');
    expect(deposit?.slots.map((slot) => slot.kind)).toContain('satoshiContainer');
    expect(deposit?.singleSatoshiContainer).toBe(true);
    expect(deposit?.singleTokenContainer).toBeUndefined();
  });

  it('leaves a payable function without it under the token pragma alone', () => {
    const deposit = layout(contract(PAYABLE, TOKEN), 'deposit');
    expect(deposit?.slots.map((slot) => slot.kind)).not.toContain('satoshiContainer');
    expect(deposit?.singleTokenContainer).toBe(true);
    expect(deposit?.singleSatoshiContainer).toBeUndefined();
  });

  it('states both on a contract that has both', () => {
    const deposit = layout(contract(PAYABLE), 'deposit');
    expect(deposit?.singleSatoshiContainer).toBe(true);
    expect(deposit?.singleTokenContainer).toBe(true);
  });

  it('leaves a function that holds no value without the satoshi container', () => {
    const bump = layout(contract('function bump() public { this.n = this.n + 1; }'), 'bump');
    expect(bump?.slots.map((slot) => slot.kind)).not.toContain('satoshiContainer');
  });

  it('changes nothing without the pragmas', () => {
    const deposit = layout(contract(PAYABLE, ''), 'deposit');
    expect(deposit?.slots.map((slot) => slot.kind)).not.toContain('satoshiContainer');
    expect(deposit?.singleSatoshiContainer).toBeUndefined();
    expect(deposit?.singleTokenContainer).toBeUndefined();
  });

  it('takes no other value', () => {
    expect(() => compileString(contract('function f() public {}', 'pragma satoshicontainer many;\n')))
      .toThrow(/Expected "pragma satoshicontainer single"/);
    expect(() => compileString(contract('function f() public {}', 'pragma tokencontainer many;\n')))
      .toThrow(/Expected "pragma tokencontainer single"/);
  });

  it('names the two pragmas where the one for both containers was', () => {
    expect(() => compileString(contract('function f() public {}', 'pragma containers single;\n')))
      .toThrow(/Expected "pragma satoshicontainer single" or "pragma tokencontainer single"/);
  });

  it('is refused for a framed contract', () => {
    const source = (pragmas: string): string =>contract('function f() public { this.n = 1; }', pragmas);
    expect(() => compileString(source(SATOSHI), { composition: 'framed' }))
      .toThrow(/pragma satoshicontainer single is not available to a framed contract/);
    expect(() => compileString(source(TOKEN), { composition: 'framed' }))
      .toThrow(/pragma tokencontainer single is not available to a framed contract/);
  });

  it('builds no message-bus route: a composed call could not keep the promise', () => {
    for (const pragmas of [SATOSHI, TOKEN]) {
      const artifact = compileString(contract('function f() public { this.n = 1; }', pragmas), { messageBus: true });
      expect(artifact.messageBus).toBeUndefined();
      expect(artifact.abi.map((fn) => fn.name)).not.toContain('__message_bus1');
    }
  });

  it('cannot send an NFT from a token container, whose one coin stays as it is', () => {
    const source = (pragmas: string): string =>`pragma solidcash ^0.52.0;
${pragmas}contract C(bytes32 asset) {
  uint32 n;
  constructor() { this.n = 0; }
  function f(address to) public { this.n = 1; this.tokens[asset].transferNft(to, hex"aa", 1); }
}`;
    expect(() => compileString(source(TOKEN)))
      .toThrow(/pragma tokencontainer single cannot send an NFT from a container in 'f'/);
    expect(() => compileString(source(SATOSHI))).not.toThrow();
    expect(() => compileString(source(''))).not.toThrow();
  });

  it('is refused through an upgrade, which moves the containers', () => {
    const source = (pragmas: string): string =>contract('function f(address to) public upgrade { this.n = 1; }', pragmas);
    expect(() => compileString(source(SATOSHI)))
      .toThrow(/pragma satoshicontainer single cannot keep its containers through 'f'/);
    expect(() => compileString(source(TOKEN)))
      .toThrow(/pragma tokencontainer single cannot keep its containers through 'f'/);
  });

  it('is refused through a delegatecall, under either pragma', () => {
    const source = (pragmas: string): string =>`pragma solidcash ^0.52.0;
${pragmas}contract C() {
  event E(int v);
  uint32 n;
  constructor() { this.n = 0; }
  function f(address t) public { emit E(1); t.delegatecall(0x1234); }
}`;
    const options = { allowUnsafeOperations: true };
    expect(() => compileString(source(SATOSHI), options))
      .toThrow(/pragma satoshicontainer single cannot keep its containers through 'f'/);
    expect(() => compileString(source(TOKEN), options))
      .toThrow(/pragma tokencontainer single cannot keep its containers through 'f'/);
    expect(() => compileString(source(''), options)).not.toThrow();
  });

  it('refuses a BCH transfer in a runtime loop under the satoshi pragma only', () => {
    const source = (pragmas: string): string =>contract(
      'function f(address to, uint32 count) public { this.n = 1; for (uint32 i = 0; i < count; i++) { this.transfer(to, 1000); } }',
      pragmas,
    );
    expect(() => compileString(source(SATOSHI)))
      .toThrow(/pragma satoshicontainer single cannot keep its containers through 'f'/);
    expect(() => compileString(source(TOKEN))).not.toThrow();
    expect(() => compileString(source(''))).not.toThrow();
  });
});
