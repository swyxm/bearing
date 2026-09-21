"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Command,
  Expand,
  ExternalLink,
  FileText,
  LayoutGrid,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  SlidersHorizontal,
  X,
  TrendingUp,
  TrendingDown,
  Microscope,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Compass } from "lucide-react";

import rawSnapshot from "@/generated/snapshot.json";
import { decision, percent, prettyDate, SCENARIOS, score, signedPercent, type Market, type Peer, type Snapshot, type Weights } from "@/lib/decision";
import { MEMOS } from "@/lib/memos";
import Northstar from "./Northstar";
import { DigitalChart, FinancialChart, RiskChart, MarketCompositionChart } from "./ReportCharts";
import PortfolioReport from "./PortfolioReport";
import CountryFlag from "./CountryFlag";

const data = rawSnapshot as Snapshot;
type View = "overview" | "market" | "scenario" | "model";
type WidgetId = "assessment" | "trend" | "financial" | "digital" | "drivers" | "peers" | "robustness";

const navigation: { id: View; label: string; icon: typeof LayoutGrid }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "market", label: "Market analysis", icon: BarChart3 },
  { id: "scenario", label: "Scenario analysis", icon: SlidersHorizontal },
  { id: "model", label: "Methodology", icon: Microscope },
];

function Info({ text, label }: { text: string; label: string }) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; below: boolean } | null>(null);
  useEffect(() => {
    if (!position) return;
    const close = () => setPosition(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [position]);
  function show() {
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(300, window.innerWidth - 28);
    const left = Math.max(14, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 14));
    const below = rect.top < 180;
    setPosition({ top: below ? rect.bottom + 10 : rect.top - 10, left, below });
  }
  return <span className="info-anchor"><button ref={button} className="info-button" type="button" aria-label={`About ${label}`} aria-describedby={position ? id : undefined} onMouseEnter={show} onMouseLeave={() => setPosition(null)} onFocus={show} onBlur={() => setPosition(null)} onClick={show}><CircleHelp size={14} strokeWidth={1.8} /></button>{position && createPortal(<span id={id} className="info-popover" role="tooltip" style={{ top: position.top, left: position.left, width: Math.min(300, window.innerWidth - 28), transform: position.below ? "none" : "translateY(-100%)" }}>{text}</span>, document.body)}</span>;
}

function Heading({ title, description }: { eyebrow?: string; title: ReactNode; description?: string }) {
  return <div className="page-heading"><h1>{title}</h1>{description && <p>{description}</p>}</div>;
}

function Widget({ id, title, info, children, expandedDetail, replaceOnExpand = false, className = "" }: { id: WidgetId; title: string; info?: string; children: ReactNode; expandedDetail?: ReactNode; replaceOnExpand?: boolean; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  return <>
    {expanded && <div className="widget-scrim" onClick={() => setExpanded(false)} />}
    <section className={`widget ${className} ${expanded ? "widget-expanded" : ""}`} data-widget={id}>
      <div className="widget-heading"><div className="widget-title"><h2>{title}</h2>{info && <Info label={title} text={info} />}</div><button className="icon-action" type="button" aria-label={expanded ? `Close ${title}` : `Expand ${title}`} onClick={() => setExpanded(!expanded)}>{expanded ? <X size={16} /> : <Expand size={15} />}</button></div>
      <div className="widget-content">{expanded && replaceOnExpand ? expandedDetail : <>{children}{expanded && expandedDetail && <div className="expanded-detail">{expandedDetail}</div>}</>}</div>
    </section>
  </>;
}

function Metric({ label, value, note, info, tone }: { label: string; value: string; note: string; info?: string; tone?: "up" | "down" }) {
  return <div className="metric"><div className="metric-label">{label}{info && <Info label={label} text={info} />}</div><div className={`metric-value ${tone || ""}`}>{value}</div><div className="metric-note">{note}</div></div>;
}

function TrendChart({ market }: { market: Market }) {
  const points = market.trend;
  if (points.length < 2) return <div className="empty-chart">Not enough history for a trend.</div>;
  const width = 680, height = 216, left = 42, right = 16, top = 14, bottom = 30;
  const vals = points.map(point => point.volatility * 100);
  const min = Math.floor(Math.min(...vals) / 10) * 10;
  const max = Math.ceil(Math.max(...vals) / 10) * 10 || min + 10;
  const y = (value: number) => top + (max - value) / (max - min || 1) * (height - top - bottom);
  const x = (index: number) => left + index / (points.length - 1) * (width - left - right);
  const path = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point.volatility * 100).toFixed(1)}`).join(" ");
  const area = `${path} L${x(points.length - 1)},${height - bottom} L${left},${height - bottom} Z`;
  return <div className="trend-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Trailing 63-day annualized peer volatility for ${market.name}`}>
    {[0, .5, 1].map((ratio, index) => { const value = min + (max - min) * ratio; return <g key={index}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} className="grid-line" /><text x={left - 10} y={y(value) + 4} textAnchor="end" className="axis-label">{Math.round(value)}%</text></g>; })}
    <path d={area} className="area-path" /><path d={path} className="trend-path" />
    <circle cx={x(points.length - 1)} cy={y(vals[vals.length - 1])} r="5" className="trend-dot" />
    {[0, Math.floor((points.length - 1) / 2), points.length - 1].map(index => <text key={index} x={x(index)} y={height - 5} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"} className="axis-label">{points[index].month}</text>)}
  </svg><div className="chart-note"><span className="legend-line" />Weighted average of listed peers’ trailing 63-day volatility, annualized.</div></div>;
}

function ScoreBar({ label, value, inputs, formula, note }: { label: string; value: number; inputs: { name: string; value: string }[]; formula: { name: string; rank: number; weight: number }[]; note: React.ReactNode }) {
  return <div className="score-row"><div className="score-row-top"><span>{label}</span><strong>{Math.round(value * 100)}<small>/100</small></strong></div><div className="score-track"><div style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} /></div><div className="score-inputs">{inputs.map(input => <div key={input.name}><span>{input.name}</span><strong>{input.value}</strong></div>)}</div><details className="score-calculation"><summary>Calculation <ChevronRight size={14} /></summary><div className="calculation-body"><div className="calc-intro">{note}</div>{formula.map(part => <div className="calculation-line" key={part.name}><span>{part.name}</span><strong>{(part.rank * 100).toFixed(1)} × {part.weight}% = {(part.rank * part.weight).toFixed(1)} points</strong></div>)}<div className="calculation-total"><span>Score</span><strong>{(value * 100).toFixed(1)} / 100</strong></div></div></details></div>;
}

