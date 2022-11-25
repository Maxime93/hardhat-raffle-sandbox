import { ethers, network } from "hardhat";
import { getSubscriptionInfo } from "../utils/utils"

const BASE_FEE = "250000000000000000" // 0.25 is this the premium in LINK?
const GAS_PRICE_LINK = 1e9 // link per gas, is this the gas lane? // 0.000000001 LINK per gas
const FUND_AMOUNT = "1000000000000000000000" // fund the subscription in VRFCoordinatorV2Mock
const RAFFLE_ENTRANCE_FEE = ethers.utils.parseEther("0.01");

/**
This script is meant to be deployed with `--network hardhat`.
We deploy the VRFMockCoordinatorMock and Raffle contracts.
VRFMockCoordinatorMock contract is supposed to mock what this contract is doing on main/livenets: https://github.com/smartcontractkit/chainlink/blob/e1e78865d4f3e609e7977777d7fb0604913b63ed/contracts/src/v0.8/VRFCoordinatorV2.sol

VRFMockCoordinatorMock contract is implemented by the chainlink team as well: https://github.com/smartcontractkit/chainlink/blob/e1e78865d4f3e609e7977777d7fb0604913b63ed/contracts/src/v0.8/mocks/VRFCoordinatorV2Mock.sol
To help us test our contracts locally.

This script enters 4 players in the raffle and chooses a winner.

You can expect output below:
```
VRFCoordinatorV2Mock with address 0x842c6E4d224Dc325780c2f6fD59b91BAC1810430.
subscription id: 1
Raffle with address 0xE9Ffd8d233057af80cD1F741F79730246725DDbe.
Subscription balance: 1000000000000000000000
Request count: 0
Subscription owner: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Consumers: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266,0xE9Ffd8d233057af80cD1F741F79730246725DDbe
Player1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 ; balance: 9999989788088988294488
Player2: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC ; balance: 9999989865720776169259
Player3: 0x90F79bf6EB2c4f870365E785982E1f101E93b906 ; balance: 9999989885005672282907
Player4: 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 ; balance: 9999989899770670882918
Number of players: 4
RequestId from receipt: 1
WinnerPicked event fired!
Recent winner: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
Player1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 ; balance: 9999989788088988294488
Player2: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC ; balance: 10000029865720776169259
Player3: 0x90F79bf6EB2c4f870365E785982E1f101E93b906 ; balance: 9999989885005672282907
Player4: 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 ; balance: 9999989899770670882918
```
*/

