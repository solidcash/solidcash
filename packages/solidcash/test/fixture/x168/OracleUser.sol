contract OracleUser() {
  uint seen;
  function record() public { this.seen = block.number; require(true); }
  function reset() public { this.seen = 0; require(true); }
}
