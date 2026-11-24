/* 사이트 알림 — 헤더 🔔 버튼
 * 1) 푸시 알림(웹 푸시): 사이트 서버가 1분마다 확인해서 보냄. 브라우저·사이트를 닫아도 PC·안드로이드·아이폰(홈 화면 앱)으로 옴
 * 2) PC 탭 알림: 사이트 탭이 열려 있을 때만 이 PC에 띄움 (푸시를 켠 기기에서는 시장 알림은 푸시가 대신함)
 * 알림 조건 판단은 alert-engine.js (서버와 같은 규칙)
 */
(function () {
  "use strict";
  const me = document.currentScript;
  const BASE = (me && me.dataset.base) || "/";
  const GUIDE = (me && me.dataset.guide) || BASE;
  const STATIC = me && me.dataset.mode === "static";
  const KEY = "tm.ntf.";
  const EN = !!window.TM_EN;
  const LANG = EN ? "en" : "ko";
  const T = (ko, en) => (EN ? en : ko);
  const DEF = { on: false, mood: true, frg: true, frgThr: 300, big: true, bigStep: 3000, flip: true, side: true, scalp: true };

  const ls = {
    get(k, d) { try { const v = localStorage.getItem(KEY + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (_) {} },
  };
  const cfg = () => Object.assign({}, DEF, ls.get("cfg", {}), { lang: LANG });
  const saveCfg = (c) => { ls.set("cfg", c); pushSyncCfg(c); };

  const UA = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/.test(UA) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(UA);
  const isMobile = isIOS || isAndroid;
  const standalone = window.navigator.standalone === true || (window.matchMedia && matchMedia("(display-mode: standalone)").matches);
  const pushSupported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const tabSupported = "Notification" in window && !isMobile; // 휴대폰 브라우저는 탭 알림(new Notification) 미지원
  const granted = () => "Notification" in window && Notification.permission === "granted";

  function kstNow() {
    const d = new Date(Date.now() + 9 * 3600e3);
    return { day: d.toISOString().slice(0, 10).replace(/-/g, ""), hm: d.getUTCHours() * 100 + d.getUTCMinutes(), dow: d.getUTCDay() };
  }
  function marketOpen() { const k = kstNow(); return k.dow >= 1 && k.dow <= 5 && k.hm >= 900 && k.hm <= 1530; }

  // ---------- PC 탭 알림 ----------
  function showTab(key, title, body, url, cooldownMs = 5 * 60e3) {
    if (!cfg().on || !granted() || !tabSupported) return false;
    const sent = ls.get("sent", {});
    if (sent[key] && Date.now() - sent[key] < cooldownMs) return false;
    sent[key] = Date.now();
    for (const k of Object.keys(sent)) if (Date.now() - sent[k] > 86400e3) delete sent[k];
    ls.set("sent", sent);
    try {
      const n = new Notification(title, { body, tag: key, icon: BASE + "icons/icon-192.png" });
      n.onclick = () => { window.focus(); if (url) location.href = url; n.close(); };
      return true;
    } catch (_) { return false; }
  }

  function loadScript(src, test) {
    if (test()) return Promise.resolve();
    return new Promise((res) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = res; document.head.appendChild(s); });
  }

  let busy = false;
  async function checkMarket() {
    const c = cfg();
    if (STATIC || !c.on || !granted() || !tabSupported || !marketOpen() || busy) return;
    if (ls.get("pushOn", false)) return; // 이 기기는 서버 푸시로 같은 알림을 받음
    busy = true;
    try {
      await Promise.all([loadScript(BASE + "js/flow-engine.js", () => !!window.Flow), loadScript(BASE + "js/alert-engine.js", () => !!window.AlertEngine)]);
      if (!window.AlertEngine) return;
      const d = await fetch(BASE + "api/flow?lite=1").then((r) => r.json());
      const snap = d && d.live;
      if (!snap || snap.bizdate !== kstNow().day) return;
      const hist = ls.get("hist", []).filter((h) => h.day === snap.bizdate && snap.ts - h.ts < 20 * 60e3);
      const r = window.AlertEngine.evaluate({ snap, hist, state: ls.get("state", null), cfg: c, now: Date.now(), Flow: window.Flow });
      for (const e of r.events) showTab(e.key, e.title, e.body, BASE + e.url.replace(/^\//, ""), 0);
      if (!hist.length || snap.ts - hist[hist.length - 1].ts > 30e3) hist.push({ ...r.point, day: snap.bizdate });
      ls.set("hist", hist.slice(-25));
      ls.set("state", r.state);
    } catch (_) {
    } finally { busy = false; }
  }

  // ---------- 웹 푸시 ----------
  const b64ToBytes = (s) => {
    const raw = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  };
  async function swReg() {
    return navigator.serviceWorker.register(BASE + "sw.js", { scope: BASE });
  }
  async function currentSub() {
    if (!pushSupported) return null;
    const reg = await navigator.serviceWorker.getRegistration(BASE);
    return reg ? reg.pushManager.getSubscription() : null;
  }
  const post = (path, body) => fetch(BASE + "api/push/" + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

  async function pushOn() {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error(T("알림 권한이 허용되지 않았습니다", "Notification permission was not granted"));
    const reg = await swReg();
    await navigator.serviceWorker.ready;
    const { key } = await fetch(BASE + "api/push/key").then((r) => r.json());
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
    const r = await post("subscribe", { sub: sub.toJSON(), cfg: cfg() });
    if (!r.ok) throw new Error(r.error || T("등록 실패", "Registration failed"));
    ls.set("pushOn", true);
    ls.set("pushLang", LANG);
  }
  async function pushOff() {
    const sub = await currentSub();
    if (sub) { await post("unsubscribe", { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
    ls.set("pushOn", false);
  }
  async function pushSyncCfg(c) {
    if (!ls.get("pushOn", false)) return;
    const sub = await currentSub().catch(() => null);
    if (sub) post("config", { endpoint: sub.endpoint, cfg: c }).catch(() => {});
  }

  // ---------- 헤더 버튼 + 설정 ----------
  function ui() {
    const nav = document.querySelector(".site-header .header-inner");
    if (!nav || STATIC) return;
    const wrap = document.createElement("div");
    wrap.className = "ntf";
    const iosNeedsHome = isIOS && !standalone;
    wrap.innerHTML = `<button type="button" class="ntf-btn" id="ntfBtn" aria-haspopup="true">🔔 <span id="ntfState">OFF</span></button>
      <div class="ntf-panel" id="ntfPanel" hidden>
        <div class="ntf-sec">
          <div class="ntf-row ntf-top"><b>${T("📱 푸시 알림", "📱 Push alerts")}</b><span class="ntf-msg" id="ntfPushState"></span></div>
          <div class="ntf-sub">${T("사이트 서버가 평일 09:00~15:30 동안 1분마다 확인해서 보냅니다. <b>브라우저나 사이트를 닫아도</b> 이 기기로 옵니다.", "The site server checks every minute on weekdays 09:00–15:30 KST and sends them. They arrive on this device <b>even with the browser or site closed</b>.")}</div>
          ${!pushSupported && !iosNeedsHome ? `<div class="ntf-warn">${T("이 브라우저는 푸시 알림을 지원하지 않습니다.", "This browser does not support push notifications.")}</div>` : ""}
          ${iosNeedsHome ? `<div class="ntf-warn">${T("아이폰은 사파리 <b>공유(□↑) → 홈 화면에 추가</b> 후, 홈 화면의 TradeMeMe 아이콘으로 열어야 푸시를 받을 수 있습니다.", "On iPhone, tap Safari <b>Share (□↑) → Add to Home Screen</b>, then open the site from the TradeMeMe home-screen icon to receive push alerts.")}</div>` : ""}
          <div class="ntf-row">
            <button type="button" class="tab" id="ntfPushBtn" ${!pushSupported ? "disabled" : ""}>${T("이 기기에서 푸시 받기", "Get push on this device")}</button>
            <button type="button" class="tab" id="ntfPushTest" hidden>${T("푸시 테스트", "Test push")}</button>
            <button type="button" class="tab" id="ntfDiag" ${!pushSupported ? "disabled" : ""}>${T("알림 진단", "Diagnose")}</button>
          </div>
          <div class="ntf-diag" id="ntfDiagOut" hidden></div>
        </div>
        ${tabSupported ? `<div class="ntf-sec">
          <div class="ntf-row ntf-top"><b>${T("💻 PC 탭 알림", "💻 PC tab alerts")}</b><label class="ntf-switch"><input type="checkbox" id="ntfOn"> ${T("켜기", "On")}</label></div>
          <div class="ntf-sub">${T("사이트 탭이 열려 있을 때만 이 PC 오른쪽 아래에 띄웁니다. 단타 \"진입 검토\" 알림은 이 방식으로만 받을 수 있습니다.", "Shown in the corner of this PC only while a site tab is open. Scalping \"consider entry\" alerts are available only this way.")}</div>
        </div>` : ""}
        <div class="ntf-sec">
          <div class="ntf-row ntf-top"><b>${T("알림 조건", "Alert conditions")}</b></div>
          <label class="ntf-row"><input type="checkbox" data-k="mood"> ${T("시장 분위기 단계 변화 (중립→약세 등)", "Market mood level change (e.g. neutral → bearish)")}</label>
          <label class="ntf-row"><input type="checkbox" data-k="frg"> ${T("외국인·기관 5분 대량 매수/매도 · 코스피", "Large 5-min foreign/institutional buying or selling · KOSPI ≥")} <input type="number" id="ntfThr" min="10" step="50" class="ntf-num">${T("억 이상 (코스닥 1/3)", "×₩100M (KOSDAQ 1/3)")}</label>
          <label class="ntf-row"><input type="checkbox" data-k="big"> ${T("외국인·기관 누적 대량 돌파 · 코스피", "Foreign/institutional cumulative milestones · KOSPI every")} <input type="number" id="ntfStep" min="100" step="500" class="ntf-num">${T("억 단위 (코스닥 1/3)", "×₩100M (KOSDAQ 1/3)")}</label>
          <label class="ntf-row"><input type="checkbox" data-k="flip"> ${T("외국인·프로그램 순매수↔순매도 전환", "Foreign/program flips between net buying and selling")}</label>
          <label class="ntf-row"><input type="checkbox" data-k="side"> ${T("코스피·코스닥 사이드카 근접·발동 조건 도달", "KOSPI/KOSDAQ sidecar approaching or triggered")}</label>
          ${tabSupported ? `<label class="ntf-row"><input type="checkbox" data-k="scalp"> ${T("단타 \"진입 검토\" 새 종목 (PC 탭 알림 전용 · 단타 화면을 열어 두면 5분마다 자동 스캔)", "New scalping \"consider entry\" stocks (PC tab alerts only · auto-scans every 5 min while the Scalping page is open)")}</label>` : ""}
        </div>
        <div class="ntf-row"><span class="ntf-msg" id="ntfMsg"></span></div>
        <div class="ntf-row"><a href="${GUIDE}">${T("PC · 안드로이드 · 아이폰 설정 방법 보기 →", "Setup guide for PC · Android · iPhone →")}</a></div>
      </div>`;
    nav.appendChild(wrap);
    const $ = (id) => document.getElementById(id);
    const msg = (t) => { $("ntfMsg").textContent = t || ""; };

    async function sync() {
      const c = cfg();
      let pushActive = false;
      try { pushActive = !!(await currentSub()) && ls.get("pushOn", false) && granted(); } catch (_) {}
      if (!pushActive && ls.get("pushOn", false) && pushSupported) ls.set("pushOn", false);
      const tabOn = c.on && granted() && tabSupported;
      const on = pushActive || tabOn;
      $("ntfState").textContent = on ? (pushActive ? T("푸시 ON", "Push ON") : "ON") : "OFF";
      $("ntfBtn").classList.toggle("on", on);
      $("ntfPushState").textContent = pushActive ? T("이 기기 받는 중", "receiving on this device") : T("꺼짐", "off");
      $("ntfPushBtn").textContent = pushActive ? T("이 기기 푸시 끄기", "Turn off push on this device") : T("이 기기에서 푸시 받기", "Get push on this device");
      $("ntfPushTest").hidden = !pushActive;
      if ($("ntfOn")) $("ntfOn").checked = tabOn;
      wrap.querySelectorAll("input[data-k]").forEach((el) => (el.checked = !!c[el.dataset.k]));
      $("ntfThr").value = c.frgThr;
      $("ntfStep").value = c.bigStep;
      if ("Notification" in window && Notification.permission === "denied") {
        msg(isIOS ? T("알림이 차단돼 있습니다. 아이폰 설정 → 알림 → TradeMeMe에서 허용해 주세요.", "Notifications are blocked. Allow them in iPhone Settings → Notifications → TradeMeMe.") : T("알림이 차단돼 있습니다. 주소창 왼쪽 자물쇠(사이트 설정) → 알림 → 허용으로 바꿔 주세요.", "Notifications are blocked. Click the lock (site settings) left of the address bar → Notifications → Allow."));
      }
    }

    $("ntfBtn").addEventListener("click", (e) => { e.stopPropagation(); $("ntfPanel").hidden = !$("ntfPanel").hidden; sync(); });
    document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) $("ntfPanel").hidden = true; });

    $("ntfPushBtn").addEventListener("click", async () => {
      const btn = $("ntfPushBtn");
      btn.disabled = true; msg(T("처리 중…", "Working…"));
      try {
        if (ls.get("pushOn", false) && (await currentSub())) { await pushOff(); msg(T("이 기기의 푸시 알림을 껐습니다.", "Push alerts turned off on this device.")); }
        else { await pushOn(); msg(T("등록됐습니다. '푸시 테스트'로 도착하는지 확인해 보세요.", "Registered. Use 'Test push' to check that alerts arrive.")); }
      } catch (e) { msg(T("푸시 등록 실패: ", "Push registration failed: ") + (e.message || e)); }
      btn.disabled = false; sync();
    });
    $("ntfPushTest").addEventListener("click", async () => {
      msg(T("보내는 중…", "Sending…"));
      try {
        const sub = await currentSub();
        const r = sub ? await post("test", { endpoint: sub.endpoint }) : { ok: false, error: T("구독 정보가 없습니다", "No subscription found") };
        msg(r.ok ? T("보냈습니다. 몇 초 안에 알림이 와야 합니다.", "Sent. An alert should arrive within a few seconds.") : T("실패: ", "Failed: ") + (r.error || r.status));
      } catch (e) { msg(T("실패: ", "Failed: ") + (e.message || e)); }
    });
    // 진단: 서버를 거치지 않고 서비스 워커가 직접 알림을 띄워 봄 → 표시 경로 확인 + 상태 요약
    $("ntfDiag").addEventListener("click", async () => {
      const out = $("ntfDiagOut");
      const L = [];
      const b = /Edg\//.test(UA) ? "Edge" : /Whale\//.test(UA) ? "Whale" : /SamsungBrowser/.test(UA) ? "Samsung Internet" : /Firefox\//.test(UA) ? "Firefox" : /Chrome\//.test(UA) ? "Chrome" : /Safari\//.test(UA) ? "Safari" : T("기타", "Other");
      L.push(`${T("브라우저", "Browser")}: ${b}${isIOS ? (standalone ? T(" (홈 화면 앱)", " (home-screen app)") : T(" (사파리 탭)", " (Safari tab)")) : ""}`);
      L.push(`${T("알림 권한", "Permission")}: ${"Notification" in window ? Notification.permission : T("없음", "none")}`);
      let reg = null, sub = null;
      try { reg = await navigator.serviceWorker.getRegistration(BASE); } catch (_) {}
      L.push(`${T("서비스 워커", "Service worker")}: ${reg && reg.active ? T("동작 중", "active") : reg ? T("설치 중", "installing") : T("없음", "none")}`);
      try { sub = reg ? await reg.pushManager.getSubscription() : null; } catch (_) {}
      L.push(`${T("푸시 등록", "Push subscription")}: ${sub ? T("있음", "yes") + " (" + new URL(sub.endpoint).host + ")" : T("없음", "none")}`);
      let shown = T("건너뜀", "skipped");
      if (reg && granted()) {
        try {
          await reg.showNotification(T("알림 진단 (서버 없이 직접)", "Alert diagnostic (direct, no server)"), { body: T("이 알림이 보이면 이 기기의 알림 표시는 정상입니다.", "If you see this, notifications display correctly on this device."), tag: "diag", icon: BASE + "icons/icon-192.png" });
          const list = await reg.getNotifications({ tag: "diag" });
          shown = list.length ? T("브라우저가 띄움", "shown by browser") : T("브라우저가 띄우지 못함", "browser could not show it");
        } catch (e) { shown = T("실패: ", "failed: ") + (e.message || e); }
      }
      L.push(`${T("직접 알림", "Direct alert")}: ${shown}`);
      if (sub) {
        try { const r = await post("test", { endpoint: sub.endpoint }); L.push(`${T("서버 푸시", "Server push")}: ${r.ok ? T("전송 성공", "sent") + " (" + r.status + ")" : T("실패 ", "failed ") + (r.error || r.status)}`); } catch (e) { L.push(T("서버 푸시: 요청 실패", "Server push: request failed")); }
      }
      L.push(T("→ '직접 알림'이 화면에 안 보이면 윈도우/휴대폰의 알림 설정 문제, 직접 알림은 보이는데 서버 푸시만 안 오면 푸시 수신 문제입니다.", "→ If the direct alert does not appear, check your Windows/phone notification settings. If it appears but server push does not, the problem is push delivery."));
      out.hidden = false;
      out.innerHTML = L.map((x) => `<div>${x}</div>`).join("");
    });

    if ($("ntfOn")) $("ntfOn").addEventListener("change", async (e) => {
      const c = cfg();
      if (e.target.checked) {
        const p = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
        c.on = p === "granted";
        if (c.on) { try { new Notification("ShinsadongTradeMeMe", { body: T("PC 탭 알림이 켜졌습니다.", "PC tab alerts are on."), tag: "test" }); } catch (_) {} }
      } else c.on = false;
      saveCfg(c); sync();
      if (c.on) checkMarket();
    });
    wrap.querySelectorAll("input[data-k]").forEach((el) => el.addEventListener("change", () => { const c = cfg(); c[el.dataset.k] = el.checked; saveCfg(c); }));
    $("ntfThr").addEventListener("change", (e) => { const c = cfg(); c.frgThr = Math.max(10, +e.target.value || DEF.frgThr); saveCfg(c); });
    $("ntfStep").addEventListener("change", (e) => { const c = cfg(); c.bigStep = Math.max(100, +e.target.value || DEF.bigStep); saveCfg(c); });
    window.addEventListener("storage", (e) => { if (e.key && e.key.startsWith(KEY)) sync(); });
    sync();
  }

  function start() {
    ui();
    if (STATIC) return;
    // 이미 푸시를 켠 기기는 서비스 워커를 최신으로 유지
    if (pushSupported && ls.get("pushOn", false)) {
      swReg().catch(() => {});
      // 언어를 바꿔 보고 있으면 서버 알림 문구 언어도 맞춤
      if (ls.get("pushLang", "ko") !== LANG) { ls.set("pushLang", LANG); pushSyncCfg(cfg()); }
    }
    const wait = 60e3 - (Date.now() % 60e3) + 20e3;
    setTimeout(() => { checkMarket(); setInterval(checkMarket, 60e3); }, wait);
    checkMarket();
  }

  window.TMNotify = {
    // 단타 알림(PC 탭 알림 전용)
    enabled: (k) => { const c = cfg(); return tabSupported && c.on && granted() && (!k || !!c[k]); },
    notify: showTab, marketOpen,
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
