import {IGPK, IGSK, ISignature, ITaus} from "./interfaces";


export class PSGroupManager {
    public static setup(bn128:any): { gsk: IGSK, gpk: IGPK } {
        //Setup
        const preg = bn128.Fr.random()
        const x = bn128.Fr.random()
        const y = bn128.Fr.random()
        const gtilde = bn128.G1.timesFr(bn128.G1.one, preg)
        const gtildeneg = bn128.G1.neg(gtilde)
        const gx = bn128.G1.timesFr(gtilde, x)
        const gy = bn128.G1.timesFr(gtilde, y)
        const gsk: IGSK = {x, y};
        const gpk: IGPK = {gtilde, gtildeneg, gx, gy}
        return {gsk, gpk}
    }

    static acceptUser(bn128:any, taus: ITaus, gsk: IGSK) {
        const u = bn128.Fr.random()
        const sigma1 = bn128.G2.timesFr(bn128.G2.one, u)
        const sigma2 = bn128.G2.timesFr(bn128.G2.add(bn128.G2.timesFr(bn128.G2.one, gsk.x), bn128.G2.timesFr(taus.tau, gsk.y)), u)
        return {sigma1, sigma2};
    }

    static open(bn128:any, gpk: IGPK, signature: ISignature, taus: ITaus) {
        let lopenpairing = bn128.pairing(gpk.gtilde, signature.sigma2random)
        lopenpairing = bn128.Gt.mul(lopenpairing, bn128.pairing(bn128.G1.neg(gpk.gx), signature.sigma1random))
        let ropenpairing = bn128.pairing(taus.tautilde, signature.sigma1random)
        return bn128.Gt.eq(lopenpairing, ropenpairing)
    }
}
