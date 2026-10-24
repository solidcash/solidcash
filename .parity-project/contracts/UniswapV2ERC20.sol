// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.24;

import './libraries/SafeMath.sol';

contract UniswapV2ERC20 {
    using SafeMathUniswap for uint;

    string public constant name = 'SushiSwap LP Token';
    string public constant symbol = 'SLP';
    uint8 public constant decimals = 18;
    uint  public totalSupply;
    mapping(address => uint) public balanceOf;
    mapping(address => mapping(address => uint)) public allowance;

    // Parity adapter: the EIP-712 domain is derived on demand. The original constructor folded it into the state
    // at deployment time; `address(this)` is the just-created covenant's own address, which the constructor fold
    // cannot express, so the same value is computed where the child's runtime context is available.
    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),
                keccak256(bytes(name)),
                keccak256(bytes('1')),
                block.chainid,
                address(this)
            )
        );
    }
    // keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 public constant PERMIT_TYPEHASH = 0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;
    mapping(address => uint) public nonces;

    event Approval(address indexed owner, address indexed spender, uint value);
    event Transfer(address indexed from, address indexed to, uint value);

    constructor() {
        // Intentionally empty: pair genesis stays a zero-write transition so the factory can authenticate the
        // child's initial state. `DOMAIN_SEPARATOR()` derives the domain from the runtime context instead.
    }

    function _mint(address to, uint value) internal {
        totalSupply = totalSupply.add(value);
        uint _mintBalance = balanceOf[to];
        balanceOf[to] = _mintBalance.add(value);
        emit Transfer(address(0), to, value);
    }

    /// Mint against a balance the caller read before another arm could write the same entry. The direct vmap
    /// covenant cannot re-read an entry after a branch-arm write, so a site whose preceding call may mint reads
    /// its recipient balance first and hands it here.
    function _mintFromBalance(address to, uint value, uint balance) internal {
        totalSupply = totalSupply.add(value);
        balanceOf[to] = balance.add(value);
        emit Transfer(address(0), to, value);
    }

    function _burn(address from, uint value) internal {
        uint _burnBalance = balanceOf[from];
        balanceOf[from] = _burnBalance.sub(value);
        totalSupply = totalSupply.sub(value);
        emit Transfer(from, address(0), value);
    }

    function _approve(address owner, address spender, uint value) private {
        allowance[owner][spender] = value;
        emit Approval(owner, spender, value);
    }

    function _transfer(address from, address to, uint value) private {
        balanceOf[from] = balanceOf[from].sub(value);
        balanceOf[to] = balanceOf[to].add(value);
        emit Transfer(from, to, value);
    }

    function approve(address spender, uint value) external returns (bool) {
        _approve(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint value) external returns (bool) {
        if (allowance[from][msg.sender] != type(uint256).max) {
            allowance[from][msg.sender] = allowance[from][msg.sender].sub(value);
        }
        _transfer(from, to, value);
        return true;
    }

    function permit(address owner, address spender, uint value, uint deadline, uint8 v, bytes32 r, bytes32 s) external {
        require(deadline >= block.timestamp, 'UniswapV2: EXPIRED');
        bytes32 digest = keccak256(
            abi.encodePacked(
                '\x19\x01',
                DOMAIN_SEPARATOR(),
                keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, nonces[owner]++, deadline))
            )
        );
        // Native projection: a BCH address identity is hash160(pubkey), the same value `owner` decodes to.
        address recoveredAddress = ecrecoverP2pkh(digest, v, r, s);
        require(recoveredAddress != address(0) && recoveredAddress == owner, 'UniswapV2: INVALID_SIGNATURE');
        _approve(owner, spender, value);
    }
}
