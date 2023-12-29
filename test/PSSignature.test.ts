import { ethers } from "hardhat";
import { BN256G1, PS } from "../typechain-types";
import { PSGroupManager } from "../groupsig/gm";
import { G1ToAffineStruct } from "../groupsig/utils";
import { IGPK, IGSK, ISigmas, ISignature, ITaus } from "../groupsig/interfaces";
import { PSHolder } from "../groupsig/user";
import { expect } from "chai";
import { PSVerifier } from "../groupsig/verifier";

const { buildBn128 } = require("ffjavascript");

describe("PS signature", () => {
  let lib: BN256G1;
  let psContract: PS;
  let bn128: any;
  let gsk: IGSK;
  let gpk: IGPK;
  let ski: Uint8Array;
  let taus: ITaus;
  let signature: ISignature;
  let sigmas: ISigmas;
  let m: Uint8Array;

  before(async () => {
    const Lib = await ethers.getContractFactory("BN256G1");
    lib = await Lib.deploy();
    bn128 = await buildBn128();
  });

  it("should setup with the gm", async () => {
    const out = PSGroupManager.setup(bn128);
    gsk = out.gsk;
    gpk = out.gpk;
  });

  it("Deploy contract", async () => {
    //Deploy contract
    const PS = await ethers.getContractFactory("PS");
    psContract = await PS.deploy(G1ToAffineStruct(bn128, gpk.gtildeneg), G1ToAffineStruct(bn128, gpk.gx), G1ToAffineStruct(bn128, gpk.gy));
  });
  it("Join request from user", async () => {
    const userRequest = PSHolder.joinRequest(bn128, gpk);
    ski = userRequest.ski;
    taus = { tau: userRequest.tau, tautilde: userRequest.tautilde };
  });
  it("Accept from GM", async () => {
    sigmas = PSGroupManager.acceptUser(bn128, taus, gsk);
  });
  it("Sign from the holder", async () => {
    m = ethers.randomBytes(32);
    signature = PSHolder.sign(bn128, sigmas, gpk, { ski: ski }, m);
  });
  it("Verify pairing from the verifier", async () => {
    const result = PSVerifier.verifyPairing(bn128, gpk, signature);
    expect(result).to.equal(true);
  });
  it("Verify hash from the verifier", async () => {
    const result = PSVerifier.verifyHash(bn128, signature,m);
    expect(result).to.equal(true);
  });
  it("Verify pairing from the verifier solidity", async () => {
    const result = await PSVerifier.verifyPairingSol(bn128, lib,gpk, signature);
    expect(result).to.equal(true);
  });
  it("Verify from the verifier solidity", async () => {
    const result = await PSVerifier.verifySol(bn128, psContract,gpk, signature,m);
    expect(result).to.equal(true);
  });
  it("Open Signature", async () => {
    const result = await PSGroupManager.open(bn128, gpk, signature, taus);
    expect(result).to.equal(true);
  });
});

