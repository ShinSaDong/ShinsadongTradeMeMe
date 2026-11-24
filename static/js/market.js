/* 종합투자 화면 */
(function () {
  "use strict";
  const F = window.Flow;
  const $ = (id) => document.getElementById(id);
  const T = window.L || ((ko) => ko);
  const LOC = window.TM_LOCALE || "ko-KR";
  const CFG = window.TM_CONFIG || {};
  const state = { data: null, res: null, m: "KOSPI", charts: {}, step: 5 };
  try { if (localStorage.getItem("tm.flowStep") === "1") state.step = 1; } catch (_) {}
  const isNum = (x) => x !== null && x !== undefined && isFinite(x);
  const num = (v, d = 0) => (!isNum(v) ? "-" : Number(v).toLocaleString(LOC, { maximumFractionDigits: d, minimumFractionDigits: d }));
  const sPct = (v, d = 2) => (!isNum(v) ? "-" : (v > 0 ? "+" : "") + Number(v).toFixed(d) + "%");
  const cls = (v) => (v > 0 ? "pos" : v < 0 ? "neg" : "");
  const eok = (v) => `<span class="${cls(v)}">${F.fmtEok(v)}</span>`;
  const raw = (v) => `<span class="${cls(v)}">${F.fmtRaw(v)}</span>`;
  const hm = (slot) => `${slot.slice(0, 2)}:${slot.slice(2)}`;
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  async function load(date) {
    try {
      const r = await fetch(`/api/flow?step=${state.step}${date ? "&date=" + date : ""}`);
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || r.status);
      state.data = j;
      state.res = F.analyzeFlow(j, state.step);
      render();
    } catch (e) {
      $("story").innerHTML = `<li>${T("수급 데이터를 불러오지 못했습니다", "Could not load flow data")}: ${e.message}</li>`;
    }
  }

  function applyStep() {
    document.querySelectorAll(".stepTxt").forEach((el) => (el.textContent = state.step + T("분", "-min")));
    $("stepSeg").querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("active", +b.dataset.step === state.step));
  }

  function render() {
    const { data, res } = state;
    if (window.TMRefresh) $("mkMode").textContent = window.TMRefresh.label();
    $("mkAt").textContent = `${data.date ? data.date.slice(4, 6) + "/" + data.date.slice(6) : "-"} ${new Date(data.fetchedAt).toLocaleTimeString(LOC, { timeZone: "Asia/Seoul", hour12: false, hour: "2-digit", minute: "2-digit" })}`;
    const days = Array.from(new Set([data.date, ...(data.days || [])].filter(Boolean))).sort().reverse();
    $("daySel").innerHTML = days.map((d) => `<option value="${d}" ${d === data.date ? "selected" : ""}>${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}</option>`).join("");

    // 종합 분위기
    const o = res.overall;
    const label = !isNum(o) ? T("데이터 없음", "No data") : o >= 40 ? T("강세", "Bullish") : o >= 15 ? T("약한 강세", "Mildly bullish") : o > -15 ? T("중립", "Neutral") : o > -40 ? T("약한 약세", "Mildly bearish") : T("약세", "Bearish");
    $("mdLabel").textContent = label;
    $("mdLabel").className = "mood-label " + (o >= 15 ? "pos" : o <= -15 ? "neg" : "");
    $("mdScore").textContent = isNum(o) ? (o > 0 ? "+" : "") + o : "-";
    $("mdMark").style.left = `${isNum(o) ? (o + 100) / 2 : 50}%`;

    // 시장 카드
    const card = (code) => {
      const M = res.markets[code];
      const L = M.last;
      if (!L) return `<div class="card mk-card"><h3>${M.name}</h3><div class="sub">${T("데이터 없음", "No data")}</div></div>`;
      const fmt = code === "FUT" ? raw : eok;
      const md = M.mood ? `<span class="badge sm ${M.mood.tone === "up" ? "b-buy" : M.mood.tone === "down" ? "b-sell" : "b-neutral"}">${M.mood.label} ${M.mood.score > 0 ? "+" : ""}${M.mood.score}</span>` : "";
      return `<div class="card mk-card">
        <div class="mk-top"><h3>${M.name}</h3>${md}</div>
        <div class="mk-price">${num(L.price, 2)} <span class="${cls(L.rate)}">${sPct(L.rate)}</span></div>
        <div class="mk-row"><span>${T("개인", "Retail")}</span>${fmt(L.ind)}</div>
        <div class="mk-row"><span>${T("외국인", "Foreign")}</span>${fmt(L.frg)}</div>
        <div class="mk-row"><span>${T("기관", "Institutional")}</span>${fmt(L.ins)}</div>
        ${isNum(L.prog) ? `<div class="mk-row"><span>${T("프로그램", "Program")}</span>${eok(L.prog)}</div><div class="mk-row sm"><span>${T("차익 / 비차익", "Arb / non-arb")}</span><span>${F.fmtEok(L.arb)} / ${F.fmtEok(L.nonArb)}</span></div>` : ""}
        ${isNum(L.up) ? `<div class="mk-row sm"><span>${T("상승 / 하락", "Up / down")}</span><span><b class="pos">${num(L.up)}</b> / <b class="neg">${num(L.down)}</b></span></div>` : ""}
      </div>`;
    };
    $("mkCards").innerHTML = ["KOSPI", "KOSDAQ", "FUT"].map(card).join("");
    renderMarket();
  }

  function renderMarket() {
    const M = state.res.markets[state.m];
    const fut = state.res.markets.FUT;
    const rows = M.rows;
    $("stTitle").textContent = T(`${M.name} 수급 해석`, `${M.name} flow interpretation`);
    $("stSub").textContent = rows.length ? `${hm(rows[0].slot)}~${hm(rows[rows.length - 1].slot)} · ${T(`${rows.length}개 ${state.step}분 구간`, `${rows.length} × ${state.step}-min bars`)}` : T(`저장된 ${state.step}분 구간이 아직 없습니다.`, `No ${state.step}-minute bars stored yet.`);
    $("story").innerHTML = M.story.length ? M.story.map((s) => `<li>${s}</li>`).join("") : `<li>${T("장이 열리면 1분마다 수급이 쌓이고 해석이 표시됩니다.", "Once the market opens, flows are recorded every minute and the interpretation appears here.")}</li>`;
    $("parts").innerHTML = M.mood ? M.mood.parts.map((p) =>
      `<div class="part"><span>${p.label}</span><div class="pbar"><div class="${p.v >= 0 ? "pp" : "pn"}" style="width:${Math.min(100, Math.abs(p.v) * 4)}%"></div></div><b class="${cls(p.v)}">${p.v > 0 ? "+" : ""}${p.v}</b></div>`).join("") : "";

    // 상관관계 표
    const cRow = (c) => {
      const cell = (r) => (isNum(r) ? `<span class="${Math.abs(r) >= 0.7 ? "strong" : Math.abs(r) >= 0.4 ? "mid" : "weak"} ${cls(r)}">${r.toFixed(2)}</span>` : "-");
      return `<tr><td>${c.label}</td><td>${cell(c.r)}</td><td>${cell(c.lead)}</td><td>${c.strength}</td><td>${c.n}</td></tr>`;
    };
    $("corrTable").innerHTML = `<thead><tr><th>${T("수급", "Flow")}</th><th>${T(`같은 ${state.step}분`, `Same ${state.step}m`)}</th><th>${T(`${state.step}분 선행`, `${state.step}m lead`)}</th><th>${T("강도", "Strength")}</th><th>${T("구간 수", "Bars")}</th></tr></thead><tbody>${M.corr.map(cRow).join("")}</tbody>` +
      (M.corr.every((c) => !isNum(c.r)) ? `<tbody><tr><td colspan="5">${T(`상관관계는 ${state.step}분 구간이 6개 이상 쌓이면 계산됩니다.`, `Correlations are calculated once 6 or more ${state.step}-minute bars are stored.`)}</td></tr></tbody>` : "");

    // 5분 표
    const fm = new Map(fut.rows.map((r) => [r.slot, r]));
    $("flowRows").innerHTML = `<thead><tr><th>${T("시간", "Time")}</th><th>${T("지수", "Index")}</th><th>${T(`${state.step}분 등락`, `${state.step}m chg`)}</th><th>${T("개인", "Retail")}</th><th>${T("외국인", "Foreign")}</th><th>${T("기관", "Inst.")}</th>${isNum((M.last || {}).prog) ? `<th>${T("프로그램", "Program")}</th>` : ""}${state.m === "KOSPI" ? `<th>${T("선물 외국인", "Fut. foreign")}</th>` : ""}<th>${T("외국인 누적", "Foreign cum.")}</th></tr></thead><tbody>` +
      rows.slice().reverse().map((r) => `<tr><td>${hm(r.slot)}${r.live ? ` <span class='sub'>${T("실시간", "live")}</span>` : ""}</td><td>${num(r.price, 2)}</td><td class="${cls(r.dPricePct)}">${sPct(r.dPricePct, 2)}</td>` +
        `<td>${eok(r.dInd)}</td><td>${eok(r.dFrg)}</td><td>${eok(r.dIns)}</td>${isNum((M.last || {}).prog) ? `<td>${eok(r.dProg)}</td>` : ""}` +
        `${state.m === "KOSPI" ? `<td>${raw((fm.get(r.slot) || {}).dFrg)}</td>` : ""}<td>${eok(r.frg)}</td></tr>`).join("") + "</tbody>";

    drawCharts(rows);
  }

  function chart(id, cfg) {
    if (state.charts[id]) state.charts[id].destroy();
    const base = {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { labels: { color: css("--muted"), boxWidth: 12 } } },
    };
    cfg.options = Object.assign(base, cfg.options || {});
    state.charts[id] = new Chart($(id), cfg);
  }

  function drawCharts(rows) {
    if (!window.Chart) return;
    const labels = rows.map((r) => hm(r.slot));
    const ax = (extra = {}) => Object.assign({ ticks: { color: css("--muted") }, grid: { color: "rgba(255,255,255,.06)" } }, extra);
    chart("cumChart", {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: T("개인", "Retail"), data: rows.map((r) => r.ind), borderColor: "#f59e0b", borderWidth: 1.5, pointRadius: 0, yAxisID: "y" },
          { label: T("외국인", "Foreign"), data: rows.map((r) => r.frg), borderColor: "#16c784", borderWidth: 2, pointRadius: 0, yAxisID: "y" },
          { label: T("기관", "Institutional"), data: rows.map((r) => r.ins), borderColor: "#8b5cf6", borderWidth: 1.5, pointRadius: 0, yAxisID: "y" },
          { label: T("프로그램", "Program"), data: rows.map((r) => r.prog), borderColor: "#38bdf8", borderWidth: 1, borderDash: [4, 3], pointRadius: 0, yAxisID: "y" },
          { label: T("지수", "Index"), data: rows.map((r) => r.price), borderColor: "#e6e9ef", borderWidth: 1, pointRadius: 0, yAxisID: "y1" },
        ],
      },
      options: { scales: { x: ax({ ticks: { color: css("--muted"), maxTicksLimit: 8 } }), y: ax(), y1: ax({ position: "right", grid: { display: false } }) } },
    });
    chart("deltaChart", {
      data: {
        labels,
        datasets: [
          { type: "bar", label: T(`외국인 ${state.step}분(억)`, `Foreign ${state.step}m (₩100M)`), data: rows.map((r) => r.dFrg), backgroundColor: rows.map((r) => (r.dFrg >= 0 ? "rgba(229,72,77,.7)" : "rgba(62,123,250,.7)")), yAxisID: "y" },
          { type: "line", label: T(`지수 ${state.step}분(%)`, `Index ${state.step}m (%)`), data: rows.map((r) => r.dPricePct), borderColor: "#f0b90b", borderWidth: 1.5, pointRadius: 0, yAxisID: "y1" },
        ],
      },
      options: { scales: { x: ax({ ticks: { color: css("--muted"), maxTicksLimit: 8 } }), y: ax(), y1: ax({ position: "right", grid: { display: false } }) } },
    });
  }

  function init() {
    if (CFG.krMode === "static") { $("mkStatic").hidden = false; return; }
    $("mkTabs").querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => {
      $("mkTabs").querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === b));
      state.m = b.dataset.m;
      if (state.res) renderMarket();
    }));
    applyStep();
    $("stepSeg").querySelectorAll(".seg-btn").forEach((b) => b.addEventListener("click", () => {
      state.step = +b.dataset.step;
      try { localStorage.setItem("tm.flowStep", String(state.step)); } catch (_) {}
      applyStep();
      load($("daySel").value || undefined);
    }));
    $("daySel").addEventListener("change", (e) => load(e.target.value));
    $("mkRefresh").addEventListener("click", () => load($("daySel").value));
    load();
    // 장중 1분, 장 마감 후 5분마다 (오늘 날짜를 보고 있을 때만)
    let lastAt = Date.now();
    const R = window.TMRefresh;
    const tick = () => {
      if (state.data && $("daySel").value !== state.data.date) return;
      if (R && !R.krDue(lastAt)) return;
      lastAt = Date.now();
      load();
    };
    if (R) R.everyMinute(tick); else setInterval(tick, 60 * 1000);
  }
  init();
})();
