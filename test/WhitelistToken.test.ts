import { ethers } from "hardhat";
import { WhitelistToken } from "../typechain-types";
import { expect } from "chai";
import { MerkleTree } from "merkletreejs";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { keccak256 } from "ethers";

interface Signers {
  admin: HardhatEthersSigner;
  user: HardhatEthersSigner;
}

describe("Merkle tree token", function () {
  before(async function () {
    this.signers = {} as Signers;
    const signers: HardhatEthersSigner[] = await ethers.getSigners();
    this.signers.admin = signers[0];
    this.signers.user = signers[1];
    this.signers.all = signers.slice(2);
  });

  beforeEach(async function () {
    const ContractFactory = await ethers.getContractFactory(
      "WhitelistToken"
    );

    this.contract = <WhitelistToken>await ContractFactory.deploy(10n ** 18n);

    //await this.contract.deployed();

    /* Create Merkle tree */
    this.buildMerkleTree = async (addresses: string[]) => {

      let leaves = addresses.map((addr) => keccak256(addr));

      return new MerkleTree(leaves, keccak256, { sortPairs: true });
    };

    this.getProofForAddress = async (
      merkleTree: MerkleTree,
      address: string
    ) => {

      /* Get proof for address */
      let hashedAddress = keccak256(address);
      return merkleTree.getHexProof(hashedAddress);
    };
  });

  it("Should revert INVALID_PROOF", async function () {
    // Create merkle root hash
    const merkleTree = await this.buildMerkleTree([
      this.signers.all[0].address,
      this.signers.all[1].address,
      this.signers.all[2].address,
      this.signers.all[3].address,
    ]);

    await this.contract.setMerkleRoot(merkleTree.getHexRoot());

    const proof = await this.getProofForAddress(
      merkleTree,
      this.signers.all[4].address
    );

    await expect(
      this.contract.connect(this.signers.all[4]).whitelistFunc(proof)
    ).to.be.revertedWith("INVALID_PROOF");
  });

  it("Should revert INVALID_PROOF. Trying to use valid proof for another address", async function () {
    // Create merkle root hash
    const merkleTree = await this.buildMerkleTree([
      this.signers.all[0].address,
      this.signers.all[1].address,
      this.signers.all[2].address,
      this.signers.all[3].address,
    ]);

    await this.contract.setMerkleRoot(merkleTree.getHexRoot());

    const proof = await this.getProofForAddress(
      merkleTree,
      this.signers.all[2].address
    );

    await expect(
      this.contract.connect(this.signers.all[4]).transferVerified(proof, this.signers.all[2].address, 10n ** 10n)
    ).to.be.revertedWith("INVALID_PROOF");
  });

  it("Should transfer with whitelist", async function () {
    // Create merkle root hash
    const merkleTree = await this.buildMerkleTree([
      this.signers.all[0].address,
      this.signers.all[1].address,
      this.signers.all[2].address,
      this.signers.all[3].address,
    ]);

    await this.contract.setMerkleRoot(merkleTree.getHexRoot());

    const proof = await this.getProofForAddress(
      merkleTree,
      this.signers.all[1].address
    );
    await this.contract.connect(this.signers.admin).mint(this.signers.all[1], 10n**12n)


    await expect(
      this.contract.connect(this.signers.all[1]).transferVerified(proof, this.signers.all[2].address, 10n ** 3n)
    ).to.be.not.reverted;

    const balance=await this.contract.connect(this.signers.all[1]).balanceOf(this.signers.all[2].address)
    expect(balance).to.equal(10n ** 3n);
  });


});
