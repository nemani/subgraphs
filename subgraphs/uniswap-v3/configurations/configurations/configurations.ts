import { UniswapV3ArbitrumConfigurations } from "../../protocols/uniswap-v3/config/networks/arbitrum/arbitrum";
import { UniswapV3MainnetConfigurations } from "../../protocols/uniswap-v3/config/networks/ethereum/ethereum";
import { UniswapV3MaticConfigurations } from "../../protocols/uniswap-v3/config/networks/polygon/polygon";
import { UniswapV3OptimismConfigurations } from "../../protocols/uniswap-v3/config/networks/optimism/optimism";
import { UniswapV3CeloConfigurations } from "../../protocols/uniswap-v3/config/networks/celo/celo";
import { Configurations } from "./interface";
import { Deploy } from "./deploy";
import { log } from "@graphprotocol/graph-ts";

export function getNetworkConfigurations(deploy: i32): Configurations {
  switch (deploy) {
    case Deploy.UNISWAP_V3_ARBITRUM: {
      return new UniswapV3ArbitrumConfigurations();
    }
    case Deploy.UNISWAP_V3_ETHEREUM: {
      return new UniswapV3MainnetConfigurations();
    }
    case Deploy.UNISWAP_V3_POLYGON: {
      return new UniswapV3MaticConfigurations();
    }
    case Deploy.UNISWAP_V3_OPTIMISM: {
      return new UniswapV3OptimismConfigurations();
    }
    case Deploy.UNISWAP_V3_CELO: {
      return new UniswapV3CeloConfigurations();
    }
    default: {
      log.critical(
        "No configurations found for deployment protocol/network",
        []
      );
      return new UniswapV3OptimismConfigurations();
    }
  }
}
