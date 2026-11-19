// Cloudflare Workers 진입점
// - /api/kr, /api/binance 는 서버 코드로 처리
// - 나머지는 Hugo 가 만든 public/ 정적 파일(ASSETS)로 응답
import { handleKr, handleBinance } from "../lib/api.js";

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (request.method === "GET" || request.method === "HEAD") {
      if (pathname === "/api/kr") return handleKr(request, (p) => ctx.waitUntil(p));
      if (pathname === "/api/binance") return handleBinance(request);
    }
    if (pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { "content-type": "application/json" } });
    }
    return env.ASSETS.fetch(request);
  },
};
