pragma solidity ^0.8.20;

import "./Record.sol";

contract CachedRecords {
  Record[] records;

  function update(uint index, uint delta, bool defer) public {
    Record storage selected = records[index];
    if (defer) {
      selected.amount += delta;
    } else {
      selected.marker = delta;
    }
    require(index < records.length);
  }
}
