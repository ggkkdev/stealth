import {
  AbiCoder,
  BigNumberish,
  computeAddress,
  keccak256,
  sha256,
  Signer,
  SigningKey,
  Transaction,
  Wallet
} from "ethers";
import { ERC20, StealthKeyRegistry } from "../typechain-types";
import { ethers } from "hardhat";
import { CURVE, Point } from "@noble/secp256k1";
import { StealthWallet } from "./wallet";

/**
 * Sign a transaction for a metawithdrawal
 * @param {object} signer Ethers Wallet or other Signer type
 * @param {number|string} chainId Chain identifier where contract is deployed
 * @param {string} contract StealthApp contract address
 * @param {string} acceptor Withdrawal destination
 * @param {string} token Address of token being withdrawn
 * @param {string} sponsor Address of relayer
 * @param {number|string} fee Amount sent to sponsor
 * @param {string|array} data Call data to be past to post withdraw hook
 */
export const signMetaWithdrawal = async (
  signer:Wallet|Signer,
  chainId:bigint,
  contract:string,
  acceptor:string,
  token:string,
  sponsor:string,
  fee:number,
  data = '0x'
) => {
  const abicoder=AbiCoder.defaultAbiCoder()
  const digest = keccak256(
    abicoder.encode(
      ['uint256', 'address', 'address', 'address', 'address', 'uint256', 'bytes'],
      [chainId, contract, acceptor, token, sponsor, fee, data]
    )
  );

  const rawSig = await signer.signMessage(ethers.getBytes(digest));
  return ethers.Signature.from(rawSig)
};
export const getPubKeyFromAddress = async (keyRegistry: StealthKeyRegistry, tokenContract: ERC20, recipient: string) => {
  const { spendingPubKey, viewingPubKey } = await keyRegistry.stealthKeys(recipient);
  if (spendingPubKey) {
    return { spendingKey: spendingPubKey.toString(), viewingKey: viewingPubKey.toString() };
  } else {
    const _pubKeyRecipient = await getPubKeyFromAddressHistory(tokenContract, recipient);
    return { spendingKey: _pubKeyRecipient.publicKey, viewingKey: _pubKeyRecipient.publicKey };
  }
};

export const getPubKeyFromAddressHistory = async (tokenContract: ERC20, recipient: string) => {
  const filter = tokenContract.filters.Transfer();
  const events = await tokenContract.queryFilter(filter);
  const recipientEvent = events.filter(e => e.args[0] == recipient)[0];
  const tx = await recipientEvent.getTransaction();
  const baseTx = new Transaction();
  baseTx.to = tx.to;
  baseTx.nonce = tx.nonce;
  baseTx.data = tx.data;
  baseTx.value = tx.value;
  baseTx.gasLimit = tx.gasLimit;
  baseTx.gasPrice = tx.gasPrice;
  baseTx.chainId = tx.chainId;
  baseTx.accessList = tx.accessList;
  baseTx.maxPriorityFeePerGas = tx.maxPriorityFeePerGas;
  baseTx.maxFeePerGas = tx.maxFeePerGas;
  const publicKey = SigningKey.recoverPublicKey(baseTx.unsignedHash, tx.signature);
  const computedAddress = computeAddress(publicKey);
  if (computedAddress !== tx.from) {
    throw new Error("Public key not recovered properly");
  }
  return { publicKey };
};

export interface IScanInfo {
  address: string,
  ephemeralpk: string
}

export class StealthAddress {

  static tryUnlock(address: string, ephemeralpk: string, receiverWallet: StealthWallet) {
    const ephemeralpkPoint = Point.fromHex(ephemeralpk);
    const sharedSecret = ephemeralpkPoint.multiply(BigInt(receiverWallet.viewingKeyPair.privateKey));
    const s = sha256("0x" + sharedSecret.toHex());
    const stealthsk = (BigInt(s) + BigInt(receiverWallet.spendingKeyPair.privateKey)) % CURVE.n;
    const stealthPoint = Point.fromPrivateKey(stealthsk);
    const stealthAddress = computeAddress("0x" + stealthPoint.toHex());
    return { match: address == stealthAddress, privateKey: stealthsk };
  }

  static async scan(infos: IScanInfo[], receiverWallet: StealthWallet) {
    const unlocked = infos.map(e => {
      return this.tryUnlock(e.address, e.ephemeralpk, receiverWallet);
    }).filter(e => e.match).map(e => new Wallet("0x" + (BigInt(e.privateKey).toString(16))).connect(ethers.provider));
    console.log(unlocked);
    return unlocked;
  }

  static async generateStealthAddress(
    keyRegistry: StealthKeyRegistry,
    tokenContract: ERC20,
    amount: BigNumberish,
    recipient: string
  ) {
    const keyPair = await getPubKeyFromAddress(keyRegistry, tokenContract, recipient);
    const spendPubKeyRecipient = Point.fromHex(keyPair.spendingKey.slice(2));
    const ephemeralsk = ethers.randomBytes(32);
    const ephemeralpk = Point.fromPrivateKey(ephemeralsk);
    const ephemeralSigner = new SigningKey(ephemeralsk);
    const sharedSecret = ephemeralSigner.computeSharedSecret(keyPair.viewingKey);
    const s = sha256(sharedSecret);
    const stealthPoint = Point.fromPrivateKey(s.slice(2)).add(spendPubKeyRecipient);
    const stealthAddress = computeAddress("0x" + stealthPoint.toHex());
    return { stealthAddress, ephemeralpk };
  }
}
