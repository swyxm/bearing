"""Curate the company universe and enrich it from Wikipedia + Wikidata.

Produces data/companies.csv with one row per company.
"""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

import pandas as pd
import requests

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DATA = ROOT / "data"
DATA.mkdir(parents=True, exist_ok=True)

UA = "kaggle-ecom-dataset/1.0 (research; contact: param.pratap@flipkart.com)"
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": UA, "Accept": "application/json"})


# (company_id, name, ticker, exchange, country_code, region, segment, wikipedia_title)
# Tickers use yfinance conventions: .NS = NSE India, .T = TSE Tokyo, .DE = Xetra,
# .L = LSE, .WA = WSE Warsaw, .JK = IDX Indonesia, .OL = Oslo, .HK = HKEX, .SI = SGX.
# wikidata_qid is resolved at runtime from the Wikipedia page to avoid stale IDs.
COMPANIES: list[tuple] = [
    # --- Global pure-play e-commerce / marketplaces -------------------------------
    ("amazon",        "Amazon.com",                 "AMZN",        "NASDAQ", "US", "North America",       "Marketplace + Cloud",          "Amazon (company)"),
    ("ebay",          "eBay",                       "EBAY",        "NASDAQ", "US", "North America",       "C2C Marketplace",              "EBay"),
    ("etsy",          "Etsy",                       "ETSY",        "NASDAQ", "US", "North America",       "Handmade Marketplace",         "Etsy"),
    ("shopify",       "Shopify",                    "SHOP",        "NYSE",   "CA", "North America",       "E-commerce SaaS",              "Shopify"),
    ("wayfair",       "Wayfair",                    "W",           "NYSE",   "US", "North America",       "Home Goods",                   "Wayfair"),
    ("chewy",         "Chewy",                      "CHWY",        "NYSE",   "US", "North America",       "Pet Supplies",                 "Chewy, Inc."),
    ("carvana",       "Carvana",                    "CVNA",        "NYSE",   "US", "North America",       "Used Cars",                    "Carvana"),
    ("revolve",       "Revolve Group",              "RVLV",        "NYSE",   "US", "North America",       "Fashion",                      "Revolve Group"),
    ("stitchfix",     "Stitch Fix",                 "SFIX",        "NASDAQ", "US", "North America",       "Personal Styling",             "Stitch Fix"),
    ("instacart",     "Maplebear (Instacart)",      "CART",        "NASDAQ", "US", "North America",       "Grocery Delivery",             "Instacart"),
    ("doordash",      "DoorDash",                   "DASH",        "NASDAQ", "US", "North America",       "Food Delivery",                "DoorDash"),

    # --- Greater China ------------------------------------------------------------
    ("alibaba",       "Alibaba Group",              "BABA",        "NYSE",   "CN", "Greater China",       "Marketplace + Cloud",          "Alibaba Group"),
    ("jdcom",         "JD.com",                     "JD",          "NASDAQ", "CN", "Greater China",       "1P + 3P Retail",               "JD.com"),
    ("pinduoduo",     "PDD Holdings (Pinduoduo)",   "PDD",         "NASDAQ", "CN", "Greater China",       "Social Commerce",              "Pinduoduo"),
    ("vipshop",       "Vipshop",                    "VIPS",        "NYSE",   "CN", "Greater China",       "Flash Sales",                  "Vipshop"),

    # --- East / Southeast Asia ----------------------------------------------------
    ("coupang",       "Coupang",                    "CPNG",        "NYSE",   "KR", "Asia Pacific",        "1P Retail",                    "Coupang"),
    ("sea",           "Sea Limited (Shopee)",       "SE",          "NYSE",   "SG", "Asia Pacific",        "Marketplace + Gaming",         "Sea Ltd"),
    ("rakuten",       "Rakuten Group",              "4755.T",      "TSE",    "JP", "Asia Pacific",        "Marketplace + Fintech",        "Rakuten"),
    ("gotogroup",     "GoTo Group",                 "GOTO.JK",     "IDX",    "ID", "Asia Pacific",        "Super-app",                    "GoTo (Indonesian company)"),

    # --- Europe -------------------------------------------------------------------
    ("zalando",       "Zalando",                    "ZAL.DE",      "Xetra",  "DE", "Europe",              "Fashion Marketplace",          "Zalando"),
    ("asos",          "ASOS",                       "ASC.L",       "LSE",    "GB", "Europe",              "Fashion",                      "ASOS (retailer)"),
    ("boohoo",        "Debenhams Group (formerly Boohoo)","DEBS.L","LSE",    "GB", "Europe",              "Fast Fashion",                 "Boohoo.com"),
    ("ao",            "AO World",                   "AO.L",        "LSE",    "GB", "Europe",              "Appliances",                   "AO World"),
    ("autotrader",    "Auto Trader Group",          "AUTO.L",      "LSE",    "GB", "Europe",              "Auto Classifieds",             "Auto Trader Group"),
    ("allegro",       "Allegro.eu",                 "ALE.WA",      "WSE",    "PL", "Europe",              "Marketplace",                  "Allegro (website)"),
    ("ocado",         "Ocado Group",                "OCDO.L",      "LSE",    "GB", "Europe",              "Online Grocery",               "Ocado Group"),

    # --- Latin America ------------------------------------------------------------
    ("mercadolibre",  "MercadoLibre",               "MELI",        "NASDAQ", "AR", "Latin America",       "Marketplace + Fintech",        "Mercado Libre"),

    # --- India --------------------------------------------------------------------
    ("nykaa",         "Nykaa (FSN E-Commerce)",     "NYKAA.NS",    "NSE",    "IN", "India",               "Beauty",                       "Nykaa"),
    ("zomato",        "Eternal (Zomato)",           "ETERNAL.NS",  "NSE",    "IN", "India",               "Food Delivery",                "Zomato"),
    ("paytm",         "One 97 Communications (Paytm)","PAYTM.NS",  "NSE",    "IN", "India",               "Payments + Commerce",          "Paytm"),
    ("policybazaar",  "PB Fintech (Policybazaar)",  "POLICYBZR.NS","NSE",    "IN", "India",               "Insurance Marketplace",        "Policybazaar"),
    ("indiamart",     "IndiaMART InterMESH",        "INDIAMART.NS","NSE",    "IN", "India",               "B2B Marketplace",              "IndiaMART"),
    ("infoedge",      "Info Edge (Naukri)",         "NAUKRI.NS",   "NSE",    "IN", "India",               "Job + Real Estate Classifieds","Info Edge"),
    ("cartrade",      "CarTrade Tech",              "CARTRADE.NS", "NSE",    "IN", "India",               "Auto Classifieds",             "CarTrade.com"),
    ("easetrip",      "Easy Trip Planners",         "EASEMYTRIP.NS","NSE",   "IN", "India",               "Online Travel",                "EaseMyTrip"),
    ("honasa",        "Honasa Consumer (Mamaearth)","HONASA.NS",   "NSE",    "IN", "India",               "D2C Beauty",                   "Mamaearth"),
    ("delhivery",     "Delhivery",                  "DELHIVERY.NS","NSE",    "IN", "India",               "E-commerce Logistics",         "Delhivery"),
    ("ixigo",         "Le Travenues (ixigo)",       "IXIGO.NS",    "NSE",    "IN", "India",               "Online Travel",                "Ixigo"),
    ("firstcry",      "Brainbees (FirstCry)",       "FIRSTCRY.NS", "NSE",    "IN", "India",               "Baby & Kids",                  "FirstCry"),

    # --- Payments / commerce-adjacent fintech ------------------------------------
    ("paypal",        "PayPal Holdings",            "PYPL",        "NASDAQ", "US", "North America",       "Payments",                     "PayPal"),
    ("block",         "Block, Inc.",                "XYZ",         "NYSE",   "US", "North America",       "Payments",                     "Block, Inc."),
    ("affirm",        "Affirm Holdings",            "AFRM",        "NASDAQ", "US", "North America",       "BNPL",                         "Affirm"),
    ("stoneco",       "StoneCo",                    "STNE",        "NASDAQ", "BR", "Latin America",       "Payments",                     "StoneCo"),
]

