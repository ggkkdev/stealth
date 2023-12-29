// @ts-ignore
import {ethers} from "hardhat";
import {IGPK, IGSKi, ISigmas, ISignature, IUserJoinRequest} from "./interfaces";
import { toG1AffineObject, toG2AffineObject } from "./utils";


export class PSHolder {


    static joinRequest(bn128:any, gpk: IGPK): IUserJoinRequest {
        const ski = bn128.Fr.random()
        const tau = bn128.G2.timesFr(bn128.G2.one, ski)
        const tautilde = bn128.G1.timesFr(gpk.gy, ski)
        return {ski, tau, tautilde}
    }
    static sign(bn128:any, sigmas: ISigmas, gpk: IGPK, gski: IGSKi, m: Uint8Array): ISignature {
        // const m = bn128.Fr.random()
        const t = bn128.Fr.random()
        const k = bn128.Fr.random()
        const sigma1random = bn128.G2.timesFr(sigmas.sigma1, t)
        const sigma1randomO = toG2AffineObject(bn128, sigma1random)
        const sigma2random = bn128.G2.timesFr(sigmas.sigma2, t)
        const sigma2randomO = toG2AffineObject(bn128, sigma2random)
        const ymink = bn128.G1.neg(bn128.G1.timesFr(gpk.gy, k))
        const yminkO = toG1AffineObject(bn128, ymink)
        const c = bn128.Fr.fromObject(ethers.solidityPackedKeccak256(["uint", "uint", "uint", "uint", "uint", "uint", "uint", "uint", "uint", "uint", "bytes32"], [sigma1randomO[0][1], sigma1randomO[0][0], sigma1randomO[1][1], sigma1randomO[1][0], sigma2randomO[0][1], sigma2randomO[0][0], sigma2randomO[1][1], sigma2randomO[1][0], yminkO[0], yminkO[1], m]))
        const s = bn128.Fr.add(k, bn128.Fr.mul(c, gski.ski))
        return {sigma1random, sigma2random, ymink, c, s}
    }


}