function Assessment({ market, weights }: { market: Market; weights: Weights }) {
  const action = decision(market, weights);
  const value = score(market, weights);
  const rationale = marketInterpretation(market);
  return <div className="assessment"><div className="assessment-action"><div className="action-line"><h3>{action}</h3></div><p>{rationale}</p></div><div className="assessment-separator" /><div className="assessment-bottom"><div><div className="small-label">Decision indicator <Info label="decision indicator" text="Scenario-weighted combination of 4 sub-scores: market opportunity, peer health, momentum and resilience. Scores map to action categories: 'Market watch' (<3 peers), 'Consider further investment' (≥63), 'Maintain and assess' (≥48), or 'Review incremental exposure'. Expand ↗ this widget to see how each sub-score contributes." /></div><strong>{Math.round(value * 100)}<span>/100</span></strong></div><div><div className="small-label">Retail and marketplace peers <Info label="consumer peer coverage" text="Retail and marketplace peers in the supplied company set." /></div><strong className="coverage-text">{market.consumerPeerCount} of {market.peerCount}</strong></div></div><p className="assessment-footnote">* Sub-score calculations are shown in the <strong>Evidence Profile</strong> widget below. ** Stress resilience uses the ML model from <strong>Forward Peer Risk</strong>.</p></div>;
}

