import { config as dotEnvConfig } from 'dotenv';

dotEnvConfig();

export class EnvSetup {

  // tslint:disable-next-line:no-any
  public static getEnv(): any {
    // tslint:disable-next-line:no-var-requires
    return require('yargs/yargs')()
      .env('')
      .options({
        hardhatChainId: {
          type: 'number',
          default: 31337,
        },
        maticRpcUrl: {
          type: 'string',
        },
        ftmRpcUrl: {
          type: 'string',
        },
        ethRpcUrl: {
          type: 'string',
          default: '',
        },
        baseRpcUrl: {
          type: 'string',
          default: '',
        },
        bscRpcUrl: {
          type: 'string',
          default: 'https://bsc-dataseed.binance.org/',
        },
        goerliRpcUrl: {
          type: 'string',
          default: '',
        },
        sepoliaRpcUrl: {
          type: 'string',
          default: '',
        },
        infuraKey: {
          type: 'string',
        },
        networkScanKey: {
          type: 'string',
        },
        networkScanKeyMatic: {
          type: 'string',
        },
        networkScanKeyFtm: {
          type: 'string',
        },
        networkScanKeyBsc: {
          type: 'string',
        },
        networkScanKeyBase: {
          type: 'string',
        },
        privateKey: {
          type: 'string',
          default: '85bb5fa78d5c4ed1fde856e9d0d1fe19973d7a79ce9ed6c0358ee06a4550504e', // random account
        },
        ethForkBlock: {
          type: 'number',
          default: 0,
        },
        maticForkBlock: {
          type: 'number',
          default: 0,
        },
        ftmForkBlock: {
          type: 'number',
          default: 0,
        },
        bscForkBlock: {
          type: 'number',
          default: 0,
        },
        baseForkBlock: {
          type: 'number',
          default: 0,
        },
        loggingEnabled: {
          type: 'boolean',
          default: false,
        },
      }).argv;
  }

}
