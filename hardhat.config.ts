import { config as dotEnvConfig } from 'dotenv';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-web3';
import '@nomiclabs/hardhat-solhint';
import '@typechain/hardhat';
import 'hardhat-contract-sizer';
import 'hardhat-gas-reporter';
import 'hardhat-tracer';
import 'solidity-coverage';
import 'hardhat-abi-exporter';
import { task } from 'hardhat/config';
import { deployContract } from './scripts/deploy/DeployContract';
import { EnvSetup } from './scripts/utils/EnvSetup';

task('deploy', 'Deploy contract', async function(args, hre, runSuper) {
  const [signer] = await hre.ethers.getSigners();
  // tslint:disable-next-line:ban-ts-ignore
  // @ts-ignore
  await deployContract(hre, signer, args.name);
}).addPositionalParam('name', 'Name of the smart contract to deploy');

export default {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      chainId: EnvSetup.getEnv().hardhatChainId,
      timeout: 99999999,
      chains: {
        137: {
          hardforkHistory: {
            berlin: 10000000,
            london: 20000000,
          },
        },
      },
      gas: EnvSetup.getEnv().hardhatChainId === 1 ? 19_000_000 :
        EnvSetup.getEnv().hardhatChainId === 137 ? 19_000_000 :
          EnvSetup.getEnv().hardhatChainId === 250 ? 11_000_000 :
            9_000_000,
      forking: EnvSetup.getEnv().hardhatChainId !== 31337 ? {
        url:
          EnvSetup.getEnv().hardhatChainId === 1 ? EnvSetup.getEnv().ethRpcUrl :
            EnvSetup.getEnv().hardhatChainId === 137 ? EnvSetup.getEnv().maticRpcUrl :
              EnvSetup.getEnv().hardhatChainId === 250 ? EnvSetup.getEnv().ftmRpcUrl :
                EnvSetup.getEnv().hardhatChainId === 56 ? EnvSetup.getEnv().bscRpcUrl :
                  EnvSetup.getEnv().hardhatChainId === 8453 ? EnvSetup.getEnv().baseRpcUrl :
                    undefined,
        blockNumber:
          EnvSetup.getEnv().hardhatChainId === 1 ? EnvSetup.getEnv().ethForkBlock !== 0 ? EnvSetup.getEnv().ethForkBlock : undefined :
            EnvSetup.getEnv().hardhatChainId === 137 ? EnvSetup.getEnv().maticForkBlock !== 0 ? EnvSetup.getEnv().maticForkBlock : undefined :
              EnvSetup.getEnv().hardhatChainId === 250 ? EnvSetup.getEnv().ftmForkBlock !== 0 ? EnvSetup.getEnv().ftmForkBlock : undefined :
                EnvSetup.getEnv().hardhatChainId === 56 ? EnvSetup.getEnv().bscForkBlock !== 0 ? EnvSetup.getEnv().bscForkBlock : undefined :
                  EnvSetup.getEnv().hardhatChainId === 8453 ? EnvSetup.getEnv().baseForkBlock !== 0 ? EnvSetup.getEnv().baseForkBlock : undefined :
                    undefined,
      } : undefined,
      accounts: {
        mnemonic: 'test test test test test test test test test test test junk',
        path: 'm/44\'/60\'/0\'/0',
        accountsBalance: '100000000000000000000000000000',
      },
      loggingEnabled: EnvSetup.getEnv().loggingEnabled,
    },
    base: {
      url: EnvSetup.getEnv().baseRpcUrl || '',
      chainId: 8453,
      // gas: 50_000_000_000,
      accounts: [EnvSetup.getEnv().privateKey],
    },
    ftm: {
      url: EnvSetup.getEnv().ftmRpcUrl || '',
      timeout: 99999,
      chainId: 250,
      gas: 10_000_000,
      // gasPrice: 100_000_000_000,
      // gasMultiplier: 2,
      accounts: [EnvSetup.getEnv().privateKey],
    },
    matic: {
      url: EnvSetup.getEnv().maticRpcUrl || '',
      timeout: 99999,
      chainId: 137,
      gas: 12_000_000,
      // gasPrice: 50_000_000_000,
      // gasMultiplier: 1.3,
      accounts: [EnvSetup.getEnv().privateKey],
    },
    eth: {
      url: EnvSetup.getEnv().ethRpcUrl || '',
      chainId: 1,
      accounts: [EnvSetup.getEnv().privateKey],
    },
    mumbai: {
      url: 'https://rpc-mumbai.maticvigil.com',
      chainId: 80001,
      accounts: [EnvSetup.getEnv().privateKey],
    },
    ropsten: {
      url: 'https://ropsten.infura.io/v3/' + EnvSetup.getEnv().infuraKey,
      chainId: 3,
      gas: 8_000_000,
      accounts: [EnvSetup.getEnv().privateKey],
    },
    rinkeby: {
      url: 'https://rinkeby.infura.io/v3/' + EnvSetup.getEnv().infuraKey,
      chainId: 4,
      gas: 8_000_000,
      gasPrice: 1_100_000_000,
      accounts: [EnvSetup.getEnv().privateKey],
    },
    bsc: {
      url: EnvSetup.getEnv().bscRpcUrl,
      timeout: 99999,
      chainId: 56,
      // gas: 19_000_000,
      // gasPrice: 100_000_000_000,
      // gasMultiplier: 1.3,
      accounts: [EnvSetup.getEnv().privateKey],
    },
    zktest: {
      url: 'https://public.zkevm-test.net:2083',
      timeout: 99999,
      chainId: 1402,
      // gas: 19_000_000,
      // gasPrice: 100_000_000_000,
      // gasMultiplier: 1.3,
      accounts: [EnvSetup.getEnv().privateKey],
    },
    goerli: {
      url: EnvSetup.getEnv().goerliRpcUrl || '',
      chainId: 5,
      // gasPrice: 5_000_000_000,
      accounts: [EnvSetup.getEnv().privateKey],
    },
    sepolia: {
      url: EnvSetup.getEnv().sepoliaRpcUrl || '',
      chainId: 11155111,
      accounts: [EnvSetup.getEnv().privateKey],
    },
    tetu: {
      url: 'https://tetu-node.io',
      chainId: 778877,
      accounts: [EnvSetup.getEnv().privateKey],
    },
    custom: {
      url: 'http://localhost:8545',
      chainId: 778877,
      accounts: [EnvSetup.getEnv().privateKey],
    },
    baobab: {
      url: 'https://api.baobab.klaytn.net:8651',
      chainId: 1001,
      accounts: [EnvSetup.getEnv().privateKey],
    },
    skale_test: {
      // https://staging-fast-active-bellatrix.explorer.staging-v3.skalenodes.com/
      // https://staging-v3.skalenodes.com/fs/staging-fast-active-bellatrix
      // https://staging-v3.skalenodes.com/#/chains/staging-fast-active-bellatrix
      url: 'https://staging-v3.skalenodes.com/v1/staging-fast-active-bellatrix',
      chainId: 1351057110,
      accounts: [EnvSetup.getEnv().privateKey],
    },
  },
  etherscan: {
    //  https://hardhat.org/plugins/nomiclabs-hardhat-etherscan.html#multiple-api-keys-and-alternative-block-explorers
    apiKey: {
      mainnet: EnvSetup.getEnv().networkScanKey,
      polygon: EnvSetup.getEnv().networkScanKeyMatic || EnvSetup.getEnv().networkScanKey,
      polygonMumbai: EnvSetup.getEnv().networkScanKeyMatic || EnvSetup.getEnv().networkScanKey,
      opera: EnvSetup.getEnv().networkScanKeyFtm || EnvSetup.getEnv().networkScanKey,
      bsc: EnvSetup.getEnv().networkScanKeyBsc || EnvSetup.getEnv().networkScanKey,
      skale_test: 'any',
      base: EnvSetup.getEnv().networkScanKeyBase,
    },
    customChains: [
      {
        network: 'skale_test',
        chainId: 1351057110,
        urls: {
          apiURL: 'https://staging-fast-active-bellatrix.explorer.staging-v3.skalenodes.com/api',
          browserURL: 'https://staging-fast-active-bellatrix.explorer.staging-v3.skalenodes.com',
        },
      },
      {
        network: 'base',
        chainId: 8453,
        urls: {
          apiURL: 'https://api.basescan.org/api',
          browserURL: 'https://basescan.org',
        },
      },
    ],
  },
  solidity: {
    compilers: [
      {
        version: '0.8.19',
        settings: {
          optimizer: {
            enabled: true,
            runs: 150,
          },
        },
      },
    ],
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  mocha: {
    timeout: 9999999999,
  },
  docgen: {
    path: './docs',
    clear: true,
    runOnCompile: false,
    except: ['contracts/third_party', 'contracts/test'],
  },
  contractSizer: {
    alphaSort: false,
    runOnCompile: false,
    disambiguatePaths: false,
  },
  gasReporter: {
    enabled: false,
    currency: 'USD',
    gasPrice: 21,
  },
  typechain: {
    outDir: 'typechain',
  },
  abiExporter: {
    path: './abi',
    runOnCompile: false,
    spacing: 2,
    pretty: false,
    flat: true,
  },
};