function DriverPanel({ market }: { market: Market }) {
  const macro = market.macro;
  const ranks = market.calculation;
  const whole = (value?: number) => value === undefined ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  return <div className="driver-panel">
    <ScoreBar label="Current market opportunity" value={market.opportunity} inputs={[{ name: "Internet use", value: `${macro.internet_users_pct?.value.toFixed(1) ?? "—"}%` }, { name: "Account ownership", value: `${macro.account_ownership_pct_adult?.value.toFixed(1) ?? "—"}%` }, { name: "GDP per capita", value: `$${whole(macro.gdp_per_capita_usd?.value)}` }, { name: "Population", value: whole(macro.population_total?.value) }]} formula={[{ name: "Internet use", rank: ranks.internetRank, weight: 25 }, { name: "Account ownership", rank: ranks.accountRank, weight: 25 }, { name: "GDP per capita", rank: ranks.gdpRank, weight: 25 }, { name: "Population", rank: ranks.populationRank, weight: 25 }]} note={<p>Percentile ranks across 13 markets. Weighting follows the equal weighting strategy from the <a href="https://unctad.org/system/files/official-document/tn_unctad_ict4d14_en.pdf" target="_blank" rel="noreferrer" style={{color: 'var(--accent)', textDecoration: 'underline'}}>UNCTAD B2C E-commerce Index methodology</a>, where each indicator carries the same weight (25%).</p>} />
    <ScoreBar label="Peer operating health" value={market.operatingHealth} inputs={[{ name: "Median revenue CAGR", value: percent(market.medianRevenueGrowth) }, { name: "Median operating margin", value: percent(market.medianOperatingMargin) }]} formula={[{ name: "Revenue growth", rank: ranks.growthRank, weight: 55 }, { name: "Operating margin", rank: ranks.marginRank, weight: 45 }]} note={<p>Company revenue growth and operating margin ranks across the supplied peer set, weighted by segment relevance.</p>} />
    <ScoreBar label="Peer price momentum" value={market.momentum} inputs={[{ name: "Median 63-day return", value: signedPercent(market.medianMomentum63) }]} formula={[{ name: "63-day return", rank: ranks.momentumRank, weight: 100 }]} note={<p>Each peer's adjusted-price return is ranked among 43 companies. The country score is a segment-relevance-weighted average of those ranks.</p>} />
  </div>;
}

function PeerPanel({ market }: { market: Market }) {
  const [selectedPeer, setSelectedPeer] = useState<Peer | null>(null);
  const [livePrediction, setLivePrediction] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  async function inspect(peer: Peer) {
    setSelectedPeer(peer); setLivePrediction(null); setLoading(true);
    try {
      const response = await fetch("/api/predict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId: peer.id }) });
      if (response.ok) setLivePrediction((await response.json()).probability);
    } catch { setLivePrediction(null); } finally { setLoading(false); }
  }
  return <div className="peer-panel"><div className="peer-table-wrap"><table className="peer-table"><thead><tr><th>Company</th><th>Segment</th><th>Revenue CAGR</th><th>Operating margin</th><th>Stress estimate</th></tr></thead><tbody>{[...market.peers].sort((a, b) => b.relevance - a.relevance).map(peer => <tr key={peer.id} className={selectedPeer?.id === peer.id ? "selected" : ""} onClick={() => inspect(peer)} tabIndex={0} onKeyDown={event => { if (event.key === "Enter") inspect(peer); }}><td><strong>{peer.name}</strong><small>{peer.ticker}</small></td><td>{peer.segment}</td><td className={peer.revenueGrowth !== null && peer.revenueGrowth < 0 ? "negative" : ""}>{signedPercent(peer.revenueGrowth)}</td><td className={peer.operatingMargin !== null && peer.operatingMargin < 0 ? "negative" : ""}>{signedPercent(peer.operatingMargin)}</td><td>{percent(peer.stressProbability, 0)}</td></tr>)}</tbody></table></div>
    {selectedPeer && <div className="peer-detail"><div><strong>{selectedPeer.name}</strong><span>{selectedPeer.segment} · fiscal {selectedPeer.fiscalYear}</span></div><div><span>Model inference</span><strong>{loading ? "Calculating…" : livePrediction === null ? percent(selectedPeer.stressProbability, 0) : percent(livePrediction, 0)}</strong></div><button onClick={() => setSelectedPeer(null)} aria-label="Close peer detail"><X size={14} /></button></div>}
  </div>;
}

function Robustness({ market }: { market: Market }) {
  return <div className="robustness"><div className="robustness-list">{Object.entries(SCENARIOS).map(([key, scenario]) => <div className="robustness-row" key={key}><span>{scenario.name}</span><strong>{decision(market, scenario.weights)}</strong><span>{Math.round(score(market, scenario.weights) * 100)}</span></div>)}</div></div>;
}

function Overview({ markets, weights, onSelect }: { markets: Market[]; weights: Weights; onSelect: (code: string) => void }) {
  const [query, setQuery] = useState("");
  const filtered = markets.filter(market => `${market.name} ${market.region}`.toLowerCase().includes(query.toLowerCase()));
  const assessable = markets.filter(market => market.peerCount >= 3).length;
  return <><Heading eyebrow="Portfolio view" title="Market assessment" description="Comparable company signals and country indicators, interpreted as evidence for investment review." />
    <div className="metrics-grid"><Metric label="Markets represented" value={String(data.dataQuality.countryCount)} note="Company country classifications" info="43 listed companies across 13 markets." /><Metric label="Markets with multiple peers" value={String(assessable)} note="At least three listed companies" info="Four markets have three or more retail or marketplace peers." /><Metric label="Next-quarter stress" value={percent(markets.filter(m => m.peerCount >= 3).reduce((sum, m) => sum + m.stressProbability, 0) / assessable, 0)} note="Mean across the four deeper markets" info="Predicted high-volatility probability across the four multi-peer markets." /><Metric label="Source freshness" value={prettyDate(data.asOf)} note="Last price observation" info="Source period through May 2026." /></div>
    <section className="widget overview-table"><div className="widget-heading"><div className="widget-title"><h2>Markets</h2><Info label="market table" text="Scenario-weighted view of country access, peer operations, price momentum and predicted stress." /></div><div className="table-actions"><a className="export-link" href="/api/export">Export data</a><div className="table-tools"><Search size={15} /><input aria-label="Search markets" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search market" /></div></div></div><div className="market-table-wrap"><table className="market-table"><thead><tr><th>Market</th><th>Assessment <Info label="assessment category" text="Derived from peer context and score: 'Market watch' (<3 peers), 'Consider further investment' (≥63), 'Maintain and assess' (≥48), or 'Review incremental exposure'." /></th><th>Indicator</th><th>Peer stress <Info label="peer stress" text="Probability of high volatility. Categories: ≥60% High risk, ≥35% Elevated, <35% Low risk." /></th><th>Peers</th><th>Coverage</th><th></th></tr></thead><tbody>{filtered.map(market => <tr key={market.code} onClick={() => onSelect(market.code)} tabIndex={0} onKeyDown={event => { if (event.key === "Enter") onSelect(market.code); }}><td><strong>{market.name}</strong><small>{market.region}</small></td><td>{decision(market, weights)}</td><td><div className="table-score"><span>{Math.round(score(market, weights) * 100)}</span><span className="mini-track"><i style={{ width: `${score(market, weights) * 100}%` }} /></span></div></td><td>{percent(market.stressProbability, 0)}</td><td>{market.peerCount}</td><td>{market.coverage}</td><td><ArrowUpRight size={16} /></td></tr>)}</tbody></table></div></section>
  </>;
}

function marketInterpretation(market: Market) {
  return MEMOS[market.code]?.reading || `${market.name} combines country access indicators with ${market.consumerPeerCount} retail or marketplace peer${market.consumerPeerCount === 1 ? "" : "s"} in the supplied set.`;
}

function AssessmentReport({ market, weights }: { market: Market; weights: Weights }) {
  const first = market.macroHistory.find(row => row.year === 2015)?.internet_users_pct;
  const last = market.macroHistory.find(row => row.year === 2024)?.internet_users_pct;
  const digitalGain = first === undefined || last === undefined ? null : last - first;
  const relevant = [...market.peers].filter(peer => peer.relevance >= 0.5).sort((a, b) => b.relevance - a.relevance).slice(0, 10);
  const pieces = [
    { label: "Market opportunity *", input: market.opportunity, weight: weights.opportunity },
    { label: "Peer operating health *", input: market.operatingHealth, weight: weights.operatingHealth },
    { label: "Price momentum *", input: market.momentum, weight: weights.momentum },
    { label: "Stress resilience **", input: 1 - market.stressProbability, weight: weights.resilience },
  ];
  const total = pieces.reduce((sum, piece) => sum + piece.weight, 0);
  const recommendation = MEMOS[market.code]?.direction || "Use the market access trend and peer record to focus the country review.";
  return <div className="assessment-report-view">
    <div className="assessment-report-banner"><div><span>Recommended focus</span><h3>{recommendation}</h3></div><p>{marketInterpretation(market)}</p></div>
    <div className="assessment-kpi-strip"><div><span>Internet use</span><strong>{last?.toFixed(1) ?? "—"}%</strong><small>2024</small></div><div><span>Access change</span><strong>{digitalGain === null ? "—" : `${digitalGain >= 0 ? "+" : ""}${digitalGain.toFixed(1)} pp`}</strong><small>since 2015</small></div><div><span>Peer revenue CAGR</span><strong>{signedPercent(market.consumerMedianRevenueGrowth)}</strong><small>{market.consumerPeerCount} peers</small></div><div><span>Peer operating margin</span><strong>{signedPercent(market.consumerMedianOperatingMargin)}</strong><small>latest fiscal year</small></div></div>
    <section className="assessment-section"><div className="assessment-section-head"><h3>Decision construction</h3><span>{Math.round(score(market, weights) * 100)}/100</span></div><table className="assessment-data-table"><thead><tr><th>Input</th><th>Score</th><th>Weight</th><th>Contribution</th></tr></thead><tbody>{pieces.map(piece => <tr key={piece.label}><td>{piece.label}</td><td>{Math.round(piece.input * 100)}</td><td>{piece.weight}%</td><td>{(piece.input * piece.weight / total * 100).toFixed(1)} points</td></tr>)}</tbody></table><p className="expanded-footnote">* Individual sub-score calculations are in the <strong>Evidence Profile</strong> widget — click the "Calculation" toggle under each bar.<br />** Stress resilience = 1 − stress probability from the predictive ML model. See the <strong>Forward Peer Risk</strong> widget for the model inputs.</p></section>
    <section className="assessment-section"><div className="assessment-section-head"><h3>Relevant peers</h3><span>{relevant.length} companies</span></div><table className="assessment-data-table peer-data-table"><thead><tr><th>Company</th><th>Segment</th><th>Revenue CAGR</th><th>Operating margin</th></tr></thead><tbody>{relevant.map(peer => <tr key={peer.id}><td><strong>{peer.name}</strong></td><td>{peer.segment}</td><td>{signedPercent(peer.revenueGrowth)}</td><td>{signedPercent(peer.operatingMargin)}</td></tr>)}</tbody></table></section>
  </div>;
}

function MLRiskWalkthrough({ market }: { market: Market }) {
  const sortedPeers = [...market.peers].sort((a, b) => b.stressProbability - a.stressProbability);
  const threshold = data.model.highStressThreshold;
  const stressColor = (p: number) => p >= 0.6 ? "#aa6259" : p >= 0.35 ? "#c4934a" : "#4a8e89";
  const stressLabel = (p: number) => p >= 0.6 ? "High risk" : p >= 0.35 ? "Elevated" : "Low risk";
  const totalRelevance = market.peers.reduce((s, p) => s + p.relevance, 0);
  return (
    <div className="ml-walkthrough">
      <div className="ml-wt-intro">
        <div className="ml-wt-headline">
          <div>
            <p className="ml-wt-eyebrow">Predictive ML · Logistic Regression</p>
            <h3>How the stress probability is built for {market.name}</h3>
          </div>
          <div className="ml-wt-country-prob">
            <span>Country score</span>
            <strong style={{ color: stressColor(market.stressProbability) }}>{percent(market.stressProbability, 0)}</strong>
          </div>
        </div>
        <p className="ml-wt-desc">The model reads 7 price-history features for each listed peer (e.g. past returns and drawdowns) to estimate future stress. <strong>Observed volatility</strong> is the actual historical price swing, while <strong>predicted stress</strong> is the model's computed probability that a peer will experience high volatility over the next 63 trading days. The country score is a relevance-weighted average of these predictions. The tiles below the chart display the global test-set metrics for the entire model, which remain constant across all countries.</p>
      </div>

      <div className="ml-wt-steps">
        <div className="ml-wt-step">
          <div className="ml-wt-step-num">1</div>
          <div className="ml-wt-step-body">
            <strong>7 features per peer are fed into the model</strong>
            <div className="ml-feature-grid">
              {[["Past returns", "21-day, 63-day, 126-day", <TrendingUp size={16} key="ret" strokeWidth={1.5} color="#c4934a" />], ["Past volatility", "21-day, 63-day, 126-day", <Activity size={16} key="vol" strokeWidth={1.5} color="#455f63" />], ["Drawdown", "Distance from 126-day high", <TrendingDown size={16} key="dd" strokeWidth={1.5} color="#aa6259" />]].map(([label, sub, icon]) => (
                <div className="ml-feature-card" key={label as string}><span className="ml-feature-icon">{icon}</span><strong>{label}</strong><small>{sub}</small></div>
              ))}
            </div>
          </div>
        </div>
        <div className="ml-wt-step">
          <div className="ml-wt-step-num">2</div>
          <div className="ml-wt-step-body">
            <strong>Each peer gets a stress probability (0–100%)</strong>
            <p className="ml-wt-step-note">High stress = above {percent(threshold, 1)} annualized volatility. The bar shows how close each peer is to that threshold. Labels map to probabilities: ≥60% High risk, ≥35% Elevated, &lt;35% Low risk.</p>
            <div className="ml-peer-list">
              {sortedPeers.map(peer => (
                <div className="ml-peer-row" key={peer.id}>
                  <div className="ml-peer-meta">
                    <span className="ml-peer-name">{peer.name}</span>
                    <span className="ml-peer-seg">{peer.segment}</span>
                  </div>
                  <div className="ml-peer-bar-wrap">
                    <div className="ml-peer-bar">
                      <div className="ml-peer-fill" style={{ width: `${peer.stressProbability * 100}%`, background: stressColor(peer.stressProbability) }} />
                      <div className="ml-peer-threshold" style={{ left: `${threshold * 100}%` }} />
                    </div>
                  </div>
                  <span className="ml-peer-pct" style={{ color: stressColor(peer.stressProbability) }}>{percent(peer.stressProbability, 0)}</span>
                  <span className="ml-peer-label" style={{ color: stressColor(peer.stressProbability) }}>{stressLabel(peer.stressProbability)}</span>
                </div>
              ))}
            </div>
            <div className="ml-threshold-legend"><div className="ml-threshold-tick" /><span>High-stress threshold ({percent(threshold, 1)})</span></div>
          </div>
        </div>
        <div className="ml-wt-step">
          <div className="ml-wt-step-num">3</div>
          <div className="ml-wt-step-body">
            <strong>Peers are averaged by relevance to get the country score</strong>
            <p className="ml-wt-step-note">Relevance reflects how closely each peer's business model matches the market being assessed. A general retailer gets more weight than an infrastructure provider.</p>
            <div className="ml-avg-visual">
              {sortedPeers.slice(0, 6).map(peer => (
                <div className="ml-avg-chip" key={peer.id} style={{ opacity: 0.4 + (peer.relevance / (totalRelevance || 1)) * 3 }}>
                  <span>{peer.name.split(" ")[0]}</span>
                  <strong style={{ color: stressColor(peer.stressProbability) }}>{percent(peer.stressProbability, 0)}</strong>
                </div>
              ))}
              {sortedPeers.length > 6 && <div className="ml-avg-chip ml-avg-chip-more">+{sortedPeers.length - 6} more</div>}
              <div className="ml-avg-arrow">→</div>
              <div className="ml-avg-result" style={{ borderColor: stressColor(market.stressProbability) }}>
                <span>Country score</span>
                <strong style={{ color: stressColor(market.stressProbability) }}>{percent(market.stressProbability, 0)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="ml-wt-footer">
        <div className="ml-wt-metric"><span>Held-out AUC</span><strong>{data.model.auc.toFixed(3)}</strong><small>vs {data.model.baselineAuc.toFixed(3)} baseline</small></div>
        <div className="ml-wt-metric"><span>Brier score</span><strong>{data.model.brier.toFixed(3)}</strong><small>lower is better</small></div>
        <div className="ml-wt-metric"><span>Training obs.</span><strong>{data.model.trainRows.toLocaleString()}</strong><small>company-month pairs</small></div>
      </div>
    </div>
  );
}

function MarketView({ market, weights, onScenario }: { market: Market; weights: Weights; onScenario: () => void }) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  return <><Heading title={<><CountryFlag code={market.code} />{market.name}</>} description={`Market evidence, operating context and forward peer risk for ${market.name}.`} />
    <div className="market-topline"><button className="weights-trigger" onClick={onScenario}>Change decision weights <ArrowRight size={15} /></button><div className="topline-actions">{/* <button className="evidence-trigger" onClick={() => setEvidenceOpen(true)} aria-label={`Search evidence for ${market.name}`} title="Search evidence"><Search size={16} /></button> */}</div></div>
    <div className="market-workspace"><div className="market-grid">
      <div className="market-column">
        <Widget id="assessment" title={`Assessment in ${market.name}`} info="Country access, peer operating results, price momentum and predicted peer stress." expandedDetail={<AssessmentReport market={market} weights={weights} />} replaceOnExpand className={`assessment-widget country-${market.code.toLowerCase()}`}><Assessment market={market} weights={weights} /></Widget>
        <Widget id="financial" title={`Peer operating trend in ${market.name}`} info="Annual medians use consumer retail and marketplace peers. Companies with different business models are shown separately in peer detail." expandedDetail={<><h3>Peer composition</h3><p>{market.peerGroupCounts["Consumer retail"]} consumer retail companies and {market.peerGroupCounts.Marketplace} marketplaces contribute to the annual medians. Their business models still differ, so the market table should be read alongside company detail.</p><h3>Annual coverage</h3>{market.annualTrend.map(row => <div className="expanded-row" key={row.year}><strong>{row.year}</strong><span>Growth {signedPercent(row.growth)} ({row.growthCount} peers)</span><span>Margin {signedPercent(row.margin)} ({row.marginCount} peers)</span></div>)}</>} className="financial-widget"><FinancialChart market={market} /></Widget>
        <Widget id="drivers" title={`Evidence profile in ${market.name}`} info="Raw country values, percentile ranks and weighted score contributions." expandedDetail={<><h3>How the scores are built</h3><p>Country indicators are ranked across 13 markets. Peer growth and margins are ranked across the 43 listed companies, then averaged with segment relevance weights.</p></>} className="drivers-widget"><DriverPanel market={market} /></Widget>
      </div>
      <div className="market-column">
        <Widget id="trend" title={`Forward peer risk in ${market.name} (Predictive ML)`} info={`Probability of listed peers entering a high-volatility period over the next 63 trading days. High volatility begins above ${(data.model.highStressThreshold * 100).toFixed(1)}% annualized volatility.`} expandedDetail={<MLRiskWalkthrough market={market} />} className="trend-widget"><RiskChart market={market} /></Widget>
        <Widget id="digital" title={`Digital access in ${market.name}`} info="Country-level internet use and financial account ownership." expandedDetail={<><h3>Source years</h3><p>Latest country indicators through 2024.</p>{Object.entries(market.macro).filter(([key]) => ["internet_users_pct", "account_ownership_pct_adult", "gdp_per_capita_usd", "population_total"].includes(key)).map(([key, fact]) => <div className="expanded-row" key={key}><strong>{key.replaceAll("_", " ")}</strong><span>{fact.value.toLocaleString()}</span><span>{fact.year}</span></div>)}</>} className="digital-widget"><DigitalChart market={market} /></Widget>
        <Widget id="robustness" title={`Decision sensitivity in ${market.name}`} info="Decision sensitivity shows whether the assessment changes when market opportunity, peer operations or risk receive more weight. Categories: 'Market watch' (<3 peers), 'Consider further investment' (≥63), 'Maintain and assess' (≥48), or 'Review incremental exposure'." expandedDetail={<><h3>Interpreting sensitivity</h3><p>{new Set(Object.values(SCENARIOS).map(item => decision(market, item.weights))).size === 1 ? "The guidance is unchanged across all four weight sets, so this conclusion is less sensitive to the selected strategic priority." : "The guidance changes across the tested weight sets. Inspect which assumption crosses a decision threshold before treating the result as stable."}</p><p>These scenario weights adjust the combination of the four high-level pillars. The current scenario aggregates opportunity, operations, momentum, and resilience using a <strong>{weights.opportunity}/{weights.operatingHealth}/{weights.momentum}/{weights.resilience}</strong> distribution. (Note: These global pillar weights are separate from the internal 25% equal-weighting baseline used <em>inside</em> the market opportunity pillar).</p></>} className="robustness-widget"><Robustness market={market} /></Widget>
      </div>
      <Widget id="peers" title={`Peer coverage in ${market.name}`} info="Listed company set assigned to this market." expandedDetail={<><h3>Peer groups</h3><p>Consumer retail, marketplace, services and infrastructure companies are shown with their segment, revenue CAGR, operating margin and stress estimate.</p></>} className="peers-widget"><MarketCompositionChart market={market} /><PeerPanel market={market} /></Widget>
    </div></div>
    {/* {evidenceOpen && <><div className="evidence-drawer-scrim" onClick={() => setEvidenceOpen(false)} /><aside className="evidence-drawer" aria-label="Evidence search"><div className="evidence-drawer-head"><div><span>Market evidence</span><h2>{market.name}</h2></div><button className="icon-action" onClick={() => setEvidenceOpen(false)} aria-label="Close evidence search"><X size={17} /></button></div><EvidenceView market={market} compact /></aside></>} */}</>;
}

function ScenarioView({ market, scenario, onScenario, custom, setCustom }: { market: Market; scenario: string; onScenario: (scenario: string) => void; custom: Weights; setCustom: (weights: Weights) => void }) {
  const active = scenario === "custom" ? custom : SCENARIOS[scenario].weights;
  const fields: { key: keyof Weights; label: string; detail: string }[] = [
    { key: "opportunity", label: "Market opportunity", detail: "Internet, banking access, GDP per capita and population" },
    { key: "operatingHealth", label: "Peer operating health", detail: "Revenue growth and operating margin" },
    { key: "momentum", label: "Peer momentum", detail: "Recent adjusted-price return" },
    { key: "resilience", label: "Stress resilience", detail: "Inverse of the predicted stress probability" },
  ];
  const total = Object.values(active).reduce((sum, value) => sum + value, 0);
  return <><Heading eyebrow="Decision assumptions" title="Scenario analysis" description={`See how strategic priorities change the ${market.name} assessment. The underlying data and model prediction remain fixed.`} />
    <div className="scenario-layout"><section className="widget scenario-select"><div className="widget-heading"><div className="widget-title"><h2>Strategic priority</h2><Info label="strategic priority" text="Presets change only the transparent decision weights. They are not macroeconomic forecasts." /></div></div><div className="scenario-options">{Object.entries(SCENARIOS).map(([key, item]) => <button key={key} className={`scenario-option ${scenario === key ? "active" : ""}`} onClick={() => onScenario(key)}><span><strong>{item.name}</strong><small>{item.description}</small></span>{scenario === key ? <Check size={16} /> : <ArrowRight size={15} />}</button>)}<button className={`scenario-option ${scenario === "custom" ? "active" : ""}`} onClick={() => onScenario("custom")}><span><strong>Custom weighting</strong><small>Adjust each factor directly.</small></span>{scenario === "custom" ? <Check size={16} /> : <ArrowRight size={15} />}</button></div></section>
      <section className="widget scenario-weights"><div className="widget-heading"><div className="widget-title"><h2>Decision weights</h2><Info label="decision weights" text="Weights must sum to 100%. The app shows their combined indicator, not an estimated investment return." /></div><span className={`weight-total ${total !== 100 ? "invalid" : ""}`}>{total}% total</span></div><div className="weight-fields">{fields.map(field => <div className="weight-field" key={field.key}><div><strong>{field.label}</strong><small>{field.detail}</small></div><div className="weight-input"><input type="number" min="0" max="100" step="5" aria-label={`${field.label} weight`} disabled={scenario !== "custom"} value={active[field.key]} onChange={event => setCustom({ ...custom, [field.key]: Math.max(0, Math.min(100, Number(event.target.value))) })} /><span>%</span></div></div>)}</div>{total !== 100 && <p className="form-note">Weights are normalized to their entered total for comparison. Set the total to 100% for a clean case assumption.</p>}</section>
      <section className="widget scenario-result"><div className="widget-heading"><div className="widget-title"><h2>{market.name} assessment</h2></div></div><Assessment market={market} weights={active} /><div className="scenario-compare"><div className="small-label">Other weightings</div>{Object.values(SCENARIOS).map(item => <div key={item.name}><span>{item.name}</span><strong>{decision(market, item.weights)}</strong></div>)}</div></section></div></>;
}

type EvidenceResult = { answer: string; mode: string; evidence: { id: string; title: string; source: string; url: string | null; text: string }[] };
function EvidenceView({ market, compact = false }: { market: Market; compact?: boolean }) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<EvidenceResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  async function ask(value = question) {
    if (!value.trim()) return;
    setQuestion(value); setBusy(true); setErrorMessage("");
    try {
      const response = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: value, country: market.code }) });
      if (!response.ok) throw new Error("The evidence service is unavailable. Start the Python API locally, or try the deployed app.");
      setResult(await response.json());
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : "Evidence search failed."); }
    finally { setBusy(false); }
  }
  return <div className={compact ? "evidence-layout compact-evidence" : "evidence-layout"}><section className="widget evidence-search"><div className="widget-heading"><div className="widget-title"><h2>Search evidence</h2><Info label="evidence search" text="Searches the supplied indicators and company records, returning cited excerpts." /></div></div><form onSubmit={event => { event.preventDefault(); ask(); }}><textarea value={question} onChange={event => setQuestion(event.target.value)} maxLength={600} placeholder={`Search evidence for ${market.name}`} aria-label="Question for evidence search" /><button type="submit" disabled={busy || question.trim().length < 4}>{busy ? "Searching…" : "Search sources"}<ArrowRight size={16} /></button></form><div className="suggested-questions"><div className="small-label">Questions to explore</div>{[`How strong is peer operating performance in ${market.name}?`, `What does the stress model predict for ${market.name}?`, `Which companies are included for ${market.name}?`].map(prompt => <button key={prompt} onClick={() => ask(prompt)}>{prompt}<ArrowUpRight size={13} /></button>)}</div></section>
    <section className="widget evidence-output"><div className="widget-heading"><div className="widget-title"><h2>Findings</h2></div>{result && <span className="output-mode">{result.mode === "generated" ? "AI summary" : "Source extracts"}</span>}</div>{errorMessage && <p className="error-message">{errorMessage}</p>}{result ? <><p className="answer-text">{result.answer}</p><div className="evidence-sources"><div className="small-label">Sources reviewed</div>{result.evidence.map((item, index) => <div className="source-item" key={item.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item.title}</strong><small>{item.source}</small>{item.url && <a href={item.url} target="_blank" rel="noreferrer">Open source <ExternalLink size={12} /></a>}</div></div>)}</div></> : <div className="empty-evidence"><FileText size={26} strokeWidth={1.25} /><strong>Answers stay tied to sources.</strong><span>Search the supplied peer and macro evidence. Each result includes the documents used.</span></div>}</section></div>;
}

