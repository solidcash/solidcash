pragma solidity ^0.8.7;
contract Pair {
  uint total;
  uint count;
  uint other;
  mapping(uint256 => mapping(address => bool)) whitelist;
  function publish(uint256 jobId_, address[] calldata allowed_) public {
    other = jobId_;
    updateWhitelist(jobId_, allowed_, allowed_);
    require(jobId_ >= 0, "neg");
  }
  function updateWhitelist(uint256 jobId_, address[] calldata a_, address[] calldata d_) public {
    for (uint256 i = 0; i < a_.length; i++) { whitelist[jobId_][a_[i]] = true; count = count + 1; }
    for (uint256 i = 0; i < d_.length; i++) { whitelist[jobId_][d_[i]] = false; total = total + 1; }
    require(jobId_ >= 0, "neg");
  }
}
