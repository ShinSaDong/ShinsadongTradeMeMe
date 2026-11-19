// 네이버 금융 데이터 수집/파싱 모듈 (Cloudflare Pages Functions 에서 사용, Node 에서도 테스트 가능)
// 네이버의 비공식 엔드포인트라 응답 형식이 바뀔 수 있어 필드명을 느슨하게 찾도록 작성했습니다.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export const NAVER_HEADERS = {
  "User-Agent": UA,
  Referer: "https://m.stock.naver.com/",
  Accept: "application/json, text/plain, */*",
};

// ---------- 공통 유틸 ----------
export function toNum(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[,\s+]/g, "").replace(/[^\d.\-]/g, "");
  if (s === "" || s === "-" || s === ".") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// "202611180905" / "20261118090500" / "2026-11-18T09:05:00" → KST 기준 epoch ms
export function kstToEpoch(str) {
  const d = String(str).replace(/\D/g, "");
  if (d.length < 12) return null;
  const y = +d.slice(0, 4), mo = +d.slice(4, 6), da = +d.slice(6, 8);
  const h = +d.slice(8, 10), mi = +d.slice(10, 12), s = d.length >= 14 ? +d.slice(12, 14) : 0;
  return Date.UTC(y, mo - 1, da, h - 9, mi, s);
}

export function kstDateStr(epochMs) {
  const d = new Date(epochMs + 9 * 3600e3);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function pickKey(obj, patterns) {
  const keys = Object.keys(obj);
  for (const p of patterns) {
    const k = keys.find((key) => p.test(key));
    if (k !== undefined) return k;
  }
  return undefined;
}

// ---------- 1분 봉 ----------
// 소스 A: api.stock.naver.com JSON 배열
export function parseMinuteJson(json) {
  const arr = Array.isArray(json) ? json : json?.priceInfos || json?.result || json?.data || [];
  if (!Array.isArray(arr) || arr.length === 0) return [];
  const s = arr[0];
  const kT = pickKey(s, [/localDateTime/i, /dateTime/i, /date/i, /time/i]);
  const kC = pickKey(s, [/^currentPrice$/i, /closePrice/i, /^close$/i, /price/i]);
  const kO = pickKey(s, [/openPrice/i, /^open$/i]);
  const kH = pickKey(s, [/highPrice/i, /^high$/i]);
  const kL = pickKey(s, [/lowPrice/i, /^low$/i]);
  const kV = pickKey(s, [/accumulatedTradingVolume/i, /tradingVolume/i, /volume/i]);
  const cumulative = kV ? /accumulated/i.test(kV) : false;
  const bars = [];
  for (const r of arr) {
    const ts = kstToEpoch(r[kT]);
    const c = toNum(r[kC]);
    if (ts === null || c === null) continue;
    bars.push({
      ts,
      o: toNum(r[kO]) ?? c,
      h: toNum(r[kH]) ?? c,
      l: toNum(r[kL]) ?? c,
      c,
      v: toNum(r[kV]) ?? 0,
    });
  }
  return normalizeVolumes(bars, cumulative ? true : undefined);
}

// 소스 B: fchart.stock.naver.com XML  <item data="202611180901|o|h|l|c|v" />
export function parseMinuteXml(xml) {
  const bars = [];
  const re = /<item\s+data="([^"]+)"/g;
  let m;
  while ((m = re.exec(xml))) {
    const p = m[1].split("|");
    if (p.length < 6) continue;
    const ts = kstToEpoch(p[0]);
    const c = toNum(p[4]);
    if (ts === null || c === null) continue;
    bars.push({ ts, o: toNum(p[1]) ?? c, h: toNum(p[2]) ?? c, l: toNum(p[3]) ?? c, c, v: toNum(p[5]) ?? 0 });
  }
  return normalizeVolumes(bars);
}

