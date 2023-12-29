// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/**
 * @title BN256G1 Curve Library
 * @dev Library providing arithmetic operations over G1 in bn256.
 * Provides additional methods like pairing and pairing_batch
 * Heavily influenced by https://github.com/PhilippSchindler/ethdkg
 * Calls to assembly are public and not external because assembly cannot be applied on calldata
 * @author Witnet Foundation
 */

library BN256G1 {

  struct G1Point {
    uint x;
    uint y;
  }

  struct G2Point {
    uint[2] x;
    uint[2] y;
  }

  // Prime number of the curve
  uint256 public constant PP = 0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47;
  // Order of the curve
  uint256 public constant NN = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001;

  /// @dev  computes P + Q
  /// @param input: 4 values of 256 bits each
  ///  *) x-coordinate of point P
  ///  *) y-coordinate of point P
  ///  *) x-coordinate of point Q
  ///  *) y-coordinate of point Q
  /// @return An array with x and y coordinates of P+Q.
  function add(uint256[4] memory input) internal view returns ( G1Point memory) {
    bool success;
    uint256[2] memory result;
    assembly {
      // 0x06     id of the bn256Add precompile
      // 0        number of ether to transfer
      // 128      size of call parameters, i.e. 128 bytes total
      // 64       size of call return value, i.e. 64 bytes / 512 bit for a BN256 curve point
      success := staticcall(not(0), 0x06,input, 128, result, 64)
    }
    require(success, "bn256 addition failed");

    return G1Point({x:result[0], y:result[1]});
  }

  /// @dev  computes P*k.
  /// @param input: 3 values of 256 bits each:
  ///  *) x-coordinate of point P
  ///  *) y-coordinate of point P
  ///  *) scalar k.
  /// @return An array with x and y coordinates of P*k.
  function multiply(uint256[3] memory input) internal view returns (G1Point memory) {
    bool success;
    uint256[2] memory result;
    assembly {
      // 0x07     id of the bn256ScalarMul precompile
      // 0        number of ether to transfer
      // 96       size of call parameters, i.e. 96 bytes total (256 bit for x, 256 bit for y, 256 bit for scalar)
      // 64       size of call return value, i.e. 64 bytes / 512 bit for a BN256 curve point
      success := staticcall(not(0), 0x07, input, 96, result, 64)
    }
    require(success, "elliptic curve multiplication failed");
    return G1Point({x:result[0], y:result[1]});
  }


  /// @dev Checks if e(P, Q) = e (R,S).
  /// @param input: 12 values of 256 bits each:
  ///  *) x-coordinate of point P
  ///  *) y-coordinate of point P
  ///  *) x real coordinate of point Q
  ///  *) x imaginary coordinate of point Q
  ///  *) y real coordinate of point Q
  ///  *) y imaginary coordinate of point Q
  ///  *) x-coordinate of point R
  ///  *) y-coordinate of point R
  ///  *) x real coordinate of point S
  ///  *) x imaginary coordinate of point S
  ///  *) y real coordinate of point S
  ///  *) y imaginary coordinate of point S
  /// @return true if e(P, Q) = e (R,S).
  function bn256CheckPairing(uint256[12] memory input) internal view returns (bool) {
    uint256[1] memory result;
    bool success;
    assembly {
      // 0x08     id of the bn256CheckPairing precompile    (checking the elliptic curve pairings)
      // 0        number of ether to transfer
      // 0        since we have an array of fixed length, our input starts in 0
      // 384      size of call parameters, i.e. 12*256 bits == 384 bytes
      // 32       size of result (one 32 byte boolean!)
      success := staticcall(sub(gas(), 2000), 0x08, input, 384, result, 32)
    }
    require(success, "elliptic curve pairing failed");
    return result[0] == 1;
  }

  /// @dev Checks if e(P, Q) = e (R,S)*e(T,U)...
  /// @param input: A modulo 6 length array of values of 256 bits each:
  ///  *) x-coordinate of point P
  ///  *) y-coordinate of point P
  ///  *) x real coordinate of point Q
  ///  *) x imaginary coordinate of point Q
  ///  *) y real coordinate of point Q
  ///  *) y imaginary coordinate of point Q
  ///  *) x-coordinate of point R
  ///  *) y-coordinate of point R
  ///  *) x real coordinate of point S
  ///  *) x imaginary coordinate of point S
  ///  *) y real coordinate of point S
  ///  *) y imaginary coordinate of point S
  ///  *) and so forth with additional pairing checks
  /// @return true if e(input[0,1], input[2,3,4,5]) = e(input[6,7], input[8,9,10,11])*e(input[12,13], input[14,15,16,17])...
  function bn256CheckPairingBatch(uint256[] memory input) internal view returns (bool) {
    uint256[1] memory result;
    bool success;
    require(input.length % 6 == 0, "Incorrect input length");
    uint256 inLen = input.length * 32;
    assembly {
      // 0x08     id of the bn256CheckPairing precompile     (checking the elliptic curve pairings)
      // 0        number of ether to transfer
      // add(input, 0x20) since we have an unbounded array, the first 256 bits refer to its length
      // 384      size of call parameters, i.e. 12*256 bits == 384 bytes
      // 32       size of result (one 32 byte boolean!)
      success := staticcall(sub(gas(), 2000), 0x08, add(input, 0x20), inLen, result, 32)
    }
    require(success, "elliptic curve pairing failed");
    return result[0] == 1;
  }


  /// @dev Custom pairing check function
  /// returns true if == 0,
  /// returns false if != 0,
  /// reverts with "Wrong pairing" if invalid pairing
  function bn256CustomCheckPairing(uint256[12] memory input) public view returns (bool) {
    assembly {
      let success := staticcall(gas(), 0x08, input, 0x0180, input, 0x20)
      if success {
        return (input, 0x20)
      }
    }
    revert("Wrong pairing");
  }

}
