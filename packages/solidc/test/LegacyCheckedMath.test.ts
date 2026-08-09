import { parseCode } from '../src/compiler.js';
import MarkLegacyCheckedMath from '../src/semantic/MarkLegacyCheckedMath.js';

const marked = (body: string): string | undefined => {
  const ast = parseCode(`
    pragma solidity 0.6.12;
    library ArbitraryName {
      function op(uint256 a, uint256 b) internal pure returns (uint256 c) { ${body} }
    }
    contract C { function f() external { require(true); } }
  `, undefined, true);
  ast.accept(new MarkLegacyCheckedMath());
  return ast.freeFunctions[0].nativeCheckedMath;
};

describe('legacy checked-math proof', () => {
  it('recognises behavior rather than library or method names', () => {
    expect(marked('require((c = a + b) >= b, "overflow");')).toBe('+');
    expect(marked('require((c = a - b) <= a, "underflow");')).toBe('-');
    expect(marked('require(b == 0 || (c = a * b) / b == a, "overflow");')).toBe('*');
  });

  it('rejects a near-match with different behavior', () => {
    expect(marked('require((c = a + b) > b, "different at a == 0");')).toBeUndefined();
  });
});