// 누적 거래량이면 분당 거래량으로 변환. forceCumulative 가 undefined 면 자동 판별.
export function normalizeVolumes(bars, forceCumulative) {
  bars.sort((a, b) => a.ts - b.ts);
  // 날짜별로 처리 (누적은 날짜가 바뀌면 리셋)
  const byDay = new Map();
  for (const b of bars) {
    const d = kstDateStr(b.ts);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(b);
  }
  for (const list of byDay.values()) {
    let cumulative = forceCumulative;
    if (cumulative === undefined && list.length >= 10) {
      let nonDec = 0;
      for (let i = 1; i < list.length; i++) if (list[i].v >= list[i - 1].v) nonDec++;
      const last = list[list.length - 1].v;
      const sorted = list.map((x) => x.v).sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      cumulative = nonDec / (list.length - 1) > 0.97 && last > median * 3;
    }
    if (cumulative) {
      let prev = 0;
      for (const b of list) {
        const cur = b.v;
        b.v = Math.max(0, cur - prev);
        prev = cur;
      }
    }
  }
  return bars;
}

// 가장 최근 거래일의 08:00~20:00 봉만 남김 (NXT 프리·애프터마켓 데이터가 있으면 포함)
export function latestSessionBars(bars) {
  if (!bars.length) return { date: null, bars: [] };
  const date = kstDateStr(bars[bars.length - 1].ts);
  const out = bars.filter((b) => {
    if (kstDateStr(b.ts) !== date) return false;
    const hm = Number(new Date(b.ts + 9 * 3600e3).toISOString().slice(11, 16).replace(":", ""));
    return hm >= 800 && hm <= 2000;
  });
  return { date, bars: out };
}

// ---------- 투자자별 수급 ----------
// 소스 A: m.stock.naver.com/api/stock/{code}/trend
export function parseTrendJson(json) {
  const arr = Array.isArray(json) ? json : json?.result || json?.data || [];
  if (!Array.isArray(arr) || !arr.length) return [];
  const s = arr[0];
  const kD = pickKey(s, [/bizdate/i, /date/i]);
  const kI = pickKey(s, [/individual.*(Pure|Net).*Quant/i, /individual/i]);
  const kF = pickKey(s, [/foreign(er)?.*(Pure|Net).*Quant/i, /foreigner(?!.*Ratio)/i]);
  const kO = pickKey(s, [/organ.*(Pure|Net).*Quant/i, /institution/i, /organ/i]);
  const kC = pickKey(s, [/closePrice/i, /close/i]);
  const kR = pickKey(s, [/HoldRatio/i, /ratio/i]);
  return arr
    .map((r) => ({
      date: String(r[kD] ?? "").replace(/\D/g, "").slice(0, 8),
      close: toNum(r[kC]),
      individual: toNum(r[kI]),
      foreign: toNum(r[kF]),
      institution: toNum(r[kO]),
      foreignHoldRatio: kR ? toNum(r[kR]) : null,
      approx: false,
    }))
    .filter((r) => r.date.length === 8);
}

// 소스 B: finance.naver.com/item/frgn.naver (EUC-KR HTML). 숫자만 쓰므로 인코딩과 무관하게 파싱.
// 행 구성: 날짜 | 종가 | 전일비 | 등락률 | 거래량 | 기관 순매매량 | 외국인 순매매량 | 외국인 보유주수 | 외국인 보유율
// 개인 순매수는 이 페이지에 없어서 -(기관+외국인) 으로 근사합니다 (approx: true).
export function parseFrgnHtml(html) {
  const rows = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = trRe.exec(html))) {
    const tds = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((x) =>
      x[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim()
    );
    if (tds.length < 9 || !/^\d{4}\.\d{2}\.\d{2}$/.test(tds[0])) continue;
    const signed = (txt, raw) => {
      const n = toNum(txt);
      return n;
    };
    const inst = signed(tds[5]);
    const frgn = signed(tds[6]);
    rows.push({
      date: tds[0].replace(/\./g, ""),
      close: toNum(tds[1]),
      individual: inst !== null && frgn !== null ? -(inst + frgn) : null,
      foreign: frgn,
      institution: inst,
      foreignHoldRatio: toNum(tds[8]),
      approx: true,
    });
  }
  return rows;
}

// ---------- 시세 기본 정보 ----------
export function parseBasicJson(json) {
  if (!json || typeof json !== "object") return null;
  return {
    name: json.stockName ?? json.itemName ?? null,
    price: toNum(json.closePrice ?? json.currentPrice ?? json.now),
    change: toNum(json.compareToPreviousClosePrice),
    changeRate: toNum(json.fluctuationsRatio),
    marketStatus: json.marketStatus ?? null,
    tradedAt: json.localTradedAt ?? null,
  };
}

