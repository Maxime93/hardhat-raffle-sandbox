import { ethers, network } from "hardhat";
import "dotenv/config";
import VRFCoordinatorV2Abi from "./VrfCoordinatorV2Abi.json"
import { getSubscriptionInfo } from "../utils/utils"


/**

Here the goal is to work with the real VRFV2Coordinator contract: https://github.com/smartcontractkit/chainlink/blob/e1e78865d4f3e609e7977777d7fb0604913b63ed/contracts/src/v0.8/VRFCoordinatorV2.sol
That is deployed here: 0x2Ca8E0C643bDe4C2E08ab1fA0da3401AdAD7734D
On Goerli testnet, in a local hardhat eth-goerli harfork network.

I connected to live Goerli Testnet with my address through Metamask and created a subscription at vrf.chain.link
tx hash: https://goerli.etherscan.io/tx/0x3f521e6dadd20b33418e8e94e4693eb17e4f8d15bce2f75812627ae39caf39ae
The subscription ID: 6806

I then funded that subscription with Link.
tx hash: https://goerli.etherscan.io/tx/0xfea1812877f71b81ec2e71ce94d86e7e48882cf621a0c4a51ae7f37fe8692a39
Which called the `TransferAndCall` method of the link token (link token address: https://goerli.etherscan.io/address/0x326C977E6efc84E512bB9C30f76E30c160eD06FB)

-- --

The script below does the following (deployed with `--network hardhat` Goerli hardfork and therefore has the transactions above):
(1) connects to VRFV2Coordinator contract
(2) creates the raffle contract
(2) checks the subscription
(3) adds a consumer to the subscription (raffle contract address)
(4) adds players to the raffle
(5) calls `requestRandomWinner` on the raffle contract

Step (5) breaks with error:
```
Error: VM Exception while processing transaction: reverted with an unrecognized custom error
      at <UnrecognizedContract>.<unknown> (0x2ca8e0c643bde4c2e08ab1fa0da3401adad7734d)
```

So the vrfcoordv2 contract is able to add a consumer (`await vrfcoordv2.connect(myAddr).addConsumer(subID, raffle.address);`), but when raffle contract calls `requestRandomWords` function we get that error.
Anyone any ideas?

Is it error because the script runs locally and vrfcoordv2.requestRandomWords() needs to be on a live network to generate these random numbers?
Or am I missing something in this script that would fix the error?

Proof that transactions above are in my hardfork.
```sh
# Create subscription
curl --header "Content-Type: application/json" \
--request POST \
--data '{"jsonrpc":"2.0","id":163,"method":"eth_getTransactionByHash","params":["0x3f521e6dadd20b33418e8e94e4693eb17e4f8d15bce2f75812627ae39caf39ae"]}' \
http://localhost:8545
```
=>
```json
{
    "jsonrpc":"2.0",
    "id":163,
    "result":{
        "blockHash":"0xfbc0e845ce6f329ddd6a580fe66959a159a7abd1996abd3e6bf0efaa5b470d73","blockNumber":"0x7a1337",
        "from":"0xe16bd85c59f7a75350350676d798a1c193f9e7f0","gas":"0xeb8b",
        "hash":"0x3f521e6dadd20b33418e8e94e4693eb17e4f8d15bce2f75812627ae39caf39ae","input":"0xa21a23e4","nonce":"0x1",
        "to":"0x2ca8e0c643bde4c2e08ab1fa0da3401adad7734d","transactionIndex":"0x7d","value":"0x0","v":"0x0",
        "r":"0x99e345356d7370fc444b678ed5243811e1e9b876f19541f5dc3dfb8e9bee46d5",
        "s":"0x4a706c5d880522abf18437d06715794e4c4f9e2d2c0146a49153a872c2424885","type":"0x2","accessList":[],
        "chainId":"0x5","gasPrice":"0x55039dc46","maxFeePerGas":"0x7120f9931","maxPriorityFeePerGas":"0x59682f00"
    }
}
```

```sh
# Fund subscription with link
curl --header "Content-Type: application/json" \
--request POST \
--data '{"jsonrpc":"2.0","id":163,"method":"eth_getTransactionByHash","params":["0xfea1812877f71b81ec2e71ce94d86e7e48882cf621a0c4a51ae7f37fe8692a39"]}' \
http://localhost:8545
```
=>
```json
{
    "jsonrpc":"2.0",
    "id":163,
    "result":{
        "blockHash":"0xbbc5eb98214b968e25b1fddd774aa0af4908faafb9e8fb9ff75665f26bf6b2ed",
        "blockNumber":"0x7a133e","from":"0xe16bd85c59f7a75350350676d798a1c193f9e7f0",
        "gas":"0x12bdc","hash":"0xfea1812877f71b81ec2e71ce94d86e7e48882cf621a0c4a51ae7f37fe8692a39",
        "input":"0x4000aea00000000000000000000000002ca8e0c643bde4c2e08ab1fa0da3401adad7734d0000000000000000000000000000000000000000000000004563918244f40000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000001a96",
        "nonce":"0x2","to":"0x326c977e6efc84e512bb9c30f76e30c160ed06fb","transactionIndex":"0x51","value":"0x0",
        "v":"0x1","r":"0xa628bb45dcf0f4eca6b326d099147b33968e17c7f515543a7838e148f9f8917a",
        "s":"0x7a71322a4f38d17c3ac438f3687345a33501034b1f4b40457ca9e3f0a706f18",
        "type":"0x2","accessList":[],"chainId":"0x5","gasPrice":"0x574fb5740","maxFeePerGas":"0x6ee6fa768",
        "maxPriorityFeePerGas":"0x59682f00"
    }
}
```
*/

