// /api/kr, /api/binance 공용 처리기
// Cloudflare Workers(worker/index.js)와 Pages Functions(functions/api/*.js)가 함께 씁니다.
import { fetchMinuteBars, fetchInvestor, fetchBasic, fetchRanking } from "./naver.js";
import { fetchSnapshot, fetchIndexMinute, FLOW_MARKETS, resampleSnaps, fetchIndexDaily, fetchIndexTrend } from "./flow.js";
import { kstDateStr } from "./naver.js";

// GET /api/flow?date=YYYYMMDD&step=1|5
// 저장된 1분 스냅샷(step=5 면 5분마다 마지막 값만) + 지금 시점 스냅샷 + 지수·선물 1분 봉. store 는 FlowStore 스텁(없으면 현재값만).
export async function handleFlow(request, store, waitUntil = () => {}) {
  const url = new URL(request.url);
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const reqDate = url.searchParams.get("date");
  const lite = url.searchParams.get("lite") === "1"; // 홈 화면용: 현재 스냅샷만
  const step = url.searchParams.get("step") === "1" ? 1 : 5;
  const cacheKey = new Request(`${url.origin}/api/flow?date=${reqDate || "latest"}&lite=${lite ? 1 : 0}&step=${step}`, { method: "GET" });
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }
  try {
    const [live, days] = await Promise.all([
      fetchSnapshot().catch(() => null),
      store && !lite ? store.days(20) : Promise.resolve([]),
    ]);
    if (lite) {
      const ok = live && Object.keys(live.markets || {}).length > 0;
      const res = json({ date: ok ? live.bizdate : null, days: [], snaps: ok ? [live] : [], live: ok ? live : null, minutes: {}, fetchedAt: Date.now() }, 200, 60);
      if (cache) waitUntil(cache.put(cacheKey, res.clone()));
      return res;
    }
    const date = reqDate || (live && Object.keys(live.markets || {}).length ? live.bizdate : null) || (days[0] && days[0].day) || null;
    let snaps = store && date ? await store.day(date) : [];
    // 저장분에 지금 값이 없으면 붙여서 보여줌(크론이 늦어도 최신값 표시)
    const liveOk = live && Object.keys(live.markets || {}).length > 0;
    // 지금 값이 저장된 같은 1분 구간 값보다 새로우면 바꿔 끼우고, 없으면 붙임(크론이 늦어도 최신값 표시)
    if (liveOk && live.bizdate === date) {
      const i = snaps.findIndex((s) => s.slot === live.slot);
      if (i < 0) snaps = [...snaps, { ...live, live: true }];
      else if (live.ts > snaps[i].ts) snaps = [...snaps.slice(0, i), { ...live, live: true }, ...snaps.slice(i + 1)];
    }
    snaps = resampleSnaps(snaps, step);
    const minutes = {};
    await Promise.all(FLOW_MARKETS.map(async (m) => {
      minutes[m.code] = await fetchIndexMinute(m.code, m.kind).catch(() => ({ bars: [] }));
    }));
    const body = { date, step, days: days.map((d) => d.day), snaps, live: liveOk ? live : null, minutes, fetchedAt: Date.now() };
    const res = json(body, 200, 60);
    if (cache) waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
}

// GET /api/rank?n=50&etf=0&by=volume|value
// 코스피+코스닥 거래량 상위(각 100개)를 합쳐서 정렬 후 상위 n개. etf=0 이면 ETF·ETN 제외.
export async function handleRank(request, waitUntil = () => {}) {
  const url = new URL(request.url);
  const n = Math.min(100, Math.max(1, parseInt(url.searchParams.get("n") || "50", 10) || 50));
  const etf = url.searchParams.get("etf") === "1";
  const by = url.searchParams.get("by") === "value" ? "value" : "volume";

  const cache = typeof caches !== "undefined" ? caches.default : null;
  const cacheKey = new Request(`${url.origin}/api/rank?n=${n}&etf=${etf ? 1 : 0}&by=${by}`, { method: "GET" });
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }
  try {
    const all = await fetchRanking();
    const list = all
      .filter((s) => etf || s.type === "stock")
      .sort((a, b) => (b[by] || 0) - (a[by] || 0))
      .slice(0, n)
      .map((s, i) => ({ rank: i + 1, ...s }));
    const res = json({ by, etf, count: list.length, stocks: list, fetchedAt: Date.now() }, 200, 60);
    if (cache) waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
}

const TTL = { minute: 60, investor: 600 };

