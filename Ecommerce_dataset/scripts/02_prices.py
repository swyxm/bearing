"""Fetch daily OHLCV history for each company via yfinance.

Produces data/prices_daily.csv (long format: one row per company-date).
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

import pandas as pd
import yfinance as yf

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DATA = ROOT / "data"

START = "2015-01-01"
END = None  # today (yfinance default)

OUT_COLS = ["company_id", "ticker", "date", "open", "high", "low", "close", "adj_close", "volume"]


def fetch_one(ticker: str) -> pd.DataFrame:
    """Return a tidy DataFrame indexed by date for a single ticker, or empty on failure."""
    try:
        # auto_adjust=False so we keep both raw close and adjusted close separately
        df = yf.download(
            ticker, start=START, end=END,
            interval="1d", auto_adjust=False, progress=False, threads=False,
        )
    except Exception as e:  # noqa: BLE001
        print(f"  ! {ticker}: {e}")
        return pd.DataFrame()
    if df is None or df.empty:
        return pd.DataFrame()
    # yfinance returns MultiIndex columns when len(tickers)>1 or sometimes single-ticker too.
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df = df.rename(columns={
        "Open": "open", "High": "high", "Low": "low",
        "Close": "close", "Adj Close": "adj_close", "Volume": "volume",
    })
    df.index.name = "date"
    df = df.reset_index()
    return df


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
        time.sleep(0.4)  # be polite

    if not frames:
        print("ERROR: no data fetched")
        return 1

    full = pd.concat(frames, ignore_index=True)
    # ensure all required columns exist (some tickers may be missing adj_close)
    for c in OUT_COLS:
        if c not in full.columns:
            full[c] = pd.NA
    full = full[OUT_COLS]
    full["date"] = pd.to_datetime(full["date"]).dt.strftime("%Y-%m-%d")
    full = full.sort_values(["company_id", "date"]).reset_index(drop=True)

    path = DATA / "prices_daily.csv"
    full.to_csv(path, index=False)
    print(f"\nWrote {path}  ({len(full):,} rows, {full['company_id'].nunique()} companies)")
    if fails:
        print(f"Failed: {fails}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
