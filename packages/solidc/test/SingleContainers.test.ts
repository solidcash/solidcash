import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const contract = (body: string): string => `pragma solidcash ^0.14.0;
pragma containers single;
contract C() {
  uint32 n;
  constructor() { this.n = 0; }
  ${body}
}`;
const layout = (source: string, name: string, options = {}) => compileString(source, options).abi
  .find((fn) => fn.name === name)?.blockLayout;

describe('pragma containers single', () => {
  it('gives a payable function the satoshi container', () => {
    const deposit = layout(contract('function deposit() public payable { this.n = this.n + 1; }'), 'deposit');
    expect(deposit?.slots.map((slot) => slot.kind)).toContain('satoshiContainer');
    expect(deposit?.singleContainers).toBe(true);
  });

  it('leaves a function that holds no value without it', () => {
    const bump = layout(contract('function bump() public { this.n = this.n + 1; }'), 'bump');
    expect(bump?.slots.map((slot) => slot.kind)).not.toContain('satoshiContainer');
  });

  it('changes nothing without the pragma', () => {
    const source = contract('function deposit() public payable { this.n = this.n + 1; }')
      .replace('pragma containers single;\n', '');
    const deposit = layout(source, 'deposit');
    expect(deposit?.slots.map((slot) => slot.kind)).not.toContain('satoshiContainer');
    expect(deposit?.singleContainers).toBeUndefined();
  });

  it('takes no other value', () => {
    expect(() => compileString(contract('function f() public {}').replace('single', 'many')))
      .toThrow(/Expected "pragma containers single"/);
  });

  it('is refused for a framed contract', () => {
    expect(() => compileString(contract('function f() public { this.n = 1; }'), { composition: 'framed' }))
      .toThrow(/pragma containers single is not available to a framed contract/);
  });

  it('builds no message-bus route: a composed call could not keep the promise', () => {
    const artifact = compileString(contract('function f() public { this.n = 1; }'), { messageBus: true });
    expect(artifact.messageBus).toBeUndefined();
    expect(artifact.abi.map((fn) => fn.name)).not.toContain('__message_bus1');
  });

  it('is refused through an upgrade, which moves the containers', () => {
    expect(() => compileString(contract('function f(address to) public upgrade { this.n = 1; }')))
      .toThrow(/pragma containers single cannot keep its containers through 'f'/);
  });
});
