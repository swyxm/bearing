"""Fetch annual financials per ticker via yfinance.

Pulls: total revenue, gross profit, operating income, net income, total assets,
total liabilities, cash & equivalents, free cash flow, employees (point-in-time).
Produces data/financials_annual.csv (long format: one row per company-fiscal_year).
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DATA = ROOT / "data"

# yfinance uses different label spellings across versions; we accept any matching key.
INCOME_KEYS = {
    "total_revenue":      ["Total Revenue", "TotalRevenue"],
    "gross_profit":       ["Gross Profit", "GrossProfit"],
    "operating_income":   ["Operating Income", "OperatingIncome"],
    "net_income":         ["Net Income", "NetIncome",
                           "Net Income Common Stockholders", "NetIncomeCommonStockholders"],
    "ebitda":             ["EBITDA", "Normalized EBITDA"],
    "research_dev":       ["Research And Development", "ResearchAndDevelopment"],
}
BALANCE_KEYS = {
    "total_assets":       ["Total Assets", "TotalAssets"],
    "total_liabilities":  ["Total Liabilities Net Minority Interest",
                           "TotalLiabilitiesNetMinorityInterest",
                           "Total Liab", "TotalLiab"],
    "cash_and_equivalents":["Cash And Cash Equivalents", "CashAndCashEquivalents",
                            "Cash Cash Equivalents And Short Term Investments"],
    "total_equity":       ["Stockholders Equity", "StockholdersEquity",
                           "Total Stockholder Equity"],
}
CASHFLOW_KEYS = {
    "operating_cash_flow":["Operating Cash Flow", "OperatingCashFlow",
                           "Cash Flow From Continuing Operating Activities"],
    "capex":              ["Capital Expenditure", "CapitalExpenditure",
                           "Capital Expenditures"],
    "free_cash_flow":     ["Free Cash Flow", "FreeCashFlow"],
}


def _pick(df: pd.DataFrame, candidates: list[str]) -> pd.Series | None:
    """Return the first matching row from a yfinance financials DataFrame."""
    if df is None or df.empty:
        return None
    for c in candidates:
        if c in df.index:
            return df.loc[c]
    return None


def _to_year_dict(series: pd.Series | None) -> dict[int, float]:
    if series is None:
        return {}
    out = {}
    for col, val in series.items():
        if pd.isna(val):
            continue
        try:
            yr = int(pd.Timestamp(col).year)
        except (ValueError, TypeError):
            continue
        out[yr] = float(val)
    return out


def fetch_one(ticker: str) -> pd.DataFrame:
    """Return a wide DataFrame indexed by fiscal_year for one ticker."""
    try:
        tk = yf.Ticker(ticker)
        inc = tk.financials              # annual income statement
        bal = tk.balance_sheet           # annual balance sheet
        cf  = tk.cashflow                # annual cash flow
    except Exception as e:  # noqa: BLE001
        print(f"  ! {ticker}: {e}")
        return pd.DataFrame()

    series: dict[str, dict[int, float]] = {}
    for k, cands in INCOME_KEYS.items():
        series[k] = _to_year_dict(_pick(inc, cands))
    for k, cands in BALANCE_KEYS.items():
        series[k] = _to_year_dict(_pick(bal, cands))
    for k, cands in CASHFLOW_KEYS.items():
        series[k] = _to_year_dict(_pick(cf, cands))

    years = sorted({y for d in series.values() for y in d.keys()})
    if not years:
        return pd.DataFrame()
    rows = []
    for y in years:
        rows.append({"fiscal_year": y, **{k: d.get(y, np.nan) for k, d in series.items()}})
    return pd.DataFrame(rows)


def main() -> int:
    companies = pd.read_csv(DATA / "companies.csv")
    frames = []
    fails = []
    for i, row in companies.iterrows():
        cid, ticker = row["company_id"], row["ticker"]
        print(f"  [{i+1:>2}/{len(companies)}] {ticker:<14s} {cid}")
        df = fetch_one(ticker)
        if df.empty:
            fails.append((cid, ticker))
            continue
        df.insert(0, "ticker", ticker)
        df.insert(0, "company_id", cid)
        frames.append(df)
        time.sleep(0.4)

    if not frames:
        print("ERROR: no data fetched")
        return 1
    full = pd.concat(frames, ignore_index=True)
    full = full.sort_values(["company_id", "fiscal_year"]).reset_index(drop=True)
    path = DATA / "financials_annual.csv"
    full.to_csv(path, index=False)
    print(f"\nWrote {path}  ({len(full):,} rows, {full['company_id'].nunique()} companies, "
          f"years {int(full['fiscal_year'].min())}–{int(full['fiscal_year'].max())})")
    if fails:
        print(f"Failed: {fails}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
