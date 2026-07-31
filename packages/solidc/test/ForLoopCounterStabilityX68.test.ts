import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const OPTIONS = {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
} as const;

const source = (body: string, pointer = true): string => `pragma solidcash >=0.8.0;
interface IFoo { function run(uint value); }
contract CounterStability() {
  ${pointer ? 'function(uint) external[] handlers;' : 'int n;'}
  ${pointer ? 'function register(address target) public { this.handlers.push(IFoo(target).run); require(true); }' : ''}
  function fireAll(uint value, address target) public {
    require(${pointer ? 'handlers.length' : 'n'} <= 3);
    for (int i = 0; i < ${pointer ? 'handlers.length' : 'n'}; i = i + 1) {
      ${body}
    }
    require(value >= 0);
  }
}`;

describe('X68 - a for loop cannot invalidate its compiler-proven counter progression', () => {
  it('refuses a pointer-table loop whose body rewinds its own counter', () => {
    expect(() => compileString(source('handlers[i](value); i = i - 1;'), OPTIONS))
      .toThrow("Message-bus pointer-table loop is not compiler-bounded: the loop body can change its counter 'i'");
  });

  it('publishes no ceiling for a rolled interface loop whose body rewinds its own counter', () => {
    const artifact = compileString(source('IFoo(target).run(value); i = i - 1;', false), OPTIONS);
    const [call] = artifact.abi.find((entry) => entry.name === 'fireAll')!.externalCalls!;
    expect(call.occurrence).toBe('loop');
    expect(call.maximumOccurrences).toBeUndefined();
    expect(call.occurrenceBoundSource).toBeUndefined();
  });

  it('does not reject an ordinary for loop merely because its body writes the counter', () => {
    expect(() => compileString(source('i = i - 1;', false), OPTIONS)).not.toThrow();
  });
});
