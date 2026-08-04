pragma solidity ^0.8.7;
abstract contract AMod {
  struct AStorage { uint256 a; }
  bytes32 private constant ALoc = 0x9016d09d72d40fdae2fd8ceac6b6234c7706214fd39c1cd1e609a0528c199300;
  function _a() private pure returns (AStorage storage $) { assembly { $.slot := ALoc } }
  function _setA(uint256 v) internal { AStorage storage $ = _a(); $.a = v; }
}
abstract contract BMod {
  struct BStorage { uint256 b; }
  bytes32 private constant BLoc = 0xcd5ed15c6e187e77e9aee88184c21f4f2182ab5827cb3b7e07fbedcd63f03300;
  function _b() private pure returns (BStorage storage $) { assembly { $.slot := BLoc } }
  function _setB(uint256 v) internal { BStorage storage $ = _b(); $.b = v; }
}
abstract contract CMod {
  struct CStorage { uint256 c; }
  bytes32 private constant CLoc = 0x237e158222e3e6968b72b9db0d8043aacf074ad9f650f0d1606b4d82ee432c00;
  function _c() private pure returns (CStorage storage $) { assembly { $.slot := CLoc } }
  function _setC(uint256 v) internal { CStorage storage $ = _c(); $.c = v; }
}
contract Multi is AMod, BMod, CMod {
  uint256 own;
  function touchC(uint256 v) public { _setC(v); own = v; require(v >= 0, "n"); }
  function touchA(uint256 v) public { _setA(v); own = v + 1; require(v >= 0, "n"); }
  function touchB(uint256 v) public { _setB(v); own = v + 2; require(v >= 0, "n"); }
}
