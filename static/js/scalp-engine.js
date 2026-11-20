/* ShinsadongTradeMeMe 단타 분석 엔진 (브라우저 + Node 테스트 공용)
 *
 * 입력: 1분 봉 [{ts, o, h, l, c, v}] (ts = epoch ms)
 * 출력: 1/3/5분 봉, 지표(VWAP·MA5·MA20), 6가지 패턴 신호, 매수가·손절가·목표가, 진입 시점 판단
 *
 * 모든 결과는 정해진 규칙으로 계산한 참고치이며 수익을 보장하지 않습니다.
 */
(function (root) {
  "use strict";

  const MIN = 60 * 1000;
  const KST = 9 * 3600 * 1000;

  // ---------- 시간 ----------
  const hmOf = (ts) => {
    const d = new Date(ts + KST);
    return d.getUTCHours() * 100 + d.getUTCMinutes();
  };
  const hhmm = (ts) => new Date(ts + KST).toISOString().slice(11, 16);
  const minOfDay = (ts) => {
    const d = new Date(ts + KST);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  };

  // ---------- 호가 단위 (2023년 이후 코스피·코스닥 공통) ----------
  function tickSize(price, isEtf) {
    if (isEtf) return 5;
    if (price < 2000) return 1;
    if (price < 5000) return 5;
    if (price < 20000) return 10;
    if (price < 50000) return 50;
    if (price < 200000) return 100;
    if (price < 500000) return 500;
    return 1000;
  }
  function roundTick(price, dir, isEtf) {
    if (price === null || !isFinite(price)) return null;
    const t = tickSize(price, isEtf);
    if (dir === "up") return Math.ceil(price / t - 1e-9) * t;
    if (dir === "down") return Math.floor(price / t + 1e-9) * t;
    return Math.round(price / t) * t;
  }

  // ---------- 봉 변환 ----------
  // 정규장 시작(09:00) 이후 봉만 사용. NXT 프리마켓(08:00~08:50)은 분석에서 제외.
  function sessionBars(bars1m) {
    return (bars1m || []).filter((b) => hmOf(b.ts) >= 900).sort((a, b) => a.ts - b.ts);
  }

  function aggregate(bars1m, tf) {
    if (tf <= 1) return bars1m.map((b) => ({ ...b }));
    const out = [];
    let cur = null;
    for (const b of bars1m) {
      const key = Math.floor(minOfDay(b.ts) / tf) * tf;
      if (!cur || cur.key !== key || kstDay(cur.ts) !== kstDay(b.ts)) {
        cur = { key, ts: b.ts - (minOfDay(b.ts) - key) * MIN, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v };
        out.push(cur);
      } else {
        cur.h = Math.max(cur.h, b.h);
        cur.l = Math.min(cur.l, b.l);
        cur.c = b.c;
        cur.v += b.v;
      }
    }
    return out.map(({ key, ...rest }) => rest);
  }
  const kstDay = (ts) => Math.floor((ts + KST) / 86400000);

  // ---------- 지표 ----------
  function sma(values, n) {
    const out = new Array(values.length).fill(null);
    let s = 0;
    for (let i = 0; i < values.length; i++) {
      s += values[i];
      if (i >= n) s -= values[i - n];
      if (i >= n - 1) out[i] = s / n;
    }
    return out;
  }
  // VWAP: 1분 봉 기준 누적. tf 봉 각각의 끝 시점 VWAP 를 돌려줌.
  function vwapSeries(bars1m, barsTf) {
    const res = [];
    let j = 0, pv = 0, vv = 0;
    for (let i = 0; i < barsTf.length; i++) {
      const nextTs = i + 1 < barsTf.length ? barsTf[i + 1].ts : Infinity;
      while (j < bars1m.length && bars1m[j].ts < nextTs) {
        const b = bars1m[j];
        pv += ((b.h + b.l + b.c) / 3) * b.v;
        vv += b.v;
        j++;
      }
      res.push(vv > 0 ? pv / vv : null);
    }
    return res;
  }
  function avg(arr) {
    const v = arr.filter((x) => x !== null && isFinite(x));
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  }
  function avgVol(bars, i, n) {
    const s = bars.slice(Math.max(0, i - n), i).map((b) => b.v);
    return avg(s) || 0;
  }
  function avgRange(bars, i, n) {
    const s = bars.slice(Math.max(0, i - n), i).map((b) => b.h - b.l);
    return avg(s) || 0;
  }

  function indicators(bars1m, bars) {
    const closes = bars.map((b) => b.c);
    return {
      ma5: sma(closes, 5),
      ma20: sma(closes, 20),
      vwap: vwapSeries(bars1m, bars),
    };
  }

  // ---------- 패턴 공통 ----------
  function plan(entry, stop, refHigh, isEtf) {
    entry = roundTick(entry, "up", isEtf);
    stop = roundTick(stop, "down", isEtf);
    if (!(entry > stop)) return null;
    const r = entry - stop;
    let t1 = entry + 1.5 * r;
    if (refHigh && refHigh >= entry + 1.5 * r && refHigh <= entry + 3 * r) t1 = refHigh; // 손익비 1.5~3 사이에 저항이 있으면 1차 목표로
    const t2 = Math.max(entry + 2.5 * r, t1 + r);
    return {
      entry,
      stop,
      target1: roundTick(t1, "down", isEtf),
      target2: roundTick(t2, "down", isEtf),
      risk: r,
      riskPct: (r / entry) * 100,
      rr1: (roundTick(t1, "down", isEtf) - entry) / r,
    };
  }

  // ① 페이크 이탈 (Bear Trap): 직전 지지선 아래로 잠깐 빠졌다가 3봉 안에 거래량 늘며 회복
  function patBearTrap(bars, ctx) {
    const L = bars.length - 1;
    for (let i = L; i >= Math.max(22, L - 12); i--) {
      const base = bars.slice(i - 22, i - 2);
      const support = Math.min(...base.map((b) => b.l));
      const b = bars[i];
      if (!(b.l < support * 0.999)) continue;
      // 이탈 봉 i 이후 0~3봉 안에 지지선 위 종가로 회복
      for (let k = i; k <= Math.min(L, i + 3); k++) {
        const rb = bars[k];
        if (rb.c > support && rb.v >= avgVol(bars, i, 20) * 1.2) {
          const trapLow = Math.min(...bars.slice(i, k + 1).map((x) => x.l));
          const refHigh = Math.max(...base.map((x) => x.h));
          const p = plan(Math.max(support, rb.c), trapLow - ctx.tick, refHigh, ctx.isEtf);
          if (!p) break;
          const holding = bars[L].c > support;
          return {
            id: "bearTrap", no: 1, name: "페이크 이탈", side: "buy",
            at: rb.ts, holding, level: support, plan: p,
            score: 55 + (holding ? 10 : -30) + (rb.v >= avgVol(bars, i, 20) * 2 ? 10 : 0),
            desc: `${hhmm(b.ts)}에 지지선 ${num(support)}원 아래로 빠졌다가 ${hhmm(rb.ts)}에 거래량을 동반해 회복했습니다. ` +
              (holding ? "지금도 지지선 위에 있어 재지지 확인 후 접근할 수 있는 자리입니다." : "다시 지지선 아래로 내려와 신호가 약해졌습니다."),
          };
        }
      }
    }
    return null;
  }

  // ② 진짜 지지 (True Support): 같은 가격대(±0.3%)에서 저점이 3번 이상 지켜지고, 하락 때 거래량 감소·반등 때 증가
  function patTrueSupport(bars, ctx) {
    const L = bars.length - 1;
    const win = bars.slice(Math.max(0, L - 40), L + 1);
    if (win.length < 15) return null;
    // 국소 저점
    const lows = [];
    for (let i = 2; i < win.length - 1; i++) {
      if (win[i].l <= win[i - 1].l && win[i].l <= win[i - 2].l && win[i].l <= win[i + 1].l) lows.push(win[i]);
    }
    let best = null;
    for (const a of lows) {
      const band = lows.filter((x) => Math.abs(x.l - a.l) / a.l <= 0.003);
      if (band.length >= 3 && (!best || band.length > best.length)) best = band;
    }
    if (!best) return null;
    const level = Math.min(...best.map((x) => x.l));
    const top = Math.max(...best.map((x) => x.l));
    const last = bars[L];
    if (last.c < level) return null; // 이미 깨졌으면 신호 아님
    const down = win.filter((b) => b.c < b.o).map((b) => b.v);
    const up = win.filter((b) => b.c >= b.o).map((b) => b.v);
    const volOk = avg(up) > avg(down);
    const distPct = ((last.c - top) / top) * 100;
    const refHigh = Math.max(...win.map((b) => b.h));
    const p = plan(Math.max(top, Math.min(last.c, top * 1.004)), level - 2 * ctx.tick, refHigh, ctx.isEtf);
    if (!p) return null;
    return {
      id: "trueSupport", no: 2, name: "진짜 지지", side: "buy",
      at: best[best.length - 1].ts, holding: true, level, plan: p,
      score: 45 + Math.min(best.length, 5) * 4 + (volOk ? 10 : -10) + (distPct <= 1 ? 10 : -15),
      desc: `${num(level)}~${num(top)}원 구간에서 저점이 ${best.length}번 지켜졌습니다. ` +
        (volOk ? "반등할 때 거래량이 하락할 때보다 많아 매수세가 받치는 모습입니다. " : "다만 반등 거래량이 하락 거래량보다 적어 힘이 약합니다. ") +
        (distPct <= 1 ? "현재가가 지지 구간 가까이 있어 손절 폭이 짧습니다." : `현재가가 지지 구간보다 ${distPct.toFixed(1)}% 위라 눌림을 기다리는 편이 낫습니다.`),
    };
  }

  // ③ 장대 윗꼬리 경계: 급등 뒤 윗꼬리가 몸통의 2배 이상 → 추격 매수 주의
  function patUpperWick(bars, ctx) {
    const L = bars.length - 1;
    for (let i = L; i >= Math.max(10, L - 6); i--) {
      const b = bars[i];
      const body = Math.abs(b.c - b.o);
      const upper = b.h - Math.max(b.c, b.o);
      const range = b.h - b.l;
      if (range <= 0) continue;
      const runUp = (b.h - bars[i - 10].c) / bars[i - 10].c;
      const isHigh = b.h >= Math.max(...bars.slice(0, i + 1).map((x) => x.h));
      if (upper >= 2 * Math.max(body, ctx.tick) && upper / range >= 0.5 && range >= 1.5 * avgRange(bars, i, 20) && (runUp >= 0.015 || isHigh)) {
        const after = bars.slice(i + 1);
        const reclaimed = after.some((x) => x.c > b.h);
        if (reclaimed) return null; // 고점을 다시 넘었으면 경고 해제
        return {
          id: "upperWick", no: 3, name: "장대 윗꼬리", side: "warn",
          at: b.ts, holding: true, level: b.h, plan: null,
          sellZone: roundTick(Math.max(b.c, b.o), "down", ctx.isEtf),
          score: 70,
          desc: `${hhmm(b.ts)}에 급등 뒤 긴 윗꼬리(고가 ${num(b.h)}원)가 나왔습니다. 고점에서 파는 힘이 강했다는 뜻입니다. ` +
            `이후 아직 고가를 다시 넘지 못해 추격 매수는 피하고, 보유 중이라면 ${num(roundTick(Math.max(b.c, b.o), "down", ctx.isEtf))}원 부근에서 일부 정리를 검토할 구간입니다.`,
        };
      }
    }
    return null;
  }

  // ④ 시초가 범위 돌파 (ORB): 개장 후 15분 고가·저가 범위를 거래량 동반해 위로 돌파
  function patOpeningRange(bars, ctx, bars1m) {
    if (!bars1m.length) return null;
    const open = bars1m[0].ts;
    const orBars = bars1m.filter((b) => b.ts < open + 15 * MIN);
    if (orBars.length < 10) return null;
    const orh = Math.max(...orBars.map((b) => b.h));
    const orl = Math.min(...orBars.map((b) => b.l));
    const L = bars.length - 1;
    const startIdx = bars.findIndex((b) => b.ts >= open + 15 * MIN);
    if (startIdx < 0) return { id: "orb", no: 4, name: "시초가 범위", side: "info", at: open, holding: true, level: orh, plan: null, score: 0, orh, orl, desc: `개장 후 15분 범위(${num(orl)}~${num(orh)}원)를 만드는 중입니다. 범위가 정해진 뒤 돌파 여부를 봅니다.` };
    let bi = -1;
    for (let i = startIdx; i <= L; i++) {
      if (bars[i].c > orh && bars[i].v >= avgVol(bars, i, 10) * 1.3) { bi = i; break; }
    }
    if (bi < 0) {
      return { id: "orb", no: 4, name: "시초가 범위", side: "info", at: open, holding: true, level: orh, plan: null, score: 0, orh, orl,
        desc: `개장 15분 범위는 ${num(orl)}~${num(orh)}원입니다. 아직 거래량을 동반한 상단 돌파가 없습니다.` };
    }
    const h = orh - orl;
    const last = bars[L];
    const holding = last.c > orh - Math.max(2 * ctx.tick, 0.15 * h);
    const retest = bars.slice(bi + 1).some((x) => x.l <= orh * 1.002 && x.c >= orh);
    const stop = orh - Math.max(2 * ctx.tick, 0.3 * h);
    const p = plan(orh + ctx.tick, stop, orh + h, ctx.isEtf);
    if (!p) return null;
    return {
      id: "orb", no: 4, name: "시초가 범위 돌파", side: "buy",
      at: bars[bi].ts, holding, level: orh, plan: p, orh, orl,
      score: 50 + (holding ? 10 : -35) + (retest ? 15 : 0) + (hmOf(bars[bi].ts) <= 1030 ? 5 : -10),
      desc: `개장 15분 범위(${num(orl)}~${num(orh)}원)를 ${hhmm(bars[bi].ts)}에 거래량과 함께 위로 돌파했습니다. ` +
        (retest ? "이후 상단을 다시 눌렀다가 지켜내(재지지) 신뢰도가 높아졌습니다. " : "아직 상단 재지지 확인 전입니다. ") +
        (holding ? "" : "다만 지금은 범위 안으로 되돌아와 돌파가 실패한 상태입니다."),
    };
  }

  // ⑤ 이평선 눌림: 5선>20선 상승 추세에서 이평선까지 거래량 줄며 눌렸다가 다시 양봉으로 반등
  function patMaPullback(bars, ctx, ind) {
    const L = bars.length - 1;
    if (L < 25) return null;
    const { ma5, ma20 } = ind;
    const up = ma5[L] > ma20[L] && ma20[L] > ma20[L - 5] && bars[L].c > ma20[L];
    if (!up) return null;
    let touch = -1;
    for (let i = L; i >= L - 6; i--) {
      if (bars[i].l <= ma5[i] * 1.002 || bars[i].l <= ma20[i] * 1.002) { touch = i; break; }
    }
    if (touch < 0) return null;
    const pull = bars.slice(Math.max(touch - 2, 0), touch + 1);
    const pullVol = avg(pull.map((b) => b.v));
    const volShrink = pullVol < avgVol(bars, touch - 2, 20);
    const last = bars[L];
    const trigger = last.c > last.o && last.c > ma5[L] && last.v > pullVol;
    const pullLow = Math.min(...pull.map((b) => b.l));
    const refHigh = Math.max(...bars.slice(L - 30, L + 1).map((b) => b.h));
    const p = plan(trigger ? last.c : ma5[L], Math.min(pullLow, ma20[L]) - ctx.tick, refHigh, ctx.isEtf);
    if (!p) return null;
    return {
      id: "maPullback", no: 5, name: "이평선 눌림", side: "buy",
      at: bars[touch].ts, holding: true, level: ma20[L], plan: p,
      score: 50 + (volShrink ? 10 : -5) + (trigger ? 15 : 0),
      desc: `5분선이 20분선 위에 있고 20분선이 오르는 상승 추세입니다. ${hhmm(bars[touch].ts)}에 이평선 부근까지 눌렸고, ` +
        (volShrink ? "눌림 동안 거래량이 줄었습니다. " : "눌림 거래량이 크게 줄지는 않았습니다. ") +
        (trigger ? "마지막 봉이 거래량을 늘리며 양봉으로 반등해 진입 신호가 나왔습니다." : "아직 반등 양봉 확인 전이라, 반등 확인 후 진입이 안전합니다."),
    };
  }

  // ⑥ 전고 돌파·재돌파: 이전 고점을 거래량 동반 돌파 → 눌림에서 전고 지지 → 다시 상승
  function patPriorHigh(bars, ctx) {
    const L = bars.length - 1;
    if (L < 30) return null;
    for (let j = L; j >= L - 15; j--) {
      const prior = bars.slice(0, Math.max(1, j - 5));
      const H = Math.max(...prior.map((b) => b.h));
      if (!(bars[j].c > H && bars[j - 1].c <= H && bars[j].v >= avgVol(bars, j, 20) * 1.5)) continue;
      const after = bars.slice(j + 1);
      const pullHeld = after.length > 0 && Math.min(...after.map((b) => b.l)) >= H * 0.997;
      const pulled = after.some((b) => b.l <= H * 1.004);
      const last = bars[L];
      const reBreak = pulled && pullHeld && last.c > last.o && last.c >= Math.max(...after.slice(0, -1).map((b) => b.h), bars[j].h);
      const pullLow = after.length ? Math.min(...after.map((b) => b.l)) : bars[j].l;
      const swingLow = Math.min(...bars.slice(Math.max(0, j - 20), j).map((b) => b.l));
      const p = plan(reBreak ? last.c : Math.max(H, pullLow), Math.min(H * 0.995, pullLow) - ctx.tick, H + (H - swingLow), ctx.isEtf);
      if (!p) return null;
      const failed = last.c < H * 0.997;
      return {
        id: "priorHigh", no: 6, name: reBreak ? "전고 재돌파" : "전고 돌파", side: "buy",
        at: bars[j].ts, holding: !failed, level: H, plan: p,
        score: 50 + (pullHeld && pulled ? 15 : 0) + (reBreak ? 15 : 0) + (failed ? -40 : 0),
        desc: `${hhmm(bars[j].ts)}에 전고점 ${num(H)}원을 거래량과 함께 돌파했습니다. ` +
          (failed ? "그러나 다시 전고 아래로 밀려 돌파가 실패했습니다(단기 차익 매물 주의)." :
            pulled ? (reBreak ? "눌림에서 전고를 지지한 뒤 다시 위로 올라 재돌파 신호입니다." : "눌림에서 전고를 지지하는 중이라 재돌파를 기다릴 자리입니다.")
              : "아직 눌림이 오지 않아 바로 따라 사기보다 전고 부근 눌림을 기다리는 편이 낫습니다."),
      };
    }
    return null;
  }

  // ---------- 종합 판단 ----------
  function trendOf(bars1m) {
    const b5 = aggregate(bars1m, 5);
    if (b5.length < 21) return { label: "판단 불가", up: null };
    const c = b5.map((b) => b.c);
    const m5 = sma(c, 5), m20 = sma(c, 20);
    const L = b5.length - 1;
    const up = m5[L] > m20[L] && m20[L] >= m20[L - 3];
    const down = m5[L] < m20[L] && m20[L] <= m20[L - 3];
    return { label: up ? "상승" : down ? "하락" : "횡보", up: up ? true : down ? false : null };
  }

  function timeAdvice(ts) {
    const hm = hmOf(ts);
    if (hm < 915) return { phase: "개장 직후", text: "시초가 범위가 만들어지는 중입니다. 15분 범위가 정해질 때까지 기다리는 편이 좋습니다.", penalty: -10 };
    if (hm < 1030) return { phase: "오전 주도 구간", text: "거래가 가장 활발한 시간대입니다. 시초가 범위 돌파·전고 돌파 신호의 신뢰도가 높습니다.", penalty: 5 };
    if (hm < 1400) return { phase: "장중", text: "변동이 줄어드는 시간대입니다. 이평선 눌림·진짜 지지처럼 기다렸다 들어가는 기법이 맞습니다.", penalty: 0 };
    if (hm < 1450) return { phase: "오후", text: "마감 전 방향이 나오는 시간대입니다. 목표가를 짧게 잡는 편이 좋습니다.", penalty: -5 };
    if (hm <= 1530) return { phase: "마감 임박", text: "신규 진입보다 보유 물량 정리를 우선할 시간입니다.", penalty: -25 };
    return { phase: "장 마감 후(NXT)", text: "애프터마켓은 거래가 적어 신호가 쉽게 틀립니다. 다음 거래일 계획을 세우는 용도로만 보세요.", penalty: -30 };
  }

  function analyze(bars1mRaw, opts = {}) {
    const tf = opts.tf || 1;
    const isEtf = !!opts.isEtf;
    const bars1m = sessionBars(bars1mRaw);
    if (bars1m.length < 15) return { ok: false, reason: "분석할 분봉이 부족합니다 (장 시작 후 15분 이상 필요)." };
    const bars = aggregate(bars1m, tf);
    const ind = indicators(bars1m, bars);
    const L = bars.length - 1;
    const last = bars[L];
    const ctx = { tick: tickSize(last.c, isEtf), isEtf };

    const found = [
      patBearTrap(bars, ctx),
      patTrueSupport(bars, ctx),
      patUpperWick(bars, ctx),
      patOpeningRange(bars, ctx, bars1m),
      patMaPullback(bars, ctx, ind),
      patPriorHigh(bars, ctx),
    ].filter(Boolean);

    const vwap = ind.vwap[L];
    const aboveVwap = vwap !== null && last.c >= vwap;
    const trend = trendOf(bars1m);
    const time = timeAdvice(last.ts);
    const warn = found.find((s) => s.id === "upperWick");

    // 매수 후보 점수 보정
    const buys = found.filter((s) => s.side === "buy" && s.plan).map((s) => {
      let score = Math.min(s.score, 85) + time.penalty;
      if (aboveVwap) score += 8; else score -= 12;
      if (trend.up === true) score += 10; else if (trend.up === false) score -= 15;
      if (warn) score -= 20;
      if (!s.holding) score -= 20;
      // 매수가에서 이미 멀리 달아난 자리는 지금 쓸 수 없는 계획이므로 순위를 낮춤
      const ext = (last.c - s.plan.entry) / s.plan.risk;
      if (ext > 2) score -= 25; else if (ext > 1) score -= 10; else if (ext >= -0.5) score += 5;
      return { ...s, finalScore: Math.max(0, Math.min(100, Math.round(score))) };
    }).sort((a, b) => b.finalScore - a.finalScore);

    const best = buys[0] || null;
    let action, timing;
    if (warn && (!best || best.finalScore < 70)) {
      action = { code: "avoid", label: "추격 금지", tone: "warn" };
      timing = `장대 윗꼬리 이후 고가(${num(warn.level)}원)를 다시 넘기 전까지는 신규 매수를 피하세요.`;
    } else if (!best || best.finalScore < 55) {
      action = { code: "wait", label: "관망", tone: "neutral" };
      timing = best ? `신호가 약합니다(${best.finalScore}점). ${best.name} 조건이 더 갖춰질 때까지 기다리세요.` : "규칙에 맞는 진입 자리가 아직 없습니다.";
    } else {
      const p = best.plan;
      const ext = (last.c - p.entry) / p.risk;
      if (last.c <= p.stop) {
        action = { code: "stop", label: "손절 구간", tone: "sell" };
        timing = `현재가가 손절가(${num(p.stop)}원) 아래입니다. 보유 중이면 정리, 신규 진입은 하지 않습니다.`;
      } else if (ext > 1) {
        action = { code: "chase", label: "눌림 대기", tone: "neutral" };
        timing = `이미 매수가보다 ${(ext).toFixed(1)}R 올라 추격 구간입니다. ${num(p.entry)}원 부근까지 눌렸다가 지지되면 진입을 검토하세요.`;
      } else if (ext >= -0.5) {
        action = { code: "buy", label: "진입 검토", tone: "buy" };
        timing = `지금이 계획한 매수가(${num(p.entry)}원) 부근입니다. 손절가 ${num(p.stop)}원을 먼저 정하고 진입을 검토할 수 있는 구간입니다.`;
      } else {
        action = { code: "near", label: "매수가 대기", tone: "neutral" };
        timing = `현재가가 매수가보다 낮습니다. ${num(p.entry)}원을 회복(재지지)하는 것을 확인한 뒤 진입하세요.`;
      }
    }

    return {
      ok: true, tf, bars, ind, last, tick: ctx.tick,
      vwap, aboveVwap, trend, time,
      signals: found, buys, best, action, timing, warn: warn || null,
    };
  }

  // 투자금·손실 한도로 수량 계산 (1회 거래 위험 관리)
  function positionSize(capital, riskPct, entry, stop) {
    if (!(capital > 0 && riskPct > 0 && entry > stop)) return null;
    const riskMoney = capital * (riskPct / 100);
    const byRisk = Math.floor(riskMoney / (entry - stop));
    const byCash = Math.floor(capital / entry);
    const qty = Math.max(0, Math.min(byRisk, byCash));
    return { qty, riskMoney, amount: qty * entry, maxLoss: qty * (entry - stop) };
  }

  function num(v) {
    return v === null || v === undefined || !isFinite(v) ? "-" : Math.round(v).toLocaleString("ko-KR");
  }

  const api = { tickSize, roundTick, sessionBars, aggregate, sma, vwapSeries, analyze, positionSize, hhmm, hmOf, trendOf, timeAdvice };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Scalp = api;
})(typeof window !== "undefined" ? window : globalThis);
