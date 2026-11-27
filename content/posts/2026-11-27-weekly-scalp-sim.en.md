---
title: "[Weekly Scalping Simulation] Nov 23–27 — 4 losing days out of 5, and the fix was a daily loss limit, not an index-drop trading halt"
date: 2026-11-27T15:50:00+09:00
lastmod: 2026-11-27T16:40:00+09:00
description: "We followed the Scalping page's 'consider entry' signals on 3- and 5-minute bars for all five trading days this week. The weekly total was −147.3%p on 3-minute bars and −83.8%p on 5-minute bars. We break the results down by day and test crash safeguards — trading halts and position cuts — on the same data. Halting on index drops did little; a daily loss limit cut the maximum drawdown by more than 60%."
tags: ["scalping", "scalping simulation", "backtest", "minute bars", "3-minute bars", "5-minute bars", "weekly review", "risk management", "market crash"]
---

**In one line: following this week's scalping signals as-is would have lost money, and the most effective safeguard was not "stop when the index falls" but "stop when I've lost this much today."**

- Monday through Thursday were losing days; only Friday made a big gain.
- Most losses came from the **"true support" pattern** and **entries after 10:00**.
- We added trading halts and position cuts triggered by index drops, but the worst days this week were days when the index **rose (Tue) or was flat (Thu)**, so they did little.
- A **daily loss limit (stop at −10%p cumulative for the day)** turned the 3-minute weekly result from −147.3%p to +34.2%p and cut the maximum drawdown from −300.1%p to −117.9%p.

## This week's market

We used minute bars of ETFs that track each index (KOSPI: KODEX 200; KOSDAQ: KODEX KOSDAQ150). All figures are versus the previous close.

| Date | KOSPI open | KOSPI intraday low | KOSPI close | KOSDAQ open | KOSDAQ intraday low | KOSDAQ close | What happened |
|---|---:|---:|---:|---:|---:|---:|---|
| Mon 11/23 | −2.73% | −5.84% | −3.20% | −1.09% | −3.66% | −1.38% | Nasdaq sell-off spillover, sell-side sidecar |
| Tue 11/24 | +7.23% | +5.42% | +6.63% | +3.81% | +3.47% | +5.69% | Jensen Huang's return, KOSPI back above 5,000 |
| Wed 11/25 | −4.39% | −7.49% | −7.02% | −2.46% | −4.06% | −2.01% | Chip sell-off, sell-side sidecar |
| Thu 11/26 | +1.08% | +0.19% | +0.35% | +1.91% | +0.51% | +1.07% | Bank of Korea rate hike, faded after a strong open |
| Fri 11/27 | +0.78% | −0.40% | +4.51% | +2.21% | +1.94% | +9.91% | Chips and KOSDAQ rallied together |

Three days moved more than 5%. See each day's [flow journal](/posts/) for the flow details.

## How it was run

| Item | Details |
|---|---|
| Stocks | Each day's top 50 stocks by minute-bar trading value (ETFs excluded) |
| Signals | The same engine as the [Scalping](/scalp/) page. Each time a 3- or 5-minute bar closed, it was recalculated using only data up to that moment, and we bought only when the overall verdict was **"consider entry"** |
| Entry | Open of the 1-minute bar after the signal bar |
| Exit | Sell half at target 1 → raise the stop on the other half to the entry price (breakeven) → sell the rest at target 2. Full exit if the stop is hit. Anything still open at 15:20 is closed at that price |
| Costs | 0.23% round-trip commission and tax deducted |
| Returns | Same amount per trade; per-trade returns are simply added up (%p). The 3- and 5-minute runs are separate accounts |

## Weekly summary

| Bars | Trades | Win rate | Avg per trade | Weekly total | Profit factor | Max drawdown |
|---|---:|---:|---:|---:|---:|---:|
| 3-minute | 1,108 | 37.9% | −0.13% | **−147.3%p** | 0.83 | −300.1%p |
| 5-minute | 722 | 40.3% | −0.12% | **−83.8%p** | 0.86 | −158.8%p |

