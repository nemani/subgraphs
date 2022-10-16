import {
  Token,
  Swap as SwapTransaction,
  LiquidityPool as LiquidityPoolStore,
} from "../../generated/schema";
import {
  log,
  BigInt,
  Address,
  ethereum,
  BigDecimal,
} from "@graphprotocol/graph-ts";
import {
  updateProtocolRevenue,
  updateSnapshotsVolume,
  updateTokenVolumeAndBalance,
} from "./Metrics";
import {
  getOrCreateToken,
  getOrCreateLiquidityPool,
  getOrCreateDexAmmProtocol,
  getOrCreateUsageMetricsDailySnapshot,
  getOrCreateUsageMetricsHourlySnapshot,
} from "../common/initializers";
import * as utils from "../common/utils";
import * as constants from "../common/constants";
import { getStat, updateStat } from "./Stat";
import { getOrCreateAccount } from "./Position";

export function createSwapTransaction(
  liquidityPool: LiquidityPoolStore,
  tokenIn: Token,
  amountIn: BigInt,
  amountInUSD: BigDecimal,
  tokenOut: Token,
  amountOut: BigInt,
  amountOutUSD: BigDecimal,
  transaction: ethereum.Transaction,
  block: ethereum.Block
): SwapTransaction {
  const transactionId = "swap-"
    .concat(transaction.hash.toHexString())
    .concat("-")
    .concat(transaction.index.toString());

  let swapTransaction = SwapTransaction.load(transactionId);

  if (!swapTransaction) {
    swapTransaction = new SwapTransaction(transactionId);

    swapTransaction.pool = liquidityPool.id;
    swapTransaction.protocol = getOrCreateDexAmmProtocol().id;

    const account = getOrCreateAccount(transaction.from.toHexString(), true);
    swapTransaction.account = account.id;

    swapTransaction.hash = transaction.hash.toHexString();
    swapTransaction.logIndex = transaction.index.toI32();
    swapTransaction.nonce = transaction.nonce;
    swapTransaction.gasLimit = transaction.gasLimit;
    swapTransaction.gasPrice = transaction.gasPrice;

    swapTransaction.tokenIn = tokenIn.id;
    swapTransaction.amountIn = amountIn;
    swapTransaction.amountInUSD = amountInUSD;

    swapTransaction.tokenOut = tokenOut.id;
    swapTransaction.amountOut = amountOut;
    swapTransaction.amountOutUSD = amountOutUSD;

    swapTransaction.timestamp = block.timestamp;
    swapTransaction.blockNumber = block.number;

    swapTransaction.save();
  }

  return swapTransaction;
}

export function UpdateMetricsAfterSwap(
  block: ethereum.Block,
  amountToken: BigInt,
  amountUSD: BigDecimal
): void {
  const protocol = getOrCreateDexAmmProtocol();

  // Update hourly and daily deposit transaction count
  const metricsDailySnapshot = getOrCreateUsageMetricsDailySnapshot(block);
  const metricsHourlySnapshot = getOrCreateUsageMetricsHourlySnapshot(block);

  metricsHourlySnapshot.hourlySwapCount += 1;

  metricsDailySnapshot.save();
  metricsHourlySnapshot.save();

  updateStat(getStat(metricsDailySnapshot.swapStats), amountToken, amountUSD);

  protocol.save();
}

export function Swap(
  poolAddress: Address,
  tokenIn: Address,
  amountIn: BigInt,
  tokenOut: Address,
  amountOut: BigInt,
  transaction: ethereum.Transaction,
  block: ethereum.Block
): void {
  const pool = getOrCreateLiquidityPool(poolAddress, block);

  const inputTokenBalances: BigInt[] = pool.inputTokenBalances;

  const tokenInStore = getOrCreateToken(tokenIn, block.number);
  const tokenInIndex = pool.inputTokens.indexOf(tokenIn.toHexString());

  let amountInUSD = amountIn
    .divDecimal(
      constants.BIGINT_TEN.pow(tokenInStore.decimals as u8).toBigDecimal()
    )
    .times(tokenInStore.lastPriceUSD!);

  const tokenOutStore = getOrCreateToken(tokenOut, block.number);
  const tokenOutIndex = pool.inputTokens.indexOf(tokenOut.toHexString());

  let amountOutUSD = amountOut
    .divDecimal(
      constants.BIGINT_TEN.pow(tokenOutStore.decimals as u8).toBigDecimal()
    )
    .times(tokenOutStore.lastPriceUSD!);

  if (tokenInIndex != -1) {
    inputTokenBalances[tokenInIndex] =
      inputTokenBalances[tokenInIndex].plus(amountIn);
  } else {
    amountInUSD = constants.BIGDECIMAL_ZERO;
  }

  if (tokenOutIndex != -1) {
    inputTokenBalances[tokenOutIndex] =
      inputTokenBalances[tokenOutIndex].minus(amountOut);
  } else {
    amountOutUSD = constants.BIGDECIMAL_ZERO;
  }

  const volumeUSD = utils.calculateAverage([amountInUSD, amountOutUSD]);
  const volumeToken = utils.calculateAverageBigInt([amountIn, amountOut]);

  pool.inputTokenBalances = inputTokenBalances;
  pool.totalValueLockedUSD = utils.getPoolTVL(
    pool.inputTokens,
    pool.inputTokenBalances,
    block
  );
  pool.inputTokenWeights = utils.getPoolTokenWeights(
    poolAddress,
    pool.inputTokens
  );
  pool.cumulativeVolumeUSD = pool.cumulativeVolumeUSD.plus(volumeUSD);
  pool.save();

  createSwapTransaction(
    pool,
    tokenInStore,
    amountIn,
    amountInUSD,
    tokenOutStore,
    amountOut,
    amountOutUSD,
    transaction,
    block
  );

  updateTokenVolumeAndBalance(
    poolAddress,
    tokenIn.toHexString(),
    amountIn,
    amountInUSD,
    block
  );

  updateTokenVolumeAndBalance(
    poolAddress,
    tokenOut.toHexString(),
    amountOut,
    amountOutUSD,
    block
  );

  updateProtocolRevenue(poolAddress, volumeUSD, block);
  updateSnapshotsVolume(poolAddress, volumeToken, volumeUSD, block);
  UpdateMetricsAfterSwap(block, volumeToken, volumeUSD);

  utils.updateProtocolTotalValueLockedUSD();

  log.info(
    "[Exchange] LiquidityPool: {}, tokenIn: {}, tokenOut: {}, amountInUSD: {}, amountOutUSD: {}, TxnHash: {}",
    [
      poolAddress.toHexString(),
      tokenIn.toHexString(),
      tokenOut.toHexString(),
      amountInUSD.truncate(2).toString(),
      amountOutUSD.truncate(2).toString(),
      transaction.hash.toHexString(),
    ]
  );
}
