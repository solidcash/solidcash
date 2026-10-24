// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

// Test token with optional transfer fees and failure modes.
contract TestERC20 {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint public totalSupply;
    mapping(address => uint) public balanceOf;
    mapping(address => mapping(address => uint)) public allowance;

    uint public feeBps;
    bool public failTransfers;
    bool public revertTransfers;

    event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint value);

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }

    function mint(address to, uint value) external {
        totalSupply += value;
        balanceOf[to] += value;
        emit Transfer(address(0), to, value);
    }

    function setFeeBps(uint _feeBps) external {
        feeBps = _feeBps;
    }

    function setFailTransfers(bool _fail) external {
        failTransfers = _fail;
    }

    function setRevertTransfers(bool _revert) external {
        revertTransfers = _revert;
    }

    function approve(address spender, uint value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint value) external returns (bool) {
        return _transfer(msg.sender, to, value);
    }

    // BCH parity helpers: one call answers both the transfer and the caller's resulting balance. The read and
    // the write name the same `msg.sender` key, so the covenant keeps one entry slot for the pair.
    function transferAndBalance(address to, uint value) external returns (uint balanceAfter) {
        uint balance = balanceOf[msg.sender];
        require(balance >= value, 'TestERC20: BALANCE');
        uint fee = value * feeBps / 10000;
        if (revertTransfers) revert('TestERC20: TRANSFER_REVERTED');
        if (!failTransfers) {
            balanceOf[msg.sender] = balance - value;
            balanceOf[to] += value - fee;
            totalSupply -= fee;
            emit Transfer(msg.sender, to, value - fee);
            if (fee > 0) emit Transfer(msg.sender, address(0), fee);
            balanceAfter = balance - value;
        } else {
            balanceAfter = type(uint256).max;
        }
    }

    function skimTo(address to, uint floor) external returns (uint excess) {
        uint balance = balanceOf[msg.sender];
        if (balance > floor) {
            excess = balance - floor;
            balanceOf[msg.sender] = balance - excess;
            balanceOf[to] += excess;
            emit Transfer(msg.sender, to, excess);
        }
    }

    function transferFrom(address from, address to, uint value) external returns (bool) {
        if (allowance[from][msg.sender] != type(uint256).max) {
            require(allowance[from][msg.sender] >= value, 'TestERC20: ALLOWANCE');
            allowance[from][msg.sender] -= value;
        }
        return _transfer(from, to, value);
    }

    function _transfer(address from, address to, uint value) internal returns (bool) {
        if (revertTransfers) revert('TestERC20: TRANSFER_REVERTED');
        if (failTransfers) return false;
        require(balanceOf[from] >= value, 'TestERC20: BALANCE');
        uint fee = value * feeBps / 10000;
        balanceOf[from] -= value;
        balanceOf[to] += value - fee;
        totalSupply -= fee;
        emit Transfer(from, to, value - fee);
        if (fee > 0) emit Transfer(from, address(0), fee);
        return true;
    }
}