function json(body, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${maxAge}`,
      "access-control-allow-origin": "*",
    },
  });
}

// GET /api/kr?code=005930&type=minute|investor
// 브라우저에서 네이버 금융을 직접 부를 수 없어서(CORS) 서버가 대신 가져옵니다.
export async function handleKr(request, waitUntil = () => {}) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const type = url.searchParams.get("type") || "minute";
  if (!/^\d{6}$/.test(code)) return json({ error: "code 는 6자리 종목코드여야 합니다" }, 400);
  if (!(type in TTL)) return json({ error: "type 은 minute 또는 investor" }, 400);

  const cache = typeof caches !== "undefined" ? caches.default : null;
  const cacheKey = new Request(`${url.origin}/api/kr?code=${code}&type=${type}`, { method: "GET" });
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  try {
    let body;
    if (type === "minute") {
      const [minute, basic] = await Promise.all([fetchMinuteBars(code), fetchBasic(code)]);
      body = { code, ...minute, basic, fetchedAt: Date.now() };
    } else {
      body = { code, ...(await fetchInvestor(code)), fetchedAt: Date.now() };
    }
    const res = json(body, 200, TTL[type]);
    if (cache) waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
}

// GET /api/binance?path=/futures/data/takerlongshortRatio&symbol=SAMSUNGUSDT&period=5m&limit=288
// 브라우저에서 바이낸스를 직접 부르는 게 실패할 때만 쓰는 예비 프록시.
// Cloudflare 서버 위치에 따라 바이낸스가 지역 제한(HTTP 451)으로 거부할 수 있습니다.
const ALLOWED = new Set([
  "/fapi/v1/klines",
  "/fapi/v1/exchangeInfo",
  "/fapi/v1/ticker/24hr",
  "/futures/data/globalLongShortAccountRatio",
  "/futures/data/topLongShortPositionRatio",
  "/futures/data/takerlongshortRatio",
]);

export async function handleBinance(request) {
  const url = new URL(request.url);
  const path = url.searchParams.get("path") || "";
  if (!ALLOWED.has(path)) return json({ error: "허용되지 않은 경로" }, 400);
  url.searchParams.delete("path");
  const target = `https://fapi.binance.com${path}?${url.searchParams.toString()}`;
  const res = await fetch(target, { cf: { cacheTtl: path.includes("exchangeInfo") ? 3600 : 60, cacheEverything: true } });
  return new Response(res.body, {
    status: res.status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
      "access-control-allow-origin": "*",
    },
  });
}

// GET /api/month?ym=YYYYMM
// 홈 화면 달력: 그 달 거래일마다 코스피·코스닥 종가·등락률과 개인·외국인·기관 순매수(억원).
// 저장된 1분 스냅샷이 있는 날은 프로그램·상승/하락 종목 수·선물 외국인까지 함께 줌.
export async function handleMonth(request, store, waitUntil = () => {}) {
  const url = new URL(request.url);
  const now = Date.now();
  const today = kstDateStr(now);
  const k = new Date(now + 9 * 3600e3);
  const hm = k.getUTCHours() * 100 + k.getUTCMinutes();
  const ym = /^\d{6}$/.test(url.searchParams.get("ym") || "") ? url.searchParams.get("ym") : today.slice(0, 6);
  const liveWindow = ym === today.slice(0, 6) && hm >= 850 && hm <= 1640;
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const cacheKey = new Request(`${url.origin}/api/month?ym=${ym}`, { method: "GET" });
  if (cache) { const hit = await cache.match(cacheKey); if (hit) return hit; }
  try {
    const [kp, kq, stored, saved] = await Promise.all([
      fetchIndexDaily("KOSPI", 30), fetchIndexDaily("KOSDAQ", 30),
      store ? store.monthLast(ym) : [], store ? store.getDaily(ym) : {},
    ]);
    const kqMap = new Map(kq.map((r) => [r.date, r]));
    const snapBy = new Map(stored.map((x) => [x.bizdate, x]));
    const days = [];
    const missing = [];
    for (const p of kp.filter((r) => r.date.startsWith(ym)).sort((a, b) => a.date.localeCompare(b.date))) {
      const q = kqMap.get(p.date) || {};
      const d = { date: p.date, kospi: { close: p.close, rate: p.rate }, kosdaq: { close: q.close ?? null, rate: q.rate ?? null } };
      const sn = snapBy.get(p.date);
      if (sn && sn.markets) {
        const M = sn.markets, K = M.KOSPI || {}, Q = M.KOSDAQ || {}, F = M.FUT || {};
        const br = (x) => (x.breadth ? { up: (x.breadth.rise || 0) + (x.breadth.upper || 0), down: (x.breadth.fall || 0) + (x.breadth.lower || 0) } : null);
        d.flows = { KOSPI: K.deal || null, KOSDAQ: Q.deal || null };
        d.prog = { KOSPI: K.prog || null, KOSDAQ: Q.prog || null };
        d.breadth = { KOSPI: br(K), KOSDAQ: br(Q) };
        d.fut = F.deal ? { frg: F.deal.frg, rate: F.rate ?? null } : null;
        d.source = "store";
        d.asOf = sn.ts;
      } else if (saved[p.date]) {
        Object.assign(d, saved[p.date], { source: "naver" });
      } else missing.push(d);
      days.push(d);
    }
    // 저장분이 없는 날은 네이버 일별 투자자 매매로 채움 (한 번에 최대 20일, 지난 날만 저장)
    const toSave = [];
    await Promise.all(missing.slice(-20).map(async (d) => {
      const [a, b] = await Promise.all([fetchIndexTrend("KOSPI", d.date).catch(() => null), fetchIndexTrend("KOSDAQ", d.date).catch(() => null)]);
      d.flows = { KOSPI: a, KOSDAQ: b };
      d.source = "naver";
      if (a && (d.date < today || hm >= 1640)) toSave.push([d.date, { flows: d.flows }]);
    }));
    if (store && toSave.length) waitUntil(store.putDaily(toSave));
    const body = { ym, today, hm, days, fetchedAt: now };
    const res = json(body, 200, liveWindow ? 60 : 600);
    if (cache) waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
}
