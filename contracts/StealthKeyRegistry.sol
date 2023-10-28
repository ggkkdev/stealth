// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

contract StealthKeyRegistry {
    // =========================================== Events ============================================

    /// @dev Event emitted when a user updates their registered stealth keys
    event StealthKeyChanged(
        address indexed registrant,
        string spendingPubKey,
        string viewingPubKey
    );

    // ======================================= State variables =======================================


    /**
     * @dev Mapping used to store two secp256k1 curve public keys used for
   * receiving stealth payments. The mapping records two keys: a viewing
   * key and a spending key, which can be set and read via the `setStealthKeys`
   * and `stealthKey` methods respectively.
   *
   * The mapping associates the user's address to another mapping, which itself maps
   * the public key prefix to the actual key . This scheme is used to avoid using an
   * extra storage slot for the public key prefix. For a given address, the mapping
   * may contain a spending key at position 0 or 1, and a viewing key at position
   * 2 or 3. See the setter/getter methods for details of how these map to prefixes.
   *
   * For more on secp256k1 public keys and prefixes generally, see:
   * https://github.com/ethereumbook/ethereumbook/blob/develop/04keys-addresses.asciidoc#generating-a-public-key
   */
    mapping(address => mapping(uint256 => string)) keys;


    constructor() {
    }

    // ======================================= Set Keys ===============================================

    /**
     * @notice Sets stealth keys for the caller
   * @param _spendingPubKey The public key for generating a stealth address
   * @param _viewingPubKey The public key to use for encryption
   */
    function setStealthKeys(
        string memory _spendingPubKey,
        string memory _viewingPubKey
    ) external {
        _setStealthKeys(msg.sender, _spendingPubKey, _viewingPubKey);
    }

    /**
     * @dev Internal method for setting stealth key that must be called after safety
   * check on registrant; see calling method for parameter details
   */
    function _setStealthKeys(
        address _registrant,
        string memory _spendingPubKey,
        string memory _viewingPubKey
    ) internal {

        emit StealthKeyChanged(_registrant, _spendingPubKey, _viewingPubKey);
        // Set the appropriate indices to the new key values
        keys[_registrant][1] = _spendingPubKey;
        keys[_registrant][0] = _viewingPubKey;
    }

    // ======================================= Get Keys ===============================================

    /**
     * @notice Returns the stealth key associated with an address.
   * @param _registrant The address whose keys to lookup.
   * @return spendingPubKey The public key for generating a stealth address
   * @return viewingPubKey The public key to use for encryption
   */
    function stealthKeys(address _registrant)
    external
    view
    returns (
        string memory spendingPubKey,
        string memory viewingPubKey
    )
    {
        spendingPubKey = keys[_registrant][1];
        viewingPubKey = keys[_registrant][0];
        return (spendingPubKey, viewingPubKey);
    }
}