Profit factor (PF) is total profit on winning trades ÷ total loss on losing trades; below 1 means more was lost than made. Max drawdown is the largest drop of the weekly cumulative curve from a peak.

### What made money and what lost it

| Item | 3-minute | 5-minute | In one line |
|---|---|---|---|
| Opening range breakout | 200 trades · 48.0% win · **+77.5%p** | 168 · 45.8% · **+48.6%p** | Steady profit on both |
| True support | 600 · 31.3% · **−206.6%p** | 341 · 36.7% · **−103.9%p** | Half the signals, most of the losses |
| MA pullback | 217 · 42.9% · +6.3%p | 160 · 36.9% · −28.8%p | Roughly breakeven |
| Entries 09:15–10:00 | 148 · 50.0% · **+43.9%p** | 53 · 64.2% · **+53.4%p** | The only profitable window |
| Entries after 14:30 | 66 · 16.7% · −45.5%p | 41 · 19.5% · −25.8%p | Better skipped |
| Stop under 1% | 540 · 29.3% · −154.6%p | 290 · 33.8% · −63.4%p | Hit by ordinary intraday noise |
| Stop 3% or more | 105 · 62.9% · +67.5%p | 81 · 61.7% · +40.0%p | High win rate, but costly when wrong |

56% of 3-minute trades (619) were stopped out before reaching target 1. Trades that reached their targets clearly made money (216 trades from target 1 to target 2, +493.7%p), but stops were hit far too often.

## Daily results

| Date | 3-min trades | Win rate | Total | PF | 5-min trades | Win rate | Total | PF |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Mon 11/23 | 270 | 33.7% | −33.9%p | 0.83 | 145 | 45.5% | +1.9%p | 1.02 |
| Tue 11/24 | 184 | 32.1% | −83.1%p | 0.45 | 115 | 35.7% | −39.8%p | 0.62 |
| Wed 11/25 | 228 | 39.5% | −44.1%p | 0.79 | 130 | 42.3% | −16.9%p | 0.86 |
| Thu 11/26 | 247 | 25.9% | **−135.6%p** | 0.41 | 171 | 26.9% | **−81.9%p** | 0.51 |
| Fri 11/27 | 179 | 64.8% | **+149.3%p** | 2.93 | 161 | 51.6% | **+52.9%p** | 1.54 |

### Mon 11/23 — sell-side sidecar, 3-min −33.9%p / 5-min +1.9%p

- KOSPI fell as far as −5.8% intraday. On 3-minute bars, 160 of 270 trades were stopped out, and the day's cumulative result sank to **−95.7%p at 12:07** before an afternoon rebound recovered part of it.
- The 3-minute day total first crossed −10%p at **09:45** — a losing day from the start.
- Winning pattern: MA pullback (54 trades, +21.4%p). Losing pattern: true support (179 trades, 29.1% win, −59.5%p).

### Tue 11/24 — index +6.6% rebound, 3-min −83.1%p / 5-min −39.8%p

- The index jumped, but the signals did not work. After a gap-up of more than 7% at the open, the market just chopped up and down all day, and support and pullback signals were stopped out one after another.
- The 3-minute day total crossed −10%p at **10:44** and never recovered.
- Losing pattern: true support (97 trades, 29.9% win, −43.5%p). Only opening range breakouts were slightly positive (+3.6%p).

### Wed 11/25 — index −7.0% crash, 3-min −44.1%p / 5-min −16.9%p

- A sidecar crash day, yet surprisingly not the week's worst. **Entries from 09:15 to 10:00 made +30.6%p on 3-minute bars.** Opening range breakouts caught the early rebound after the drop well (24 trades, 62.5% win, +43.4%p).
- The problem was the afternoon. Support signals failed as the rebound faded, and the day's drawdown from its peak reached −100.8%p.

### Thu 11/26 — flat market, rate hike, 3-min −135.6%p / 5-min −81.9%p (worst of the week)

