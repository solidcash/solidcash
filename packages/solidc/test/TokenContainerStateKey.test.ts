/**
 * A token container keyed by a local bound to an immutable bytes32 state variable: the value is fixed at genesis, so
 * the ABI names the variable and the SDK reads the key from the state a call loads. A mutable variable is refused.
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

  it('refuses a mutable state variable as the key', () => {
    expect(() => compileString(source('internal'), { messageBus: false, suppressWarnings: true }))
      .toThrow(TokenContainerKeyMustBeParameterError);
  });
});
