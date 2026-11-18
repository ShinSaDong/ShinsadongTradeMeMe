// GET /api/binance?path=/futures/data/takerlongshortRatio&symbol=SAMSUNGUSDT&period=5m&limit=288
// 브라우저에서 바이낸스를 직접 부르는 게 실패할 때만 쓰는 예비 프록시입니다.
// 주의: Cloudflare 서버 위치에 따라 바이낸스가 지역 제한(HTTP 451)으로 거부할 수 있습니다.
const ALLOWED = new Set([
  "/fapi/v1/klines",
  "/fapi/v1/exchangeInfo",
  "/fapi/v1/ticker/24hr",
  "/futures/data/globalLongShortAccountRatio",
  "/futures/data/topLongShortPositionRatio",
  "/futures/data/takerlongshortRatio",
]);

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const path = url.searchParams.get("path") || "";
  if (!ALLOWED.has(path)) {
    return new Response(JSON.stringify({ error: "허용되지 않은 경로" }), { status: 400 });
  }
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
