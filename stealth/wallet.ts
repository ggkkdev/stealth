import { HDNodeWallet, hexlify, isHexString, JsonRpcSigner, sha256, toUtf8Bytes, Wallet } from "ethers";
// @ts-ignore
import { ethers } from "hardhat";
import { getPublicKey, utils as nobleUtils } from "@noble/secp256k1";


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
