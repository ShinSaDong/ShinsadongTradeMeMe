---
title: "[Weekly Scalping Simulation] Nov 23–27 — Following the scalping signals as-is: 4 losing days out of 5, and Friday alone won most of it back"
date: 2026-11-27T15:50:00+09:00
description: "We mechanically followed the Scalping page's 'consider entry' signals on 3- and 5-minute bars for all five trading days this week. The 3-minute run lost a cumulative 147.3% over 1,108 trades and the 5-minute run lost 83.8% over 722 trades. Dropping the 'true support' pattern turned the week positive, but most of that gain came from Friday."
tags: ["scalping", "scalping simulation", "backtest", "minute bars", "3-minute bars", "5-minute bars", "weekly review"]
---

**In one line: following this week's scalping signals as-is would have lost money.** Monday through Thursday were losing days; only Friday made a big gain. By pattern, "true support" signals caused most of the losses, and removing that pattern turns the week positive. Even that gain comes mostly from Friday, though, so it is too early to say the rules work.

The market itself was rough this week. KOSPI fell 3.31% on Monday (sell-side sidecar), rose 6.32% on Tuesday, fell 6.16% on Wednesday (sell-side sidecar), edged up 0.29% on Thursday despite a Bank of Korea rate hike, and on Friday large-cap chipmakers rallied (Samsung Electronics up about 4%, SK hynix up about 5%). The direction flipped almost every day. See each day's [flow journal](/posts/) for details.

## How it was run

| Item | Details |
|---|---|
| Period | Mon 2026-11-23 to Fri 11-27, 09:00–15:20 each day |
| Stocks | Each day's top 50 stocks by minute-bar trading value (ETFs excluded) |
| Signals | The same engine as the [Scalping](/scalp/) page. Each time a 3- or 5-minute bar closed, it was recalculated using only data up to that moment, and we bought only when the overall verdict was **"consider entry"** |
| Entry | Open of the 1-minute bar after the signal bar |
| Exit | Sell half at target 1 → raise the stop on the other half to the entry price (breakeven) → sell the rest at target 2. Full exit if the stop is hit. Anything still open at 15:20 is closed at that price |
| Costs | 0.23% round-trip commission and tax deducted |
| Returns | Same amount per trade; per-trade returns are simply added up |

## Results for the week

| Bars | Trades | Win rate | Avg per trade | Weekly total | Profit factor |
|---|---:|---:|---:|---:|---:|
| 3-minute | 1,108 | 37.9% | −0.13% | **−147.3%** | 0.83 |
| 5-minute | 722 | 40.3% | −0.12% | **−83.8%** | 0.86 |

Profit factor (PF) is total profit on winning trades ÷ total loss on losing trades. Below 1 means more was lost than made.

### By day

| Date | 3-min trades | 3-min win rate | 3-min total | 5-min trades | 5-min win rate | 5-min total |
|---|---:|---:|---:|---:|---:|---:|
| Mon 11/23 | 270 | 33.7% | −33.9% | 145 | 45.5% | +1.9% |
| Tue 11/24 | 184 | 32.1% | −83.1% | 115 | 35.7% | −39.8% |
| Wed 11/25 | 228 | 39.5% | −44.1% | 130 | 42.3% | −16.9% |
| Thu 11/26 | 247 | 25.9% | −135.6% | 171 | 26.9% | −82.0% |
| Fri 11/27 | 179 | 64.8% | **+149.3%** | 161 | 51.6% | **+52.9%** |

- The 3-minute run lost four days in a row, then made +149.3% on Friday alone, which still did not cover the week.
- The worst day was **Thursday**. The early rebound faded after the rate hike; even opening-range breakouts, usually the most reliable setup, won only 22% of the time on 3-minute bars, and the overall win rate fell to 25.9%.
- Tuesday (+6.32% rebound) was also a loss. The index rose sharply, but signals that bought pullbacks in stocks that had already run did poorly — 3-minute MA pullback signals won only 25% of the time.

## What made money and what lost it

### By pattern (weekly total)

| Pattern | 3-min trades | 3-min win rate | 3-min total | 5-min trades | 5-min win rate | 5-min total |
|---|---:|---:|---:|---:|---:|---:|
| Opening range breakout | 200 | 48.0% | **+77.5%** | 168 | 45.8% | **+48.6%** |
| MA pullback | 217 | 42.9% | +6.3% | 160 | 36.9% | −28.8% |
| Fake breakdown | 52 | 42.3% | −3.0% | 21 | 57.1% | +8.0% |
| Prior-high breakout / re-break | 39 | 53.8% | −21.6% | 32 | 56.3% | −7.7% |
| True support | 600 | 31.3% | **−206.6%** | 341 | 36.7% | **−103.9%** |

**"True support" was the problem.** More than half of the 3-minute signals (600) were this pattern, and at a 31% win rate it caused most of the losses. In a volatile market, support that "held three times at the same level" broke easily on the fourth test. **Opening range breakouts**, on the other hand, made money steadily on both timeframes.

### By entry time

| Entry time | 3-min trades | 3-min win rate | 3-min total | 5-min trades | 5-min win rate | 5-min total |
|---|---:|---:|---:|---:|---:|---:|
| 09:15–10:00 | 148 | 50.0% | **+43.9%** | 53 | 64.2% | **+53.4%** |
| 10:00–11:00 | 367 | 36.0% | −83.6% | 120 | 30.8% | −50.6% |
| 11:00–13:00 | 378 | 38.4% | −31.8% | 364 | 43.7% | −26.8% |
| 13:00–14:30 | 149 | 38.9% | −30.4% | 144 | 36.8% | −34.1% |
| 14:30–15:15 | 66 | 16.7% | −45.5% | 41 | 19.5% | −25.8% |

