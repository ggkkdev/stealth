import { BigNumberish, computeAddress, HDNodeWallet, sha256, SigningKey, Transaction, Wallet } from "ethers";
import { ERC20 } from "../typechain-types";
import { ethers } from "hardhat";
import { CURVE, Point } from "@noble/secp256k1";


export const getPubKeyFromAddress = async (tokenContract: ERC20, recipient: string) => {
  /*  const logs = await ethers.provider.getLogs({
      fromBlock: 0,
      toBlock: "latest",
      address: await tokenContract.getAddress()
    });*/
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

export interface ScanInfo {
  address: string,
  ephemeralpk: string
}

export class StealthAddress {

  static tryUnlock(address: string, ephemeralpk: string, receiver: HDNodeWallet) {
    const privateKeyReceiver = BigInt(receiver.privateKey as string);
    const ephemeralpkPoint=Point.fromHex(ephemeralpk)
    const sharedSecret = ephemeralpkPoint.multiply(privateKeyReceiver);
    const s=sha256("0x"+sharedSecret.toHex());
    const stealthsk=(BigInt(s) + privateKeyReceiver) % CURVE.n;
    const stealthPoint = Point.fromPrivateKey(stealthsk);
    const stealthAddress = computeAddress("0x" + stealthPoint.toHex());
    return {match:address==stealthAddress, privateKey:stealthsk};
  }

  static async scan(infos: ScanInfo[], receiver: HDNodeWallet) {
    const unlocked = infos.map(e => {
      return this.tryUnlock(e.address, e.ephemeralpk, receiver);
    }).filter(e=>e.match).map(e=>new Wallet( "0x"+(BigInt(e.privateKey).toString(16))).connect(ethers.provider));
    console.log(unlocked);
    return unlocked;
  }

  static async generateStealthAddress(
    tokenContract: ERC20,
    amount: BigNumberish,
    recipient: string
  ) {
    const _pubKeyRecipient = await getPubKeyFromAddress(tokenContract, recipient);
    const pubKeyRecipient = Point.fromHex(_pubKeyRecipient.publicKey.slice(2));
    console.log(pubKeyRecipient);
    const ephemeralsk = ethers.randomBytes(32);
    const ephemeralpk = Point.fromPrivateKey(ephemeralsk);
    const ephemeralSigner = new SigningKey(ephemeralsk);
    const sharedSecret = ephemeralSigner.computeSharedSecret(_pubKeyRecipient.publicKey);
    console.log(sharedSecret);
    const s = sha256(sharedSecret);
    const stealthPoint = Point.fromPrivateKey(s.slice(2)).add(pubKeyRecipient);
    const stealthAddress = computeAddress("0x" + stealthPoint.toHex());

    return { stealthAddress, ephemeralpk };

  }
}