COLS = ["company_id","name","ticker","exchange","country_code","region","segment","wikipedia_title"]

# Manual overrides for companies where Wikipedia/Wikidata is incomplete or unlinked.
# Field names match the Wikidata fact dict produced below.
MANUAL_OVERRIDES: dict[str, dict] = {
    "revolve":  {"wikidata_qid": "Q66054095",
                 "founded_date": "2003-01-01", "headquarters": "Cerritos, California",
                 "founders": "Michael Mente; Mike Karanikolas",
                 "industry": "Fashion retail", "website": "https://www.revolve.com/"},
    "honasa":   {"wikidata_qid": "Q56411183",
                 "founded_date": "2016-01-01", "headquarters": "Gurgaon, India",
                 "founders": "Varun Alagh; Ghazal Alagh",
                 "industry": "Personal care", "website": "https://honasa.in/"},
    "stoneco":  {"wikidata_qid": "Q105966359",
                 "founded_date": "2014-01-01", "headquarters": "São Paulo, Brazil",
                 "founders": "André Street",
                 "industry": "Financial technology", "website": "https://www.stone.co/"},
}


def wiki_summary(title: str) -> dict:
    """Hit the Wikipedia REST summary endpoint. Returns the canonical title used and the QID."""
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{requests.utils.quote(title, safe='')}"
    r = SESSION.get(url, timeout=15)
    out = {"wiki_extract": None, "wiki_url": None, "wiki_thumbnail": None,
           "wiki_title_canonical": None, "wikidata_qid": None}
    if r.status_code == 200:
        j = r.json()
        out["wiki_extract"] = j.get("extract")
        out["wiki_url"] = (j.get("content_urls") or {}).get("desktop", {}).get("page")
        out["wiki_thumbnail"] = (j.get("thumbnail") or {}).get("source")
        out["wiki_title_canonical"] = j.get("title")
        out["wikidata_qid"] = j.get("wikibase_item")
    return out


