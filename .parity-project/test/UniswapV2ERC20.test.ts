import { expect } from "chai";
import {
  MaxUint256,
  addressOf,
  deployToken,
  ethers,
  latestTimestamp,
  signPermit,
  signPermitWithNonce,
  sortTokens,
} from "./helpers.js";

describe("UniswapV2ERC20 (via UniswapV2Pair)", () => {
  let owner: any;
  let spender: any;
  let other: any;
  let token: any;

  beforeEach(async () => {
    [owner, spender, other] = await ethers.getSigners();
    const factory = await ethers.deployContract("UniswapV2Factory", [owner.address]);
    await factory.waitForDeployment();

    const a = await deployToken("Token A", "A", owner);
    const b = await deployToken("Token B", "B", owner);
    await factory.createPair(await a.getAddress(), await b.getAddress());
    const pairAddress = await factory.getPair(await a.getAddress(), await b.getAddress());
    token = await ethers.getContractAt("UniswapV2Pair", pairAddress);

    await a.mint(await token.getAddress(), 10000n);
    await b.mint(await token.getAddress(), 10000n);
    await token.mint(owner.address);
  });

  it("exposes the SushiSwap LP token metadata", async () => {
    expect(await token.name()).to.equal("SushiSwap LP Token");
    expect(await token.symbol()).to.equal("SLP");
    expect(await token.decimals()).to.equal(18n);
    expect(await token.PERMIT_TYPEHASH()).to.equal(
      ethers.keccak256(
        ethers.toUtf8Bytes(
          "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
        )
      )
    );
  });

  it("computes the EIP-712 domain separator", async () => {
    const { chainId } = await ethers.provider.getNetwork();
    const expected = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "bytes32", "bytes32", "uint256", "address"],
        [
          ethers.keccak256(
            ethers.toUtf8Bytes(
              "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
            )
          ),
          ethers.keccak256(ethers.toUtf8Bytes("SushiSwap LP Token")),
          ethers.keccak256(ethers.toUtf8Bytes("1")),
          chainId,
          await token.getAddress(),
        ]
      )
    );
    expect(await token.DOMAIN_SEPARATOR()).to.equal(expected);
  });

  describe("approve", () => {
    it("sets the allowance and emits Approval", async () => {
      await expect(token.connect(owner).approve(spender.address, 100n))
        .to.emit(token, "Approval")
        .withArgs(owner.address, spender.address, 100n);
      expect(await token.allowance(owner.address, spender.address)).to.equal(100n);
    });
  });

  describe("transfer", () => {
    it("moves tokens and emits Transfer", async () => {
      const balance = await token.balanceOf(owner.address);
      expect(balance).to.be.gt(0n);
      await expect(token.connect(owner).transfer(spender.address, 40n))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, spender.address, 40n);
      expect(await token.balanceOf(owner.address)).to.equal(balance - 40n);
      expect(await token.balanceOf(spender.address)).to.equal(40n);
    });

    it("reverts when the balance is insufficient", async () => {
      const balance = await token.balanceOf(owner.address);
      await expect(
        token.connect(owner).transfer(spender.address, balance + 1n)
      ).to.be.revertedWith("ds-math-sub-underflow");
    });
  });

  describe("transferFrom", () => {
    it("decrements a finite allowance and transfers", async () => {
      await token.connect(owner).approve(spender.address, 100n);
      await expect(token.connect(spender).transferFrom(owner.address, other.address, 40n))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, other.address, 40n);
      expect(await token.allowance(owner.address, spender.address)).to.equal(60n);
      expect(await token.balanceOf(other.address)).to.equal(40n);
    });

    it("leaves an unlimited allowance untouched", async () => {
      await token.connect(owner).approve(spender.address, MaxUint256);
      await token.connect(spender).transferFrom(owner.address, other.address, 40n);
      expect(await token.allowance(owner.address, spender.address)).to.equal(MaxUint256);
    });

    it("reverts when the allowance is insufficient", async () => {
      await token.connect(owner).approve(spender.address, 10n);
      await expect(
        token.connect(spender).transferFrom(owner.address, other.address, 40n)
      ).to.be.revertedWith("ds-math-sub-underflow");
    });
  });

  describe("permit", () => {
    it("sets the allowance and increments the nonce", async () => {
      const deadline = BigInt(await latestTimestamp()) + 1000n;
      const value = 123n;
      const { v, r, s } = await signPermit(owner, token, spender.address, value, deadline);
      await expect(token.permit(owner.address, spender.address, value, deadline, v, r, s))
        .to.emit(token, "Approval")
        .withArgs(owner.address, spender.address, value);
      expect(await token.allowance(owner.address, spender.address)).to.equal(value);
      expect(await token.nonces(owner.address)).to.equal(1n);
    });

    it("rejects an expired permit", async () => {
      const deadline = BigInt(await latestTimestamp()) - 1n;
      const { v, r, s } = await signPermit(owner, token, spender.address, 1n, deadline);
      await expect(
        token.permit(owner.address, spender.address, 1n, deadline, v, r, s)
      ).to.be.revertedWith("UniswapV2: EXPIRED");
    });

    it("rejects a permit signed by another account", async () => {
      const deadline = BigInt(await latestTimestamp()) + 1000n;
      const { v, r, s } = await signPermit(other, token, spender.address, 1n, deadline);
      await expect(
        token.permit(owner.address, spender.address, 1n, deadline, v, r, s)
      ).to.be.revertedWith("UniswapV2: INVALID_SIGNATURE");
    });

    it("rejects a replayed permit", async () => {
      const deadline = BigInt(await latestTimestamp()) + 1000n;
      const { v, r, s } = await signPermit(owner, token, spender.address, 1n, deadline);
      await token.permit(owner.address, spender.address, 1n, deadline, v, r, s);
      await expect(
        token.permit(owner.address, spender.address, 1n, deadline, v, r, s)
      ).to.be.revertedWith("UniswapV2: INVALID_SIGNATURE");
    });

    it("rejects a signature with a wrong nonce", async () => {
      const deadline = BigInt(await latestTimestamp()) + 1000n;
      const { v, r, s } = await signPermitWithNonce(
        owner,
        token,
        spender.address,
        1n,
        deadline,
        5n
      );
      await expect(
        token.permit(owner.address, spender.address, 1n, deadline, v, r, s)
      ).to.be.revertedWith("UniswapV2: INVALID_SIGNATURE");
    });

    it("rejects an empty signature", async () => {
      const deadline = BigInt(await latestTimestamp()) + 1000n;
      await expect(
        token.permit(
          owner.address,
          spender.address,
          1n,
          deadline,
          0,
          ethers.ZeroHash,
          ethers.ZeroHash
        )
      ).to.be.revertedWith("UniswapV2: INVALID_SIGNATURE");
    });
  });
});
