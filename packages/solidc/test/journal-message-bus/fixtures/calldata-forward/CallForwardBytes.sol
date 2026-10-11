// Upstream Solidity fixture (test/libsolidity/semanticTests/fallback/call_forward_bytes.sol), source verbatim.
// A `fallback` stores `msg.data` into a state `bytes` and a public function forwards it through a low-level
// `address(...).call(...)`. The atomic route therefore decodes a stored calldata blob for a returning handler
// whose effect graph is a runtime emission handler: the handler returns its exhausted emission cursor above the
// scalar-journal context, and the route's generated `__message_bus_value_*` declaration follows that call.
// Regression guard for the returned-cursor stack model in `visitUserFunctionCall`.
contract receiver {
    uint256 public received;
    function recv(uint256 x) public { received += x + 1; }
    fallback() external { received = 0x80; }
}
contract sender {
    constructor() { rec = new receiver();}
    fallback() external { savedData = msg.data; }
    function forward() public returns (bool) { address(rec).call(savedData); return true; }
    function clear() public returns (bool) { delete savedData; return true; }
    function val() public returns (uint) { return rec.received(); }
    receiver rec;
    bytes savedData;
}