def lookup_qid(title: str) -> str | None:
    """Fallback: resolve QID via the MediaWiki action API pageprops."""
    r = SESSION.get(
        "https://en.wikipedia.org/w/api.php",
        params={"action": "query", "prop": "pageprops", "titles": title,
                "redirects": 1, "format": "json"},
        timeout=15,
    )
    if r.status_code != 200:
        return None
    pages = r.json().get("query", {}).get("pages", {})
    for _, p in pages.items():
        qid = (p.get("pageprops") or {}).get("wikibase_item")
        if qid:
            return qid
    return None


def _label(claim_value: dict) -> str | None:
    """Resolve a Wikidata QID to its English label."""
    qid = claim_value.get("id")
    if not qid:
        return None
    url = f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json"
    r = SESSION.get(url, timeout=15)
    if r.status_code != 200:
        return None
    try:
        ent = r.json()["entities"][qid]
        return ent.get("labels", {}).get("en", {}).get("value")
    except (KeyError, ValueError):
        return None


def _extract_date(claim) -> str | None:
    try:
        t = claim["mainsnak"]["datavalue"]["value"]["time"]  # "+1994-07-05T00:00:00Z"
        m = re.search(r"([+\-]\d{4})-(\d{2})-(\d{2})", t)
        if not m:
            return None
        year = int(m.group(1))
        return f"{year:04d}-{m.group(2)}-{m.group(3)}"
    except (KeyError, TypeError, ValueError):
        return None


def _extract_amount(claim) -> float | None:
    try:
        return float(claim["mainsnak"]["datavalue"]["value"]["amount"])
    except (KeyError, TypeError, ValueError):
        return None


