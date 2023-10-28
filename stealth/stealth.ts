import {
  BigNumberish,
  computeAddress,
  HDNodeWallet, hexlify, isHexString,
  JsonRpcSigner,
  sha256,
  SigningKey, toUtf8Bytes,
  Transaction,
  Wallet
} from "ethers";
import { ERC20, StealthKeyRegistry } from "../typechain-types";
import { ethers } from "hardhat";
import { CURVE, getPublicKey, Point, utils as nobleUtils } from "@noble/secp256k1";


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

interface IKeyPair {
  privateKey: string,
  publicKey: string
}

export class StealthWallet {
  signer: JsonRpcSigner | Wallet | HDNodeWallet; // Public key as hex string with 0x04 prefix
  viewingKeyPair: IKeyPair;
  spendingKeyPair: IKeyPair;

  constructor(signer: JsonRpcSigner | Wallet | HDNodeWallet, spendingKeyPair: IKeyPair, viewingKeyPair: IKeyPair) {
    this.signer = signer;
    this.spendingKeyPair = spendingKeyPair;
    this.viewingKeyPair = viewingKeyPair;
  }

  public static create = async (signer: JsonRpcSigner | Wallet | HDNodeWallet) => {
    const { spendingKeyPair, viewingKeyPair } = await StealthWallet.generatePrivateKeys(signer);
    return new StealthWallet(signer, spendingKeyPair, viewingKeyPair);
  };

  /**
   * copied from Umbra
   * @param signer: original signer
   */
  static async generatePrivateKeys(signer: JsonRpcSigner | Wallet | HDNodeWallet) {
    const baseMessage = "Sign this message to access our stealth app"; // prettier-ignore
    const { chainId } = await ethers.provider.getNetwork();
    const message = `${baseMessage}\n\nChain ID: ${chainId}`;

    // Get 65 byte signature from user using personal_sign
    //const userAddress = await signer.getAddress();
    const formattedMessage = hexlify(toUtf8Bytes(message));
    // const signature = String(await ethers.provider.send("personal_sign", [formattedMessage, userAddress.toLowerCase()]));
    const signature = await signer.signMessage(formattedMessage);

    const isValidSignature = (sig: string) => isHexString(sig) && sig.length === 132;
    if (!isValidSignature(signature)) {
      throw new Error(`Invalid signature: ${signature}`);
    }

    // Split hex string signature into two 32 byte chunks
    const startIndex = 2; // first two characters are 0x, so skip these
    const length = 64; // each 32 byte chunk is in hex, so 64 characters
    const portion1 = signature.slice(startIndex, startIndex + length);
    const portion2 = signature.slice(startIndex + length, startIndex + length + length);
    const lastByte = signature.slice(signature.length - 2);

    if (`0x${portion1}${portion2}${lastByte}` !== signature) {
      throw new Error("Signature incorrectly generated or parsed");
    }
    // Hash the signature pieces to get the two private keys
    const spendingPrivateKey = sha256(`0x${portion1}`);
    const viewingPrivateKey = sha256(`0x${portion2}`);
    const spendingKeyPair: IKeyPair = {
      privateKey: spendingPrivateKey,
      publicKey: "0x"+nobleUtils.bytesToHex(getPublicKey(spendingPrivateKey.slice(2), true))
    };
    const viewingKeyPair: IKeyPair = {
      privateKey: viewingPrivateKey,
      publicKey: "0x"+nobleUtils.bytesToHex(getPublicKey(viewingPrivateKey.slice(2), true))
    };
    return { spendingKeyPair, viewingKeyPair };
  }
}

export class StealthAddress {

  static tryUnlock(address: string, ephemeralpk: string, receiverWallet: StealthWallet) {
    //const viewingPrivateKey = BigInt(_viewingPrivateKey.toString());
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
