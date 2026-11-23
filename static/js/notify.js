/* 사이트 알림 (윈도우 오른쪽 아래 알림)
 * - 헤더의 🔔 버튼으로 켜고 끔. 설정은 이 브라우저에만 저장(localStorage)
 * - 사이트 탭이 하나라도 열려 있으면(다른 창을 보고 있어도) 평일 09:00~15:30 동안 1분마다 시장 수급을 확인
 * - 조건: 시장 분위기 단계 변화 / 외국인·기관 5분 대량 매매 / 외국인·기관 누적 대량 돌파 /
 *         외국인·프로그램 순매수↔순매도 전환 / 코스피·코스닥 사이드카 / 단타 "진입 검토" 새 종목
 */
(function () {
  "use strict";
  const me = document.currentScript;
  const BASE = (me && me.dataset.base) || "/";
  const STATIC = me && me.dataset.mode === "static";
  const KEY = "tm.ntf.";
  const DEF = { on: false, mood: true, frg: true, frgThr: 300, big: true, bigStep: 3000, flip: true, side: true, scalp: true };

  const ls = {
    get(k, d) { try { const v = localStorage.getItem(KEY + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (_) {} },
  };
  const cfg = () => Object.assign({}, DEF, ls.get("cfg", {}));
  const saveCfg = (c) => ls.set("cfg", c);
  const supported = () => "Notification" in window;
  const granted = () => supported() && Notification.permission === "granted";

  function kstNow() {
    const d = new Date(Date.now() + 9 * 3600e3);
    return { day: d.toISOString().slice(0, 10).replace(/-/g, ""), hm: d.getUTCHours() * 100 + d.getUTCMinutes(), dow: d.getUTCDay() };
  }
  function marketOpen() {
    const k = kstNow();
    return k.dow >= 1 && k.dow <= 5 && k.hm >= 900 && k.hm <= 1530;
  }

  // 같은 key 로는 cooldown 동안 한 번만 (탭이 여러 개여도 중복 방지)
  function notify(key, title, body, url, cooldownMs = 5 * 60e3) {
    const c = cfg();
    if (!c.on || !granted()) return false;
    const sent = ls.get("sent", {});
    if (sent[key] && Date.now() - sent[key] < cooldownMs) return false;
    sent[key] = Date.now();
    for (const k of Object.keys(sent)) if (Date.now() - sent[k] > 86400e3) delete sent[k];
    ls.set("sent", sent);
    try {
      const n = new Notification(title, { body, tag: key, requireInteraction: false });
      n.onclick = () => { window.focus(); if (url) location.href = url; n.close(); };
      return true;
    } catch (_) { return false; }
  }

  // ---------- 시장 수급 감시 ----------
  const eok = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(Math.round(v)).toLocaleString("ko-KR") + "억";

  function loadFlowEngine() {
    if (window.Flow) return Promise.resolve();
    return new Promise((res) => {
      const s = document.createElement("script");
      s.src = BASE + "js/flow-engine.js";
      s.onload = res; s.onerror = res;
      document.head.appendChild(s);
    });
  }

  let busy = false;
  async function checkMarket() {
    const c = cfg();
    if (STATIC || !c.on || !granted() || !marketOpen() || busy) return;
    busy = true;
    try {
      const d = await fetch(BASE + "api/flow?lite=1").then((r) => r.json());
      const snap = d && d.live;
      if (!snap || snap.bizdate !== kstNow().day) return;
      const K = snap.markets.KOSPI || {}, Q = snap.markets.KOSDAQ || {};
      const cur = {
        ts: snap.ts || Date.now(),
        kf: K.deal ? K.deal.frg : null, qf: Q.deal ? Q.deal.frg : null,
        ki: K.deal ? K.deal.ins : null, qi: Q.deal ? Q.deal.ins : null,
        kp: K.prog ? K.prog.total : null,
      };
      const marketUrl = BASE + "market/";

      // 1) 시장 분위기 단계 변화
      if (c.mood) {
        await loadFlowEngine();
        if (window.Flow) {
          const res = window.Flow.analyzeFlow(d);
          const o = res.overall;
          if (o !== null && isFinite(o)) {
            const label = o >= 40 ? "강세" : o >= 15 ? "약한 강세" : o > -15 ? "중립" : o > -40 ? "약한 약세" : "약세";
            const prev = ls.get("mood", null);
            if (prev && prev.day === kstNow().day && prev.label !== label) {
              notify("mood:" + label, `시장 분위기: ${prev.label} → ${label}`, `종합 점수 ${o > 0 ? "+" : ""}${o}. 외국인 코스피 ${eok(cur.kf || 0)}, 프로그램 ${eok(cur.kp || 0)}`, marketUrl, 10 * 60e3);
            }
            ls.set("mood", { day: kstNow().day, label });
          }
        }
      }

      // 2) 외국인·기관 5분 대량 매수/매도 (코스피 기준값, 코스닥은 1/3)
      const hist = ls.get("hist", []).filter((h) => h.day === kstNow().day && cur.ts - h.ts < 20 * 60e3);
      if (c.frg) {
        const old = hist.filter((h) => cur.ts - h.ts >= 4.5 * 60e3).pop();
        const thr = Math.max(10, +c.frgThr || DEF.frgThr);
        if (old) {
          for (const [who, name, now, then, t] of [
            ["외국인", "코스피", cur.kf, old.kf, thr], ["외국인", "코스닥", cur.qf, old.qf, thr / 3],
            ["기관", "코스피", cur.ki, old.ki, thr], ["기관", "코스닥", cur.qi, old.qi, thr / 3],
          ]) {
            if (now === null || then === null || now === undefined || then === undefined) continue;
            const dv = now - then;
            if (Math.abs(dv) >= t) {
              notify(`flow5:${who}:${name}:${dv > 0 ? "+" : "-"}`, `${who} ${name} 5분 대량 ${dv > 0 ? "매수" : "매도"} ${eok(dv)}`,
                `5분 사이 ${who} 순매수가 ${eok(dv)} 바뀌었습니다. 누적 ${eok(now)}.`, marketUrl);
            }
          }
        }
      }
      hist.push({ day: kstNow().day, ts: cur.ts, kf: cur.kf, qf: cur.qf, ki: cur.ki, qi: cur.qi, kp: cur.kp });

      // 2-1) 외국인·기관 누적 대량 돌파 (코스피 bigStep 억 단위, 코스닥은 1/3 단위)
      if (c.big) {
        const step = Math.max(100, +c.bigStep || DEF.bigStep);
        const lv = ls.get("level", {});
        if (lv.day !== kstNow().day) { for (const k of Object.keys(lv)) delete lv[k]; lv.day = kstNow().day; }
        for (const [k, who, name, v, st] of [
          ["kf", "외국인", "코스피", cur.kf, step], ["ki", "기관", "코스피", cur.ki, step],
          ["qf", "외국인", "코스닥", cur.qf, step / 3], ["qi", "기관", "코스닥", cur.qi, step / 3],
        ]) {
          if (v === null || v === undefined) continue;
          const level = Math.trunc(v / st); // 0, ±1, ±2 …
          const prev = lv[k] || 0;
          if (level !== 0 && (Math.sign(level) !== Math.sign(prev) || Math.abs(level) > Math.abs(prev))) {
            const mark = Math.round(level * st);
            notify(`big:${k}:${level}`, `${who} ${name} 누적 ${mark > 0 ? "순매수" : "순매도"} ${eok(mark)} 돌파`,
              `현재 누적 ${eok(v)}. 오늘 ${who} 매매가 한쪽으로 크게 쏠리고 있습니다.`, marketUrl, 6 * 3600e3);
          }
          lv[k] = level;
        }
        ls.set("level", lv);
      }

      // 2-2) 사이드카 (하루 방향별 1번)
      //  코스피: 코스피200 선물 ±5% 가 1분 이상 → 2번 연속 확인 시 알림. ±4% 근접 경고
      //  코스닥: 코스닥150 선물 ±6% + 코스닥150 지수 ±3% → KODEX 코스닥150 ETF ±6% 로 추정. ±5% 근접 경고
      if (c.side) {
        const sd = ls.get("side", {});
        if (sd.day !== kstNow().day) { for (const k of Object.keys(sd)) delete sd[k]; sd.day = kstNow().day; }
        const F = snap.markets.FUT || {}, E = snap.markets.KQ150 || {};
        for (const [k, name, rate, warn, hit, basis] of [
          ["k", "코스피", F.rate, 4, 5, "코스피200 선물"],
          ["q", "코스닥", E.rate, 5, 6, "코스닥150(ETF 추정)"],
        ]) {
          if (rate === null || rate === undefined || !isFinite(rate)) { sd[k + "n"] = 0; continue; }
          const dir = rate > 0 ? "매수" : "매도";
          const a = Math.abs(rate);
          sd[k + "n"] = a >= hit ? (sd[k + "n"] || 0) + 1 : 0;
          if (sd[k + "n"] >= 2) {
            notify(`side:${k}:${dir}`, `🚨 ${name} ${dir} 사이드카 발동 조건 도달`, `${basis} ${rate > 0 ? "+" : ""}${rate.toFixed(2)}%가 1분 넘게 유지. 프로그램 ${dir} 호가가 5분간 멈출 수 있습니다.`, marketUrl, 24 * 3600e3);
          } else if (a >= warn) {
            notify(`sidewarn:${k}:${dir}`, `⚠️ ${name} ${dir} 사이드카 근접`, `${basis} ${rate > 0 ? "+" : ""}${rate.toFixed(2)}% (발동 기준 ±${hit}%).`, marketUrl, 24 * 3600e3);
          }
        }
        ls.set("side", sd);
      }
      ls.set("hist", hist.slice(-25));

      // 3) 순매수 ↔ 순매도 전환 (±100억 넘게 넘어갈 때만, 잔떨림 무시)
      if (c.flip) {
        const sig = ls.get("sign", {});
        if (sig.day !== kstNow().day) { sig.day = kstNow().day; sig.kf = 0; sig.kp = 0; }
        for (const [k, name, v] of [["kf", "외국인(코스피)", cur.kf], ["kp", "프로그램(코스피)", cur.kp]]) {
          if (v === null || Math.abs(v) < 100) continue;
          const s = Math.sign(v);
          if (sig[k] && sig[k] !== s) {
            notify(`flip:${k}:${s}`, `${name} ${s > 0 ? "순매수 전환" : "순매도 전환"}`, `방향이 바뀌었습니다. 현재 누적 ${eok(v)}.`, marketUrl, 15 * 60e3);
          }
          sig[k] = s;
        }
        ls.set("sign", sig);
      }
    } catch (_) {
    } finally { busy = false; }
  }

  // ---------- 헤더 버튼 + 설정 ----------
  function ui() {
    const nav = document.querySelector(".site-header .header-inner");
    if (!nav || !supported()) return;
    const wrap = document.createElement("div");
    wrap.className = "ntf";
    wrap.innerHTML = `<button type="button" class="ntf-btn" id="ntfBtn" aria-haspopup="true">🔔 <span id="ntfState">OFF</span></button>
      <div class="ntf-panel" id="ntfPanel" hidden>
        <div class="ntf-row ntf-top"><b>알림</b><label class="ntf-switch"><input type="checkbox" id="ntfOn"> 켜기</label></div>
        <div class="ntf-sub">평일 09:00~15:30, 사이트 탭이 열려 있을 때 윈도우 오른쪽 아래에 알림을 띄웁니다.</div>
        <label class="ntf-row"><input type="checkbox" data-k="mood"> 시장 분위기 단계 변화 (중립→약세 등)</label>
        <label class="ntf-row"><input type="checkbox" data-k="frg"> 외국인·기관 5분 대량 매수/매도 · 코스피 <input type="number" id="ntfThr" min="10" step="50" class="ntf-num">억 이상 (코스닥 1/3)</label>
        <label class="ntf-row"><input type="checkbox" data-k="big"> 외국인·기관 누적 대량 돌파 · 코스피 <input type="number" id="ntfStep" min="100" step="500" class="ntf-num">억 단위 (코스닥 1/3)</label>
        <label class="ntf-row"><input type="checkbox" data-k="flip"> 외국인·프로그램 순매수↔순매도 전환</label>
        <label class="ntf-row"><input type="checkbox" data-k="side"> 코스피·코스닥 사이드카 근접·발동 조건 도달</label>
        <label class="ntf-row"><input type="checkbox" data-k="scalp"> 단타 "진입 검토" 새 종목 (단타 화면을 열어 두면 5분마다 자동 스캔)</label>
        <div class="ntf-row"><button type="button" class="tab" id="ntfTest">테스트 알림</button><span class="ntf-msg" id="ntfMsg"></span></div>
      </div>`;
    nav.appendChild(wrap);
    const $ = (id) => document.getElementById(id);
    const sync = () => {
      const c = cfg();
      const on = c.on && granted();
      $("ntfState").textContent = on ? "ON" : "OFF";
      $("ntfBtn").classList.toggle("on", on);
      $("ntfOn").checked = on;
      wrap.querySelectorAll("input[data-k]").forEach((el) => (el.checked = !!c[el.dataset.k]));
      $("ntfThr").value = c.frgThr;
      $("ntfStep").value = c.bigStep;
      const denied = Notification.permission === "denied";
      $("ntfMsg").textContent = denied ? "브라우저에서 알림이 차단돼 있습니다. 주소창 왼쪽 자물쇠 → 알림 → 허용으로 바꿔 주세요." : "";
    };
    $("ntfBtn").addEventListener("click", (e) => { e.stopPropagation(); $("ntfPanel").hidden = !$("ntfPanel").hidden; sync(); });
    document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) $("ntfPanel").hidden = true; });
    $("ntfOn").addEventListener("change", async (e) => {
      const c = cfg();
      if (e.target.checked) {
        const p = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
        c.on = p === "granted";
      } else c.on = false;
      saveCfg(c); sync();
      if (c.on) checkMarket();
    });
    wrap.querySelectorAll("input[data-k]").forEach((el) => el.addEventListener("change", () => { const c = cfg(); c[el.dataset.k] = el.checked; saveCfg(c); }));
    $("ntfThr").addEventListener("change", (e) => { const c = cfg(); c.frgThr = Math.max(10, +e.target.value || DEF.frgThr); saveCfg(c); });
    $("ntfStep").addEventListener("change", (e) => { const c = cfg(); c.bigStep = Math.max(100, +e.target.value || DEF.bigStep); saveCfg(c); });
    $("ntfTest").addEventListener("click", () => {
      if (!granted()) { $("ntfMsg").textContent = "먼저 '켜기'를 체크하고 브라우저 알림을 허용해 주세요."; return; }
      try { new Notification("ShinsadongTradeMeMe 테스트 알림", { body: "알림이 정상적으로 보입니다.", tag: "test" }); $("ntfMsg").textContent = "보냈습니다. 화면 오른쪽 아래를 확인하세요."; } catch (_) {}
    });
    window.addEventListener("storage", (e) => { if (e.key === KEY + "cfg") sync(); });
    sync();
  }

  // 1분마다(정각 +20초) 확인. 백그라운드 탭에서도 동작
  function start() {
    ui();
    if (STATIC) return;
    const tick = () => checkMarket();
    const wait = 60e3 - (Date.now() % 60e3) + 20e3;
    setTimeout(() => { tick(); setInterval(tick, 60e3); }, wait);
    tick();
  }

  window.TMNotify = {
    enabled: (k) => { const c = cfg(); return c.on && granted() && (!k || !!c[k]); },
    notify, marketOpen, _check: checkMarket,
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
