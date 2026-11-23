// 종합투자: 시장별 투자자 수급 스냅샷 수집
// 네이버는 시간별 수급 이력을 주지 않고 "현재까지 누적" 값만 줍니다.
// 그래서 1분마다 스냅샷을 찍어 저장하고, 그 차이로 1분·5분 수급을 만듭니다.
//
// m.stock.naver.com/api/index/{KOSPI|KOSDAQ|FUT}/integration (2026-11 확인)
//   dealTrendInfo:    { bizdate, personalValue, foreignValue, institutionalValue }   ← 억원(선물은 네이버 표기 단위)
//   programTrendInfo: { indexDifferenceReal(차익), indexBiDifferenceReal(비차익), indexTotalReal(전체) }  ← 억원, 선물은 null
//   upDownStockInfo:  { upperCount, riseCount, lowerCount, fallCount, steadyCount }
// m.stock.naver.com/api/index/{code}/basic → closePrice, compareToPreviousClosePrice, fluctuationsRatio, marketStatus
import { NAVER_HEADERS, toNum, parseMinuteJson, latestSessionBars, mergeRawRows, kstDateStr } from "./naver.js";

export const FLOW_MARKETS = [
  { code: "KOSPI", name: "코스피", kind: "index" },
  { code: "KOSDAQ", name: "코스닥", kind: "index" },
  { code: "FUT", name: "코스피200 선물", kind: "futures" },
];

export function parseIntegration(j) {
  if (!j || typeof j !== "object") return null;
  const d = j.dealTrendInfo || {};
  const p = j.programTrendInfo || null;
  const u = j.upDownStockInfo || null;
  const info = Object.fromEntries((j.totalInfos || []).map((x) => [x.code, toNum(x.value)]));
  return {
    bizdate: d.bizdate || null,
    deal: { ind: toNum(d.personalValue), frg: toNum(d.foreignValue), ins: toNum(d.institutionalValue) },
    prog: p ? { arb: toNum(p.indexDifferenceReal), nonArb: toNum(p.indexBiDifferenceReal), total: toNum(p.indexTotalReal) } : null,
    breadth: u ? {
      upper: toNum(u.upperCount), rise: toNum(u.riseCount), lower: toNum(u.lowerCount),
      fall: toNum(u.fallCount), flat: toNum(u.steadyCount),
    } : null,
    prevClose: info.lastClosePrice ?? null,
    open: info.openPrice ?? null, high: info.highPrice ?? null, low: info.lowPrice ?? null,
    value: info.accumulatedTradingValue ?? null, // 백만원
  };
}

export function parseIndexBasic(j) {
  if (!j || typeof j !== "object") return null;
  return {
    price: toNum(j.closePrice),
    change: toNum(j.compareToPreviousClosePrice),
    rate: toNum(j.fluctuationsRatio),
    status: j.marketStatus || null,
    tradedAt: j.localTradedAt || null,
  };
}

async function getJson(url, fetchImpl) {
  const r = await fetchImpl(url, { headers: NAVER_HEADERS });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return JSON.parse(new TextDecoder("utf-8").decode(await r.arrayBuffer()));
}

// step 분 슬롯(KST) 문자열 "HHMM" (기본 1분)
export function slotOf(ts, step = 1) {
  const d = new Date(ts + 9 * 3600e3);
  const m = d.getUTCHours() * 60 + Math.floor(d.getUTCMinutes() / step) * step;
  return String(Math.floor(m / 60)).padStart(2, "0") + String(m % 60).padStart(2, "0");
}

// 1분 스냅샷 → step 분 구간마다 가장 늦은 스냅샷 하나만 남김 (예전 5분 저장분도 그대로 동작)
export function resampleSnaps(snaps, step = 5) {
  if (step <= 1) return snaps;
  const by = new Map();
  for (const s of snaps || []) {
    const m = (+s.slot.slice(0, 2)) * 60 + (+s.slot.slice(2, 4));
    const b = Math.floor(m / step) * step;
    const key = String(Math.floor(b / 60)).padStart(2, "0") + String(b % 60).padStart(2, "0");
    const cur = by.get(key);
    if (!cur || s.ts > cur.ts) by.set(key, { ...s, slot: key });
  }
  return [...by.values()].sort((a, b) => a.slot.localeCompare(b.slot));
}

export async function fetchSnapshot(fetchImpl = fetch, now = Date.now()) {
  const markets = {};
  let bizdate = null;
  await Promise.all(FLOW_MARKETS.map(async (m) => {
    const [integ, basic] = await Promise.all([
      getJson(`https://m.stock.naver.com/api/index/${m.code}/integration`, fetchImpl).catch(() => null),
      getJson(`https://m.stock.naver.com/api/index/${m.code}/basic`, fetchImpl).catch(() => null),
    ]);
    const i = parseIntegration(integ);
    const b = parseIndexBasic(basic);
    if (!i && !b) return;
    markets[m.code] = { ...(i || {}), ...(b || {}) };
    if (i && i.bizdate && !bizdate) bizdate = i.bizdate;
  }));
  return { ts: now, slot: slotOf(now), bizdate: bizdate || kstDateStr(now), markets };
}

// 지수·선물 1분 봉 (5분 분석의 가격 기준)
export async function fetchIndexMinute(code, kind, fetchImpl = fetch, now = Date.now()) {
  const CHUNKS = [["0800", "1159"], ["1200", "1559"], ["1600", "2000"]];
  for (let back = 0; back < 7; back++) {
    const day = kstDateStr(now - back * 86400e3);
    const parts = await Promise.all(CHUNKS.map(([s, e]) =>
      getJson(`https://api.stock.naver.com/chart/domestic/${kind}/${code}/minute?startDateTime=${day}${s}&endDateTime=${day}${e}`, fetchImpl)
        .then((j) => (Array.isArray(j) ? j : []))
        .catch(() => [])
    ));
    const merged = mergeRawRows(parts.flat());
    if (!merged.length) continue;
    const sess = latestSessionBars(parseMinuteJson(merged));
    if (sess.bars.length) return { code, ...sess };
  }
  return { code, date: null, bars: [] };
}

// 크론 실행 시간대: 평일 KST 08:55 ~ 16:35
export function inFlowWindow(now = Date.now()) {
  const d = new Date(now + 9 * 3600e3);
  const dow = d.getUTCDay();
  const hm = d.getUTCHours() * 100 + d.getUTCMinutes();
  return dow >= 1 && dow <= 5 && hm >= 855 && hm <= 1635;
}
