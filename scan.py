#!/usr/bin/env python3
"""
scan.py - premarket data gatherer.

Collects raw premarket data into packet.json. Does ZERO analysis: no
conviction, no buckets, no opinions. The only computed fields are the
deterministic day_eligible / swing_eligible flags, which are a direct,
literal encoding of WATCHLIST_CRITERIA.md, not a judgment call. All real
judgment happens later in AI prompts that read this packet.

Requires: pip install yfinance feedparser requests
(zoneinfo is stdlib in Python 3.9+)
"""

import json
import re
import time
from datetime import datetime, timedelta
from html import unescape
from pathlib import Path
from zoneinfo import ZoneInfo

import feedparser
import requests
import yfinance as yf

ET = ZoneInfo("America/New_York")

# ---------------------------------------------------------------------------
# 1. Market snapshot
# ---------------------------------------------------------------------------

MARKET_INSTRUMENTS = {
    "S&P 500": "^GSPC",
    "Dow": "^DJI",
    "Nasdaq": "^IXIC",
    "Russell 2000": "^RUT",
    "VIX": "^VIX",
    "US 10Y": "^TNX",
    "US 3M": "^IRX",
    "WTI Oil": "CL=F",
    "Dollar (DXY)": "DX-Y.NYB",
}


def get_market_snapshot():
    snapshot = {}
    for name, symbol in MARKET_INSTRUMENTS.items():
        try:
            hist = yf.Ticker(symbol).history(period="5d", interval="1d")
            closes = hist["Close"].dropna()
            if len(closes) < 2:
                snapshot[name] = {"symbol": symbol, "error": "not enough data"}
                continue
            last = float(closes.iloc[-1])
            prev_close = float(closes.iloc[-2])
            change_pct = (last - prev_close) / prev_close * 100 if prev_close else None
            snapshot[name] = {
                "symbol": symbol,
                "last": round(last, 2),
                "prev_close": round(prev_close, 2),
                "change_pct": round(change_pct, 2) if change_pct is not None else None,
            }
            print(f"  {name} ({symbol}): last={last:.2f} chg={change_pct:.2f}%")
        except Exception as e:
            print(f"  WARNING: failed to fetch {name} ({symbol}): {e}")
            snapshot[name] = {"symbol": symbol, "error": str(e)}
    return snapshot


# ---------------------------------------------------------------------------
# 2. Live top movers, with a static universe fallback
# ---------------------------------------------------------------------------

UNIVERSE = [
    "NVDA", "AMD", "AVGO", "SMCI", "MRVL", "TSLA", "AAPL", "MSFT", "META",
    "AMZN", "GOOGL", "NFLX", "DELL", "SNOW", "PLTR", "COIN", "MSTR", "SOFI",
    "RIVN", "NIO", "MARA", "RIOT", "BA", "DIS", "JPM", "BAC", "XOM", "CVX",
    "HOOD", "UBER", "CRWD", "PANW", "CELH", "LULU", "NKE", "CAVA", "DKNG",
    "ARM", "INTC", "MU",
]


def get_live_movers():
    """Pull yfinance's keyless predefined screeners. Returns {} on any failure,
    which is fine because the caller falls back to the static universe."""
    quotes = {}
    for screen_name in ("day_gainers", "most_actives"):
        try:
            try:
                result = yf.screen(screen_name, count=50)
            except TypeError:
                result = yf.screen(screen_name)
            found = result.get("quotes", []) if isinstance(result, dict) else []
            for q in found:
                symbol = q.get("symbol")
                if not symbol or symbol in quotes:
                    continue
                quotes[symbol] = {
                    "ticker": symbol,
                    "name": q.get("shortName") or q.get("longName") or symbol,
                    "price": q.get("regularMarketPrice"),
                    "prev_close": q.get("regularMarketPreviousClose"),
                    "gap_pct": q.get("regularMarketChangePercent"),
                    "market_cap": q.get("marketCap"),
                    "volume": q.get("regularMarketVolume"),
                }
            print(f"  screener '{screen_name}': {len(found)} quotes")
        except Exception as e:
            print(f"  WARNING: screener '{screen_name}' failed: {e}")
    return quotes


