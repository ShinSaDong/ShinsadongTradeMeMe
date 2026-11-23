/* 단타 분석 화면 */
(function () {
  "use strict";
  const S = window.Scalp;
  const $ = (id) => document.getElementById(id);
  const CFG = window.TM_CONFIG || {};
  const state = { by: "volume", etf: false, list: [], selected: null, tf: 1, cache: new Map(), scan: new Map(), chart: null };

  const num = (v, d = 0) => (v === null || v === undefined || !isFinite(v) ? "-" : Number(v).toLocaleString("ko-KR", { maximumFractionDigits: d, minimumFractionDigits: d }));
  const sPct = (v, d = 2) => (v === null || v === undefined || !isFinite(v) ? "-" : (v > 0 ? "+" : "") + Number(v).toFixed(d) + "%");
  const cls = (v) => (v > 0 ? "pos" : v < 0 ? "neg" : "");
  const big = (v) => (v >= 1e12 ? (v / 1e12).toFixed(1) + "조" : v >= 1e8 ? Math.round(v / 1e8).toLocaleString("ko-KR") + "억" : v >= 1e4 ? Math.round(v / 1e4).toLocaleString("ko-KR") + "만" : num(v));
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
      $("rankAt").textContent = new Date(j.fetchedAt).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour12: false, hour: "2-digit", minute: "2-digit" });
      $("rankBy").textContent = state.by === "value" ? "· 거래대금순" : "· 거래량순";
      renderRank();
      if (!state.selected && state.list.length) {
        const hash = location.hash.replace("#", "");
        const pick = state.list.find((s) => s.code === hash) || state.list[0];
        select(pick.code);
      }
    } catch (e) {
      $("rankTable").innerHTML = `<tbody><tr><td>순위를 불러오지 못했습니다: ${e.message}</td></tr></tbody>`;
    }
  }

  function renderRank() {
    const rows = state.list.map((s) => {
      const sc = state.scan.get(s.code);
      const badge = sc ? `<span class="badge sm ${TONE[sc.tone] || ""}">${sc.label}</span>` : "";
      return `<tr data-code="${s.code}" class="${state.selected === s.code ? "sel" : ""}">
        <td>${s.rank}</td>
        <td class="nm"><b>${s.name}</b><span class="sub">${s.code} · ${s.market === "KOSDAQ" ? "코스닥" : "코스피"}</span></td>
        <td>${num(s.price)}</td>
        <td class="${cls(s.changeRate)}">${sPct(s.changeRate)}</td>
        <td>${big(state.by === "value" ? s.value : s.volume)}</td>
        <td>${badge}</td></tr>`;
    }).join("");
    $("rankTable").innerHTML = `<thead><tr><th>#</th><th>종목</th><th>현재가</th><th>등락</th><th>${state.by === "value" ? "거래대금" : "거래량"}</th><th>신호</th></tr></thead><tbody>${rows}</tbody>`;
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
    $("dMeta").textContent = "분봉 불러오는 중…";
    try {
      const data = await minute(code);
      if (state.selected !== code) return;
      renderDetail(s, data);
    } catch (e) {
      $("dMeta").textContent = `분봉을 불러오지 못했습니다: ${e.message}`;
    }
  }

  function renderDetail(s, data) {
    const isEtf = s.type && s.type !== "stock";
    const r = S.analyze(data.bars || [], { tf: state.tf, isEtf });
    const asOf = data.fetchedAt ? new Date(data.fetchedAt).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour12: false, hour: "2-digit", minute: "2-digit" }) : "-";
    const price = data.basic && data.basic.price ? data.basic.price : r.last ? r.last.c : null;
    const rate = data.basic ? data.basic.changeRate : s.changeRate;
    $("dMeta").innerHTML = `${s.code} · 현재가 <b>${num(price)}</b>원 <span class="${cls(rate)}">${sPct(rate)}</span> · ${data.date ? data.date.slice(4, 6) + "/" + data.date.slice(6) : ""} 분봉 · 기준 ${asOf}`;

    if (!r.ok) {
      $("vBadge").textContent = "대기"; $("vBadge").className = "badge b-neutral";
      $("vTitle").textContent = "분석 대기"; $("vText").textContent = r.reason;
      $("planGrid").innerHTML = ""; $("patterns").innerHTML = ""; $("ctx").innerHTML = "";
      drawChart(null);
      return;
    }
    state.scan.set(s.code, { label: r.action.label, tone: r.action.tone });
    renderRank();

    $("vBadge").textContent = r.action.label;
    $("vBadge").className = "badge " + (TONE[r.action.tone] || "");
    $("vTitle").textContent = r.best ? `${r.best.name} 기준 계획 (${r.best.finalScore}점)` : "진입 계획 없음";
    $("vText").textContent = r.timing;

    const p = r.best && r.action.code !== "avoid" ? r.best.plan : null;
    if (p) {
      const pc = (x) => sPct(((x - p.entry) / p.entry) * 100, 2);
      $("planGrid").innerHTML = [
        ["매수가", num(p.entry), "plan-buy", `현재가 대비 ${sPct(((p.entry - r.last.c) / r.last.c) * 100)}`],
        ["손절가", num(p.stop), "plan-stop", `${pc(p.stop)} · 1호가 ${num(r.tick)}원`],
        ["1차 목표", num(p.target1), "plan-tgt", `${pc(p.target1)} · 손익비 1:${p.rr1.toFixed(1)}`],
        ["2차 목표", num(p.target2), "plan-tgt", `${pc(p.target2)} · 손익비 1:${((p.target2 - p.entry) / p.risk).toFixed(1)}`],
      ].map(([k, v, c, sub]) => `<div class="plan ${c}"><div class="label">${k}</div><div class="value">${v}</div><div class="sub">${sub}</div></div>`).join("");
    } else {
      $("planGrid").innerHTML = `<div class="plan"><div class="label">계획</div><div class="value">-</div><div class="sub">조건이 갖춰지면 매수가·손절가가 표시됩니다.</div></div>`;
    }

    const k = (label, v, c = "") => `<div class="kpi"><div class="label">${label}</div><div class="value ${c}">${v}</div></div>`;
    $("ctx").innerHTML =
      k("5분 추세", r.trend.label, r.trend.up === true ? "pos" : r.trend.up === false ? "neg" : "") +
      k("VWAP", `${num(r.vwap)} <small>${r.aboveVwap ? "위" : "아래"}</small>`, r.aboveVwap ? "pos" : "neg") +
      k("시간대", r.time.phase) +
      `<div class="kpi wide"><div class="label">시간대 조언</div><div class="txt">${r.time.text}</div></div>`;

    const order = { buy: 0, warn: 1, info: 2 };
    $("patterns").innerHTML = r.signals.length
      ? r.signals.slice().sort((a, b) => order[a.side] - order[b.side] || a.no - b.no).map((sg) => {
          const fin = r.buys.find((b) => b.id === sg.id);
          const tag = sg.side === "warn" ? `<span class="badge sm b-warn">경고</span>` : sg.side === "info" ? `<span class="badge sm b-neutral">관찰</span>`
            : (() => {
                const far = sg.plan && (r.last.c - sg.plan.entry) / sg.plan.risk > 2;
                const [c, t] = !sg.holding ? ["b-neutral", "실패"] : far ? ["b-neutral", "지난 자리"] : ["b-buy", "유효"];
                return `<span class="badge sm ${c}">${t}</span>`;
              })();
          const plan = sg.plan ? `<div class="pat-plan">매수 ${num(sg.plan.entry)} · 손절 ${num(sg.plan.stop)} · 목표 ${num(sg.plan.target1)} / ${num(sg.plan.target2)}</div>` : "";
          return `<div class="pat"><div class="pat-h"><span class="pat-no">${"①②③④⑤⑥"[sg.no - 1]}</span><b>${sg.name}</b> ${tag}
            <span class="sub">${S.hhmm(sg.at)}${fin ? ` · ${fin.finalScore}점` : ""}</span></div><div class="pat-d">${sg.desc}</div>${plan}</div>`;
        }).join("")
      : `<div class="empty">현재 ${state.tf}분 봉에서 감지된 패턴이 없습니다. 다른 분봉도 확인해 보세요.</div>`;

    drawChart(r, p);
    updateCalc(p);
  }

  // ---------- 차트 ----------
  function drawChart(r, p) {
    const el = $("chart");
    if (state.chart) { state.chart.remove(); state.chart = null; }
    if (!r || !window.LightweightCharts) { el.innerHTML = r ? '<div class="empty">차트 라이브러리를 불러오지 못했습니다.</div>' : ""; return; }
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
      localization: { priceFormatter: (v) => Math.round(v).toLocaleString("ko-KR") },
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
      pl(p.entry, "#16c784", "매수");
      pl(p.stop, "#ea3943", "손절");
      pl(p.target1, "#3e7bfa", "1차");
      pl(p.target2, "#3e7bfa", "2차");
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
    if (!lastPlan) { out.textContent = "매수 계획이 있을 때 계산합니다."; return; }
    const ps = S.positionSize(+$("capital").value, +$("riskPct").value, lastPlan.entry, lastPlan.stop);
    if (!ps) { out.textContent = "투자금과 손실 한도를 입력하세요."; return; }
    out.innerHTML = `매수 수량 <b>${num(ps.qty)}주</b> · 투자금액 ${num(ps.amount)}원 · 손절 시 최대 손실 <b class="neg">${num(ps.maxLoss)}원</b> (한도 ${num(ps.riskMoney)}원)`;
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
        $("scanStatus").textContent = `${state.tf}분 봉 기준 스캔 중… ${done}/${state.list.length}`;
        if (done % 5 === 0) renderRank();
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    renderRank();
    const buys = state.list.filter((s) => (state.scan.get(s.code) || {}).tone === "buy").length;
    $("scanStatus").textContent = `${state.tf}분 봉 기준 스캔 완료 · "진입 검토" ${buys}개 종목. 신호는 시간이 지나면 바뀌니 다시 스캔하세요.`;
    btn.disabled = false;
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
      $("rankTable").innerHTML = "<tbody><tr><td>실시간 주소에서 이용할 수 있습니다.</td></tr></tbody>";
      return;
    }
    segClick("sortSeg", "by", (v) => { state.by = v; loadRank(); });
    segClick("tfSeg", "tf", (v) => { state.tf = +v; state.scan.clear(); renderRank(); if (state.selected) select(state.selected); });
    $("etfChk").addEventListener("change", (e) => { state.etf = e.target.checked; loadRank(); });
    $("scanBtn").addEventListener("click", scanAll);
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
