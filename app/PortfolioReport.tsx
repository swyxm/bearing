"use client";

import { useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { percent, score, signedPercent, SCENARIOS, type Market, type Weights } from "@/lib/decision";
import CountryFlag from "./CountryFlag";
import { MEMOS } from "@/lib/memos";



function latest(market: Market, key: string): number | null {
  return market.macro[key]?.value ?? null;
}

function internetGain(market: Market): number | null {
  const first = market.macroHistory.find(row => row.year === 2015)?.internet_users_pct;
  const last = market.macroHistory.find(row => row.year === 2024)?.internet_users_pct;
  return first === undefined || last === undefined ? null : last - first;
}

function pctPoint(value: number | null) {
  return value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)} pp`;
}

function MarketSignals({ market }: { market: Market }) {
  const access = latest(market, "internet_users_pct");
  const growth = market.consumerMedianRevenueGrowth;
  const hasPeerTrend = market.consumerPeerCount >= 3 && growth !== null;
  return <span className="market-signals">
    <span><small>Internet use</small><strong>{access?.toFixed(0) ?? "—"}%</strong></span>
    <span><small>Since 2015</small><strong>{pctPoint(internetGain(market))}</strong></span>
    <span><small>{hasPeerTrend ? "Peer revenue CAGR" : "Relevant peers"}</small><strong>{hasPeerTrend ? signedPercent(growth, 0) : market.consumerPeerCount}</strong></span>
  </span>;
}

function MarketSensitivity({ market, weights }: { market: Market; weights: Weights }) {
  const activeScore = Math.round(score(market, weights) * 100);
  const total = weights.opportunity + weights.operatingHealth + weights.momentum + weights.resilience;
  const opp = Math.round((market.opportunity * weights.opportunity / total) * 100);
  const health = Math.round((market.operatingHealth * weights.operatingHealth / total) * 100);
  const mom = Math.round((market.momentum * weights.momentum / total) * 100);
  const res = Math.round(((1 - market.stressProbability) * weights.resilience / total) * 100);

  return (
    <div className="report-market-sensitivity group">
      <div className="sensitivity-array">
        <div className="sensitivity-pill active" title="Current Score">
          <span>Score</span>
          <strong>{activeScore}</strong>
        </div>
      </div>
      <div className="score-tooltip">
        <div className="tooltip-head">Score Breakdown (out of 100)</div>
        <div className="tooltip-grid">
          <span>Opportunity</span><strong>{opp}</strong>
          <span>Health</span><strong>{health}</strong>
          <span>Momentum</span><strong>{mom}</strong>
          <span>Resilience</span><strong>{res}</strong>
        </div>
      </div>
    </div>
  );
}

export default function PortfolioReport({ markets, weights, onSelect }: { markets: Market[]; weights: Weights; onSelect: (code: string) => void }) {
  const [filter, setFilter] = useState<"all" | "deep" | "other">("all");
  const byCode = useMemo(() => Object.fromEntries(markets.map(market => [market.code, market])), [markets]);
  const core = markets.filter(m => m.consumerPeerCount >= 3).sort((a, b) => score(b, weights) - score(a, weights));
  const others = markets.filter(m => m.consumerPeerCount < 3).sort((a, b) => score(b, weights) - score(a, weights));
  const shown = filter === "deep" ? core : filter === "other" ? others : [...core, ...others];
  const us = byCode.US;
  const india = byCode.IN;
  const uk = byCode.GB;
  return <div className="portfolio-report">
    <section className="widget report-lead">
      <div className="report-lead-head"><span>Shop-EY market review</span></div>
      <h2>Scenario-driven strategic priorities</h2>
      <p>Under the current weights, <strong>{core[0].name}</strong> is the strongest assessable market, while <strong>{core[core.length - 1].name}</strong> presents the weakest profile. <strong>{[...others].sort((a, b) => b.opportunity - a.opportunity)[0].name}</strong> offers an alternate option with high underlying opportunity but low current competition.</p>
      <div className="strategic-layout">
        <button type="button" className="strategic-card" onClick={() => onSelect(core[0].code)}>
          <div className="strategic-hero">
            <CountryFlag code={core[0].code} /> <strong>{core[0].name}</strong> <span className="strategic-score">{Math.round(score(core[0], weights) * 100)}</span>
          </div>
          <div className="strategic-label">Primary recommendation for investment <ArrowUpRight size={14} className="strategic-arrow" /></div>
        </button>
        
        <button type="button" className="strategic-card" onClick={() => onSelect([...others].sort((a, b) => b.opportunity - a.opportunity)[0].code)}>
          <div className="strategic-hero">
            <CountryFlag code={[...others].sort((a, b) => b.opportunity - a.opportunity)[0].code} /> <strong>{[...others].sort((a, b) => b.opportunity - a.opportunity)[0].name}</strong> <span className="strategic-score">{Math.round([...others].sort((a, b) => b.opportunity - a.opportunity)[0].opportunity * 100)}</span>
          </div>
          <div className="strategic-label">Alternate recommendation for investment <ArrowUpRight size={14} className="strategic-arrow" /></div>
        </button>

        <div className="strategic-divider" />

        <button type="button" className="strategic-card divest" onClick={() => onSelect(core[core.length - 1].code)}>
          <div className="strategic-hero">
            <CountryFlag code={core[core.length - 1].code} /> <strong>{core[core.length - 1].name}</strong> <span className="strategic-score">{Math.round(score(core[core.length - 1], weights) * 100)}</span>
          </div>
          <div className="strategic-label">Review exposure <ArrowUpRight size={14} className="strategic-arrow" /></div>
        </button>
      </div>
    </section>
    <section className="report-focus-grid" aria-label="Market findings">
      {shown.map(market => <button type="button" className="widget report-focus" key={market.code} onClick={() => onSelect(market.code)}>
        <div className="report-focus-top"><span><CountryFlag code={market.code} />{market.name}</span><ArrowUpRight size={17} /></div>
        <h2>{MEMOS[market.code]?.title}</h2>
        <p>{MEMOS[market.code]?.reading}</p>
        <div className="report-focus-data">
          <span><small>Internet use</small><strong>{latest(market, "internet_users_pct")?.toFixed(1)}%</strong></span>
          <span><small>Change since 2015</small><strong>{pctPoint(internetGain(market))}</strong></span>
          <span><small>Peer revenue CAGR</small><strong>{signedPercent(market.consumerMedianRevenueGrowth, 0)}</strong></span>
          <span><small>Peer operating margin</small><strong>{signedPercent(market.consumerMedianOperatingMargin, 0)}</strong></span>
        </div>
        <div className="report-focus-direction"><strong>Recommended focus</strong><span>{MEMOS[market.code]?.direction}</span></div>
      </button>)}
    </section>
    <section className="widget report-market-list">
      <div className="report-list-head"><div><h2>All markets</h2><p>Country indicators cover all 13 markets. Company evidence is deepest in the four markets above.</p></div><div className="report-filters"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button><button className={filter === "deep" ? "active" : ""} onClick={() => setFilter("deep")}>Multi-peer</button><button className={filter === "other" ? "active" : ""} onClick={() => setFilter("other")}>Other markets</button></div></div>
      <div className="report-table-head"><span>Market</span><span>Market evidence</span><span>Decision indicator</span></div>
      <div className="report-market-rows">{shown.map(market => <button key={market.code} onClick={() => onSelect(market.code)}>
        <span className="report-market-name"><strong><CountryFlag code={market.code} />{market.name}</strong><small>{market.consumerPeerCount} relevant listed peers</small></span>
        <MarketSignals market={market} />
        <MarketSensitivity market={market} weights={weights} />
        <ArrowRight size={15} aria-hidden="true" />
      </button>)}</div>
    </section>
  </div>;
}