- The index barely moved, yet losses were the largest. 3-minute win rate 25.9%; 175 of 247 trades were stopped out.
- The 3-minute day total crossed −10%p at **10:36**, signals kept coming afterward, and it slid to −139.0%p by the close. **Not stopping was the biggest cause of the loss.**
- Losing pattern: true support (144 trades, 24.3% win, −75.9%p). Nine entries in Yellow Balloon Tour alone cost −9.7%p.

### Fri 11/27 — chips and KOSDAQ rally, 3-min +149.3%p / 5-min +52.9%p

- A strong trend day with the KOSDAQ ETF up 9.9%. The day total never touched −10%p, the 3-minute win rate was 64.8%, and this one day won back most of the week's losses.
- Winning pattern: opening range breakout (69 trades, 68.1% win, +66.1%p). The week's single worst trade (Dongyang Express on 5-minute bars, a plan with a 17% stop, −13.6%) also came on this day.

## Review: adding crash safeguards — trading halts and position cuts

To cut losses in a rough market like this one, we re-ran the same data with the safeguards below, one at a time and combined.

| Safeguard | Rule |
|---|---|
| G1. Halt on index drop | No new entries while the stock's market index (ETF) is **−2% or worse** versus the previous close |
| G2. Cut size on index drop | **Half size at −1% or worse**, no new entries at −2% or worse |
| G3. Daily loss limit | Stop trading for the day once realized P&L reaches **−10%p** (same amount per trade; about 8 stop-outs) |
| G4. Stop a stock after consecutive stop-outs | After **two consecutive stop-outs** in the same stock, stop trading it for the day |
| G5. Combined | G2 + G3 + G4 |
| G6. Add volatility cut | G5 + half size while the index is moving **±3% or more** versus the previous close |
| G7. Final | G6 + exclude "true support" + no entries after 14:30 + skip plans with stops under 1% |

### Results

| Safeguard | 3-min trades | Win | Weekly total | PF | Max DD | 5-min trades | Win | Weekly total | PF | Max DD |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Base | 1,108 | 37.9% | −147.3%p | 0.83 | −300.1%p | 722 | 40.3% | −83.8%p | 0.86 | −158.8%p |
| G1 halt at index −2% | 873 | 37.6% | −149.0%p | 0.80 | −301.7%p | 593 | 38.8% | −71.1%p | 0.86 | −166.2%p |
| G2 half at −1%, halt at −2% | 873 | 37.6% | −142.4%p | 0.78 | −295.1%p | 593 | 38.8% | −68.1%p | 0.85 | −153.1%p |
| G3 daily loss limit −10%p | 479 | 45.7% | **+34.2%p** | 1.09 | **−117.9%p** | 428 | 40.9% | −28.5%p | 0.92 | **−88.9%p** |
| G4 stop stock after 2 stop-outs | 708 | 41.9% | −43.8%p | 0.92 | −200.4%p | 559 | 40.3% | −71.8%p | 0.86 | −137.0%p |
| **G5 combined (G2+G3+G4)** | 347 | 46.7% | **+44.6%p** | **1.17** | −108.7%p | 303 | 41.6% | −2.4%p | 0.99 | −57.4%p |
| G6 G5 + volatility cut | 361 | 45.7% | +4.7%p | 1.03 | −94.5%p | 343 | 41.1% | −27.9%p | 0.86 | −59.3%p |
| **G7 final** | 269 | 48.3% | +6.3%p | 1.04 | **−88.6%p** | 290 | **50.0%** | **+23.4%p** | **1.12** | **−46.9%p** |

### By day (3-min / 5-min, %p)

