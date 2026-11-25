import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const SOURCE = `pragma solidcash ^0.52.0;
contract Counter() {
    uint32 count;
    constructor() { this.count = 0; }
    function deposit() public payable {
        require(msg.value == 5000, "value");
        this.count = this.count + 1;
    }
    function getCount() public view returns (uint32) { return this.count; }
}`;

describe('the direct convention publishes no composition route', () => {
  it('compiles a stateful contract to bytecode without route metadata', () => {
    const artifact = compileString(SOURCE);
    expect(artifact.stateLayout).toBeDefined();
    expect(artifact.bytecode.length).toBeGreaterThan(0);
    expect(artifact.bytecode).not.toMatch(/53434231/);
    expect(Object.keys(artifact).map((key) => key.toLowerCase())
      .filter((key) => key.includes('bus'))).toEqual([]);
  });

  it('compiles the same source to identical bytecode on a second run', () => {
    const first = compileString(SOURCE);
    const second = compileString(SOURCE);
    expect(second.bytecode).toBe(first.bytecode);
  });
});
