---
title: "Alert Setup Guide — Sidecar and Flow Push Alerts on PC, Android and iPhone"
date: 2026-11-23T17:40:00+09:00
description: "How to set up push alerts that reach your phone or PC even with the site closed, for PC (Chrome/Edge), Android and iPhone. Get alerts for sidecars, large foreign/institutional trades and market mood changes."
tags: ["alerts", "push", "sidecar", "guide", "notice"]
---

You can turn on alerts with the **🔔 button** at the top right of the site. There are two kinds.

| Type | Where | Even with the site closed? | Notes |
|---|---|---|---|
| **📱 Push alerts** (recommended) | PC · Android · iPhone | **Yes** | The site server checks every minute and sends them |
| 💻 PC tab alerts | PC | No (a tab must stay open) | Scalping "consider entry" alerts are available only this way |

## Available alerts

Sent only during market hours on weekdays (09:00–15:30 KST). Each can be turned on or off in the 🔔 panel, and thresholds can be changed.

| Alert | When it arrives |
|---|---|
| Market mood change | The overall mood level changes (e.g. neutral → mildly bearish) |
| Large 5-min foreign/institutional buying or selling | Net buying changes by ₩30B+ (300억) on KOSPI or ₩10B+ (100억) on KOSDAQ within 5 minutes |
| Cumulative foreign/institutional milestones | The day's cumulative total passes each ₩300B (3,000억) on KOSPI or ₩100B (1,000억) on KOSDAQ |
| Net buying ↔ net selling flip | KOSPI foreign or program trading changes direction |
| Sidecar approaching / triggered | KOSPI200 futures ±4% (approaching) / ±5% (trigger condition); KOSDAQ150 ±5% (approaching) / ±6% (trigger condition) |

Tapping an alert opens the [Market Flow](/market/) page. If you are using the English site when you turn push on, alerts arrive in English.

---

## 💻 PC (Chrome · Edge)

1. Open **shinsadongtradememe.com** in a PC browser.
2. Click the **🔔 OFF** button at the top right.
3. Under **📱 Push alerts**, click **[Get push on this device]**.
4. When the "Show notifications" prompt appears below the address bar, click **Allow**.
5. Click **[Test push]** and check that an alert appears in the bottom-right corner.

**If alerts don't appear**
- In Windows **Settings → System → Notifications**, make sure Chrome (or Microsoft Edge) notifications are on.
- **Do not disturb (Focus)** hides alerts.
- If you fully quit the browser, missed alerts arrive the next time you open it. In Chrome, turn on **Settings → System → "Continue running background apps when Google Chrome is closed"** to receive them with the window closed.
- If you prefer to receive alerts with a site tab open, you can also use **💻 PC tab alerts → On**. Scalping "consider entry" alerts come only this way.

## 🤖 Android (Chrome)

1. Open **shinsadongtradememe.com** in **Chrome**. (Samsung Internet mostly works too, but Chrome is recommended.)
2. Tap the **🔔** button at the top right.
3. Tap **[Get push on this device]** and tap **Allow** when asked to allow notifications.
4. Use **[Test push]** to check that an alert arrives.

**Optional**: Chrome menu (⋮) → **Add to Home screen** or **Install app** creates an app-like icon.

**If alerts don't arrive**
- Check that **Settings → Apps → Chrome → Notifications** is on.
- Setting **Settings → Apps → Chrome → Battery** to "Unrestricted" keeps alerts on time in power-saving mode.

## 🍎 iPhone (iOS 16.4 or later)

On iPhone, **Safari cannot receive push directly — you must add the site to your Home Screen** first (Apple's policy).

1. Open **shinsadongtradememe.com** in **Safari**.
2. Tap the **Share button (□↑)** at the bottom → **Add to Home Screen** → **Add**.
3. Open the site from the new **TradeMeMe** icon on your Home Screen. (You must open it from this icon.)
4. Tap **🔔** at the top right → **[Get push on this device]** → **Allow**.
5. Use **[Test push]** to check that an alert arrives on the lock screen.

**If alerts don't arrive**
- Check that notifications are allowed in **Settings → Notifications → TradeMeMe**.
- **Focus (Do not disturb)** hides alerts.
- iOS versions below 16.4 do not support web push. Check your version in **Settings → General → Software Update**.
- If you deleted and re-added the Home Screen icon, turn push on again.

---

## Turning alerts off

🔔 → **[Turn off push on this device]** turns it off for that device only. Each device is turned on and off separately.

## FAQ

**Q. If I change alert conditions, does my phone update right away?**
Conditions changed on a device apply immediately to that device's push alerts. PC and phone are set up separately.

**Q. I get too many alerts.**
The same alert is sent only once within 5 minutes to a day. If it is still too many, raise the "large 5-min" threshold in the 🔔 panel or turn off items you don't need.

**Q. Is the KOSDAQ sidecar alert accurate?**
The official KOSDAQ sidecar condition is **KOSDAQ150 futures ±6% and the KOSDAQ150 index ±3%, both held for 1 minute or more**. The data the site uses has no KOSDAQ150 index or futures quotes, so it is estimated from the **KODEX KOSDAQ150 ETF**, which tracks KOSDAQ150. Check Korea Exchange announcements for whether it was actually triggered.

**Q. Do you collect personal information?**
Push alerts store only the "delivery address" your browser creates, plus your chosen conditions and language; no names, phone numbers or email addresses. Turning push off deletes that address.

*Alerts are for reference only and are not investment advice. They may be late or missed depending on data delays or network conditions.*
