pragma solidity ^0.8.7;
contract Sized {
  uint a;
  uint b;
  uint c;
  function setA(uint v) public { a = v; require(v >= 0, "n"); }
  function setB(uint v) public { b = v; require(v >= 0, "n"); }
  function setC(uint v) public { c = v; require(v >= 0, "n"); }
}
