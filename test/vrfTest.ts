import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { Contract } from "ethers";


/**
This test should be run locally `npx hardhat test`.
Simple test file calling some of VRFCoordinatorV2Mock contract functions.
*/

describe("Raffle", function () {
    let vrfcoordv2: Contract;
    beforeEach(async function () {
        // Addresses we will be using
        const [deployer,
            rafflePlayer1,
            rafflePlayer2,
            rafflePlayer3,
            rafflePlayer4,
        ] = await hre.ethers.getSigners();
        // ---------------------------------------------

        // Deploying mock VRFCoordinatorV2Mock
        const BASE_FEE = "250000000000000000" // 0.25 is this the premium in LINK?
        const GAS_PRICE_LINK = 1e9 // link per gas, is this the gas lane? // 0.000000001 LINK per gas
        const VRFCoordinatorV2Mock = await hre.ethers.getContractFactory("VRFCoordinatorV2Mock");
        vrfcoordv2 = await VRFCoordinatorV2Mock.connect(deployer).deploy(
            BASE_FEE,
            GAS_PRICE_LINK
        );
        await vrfcoordv2.deployed();
        // ---------------------------------------------
      });
    it("Should create a subscription for ", async function () {
        // Creating a Subscription in the VRFCoordinatorV2Mock
        let createSubscriptionTx = await vrfcoordv2.createSubscription();
        let createSubscriptionRt = await createSubscriptionTx.wait();
        let sId = createSubscriptionRt.events[0].args.subId
        expect(sId).to.equal(1);


        // Creating a Subscription in the VRFCoordinatorV2Mock
        createSubscriptionTx = await vrfcoordv2.createSubscription();
        createSubscriptionRt = await createSubscriptionTx.wait();
        sId = createSubscriptionRt.events[0].args.subId
        expect(sId).to.equal(2);
        // ---------------------------------------------
    });
    it("Should fund subscription", async function () {
        // Creating a Subscription in the VRFCoordinatorV2Mock
        let createSubscriptionTx = await vrfcoordv2.createSubscription();
        let createSubscriptionRt = await createSubscriptionTx.wait();
        let sId = createSubscriptionRt.events[0].args.subId

        // Fund the subscription in VRFCoordinatorV2Mock
        const FUND_AMOUNT = "1000000000000000000000";
        const fundSubscriptionTx = await vrfcoordv2.fundSubscription(sId, FUND_AMOUNT);
        await fundSubscriptionTx.wait();

        // Verify fund in fund amount:
        let subInfo = await vrfcoordv2.getSubscription(sId);
        expect(subInfo[0]).to.equal(FUND_AMOUNT);
    });
    it("Should add consumer to subscritptionId", async function () {
        const [_,addr1,addr2] = await hre.ethers.getSigners();

        // Creating a Subscription in the VRFCoordinatorV2Mock
        let createSubscriptionTx = await vrfcoordv2.createSubscription();
        let createSubscriptionRt = await createSubscriptionTx.wait();
        let sId = createSubscriptionRt.events[0].args.subId

        // Fund the subscription in VRFCoordinatorV2Mock
        const FUND_AMOUNT = "1000000000000000000000";
        const fundSubscriptionTx = await vrfcoordv2.fundSubscription(sId, FUND_AMOUNT);
        await fundSubscriptionTx.wait();

        // Add another consumer for our subscription in VRFCoordinatorV2Mock
        const addAnotherConsumerTx = await vrfcoordv2.addConsumer(sId, addr1.address);
        await addAnotherConsumerTx.wait();
        // ---------------------------------------------

        // Verify consumers
        let subInfo = await vrfcoordv2.getSubscription(sId);
        expect(subInfo[3][0]).to.equal(addr1.address);
        // ---------------------------------------------
    });
});