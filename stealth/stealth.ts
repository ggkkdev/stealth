import { BytesLike, computeAddress, sha256, Signer, SigningKey, Transaction, Wallet } from "ethers";
import { ERC20, Stealth, StealthGroup, StealthKeyRegistry } from "../typechain-types";
import { ethers } from "hardhat";
import { CURVE, Point } from "@noble/secp256k1";
import { StealthWallet } from "./wallet";

/**
 * Sign a transaction for a metawithdrawal
 * @param {object} signer Ethers Wallet or other Signer type
 * @param {BytesLike} digest digest to sign
 */
export const signMetaWithdrawal = async (signer: Wallet | Signer, digest:BytesLike) => {
  // @ts-ignore
  const rawSig = await signer.signingKey.sign(digest);
  return ethers.Signature.from(rawSig);
};

export const getDigest=( chainId: bigint, contract: string, acceptor: string, token: string,
                             sponsor: string, fee: number)=>{
  const digest = ethers.solidityPackedKeccak256(["uint", "address", "address", "address", "address", "uint"], [chainId, contract, acceptor, token, sponsor, fee]);
  return ethers.getBytes(digest);
}
export const getTokenDigest=( chainId: bigint, acceptor: string, token: string, amount:bigint)=>{
  const digest = ethers.solidityPackedKeccak256(["uint", "address", "address", "uint"], [chainId,  token, acceptor, amount]);
  return ethers.getBytes(digest);
}
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

  static async scan(stealth:Stealth|StealthGroup, receiverWallet: StealthWallet) {
    const filter = stealth.filters.Announcement();
    const events = await stealth.queryFilter(filter);
    const infos: IScanInfo[] = events.map(e => {
      return { address: e.args[0], ephemeralpk: e.args[3] };
    });

    const unlocked = infos.map(e => {
      return this.tryUnlock(e.address, e.ephemeralpk, receiverWallet);
    }).filter(e => e.match).map(e => new Wallet("0x" + (BigInt(e.privateKey).toString(16))).connect(ethers.provider));
    console.log(unlocked);
    return unlocked;
  }

  static async generateStealthAddress(
    keyRegistry: StealthKeyRegistry,
    tokenContract: ERC20,
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
