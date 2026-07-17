# Watchlist Criteria (Source of Truth)

This doc is the rulebook for the premarket scanner. Two setups, both backtested, both validated. If the scanner ever disagrees with this doc, the doc wins and the scanner is wrong.

Don't add filters, don't get creative, don't "improve" the thresholds. If a setup needs changing, that happens here first, then in code.

---

## 1. Day Trading Watchlist: "Trend Join Long"

**Backtest stats:** 54.6% win rate, profit factor 1.59, 280 trades.

### Premarket selection (ALL required)

| Filter | Threshold |
|---|---|
| Gap % vs prev close | > 3% |
| Price | > $3 |
| Market cap | > $1B |
| Premarket RVOL | > 1.5 |
| Price action | Breaking above yesterday's high |

### Intraday plan

- **Window:** 10:00am to 3:30pm ET. Nothing before 10, nothing new after 3:30.
- **Trigger:** price > premarket high AND > prior high-of-day. Both, not either.
- **Stop (1R):** 1% below premarket high, or the LOD, whichever is lower.
- **Scale out:** 1/3 off at +1R, 1/3 off at +2R.
- **Runner:** trail the last 1/3 on the 21-EMA.
- **Flat by 3:51pm.** No exceptions, no holding into the close.

---

## 2. Swing Watchlist

**Backtest stats:** 57.6% win rate / PF 5.34 on news catalysts. 44.7% win rate / PF 2.57 on earnings catalysts. Two different catalyst buckets, track them separately.

### Premarket selection (ALL required)

| Filter | Threshold |
|---|---|
| Gap % | >= 8% |
| Price | > $3 |
| Open | > yesterday's high |
| Open | > 200-day SMA |
| Market cap | >= $800M |
| Catalyst | Real one: earnings on the gap day, or news with no earnings |

### Entry and exit management

**Not built yet.** Swing names coming out of this scan are starter ideas only. No stops, no targets, no "here's the plan" until the management rules are actually designed and validated. Don't let the scanner fake confidence it doesn't have here.

---

## Notes for the scanner build

- These are premarket selection filters only. Everything after entry (day trading intraday plan, swing management) either lives above as-is or isn't built yet, per setup.
- Earnings vs. news catalyst should be tagged separately on swing candidates, since the backtest performance is different for each bucket.
- If a candidate fails even one required filter, it's off the list. No partial matches, no "close enough."
