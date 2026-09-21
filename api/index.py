"""Bearing API. Runs as a Vercel Python Function or a local HTTP server."""

from __future__ import annotations

import json
import csv
import io
import math
import os
import re
from functools import lru_cache
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib import error, request

import joblib
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "generated" / "snapshot.json"
MODEL = ROOT / "models" / "stress.joblib"
TOKENS = re.compile(r"[a-z0-9]+")
STOP = {"a", "an", "and", "are", "as", "at", "be", "by", "do", "for", "from", "how", "in", "is", "it", "of", "on", "or", "the", "to", "what", "which", "why", "with"}


@lru_cache(maxsize=1)
def snapshot():
    return json.loads(SNAPSHOT.read_text())


@lru_cache(maxsize=1)
def artifact():
    return joblib.load(MODEL)


def docs():
    data = snapshot()
    items = []
    for market in data["markets"]:
        name = market["name"]
        code = market["code"]
        history = {row["year"]: row for row in market.get("macroHistory", [])}
        earlier_access = history.get(2015, {}).get("internet_users_pct")
        recent_access = history.get(2024, {}).get("internet_users_pct")
        if earlier_access is not None and recent_access is not None:
            change = recent_access - earlier_access
            items.append({
                "id": f"digital-change-{code}",
                "country": code,
                "title": f"{name} internet adoption 2015 to 2024",
                "source": "Calculation from client-provided macro_indicators.csv, internet_users_pct, 2015 and 2024",
                "url": None,
                "text": f"Internet use in {name} changed from {earlier_access:.1f}% in 2015 to {recent_access:.1f}% in 2024, a change of {change:+.1f} percentage points. This measures country access, not Shop-EY customer growth.",
            })
        items.append({
            "id": f"market-{code}",
            "country": code,
            "title": f"{name} market evidence",
            "source": "Client-provided companies, financials and prices",
            "url": None,
            "text": (
                f"{name} has {market['peerCount']} listed peers in the supplied universe. "
                f"Median peer revenue CAGR is {market['medianRevenueGrowth'] * 100:.1f}% across available fiscal years. "
                f"Median operating margin is {market['medianOperatingMargin'] * 100:.1f}%. "
                f"Current market readiness scores {market['opportunity'] * 100:.1f}/100 from country internet use, account ownership, GDP per capita and population ranks. "
                f"Peer operating health scores {market['operatingHealth'] * 100:.1f}/100 from company revenue-growth and operating-margin ranks. "
                f"The model estimates {market['stressProbability'] * 100:.1f}% high-volatility probability over the next 63 trading days. "
                f"Peer coverage is {market['coverage'].lower()}. These are public peer signals, not Shop-EY sales or margins."
            ),
        })
        for peer in market["peers"]:
            items.append({
                "id": f"peer-{peer['id']}",
                "country": code,
                "title": f"{peer['name']} ({peer['ticker']}) peer record",
                "source": f"Client-provided companies, annual financials and adjusted prices; fiscal {peer['fiscalYear']}",
                "url": None,
                "text": (
                    f"{peer['name']} is classified as {peer['peerGroup']} in {name}; supplied segment: {peer['segment']}. "
                    f"Revenue CAGR through fiscal {peer['fiscalYear']} is {peer['revenueGrowth'] * 100:.1f}% when available. " if peer['revenueGrowth'] is not None else f"{peer['name']} has no calculable revenue CAGR. "
                ) + (
                    f"Operating margin is {peer['operatingMargin'] * 100:.1f}% when available. " if peer['operatingMargin'] is not None else "Operating margin is unavailable. "
                ) + f"The 63-trading-day forward high-volatility estimate is {peer['stressProbability'] * 100:.1f}%. The peer is assigned one primary country, not its complete geographic revenue footprint.",
            })
        for year in market.get("annualTrend", []):
            if year["growth"] is None and year["margin"] is None:
                continue
            growth = f"{year['growth'] * 100:.1f}% from {year['growthCount']} peers" if year["growth"] is not None else "unavailable"
            margin = f"{year['margin'] * 100:.1f}% from {year['marginCount']} peers" if year["margin"] is not None else "unavailable"
            items.append({
                "id": f"financial-{code}-{year['year']}", "country": code,
                "title": f"{name} consumer peer operating trend {year['year']}",
                "source": f"Client-provided annual financials, fiscal {year['year']}", "url": None,
                "text": f"In {name}, fiscal {year['year']} median year-over-year revenue growth among consumer retail and marketplace peers was {growth}; median operating margin was {margin}. Services and infrastructure peers are excluded from these medians.",
            })
        for indicator, fact in market["macro"].items():
            if indicator not in {"internet_users_pct", "account_ownership_pct_adult", "gdp_per_capita_usd", "population_total", "urban_population_pct"}:
                continue
            items.append({
                "id": f"macro-{code}-{indicator}",
                "country": code,
                "title": f"{name}: {indicator.replace('_', ' ')}",
                "source": f"World Bank indicator in client macro data ({fact['year']})",
                "url": None,
                "text": f"For {name}, {indicator.replace('_', ' ')} was {fact['value']:,.1f} in {fact['year']}. This annual observation describes country context, not Shop-EY performance.",
            })
    items.append({
        "id": "method-stress",
        "country": None,
        "title": "Predictive model methodology",
        "source": "Bearing model card",
        "url": None,
        "text": "The stress model uses trailing 21, 63 and 126 trading day price return and volatility, plus 126 day drawdown, to estimate whether a peer's next 63 trading day annualized volatility exceeds the training-period upper quartile. It predicts public equity volatility, not Shop-EY sales, profit or country revenue.",
    })
    items.append({
        "id": "method-score",
        "country": None,
        "title": "Decision indicator calculation",
        "source": "Bearing methodology",
        "url": None,
        "text": "Current market readiness combines percentile ranks across 13 countries using equal 25% weighting for internet use, account ownership, GDP per capita, and log population. It measures present access and purchasing capacity, not growth potential. Peer operating health combines company-level revenue-growth ranks 55% and operating-margin ranks 45%, weighted by retail-segment relevance. Peer momentum is the weighted rank of trailing 63-day adjusted-price return. The decision indicator combines readiness, operating health, momentum and inverse predicted stress under explicit scenario weights. It is a relative screening aid, not Shop-EY ROI.",
    })
    items.append({
        "id": "method-coverage",
        "country": None,
        "title": "Market coverage limits",
        "source": "Bearing data assessment",
        "url": None,
        "text": "Country codes describe the assigned primary country of each listed company. Global companies operate across borders. Nine of the thirteen countries have only one peer in the supplied universe. Shop-EY's own country sales, costs and investment requirements are not present.",
    })
    return items