async function main() {
    // Checking network
    if (network.config.chainId != 31337) {
        // Exit, only want to deploy to local
        throw new Error("Trying to deploy to livenet. This script is only for local dev");
    };
    // ---------------------------------------------

    // Addresses we will be using
    const [
        deployer,
        rafflePlayer1,
        rafflePlayer2,
        rafflePlayer3,
        rafflePlayer4,
    ] = await ethers.getSigners();
    // ---------------------------------------------

    // Deploying mock VRFCoordinatorV2Mock
    const VRFCoordinatorV2Mock = await ethers.getContractFactory("VRFCoordinatorV2Mock");
    const vrfcoordv2 = await VRFCoordinatorV2Mock.connect(deployer).deploy(
        BASE_FEE,
        GAS_PRICE_LINK
    );
    await vrfcoordv2.deployed();
    console.log(`VRFCoordinatorV2Mock with address ${vrfcoordv2.address}.`);
    // ---------------------------------------------

    // Creating a Subscription in the VRFCoordinatorV2Mock
    const createSubscriptionTx = await vrfcoordv2.createSubscription();
    const createSubscriptionRt = await createSubscriptionTx.wait();
    await network.provider.request({ method: "evm_increaseTime", params: [60] });
    await network.provider.request({ method: "evm_mine", params: [] });
    // ---------------------------------------------

    // Extract the subscriptionId fromt the event
    let events = createSubscriptionRt.events!;
    if (events.length == 0 || events == undefined) {
        throw new Error("Cound not get subscriptionId from events.");
    };
    let args = events[0].args;
    if (args == undefined) {
        throw new Error("Cound not get subscriptionId from events.");
    };
    let subscriptionId = args.subId;
    if (subscriptionId == undefined) {
        // Exit, only want to deploy to local
        throw new Error("Cound not get subscriptionId from events.");
    };
    console.log(`subscription id: ${subscriptionId}`);
    // ---------------------------------------------

    // Fund the subscription in VRFCoordinatorV2Mock
    const fundSubscriptionTx = await vrfcoordv2.fundSubscription(subscriptionId, FUND_AMOUNT);
    await fundSubscriptionTx.wait();
    await network.provider.request({ method: "evm_increaseTime", params: [60] });
    await network.provider.request({ method: "evm_mine", params: [] });
    // ---------------------------------------------

    // Add a consumer for our subscription in VRFCoordinatorV2Mock
    const addConsumerTx = await vrfcoordv2.addConsumer(subscriptionId, deployer.address);
    await addConsumerTx.wait();
    await network.provider.request({ method: "evm_increaseTime", params: [60] });
    await network.provider.request({ method: "evm_mine", params: [] });
    // ---------------------------------------------

    // Deploying Raffle Contract
    const Raffle = await ethers.getContractFactory("Raffle");
    const raffle = await Raffle.connect(deployer).deploy(
        vrfcoordv2.address,
        RAFFLE_ENTRANCE_FEE,
        "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15", // GasLane: https://docs.chain.link/vrf/v2/subscription/supported-networks
        subscriptionId,
        "500000" // callbackGasLimit: https://docs.chain.link/vrf/v2/subscription/supported-networks
    );
    await raffle.deployed();
    console.log(`Raffle with address ${raffle.address}.`);
    // ---------------------------------------------

    // Add another consumer for our subscription in VRFCoordinatorV2Mock
    const addAnotherConsumerTx = await vrfcoordv2.addConsumer(subscriptionId, raffle.address);
    await addAnotherConsumerTx.wait();
    await network.provider.request({ method: "evm_increaseTime", params: [60] });
    await network.provider.request({ method: "evm_mine", params: [] });
    // ---------------------------------------------

    // Get the subscription in VRFCoordinatorV2Mock - make sure what address and if funded
    getSubscriptionInfo(vrfcoordv2, subscriptionId, deployer)
    // ---------------------------------------------

    // Check the consumer is added
    let consumerIsAdded  = await vrfcoordv2.consumerIsAdded(subscriptionId, deployer.address);
    if (!consumerIsAdded) {
        throw new Error("Consumer not added");
    }
    consumerIsAdded  = await vrfcoordv2.consumerIsAdded(subscriptionId, raffle.address);
    if (!consumerIsAdded) {
        throw new Error("Consumer not added");
    }
    // ---------------------------------------------

    // Enter the Raffle
    let enterRaffleTx = await raffle.connect(rafflePlayer1).enterRaffle(
        { value: RAFFLE_ENTRANCE_FEE }
    );
    let enterRaffleRt = await enterRaffleTx.wait();
    console.log(`Player1: ${rafflePlayer1.address} ; balance: ${await rafflePlayer1.getBalance()}`)
    await network.provider.request({ method: "evm_increaseTime", params: [60] });
    await network.provider.request({ method: "evm_mine", params: [] });

    enterRaffleTx = await raffle.connect(rafflePlayer2).enterRaffle(
        { value: RAFFLE_ENTRANCE_FEE }
    );
    enterRaffleRt = await enterRaffleTx.wait();
    console.log(`Player2: ${rafflePlayer2.address} ; balance: ${await rafflePlayer2.getBalance()}`)
    await network.provider.request({ method: "evm_increaseTime", params: [60] });
    await network.provider.request({ method: "evm_mine", params: [] });

    enterRaffleTx = await raffle.connect(rafflePlayer3).enterRaffle(
        { value: RAFFLE_ENTRANCE_FEE }
    );
    enterRaffleRt = await enterRaffleTx.wait();
    console.log(`Player3: ${rafflePlayer3.address} ; balance: ${await rafflePlayer3.getBalance()}`)
    await network.provider.request({ method: "evm_increaseTime", params: [60] });
    await network.provider.request({ method: "evm_mine", params: [] });

    enterRaffleTx = await raffle.connect(rafflePlayer4).enterRaffle(
        { value: RAFFLE_ENTRANCE_FEE }
    );
    enterRaffleRt = await enterRaffleTx.wait();
    console.log(`Player4: ${rafflePlayer4.address} ; balance: ${await rafflePlayer4.getBalance()}`)
    await network.provider.request({ method: "evm_increaseTime", params: [60] });
    await network.provider.request({ method: "evm_mine", params: [] });
    // ---------------------------------------------

    // Verify number of players
    let numPlayers = await raffle.getNumPlayers();
    console.log(`Number of players: ${numPlayers}`);
    // ---------------------------------------------

    // Request winner!
    const requestRandomWinnerTx = await raffle.connect(deployer).requestRandomWinner();
    const requestRandomWinnerRt = await requestRandomWinnerTx.wait(1);
    await network.provider.request({ method: "evm_increaseTime", params: [60] });
    await network.provider.request({ method: "evm_mine", params: [] });
    // ---------------------------------------------

    // Get the requestID from the RequestedRaffleWinner event.
    console.log(`RequestId from receipt: ${requestRandomWinnerRt.events[1].args.requestId}`);
    // ---------------------------------------------

    // FullfillRandomness
    const fulfillRandomWordsTx = await vrfcoordv2.fulfillRandomWords(
        requestRandomWinnerRt!.events![1].args!.requestId,
        raffle.address
    );
    const fulfillRandomWordsRt = await fulfillRandomWordsTx.wait(1);
    await network.provider.request({ method: "evm_increaseTime", params: [60] });
    await network.provider.request({ method: "evm_mine", params: [] });
    // Can get the WinnerPicked event from fulfillRandomWordsRt
    // ---------------------------------------------


    // Execute the final checks after WinnerPicked event is received
    await new Promise<void>(async (resolve, reject) => {
        raffle.once("WinnerPicked", async () => {
            try {
            } catch(e) {
                reject(e)
            }
            resolve()
        })

        console.log("WinnerPicked event fired!")

        // Verify recent winner
        let recentWinner = await raffle.getRecentWinner();
        console.log(`Recent winner: ${recentWinner}`);
        // ---------------------------------------------

        // Players
        console.log(`Player1: ${rafflePlayer1.address} ; balance: ${await rafflePlayer1.getBalance()}`)
        console.log(`Player2: ${rafflePlayer2.address} ; balance: ${await rafflePlayer2.getBalance()}`)
        console.log(`Player3: ${rafflePlayer3.address} ; balance: ${await rafflePlayer3.getBalance()}`)
        console.log(`Player4: ${rafflePlayer4.address} ; balance: ${await rafflePlayer4.getBalance()}`)
        // ---------------------------------------------
    });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
