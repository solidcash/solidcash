pragma solidity ^0.8.7;
contract SplitInit {
  uint value;
  constructor(uint initial) { value = initial; }
  function set(uint next) external { value = next + block.timestamp; require(next > 0); }
}
