/* 단타 분석 화면 */
(function () {
  "use strict";
  const S = window.Scalp;
  const $ = (id) => document.getElementById(id);
  const EN = !!window.TM_EN;
  const T = (ko, en) => (EN ? en : ko);
  const LOC = EN ? "en-US" : "ko-KR";
  const CFG = window.TM_CONFIG || {};
  const state = { by: "volume", etf: false, list: [], selected: null, tf: 1, cache: new Map(), scan: new Map(), chart: null };

  const num = (v, d = 0) => (v === null || v === undefined || !isFinite(v) ? "-" : Number(v).toLocaleString(LOC, { maximumFractionDigits: d, minimumFractionDigits: d }));
  const sPct = (v, d = 2) => (v === null || v === undefined || !isFinite(v) ? "-" : (v > 0 ? "+" : "") + Number(v).toFixed(d) + "%");
  const cls = (v) => (v > 0 ? "pos" : v < 0 ? "neg" : "");
  const big = (v) => (EN
    ? (v >= 1e12 ? (v / 1e12).toFixed(1) + "T" : v >= 1e9 ? (v / 1e9).toFixed(1) + "B" : v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : v >= 1e4 ? Math.round(v / 1e3).toLocaleString(LOC) + "K" : num(v))
    : (v >= 1e12 ? (v / 1e12).toFixed(1) + "조" : v >= 1e8 ? Math.round(v / 1e8).toLocaleString("ko-KR") + "억" : v >= 1e4 ? Math.round(v / 1e4).toLocaleString("ko-KR") + "만" : num(v)));
  const TONE = { buy: "b-buy", sell: "b-sell", warn: "b-warn", neutral: "b-neutral" };

  async function getJSON(url) {
    const r = await fetch(url);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error || r.status);
    return j;
  }

  // ---------- 순위 ----------
  async function loadRank() {
    try {
      const j = await getJSON(`/api/rank?n=50&by=${state.by}&etf=${state.etf ? 1 : 0}`);
      state.list = j.stocks || [];
      if (window.TMRefresh) $("scMode").textContent = window.TMRefresh.label();
      $("rankAt").textContent = new Date(j.fetchedAt).toLocaleTimeString(LOC, { timeZone: "Asia/Seoul", hour12: false, hour: "2-digit", minute: "2-digit" });
      $("rankBy").textContent = state.by === "value" ? T("· 거래대금순", "· by value") : T("· 거래량순", "· by volume");
      renderRank();
      if (!state.selected && state.list.length) {
        const hash = location.hash.replace("#", "");
        const pick = state.list.find((s) => s.code === hash) || state.list[0];
        select(pick.code);
      }
    } catch (e) {
      $("rankTable").innerHTML = `<tbody><tr><td>${T("순위를 불러오지 못했습니다", "Could not load rankings")}: ${e.message}</td></tr></tbody>`;
    }
  }

  function renderRank() {
    const rows = state.list.map((s) => {
      const sc = state.scan.get(s.code);
      const badge = sc ? `<span class="badge sm ${TONE[sc.tone] || ""}">${sc.label}</span>` : "";
      return `<tr data-code="${s.code}" class="${state.selected === s.code ? "sel" : ""}">
        <td>${s.rank}</td>
        <td class="nm"><b>${s.name}</b><span class="sub">${s.code} · ${s.market === "KOSDAQ" ? T("코스닥", "KOSDAQ") : T("코스피", "KOSPI")}</span></td>
        <td>${num(s.price)}</td>
        <td class="${cls(s.changeRate)}">${sPct(s.changeRate)}</td>
        <td>${big(state.by === "value" ? s.value : s.volume)}</td>
        <td>${badge}</td></tr>`;
    }).join("");
    $("rankTable").innerHTML = `<thead><tr><th>#</th><th>${T("종목", "Stock")}</th><th>${T("현재가", "Price")}</th><th>${T("등락", "Chg")}</th><th>${state.by === "value" ? T("거래대금", "Value") : T("거래량", "Volume")}</th><th>${T("신호", "Signal")}</th></tr></thead><tbody>${rows}</tbody>`;
    $("rankTable").querySelectorAll("tr[data-code]").forEach((tr) => tr.addEventListener("click", () => {
      select(tr.dataset.code);
      if (window.innerWidth < 900) $("detail").scrollIntoView({ behavior: "smooth", block: "start" });
    }));
  }

  // ---------- 분봉 ----------
  async function minute(code) {
    const c = state.cache.get(code);
    if (c && Date.now() - c.at < 50 * 1000) return c.data;
    const data = await getJSON(`/api/kr?code=${code}&type=minute`);
    state.cache.set(code, { at: Date.now(), data });
    return data;
  }

  async function select(code) {
    state.selected = code;
    try { history.replaceState(null, "", "#" + code); } catch (_) {}
    renderRank();
    $("detailEmpty").hidden = true;
    $("detailBody").hidden = false;
    const s = state.list.find((x) => x.code === code) || { code, name: code };
    $("dName").textContent = `${s.name}`;
    $("dMeta").textContent = T("분봉 불러오는 중…", "Loading bars…");
    try {
      const data = await minute(code);
      if (state.selected !== code) return;
      renderDetail(s, data);
    } catch (e) {
      $("dMeta").textContent = T(`분봉을 불러오지 못했습니다: ${e.message}`, `Could not load bars: ${e.message}`);
    }
  }

  function renderDetail(s, data) {
    const isEtf = s.type && s.type !== "stock";
    const r = S.analyze(data.bars || [], { tf: state.tf, isEtf });
    const asOf = data.fetchedAt ? new Date(data.fetchedAt).toLocaleTimeString(LOC, { timeZone: "Asia/Seoul", hour12: false, hour: "2-digit", minute: "2-digit" }) : "-";
    const price = data.basic && data.basic.price ? data.basic.price : r.last ? r.last.c : null;
    const rate = data.basic ? data.basic.changeRate : s.changeRate;
    $("dMeta").innerHTML = T(`${s.code} · 현재가 <b>${num(price)}</b>원 <span class="${cls(rate)}">${sPct(rate)}</span> · ${data.date ? data.date.slice(4, 6) + "/" + data.date.slice(6) : ""} 분봉 · 기준 ${asOf}`, `${s.code} · price <b>₩${num(price)}</b> <span class="${cls(rate)}">${sPct(rate)}</span> · ${data.date ? data.date.slice(4, 6) + "/" + data.date.slice(6) : ""} bars · as of ${asOf}`);

    if (!r.ok) {
      $("vBadge").textContent = T("대기", "Waiting"); $("vBadge").className = "badge b-neutral";
      $("vTitle").textContent = T("분석 대기", "Waiting for data"); $("vText").textContent = r.reason;
      $("planGrid").innerHTML = ""; $("patterns").innerHTML = ""; $("ctx").innerHTML = "";
      drawChart(null);
      return;
    }
    state.scan.set(s.code, { label: r.action.label, tone: r.action.tone });
    renderRank();

    $("vBadge").textContent = r.action.label;
    $("vBadge").className = "badge " + (TONE[r.action.tone] || "");
    $("vTitle").textContent = r.best ? T(`${r.best.name} 기준 계획 (${r.best.finalScore}점)`, `Plan based on ${r.best.name} (score ${r.best.finalScore})`) : T("진입 계획 없음", "No entry plan");
    $("vText").textContent = r.timing;

    const p = r.best && r.action.code !== "avoid" ? r.best.plan : null;
    if (p) {
      const pc = (x) => sPct(((x - p.entry) / p.entry) * 100, 2);
      $("planGrid").innerHTML = [
        [T("매수가", "Entry"), num(p.entry), "plan-buy", `${T("현재가 대비", "vs price")} ${sPct(((p.entry - r.last.c) / r.last.c) * 100)}`],
        [T("손절가", "Stop"), num(p.stop), "plan-stop", `${pc(p.stop)} · ${T("1호가", "tick")} ${num(r.tick)}${T("원", " KRW")}`],
        [T("1차 목표", "Target 1"), num(p.target1), "plan-tgt", `${pc(p.target1)} · ${T("손익비", "R:R")} 1:${p.rr1.toFixed(1)}`],
        [T("2차 목표", "Target 2"), num(p.target2), "plan-tgt", `${pc(p.target2)} · ${T("손익비", "R:R")} 1:${((p.target2 - p.entry) / p.risk).toFixed(1)}`],
      ].map(([k, v, c, sub]) => `<div class="plan ${c}"><div class="label">${k}</div><div class="value">${v}</div><div class="sub">${sub}</div></div>`).join("");
    } else {
      $("planGrid").innerHTML = `<div class="plan"><div class="label">${T("계획", "Plan")}</div><div class="value">-</div><div class="sub">${T("조건이 갖춰지면 매수가·손절가가 표시됩니다.", "Entry and stop prices appear once conditions are met.")}</div></div>`;
    }

    const k = (label, v, c = "") => `<div class="kpi"><div class="label">${label}</div><div class="value ${c}">${v}</div></div>`;
    $("ctx").innerHTML =
      k(T("5분 추세", "5-min trend"), r.trend.label, r.trend.up === true ? "pos" : r.trend.up === false ? "neg" : "") +
      k("VWAP", `${num(r.vwap)} <small>${r.aboveVwap ? T("위", "above") : T("아래", "below")}</small>`, r.aboveVwap ? "pos" : "neg") +
      k(T("시간대", "Session"), r.time.phase) +
      `<div class="kpi wide"><div class="label">${T("시간대 조언", "Timing advice")}</div><div class="txt">${r.time.text}</div></div>`;

    const order = { buy: 0, warn: 1, info: 2 };
    $("patterns").innerHTML = r.signals.length
      ? r.signals.slice().sort((a, b) => order[a.side] - order[b.side] || a.no - b.no).map((sg) => {
          const fin = r.buys.find((b) => b.id === sg.id);
          const tag = sg.side === "warn" ? `<span class="badge sm b-warn">${T("경고", "Warning")}</span>` : sg.side === "info" ? `<span class="badge sm b-neutral">${T("관찰", "Watch")}</span>`
            : (() => {
                const far = sg.plan && (r.last.c - sg.plan.entry) / sg.plan.risk > 2;
                const [c, t] = !sg.holding ? ["b-neutral", T("실패", "Failed")] : far ? ["b-neutral", T("지난 자리", "Missed")] : ["b-buy", T("유효", "Valid")];
                return `<span class="badge sm ${c}">${t}</span>`;
              })();
          const plan = sg.plan ? `<div class="pat-plan">${T("매수", "Entry")} ${num(sg.plan.entry)} · ${T("손절", "Stop")} ${num(sg.plan.stop)} · ${T("목표", "Targets")} ${num(sg.plan.target1)} / ${num(sg.plan.target2)}</div>` : "";
          return `<div class="pat"><div class="pat-h"><span class="pat-no">${"①②③④⑤⑥"[sg.no - 1]}</span><b>${sg.name}</b> ${tag}
            <span class="sub">${S.hhmm(sg.at)}${fin ? ` · ${fin.finalScore}${T("점", " pts")}` : ""}</span></div><div class="pat-d">${sg.desc}</div>${plan}</div>`;
        }).join("")
      : `<div class="empty">${T(`현재 ${state.tf}분 봉에서 감지된 패턴이 없습니다. 다른 분봉도 확인해 보세요.`, `No patterns detected on ${state.tf}-minute bars right now. Try other intervals.`)}</div>`;

    drawChart(r, p);
    updateCalc(p);
  }

  // ---------- 차트 ----------
  function drawChart(r, p) {
    const el = $("chart");
    if (state.chart) { state.chart.remove(); state.chart = null; }
    if (!r || !window.LightweightCharts) { el.innerHTML = r ? `<div class="empty">${T("차트 라이브러리를 불러오지 못했습니다.", "Could not load the chart library.")}</div>` : ""; return; }
    el.innerHTML = "";
    const LC = window.LightweightCharts;
    const KST = 9 * 3600;
    const t = (ts) => Math.floor(ts / 1000) + KST;
    const chart = LC.createChart(el, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: "#9aa3b2", fontSize: 11 },
      grid: { vertLines: { color: "rgba(255,255,255,.04)" }, horzLines: { color: "rgba(255,255,255,.06)" } },
      rightPriceScale: { borderColor: "#2a303c" },
      timeScale: { borderColor: "#2a303c", timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0 },
      localization: { priceFormatter: (v) => Math.round(v).toLocaleString(LOC) },
    });
    const candles = chart.addCandlestickSeries({ upColor: "#e5484d", downColor: "#3e7bfa", borderVisible: false, wickUpColor: "#e5484d", wickDownColor: "#3e7bfa" });
    candles.priceScale().applyOptions({ scaleMargins: { top: 0.06, bottom: 0.24 } });
    candles.setData(r.bars.map((b) => ({ time: t(b.ts), open: b.o, high: b.h, low: b.l, close: b.c })));
    const vol = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "" });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    vol.setData(r.bars.map((b) => ({ time: t(b.ts), value: b.v, color: b.c >= b.o ? "rgba(229,72,77,.45)" : "rgba(62,123,250,.45)" })));
    const line = (vals, color) => {
      const s = chart.addLineSeries({ color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      s.setData(r.bars.map((b, i) => (vals[i] === null ? null : { time: t(b.ts), value: vals[i] })).filter(Boolean));
    };
    line(r.ind.vwap, "#f0b90b");
    line(r.ind.ma5, "#38bdf8");
    line(r.ind.ma20, "#a78bfa");
    if (p) {
      const pl = (price, color, title) => candles.createPriceLine({ price, color, lineWidth: 1, lineStyle: LC.LineStyle.Dashed, axisLabelVisible: true, title });
      pl(p.entry, "#16c784", T("매수", "Entry"));
      pl(p.stop, "#ea3943", T("손절", "Stop"));
      pl(p.target1, "#3e7bfa", T("1차", "T1"));
      pl(p.target2, "#3e7bfa", T("2차", "T2"));
    }
    const markers = r.signals.filter((s) => s.at).map((s) => ({
      time: t(s.at),
      position: s.side === "warn" ? "aboveBar" : "belowBar",
      color: s.side === "warn" ? "#f0b90b" : s.side === "buy" ? "#16c784" : "#9aa3b2",
      shape: s.side === "warn" ? "arrowDown" : "arrowUp",
      text: "①②③④⑤⑥"[s.no - 1],
    })).filter((m) => r.bars.some((b) => t(b.ts) === m.time)).sort((a, b) => a.time - b.time);
    candles.setMarkers(markers);
    chart.timeScale().fitContent();
    state.chart = chart;
  }

  // ---------- 수량 계산 ----------
  let lastPlan = null;
  function updateCalc(p) {
    if (p !== undefined) lastPlan = p;
    const out = $("calcOut");
    if (!lastPlan) { out.textContent = T("매수 계획이 있을 때 계산합니다.", "Calculated when there is an entry plan."); return; }
    const ps = S.positionSize(+$("capital").value, +$("riskPct").value, lastPlan.entry, lastPlan.stop);
    if (!ps) { out.textContent = T("투자금과 손실 한도를 입력하세요.", "Enter your capital and loss limit."); return; }
    out.innerHTML = T(`매수 수량 <b>${num(ps.qty)}주</b> · 투자금액 ${num(ps.amount)}원 · 손절 시 최대 손실 <b class="neg">${num(ps.maxLoss)}원</b> (한도 ${num(ps.riskMoney)}원)`, `Quantity <b>${num(ps.qty)} shares</b> · amount ₩${num(ps.amount)} · max loss at stop <b class="neg">₩${num(ps.maxLoss)}</b> (limit ₩${num(ps.riskMoney)})`);
  }

  // ---------- 전체 스캔 ----------
  async function scanAll() {
    const btn = $("scanBtn");
    btn.disabled = true;
    const list = state.list.slice();
    let done = 0;
    const worker = async () => {
      while (list.length) {
        const s = list.shift();
        try {
          const data = await minute(s.code);
          const r = S.analyze(data.bars || [], { tf: state.tf, isEtf: s.type !== "stock" });
          if (r.ok) state.scan.set(s.code, { label: r.action.label, tone: r.action.tone, score: r.best ? r.best.finalScore : 0 });
        } catch (_) {}
        done++;
        $("scanStatus").textContent = T(`${state.tf}분 봉 기준 스캔 중… ${done}/${state.list.length}`, `Scanning ${state.tf}-minute bars… ${done}/${state.list.length}`);
        if (done % 5 === 0) renderRank();
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    renderRank();
    const buys = state.list.filter((s) => (state.scan.get(s.code) || {}).tone === "buy").length;
    $("scanStatus").textContent = T(`${state.tf}분 봉 기준 스캔 완료 · "진입 검토" ${buys}개 종목. 신호는 시간이 지나면 바뀌니 다시 스캔하세요.`, `Scan of ${state.tf}-minute bars done · ${buys} "consider entry" stocks. Signals change over time, so rescan later.`);
    btn.disabled = false;
    state.lastScanAt = Date.now();
    notifyNewBuys();
  }

  // 알림: 이번 스캔에서 새로 "진입 검토"가 된 종목만 알림 (같은 날 같은 종목은 한 번)
  function notifyNewBuys() {
    const N = window.TMNotify;
    if (!N || !N.enabled("scalp")) return;
    const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    let seen = {};
    try { seen = JSON.parse(localStorage.getItem("tm.ntf.scalpSeen") || "{}"); } catch (_) {}
    if (seen.day !== day) seen = { day, codes: [] };
    const fresh = state.list.filter((s) => (state.scan.get(s.code) || {}).tone === "buy" && !seen.codes.includes(s.code));
    if (!fresh.length) return;
    seen.codes.push(...fresh.map((s) => s.code));
    try { localStorage.setItem("tm.ntf.scalpSeen", JSON.stringify(seen)); } catch (_) {}
    const names = fresh.slice(0, 5).map((s) => s.name).join(", ") + (fresh.length > 5 ? T(` 외 ${fresh.length - 5}개`, ` +${fresh.length - 5} more`) : "");
    N.notify("scalp:" + fresh.map((s) => s.code).join(","), T(`단타 진입 검토 ${fresh.length}종목 (${state.tf}분 봉)`, `Scalping: ${fresh.length} stocks to consider (${state.tf}-min bars)`), names, location.pathname + "#" + fresh[0].code, 0);
  }

  // ---------- 이벤트 ----------
  function segClick(id, key, cb) {
    $(id).querySelectorAll(".seg-btn").forEach((b) => b.addEventListener("click", () => {
      $(id).querySelectorAll(".seg-btn").forEach((x) => x.classList.toggle("active", x === b));
      cb(b.dataset[key]);
    }));
  }

  function init() {
    if (CFG.krMode === "static") {
      $("staticNotice").hidden = false;
      $("rankTable").innerHTML = `<tbody><tr><td>${T("실시간 주소에서 이용할 수 있습니다.", "Available on the live site.")}</td></tr></tbody>`;
      return;
    }
    segClick("sortSeg", "by", (v) => { state.by = v; loadRank(); });
    segClick("tfSeg", "tf", (v) => { state.tf = +v; state.scan.clear(); renderRank(); if (state.selected) select(state.selected); });
    $("etfChk").addEventListener("change", (e) => { state.etf = e.target.checked; loadRank(); });
    $("scanBtn").addEventListener("click", scanAll);
    // 단타 알림을 켜 두면 장중 5분마다 자동 스캔 (탭이 백그라운드여도)
    setInterval(() => {
      const N = window.TMNotify;
      if (!N || !N.enabled("scalp") || !N.marketOpen() || !state.list.length || $("scanBtn").disabled) return;
      if (state.lastScanAt && Date.now() - state.lastScanAt < 5 * 60e3 - 5000) return;
      scanAll();
    }, 60e3);
    ["capital", "riskPct"].forEach((id) => $(id).addEventListener("input", () => updateCalc()));
    loadRank();
    // 장중 1분, 장 마감 후 5분마다 선택 종목 분봉과 순위를 새로 받음
    let lastAt = Date.now();
    const R = window.TMRefresh;
    const tick = () => {
      if (R && !R.krDue(lastAt)) return;
      lastAt = Date.now();
      loadRank();
      if (state.selected) select(state.selected);
    };
    if (R) R.everyMinute(tick); else setInterval(tick, 60 * 1000);
  }
  init();
})();
