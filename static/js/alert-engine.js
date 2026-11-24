/* 알림 판단 엔진 (브라우저 탭 알림 + 서버 웹 푸시 공용)
 * evaluate({ snap, hist, state, cfg, now, Flow }) → { events, state, point }
 *  - snap: /api/flow 의 실시간 스냅샷 { ts, bizdate, markets: { KOSPI, KOSDAQ, FUT, KQ150 } }
 *  - hist: 오늘 이전 시점들의 point 배열(오래된 순) — 5분 변화 계산용
 *  - state: 이전 호출이 돌려준 state (중복 방지, 단계·방향 기억)
 *  - cfg: 켜고 끄는 조건과 기준값
 */
(function (root) {
  "use strict";
  const DEF = { mood: true, frg: true, frgThr: 300, big: true, bigStep: 3000, flip: true, side: true, scalp: true };
  const URL_MARKET = "/market/";
  const isNum = (x) => x !== null && x !== undefined && isFinite(x);
  // 언어: cfg.lang === "en" 이면 영어 (브라우저는 페이지 언어, 서버 푸시는 구독할 때 저장한 언어)
  const eokOf = (en) => (v) => {
    const sg = v > 0 ? "+" : v < 0 ? "−" : "", a = Math.abs(v);
    if (en) return sg + (a >= 10000 ? "₩" + (a / 10000).toFixed(2) + "T" : "₩" + (a / 10).toLocaleString("en-US", { maximumFractionDigits: a >= 100 ? 0 : 1 }) + "B");
    return sg + Math.abs(Math.round(v)).toLocaleString("ko-KR") + "억";
  };
  const moodLabel = (o, en) => (en
    ? (o >= 40 ? "Bullish" : o >= 15 ? "Mildly bullish" : o > -15 ? "Neutral" : o > -40 ? "Mildly bearish" : "Bearish")
    : (o >= 40 ? "강세" : o >= 15 ? "약한 강세" : o > -15 ? "중립" : o > -40 ? "약한 약세" : "약세"));

  function pointOf(snap) {
    const M = (snap && snap.markets) || {};
    const K = M.KOSPI || {}, Q = M.KOSDAQ || {};
    return {
      ts: snap.ts,
      kf: K.deal ? K.deal.frg : null, qf: Q.deal ? Q.deal.frg : null,
      ki: K.deal ? K.deal.ins : null, qi: Q.deal ? Q.deal.ins : null,
      kp: K.prog ? K.prog.total : null,
    };
  }

  function evaluate({ snap, hist = [], state, cfg, now = Date.now(), Flow }) {
    cfg = Object.assign({}, DEF, cfg || {});
    const EN = cfg.lang === "en";
    const T = (ko, en) => (EN ? en : ko);
    const eok = eokOf(EN);
    const url = EN ? "/en" + URL_MARKET : URL_MARKET;
    const day = snap.bizdate;
    if (!state || state.day !== day) state = { day, sent: {}, mood: null, sign: {}, level: {}, side: {} };
    const events = [];
    const fire = (key, title, body, cooldownMs = 5 * 60e3) => {
      const last = state.sent[key];
      if (last && now - last < cooldownMs) return;
      state.sent[key] = now;
      events.push({ key, title, body, url });
    };
    const cur = pointOf(snap);
    const M = snap.markets || {};

    // ① 시장 분위기 단계 변화
    if (cfg.mood && Flow) {
      const res = Flow.analyzeFlow({ date: day, snaps: [{ ...snap, slot: snap.slot || "0900" }], minutes: {} });
      const o = res.overall;
      if (isNum(o)) {
        const label = moodLabel(o, EN);
        if (state.mood && state.mood !== label) {
          fire("mood:" + label, T(`시장 분위기: ${state.mood} → ${label}`, `Market mood: ${state.mood} → ${label}`),
            T(`종합 점수 ${o > 0 ? "+" : ""}${o}. 외국인 코스피 ${eok(cur.kf || 0)}, 프로그램 ${eok(cur.kp || 0)}`, `Overall score ${o > 0 ? "+" : ""}${o}. Foreign KOSPI ${eok(cur.kf || 0)}, program ${eok(cur.kp || 0)}`), 10 * 60e3);
        }
        state.mood = label;
      }
    }

    // ② 외국인·기관 5분 대량 매수/매도 (코스피 기준값, 코스닥 1/3)
    if (cfg.frg) {
      const old = hist.filter((h) => cur.ts - h.ts >= 4.5 * 60e3 && cur.ts - h.ts < 20 * 60e3).pop();
      const thr = Math.max(10, +cfg.frgThr || DEF.frgThr);
      if (old) {
        for (const [who, name, a, b, t] of [
          [T("외국인", "Foreign"), T("코스피", "KOSPI"), cur.kf, old.kf, thr], [T("외국인", "Foreign"), T("코스닥", "KOSDAQ"), cur.qf, old.qf, thr / 3],
          [T("기관", "Institutional"), T("코스피", "KOSPI"), cur.ki, old.ki, thr], [T("기관", "Institutional"), T("코스닥", "KOSDAQ"), cur.qi, old.qi, thr / 3],
        ]) {
          if (!isNum(a) || !isNum(b)) continue;
          const dv = a - b;
          if (Math.abs(dv) >= t) {
            fire(`flow5:${who}:${name}:${dv > 0 ? "+" : "-"}`, T(`${who} ${name} 5분 대량 ${dv > 0 ? "매수" : "매도"} ${eok(dv)}`, `${who} ${name}: large 5-min ${dv > 0 ? "buying" : "selling"} ${eok(dv)}`),
              T(`5분 사이 ${who} 순매수가 ${eok(dv)} 바뀌었습니다. 누적 ${eok(a)}.`, `${who} net buying changed by ${eok(dv)} in 5 minutes. Cumulative ${eok(a)}.`));
          }
        }
      }
    }

    // ③ 외국인·기관 누적 대량 돌파 (코스피 bigStep 억 단위, 코스닥 1/3 단위)
    if (cfg.big) {
      const step = Math.max(100, +cfg.bigStep || DEF.bigStep);
      for (const [k, who, name, v, st] of [
        ["kf", T("외국인", "Foreign"), T("코스피", "KOSPI"), cur.kf, step], ["ki", T("기관", "Institutional"), T("코스피", "KOSPI"), cur.ki, step],
        ["qf", T("외국인", "Foreign"), T("코스닥", "KOSDAQ"), cur.qf, step / 3], ["qi", T("기관", "Institutional"), T("코스닥", "KOSDAQ"), cur.qi, step / 3],
      ]) {
        if (!isNum(v)) continue;
        const level = Math.trunc(v / st);
        const prev = state.level[k] || 0;
        if (level !== 0 && (Math.sign(level) !== Math.sign(prev) || Math.abs(level) > Math.abs(prev))) {
          const mark = Math.round(level * st);
          fire(`big:${k}:${level}`, T(`${who} ${name} 누적 ${mark > 0 ? "순매수" : "순매도"} ${eok(mark)} 돌파`, `${who} ${name} cumulative net ${mark > 0 ? "buying" : "selling"} passes ${eok(mark)}`),
            T(`현재 누적 ${eok(v)}. 오늘 ${who} 매매가 한쪽으로 크게 쏠리고 있습니다.`, `Cumulative ${eok(v)}. ${who} trading is heavily one-sided today.`), 6 * 3600e3);
        }
        state.level[k] = level;
      }
    }

    // ④ 순매수 ↔ 순매도 전환 (±100억 넘게 넘어갈 때만)
    if (cfg.flip) {
      for (const [k, name, v] of [["kf", T("외국인(코스피)", "Foreign (KOSPI)"), cur.kf], ["kp", T("프로그램(코스피)", "Program (KOSPI)"), cur.kp]]) {
        if (!isNum(v) || Math.abs(v) < 100) continue;
        const s = Math.sign(v);
        if (state.sign[k] && state.sign[k] !== s) {
          fire(`flip:${k}:${s}`, T(`${name} ${s > 0 ? "순매수 전환" : "순매도 전환"}`, `${name} flips to net ${s > 0 ? "buying" : "selling"}`), T(`방향이 바뀌었습니다. 현재 누적 ${eok(v)}.`, `Direction changed. Cumulative ${eok(v)}.`), 15 * 60e3);
        }
        state.sign[k] = s;
      }
    }

    // ⑤ 사이드카: 코스피200 선물 ±5%(근접 ±4%), 코스닥150(ETF 추정) ±6%(근접 ±5%). 2번 연속이면 발동 조건 도달
    if (cfg.side) {
      const F = M.FUT || {}, E = M.KQ150 || {};
      for (const [k, name, rate, warn, hit, basis] of [
        ["k", T("코스피", "KOSPI"), F.rate, 4, 5, T("코스피200 선물", "KOSPI200 futures")],
        ["q", T("코스닥", "KOSDAQ"), E.rate, 5, 6, T("코스닥150(ETF 추정)", "KOSDAQ150 (ETF estimate)")],
      ]) {
        if (!isNum(rate)) { state.side[k] = 0; continue; }
        const dirKey = rate > 0 ? "buy" : "sell";
        const dir = rate > 0 ? T("매수", "buy") : T("매도", "sell");
        const a = Math.abs(rate);
        state.side[k] = a >= hit ? (state.side[k] || 0) + 1 : 0;
        const pr = `${rate > 0 ? "+" : ""}${Number(rate).toFixed(2)}%`;
        if (state.side[k] >= 2) {
          fire(`side:${k}:${dirKey}`, T(`🚨 ${name} ${dir} 사이드카 발동 조건 도달`, `🚨 ${name} ${dir}-side sidecar condition met`), T(`${basis} ${pr}가 1분 넘게 유지. 프로그램 ${dir} 호가가 5분간 멈출 수 있습니다.`, `${basis} held ${pr} for over 1 minute. Program ${dir} orders may be halted for 5 minutes.`), 24 * 3600e3);
        } else if (a >= warn) {
          fire(`sidewarn:${k}:${dirKey}`, T(`⚠️ ${name} ${dir} 사이드카 근접`, `⚠️ ${name} ${dir}-side sidecar approaching`), T(`${basis} ${pr} (발동 기준 ±${hit}%).`, `${basis} ${pr} (trigger ±${hit}%).`), 24 * 3600e3);
        }
      }
    }

    // 하루 지난 기록 정리
    for (const k of Object.keys(state.sent)) if (now - state.sent[k] > 86400e3) delete state.sent[k];
    return { events, state, point: cur };
  }

  const api = { DEF, evaluate, pointOf, moodLabel };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AlertEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
