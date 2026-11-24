/* 홈 화면: 이번 달 장세 달력
 * - /api/month 로 이번 달 거래일별 지수 등락률과 개인·외국인·기관 순매수를 받아 날짜마다 강세/약세 표시
 * - 날짜를 누르면 오른쪽에 그날 장세와 이유(수급 해석)를 보여줌
 * - 달이 바뀌면 자동으로 새 달로 넘어감(항상 이번 달만 표시)
 */
(function () {
  "use strict";
  const F = window.Flow;
  const $ = (id) => document.getElementById(id);
  const root = $("mcal");
  if (!root || !F) return;
  const NOTES = (() => { try { return JSON.parse(($("mcal-notes") || {}).textContent || "{}") || {}; } catch (_) { return {}; } })();
  const isNum = (x) => x !== null && x !== undefined && isFinite(x);
  const EN = !!window.TM_EN;
  const T = (ko, en) => (EN ? en : ko);
  const LOC = EN ? "en-US" : "ko-KR";
  const cls = (v) => (v > 0 ? "pos" : v < 0 ? "neg" : "");
  const pct = (v) => (isNum(v) ? (v > 0 ? "+" : "") + Number(v).toFixed(2) + "%" : "-");
  const eok = (v) => `<span class="${cls(v)}">${F.fmtEok(v)}</span>`;
  const WD = EN ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["일", "월", "화", "수", "목", "금", "토"];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const IND = T("개인", "Retail"), FRG = T("외국인", "Foreigners"), INS = T("기관", "Institutions");
  const state = { data: null, sel: null, ym: null };

  function kst() {
    const d = new Date(Date.now() + 9 * 3600e3);
    return { ymd: d.toISOString().slice(0, 10).replace(/-/g, ""), hm: d.getUTCHours() * 100 + d.getUTCMinutes() };
  }
  const labelOf = (o) => (!isNum(o) ? null : o >= 40 ? T("강세", "Bullish") : o >= 15 ? T("약한 강세", "Mildly bullish") : o > -15 ? T("중립", "Neutral") : o > -40 ? T("약한 약세", "Mildly bearish") : T("약세", "Bearish"));
  const toneOf = (o) => (o >= 15 ? "up" : o <= -15 ? "down" : "flat");

  // 하루 자료 → 분위기 점수와 해석
  function model(d) {
    const mk = (code) => {
      const f = (d.flows || {})[code] || {};
      const p = (d.prog || {})[code] || null;
      const b = (d.breadth || {})[code] || null;
      const idx = code === "KOSPI" ? d.kospi : d.kosdaq;
      return {
        ind: f.ind ?? null, frg: f.frg ?? null, ins: f.ins ?? null,
        prog: p ? p.total : null, arb: p ? p.arb : null, nonArb: p ? p.nonArb : null,
        up: b ? b.up : null, down: b ? b.down : null,
        rate: idx.rate, price: idx.close,
      };
    };
    const K = mk("KOSPI"), Q = mk("KOSDAQ");
    const fut = d.fut && isNum(d.fut.frg) ? { frg: d.fut.frg } : null;
    const hasFlow = isNum(K.frg) || isNum(Q.frg);
    // 저장 시작 전 날짜는 프로그램·종목 수가 없어 점수 폭이 좁음 → 있는 항목의 최대치 기준으로 비율 보정
    const W = { "외국인 현물": 25, "기관": 10, "프로그램": 15, "상승·하락 종목 수": 20, "지수 등락률": 15, "선물 외국인": 15,
      "Foreign cash": 25, "Institutions": 10, "Program": 15, "Advancers/decliners": 20, "Index change": 15, "Futures foreign": 15 };
    const norm = (md, full) => {
      if (!md) return md;
      const avail = md.parts.reduce((a, p) => a + (W[p.label] || 0), 0);
      if (!avail || avail >= full) return md;
      return { ...md, score: Math.max(-100, Math.min(100, Math.round((md.score * full) / avail))) };
    };
    const mK = norm(F.mood("KOSPI", K, fut, [], 5), 100), mQ = norm(F.mood("KOSDAQ", Q, null, [], 5), 85);
    const overall = mK ? Math.round(mK.score * 0.65 + (mQ ? mQ.score : mK.score) * 0.35) : null;
    return { K, Q, fut, mK, mQ, overall, hasFlow };
  }

  function moveWord(r) {
    if (!isNum(r)) return "";
    const a = Math.abs(r);
    if (EN) return a >= 3 ? (r > 0 ? "surged" : "plunged") : a >= 1 ? (r > 0 ? "rose" : "fell") : a >= 0.3 ? (r > 0 ? "edged up" : "edged down") : "was flat";
    return a >= 3 ? (r > 0 ? "급등" : "급락") : a >= 1 ? (r > 0 ? "상승" : "하락") : a >= 0.3 ? (r > 0 ? "소폭 상승" : "소폭 하락") : "보합";
  }

  // 지수 방향과 같은 쪽으로 가장 크게 매매한 주체(주도)와 반대편 최대 주체
  function driver(M) {
    const who = [[FRG, M.frg], [INS, M.ins], [IND, M.ind]].filter(([, v]) => isNum(v));
    if (!who.length || !isNum(M.rate) || Math.abs(M.rate) < 0.3) return null;
    const dir = Math.sign(M.rate);
    // 주도: 외국인·기관 중 지수와 같은 방향으로 가장 크게 매매한 쪽(없으면 개인)
    const same = who.filter(([, v]) => Math.sign(v) === dir).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const lead = same.find(([k]) => k !== IND) || same[0];
    const counter = who.filter(([, v]) => Math.sign(v) === -dir).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
    return { lead, counter, dir };
  }

  function reasons(d, m) {
    const L = [];
    const r = m.K.rate;
    const px = isNum(m.K.price) ? m.K.price.toLocaleString(LOC, { maximumFractionDigits: 2 }) : "-";
    const head = EN ? `KOSPI ${moveWord(r)} ${pct(r)} (${px}), KOSDAQ ${moveWord(m.Q.rate)} ${pct(m.Q.rate)}.`
      : `코스피 ${pct(r)} ${moveWord(r)}(${px}), 코스닥 ${pct(m.Q.rate)} ${moveWord(m.Q.rate)}.`;
    L.push(head);
    for (const [name, M] of [[T("코스피", "KOSPI"), m.K], [T("코스닥", "KOSDAQ"), m.Q]]) {
      const dv = driver(M);
      if (!dv) continue;
      const up = dv.dir > 0;
      let t = "";
      if (EN) {
        if (dv.lead) t += `${name}'s ${up ? "rise" : "fall"} was led by <b>${dv.lead[0]} net ${up ? "buying" : "selling"} of ${F.fmtEok(dv.lead[1])}</b>`;
        if (dv.counter) t += `${t ? ", while " : ""}${dv.counter[0]} ${up ? "sold" : "bought"} ${F.fmtEok(dv.counter[1])} on the other side`;
      } else {
        if (dv.lead) t += `${name} ${up ? "상승" : "하락"}을 이끈 건 <b>${dv.lead[0]} ${F.fmtEok(dv.lead[1])}</b> ${up ? "순매수" : "순매도"}`;
        if (dv.counter) t += `${t ? "이고, " : ""}${dv.counter[0]}${up ? "은" : "이"} ${F.fmtEok(dv.counter[1])} ${up ? "순매도로 맞섰습니다" : "순매수로 받아냈습니다"}`;
      }
      if (t) L.push(t + ".");
    }
    if (m.K.frg !== null && m.fut && isNum(m.fut.frg)) {
      const s = Math.sign(m.K.frg), f = Math.sign(m.fut.frg);
      if (s < 0 && f < 0) L.push(T("외국인 현물·선물 동반 매도 — 지수에 가장 부담이 큰 조합이었습니다.", "Foreigners sold both cash and futures — the most bearish combination for the index."));
      else if (s > 0 && f > 0) L.push(T("외국인 현물·선물 동반 매수 — 지수에 가장 우호적인 조합이었습니다.", "Foreigners bought both cash and futures — the most bullish combination for the index."));
      else if (s !== 0 && f !== 0 && s !== f) L.push(T(`외국인이 현물은 ${s > 0 ? "사고" : "팔고"} 선물은 ${f > 0 ? "사서" : "팔아"} 방향성은 엇갈렸습니다.`, `Foreigners ${s > 0 ? "bought" : "sold"} cash but ${f > 0 ? "bought" : "sold"} futures, so the signal was mixed.`));
    }
    if (isNum(m.K.prog)) L.push(T(`코스피 프로그램 ${F.fmtEok(m.K.prog)} (비차익 ${F.fmtEok(m.K.nonArb)}).`, `KOSPI program trading ${F.fmtEok(m.K.prog)} (non-arbitrage ${F.fmtEok(m.K.nonArb)}).`));
    if (isNum(m.K.up) && isNum(m.K.down) && m.K.up + m.K.down > 0) {
      const ratio = m.K.up / (m.K.up + m.K.down);
      let t = T(`코스피 상승 ${m.K.up}종목 · 하락 ${m.K.down}종목.`, `KOSPI ${m.K.up} advancers · ${m.K.down} decliners.`);
      if (isNum(r) && r > 0 && ratio < 0.4) t += T(" 지수는 올랐지만 하락 종목이 많아 대형주 쏠림 장이었습니다.", " The index rose but most stocks fell — a large-cap-driven day.");
      else if (isNum(r) && r < 0 && ratio > 0.6) t += T(" 지수는 내렸지만 오른 종목이 많아 대형주만 약했습니다.", " The index fell but most stocks rose — only the large caps were weak.");
      else if (ratio < 0.2) t += T(" 대부분 종목이 내린 전면 약세였습니다.", " Broad weakness — most stocks fell.");
      else if (ratio > 0.8) t += T(" 대부분 종목이 오른 전면 강세였습니다.", " Broad strength — most stocks rose.");
      L.push(t);
    }
    return L;
  }

  function render() {
    const { data } = state;
    const today = kst().ymd;
    const ym = data.ym;
    const y = +ym.slice(0, 4), mo = +ym.slice(4, 6);
    const first = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay();
    const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const byDate = new Map(data.days.map((d) => [d.date, d]));
    $("mcalTitle").textContent = T(`${y}년 ${mo}월 장세 달력`, `Market calendar — ${MON[mo - 1]} ${y}`);
    let html = WD.map((w, i) => `<div class="mc-wd ${i === 0 ? "sun" : i === 6 ? "sat" : ""}">${w}</div>`).join("");
    for (let i = 0; i < first; i++) html += `<div class="mc-cell empty"></div>`;
    for (let day = 1; day <= last; day++) {
      const ds = ym + String(day).padStart(2, "0");
      const dow = (first + day - 1) % 7;
      const d = byDate.get(ds);
      let tag = "", body = "", c = "mc-cell";
      if (dow === 0 || dow === 6) { c += " weekend"; }
      if (d) {
        const m = model(d);
        d._m = m;
        const lab = labelOf(m.overall);
        const live = ds === today && kst().hm < 1540;
        c += " trade tone-" + (lab ? toneOf(m.overall) : "flat");
        tag = lab ? `<span class="mc-lab">${live ? T("장중·", "Live·") : ""}${EN ? lab.replace("Mildly ", "Mild ") : lab.replace(" ", "")}</span>` : "";
        body = `<span class="mc-rate ${cls(d.kospi.rate)}">${pct(d.kospi.rate)}</span>`;
      } else if (dow !== 0 && dow !== 6) {
        if (ds < today) { c += " closed"; tag = `<span class="mc-lab">${T("휴장", "Closed")}</span>`; }
        else if (ds === today) { c += " pre"; tag = `<span class="mc-lab">${T("장 전", "Pre-open")}</span>`; }
      }
      if (ds === today) c += " today";
      if (ds === state.sel) c += " sel";
      html += `<button type="button" class="${c}" data-d="${ds}" ${d || ds < today ? "" : "disabled"}><span class="mc-day">${day}</span>${tag}${body}</button>`;
    }
    $("mcalGrid").innerHTML = html;
    $("mcalGrid").querySelectorAll(".mc-cell[data-d]:not([disabled])").forEach((b) => b.addEventListener("click", () => { state.sel = b.dataset.d; render(); }));
    renderDetail(byDate);
  }

  function renderDetail(byDate) {
    const ds = state.sel;
    const box = $("mcalDetail");
    if (!ds) { box.innerHTML = `<div class="empty">${T("날짜를 누르면 그날 장세를 보여줍니다.", "Click a date to see that day's market.")}</div>`; return; }
    const date = new Date(Date.UTC(+ds.slice(0, 4), +ds.slice(4, 6) - 1, +ds.slice(6)));
    const title = EN ? `${WD[date.getUTCDay()]}, ${MON[+ds.slice(4, 6) - 1]} ${+ds.slice(6)}` : `${+ds.slice(4, 6)}월 ${+ds.slice(6)}일 (${WD[date.getUTCDay()]})`;
    const d = byDate.get(ds);
    if (!d) {
      box.innerHTML = `<h3>${title}</h3><p class="sub">${T("휴장일입니다. 거래가 없었습니다.", "Market holiday — no trading.")}</p>${NOTES[ds] ? `<div class="mc-note"><b>${T("메모", "Note")}</b> ${NOTES[ds]}</div>` : ""}`;
      return;
    }
    const m = d._m || model(d);
    const lab = labelOf(m.overall);
    const live = ds === kst().ymd && kst().hm < 1540;
    const row = (name, M) => `<tr><td>${name}</td><td>${eok(M.ind)}</td><td>${eok(M.frg)}</td><td>${eok(M.ins)}</td><td>${isNum(M.prog) ? eok(M.prog) : "-"}</td></tr>`;
    box.innerHTML = `
      <div class="mc-dh"><h3>${title}${live ? ` <span class="sub">${T("장중", "live")}</span>` : ""}</h3>
        ${lab ? `<span class="badge sm ${toneOf(m.overall) === "up" ? "b-buy" : toneOf(m.overall) === "down" ? "b-sell" : "b-neutral"}">${lab} ${m.overall > 0 ? "+" : ""}${m.overall}</span>` : ""}</div>
      <div class="mc-idx">
        <div>${T("코스피", "KOSPI")} <b>${isNum(d.kospi.close) ? d.kospi.close.toLocaleString(LOC, { maximumFractionDigits: 2 }) : "-"}</b> <span class="${cls(d.kospi.rate)}">${pct(d.kospi.rate)}</span></div>
        <div>${T("코스닥", "KOSDAQ")} <b>${isNum(d.kosdaq.close) ? d.kosdaq.close.toLocaleString(LOC, { maximumFractionDigits: 2 }) : "-"}</b> <span class="${cls(d.kosdaq.rate)}">${pct(d.kosdaq.rate)}</span></div>
      </div>
      ${NOTES[ds] ? `<div class="mc-note"><b>${T("시장 이슈", "Market news")}</b> ${NOTES[ds]}</div>` : ""}
      <ul class="story">${reasons(d, m).map((s) => `<li>${s}</li>`).join("")}</ul>
      ${m.hasFlow ? `<div class="table-wrap"><table class="data mc-flow"><thead><tr>${T("<th>순매수(억)</th><th>개인</th><th>외국인</th><th>기관</th><th>프로그램</th>", "<th>Net buying</th><th>Retail</th><th>Foreign</th><th>Inst.</th><th>Program</th>")}</tr></thead>
        <tbody>${row(T("코스피", "KOSPI"), m.K)}${row(T("코스닥", "KOSDAQ"), m.Q)}</tbody></table></div>` : `<p class="sub">${T("이날 투자자별 매매 자료를 아직 받지 못했습니다.", "Investor flow data for this day is not available yet.")}</p>`}
      <div class="legend-note">${d.source === "store" ? T("사이트가 1분마다 저장한 장 마감 값 기준", "Based on closing values the site stores every minute") : T("네이버 일별 투자자 매매 기준(프로그램·종목 수는 저장 시작 전이라 없음)", "Based on Naver daily investor data (program and breadth data predate storage, so they are missing)")} · ${T("분위기 점수는 종합투자와 같은 방식(코스피 65% + 코스닥 35%)", "Mood score uses the same method as Market Flow (KOSPI 65% + KOSDAQ 35%)")}</div>`;
  }

  async function load() {
    const ym = kst().ymd.slice(0, 6);
    try {
      const r = await fetch(`/api/month?ym=${ym}`);
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || r.status);
      const monthChanged = state.ym && state.ym !== j.ym;
      state.data = j; state.ym = j.ym;
      const trade = j.days.map((d) => d.date);
      if (!state.sel || monthChanged || !state.sel.startsWith(j.ym)) {
        const t = kst().ymd;
        state.sel = trade.includes(t) ? t : trade[trade.length - 1] || null;
      }
      root.hidden = false;
      render();
    } catch (e) {
      if (!state.data) { root.hidden = false; $("mcalDetail").innerHTML = `<div class="empty">${T("달력 자료를 불러오지 못했습니다", "Could not load calendar data")}: ${e.message}</div>`; }
    }
  }
  load();
  // 장중 1분·장후 5분 주기로 다시 받음(서버 캐시 1~10분). 달이 바뀌면 새 달로 초기화
  let lastAt = Date.now();
  const R = window.TMRefresh;
  const tick = () => { if (!R || R.krDue(lastAt) || kst().ymd.slice(0, 6) !== state.ym) { lastAt = Date.now(); load(); } };
  if (R) R.everyMinute(tick); else setInterval(tick, 5 * 60e3);
})();
