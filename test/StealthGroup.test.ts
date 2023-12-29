import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";
import {
  GroupSigToken,
  GroupSigToken__factory,
  PS,
  StealthGroup,
  StealthGroup__factory,
  StealthKeyRegistry,
  StealthKeyRegistry__factory
} from "../typechain-types";
import { getDigest, getTokenDigest, signMetaWithdrawal, StealthAddress } from "../stealth/stealth";
import { expect } from "chai";
import { HDNodeWallet, Network, zeroPadValue } from "ethers";
import { StealthWallet } from "../stealth/wallet";
import { PSGroupManager } from "../groupsig/gm";
import { IGPK, IGSK, ISigmas, ISignature, ITaus } from "../groupsig/interfaces";
import { G1ToAffineStruct, psSigToStruct } from "../groupsig/utils";
import { PSHolder } from "../groupsig/user";
import { PSVerifier } from "../groupsig/verifier";

const { buildBn128 } = require("ffjavascript");

describe("StealthGroup", () => {
  let stealth: StealthGroup;
  let keyRegistry: StealthKeyRegistry;
  let stealthContractAddress: string;
  let tokenContract: GroupSigToken;
  let owner: HardhatEthersSigner;
  let stealthOwner: any;
  let sender: HardhatEthersSigner;
  let relayer: HardhatEthersSigner;
  let receiver1: HDNodeWallet;
  let receiver2: HDNodeWallet;
  let stealthWalletReceiver1: StealthWallet;
  let network: Network;
  let bn128: any;
  let gsk: IGSK;
  let gpk: IGPK;
  let ski: Uint8Array;
  //let receiverSigningKey: SigningKey;
  let taus: ITaus;
  let signature: ISignature;
  let sigmas: ISigmas;
  let psContract: PS;
  let digest: Uint8Array;
  let tokenDigest: Uint8Array;
  let chainId: bigint;
  let relayerTokenFee: number;
  let tokenAddress: string;
  const amount:bigint=10n

  before(async () => {
    [owner, sender, relayer] = await ethers.getSigners();
    relayerTokenFee = 10;

    bn128 = await buildBn128();
    network = await ethers.provider.getNetwork();
    chainId = network.chainId;
    receiver1 = HDNodeWallet.createRandom().connect(ethers.provider);
    stealthWalletReceiver1 = await StealthWallet.create(receiver1);
    receiver2 = HDNodeWallet.createRandom().connect(ethers.provider);
    const keyRegistryFactory = (await ethers.getContractFactory("StealthKeyRegistry")) as StealthKeyRegistry__factory;
    const tokenFactory:GroupSigToken__factory = await ethers.getContractFactory("GroupSigToken");
    const tx = await owner.sendTransaction({ to: receiver1.address, value: 10n ** 18n });
    await tx.wait();
    const tx2 = await owner.sendTransaction({ to: relayer.address, value: 10n ** 18n });
    await tx2.wait();

    const stealthFactory = (await ethers.getContractFactory("StealthGroup")) as StealthGroup__factory;
    stealth = await stealthFactory.deploy();
    stealthContractAddress = await stealth.getAddress();
    keyRegistry = await keyRegistryFactory.deploy();


    const out = PSGroupManager.setup(bn128);
    gsk = out.gsk;
    gpk = out.gpk;

    const PS = await ethers.getContractFactory("PS");
    psContract = await PS.deploy(G1ToAffineStruct(bn128, gpk.gtildeneg), G1ToAffineStruct(bn128, gpk.gx), G1ToAffineStruct(bn128, gpk.gy));


    tokenContract = <GroupSigToken> await tokenFactory.deploy(10n ** 18n,await psContract.getAddress());
    tokenAddress = await tokenContract.getAddress();

    await tokenContract.connect(owner).approve(stealthContractAddress, ethers.MaxUint256);
    await tokenContract.connect(sender).approve(stealthContractAddress, ethers.MaxUint256);
    await tokenContract.connect(owner).mint(receiver1.address, 10n ** 2n);
    await tokenContract.connect(owner).mint(receiver2.address, 10n ** 2n);
    await tokenContract.connect(owner).mint(sender.address, 10n ** 2n);
    await tokenContract.connect(receiver1).transfer(owner.address, 10n ** 1n);
  });

 /* it("should setup with the gm", async () => {

  });
  it("Deploy contract", async () => {
    //Deploy contract

  });*/
  it("Join request from user", async () => {
    const userRequest = PSHolder.joinRequest(bn128, gpk);
    ski = userRequest.ski;
    //receiverSigningKey = new SigningKey(ski);
    taus = { tau: userRequest.tau, tautilde: userRequest.tautilde };
  });
  it("Accept from GM", async () => {
    sigmas = PSGroupManager.acceptUser(bn128, taus, gsk);
  });
  it("should register receiver in the key registry", async () => {
    await keyRegistry.connect(receiver1).setStealthKeys(stealthWalletReceiver1.spendingKeyPair.publicKey, stealthWalletReceiver1.viewingKeyPair.publicKey);
  });
  it("should send to stealth address", async () => {
    const {
      stealthAddress,
      ephemeralpk
    } = await StealthAddress.generateStealthAddress(keyRegistry, tokenContract, receiver1.address);
    const balance = await tokenContract.balanceOf(stealthContractAddress);
    const tokenAddress = await tokenContract.getAddress();
    const result = await stealth.connect(sender).sendToken(stealthAddress, tokenAddress, amount, ephemeralpk.toHex());
    const receipt = await result.wait();
    const event = receipt?.logs[0];
    const balanceUpdated = await tokenContract.balanceOf(stealthContractAddress);
    expect(balance + 10n).to.equal(balanceUpdated);
    expect(event?.address).to.equal(stealthContractAddress);
    expect(zeroPadValue(stealthAddress, 32)).to.equal(event!.topics[1]);
    expect(event?.address).to.equal(stealthContractAddress);
  });

  it("should scan keys", async () => {
    const wallets = await StealthAddress.scan(stealth, stealthWalletReceiver1);
    stealthOwner = wallets[0];
  });
  it("should hash right for stealth", async () => {
    digest = getDigest(chainId, stealthContractAddress, receiver2.address, tokenAddress, relayer.address, relayerTokenFee);
    const result = await stealth.getDigest(stealthContractAddress, receiver2.address, tokenAddress, relayer.address, relayerTokenFee);
    expect(ethers.hexlify(digest)).to.equal(result);
  });
  it("should hash right for token", async () => {
    tokenDigest = getTokenDigest(chainId, receiver2.address, tokenAddress, amount);
    const result = await tokenContract.getDigest(receiver2.address, amount);
    expect(ethers.hexlify(tokenDigest)).to.equal(result);
  });
  it("should verify group signature", async () => {
    //tokenDigest=getTokenDigest(chainId,  tokenAddress, receiver2.address, amount);
    signature = PSHolder.sign(bn128, sigmas, gpk, { ski: ski }, tokenDigest);
    const result = await PSVerifier.verifySol(bn128, psContract, gpk, signature, tokenDigest);
    expect(result).to.equal(true);
  });

  it("should withdraw on behalf", async () => {
    const { v, r, s } = await signMetaWithdrawal(stealthOwner, digest);
    const balanceBefore = await tokenContract.balanceOf(receiver2);
    const tx = await stealth.connect(relayer).withdrawTokenOnBehalf(
      stealthOwner.address, receiver2.address, tokenAddress, relayer.address, relayerTokenFee, v, r, s, psSigToStruct(bn128,signature)
    );
    const receipt = await tx.wait();
    console.log(receipt);
    const balance = await tokenContract.balanceOf(receiver2);
    expect(balanceBefore + 10n).to.equal(balance);
  });
});

