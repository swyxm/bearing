export type Peer = {
  id: string;
  name: string;
  ticker: string;
  segment: string;
  peerGroup: "Consumer retail" | "Marketplace" | "Services & infrastructure";
  relevance: number;
  stressProbability: number;
  momentum63: number;
  volatility63: number;
  revenueGrowth: number | null;
  operatingMargin: number | null;
  fiscalYear: number;
  historyStart: string;
  lastPriceDate: string;
};

export type Market = {
  code: string;
  name: string;
  region: string;
  peerCount: number;
  consumerPeerCount: number;
  peerGroupCounts: Record<Peer["peerGroup"], number>;
  coverage: "Broad" | "Moderate" | "Limited";
  opportunity: number;
  operatingHealth: number;
  momentum: number;
  calculation: {
    internetRank: number;
    accountRank: number;
    gdpRank: number;
    populationRank: number;
    growthRank: number;
    marginRank: number;
    momentumRank: number;
  };
  stressProbability: number;
  medianRevenueGrowth: number;
  medianOperatingMargin: number;
  consumerMedianRevenueGrowth: number | null;
  consumerMedianOperatingMargin: number | null;
  medianMomentum63: number;
  macro: Record<string, { value: number; year: number }>;
  trend: { month: string; volatility: number; stressProbability: number }[];
  annualTrend: { year: number; growth: number | null; margin: number | null; growthCount: number; marginCount: number }[];
  macroHistory: { year: number; internet_users_pct?: number; account_ownership_pct_adult?: number; mobile_subs_per_100?: number; urban_population_pct?: number }[];
  peers: Peer[];
};

export type Snapshot = {
  version: string;
  asOf: string;
  builtAt: string;
  dataQuality: { invalidPriceRowsRemoved: number; countryCount: number; companyCount: number };
  model: {
    trainRows: number;
    testRows: number;
    trainEnd: string;
    testStart: string;
    testEnd: string;
    highStressThreshold: number;
    testPrevalence: number;
    auc: number;
    baselineAuc: number;
    averagePrecision: number;
    brier: number;
  };
  markets: Market[];
};

export type Weights = { opportunity: number; operatingHealth: number; momentum: number; resilience: number };

export const SCENARIOS: Record<string, { name: string; description: string; weights: Weights }> = {
  balanced: {
    name: "Balanced allocation",
    description: "Equal attention to market capacity, operating performance and downside exposure.",
    weights: { opportunity: 35, operatingHealth: 25, momentum: 15, resilience: 25 },
  },
  growth: {
    name: "Structural capacity",
    description: "Prioritizes total addressable market and macro readiness for maximum de-risked capacity.",
    weights: { opportunity: 45, operatingHealth: 25, momentum: 20, resilience: 10 },
  },
  returns: {
    name: "Growth momentum",
    description: "Prioritizes recent peer growth and operating momentum for targeted upside bets.",
    weights: { opportunity: 15, operatingHealth: 45, momentum: 30, resilience: 10 },
  },
  defensive: {
    name: "Margin and resilience",
    description: "Prioritizes operating margin health and low-stress environments to protect capital.",
    weights: { opportunity: 20, operatingHealth: 35, momentum: 10, resilience: 35 },
  },
};

export function score(market: Market, weights: Weights): number {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (!total) return 0;
  return (
    market.opportunity * weights.opportunity +
    market.operatingHealth * weights.operatingHealth +
    market.momentum * weights.momentum +
    (1 - market.stressProbability) * weights.resilience
  ) / total;
}

export function decision(market: Market, weights: Weights): string {
  if (market.consumerPeerCount < 3) return "Market watch";
  if (market.consumerMedianRevenueGrowth !== null && market.consumerMedianOperatingMargin !== null && market.consumerMedianRevenueGrowth < 0 && market.consumerMedianOperatingMargin < 0) return "Review incremental exposure";
  const value = score(market, weights);
  if (value >= 0.63) return "Consider further investment";
  if (value >= 0.48) return "Maintain and assess";
  return "Review incremental exposure";
}

export function percent(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : `${(value * 100).toFixed(digits)}%`;
}

export function signedPercent(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : `${value > 0 ? "+" : ""}${(value * 100).toFixed(digits)}%`;
}

export function prettyDate(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
