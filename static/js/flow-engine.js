/* 종합투자 수급 분석 엔진 (브라우저 + Node 테스트 공용)
 *
 * 입력: 1분마다 저장된 누적 수급 스냅샷 + 지수·선물 1분 봉
 * 출력: 1분/5분 수급 표, 수급↔지수 상관관계, 시장 분위기 점수와 해석 문장
 * 단위: 코스피·코스닥 = 억원, 선물 = 네이버 표기 기준
 */
(function (root) {
  "use strict";
  const KST = 9 * 3600e3;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const isNum = (x) => x !== null && x !== undefined && isFinite(x);

  function slotEndTs(date, slot, step = 5) {
    // date "YYYYMMDD", slot "HHMM" → 해당 step 분 구간이 끝나는 시각(epoch ms)
    const y = +date.slice(0, 4), m = +date.slice(4, 6) - 1, d = +date.slice(6, 8);
    const hh = +slot.slice(0, 2), mm = +slot.slice(2, 4);
    return Date.UTC(y, m, d, hh, mm) - KST + step * 60e3;
  }

  // step 분 구간마다 가장 늦은 스냅샷 하나만 남김 (서버가 이미 맞춰 줬으면 그대로)
  function resample(snaps, step) {
    if (step <= 1) return (snaps || []).slice();
    const by = new Map();
    for (const s of snaps || []) {
      const m = (+s.slot.slice(0, 2)) * 60 + (+s.slot.slice(2, 4));
      const b = Math.floor(m / step) * step;
      const key = String(Math.floor(b / 60)).padStart(2, "0") + String(b % 60).padStart(2, "0");
      const cur = by.get(key);
      if (!cur || s.ts > cur.ts) by.set(key, { ...s, slot: key });
    }
    return [...by.values()];
  }

  // 1분 봉에서 시각 t 직전 종가
  function priceAt(bars, t) {
    let p = null;
    for (const b of bars || []) { if (b.ts < t) p = b.c; else break; }
    return p;
  }

  function pearson(xs, ys) {
    const pts = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => isNum(x) && isNum(y));
    const n = pts.length;
    if (n < 6) return { r: null, n };
    const mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
    return { r: sxx && syy ? sxy / Math.sqrt(sxx * syy) : null, n };
  }
  const strength = (r) => (!isNum(r) ? "-" : Math.abs(r) >= 0.7 ? "강함" : Math.abs(r) >= 0.4 ? "보통" : "약함");

  // 시장별 step 분 행 만들기
  function buildRows(date, snaps, code, minuteBars, step = 5) {
    const list = (snaps || []).filter((s) => s.markets && s.markets[code]).sort((a, b) => a.slot.localeCompare(b.slot));
    const rows = [];
    let prev = null;
    for (const s of list) {
      const m = s.markets[code];
      const end = slotEndTs(date, s.slot, step);
      const px = priceAt(minuteBars, Math.min(end, s.ts + 1)) ?? m.price ?? null;
      const cur = {
        slot: s.slot, live: !!s.live,
        price: px,
        ind: m.deal ? m.deal.ind : null, frg: m.deal ? m.deal.frg : null, ins: m.deal ? m.deal.ins : null,
        arb: m.prog ? m.prog.arb : null, nonArb: m.prog ? m.prog.nonArb : null, prog: m.prog ? m.prog.total : null,
        up: m.breadth ? (m.breadth.rise || 0) + (m.breadth.upper || 0) : null,
        down: m.breadth ? (m.breadth.fall || 0) + (m.breadth.lower || 0) : null,
        rate: m.rate ?? null,
      };
      const d = (k) => (prev && isNum(cur[k]) && isNum(prev[k]) ? cur[k] - prev[k] : null);
      cur.dInd = d("ind"); cur.dFrg = d("frg"); cur.dIns = d("ins"); cur.dProg = d("prog"); cur.dNonArb = d("nonArb");
      cur.dPricePct = prev && isNum(cur.price) && isNum(prev.price) && prev.price ? ((cur.price - prev.price) / prev.price) * 100 : null;
      rows.push(cur);
      prev = cur;
    }
    return rows;
  }

  function correlations(rows, futRows) {
    const pick = (k) => rows.map((r) => r[k]);
    const px = pick("dPricePct");
    const lead = (k) => pearson(rows.slice(0, -1).map((r) => r[k]), rows.slice(1).map((r) => r.dPricePct));
    const out = [
      { key: "frg", label: "외국인 → 지수", ...pearson(pick("dFrg"), px), lead: lead("dFrg").r },
      { key: "ins", label: "기관 → 지수", ...pearson(pick("dIns"), px), lead: lead("dIns").r },
      { key: "ind", label: "개인 → 지수", ...pearson(pick("dInd"), px), lead: lead("dInd").r },
      { key: "prog", label: "프로그램 → 지수", ...pearson(pick("dProg"), px), lead: lead("dProg").r },
    ];
    if (futRows && futRows.length) {
      const fm = new Map(futRows.map((r) => [r.slot, r]));
      const f = rows.map((r) => (fm.get(r.slot) || {}).dFrg ?? null);
      out.push({ key: "futFrg", label: "선물 외국인 → 지수", ...pearson(f, px), lead: pearson(f.slice(0, -1), px.slice(1)).r });
      out.push({ key: "futProg", label: "선물 외국인 ↔ 프로그램", ...pearson(f, pick("dProg")), lead: null });
    }
    return out.map((c) => ({ ...c, strength: strength(c.r) }));
  }

  const fmtEok = (v) => {
    if (!isNum(v)) return "-";
    const a = Math.abs(v), s = v > 0 ? "+" : v < 0 ? "−" : "";
    return a >= 10000 ? `${s}${(a / 10000).toFixed(2)}조` : `${s}${Math.round(a).toLocaleString("ko-KR")}억`;
  };

  const fmtRaw = (v) => (!isNum(v) ? "-" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(Math.round(v)).toLocaleString("ko-KR"));

  // 시장 분위기 점수(−100 ~ +100)와 해석
  function mood(code, last, futLast, rows, step = 5) {
    if (!last) return null;
    const parts = [];
    const add = (label, v) => { if (isNum(v)) parts.push({ label, v: Math.round(v) }); };
    add("외국인 현물", clamp((last.frg || 0) / 3000, -1, 1) * 25);
    add("기관", clamp((last.ins || 0) / 3000, -1, 1) * 10);
    if (isNum(last.prog)) add("프로그램", clamp(last.prog / 3000, -1, 1) * 15);
    if (isNum(last.up) && last.up + last.down > 0) add("상승·하락 종목 수", ((last.up / (last.up + last.down)) - 0.5) * 2 * 20);
    if (isNum(last.rate)) add("지수 등락률", clamp(last.rate / 2, -1, 1) * 15);
    if (code === "KOSPI" && futLast && isNum(futLast.frg)) add("선물 외국인", clamp(futLast.frg / 2000, -1, 1) * 15);
    const score = Math.round(parts.reduce((a, p) => a + p.v, 0));
    const label = score >= 40 ? "강세" : score >= 15 ? "약한 강세" : score > -15 ? "중립" : score > -40 ? "약한 약세" : "약세";
    const tone = score >= 15 ? "up" : score <= -15 ? "down" : "flat";

    // 최근 30분 외국인 흐름
    const n = Math.max(1, Math.round(30 / step));
    const need = Math.ceil(n / 2);
    const recent = rows.slice(-n).map((r) => r.dFrg).filter(isNum);
    const earlier = rows.slice(-2 * n, -n).map((r) => r.dFrg).filter(isNum);
    const sum = (a) => a.reduce((x, y) => x + y, 0);
    const momentum = recent.length >= need ? { recent: sum(recent), earlier: earlier.length >= need ? sum(earlier) : null } : null;
    return { score, label, tone, parts, momentum };
  }

  function narrative(code, name, last, futLast, corr, md, step = 5) {
    const L = [];
    if (!last) return L;
    // 1. 주체 구도
    const who = [["개인", last.ind], ["외국인", last.frg], ["기관", last.ins]].filter(([, v]) => isNum(v));
    const buyers = who.filter(([, v]) => v > 0), sellers = who.filter(([, v]) => v < 0);
    if (who.length === 3) {
      const b = buyers.map(([k, v]) => `${k} ${fmtEok(v)}`).join(", ");
      const s = sellers.map(([k, v]) => `${k} ${fmtEok(v)}`).join(", ");
      let t = `${name}: ${b || "순매수 주체 없음"} 순매수, ${s || "순매도 주체 없음"} 순매도.`;
      if (buyers.length === 1 && buyers[0][0] === "개인") t += " 개인 혼자 외국인·기관 물량을 받아내는 구도라, 반등이 나와도 힘이 약할 수 있습니다.";
      else if (sellers.length === 1 && sellers[0][0] === "개인") t += " 외국인·기관이 함께 사들이는 구도로 수급이 가장 좋은 조합입니다.";
      else if (buyers.some(([k]) => k === "외국인") && buyers.some(([k]) => k === "기관")) t += " 외국인·기관 동반 순매수입니다.";
      L.push(t);
    }
    // 2. 현물·선물 외국인 (코스피)
    if (code === "KOSPI" && futLast && isNum(futLast.frg) && isNum(last.frg)) {
      const s = Math.sign(last.frg), f = Math.sign(futLast.frg);
      if (s < 0 && f < 0) L.push(`외국인이 현물(${fmtEok(last.frg)})과 선물(${fmtRaw(futLast.frg)})을 함께 팔고 있습니다. 현·선물 동반 매도는 지수 하락에 무게를 둔 가장 약한 조합입니다.`);
      else if (s > 0 && f > 0) L.push(`외국인이 현물(${fmtEok(last.frg)})과 선물(${fmtRaw(futLast.frg)})을 함께 사고 있습니다. 현·선물 동반 매수는 지수 상승에 무게를 둔 가장 강한 조합입니다.`);
      else if (s < 0 && f > 0) L.push("외국인이 현물은 팔고 선물은 사고 있습니다. 현물 매도를 선물로 헤지하거나 차익거래일 수 있어 방향성은 약합니다.");
      else if (s > 0 && f < 0) L.push("외국인이 현물은 사고 선물은 팔고 있습니다. 현물 보유분의 하락 위험을 선물로 헤지하는 모습일 수 있습니다.");
    }
    // 3. 프로그램
    if (isNum(last.prog)) {
      const big = Math.abs(last.nonArb || 0) >= Math.abs(last.arb || 0);
      L.push(`프로그램 ${fmtEok(last.prog)} (차익 ${fmtEok(last.arb)}, 비차익 ${fmtEok(last.nonArb)}). ` +
        (big ? `비차익이 중심이라 외국인·기관의 바스켓(대형주 묶음) 매매가 지수를 ${last.nonArb < 0 ? "누르고" : "끌어올리고"} 있습니다.`
          : `차익거래(선물-현물 가격 차이)가 중심이라 선물 가격 움직임에 따라 바뀌기 쉽습니다.`));
    }
    // 4. 시장 폭
    if (isNum(last.up) && isNum(last.down) && last.up + last.down > 0) {
      const ratio = last.up / (last.up + last.down);
      let t = `상승 ${last.up.toLocaleString("ko-KR")}종목 · 하락 ${last.down.toLocaleString("ko-KR")}종목 (상승 비율 ${(ratio * 100).toFixed(0)}%).`;
      if (isNum(last.rate) && last.rate > 0 && ratio < 0.4) t += " 지수는 올랐는데 하락 종목이 더 많아 일부 대형주 쏠림입니다.";
      else if (isNum(last.rate) && last.rate < 0 && ratio > 0.6) t += " 지수는 내렸지만 오른 종목이 더 많아 대형주만 약한 장입니다.";
      else if (ratio < 0.2) t += " 거의 모든 종목이 내리는 전면 약세입니다.";
      else if (ratio > 0.8) t += " 거의 모든 종목이 오르는 전면 강세입니다.";
      L.push(t);
    }
    // 5. 상관관계 핵심
    const sig = (corr || []).filter((c) => isNum(c.r) && ["frg", "ins", "ind", "prog", "futFrg"].includes(c.key)).sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    if (sig.length) {
      const top = sig[0];
      const who = top.label.replace(" → 지수", "");
      if (Math.abs(top.r) < 0.4) {
        L.push(`아직 ${name} ${step}분 등락을 뚜렷하게 이끈 수급은 없습니다 (가장 높은 상관: ${who} ${top.r.toFixed(2)}, ${top.n}구간).`);
      } else if (top.r > 0) {
        L.push(`오늘 ${step}분 단위로 ${name} 등락과 가장 같이 움직인 수급은 ${who}입니다 (상관 ${top.r.toFixed(2)}, ${top.strength}, ${top.n}구간). 이 주체가 살 때 지수가 오르고 팔 때 내리는, 지수를 이끄는 수급입니다.` +
          (isNum(top.lead) && Math.abs(top.lead) >= 0.4 ? ` 앞 ${step}분 수급과 다음 ${step}분 지수의 상관도 ${top.lead.toFixed(2)}라 지수보다 먼저 움직이는 경향이 있습니다.` : ""));
      } else {
        L.push(`${who}는 ${name}과 반대로 움직였습니다 (상관 ${top.r.toFixed(2)}, ${top.strength}). 지수가 내릴 때 사고 오를 때 파는 역추세 매매로, 지수를 이끌기보다 받아내는 쪽입니다.`);
      }
    }
    // 6. 최근 30분 외국인
    if (md && md.momentum) {
      const { recent, earlier } = md.momentum;
      let t = `최근 30분 외국인 ${fmtEok(recent)}.`;
      if (isNum(earlier)) {
        if (recent < 0 && earlier < 0) t += Math.abs(recent) > Math.abs(earlier) ? " 매도 강도가 커지고 있습니다." : " 매도 강도는 줄어드는 중입니다.";
        else if (recent > 0 && earlier < 0) t += " 매도에서 매수로 돌아섰습니다.";
        else if (recent < 0 && earlier > 0) t += " 매수에서 매도로 돌아섰습니다.";
        else if (recent > 0 && earlier > 0) t += Math.abs(recent) > Math.abs(earlier) ? " 매수 강도가 커지고 있습니다." : " 매수 강도는 줄어드는 중입니다.";
      }
      L.push(t);
    }
    return L;
  }

  function analyzeFlow(data, step) {
    const date = data.date;
    step = step || data.step || 5;
    const snaps = resample(data.snaps || [], step);
    const min = data.minutes || {};
    const fut = buildRows(date, snaps, "FUT", (min.FUT || {}).bars, step);
    const futLast = fut[fut.length - 1] || null;
    const markets = {};
    for (const [code, name] of [["KOSPI", "코스피"], ["KOSDAQ", "코스닥"]]) {
      const rows = buildRows(date, snaps, code, (min[code] || {}).bars, step);
      const last = rows[rows.length - 1] || null;
      const corr = correlations(rows, code === "KOSPI" ? fut : null);
      const md = mood(code, last, futLast, rows, step);
      markets[code] = { code, name, rows, last, corr, mood: md, story: narrative(code, name, last, futLast, corr, md, step) };
    }
    markets.FUT = { code: "FUT", name: "코스피200 선물", rows: fut, last: futLast };
    const k = markets.KOSPI.mood, q = markets.KOSDAQ.mood;
    const overall = k ? Math.round(k.score * 0.65 + (q ? q.score * 0.35 : k.score * 0.35)) : null;
    return { date, step, markets, overall, points: (markets.KOSPI.rows || []).length };
  }

  const api = { fmtRaw, analyzeFlow, resample, buildRows, correlations, mood, narrative, pearson, fmtEok, slotEndTs, priceAt };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Flow = api;
})(typeof window !== "undefined" ? window : globalThis);