// ---------- 원격 호출 ----------
async function fetchText(url, fetchImpl) {
  const res = await fetchImpl(url, { headers: NAVER_HEADERS });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = await res.arrayBuffer();
  // latin1 로 디코딩해도 숫자/태그 파싱에는 문제 없음 (EUC-KR 페이지 대응)
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return s;
}

function ymd(epochMs) {
  return kstDateStr(epochMs);
}

// 구간별로 받은 원본 행을 시간 기준으로 합치고 중복 제거
export function mergeRawRows(rows) {
  if (!rows.length) return [];
  const kT = pickKey(rows[0], [/localDateTime/i, /dateTime/i, /date/i, /time/i]);
  const map = new Map();
  for (const r of rows) {
    const k = String(r[kT] ?? "");
    if (k) map.set(k, r);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map((e) => e[1]);
}

export async function fetchMinuteBars(code, fetchImpl = fetch, now = Date.now()) {
  const errors = [];
  // A. JSON — 한 번에 받을 수 있는 분봉 개수에 상한이 있어서(약 380개) 하루를 3구간으로 나눠 받고 합칩니다.
  //    오늘 데이터가 없으면(주말·휴일·장 시작 전) 하루씩 거슬러 올라가며 최대 7일까지 찾습니다.
  try {
    const CHUNKS = [["0800", "1159"], ["1200", "1559"], ["1600", "2000"]];
    for (let back = 0; back < 7; back++) {
      const day = ymd(now - back * 86400e3);
      const parts = await Promise.all(
        CHUNKS.map(([s, e]) =>
          fetchText(`https://api.stock.naver.com/chart/domestic/item/${code}/minute?startDateTime=${day}${s}&endDateTime=${day}${e}`, fetchImpl)
            .then((t) => {
              const j = JSON.parse(t);
              return Array.isArray(j) ? j : j?.priceInfos || j?.result || j?.data || [];
            })
            .catch(() => [])
        )
      );
      const merged = mergeRawRows(parts.flat());
      if (!merged.length) continue;
      const sess = latestSessionBars(parseMinuteJson(merged));
      if (sess.bars.length) return { source: "api.stock.naver.com", ...sess };
    }
    errors.push("A: empty");
  } catch (e) {
    errors.push("A: " + e.message);
  }
  // B. XML
  try {
    const url = `https://fchart.stock.naver.com/sise.nhn?symbol=${code}&timeframe=minute&count=2000&requestType=0`;
    const txt = await fetchText(url, fetchImpl);
    const bars = parseMinuteXml(txt);
    const sess = latestSessionBars(bars);
    if (sess.bars.length) return { source: "fchart.stock.naver.com", ...sess };
    errors.push("B: empty");
  } catch (e) {
    errors.push("B: " + e.message);
  }
  throw new Error("분봉 데이터를 가져오지 못했습니다 (" + errors.join("; ") + ")");
}

export async function fetchInvestor(code, fetchImpl = fetch) {
  const errors = [];
  try {
    const txt = await fetchText(`https://m.stock.naver.com/api/stock/${code}/trend?pageSize=20`, fetchImpl);
    const rows = parseTrendJson(JSON.parse(txt));
    if (rows.length && rows.some((r) => r.individual !== null || r.foreign !== null)) return { source: "m.stock.naver.com", rows };
    errors.push("A: empty");
  } catch (e) {
    errors.push("A: " + e.message);
  }
  try {
    const rows = [];
    for (const page of [1, 2]) {
      const html = await fetchText(`https://finance.naver.com/item/frgn.naver?code=${code}&page=${page}`, fetchImpl);
      rows.push(...parseFrgnHtml(html));
    }
    if (rows.length) return { source: "finance.naver.com", rows: rows.slice(0, 20) };
    errors.push("B: empty");
  } catch (e) {
    errors.push("B: " + e.message);
  }
  throw new Error("수급 데이터를 가져오지 못했습니다 (" + errors.join("; ") + ")");
}

export async function fetchBasic(code, fetchImpl = fetch) {
  try {
    const txt = await fetchText(`https://m.stock.naver.com/api/stock/${code}/basic`, fetchImpl);
    return parseBasicJson(JSON.parse(txt));
  } catch {
    return null;
  }
}