def get_fallback_movers():
    quotes = {}
    for symbol in UNIVERSE:
        try:
            t = yf.Ticker(symbol)
            hist = t.history(period="5d", interval="1d")
            closes = hist["Close"].dropna()
            if len(closes) < 2:
                continue
            last = float(closes.iloc[-1])
            prev_close = float(closes.iloc[-2])
            gap_pct = (last - prev_close) / prev_close * 100 if prev_close else None

            market_cap, volume, name = None, None, symbol
            try:
                fi = t.fast_info
                market_cap = getattr(fi, "market_cap", None)
                volume = getattr(fi, "last_volume", None)
            except Exception:
                pass
            try:
                info = t.info
                name = info.get("shortName") or info.get("longName") or symbol
                market_cap = market_cap or info.get("marketCap")
                volume = volume or info.get("regularMarketVolume") or info.get("volume")
            except Exception:
                pass

            quotes[symbol] = {
                "ticker": symbol,
                "name": name,
                "price": round(last, 2),
                "prev_close": round(prev_close, 2),
                "gap_pct": round(gap_pct, 2) if gap_pct is not None else None,
                "market_cap": market_cap,
                "volume": volume,
            }
        except Exception as e:
            print(f"  WARNING: fallback fetch failed for {symbol}: {e}")
    return quotes


def get_top_movers():
    live = get_live_movers()
    if len(live) >= 5:
        return live, "live_screener"
    print("  Live screener returned fewer than 5 names, falling back to static universe")
    return get_fallback_movers(), "static_universe_fallback"


# ---------------------------------------------------------------------------
# 3. Gap filter
# ---------------------------------------------------------------------------

def filter_gappers(movers):
    keepers = []
    for data in movers.values():
        gap, price = data.get("gap_pct"), data.get("price")
        if gap is None or price is None:
            continue
        if abs(gap) >= 4 and price >= 3:
            keepers.append(data)
    keepers.sort(key=lambda d: abs(d["gap_pct"]), reverse=True)
    return keepers[:12]


# ---------------------------------------------------------------------------
# 4. Market-wide news via free RSS
# ---------------------------------------------------------------------------

NEWS_FEEDS = {
    "MarketWatch Top": "http://feeds.marketwatch.com/marketwatch/topstories/",
    "MarketWatch RealTime": "http://feeds.marketwatch.com/marketwatch/realtimeheadlines/",
    "CNBC": "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    "Yahoo Finance": "https://finance.yahoo.com/news/rssindex",
    "Google News Markets": (
        "https://news.google.com/rss/search?q=markets+OR+earnings+when:1d"
        "&hl=en-US&gl=US&ceid=US:en"
    ),
}

SEO_SPAM_PATTERNS = [
    re.compile(r"price prediction", re.IGNORECASE),
    re.compile(r"\b20\d{2}-20\d{2}\b"),
]


def strip_html(text):
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def is_seo_spam(title):
    return any(p.search(title) for p in SEO_SPAM_PATTERNS)


def get_market_news():
    items = []
    for source, url in NEWS_FEEDS.items():
        try:
            feed = feedparser.parse(url)
            count = 0
            for entry in feed.entries:
                title = strip_html(entry.get("title", ""))
                if not title or is_seo_spam(title):
                    continue
                summary = strip_html(entry.get("summary", "") or entry.get("description", ""))
                items.append({
                    "source": source,
                    "title": title,
                    "link": entry.get("link", ""),
                    "summary": summary[:400],
                    "published": entry.get("published", ""),
                })
                count += 1
            print(f"  {source}: {count} headlines")
        except Exception as e:
            print(f"  WARNING: failed to fetch feed '{source}': {e}")
    return items


# ---------------------------------------------------------------------------
# 5. Economic calendar (ForexFactory data-partner feed, cached)
# ---------------------------------------------------------------------------

