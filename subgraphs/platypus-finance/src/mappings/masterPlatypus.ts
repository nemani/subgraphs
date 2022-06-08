import { Deposit, DepositFor, EmergencyWithdraw, Withdraw } from "../../generated/MasterPlatypus/MasterPlatypus";

import { RewardToken, _Asset } from "../../generated/schema";
import { Address, BigDecimal, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { getOrCreateLiquidityPool, getOrCreateRewardToken, getOrCreateToken } from "../common/getters";
import { MasterPlatypus } from "../../generated/MasterPlatypus/MasterPlatypus";
import { MasterPlatypusOld } from "../../generated/MasterPlatypusOld/MasterPlatypusOld";
import { SimpleRewarder } from "../../generated/MasterPlatypus/SimpleRewarder";

import { BIGINT_ZERO, MasterPlatypusOld_ADDRESS, PTPAddress, ZERO_ADDRESS } from "../common/constants";
import { tokenAmountToUSDAmount } from "../common/utils/numbers";
import { emissionsPerDay } from "../common/rewards";

export function updatePoolRewards(event: ethereum.Event, poolAddress: Address): void {
  log.debug("[UpdateRewards][{}] get pool {}", [event.transaction.hash.toHexString(), poolAddress.toHexString()]);

  let pool = getOrCreateLiquidityPool(poolAddress, event);
  let poolRewardTokens = new Array<string>();
  let poolRewardTokenEmissionsAmount = new Array<BigInt>();
  let poolRewardTokenEmissionsUSD = new Array<BigDecimal>();

  if (!pool._ignore) {
    for (let j = 0; j < pool._assets.length; j++) {
      let _asset = _Asset.load(pool._assets[j])!;
      log.debug("[UpdateRewards][{}] get asset at {} => {}", [
        event.transaction.hash.toHexString(),
        j.toString(),
        _asset.id,
      ]);

      if (_asset.rewardTokens) {
        log.debug("[UpdateRewards][{}] get RTs {} for asset {} amt {}, usd {}, POOOL AMT {} POOL USD {}", [
          event.transaction.hash.toHexString(),
          _asset.rewardTokens!.toString(),
          _asset.id,
          _asset.rewardTokenEmissionsAmount!.toString(),
          _asset.rewardTokenEmissionsUSD!.toString(),
          poolRewardTokenEmissionsAmount.toString(),
          poolRewardTokenEmissionsUSD.toString(),
        ]);

        for (let k = 0; k < _asset.rewardTokens!.length; k++) {
          if (poolRewardTokenEmissionsAmount.length > k) {
            poolRewardTokenEmissionsAmount[k] = poolRewardTokenEmissionsAmount[k].plus(
              _asset.rewardTokenEmissionsAmount![k],
            );
            poolRewardTokenEmissionsUSD[k] = poolRewardTokenEmissionsUSD[k].plus(_asset.rewardTokenEmissionsUSD![k]);
          } else {
            poolRewardTokenEmissionsAmount.push(_asset.rewardTokenEmissionsAmount![k]);
            poolRewardTokenEmissionsUSD.push(_asset.rewardTokenEmissionsUSD![k]);
          }

          log.debug("[UpdateRewards][{}] get RT at {} => {} AMT: {} USD: {}", [
            event.transaction.hash.toHexString(),
            k.toString(),
            _asset.rewardTokens![k].toString(),
            _asset.rewardTokenEmissionsAmount![k].toString(),
            _asset.rewardTokenEmissionsUSD![k].toString(),
          ]);
        }

        poolRewardTokens = _asset.rewardTokens!;
      }
    }
  }

  log.debug("[UpdateRewards][{}] pool {} : final AMT: {} USD: {}", [
    event.transaction.hash.toHexString(),
    pool.id,
    poolRewardTokenEmissionsAmount.toString(),
    poolRewardTokenEmissionsUSD.toString(),
  ]);

  pool.rewardTokens = poolRewardTokens;
  pool.rewardTokenEmissionsAmount = poolRewardTokenEmissionsAmount;
  pool.rewardTokenEmissionsUSD = poolRewardTokenEmissionsUSD;
  pool.save();
}

export function addRewardTokenToAsset(event: ethereum.Event, rtAddress: Address, _asset: _Asset): RewardToken {
  let rt = getOrCreateRewardToken(event, rtAddress);
  let rts = _asset.rewardTokens;

  if (!rts) {
    rts = new Array<string>();
  }
  if (rts.indexOf(rt.id) < 0) {
    rts.push(rt.id);
    log.debug("Added Reward {} Token {} to Asset {}", [
      rt.id.toString(),
      rtAddress.toHexString(),
      _asset.id.toString(),
    ]);
    _asset.rewardTokens = rts;
    _asset.save();
  }
  return rt;
}

export function getAssetForRewardsOld<T>(event: T): _Asset {
  let MP = MasterPlatypusOld.bind(event.address);

  let pid = event.params.pid;
  let poolInfo = MP.try_poolInfo(pid);
  if (poolInfo.reverted) {
    log.error("[HandleRewards][{}]error fetching poolInfo for pid {} from MP {}", [
      event.transaction.hash.toHexString(),
      pid.toString(),
      event.address.toHexString(),
    ]);
  }

  let poolInfoMap = poolInfo.value;

  let _asset = _Asset.load(poolInfoMap.value0.toHexString());

  if (!_asset) {
    log.error("[HandleRewards][{}]Asset not found {}", [
      event.transaction.hash.toHexString(),
      poolInfoMap.value0.toHexString(),
    ]);
  }

  _asset!._index = pid;
  addRewardTokenToAsset(event, Address.fromString(PTPAddress), _asset!);

  let totalAllocPoint_call = MP.try_totalAllocPoint();
  if (totalAllocPoint_call.reverted) {
    log.error("[HandleRewards][{}]error fetching Ptp per second for pid {} old master plat", [
      event.transaction.hash.toHexString(),
      pid.toString(),
    ]);
    return _asset!;
  }

  let totalAllocPoint = totalAllocPoint_call.value;

  let ptpPerSecond_call = MP.try_ptpPerSec();
  if (ptpPerSecond_call.reverted) {
    log.error("[HandleRewards][{}]error fetching Ptp per second for pid {} old master plat", [
      event.transaction.hash.toHexString(),
      pid.toString(),
    ]);
    return _asset!;
  }

  let ptpPerSecond = ptpPerSecond_call.value;

  // // Get info for PTP rewards
  let allocPoint = poolInfoMap.value1;
  // let lastRewardTimestamp = poolInfoMap.value2;
  // let accPtpPerShare = poolInfoMap.value3;
  let rewarder = poolInfoMap.value4;
  // let sumOfFactors = poolInfoMap.value5;
  // let accPtpPerFactorShare = poolInfoMap.value6;

  if (rewarder.notEqual(ZERO_ADDRESS)) {
    let bonusRewards = MP.try_rewarderBonusTokenInfo(pid);
    if (bonusRewards.reverted) {
      log.error("[HandleRewards][{}]error fetching bonusRewards for pid {}", [
        event.transaction.hash.toHexString(),
        pid.toString(),
      ]);
      return _asset!;
    }
    addRewardTokenToAsset(event, bonusRewards.value.value0, _asset!);
  }

  _asset!.save();

  let rewardTokenEmissionsAmount = new Array<BigInt>();
  let rewardTokenEmissionsUSD = new Array<BigDecimal>();

  for (let k = 0; k < _asset!.rewardTokens!.length; k++) {
    let tps: BigInt;
    let rewardToken = RewardToken.load(_asset!.rewardTokens![k])!;
    let token = getOrCreateToken(event, Address.fromString(rewardToken.token));

    if (token.id == PTPAddress) {
      tps = ptpPerSecond.times(allocPoint).div(totalAllocPoint);
      log.debug("PPS*AP/TAP=tps {}*{}/{}={}", [
        ptpPerSecond.toString(),
        allocPoint.toString(),
        totalAllocPoint.toString(),
        tps.toString(),
      ]);
    } else {
      let rewarderContract = SimpleRewarder.bind(rewarder);
      tps = getTPS(rewarderContract);
      log.debug("TPS={}", [tps.toString()]);
    }

    log.debug("rt {} tps {}", [rewardToken.id.toString(), tps.toString()]);
    rewardTokenEmissionsAmount.push(emissionsPerDay(tps));
    rewardTokenEmissionsUSD.push(tokenAmountToUSDAmount(token, emissionsPerDay(tps)));
  }

  _asset!.rewardTokenEmissionsAmount = rewardTokenEmissionsAmount;
  _asset!.rewardTokenEmissionsUSD = rewardTokenEmissionsUSD;
  _asset!.save();
  return _asset!;
}

export function getAssetForRewardsNew<T>(event: T): _Asset {
  let MP = MasterPlatypus.bind(event.address);

  let pid = event.params.pid;
  let poolInfo = MP.try_poolInfo(pid);
  if (poolInfo.reverted) {
    log.error("[HandleRewards][{}]error fetching poolInfo for pid {} from MP {}", [
      event.transaction.hash.toHexString(),
      pid.toString(),
      event.address.toHexString(),
    ]);
  }

  let poolInfoMap = poolInfo.value;

  // Get Relevant Asset
  let _asset = _Asset.load(poolInfoMap.value0.toHexString());

  if (!_asset) {
    log.error("[HandleRewards][{}]Asset not found {}", [
      event.transaction.hash.toHexString(),
      poolInfoMap.value0.toHexString(),
    ]);
  }

  _asset!._index = pid;
  addRewardTokenToAsset(event, Address.fromString(PTPAddress), _asset!);

  let totalAdjustedAllocPoint_call = MP.try_totalAdjustedAllocPoint();
  if (totalAdjustedAllocPoint_call.reverted) {
    log.error("[HandleRewards][{}]error fetching Ptp per second for pid {} old master plat", [
      event.transaction.hash.toHexString(),
      pid.toString(),
    ]);
    return _asset!;
  }

  let totalAdjustedAllocPoint = totalAdjustedAllocPoint_call.value;

  let ptpPerSecond_call = MP.try_ptpPerSec();
  if (ptpPerSecond_call.reverted) {
    log.error("[HandleRewards][{}]error fetching Ptp per second for pid {} old master plat", [
      event.transaction.hash.toHexString(),
      pid.toString(),
    ]);
    return _asset!;
  }

  let ptpPerSecond = ptpPerSecond_call.value;

  // // Get info for PTP rewards
  // let baseAllocPoint = poolInfoMap.value1;
  // let lastRewardTimestamp = poolInfoMap.value2;
  // let accPtpPerShare = poolInfoMap.value3;
  let rewarder = poolInfoMap.value4;
  // let sumOfFactors = poolInfoMap.value5;
  // let accPtpPerFactorShare = poolInfoMap.value6;
  // Adjusted allocation points for this pool. PTPs │ to distribute per second.
  // Only exists in masterPlatypusv3 contract
  let adjustedAllocPoint = poolInfoMap.value7;

  if (rewarder.notEqual(ZERO_ADDRESS)) {
    let bonusRewards = MP.try_rewarderBonusTokenInfo(pid);
    if (bonusRewards.reverted) {
      log.error("[HandleRewards][{}]error fetching bonusRewards for pid {}", [
        event.transaction.hash.toHexString(),
        pid.toString(),
      ]);
      return _asset!;
    }
    addRewardTokenToAsset(event, bonusRewards.value.value0, _asset!);
  }

  _asset!.save();

  let rewardTokenEmissionsAmount = new Array<BigInt>();
  let rewardTokenEmissionsUSD = new Array<BigDecimal>();

  for (let k = 0; k < _asset!.rewardTokens!.length; k++) {
    let tps: BigInt;
    let rewardToken = RewardToken.load(_asset!.rewardTokens![k])!;
    let token = getOrCreateToken(event, Address.fromString(rewardToken.token));

    log.debug("[HandleRewards][{}] Asset: {}, RT: {}, rewarder: {}", [
      event.transaction.hash.toHexString(),
      _asset!.id.toString(),
      rewardToken.id.toString(),
      rewarder.toHexString(),
    ]);

    if (token.id == PTPAddress) {
      tps = ptpPerSecond.times(adjustedAllocPoint).div(totalAdjustedAllocPoint);
      log.debug("PPS*AAP/TAAP=tps {}*{}/{}={}", [
        ptpPerSecond.toString(),
        adjustedAllocPoint.toString(),
        totalAdjustedAllocPoint.toString(),
        tps.toString(),
      ]);
    } else {
      let rewarderContract = SimpleRewarder.bind(rewarder);
      tps = getTPS(rewarderContract);
    }

    log.debug("rt {} tps {}", [rewardToken.id.toString(), tps.toString()]);
    rewardTokenEmissionsAmount.push(emissionsPerDay(tps));
    rewardTokenEmissionsUSD.push(tokenAmountToUSDAmount(token, emissionsPerDay(tps)));
  }

  _asset!.rewardTokenEmissionsAmount = rewardTokenEmissionsAmount;
  _asset!.rewardTokenEmissionsUSD = rewardTokenEmissionsUSD;
  _asset!.save();
  return _asset!;
}

export function getTPS(rewarderContract: SimpleRewarder): BigInt {
  if (rewarderContract._address.equals(ZERO_ADDRESS)) {
    return BIGINT_ZERO;
  }

  let tps = rewarderContract.try_tokenPerSec();
  if (tps.reverted) {
    log.error("[HandleRewards]error fetching simplerewarder {} getting tps ", [
      rewarderContract._address.toHexString(),
    ]);
  }
  return tps.value;
}

export function handleDeposit(event: Deposit): void {
  let _asset: _Asset;
  if (event.address.equals(MasterPlatypusOld_ADDRESS)) {
    _asset = getAssetForRewardsOld<Deposit>(event);
  } else {
    _asset = getAssetForRewardsNew<Deposit>(event);
  }
  _asset.amountStaked = _asset.amountStaked.plus(event.params.amount);
  _asset.save();
  updatePoolRewards(event, Address.fromString(_asset.pool));
}

export function handleWithdraw(event: Withdraw): void {
  let _asset: _Asset;
  if (event.address.equals(MasterPlatypusOld_ADDRESS)) {
    _asset = getAssetForRewardsOld<Withdraw>(event);
  } else {
    _asset = getAssetForRewardsNew<Withdraw>(event);
  }
  _asset.amountStaked = _asset.amountStaked.minus(event.params.amount);
  _asset.save();
  updatePoolRewards(event, Address.fromString(_asset.pool));
}

export function handleDepositFor(event: DepositFor): void {
  let _asset: _Asset;
  if (event.address.equals(MasterPlatypusOld_ADDRESS)) {
    _asset = getAssetForRewardsOld<DepositFor>(event);
  } else {
    _asset = getAssetForRewardsNew<DepositFor>(event);
  }
  _asset.amountStaked = _asset.amountStaked.plus(event.params.amount);
  _asset.save();
  updatePoolRewards(event, Address.fromString(_asset.pool));
}

export function handleEmergencyWithdraw(event: EmergencyWithdraw): void {}
