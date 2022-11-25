// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;
import '@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol';
import '@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol';
import "hardhat/console.sol";

error Raffle__NotEnoughETHEntered();
error Raffle__TransferFailed();
error Raffle__NotOpen();

contract Raffle is VRFConsumerBaseV2 {
    // Types
    enum RaffleState {
        OPEN,
        CALCULATING
    }

    // State variables
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    address private immutable vrfCoordiantorAddress;
    VRFCoordinatorV2Interface private immutable i_vrfCoordiantor;
    bytes32 private immutable i_gaslane;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATION = 1;
    uint32 private constant NUM_WORDS = 1;

    // Raffle variables
    address private s_recentWinner;
    RaffleState private s_raffleState;

    // Events
    event RaffleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    constructor(
            address vrfCoordinatorV2,
            uint256 entranceFee,
            bytes32 gasLane,
            uint64 subscriptionId,
            uint32 callbackGasLimit
        ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
        vrfCoordiantorAddress = vrfCoordinatorV2;
        i_vrfCoordiantor = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gaslane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_raffleState = RaffleState.OPEN;
    }

    function enterRaffle() public payable {
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughETHEntered();
        }
        if (s_raffleState == RaffleState.CALCULATING) {
            revert Raffle__NotOpen();
        }
        s_players.push(payable(msg.sender));
        emit RaffleEnter(msg.sender);
    }

    function requestRandomWinner() external {
        // Request random number / 2 transactions
        s_raffleState = RaffleState.CALCULATING;
        uint256 requestId = i_vrfCoordiantor.requestRandomWords(
            i_gaslane, // gaslane - tells chainlink the maximum gas you are willing to pay in wei
            i_subscriptionId,
            REQUEST_CONFIRMATION,
            i_callbackGasLimit,
            NUM_WORDS
        );
        emit RequestedRaffleWinner(requestId);
    }

    function fulfillRandomWords(
        uint256 /*requestId*/,
        uint256[] memory randomWords
    )
        internal
        override
    {
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_raffleState = RaffleState.OPEN;
        s_players = new address payable[](0);
        (bool success, ) = recentWinner.call{
            value: address(this).balance
        }("");
        if (!success) {
            revert Raffle__TransferFailed();
        }
        emit WinnerPicked(recentWinner);
    }

    function getEntranceFee() public view returns(uint256) {
        return i_entranceFee;
    }

    function getGasLane() public view returns(bytes32) {
        return i_gaslane;
    }

    function getVrfCoordinatorV2() public view returns(address) {
        return vrfCoordiantorAddress;
    }

    function getCallbackGasLimit() public view returns(uint256) {
        return i_callbackGasLimit;
    }

    function getSubID() public view returns(uint256) {
        return i_subscriptionId;
    }

    function getPlayer(uint256 index) public view returns(address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns(address) {
        return s_recentWinner;
    }

    function getRaffleState() public view returns(RaffleState) {
        return s_raffleState;
    }

    function getNumWords() public pure returns(uint256) {
        return NUM_WORDS;
    }

    function getNumPlayers() public view returns(uint256) {
        return s_players.length;
    }
}
