---
title: "Update 2026-11-23 — Official Domain, 1-min/5-min Views, Windows Alerts (Sidecar, Large Foreign/Institutional Trades)"
date: 2026-11-23T16:50:00+09:00
description: "The official domain shinsadongtradememe.com is live, plus 1-minute/5-minute views on the Dashboard and Market Flow, 1-minute intraday refresh, 1-minute flow storage, a better bar selector on Scalping, and Windows alerts for sidecars, large foreign/institutional trades and market mood changes."
tags: ["update", "alerts", "sidecar", "flows", "notice"]
---

Here is everything that changed on the site today. The biggest changes are the **official address** and **Windows alerts**.

## At a glance

| Area | What changed |
|---|---|
| Address | Official domain **shinsadongtradememe.com** is live (www also works) |
| Refresh | Korean data refreshes **every minute** during market hours (weekdays 09:00–15:30 KST) and every 5 minutes after the close. Binance is always every minute |
| View interval | **[1m \| 5m]** buttons added to the Dashboard and Market Flow |
| Flow storage | Market flows (retail, foreign, institutional, program) are now stored every **1 minute** instead of 5 |
| Scalping | The 1/3/5-minute bar buttons moved to the top of the page |
| Alerts | 6 kinds of **Windows alerts**, toggled with the 🔔 button (sidecar, large foreign/institutional trades and more) |

---

## 1. Official domain

You can now visit **https://shinsadongtradememe.com**. `www.shinsadongtradememe.com` opens the same site. The old temporary address still works for now, but please update your bookmarks.

Google and Naver search registration is also done. It can take days to weeks to appear in search results.

## 2. 1-minute refresh during market hours

| Time | Korean data (flows, buy ratio, scalping bars) | Binance |
|---|---|---|
| Market hours (weekdays 09:00–15:30) | **Every minute** | Every minute |
| After the close | Every 5 minutes | Every minute |

Just keep the page open and new data appears automatically every minute. Because the server reuses the same data for a minute, it can lag the live market by 1–2 minutes.

## 3. Choosing 1-minute or 5-minute view

The top right of the [Dashboard](/dashboard/) and [Market Flow](/market/) now has **[1m | 5m]** buttons. They decide **how many minutes of data are grouped together**, separate from how often the page refreshes.

- **1-minute view**: for a fine-grained intraday picture. Charts, comparison tables, correlations and the written interpretation all switch to 1-minute bars.
- **5-minute view**: filters out noise to show the bigger trend.
- Your choice is saved in the browser for your next visit.

**Note on the Dashboard's 1-minute view**: the Binance taker buy ratio is calculated directly from 1-minute taker volume. However, **Binance provides the long-account ratio and top-trader long ratio only in 5-minute intervals**, so those two values change every 5 minutes even in the 1-minute view.

## 4. 1-minute flow storage

Market flows on [Market Flow](/market/) are built by saving Naver Finance's intraday cumulative figures, and the interval is now **1 minute** instead of 5. In the 1-minute view you can see how foreign, institutional and program flows change minute by minute.

1-minute storage began this afternoon. Earlier dates still display at 5-minute intervals even in the 1-minute view.

## 5. Scalping page: bar buttons moved

On the [Scalping](/scalp/) page, the **1m / 3m / 5m** buttons used to appear only after selecting a stock; they are now **at the top of the page**. You can pick the interval first, and "Scan all signals" uses the selected interval.

---

## 6. New: Windows alerts 🔔

Keep the site open on your PC and, when a condition you set occurs, **an alert pops up in the bottom-right corner of Windows** — even while you are looking at other programs (your brokerage app, Excel and so on).

### How to turn it on

1. Open the site in a PC browser (Chrome or Edge).
2. Click the **🔔 OFF** button at the right end of the menu.
3. Check **On** and click **Allow** when the browser asks to show notifications.
4. Click **Test alert** and check that an alert appears in the bottom-right corner.

Clicking an alert takes you straight to the relevant page (Market Flow or Scalping).

### Alert types (each can be turned on or off)

| Alert | When it fires | Default threshold |
|---|---|---|
| ① Market mood change | The overall mood level changes (e.g. neutral → mildly bearish) | 5 levels: bullish / mildly bullish / neutral / mildly bearish / bearish |
| ② Large 5-min foreign/institutional buying or selling | Net buying changes by more than the threshold within 5 minutes | KOSPI ₩30B (300억), KOSDAQ ₩10B (adjustable) |
| ③ Cumulative foreign/institutional milestones | The day's cumulative net buying or selling passes a set step | KOSPI every ₩300B (3,000억), KOSDAQ every ₩100B (adjustable) |
| ④ Net buying ↔ net selling flip | KOSPI foreign or program trading changes direction | Only when it crosses more than ₩10B (100억) the other way |
| ⑤ Sidecar approaching / triggered | KOSPI or KOSDAQ nears or hits the sidecar threshold | See below |
| ⑥ New scalping "consider entry" stocks | A stock newly shows "consider entry" in a scalping scan | Auto-scans every 5 minutes during market hours while the Scalping page is open |

### Sidecar alert thresholds

A sidecar is a market safeguard that **halts program-trading orders for 5 minutes** when futures prices move sharply. It can be triggered only once a day.

| Market | Official trigger (Korea Exchange) | This site's alert |
|---|---|---|
| KOSPI | KOSPI200 futures move ±5% or more from the previous close for 1 minute | **Approaching warning** at ±4% on futures; **trigger condition met** when ±5% is confirmed twice in a row (1+ minute) |
| KOSDAQ | KOSDAQ150 futures ±6% or more **and** the KOSDAQ150 index ±3% or more, both for 1 minute | **Approaching warning** at ±5% on the KODEX KOSDAQ150 ETF; **trigger condition met** at ±6% twice in a row |

> KOSDAQ150 index and futures quotes are not available in the data the site uses, so they are estimated from the **KODEX KOSDAQ150 ETF (229200)**, which tracks KOSDAQ150. Check Korea Exchange announcements for whether a sidecar was actually triggered.

### Good to know

- Checks run only on **weekdays 09:00–15:30 KST**, every minute.
- **At least one site tab must be open.** It can be in the background or behind other windows, but closing the browser stops alerts.
- To avoid repeats, the same alert is sent only once within a set period (5 minutes to a day). Multiple open tabs still produce one alert.
- **PC only.** Mobile browsers do not properly support web notifications, so the button is hidden there.
- Settings are saved only in the PC browser you use.
- If the test alert doesn't appear, check Windows **Settings → System → Notifications** to make sure Chrome (or Edge) notifications are on and **Do not disturb (Focus)** is off.

---

## What's next

I plan to post a **daily flow journal** summarizing each day's flows after the close. Send feedback on alert thresholds or the pages via the [Contact](/contact/) page.

*All figures and alerts on this site are for reference only and are not investment advice. Alerts may be late or missed due to data delays or errors, so confirm important decisions with your brokerage app and Korea Exchange announcements.*

*Translated from the original Korean post. Push alerts (which also work on phones) were added later — see the [push alert guide](/posts/2026-11-23-push-alert-guide/).*
