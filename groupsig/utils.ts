import { BN256G1, PS } from "../typechain-types/contracts/PS/PS";
import G2PointStruct = BN256G1.G2PointStruct;
import G1PointStruct = BN256G1.G1PointStruct;
import PSSignatureStruct = PS.PSSignatureStruct;
import { ISignature } from "./interfaces";

export const G1ToAffineStruct = (bn128:any,point:Uint8Array):G1PointStruct => {
    const o = toG1AffineObject(bn128,point);
    return {
        x: o[0],
        y: o[1]
    }
}

export const G2ToAffineStruct = (bn128:any,point:Uint8Array):G2PointStruct => {
    const o = toG2AffineObject(bn128,point);
    return {
        x: [o[0][1], o[0][0]],
        y: [o[1][1], o[1][0]]
    }
}

export const toG1AffineObject = (bn128:any,point:Uint8Array) => {
    return bn128.G1.toObject(bn128.G1.toAffine(point));
}

export const toG2AffineObject = (bn128:any,point:Uint8Array) => {
    return bn128.G2.toObject(bn128.G2.toAffine(point));
}

export const psSigToStruct=(bn128:any,signature:ISignature):PSSignatureStruct =>{
    return  {
        c: bn128.Fr.toObject(signature.c),
        ymink: G1ToAffineStruct(bn128, signature.ymink),
        s: bn128.Fr.toObject(signature.s),
        sigma1: G2ToAffineStruct(bn128, signature.sigma1random),
        sigma2: G2ToAffineStruct(bn128, signature.sigma2random)
    };
}