def wikidata_facts(qid: str) -> dict:
    """Pull a fixed set of Wikidata facts for a company."""
    facts = {
        "founded_date": None,
        "headquarters": None,
        "founders": None,
        "industry": None,
        "employees": None,
        "employees_year": None,
        "website": None,
    }
    if not qid:
        return facts
    url = f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json"
    r = SESSION.get(url, timeout=20)
    if r.status_code != 200:
        return facts
    try:
        claims = r.json()["entities"][qid]["claims"]
    except (KeyError, ValueError):
        return facts

    # P571 inception
    if "P571" in claims:
        facts["founded_date"] = _extract_date(claims["P571"][0])
    # P159 headquarters location (resolve label)
    if "P159" in claims:
        try:
            facts["headquarters"] = _label(claims["P159"][0]["mainsnak"]["datavalue"]["value"])
        except (KeyError, TypeError):
            pass
    # P112 founders (resolve up to 4)
    if "P112" in claims:
        names = []
        for c in claims["P112"][:4]:
            try:
                names.append(_label(c["mainsnak"]["datavalue"]["value"]))
            except (KeyError, TypeError):
                continue
        names = [n for n in names if n]
        if names:
            facts["founders"] = "; ".join(names)
    # P452 industry (label)
    if "P452" in claims:
        try:
            facts["industry"] = _label(claims["P452"][0]["mainsnak"]["datavalue"]["value"])
        except (KeyError, TypeError):
            pass
    # P1128 number of employees (take most recent qualifier)
    if "P1128" in claims:
        best_amt, best_year = None, -1
        for c in claims["P1128"]:
            amt = _extract_amount(c)
            year = -1
            quals = c.get("qualifiers", {})
            if "P585" in quals:  # point in time
                d = _extract_date({"mainsnak": quals["P585"][0]})
                if d:
                    year = int(d.split("-")[0])
            if amt is not None and year > best_year:
                best_amt, best_year = amt, year
        if best_amt is not None:
            facts["employees"] = int(best_amt)
            facts["employees_year"] = best_year if best_year != -1 else None
    # P856 official website
    if "P856" in claims:
        try:
            facts["website"] = claims["P856"][0]["mainsnak"]["datavalue"]["value"]
        except (KeyError, TypeError):
            pass
    return facts


def main() -> None:
    base = pd.DataFrame(COMPANIES, columns=COLS)
    print(f"Curated {len(base)} companies across {base['country_code'].nunique()} countries.")

    rows = []
    for i, row in base.iterrows():
        wiki = wiki_summary(row["wikipedia_title"])
        qid = wiki.get("wikidata_qid") or lookup_qid(row["wikipedia_title"])
        facts = wikidata_facts(qid) if qid else {
            "founded_date": None, "headquarters": None, "founders": None,
            "industry": None, "employees": None, "employees_year": None, "website": None,
        }
        # Apply manual overrides where Wikipedia/Wikidata is incomplete.
        ov = MANUAL_OVERRIDES.get(row["company_id"], {})
        if ov.get("wikidata_qid") and not qid:
            qid = ov["wikidata_qid"]
        for k in ("founded_date", "headquarters", "founders", "industry", "website",
                  "employees", "employees_year"):
            if not facts.get(k) and ov.get(k):
                facts[k] = ov[k]

        merged = {**row.to_dict(), **wiki, "wikidata_qid": qid, **facts}
        rows.append(merged)
        print(f"  [{i+1:>2}/{len(base)}] {row['name']:<35s} qid={qid} founded={facts.get('founded_date')} hq={facts.get('headquarters')}")
        time.sleep(0.15)  # be polite to Wikimedia

    out = pd.DataFrame(rows)
    # tidy column order
    front = COLS + ["wikidata_qid", "wiki_title_canonical",
                    "founded_date", "headquarters", "founders", "industry",
                    "employees", "employees_year", "website",
                    "wiki_extract", "wiki_url", "wiki_thumbnail"]
    out = out[front]
    path = DATA / "companies.csv"
    out.to_csv(path, index=False)
    print(f"\nWrote {path}  ({len(out)} rows, {len(out.columns)} cols)")


if __name__ == "__main__":
    sys.exit(main())
