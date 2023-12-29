// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./PS/PS.sol";
import "./AStealth.sol";

contract StealthGroup is AStealth {

    // ======================================= State variables =======================================
    PS ps;

    constructor(address psAddress) {
        ps = PS(psAddress);
    }

    /*    *//**
     * @notice Withdraw an ERC20 token payment sent to a stealth address
   * @dev This method must be directly called by the stealth address
   * @param _acceptor Address where withdrawn funds should be sent
   * @param _tokenAddr Address of the ERC20 token being withdrawn
   *//*
    function withdrawToken(address _acceptor, address _tokenAddr) external {
        _withdrawTokenInternal(msg.sender, _acceptor, _tokenAddr, address(0), 0, "");
    }*/

    /**
 * @notice Withdraw an ERC20 token payment on behalf of a stealth address via signed authorization
   * @param _stealthAddr The stealth address whose token balance will be withdrawn
   * @param _acceptor Address where withdrawn funds should be sent
   * @param _tokenAddr Address of the ERC20 token being withdrawn
   * @param _sponsor Address which is compensated for submitting the withdrawal tx
   * @param _sponsorFee Amount of the token to pay to the sponsor
   * @param _v ECDSA signature component: Parity of the `y` coordinate of point `R`
   * @param _r ECDSA signature component: x-coordinate of `R`
   * @param _s ECDSA signature component: `s` value of the signature
   */
    function withdrawTokenOnBehalf(
        address _stealthAddr, address _acceptor, address _tokenAddr, address _sponsor, uint256 _sponsorFee, uint8 _v, bytes32 _r, bytes32 _s,
        uint c, BN256G1.G1Point calldata ymink, uint s, BN256G1.G2Point calldata sigma1, BN256G1.G2Point calldata sigma2
    ) external {
        bytes32 _digest = getDigest( _stealthAddr, _acceptor, _tokenAddr, _sponsor, _sponsorFee);
        require(ps.verify(c, ymink, s, sigma1, sigma2, _digest), "group signature not correct");
        _validateWithdrawSignature(block.chainid,_stealthAddr, _digest, _v, _r, _s);
        _withdrawTokenInternal(_stealthAddr, _acceptor, _tokenAddr, address(0), 0);
    }

}
