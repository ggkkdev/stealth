// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

// TODO: console.log() remove that before deployment
// import "hardhat/console.sol";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./MerkleTreeWhitelistContract.sol";

contract WhitelistToken is ERC20, MerkleTreeWhitelistContract {

    constructor(uint256 initialSupply) ERC20("Whitelist Token", "WLT") {
        _mint(_msgSender(), initialSupply);
    }

    function transferVerified(bytes32[] calldata _merkleProof, address to, uint256 amount) public returns (bool) {
        address owner = _msgSender();
        require(super.verifyAddress(_merkleProof), "INVALID_PROOF");
        _transfer(owner, to, amount);
        return true;
    }

    function decimals() public pure override returns (uint8) {
        return 1;
    }

    function mint(address account, uint256 amount) public onlyOwner {
        _mint(account, amount);
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        address owner = _msgSender();
        emit Transfer(owner, to, amount);
        _transfer(owner, to, amount);
        return true;
    }

}
