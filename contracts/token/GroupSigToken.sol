// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

// TODO: console.log() remove that before deployment
// import "hardhat/console.sol";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../PS/PS.sol";

contract GroupSigToken is ERC20, Ownable {
    PS ps;

    constructor(uint256 initialSupply, address psAddress) ERC20("Group Signature token", "GST") {
        _mint(_msgSender(), initialSupply);
        ps = PS(psAddress);
    }
    /// TODO add Ethereum signed message for security
    function getDigest(address to, uint256 amount) public view returns (bytes32 _digest) {
        _digest = keccak256(abi.encodePacked(block.chainid, address(this), to, amount));
    }

    function transferVerified(PS.PSSignature calldata _pssignature, address to, uint256 amount) public returns (bool) {
        address owner = _msgSender();
        bytes32 _digest =getDigest(to, amount);
        require(ps.verify(_pssignature, _digest), "group signature not correct");
        _transfer(owner, to, amount);
        return true;
    }

    function decimals() public pure override returns (uint8) {
        return 1;
    }

    function mint(address account, uint256 amount) public onlyOwner {
        _mint(account, amount);
    }
}
