import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// A function with unnamed return types that can fall off its end returns its type defaults (Solidity semantics).
// When no function in the program names its returns, the compiler skips NamedReturnTransformation and runs only its
// fall-through default step, for the functions the final check would otherwise refuse.
describe('fall-through default return when no function names its returns', () => {
  const contractName = (source: string): string => compileString(source, { solidityImportCompat: true }).contractName;

  it('completes a helper whose other arm ends in an inline-assembly revert (OZ Address._verifyCallResult)', () => {
    // The assembly revert lowers to require(false), which the final check does not count as an exit.
    expect(contractName(`pragma solidity 0.6.12;
      contract C {
        function _verifyCallResult(bool success, bytes memory returndata, string memory errorMessage)
            private pure returns (bytes memory) {
          if (success) {
            return returndata;
          } else {
            if (returndata.length > 0) {
              assembly {
                let returndata_size := mload(returndata)
                revert(add(32, returndata), returndata_size)
              }
            } else {
              revert(errorMessage);
            }
          }
        }
        function f(bool ok, bytes memory data) public pure { require(_verifyCallResult(ok, data, "x").length >= 0); }
      }`)).toBe('C');
  });

  it('completes a helper that ends in a call to a contract function that always reverts', () => {
    expect(contractName(`pragma solidity 0.8.20;
      contract C {
        function _fail() private pure { revert("no"); }
        function _get(bool ok) private pure returns (uint256) { if (ok) { return 1; } _fail(); }
        function f(bool ok) public pure { require(_get(ok) == 1); }
      }`)).toBe('C');
  });

  it('completes an empty returning helper', () => {
    expect(contractName(`pragma solidity 0.8.20;
      contract C {
        function _get() private pure returns (uint256) { }
        function f() public pure { require(_get() == 0); }
      }`)).toBe('C');
  });
});
