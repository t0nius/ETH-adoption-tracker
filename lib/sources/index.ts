import { MetricResult } from "../types";
import { getEthBtc } from "./coingecko";
import { getStablecoinSupplyEthereum } from "./defillama-stables";
import { getRwaShareEthereum } from "./defillama-rwa";
import { getTpsAggregated, getActiveAddressesAggregated } from "./growthepie";
import { getL2Tvl } from "./l2beat";
import { getBurnRateDaily, getStakingRatio } from "./ultrasound";
import { getBlobCountLatest } from "./rpc-blob";

export async function getAllMetrics(): Promise<MetricResult[]> {
  return Promise.all([
    getTpsAggregated(),
    getStablecoinSupplyEthereum(),
    getBurnRateDaily(),
    getStakingRatio(),
    getL2Tvl(),
    getEthBtc(),
    getActiveAddressesAggregated(),
    getRwaShareEthereum(),
    getBlobCountLatest(),
  ]);
}
