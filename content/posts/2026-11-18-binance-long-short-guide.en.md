---
title: "Reading Korean Stock Flows with Binance Long/Short Ratios: Dashboard Guide"
date: 2026-11-18T09:00:00+09:00
description: "How to compare long/short ratios of Binance Samsung Electronics and SK hynix perpetual futures with Korean buy/sell ratios and retail, foreign and institutional flows."
tags: ["Binance", "long-short ratio", "flows", "Samsung Electronics", "SK hynix"]
---

In June 2026, Binance listed perpetual futures on **Samsung Electronics (SAMSUNGUSDT), SK hynix (SKHYNIXUSDT) and Hyundai Motor (HYUNDAIUSDT)**, and **LG Electronics (LGELECTRONICSUSDT), NAVER (NAVERUSDT) and Samsung Electro-Mechanics (SAMSUNGEMUSDT)** now trade as well. These contracts trade at night and on weekends when the Korean market is closed, and overseas traders' positions build up in real time. This blog's [Dashboard](/dashboard/) puts that sentiment side by side with actual flows in the Korean market.

## Indicators on the dashboard

### Binance side
| Indicator | Meaning |
|---|---|
| Long/short account ratio | Share of long vs short accounts among **all accounts** holding positions. Closer to retail sentiment. |
| Top trader position ratio | Long/short ratio by **position size** for the top 20% of accounts by margin. Closer to the direction of big players. |
| Taker buy ratio | Share of volume executed by **buyers hitting the market** over 5 minutes. The most direct comparison with trade direction in Korea. |

### Korean market side
| Indicator | Meaning |
|---|---|
| Buy-side volume ratio (estimate) | Volume split into buyer- and seller-initiated by the direction of each 1-minute bar (tick rule), summed every 5 minutes. An **estimate** similar to the "trade strength" figure in Korean brokerage apps. |
| Retail / foreign / institutional net buying | Daily net buying in shares by investor type. |

## Reading the comparison table

For each 5-minute bar during Korean trading hours (regular session 09:00–15:30, 08:00–20:00 including Nextrade pre- and after-market), the table shows:

- **Same direction**: both the Binance taker buy ratio and the Korean buy-side ratio are above (or both below) 50%
- **Diverging**: one side is buy-dominant while the other is sell-dominant

Persistent divergence can be read as a sign that overseas derivatives sentiment and Korean cash-market flows are moving differently.

## Caveats

- Binance's Korean stock futures **cannot be traded by Korean residents**. Here, public market data is used only as a reference indicator.
- The Korean buy/sell ratio is an **estimate based on minute bars**, not actual order-book trade data.
- All indicators are for reference only; trading decisions are your own responsibility.
