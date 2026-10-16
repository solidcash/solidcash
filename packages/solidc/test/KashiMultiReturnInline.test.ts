import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

// Kashi `_isSolvent`: a returning STATE/entry-reading helper with EARLY returns. It cannot be an OP_INVOKE
// subroutine (the mapping read needs the caller's block layout) and it used to fail inline eligibility (several
// returns, not a single tail return). The single-exit normalization now folds the early returns into nested
// ternaries so the helper inlines into its entry point.
const KASHI = `
pragma solidcash >=0.8.0;
contract Kashi {
    mapping(bytes20 => int) bal;

    function _ok(bytes20 a, int m) internal view returns (bool) {
        int b = bal[a];
        if (b == 0) return false;
        if (b < m) return false;
        return b >= m * 2;
    }

    function check(bytes20 a, int m, bool expected) public view {
        require(_ok(a, m) == expected);
    }
}
`;

describe('Kashi _isSolvent multi-return state-helper inline', () => {
  it('inlines the early-return helper into its entry point', () => {
    const artifact = compileString(KASHI);
    const check = artifact.abi.find((entry) => entry.name === 'check');
    expect(check).toBeDefined();
    // The helper's mapping read landed on the caller, so the caller co-spends the entry.
    expect(check?.entryAccesses?.length).toBeGreaterThan(0);
    // The helper was fully inlined and dropped - no standalone OP_INVOKE subroutine remains.
    expect(artifact.abi.find((entry) => entry.name === '_ok')).toBeUndefined();
  });

  it('the inlined helper compiles to the same covenant body as the direct-expression oracle', () => {
    const DIRECT = `
pragma solidcash >=0.8.0;
contract KashiDirect {
    mapping(bytes20 => int) bal;

    function check(bytes20 a, int m, bool expected) public view {
        int b = bal[a];
        require((b == 0 ? false : (b < m ? false : b >= m * 2)) == expected);
    }
}
`;
    const inline = compileString(KASHI).abi.find((entry) => entry.name === 'check');
    const direct = compileString(DIRECT).abi.find((entry) => entry.name === 'check');
    // Both must expose the same entry read (one via the helper, one directly).
    expect(inline?.entryAccesses?.map((access) => access.collection))
      .toEqual(direct?.entryAccesses?.map((access) => access.collection));
  });
});
