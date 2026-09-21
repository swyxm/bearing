"use client";

import { useState } from "react";
import { percent, signedPercent, type Market } from "@/lib/decision";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, CartesianGrid, PieChart, Pie } from 'recharts';

type Point = { label: string; value: number };

function formatMonth(label: string) {
  if (!label.includes("-")) return label;
  const [year, month] = label.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleString('default', { month: 'short' }) + " '" + year.slice(2);
}

// A generic Recharts line chart wrapper
function RechartsLine({ points, unit = "%", forecast = false }: { points: Point[]; unit?: string; forecast?: boolean }) {
  if (points.length < 2) return <p className="chart-empty">Insufficient observations for a trend.</p>;
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="recharts-custom-tooltip" style={{ background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)', border: '1px solid var(--line)', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-secondary)' }}>{formatMonth(label)}</p>
          <p style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700, fontSize: '14px' }}>{payload[0].value.toFixed(1)}{unit}</p>
        </div>
      );
    }
    return null;
  };

  const chartData = points.map((p, i) => {
    if (!forecast) return { ...p, label: formatMonth(p.label) };
    return {
      label: formatMonth(p.label),
      historicalValue: i < points.length - 1 ? p.value : null,
      forecastValue: i >= points.length - 2 ? p.value : null,
      value: p.value
    };
  });

  return (
    <div className="report-chart" style={{ height: '210px', width: '100%', marginTop: '16px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} tickFormatter={(val) => `${val.toFixed(0)}${unit}`} width={40} />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--text-secondary)', strokeWidth: 1, strokeDasharray: '3 3' }} />
          <Line type="monotone" dataKey={forecast ? "historicalValue" : "value"} stroke="var(--accent)" strokeWidth={1.5} dot={{ r: 2.5, fill: 'var(--accent)', strokeWidth: 0 }} activeDot={{ r: 4.5, strokeWidth: 0, fill: 'var(--accent-strong)' }} connectNulls />
          {forecast && (
            <Line type="monotone" dataKey="forecastValue" stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 2.5, fill: 'var(--accent)', strokeWidth: 0 }} activeDot={{ r: 4.5, strokeWidth: 0, fill: 'var(--accent-strong)' }} connectNulls />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RiskChart({ market }: { market: Market }) {
  const [mode, setMode] = useState<"forecast" | "observed">("forecast");
  const history = market.trend.map(point => ({ label: point.month, value: (mode === "forecast" ? point.stressProbability : point.volatility) * 100 }));
  const points = mode === "forecast" ? [...history.slice(0, -1), { label: "Next 63d", value: market.stressProbability * 100 }] : history;
  const previous = market.trend.at(-2)?.stressProbability;
  const delta = previous === undefined ? null : market.stressProbability - previous;
  return <div className="risk-report">
    <div className="chart-switch"><button className={mode === "forecast" ? "active" : ""} onClick={() => setMode("forecast")}>Predicted stress</button><button className={mode === "observed" ? "active" : ""} onClick={() => setMode("observed")}>Observed volatility</button></div>
    <div className="forecast-summary"><div><span>Next 63 trading days</span><strong>{percent(market.stressProbability, 0)}</strong></div><div className={delta !== null && delta < 0 ? "direction-positive" : "direction-negative"}><span>Change from previous month</span><strong>{delta === null ? "—" : `${delta > 0 ? "↑" : delta < 0 ? "↓" : "→"} ${Math.abs(delta * 100).toFixed(1)} points`}</strong></div></div>
    <RechartsLine points={points} forecast={mode === "forecast"} />
  </div>;
}

export function FinancialChart({ market }: { market: Market }) {
  const [metric, setMetric] = useState<"growth" | "margin">("growth");
  const points = market.annualTrend.filter(row => row[metric] !== null).map(row => ({ label: String(row.year), value: (row[metric] || 0) * 100 }));
  const latest = market.annualTrend.at(-1);
  return <div>
    <div className="chart-switch"><button className={metric === "growth" ? "active" : ""} onClick={() => setMetric("growth")}>Revenue growth</button><button className={metric === "margin" ? "active" : ""} onClick={() => setMetric("margin")}>Operating margin</button></div>
    <RechartsLine points={points} />
    <div className="chart-facts"><span>Consumer relevant peers</span><strong>{market.consumerPeerCount} of {market.peerCount}</strong><span>Latest median {metric === "growth" ? "growth" : "margin"}</span><strong>{signedPercent(metric === "growth" ? latest?.growth : latest?.margin)}</strong></div>
  </div>;
}

export function DigitalChart({ market }: { market: Market }) {
  const [metric, setMetric] = useState<"internet_users_pct" | "account_ownership_pct_adult">("internet_users_pct");
  const points = market.macroHistory.filter(row => row[metric] !== undefined).map(row => ({ label: String(row.year), value: row[metric] || 0 }));
  return <div>
    <div className="chart-switch"><button className={metric === "internet_users_pct" ? "active" : ""} onClick={() => setMetric("internet_users_pct")}>Internet use</button><button className={metric === "account_ownership_pct_adult" ? "active" : ""} onClick={() => setMetric("account_ownership_pct_adult")}>Account ownership</button></div>
    <RechartsLine points={points} unit="%" />
  </div>;
}

export function MarketCompositionChart({ market }: { market: Market }) {
  const COLORS = ['#304a4e', '#607477', '#a1afae'];
  const data = [
    { name: "Retail", value: market.peerGroupCounts["Consumer retail"] || 0 },
    { name: "Marketplace", value: market.peerGroupCounts["Marketplace"] || 0 },
    { name: "Services", value: market.peerGroupCounts["Services & infrastructure"] || 0 }
  ].filter(d => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);

  const renderCustomLabel = ({ cx, cy, midAngle, outerRadius, name, value }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 24;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central"
        style={{ fontSize: 11, fontWeight: 600, fill: '#435256', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif' }}>
        {name} ({value})
      </text>
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid var(--line)', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{payload[0].payload.name}</p>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '14px' }}>{payload[0].value} of {total} peers</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '8px' }}>
      <div style={{ width: '100%', height: '280px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%"
              innerRadius={68} outerRadius={110} paddingAngle={2}
              labelLine={true} label={renderCustomLabel}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '4px' }}>
        {data.map((entry, index) => (
          <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#697679' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: COLORS[index % COLORS.length], flexShrink: 0 }} />
            <span style={{ fontWeight: 600 }}>{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
