// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Stealth is Ownable {
    // =========================================== Events ============================================

    /// @notice Emitted when a payment is sent
    event Announcement(
        address indexed receiver, // stealth address
        uint256 amount, // funds
        address indexed token, // token address or ETH placeholder
        string pkx // ephemeral public key x coordinate
    );

    /// @notice Emitted when a token is withdrawn
    event TokenWithdrawal(
        address indexed receiver, // stealth address
        address indexed acceptor, // destination of funds
        uint256 amount, // funds
        address indexed token // token address
    );

    // ======================================= State variables =======================================

    /// @notice Token payments pending withdrawal; stealth address => token address => amount
    mapping(address => mapping(address => uint256)) public tokenPayments;


    /**
     * @notice Send and announce an ERC20 payment to a stealth address
   * @param _receiver Stealth address receiving the payment
   * @param _tokenAddr Address of the ERC20 token being sent
   * @param _amount Amount of the token to send, in its own base units
   * @param _pkx ephemeral public key used to encrypt the payload
   */
    function sendToken(
        address _receiver,
        address _tokenAddr,
        uint256 _amount,
        string memory _pkx // ephemeral public key x coordinate
    ) external payable {
        require(tokenPayments[_receiver][_tokenAddr] == 0, "Cannot send more tokens to stealth address");

        tokenPayments[_receiver][_tokenAddr] = _amount;
        emit Announcement(_receiver, _amount, _tokenAddr, _pkx);

        IERC20(_tokenAddr).transferFrom(msg.sender, address(this), _amount);
    }

    /**
     * @notice Withdraw an ERC20 token payment sent to a stealth address
   * @dev This method must be directly called by the stealth address
   * @param _acceptor Address where withdrawn funds should be sent
   * @param _tokenAddr Address of the ERC20 token being withdrawn
   */
    function withdrawToken(address _acceptor, address _tokenAddr) external {
        _withdrawTokenInternal(msg.sender, _acceptor, _tokenAddr, address(0), 0, "");
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
        _validateWithdrawSignature(
            _stealthAddr,
            _acceptor,
            _tokenAddr,
            _sponsor,
            _sponsorFee,
            "",
            _v,
            _r,
            _s
        );
        _withdrawTokenInternal(_stealthAddr, _acceptor, _tokenAddr, address(0), 0, "");
    }


    /**
 * @notice Low level withdrawal function that should only be called after safety checks
   * @param _stealthAddr The stealth address whose token balance will be withdrawn
   * @param _acceptor Address where withdrawn funds should be sent
   * @param _tokenAddr Address of the ERC20 token being withdrawn
   * @param _sponsor Address which is compensated for submitting the withdrawal tx
   * @param _sponsorFee Amount of the token to pay to the sponsor
   * @param _data Arbitrary data that will be passed to the post-withdraw hook contract
   */
    function _withdrawTokenInternal(
        address _stealthAddr,
        address _acceptor,
        address _tokenAddr,
        address _sponsor,
        uint256 _sponsorFee,
        bytes memory _data
    ) internal {
        uint256 _amount = tokenPayments[_stealthAddr][_tokenAddr];

        // also protects from underflow
        require(_amount > _sponsorFee, "No balance to withdraw or fee exceeds balance");

        uint256 _withdrawalAmount = _amount - _sponsorFee;
        delete tokenPayments[_stealthAddr][_tokenAddr];
        emit TokenWithdrawal(_stealthAddr, _acceptor, _withdrawalAmount, _tokenAddr);

        IERC20(_tokenAddr).transfer(_acceptor, _withdrawalAmount);

        if (_sponsorFee > 0) {
            IERC20(_tokenAddr).transfer(_sponsor, _sponsorFee);
        }
    }

    /**
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
   */
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
    }
}
