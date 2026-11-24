---
title: "6 Practical Intraday Scalping Patterns — Setting Entry, Stop and Target with Numbers"
date: 2026-11-20T12:30:00+09:00
description: "Explains six minute-bar patterns — fake breakdown, true support, long upper wick, opening range breakout, moving-average pullback and prior-high re-break — and how the Scalping page calculates entry, stop and target prices."
tags: ["scalping", "minute bars", "trading setups", "stop loss", "VWAP"]
---

In scalping, knowing pattern names matters less than **deciding in advance, in numbers, where you buy, where you admit you were wrong, and where you sell**. The [Scalping](/scalp/) page finds the six patterns below on 1/3/5-minute bars of the top 50 stocks by volume and calculates those three prices. This post summarizes what each pattern means and how it is calculated.

## First: principles common to every pattern

| Principle | Details |
|---|---|
| Set the stop first | The stop is the price at which the pattern is "wrong". If you don't set it before entering, losses grow. |
| Reward:risk of at least 1.5 | Enter only when the target profit is at least 1.5× the stop distance (R). Even a 50% win rate then leaves a profit. |
| Max loss per trade | Cap what you lose on one wrong trade at around 1% of capital. Quantity = loss limit ÷ (entry − stop). |
| Check volume | Breakouts, recoveries and bounces are real only when volume rises. Moves without volume reverse easily. |
| Big picture first | Read the trend on 5-minute bars, then time the entry on 1–3-minute bars. |

## ① Fake breakdown (bear trap)

Price briefly drops below support and recovers right away. It often happens after stop orders parked below support are absorbed and price climbs again.

- **Key**: speed of recovery and volume. Price must return above support within 3 bars on rising volume.
- **Calculation**: entry = support reclaim price; stop = 1 tick below the breakdown low.
- **Caution**: if price falls back below support after recovering, it is a real breakdown. The page changes it to "Failed".

## ② True support

Buyers step in at the same price zone again and again, defending the low.

- **Key**: 3 or more lows within the same zone (±0.3%). Even better if volume shrinks on the way down and grows on the bounce.
- **Calculation**: entry = top of the support zone; stop = 2 ticks below the bottom of the zone. The tight stop gives a good reward:risk.
- **Caution**: if price is more than 1% above the zone, don't chase — wait for a pullback.

## ③ Long upper wick warning

A long upper wick after a spike means selling at the top was strong. It does not guarantee a decline on its own, but it is **a place to avoid chasing**.

- **Conditions**: upper wick at least 2× the body and over half of the bar's range, a bar 1.5× longer than usual, right after a spike or at the day's high.
- **Interpretation**: the warning stays while the next bars fail to retake the wick high. If holding, consider trimming.
- **Cleared**: when a bar closes back above the wick high.

## ④ Opening range breakout

Price breaks above the high/low box formed in the first 15 minutes, on volume. It works best before 10:30 a.m.

- **Calculation**: entry = top of the box + 1 tick; stop = 30% of the box height below the top; target = top + box height.
- **Bonus**: reliability rises when price pulls back to the top of the box after the breakout and holds it (a "retest").
- **Caution**: if price falls back inside the box after the breakout, exit quickly.

## ⑤ Moving-average pullback

Targets a bounce after an uptrend corrects to around the 5- and 20-period moving averages.

- **Conditions**: MA5 above MA20, MA20 rising, a pullback to the averages on shrinking volume, followed by an up bar on rising volume.
- **Calculation**: entry = close of the bounce bar; stop = 1 tick below the lower of the pullback low and MA20.
- **Caution**: until the bounce bar appears, the page shows "waiting for entry signal". Don't buy early.

## ⑥ Prior-high breakout and re-break

Price breaks the day's earlier high, the old high then acts as support on the pullback, and price rises again.

- **Conditions**: break of the prior high on 1.5× average volume → holds above it on the pullback → climbs back above the recent high.
- **Calculation**: entry = re-break close (or near the prior high); stop = the lower of prior high −0.5% and the pullback low.
- **Caution**: if the re-break fails, short-term profit-taking can pour in.

## Extra criteria the page applies

Points are added to or subtracted from the pattern score to choose the single best plan.

- **VWAP (volume-weighted average price)**: the day's average traded price. Above VWAP, most of today's buyers are in profit, which favors buyers; below it, every bounce meets break-even selling. Above +8, below −12.
- **5-minute trend**: direction of MA5 and MA20 on 5-minute bars. Up +10, down −15.
- **Time of day**: the first 15 minutes are penalized because the range is not set yet; 9:15–10:30 a.m. adds points to breakout signals; after 2:50 p.m. and the after-market are heavily penalized.
- **Chasing**: if price is already more than 1R above the entry, it shows "Wait for dip".

## How to read the result

| Label | Meaning |
|---|---|
| Consider entry | Price is near the planned entry. Set the stop first, then consider entering. |
| Wait for entry | Price is below the entry. Check whether it reclaims the entry price. |
| Wait for dip | Already up a lot — chasing territory. Wait for a pullback toward the entry. |
| Don't chase | A long-upper-wick warning is active. Avoid new buys until the high is retaken. |
| Wait | No setup matches the rules, or the score is low. |
| Stop zone | Price is below the plan's stop. |

## Limitations

- Minute-bar data cannot capture every order-book and trade detail.
- Patterns are found mechanically from past price moves, and the same pattern can play out differently depending on the market.
- The figures in this post and on the page are for learning and reference only, not investment advice. Trading decisions and their outcomes are your own responsibility.

*Translated from the original Korean post.*