CALENDAR_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
CACHE_FILE = Path(".ff_calendar_cache.json")
CACHE_TTL_SECONDS = 4 * 60 * 60


def fetch_ff_calendar_raw():
    """Returns (data, note). Uses a local cache since this feed rate-limits
    (429) on rapid calls. Falls back to the last cached week on failure."""
    now = time.time()
    cached = None
    if CACHE_FILE.exists():
        try:
            cached = json.loads(CACHE_FILE.read_text())
        except Exception:
            cached = None

    if cached and (now - cached.get("fetched_at", 0)) < CACHE_TTL_SECONDS:
        print("  Using cached economic calendar (still fresh)")
        return cached["data"], None

    try:
        resp = requests.get(CALENDAR_URL, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        data = resp.json()
        try:
            CACHE_FILE.write_text(json.dumps({"fetched_at": now, "data": data}))
        except Exception as e:
            print(f"  WARNING: could not write calendar cache: {e}")
        print("  Fetched fresh economic calendar")
        return data, None
    except Exception as e:
        print(f"  WARNING: live fetch of economic calendar failed: {e}")
        if cached:
            print("  Falling back to last cached calendar")
            return cached["data"], "live fetch failed, used cached data from earlier this week"
        return None, f"live fetch failed and no cache available: {e}"


def get_econ_calendar():
    empty = {
        "source": "forexfactory (nfs.faireconomy.media)",
        "filter": "USD, High impact",
        "today_date": None,
        "tomorrow_date": None,
        "today": [],
        "tomorrow": [],
    }
    try:
        data, note = fetch_ff_calendar_raw()
        if data is None:
            empty["note"] = note
            return empty

        today_et = datetime.now(ET).date()
        tomorrow_et = today_et + timedelta(days=1)

        today_events, tomorrow_events = [], []
        for event in data:
            try:
                if event.get("country") != "USD" or event.get("impact") != "High":
                    continue
                date_str = event.get("date", "")
                if date_str.endswith("Z"):
                    date_str = date_str[:-1] + "+00:00"
                event_dt_et = datetime.fromisoformat(date_str).astimezone(ET)
                record = {
                    "time_et": event_dt_et.strftime("%I:%M %p").lstrip("0"),
                    "title": event.get("title", ""),
                    "forecast": event.get("forecast", ""),
                    "previous": event.get("previous", ""),
                }
                if event_dt_et.date() == today_et:
                    today_events.append((event_dt_et, record))
                elif event_dt_et.date() == tomorrow_et:
                    tomorrow_events.append((event_dt_et, record))
            except Exception:
                continue

        today_events.sort(key=lambda x: x[0])
        tomorrow_events.sort(key=lambda x: x[0])

        result = {
            "source": "forexfactory (nfs.faireconomy.media)",
            "filter": "USD, High impact",
            "today_date": today_et.isoformat(),
            "tomorrow_date": tomorrow_et.isoformat(),
            "today": [r for _, r in today_events],
            "tomorrow": [r for _, r in tomorrow_events],
        }
        if note:
            result["note"] = note
        return result
    except Exception as e:
        print(f"  WARNING: econ calendar processing failed: {e}")
        empty["note"] = f"error, returned empty calendar: {e}"
        return empty


# ---------------------------------------------------------------------------
# 6. Per-gapper enrichment
# ---------------------------------------------------------------------------

# Generic words that show up in lots of unrelated company names. A single one
# of these must never count as a catalyst match on its own (e.g. "Applied"
# alone would cross-match Applied Materials, Applied Signal, Applied DNA...).
GENERIC_COMPANY_WORDS = {
    "the", "inc", "incorporated", "corp", "corporation", "co", "company",
    "holdings", "holding", "technologies", "technology", "tech", "group",
    "digital", "applied", "advanced", "strategy", "strategic", "motors",
    "motor", "energy", "platforms", "platform", "systems", "system",
    "solutions", "solution", "international", "global", "industries",
    "industry", "enterprises", "enterprise", "capital", "partners",
    "ventures", "labs", "laboratory", "laboratories", "resources",
    "networks", "network", "communications", "sciences", "science",
    "pharmaceuticals", "pharmaceutical", "therapeutics", "financial",
    "services", "service", "brands", "properties", "trust",
    "fund", "acquisition", "class", "ltd", "limited", "plc", "nv", "sa", "ag",
}

PRIMARY_PUBLISHERS = [
    "bloomberg", "reuters", "cnbc", "marketwatch", "barron", "yahoo finance",
    "wall street journal", "wsj", "associated press", "ap news",
]


def distinctive_name_tokens(name):
    if not name:
        return []
    tokens = []
    for word in re.findall(r"[A-Za-z]+", name):
        lw = word.lower()
        if lw in GENERIC_COMPANY_WORDS or len(lw) < 3:
            continue
        tokens.append(lw)
    return tokens


def headline_mentions_ticker(title, ticker, name_tokens):
    if not title:
        return False
    # Ticker match is case-sensitive on purpose: lowercasing would make short
    # tickers that are also common words (e.g. "ON", "ALL") match constantly.
    if re.search(r"\b" + re.escape(ticker) + r"\b", title):
        return True
    title_lower = title.lower()
    return any(re.search(r"\b" + re.escape(tok) + r"\b", title_lower) for tok in name_tokens)


def parse_yf_news_item(item):
    """yfinance's news schema has changed across versions, try both shapes."""
    try:
        content = item.get("content") if isinstance(item.get("content"), dict) else None
        if content:
            title = content.get("title", "")
            provider = content.get("provider") or {}
            publisher = provider.get("displayName", "") if isinstance(provider, dict) else ""
            url_obj = content.get("canonicalUrl") or {}
            link = url_obj.get("url", "") if isinstance(url_obj, dict) else ""
        else:
            title = item.get("title", "")
            publisher = item.get("publisher", "")
            link = item.get("link", "")
        return title, publisher, link
    except Exception:
        return "", "", ""


def get_catalyst_headlines(ticker, company_name, all_news):
    headlines = []

    try:
        for item in (yf.Ticker(ticker).news or []):
            title, publisher, link = parse_yf_news_item(item)
            if title:
                headlines.append({"source": publisher or "Yahoo Finance", "title": title, "link": link})
    except Exception as e:
        print(f"    WARNING: yfinance news fetch failed for {ticker}: {e}")

    name_tokens = distinctive_name_tokens(company_name)
    for item in all_news:
        if headline_mentions_ticker(item["title"], ticker, name_tokens):
            headlines.append({"source": item["source"], "title": item["title"], "link": item.get("link", "")})

    seen, deduped = set(), []
    for h in headlines:
        key = h["title"].strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(h)

    def is_primary(h):
        src = h["source"].lower()
        return any(pub in src for pub in PRIMARY_PUBLISHERS)

    deduped.sort(key=lambda h: 0 if is_primary(h) else 1)
    return deduped[:8], len(deduped) > 0


def get_intraday_levels(ticker):
    try:
        hist = yf.Ticker(ticker).history(period="1d", interval="5m", prepost=True)
        if hist.empty:
            return {"error": "no intraday data"}

        idx = hist.index.tz_convert(ET) if hist.index.tz is not None else hist.index
        premarket_mask = (idx.hour < 9) | ((idx.hour == 9) & (idx.minute < 30))
        premarket_bars = hist[premarket_mask]

        vwap = None
        if hist["Volume"].sum() > 0:
            typical_price = (hist["High"] + hist["Low"] + hist["Close"]) / 3
            vwap = float((typical_price * hist["Volume"]).sum() / hist["Volume"].sum())

        return {
            "vwap": round(vwap, 2) if vwap is not None else None,
            "hod": round(float(hist["High"].max()), 2),
            "lod": round(float(hist["Low"].min()), 2),
            "premarket_high": round(float(premarket_bars["High"].max()), 2) if not premarket_bars.empty else None,
            "premarket_volume": int(premarket_bars["Volume"].sum()) if not premarket_bars.empty else 0,
        }
    except Exception as e:
        print(f"    WARNING: intraday levels failed for {ticker}: {e}")
        return {"error": str(e)}


def get_daily_metrics(ticker):
    try:
        hist = yf.Ticker(ticker).history(period="1y", interval="1d")
        if hist.empty:
            return {"error": "no daily data"}

        today_et = datetime.now(ET).date()
        idx = hist.index.tz_convert(ET) if hist.index.tz is not None else hist.index
        dates = idx.date

        hist_complete = hist[dates < today_et]
        if hist_complete.empty:
            return {"error": "no completed daily bars"}

        sma_200 = float(hist_complete["Close"].tail(200).mean()) if len(hist_complete) >= 200 else None
        prior_close = float(hist_complete["Close"].iloc[-1])
        prior_high = float(hist_complete["High"].iloc[-1])
        avg_vol_20 = float(hist_complete["Volume"].tail(20).mean())

        hist_today = hist[dates == today_et]
        today_open = float(hist_today["Open"].iloc[0]) if not hist_today.empty else None
        today_volume = float(hist_today["Volume"].iloc[0]) if not hist_today.empty else None

        return {
            "sma_200": round(sma_200, 2) if sma_200 is not None else None,
            "prior_day_high": round(prior_high, 2),
            "prior_close": round(prior_close, 2),
            "today_open": round(today_open, 2) if today_open is not None else None,
            "avg_volume_20d": round(avg_vol_20, 0),
            "today_volume": today_volume,
        }
    except Exception as e:
        print(f"    WARNING: daily metrics failed for {ticker}: {e}")
        return {"error": str(e)}


def get_next_earnings_date(ticker):
    try:
        cal = yf.Ticker(ticker).calendar
        if isinstance(cal, dict):
            dates = cal.get("Earnings Date")
            if dates:
                d = dates[0] if isinstance(dates, (list, tuple)) else dates
                return str(d)
        return None
    except Exception as e:
        print(f"    WARNING: next earnings date failed for {ticker}: {e}")
        return None


# ---------------------------------------------------------------------------
# 7. Deterministic eligibility flags (encodes WATCHLIST_CRITERIA.md, in code)
# ---------------------------------------------------------------------------

def compute_eligibility(gap_pct, price, market_cap, rvol, prior_day_high, today_open, sma_200, catalyst_found):
    day_eligible = all([
        gap_pct is not None and gap_pct > 3,
        price is not None and price > 3,
        market_cap is not None and market_cap > 1_000_000_000,
        rvol is not None and rvol > 1.5,
        price is not None and prior_day_high is not None and price > prior_day_high,
    ])

    swing_eligible = all([
        gap_pct is not None and gap_pct >= 8,
        price is not None and price > 3,
        today_open is not None and prior_day_high is not None and today_open > prior_day_high,
        today_open is not None and sma_200 is not None and today_open > sma_200,
        market_cap is not None and market_cap >= 800_000_000,
        catalyst_found is True,
    ])

    return day_eligible, swing_eligible


def enrich_gappers(gappers, all_news):
    enriched = []
    for g in gappers:
        ticker = g["ticker"]
        print(f"  Enriching {ticker}...")

        catalyst_headlines, catalyst_found = get_catalyst_headlines(ticker, g.get("name", ticker), all_news)
        intraday = get_intraday_levels(ticker)
        daily = get_daily_metrics(ticker)
        earnings_date = get_next_earnings_date(ticker)

        avg_vol_20 = daily.get("avg_volume_20d") if isinstance(daily, dict) else None
        today_volume = g.get("volume")
        # yfinance reports about 0 premarket volume, so this is full-day
        # volume over 20-day average volume, a keyless stand-in. A true
        # premarket RVOL needs a premarket data feed such as Alpaca.
        rvol = round(today_volume / avg_vol_20, 2) if today_volume and avg_vol_20 else None

        prior_day_high = daily.get("prior_day_high") if isinstance(daily, dict) else None
        today_open = daily.get("today_open") if isinstance(daily, dict) else None
        sma_200 = daily.get("sma_200") if isinstance(daily, dict) else None

        day_eligible, swing_eligible = compute_eligibility(
            gap_pct=g.get("gap_pct"),
            price=g.get("price"),
            market_cap=g.get("market_cap"),
            rvol=rvol,
            prior_day_high=prior_day_high,
            today_open=today_open,
            sma_200=sma_200,
            catalyst_found=catalyst_found,
        )

        record = dict(g)
        record.update({
            "catalyst_headlines": catalyst_headlines,
            "catalyst_found": catalyst_found,
            "intraday": intraday,
            "daily": daily,
            "rvol": rvol,
            "next_earnings_date": earnings_date,
            "day_eligible": day_eligible,
            "swing_eligible": swing_eligible,
        })
        enriched.append(record)
    return enriched


# ---------------------------------------------------------------------------
# 8. Packet assembly
# ---------------------------------------------------------------------------

def build_packet():
    now_et = datetime.now(ET)

    print("=== Market snapshot ===")
    market_snapshot = get_market_snapshot()

    print("=== Top movers ===")
    movers, candidate_source = get_top_movers()
    print(f"  candidate_source = {candidate_source}, {len(movers)} candidates")

    print("=== Gap filter ===")
    gappers_raw = filter_gappers(movers)
    print(f"  {len(gappers_raw)} names pass the gap filter")

    print("=== Market news ===")
    all_news = get_market_news()
    market_news = all_news[:20]

    print("=== Economic calendar ===")
    econ_calendar = get_econ_calendar()

    print("=== Per-gapper enrichment ===")
    gappers = enrich_gappers(gappers_raw, all_news)

    return {
        "generated_at": now_et.isoformat(),
        "candidate_source": candidate_source,
        "trading_day_note": (
            "Data pulled premarket ET. This scanner does zero analysis, all "
            "judgment happens later in the AI prompt layer."
        ),
        "scan_params": {
            "gap_filter_min_abs_pct": 4,
            "gap_filter_min_price": 3,
            "gap_filter_max_candidates": 12,
        },
        "criteria": {
            "day_trading_trend_join_long": (
                "Premarket: gap > 3%, price > $3, market cap > $1B, premarket RVOL > 1.5, "
                "price breaking above yesterday's high. Backtest: 54.6% win rate, PF 1.59, "
                "280 trades. Intraday plan: window 10:00am to 3:30pm ET, trigger price > "
                "premarket high and > prior high-of-day, stop 1% below premarket high or LOD "
                "(whichever is lower) is 1R, scale 1/3 at +1R and 1/3 at +2R, trail the last "
                "1/3 on the 21-EMA, flat by 3:51pm."
            ),
            "swing": (
                "Premarket: gap >= 8%, price > $3, open > yesterday's high, open > 200-day SMA, "
                "market cap >= $800M, real catalyst (earnings on the gap day or news with no "
                "earnings). Backtest: 57.6% win rate / PF 5.34 on news catalysts, 44.7% / PF "
                "2.57 on earnings catalysts. Entry and exit management is still being built, so "
                "swing names here are starter ideas only, no stops or targets."
            ),
        },
        "market_snapshot": market_snapshot,
        "econ_calendar": econ_calendar,
        "gappers": gappers,
        "market_news": market_news,
        "gaps_to_fill": [
            "Earnings coverage is per-ticker next-earnings-date only, not a full "
            "market-wide earnings calendar.",
            "Intraday levels (VWAP, HOD, LOD, premarket high and volume) are best-effort "
            "from yfinance 5-min bars, not a dedicated intraday feed.",
            "RVOL is full-day volume over 20-day average volume, a keyless stand-in. "
            "yfinance reports about 0 premarket volume, so true premarket RVOL needs a "
            "premarket data feed such as Alpaca.",
        ],
    }


def main():
    print("Starting premarket scan...")
    packet = build_packet()
    out_path = Path("packet.json")
    out_path.write_text(json.dumps(packet, indent=2, default=str))
    print(f"Done. Wrote {out_path.resolve()}")


if __name__ == "__main__":
    main()
