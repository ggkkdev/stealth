// @ts-ignore
import { ethers } from "hardhat";
import { IGPK, ISignature } from "./interfaces";
import { BN256G1, PS } from "../typechain-types";
import { G1ToAffineStruct, G2ToAffineStruct, toG1AffineObject, toG2AffineObject } from "./utils";
import { expect } from "chai";


export class PSVerifier {

  static verifyPairing(bn128: any, gpk: IGPK, signature: ISignature) {
    const ltmp = bn128.G1.add(bn128.G1.add(bn128.G1.timesFr(gpk.gx, signature.c), bn128.G1.timesFr(gpk.gy, signature.s)), signature.ymink);
    const lpairing = bn128.pairing(ltmp, signature.sigma1random);
    const rpairing = bn128.pairing(bn128.G1.timesFr(gpk.gtilde, signature.c), signature.sigma2random);
    return bn128.Gt.eq(lpairing, rpairing);
  }

  static verifyHash(bn128: any, signature: ISignature, m: Uint8Array) {
    const yminkO = toG1AffineObject(bn128, signature.ymink);
    const sigma1randomO = toG2AffineObject(bn128, signature.sigma1random);
    const sigma2randomO = toG2AffineObject(bn128, signature.sigma2random);
    const verifc = ethers.solidityPackedKeccak256(["uint", "uint", "uint", "uint", "uint", "uint", "uint", "uint", "uint", "uint", "bytes32"], [sigma1randomO[0][1], sigma1randomO[0][0], sigma1randomO[1][1], sigma1randomO[1][0], sigma2randomO[0][1], sigma2randomO[0][0], sigma2randomO[1][1], sigma2randomO[1][0], yminkO[0], yminkO[1], m]);
    return bn128.Fr.eq(bn128.Fr.fromObject(verifc), signature.c);
  }

  static async verifyPairingSol(bn128: any, lib: BN256G1, gpk: IGPK, signature: ISignature) {
    //verif with solidity pairing
    const ltmp = bn128.G1.add(bn128.G1.add(bn128.G1.timesFr(gpk.gx, bn128.Fr.e(signature.c)), bn128.G1.timesFr(gpk.gy, bn128.Fr.e(signature.s))), signature.ymink);
    //const rpairing = bn128.pairing(bn128.G1.timesFr(gpk.gtilde, bn128.Fr.e(signature.c)), signature.sigma2random)
    const e1a = toG1AffineObject(bn128, ltmp);
    const e1b = toG2AffineObject(bn128, signature.sigma1random);
    const e2a = toG1AffineObject(bn128, bn128.G1.timesFr(gpk.gtildeneg, bn128.Fr.e(signature.c)));
    const e2b = toG2AffineObject(bn128, signature.sigma2random);
    const result = await lib.bn256CustomCheckPairing([e1a[0], e1a[1], e1b[0][1], e1b[0][0], e1b[1][1], e1b[1][0], e2a[0], e2a[1], e2b[0][1], e2b[0][0], e2b[1][1], e2b[1][0]]);
    return result;
  }

  static async verifySol(bn128: any, psContract: PS, gpk: IGPK, signature: ISignature, m: Uint8Array) {
    // @ts-ignore
    const tx = await psContract.verify(bn128.Fr.toObject(signature.c), G1ToAffineStruct(bn128, signature.ymink), bn128.Fr.toObject(signature.s),
      G2ToAffineStruct(bn128, signature.sigma1random), G2ToAffineStruct(bn128, signature.sigma2random), m);
    // @ts-ignore
    const { logs, gasUsed } = await tx.wait();
    console.log(`Gas used for ps verification function ${gasUsed.toString()}`)
    return logs[0].args.result;
  }
}
