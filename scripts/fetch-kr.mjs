// GitHub Pages 용: 빌드 직전에 네이버 금융 데이터를 받아 정적 JSON 으로 저장합니다.
// (Cloudflare Pages 에서는 이 스크립트 대신 functions/api/kr.js 가 실시간으로 가져옵니다.)
// 사용: node scripts/fetch-kr.mjs [출력폴더=static/data/kr]
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fetchMinuteBars, fetchInvestor, fetchBasic } from "../lib/naver.js";

const outDir = process.argv[2] || "static/data/kr";
mkdirSync(outDir, { recursive: true });

const yaml = readFileSync(new URL("../data/symbols.yaml", import.meta.url), "utf8");
const codes = [...yaml.matchAll(/krx:\s*"?(\d{6})"?/g)].map((m) => m[1]);

let ok = 0;
for (const code of codes) {
  const now = Date.now();
  try {
    const [minute, basic] = await Promise.all([fetchMinuteBars(code), fetchBasic(code)]);
    writeFileSync(`${outDir}/${code}-minute.json`, JSON.stringify({ code, ...minute, basic, fetchedAt: now }));
    const hm = (t) => new Date(t + 9 * 3600e3).toISOString().slice(11, 16);
    console.log(`✓ ${code} minute ${minute.date} ${minute.bars.length} bars ${hm(minute.bars[0].ts)}~${hm(minute.bars.at(-1).ts)} (${minute.source})`);
    ok++;
  } catch (e) {
    writeFileSync(`${outDir}/${code}-minute.json`, JSON.stringify({ code, error: e.message, fetchedAt: now }));
    console.log(`✗ ${code} minute: ${e.message}`);
  }
  try {
    const inv = await fetchInvestor(code);
    writeFileSync(`${outDir}/${code}-investor.json`, JSON.stringify({ code, ...inv, fetchedAt: now }));
    console.log(`✓ ${code} investor ${inv.rows.length} rows (${inv.source})`);
  } catch (e) {
    writeFileSync(`${outDir}/${code}-investor.json`, JSON.stringify({ code, error: e.message, fetchedAt: now }));
    console.log(`✗ ${code} investor: ${e.message}`);
  }
}
console.log(`done: ${ok}/${codes.length} minute files`);

// ---- 진단용: 네이버 원본 응답 일부를 저장 (data/kr/_debug.json) ----
try {
  const { NAVER_HEADERS } = await import("../lib/naver.js");
  const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, "");
  const get = async (u) => {
    try {
      const r = await fetch(u, { headers: NAVER_HEADERS });
      const t = await r.text();
      return { status: r.status, len: t.length, head: t.slice(0, 1500), tail: t.slice(-600) };
    } catch (e) { return { error: String(e) }; }
  };
  const dbg = {
    at: new Date().toISOString(),
    a_morning: await get(`https://api.stock.naver.com/chart/domestic/item/005930/minute?startDateTime=${day}0800&endDateTime=${day}1159`),
    a_plain: await get(`https://api.stock.naver.com/chart/domestic/item/005930/minute`),
    b: await get(`https://fchart.stock.naver.com/sise.nhn?symbol=005930&timeframe=minute&count=1500&requestType=0`),
  };
  writeFileSync(`${outDir}/_debug.json`, JSON.stringify(dbg, null, 1));
  console.log("debug saved");
} catch (e) { console.log("debug failed", e.message); }
