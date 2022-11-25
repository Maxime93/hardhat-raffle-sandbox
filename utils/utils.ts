import { ethers, network } from "hardhat";
import { Contract, Wallet, Signer } from "ethers";

const generateRandomNumber = (min: number, max: number) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const waitAndMine = async(): Promise<string> => {
    let t = generateRandomNumber(5,15)
    let m = 0
    while (m < t) {
        await network.provider.request({ method: "evm_increaseTime", params: [60] });
        await network.provider.request({ method: "evm_mine", params: [] });
        m += 1;
    }
    let bn = await ethers.provider.getBlockNumber()
    return bn.toString()
}

export async function getSubscriptionInfo(vrfcoordv2: Contract, subID: number, myAddr: Wallet|Signer): Promise<[string, string, string, string]> {
    let subInfo = await vrfcoordv2.connect(myAddr).getSubscription(subID);
    let subBalance = subInfo[0].toString();
    let reqCount = subInfo[1].toString();
    let owner = subInfo[2];
    let consumers = subInfo[3];
    console.log(`Subscription balance: ${subBalance}`);
    console.log(`Request count: ${reqCount}`);
    console.log(`Subscription owner: ${owner}`);
    console.log(`Consumers: ${consumers}`);
    return [subBalance, reqCount, owner, consumers];
}
