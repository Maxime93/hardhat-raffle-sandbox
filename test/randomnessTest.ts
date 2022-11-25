import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { Contract, BigNumber } from "ethers";
import { waitAndMine } from "../utils/utils"
import { keccak256 } from "ethers/lib/utils";

/**
This test should be run locally `npx hardhat test`.
We deploy the VRFMockCoordinatorMock and Raffle contracts (see scripts/sandbox.ts)

Chainlinks VRFCoordinator is deterministic, meaning if we replay any block in the past that called `getRandomWords`, the same random number should be returned.
But we should not be able to guess a random word that is about to be generated in a new block.

Therefore if we run this test multiple times the same winners should picked.
*/

async function playNRaffles(numRaffles:number , raffle:Contract, vrfcoordv2:Contract, RAFFLE_ENTRANCE_FEE:BigNumber): Promise<Map<string, number>> {
    // Enter the Raffle
    const [mockDeployer,raffleDeployer,p1,p2,p3,p4] = await hre.ethers.getSigners();

    var winners = new Map([
        [ p1.address, 0 ],
        [ p2.address, 0 ],
        [ p3.address, 0 ],
        [ p4.address, 0 ],
    ]);

    var n:number = 0
    while(n < numRaffles) {
        // Enter Raffle P1
        let tx = await raffle.connect(p1).enterRaffle(
            { value: RAFFLE_ENTRANCE_FEE }
        );
        await tx.wait();
        // ---------------------------------------------

        await waitAndMine();

        // Enter Raffle P2
        tx = await raffle.connect(p2).enterRaffle(
            { value: RAFFLE_ENTRANCE_FEE }
        );
        tx.wait();
        // ---------------------------------------------

        await waitAndMine()

        // Enter Raffle P3
        tx = await raffle.connect(p3).enterRaffle(
            { value: RAFFLE_ENTRANCE_FEE }
        );
        await tx.wait();
        // ---------------------------------------------

        await waitAndMine()

        // Enter Raffle P4
        tx = await raffle.connect(p4).enterRaffle(
            { value: RAFFLE_ENTRANCE_FEE }
        );
        tx.wait();
        // ---------------------------------------------

        await waitAndMine()

        // Check number of players
        let numPlayers = await raffle.getNumPlayers();
        expect(numPlayers).to.equal(4);
        // ---------------------------------------------

        // Request winner!
        const requestRandomWinnerTx = await raffle.connect(raffleDeployer).requestRandomWinner();
        const requestRandomWinnerRt = await requestRandomWinnerTx.wait(1);
        // ---------------------------------------------

        await waitAndMine()

        // FullfillRandomness
        const fulfillRandomWordsTx = await vrfcoordv2.fulfillRandomWords(
            requestRandomWinnerRt!.events![1].args!.requestId,
            raffle.address
        );
        await fulfillRandomWordsTx.wait(1);
        // ---------------------------------------------

        await waitAndMine()

        // Get most recent winner
        let recentWinner = await raffle.getRecentWinner();
        let wins = winners.get(recentWinner)
        if (wins != undefined) {
            wins += 1
            winners.set(recentWinner, wins)
        }
        // ---------------------------------------------

        n += 1;
    }
    return winners
}

describe("Raffle", function () {
    let vrfcoordv2: Contract;
    let raffle: Contract;
    let sID: number;
    let winners1: Map<string, number>;
    let winners2: Map<string, number>;
    const RAFFLE_ENTRANCE_FEE = ethers.utils.parseEther("0.01");
    beforeEach(async function () {

        // Addresses we will be using
        const [mockDeployer,raffleDeployer] = await hre.ethers.getSigners();
        // ---------------------------------------------

        // Deploying mock VRFCoordinatorV2Mock
        const BASE_FEE = "250000000000000000" // 0.25 is this the premium in LINK?
        const GAS_PRICE_LINK = 1e9 // link per gas, is this the gas lane? // 0.000000001 LINK per gas
        const VRFCoordinatorV2Mock = await hre.ethers.getContractFactory("VRFCoordinatorV2Mock");
        vrfcoordv2 = await VRFCoordinatorV2Mock.connect(mockDeployer).deploy(
            BASE_FEE,
            GAS_PRICE_LINK
        );
        await vrfcoordv2.deployed();
        // ---------------------------------------------

        // Creating a Subscription in the VRFCoordinatorV2Mock
        const createSubscriptionTx = await vrfcoordv2.createSubscription();
        const createSubscriptionRt = await createSubscriptionTx.wait();
        // ---------------------------------------------

        // Extract the subscriptionId fromt the event
        sID = createSubscriptionRt.events[0].args.subId
        // ---------------------------------------------

        // Fund the subscription in VRFCoordinatorV2Mock
        const FUND_AMOUNT = "1000000000000000000000" // fund the subscription in VRFCoordinatorV2Mock
        const fundSubscriptionTx = await vrfcoordv2.fundSubscription(sID, FUND_AMOUNT);
        await fundSubscriptionTx.wait();
        // ---------------------------------------------

        // Deploying Raffle Contract
        const Raffle = await ethers.getContractFactory("Raffle");
        raffle = await Raffle.connect(raffleDeployer).deploy(
            vrfcoordv2.address,
            RAFFLE_ENTRANCE_FEE,
            "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc",
            sID,
            "500000"
        );
        await raffle.deployed();
        // ---------------------------------------------

        // Add a consumer for our subscription in VRFCoordinatorV2Mock
        const addConsumerTx = await vrfcoordv2.addConsumer(sID, raffle.address);
        await addConsumerTx.wait();
        // ---------------------------------------------

      });
    it("1. Enter 4 players, play 10 raffles", async function () {
        winners1 = await playNRaffles(10, raffle, vrfcoordv2, RAFFLE_ENTRANCE_FEE);
        await waitAndMine();
        await playNRaffles(10, raffle, vrfcoordv2, RAFFLE_ENTRANCE_FEE);
        console.log(await raffle.getRaffleState());

    });
    it("2. Enter 4 players, play 10 raffles", async function () {
        // Since the contracts are redeployed, winners1 and winners2 should have the same results
        winners2 = await playNRaffles(10, raffle, vrfcoordv2, RAFFLE_ENTRANCE_FEE);
        winners1.forEach(function(value,key){
            expect(value).to.equal(winners2.get(key));
        });
    });
});