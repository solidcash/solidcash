import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

/**
 * A call a function makes beside its delegatecall is verified like a call in any other function: the delegate
 * authorizes the proxy's state, and nothing it runs binds a call the proxy makes itself. The machine cases (another
 * callee, another function, no callee, a returning call) are in solidcash `e2e/DelegatecallExternalCall.test.ts`.
 */
const IH = 'interface IH { function inc(uint256 v); function dec(uint256 v); }';

describe('an external call beside a delegatecall', () => {
  it('compiles, listing the call for its verification', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
${IH}
contract T(address impl, address target) {
  bigint counter;
  function fire(uint256 v) {
    (bool ok, ) = impl.delegatecall(abi.encodeWithSignature("x()")); require(ok);
    IH(target).inc(v);
  }
}`, { messageBus: false });
    const fire = artifact.abi.find((entry) => entry.name === 'fire');
    expect(fire?.externalCalls?.map((call) => `${call.interfaceName}.${call.functionName}/${call.occurrence}`))
      .toStrictEqual(['IH.inc/once']);
    expect(fire?.lowLevelCalls?.map((call) => call.callMode)).toStrictEqual(['delegatecall']);
  });
});
