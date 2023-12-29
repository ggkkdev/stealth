// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./AStealth.sol";

contract Stealth is AStealth {

    /**
     * @notice Withdraw an ERC20 token payment sent to a stealth address
   * @dev This method must be directly called by the stealth address
   * @param _acceptor Address where withdrawn funds should be sent
   * @param _tokenAddr Address of the ERC20 token being withdrawn
   */
    function withdrawToken(address _acceptor, address _tokenAddr) external {
        _withdrawTokenInternal(msg.sender, _acceptor, _tokenAddr, address(0), 0);
    }

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
        address _stealthAddr,
        address _acceptor,
        address _tokenAddr,
        address _sponsor,
        uint256 _sponsorFee,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external {
        bytes32 _digest = getDigest(_stealthAddr, _acceptor, _tokenAddr, _sponsor, _sponsorFee);
        _validateWithdrawSignature(block.chainid,_stealthAddr, _digest, _v, _r, _s);
        _withdrawTokenInternal(_stealthAddr, _acceptor, _tokenAddr, address(0), 0);
    }



    /*    *//**
 * @notice Internal method which recovers address from signature of the parameters and throws if not _stealthAddr
   * @param _stealthAddr The stealth address whose token balance will be withdrawn
   * @param _acceptor Address where withdrawn funds should be sent
   * @param _tokenAddr Address of the ERC20 token being withdrawn
   * @param _sponsor Address which is compensated for submitting the withdrawal tx
   * @param _sponsorFee Amount of the token to pay to the sponsor
   * @param _data Arbitrary data that will be passed to the post-withdraw hook contract
   * @param _v ECDSA signature component: Parity of the `y` coordinate of point `R`
   * @param _r ECDSA signature component: x-coordinate of `R`
   * @param _s ECDSA signature component: `s` value of the signature
   *//*
    function _validateWithdrawSignature(
        address _stealthAddr,
        address _acceptor,
        address _tokenAddr,
        address _sponsor,
        uint256 _sponsorFee,
        bytes memory _data,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) internal view {
        uint256 _chainId;
        assembly {
            _chainId := chainid()
        }

        bytes32 _digest =
        keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(
                    abi.encode(_chainId, address(this), _acceptor, _tokenAddr, _sponsor, _sponsorFee, _data)
                )
            )
        );

        address _recoveredAddress = ecrecover(_digest, _v, _r, _s);
        require(_recoveredAddress != address(0) && _recoveredAddress == _stealthAddr, "SimpleStealth: Invalid Signature");
    }*/
}
