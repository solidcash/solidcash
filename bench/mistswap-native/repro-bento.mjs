// Minimal repro of the MistSwap PairKashi/SushiMakerKashi constructor wall: deploy BentoBoxMock.
// Run: SOLIDCASH_DEPLOY_TRACE=1 node ../../packages/solidhat/dist/cli.js run repro-bento.mjs
const { ethers } = globalThis.hre;

await ethers.getSigners();

const WETH9Mock = await ethers.getContractFactory('WETH9Mock');
const weth = await WETH9Mock.deploy();
console.log('weth deployed at', weth.address);

const BentoBoxMock = await ethers.getContractFactory('BentoBoxMock');
try {
  const bento = await BentoBoxMock.deploy(weth.address);
  console.log('BENTO OK', bento.address);
} catch (e) {
  console.log('BENTO FAILED:', (e?.message ?? String(e)).slice(0, 400));
}
