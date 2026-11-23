/* 데이터 가공 로직 (브라우저 + Node 테스트 공용) */
(function (root) {
  const ONE = 60 * 1000;
  const FIVE = 5 * ONE;

  // step(ms) 단위 구간 시작 시각
  function slot(ts, step = FIVE) {
    return Math.floor(ts / step) * step;
  }

  function kstHM(ts) {
    return new Date(ts + 9 * 3600e3).toISOString().slice(11, 16);
  }

  // 1분 봉 → step(1분/5분) 매수/매도 추정 (틱 규칙: 직전 체결가보다 오르면 매수 주도, 내리면 매도 주도,
  // 같으면 직전 방향을 이어받음. 방향이 없으면 절반씩 배분)
  function tickRule(bars, step = FIVE) {
    const out = new Map();
    let prevC = null;
    let lastDir = 0;
    for (const b of bars) {
      let dir;
      if (prevC === null) dir = Math.sign(b.c - b.o);
      else dir = Math.sign(b.c - prevC);
      if (dir === 0) dir = lastDir;
      else lastDir = dir;
      prevC = b.c;
      const k = slot(b.ts, step);
      if (!out.has(k)) out.set(k, { ts: k, open: b.o, high: b.h, low: b.l, close: b.c, buy: 0, sell: 0, vol: 0 });
      const s = out.get(k);
      s.high = Math.max(s.high, b.h);
      s.low = Math.min(s.low, b.l);
      s.close = b.c;
      s.vol += b.v;
      if (dir > 0) s.buy += b.v;
      else if (dir < 0) s.sell += b.v;
      else {
        s.buy += b.v / 2;
        s.sell += b.v / 2;
      }
    }
    return [...out.values()]
      .sort((a, b) => a.ts - b.ts)
      .map((s) => ({ ...s, ratio: s.buy + s.sell > 0 ? s.buy / (s.buy + s.sell) : null }));
  }

  const tickRuleFiveMin = (bars) => tickRule(bars, FIVE);

  function totalBuyRatio(slots) {
    let b = 0, s = 0;
    for (const x of slots) { b += x.buy; s += x.sell; }
    return b + s > 0 ? b / (b + s) : null;
  }

  // 바이낸스 응답 정규화
  function normTaker(arr) {
    return (arr || []).map((r) => {
      const buy = +r.buyVol, sell = +r.sellVol;
      return { ts: +r.timestamp, buy, sell, ratio: buy + sell > 0 ? buy / (buy + sell) : null };
    }).sort((a, b) => a.ts - b.ts);
  }
  function normLS(arr) {
    return (arr || []).map((r) => ({ ts: +r.timestamp, long: +r.longAccount, short: +r.shortAccount, ratio: +r.longShortRatio }))
      .sort((a, b) => a.ts - b.ts);
  }
  function normKlines(arr) {
    return (arr || []).map((k) => ({ ts: +k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5], tb: +k[9] }));
  }
  // 1분 봉의 테이커 매수 거래량(k[9])으로 1분 테이커 매수 비율 계산 (바이낸스 비율 API 는 5분이 최소)
  function takerFromKlines(klines) {
    return (klines || []).map((k) => {
      const buy = isFinite(k.tb) ? k.tb : null;
      const sell = buy === null ? null : k.v - buy;
      return { ts: k.ts, buy, sell, ratio: buy !== null && k.v > 0 ? buy / k.v : null };
    });
  }

  // 시계열에서 ts 와 같은 step 구간(없으면 ±step 이내 가장 가까운 값)을 찾음
  function lookup(series, ts, step = FIVE) {
    const t = slot(ts, step);
    let best = null, bestD = Infinity;
    for (const r of series) {
      const d = Math.abs(slot(r.ts, step) - t);
      if (d < bestD) { bestD = d; best = r; }
      if (d === 0) break;
    }
    return bestD <= step ? best : null;
  }

  function pearson(xs, ys) {
    const pts = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => x !== null && y !== null && isFinite(x) && isFinite(y));
    const n = pts.length;
    if (n < 5) return null;
    const mx = pts.reduce((a, p) => a + p[0], 0) / n;
    const my = pts.reduce((a, p) => a + p[1], 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
    return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
  }

  // 국내 step(1분/5분) 구간 기준 비교표. 롱 계정·상위 트레이더 비율은 바이낸스가 5분 단위로만 줌
  function buildComparison(krSlots, bn, step = FIVE) {
    const krBase = krSlots.length ? krSlots[0].open : null;
    const daySlots = bn.klines.filter((k) => krSlots.length && slot(k.ts, step) >= krSlots[0].ts);
    const bnBase = daySlots.length ? daySlots[0].o : null;
    const rows = krSlots.map((k) => {
      const t = lookup(bn.taker, k.ts, step);
      const g = lookup(bn.global, k.ts, FIVE);
      const p = lookup(bn.top, k.ts, FIVE);
      const kl = lookup(bn.klines, k.ts, step);
      const krChg = krBase ? (k.close / krBase - 1) * 100 : null;
      const bnChg = kl && bnBase ? (kl.c / bnBase - 1) * 100 : null;
      let verdict = null;
      if (t && t.ratio !== null && k.ratio !== null) verdict = (t.ratio >= 0.5) === (k.ratio >= 0.5) ? "agree" : "diverge";
      return {
        ts: k.ts,
        time: kstHM(k.ts),
        krClose: k.close,
        krChg,
        krBuy: k.ratio,
        krVol: k.vol,
        bnClose: kl ? kl.c : null,
        bnChg,
        bnTaker: t ? t.ratio : null,
        bnLong: g ? g.long : null,
        bnTop: p ? p.long : null,
        verdict,
      };
    });
    const judged = rows.filter((r) => r.verdict);
    const stats = {
      slots: rows.length,
      agreeRate: judged.length ? judged.filter((r) => r.verdict === "agree").length / judged.length : null,
      corrBuy: pearson(rows.map((r) => r.krBuy), rows.map((r) => r.bnTaker)),
      corrChg: pearson(rows.map((r) => r.krChg), rows.map((r) => r.bnChg)),
      krBuyAvg: totalBuyRatio(krSlots),
      bnTakerAvg: avg(rows.map((r) => r.bnTaker)),
      bnLongAvg: avg(rows.map((r) => r.bnLong)),
    };
    return { rows, stats };
  }

  function avg(a) {
    const v = a.filter((x) => x !== null && isFinite(x));
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
  }

  const api = { ONE, FIVE, slot, kstHM, tickRule, tickRuleFiveMin, takerFromKlines, totalBuyRatio, normTaker, normLS, normKlines, lookup, pearson, buildComparison };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TM = api;
})(typeof window !== "undefined" ? window : globalThis);
