"""Pull country-level macro indicators relevant to e-commerce from the World Bank API.

Produces data/macro_indicators.csv (long format: country-year-indicator).
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

import pandas as pd
import requests

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DATA = ROOT / "data"

UA = "kaggle-ecom-dataset/1.0 (research; contact: param.pratap@flipkart.com)"
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": UA, "Accept": "application/json"})

# Country codes that appear in our companies universe.
COUNTRIES = ["US", "CA", "CN", "KR", "SG", "JP", "ID", "DE", "GB", "PL", "AR", "IN", "BR"]

# (indicator_id, friendly_name) — relevant to digital commerce.
INDICATORS = [
    ("IT.NET.USER.ZS",        "internet_users_pct"),         # Individuals using the Internet (% of pop)
    ("IT.CEL.SETS.P2",        "mobile_subs_per_100"),         # Mobile cellular subscriptions per 100
    ("NY.GDP.PCAP.CD",        "gdp_per_capita_usd"),          # GDP per capita (current US$)
    ("NY.GDP.MKTP.CD",        "gdp_total_usd"),               # GDP, current US$
    ("SP.POP.TOTL",           "population_total"),            # Total population
    ("SP.URB.TOTL.IN.ZS",     "urban_population_pct"),        # Urban population (% of total)
    ("FX.OWN.TOTL.ZS",        "account_ownership_pct_adult"), # Account ownership at a financial institution
    ("BX.KLT.DINV.WD.GD.ZS",  "fdi_inflow_pct_gdp"),          # FDI net inflows (% of GDP)
]
START_YEAR, END_YEAR = 2010, 2025


def fetch(country: str, indicator: str, retries: int = 3) -> list[dict]:
    """Hit WB API once for one (country, indicator). Retry on transient errors."""
    url = f"https://api.worldbank.org/v2/country/{country}/indicator/{indicator}"
    params = {"format": "json", "date": f"{START_YEAR}:{END_YEAR}", "per_page": 1000}
    for attempt in range(retries):
        try:
            r = SESSION.get(url, params=params, timeout=60)
        except requests.RequestException as e:
            print(f"  retry {attempt+1}/{retries} {country} {indicator}: {e}")
            time.sleep(1.5 * (attempt + 1))
            continue
        if r.status_code != 200:
            return []
        j = r.json()
        if not isinstance(j, list) or len(j) < 2 or j[1] is None:
            return []
        return j[1]
    return []


def main() -> int:
    rows = []
    for country in COUNTRIES:
        for indicator, friendly in INDICATORS:
            data = fetch(country, indicator)
            for item in data:
                value = item.get("value")
                if value is None:
                    continue
                rows.append({
                    "country_code": country,
                    "year": int(item["date"]),
                    "indicator_id": indicator,
                    "indicator_name": friendly,
                    "value": float(value),
                })
            time.sleep(0.05)
        print(f"  {country}: pulled {sum(1 for r in rows if r['country_code']==country)} obs")

    df = pd.DataFrame(rows).sort_values(["country_code", "indicator_name", "year"]).reset_index(drop=True)
    path = DATA / "macro_indicators.csv"
    df.to_csv(path, index=False)
    print(f"\nWrote {path}  ({len(df):,} rows, {df['country_code'].nunique()} countries, "
          f"{df['indicator_name'].nunique()} indicators)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
