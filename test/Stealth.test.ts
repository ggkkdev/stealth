import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";
import {
  Stealth,
  Stealth__factory,
  StealthKeyRegistry,
  StealthKeyRegistry__factory,
  SimpleToken
} from "../typechain-types";
import { getDigest, signMetaWithdrawal, StealthAddress } from "../stealth/stealth";
import { expect } from "chai";
import { HDNodeWallet, Network, zeroPadValue } from "ethers";
import { StealthWallet } from "../stealth/wallet";

describe("Stealth", () => {
  let stealth: Stealth;
  let keyRegistry: StealthKeyRegistry;
  let stealthContractAddress: string;
  let tokenContract: SimpleToken;
  let owner: HardhatEthersSigner;
  let stealthOwner: any;
  let sender: HardhatEthersSigner;
  let relayer: HardhatEthersSigner;
  let receiver1: HDNodeWallet;
  let receiver2: HDNodeWallet;
  let stealthWalletReceiver1: StealthWallet;
  let network: Network;

  before(async () => {
    [owner, sender, relayer] = await ethers.getSigners();
    network = await ethers.provider.getNetwork();
    receiver1 = HDNodeWallet.createRandom().connect(ethers.provider);
    stealthWalletReceiver1 = await StealthWallet.create(receiver1);
    receiver2 = HDNodeWallet.createRandom().connect(ethers.provider);
    const stealthFactory = (await ethers.getContractFactory("Stealth")) as Stealth__factory;
    const keyRegistryFactory = (await ethers.getContractFactory("StealthKeyRegistry")) as StealthKeyRegistry__factory;
    const tokenFactory = await ethers.getContractFactory("SimpleToken");
    const tx = await owner.sendTransaction({ to: receiver1.address, value: 10n ** 18n });
    await tx.wait();
    const tx2 = await owner.sendTransaction({ to: relayer.address, value: 10n ** 18n });
    await tx2.wait();

    tokenContract = <SimpleToken>await tokenFactory.deploy("simple token", "STN");
    stealth = await stealthFactory.deploy();
    keyRegistry = await keyRegistryFactory.deploy();
    stealthContractAddress = await stealth.getAddress();
    await tokenContract.connect(owner).mint(receiver1.address, 10n ** 2n);
    await tokenContract.connect(owner).mint(receiver2.address, 10n ** 2n);
    await tokenContract.connect(owner).mint(sender.address, 10n ** 2n);
    await tokenContract.connect(owner).approve(stealthContractAddress, ethers.MaxUint256);
    await tokenContract.connect(sender).approve(stealthContractAddress, ethers.MaxUint256);
    await tokenContract.connect(receiver1).transfer(owner.address, 10n ** 1n);

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
    const result = await stealth.connect(sender).sendToken(stealthAddress, tokenAddress, 10n ** 1n, ephemeralpk.toHex());
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
  it("should withdraw on behalf", async () => {
    const relayerTokenFee = 0;
    const tokenAddress = await tokenContract.getAddress();
    const chainId = network.chainId;
    const digest=getDigest(chainId, stealthContractAddress, receiver2.address, tokenAddress, relayer.address, relayerTokenFee)
    const { v, r, s } = await signMetaWithdrawal(stealthOwner, digest);
    const balanceBefore = await tokenContract.balanceOf(receiver2);
    const tx = await stealth.connect(relayer).withdrawTokenOnBehalf(
      stealthOwner.address, receiver2.address, tokenAddress, relayer.address, relayerTokenFee, v, r, s);
    const receipt = await tx.wait();
    console.log(receipt);
    const balance = await tokenContract.balanceOf(receiver2);
    expect(balanceBefore + 10n).to.equal(balance);
  });
});