function ModelView() {
  const model = data.model;
  return <><Heading eyebrow="Model and sources" title="Methodology" description="Definitions, validation, and limits behind the displayed assessment." /><div className="model-layout">
    <div className="model-column">
      <section className="widget model-main"><div className="widget-heading"><div className="widget-title"><h2>Next-quarter stress model</h2><Info label="stress model" text="A regularized logistic regression trained on historical company-month observations. Its outcome is future public equity volatility." /></div></div><p className="model-lead">Estimates the probability that a listed peer’s next 63 trading days exceed the upper quartile of annualized volatility observed in the training period.</p><div className="model-metrics"><Metric label="Held-out AUC" value={model.auc.toFixed(3)} note="2024–2025 observations" info="Area under the ROC curve. A value of 0.5 is chance-level discrimination; this is a historical test, not a guarantee of future performance." /><Metric label="Recent-volatility baseline" value={model.baselineAuc.toFixed(3)} note="Same held-out period" info="The AUC obtained by ranking peers using only their latest 63-day volatility. This is the relevant simple comparator." /><Metric label="Brier score" value={model.brier.toFixed(3)} note="Lower is better" info="Average squared difference between predicted probability and observed high-stress outcome." /></div><div className="model-split"><div><span>Training examples</span><strong>{model.trainRows.toLocaleString()}</strong><small>Through {prettyDate(model.trainEnd)}</small></div><div><span>Test examples</span><strong>{model.testRows.toLocaleString()}</strong><small>{prettyDate(model.testStart)} to {prettyDate(model.testEnd)}</small></div><div><span>High-stress threshold</span><strong>{percent(model.highStressThreshold, 1)}</strong><small>Annualized forward volatility</small></div></div></section>
      <section className="widget model-sources"><div className="widget-heading"><div className="widget-title"><h2>Data provenance</h2></div></div><div className="provenance-list"><div><span>Price history</span><strong>85,763 source rows</strong><small>files used: prices.csv, returns.csv</small></div><div><span>Coverage</span><strong>{data.dataQuality.companyCount} companies · {data.dataQuality.countryCount} countries</strong><small>files used: coverage.json, peer_data.json</small></div><div><span>Snapshot</span><strong>{prettyDate(data.asOf)}</strong><small>files used: snapshot_meta.json</small></div></div></section>
    </div>
    <div className="model-column">
      <section className="widget model-features"><div className="widget-heading"><div className="widget-title"><h2>Inputs</h2></div></div><div className="feature-list"><div><span>01</span><strong>Past returns</strong><small>21, 63 and 126 trading days</small></div><div><span>02</span><strong>Past volatility</strong><small>21, 63 and 126 trading days</small></div><div><span>03</span><strong>Drawdown</strong><small>Distance below the recent 126-day high</small></div></div><p>Annual financials and macro indicators inform the separate assessment. Their historical publication dates are unavailable, so they are excluded from model training.</p></section>
      <section className="widget model-limits"><div className="widget-heading"><div className="widget-title"><h2>Interpretation limits</h2></div></div><ol><li>Peer share prices reflect investor expectations and market sentiment. They do not directly measure Shop-EY demand.</li><li>Nine countries have one assigned peer, so directional country assessments are withheld there.</li><li>Annual financials cover mostly four fiscal years. Their release timestamps are absent from the case files.</li><li>Investment or exit decisions require Shop-EY revenue, unit economics, capital needs and market-specific exposure.</li></ol></section>
    </div>
  </div></>;
}

