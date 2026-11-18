/* ShinsadongTradeMeMe 대시보드 */
(function () {
  "use strict";
  const TM = window.TM;
  const SYMBOLS = JSON.parse(document.getElementById("symbols-data").textContent || "[]");
  const REFRESH_MS = 5 * 60 * 1000;
  const BN = "https://fapi.binance.com";
  const $ = (id) => document.getElementById(id);

  const state = { selected: 0, charts: {}, exchangeSymbols: null, summaries: {} };

  // ---------- 포맷 ----------
  const pct = (v, d = 1) => (v === null || v === undefined || !isFinite(v) ? "-" : (v * 100).toFixed(d) + "%");
  const sPct = (v, d = 2) => (v === null || v === undefined || !isFinite(v) ? "-" : (v > 0 ? "+" : "") + v.toFixed(d) + "%");
  const num = (v, d = 0) => (v === null || v === undefined || !isFinite(v) ? "-" : Number(v).toLocaleString("ko-KR", { maximumFractionDigits: d, minimumFractionDigits: d }));
  const signCls = (v) => (v > 0 ? "pos" : v < 0 ? "neg" : "");
  const fmtDate = (d) => (d ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : "-");

  // ---------- 데이터 호출 ----------
  async function getJSON(url) {
    const r = await fetch(url);
    if (!r.ok) {
      let msg = r.status;
      try { msg = (await r.json()).error || msg; } catch (_) {}
      throw new Error(msg);
    }
    return r.json();
  }

  // 바이낸스: 브라우저 직접 호출 → 실패하면 사이트 프록시(/api/binance)
  async function binance(path, params) {
    const qs = new URLSearchParams(params).toString();
    try {
      return await getJSON(`${BN}${path}?${qs}`);
    } catch (e) {
      if ((window.TM_CONFIG || {}).krMode === "static") throw e; // GitHub Pages 에는 예비 프록시가 없음
      return await getJSON(`/api/binance?path=${encodeURIComponent(path)}&${qs}`);
    }
  }

  async function loadExchangeSymbols() {
    if (state.exchangeSymbols) return state.exchangeSymbols;
    try {
      const info = await binance("/fapi/v1/exchangeInfo", {});
      state.exchangeSymbols = new Set(info.symbols.filter((s) => s.status === "TRADING").map((s) => s.symbol));
    } catch (e) {
      state.exchangeSymbols = null;
    }
    return state.exchangeSymbols;
  }

  // 설정된 심볼 확인 + 미상장 종목 자동 감지
  async function resolveBinanceSymbols() {
    const set = await loadExchangeSymbols();
    for (const s of SYMBOLS) {
      s.bnStatus = "unknown";
      if (!set) { s.bnResolved = s.binance || ""; s.bnStatus = s.binance ? "configured" : "none"; continue; }
      if (s.binance && set.has(s.binance)) { s.bnResolved = s.binance; s.bnStatus = "listed"; continue; }
      const found = [...set].find((sym) => sym.endsWith("USDT") && (s.detect || []).some((k) => sym.startsWith(k)));
      s.bnResolved = found || "";
      s.bnStatus = found ? "detected" : "none";
    }
  }

  async function loadBinance(symbol, limit = 288) {
    const p = { symbol, period: "5m", limit };
    const [klines, global, top, taker] = await Promise.all([
      binance("/fapi/v1/klines", { symbol, interval: "5m", limit }),
      binance("/futures/data/globalLongShortAccountRatio", p).catch(() => []),
      binance("/futures/data/topLongShortPositionRatio", p).catch(() => []),
      binance("/futures/data/takerlongshortRatio", p).catch(() => []),
    ]);
    return { klines: TM.normKlines(klines), global: TM.normLS(global), top: TM.normLS(top), taker: TM.normTaker(taker) };
  }

  // 국내 데이터: Cloudflare 에서는 /api/kr 함수, GitHub Pages 에서는 빌드 때 받아둔 정적 JSON
  const CFG = window.TM_CONFIG || { krMode: "api" };
  async function loadKr(code, type) {
    const data = CFG.krMode === "static"
      ? await getJSON(`${CFG.krStaticBase}${code}-${type}.json?t=${Math.floor(Date.now() / 60000)}`)
      : await getJSON(`/api/kr?code=${code}&type=${type}`);
    if (data && data.error) throw new Error(data.error);
    return data;
  }
  const loadKrMinute = (code) => loadKr(code, "minute");
  const loadKrInvestor = (code) => loadKr(code, "investor");

  // ---------- 차트 ----------
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  function chart(id, config) {
    if (state.charts[id]) state.charts[id].destroy();
    const base = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { labels: { color: css("--muted"), boxWidth: 12 } } },
      scales: {
        x: { ticks: { color: css("--muted"), maxTicksLimit: 8, autoSkip: true }, grid: { color: "rgba(255,255,255,.04)" } },
        y: { ticks: { color: css("--muted") }, grid: { color: "rgba(255,255,255,.06)" } },
      },
    };
    config.options = deepMerge(base, config.options || {});
    state.charts[id] = new Chart($(id), config);
  }
  function deepMerge(a, b) {
    const out = { ...a };
    for (const k of Object.keys(b)) out[k] = b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) ? deepMerge(a[k] || {}, b[k]) : b[k];
    return out;
  }
  const pctAxis = { min: 0, max: 100, ticks: { callback: (v) => v + "%" } };

  function setBar(lId, sId, ratio, lLabel, sLabel) {
    const l = ratio === null || !isFinite(ratio) ? 50 : ratio * 100;
    $(lId).style.width = l + "%";
    $(sId).style.width = 100 - l + "%";
    $(lId).textContent = `${lLabel} ${ratio === null ? "-" : l.toFixed(1) + "%"}`;
    $(sId).textContent = `${sLabel} ${ratio === null ? "-" : (100 - l).toFixed(1) + "%"}`;
  }

  // ---------- 렌더: 바이낸스 ----------
  function renderBinance(sym, bn) {
    $("bnSymbol").textContent = sym.bnResolved ? `· ${sym.bnResolved}${sym.bnStatus === "detected" ? " (자동 감지)" : ""}` : "";
    const body = $("bnBody");
    if (!bn) {
      body.dataset.empty = "1";
      body.querySelectorAll(".chart-box, .kpis, .ratio-bar").forEach((el) => (el.style.display = "none"));
      let e = body.querySelector(".empty");
      if (!e) { e = document.createElement("div"); e.className = "empty"; body.appendChild(e); }
      e.textContent = sym.bnStatus === "error" ? "바이낸스 데이터를 불러오지 못했습니다." : `${sym.name}은(는) 아직 바이낸스 선물에 상장되지 않았습니다.`;
      return;
    }
    body.querySelectorAll(".chart-box, .kpis, .ratio-bar").forEach((el) => (el.style.display = ""));
    const e = body.querySelector(".empty"); if (e) e.remove();

    const lastK = bn.klines[bn.klines.length - 1];
    const lastG = bn.global[bn.global.length - 1];
    const lastT = bn.top[bn.top.length - 1];
    const lastTk = bn.taker[bn.taker.length - 1];
    $("bnPrice").textContent = lastK ? num(lastK.c, 2) : "-";
    $("bnLong").textContent = lastG ? pct(lastG.long) : "-";
    $("bnTop").textContent = lastT ? pct(lastT.long) : "-";
    $("bnTaker").textContent = lastTk ? pct(lastTk.ratio) : "-";
    setBar("bnBarL", "bnBarS", lastG ? lastG.long : null, "롱", "숏");

    chart("bnPriceChart", {
      type: "line",
      data: {
        labels: bn.klines.map((k) => TM.kstHM(k.ts)),
        datasets: [{ label: "가격 (USDT)", data: bn.klines.map((k) => k.c), borderColor: css("--accent"), borderWidth: 1.5, pointRadius: 0, tension: 0.1 }],
      },
    });
    const labels = bn.global.length ? bn.global : bn.taker;
    chart("bnRatioChart", {
      type: "line",
      data: {
        labels: labels.map((r) => TM.kstHM(r.ts)),
        datasets: [
          { label: "롱 계정 %", data: labels.map((r) => valAt(bn.global, r.ts, "long")), borderColor: css("--long"), borderWidth: 1.5, pointRadius: 0 },
          { label: "상위 트레이더 롱 %", data: labels.map((r) => valAt(bn.top, r.ts, "long")), borderColor: "#a78bfa", borderWidth: 1.2, pointRadius: 0 },
          { label: "테이커 매수 %", data: labels.map((r) => valAt(bn.taker, r.ts, "ratio")), borderColor: css("--accent"), borderWidth: 1, pointRadius: 0, borderDash: [4, 3] },
        ],
      },
      options: { scales: { y: pctAxis } },
    });
  }
  function valAt(series, ts, key) {
    const r = TM.lookup(series, TM.slot(ts));
    return r && r[key] !== null ? +(r[key] * 100).toFixed(2) : null;
  }

  // ---------- 렌더: 국내 ----------
  function renderKr(sym, kr, slots) {
    $("krCode").textContent = `· ${sym.krx}`;
    const body = $("krBody");
    if (!kr || !slots.length) {
      body.querySelectorAll(".chart-box, .kpis, .ratio-bar").forEach((el) => (el.style.display = "none"));
      let e = body.querySelector(".empty");
      if (!e) { e = document.createElement("div"); e.className = "empty"; body.appendChild(e); }
      e.textContent = kr && kr.error ? `국내 데이터를 불러오지 못했습니다: ${kr.error}` : "국내 장 데이터가 없습니다.";
      return;
    }
    body.querySelectorAll(".chart-box, .kpis, .ratio-bar").forEach((el) => (el.style.display = ""));
    const e = body.querySelector(".empty"); if (e) e.remove();

    const asOf = kr.fetchedAt ? ` · 데이터 기준 ${new Date(kr.fetchedAt).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour12: false, hour: "2-digit", minute: "2-digit" })}` : "";
    $("krDateLabel").textContent = `${fmtDate(kr.date)} 정규장 · 5분 · KST${asOf}`;
    const last = slots[slots.length - 1];
    const basic = kr.basic || {};
    $("krPrice").textContent = num(basic.price ?? last.close);
    const chg = basic.changeRate ?? (slots[0].open ? (last.close / slots[0].open - 1) * 100 : null);
    $("krChg").innerHTML = `<span class="${signCls(chg)}">${sPct(chg)}</span>`;
    const dayRatio = TM.totalBuyRatio(slots);
    $("krBuy").textContent = pct(dayRatio);
    $("krBuy5").textContent = pct(last.ratio);
    setBar("krBarB", "krBarS", dayRatio, "매수", "매도");

    const labels = slots.map((s) => TM.kstHM(s.ts));
    chart("krPriceChart", {
      type: "line",
      data: { labels, datasets: [{ label: "가격 (원)", data: slots.map((s) => s.close), borderColor: css("--up"), borderWidth: 1.5, pointRadius: 0, tension: 0.1 }] },
    });
    chart("krRatioChart", {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "매수 체결 %", data: slots.map((s) => (s.ratio === null ? null : +(s.ratio * 100).toFixed(1))), backgroundColor: slots.map((s) => (s.ratio >= 0.5 ? css("--up") : css("--down"))) },
        ],
      },
      options: { scales: { y: pctAxis }, plugins: { legend: { display: false } } },
    });
  }

  // ---------- 렌더: 비교표 ----------
  function renderComparison(sym, slots, bn) {
    const table = $("cmpTable");
    const stats = $("cmpStats");
    if (!slots.length) { table.innerHTML = ""; stats.innerHTML = ""; return; }
    const empty = { klines: [], global: [], top: [], taker: [] };
    const { rows, stats: st } = TM.buildComparison(slots, bn || empty);
    const k = (label, v) => `<div class="kpi"><div class="label">${label}</div><div class="value">${v}</div></div>`;
    stats.innerHTML =
      k("국내 매수 비율(당일)", pct(st.krBuyAvg)) +
      (bn ? k("바이낸스 테이커 매수(장중 평균)", pct(st.bnTakerAvg)) + k("바이낸스 롱 계정(장중 평균)", pct(st.bnLongAvg)) +
        k("같은 방향 비율", pct(st.agreeRate, 0)) + k("매수비율 상관계수", st.corrBuy === null ? "-" : st.corrBuy.toFixed(2)) +
        k("등락률 상관계수", st.corrChg === null ? "-" : st.corrChg.toFixed(2)) : "");

    const head = `<tr><th>시간</th><th>국내가</th><th>국내 등락</th><th>국내 매수%</th><th>거래량</th>` +
      (bn ? `<th>바이낸스가</th><th>바이낸스 등락</th><th>테이커 매수%</th><th>롱 계정%</th><th>상위 롱%</th><th>판정</th>` : "") + `</tr>`;
    const body = rows.slice().reverse().map((r) =>
      `<tr><td>${r.time}</td><td>${num(r.krClose)}</td><td class="${signCls(r.krChg)}">${sPct(r.krChg)}</td>` +
      `<td class="${r.krBuy >= 0.5 ? "pos" : "neg"}">${pct(r.krBuy)}</td><td>${num(r.krVol)}</td>` +
      (bn ? `<td>${num(r.bnClose, 2)}</td><td class="${signCls(r.bnChg)}">${sPct(r.bnChg)}</td>` +
        `<td class="${r.bnTaker >= 0.5 ? "pos" : "neg"}">${pct(r.bnTaker)}</td><td>${pct(r.bnLong)}</td><td>${pct(r.bnTop)}</td>` +
        `<td class="${r.verdict || ""}">${r.verdict === "agree" ? "같은 방향" : r.verdict === "diverge" ? "엇갈림" : "-"}</td>` : "") +
      `</tr>`).join("");
    table.innerHTML = `<thead>${head}</thead><tbody>${body}</tbody>`;
  }

  // ---------- 렌더: 수급 ----------
  function renderFlow(inv) {
    const table = $("flowTable");
    if (!inv || inv.error || !inv.rows || !inv.rows.length) {
      table.innerHTML = `<tbody><tr><td>수급 데이터를 불러오지 못했습니다${inv && inv.error ? ": " + inv.error : ""}</td></tr></tbody>`;
      if (state.charts.flowChart) state.charts.flowChart.destroy();
      return;
    }
    const rows = inv.rows.slice().sort((a, b) => a.date.localeCompare(b.date));
    chart("flowChart", {
      type: "bar",
      data: {
        labels: rows.map((r) => fmtDate(r.date).slice(5)),
        datasets: [
          { label: "개인" + (inv.rows[0].approx ? " (추정)" : ""), data: rows.map((r) => r.individual), backgroundColor: "#f59e0b" },
          { label: "외국인", data: rows.map((r) => r.foreign), backgroundColor: "#16c784" },
          { label: "기관", data: rows.map((r) => r.institution), backgroundColor: "#8b5cf6" },
        ],
      },
      options: { scales: { y: { ticks: { callback: (v) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + "M" : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(0) + "K" : v) } } } },
    });
    const sum = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
    table.innerHTML =
      `<thead><tr><th>날짜</th><th>종가</th><th>개인</th><th>외국인</th><th>기관</th><th>외국인 보유율</th></tr></thead><tbody>` +
      rows.slice().reverse().map((r) =>
        `<tr><td>${fmtDate(r.date)}</td><td>${num(r.close)}</td><td class="${signCls(r.individual)}">${num(r.individual)}</td>` +
        `<td class="${signCls(r.foreign)}">${num(r.foreign)}</td><td class="${signCls(r.institution)}">${num(r.institution)}</td>` +
        `<td>${r.foreignHoldRatio === null ? "-" : r.foreignHoldRatio.toFixed(2) + "%"}</td></tr>`).join("") +
      `<tr class="sum"><td>${rows.length}일 합계</td><td></td><td class="${signCls(sum("individual"))}">${num(sum("individual"))}</td>` +
      `<td class="${signCls(sum("foreign"))}">${num(sum("foreign"))}</td><td class="${signCls(sum("institution"))}">${num(sum("institution"))}</td><td></td></tr></tbody>`;
  }

  // ---------- 요약 카드 ----------
  function renderSummary() {
    $("summaryGrid").innerHTML = SYMBOLS.map((s, i) => {
      const m = state.summaries[i] || {};
      return `<div class="summary-card" data-i="${i}">
        <h3>${s.name} <span class="sub">${s.bnResolved || "바이낸스 미상장"}</span></h3>
        <div class="row"><span>국내 등락</span><b class="${signCls(m.krChg)}">${sPct(m.krChg)}</b></div>
        <div class="row"><span>국내 매수 비율</span><b>${pct(m.krBuy)}</b></div>
        <div class="row"><span>바이낸스 롱 계정</span><b>${pct(m.bnLong)}</b></div>
        <div class="row"><span>테이커 매수</span><b>${pct(m.bnTaker)}</b></div>
      </div>`;
    }).join("");
    $("summaryGrid").querySelectorAll(".summary-card").forEach((el) => el.addEventListener("click", () => select(+el.dataset.i)));
  }

  async function loadSummary(i) {
    const s = SYMBOLS[i];
    const m = {};
    await Promise.all([
      loadKrMinute(s.krx).then((kr) => {
        const slots = TM.tickRuleFiveMin(kr.bars || []);
        m.krBuy = TM.totalBuyRatio(slots);
        m.krChg = kr.basic && kr.basic.changeRate !== null ? kr.basic.changeRate : null;
      }).catch(() => {}),
      s.bnResolved ? Promise.all([
        binance("/futures/data/globalLongShortAccountRatio", { symbol: s.bnResolved, period: "5m", limit: 1 }),
        binance("/futures/data/takerlongshortRatio", { symbol: s.bnResolved, period: "5m", limit: 1 }),
      ]).then(([g, t]) => {
        const G = TM.normLS(g), T = TM.normTaker(t);
        m.bnLong = G.length ? G[G.length - 1].long : null;
        m.bnTaker = T.length ? T[T.length - 1].ratio : null;
      }).catch(() => {}) : null,
    ]);
    state.summaries[i] = m;
  }

  // ---------- 탭 ----------
  function renderTabs() {
    $("symbolTabs").innerHTML = SYMBOLS.map((s, i) =>
      `<button type="button" class="tab ${i === state.selected ? "active" : ""}" data-i="${i}">${s.name}<span class="badge">${s.bnResolved ? "B" : ""}</span></button>`).join("");
    $("symbolTabs").querySelectorAll(".tab").forEach((el) => el.addEventListener("click", () => select(+el.dataset.i)));
  }

  async function select(i) {
    state.selected = i;
    try { history.replaceState(null, "", "#" + SYMBOLS[i].krx); } catch (_) {}
    renderTabs();
    await loadSelected();
  }

  async function loadSelected() {
    const sym = SYMBOLS[state.selected];
    const [kr, bn, inv] = await Promise.all([
      loadKrMinute(sym.krx).catch((e) => ({ error: e.message })),
      sym.bnResolved ? loadBinance(sym.bnResolved).catch(() => { sym.bnStatus = "error"; return null; }) : Promise.resolve(null),
      loadKrInvestor(sym.krx).catch((e) => ({ error: e.message })),
    ]);
    const slots = kr && !kr.error ? TM.tickRuleFiveMin(kr.bars || []) : [];
    renderBinance(sym, bn);
    renderKr(sym, kr, slots);
    renderComparison(sym, slots, bn);
    renderFlow(inv);
    $("lastUpdated").textContent = new Date().toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour12: false });
  }

  async function refreshAll() {
    await loadSelected();
    await Promise.all(SYMBOLS.map((_, i) => loadSummary(i)));
    renderSummary();
  }

  async function init() {
    const hash = location.hash.replace("#", "");
    const idx = SYMBOLS.findIndex((s) => s.krx === hash);
    if (idx >= 0) state.selected = idx;
    await resolveBinanceSymbols();
    renderTabs();
    renderSummary();
    await refreshAll();
    $("refreshBtn").addEventListener("click", refreshAll);
    setInterval(() => { if (!document.hidden) refreshAll(); }, REFRESH_MS);
  }

  init();
})();
