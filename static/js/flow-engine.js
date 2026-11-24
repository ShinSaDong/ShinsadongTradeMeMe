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
  // 언어: 브라우저에서 window.TM_EN 이면 영어, 서버(워커)·Node 는 한글
  const EN = typeof window !== "undefined" && !!window.TM_EN;
  const T = (ko, en) => (EN ? en : ko);
  const LOC = EN ? "en-US" : "ko-KR";

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
  const strength = (r) => (!isNum(r) ? "-" : Math.abs(r) >= 0.7 ? T("강함", "strong") : Math.abs(r) >= 0.4 ? T("보통", "moderate") : T("약함", "weak"));

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
      { key: "frg", label: T("외국인 → 지수", "Foreign → index"), who: T("외국인", "Foreigners"), ...pearson(pick("dFrg"), px), lead: lead("dFrg").r },
      { key: "ins", label: T("기관 → 지수", "Institutions → index"), who: T("기관", "Institutions"), ...pearson(pick("dIns"), px), lead: lead("dIns").r },
      { key: "ind", label: T("개인 → 지수", "Retail → index"), who: T("개인", "Retail"), ...pearson(pick("dInd"), px), lead: lead("dInd").r },
      { key: "prog", label: T("프로그램 → 지수", "Program → index"), who: T("프로그램", "Program trading"), ...pearson(pick("dProg"), px), lead: lead("dProg").r },
    ];
    if (futRows && futRows.length) {
      const fm = new Map(futRows.map((r) => [r.slot, r]));
      const f = rows.map((r) => (fm.get(r.slot) || {}).dFrg ?? null);
      out.push({ key: "futFrg", label: T("선물 외국인 → 지수", "Futures foreign → index"), who: T("선물 외국인", "Foreign futures"), ...pearson(f, px), lead: pearson(f.slice(0, -1), px.slice(1)).r });
      out.push({ key: "futProg", label: T("선물 외국인 ↔ 프로그램", "Futures foreign ↔ program"), ...pearson(f, pick("dProg")), lead: null });
    }
    return out.map((c) => ({ ...c, strength: strength(c.r) }));
  }

  const fmtEok = (v) => {
    if (!isNum(v)) return "-";
    const a = Math.abs(v), s = v > 0 ? "+" : v < 0 ? "−" : "";
    if (EN) return a >= 10000 ? `${s}₩${(a / 10000).toFixed(2)}T` : `${s}₩${(a / 10).toLocaleString("en-US", { maximumFractionDigits: a >= 100 ? 0 : 1 })}B`;
    return a >= 10000 ? `${s}${(a / 10000).toFixed(2)}조` : `${s}${Math.round(a).toLocaleString("ko-KR")}억`;
  };

  const fmtRaw = (v) => (!isNum(v) ? "-" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(Math.round(v)).toLocaleString(LOC));

  // 시장 분위기 점수(−100 ~ +100)와 해석
  function mood(code, last, futLast, rows, step = 5) {
    if (!last) return null;
    const parts = [];
    const add = (label, v) => { if (isNum(v)) parts.push({ label, v: Math.round(v) }); };
    add(T("외국인 현물", "Foreign cash"), clamp((last.frg || 0) / 3000, -1, 1) * 25);
    add(T("기관", "Institutions"), clamp((last.ins || 0) / 3000, -1, 1) * 10);
    if (isNum(last.prog)) add(T("프로그램", "Program"), clamp(last.prog / 3000, -1, 1) * 15);
    if (isNum(last.up) && last.up + last.down > 0) add(T("상승·하락 종목 수", "Advancers/decliners"), ((last.up / (last.up + last.down)) - 0.5) * 2 * 20);
    if (isNum(last.rate)) add(T("지수 등락률", "Index change"), clamp(last.rate / 2, -1, 1) * 15);
    if (code === "KOSPI" && futLast && isNum(futLast.frg)) add(T("선물 외국인", "Futures foreign"), clamp(futLast.frg / 2000, -1, 1) * 15);
    const score = Math.round(parts.reduce((a, p) => a + p.v, 0));
    const label = score >= 40 ? T("강세", "Bullish") : score >= 15 ? T("약한 강세", "Mildly bullish") : score > -15 ? T("중립", "Neutral") : score > -40 ? T("약한 약세", "Mildly bearish") : T("약세", "Bearish");
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
    const IND = T("개인", "Retail"), FRG = T("외국인", "Foreigners"), INS = T("기관", "Institutions");
    // 1. 주체 구도
    const who = [[IND, last.ind], [FRG, last.frg], [INS, last.ins]].filter(([, v]) => isNum(v));
    const buyers = who.filter(([, v]) => v > 0), sellers = who.filter(([, v]) => v < 0);
    if (who.length === 3) {
      const b = buyers.map(([k, v]) => `${k} ${fmtEok(v)}`).join(", ");
      const s = sellers.map(([k, v]) => `${k} ${fmtEok(v)}`).join(", ");
      let t = EN
        ? `${name}: net buyers — ${b || "none"}; net sellers — ${s || "none"}.`
        : `${name}: ${b || "순매수 주체 없음"} 순매수, ${s || "순매도 주체 없음"} 순매도.`;
      if (buyers.length === 1 && buyers[0][0] === IND) t += T(" 개인 혼자 외국인·기관 물량을 받아내는 구도라, 반등이 나와도 힘이 약할 수 있습니다.", " Retail alone is absorbing foreign and institutional selling, so any rebound may lack strength.");
      else if (sellers.length === 1 && sellers[0][0] === IND) t += T(" 외국인·기관이 함께 사들이는 구도로 수급이 가장 좋은 조합입니다.", " Foreigners and institutions are buying together — the strongest flow combination.");
      else if (buyers.some(([k]) => k === FRG) && buyers.some(([k]) => k === INS)) t += T(" 외국인·기관 동반 순매수입니다.", " Foreigners and institutions are both net buyers.");
      L.push(t);
    }
    // 2. 현물·선물 외국인 (코스피)
    if (code === "KOSPI" && futLast && isNum(futLast.frg) && isNum(last.frg)) {
      const s = Math.sign(last.frg), f = Math.sign(futLast.frg);
      if (s < 0 && f < 0) L.push(T(`외국인이 현물(${fmtEok(last.frg)})과 선물(${fmtRaw(futLast.frg)})을 함께 팔고 있습니다. 현·선물 동반 매도는 지수 하락에 무게를 둔 가장 약한 조합입니다.`,
        `Foreigners are selling both cash (${fmtEok(last.frg)}) and futures (${fmtRaw(futLast.frg)}). Selling both is the weakest, most bearish combination.`));
      else if (s > 0 && f > 0) L.push(T(`외국인이 현물(${fmtEok(last.frg)})과 선물(${fmtRaw(futLast.frg)})을 함께 사고 있습니다. 현·선물 동반 매수는 지수 상승에 무게를 둔 가장 강한 조합입니다.`,
        `Foreigners are buying both cash (${fmtEok(last.frg)}) and futures (${fmtRaw(futLast.frg)}). Buying both is the strongest, most bullish combination.`));
      else if (s < 0 && f > 0) L.push(T("외국인이 현물은 팔고 선물은 사고 있습니다. 현물 매도를 선물로 헤지하거나 차익거래일 수 있어 방향성은 약합니다.",
        "Foreigners are selling cash but buying futures. This may be a hedge or arbitrage, so the directional signal is weak."));
      else if (s > 0 && f < 0) L.push(T("외국인이 현물은 사고 선물은 팔고 있습니다. 현물 보유분의 하락 위험을 선물로 헤지하는 모습일 수 있습니다.",
        "Foreigners are buying cash but selling futures — possibly hedging downside risk on their cash holdings."));
    }
    // 3. 프로그램
    if (isNum(last.prog)) {
      const big = Math.abs(last.nonArb || 0) >= Math.abs(last.arb || 0);
      L.push(T(`프로그램 ${fmtEok(last.prog)} (차익 ${fmtEok(last.arb)}, 비차익 ${fmtEok(last.nonArb)}). `, `Program trading ${fmtEok(last.prog)} (arbitrage ${fmtEok(last.arb)}, non-arbitrage ${fmtEok(last.nonArb)}). `) +
        (big ? T(`비차익이 중심이라 외국인·기관의 바스켓(대형주 묶음) 매매가 지수를 ${last.nonArb < 0 ? "누르고" : "끌어올리고"} 있습니다.`,
                 `Mostly non-arbitrage, so foreign/institutional basket trading in large caps is ${last.nonArb < 0 ? "pushing the index down" : "lifting the index"}.`)
          : T(`차익거래(선물-현물 가격 차이)가 중심이라 선물 가격 움직임에 따라 바뀌기 쉽습니다.`, `Mostly arbitrage (futures–cash basis), so it can flip quickly with futures prices.`)));
    }
    // 4. 시장 폭
    if (isNum(last.up) && isNum(last.down) && last.up + last.down > 0) {
      const ratio = last.up / (last.up + last.down);
      let t = T(`상승 ${last.up.toLocaleString("ko-KR")}종목 · 하락 ${last.down.toLocaleString("ko-KR")}종목 (상승 비율 ${(ratio * 100).toFixed(0)}%).`,
        `${last.up.toLocaleString("en-US")} advancers · ${last.down.toLocaleString("en-US")} decliners (${(ratio * 100).toFixed(0)}% up).`);
      if (isNum(last.rate) && last.rate > 0 && ratio < 0.4) t += T(" 지수는 올랐는데 하락 종목이 더 많아 일부 대형주 쏠림입니다.", " The index is up but decliners outnumber advancers — gains are concentrated in a few large caps.");
      else if (isNum(last.rate) && last.rate < 0 && ratio > 0.6) t += T(" 지수는 내렸지만 오른 종목이 더 많아 대형주만 약한 장입니다.", " The index is down but most stocks are up — only the large caps are weak.");
      else if (ratio < 0.2) t += T(" 거의 모든 종목이 내리는 전면 약세입니다.", " Nearly everything is falling — broad weakness.");
      else if (ratio > 0.8) t += T(" 거의 모든 종목이 오르는 전면 강세입니다.", " Nearly everything is rising — broad strength.");
      L.push(t);
    }
    // 5. 상관관계 핵심
    const sig = (corr || []).filter((c) => isNum(c.r) && ["frg", "ins", "ind", "prog", "futFrg"].includes(c.key)).sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    if (sig.length) {
      const top = sig[0];
      const who = top.who || top.label;
      if (Math.abs(top.r) < 0.4) {
        L.push(T(`아직 ${name} ${step}분 등락을 뚜렷하게 이끈 수급은 없습니다 (가장 높은 상관: ${who} ${top.r.toFixed(2)}, ${top.n}구간).`,
          `No flow has clearly driven ${name}'s ${step}-minute moves yet (highest correlation: ${who} ${top.r.toFixed(2)}, ${top.n} bars).`));
      } else if (top.r > 0) {
        L.push(T(`오늘 ${step}분 단위로 ${name} 등락과 가장 같이 움직인 수급은 ${who}입니다 (상관 ${top.r.toFixed(2)}, ${top.strength}, ${top.n}구간). 이 주체가 살 때 지수가 오르고 팔 때 내리는, 지수를 이끄는 수급입니다.`,
          `On a ${step}-minute basis, the flow that moved most closely with ${name} today is ${who} (correlation ${top.r.toFixed(2)}, ${top.strength}, ${top.n} bars). The index rises when they buy and falls when they sell — they are leading the index.`) +
          (isNum(top.lead) && Math.abs(top.lead) >= 0.4 ? T(` 앞 ${step}분 수급과 다음 ${step}분 지수의 상관도 ${top.lead.toFixed(2)}라 지수보다 먼저 움직이는 경향이 있습니다.`,
            ` Their flow in one ${step}-minute bar also correlates ${top.lead.toFixed(2)} with the index in the next, so they tend to move first.`) : ""));
      } else {
        L.push(T(`${who}는 ${name}과 반대로 움직였습니다 (상관 ${top.r.toFixed(2)}, ${top.strength}). 지수가 내릴 때 사고 오를 때 파는 역추세 매매로, 지수를 이끌기보다 받아내는 쪽입니다.`,
          `${who} moved against ${name} (correlation ${top.r.toFixed(2)}, ${top.strength}) — buying dips and selling rallies, absorbing the move rather than leading it.`));
      }
    }
    // 6. 최근 30분 외국인
    if (md && md.momentum) {
      const { recent, earlier } = md.momentum;
      let t = T(`최근 30분 외국인 ${fmtEok(recent)}.`, `Foreigners over the last 30 min: ${fmtEok(recent)}.`);
      if (isNum(earlier)) {
        if (recent < 0 && earlier < 0) t += Math.abs(recent) > Math.abs(earlier) ? T(" 매도 강도가 커지고 있습니다.", " Selling is intensifying.") : T(" 매도 강도는 줄어드는 중입니다.", " Selling is easing.");
        else if (recent > 0 && earlier < 0) t += T(" 매도에서 매수로 돌아섰습니다.", " They have flipped from selling to buying.");
        else if (recent < 0 && earlier > 0) t += T(" 매수에서 매도로 돌아섰습니다.", " They have flipped from buying to selling.");
        else if (recent > 0 && earlier > 0) t += Math.abs(recent) > Math.abs(earlier) ? T(" 매수 강도가 커지고 있습니다.", " Buying is intensifying.") : T(" 매수 강도는 줄어드는 중입니다.", " Buying is easing.");
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
    for (const [code, name] of [["KOSPI", T("코스피", "KOSPI")], ["KOSDAQ", T("코스닥", "KOSDAQ")]]) {
      const rows = buildRows(date, snaps, code, (min[code] || {}).bars, step);
      const last = rows[rows.length - 1] || null;
      const corr = correlations(rows, code === "KOSPI" ? fut : null);
      const md = mood(code, last, futLast, rows, step);
      markets[code] = { code, name, rows, last, corr, mood: md, story: narrative(code, name, last, futLast, corr, md, step) };
    }
    markets.FUT = { code: "FUT", name: T("코스피200 선물", "KOSPI200 futures"), rows: fut, last: futLast };
    const k = markets.KOSPI.mood, q = markets.KOSDAQ.mood;
    const overall = k ? Math.round(k.score * 0.65 + (q ? q.score * 0.35 : k.score * 0.35)) : null;
    return { date, step, markets, overall, points: (markets.KOSPI.rows || []).length };
  }

  const api = { fmtRaw, analyzeFlow, resample, buildRows, correlations, mood, narrative, pearson, fmtEok, slotEndTs, priceAt };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Flow = api;
})(typeof window !== "undefined" ? window : globalThis);
