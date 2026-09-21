"""End-to-end validation of the assembled dataset.

Checks:
  * each expected file exists and is non-empty
  * referential integrity of company_id between tables
  * date / year ranges look sensible
  * no extreme outliers (e.g. negative prices, impossible volumes)
  * primary keys are unique where expected

Exits non-zero if any check fails.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DATA = ROOT / "data"

EXPECTED = [
    "companies.csv", "prices_daily.csv", "financials_annual.csv",
    "macro_indicators.csv", "company_metrics.csv",
    "ecommerce_index.csv", "data_dictionary.csv",
]


def check(label: str, cond: bool, detail: str = "") -> bool:
    status = "PASS" if cond else "FAIL"
    print(f"  [{status}] {label}{(' — ' + detail) if detail else ''}")
    return cond


def main() -> int:
    ok = True
    print("== existence & non-empty ==")
    for f in EXPECTED:
        p = DATA / f
        ok &= check(f"{f} exists & non-empty", p.exists() and p.stat().st_size > 0,
                    detail=f"{p.stat().st_size:,} B" if p.exists() else "missing")

    companies = pd.read_csv(DATA / "companies.csv")
    prices    = pd.read_csv(DATA / "prices_daily.csv")
    fins      = pd.read_csv(DATA / "financials_annual.csv")
    metrics   = pd.read_csv(DATA / "company_metrics.csv")
    macro     = pd.read_csv(DATA / "macro_indicators.csv")
    idx       = pd.read_csv(DATA / "ecommerce_index.csv")

    print("\n== primary key uniqueness ==")
    ok &= check("companies.company_id unique", companies["company_id"].is_unique)
    ok &= check("companies.ticker unique",     companies["ticker"].is_unique)
    ok &= check("prices_daily (company_id, date) unique",
                not prices.duplicated(subset=["company_id", "date"]).any())
    ok &= check("financials (company_id, fiscal_year) unique",
                not fins.duplicated(subset=["company_id", "fiscal_year"]).any())
    ok &= check("macro (country_code, year, indicator_id) unique",
                not macro.duplicated(subset=["country_code", "year", "indicator_id"]).any())
    ok &= check("ecommerce_index.date unique", idx["date"].is_unique)

    print("\n== referential integrity ==")
    cids = set(companies["company_id"])
    ok &= check("prices_daily.company_id ⊆ companies", set(prices["company_id"]).issubset(cids))
    ok &= check("financials.company_id ⊆ companies", set(fins["company_id"]).issubset(cids))
    ok &= check("company_metrics.company_id ⊆ companies", set(metrics["company_id"]).issubset(cids))
    macro_countries = set(macro["country_code"])
    company_countries = set(companies["country_code"])
    overlap = company_countries & macro_countries
    ok &= check(f"macro covers all company countries ({len(overlap)}/{len(company_countries)})",
                company_countries.issubset(macro_countries))

    print("\n== ranges & sanity ==")
    ok &= check("prices.date in [2015, today]",
                (prices["date"].min() >= "2015-01-01") and (prices["date"].max() <= "2030-12-31"),
                detail=f"{prices['date'].min()} → {prices['date'].max()}")
    ok &= check("no negative prices",
                (prices[["open", "high", "low", "close"]].dropna() >= 0).all().all())
    ok &= check("no negative volumes",
                (prices["volume"].dropna() >= 0).all())
    ok &= check("high >= low (where both present)",
                (prices.dropna(subset=["high", "low"])["high"]
                 >= prices.dropna(subset=["high", "low"])["low"]).all())
    ok &= check("ecommerce_index.index_level > 0",
                (idx["index_level"] > 0).all())
    ok &= check("ecommerce_index has at least 5 constituents per row",
                (idx["constituents"] >= 5).all())

    print("\n== completeness ==")
    coverage = prices.groupby("company_id").size()
    ok &= check("every company has ≥ 30 price rows",
                (coverage >= 30).all(),
                detail=f"min={coverage.min()}")
    ok &= check("every company has ≥ 1 financials row",
                set(fins["company_id"]) == cids,
                detail=f"{len(set(fins['company_id']))}/{len(cids)} covered")

    print("\n== summary ==")
    print(f"  companies        : {len(companies):>5,} rows × {len(companies.columns):>2} cols")
    print(f"  prices_daily     : {len(prices):>5,} rows × {len(prices.columns):>2} cols")
    print(f"  financials_annual: {len(fins):>5,} rows × {len(fins.columns):>2} cols")
    print(f"  macro_indicators : {len(macro):>5,} rows × {len(macro.columns):>2} cols")
    print(f"  company_metrics  : {len(metrics):>5,} rows × {len(metrics.columns):>2} cols")
    print(f"  ecommerce_index  : {len(idx):>5,} rows × {len(idx.columns):>2} cols")

    print("\n" + ("OK — all checks passed." if ok else "FAIL — see above."))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
