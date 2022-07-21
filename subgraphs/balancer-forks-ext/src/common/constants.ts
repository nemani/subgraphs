import { BigDecimal, BigInt, Address, dataSource } from "@graphprotocol/graph-ts";

////////////////////////
///// Schema Enums /////
////////////////////////

////////////////////
///// Versions /////
////////////////////

export const PROTOCOL_SCHEMA_VERSION = "1.3.0";
export const PROTOCOL_SUBGRAPH_VERSION = "1.1.2";
export const PROTOCOL_METHODOLOGY_VERSION = "1.0.0";

export const PROTOCOL_NAME = "Balancer v2"
export const PROTOCOL_SLUG = "balancer-v2"




// The network names corresponding to the Network enum in the schema.
// They also correspond to the ones in `dataSource.network()` after converting to lower case.
// See below for a complete list:
// https://thegraph.com/docs/en/hosted-service/what-is-hosted-service/#supported-networks-on-the-hosted-service
export namespace Network {
    export const ARBITRUM_ONE = "ARBITRUM_ONE";
    export const AVALANCHE = "AVALANCHE";
    export const AURORA = "AURORA";
    export const BSC = "BSC"; // aka BNB Chain
    export const CELO = "CELO";
    export const MAINNET = "MAINNET"; // Ethereum mainnet
    export const FANTOM = "FANTOM";
    export const FUSE = "FUSE";
    export const MOONBEAM = "MOONBEAM";
    export const MOONRIVER = "MOONRIVER";
    export const NEAR_MAINNET = "NEAR_MAINNET";
    export const OPTIMISM = "OPTIMISM";
    export const MATIC = "MATIC"; // aka Polygon
    export const XDAI = "XDAI"; // aka Gnosis Chain
}

export namespace ProtocolType {
    export const EXCHANGE = "EXCHANGE";
    export const LENDING = "LENDING";
    export const YIELD = "YIELD";
    export const BRIDGE = "BRIDGE";
    export const GENERIC = "GENERIC";
}

export namespace VaultFeeType {
  export const MANAGEMENT_FEE = "MANAGEMENT_FEE";
  export const PERFORMANCE_FEE = "PERFORMANCE_FEE";
  export const DEPOSIT_FEE = "DEPOSIT_FEE";
  export const WITHDRAWAL_FEE = "WITHDRAWAL_FEE";
}

export namespace LiquidityPoolFeeType {
  export const FIXED_TRADING_FEE = "FIXED_TRADING_FEE";
  export const TIERED_TRADING_FEE = "TIERED_TRADING_FEE";
  export const DYNAMIC_TRADING_FEE = "DYNAMIC_TRADING_FEE";
  export const FIXED_LP_FEE = "FIXED_LP_FEE";
  export const DYNAMIC_LP_FEE = "DYNAMIC_LP_FEE";
  export const FIXED_PROTOCOL_FEE = "FIXED_PROTOCOL_FEE";
  export const DYNAMIC_PROTOCOL_FEE = "DYNAMIC_PROTOCOL_FEE";
}

export namespace RewardTokenType {
  export const DEPOSIT = "DEPOSIT";
  export const BORROW = "BORROW";
}

export namespace UsageType {
  export const DEPOSIT = "DEPOSIT";
  export const WITHDRAW = "WITHDRAW";
  export const SWAP = "SWAP";
}

//////////////////////////////
///// Ethereum Addresses /////
//////////////////////////////

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

////////////////////////
///// Type Helpers /////
////////////////////////

export const DEFAULT_DECIMALS = 18;
export const USDC_DECIMALS = 6;
export const USDC_DENOMINATOR = BigDecimal.fromString("1000000");
export const BIGINT_NEG_ONE = BigInt.fromI32(-1);
export const BIGINT_ZERO = BigInt.fromI32(0);
export const BIGINT_ONE = BigInt.fromI32(1);
export const BIGINT_TWO = BigInt.fromI32(2);
export const BIGINT_TEN = BigInt.fromI32(10);
export const BIGINT_HUNDRED = BigInt.fromI32(100);
export const BIGINT_192 = BigInt.fromI32(192);
export const BIGINT_TEN_THOUSAND = BigInt.fromI32(10000);
export const BIGINT_MILLION = BigInt.fromI32(1000000);
export const BIGINT_MAX = BigInt.fromString("115792089237316195423570985008687907853269984665640564039457584007913129639935");
export const BIGDECIMAL_NEG_ONE = new BigDecimal(BIGINT_NEG_ONE);
export const BIGDECIMAL_ZERO = new BigDecimal(BIGINT_ZERO);
export const BIGDECIMAL_ONE = new BigDecimal(BIGINT_ONE);
export const BIGDECIMAL_TWO = new BigDecimal(BIGINT_TWO);
export const BIGDECIMAL_TEN = new BigDecimal(BIGINT_TEN);
export const BIGDECIMAL_HUNDRED = new BigDecimal(BIGINT_HUNDRED);
export const BIGDECIMAL_192 = new BigDecimal(BIGINT_192);
export const BIGDECIMAL_TEN_THOUSAND = new BigDecimal(BIGINT_TEN_THOUSAND);
export const BIGDECIMAL_MILLION = new BigDecimal(BIGINT_MILLION);

export const Q192 = BigDecimal.fromString("6277101735386680763835789423207666416102355444464034512896");
export const INT_ZERO = 0 as i32;
export const INT_ONE = 1 as i32;
export const INT_TWO = 2 as i32;
export const INT_THREE = 3 as i32;

/////////////////////
///// Date/Time /////
/////////////////////
export const MAX_UINT = BigInt.fromI32(2).times(BigInt.fromI32(255));
export const DAYS_PER_YEAR = new BigDecimal(BigInt.fromI32(365));
export const SECONDS_PER_DAY = 60 * 60 * 24;
export const SECONDS_PER_HOUR = 60 * 60;
export const MS_PER_DAY = new BigDecimal(BigInt.fromI32(24 * 60 * 60 * 1000));
export const MS_PER_YEAR = DAYS_PER_YEAR.times(new BigDecimal(BigInt.fromI32(24 * 60 * 60 * 1000)));
export const PROTOCOL_FEE_TO_OFF = BigDecimal.fromString("0");


/////////////////////////////
///// Protocol Specific /////
/////////////////////////////

export let DEFAULT_NETWORK =  "MATIC" 

export let VAULT_ADDRESS = Address.fromString('0xBA12222222228d8Ba445958a75a0704d566BF2C8')

export let REWARD_TOKEN = "" 





export let WETH: Address = Address.fromString('0x7ceb23fd6bc0add59e62ac25578270cff1b9f619');
export let WMATIC: Address = Address.fromString('0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270');
export let WBTC: Address = Address.fromString('0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6');
export let USDC: Address = Address.fromString('0x2791bca1f2de4661ed88a30c99a7a9449aa84174');
export let USDT: Address = Address.fromString('0xc2132D05D31c914a87C6611C10748AEb04B58e8F');
export let BAL: Address = Address.fromString('0x9a71012b13ca4d3d0cdc72a177df3ef03b0e76a3');
export let DAI: Address = Address.fromString('0x8f3cf7ad23cd3cadbd9735aff958023239c6a063');

export let USD_STABLE_ASSETS: Address[] = [USDC, DAI, USDT];
export let BASE_ASSETS: Address[] = [WETH, WMATIC, WBTC, BAL];
