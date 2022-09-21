import {
  log,
  BigInt,
  Address,
  ethereum,
  BigDecimal,
} from "@graphprotocol/graph-ts";
import {
  Deposit as DepositTransaction,
  LiquidityPool as LiquidityPoolStore,
} from "../../generated/schema";
import {
  getOrCreateToken,
  getOrCreateLiquidityPool,
  getOrCreateDexAmmProtocol,
  getOrCreateUsageMetricsDailySnapshot,
  getOrCreateUsageMetricsHourlySnapshot,
  getOrCreateLiquidityPoolDailySnapshots,
} from "../common/initializers";
import * as utils from "../common/utils";
import * as constants from "../common/constants";
import { getOrCreatePosition, updatePositions } from "./Position";
import { getStat, updateStat } from "./Stat";

export function createDepositTransaction(
  pool: LiquidityPoolStore,
  inputTokenAmounts: BigInt[],
  outputTokenMintedAmount: BigInt,
  amountUSD: BigDecimal,
  provider: Address,
  transaction: ethereum.Transaction,
  block: ethereum.Block
): DepositTransaction {
  let transactionId = "deposit-"
    .concat(transaction.hash.toHexString())
    .concat("-")
    .concat(transaction.index.toString());

  let depositTransaction = DepositTransaction.load(transactionId);

  if (!depositTransaction) {
    depositTransaction = new DepositTransaction(transactionId);

    depositTransaction.pool = pool.id;
    depositTransaction.protocol = getOrCreateDexAmmProtocol().id;

    depositTransaction.account = provider.toHexString();

    depositTransaction.hash = transaction.hash.toHexString();
    depositTransaction.logIndex = transaction.index.toI32();
    depositTransaction.nonce = transaction.nonce;
    depositTransaction.gasLimit = transaction.gasLimit;
    depositTransaction.gasPrice = transaction.gasPrice;

    depositTransaction.inputTokens = pool.inputTokens;
    depositTransaction.inputTokenAmounts = inputTokenAmounts;

    depositTransaction.outputToken = pool.outputToken;
    depositTransaction.outputTokenAmount = outputTokenMintedAmount;

    depositTransaction.amountUSD = amountUSD;

    depositTransaction.timestamp = block.timestamp;
    depositTransaction.blockNumber = block.number;

    depositTransaction.position = getOrCreatePosition(
      pool.id,
      provider.toHexString(),
      transaction,
      block
    ).id;

    depositTransaction.save();
  }

  return depositTransaction;
}

export function UpdateMetricsAfterDeposit(
  block: ethereum.Block,
  amountToken: BigInt,
  amountUSD: BigDecimal
): void {
  const protocol = getOrCreateDexAmmProtocol();

  // Update hourly and daily deposit transaction count
  const metricsDailySnapshot = getOrCreateUsageMetricsDailySnapshot(block);
  const metricsHourlySnapshot = getOrCreateUsageMetricsHourlySnapshot(block);

  metricsHourlySnapshot.hourlyDepositCount += 1;

  metricsDailySnapshot.save();
  metricsHourlySnapshot.save();

  updateStat(
    getStat(metricsDailySnapshot.depositStats),
    amountToken,
    amountUSD
  );

  protocol.save();
}

export function Deposit(
  poolAddress: Address,
  inputTokens: Address[],
  depositedCoinAmounts: BigInt[],
  fees: BigInt[],
  provider: Address,
  transaction: ethereum.Transaction,
  block: ethereum.Block,
  transactionLogIndex: BigInt
): void {
  const pool = getOrCreateLiquidityPool(poolAddress, block);

  let inputTokenAmounts: BigInt[] = [];
  let inputTokenBalances = pool.inputTokenBalances;
  let depositAmountUSD = constants.BIGDECIMAL_ZERO;

  for (let idx = 0; idx < depositedCoinAmounts.length; idx++) {
    if (inputTokens.at(idx).equals(poolAddress)) continue;

    let inputToken = getOrCreateToken(inputTokens.at(idx), block.number);

    let inputTokenIndex = pool.inputTokens.indexOf(inputToken.id);
    inputTokenBalances[inputTokenIndex] = inputTokenBalances[
      inputTokenIndex
    ].plus(depositedCoinAmounts[idx].minus(fees[idx]));

    inputTokenAmounts.push(depositedCoinAmounts[idx]);

    depositAmountUSD = depositAmountUSD.plus(
      depositedCoinAmounts[idx]
        .divDecimal(
          constants.BIGINT_TEN.pow(inputToken.decimals as u8).toBigDecimal()
        )
        .times(inputToken.lastPriceUSD!)
    );
  }

  let totalSupplyAfterDeposit = utils.getOutputTokenSupply(
    poolAddress,
    pool.outputTokenSupply!
  );
  let outputTokenMintedAmount = totalSupplyAfterDeposit.minus(
    pool.outputTokenSupply!
  );

  pool.inputTokenBalances = inputTokenBalances;
  pool.totalValueLockedUSD = utils.getPoolTVL(
    pool.inputTokens,
    pool.inputTokenBalances,
    block
  );
  let inputTokenWeights =
    utils.getPoolTokenWeightsForDynamicWeightPools(poolAddress, pool.inputTokens);

  if (inputTokenWeights.length > 0) {
    pool.inputTokenWeights = inputTokenWeights;
  }
  pool.outputTokenSupply = totalSupplyAfterDeposit;
  pool.outputTokenPriceUSD = utils.getOutputTokenPriceUSD(poolAddress, block);
  pool.save();

  createDepositTransaction(
    pool,
    inputTokenAmounts,
    outputTokenMintedAmount,
    depositAmountUSD,
    provider,
    transaction,
    block
  );

  updatePositions(
    pool,
    constants.UsageType.DEPOSIT,
    provider,
    outputTokenMintedAmount,
    transaction,
    block,
    transactionLogIndex
  );

  utils.updateProtocolTotalValueLockedUSD();
  UpdateMetricsAfterDeposit(block, outputTokenMintedAmount, depositAmountUSD);

  let poolDailySnaphot = getOrCreateLiquidityPoolDailySnapshots(pool.id, block);
  updateStat(
    getStat(poolDailySnaphot.depositStats),
    outputTokenMintedAmount,
    depositAmountUSD
  );

  log.info(
    "[AddLiquidity] LiquidityPool: {}, sharesMinted: {}, depositAmount: [{}], inputTokenBalances: [{}], depositAmountUSD: {}, fees: {}, TxnHash: {}",
    [
      poolAddress.toHexString(),
      outputTokenMintedAmount.toString(),
      depositedCoinAmounts.join(", "),
      inputTokenBalances.join(", "),
      depositAmountUSD.truncate(1).toString(),
      fees.join(", "),
      transaction.hash.toHexString(),
    ]
  );
}
