pragma solidity >=0.0;
import "./pure_library_constants.sol";

contract PureLibConsumer {
    using PureMath for *;

    function f(uint v) public pure returns (uint) {
        require(v.safeToAdd(1));
        require(PureMath.ONE > 0);
        return PureMath.halfOne();
    }
}
