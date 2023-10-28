import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";
import {
  Stealth,
  Stealth__factory,
  StealthKeyRegistry,
  StealthKeyRegistry__factory,
  WhitelistToken
} from "../typechain-types";
import { StealthAddress } from "../stealth/stealth";
import { expect } from "chai";
import { HDNodeWallet, zeroPadValue } from "ethers";
import { StealthWallet } from "../stealth/wallet";

describe("Stealth", () => {
  let stealth: Stealth;
  let keyRegistry: StealthKeyRegistry;
  let stealthContractAddress: string;
  let tokenContract: WhitelistToken;
  let owner: HardhatEthersSigner;
  let sender: HardhatEthersSigner;
  let receiver1: HDNodeWallet;
  let receiver2: HDNodeWallet;
  let stealthWalletReceiver1:StealthWallet
  //let addresses: HardhatEthersSigner[];

  // hooks
  before(async () => {
    [owner, sender] = await ethers.getSigners();
    receiver1 = HDNodeWallet.createRandom().connect(ethers.provider);
    stealthWalletReceiver1=await StealthWallet.create(receiver1)
    receiver2 = HDNodeWallet.createRandom().connect(ethers.provider);
    const stealthFactory = (await ethers.getContractFactory("Stealth")) as Stealth__factory;
    const keyRegistryFactory = (await ethers.getContractFactory("StealthKeyRegistry")) as StealthKeyRegistry__factory;
    const tokenFactory = await ethers.getContractFactory("WhitelistToken");
    const tx = await owner.sendTransaction({ to: receiver1.address, value: 10n ** 18n });
    await tx.wait();

    tokenContract = <WhitelistToken>await tokenFactory.deploy(10n ** 18n);
    stealth = await stealthFactory.deploy();
    keyRegistry = await keyRegistryFactory.deploy();
    stealthContractAddress = await stealth.getAddress();
    await tokenContract.connect(owner).mint(receiver1.address, 10n ** 2n);
    //const balanceof = await tokenContract.balanceOf(receiver1.address);
    await tokenContract.connect(owner).mint(receiver2.address, 10n ** 2n);
    await tokenContract.connect(owner).mint(sender.address, 10n ** 2n);
    await tokenContract.connect(owner).approve(stealthContractAddress, ethers.MaxUint256);
    await tokenContract.connect(sender).approve(stealthContractAddress, ethers.MaxUint256);
    await tokenContract.connect(receiver1).transfer(owner.address, 10n ** 1n);
  });

  it("should register receiver in the key registry", async () => {
    await keyRegistry.connect(receiver1).setStealthKeys(stealthWalletReceiver1.spendingKeyPair.publicKey, stealthWalletReceiver1.viewingKeyPair.publicKey)
  })

  it("should send to stealth address", async () => {
    const {
      stealthAddress,
      ephemeralpk
    } = await StealthAddress.generateStealthAddress(keyRegistry, tokenContract, 10n * 1n, receiver1.address);
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
    const filter = stealth.filters.Announcement();
    const events = await stealth.queryFilter(filter);
    const infos = events.map(e => {
      return { address: e.args[0], ephemeralpk: e.args[3] };
    });
    const wallets = await StealthAddress.scan(infos,stealthWalletReceiver1);
    const tokenAddress = await tokenContract.getAddress();
    const tx = await owner.sendTransaction({ to: wallets[0].address, value: 10n ** 18n });
    await tx.wait();
    const balanceBefore = await tokenContract.balanceOf(receiver2);
    await stealth.connect(wallets[0]).withdrawToken(receiver2.address, tokenAddress);
    const balance = await tokenContract.balanceOf(receiver2);
    expect(balanceBefore + 10n).to.equal(balance);
  });

});

