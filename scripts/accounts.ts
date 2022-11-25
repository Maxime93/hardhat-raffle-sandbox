import { ethers, network } from "hardhat";
import "dotenv/config";

const ethGoerliAddr = process.env.ETH_GOERLI_ADDRESS

async function main() {
    // Checking network
    if (network.config.chainId != 31337) {
        // Exit, only want to deploy to local
        throw new Error("Trying to deploy to livenet. This script is only for local dev");
    };
    // ---------------------------------------------

    // Addresses we will be using
    const [hhAddr] = await ethers.getSigners();

    let myAddr = ethers.provider.getSigner(ethGoerliAddr!);
    console.log((await myAddr.getBalance()).toString());

    let myBalance = await ethers.provider.getBalance(ethGoerliAddr!);
    console.log(myBalance.toString());

    let balance = await hhAddr.getBalance();
    console.log(hhAddr.address)
    console.log(balance.toString());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