def retrieve(question: str, country: str | None, limit: int = 5):
    pool = docs()
    named_countries = {market["code"] for market in snapshot()["markets"] if market["name"].lower() in question.lower()}
    allowed_countries = named_countries | ({country} if country else set())
    country_tokens = {token for market in snapshot()["markets"] if market["code"] in allowed_countries for token in TOKENS.findall(market["name"].lower())}
    query = [token for token in TOKENS.findall(question.lower()) if token not in STOP and token not in country_tokens]
    frequencies = {}
    for document in pool:
        for token in set(TOKENS.findall((document["title"] + " " + document["text"]).lower())):
            frequencies[token] = frequencies.get(token, 0) + 1
    scored = []
    for document in pool:
        if allowed_countries and document["country"] not in allowed_countries | {None}:
            continue
        title = set(TOKENS.findall(document["title"].lower()))
        body = set(TOKENS.findall(document["text"].lower()))
        score = sum((2.5 if token in title else 1 if token in body else 0) * math.log(2 + len(pool) / (1 + frequencies.get(token, 0))) for token in query)
        if score > 0 and document["country"] in allowed_countries:
            score += 1.5
        if score > 0:
            scored.append((score, document))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [document for _, document in scored[:limit]]


def generated_answer(question: str, evidence: list[dict]):
    if os.getenv("BEARING_LLM_ENABLED", "false").lower() != "true":
        return None
    context = "\n".join(f"[{index + 1}] {item['title']} | {item['source']}\n{item['text']}" for index, item in enumerate(evidence))
    instructions = "Answer as a concise analyst. Use only the numbered evidence supplied. Cite facts with [1], [2], etc. State when evidence cannot answer the question. Never infer Shop-EY sales or investment ROI from public peers. Do not add external facts."
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")  # override via GEMINI_MODEL env var if needed
        payload = {"systemInstruction": {"parts": [{"text": instructions}]}, "contents": [{"role": "user", "parts": [{"text": f"Question: {question}\n\nEvidence:\n{context}"}]}], "generationConfig": {"maxOutputTokens": 400, "temperature": 0.1}}
        req = request.Request(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            data=json.dumps(payload).encode(),
            headers={"x-goog-api-key": gemini_key, "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=20) as response:
                data = json.load(response)
            return "\n".join(part.get("text", "") for candidate in data.get("candidates", []) for part in candidate.get("content", {}).get("parts", []) if "text" in part).strip() or None
        except (error.URLError, TimeoutError, ValueError):
            return None
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        return None
    payload = {
        "model": os.getenv("OPENAI_MODEL", "gpt-5-mini"),
        "store": False,
        "max_output_tokens": 240,
        "instructions": instructions,
        "input": f"Question: {question}\n\nEvidence:\n{context}",
    }
    req = request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=20) as response:
            data = json.load(response)
        return "\n".join(part.get("text", "") for item in data.get("output", []) for part in item.get("content", []) if part.get("type") == "output_text").strip() or None
    except (error.URLError, TimeoutError, ValueError):
        return None


def answer(question: str, country: str | None):
    lower = question.lower()
    unavailable_shop_ey = re.search(r"shop-ey.{0,35}(revenue|profit|roi|customers|conversion|sales|costs|orders|deliveries|retention|acquisition)", lower)
    unavailable_operations = re.search(r"(shipping|delivery|fulfillment|logistics).{0,15}(cost|expense|time|rate)", lower)
    if unavailable_shop_ey or unavailable_operations:
        return {"answer": "The supplied evidence does not include Shop-EY country sales, orders, customers, delivery performance, costs or investment returns. Those operating measures are needed to answer this question.", "evidence": [], "mode": "insufficient"}
    matches = retrieve(question, country)
    if not matches:
        return {"answer": "The available sources do not address that question. Try asking about peer performance, digital readiness, coverage or the stress model.", "evidence": [], "mode": "retrieval"}
    generated = generated_answer(question, matches)
    citations = [int(number) for number in re.findall(r"\[(\d+)\]", generated or "")]
    if generated and citations and all(1 <= number <= len(matches) for number in citations):
        return {"answer": generated, "evidence": matches, "mode": "generated"}
    # The product remains usable without an LLM key. Show only excerpts used in the answer.
    used = matches[:1] if matches[0]["id"].startswith("peer-") else matches[:2]
    return {"answer": " ".join(f"[{index + 1}] {item['text']}" for index, item in enumerate(used)), "evidence": used, "mode": "retrieval"}


class handler(BaseHTTPRequestHandler):
    def respond(self, status, payload):
        body = json.dumps(payload, allow_nan=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def body(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length > 10000:
            raise ValueError("Request too large")
        return json.loads(self.rfile.read(length) or b"{}")

    def do_GET(self):
        path = self.path.split("?")[0].rstrip("/")
        if path in {"/api/health", "/health"}:
            return self.respond(200, {"ok": True, "version": snapshot()["version"]})
        if path in {"/api/markets", "/markets"}:
            return self.respond(200, snapshot())
        if path in {"/api/model", "/model"}:
            data = snapshot()
            return self.respond(200, {"version": data["version"], "asOf": data["asOf"], "metrics": data["model"], "dataQuality": data["dataQuality"]})
        if path in {"/api/export", "/export"}:
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["as_of", "country_code", "market", "peer_count", "coverage", "revenue_growth_median", "operating_margin_median", "peer_stress_probability", "opportunity_score", "operating_score", "momentum_score"])
            for market in snapshot()["markets"]:
                writer.writerow([snapshot()["asOf"], market["code"], market["name"], market["peerCount"], market["coverage"], market["medianRevenueGrowth"], market["medianOperatingMargin"], market["stressProbability"], market["opportunity"], market["operatingHealth"], market["momentum"]])
            body = output.getvalue().encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/csv; charset=utf-8")
            self.send_header("Content-Disposition", 'attachment; filename="bearing-markets.csv"')
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        return self.respond(404, {"error": "Not found"})

    def do_POST(self):
        path = self.path.split("?")[0].rstrip("/")
        try:
            body = self.body()
            if path in {"/api/ask", "/ask"}:
                question = str(body.get("question", "")).strip()[:600]
                country = str(body.get("country", "")).upper() or None
                if len(question) < 4:
                    return self.respond(400, {"error": "Enter a question of at least four characters."})
                if country and country not in {market["code"] for market in snapshot()["markets"]}:
                    return self.respond(400, {"error": "Unknown country."})
                return self.respond(200, answer(question, country))
            if path in {"/api/predict", "/predict"}:
                company_id = str(body.get("companyId", ""))
                peer = next((peer for market in snapshot()["markets"] for peer in market["peers"] if peer["id"] == company_id), None)
                if peer is None:
                    return self.respond(404, {"error": "Unknown company."})
                model_data = artifact()
                row = pd.DataFrame([peer["modelFeatures"]])[model_data["features"]]
                probability = float(model_data["model"].predict_proba(row)[0, 1])
                return self.respond(200, {"companyId": company_id, "probability": round(probability, 4), "threshold": round(model_data["threshold"], 3), "modelVersion": model_data["version"]})
            return self.respond(404, {"error": "Not found"})
        except (ValueError, json.JSONDecodeError) as exc:
            return self.respond(400, {"error": str(exc)})


if __name__ == "__main__":
    print("Bearing API listening on http://127.0.0.1:8000")
    HTTPServer(("127.0.0.1", 8000), handler).serve_forever()
