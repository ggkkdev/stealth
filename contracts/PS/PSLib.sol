// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./BN256G1.sol";

/**
 * @title PS signatures
 * @dev A library for verifying PS signatures.
 */
library PSLib {
    //event Verification(uint c, uint s, BN256G1.G1Point ymink, BN256G1.G2Point sigma2, BN256G1.G2Point sigma1, BN256G1.G1Point gtildeneg, BN256G1.G1Point X, BN256G1.G1Point Y, bool resultPairing, bool resultHash);

    /*    BN256G1.G1Point gtildeneg;
        BN256G1.G1Point X;
        BN256G1.G1Point Y;*/

    /*    constructor(BN256G1.G1Point memory _gtildeneg, BN256G1.G1Point memory _X, BN256G1.G1Point memory _Y) public {
            X = _X;
            Y = _Y;
            gtildeneg = _gtildeneg;
        }*/
    function test() public view returns (uint){
        return 4 + 5;
    }

    /// @dev Verify PS group signatures
    function verify(BN256G1.G1Point storage gtildeneg, BN256G1.G1Point storage X, BN256G1.G1Point storage Y, uint c, BN256G1.G1Point calldata ymink, uint s, BN256G1.G2Point calldata sigma1, BN256G1.G2Point calldata sigma2, bytes32 message) internal returns (bool){
        (bool resultPairing) = checkPairing(c, ymink, s, sigma1, sigma2, gtildeneg, X, Y);
        bool hashCheck = checkHash(c, sigma1, sigma2, ymink, message);
        //emit Verification(c, s, ymink, sigma2, sigma1, gtildeneg, X, Y, resultPairing, hashCheck);
        return (resultPairing && hashCheck);
    }

    function checkPairing(uint c, BN256G1.G1Point calldata ymink, uint s, BN256G1.G2Point calldata sigma1, BN256G1.G2Point calldata sigma2, BN256G1.G1Point storage gtildeneg, BN256G1.G1Point storage X, BN256G1.G1Point storage Y) internal view returns (bool){
        BN256G1.G1Point memory e1a;
        {BN256G1.G1Point memory xc = BN256G1.multiply([X.x, X.y, c]);
            BN256G1.G1Point memory ys = BN256G1.multiply([Y.x, Y.y, s]);
            BN256G1.G1Point memory ysmink = BN256G1.add([ys.x, ys.y, ymink.x, ymink.y]);
            e1a = BN256G1.add([ysmink.x, ysmink.y, xc.x, xc.y]);
        }
        BN256G1.G1Point memory gtildenegc = BN256G1.multiply([gtildeneg.x, gtildeneg.y, c]);
        (bool resultPairing) = BN256G1.bn256CheckPairing([e1a.x, e1a.y, sigma1.x[0], sigma1.x[1], sigma1.y[0], sigma1.y[1], gtildenegc.x, gtildenegc.y, sigma2.x[0], sigma2.x[1], sigma2.y[0], sigma2.y[1]]);
        return (resultPairing);
    }

    function checkHash(uint c, BN256G1.G2Point calldata sigma1, BN256G1.G2Point calldata sigma2, BN256G1.G1Point calldata ymink, bytes32 message) public view returns (bool){
        bytes32 hashed = keccak256(abi.encodePacked(sigma1.x[0], sigma1.x[1], sigma1.y[0], sigma1.y[1], sigma2.x[0], sigma2.x[1], sigma2.y[0], sigma2.y[1], ymink.x, ymink.y, message));
        return (bytes32(c) == (bytes32(uint(hashed) % BN256G1.NN)));
    }

}
