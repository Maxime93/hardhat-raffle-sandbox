import "dotenv/config";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-ethers"

const ethGoerliURL = process.env.ETH_GOERLI_INFURA_URL
const ethGoerliPK = process.env.ETH_GOERLI_PRIVATE_KEY!

const config: HardhatUserConfig = {
    solidity: "0.8.17",
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            // If you want to do some forking, uncomment this
            forking: {
                url: ethGoerliURL,
                accounts: [ethGoerliPK]
            },
            chainId: 31337,
            allowUnlimitedContractSize: true,
        },
        localhost: {
            chainId: 31337,
        },
        goerli: {
            url: ethGoerliURL,
            accounts: [ethGoerliPK],
            chainId: 5,
        },
        mainnet: {
            url: process.env.ETH_MAINNET_INFURA_URL,
            accounts: [process.env.ETH_MAINNET_PRIVATE_KEY!],
            chainId: 1,
        },
        // polygon: {
        //     url: POLYGON_MAINNET_RPC_URL,
        //     accounts: ,
        //     saveDeployments: true,
        //     chainId: 137,
        // },
    },
};

export default config;