function MarketSelect({ markets, value, onChange }: { markets: Market[], value: string, onChange: (val: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = markets.find(m => m.code === value) || markets[0];
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="custom-dropdown" ref={ref}>
      <button className="dropdown-trigger" onClick={() => setOpen(!open)} aria-label="Select market">
        {selected.name}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="dropdown-menu">
          {markets.map(m => (
            <button
              key={m.code}
              className={`dropdown-item ${m.code === value ? 'selected' : ''}`}
              onClick={() => { onChange(m.code); setOpen(false); }}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("overview");
  const [marketCode, setMarketCode] = useState("IN");
  const [scenario, setScenario] = useState("balanced");
  const [custom, setCustom] = useState<Weights>({ ...SCENARIOS.balanced.weights });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const market = useMemo(() => data.markets.find(item => item.code === marketCode) || data.markets[0], [marketCode]);
  const weights = scenario === "custom" ? custom : SCENARIOS[scenario].weights;
  function selectMarket(code: string) { setMarketCode(code); setView("market"); window.scrollTo(0, 0); }
  function handleSetWeights(newWeights: Weights) { setCustom(newWeights); setScenario("custom"); }
  return <div className={`app-shell ${sidebarOpen ? "" : "sidebar-closed"}`}><aside className="sidebar"><div className="sidebar-brand"><img src="/bearing.png" alt="Bearing logo" className="brand-logo" width="32" height="32" /><div><strong>Bearing</strong></div><button className="icon-action sidebar-toggle" aria-label="Toggle sidebar" onClick={() => setSidebarOpen(!sidebarOpen)}>{sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}</button></div><div className="sidebar-section-label">Workspace</div><nav aria-label="Main navigation">{navigation.map(item => { const Icon = item.icon; return <button type="button" key={item.id} className={`nav-item ${view === item.id ? "active" : ""}`} onClick={() => setView(item.id)}><Icon size={18} strokeWidth={1.75} /><span>{item.label}</span>{view === item.id && <span className="nav-active-mark" />}</button>; })}</nav></aside>
    <div className="main-area"><header className="topbar"><div className="topbar-left"><span>Shop-EY</span><span className="topbar-slash">/</span><strong>{navigation.find(item => item.id === view)?.label}</strong></div><div className="topbar-right">{view !== "overview" && <MarketSelect markets={data.markets} value={marketCode} onChange={(c) => { setMarketCode(c); window.scrollTo(0,0); }} />}</div></header>
      <main className="content">{view === "overview" && <PortfolioReport markets={data.markets} weights={weights} onSelect={selectMarket} />}{view === "market" && <MarketView key={marketCode} market={market} weights={weights} onScenario={() => setView("scenario")} />}{view === "scenario" && <ScenarioView market={market} scenario={scenario} onScenario={setScenario} custom={custom} setCustom={setCustom} />}{view === "model" && <ModelView />}</main></div>
    <Northstar weights={weights} setWeights={handleSetWeights} />
  </div>;
}