**Only the first 45 minutes after the open made money.** Entries from 09:15 to 10:00 were positive on both timeframes; every later window was negative. **New entries after 14:30 won only about 20% of the time** — skipping them would have been better.

### By stop distance

| Stop distance | 3-min trades | 3-min win rate | 3-min total | 5-min trades | 5-min win rate | 5-min total |
|---|---:|---:|---:|---:|---:|---:|
| Under 1% | 540 | 29.3% | −154.6% | 290 | 33.8% | −63.4% |
| 1–2% | 356 | 41.0% | −74.9% | 259 | 40.5% | −35.5% |
| 2–3% | 107 | 46.7% | +14.7% | 92 | 41.3% | −25.0% |
| 3% or more | 105 | 62.9% | +67.5% | 81 | 61.7% | +40.0% |

This was the opposite of what we expected. **Signals with tight stops under 1% lost the most.** In a week when daily swings exceeded 5%, stops inside 1% were simply hit by intraday noise. Signals with wide stops won more than 60% of the time. But a wide stop loses a lot when it is wrong: the week's worst trade (Friday, Dongyang Express on 5-minute bars, −13.6%) was a plan with a 17% stop.

### By exit path

| Exit path | 3-min trades | 3-min total | 5-min trades | 5-min total |
|---|---:|---:|---:|---:|
| Stopped out | 619 | −792.2% | 362 | −505.7% |
| Target 1 → breakeven | 149 | +94.4% | 76 | +38.6% |
| Target 1 → target 2 | 216 | +493.7% | 158 | +369.9% |
| Target 1 → closed at 15:20 | 27 | +75.3% | 26 | +64.6% |
| Closed at 15:20 (no target hit) | 97 | −18.5% | 100 | −51.2% |

56% of 3-minute trades were stopped out before reaching target 1. Trades that reached their targets clearly made money (216 trades to target 2, +493.7%), but stops were hit far too often.

## What if the rules change

We recalculated on the same data with a few changed conditions.

| Condition | 3-min trades | 3-min win rate | 3-min total | 5-min trades | 5-min win rate | 5-min total |
|---|---:|---:|---:|---:|---:|---:|
| Base (engine as-is) | 1,108 | 37.9% | −147.3% | 722 | 40.3% | −83.8% |
| A. No entries after 14:30 + skip stops over 3% | 1,072 | 37.5% | −153.5% | 682 | 39.3% | −80.6% |
| B. Entries before 11:00 only | 515 | 40.0% | −39.6% | 173 | 41.0% | +2.8% |
| C. Exclude "true support" | 508 | 45.7% | +59.3% | 381 | 43.6% | +20.1% |
| D. C + no entries after 14:30 | 478 | 46.9% | +80.8% | 358 | 45.3% | +39.2% |
| E. D + skip stops under 1% | 375 | 50.7% | **+99.1%** | 282 | 50.4% | **+57.6%** |

- **Rule A did not help.** It was based on our earlier one-day (11/27) result, but over the full week, trades with stops over 3% were actually a source of profit. A good example of why rules should not be set from a single day.
- **Rules C–E were positive.** Dropping "true support", blocking late-afternoon entries and avoiding very tight stops pushed the win rate above 50%.
- **They still lean heavily on Friday.** Rule E on 3-minute bars by day: Mon +32.3%, Tue −25.2%, Wed −7.7%, Thu −45.1%, Fri +144.8%. Without Friday it is still negative.
- These conditions were **chosen after looking at this week's data**, so they risk overfitting. They only mean something once they are checked against next week's data.

## By stock (3-minute bars)

| Top gainers | Trades | Total | | Top losers | Trades | Total |
|---|---:|---:|---|---|---:|---:|
| Clobot | 11 | +11.4% | | Yellow Balloon Tour | 19 | −20.8% |
| Dongyang Express | 6 | +11.2% | | Wonik Holdings | 30 | −15.3% |
| Nanoteam | 6 | +11.1% | | SFA Semicon | 37 | −14.5% |
| AL Robot | 29 | +10.5% | | Simmtech | 26 | −12.9% |
| Aton | 3 | +10.3% | | Jusung Engineering | 22 | −10.9% |

The losers were mostly stocks where **signals fired dozens of times** (SFA Semicon 37 trades, Wonik Holdings 30). In stocks drifting up and down with no direction, repeated support and breakout signals piled up small stop-outs. Capping entries at two or three per stock per day may help.

## What to check next week

1. **Stricter "true support" conditions** — test skipping this pattern on volatile days (index ±2% or more).
2. **Entry time limit** — see whether blocking new entries after 14:30 holds up in other weeks.
3. **Minimum stop distance** — check how much filtering out plans with stops under 1% reduces stop-outs.
4. **Daily entry cap per stock** — see whether it stops repeated stop-outs in the same stock.

We'll post the results in the same format next Friday.

## Limitations of this simulation

- **Candidate bias**: Past daily trading-value rankings were not stored, so each day's top 50 was chosen from about 110 stocks that ranked high by trading value or volume on 11/27. Stocks that were hot only early in the week may be missing.
- **Fill assumption**: Orders were assumed to fill at the open of the next 1-minute bar. Slippage, gaps in the order book, volatility interruptions (VI) and missed fills are not included.
- **Order within a bar**: If a single 1-minute bar touched both the stop and a target, it was counted as a stop (the unfavorable assumption).
- **How returns are added**: A simple sum assuming the same amount per trade, which differs from a real account's compounded return. The 3- and 5-minute runs were treated as separate accounts.
- **Short period**: Five trading days, and a very rough week with two sidecars.

*All figures in this post are reference results from applying fixed rules to past minute-bar data and are not investment advice. Real trading results can differ greatly depending on fills and costs.*
