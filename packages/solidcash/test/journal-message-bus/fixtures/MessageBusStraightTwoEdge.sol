pragma solidity >=0.8.0;

contract TwoEdgeCallee {
    uint256 public brand;

    constructor(uint256 value) {
        brand = value;
    }

    function tick(uint256 value) public pure {
        require(value > 0);
    }
}

contract TwoEdgeCaller {
    TwoEdgeCallee public target;
    uint256 public knob;

    constructor(TwoEdgeCallee value) {
        target = value;
        knob = 3;
    }

    function ping() public {
        target.tick(knob + 1);
        target.tick(knob + 2);
    }
}
