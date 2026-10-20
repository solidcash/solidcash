/**
 * A token container keyed by a local bound to an immutable bytes32 state variable: the value is fixed at genesis, so
 * the ABI names the variable and the SDK reads the key from the state a call loads. A mutable variable is refused, and a
 * message-bus route carries the access as the handler states it, reading the key itself.
 */
import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';
import { TokenContainerKeyMustBeParameterError } from '../src/Errors.js';

const source = (modifier: string): string => `
pragma solidcash >=0.8.0;

contract Reserve() {
    bytes32 ${modifier} bearer;

    constructor(bytes32 bearer_) {
        this.bearer = bearer_;
    }

    function pay(address to, int amount) {
        bytes32 category = this.bearer;
        require(this.tokens[category].tokenAmount >= amount);
        this.tokens[category].transfer(to, amount);
    }
}
`;

describe('token container keyed by state', () => {
  it('publishes an immutable bytes32 key as the state variable it reads', () => {
    const artifact = compileString(source('immutable'), { messageBus: false, suppressWarnings: true });
    const pay = artifact.abi.find((entry) => entry.name === 'pay')!;
    expect(pay.tokenContainerAccesses).toEqual([expect.objectContaining({
      keySource: 'state', keyStateVariable: 'bearer', operations: ['read', 'transfer'],
    })]);
    expect(pay.inputs.map((input) => input.name)).not.toContain('category');
  });

  it('carries a state-keyed container onto a message-bus route beside a parameter-keyed one', () => {
    const control = `
pragma solidcash >=0.8.0;

contract Reserve() {
    int n;

    function pay(bytes32 category, address to, int amount) {
        this.n = this.n + 1;
        this.tokens[category].transfer(to, amount);
    }
}
`;
    const compiled = (text: string): ReturnType<typeof compileString> =>
      compileString(text, { messageBus: true, suppressWarnings: true });
    const stateKeyed = compiled(source('immutable'));
    expect(stateKeyed.messageBus?.handlers.find((candidate) => candidate.name === 'pay'))
      .toMatchObject({ eligible: true });
    expect(stateKeyed.messageBus?.route.tokenContainerAccesses).toEqual([expect.objectContaining({
      keySource: 'state', keyStateVariable: 'bearer',
    })]);
    expect(compiled(control).messageBus?.handlers.find((candidate) => candidate.name === 'pay'))
      .toMatchObject({ eligible: true });
  });

  it('refuses a mutable state variable as the key', () => {
    expect(() => compileString(source('internal'), { messageBus: false, suppressWarnings: true }))
      .toThrow(TokenContainerKeyMustBeParameterError);
  });
});
