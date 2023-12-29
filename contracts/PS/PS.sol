// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./BN256G1.sol";
import "./PSLib.sol";

/**
 * @title PS signatures
 * @dev A library for verifying PS signatures.
 */
contract PS {

    event Verification(uint c, uint s, BN256G1.G1Point ymink, BN256G1.G2Point sigma2, BN256G1.G2Point sigma1, bool result);

    BN256G1.G1Point gtildeneg;
    BN256G1.G1Point X;
    BN256G1.G1Point Y;

    constructor(BN256G1.G1Point memory _gtildeneg, BN256G1.G1Point memory _X, BN256G1.G1Point memory _Y) public {
        X = _X;
        Y = _Y;
        gtildeneg = _gtildeneg;
    }

    /// @dev Verify PS group signatures
    function verify(uint c, BN256G1.G1Point calldata ymink, uint s, BN256G1.G2Point calldata sigma1, BN256G1.G2Point calldata sigma2, bytes32 message) public returns (bool){
        (bool result) = PSLib.verify(gtildeneg, X, Y, c, ymink, s, sigma1, sigma2, message);
        emit Verification(c, s, ymink, sigma2, sigma1,result);
        return result;
    }

}