| Date | Base | G3 daily limit | G5 combined | G7 final |
|---|---:|---:|---:|---:|
| Mon 11/23 | −33.9 / +1.9 | −25.9 / −24.5 | −22.1 / −9.5 | −18.7 / +9.8 |
| Tue 11/24 | −83.1 / −39.8 | −22.2 / −18.3 | −18.3 / −15.5 | −13.6 / −4.2 |
| Wed 11/25 | −44.1 / −16.9 | −26.7 / −18.8 | −31.1 / −10.6 | −28.9 / −3.8 |
| Thu 11/26 | −135.6 / −81.9 | −40.3 / −19.8 | −34.5 / −18.7 | −22.6 / −20.2 |
| Fri 11/27 | +149.3 / +52.9 | +149.3 / +52.9 | +150.5 / +52.0 | +90.1 / +41.8 |

### What the review found

1. **Halting on index drops (G1, G2) did almost nothing this week.** The worst days were Tuesday, when the index rose 6.6%, and flat Thursday. On the crash day (Wed), G1 actually made the 3-minute loss worse, from −44.1%p to −71.3%p, because it also blocked the early rebound signals right after the drop — the best signals that day. **For index-based rules, cutting size (G2) is better than a full halt.**
2. **The daily loss limit (G3) had by far the biggest effect.** On 3-minute bars, Monday through Thursday all hit the limit between 09:45 and 11:40 and stopped there, shrinking the worst day (Thu) from −135.6%p to −40.3%p. On the good day (Fri), the limit was never hit, so the profit was kept in full. In effect it judges "the market is bad" by **how my own signals are doing**, not by the index.
3. **Stopping a stock after two consecutive stop-outs (G4)** prevented losses from piling up in the same stock and, on its own, cut the 3-minute loss to about a third.
4. **We don't recommend the volatility (±3%) size cut (G6).** It reduced crash-day losses but cut more of the profit on strong trend days like Friday.
5. **G7 (final)** had the smallest drawdowns (−88.6%p on 3-minute, −46.9%p on 5-minute) and was positive on 5-minute bars with a 50% win rate. On 3-minute bars it made less than G5, so the pattern and time filters need another check on next week's data.

### So here is what we're adding

| Priority | Safeguard | In practice |
|---|---|---|
| 1 | **Stop trading at a daily loss limit** | If each trade uses 10% of the account, −10%p is about −1% of the account: "down 1% today, done for the day" |
| 2 | **Two consecutive stop-outs in a stock → stop that stock for the day** | Look at it again tomorrow |
| 3 | **Index −1% or worse → half size; −2% or worse → no new entries** | Crash insurance. May miss the first rebound right after a sharp drop |
| 4 | **No new entries after 14:30** | Win rate was around 20% this week |
| 5 | **Hold off on "true support" signals on volatile days** | Re-test next week |

## What to check next week

1. Where to set the daily loss limit: −5%p, −10%p or −15%p. This week −5%p did best (+72.9%p on 3-minute bars), but a tighter limit also risks cutting good days short.
2. Whether to build items 1–4 into the Scalping page alerts (e.g., a "daily loss limit reached" notice).
3. Whether the same rules hold in other weeks. We'll post the results in the same format next Friday.

## Limitations of this simulation

- **Candidate bias**: Past daily trading-value rankings were not stored, so each day's top 50 was chosen from about 110 stocks that ranked high by trading value or volume on 11/27. Stocks that were hot only early in the week may be missing.
- **Index proxy**: KODEX 200 and KODEX KOSDAQ150 ETF minute bars were used instead of the indexes. They can differ slightly from the actual index.
- **Fill assumption**: Orders were assumed to fill at the open of the next 1-minute bar. Slippage, gaps in the order book, volatility interruptions (VI) and missed fills are not included.
- **Order within a bar**: If a single 1-minute bar touched both the stop and a target, it was counted as a stop.
- **Safeguards are approximations**: The daily loss limit and consecutive stop-out rules were applied by removing later trades from the base simulation. In reality, other entries could have taken their place.
- **Short period**: Five trading days, and a very rough week with two sidecars. Some rules were chosen after looking at this week's data, so they risk overfitting.

*All figures in this post are reference results from applying fixed rules to past minute-bar data and are not investment advice. Real trading results can differ greatly depending on fills and costs.*
