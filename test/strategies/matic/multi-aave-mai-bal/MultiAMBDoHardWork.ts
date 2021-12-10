import {DoHardWorkLoopBase} from "../../DoHardWorkLoopBase";
import {
  ICamToken,
  IStrategy,
  MaiStablecoinPipe,
  SmartVault,
  StrategyAaveMaiBal
} from "../../../../typechain";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import {MaticAddresses} from "../../../../scripts/addresses/MaticAddresses";
import {TokenUtils} from "../../../TokenUtils";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {BigNumber, utils} from "ethers";
import {CoreContractsWrapper} from "../../../CoreContractsWrapper";
import {ToolsContractsWrapper} from "../../../ToolsContractsWrapper";
import {DeployerUtils} from "../../../../scripts/deploy/DeployerUtils";
import {AMBUtils} from "./AMBUtils";

chai.use(chaiAsPromised);

export class MultiAaveMaiBalTest extends DoHardWorkLoopBase {

  public camToken: string;
  public airDropper: SignerWithAddress;
  public airDropToken: string;
  public airDropAmount: BigNumber;
  public airDropPipeIndex: number;


  constructor(signer: SignerWithAddress, user: SignerWithAddress, core: CoreContractsWrapper, tools: ToolsContractsWrapper, underlying: string, vault: SmartVault, strategy: IStrategy, balanceTolerance: number, finalBalanceTolerance: number, camToken: string, airDropper: SignerWithAddress, airDropToken: string, airDropAmount: BigNumber, airDropPipeIndex: number) {
    super(signer, user, core, tools, underlying, vault, strategy, balanceTolerance, finalBalanceTolerance);
    this.camToken = camToken;
    this.airDropper = airDropper;
    this.airDropToken = airDropToken;
    this.airDropAmount = airDropAmount;
    this.airDropPipeIndex = airDropPipeIndex;
  }

  protected async init() {
    await super.init();
    await AMBUtils.refuelMAI(this.signer, this.strategy.address);
  }

  public async afterBlocAdvance() {
    await super.afterBlocAdvance();

    const strategyAaveMaiBal: StrategyAaveMaiBal = this.strategy as StrategyAaveMaiBal;

    // claim aave rewards on mai
    console.log('claimAaveRewards');
    const cam = await DeployerUtils.connectInterface(this.signer, 'ICamToken', this.camToken) as ICamToken;
    await cam.claimAaveRewards();

    // air drop reward token
    await TokenUtils.getToken(MaticAddresses.WMATIC_TOKEN, this.airDropper.address, this.airDropAmount);
    await TokenUtils.getToken(this.airDropToken, this.airDropper.address, this.airDropAmount);
    const bal = await TokenUtils.balanceOf(this.airDropToken, this.airDropper.address);
    const pipeAddress = await strategyAaveMaiBal.pipes(this.airDropPipeIndex);
    await TokenUtils.transfer(this.airDropToken, this.airDropper, pipeAddress, bal.toString());

  }

}
