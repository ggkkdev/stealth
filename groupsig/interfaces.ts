
/*export interface G1Point{
    x:Uint8Array[32];
    y:Uint8Array;
}
export interface G2Point{
    x:Uint8Array[2];
    y:Uint8Array[2];
}*/
export interface IGSK {
    x: Uint8Array;
    y: Uint8Array;
}

export interface IGPK {
    gtilde: Uint8Array;
    gtildeneg: Uint8Array;
    gx: Uint8Array;
    gy: Uint8Array;
}

export interface ITaus {
    tau: Uint8Array;
    tautilde: Uint8Array;
}

export interface ISigmas {
    sigma1: Uint8Array;
    sigma2: Uint8Array;
}

export interface IUserJoinRequest {
    ski: Uint8Array;
    tau: Uint8Array;
    tautilde: Uint8Array;
}

export interface IGSKi {
    ski: Uint8Array;
}

export interface ISignature {
    sigma1random: Uint8Array;
    sigma2random: Uint8Array;
    ymink: Uint8Array;
    c: Uint8Array;
    s: Uint8Array;
}
