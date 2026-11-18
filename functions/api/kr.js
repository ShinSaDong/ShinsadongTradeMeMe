// GET /api/kr?code=005930&type=minute|investor
// 브라우저에서 네이버 금융을 직접 부를 수 없어서(CORS) Cloudflare Pages Function 이 대신 가져옵니다.
import { fetchMinuteBars, fetchInvestor, fetchBasic } from "../../lib/naver.js";

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

export async function onRequestGet({ request, waitUntil }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const type = url.searchParams.get("type") || "minute";
  if (!/^\d{6}$/.test(code)) return json({ error: "code 는 6자리 종목코드여야 합니다" }, 400);
  if (!(type in TTL)) return json({ error: "type 은 minute 또는 investor" }, 400);

  const cache = caches.default;
  const cacheKey = new Request(`${url.origin}/api/kr?code=${code}&type=${type}`, { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  try {
    let body;
    if (type === "minute") {
      const [minute, basic] = await Promise.all([fetchMinuteBars(code), fetchBasic(code)]);
      body = { code, ...minute, basic, fetchedAt: Date.now() };
    } else {
      body = { code, ...(await fetchInvestor(code)), fetchedAt: Date.now() };
    }
    const res = json(body, 200, TTL[type]);
    waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
}
