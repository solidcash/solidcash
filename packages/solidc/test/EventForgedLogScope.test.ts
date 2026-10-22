import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

// SEC-10: an own-category immutable NFT output may only sit at an event offset of a contract with events. A stateful
// contract whose emitted event is declared outside it (file level, library, interface) declares no event itself,
// yet its log is readable at the same event address, so it must carry the pin the contract-level form carries.
const members = (emit: string): string => `
    bigint counter;
    function bump(bigint x) {
      ${emit}(x);
      this.counter = this.counter + x;
      require(x > 0);
    }
    function quiet(bigint x) {
      this.counter = this.counter + x;
      require(x > 0);
    }`;

describe('SEC-10 forged-log pin whatever scope declares the emitted event', () => {
  const contractLevel = compileString(`contract C() { event Fired(bigint value); ${members('emit Fired')} }`);

  it('pins a stateful contract emitting a file-level event as the contract-level form', () => {
    const fileLevel = compileString(`event Fired(bigint value); contract C() { ${members('emit Fired')} }`);
    expect(fileLevel.bytecode).toBe(contractLevel.bytecode);
  });

  it('pins a stateful contract emitting a library event as the contract-level form', () => {
    const library = compileString(
      `library L { event Fired(bigint value); } contract C() { ${members('emit L.Fired')} }`,
    );
    expect(library.bytecode).toBe(contractLevel.bytecode);
  });

  it('pins a stateful contract emitting an interface event as the contract-level form', () => {
    const iface = compileString(
      `interface I { event Fired(bigint value); } contract C() { ${members('emit I.Fired')} }`,
    );
    expect(iface.bytecode).toBe(contractLevel.bytecode);
  });

  it('leaves a contract that emits nothing unchanged by a file-level event declaration', () => {
    const quiet = 'bigint counter; function quiet(bigint x) { this.counter = this.counter + x; require(x > 0); }';
    expect(compileString(`event Fired(bigint value); contract C() { ${quiet} }`).bytecode)
      .toBe(compileString(`contract C() { ${quiet} }`).bytecode);
  });
});
