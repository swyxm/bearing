"""Build derived tables on top of the raw extracts.

Outputs:
  - data/company_metrics.csv  (per-company derived features: CAGR, volatility, etc.)
  - data/ecommerce_index.csv  (daily equal-weighted price index across the universe)
  - data/data_dictionary.csv  (one row per (table, column) describing every field)
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DATA = ROOT / "data"


def build_company_metrics(prices: pd.DataFrame, financials: pd.DataFrame, companies: pd.DataFrame) -> pd.DataFrame:
    prices = prices.copy()
    prices["date"] = pd.to_datetime(prices["date"])

    rows = []
    for cid, grp in prices.groupby("company_id"):
        grp = grp.sort_values("date").reset_index(drop=True)
        if len(grp) < 30:
            continue
        first = grp.iloc[0]
        last  = grp.iloc[-1]
        first_close, last_close = float(first["adj_close"]), float(last["adj_close"])
        days = (last["date"] - first["date"]).days
        years = max(days / 365.25, 1e-6)

        log_ret = np.log(grp["adj_close"]).diff()
        ann_vol = float(log_ret.std() * np.sqrt(252)) if log_ret.std() == log_ret.std() else np.nan

        # max drawdown
        cummax = grp["adj_close"].cummax()
        dd = grp["adj_close"] / cummax - 1.0
        max_dd = float(dd.min()) if not dd.empty else np.nan

        # all-time high & date
        ath_idx = grp["adj_close"].idxmax()
        ath_value = float(grp.loc[ath_idx, "adj_close"])
        ath_date = grp.loc[ath_idx, "date"].strftime("%Y-%m-%d")

        # 1y return (last 252 trading days)
        if len(grp) >= 252:
            r_1y = float(grp.iloc[-1]["adj_close"] / grp.iloc[-252]["adj_close"] - 1)
        else:
            r_1y = np.nan

        # 90d momentum
        if len(grp) >= 90:
            r_90 = float(grp.iloc[-1]["adj_close"] / grp.iloc[-90]["adj_close"] - 1)
        else:
            r_90 = np.nan

        # cumulative return + CAGR
        cum = last_close / first_close - 1
        cagr = (last_close / first_close) ** (1 / years) - 1 if years > 0 else np.nan

        rows.append({
            "company_id": cid,
            "ticker": grp.iloc[0]["ticker"],
            "history_start": first["date"].strftime("%Y-%m-%d"),
            "history_end":   last["date"].strftime("%Y-%m-%d"),
            "trading_days": int(len(grp)),
            "first_close": first_close,
            "last_close": last_close,
            "cumulative_return": cum,
            "cagr": cagr,
            "annualized_volatility": ann_vol,
            "max_drawdown": max_dd,
            "all_time_high": ath_value,
            "all_time_high_date": ath_date,
            "return_90d": r_90,
            "return_1y": r_1y,
        })
    metrics = pd.DataFrame(rows)

    # latest-fiscal-year fundamentals
    if not financials.empty:
        latest = (financials.dropna(subset=["fiscal_year"])
                  .sort_values(["company_id", "fiscal_year"])
                  .groupby("company_id").tail(1)
                  .rename(columns={"fiscal_year": "latest_fiscal_year"}))
        keep = ["company_id", "latest_fiscal_year", "total_revenue", "net_income",
                "operating_income", "total_assets", "free_cash_flow"]
        latest = latest[keep]
        # derived margins
        latest["net_margin"] = latest["net_income"] / latest["total_revenue"]
        latest["operating_margin"] = latest["operating_income"] / latest["total_revenue"]
        metrics = metrics.merge(latest, on="company_id", how="left")

    # revenue CAGR over the available fiscal-year window
    if not financials.empty:
        rev = (financials.dropna(subset=["total_revenue"])
               .sort_values(["company_id", "fiscal_year"]))
        cagr_rows = []
        for cid, g in rev.groupby("company_id"):
            if len(g) < 2:
                continue
            first_y, last_y = g.iloc[0], g.iloc[-1]
            years = last_y["fiscal_year"] - first_y["fiscal_year"]
            if years <= 0 or first_y["total_revenue"] <= 0:
                continue
            rcg = (last_y["total_revenue"] / first_y["total_revenue"]) ** (1 / years) - 1
            cagr_rows.append({"company_id": cid, "revenue_cagr": rcg, "revenue_cagr_years": int(years)})
        if cagr_rows:
            metrics = metrics.merge(pd.DataFrame(cagr_rows), on="company_id", how="left")

    # bolt on country/region for convenience
    metrics = metrics.merge(
        companies[["company_id", "country_code", "region", "segment"]],
        on="company_id", how="left",
    )
    front = ["company_id", "ticker", "country_code", "region", "segment"]
    rest = [c for c in metrics.columns if c not in front]
    return metrics[front + rest]


def build_index(prices: pd.DataFrame) -> pd.DataFrame:
    """Equal-weighted daily index across all tickers that have a price on a given date."""
    p = prices.copy()
    p["date"] = pd.to_datetime(p["date"])
    p["log_ret"] = (
        p.sort_values(["company_id", "date"])
         .groupby("company_id")["adj_close"]
         .transform(lambda s: np.log(s).diff())
    )
    daily = (p.dropna(subset=["log_ret"])
              .groupby("date")
              .agg(constituents=("company_id", "nunique"),
                   mean_log_ret=("log_ret", "mean"))
              .reset_index())
    # smoothing edge case: require at least 5 constituents to publish a value
    daily = daily[daily["constituents"] >= 5].reset_index(drop=True)
    daily["index_level"] = 100.0 * np.exp(daily["mean_log_ret"].cumsum())
    daily["daily_return"] = daily["index_level"].pct_change()
    daily["date"] = daily["date"].dt.strftime("%Y-%m-%d")
    return daily[["date", "constituents", "daily_return", "index_level"]]


# ---------- Data dictionary -----------------------------------------------------
DICTIONARY: list[tuple] = [
    # companies.csv
    ("companies",   "company_id",        "string", "Stable short identifier (kebab-case)."),
    ("companies",   "name",              "string", "Company display name."),
    ("companies",   "ticker",            "string", "Stock ticker symbol as used by yfinance / Yahoo Finance."),
    ("companies",   "exchange",          "string", "Listing exchange (NYSE, NASDAQ, NSE, LSE, etc.)."),
    ("companies",   "reporting_currency","string", "ISO 4217 currency in which prices and financials are reported."),
    ("companies",   "country_code",      "string", "ISO 3166-1 alpha-2 country code of primary operations."),
    ("companies",   "region",            "string", "Geographic region grouping used in this dataset."),
    ("companies",   "segment",           "string", "Business-line segment label (e.g., Marketplace, Fashion, Payments)."),
    ("companies",   "wikipedia_title",   "string", "Wikipedia page title used to fetch metadata."),
    ("companies",   "wikidata_qid",      "string", "Wikidata QID (link via https://www.wikidata.org/wiki/<qid>)."),
    ("companies",   "wiki_title_canonical","string","Canonical Wikipedia title after redirect resolution."),
    ("companies",   "founded_date",      "string", "Inception date (YYYY-MM-DD; partial dates use 00 for unknown month/day)."),
    ("companies",   "headquarters",      "string", "Headquarters city / locality (Wikidata P159 label)."),
    ("companies",   "founders",          "string", "Founders, semicolon-separated."),
    ("companies",   "industry",          "string", "Primary industry label (Wikidata P452)."),
    ("companies",   "employees",         "int",    "Most recent reported employee headcount (Wikidata P1128)."),
    ("companies",   "employees_year",    "int",    "Year of the employee headcount."),
    ("companies",   "website",           "string", "Official website URL."),
    ("companies",   "wiki_extract",      "string", "Short text summary from Wikipedia REST API."),
    ("companies",   "wiki_url",          "string", "Canonical Wikipedia URL."),
    ("companies",   "wiki_thumbnail",    "string", "Thumbnail image URL (logo / lead image)."),

    # prices_daily.csv
    ("prices_daily","company_id",        "string", "Foreign key to companies.company_id."),
    ("prices_daily","ticker",            "string", "Stock ticker (denormalized for convenience)."),
    ("prices_daily","date",              "date",   "Trading day in YYYY-MM-DD (exchange-local)."),
    ("prices_daily","open",              "float",  "Opening price in the listing currency."),
    ("prices_daily","high",              "float",  "Intraday high."),
    ("prices_daily","low",               "float",  "Intraday low."),
    ("prices_daily","close",             "float",  "Closing price (unadjusted)."),
    ("prices_daily","adj_close",         "float",  "Split/dividend-adjusted close (use this for returns)."),
    ("prices_daily","volume",            "int",    "Daily share volume."),

    # financials_annual.csv
    ("financials_annual","company_id",          "string", "Foreign key to companies.company_id."),
    ("financials_annual","ticker",              "string", "Stock ticker."),
    ("financials_annual","fiscal_year",         "int",    "Fiscal year (calendar year of fiscal-year end)."),
    ("financials_annual","total_revenue",       "float",  "Total revenue / net sales, reporting currency."),
    ("financials_annual","gross_profit",        "float",  "Gross profit."),
    ("financials_annual","operating_income",    "float",  "Operating income / EBIT."),
    ("financials_annual","net_income",          "float",  "Net income attributable to common shareholders."),
    ("financials_annual","ebitda",              "float",  "EBITDA (normalized where provided)."),
    ("financials_annual","research_dev",        "float",  "R&D expense (null when not separately disclosed)."),
    ("financials_annual","total_assets",        "float",  "Total assets."),
    ("financials_annual","total_liabilities",   "float",  "Total liabilities (net of minority interest where applicable)."),
    ("financials_annual","cash_and_equivalents","float",  "Cash & equivalents (may include short-term investments)."),
    ("financials_annual","total_equity",        "float",  "Stockholders' equity."),
    ("financials_annual","operating_cash_flow", "float",  "Cash from operating activities."),
    ("financials_annual","capex",               "float",  "Capital expenditure (typically reported as negative)."),
    ("financials_annual","free_cash_flow",      "float",  "Free cash flow."),

    # macro_indicators.csv
    ("macro_indicators","country_code",  "string", "ISO 3166-1 alpha-2 country code."),
    ("macro_indicators","year",          "int",    "Calendar year."),
    ("macro_indicators","indicator_id",  "string", "World Bank indicator code."),
    ("macro_indicators","indicator_name","string", "Friendly indicator name used in this dataset."),
    ("macro_indicators","value",         "float",  "Observed value (units depend on indicator)."),

    # company_metrics.csv
    ("company_metrics","company_id",                "string", "Foreign key."),
    ("company_metrics","ticker",                    "string", "Stock ticker."),
    ("company_metrics","country_code",              "string", "ISO country code."),
    ("company_metrics","region",                    "string", "Region grouping."),
    ("company_metrics","segment",                   "string", "Business segment."),
    ("company_metrics","history_start",             "date",   "First trading day in this dataset."),
    ("company_metrics","history_end",               "date",   "Last trading day in this dataset."),
    ("company_metrics","trading_days",              "int",    "Number of trading-day observations."),
    ("company_metrics","first_close",               "float",  "Adjusted close on history_start."),
    ("company_metrics","last_close",                "float",  "Adjusted close on history_end."),
    ("company_metrics","cumulative_return",         "float",  "(last_close / first_close) - 1."),
    ("company_metrics","cagr",                      "float",  "Compound annual growth rate of adjusted price."),
    ("company_metrics","annualized_volatility",     "float",  "Stdev of daily log returns × √252."),
    ("company_metrics","max_drawdown",              "float",  "Largest peak-to-trough drop in adjusted price."),
    ("company_metrics","all_time_high",             "float",  "Highest adjusted close observed."),
    ("company_metrics","all_time_high_date",        "date",   "Date of all-time high."),
    ("company_metrics","return_90d",                "float",  "Return over the last 90 trading days."),
    ("company_metrics","return_1y",                 "float",  "Return over the last 252 trading days."),
    ("company_metrics","latest_fiscal_year",        "int",    "Most recent fiscal year with reported financials."),
    ("company_metrics","total_revenue",             "float",  "Revenue in latest fiscal year."),
    ("company_metrics","net_income",                "float",  "Net income in latest fiscal year."),
    ("company_metrics","operating_income",          "float",  "Operating income in latest fiscal year."),
    ("company_metrics","total_assets",              "float",  "Total assets in latest fiscal year."),
    ("company_metrics","free_cash_flow",            "float",  "Free cash flow in latest fiscal year."),
    ("company_metrics","net_margin",                "float",  "net_income / total_revenue."),
    ("company_metrics","operating_margin",          "float",  "operating_income / total_revenue."),
    ("company_metrics","revenue_cagr",              "float",  "Revenue CAGR across available fiscal years."),
    ("company_metrics","revenue_cagr_years",        "int",    "Window length (years) used for revenue_cagr."),

    # ecommerce_index.csv
    ("ecommerce_index","date",          "date",   "Trading day."),
    ("ecommerce_index","constituents",  "int",    "Number of tickers contributing on that day."),
    ("ecommerce_index","daily_return",  "float",  "Daily simple return of the index."),
    ("ecommerce_index","index_level",   "float",  "Equal-weighted index level, rebased to 100 at start."),
]


# Mapping from exchange listing to the reporting / price currency.
# Most NSE-listed Indian firms report in INR, US-listed in USD, etc.
EXCHANGE_CURRENCY = {
    "NASDAQ": "USD", "NYSE": "USD",
    "NSE": "INR",
    "TSE": "JPY",
    "LSE": "GBP",
    "Xetra": "EUR",
    "WSE": "PLN",
    "IDX": "IDR",
}


def amend_companies(companies: pd.DataFrame) -> pd.DataFrame:
    """Add a reporting_currency column derived from the listing exchange."""
    companies = companies.copy()
    companies["reporting_currency"] = companies["exchange"].map(EXCHANGE_CURRENCY).fillna("USD")
    # Reorder so currency sits next to exchange
    cols = list(companies.columns)
    cols.remove("reporting_currency")
    idx = cols.index("exchange") + 1
    cols.insert(idx, "reporting_currency")
    return companies[cols]


def main() -> int:
    companies   = pd.read_csv(DATA / "companies.csv")
    companies = amend_companies(companies)
    companies.to_csv(DATA / "companies.csv", index=False)
    print(f"Amended companies.csv with reporting_currency ({companies.shape})")
    prices      = pd.read_csv(DATA / "prices_daily.csv")
    financials  = pd.read_csv(DATA / "financials_annual.csv")

    print("Building company_metrics …")
    metrics = build_company_metrics(prices, financials, companies)
    metrics.to_csv(DATA / "company_metrics.csv", index=False)
    print(f"  wrote company_metrics.csv ({len(metrics)} rows, {len(metrics.columns)} cols)")

    print("Building ecommerce_index …")
    idx = build_index(prices)
    idx.to_csv(DATA / "ecommerce_index.csv", index=False)
    print(f"  wrote ecommerce_index.csv ({len(idx)} rows)")

    print("Writing data_dictionary …")
    dd = pd.DataFrame(DICTIONARY, columns=["table", "column", "dtype", "description"])
    dd.to_csv(DATA / "data_dictionary.csv", index=False)
    print(f"  wrote data_dictionary.csv ({len(dd)} rows)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