const ethGoerliPK = process.env.ETH_GOERLI_PRIVATE_KEY

const RAFFLE_ENTRANCE_FEE = ethers.utils.parseEther("0.01");

async function main() {
    // Checking network
    if (network.config.chainId != 31337) {
        // Exit, only want to deploy to local chain!
        throw new Error("Trying to deploy to livenet. This script is only for local dev");
    };
    // ---------------------------------------------

    // Impersonating my own account
    let myAddr = new ethers.Wallet(ethGoerliPK!, ethers.provider);
    let myBalance = (await myAddr.getBalance()).toString();
    console.log(`My wallet balance: ${myBalance}`);

    if (myBalance == "0") {
        // Exit, only want to deploy to local and HARDFORKED to ETH GOERLI!
        throw new Error("I don't have any funds");
    };

    // Addresses we will be using
    const [
        rafflePlayer1,
        rafflePlayer2,
        rafflePlayer3,
        rafflePlayer4,
    ] = await ethers.getSigners();
    // ---------------------------------------------

    // Get VRFCoordinatorV2 is deployed deployed in ETH GOERLI CHAIN
    const VRFCoordinatorV2Address = "0x2Ca8E0C643bDe4C2E08ab1fA0da3401AdAD7734D";
    const vrfcoordv2 = await ethers.getContractAt(VRFCoordinatorV2Abi, VRFCoordinatorV2Address);
    // ---------------------------------------------

    // A Subscription was created and funded (with LINK) with myAddr above.
    // Let's get the subscription info
    const subID = 6806; // Which we get from the chainlink website
    let subInfo = getSubscriptionInfo(vrfcoordv2, subID, myAddr);
    // ---------------------------------------------

    // Deploying Raffle Contract
    const Raffle = await ethers.getContractFactory("Raffle");
    const raffle = await Raffle.connect(myAddr).deploy(
        VRFCoordinatorV2Address,
        RAFFLE_ENTRANCE_FEE,
        "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15", // gaslane
        subID,
        "2500000"
    );
    await raffle.deployed();
    console.log(`Raffle with address ${raffle.address}.`);
    // ---------------------------------------------

    // Add a consumer for our subscription in VRFCoordinatorV2
    // raffle contract will be calling VRFCoordinatorV2, therefore it needs to be a consumer
    const addConsumerTx = await vrfcoordv2.connect(myAddr).addConsumer(subID, raffle.address);
    await addConsumerTx.wait();
    console.log("Added consumer!");
    await network.provider.request({ method: "evm_increaseTime", params: [60] });
    await network.provider.request({ method: "evm_mine", params: [] });
    // ---------------------------------------------

    // Check the consumer is added
    // Let's get the subscription info
    subInfo = getSubscriptionInfo(vrfcoordv2, subID, myAddr);
    // ---------------------------------------------

    // Enter the Raffle
    let enterRaffleTx = await raffle.connect(rafflePlayer1).enterRaffle(
        { value: RAFFLE_ENTRANCE_FEE }
    );
    await enterRaffleTx.wait();
    console.log(`Player1: ${rafflePlayer1.address} ; balance: ${await rafflePlayer1.getBalance()}`);
    await network.provider.request({ method: "evm_increaseTime", params: [60] });
    await network.provider.request({ method: "evm_mine", params: [] });

    enterRaffleTx = await raffle.connect(rafflePlayer2).enterRaffle(
        { value: RAFFLE_ENTRANCE_FEE }
    );
    await enterRaffleTx.wait();
    console.log(`Player2: ${rafflePlayer2.address} ; balance: ${await rafflePlayer2.getBalance()}`);
    await network.provider.request({ method: "evm_increaseTime", params: [60] });
    await network.provider.request({ method: "evm_mine", params: [] });

    enterRaffleTx = await raffle.connect(rafflePlayer3).enterRaffle(
        { value: RAFFLE_ENTRANCE_FEE }
    );
    await enterRaffleTx.wait();
    console.log(`Player3: ${rafflePlayer3.address} ; balance: ${await rafflePlayer3.getBalance()}`);
    await network.provider.request({ method: "evm_increaseTime", params: [60] });
    await network.provider.request({ method: "evm_mine", params: [] });

    enterRaffleTx = await raffle.connect(rafflePlayer4).enterRaffle(
        { value: RAFFLE_ENTRANCE_FEE }
    );
    await enterRaffleTx.wait();
    console.log(`Player4: ${rafflePlayer4.address} ; balance: ${await rafflePlayer4.getBalance()}`);
    await network.provider.request({ method: "evm_increaseTime", params: [60] });
    await network.provider.request({ method: "evm_mine", params: [] });
    // ---------------------------------------------

    // Verify number of players
    let numPlayers = await raffle.getNumPlayers();
    console.log(`Number of players: ${numPlayers}`);
    // ---------------------------------------------

    // Get Raffle info
    console.log(`VRFV2Coordinator address in Raffle: ${await raffle.getVrfCoordinatorV2()}`);
    console.log(`Gaslane in Raffle: ${await raffle.getGasLane()}`);
    console.log(`CallbackGasLimit in Raffle: ${await raffle.getCallbackGasLimit()}`);
    console.log(`SubID in Raffle: ${await raffle.getSubID()}`);
    // ---------------------------------------------

    // Request winner!
    // {gasPrice: ethers.utils.parseUnits('100', 'gwei'), gasLimit: 1000000}
    const requestRandomWinnerTx = await raffle.connect(myAddr).requestRandomWinner({ gasLimit: 1 * 10 ** 6 });
    const requestRandomWinnerRt = await requestRandomWinnerTx.wait();
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
